/**
 * CodeActionMenuPlugin — renders Copy & Download action buttons
 * in the top-right corner of every code block in the editor.
 *
 * Uses a React portal to mount buttons inside each .editor-code DOM node.
 * Communicates with React Native via window.ReactNativeWebView.postMessage.
 */
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalEditor, $getNearestNodeFromDOMNode } from 'lexical';
import { CodeNode, $isCodeNode } from '@lexical/code';

const CODE_EXTENSIONS: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  html: 'html',
  css: 'css',
  python: 'py',
  markdown: 'md',
  json: 'json',
  rust: 'rs',
  go: 'go',
  cpp: 'cpp',
  c: 'c',
  java: 'java',
};

// ── Code action bar rendered into each code block ─────────────────────────────
function CodeActionBar({ codeEl, editor }: { codeEl: HTMLElement; editor: LexicalEditor }) {
  const [copied, setCopied] = useState(false);

  const getContentAndLanguage = (): { content: string; language: string } => {
    let content = '';
    let language = '';
    editor.getEditorState().read(() => {
      const node = $getNearestNodeFromDOMNode(codeEl);
      if ($isCodeNode(node)) {
        content = node.getTextContent();
        language = node.getLanguage() || '';
      }
    });
    return { content, language };
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { content } = getContentAndLanguage();
    
    // Attempt standard browser clipboard copy first
    navigator.clipboard.writeText(content).then(() => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'COPY_CODE_RESULT', payload: 'ok' }));
    }).catch(() => {
      // Fallback to React Native clipboard if clipboard API is blocked
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'COPY_CODE_CONTENT', payload: content }));
    });
    
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { content, language } = getContentAndLanguage();
    const ext = CODE_EXTENSIONS[language] || 'txt';
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `${ts}.${ext}`;

    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'DOWNLOAD_CODE_CONTENT',
      payload: { content, filename, language },
    }));
  };

  return (
    <div className="code-action-bar" onMouseDown={e => e.preventDefault()}>
      <button
        className="code-action-btn"
        onMouseDown={handleCopy}
        title="Copy code"
      >
        {copied ? '✓ Copied' : '⎘ Copy'}
      </button>
      <button
        className="code-action-btn"
        onMouseDown={handleDownload}
        title="Download file"
      >
        ↓ Save
      </button>
    </div>
  );
}

// ── Main plugin ───────────────────────────────────────────────────────────────
export default function CodeActionMenuPlugin(): React.ReactElement | null {
  const [editor] = useLexicalComposerContext();
  const [codeEls, setCodeEls] = useState<HTMLElement[]>([]);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const updateCodeEls = () => {
      const els = Array.from(
        (root.closest('.editor-container') ?? root.parentElement ?? document.body)
          .querySelectorAll<HTMLElement>('code.editor-code')
      );
      setCodeEls(els);
    };

    updateCodeEls();

    const observer = new MutationObserver(updateCodeEls);
    observer.observe(root.parentElement ?? document.body, {
      childList: true,
      subtree: true,
    });

    return () => { observer.disconnect(); };
  }, [editor]);

  if (codeEls.length === 0) return null;

  return (
    <>
      {codeEls.map((el, i) => {
        if (!el.style.position) el.style.position = 'relative';
        return ReactDOM.createPortal(
          <CodeActionBar key={i} codeEl={el} editor={editor} />,
          el,
        );
      })}
    </>
  );
}
