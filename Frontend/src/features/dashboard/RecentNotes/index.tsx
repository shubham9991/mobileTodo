import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../themes/ThemeContext';
import { getAllNotes, formatRelativeTime, type Note } from '../../../core/db/notesStore';
import { NoteCardSkeleton } from '../../../core/components/Skeleton';

export const RecentNotes = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    const all = await getAllNotes();
    // Show pinned first, then most recent, max 4 on dashboard
    const sorted = [
      ...all.filter(n => n.pinned),
      ...all.filter(n => !n.pinned),
    ].slice(0, 4);
    setNotes(sorted);
    setLoading(false);
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const openNote = useCallback((note: Note) => {
    router.push({ pathname: '/note', params: { noteId: note.id, noteTitle: note.title } });
  }, [router]);

  const createNote = useCallback(() => {
    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    router.push({ pathname: '/note', params: { noteId: id } });
  }, [router]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
          RECENT NOTES
        </Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/notes')}>
          <Text style={[styles.seeAll, { color: theme.colors.primary, fontFamily: 'Inter_500Medium' }]}>
            See all
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2-column Grid */}
      <View style={styles.grid}>
        {loading ? (
          <>
            <NoteCardSkeleton />
            <NoteCardSkeleton />
          </>
        ) : notes.length === 0 ? (
          /* Empty state card that opens a new note */
          <TouchableOpacity
            style={[styles.emptyCard, { borderColor: theme.colors.border, borderStyle: 'dashed' }]}
            onPress={createNote}
          >
            <MaterialIcons name="add" size={22} color={theme.colors.primary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              New note
            </Text>
          </TouchableOpacity>
        ) : (
          notes.map((note) => (
            <TouchableOpacity
              key={note.id}
              style={[styles.noteCard, {
                backgroundColor: theme.colors.cardPrimary,
                borderColor: theme.colors.border,
              }]}
              onPress={() => openNote(note)}
              activeOpacity={0.7}
            >
              {note.pinned && (
                <MaterialIcons name="push-pin" size={11} color={theme.colors.primary} style={styles.pinIcon} />
              )}
              <View style={styles.noteHeader}>
                <Text
                  style={[styles.noteTitle, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}
                  numberOfLines={2}
                >
                  {note.title || 'Untitled'}
                </Text>
              </View>

              <Text
                style={[styles.notePreview, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}
                numberOfLines={3}
              >
                {note.preview || 'No content'}
              </Text>

              <View style={styles.noteFooter}>
                <MaterialIcons name="schedule" size={11} color={theme.colors.textSecondary} />
                <Text style={[styles.noteTime, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  {formatRelativeTime(note.updatedAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  noteCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 6,
  },
  noteTitle: {
    fontSize: 13,
    flex: 1,
    letterSpacing: -0.1,
    lineHeight: 18,
  },
  notePreview: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 8,
  },
  noteTime: {
    fontSize: 11,
  },
  seeAll: { fontSize: 12 },
  emptyCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyText: { fontSize: 12 },
  pinIcon: { position: 'absolute', top: 8, right: 8 },
});
