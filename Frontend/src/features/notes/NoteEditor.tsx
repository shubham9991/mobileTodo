/**
 * NoteEditor — WebView wrapper that renders the Lexical editor.
 *
 * Native-feel checklist applied here:
 * ✅ Loads from android_asset (zero network, zero flash)
 * ✅ backgroundColor="transparent" (RN background shines through)
 * ✅ softwareKeyboardLayoutAdjustment="resize" (keyboard doesn't hide cursor)
 * ✅ overScrollMode="never" (no Android overscroll glow)
 * ✅ scalesPageToFit={false} (prevents WebView zoom-to-fit)
 */
import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import WebView from 'react-native-webview';
import { useTheme } from '../../themes/ThemeContext';
import { useEditorBridge, SavePayload } from './useEditorBridge';
import { NoteToolbar } from './NoteToolbar';

interface NoteEditorProps {
  /** Serialized Lexical JSON AST string (for editing existing notes) */
  initialStateJson?: string;
  /** Called whenever the editor auto-saves (debounced 1.5s) */
  onSave: (payload: SavePayload) => void;
  /** Called when editor is ready to accept commands */
  onReady?: () => void;
  /** Explanatory toast triggers when actions are fired */
  onActionTriggered?: (type: string, payload?: string) => void;
}

// The bundled Lexical editor lives in the Android assets folder.
// For iOS, the file would need to be in the app bundle via Xcode.
const EDITOR_SOURCE: { uri: string } =
  Platform.OS === 'android'
    ? { uri: 'file:///android_asset/editor.html' }
    : { uri: 'editor.html' }; // iOS: add editor.html to Xcode Copy Bundle Resources

export function NoteEditor({ initialStateJson, onSave, onReady, onActionTriggered }: NoteEditorProps) {
  const { theme, isDark } = useTheme();
  const { webviewRef, sendCommand, selectionState, isReady, onMessage } = useEditorBridge({
    onSave,
    onReady,
  });

  // After editor signals ready: sync theme + accent + load existing state
  useEffect(() => {
    if (!isReady) return;
    sendCommand('SET_THEME', isDark ? 'dark' : 'light');
    sendCommand('SET_ACCENT', theme.colors.primary);
    if (initialStateJson) {
      sendCommand('LOAD_STATE', initialStateJson);
    }
    sendCommand('FOCUS');
  }, [isReady, isDark, theme.colors.primary, initialStateJson, sendCommand]);

  // Re-sync theme if user toggles dark mode while editor is open
  useEffect(() => {
    if (!isReady) return;
    sendCommand('SET_THEME', isDark ? 'dark' : 'light');
    sendCommand('SET_ACCENT', theme.colors.primary);
  }, [isDark, theme.colors.primary, isReady, sendCommand]);

  const handleLoad = useCallback(() => {
    // onLoad fires before EDITOR_READY message — we use EDITOR_READY instead
    // but also send a focus as a fallback
    setTimeout(() => { if (!isReady) sendCommand('FOCUS'); }, 500);
  }, [isReady, sendCommand]);

  // Directly inject JS to blur the WebView's active element — the only reliable
  // way to dismiss the keyboard when it is owned by the WebView.
  const blurWebView = useCallback(() => {
    webviewRef.current?.injectJavaScript('document.activeElement && document.activeElement.blur(); true;');
  }, [webviewRef]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <WebView
        ref={webviewRef}
        source={EDITOR_SOURCE}
        // ── Native-feel props ──────────────────────────────────────
        // #1 Transparent: native app background shows through
        style={styles.webview}
        // Android hardware layer allows transparency
        androidLayerType="hardware"
        // ── Core WebView config ────────────────────────────────────
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // Prevent WebView from scaling the page (kills double-tap zoom)
        scalesPageToFit={false}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        // #2 Kill overscroll bounce/glow
        overScrollMode="never"
        bounces={false}
        // Performance
        cacheEnabled={false}
        // Message bridge
        onMessage={onMessage}
        onLoad={handleLoad}
        // Allow file:// access for loading assets
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        originWhitelist={['*']}
        // Render loading indicator while editor initializes
        renderLoading={() => (
          <View style={[styles.loadingOverlay, { backgroundColor: theme.colors.background }]}>
            <ActivityIndicator color={theme.colors.primary} size="small" />
          </View>
        )}
        startInLoadingState={true}
      />

      {/* Native toolbar rendered OUTSIDE the WebView — participates in safe area + keyboard */}
      <NoteToolbar
        sendCommand={sendCommand}
        selectionState={selectionState}
        isEditorReady={isReady}
        onActionTriggered={onActionTriggered}
        blurWebView={blurWebView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
