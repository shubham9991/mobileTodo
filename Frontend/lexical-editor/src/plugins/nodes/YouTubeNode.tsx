/**
 * YouTubeNode — embeds a YouTube video by video ID.
 * Renders as a thumbnail card (works in Android file:// WebView).
 * Tap once to select (shows blue border and delete ✕ button).
 * Once selected, tap play to start live iframe playback.
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

export type SerializedYouTubeNode = Spread<
  { videoID: string },
  SerializedLexicalNode
>;

function YouTubeComponent({
  nodeKey,
  videoID,
  editor,
}: {
  nodeKey: string;
  videoID: string;
  editor: LexicalEditor;
}) {
  const [selected, setSelected] = useState(false);
  const [playing, setPlaying] = useState(false);
  const thumb = `https://img.youtube.com/vi/${videoID}/hqdefault.jpg`;
  // Use youtube.com instead of youtube-nocookie.com to avoid configuration errors in WebView
  const embedSrc = `https://www.youtube.com/embed/${videoID}?autoplay=1`;

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) node.remove();
    });
  }, [editor, nodeKey]);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selected) {
      setSelected(true);
    }
  }, [selected]);

  const handlePlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (selected) {
      setPlaying(true);
    } else {
      setSelected(true);
    }
  }, [selected]);

  // Click outside to deselect
  useEffect(() => {
    if (!selected) return;
    const handler = () => setSelected(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [selected]);

  if (playing) {
    return (
      <div
        className={`editor-youtube-wrap${selected ? ' editor-youtube-selected' : ''}`}
        onClick={handleContainerClick}
      >
        <iframe
          className="editor-youtube-iframe"
          src={embedSrc}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video"
        />
        {selected && (
          <button
            className="editor-youtube-delete-btn"
            onMouseDown={handleDelete}
            onTouchEnd={handleDelete as any}
            title="Delete video"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`editor-youtube-wrap${selected ? ' editor-youtube-selected' : ''}`}
      onClick={handleContainerClick}
    >
      <img
        className="editor-youtube-thumb"
        src={thumb}
        alt="YouTube video thumbnail"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <div className="editor-youtube-play" onClick={handlePlayClick}>
        <svg viewBox="0 0 68 48" width="68" height="48">
          <path
            d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"
            fill="#ff0000"
          />
          <path d="M 45,24 27,14 27,34" fill="#fff" />
        </svg>
      </div>
      <div className="editor-youtube-label">Tap to select / play</div>
      {selected && (
        <button
          className="editor-youtube-delete-btn"
          onMouseDown={handleDelete}
          onTouchEnd={handleDelete as any}
          title="Delete video"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export class YouTubeNode extends DecoratorNode<React.JSX.Element> {
  __videoID: string;

  static getType(): string { return 'youtube'; }
  static clone(node: YouTubeNode): YouTubeNode { return new YouTubeNode(node.__videoID, node.__key); }

  constructor(videoID: string, key?: NodeKey) {
    super(key);
    this.__videoID = videoID;
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'contents';
    return div;
  }
  updateDOM(): false { return false; }

  static importJSON(sn: SerializedYouTubeNode): YouTubeNode { return new YouTubeNode(sn.videoID); }
  exportJSON(): SerializedYouTubeNode {
    return { ...super.exportJSON(), type: 'youtube', version: 1, videoID: this.__videoID };
  }
  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${this.__videoID}`;
    return { element: iframe };
  }
  decorate(editor: LexicalEditor): React.JSX.Element {
    return <YouTubeComponent nodeKey={this.__key} videoID={this.__videoID} editor={editor} />;
  }
}

export function $createYouTubeNode(videoID: string): YouTubeNode { return new YouTubeNode(videoID); }
export function $isYouTubeNode(node: LexicalNode | null | undefined): node is YouTubeNode {
  return node instanceof YouTubeNode;
}
