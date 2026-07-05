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
import 'prismjs/components/prism-go';
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
  COMMAND_PRIORITY_LOW,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $isParagraphNode,
  $setSelection,
  $getNodeByKey,
  $getNearestNodeFromDOMNode,
  TextFormatType,
  ElementFormatType,
  $isTextNode,
  $isElementNode,
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
// SLASH COMMAND PLUGIN — detects "/" keypress, posts SLASH_MENU_OPEN to RN
// ═══════════════════════════════════════════════════════════════════════════════
// Helper to get all text in the current block up to the cursor position
function getTextBeforeCursor(selection: any): string {
  const anchor = selection.anchor;
  const node = anchor.getNode();
  if ($isTextNode(node)) {
    let text = node.getTextContent().slice(0, anchor.offset);
    let prevSibling = node.getPreviousSibling();
    while (prevSibling !== null) {
      text = prevSibling.getTextContent() + text;
      prevSibling = prevSibling.getPreviousSibling();
    }
    return text;
  } else if ($isElementNode(node)) {
    const children = node.getChildren();
    let text = '';
    for (let i = 0; i < anchor.offset && i < children.length; i++) {
      text += children[i].getTextContent();
    }
    return text;
  }
  return '';
}

function SlashCommandPlugin() {
  const [editor] = useLexicalComposerContext();
  const slashActiveRef = useRef(false);
  const lastTriggerOffsetRef = useRef<{key: string, offset: number} | null>(null);

  useEffect(() => {
    const unregisterUpdate = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return;
        }

        const anchor = selection.anchor;
        const node = anchor.getNode();

        // Retrieve the entire text in the current block up to the cursor
        const textBefore = getTextBeforeCursor(selection);
        console.log('[SlashCommandPlugin] Text before cursor:', JSON.stringify(textBefore));

        // We want to trigger if the character just before the cursor is '/'
        // and it's either the very first character or preceded by a space or newline.
        const isSlashTrigger = textBefore === '/' || textBefore.endsWith(' /') || textBefore.endsWith('\n/');
        console.log('[SlashCommandPlugin] isSlashTrigger:', isSlashTrigger, 'slashActiveRef:', slashActiveRef.current);

        if (isSlashTrigger) {
          // Check if we already triggered at this exact position (node key & offset)
          const lastTrigger = lastTriggerOffsetRef.current;
          if (lastTrigger && lastTrigger.key === node.getKey() && lastTrigger.offset === anchor.offset) {
            console.log('[SlashCommandPlugin] Skip trigger: already triggered at this position.');
            return;
          }

          if (!slashActiveRef.current) {
            console.log('[SlashCommandPlugin] Posting SLASH_MENU_OPEN!');
            lastTriggerOffsetRef.current = { key: node.getKey(), offset: anchor.offset };
            slashActiveRef.current = true;
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'SLASH_MENU_OPEN',
            }));
          }
        } else {
          // Reset the trigger block if they move away or delete the slash
          if (!slashActiveRef.current) {
            lastTriggerOffsetRef.current = null;
          }
        }
      });
    });

    const unregisterKey = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        // Fallback for hardware keyboard Escape
        if (event.key === 'Escape' && slashActiveRef.current) {
          console.log('[SlashCommandPlugin] Escape key pressed, closing slash menu.');
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'SLASH_MENU_CLOSE' }));
          slashActiveRef.current = false;
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const handleClose = () => {
      console.log('[SlashCommandPlugin] __slashMenuClose called, resetting slashActiveRef.');
      slashActiveRef.current = false;
    };
    (window as any).__slashMenuClose = handleClose;

    return () => {
      unregisterUpdate();
      unregisterKey();
    };
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
            editor.update(() => { restoreSelection(); editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined); });
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
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                const anchorNode = selection.anchor.getNode();
                const codeNode = anchorNode.getParents().find($isCodeNode) || ($isCodeNode(anchorNode) ? anchorNode : null);
                if (codeNode) codeNode.setLanguage(payload || '');
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
              editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
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
          case 'INSERT_COLUMNS': {
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'FEATURE_NOTE',
              payload: 'Columns layout coming soon',
            }));
            break;
          }
          case 'INSERT_TWEET': {
            if (!payload) break;
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel)) sel.insertText(`🐦 ${payload}`);
            });
            break;
          }
          case 'PAGE_LAYOUT': {
            if (payload) {
              try {
                const layout = JSON.parse(payload);
                document.documentElement.setAttribute('data-page-size', layout.pageSize || 'pageless');
                document.documentElement.setAttribute('data-page-orientation', layout.orientation || 'portrait');
                document.documentElement.setAttribute('data-page-margins', layout.margins || 'normal');
                document.documentElement.setAttribute('data-page-line-spacing', layout.lineSpacing || '1');
              } catch (e) {
                console.error('[Lexical] PAGE_LAYOUT parse failed:', e);
              }
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'PAGE_LAYOUT_CHANGE',
                payload: JSON.parse(payload),
              }));
            }
            break;
          }

          // ── Slash menu: delete the "/" character before inserting block ──
          case 'DELETE_SLASH': {
            editor.update(() => {
              restoreSelection();
              const sel = $getSelection();
              if ($isRangeSelection(sel) && sel.isCollapsed()) {
                // Delete one character before the cursor (the "/")
                sel.modify('extend', true, 'character');
                sel.deleteCharacter(true);
              }
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
              if (!$isRangeSelection(sel)) return;
              const anchor = sel.anchor.getNode();
              const codeNode = anchor.getParents().find($isCodeNode) || ($isCodeNode(anchor) ? anchor : null);
              if (codeNode && $isCodeNode(codeNode)) {
                const content = codeNode.getTextContent();
                navigator.clipboard.writeText(content).then(() => {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'COPY_CODE_RESULT', payload: 'ok' }));
                }).catch(() => {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'COPY_CODE_CONTENT', payload: content }));
                });
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
// FLOATING LINK EDITOR — shows on link selection
// ═══════════════════════════════════════════════════════════════════════════════
function FloatingLinkEditorPlugin() {
  const [editor] = useLexicalComposerContext();
  const [linkUrl, setLinkUrl] = useState('');
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel)) { setVisible(false); return; }
        const node = sel.anchor.getNode();
        const parent = node.getParent();
        const linkNode = node.getType() === 'link' ? node : (parent?.getType() === 'link' ? parent : null);
        if (linkNode) {
          setVisible(true);
          setLinkUrl((linkNode as any).__url ?? '');
        } else {
          setVisible(false);
        }
      });
    });
  }, [editor]);

  const applyLink = () => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl || null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="link-editor" style={{ bottom: 60, left: 16, top: 'auto' }}>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>🔗</span>
      <input
        ref={inputRef}
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        placeholder="https://..."
        onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); }}
      />
      <button className="link-editor-btn" onClick={applyLink}>✓</button>
      <button className="link-editor-btn" onClick={() => { editor.dispatchCommand(TOGGLE_LINK_COMMAND, null); setVisible(false); }}>✕</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLICK FOCUS PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════
function ClickFocusPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.classList.contains('editor-container') ||
        target.classList.contains('editor-shell') ||
        target.tagName === 'BODY' ||
        target.tagName === 'HTML'
      ) {
        editor.update(() => { editor.focus(); });
      }
    };
    document.addEventListener('click', handleContainerClick);
    return () => { document.removeEventListener('click', handleContainerClick); };
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
        if (target.closest('.code-action-bar')) {
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
// PAGINATION PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════
function PaginationPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const updatePagination = () => {
      const rootEl = editor.getRootElement();
      if (!rootEl) return;

      const pageSize = document.documentElement.getAttribute('data-page-size') || 'pageless';
      const orientation = document.documentElement.getAttribute('data-page-orientation') || 'portrait';
      const marginAttr = document.documentElement.getAttribute('data-page-margins') || 'normal';

      const children = Array.from(rootEl.children) as HTMLElement[];

      // Clear all page starts first
      children.forEach(child => {
        child.removeAttribute('data-page-start');
      });

      if (pageSize === 'pageless') return;

      const width = rootEl.clientWidth;

      // Aspect ratios map
      const ASPECT_RATIOS: Record<string, number> = {
        a4: 1.414,
        letter: 1.294,
        legal: 1.647,
        tabloid: 1.545,
        a3: 1.414,
        a5: 1.414,
        b4: 1.412,
        b5: 1.420,
        statement: 1.545,
        executive: 1.448,
        folio: 1.529,
      };

      const ratio = ASPECT_RATIOS[pageSize] || 1.414;
      const heightMultiplier = orientation === 'portrait' ? ratio : 1 / ratio;

      // Calculate total page height based on viewport size
      const totalPageHeight = width * heightMultiplier;

      // Subtract padding to find the printable height
      const marginMap: Record<string, number> = { narrow: 32, normal: 56, moderate: 80, wide: 104 };
      const totalPadding = marginMap[marginAttr] || 56;
      const printableHeight = totalPageHeight - totalPadding;

      let cumulativeHeight = 0;
      let pageCount = 1;

      children.forEach((child) => {
        // Skip editor action bar or helper elements that are absolutely positioned
        if (child.classList.contains('code-action-bar') || child.tagName === 'BUTTON') return;

        const childHeight = child.offsetHeight;
        cumulativeHeight += childHeight;

        // If this child element pushes the page past the printable height boundary
        if (cumulativeHeight > printableHeight) {
          child.setAttribute('data-page-start', 'true');
          // Reset count starting with this child's height on the new page
          cumulativeHeight = childHeight;
          pageCount++;
        }
      });

      // Dynamically size the editor-input container to always span full pages
      // total height = (number of pages * height of one page) + (number of gaps * gap height)
      const totalPageHeightWithGaps = (pageCount * totalPageHeight) + ((pageCount - 1) * 56);
      rootEl.style.minHeight = `${totalPageHeightWithGaps}px`;
    };

    // Run on editor updates (text changes, node insertions/deletions)
    const unregisterUpdate = editor.registerUpdateListener(() => {
      // Run after the DOM finishes updating
      setTimeout(updatePagination, 0);
    });

    // Run on window resize or orientation change
    window.addEventListener('resize', updatePagination, { passive: true });

    // Use ResizeObserver for accurate container size tracking
    const rootEl = editor.getRootElement();
    let ro: ResizeObserver | null = null;
    if (rootEl) {
      ro = new ResizeObserver(() => {
        updatePagination();
      });
      ro.observe(rootEl);
    }

    // Also run a MutationObserver on document.documentElement attributes
    // so we re-paginate immediately when the user changes layout settings
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.attributeName && mutation.attributeName.startsWith('data-page-')) {
          updatePagination();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    // Initial run
    setTimeout(updatePagination, 100);

    return () => {
      unregisterUpdate();
      window.removeEventListener('resize', updatePagination);
      observer.disconnect();
      if (ro) ro.disconnect();
    };
  }, [editor]);

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAG DROP LIST PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════
function DragDropListPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let activeDraggedLi: HTMLElement | null = null;
    let draggedNodeKey: string | null = null;
    let dropTargetLi: HTMLElement | null = null;
    let isBefore = true;
    let isDraggingActive = false;

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDraggingActive) {
        e.preventDefault();
      }
    };

    const clearIndicators = (el: HTMLElement | null) => {
      if (el) {
        el.style.borderTop = '';
        el.style.borderBottom = '';
      }
    };

    return editor.registerRootListener((rootElement, prevRootElement) => {
      if (!rootElement) return;

      const handleTouchStart = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        const li = target.closest('li');
        if (li && li.classList.contains('editor-listItemUnchecked')) {
          const rect = li.getBoundingClientRect();
          const touch = e.touches[0];
          const clickX = touch.clientX - rect.left;
          // Drag handle is at left:-22px to -8px (in UL's left-padding, before the li)
          if (clickX >= -22 && clickX <= -8) {
            e.preventDefault(); // Prevent scroll AND long-press text selection
          }
        }
      };

      const handleContextMenu = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const li = target.closest('li');
        if (li && li.classList.contains('editor-listItemUnchecked')) {
          const rect = li.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          // Drag handle at -22px to -8px from li left edge
          if (clickX >= -22 && clickX <= -8) {
            e.preventDefault();
          }
        }
      };

      const handlePointerDown = (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        const li = target.closest('li');
        if (li && li.classList.contains('editor-listItemUnchecked')) {
          const rect = li.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          // Drag handle is at left:-22px to -8px (inside UL's 26px left-padding)
          // These are negative because the handle is before the li's left edge
          if (clickX >= -22 && clickX <= -8) {
            e.preventDefault();
            activeDraggedLi = li;
            li.style.opacity = '0.5';
            isDraggingActive = true;

            // CRITICAL: capture the pointer on the root element so that
            // pointermove / pointerup events keep firing even when the finger
            // moves outside the original <li> or the WebView clips events.
            try { rootElement.setPointerCapture(e.pointerId); } catch (_) {}

            editor.getEditorState().read(() => {
              const node = $getNearestNodeFromDOMNode(li);
              if (node) draggedNodeKey = node.getKey();
            });

            window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
            window.addEventListener('pointercancel', handlePointerCancel);
          }
        }
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (!activeDraggedLi) return;

        const clientX = e.clientX;
        const clientY = e.clientY;
        const hoverEl = document.elementFromPoint(clientX, clientY) as HTMLElement;
        const targetLi = hoverEl?.closest('li');

        if (targetLi && targetLi !== activeDraggedLi && targetLi.classList.contains('editor-listItemUnchecked')) {
          const targetRect = targetLi.getBoundingClientRect();
          const relativeY = clientY - targetRect.top;
          const middleY = targetRect.height / 2;
          const nextIsBefore = relativeY < middleY;

          if (dropTargetLi !== targetLi || isBefore !== nextIsBefore) {
            clearIndicators(dropTargetLi);
            dropTargetLi = targetLi;
            isBefore = nextIsBefore;

            if (isBefore) {
              targetLi.style.borderTop = '2.5px solid var(--accent)';
              targetLi.style.borderBottom = '';
            } else {
              targetLi.style.borderBottom = '2.5px solid var(--accent)';
              targetLi.style.borderTop = '';
            }
          }
        } else {
          if (dropTargetLi) {
            clearIndicators(dropTargetLi);
            dropTargetLi = null;
          }
        }
      };

      const handlePointerUp = (e: PointerEvent) => {
        cleanupDrag();
      };

      const handlePointerCancel = (e: PointerEvent) => {
        cleanupDrag();
      };

      const cleanupDrag = () => {
        if (activeDraggedLi) {
          activeDraggedLi.style.opacity = '';
        }
        if (dropTargetLi) {
          clearIndicators(dropTargetLi);
        }

        if (draggedNodeKey && dropTargetLi) {
          editor.update(() => {
            const srcNode = $getNodeByKey(draggedNodeKey!);
            const destNode = $getNearestNodeFromDOMNode(dropTargetLi!);
            if (srcNode && destNode && srcNode !== destNode) {
              if (isBefore) {
                destNode.insertBefore(srcNode);
              } else {
                destNode.insertAfter(srcNode);
              }
            }
          });
        }

        activeDraggedLi = null;
        draggedNodeKey = null;
        dropTargetLi = null;
        isDraggingActive = false;

        window.removeEventListener('touchmove', handleGlobalTouchMove);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
      };

      rootElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      rootElement.addEventListener('pointerdown', handlePointerDown);
      rootElement.addEventListener('contextmenu', handleContextMenu);

      return () => {
        rootElement.removeEventListener('touchstart', handleTouchStart);
        rootElement.removeEventListener('pointerdown', handlePointerDown);
        rootElement.removeEventListener('contextmenu', handleContextMenu);
        window.removeEventListener('touchmove', handleGlobalTouchMove);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
      };
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

          {/* Tier 2: Structural plugins */}
          <TablePlugin />

          {/* Bridge & UX plugins */}
          <SelectionSaverPlugin />
          <ToolbarBridgePlugin />
          <SelectionStatePlugin />
          <AutoSavePlugin />
          <KeyboardScrollPlugin />
          <FloatingLinkEditorPlugin />
          <ClickFocusPlugin />
          <SlashCommandPlugin />
          <CodeLanguageClickPlugin />
          <PaginationPlugin />
          <DragDropListPlugin />
        </div>
      </div>
    </LexicalComposer>
  );
}
