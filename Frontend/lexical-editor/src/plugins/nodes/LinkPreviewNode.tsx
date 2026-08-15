/**
 * LinkPreviewNode — interactive rich website link preview card.
 * Automatically generated when a user pastes or writes a website URL.
 * Displays website favicon, domain title, clean URL, and opens in native browser on tap.
 */
import {
  DecoratorNode,
  DOMExportOutput,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  $getNodeByKey,
} from 'lexical';
import React, { useState, useEffect, useCallback } from 'react';

export type SerializedLinkPreviewNode = Spread<
  { url: string },
  SerializedLexicalNode
>;

function cleanDisplayUrl(url: string): { domain: string; title: string } {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    let path = parsed.pathname;
    if (path === '/' || !path) {
      return { domain, title: domain.charAt(0).toUpperCase() + domain.slice(1) };
    }
    // Clean path for title display (e.g. /wiki/React_(software) -> React (software))
    const segments = path.split('/').filter(Boolean);
    const lastSeg = segments[segments.length - 1] || domain;
    const cleanTitle = decodeURIComponent(lastSeg).replace(/[-_]/g, ' ');
    return {
      domain,
      title: cleanTitle.length > 50 ? cleanTitle.substring(0, 47) + '…' : cleanTitle,
    };
  } catch {
    return { domain: url, title: url };
  }
}

function LinkPreviewComponent({
  nodeKey,
  url,
  editor,
}: {
  nodeKey: string;
  url: string;
  editor: LexicalEditor;
}) {
  const [selected, setSelected] = useState(false);
  const { domain, title } = cleanDisplayUrl(url);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) node.remove();
    });
  }, [editor, nodeKey]);

  const handlePress = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (selected) {
      window.ReactNativeWebView?.postMessage(
        JSON.stringify({ type: 'OPEN_URL', payload: url })
      );
    } else {
      setSelected(true);
    }
  }, [selected, url]);

  // Click outside to deselect
  useEffect(() => {
    if (!selected) return;
    const handler = () => setSelected(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [selected]);

  return (
    <div
      className={`editor-link-preview-container${selected ? ' editor-link-preview-selected' : ''}`}
      onClick={handlePress}
    >
      <div className="editor-link-preview-card">
        <div className="editor-link-preview-icon">
          <img
            src={faviconUrl}
            alt=""
            className="editor-link-preview-favicon"
            onError={(e) => {
              // Fallback to globe icon on error
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
        <div className="editor-link-preview-body">
          <div className="editor-link-preview-domain">{domain}</div>
          <div className="editor-link-preview-title">{title}</div>
          <div className="editor-link-preview-url">{url}</div>
        </div>
        <div className="editor-link-preview-open">↗</div>
      </div>
      {selected && (
        <button
          className="editor-link-preview-delete-btn"
          onMouseDown={handleDelete}
          onTouchEnd={handleDelete as any}
          title="Delete link preview"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export class LinkPreviewNode extends DecoratorNode<React.JSX.Element> {
  __url: string;

  static getType(): string { return 'link-preview'; }
  static clone(node: LinkPreviewNode): LinkPreviewNode { return new LinkPreviewNode(node.__url, node.__key); }

  constructor(url: string, key?: NodeKey) {
    super(key);
    this.__url = url;
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'contents';
    return div;
  }
  updateDOM(): false { return false; }

  static importJSON(sn: SerializedLinkPreviewNode): LinkPreviewNode { return new LinkPreviewNode(sn.url); }
  exportJSON(): SerializedLinkPreviewNode {
    return { ...super.exportJSON(), type: 'link-preview', version: 1, url: this.__url };
  }
  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const a = document.createElement('a');
    a.href = this.__url;
    a.textContent = this.__url;
    return { element: a };
  }
  decorate(editor: LexicalEditor): React.JSX.Element {
    return <LinkPreviewComponent nodeKey={this.__key} url={this.__url} editor={editor} />;
  }
}

export function $createLinkPreviewNode(url: string): LinkPreviewNode { return new LinkPreviewNode(url); }
export function $isLinkPreviewNode(node: LexicalNode | null | undefined): node is LinkPreviewNode {
  return node instanceof LinkPreviewNode;
}
