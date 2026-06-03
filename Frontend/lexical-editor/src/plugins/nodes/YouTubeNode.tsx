/**
 * YouTubeNode — embeds a YouTube video by video ID as an iframe.
 * Stored as { videoID } in the JSON AST.
 */
import {
  DecoratorNode,
  DOMExportOutput,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import React from 'react';

export type SerializedYouTubeNode = Spread<
  { videoID: string },
  SerializedLexicalNode
>;

function YouTubeComponent({ videoID }: { videoID: string }) {
  return (
    <iframe
      className="editor-youtube"
      src={`https://www.youtube-nocookie.com/embed/${videoID}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title="YouTube video"
    />
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
    iframe.src = `https://www.youtube-nocookie.com/embed/${this.__videoID}`;
    return { element: iframe };
  }
  decorate(): React.JSX.Element { return <YouTubeComponent videoID={this.__videoID} />; }
}

export function $createYouTubeNode(videoID: string): YouTubeNode { return new YouTubeNode(videoID); }
export function $isYouTubeNode(node: LexicalNode | null | undefined): node is YouTubeNode {
  return node instanceof YouTubeNode;
}
