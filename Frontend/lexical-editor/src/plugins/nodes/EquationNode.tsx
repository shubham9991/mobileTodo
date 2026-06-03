/**
 * EquationNode — renders LaTeX equations using KaTeX.
 * The raw LaTeX string is stored in the JSON AST.
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
import React, { useCallback, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export type SerializedEquationNode = Spread<
  { equation: string; inline: boolean },
  SerializedLexicalNode
>;

function KatexRenderer({ equation, inline }: { equation: string; inline: boolean }) {
  let html = '';
  try {
    html = katex.renderToString(equation, {
      displayMode: !inline,
      throwOnError: false,
      output: 'html',
    });
  } catch {
    html = `<span style="color:red">[Invalid LaTeX]</span>`;
  }
  return (
    <span
      className={`editor-equation${inline ? ' editor-equation-inline' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function EquationComponent({ equation, inline, nodeKey }: { equation: string; inline: boolean; nodeKey: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(equation);

  const onConfirm = useCallback(() => {
    setEditing(false);
    // Emit bridge message to update node
    const msg = JSON.stringify({ type: 'UPDATE_EQUATION', payload: { nodeKey, equation: draft } });
    window.ReactNativeWebView?.postMessage(msg);
  }, [draft, nodeKey]);

  if (editing) {
    return (
      <span className="editor-equation-editor">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={onConfirm}
          onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(); if (e.key === 'Escape') setEditing(false); }}
          style={{ fontFamily: 'monospace', fontSize: 14, border: '1px solid var(--accent)', borderRadius: 4, padding: '2px 6px', background: 'transparent', color: 'var(--text)' }}
        />
      </span>
    );
  }

  return (
    <span onClick={() => setEditing(true)} title="Tap to edit equation">
      <KatexRenderer equation={equation} inline={inline} />
    </span>
  );
}

export class EquationNode extends DecoratorNode<React.JSX.Element> {
  __equation: string;
  __inline: boolean;

  static getType(): string { return 'equation'; }
  static clone(node: EquationNode): EquationNode { return new EquationNode(node.__equation, node.__inline, node.__key); }

  constructor(equation: string, inline: boolean, key?: NodeKey) {
    super(key);
    this.__equation = equation;
    this.__inline = inline;
  }

  createDOM(): HTMLElement { return document.createElement(this.__inline ? 'span' : 'div'); }
  updateDOM(): false { return false; }

  static importJSON(sn: SerializedEquationNode): EquationNode { return new EquationNode(sn.equation, sn.inline); }
  exportJSON(): SerializedEquationNode {
    return { ...super.exportJSON(), type: 'equation', version: 1, equation: this.__equation, inline: this.__inline };
  }
  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const el = document.createElement(this.__inline ? 'span' : 'div');
    el.textContent = `[LaTeX: ${this.__equation}]`;
    return { element: el };
  }

  decorate(): React.JSX.Element {
    return <EquationComponent equation={this.__equation} inline={this.__inline} nodeKey={this.__key} />;
  }
}

export function $createEquationNode(equation: string, inline: boolean): EquationNode {
  return new EquationNode(equation, inline);
}
export function $isEquationNode(node: LexicalNode | null | undefined): node is EquationNode {
  return node instanceof EquationNode;
}
