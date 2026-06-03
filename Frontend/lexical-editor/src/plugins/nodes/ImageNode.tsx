/**
 * Custom ImageNode — stores image as base64 URI so it lives entirely inside
 * the Lexical JSON AST with no external file dependency.
 */
import {
  DecoratorNode,
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import React, { Suspense } from 'react';

export type SerializedImageNode = Spread<
  { src: string; altText: string; width?: number; height?: number },
  SerializedLexicalNode
>;

function ImageComponent({ src, altText }: { src: string; altText: string }) {
  return (
    <div className="editor-image-container">
      <img
        src={src}
        alt={altText}
        className="editor-image"
        draggable={false}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    </div>
  );
}

export class ImageNode extends DecoratorNode<React.JSX.Element> {
  __src: string;
  __altText: string;
  __width: number | undefined;
  __height: number | undefined;

  static getType(): string { return 'image'; }
  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__width, node.__height, node.__key);
  }

  constructor(src: string, altText: string, width?: number, height?: number, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width;
    this.__height = height;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    return span;
  }

  updateDOM(): false { return false; }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return new ImageNode(serializedNode.src, serializedNode.altText, serializedNode.width, serializedNode.height);
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: (domNode) => {
          const img = domNode as HTMLImageElement;
          return { node: new ImageNode(img.src, img.alt) };
        },
        priority: 0,
      }),
    };
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const img = document.createElement('img');
    img.src = this.__src;
    img.alt = this.__altText;
    return { element: img };
  }

  decorate(): React.JSX.Element {
    return (
      <Suspense fallback={null}>
        <ImageComponent src={this.__src} altText={this.__altText} />
      </Suspense>
    );
  }
}

export function $createImageNode(src: string, altText: string, width?: number, height?: number): ImageNode {
  return new ImageNode(src, altText, width, height);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
