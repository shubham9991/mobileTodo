import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';
import { dummyData } from '../../../core/dummyData';
import { NoteCardSkeleton } from '../../../core/components/Skeleton';

export const RecentNotes = () => {
  const { theme } = useTheme();
  const notes = dummyData.recentNotes;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
          RECENT NOTES
        </Text>
        <TouchableOpacity>
          <MaterialIcons name="grid-view" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* 2-column Grid */}
      <View style={styles.grid}>
        {loading ? (
          <>
            <NoteCardSkeleton />
            <NoteCardSkeleton />
          </>
        ) : (
          notes.map((note) => (
            <View
              key={note.id}
              style={[styles.noteCard, {
                backgroundColor: theme.colors.cardPrimary,
                borderColor: theme.colors.border,
              }]}
            >
              <View style={styles.noteHeader}>
                <Text
                  style={[styles.noteTitle, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}
                  numberOfLines={2}
                >
                  {note.title}
                </Text>
                <MaterialIcons
                  name={note.pinned ? 'push-pin' : 'edit-note'}
                  size={14}
                  color={theme.colors.textSecondary}
                />
              </View>

              <Text
                style={[styles.notePreview, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}
                numberOfLines={3}
              >
                {note.preview}
              </Text>

              <View style={styles.noteFooter}>
                <MaterialIcons name="schedule" size={11} color={theme.colors.textSecondary} />
                <Text style={[styles.noteTime, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  {note.time}
                </Text>
              </View>
            </View>
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
});
