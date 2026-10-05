import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { useDashboard } from '../../../core/DashboardContext';
import { getAllNotes, Note, formatRelativeTime } from '../../../core/db/notesStore';
import { getAllDrawings, DrawingMeta } from '../../drawing/drawingStore';
import { Task } from '../../../core/dummyData';
import { DisplayDensity } from '../dashboardPrefsStore';

export type RecentItemType = 'note' | 'sketch' | 'task';

export interface RecentItem {
  id: string;
  type: RecentItemType;
  title: string;
  subtitle?: string;
  timestamp: number;
  thumbnailUri?: string;
  completed?: boolean;
  rawItem: Note | DrawingMeta | Task;
}

interface RecentsCarouselProps {
  density?: DisplayDensity;
}

export const RecentsCarousel = ({ density = 'comfortable' }: RecentsCarouselProps) => {
  const { theme } = useTheme();
  const router = useRouter();
  const { taskGroups, updateTask } = useDashboard();
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isCompact = density === 'compact';
  const isExpanded = density === 'expanded';
  const cardWidth = isCompact ? 145 : isExpanded ? 195 : 170;

  const loadAllRecents = useCallback(async () => {
    try {
      const [notes, drawings] = await Promise.all([
        getAllNotes(),
        getAllDrawings(),
      ]);

      const noteItems: RecentItem[] = notes.slice(0, 4).map((n) => ({
        id: `note_${n.id}`,
        type: 'note',
        title: n.title || 'Untitled Note',
        subtitle: n.preview || 'No text snippet',
        timestamp: new Date(n.updatedAt).getTime(),
        rawItem: n,
      }));

      const drawingItems: RecentItem[] = drawings.slice(0, 4).map((d) => ({
        id: `drawing_${d.id}`,
        type: 'sketch',
        title: d.title || 'Untitled Sketch',
        subtitle: 'Canvas whiteboard sketch',
        timestamp: d.updatedAt,
        thumbnailUri: d.thumbnailUri,
        rawItem: d,
      }));

      const allTasks = taskGroups.reduce<Task[]>((acc, g) => [...acc, ...g.tasks], []);
      const taskItems: RecentItem[] = allTasks.slice(0, 4).map((t) => ({
        id: `task_${t.id}`,
        type: 'task',
        title: t.title,
        subtitle: t.dueDate ? `Due ${t.dueDate}` : t.tag ? `#${t.tag}` : 'Task item',
        timestamp: Date.now() - 3600000,
        completed: t.completed,
        rawItem: t,
      }));

      const merged = [...noteItems, ...drawingItems, ...taskItems].sort(
        (a, b) => b.timestamp - a.timestamp
      );

      setItems(merged.slice(0, 6));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [taskGroups]);

  useFocusEffect(
    useCallback(() => {
      loadAllRecents();
    }, [loadAllRecents])
  );

  const handlePressItem = (item: RecentItem) => {
    Haptics.selectionAsync().catch(() => {});
    if (item.type === 'note') {
      const n = item.rawItem as Note;
      router.push({ pathname: '/note', params: { noteId: n.id, noteTitle: n.title } });
    } else if (item.type === 'sketch') {
      const d = item.rawItem as DrawingMeta;
      router.push({ pathname: '/drawing', params: { drawingId: d.id, drawingTitle: d.title } });
    } else if (item.type === 'task') {
      const t = item.rawItem as Task;
      updateTask(t.id, (prev) => ({ ...prev, completed: !prev.completed }));
    }
  };

  if (!loading && items.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialIcons name="history" size={14} color={theme.colors.textSecondary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
            PICK UP WHERE YOU LEFT OFF
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {items.map((item) => {
          const isNote = item.type === 'note';
          const isSketch = item.type === 'sketch';

          const badgeColor = isNote ? '#F59E0B' : isSketch ? '#6366F1' : '#10B981';
          const badgeIcon = isNote ? 'description' : isSketch ? 'brush' : 'task-alt';
          const badgeLabel = isNote ? 'Note' : isSketch ? 'Sketch' : 'Task';

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.carouselCard,
                { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border, width: cardWidth },
              ]}
              onPress={() => handlePressItem(item)}
              activeOpacity={0.7}
            >
              {/* Type pill + time */}
              <View style={styles.cardTopRow}>
                <View style={[styles.typeBadge, { backgroundColor: `${badgeColor}15` }]}>
                  <MaterialIcons name={badgeIcon as any} size={11} color={badgeColor} />
                  <Text style={[styles.typeBadgeText, { color: badgeColor, fontFamily: 'Inter_600SemiBold' }]}>
                    {badgeLabel}
                  </Text>
                </View>
                <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                  {formatRelativeTime(new Date(item.timestamp).toISOString())}
                </Text>
              </View>

              {/* Sketch Thumbnail or Preview snippet */}
              {isSketch && item.thumbnailUri ? (
                <View style={styles.thumbBox}>
                  <Image source={{ uri: item.thumbnailUri }} style={styles.thumbImage} resizeMode="cover" />
                </View>
              ) : null}

              {/* Title & Subtitle */}
              <Text
                style={[
                  styles.cardTitle,
                  { color: item.completed ? theme.colors.textSecondary : theme.colors.text, fontFamily: 'Inter_600SemiBold' },
                  item.completed && { textDecorationLine: 'line-through' },
                ]}
                numberOfLines={2}
              >
                {item.title}
              </Text>

              {item.subtitle ? (
                <Text
                  style={[styles.cardSubtitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}
                  numberOfLines={2}
                >
                  {item.subtitle}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  scrollList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  carouselCard: {
    width: 170,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'space-between',
    minHeight: 125,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9.5,
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 10,
  },
  thumbBox: {
    width: '100%',
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#18181B',
    marginBottom: 6,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  cardTitle: {
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
});
