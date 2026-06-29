/**
 * CodeActionMenuPlugin
 *
 * 1. Tracks each `code.editor-code` element via MutationObserver + Lexical updates.
 * 2. Adds touch + scroll listeners to update `--csx` CSS variable so the
 *    ::before (gutter) and ::after (header) pseudo-elements counter-scroll
 *    smoothly without wobble.
 * 3. Portals the Copy button to document.body with position:fixed so it is
 *    NEVER clipped or hidden by the code element's overflow-x:auto.
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

// ── Copy button — portaled to document.body, position:fixed ───────────────────
// This means it is NEVER inside the overflow-x:auto <code> element,
// so it can never be clipped or hidden, regardless of scroll state.
function CopyButton({ codeEl, editor }: { codeEl: HTMLElement; editor: LexicalEditor }) {
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  // Compute fixed position from the code element's bounding rect
  useEffect(() => {
    const update = () => {
      if (!codeEl.isConnected) return;
      const r = codeEl.getBoundingClientRect();
      if (r.width === 0) return;
      setPos({
        top: r.top + 5,
        right: window.innerWidth - r.right + 10,
      });
    };

    update();

    // Re-compute if the window resizes (orientation change etc.)
    window.addEventListener('resize', update, { passive: true });

    // Re-compute if the code block height changes (lines added/removed)
    const ro = new ResizeObserver(update);
    ro.observe(codeEl);

    // Re-compute if parent container scrolls (editor vertical scroll)
    let el: HTMLElement | null = codeEl.parentElement;
    const scrollParents: HTMLElement[] = [];
    while (el) {
      el.addEventListener('scroll', update, { passive: true });
      scrollParents.push(el);
      el = el.parentElement;
    }

    return () => {
      window.removeEventListener('resize', update);
      ro.disconnect();
      scrollParents.forEach(p => p.removeEventListener('scroll', update));
    };
  }, [codeEl]);

  const handleCopy = useCallback((e: React.MouseEvent) => {
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

    if (!content) return;

    navigator.clipboard.writeText(content).catch(() => {
      window.ReactNativeWebView?.postMessage(
        JSON.stringify({ type: 'COPY_CODE_CONTENT', payload: content })
      );
    });
    window.ReactNativeWebView?.postMessage(
      JSON.stringify({ type: 'COPY_CODE_RESULT', payload: 'ok' })
    );

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editor, codeEl]);

  if (!pos) return null;

  return (
    <button
      className={`code-copy-btn${copied ? ' copied' : ''}`}
      onMouseDown={handleCopy}
      title="Copy code"
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
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

  // ── Scroll + touch listeners → update --csx for gutter/header transforms ──
  // Using touchmove fires BEFORE the browser composites the scroll,
  // which eliminates the 1-frame wobble seen with scroll-only approach.
  useEffect(() => {
    if (codeEls.length === 0) return;
    const cleanups: (() => void)[] = [];

    for (const el of codeEls) {
      let touchStartX = 0;
      let scrollAtTouchStart = 0;

      const setCsx = (v: number) => {
        el.style.setProperty('--csx', `${v}px`);
      };

      const onTouchStart = (e: TouchEvent) => {
        touchStartX = e.touches[0].clientX;
        scrollAtTouchStart = el.scrollLeft;
      };

      const onTouchMove = (e: TouchEvent) => {
        // Estimate scroll offset from touch delta — fires before scroll compositing
        const delta = touchStartX - e.touches[0].clientX;
        const estimated = Math.max(
          0,
          Math.min(el.scrollWidth - el.clientWidth, scrollAtTouchStart + delta)
        );
        setCsx(estimated);
      };

      const onScroll = () => {
        // Fires after compositing — corrects any estimation drift
        setCsx(el.scrollLeft);
      };

      setCsx(el.scrollLeft);
      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: true });
      el.addEventListener('scroll', onScroll, { passive: true });

      cleanups.push(() => {
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('scroll', onScroll);
        el.style.removeProperty('--csx');
      });
    }

    return () => cleanups.forEach(fn => fn());
  }, [codeEls]);

  if (codeEls.length === 0) return null;

  // Portal each copy button to document.body (NOT into the <code> element)
  return (
    <>
      {codeEls.map((el, i) =>
        ReactDOM.createPortal(
          <CopyButton key={i} codeEl={el} editor={editor} />,
          document.body,
        )
      )}
    </>
  );
}
