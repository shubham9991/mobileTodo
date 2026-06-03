/**
 * NoteScreen — full-screen note editing experience.
 * Handles: title editing, save state indicator, back navigation,
 * and wrapping the NoteEditor.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import { NoteEditor } from './NoteEditor';
import {
  getNote, saveNote, createBlankNote, buildPreview,
  formatRelativeTime, type Note,
} from '../../core/db/notesStore';
import type { SavePayload } from './useEditorBridge';

type SaveStatus = 'idle' | 'saving' | 'saved';

interface ActionInfo {
  title: string;
  desc: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const ACTION_MAP: Record<string, ActionInfo | ((payload?: string) => ActionInfo)> = {
  FORMAT_TEXT: (payload) => {
    switch (payload) {
      case 'bold':
        return { title: 'Bold', desc: 'Makes your text thicker and stand out.', icon: 'format-bold' };
      case 'italic':
        return { title: 'Italic', desc: 'Slants text to emphasize it or show quotes.', icon: 'format-italic' };
      case 'underline':
        return { title: 'Underline', desc: 'Draws a line under text to highlight it.', icon: 'format-underlined' };
      case 'strikethrough':
        return { title: 'Strikethrough', desc: 'Crosses out text to show deletions.', icon: 'strikethrough-s' };
      case 'highlight':
        return { title: 'Highlight', desc: 'Colorizes text background like a marker.', icon: 'highlight' };
      case 'code':
        return { title: 'Inline Code', desc: 'Applies monospace styling for code snippets.', icon: 'code' };
      case 'subscript':
        return { title: 'Subscript', desc: 'Places text slightly below the normal line.', icon: 'text-format' };
      case 'superscript':
        return { title: 'Superscript', desc: 'Places text slightly above the normal line.', icon: 'text-format' };
      default:
        return { title: 'Format Text', desc: 'Applies inline text formatting.', icon: 'format-color-text' };
    }
  },
  SET_HEADING: (payload) => {
    const num = payload === 'h1' ? '1' : payload === 'h2' ? '2' : '3';
    return {
      title: `Heading ${num}`,
      desc: `Applies Large Heading ${num} styling for titles.`,
      icon: 'title',
    };
  },
  SET_PARAGRAPH: { title: 'Paragraph', desc: 'Reverts text to standard body text formatting.', icon: 'notes' },
  SET_QUOTE: { title: 'Blockquote', desc: 'Styles paragraph as an indented quote block.', icon: 'format-quote' },
  SET_CODE: { title: 'Code Block', desc: 'Formats text into a syntax-highlighted code block.', icon: 'data-object' },
  INSERT_UL: { title: 'Bullet List', desc: 'Creates a bulleted list of items.', icon: 'format-list-bulleted' },
  INSERT_OL: { title: 'Numbered List', desc: 'Creates an ordered numbered list of items.', icon: 'format-list-numbered' },
  INSERT_CHECK: { title: 'Checklist', desc: 'Adds interactive checkable tasks.', icon: 'checklist' },
  INDENT: { title: 'Increase Indent', desc: 'Pushes text paragraph rightward.', icon: 'format-indent-increase' },
  OUTDENT: { title: 'Decrease Indent', desc: 'Pulls text paragraph leftward.', icon: 'format-indent-decrease' },
  UNDO: { title: 'Undo Action', desc: 'Reverts your last text editing action.', icon: 'undo' },
  REDO: { title: 'Redo Action', desc: 'Restores your last undone action.', icon: 'redo' },
  SET_TEXT_COLOR: { title: 'Text Color', desc: 'Changes the color of the selected text.', icon: 'format-color-text' },
  SET_HIGHLIGHT_COLOR: { title: 'Highlight Color', desc: 'Changes the text background highlight color.', icon: 'border-color' },
  CLEAR_FORMATTING: { title: 'Clear Format', desc: 'Clears all formatting and styles from selection.', icon: 'format-clear' },
  TOGGLE_LINK: { title: 'Hyperlink', desc: 'Inserts or removes a clickable web link.', icon: 'link' },
  INSERT_TABLE: { title: 'Insert Table', desc: 'Creates a grid layout for tabular data.', icon: 'table-chart' },
  INSERT_HR: { title: 'Divider Line', desc: 'Adds a horizontal line separating sections.', icon: 'horizontal-rule' },
  INSERT_COLLAPSIBLE: { title: 'Collapsible', desc: 'Adds a toggleable collapsible accordion.', icon: 'expand-more' },
  INSERT_YOUTUBE: { title: 'YouTube Embed', desc: 'Embeds an interactive YouTube video player.', icon: 'play-circle-outline' },
  INSERT_EQUATION: { title: 'LaTeX Formula', desc: 'Inserts a formatted mathematical equation.', icon: 'functions' },
  FORMAT_ELEMENT: (payload) => {
    return {
      title: `Align ${payload ? payload.charAt(0).toUpperCase() + payload.slice(1) : ''}`,
      desc: `Aligns paragraph text to the ${payload || 'left'}.`,
      icon: `format-align-${payload === 'start' ? 'left' : payload === 'end' ? 'right' : payload || 'left'}` as any,
    };
  },
};

export function NoteScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { noteId, noteTitle: paramTitle } = useLocalSearchParams<{ noteId: string; noteTitle?: string }>();

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState(paramTitle ?? '');

  // Toast state & animations
  const [toast, setToast] = useState<{ title: string; desc: string; icon: keyof typeof MaterialIcons.glyphMap } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideAnim = useRef(new Animated.Value(320)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleActionTriggered = useCallback((type: string, payload?: string) => {
    const mapping = ACTION_MAP[type];
    if (!mapping) return;
    const info = typeof mapping === 'function' ? mapping(payload) : mapping;

    // Reset animation states
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    slideAnim.stopAnimation();
    opacityAnim.stopAnimation();
    slideAnim.setValue(320);
    opacityAnim.setValue(0);

    setToast(info);

    // Animated spring slide in
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    toastTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 320,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToast(null);
      });
    }, 2800);
  }, []);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [wordCount, setWordCount] = useState(0);
  const [initialStateJson, setInitialStateJson] = useState<string | undefined>(undefined);
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayload = useRef<SavePayload | null>(null);
  const c = theme.colors;

  // Load existing note on mount
  useEffect(() => {
    if (!noteId) return;
    getNote(noteId).then(existing => {
      if (existing) {
        setNote(existing);
        setTitle(existing.title);
        setWordCount(existing.wordCount ?? 0);
        if (existing.content && Object.keys(existing.content).length > 0) {
          setInitialStateJson(JSON.stringify(existing.content));
        }
      } else {
        // New note
        const blank = createBlankNote(noteId, paramTitle ?? '');
        setNote(blank);
      }
    });
  }, [noteId, paramTitle]);

  // Handle auto-save payload from Lexical bridge
  const handleSave = useCallback(async (payload: SavePayload) => {
    if (!noteId) return;
    latestPayload.current = payload;
    setSaveStatus('saving');
    setWordCount(payload.wordCount ?? 0);

    const now = new Date().toISOString();
    const updatedNote: Note = {
      id: noteId,
      title: title || 'Untitled',
      content: payload.json,
      contentHtml: payload.html,
      preview: buildPreview(payload.text),
      createdAt: note?.createdAt ?? now,
      updatedAt: now,
      pinned: note?.pinned ?? false,
      wordCount: payload.wordCount ?? 0,
    };

    await saveNote(updatedNote);
    setNote(updatedNote);

    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
    saveStatusTimer.current = setTimeout(() => setSaveStatus('saved'), 300);
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [noteId, title, note]);

  // Save title change immediately
  const handleTitleChange = useCallback(async (newTitle: string) => {
    setTitle(newTitle);
    if (!note || !noteId) return;
    const updatedNote: Note = { ...note, title: newTitle, updatedAt: new Date().toISOString() };
    setNote(updatedNote);
    await saveNote(updatedNote);
  }, [note, noteId]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const saveStatusLabel = { idle: '', saving: 'Saving…', saved: '✓ Saved' }[saveStatus];
  const saveStatusColor = saveStatus === 'saved' ? c.primary : c.textSecondary;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <TextInput
            style={[styles.titleInput, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Untitled"
            placeholderTextColor={c.textSecondary}
            returnKeyType="done"
            blurOnSubmit
            maxLength={200}
          />
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              {wordCount > 0 ? `${wordCount} words  ·  ` : ''}
              {note ? formatRelativeTime(note.updatedAt) : ''}
            </Text>
            {saveStatus !== 'idle' && (
              <Text style={[styles.saveStatus, { color: saveStatusColor, fontFamily: 'Inter_500Medium' }]}>
                {'  '}{saveStatusLabel}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* ── Editor ─────────────────────────────────────────────────────── */}
      <NoteEditor
        initialStateJson={initialStateJson}
        onSave={handleSave}
        onActionTriggered={handleActionTriggered}
      />

      {/* ── Fancy Animated Toast description overlay ──────────────────── */}
      {toast && (
        <Animated.View style={[
          styles.toastContainer,
          {
            transform: [{ translateX: slideAnim }],
            opacity: opacityAnim,
            backgroundColor: c.cardPrimary,
            borderColor: c.border,
            borderLeftColor: c.primary,
          }
        ]}>
          <View style={[styles.toastIconWrap, { backgroundColor: c.primary + '15' }]}>
            <MaterialIcons name={toast.icon} size={18} color={c.primary} />
          </View>
          <View style={styles.toastTextContainer}>
            <Text style={[styles.toastTitle, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}>
              {toast.title}
            </Text>
            <Text style={[styles.toastDesc, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]} numberOfLines={2}>
              {toast.desc}
            </Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
    minHeight: 56,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerCenter: { flex: 1 },
  titleInput: {
    fontSize: 17,
    letterSpacing: -0.2,
    padding: 0,
    includeFontPadding: false,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: { fontSize: 11 },
  saveStatus: { fontSize: 11 },
  pinBtn: { padding: 6 },
  toastContainer: {
    position: 'absolute',
    top: 80,
    right: 16,
    width: 280,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  toastIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  toastTextContainer: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 13,
    marginBottom: 2,
  },
  toastDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
});
