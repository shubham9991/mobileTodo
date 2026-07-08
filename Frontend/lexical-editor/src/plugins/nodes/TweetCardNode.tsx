/**
 * TweetCardNode — styled X/Twitter link card.
 * Renders a tappable card that opens the tweet URL in the native browser.
 * Tap once to select (shows blue border and delete ✕ button).
 * Once selected, tap the card body to open the URL in native browser.
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

export type SerializedTweetCardNode = Spread<
  { url: string },
  SerializedLexicalNode
>;

function TweetCardComponent({
  nodeKey,
  url,
  editor,
}: {
  nodeKey: string;
  url: string;
  editor: LexicalEditor;
}) {
  const [selected, setSelected] = useState(false);

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
      className={`editor-tweet-card-container${selected ? ' editor-tweet-card-selected' : ''}`}
      onClick={handlePress}
    >
      <div className="editor-tweet-card">
        <div className="editor-tweet-card-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </div>
        <div className="editor-tweet-card-body">
          <div className="editor-tweet-card-title">X / Twitter Post</div>
          <div className="editor-tweet-card-url">{url}</div>
        </div>
        <div className="editor-tweet-card-open">↗</div>
      </div>
      {selected && (
        <button
          className="editor-tweet-card-delete-btn"
          onMouseDown={handleDelete}
          onTouchEnd={handleDelete as any}
          title="Delete post"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export class TweetCardNode extends DecoratorNode<React.JSX.Element> {
  __url: string;

  static getType(): string { return 'tweet-card'; }
  static clone(node: TweetCardNode): TweetCardNode { return new TweetCardNode(node.__url, node.__key); }

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

  static importJSON(sn: SerializedTweetCardNode): TweetCardNode { return new TweetCardNode(sn.url); }
  exportJSON(): SerializedTweetCardNode {
    return { ...super.exportJSON(), type: 'tweet-card', version: 1, url: this.__url };
  }
  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const a = document.createElement('a');
    a.href = this.__url;
    a.textContent = this.__url;
    return { element: a };
  }
  decorate(editor: LexicalEditor): React.JSX.Element {
    return <TweetCardComponent nodeKey={this.__key} url={this.__url} editor={editor} />;
  }
}

export function $createTweetCardNode(url: string): TweetCardNode { return new TweetCardNode(url); }
export function $isTweetCardNode(node: LexicalNode | null | undefined): node is TweetCardNode {
  return node instanceof TweetCardNode;
}
