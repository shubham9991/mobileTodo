/**
 * PageBreakNode — visually distinct from HorizontalRuleNode.
 * Renders as a dashed line with a centered "PAGE BREAK" label.
 */
import {
  DecoratorNode,
  DOMExportOutput,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
} from 'lexical';
import React from 'react';

function PageBreakComponent() {
  return (
    <div className="editor-page-break" contentEditable="false">
      <span className="editor-page-break-label">Page Break</span>
    </div>
  );
}

export class PageBreakNode extends DecoratorNode<React.JSX.Element> {
  static getType(): string { return 'page-break'; }
  static clone(node: PageBreakNode): PageBreakNode { return new PageBreakNode(node.__key); }

  constructor(key?: NodeKey) { super(key); }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'contents';
    return div;
  }
  updateDOM(): false { return false; }

  static importJSON(_sn: SerializedLexicalNode): PageBreakNode { return new PageBreakNode(); }
  exportJSON(): SerializedLexicalNode & { type: 'page-break'; version: 1 } {
    return { ...super.exportJSON(), type: 'page-break', version: 1 };
  }
  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const hr = document.createElement('hr');
    hr.style.borderStyle = 'dashed';
    return { element: hr };
  }
  decorate(): React.JSX.Element {
    return <PageBreakComponent />;
  }
}

export function $createPageBreakNode(): PageBreakNode { return new PageBreakNode(); }
export function $isPageBreakNode(node: LexicalNode | null | undefined): node is PageBreakNode {
  return node instanceof PageBreakNode;
}
