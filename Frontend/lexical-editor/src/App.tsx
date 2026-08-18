/**
 * Lexical Editor — Full-featured, native-feeling web editor
 * bundled as a single HTML file for React Native WebView.
 *
 * Architecture:
 *   Tier 1 (always loaded): RichText, History, List, Link, AutoLink,
 *                           Markdown shortcuts, Hashtag, Code highlight
 *   Tier 2 (bridge-activated): Table, Image, YouTube, Equation,
 *                               Collapsible, Color, Link editor, Poll
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no @types/prismjs bundled; prism works fine at runtime
import Prism from 'prismjs';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-objectivec';
import 'prismjs/components/prism-xml-doc';
(window as any).Prism = Prism;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { registerCodeHighlighting } from '@lexical/code';
import { TRANSFORMERS } from '@lexical/markdown';
import {
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  COMMAND_PRIORITY_LOW,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isNodeSelection,
  $createParagraphNode,
  $isParagraphNode,
  $setSelection,
  $getNodeByKey,
  $getNearestNodeFromDOMNode,
  TextFormatType,
  ElementFormatType,
  $isTextNode,
  $isElementNode,
  KEY_BACKSPACE_COMMAND,
} from 'lexical';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
} from '@lexical/list';
import { $setBlocksType, $patchStyleText, $getSelectionStyleValueForProperty } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode, $isHeadingNode } from '@lexical/rich-text';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  INSERT_TABLE_COMMAND,
  $isTableCellNode,
  $isTableRowNode,
  $isTableNode,
  $insertTableRow__EXPERIMENTAL,
  $insertTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $deleteTableColumn__EXPERIMENTAL,
  $getTableCellNodeFromLexicalNode,
} from '@lexical/table';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { $generateHtmlFromNodes } from '@lexical/html';

import editorTheme from './theme/editorTheme';
import { allNodes } from './plugins/nodes';
import { $createImageNode } from './plugins/nodes/ImageNode';
import { $createYouTubeNode } from './plugins/nodes/YouTubeNode';
import { $createEquationNode } from './plugins/nodes/EquationNode';
import {
  $createCollapsibleContainerNode,
  $createCollapsibleTitleNode,
  $createCollapsibleContentNode,
} from './plugins/nodes/CollapsibleNodes';
import { $createPollNode } from './plugins/nodes/PollNode';
import { $createPageBreakNode } from './plugins/nodes/PageBreakNode';
import { $createTweetCardNode } from './plugins/nodes/TweetCardNode';
import { $createLinkPreviewNode } from './plugins/nodes/LinkPreviewNode';
import { $createKeepChecklistNode, $isKeepChecklistNode, KeepChecklistItem } from './plugins/nodes/KeepChecklistNode';
import CodeActionMenuPlugin from './plugins/CodeActionMenuPlugin';


// ── Code file extension map ───────────────────────────────────────────────────
const CODE_EXTENSIONS: Record<string, string> = {
  javascript: 'js', typescript: 'ts', python: 'py', css: 'css',
  html: 'html', java: 'java', cpp: 'cpp', c: 'c', go: 'go',
  rust: 'rs', sql: 'sql', swift: 'swift', markdown: 'md',
  powershell: 'ps1', objectivec: 'm', xml: 'xml', plaintext: 'txt', '': 'txt',
};

// ── Type declaration for React Native bridge ─────────────────────────────────
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    onNativeCommand?: (type: string, payload?: any) => void;
  }
}

// ── Global: always tracks the last non-null Lexical selection ────────────────
import type { BaseSelection } from 'lexical';
let _lastKnownSelection: BaseSelection | null = null;

// ── Global: tracks the format state the user WANTS at the cursor ─────────────
const _desiredFormats = new Map<string, { active: boolean; expiresAt: number }>();

// ── URL matchers for AutoLinkPlugin ──────────────────────────────────────────
const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/i;
const EMAIL_MATCHER = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
const MATCHERS = [
  (text: string) => {
    const m = URL_MATCHER.exec(text);
    return m ? { index: m.index, length: m[0].length, text: m[0], url: m[0].startsWith('http') ? m[0] : `https://${m[0]}` } : null;
  },
  (text: string) => {
    const m = EMAIL_MATCHER.exec(text);
    return m ? { index: m.index, length: m[0].length, text: m[0], url: `mailto:${m[0]}` } : null;
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTION STATE PLUGIN — reports active formats back to native toolbar
// ═══════════════════════════════════════════════════════════════════════════════
function SelectionStatePlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === 'root'
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();

        let blockType = 'paragraph';
        if ($isHeadingNode(element)) blockType = element.getTag();
        else if ($isListNode(element)) blockType = element.getListType();
        else if ($isKeepChecklistNode(element) || (element as any).getType?.() === 'keep-checklist') blockType = 'check';
        else if (!$isParagraphNode(element)) blockType = element.getType();

        // Detect if cursor is inside a table cell
        let inTable = false;
        let node: any = anchorNode;
        while (node) {
          if ($isTableCellNode(node)) { inTable = true; break; }
          node = node.getParent?.();
        }
        if (inTable) blockType = 'table';

        const fontFamily = $getSelectionStyleValueForProperty(selection, 'font-family', 'System');
        const fontSize = $getSelectionStyleValueForProperty(selection, 'font-size', '16px');
        const align = typeof (element as any).getFormat === 'function' ? (element as any).getFormat() : '';

        let codeLanguage = '';
        if (blockType === 'code') {
          const codeNode = anchorNode.getParents().find($isCodeNode) || ($isCodeNode(anchorNode) ? anchorNode : null);
          if (codeNode) {
            codeLanguage = codeNode.getLanguage() || '';
          }
        }

        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'SELECTION_STATE',
          payload: {
            bold: selection.hasFormat('bold'),
            italic: selection.hasFormat('italic'),
            underline: selection.hasFormat('underline'),
            strikethrough: selection.hasFormat('strikethrough'),
            code: selection.hasFormat('code'),
            subscript: selection.hasFormat('subscript'),
            superscript: selection.hasFormat('superscript'),
            highlight: selection.hasFormat('highlight'),
            blockType,
            fontFamily,
            fontSize,
            align,
            codeLanguage,
          },
        }));
      });
    });
  }, [editor]);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-SAVE PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════
function AutoSavePlugin() {
  const [editor] = useLexicalComposerContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        editorState.read(() => {
          const json = editorState.toJSON();
          const html = $generateHtmlFromNodes(editor, null);
          const text = $getRoot().getTextContent();
          const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'AUTO_SAVE',
            payload: { json, html, text, wordCount },
          }));
        });
      }, 1500);
    });
  }, [editor]);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYBOARD SCROLL PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════
function KeyboardScrollPlugin() {
  useEffect(() => {
    let lastHeight = window.visualViewport?.height ?? window.innerHeight;

    const handleViewportResize = () => {
      const currentHeight = window.visualViewport?.height ?? window.innerHeight;
      
      // Only execute scroll adjustment if height changed significantly (keyboard toggle)
      if (Math.abs(currentHeight - lastHeight) < 30) return;
      lastHeight = currentHeight;

      requestAnimationFrame(() => {
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const viewportHeight = currentHeight;
          if (rect.bottom > viewportHeight - 20) {
            window.scrollBy({ top: rect.bottom - viewportHeight + 40, behavior: 'smooth' });
          }
        }
      });
    };

    window.visualViewport?.addEventListener('resize', handleViewportResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTION SAVER PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════
function SelectionSaverPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const sel = $getSelection();
        if (sel !== null) _lastKnownSelection = sel.clone();
      });
    });
  }, [editor]);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLBAR BRIDGE PLUGIN — receives commands from native RN toolbar
// ═══════════════════════════════════════════════════════════════════════════════
function ToolbarBridgePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const executeCommand = (type: string, payload?: string) => {
      const skipFocus = ['LOAD_STATE', 'GET_STATE', 'SET_THEME', 'SET_ACCENT', 'BLUR', 'COPY_CODE', 'DOWNLOAD_CODE'].includes(type);

      const restoreSelection = () => {
        if (_lastKnownSelection) $setSelection(_lastKnownSelection.clone());
      };

      const run = () => {
        switch (type) {
          // ── Inline text formatting ──────────────────────────────────
          case 'FORMAT_TEXT': {
            let fmt: TextFormatType;
            let desiredActive: boolean;
            if (payload && payload.includes(':')) {
              const col = payload.lastIndexOf(':');
              fmt = payload.substring(0, col) as TextFormatType;
              desiredActive = payload.substring(col + 1) === '1';
            } else {
              fmt = payload as TextFormatType;
              desiredActive = true;
            }

            // Check if active element or last focused input is a checklist item
            const activeEl = document.activeElement as HTMLElement | null;
            const lastCheckEl = (window as any).__lastFocusedChecklistInput as HTMLElement | null;
            const targetCheckEl = activeEl?.closest('.keep-item-input') || (lastCheckEl?.isConnected ? lastCheckEl : null);

            if (targetCheckEl) {
              const cmdMap: Record<string, string> = {
                bold: 'bold',
                italic: 'italic',
                underline: 'underline',
                strikethrough: 'strikeThrough',
              };
              const execCmd = cmdMap[fmt];
              if (execCmd) {
                (targetCheckEl as HTMLElement).focus();
                document.execCommand(execCmd, false);
                targetCheckEl.dispatchEvent(new Event('input', { bubbles: true }));

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
              }
              break;
            }

            _desiredFormats.set(fmt, { active: desiredActive, expiresAt: Date.now() + 12_000 });
            editor.update(() => { restoreSelection(); }, {
              onUpdate: () => {
                editor.getEditorState().read(() => {
                  const sel = $getSelection();
                  if ($isRangeSelection(sel)) {
                    const has = sel.hasFormat(fmt);
                    if (has !== desiredActive) editor.dispatchCommand(FORMAT_TEXT_COMMAND, fmt);
                  }
                });
              }
            });
            break;
          }

          case 'FORMAT_ELEMENT':
            editor.update(() => { restoreSelection(); editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, payload as ElementFormatType); });
            break;

          case 'INDENT':
            editor.update(() => { restoreSelection(); editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined); });
            break;
          case 'OUTDENT':
            editor.update(() => { restoreSelection(); editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined); });
            break;

          case 'UNDO': editor.dispatchCommand(UNDO_COMMAND, undefined); break;
          case 'REDO': editor.dispatchCommand(REDO_COMMAND, undefined); break;

          case 'INSERT_UL':
            editor.update(() => { restoreSelection(); editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined); });
            break;
          case 'INSERT_OL':
            editor.update(() => { restoreSelection(); editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined); });
            break;
          case 'INSERT_CHECK':
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel)) {
                const anchorNode = sel.anchor.getNode();
                const element = anchorNode.getKey() === 'root'
                  ? anchorNode
                  : anchorNode.getTopLevelElementOrThrow();

                // If already inside a checklist node, do not duplicate
                if ($isKeepChecklistNode(element) || (element as any).getType?.() === 'keep-checklist') {
                  return;
                }

                let text = element.getTextContent().trim();
                // Strip any existing brackets or checkbox markers
                text = text.replace(/^(\[\s*\]|\[x\])\s*/gi, '').trim();

                const keepChecklist = $createKeepChecklistNode([
                  { id: Math.random().toString(36).slice(2, 9), text: text, checked: false },
                ]);

                if (element.getKey() === 'root') {
                  const root = $getRoot();
                  root.append(keepChecklist);
                } else {
                  element.replace(keepChecklist);
                }
              }
            });
            break;
          case 'REMOVE_LIST':
            editor.update(() => { restoreSelection(); editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined); });
            break;

          case 'SET_HEADING':
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel)) {
                const anchorNode = sel.anchor.getNode();
                const element = anchorNode.getTopLevelElementOrThrow();
                // Toggle: if already the same heading level, revert to paragraph
                if ($isHeadingNode(element) && element.getTag() === payload) {
                  $setBlocksType(sel, () => $createParagraphNode());
                } else {
                  $setBlocksType(sel, () => $createHeadingNode(payload as 'h1' | 'h2' | 'h3'));
                }
              }
            });
            break;

          case 'SET_PARAGRAPH':
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createParagraphNode());
            });
            break;
          case 'SET_QUOTE':
            editor.update(() => {
              restoreSelection();
              const selection = $getSelection();
              if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createQuoteNode());
            });
            break;
          case 'SET_CODE':
            editor.update(() => {
              restoreSelection();
              const selection = $getSelection();
              if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createCodeNode());
            });
            break;
          case 'SET_CODE_LANGUAGE':
            editor.update(() => {
              restoreSelection();
              let codeNode: any = null;
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                const anchorNode = selection.anchor.getNode();
                codeNode = anchorNode.getParents().find($isCodeNode) || ($isCodeNode(anchorNode) ? anchorNode : null);
              }
              if (!codeNode) {
                const root = $getRoot();
                const findCode = (n: any) => {
                  if ($isCodeNode(n)) codeNode = n;
                  else if (typeof n.getChildren === 'function') n.getChildren().forEach(findCode);
                };
                root.getChildren().forEach(findCode);
              }
              if (codeNode && $isCodeNode(codeNode)) {
                codeNode.setLanguage(payload || '');
              }
            });
            break;

          // ── Insert elements ───────────────────────────────────────────
          case 'INSERT_HR':
            editor.update(() => { restoreSelection(); editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined); });
            break;
          case 'INSERT_TABLE': {
            const [rows = '3', cols = '3'] = (payload ?? '3,3').split(',');
            editor.update(() => { restoreSelection(); editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows, columns: cols, includeHeaders: true }); });
            break;
          }

          // ── Table row/col operations (__EXPERIMENTAL = operates on current focus cell) ──
          case 'TABLE_ADD_ROW_ABOVE':
            editor.update(() => { $insertTableRow__EXPERIMENTAL(false); });
            break;
          case 'TABLE_ADD_ROW_BELOW':
            editor.update(() => { $insertTableRow__EXPERIMENTAL(true); });
            break;
          case 'TABLE_ADD_COL_LEFT':
            editor.update(() => { $insertTableColumn__EXPERIMENTAL(false); });
            break;
          case 'TABLE_ADD_COL_RIGHT':
            editor.update(() => { $insertTableColumn__EXPERIMENTAL(true); });
            break;
          case 'TABLE_DELETE_ROW':
            editor.update(() => { $deleteTableRow__EXPERIMENTAL(); });
            break;
          case 'TABLE_DELETE_COL':
            editor.update(() => { $deleteTableColumn__EXPERIMENTAL(); });
            break;
          case 'TABLE_DELETE_FULL':
            editor.update(() => {
              const sel = $getSelection();
              if (!$isRangeSelection(sel)) return;
              let node: any = sel.anchor.getNode();
              while (node && !$isTableNode(node)) node = node.getParent();
              if (node && $isTableNode(node)) node.remove();
            });
            break;
          case 'TOGGLE_LINK':
            editor.update(() => { restoreSelection(); editor.dispatchCommand(TOGGLE_LINK_COMMAND, payload ?? null); });
            break;
          case 'INSERT_IMAGE': {
            if (!payload) break;
            try {
              const { src, altText } = JSON.parse(payload);
              editor.update(() => {
                restoreSelection();
                const sel = $getSelection();
                if (sel) sel.insertNodes([$createImageNode(src, altText ?? '')]);
              });
            } catch {}
            break;
          }
          case 'INSERT_YOUTUBE': {
            if (!payload) break;
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if (sel) sel.insertNodes([$createYouTubeNode(payload)]);
            });
            break;
          }
          case 'INSERT_EQUATION': {
            if (!payload) break;
            try {
              const { equation, inline } = JSON.parse(payload);
              editor.update(() => {
                restoreSelection();
                const sel = $getSelection();
                if (sel) sel.insertNodes([$createEquationNode(equation, inline ?? false)]);
              });
            } catch {}
            break;
          }
          case 'INSERT_COLLAPSIBLE': {
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if (!sel) return;
              const container = $createCollapsibleContainerNode(true);
              const title = $createCollapsibleTitleNode();
              const content = $createCollapsibleContentNode();
              const p = $createParagraphNode();
              content.append(p);
              container.append(title);
              container.append(content);
              sel.insertNodes([container]);
              title.selectStart();
            });
            break;
          }
          case 'INSERT_POLL': {
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if (sel) {
                const pollNode = $createPollNode();
                sel.insertNodes([pollNode]);
              }
            });
            break;
          }
          case 'INSERT_PAGE_BREAK': {
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if (sel) sel.insertNodes([$createPageBreakNode()]);
            });
            break;
          }
          case 'INSERT_DATE': {
            if (!payload) break;
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel)) sel.insertText(payload);
            });
            break;
          }
          case 'INSERT_STICKY_NOTE': {
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createQuoteNode());
            });
            break;
          }
          case 'INSERT_TWEET': {
            if (!payload) break;
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if (sel) sel.insertNodes([$createTweetCardNode(payload)]);
            });
            break;
          }



          // ── Text color / highlight color ──────────────────────────────
          case 'SET_TEXT_COLOR': {
            if (!payload) break;
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel)) $patchStyleText(sel, { color: payload });
            });
            break;
          }
          case 'SET_HIGHLIGHT_COLOR': {
            if (!payload) break;
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel)) $patchStyleText(sel, { 'background-color': payload });
            });
            break;
          }
          case 'SET_FONT_FAMILY': {
            if (!payload) break;
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel)) $patchStyleText(sel, { 'font-family': payload === 'System' ? '' : payload });
            });
            break;
          }
          case 'SET_FONT_SIZE': {
            if (!payload) break;
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel)) $patchStyleText(sel, { 'font-size': payload });
            });
            break;
          }
          case 'CLEAR_FORMATTING': {
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel)) {
                const formats: TextFormatType[] = ['bold', 'italic', 'underline', 'strikethrough', 'code', 'highlight', 'subscript', 'superscript'];
                formats.forEach(f => { if (sel.hasFormat(f)) editor.dispatchCommand(FORMAT_TEXT_COMMAND, f); });
                $patchStyleText(sel, { color: '', 'background-color': '' });
              }
            });
            break;
          }

          case 'TEXT_TRANSFORM': {
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if (!$isRangeSelection(sel)) return;
              sel.getNodes().forEach(node => {
                if (node.getType() === 'text') {
                  const textNode = node as import('lexical').TextNode;
                  const current = textNode.getTextContent();
                  let transformed = current;
                  if (payload === 'uppercase') transformed = current.toUpperCase();
                  else if (payload === 'lowercase') transformed = current.toLowerCase();
                  else if (payload === 'capitalize') transformed = current.replace(/\b\w/g, c => c.toUpperCase());
                  textNode.setTextContent(transformed);
                }
              });
            });
            break;
          }

          // ── Code block actions ────────────────────────────────────
          case 'COPY_CODE': {
            editor.getEditorState().read(() => {
              const sel = $getSelection();
              let codeNode: any = null;
              if ($isRangeSelection(sel)) {
                const anchor = sel.anchor.getNode();
                codeNode = anchor.getParents().find($isCodeNode) || ($isCodeNode(anchor) ? anchor : null);
              }
              if (!codeNode) {
                const root = $getRoot();
                const findCode = (n: any) => {
                  if ($isCodeNode(n)) codeNode = n;
                  else if (typeof n.getChildren === 'function') n.getChildren().forEach(findCode);
                };
                root.getChildren().forEach(findCode);
              }
              if (codeNode && $isCodeNode(codeNode)) {
                const content = codeNode.getTextContent();
                window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'COPY_CODE_CONTENT', payload: content }));
                try {
                  navigator.clipboard?.writeText(content).catch(() => {});
                } catch {
                  // ignore
                }
              }
            });
            break;
          }
          case 'DOWNLOAD_CODE': {
            editor.getEditorState().read(() => {
              const sel = $getSelection();
              if (!$isRangeSelection(sel)) return;
              const anchor = sel.anchor.getNode();
              const codeNode = anchor.getParents().find($isCodeNode) || ($isCodeNode(anchor) ? anchor : null);
              if (codeNode && $isCodeNode(codeNode)) {
                const content = codeNode.getTextContent();
                const lang = codeNode.getLanguage() || '';
                const ext = CODE_EXTENSIONS[lang] || 'txt';
                const now = new Date();
                const pad = (n: number) => n.toString().padStart(2, '0');
                const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
                const filename = `${ts}.${ext}`;
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'DOWNLOAD_CODE_CONTENT',
                  payload: { content, filename, language: lang },
                }));
              }
            });
            break;
          }

          case 'FOCUS': break;
          case 'BLUR': {
            const rootEl = editor.getRootElement();
            if (rootEl) rootEl.blur();
            if (document.activeElement && typeof (document.activeElement as any).blur === 'function') {
              (document.activeElement as any).blur();
            }
            window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'EDITOR_BLUR' }));
            break;
          }
          case 'CLEAR': {
            editor.update(() => {
              const root = $getRoot();
              root.clear();
              const p = $createParagraphNode();
              root.append(p);
              p.select();
            });
            break;
          }
        }
      };

      if (!skipFocus) {
        const rootEl = editor.getRootElement();
        if (rootEl) rootEl.focus({ preventScroll: true });
        setTimeout(() => { run(); }, 50);
      } else {
        switch (type) {
          case 'SET_THEME': {
            document.documentElement.setAttribute('data-theme', payload === 'dark' ? 'dark' : 'light');
            break;
          }
          case 'SET_ACCENT': {
            if (payload) document.documentElement.style.setProperty('--accent', payload);
            break;
          }
          case 'LOAD_STATE': {
            if (!payload) break;
            try {
              const parsed = editor.parseEditorState(payload);
              editor.setEditorState(parsed);
            } catch (e) {
              console.error('[Lexical] LOAD_STATE failed:', e);
            }
            break;
          }
          case 'GET_STATE': {
            editor.getEditorState().read(() => {
              const json = editor.getEditorState().toJSON();
              const html = $generateHtmlFromNodes(editor, null);
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'STATE_SNAPSHOT',
                payload: { json, html },
              }));
            });
            break;
          }
        }
      }
    };

    // ── Persistent SELECTION_CHANGE guard ────────────────────────────────
    const unregisterSelChange = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        if (_desiredFormats.size === 0) return false;
        const now = Date.now();
        const sel = $getSelection();
        if (!$isRangeSelection(sel) || !sel.isCollapsed()) {
          _desiredFormats.clear();
          return false;
        }
        _desiredFormats.forEach(({ active, expiresAt }, fmt) => {
          if (now > expiresAt) { _desiredFormats.delete(fmt); return; }
          const has = sel.hasFormat(fmt as TextFormatType);
          if (active && !has) sel.formatText(fmt as TextFormatType);
          else if (!active && has) sel.formatText(fmt as TextFormatType);
        });
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );

    window.onNativeCommand = (type: string, payload?: any) => {
      executeCommand(type, payload);
    };

    const handleMessage = (event: MessageEvent) => {
      let data: { type: string; payload?: string };
      try {
        data = JSON.parse(typeof event.data === 'string' ? event.data : JSON.stringify(event.data));
      } catch {
        return;
      }
      const { type, payload } = data;
      executeCommand(type, payload);
    };

    document.addEventListener('message', handleMessage as EventListener);
    window.addEventListener('message', handleMessage);

    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'EDITOR_READY' }));

    return () => {
      unregisterSelChange();
      _desiredFormats.clear();
      window.onNativeCommand = undefined;
      document.removeEventListener('message', handleMessage as EventListener);
      window.removeEventListener('message', handleMessage);
    };
  }, [editor]);

  return null;
}

function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => registerCodeHighlighting(editor), [editor]);
  return null;
}



// ═══════════════════════════════════════════════════════════════════════════════
// KEEP CHECKLIST MIGRATION PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════
function KeepChecklistMigrationPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let migrating = false;
    return editor.registerUpdateListener(({ editorState, dirtyLeaves }) => {
      if (migrating || dirtyLeaves.size === 0) return;

      editorState.read(() => {
        const root = $getRoot();
        const checkLists: any[] = [];
        const findChecklists = (node: any) => {
          if ($isListNode(node) && node.getListType() === 'check') {
            checkLists.push(node);
          } else if (typeof node.getChildren === 'function') {
            node.getChildren().forEach(findChecklists);
          }
        };
        root.getChildren().forEach(findChecklists);

        if (checkLists.length > 0) {
          migrating = true;
          editor.update(() => {
            for (const list of checkLists) {
              const fresh = $getNodeByKey(list.getKey());
              if (fresh && $isListNode(fresh) && fresh.getListType() === 'check') {
                const listItems = fresh.getChildren();
                const items: KeepChecklistItem[] = listItems.map((li: any) => {
                  let raw = typeof li.getTextContent === 'function' ? li.getTextContent() : '';
                  raw = raw.replace(/^(\[\s*\]|\[x\])\s*/gi, '').trim();
                  return {
                    id: Math.random().toString(36).slice(2, 9),
                    text: raw,
                    checked: typeof li.getChecked === 'function' ? li.getChecked() : false,
                  };
                });
                const keepNode = $createKeepChecklistNode(items.length > 0 ? items : undefined);
                fresh.replace(keepNode);
              }
            }
          }, { onUpdate: () => { migrating = false; } });
        }
      });
    });
  }, [editor]);

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLICK FOCUS PLUGIN — tapping blank note space below any block always creates/selects a paragraph
// ═══════════════════════════════════════════════════════════════════════════════
function ClickFocusPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Don't intercept interactive buttons/checkboxes
      if (
        target.closest('.code-copy-btn') ||
        target.closest('.keep-drag-handle') ||
        target.closest('.keep-checkbox') ||
        target.closest('.keep-item-delete') ||
        target.closest('.keep-add-row') ||
        target.closest('.keep-accordion-header')
      ) {
        return;
      }

      // If user clicked inside a checklist item to edit it, let them
      if (target.closest('.keep-item-input')) {
        return;
      }

      const rootEl = editor.getRootElement();
      if (!rootEl) return;

      // Check if click was on rootEl, editor-input, container, shell, body, html, or below last child
      const isContainerOrBody =
        target === rootEl ||
        target.classList.contains('editor-input') ||
        target.classList.contains('editor-container') ||
        target.classList.contains('editor-shell') ||
        target.tagName === 'BODY' ||
        target.tagName === 'HTML';

      const lastChildEl = rootEl.lastElementChild as HTMLElement | null;
      const isBelowLastChild = lastChildEl && e.clientY > lastChildEl.getBoundingClientRect().bottom + 4;

      if (isContainerOrBody || isBelowLastChild) {
        editor.update(() => {
          const root = $getRoot();
          const last = root.getLastChild();

          // If the last block is already an empty paragraph, just select it
          if (last && $isParagraphNode(last) && last.getTextContent().trim() === '') {
            last.select();
            return;
          }

          // Otherwise append a new paragraph at the bottom and focus it
          const p = $createParagraphNode();
          root.append(p);
          p.select();
        });
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [editor]);

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CODE LANGUAGE CLICK PLUGIN — detects clicks on the code block's header label
// ═══════════════════════════════════════════════════════════════════════════════
function CodeLanguageClickPlugin() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const codeEl = target.closest('code.editor-code');
      if (codeEl) {
        if (target.closest('.code-action-bar') || target.closest('.code-copy-btn')) {
          return;
        }

        const rect = codeEl.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        if (clickY >= 0 && clickY < 34) {
          e.preventDefault();
          e.stopPropagation();
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'CODE_LANG_CLICK',
          }));
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CODE BLOCK EXIT PLUGIN — allows easy exit from code block via Enter, ArrowDown, mobile beforeinput
// ═══════════════════════════════════════════════════════════════════════════════
function CodeBlockExitPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // 1. Enter key: pressing Enter on an empty line at the end of the code block exits to a paragraph below
    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (e) => {
        let handled = false;
        editor.update(() => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel) || !sel.isCollapsed()) return;

          const anchor = sel.anchor.getNode();
          const codeNode = anchor.getParents().find($isCodeNode) || ($isCodeNode(anchor) ? anchor : null);
          if (!codeNode || !$isCodeNode(codeNode)) return;

          const text = codeNode.getTextContent();
          if (text.trim() === '') {
            const p = $createParagraphNode();
            codeNode.replace(p);
            p.select();
            handled = true;
            return;
          }

          // If code text ends with a newline (meaning user is on the empty trailing line) or Shift+Enter was pressed:
          if (text.endsWith('\n') || (e as KeyboardEvent)?.shiftKey) {
            const lastDescendant = codeNode.getLastDescendant();
            if (text.endsWith('\n') && lastDescendant && $isTextNode(lastDescendant)) {
              const cur = lastDescendant.getTextContent();
              if (cur.endsWith('\n')) {
                lastDescendant.setTextContent(cur.slice(0, -1));
              }
            }
            const p = $createParagraphNode();
            codeNode.insertAfter(p);
            p.select();
            handled = true;
          }
        });

        if (handled && e) {
          e.preventDefault();
          e.stopPropagation();
        }
        return handled;
      },
      COMMAND_PRIORITY_HIGH,
    );

    // 2. ArrowDown key: pressing ArrowDown at the end of a code block creates/moves to paragraph below
    const unregisterArrowDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (e) => {
        let handled = false;
        editor.update(() => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel) || !sel.isCollapsed()) return;

          const anchor = sel.anchor.getNode();
          const codeNode = anchor.getParents().find($isCodeNode) || ($isCodeNode(anchor) ? anchor : null);
          if (!codeNode || !$isCodeNode(codeNode)) return;

          const nextSibling = codeNode.getNextSibling();
          if (!nextSibling) {
            const p = $createParagraphNode();
            codeNode.insertAfter(p);
            p.select();
            handled = true;
          } else if (typeof (nextSibling as any).selectStart === 'function') {
            (nextSibling as any).selectStart();
            handled = true;
          }
        });

        if (handled && e) {
          e.preventDefault();
        }
        return handled;
      },
      COMMAND_PRIORITY_HIGH,
    );

    // 3. Capture-phase keydown handler to catch Enter before any default handling
    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        let shouldExit = false;
        editor.getEditorState().read(() => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel) || !sel.isCollapsed()) return;

          const anchor = sel.anchor.getNode();
          const codeNode = anchor.getParents().find($isCodeNode) || ($isCodeNode(anchor) ? anchor : null);
          if (!codeNode || !$isCodeNode(codeNode)) return;

          const text = codeNode.getTextContent();
          if (text.endsWith('\n') || text.trim() === '') {
            shouldExit = true;
          }
        });

        if (shouldExit) {
          e.preventDefault();
          e.stopPropagation();
          editor.update(() => {
            const sel = $getSelection();
            if (!$isRangeSelection(sel)) return;
            const anchor = sel.anchor.getNode();
            const codeNode = anchor.getParents().find($isCodeNode) || ($isCodeNode(anchor) ? anchor : null);
            if (codeNode && $isCodeNode(codeNode)) {
              const text = codeNode.getTextContent();
              if (text.endsWith('\n')) {
                const lastDescendant = codeNode.getLastDescendant();
                if (lastDescendant && $isTextNode(lastDescendant) && lastDescendant.getTextContent().endsWith('\n')) {
                  const cur = lastDescendant.getTextContent();
                  lastDescendant.setTextContent(cur.slice(0, -1));
                }
              }
              const p = $createParagraphNode();
              codeNode.insertAfter(p);
              p.select();
            }
          });
        }
      }
    };

    // 4. Mobile touch/keyboard beforeinput event
    const onBeforeInput = (e: Event) => {
      const inputEvent = e as InputEvent;
      if (inputEvent.inputType === 'insertParagraph' || inputEvent.inputType === 'insertLineBreak') {
        let shouldExit = false;
        editor.getEditorState().read(() => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel) || !sel.isCollapsed()) return;

          const anchor = sel.anchor.getNode();
          const codeNode = anchor.getParents().find($isCodeNode) || ($isCodeNode(anchor) ? anchor : null);
          if (!codeNode || !$isCodeNode(codeNode)) return;

          const text = codeNode.getTextContent();
          if (text.endsWith('\n') || text.trim() === '') {
            shouldExit = true;
          }
        });

        if (shouldExit) {
          e.preventDefault();
          e.stopPropagation();
          editor.update(() => {
            const sel = $getSelection();
            if (!$isRangeSelection(sel)) return;
            const anchor = sel.anchor.getNode();
            const codeNode = anchor.getParents().find($isCodeNode) || ($isCodeNode(anchor) ? anchor : null);
            if (codeNode && $isCodeNode(codeNode)) {
              const lastDescendant = codeNode.getLastDescendant();
              if (lastDescendant && $isTextNode(lastDescendant) && lastDescendant.getTextContent().endsWith('\n')) {
                const cur = lastDescendant.getTextContent();
                lastDescendant.setTextContent(cur.slice(0, -1));
              }
              const p = $createParagraphNode();
              codeNode.insertAfter(p);
              p.select();
            }
          });
        }
      }
    };

    return editor.registerRootListener((root, prevRoot) => {
      if (prevRoot) {
        prevRoot.removeEventListener('keydown', handleKeyDownCapture, true);
        prevRoot.removeEventListener('beforeinput', onBeforeInput, true);
      }
      if (root) {
        root.addEventListener('keydown', handleKeyDownCapture, true);
        root.addEventListener('beforeinput', onBeforeInput, true);
      }
      return () => {
        unregisterEnter();
        unregisterArrowDown();
      };
    });
  }, [editor]);

  return null;
}

// ── BackspaceNodeDeletionPlugin — deletes media blocks on backspace ──────────
function BackspaceNodeDeletionPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const DELETABLE = new Set(['image', 'youtube', 'tweet-card', 'page-break', 'equation', 'poll']);

    /**
     * Find the Lexical key of a node we should delete on backspace.
     * Checks THREE scenarios in order:
     *  1. Lexical already put the node into a NodeSelection (first backspace moved focus to it)
     *  2. DOM cursor is at offset 0 of a block — look at the preceding DOM sibling
     *  3. Lexical RangeSelection is at offset 0 — look at preceding Lexical sibling
     */
    const findNodeToDelete = (): string | null => {
      let key: string | null = null;

      editor.getEditorState().read(() => {
        const selection = $getSelection();

        // ── Scenario 1: Lexical NodeSelection (node already "selected" by previous backspace) ──
        if ($isNodeSelection(selection)) {
          const nodes = selection.getNodes();
          if (nodes.length === 1 && DELETABLE.has(nodes[0].getType())) {
            key = nodes[0].getKey();
            return;
          }
        }

        // ── Scenario 2: Use raw DOM selection (avoids Android reconciliation lag) ──
        const domSel = window.getSelection();
        const rootEl = editor.getRootElement();
        if (domSel && domSel.isCollapsed && domSel.rangeCount > 0 && rootEl) {
          const range = domSel.getRangeAt(0);
          // Find the block-level element that is a direct child of the editor root
          let blockEl: Element | null =
            range.startContainer.nodeType === Node.TEXT_NODE
              ? (range.startContainer as Text).parentElement
              : (range.startContainer as Element);
          while (blockEl && blockEl.parentElement !== rootEl) {
            blockEl = blockEl.parentElement;
          }
          if (blockEl) {
            try {
              // Create range to check if there is any visible text before the caret in this block
              const preRange = document.createRange();
              preRange.setStart(blockEl, 0);
              preRange.setEnd(range.startContainer, range.startOffset);
              const preText = preRange.toString();
              const cleanPreText = preText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

              if (cleanPreText === '') {
                const prevEl = blockEl.previousElementSibling;
                if (prevEl) {
                  const node = $getNearestNodeFromDOMNode(prevEl);
                  if (node && DELETABLE.has(node.getType())) {
                    key = node.getKey();
                    return;
                  }
                }
              }
            } catch (_) { /* range error or node not found in DOM */ }
          }
        }

        // ── Scenario 3: Fallback — Lexical RangeSelection at offset 0 ──
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();

        let isAtStart = false;
        if (anchor.type === 'text' && anchor.offset === 0) {
          let prev = anchorNode.getPreviousSibling();
          while (prev && prev.getTextContentSize() === 0) prev = prev.getPreviousSibling();
          if (!prev) isAtStart = true;
        } else if (anchor.type === 'element' && anchor.offset === 0) {
          isAtStart = true;
        }
        if (!isAtStart) return;

        let topBlock: any = anchorNode;
        while (topBlock && topBlock.getParent()?.getType() !== 'root') {
          topBlock = topBlock.getParent();
        }
        if (!topBlock) return;

        const prev = topBlock.getPreviousSibling();
        if (prev && DELETABLE.has(prev.getType())) key = prev.getKey();
      });

      return key;
    };

    const tryDelete = (e: Event): boolean => {
      const key = findNodeToDelete();
      if (!key) return false;
      // Call preventDefault SYNCHRONOUSLY before scheduling editor.update
      e.preventDefault();
      e.stopImmediatePropagation();
      editor.update(() => {
        const node = $getNodeByKey(key);
        if (node) node.remove();
      });
      return true;
    };

    const onBeforeInput = (e: Event) => {
      if ((e as InputEvent).inputType === 'deleteContentBackward') tryDelete(e);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.keyCode === 8) tryDelete(e);
    };

    return editor.registerRootListener((root, prevRoot) => {
      if (prevRoot) {
        prevRoot.removeEventListener('beforeinput', onBeforeInput, true);
        prevRoot.removeEventListener('keydown', onKeyDown, true);
      }
      if (root) {
        root.addEventListener('beforeinput', onBeforeInput, true);
        root.addEventListener('keydown', onKeyDown, true);
      }
    });
  }, [editor]);

  return null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
const initialConfig = {
  namespace: 'NoteEditor',
  theme: editorTheme,
  nodes: allNodes,
  onError: (err: Error) => {
    console.error('[Lexical Error]', err);
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'EDITOR_ERROR', payload: err.message }));
  },
};

export default function App() {
  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor-shell">
        <div className="editor-container">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="editor-input"
                aria-label="Note editor"
                spellCheck={false}
              />
            }
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />

          {/* Tier 1: Always loaded core plugins */}
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <LinkPlugin />
          <AutoLinkPlugin matchers={MATCHERS} />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <HorizontalRulePlugin />
          <CodeHighlightPlugin />
          <CodeActionMenuPlugin />
          <CodeBlockExitPlugin />

          {/* Tier 2: Structural plugins */}
          <TablePlugin />

          {/* Bridge & UX plugins */}
          <SelectionSaverPlugin />
          <ToolbarBridgePlugin />
          <SelectionStatePlugin />
          <AutoSavePlugin />
          <KeyboardScrollPlugin />
          <ClickFocusPlugin />
          <CodeLanguageClickPlugin />
          <BackspaceNodeDeletionPlugin />
          <KeepChecklistMigrationPlugin />
        </div>
      </div>
    </LexicalComposer>
  );
}
