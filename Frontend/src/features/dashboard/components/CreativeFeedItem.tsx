import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { Note, formatRelativeTime } from '../../../core/db/notesStore';
import { DrawingMeta, formatDrawingTime } from '../../drawing/drawingStore';
import { DisplayDensity } from '../dashboardPrefsStore';

export type CreativeItem =
  | { kind: 'note'; data: Note; timestamp: number }
  | { kind: 'sketch'; data: DrawingMeta; timestamp: number };

interface CreativeFeedItemProps {
  item: CreativeItem;
  onOpenNote: (note: Note) => void;
  onOpenSketch: (sketch: DrawingMeta) => void;
  density?: DisplayDensity;
}

export const CreativeFeedItem = ({
  item,
  onOpenNote,
  onOpenSketch,
  density = 'comfortable',
}: CreativeFeedItemProps) => {
  const { theme } = useTheme();
  const isCompact = density === 'compact';
  const isExpanded = density === 'expanded';
  const thumbHeight = isCompact ? 60 : isExpanded ? 105 : 80;
  const previewLines = isCompact ? 2 : isExpanded ? 5 : 4;

  if (item.kind === 'note') {
    const note = item.data;
    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
        ]}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onOpenNote(note);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: '#F59E0B15' }]}>
            <MaterialIcons name="description" size={11} color="#F59E0B" />
            <Text style={[styles.badgeText, { color: "#F59E0B", fontFamily: 'Inter_600SemiBold' }]}>
              Note
            </Text>
          </View>
          {note.pinned && (
            <MaterialIcons name="push-pin" size={12} color={theme.colors.primary} />
          )}
        </View>

        <Text
          style={[styles.title, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}
          numberOfLines={2}
        >
          {note.title || 'Untitled Note'}
        </Text>

        <Text
          style={[styles.preview, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}
          numberOfLines={previewLines}
        >
          {note.preview || 'No additional content'}
        </Text>

        <View style={styles.footer}>
          {note.tag ? (
            <View style={[styles.tagPill, { backgroundColor: theme.colors.secondary }]}>
              <Text style={[styles.tagText, { color: theme.colors.textSecondary }]}>
                #{note.tag}
              </Text>
            </View>
          ) : null}
          <View style={styles.timeRow}>
            <MaterialIcons name="schedule" size={10} color={theme.colors.textSecondary} />
            <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
              {formatRelativeTime(note.updatedAt)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Kind === 'sketch'
  const sketch = item.data;
  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
        isCompact && { padding: 9, marginBottom: 7 },
        isExpanded && { padding: 15, marginBottom: 13 },
      ]}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onOpenSketch(sketch);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: '#6366F115' }]}>
          <MaterialIcons name="brush" size={11} color="#6366F1" />
          <Text style={[styles.badgeText, { color: "#6366F1", fontFamily: 'Inter_600SemiBold' }]}>
            Sketch
          </Text>
        </View>
      </View>

      {sketch.thumbnailUri ? (
        <View style={[styles.sketchThumbContainer, { height: thumbHeight }]}>
          <Image source={{ uri: sketch.thumbnailUri }} style={styles.sketchImage} resizeMode="cover" />
        </View>
      ) : (
        <View style={[styles.placeholderSketch, { backgroundColor: theme.colors.secondary, height: thumbHeight }]}>
          <MaterialIcons name="gesture" size={28} color="#6366F1" />
        </View>
      )}

      <Text
        style={[styles.title, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}
        numberOfLines={1}
      >
        {sketch.title || 'Untitled Sketch'}
      </Text>

      <View style={styles.footer}>
        <View style={styles.timeRow}>
          <MaterialIcons name="schedule" size={10} color={theme.colors.textSecondary} />
          <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
            {formatDrawingTime(sketch.updatedAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  preview: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 8,
  },
  sketchThumbContainer: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    marginBottom: 8,
  },
  sketchImage: {
    width: '100%',
    height: '100%',
  },
  placeholderSketch: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: 10,
  },
});
