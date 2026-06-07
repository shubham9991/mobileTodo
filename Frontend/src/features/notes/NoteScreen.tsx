/**
 * NoteScreen — full-screen note editing experience.
 * Handles: title editing, save state indicator, back navigation,
 * and wrapping the NoteEditor.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, Platform, Animated, Keyboard,
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



export function NoteScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { noteId, noteTitle: paramTitle } = useLocalSearchParams<{ noteId: string; noteTitle?: string }>();

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState(paramTitle ?? '');


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
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const saveStatusLabel = { idle: '', saving: 'Saving…', saved: '✓ Saved' }[saveStatus];
  const saveStatusColor = saveStatus === 'saved' ? c.primary : c.textSecondary;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]} edges={['top']}>
      {/* ── Header — MS Word style ──────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>

        {/* Title — full editable, centered */}
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

        {/* Right actions */}
        <View style={styles.headerActions}>
          {/* Save indicator */}
          {saveStatus !== 'idle' ? (
            <Text style={[styles.saveStatusBadge, { color: saveStatus === 'saved' ? c.primary : c.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              {saveStatus === 'saving' ? '…' : '✓'}
            </Text>
          ) : wordCount > 0 ? (
            <Text style={[styles.wordCountBadge, { color: c.textSecondary }]}>{wordCount}w</Text>
          ) : null}
        </View>
      </View>

      {/* ── Editor ─────────────────────────────────────────────────────── */}
      <NoteEditor
        initialStateJson={initialStateJson}
        onSave={handleSave}
      />


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
    height: 50,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
  },
  titleInput: {
    flex: 1,
    fontSize: 16,
    letterSpacing: -0.3,
    padding: 0,
    includeFontPadding: false,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveStatusBadge: {
    fontSize: 13,
    paddingHorizontal: 6,
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
