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
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, ToastAndroid, Alert } from 'react-native';
import WebView from 'react-native-webview';
import { useTheme } from '../../themes/ThemeContext';
import { useEditorBridge, SavePayload } from './useEditorBridge';
import { NoteToolbar } from './NoteToolbar';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';

interface NoteEditorProps {
  /** Serialized Lexical JSON AST string (for editing existing notes) */
  initialStateJson?: string;
  /** Called whenever the editor auto-saves (debounced 1.5s) */
  onSave: (payload: SavePayload) => void;
  /** Called when editor is ready to accept commands */
  onReady?: () => void;
  /** Explanatory toast triggers when actions are fired */
  onActionTriggered?: (type: string, payload?: string) => void;
  /** Called with sendCommand so the parent can invoke editor commands (e.g. undo/redo from header) */
  onCommandReady?: (sendCommand: (type: string, payload?: string) => void) => void;
}

import { EDITOR_HTML } from './editorBundle';

// Loads the bundled Lexical editor directly from JavaScript bundle (instant Metro hot-reload)
const EDITOR_SOURCE = { html: EDITOR_HTML, baseUrl: 'file:///android_asset/' };

export function NoteEditor({ initialStateJson, onSave, onReady, onActionTriggered, onCommandReady }: NoteEditorProps) {
  const { theme, isDark } = useTheme();
  const [codeLanguageClickTrigger, setCodeLanguageClickTrigger] = useState(0);
  const [activeModalTrigger, setActiveModalTrigger] = useState<{ type: string; count: number } | null>(null);

  const { webviewRef, sendCommand, selectionState, isReady, onMessage } = useEditorBridge({
    onSave,
    onReady,
    onCopied: () => {
      if (Platform.OS === 'android') ToastAndroid.show('Code copied to clipboard!', ToastAndroid.SHORT);
      else Alert.alert('Copied', 'Code copied to clipboard!');
    },
    onCopyFallback: async (content: string) => {
      try {
        await Clipboard.setStringAsync(content);
      } catch {
        // ignore
      }
      if (Platform.OS === 'android') ToastAndroid.show('Code copied to clipboard!', ToastAndroid.SHORT);
      else Alert.alert('Copied', 'Code copied to clipboard!');
    },
    onDownloadCode: async ({ content, filename }) => {
      try {
        const path = `${FileSystem.cacheDirectory ?? ''}${filename}`;
        await FileSystem.writeAsStringAsync(path, content, { encoding: 'utf8' as any });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: `Save ${filename}` });
        } else {
          Alert.alert('Download', `File saved as ${filename}`);
        }
      } catch {
        Alert.alert('Error', 'Could not save file.');
      }
    },
    onFeatureNote: (message: string) => {
      if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
      else Alert.alert('Info', message);
    },
    onCodeLangClick: () => setCodeLanguageClickTrigger(c => c + 1),
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
    // Expose sendCommand to parent
    onCommandReady?.(sendCommand);
  }, [isReady, isDark, theme.colors.primary, initialStateJson, sendCommand]);

  // Re-sync theme if user toggles dark mode while editor is open
  useEffect(() => {
    if (!isReady) return;
    sendCommand('SET_THEME', isDark ? 'dark' : 'light');
    sendCommand('SET_ACCENT', theme.colors.primary);
  }, [isDark, theme.colors.primary, isReady, sendCommand]);

  const handleLoad = useCallback(() => {
    setTimeout(() => { if (!isReady) sendCommand('FOCUS'); }, 500);
  }, [isReady, sendCommand]);

  const blurWebView = useCallback(() => {
    webviewRef.current?.injectJavaScript('document.activeElement && document.activeElement.blur(); true;');
  }, [webviewRef]);

  // Handle INSERT_IMAGE_NATIVE: open image picker, persist to app storage, send file URI to editor
  const handleActionTriggered = useCallback(async (type: string, payload?: string) => {
    if (type === 'INSERT_IMAGE_NATIVE') {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow access to your photo library to insert images.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          base64: true,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          let imageUri = asset.uri;

          try {
            const noteImagesDir = `${FileSystem.documentDirectory}note_images/`;
            const dirInfo = await FileSystem.getInfoAsync(noteImagesDir);
            if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(noteImagesDir, { intermediates: true });
            }

            const fileExt = (asset.uri.split('.').pop() || 'jpg').split('?')[0];
            const permanentPath = `${noteImagesDir}img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
            
            await FileSystem.copyAsync({
              from: asset.uri,
              to: permanentPath,
            });
            imageUri = permanentPath;
          } catch {
            if (asset.base64) {
              imageUri = `data:image/jpeg;base64,${asset.base64}`;
            }
          }

          sendCommand('INSERT_IMAGE', JSON.stringify({ src: imageUri, altText: '' }));
        }
      } catch (e) {
        Alert.alert('Error', 'Could not open image picker.');
      }
    }
    onActionTriggered?.(type, payload);
  }, [sendCommand, onActionTriggered]);

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
        onActionTriggered={handleActionTriggered}
        blurWebView={blurWebView}
        codeLanguageClickTrigger={codeLanguageClickTrigger}
        activeModalTrigger={activeModalTrigger}
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
