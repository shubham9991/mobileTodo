/**
 * NoteScreen — full-screen note editing experience.
 * Handles: title editing, save state indicator, back navigation,
 * and wrapping the NoteEditor.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import { NoteEditor } from './NoteEditor';
import {
  getNote, saveNote, deleteNote, createBlankNote, buildPreview, type Note,
} from '../../core/db/notesStore';
import type { SavePayload } from './useEditorBridge';

type SaveStatus = 'idle' | 'saving' | 'saved';



export function NoteScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { noteId, noteTitle: paramTitle } = useLocalSearchParams<{ noteId: string; noteTitle?: string }>();

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState(paramTitle ?? '');
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<TextInput>(null);
  const sendCommandRef = useRef<((type: string, payload?: string) => void) | null>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [wordCount, setWordCount] = useState(0);
  const [initialStateJson, setInitialStateJson] = useState<string | undefined>(undefined);
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    const hasPlainText = payload.text && payload.text.trim().length > 0;
    const hasHtmlBlocks = payload.html && payload.html
      .replace(/<p[^>]*>\s*<br\s*\/?>\s*<\/p>/gi, '')
      .replace(/<p[^>]*>\s*<\/p>/gi, '')
      .trim().length > 0;

    const hasContent = hasPlainText || hasHtmlBlocks;
    const hasTitleText = title && title.trim().length > 0 && title.toLowerCase() !== 'untitled';

    if (!hasContent && !hasTitleText) {
      await deleteNote(noteId);
      setNote(null);
      setSaveStatus('idle');
      return;
    }

    setSaveStatus('saving');
    setWordCount(payload.wordCount ?? 0);

    const now = new Date().toISOString();
    const updatedNote: Note = {
      id: noteId,
      title: title || 'Untitled',
      content: payload.json,
      contentHtml: payload.html,
      preview: buildPreview(payload.text, payload.html),
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
    if (!noteId) return;

    const hasPlainText = note?.preview && note.preview.trim().length > 0;
    const hasHtmlBlocks = note?.contentHtml && note.contentHtml
      .replace(/<p[^>]*>\s*<br\s*\/?>\s*<\/p>/gi, '')
      .replace(/<p[^>]*>\s*<\/p>/gi, '')
      .trim().length > 0;

    const hasContent = hasPlainText || hasHtmlBlocks;
    const hasTitleText = newTitle && newTitle.trim().length > 0 && newTitle.toLowerCase() !== 'untitled';

    if (!hasContent && !hasTitleText) {
      await deleteNote(noteId);
      setNote(null);
      return;
    }

    if (!note) return;
    const updatedNote: Note = { ...note, title: newTitle, updatedAt: new Date().toISOString() };
    setNote(updatedNote);
    await saveNote(updatedNote);
  }, [note, noteId]);

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleTitleSubmitEditing = useCallback(async () => {
    setEditingTitle(false);
    const trimmed = title.trim();

    const hasPlainText = note?.preview && note.preview.trim().length > 0;
    const hasHtmlBlocks = note?.contentHtml && note.contentHtml
      .replace(/<p[^>]*>\s*<br\s*\/?>\s*<\/p>/gi, '')
      .replace(/<p[^>]*>\s*<\/p>/gi, '')
      .trim().length > 0;

    const hasContent = hasPlainText || hasHtmlBlocks;
    const hasTitleText = trimmed.length > 0 && trimmed.toLowerCase() !== 'untitled';

    if (!hasContent && !hasTitleText) {
      setTitle('');
      if (noteId) await deleteNote(noteId);
      setNote(null);
      return;
    }

    const finalTitle = trimmed || 'Untitled';
    setTitle(finalTitle);
    if (!note || !noteId) return;
    const updatedNote: Note = { ...note, title: finalTitle, updatedAt: new Date().toISOString() };
    setNote(updatedNote);
    await saveNote(updatedNote);
  }, [title, note, noteId]);

  const handleUndo = useCallback(() => sendCommandRef.current?.('UNDO'), []);
  const handleRedo = useCallback(() => sendCommandRef.current?.('REDO'), []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]} edges={['top']}>
      {/* ── Header — Sketch-style navbar ────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.cardPrimary ?? c.background }]}>
        {/* Back */}
        <TouchableOpacity style={styles.headerBtn} onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>

        {/* Title — tap to edit (sketch style) */}
        {editingTitle ? (
          <TextInput
            ref={titleInputRef}
            style={[styles.titleInput, { color: c.text, borderBottomColor: c.primary, fontFamily: 'Inter_600SemiBold' }]}
            value={title}
            onChangeText={handleTitleChange}
            onBlur={handleTitleSubmitEditing}
            onSubmitEditing={handleTitleSubmitEditing}
            placeholder="Untitled"
            placeholderTextColor={c.textSecondary}
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
            maxLength={200}
          />
        ) : (
          <TouchableOpacity onPress={() => setEditingTitle(true)} style={styles.titleBtn}>
            <Text
              style={[styles.titleText, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}
              numberOfLines={1}
            >
              {title || 'Untitled'}
            </Text>
            <MaterialIcons name="edit" size={13} color={c.textSecondary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        )}

        {/* Right actions: save indicator + undo + redo */}
        <View style={styles.headerActions}>
          {/* Save / word count indicator */}
          {saveStatus !== 'idle' ? (
            <Text style={[styles.saveStatusBadge, { color: saveStatus === 'saved' ? c.primary : c.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              {saveStatus === 'saving' ? '…' : '✓'}
            </Text>
          ) : wordCount > 0 ? (
            <Text style={[styles.wordCountBadge, { color: c.textSecondary }]}>{wordCount}w</Text>
          ) : null}
          <TouchableOpacity style={styles.headerBtn} onPress={handleUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="undo" size={20} color={c.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleRedo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="redo" size={20} color={c.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Editor ─────────────────────────────────────────────────────── */}
      <NoteEditor
        initialStateJson={initialStateJson}
        onSave={handleSave}
        onCommandReady={(fn) => { sendCommandRef.current = fn; }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 4,
    borderBottomWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    gap: 4,
    minHeight: 50,
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
    letterSpacing: -0.3,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottomWidth: 1.5,
    includeFontPadding: false,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  saveStatusBadge: {
    fontSize: 13,
    paddingHorizontal: 4,
  },
  wordCountBadge: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 11 },
  saveStatus: { fontSize: 11 },
  pinBtn: { padding: 6 },
});
