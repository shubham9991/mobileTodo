import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { useDashboard } from '../../../core/DashboardContext';
import { generateDrawingId } from '../../drawing/drawingStore';
import { Task } from '../../../core/dummyData';
import { RecentsCarousel } from '../components/RecentsCarousel';
import { MinimalWidgetKey } from '../dashboardPrefsStore';

interface MinimalistViewProps {
  onOpenComposer: () => void;
  onToggleTask: (taskId: string) => void;
  onOpenSearch?: () => void;
}

export const MinimalistView = ({ onOpenComposer, onToggleTask, onOpenSearch }: MinimalistViewProps) => {
  const { theme } = useTheme();
  const router = useRouter();
  const { taskGroups, dashboardPrefs } = useDashboard();
  const vis = dashboardPrefs.widgetVisibility.minimal;
  const order = dashboardPrefs.widgetOrder?.minimal || ['calmHeader', 'recentsCarousel', 'ruleOfThree', 'microDock'];
  const density = dashboardPrefs.density || 'comfortable';

  const isCompact = density === 'compact';
  const isExpanded = density === 'expanded';

  // Flatten tasks and pick top 3 uncompleted tasks
  const allTasks = useMemo(() => {
    return taskGroups.reduce<Task[]>((acc, g) => [...acc, ...g.tasks], []);
  }, [taskGroups]);

  const topThreeTasks = useMemo(() => {
    const uncompleted = allTasks.filter((t) => !t.completed);
    // Sort high priority first
    uncompleted.sort((a, b) => {
      const pMap: Record<string, number> = { HIGH: 3, MED: 2, LOW: 1 };
      return (pMap[b.priority || ''] || 0) - (pMap[a.priority || ''] || 0);
    });
    return uncompleted.slice(0, 3);
  }, [allTasks]);

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

  const renderSection = (key: MinimalWidgetKey) => {
    switch (key) {
      case 'calmHeader':
        if (!vis.calmHeader) return null;
        return (
          <View key="calmHeader" style={[styles.calmHeader, isCompact && { paddingTop: 14, paddingBottom: 10 }]}>
            <Text style={[styles.calmDate, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              {format(new Date(), 'EEEE, MMMM d').toUpperCase()}
            </Text>
            <Text
              style={[
                styles.calmGreeting,
                { color: theme.colors.text, fontFamily: 'Inter_700Bold' },
                isCompact && { fontSize: 22 },
                isExpanded && { fontSize: 28 },
              ]}
            >
              Focus on what matters.
            </Text>
          </View>
        );

      case 'recentsCarousel':
        if (!vis.recentsCarousel) return null;
        return <RecentsCarousel key="recentsCarousel" density={density} />;

      case 'ruleOfThree':
        if (!vis.ruleOfThree) return null;
        return (
          <View key="ruleOfThree" style={styles.essentialsContainer}>
            <View style={styles.essentialsHeader}>
              <Text style={[styles.essentialsTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                RULE OF THREE
              </Text>
              <Text style={[styles.essentialsSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                {topThreeTasks.length} key priorities
              </Text>
            </View>

            {topThreeTasks.length === 0 ? (
              <View style={[styles.completedBox, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
                <MaterialIcons name="spa" size={32} color="#10B981" />
                <Text style={[styles.completedTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  Your essentials are complete
                </Text>
                <Text style={[styles.completedSub, { color: theme.colors.textSecondary }]}>
                  Take time to recharge or capture new thoughts below.
                </Text>
              </View>
            ) : (
              topThreeTasks.map((task, idx) => (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.essentialCard,
                    { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
                    isCompact && { padding: 11, marginBottom: 7 },
                    isExpanded && { padding: 20, marginBottom: 14 },
                  ]}
                  onPress={() => onToggleTask(task.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.numberIndexWrap}>
                    <Text style={[styles.numberIndex, { color: theme.colors.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                      0{idx + 1}
                    </Text>
                  </View>

                  <View style={styles.essentialContent}>
                    <Text
                      style={[
                        styles.taskTitle,
                        {
                          color: task.completed ? theme.colors.textSecondary : theme.colors.text,
                          textDecorationLine: task.completed ? 'line-through' : 'none',
                          fontFamily: 'Inter_500Medium',
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {task.title}
                    </Text>
                    {task.tag && (
                      <Text style={[styles.taskTag, { color: theme.colors.textSecondary }]}>
                        #{task.tag}
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      styles.checkCircle,
                      { borderColor: task.completed ? theme.colors.primary : theme.colors.border },
                      task.completed && { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    {task.completed && (
                      <MaterialIcons name="check" size={13} color={theme.colors.primaryText} />
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        );

      case 'microDock':
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

      {/* ── 4. Universal Micro Dock (Search, Task, Note, Sketch) ── */}
      {vis.microDock && (
        <View style={styles.microDockWrap}>
          <View style={[styles.microDock, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
            {onOpenSearch && (
              <>
                <TouchableOpacity
                  style={styles.dockItem}
                  onPress={onOpenSearch}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="search" size={22} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <View style={[styles.dockDivider, { backgroundColor: theme.colors.border }]} />
              </>
            )}

            <TouchableOpacity
              style={styles.dockItem}
              onPress={onOpenComposer}
              activeOpacity={0.7}
            >
              <MaterialIcons name="add-task" size={20} color="#10B981" />
            </TouchableOpacity>

            <View style={[styles.dockDivider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity
              style={styles.dockItem}
              onPress={handleCreateNote}
              activeOpacity={0.7}
            >
              <MaterialIcons name="edit-note" size={22} color="#F59E0B" />
            </TouchableOpacity>

            <View style={[styles.dockDivider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity
              style={styles.dockItem}
              onPress={handleCreateSketch}
              activeOpacity={0.7}
            >
              <MaterialIcons name="gesture" size={20} color="#6366F1" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 90,
  },
  calmHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  calmDate: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  calmGreeting: {
    fontSize: 26,
    letterSpacing: -0.6,
  },
  essentialsContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  essentialsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  essentialsTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  essentialsSub: {
    fontSize: 11,
  },
  essentialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    gap: 14,
  },
  numberIndexWrap: {
    width: 28,
  },
  numberIndex: {
    fontSize: 15,
  },
  essentialContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  taskTag: {
    fontSize: 11,
    marginTop: 3,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completedTitle: {
    fontSize: 15,
  },
  completedSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  microDockWrap: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  },
  microDock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  dockItem: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockDivider: {
    width: 1,
    height: 18,
  },
});
