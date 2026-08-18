/**
 * CodeActionMenuPlugin
 *
 * 1. Tracks each `code.editor-code` element via MutationObserver + Lexical updates.
 * 2. Portals the Copy button to `.editor-container` with position:absolute,
 *    keeping it completely OUTSIDE Lexical's internal <code> children to avoid
 *    any DOM reconciliation or selection conflicts.
 * 3. Aligns the Copy button perfectly inside the top-right of the 32px header bar.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalEditor, $getNearestNodeFromDOMNode } from 'lexical';
import { $isCodeNode } from '@lexical/code';

// ── SVG icons ─────────────────────────────────────────────────────────────────
function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Copy button inside code block header ─────────────────────────────────────
function CopyButton({ codeEl, editor }: { codeEl: HTMLElement; editor: LexicalEditor }) {
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    const update = () => {
      if (!codeEl.isConnected) return;
      const container = codeEl.closest('.editor-container') || codeEl.parentElement;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const r = codeEl.getBoundingClientRect();
      if (r.width === 0) return;

      setPos({
        top: r.top - cRect.top + 4,
        right: cRect.right - r.right + 8,
      });
    };

    update();

    window.addEventListener('resize', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(codeEl);

    const container = codeEl.closest('.editor-container');
    if (container) ro.observe(container);

    return () => {
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [codeEl]);

  const handleCopy = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let content = '';
    try {
      editor.getEditorState().read(() => {
        if (!codeEl.isConnected) return;
        const node = $getNearestNodeFromDOMNode(codeEl);
        if ($isCodeNode(node)) content = node.getTextContent();
      });
    } catch (_) { /* ignore */ }

    if (!content) {
      content = codeEl.innerText || codeEl.textContent || '';
    }

    // Forward code content to React Native native clipboard
    window.ReactNativeWebView?.postMessage(
      JSON.stringify({ type: 'COPY_CODE_CONTENT', payload: content })
    );

    try {
      navigator.clipboard?.writeText(content).catch(() => {});
    } catch {
      // ignore
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editor, codeEl]);

  if (!pos) return null;

  return (
    <button
      type="button"
      className={`code-copy-btn${copied ? ' copied' : ''}`}
      onClick={handleCopy}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={handleCopy}
      onMouseDown={handleCopy}
      title="Copy code"
      style={{
        position: 'absolute',
        top: pos.top,
        right: pos.right,
        zIndex: 10,
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span>{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  );
}

// ── Plugin ─────────────────────────────────────────────────────────────────────
export default function CodeActionMenuPlugin(): React.ReactElement | null {
  const [editor] = useLexicalComposerContext();
  const [codeEls, setCodeEls] = useState<HTMLElement[]>([]);
  const rafRef = useRef<number | null>(null);

  // ── Scan for code elements ────────────────────────────────────────────────
  useEffect(() => {
    const scan = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const root = editor.getRootElement();
        if (!root) return;
        const container = root.closest('[class*="editor"]') ?? root.parentElement ?? document.body;
        const els = Array.from(container.querySelectorAll<HTMLElement>('code.editor-code'));
        setCodeEls(prev => {
          if (prev.length === els.length && prev.every((el, i) => el === els[i])) return prev;
          return els;
        });
      });
    };

    scan();
    const unregisterUpdate = editor.registerUpdateListener(scan);
    const root = editor.getRootElement();
    const observer = new MutationObserver(scan);
    observer.observe(root?.parentElement ?? document.body, { childList: true, subtree: true });

    return () => {
      unregisterUpdate();
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [editor]);

  if (codeEls.length === 0) return null;

  const container = editor.getRootElement()?.closest('.editor-container') || document.body;

  // Portal each copy button to .editor-container (outside code node)
  return (
    <>
      {codeEls.map((el, i) =>
        ReactDOM.createPortal(
          <CopyButton key={i} codeEl={el} editor={editor} />,
          container,
        )
      )}
    </>
  );
}
