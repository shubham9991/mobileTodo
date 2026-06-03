/**
 * Collapsible container nodes — three cooperating nodes:
 *  CollapsibleContainerNode  (outer)
 *  CollapsibleTitleNode      (header / toggle)
 *  CollapsibleContentNode    (body, hidden when collapsed)
 */
import {
  ElementNode,
  LexicalNode,
  NodeKey,
  RangeSelection,
  SerializedElementNode,
  Spread,
} from 'lexical';

// ── Container ────────────────────────────────────────────────────
export type SerializedCollapsibleContainerNode = Spread<
  { open: boolean },
  SerializedElementNode
>;

export class CollapsibleContainerNode extends ElementNode {
  __open: boolean;

  static getType(): string { return 'collapsible-container'; }
  static clone(node: CollapsibleContainerNode): CollapsibleContainerNode {
    return new CollapsibleContainerNode(node.__open, node.__key);
  }

  constructor(open: boolean, key?: NodeKey) { super(key); this.__open = open; }

  createDOM(): HTMLElement {
    const el = document.createElement('details');
    el.className = 'editor-collapsible-container';
    if (this.__open) el.open = true;
    return el;
  }
  updateDOM(prevNode: CollapsibleContainerNode, dom: HTMLElement): boolean {
    const detailsEl = dom as HTMLDetailsElement;
    if (prevNode.__open !== this.__open) detailsEl.open = this.__open;
    return false;
  }
  static importJSON(sn: SerializedCollapsibleContainerNode): CollapsibleContainerNode {
    return new CollapsibleContainerNode(sn.open);
  }
  exportJSON(): SerializedCollapsibleContainerNode {
    return { ...super.exportJSON(), type: 'collapsible-container', version: 1, open: this.__open };
  }
  insertNewAfter(_sel: RangeSelection, restoreSelection?: boolean): LexicalNode | null {
    return this.insertAfter(new CollapsibleContainerNode(true), restoreSelection);
  }
  collapseAtStart(): boolean { return true; }
}

// ── Title ────────────────────────────────────────────────────────
export class CollapsibleTitleNode extends ElementNode {
  static getType(): string { return 'collapsible-title'; }
  static clone(node: CollapsibleTitleNode): CollapsibleTitleNode { return new CollapsibleTitleNode(node.__key); }
  createDOM(): HTMLElement {
    const el = document.createElement('summary');
    el.className = 'editor-collapsible-title';
    return el;
  }
  updateDOM(): false { return false; }
  static importJSON(sn: SerializedElementNode): CollapsibleTitleNode { return new CollapsibleTitleNode(); }
  exportJSON(): SerializedElementNode {
    return { ...super.exportJSON(), type: 'collapsible-title', version: 1 };
  }
  collapseAtStart(): boolean { return true; }
}

// ── Content ───────────────────────────────────────────────────────
export class CollapsibleContentNode extends ElementNode {
  static getType(): string { return 'collapsible-content'; }
  static clone(node: CollapsibleContentNode): CollapsibleContentNode { return new CollapsibleContentNode(node.__key); }
  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'editor-collapsible-content';
    return el;
  }
  updateDOM(): false { return false; }
  static importJSON(sn: SerializedElementNode): CollapsibleContentNode { return new CollapsibleContentNode(); }
  exportJSON(): SerializedElementNode {
    return { ...super.exportJSON(), type: 'collapsible-content', version: 1 };
  }
}

// ── Helpers ───────────────────────────────────────────────────────
export function $createCollapsibleContainerNode(open: boolean): CollapsibleContainerNode {
  return new CollapsibleContainerNode(open);
}
export function $createCollapsibleTitleNode(): CollapsibleTitleNode { return new CollapsibleTitleNode(); }
export function $createCollapsibleContentNode(): CollapsibleContentNode { return new CollapsibleContentNode(); }

export function $isCollapsibleContainerNode(node: LexicalNode | null | undefined): node is CollapsibleContainerNode {
  return node instanceof CollapsibleContainerNode;
}
