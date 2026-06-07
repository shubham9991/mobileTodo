import React, { useEffect, useState, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isCodeNode, CodeNode, getLanguageFriendlyName } from '@lexical/code';
import { $getSelection, $isRangeSelection, LexicalEditor } from 'lexical';
import { createPortal } from 'react-dom';

const LANGUAGE_OPTIONS: Record<string, string> = {
  '': '(No language)',
  c: 'C',
  clike: 'C-like',
  cpp: 'C++',
  css: 'CSS',
  go: 'Go',
  html: 'HTML',
  java: 'Java',
  javascript: 'JavaScript',
  markdown: 'Markdown',
  objectivec: 'Objective-C',
  plaintext: 'Plain Text',
  powershell: 'PowerShell',
  python: 'Python',
  rust: 'Rust',
  sql: 'SQL',
  swift: 'Swift',
  typescript: 'TypeScript',
  xml: 'XML',
};

function CodeActionMenu({
  editor,
  anchorElement,
  codeNodeKey,
}: {
  editor: LexicalEditor;
  anchorElement: HTMLElement;
  codeNodeKey: string;
}) {
  const [langName, setLangName] = useState('Plain Text');
  const [langCode, setLangCode] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    editor.getEditorState().read(() => {
      const node = editor.getElementByKey(codeNodeKey);
      if (!node) return;
      const codeNode = $isCodeNode(editor.getEditorState()._nodeMap.get(codeNodeKey))
        ? (editor.getEditorState()._nodeMap.get(codeNodeKey) as CodeNode)
        : null;
      if (codeNode) {
        const lang = codeNode.getLanguage();
        setLangCode(lang || '');
        setLangName(LANGUAGE_OPTIONS[lang || ''] || 'Plain Text');
      }
    });
  }, [editor, codeNodeKey]);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCodeContent = () => {
    let content = '';
    editor.getEditorState().read(() => {
      const node = editor.getEditorState()._nodeMap.get(codeNodeKey);
      if ($isCodeNode(node)) {
        content = node.getTextContent();
      }
    });
    return content;
  };

  const handleCopy = async () => {
    const content = getCodeContent();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setIsMenuOpen(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownload = () => {
    const content = getCodeContent();
    const now = new Date();
    // Format: YYYY-MM-DD_HH-mm-ss
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    
    // Determine extension
    let ext = langCode.toLowerCase();
    if (ext === '' || ext === 'plain') ext = 'txt';
    if (ext === 'javascript') ext = 'js';
    if (ext === 'typescript') ext = 'ts';
    if (ext === 'python') ext = 'py';
    if (ext === 'markdown') ext = 'md';
    if (ext === 'objectivec') ext = 'm';

    const filename = `${timestamp}.${ext}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsMenuOpen(false);
  };

  const handleLanguageSelect = (lang: string) => {
    editor.update(() => {
      const node = editor.getElementByKey(codeNodeKey);
      if (!node) return;
      const codeNode = $isCodeNode(editor.getEditorState()._nodeMap.get(codeNodeKey))
        ? (editor.getEditorState()._nodeMap.get(codeNodeKey) as CodeNode)
        : null;
      if (codeNode) {
        codeNode.setLanguage(lang);
      }
    });
    setIsLangMenuOpen(false);
  };

  // Position at the very top of the code block, taking full width
  const rect = anchorElement.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const left = rect.left + window.scrollX;
  const width = rect.width;

  return (
    <div
      className="code-github-header"
      style={{
        position: 'absolute',
        top: `${top + 1}px`,
        left: `${left + 1}px`,
        width: `${width - 2}px`,
      }}
    >
      <div className="code-github-tab-wrapper" ref={langMenuRef}>
        <button 
          className="code-github-tab"
          onClick={(e) => {
            e.preventDefault();
            setIsLangMenuOpen(!isLangMenuOpen);
          }}
        >
          <span>{langName}</span>
          <svg aria-hidden="true" height="12" viewBox="0 0 16 16" version="1.1" width="12" fill="currentColor" style={{ marginLeft: 6, opacity: 0.7 }}>
            <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"></path>
          </svg>
        </button>

        {isLangMenuOpen && (
          <div className="code-github-lang-dropdown">
            {Object.entries(LANGUAGE_OPTIONS).map(([value, label]) => (
              <button 
                key={value}
                className="code-github-dropdown-item"
                onClick={() => handleLanguageSelect(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <div className="code-github-actions" ref={menuRef}>
        <button 
          className="code-github-dots" 
          onClick={(e) => {
            e.preventDefault();
            setIsMenuOpen(!isMenuOpen);
          }}
          title="More actions"
        >
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor">
            <path d="M8 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM1.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"></path>
          </svg>
        </button>

        {isMenuOpen && (
          <div className="code-github-dropdown">
            <button className="code-github-dropdown-item" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="code-github-dropdown-item" onClick={handleDownload}>
              Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CodeActionMenuPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [activeCodeNode, setActiveCodeNode] = useState<{
    element: HTMLElement;
    key: string;
  } | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          setActiveCodeNode(null);
          return;
        }

        const anchorNode = selection.anchor.getNode();
        const codeNode = anchorNode.getParents().find($isCodeNode) || 
                         ($isCodeNode(anchorNode) ? anchorNode : null);

        if (codeNode) {
          const key = codeNode.getKey();
          const element = editor.getElementByKey(key);
          if (element) {
            setActiveCodeNode({ element, key });
            return;
          }
        }
        
        setActiveCodeNode(null);
      });
    });
  }, [editor]);

  if (!activeCodeNode) return null;

  return createPortal(
    <CodeActionMenu
      editor={editor}
      anchorElement={activeCodeNode.element}
      codeNodeKey={activeCodeNode.key}
    />,
    document.body
  );
}
