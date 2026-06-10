/**
 * useEditorBridge — bidirectional communication hook between
 * React Native and the Lexical WebView.
 *
 * FROM React Native → WebView: sendCommand(type, payload?)
 *   Uses injectJavaScript to dispatch a MessageEvent into the web context.
 *
 * FROM WebView → React Native: onMessage(event)
 *   The WebView fires window.ReactNativeWebView.postMessage(json)
 *   and this hook parses and routes the incoming message.
 */
import { useRef, useCallback, useState } from 'react';
import { Keyboard } from 'react-native';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

// ── Toolbar active-state shape ────────────────────────────────────────────────
export interface SelectionState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  subscript: boolean;
  superscript: boolean;
  highlight: boolean;
  /** 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'code' | 'bullet' | 'number' | 'check' | 'table' */
  blockType: string;
  fontFamily: string;
  fontSize?: string;
  codeLanguage: string;
  align?: 'left' | 'center' | 'right' | 'justify';
}

const DEFAULT_SELECTION: SelectionState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  subscript: false,
  superscript: false,
  highlight: false,
  blockType: 'paragraph',
  fontFamily: 'System',
  fontSize: '16px',
  codeLanguage: '',
};

export type SavePayload = {
  json: object;
  html: string;
  text: string;
  wordCount: number;
};

export type EditorEventHandler = {
  onSave?: (payload: SavePayload) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  onCopied?: () => void;
  onDownloadCode?: (payload: { content: string; filename: string; language: string }) => void;
  onCopyFallback?: (content: string) => void;
  onFeatureNote?: (message: string) => void;
  onLayoutChange?: (layout: object) => void;
  onSlashMenuOpen?: () => void;
  onSlashMenuClose?: () => void;
  onCodeLangClick?: () => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useEditorBridge(handlers: EditorEventHandler = {}) {
  const webviewRef = useRef<WebView>(null);
  const [selectionState, setSelectionState] = useState<SelectionState>(DEFAULT_SELECTION);
  const [isReady, setIsReady] = useState(false);

  /**
   * sendCommand — fires a command into the Lexical editor.
   * Uses injectJavaScript (correct direction: RN → WebView).
   * Dispatches to both window and document for Android/iOS compat.
   */
  const sendCommand = useCallback((type: string, payload?: string) => {
    const msg = JSON.stringify({ type, payload });
    // JSON.stringify the already-serialized msg string so it becomes a JS string literal
    const jsPayload = JSON.stringify(msg);
    webviewRef.current?.injectJavaScript(`
      if (window.onNativeCommand) {
        window.onNativeCommand(${JSON.stringify(type)}, ${JSON.stringify(payload ?? null)});
      } else {
        (function() {
          var evt = new MessageEvent('message', { data: ${jsPayload}, bubbles: false });
          window.dispatchEvent(evt);
          document.dispatchEvent(evt);
        })();
      }
      true;
    `);
  }, []);

  /**
   * onMessage — handles all messages coming FROM the Lexical WebView.
   */
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let parsed: { type: string; payload?: unknown };
    try {
      parsed = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    const { type, payload } = parsed;

    switch (type) {
      case 'SELECTION_STATE':
        setSelectionState(payload as SelectionState);
        break;
      case 'AUTO_SAVE':
        handlers.onSave?.(payload as SavePayload);
        break;
      case 'STATE_SNAPSHOT':
        handlers.onSave?.(payload as SavePayload);
        break;
      case 'EDITOR_READY':
        setIsReady(true);
        handlers.onReady?.();
        break;
      case 'EDITOR_ERROR':
        handlers.onError?.(payload as string);
        break;
      case 'COPY_CODE_RESULT':
        handlers.onCopied?.();
        break;
      case 'COPY_CODE_CONTENT':
        // Clipboard API failed — fall back to native clipboard
        handlers.onCopyFallback?.(payload as string);
        break;
      case 'DOWNLOAD_CODE_CONTENT':
        handlers.onDownloadCode?.(payload as { content: string; filename: string; language: string });
        break;
      case 'EDITOR_BLUR':
        Keyboard.dismiss();
        break;
      case 'FEATURE_NOTE':
        handlers.onFeatureNote?.(payload as string);
        break;
      case 'PAGE_LAYOUT_CHANGE':
        handlers.onLayoutChange?.(payload as object);
        break;
      case 'SLASH_MENU_OPEN':
        handlers.onSlashMenuOpen?.();
        break;
      case 'SLASH_MENU_CLOSE':
        handlers.onSlashMenuClose?.();
        break;
      case 'CODE_LANG_CLICK':
        handlers.onCodeLangClick?.();
        break;
    }
  }, [handlers]);

  return {
    webviewRef,
    sendCommand,
    selectionState,
    isReady,
    onMessage,
  };
}
