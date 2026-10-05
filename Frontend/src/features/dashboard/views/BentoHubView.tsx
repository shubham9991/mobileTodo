import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { useTheme } from '../../../themes/ThemeContext';
import { useDashboard } from '../../../core/DashboardContext';
import { getAllNotes, Note } from '../../../core/db/notesStore';
import { getAllDrawings, generateDrawingId, DrawingMeta } from '../../drawing/drawingStore';
import { Task } from '../../../core/dummyData';
import { BentoGrid } from '../components/BentoGrid';
import { RecentSketchesWidget } from '../components/RecentSketchesWidget';
import { Upcoming } from '../Upcoming';
import { BentoWidgetKey } from '../dashboardPrefsStore';

interface BentoHubViewProps {
  onOpenComposer: () => void;
  onToggleTask: (taskId: string) => void;
}

export const BentoHubView = ({ onOpenComposer, onToggleTask }: BentoHubViewProps) => {
  const { theme } = useTheme();
  const router = useRouter();
  const { taskGroups, dashboardPrefs } = useDashboard();

  const [notes, setNotes] = useState<Note[]>([]);
  const [sketches, setSketches] = useState<DrawingMeta[]>([]);

  const vis = dashboardPrefs.widgetVisibility.bento;
  const order = dashboardPrefs.widgetOrder?.bento || ['statusBar', 'heroCard', 'bentoGrid', 'recentSketches', 'upcoming'];
  const density = dashboardPrefs.density || 'comfortable';

  const loadData = useCallback(async () => {
    try {
      const [n, d] = await Promise.all([getAllNotes(), getAllDrawings()]);
      setNotes(n);
      setSketches(d);
    } catch {
      // safe fallback
    }
  }, []);

  // Reload notes & sketches on screen focus so edits/creations reflect immediately
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // All flat tasks
  const allTasks = useMemo(() => {
    return taskGroups.reduce<Task[]>((acc, g) => [...acc, ...g.tasks], []);
  }, [taskGroups]);

  const pendingTasks = useMemo(() => {
    return allTasks.filter((t) => !t.completed);
  }, [allTasks]);

  // Hero focus task: the first high priority task or first pending task
  const heroTask = useMemo(() => {
    return pendingTasks.find((t) => t.priority === 'HIGH') || pendingTasks[0] || null;
  }, [pendingTasks]);

  // Greeting calculation
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const handleOpenNote = (note: Note) => {
    router.push({ pathname: '/note', params: { noteId: note.id, noteTitle: note.title } });
  };

  const handleCreateNote = () => {
    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    router.push({ pathname: '/note', params: { noteId: id, noteTitle: '' } });
  };

  const handleOpenSketch = (sketch: DrawingMeta) => {
    router.push({ pathname: '/drawing', params: { drawingId: sketch.id, drawingTitle: sketch.title } });
  };

  const handleCreateSketch = () => {
    const id = generateDrawingId();
    router.push({ pathname: '/drawing', params: { drawingId: id, drawingTitle: 'Untitled Sketch' } });
  };

  // Density metrics
  const isCompact = density === 'compact';
  const isExpanded = density === 'expanded';

  const renderSection = (key: BentoWidgetKey) => {
    switch (key) {
      case 'statusBar':
        if (!vis.statusBar) return null;
        return (
          <View key="statusBar" style={[styles.statusBar, isCompact && styles.statusBarCompact]}>
            <View>
              <Text style={[styles.greetingText, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }, isCompact && { fontSize: 19 }]}>
                {greeting}
              </Text>
              <Text style={[styles.dateText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                {format(new Date(), 'EEEE, MMMM d')}
              </Text>
            </View>

            {/* Triad Live Metric Chips */}
            <View style={styles.metricRow}>
              <View style={[styles.metricChip, { backgroundColor: theme.colors.secondary }]}>
                <MaterialIcons name="task-alt" size={13} color="#10B981" />
                <Text style={[styles.metricText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  {pendingTasks.length} {pendingTasks.length === 1 ? 'Task' : 'Tasks'}
                </Text>
              </View>

              <View style={[styles.metricChip, { backgroundColor: theme.colors.secondary }]}>
                <MaterialIcons name="description" size={13} color="#F59E0B" />
                <Text style={[styles.metricText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  {notes.length} Notes
                </Text>
              </View>

              <View style={[styles.metricChip, { backgroundColor: theme.colors.secondary }]}>
                <MaterialIcons name="brush" size={13} color="#6366F1" />
                <Text style={[styles.metricText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  {sketches.length} Sketches
                </Text>
              </View>
            </View>
          </View>
        );

      case 'heroCard':
        if (!vis.heroCard || !heroTask) return null;
        return (
          <View
            key="heroCard"
            style={[
              styles.heroCardOuter,
              { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
              isCompact && styles.heroCardCompact,
              isExpanded && styles.heroCardExpanded,
            ]}
          >
            <View style={styles.heroHeader}>
              <MaterialIcons name="bolt" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.heroHeaderTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                PRIMARY FOCUS
              </Text>
            </View>

            <View style={[styles.heroCardInner, { backgroundColor: theme.colors.heroCardBg }]}>
              <View style={styles.heroContent}>
                <Text style={[styles.heroTag, { color: 'rgba(250,250,250,0.6)', fontFamily: 'Inter_500Medium' }]}>
                  {heroTask.tag ? `#${heroTask.tag}` : 'PRIORITY TASK'}
                </Text>
                <Text style={[styles.heroTaskTitle, { color: theme.colors.heroCardText, fontFamily: 'Inter_600SemiBold' }]}>
                  {heroTask.title}
                </Text>
                {heroTask.dueDate && (
                  <Text style={[styles.heroDueText, { color: 'rgba(250,250,250,0.6)', fontFamily: 'Inter_400Regular' }]}>
                    Due: {heroTask.dueDate}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.heroActionBtn, { backgroundColor: theme.colors.cardPrimary }]}
                onPress={() => onToggleTask(heroTask.id)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="check" size={15} color={theme.colors.text} />
                <Text style={[styles.heroActionText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'bentoGrid':
        if (!vis.bentoGrid) return null;
        return (
          <BentoGrid
            key="bentoGrid"
            tasks={pendingTasks}
            onToggleTask={onToggleTask}
            onPressNewTask={onOpenComposer}
            note={notes[0] || null}
            onOpenNote={handleOpenNote}
            onCreateNote={handleCreateNote}
            sketch={sketches[0] || null}
            onOpenSketch={handleOpenSketch}
            onCreateSketch={handleCreateSketch}
            density={density}
          />
        );

      case 'recentSketches':
        if (!vis.recentSketches) return null;
        return (
          <RecentSketchesWidget
            key="recentSketches"
            compact={isCompact}
            maxItems={isExpanded ? 4 : 2}
          />
        );

      case 'upcoming':
        if (!vis.upcoming) return null;
        return <Upcoming key="upcoming" />;

      default:
        return null;
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={{ flex: 1 }}
    >
      {order.map((key) => renderSection(key))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 90,
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  statusBarCompact: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  greetingText: {
    fontSize: 22,
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  metricText: {
    fontSize: 11.5,
  },
  heroCardOuter: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  heroCardCompact: {
    marginBottom: 8,
    padding: 10,
  },
  heroCardExpanded: {
    marginBottom: 18,
    padding: 18,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  heroHeaderTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  heroCardInner: {
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroContent: {
    flex: 1,
  },
  heroTag: {
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  heroTaskTitle: {
    fontSize: 16,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  heroDueText: {
    fontSize: 11,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  heroActionText: {
    fontSize: 12.5,
  },
});
