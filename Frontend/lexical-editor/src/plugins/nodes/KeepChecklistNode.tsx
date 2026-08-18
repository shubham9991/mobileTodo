/**
 * KeepChecklistNode.tsx — Google Keep style interactive Checklist DecoratorNode for Lexical.
 *
 * Features:
 * 1. 6-dots drag handle for reordering items (touch + mouse).
 * 2. Custom checkboxes [ ] and [✓].
 * 3. Checking an item moves it down into a collapsible bottom accordion ("N checked items").
 * 4. Unchecking an item moves it back up into the active unchecked items.
 * 5. "✕" button on each row to delete the item.
 * 6. "+ List item" button below unchecked items to quickly add a new item.
 * 7. Full keyboard & mobile beforeinput navigation: Enter creates new item; Enter on empty exits to paragraph outside; Backspace on empty deletes/exits.
 * 8. Auto-focuses the checkbox input immediately when created from toolbar.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  DecoratorNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  LexicalNode,
  $getNodeByKey,
  $createParagraphNode,
  $isParagraphNode,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type KeepChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
};

export type SerializedKeepChecklistNode = Spread<{
  items: KeepChecklistItem[];
  isCollapsed: boolean;
}, SerializedLexicalNode>;

function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

// ── ContentEditable Input Item ────────────────────────────────────────────────

interface ChecklistItemInputProps {
  id: string;
  initialText: string;
  checked: boolean;
  onTextChange: (id: string, text: string) => void;
  onEnter: (id: string, checked: boolean, target: HTMLDivElement) => void;
  onBackspace: (id: string, checked: boolean, target: HTMLDivElement) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, id: string, checked: boolean) => void;
  onFocus: () => void;
  inputRef: (el: HTMLDivElement | null) => void;
}

function ChecklistItemInput({
  id,
  initialText,
  checked,
  onTextChange,
  onEnter,
  onBackspace,
  onKeyDown,
  onFocus,
  inputRef,
}: ChecklistItemInputProps) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (elRef.current) {
      if (document.activeElement !== elRef.current && elRef.current.innerHTML !== initialText) {
        elRef.current.innerHTML = initialText;
      }
    }
  }, [initialText]);

  useEffect(() => {
    if (elRef.current && initialText) {
      elRef.current.innerHTML = initialText;
    }
  }, []);

  return (
    <div
      ref={(el) => {
        elRef.current = el;
        inputRef(el);
      }}
      contentEditable
      suppressContentEditableWarning
      className={`keep-item-input ${checked ? 'keep-input-checked' : ''}`}
      data-placeholder="List item"
      onInput={(e) => {
        const html = e.currentTarget.innerHTML;
        onTextChange(id, html);
      }}
      onBeforeInput={(e: any) => {
        if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
          e.preventDefault();
          if (elRef.current) onEnter(id, checked, elRef.current);
        } else if (e.inputType === 'deleteContentBackward') {
          const rawText = (e.currentTarget.textContent || '').trim();
          if (!rawText || e.currentTarget.innerHTML === '' || e.currentTarget.innerHTML === '<br>') {
            e.preventDefault();
            if (elRef.current) onBackspace(id, checked, elRef.current);
          }
        }
      }}
      onKeyDown={(e) => onKeyDown(e, id, checked)}
      onFocus={() => {
        (window as any).__lastFocusedChecklistInput = elRef.current;
        onFocus();
      }}
      onClick={() => {
        (window as any).__lastFocusedChecklistInput = elRef.current;
        onFocus();
      }}
      onKeyUp={() => {
        onFocus();
      }}
    />
  );
}

// ── React Component ───────────────────────────────────────────────────────────

interface KeepChecklistProps {
  nodeKey: NodeKey;
  initialItems: KeepChecklistItem[];
  initialIsCollapsed: boolean;
}

function KeepChecklistComponent({ nodeKey, initialItems, initialIsCollapsed }: KeepChecklistProps) {
  const [editor] = useLexicalComposerContext();
  const [items, setItems] = useState<KeepChecklistItem[]>(() =>
    initialItems.length > 0 ? initialItems : [{ id: uid(), text: '', checked: false }]
  );
  const [isCollapsed, setIsCollapsed] = useState<boolean>(initialIsCollapsed);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [focusItemId, setFocusItemId] = useState<string | null>(() => {
    return initialItems.length > 0 ? initialItems[0].id : null;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const itemInputRefs = useRef<{ [id: string]: HTMLDivElement | null }>({});

  // Sync state changes with Lexical Node
  const syncWithNode = (newItems: KeepChecklistItem[], collapsed: boolean) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node && $isKeepChecklistNode(node)) {
        node.setItems(newItems);
        node.setIsCollapsed(collapsed);
      }
    });
  };

  const reportChecklistFocus = () => {
    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    const isUnderline = document.queryCommandState('underline');
    const isStrike = document.queryCommandState('strikeThrough');

    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'SELECTION_STATE',
      payload: {
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        strikethrough: isStrike,
        code: false,
        subscript: false,
        superscript: false,
        highlight: false,
        blockType: 'check',
        align: '',
        fontFamily: 'System',
        fontSize: '16px',
        codeLanguage: '',
      }
    }));
  };

  // Report checklist focus on mount and auto-focus the first item
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && containerRef.current?.contains(target)) {
        reportChecklistFocus();
      }
    };

    document.addEventListener('focusin', handleFocusIn);

    // Auto focus first item on mount
    const targetId = focusItemId || (items.length > 0 ? items[0].id : null);
    if (targetId) {
      setTimeout(() => {
        const el = itemInputRefs.current[targetId];
        if (el) {
          el.focus();
          (window as any).__lastFocusedChecklistInput = el;
          reportChecklistFocus();
        }
      }, 60);
    }

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  // Focus item input when focusItemId changes
  useEffect(() => {
    if (focusItemId && itemInputRefs.current[focusItemId]) {
      const el = itemInputRefs.current[focusItemId];
      if (el) {
        el.focus();
        try {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch {
          // ignore
        }
        (window as any).__lastFocusedChecklistInput = el;
        reportChecklistFocus();
      }
    }
  }, [focusItemId, items]);

  // Split into unchecked and checked lists
  const uncheckedItems = items.filter(it => !it.checked);
  const checkedItems = items.filter(it => it.checked);

  // Update item text
  const handleTextChange = (id: string, text: string) => {
    setItems(prev => {
      const next = prev.map(it => (it.id === id ? { ...it, text } : it));
      syncWithNode(next, isCollapsed);
      return next;
    });
  };

  // Toggle item checked state
  const handleToggleCheck = (id: string) => {
    setItems(prev => {
      const target = prev.find(it => it.id === id);
      if (!target) return prev;

      const newChecked = !target.checked;
      const otherItems = prev.filter(it => it.id !== id);
      const updatedTarget = { ...target, checked: newChecked };

      let next: KeepChecklistItem[];
      if (newChecked) {
        // Moved to bottom (checked list)
        next = [...otherItems, updatedTarget];
      } else {
        // Moved back to active list (at the end of unchecked items)
        const unchecks = otherItems.filter(it => !it.checked);
        const checks = otherItems.filter(it => it.checked);
        next = [...unchecks, updatedTarget, ...checks];
      }

      syncWithNode(next, isCollapsed);
      return next;
    });
  };

  // Delete an item
  const handleDeleteItem = (id: string) => {
    if (items.length <= 1) {
      // When deleting the only remaining item in the checklist, delete the whole checklist node
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node) {
          const p = $createParagraphNode();
          node.replace(p);
          p.select();
        }
      });
      return;
    }
    const next = items.filter(it => it.id !== id);
    setItems(next);
    syncWithNode(next, isCollapsed);
  };

  // Add a new unchecked item
  const handleAddItem = (afterId?: string) => {
    const newId = uid();
    const newItem: KeepChecklistItem = { id: newId, text: '', checked: false };

    setItems(prev => {
      let next: KeepChecklistItem[];
      if (afterId) {
        const idx = prev.findIndex(it => it.id === afterId);
        if (idx !== -1) {
          next = [...prev.slice(0, idx + 1), newItem, ...prev.slice(idx + 1)];
        } else {
          const unchecks = prev.filter(it => !it.checked);
          const checks = prev.filter(it => it.checked);
          next = [...unchecks, newItem, ...checks];
        }
      } else {
        const unchecks = prev.filter(it => !it.checked);
        const checks = prev.filter(it => it.checked);
        next = [...unchecks, newItem, ...checks];
      }

      syncWithNode(next, isCollapsed);
      return next;
    });

    setFocusItemId(newId);
  };

  // Dedicated Enter handler (supports both keyboard Enter and mobile beforeinput)
  const handleEnter = (id: string, isChecked: boolean, targetEl: HTMLDivElement) => {
    const rawText = (targetEl.textContent || '').trim();
    if (!rawText) {
      // Exit checklist to a normal paragraph outside
      if (items.length > 1) {
        handleDeleteItem(id);
      }
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node) {
          const p = $createParagraphNode();
          node.insertAfter(p);
          p.select();
        }
      });
      return;
    }
    handleAddItem(id);
  };

  // Dedicated Backspace handler (supports both keyboard Backspace and mobile beforeinput)
  const handleBackspace = (id: string, isChecked: boolean, targetEl: HTMLDivElement) => {
    const rawText = (targetEl.textContent || '').trim();
    if (!rawText || targetEl.innerHTML === '' || targetEl.innerHTML === '<br>') {
      if (items.length === 1 && !rawText) {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node) {
            const p = $createParagraphNode();
            node.replace(p);
            p.select();
          }
        });
        return;
      }
      const currentList = isChecked ? checkedItems : uncheckedItems;
      const idx = currentList.findIndex(it => it.id === id);
      if (currentList.length > 1 && idx > 0) {
        const prevItem = currentList[idx - 1];
        handleDeleteItem(id);
        setFocusItemId(prevItem.id);
      }
    }
  };

  // Handle keyboard navigation & actions in input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, id: string, isChecked: boolean) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnter(id, isChecked, e.currentTarget);
    } else if (e.key === 'Backspace') {
      const rawText = (e.currentTarget.textContent || '').trim();
      if (!rawText || e.currentTarget.innerHTML === '' || e.currentTarget.innerHTML === '<br>') {
        e.preventDefault();
        handleBackspace(id, isChecked, e.currentTarget);
      }
    } else if (e.key === 'ArrowUp') {
      const allActive = isChecked ? checkedItems : uncheckedItems;
      const idx = allActive.findIndex(it => it.id === id);
      if (idx > 0) {
        e.preventDefault();
        setFocusItemId(allActive[idx - 1].id);
      } else if (idx === 0 && !isChecked) {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node) {
            const prevSibling = node.getPreviousSibling();
            if (prevSibling && typeof (prevSibling as any).selectEnd === 'function') {
              (prevSibling as any).selectEnd();
            }
          }
        });
      }
    } else if (e.key === 'ArrowDown') {
      const allActive = isChecked ? checkedItems : uncheckedItems;
      const idx = allActive.findIndex(it => it.id === id);
      if (idx < allActive.length - 1) {
        e.preventDefault();
        setFocusItemId(allActive[idx + 1].id);
      } else if (idx === allActive.length - 1 && (isChecked || checkedItems.length === 0)) {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node) {
            const nextSibling = node.getNextSibling();
            if (nextSibling && typeof (nextSibling as any).selectStart === 'function') {
              (nextSibling as any).selectStart();
            } else {
              const p = $createParagraphNode();
              node.insertAfter(p);
              p.select();
            }
          }
        });
      }
    }
  };

  // ── Touch drag for mobile devices ──────────────────────────────────────────
  const touchStartY = useRef<number>(0);
  const touchStartIndex = useRef<number | null>(null);
  const rowRefs = useRef<{ [index: number]: HTMLDivElement | null }>({});

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartIndex.current = index;
    setDragIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartIndex.current === null) return;
    const currentY = e.touches[0].clientY;

    let targetIdx: number | null = null;
    Object.keys(rowRefs.current).forEach(k => {
      const el = rowRefs.current[Number(k)];
      if (el) {
        const rect = el.getBoundingClientRect();
        if (currentY >= rect.top && currentY <= rect.bottom) {
          targetIdx = Number(k);
        }
      }
    });

    if (targetIdx !== null && targetIdx !== dragOverIndex) {
      setDragOverIndex(targetIdx);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartIndex.current !== null && dragOverIndex !== null && touchStartIndex.current !== dragOverIndex) {
      const reorderedUnchecked = [...uncheckedItems];
      const [moved] = reorderedUnchecked.splice(touchStartIndex.current, 1);
      reorderedUnchecked.splice(dragOverIndex, 0, moved);

      const next = [...reorderedUnchecked, ...checkedItems];
      setItems(next);
      syncWithNode(next, isCollapsed);
    }
    touchStartIndex.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ── HTML5 Drag & Drop (desktop) ──────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reorderedUnchecked = [...uncheckedItems];
    const [moved] = reorderedUnchecked.splice(dragIndex, 1);
    reorderedUnchecked.splice(targetIndex, 0, moved);

    const next = [...reorderedUnchecked, ...checkedItems];
    setItems(next);
    syncWithNode(next, isCollapsed);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="keep-checklist-container" ref={containerRef}>
      {/* ── Active Unchecked Items ────────────────────────────────────────── */}
      <div className="keep-checklist-list">
        {uncheckedItems.map((item, index) => {
          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <div
              key={item.id}
              ref={el => { rowRefs.current[index] = el; }}
              className={`keep-item-row ${isDragging ? 'keep-item-dragging' : ''} ${isDragOver ? 'keep-item-drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
            >
              {/* 6 Dots Drag Handle — ONLY this handle triggers drag / reordering */}
              <div
                className="keep-drag-handle"
                title="Drag to reorder"
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor">
                  <circle cx="4" cy="4" r="1.5" />
                  <circle cx="10" cy="4" r="1.5" />
                  <circle cx="4" cy="9" r="1.5" />
                  <circle cx="10" cy="9" r="1.5" />
                  <circle cx="4" cy="14" r="1.5" />
                  <circle cx="10" cy="14" r="1.5" />
                </svg>
              </div>

              {/* Square Checkbox */}
              <button
                type="button"
                className="keep-checkbox"
                onClick={() => handleToggleCheck(item.id)}
                title="Mark as complete"
              >
                <div className="keep-checkbox-box" />
              </button>

              {/* Editable Content */}
              <ChecklistItemInput
                id={item.id}
                initialText={item.text}
                checked={false}
                onTextChange={handleTextChange}
                onEnter={handleEnter}
                onBackspace={handleBackspace}
                onKeyDown={handleKeyDown}
                onFocus={reportChecklistFocus}
                inputRef={el => { itemInputRefs.current[item.id] = el; }}
              />

              {/* Delete ✕ Button */}
              <button
                type="button"
                className="keep-item-delete"
                onClick={() => handleDeleteItem(item.id)}
                title="Delete item"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M13 1L1 13M1 1l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* ── "+ List item" Button — perfectly aligned with checklist columns ── */}
      <button
        type="button"
        className="keep-add-row"
        onClick={() => handleAddItem()}
      >
        <div className="keep-add-spacer" />
        <span className="keep-add-plus">+</span>
        <span className="keep-add-text">List item</span>
      </button>

      {/* ── Collapsible Accordion for Checked Items ───────────────────────── */}
      {checkedItems.length > 0 && (
        <div className="keep-checked-section">
          <button
            type="button"
            className="keep-accordion-header"
            onClick={() => {
              const next = !isCollapsed;
              setIsCollapsed(next);
              syncWithNode(items, next);
            }}
          >
            <span className={`keep-accordion-arrow ${isCollapsed ? 'collapsed' : ''}`}>
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 1.5 6 6.5 11 1.5"/>
              </svg>
            </span>
            <span className="keep-accordion-label">
              {checkedItems.length} checked {checkedItems.length === 1 ? 'item' : 'items'}
            </span>
          </button>

          {!isCollapsed && (
            <div className="keep-checked-list">
              {checkedItems.map((item) => (
                <div key={item.id} className="keep-item-row keep-checked-row">
                  {/* Empty handle space for alignment */}
                  <div className="keep-drag-handle-spacer" />

                  {/* Checked Box [✓] */}
                  <button
                    type="button"
                    className="keep-checkbox keep-checkbox-checked"
                    onClick={() => handleToggleCheck(item.id)}
                    title="Mark as incomplete"
                  >
                    <div className="keep-checkbox-box checked">
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1.5 4.5 4.5 7.5 9.5 1.5"/>
                      </svg>
                    </div>
                  </button>

                  {/* Strikethrough Content */}
                  <ChecklistItemInput
                    id={item.id}
                    initialText={item.text}
                    checked={true}
                    onTextChange={handleTextChange}
                    onEnter={handleEnter}
                    onBackspace={handleBackspace}
                    onKeyDown={handleKeyDown}
                    onFocus={reportChecklistFocus}
                    inputRef={el => { itemInputRefs.current[item.id] = el; }}
                  />

                  {/* Delete ✕ Button */}
                  <button
                    type="button"
                    className="keep-item-delete"
                    onClick={() => handleDeleteItem(item.id)}
                    title="Delete item"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M13 1L1 13M1 1l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Lexical DecoratorNode Class ───────────────────────────────────────────────

export class KeepChecklistNode extends DecoratorNode<React.ReactElement> {
  __items: KeepChecklistItem[];
  __isCollapsed: boolean;

  static getType(): string {
    return 'keep-checklist';
  }

  static clone(node: KeepChecklistNode): KeepChecklistNode {
    return new KeepChecklistNode(node.__items, node.__isCollapsed, node.__key);
  }

  constructor(items?: KeepChecklistItem[], isCollapsed = false, key?: NodeKey) {
    super(key);
    this.__items = items ? items.map(i => ({ ...i })) : [{ id: uid(), text: '', checked: false }];
    this.__isCollapsed = isCollapsed;
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'keep-checklist-wrapper';
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  setItems(items: KeepChecklistItem[]): void {
    const writable = this.getWritable();
    writable.__items = items.map(i => ({ ...i }));
  }

  getItems(): KeepChecklistItem[] {
    return this.__items;
  }

  setIsCollapsed(isCollapsed: boolean): void {
    const writable = this.getWritable();
    writable.__isCollapsed = isCollapsed;
  }

  getIsCollapsed(): boolean {
    return this.__isCollapsed;
  }

  getTextContent(): string {
    return this.__items.map(it => {
      const plain = it.text.replace(/<[^>]*>/g, '');
      return `${it.checked ? '[x]' : '[ ]'} ${plain}`;
    }).join('\n');
  }

  static importJSON(serializedNode: SerializedKeepChecklistNode): KeepChecklistNode {
    return $createKeepChecklistNode(serializedNode.items, serializedNode.isCollapsed);
  }

  exportJSON(): SerializedKeepChecklistNode {
    return {
      type: 'keep-checklist',
      version: 1,
      items: this.__items,
      isCollapsed: this.__isCollapsed,
    };
  }

  decorate(): React.ReactElement {
    return (
      <KeepChecklistComponent
        nodeKey={this.__key}
        initialItems={this.__items}
        initialIsCollapsed={this.__isCollapsed}
      />
    );
  }
}

export function $createKeepChecklistNode(
  items?: KeepChecklistItem[],
  isCollapsed = false,
): KeepChecklistNode {
  return new KeepChecklistNode(items, isCollapsed);
}

export function $isKeepChecklistNode(
  node: LexicalNode | null | undefined,
): node is KeepChecklistNode {
  return node instanceof KeepChecklistNode;
}
