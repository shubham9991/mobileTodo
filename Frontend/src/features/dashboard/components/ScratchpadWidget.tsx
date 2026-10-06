import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../../themes/ThemeContext';
import { saveNote, Note } from '../../../core/db/notesStore';
import { WidgetSize } from '../dashboardPrefsStore';

interface ScratchpadWidgetProps {
  size?: WidgetSize;
  onLongPress?: () => void;
  onNoteCreated?: () => void;
}

const SCRATCHPAD_FILE = `${FileSystem.documentDirectory}scratchpad_memo.txt`;

export const ScratchpadWidget = ({
  size = 'half',
  onLongPress,
  onNoteCreated,
}: ScratchpadWidgetProps) => {
  const { theme } = useTheme();
  const [text, setText] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(true);

  // Load saved scratch text on mount
  useEffect(() => {
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(SCRATCHPAD_FILE);
        if (info.exists) {
          const content = await FileSystem.readAsStringAsync(SCRATCHPAD_FILE);
          setText(content);
        }
      } catch {}
    })();
  }, []);

  const handleChangeText = (val: string) => {
    setText(val);
    setIsSaved(false);
  };

  // Auto-save debounced
  useEffect(() => {
    if (isSaved) return;
    const t = setTimeout(async () => {
      try {
        await FileSystem.writeAsStringAsync(SCRATCHPAD_FILE, text);
        setIsSaved(true);
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [text, isSaved]);

  const handleConvertToNote = useCallback(async () => {
    if (!text.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    try {
      const lines = text.trim().split('\n');
      const title = lines[0].slice(0, 50) || 'Quick Scratch Note';
      const preview = lines.slice(1).join(' ').trim() || lines[0];

      const newNote: Note = {
        id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title,
        content: {},
        contentHtml: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
        preview,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pinned: false,
        wordCount: text.trim().split(/\s+/).length,
      };

      await saveNote(newNote);
      await FileSystem.writeAsStringAsync(SCRATCHPAD_FILE, '');
      setText('');
      setIsSaved(true);
      if (onNoteCreated) onNoteCreated();
    } catch (err) {
      console.error('[ScratchpadWidget] convert error', err);
    }
  }, [text, onNoteCreated]);

  const handleClear = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setText('');
    setIsSaved(true);
    try {
      await FileSystem.writeAsStringAsync(SCRATCHPAD_FILE, '');
    } catch {}
  }, []);

  const isFull = size === 'full';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.cardPrimary,
          borderColor: theme.colors.border,
          flex: isFull ? undefined : 1,
          width: isFull ? '100%' : undefined,
        },
      ]}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.9}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="sticky-note-2" size={15} color="#F59E0B" />
          <Text style={[styles.title, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
            SCRATCHPAD
          </Text>
        </View>
        <View style={styles.headerRight}>
          {text.trim().length > 0 && (
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Input area */}
      <TextInput
        style={[
          styles.input,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.secondary,
            fontFamily: 'Inter_400Regular',
            minHeight: isFull ? 80 : 65,
          },
        ]}
        placeholder="Type a quick thought or memo..."
        placeholderTextColor={theme.colors.textSecondary}
        multiline
        value={text}
        onChangeText={handleChangeText}
        textAlignVertical="top"
      />

      {/* Footer / Actions */}
      <View style={styles.footer}>
        <Text style={[styles.charCount, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          {text.length > 0 ? `${text.length} chars` : 'Instant memo'}
        </Text>

        <TouchableOpacity
          style={[
            styles.convertBtn,
            {
              backgroundColor: text.trim() ? '#F59E0B' : theme.colors.border,
              opacity: text.trim() ? 1 : 0.6,
            },
          ]}
          onPress={handleConvertToNote}
          disabled={!text.trim()}
          activeOpacity={0.8}
        >
          <MaterialIcons name="note-add" size={13} color="#fff" />
          <Text style={[styles.convertBtnText, { color: '#fff', fontFamily: 'Inter_600SemiBold' }]}>
            Convert to Note
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    minHeight: 155,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  charCount: {
    fontSize: 10,
  },
  convertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  convertBtnText: {
    fontSize: 10.5,
  },
});
