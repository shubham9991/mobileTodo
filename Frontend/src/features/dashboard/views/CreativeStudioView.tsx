import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { useDashboard } from '../../../core/DashboardContext';
import { getAllNotes, Note } from '../../../core/db/notesStore';
import { getAllDrawings, generateDrawingId, DrawingMeta } from '../../drawing/drawingStore';
import { CreativeFeedItem, CreativeItem } from '../components/CreativeFeedItem';
import { StudioWidgetKey } from '../dashboardPrefsStore';

interface CreativeStudioViewProps {
  onOpenTasksTab?: () => void;
}

export const CreativeStudioView = ({ onOpenTasksTab }: CreativeStudioViewProps) => {
  const { theme } = useTheme();
  const router = useRouter();
  const { taskGroups, dashboardPrefs } = useDashboard();
  const vis = dashboardPrefs.widgetVisibility.studio;
  const order = dashboardPrefs.widgetOrder?.studio || ['ideationBar', 'filterPills', 'creativeFeed', 'taskRadar'];
  const density = dashboardPrefs.density || 'comfortable';

  const [notes, setNotes] = useState<Note[]>([]);
  const [sketches, setSketches] = useState<DrawingMeta[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const isCompact = density === 'compact';
  const isExpanded = density === 'expanded';

  const loadData = useCallback(async () => {
    try {
      const [n, d] = await Promise.all([getAllNotes(), getAllDrawings()]);
      setNotes(n);
      setSketches(d);
    } catch {
      // fallback
    }
  }, []);

  // Reload notes & sketches when screen regains focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Extract all unique tags across notes
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => {
      if (n.tag && n.tag.trim()) {
        tagSet.add(n.tag.trim().toUpperCase());
      }
    });
    return Array.from(tagSet);
  }, [notes]);

  // Pending tasks count for task radar
  const pendingTasksCount = useMemo(() => {
    const all = taskGroups.reduce<any[]>((acc, g) => [...acc, ...g.tasks], []);
    return all.filter((t) => !t.completed).length;
  }, [taskGroups]);

  // Combined Creative Feed Items
  const feedItems = useMemo<CreativeItem[]>(() => {
    const noteItems: CreativeItem[] = notes.map((n) => ({
      kind: 'note',
      data: n,
      timestamp: new Date(n.updatedAt).getTime(),
    }));

    const sketchItems: CreativeItem[] = sketches.map((s) => ({
      kind: 'sketch',
      data: s,
      timestamp: s.updatedAt,
    }));

    let merged = [...noteItems, ...sketchItems];

    if (activeFilter === 'notes') {
      merged = merged.filter((i) => i.kind === 'note');
    } else if (activeFilter === 'sketches') {
      merged = merged.filter((i) => i.kind === 'sketch');
    } else if (activeFilter === 'pinned') {
      merged = merged.filter((i) => i.kind === 'note' && (i.data as Note).pinned);
    } else if (activeFilter !== 'all') {
      // Custom tag filter
      merged = merged.filter((i) => {
        if (i.kind === 'note') {
          return (i.data as Note).tag?.toUpperCase() === activeFilter.toUpperCase();
        } else {
          return (i.data as DrawingMeta).title.toUpperCase().includes(activeFilter.toUpperCase());
        }
      });
    }

    // Sort pinned notes first, then chronological descending
    return merged.sort((a, b) => {
      const aPinned = a.kind === 'note' && (a.data as Note).pinned ? 1 : 0;
      const bPinned = b.kind === 'note' && (b.data as Note).pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return b.timestamp - a.timestamp;
    });
  }, [notes, sketches, activeFilter]);

  // Split into 2 columns for a masonry-like grid
  const leftCol = useMemo(() => feedItems.filter((_, idx) => idx % 2 === 0), [feedItems]);
  const rightCol = useMemo(() => feedItems.filter((_, idx) => idx % 2 === 1), [feedItems]);

  const handleCreateNote = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    router.push({ pathname: '/note', params: { noteId: id, noteTitle: '' } });
  };

  const handleCreateSketch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const id = generateDrawingId();
    router.push({ pathname: '/drawing', params: { drawingId: id, drawingTitle: 'Untitled Sketch' } });
  };

  const handleOpenNote = (note: Note) => {
    router.push({ pathname: '/note', params: { noteId: note.id, noteTitle: note.title } });
  };

  const handleOpenSketch = (sketch: DrawingMeta) => {
    router.push({ pathname: '/drawing', params: { drawingId: sketch.id, drawingTitle: sketch.title } });
  };

  const renderSection = (key: StudioWidgetKey) => {
    switch (key) {
      case 'ideationBar':
        if (!vis.ideationBar) return null;
        return (
          <View
            key="ideationBar"
            style={[
              styles.ideationBox,
              { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
              isCompact && { marginTop: 8, padding: 10, marginBottom: 8 },
              isExpanded && { marginTop: 18, padding: 18, marginBottom: 16 },
            ]}
          >
            <Text style={[styles.ideationPrompt, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Capture an idea, draft rich notes, or start a canvas sketch...
            </Text>
            <View style={styles.ideationButtonsRow}>
              <TouchableOpacity
                style={[styles.ideationBtn, { backgroundColor: theme.colors.secondary }]}
                onPress={handleCreateNote}
                activeOpacity={0.7}
              >
                <MaterialIcons name="edit-note" size={17} color="#F59E0B" />
                <Text style={[styles.ideationBtnText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  New Note
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.ideationBtn, { backgroundColor: theme.colors.secondary }]}
                onPress={handleCreateSketch}
                activeOpacity={0.7}
              >
                <MaterialIcons name="brush" size={16} color="#6366F1" />
                <Text style={[styles.ideationBtnText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  New Sketch
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'filterPills':
        if (!vis.filterPills) return null;
        return (
          <ScrollView
            key="filterPills"
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          >
            {[
              { id: 'all', label: `All (${notes.length + sketches.length})` },
              { id: 'notes', label: `Notes (${notes.length})` },
              { id: 'sketches', label: `Sketches (${sketches.length})` },
              { id: 'pinned', label: 'Pinned' },
              ...availableTags.map((tag) => ({ id: tag, label: `#${tag.toLowerCase()}` })),
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? theme.colors.primary : theme.colors.cardPrimary,
                      borderColor: isActive ? theme.colors.primary : theme.colors.border,
                    },
                    isCompact && { paddingHorizontal: 9, paddingVertical: 4 },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveFilter(tab.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isActive ? theme.colors.primaryText : theme.colors.textSecondary,
                        fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        );

      case 'creativeFeed':
        if (!vis.creativeFeed) return null;
        return (
          <View key="creativeFeed" style={styles.feedContainer}>
            {feedItems.length === 0 ? (
              <View style={styles.emptyFeed}>
                <MaterialIcons name="auto-awesome" size={36} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyFeedTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  No creative items found
                </Text>
                <Text style={[styles.emptyFeedSub, { color: theme.colors.textSecondary }]}>
                  Start drafting a note or open the canvas to sketch your thoughts.
                </Text>
              </View>
            ) : (
              <View style={styles.twoColumnGrid}>
                <View style={styles.column}>
                  {leftCol.map((item) => (
                    <CreativeFeedItem
                      key={item.kind === 'note' ? item.data.id : item.data.id}
                      item={item}
                      onOpenNote={handleOpenNote}
                      onOpenSketch={handleOpenSketch}
                      density={density}
                    />
                  ))}
                </View>
                <View style={styles.column}>
                  {rightCol.map((item) => (
                    <CreativeFeedItem
                      key={item.kind === 'note' ? item.data.id : item.data.id}
                      item={item}
                      onOpenNote={handleOpenNote}
                      onOpenSketch={handleOpenSketch}
                      density={density}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        );

      case 'taskRadar':
        // Rendered as floating pill below ScrollView
        return null;

      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={{ flex: 1 }}
      >
        {order.map((key) => renderSection(key))}
      </ScrollView>

      {/* ── 4. Compact Background Task Radar Pill ── */}
      {vis.taskRadar && pendingTasksCount > 0 && (
        <TouchableOpacity
          style={[
            styles.taskRadarPill,
            { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
          ]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            if (onOpenTasksTab) onOpenTasksTab();
            else router.push('/(tabs)/tasks');
          }}
          activeOpacity={0.8}
        >
          <View style={styles.taskRadarDot} />
          <Text style={[styles.taskRadarText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
            {pendingTasksCount} pending {pendingTasksCount === 1 ? 'task' : 'tasks'} today
          </Text>
          <MaterialIcons name="chevron-right" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 90,
  },
  ideationBox: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  ideationPrompt: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  ideationButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ideationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  ideationBtnText: {
    fontSize: 12.5,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  feedContainer: {
    paddingHorizontal: 16,
  },
  twoColumnGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  column: {
    flex: 1,
  },
  emptyFeed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 8,
  },
  emptyFeedTitle: {
    fontSize: 15,
  },
  emptyFeedSub: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
  },
  taskRadarPill: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  taskRadarDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  taskRadarText: {
    fontSize: 12,
  },
});
