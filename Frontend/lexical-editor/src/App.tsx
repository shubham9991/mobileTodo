/**
 * Lexical Editor — Full-featured, native-feeling web editor
 * bundled as a single HTML file for React Native WebView.
 *
 * Architecture:
 *   Tier 1 (always loaded): RichText, History, List, Link, AutoLink,
 *                           Markdown shortcuts, Hashtag, Code highlight
 *   Tier 2 (bridge-activated): Table, Image, YouTube, Equation,
 *                               Collapsible, Color, Link editor
 */
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
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $isParagraphNode,
  TextFormatType,
  ElementFormatType,
} from 'lexical';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
} from '@lexical/list';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode, $isHeadingNode } from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { $generateHtmlFromNodes } from '@lexical/html';
import { $patchStyleText } from '@lexical/selection';
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

// ── Type declaration for React Native bridge ─────────────────────────────────
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
}

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

        // Determine active block type for toolbar indicator
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === 'root'
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();

        let blockType = 'paragraph';
        if ($isHeadingNode(element)) blockType = element.getTag();
        else if ($isListNode(element)) blockType = element.getListType();
        else if (!$isParagraphNode(element)) blockType = element.getType();

        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'SELECTION_STATE',
          payload: {
            // Inline formats
            bold: selection.hasFormat('bold'),
            italic: selection.hasFormat('italic'),
            underline: selection.hasFormat('underline'),
            strikethrough: selection.hasFormat('strikethrough'),
            code: selection.hasFormat('code'),
            subscript: selection.hasFormat('subscript'),
            superscript: selection.hasFormat('superscript'),
            highlight: selection.hasFormat('highlight'),
            // Block type
            blockType,
          },
        }));
      });
    });
  }, [editor]);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-SAVE PLUGIN — debounced 1.5s: sends JSON AST + HTML + plain text to RN
// ═══════════════════════════════════════════════════════════════════════════════
function AutoSavePlugin() {
  const [editor] = useLexicalComposerContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // Only save when there are actual content changes (not just selection moves)
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
// KEYBOARD SCROLL PLUGIN — prevents cursor from hiding behind Android keyboard
// ═══════════════════════════════════════════════════════════════════════════════
function KeyboardScrollPlugin() {
  useEffect(() => {
    const handleViewportResize = () => {
      // When the visual viewport shrinks (keyboard opens), scroll active element into view
      requestAnimationFrame(() => {
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl) {
          activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        // Additionally scroll the selection range into view
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
          if (rect.bottom > viewportHeight - 20) {
            window.scrollBy({ top: rect.bottom - viewportHeight + 40, behavior: 'smooth' });
          }
        }
      });
    };

    window.visualViewport?.addEventListener('resize', handleViewportResize);
    window.visualViewport?.addEventListener('scroll', handleViewportResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('scroll', handleViewportResize);
    };
  }, []);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLBAR BRIDGE PLUGIN — receives commands from native RN toolbar
// ═══════════════════════════════════════════════════════════════════════════════
function ToolbarBridgePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const executeCommand = (type: string, payload?: string) => {
      const skipFocus = ['LOAD_STATE', 'GET_STATE', 'SET_THEME', 'SET_ACCENT'].includes(type);
      if (!skipFocus) {
        editor.focus();
      }

      switch (type) {
        // ── Inline text formatting ──────────────────────────────────
        case 'FORMAT_TEXT':
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, payload as TextFormatType);
          break;

        // ── Element / block alignment ───────────────────────────────
        case 'FORMAT_ELEMENT':
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, payload as ElementFormatType);
          break;

        // ── Indentation ─────────────────────────────────────────────
        case 'INDENT':
          editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
          break;
        case 'OUTDENT':
          editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
          break;

        // ── History ─────────────────────────────────────────────────
        case 'UNDO':
          editor.dispatchCommand(UNDO_COMMAND, undefined);
          break;
        case 'REDO':
          editor.dispatchCommand(REDO_COMMAND, undefined);
          break;

        // ── Lists ────────────────────────────────────────────────────
        case 'INSERT_UL':
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          break;
        case 'INSERT_OL':
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
          break;
        case 'INSERT_CHECK':
          editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
          break;
        case 'REMOVE_LIST':
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          break;

        // ── Headings ─────────────────────────────────────────────────
        case 'SET_HEADING':
          editor.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) {
              $setBlocksType(sel, () => $createHeadingNode(payload as 'h1' | 'h2' | 'h3'));
            }
          });
          break;

        // ── Block types ───────────────────────────────────────────────
        case 'SET_PARAGRAPH':
          editor.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createParagraphNode());
          });
          break;
        case 'SET_QUOTE':
          editor.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createQuoteNode());
          });
          break;
        case 'SET_CODE':
          editor.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createCodeNode());
          });
          break;

        // ── Insert elements ───────────────────────────────────────────
        case 'INSERT_HR':
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
          break;
        case 'INSERT_TABLE': {
          const [rows = '3', cols = '3'] = (payload ?? '3,3').split(',');
          editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows, columns: cols, includeHeaders: true });
          break;
        }
        case 'TOGGLE_LINK':
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, payload ?? null);
          break;
        case 'INSERT_IMAGE': {
          if (!payload) break;
          try {
            const { src, altText } = JSON.parse(payload);
            editor.update(() => {
              const sel = $getSelection();
              if (sel) {
                const imageNode = $createImageNode(src, altText ?? '');
                sel.insertNodes([imageNode]);
              }
            });
          } catch {}
          break;
        }
        case 'INSERT_YOUTUBE': {
          if (!payload) break;
          editor.update(() => {
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
              const sel = $getSelection();
              if (sel) sel.insertNodes([$createEquationNode(equation, inline ?? false)]);
            });
          } catch {}
          break;
        }
        case 'INSERT_COLLAPSIBLE': {
          editor.update(() => {
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

        // ── Text color / highlight color ──────────────────────────────
        case 'SET_TEXT_COLOR': {
          if (!payload) break;
          editor.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) $patchStyleText(sel, { color: payload });
          });
          break;
        }
        case 'SET_HIGHLIGHT_COLOR': {
          if (!payload) break;
          editor.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) $patchStyleText(sel, { 'background-color': payload });
          });
          break;
        }
        case 'CLEAR_FORMATTING': {
          editor.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) {
              const formats: TextFormatType[] = ['bold', 'italic', 'underline', 'strikethrough', 'code', 'highlight', 'subscript', 'superscript'];
              formats.forEach(f => { if (sel.hasFormat(f)) editor.dispatchCommand(FORMAT_TEXT_COMMAND, f); });
              $patchStyleText(sel, { color: '', 'background-color': '' });
            }
          });
          break;
        }

        // ── Text transform ────────────────────────────────────────────
        case 'TEXT_TRANSFORM': {
          editor.update(() => {
            const sel = $getSelection();
            if (!$isRangeSelection(sel)) return;
            const nodes = sel.getNodes();
            nodes.forEach(node => {
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

        // ── Theme sync ────────────────────────────────────────────────
        case 'SET_THEME': {
          document.documentElement.setAttribute('data-theme', payload === 'dark' ? 'dark' : 'light');
          break;
        }
        case 'SET_ACCENT': {
          if (payload) document.documentElement.style.setProperty('--accent', payload);
          break;
        }

        // ── State management ──────────────────────────────────────────
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
        case 'FOCUS': {
          editor.focus();
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

    // Bind to window for direct injectJavaScript calls
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

    // Android WebView sends to document; iOS to window — register both
    document.addEventListener('message', handleMessage as EventListener);
    window.addEventListener('message', handleMessage);

    // Signal to RN that the editor is ready
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'EDITOR_READY' }));

    return () => {
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
// CLICK FOCUS PLUGIN — clicking anywhere in the container focuses the editor
// ═══════════════════════════════════════════════════════════════════════════════
function ClickFocusPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Focus if we click on the container background or padding area
      if (
        target.classList.contains('editor-container') ||
        target.classList.contains('editor-shell') ||
        target.tagName === 'BODY' ||
        target.tagName === 'HTML'
      ) {
        editor.update(() => {
          editor.focus();
        });
      }
    };

    document.addEventListener('click', handleContainerClick);
    return () => {
      document.removeEventListener('click', handleContainerClick);
    };
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
                aria-placeholder="Start writing…"
                aria-label="Note editor"
                placeholder={
                  <div className="editor-placeholder">Start writing…</div>
                }
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

          {/* Tier 2: Structural plugins */}
          <TablePlugin />

          {/* Bridge & UX plugins */}
          <ToolbarBridgePlugin />
          <SelectionStatePlugin />
          <AutoSavePlugin />
          <KeyboardScrollPlugin />
          <FloatingLinkEditorPlugin />
          <ClickFocusPlugin />
        </div>
      </div>
    </LexicalComposer>
  );
}
