/**
 * DrawingEditor — WebView wrapper that renders the tldraw drawing canvas.
 *
 * Architecture mirrors NoteEditor.tsx exactly:
 * ✅ Loads drawing.html from android_asset (zero network, zero flash)
 * ✅ Full bidirectional message bridge (RN ↔ tldraw)
 * ✅ Auto-save with debounce via SAVE message
 * ✅ Thumbnail capture via THUMBNAIL message
 * ✅ Theme sync (dark/light)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, ActivityIndicator, Platform, TouchableOpacity,
  Text, TextInput, Alert, StatusBar, ToastAndroid,
} from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../themes/ThemeContext';
import {
  saveDrawing, saveThumbnail, updateDrawingTitle,
} from './drawingStore';

const DRAWING_SOURCE =
  Platform.OS === 'android'
    ? { uri: 'file:///android_asset/drawing.html' }
    : { uri: 'drawing.html' };

interface DrawingEditorProps {
  drawingId: string;
  initialTitle: string;
  initialSnapshotJson?: string | null;
  onBack: () => void;
}

export function DrawingEditor({
  drawingId,
  initialTitle,
  initialSnapshotJson,
  onBack,
}: DrawingEditorProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

  const webviewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [title, setTitle] = useState(initialTitle || 'Untitled Sketch');
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<TextInput>(null);

  // ── Send command to tldraw WebView ──────────────────────────────────────────
  const sendCommand = useCallback((type: string, payload?: string) => {
    const msg = JSON.stringify({ type, payload });
    webviewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(msg)} })); true;`
    );
  }, []);

  // ── After editor ready: sync theme + load existing snapshot ─────────────────
  useEffect(() => {
    if (!isReady) return;
    sendCommand('SET_THEME', isDark ? 'dark' : 'light');
    if (initialSnapshotJson) {
      sendCommand('LOAD_STATE', initialSnapshotJson);
    }
  }, [isReady]);

  // ── Re-sync theme on toggle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return;
    sendCommand('SET_THEME', isDark ? 'dark' : 'light');
  }, [isDark, isReady]);

  // ── Handle messages FROM tldraw ─────────────────────────────────────────────
  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    let msg: { type: string; payload?: string | null };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'READY': {
        setIsReady(true);
        break;
      }
      case 'SAVE': {
        if (msg.payload) {
          await saveDrawing(drawingId, msg.payload, title);
        }
        break;
      }
      case 'THUMBNAIL': {
        if (msg.payload) {
          await saveThumbnail(drawingId, msg.payload);
        }
        break;
      }
      case 'EXPORT_RESULT': {
        // Future: handle share/export flow
        break;
      }
      case 'DOWNLOAD_FILE': {
        if (!msg.payload) break;
        try {
          const { dataUrl, filename, url } = JSON.parse(msg.payload) as {
            dataUrl?: string;
            filename: string;
            url?: string;
          };

          const ext = filename.split('.').pop() || 'png';
          const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
          const cachePath = `${FileSystem.cacheDirectory}${filename}`;

          if (dataUrl) {
            // Strip the data URL prefix and save raw base64
            const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
            await FileSystem.writeAsStringAsync(cachePath, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } else if (url) {
            // Download from URL directly
            await FileSystem.downloadAsync(url, cachePath);
          } else {
            break;
          }

          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(cachePath, {
              mimeType,
              dialogTitle: `Save ${filename}`,
              UTI: ext === 'svg' ? 'public.svg-image' : 'public.image',
            });
          } else {
            Alert.alert('Saved', `Image saved to ${cachePath}`);
          }
          if (Platform.OS === 'android') {
            ToastAndroid.show('Image ready to save!', ToastAndroid.SHORT);
          }
        } catch (err) {
          console.error('[DrawingEditor] DOWNLOAD_FILE error', err);
          Alert.alert('Error', 'Could not save the image. Please try again.');
        }
        break;
      }
    }
  }, [drawingId, title]);

  const handleTitleSubmit = useCallback(async () => {
    setEditingTitle(false);
    const trimmed = title.trim() || 'Untitled Sketch';
    setTitle(trimmed);
    await updateDrawingTitle(drawingId, trimmed);
  }, [drawingId, title]);

  const handleUndo = useCallback(() => sendCommand('UNDO'), [sendCommand]);
  const handleRedo = useCallback(() => sendCommand('REDO'), [sendCommand]);
  const handleZoomFit = useCallback(() => sendCommand('ZOOM_TO_FIT'), [sendCommand]);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear Canvas',
      'This will erase all content. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => sendCommand('CLEAR_CANVAS'),
        },
      ]
    );
  }, [sendCommand]);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Native Header Bar ────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: c.cardPrimary,
            borderBottomColor: c.border,
            paddingTop: insets.top + 4,
          },
        ]}
      >
        {/* Back button */}
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>

        {/* Editable title */}
        {editingTitle ? (
          <TextInput
            ref={titleInputRef}
            style={[styles.titleInput, { color: c.text, borderBottomColor: c.primary }]}
            value={title}
            onChangeText={setTitle}
            onBlur={handleTitleSubmit}
            onSubmitEditing={handleTitleSubmit}
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
          />
        ) : (
          <TouchableOpacity onPress={() => setEditingTitle(true)} style={styles.titleBtn}>
            <Text
              style={[styles.titleText, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <MaterialIcons name="edit" size={13} color={c.textSecondary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        )}

        {/* Right action buttons */}
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleUndo} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="undo" size={20} color={c.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRedo} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="redo" size={20} color={c.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleZoomFit} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="fit-screen" size={20} color={c.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClear} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="delete-sweep" size={20} color={c.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── tldraw WebView Canvas ─────────────────────────────────────────── */}
      <WebView
        ref={webviewRef}
        source={DRAWING_SOURCE}
        style={styles.webview}
        androidLayerType="hardware"
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit={false}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
        cacheEnabled={false}
        onMessage={onMessage}
        onConsoleMessage={(e) => console.log('[Drawing WebView]', e.nativeEvent.message)}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        originWhitelist={['*']}
        // Allow pinch-to-zoom — tldraw needs native touch gestures
        setBuiltInZoomControls={false}
        builtInZoomControls={false}
        renderLoading={() => (
          <View style={[styles.loadingOverlay, { backgroundColor: c.background }]}>
            <ActivityIndicator color={c.primary} size="large" />
            <Text style={[styles.loadingText, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Loading canvas…
            </Text>
          </View>
        )}
        startInLoadingState
      />

      {/* Bottom safe area fill so tldraw toolbar clears the nav bar */}
      <View style={{ height: insets.bottom, backgroundColor: c.cardPrimary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    gap: 6,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  titleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  titleText: {
    fontSize: 16,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  titleInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottomWidth: 1.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
});
