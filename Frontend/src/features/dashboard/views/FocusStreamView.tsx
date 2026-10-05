import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { useDashboard, isTaskScheduledForDate } from '../../../core/DashboardContext';
import { Task } from '../../../core/dummyData';
import { FocusWidgetKey } from '../dashboardPrefsStore';

interface FocusStreamViewProps {
  onOpenComposer: () => void;
  onToggleTask: (taskId: string) => void;
}

type GroupByMode = 'priority' | 'timeblock';

export const FocusStreamView = ({ onOpenComposer, onToggleTask }: FocusStreamViewProps) => {
  const { theme } = useTheme();
  const { taskGroups, handleComposerSave, dashboardPrefs } = useDashboard();
  const vis = dashboardPrefs.widgetVisibility.focus;
  const order = dashboardPrefs.widgetOrder?.focus || ['weekCalendar', 'progressBar', 'quickComposer', 'agenda'];
  const density = dashboardPrefs.density || 'comfortable';

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [quickInput, setQuickInput] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByMode>('priority');

  // Density flags
  const isCompact = density === 'compact';
  const isExpanded = density === 'expanded';

  // All flat tasks
  const allTasks = useMemo(() => {
    return taskGroups.reduce<Task[]>((acc, g) => [...acc, ...g.tasks], []);
  }, [taskGroups]);

  // Generate 7 days of the current week (starting Monday)
  const weekDays = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(monday, i));
    }
    return days;
  }, []);

  const selectedDateStr = useMemo(() => {
    return format(selectedDate, 'yyyy-MM-dd');
  }, [selectedDate]);

  // Tasks for the selected date using robust interval/normalization matching
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => isTaskScheduledForDate(t, selectedDateStr));
  }, [allTasks, selectedDateStr]);

  // Day progress metrics
  const totalCount = filteredTasks.length;
  const completedCount = filteredTasks.filter((t) => t.completed).length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Group filtered tasks by priority or time block
  const groupedTasks = useMemo(() => {
    if (groupBy === 'priority') {
      const high = filteredTasks.filter((t) => t.priority === 'HIGH');
      const med = filteredTasks.filter((t) => t.priority === 'MED');
      const low = filteredTasks.filter((t) => t.priority === 'LOW' || !t.priority);
      return [
        { id: 'HIGH', label: 'High Priority', color: '#EF4444', tasks: high },
        { id: 'MED', label: 'Medium Priority', color: '#F97316', tasks: med },
        { id: 'LOW', label: 'Normal / General', color: '#10B981', tasks: low },
      ].filter((g) => g.tasks.length > 0);
    } else {
      // Group by time block
      const morning: Task[] = [];
      const afternoon: Task[] = [];
      const evening: Task[] = [];
      const anytime: Task[] = [];

      filteredTasks.forEach((t) => {
        if (!t.dueTime) {
          anytime.push(t);
          return;
        }
        const timeUpper = t.dueTime.toUpperCase();
        if (timeUpper.includes('AM')) {
          morning.push(t);
        } else if (timeUpper.includes('PM')) {
          // Check hour if possible
          const match = timeUpper.match(/(\d+):?/);
          const hour = match ? parseInt(match[1], 10) : 12;
          if (hour === 12 || hour < 5) {
            afternoon.push(t);
          } else {
            evening.push(t);
          }
        } else {
          anytime.push(t);
        }
      });

      return [
        { id: 'morning', label: 'Morning Block (Before 12 PM)', color: '#F59E0B', tasks: morning },
        { id: 'afternoon', label: 'Afternoon Block (12 PM - 5 PM)', color: '#3B82F6', tasks: afternoon },
        { id: 'evening', label: 'Evening Block (After 5 PM)', color: '#8B5CF6', tasks: evening },
        { id: 'anytime', label: 'Anytime / Unscheduled', color: '#6B7280', tasks: anytime },
      ].filter((g) => g.tasks.length > 0);
    }
  }, [filteredTasks, groupBy]);

  // Inline Quick Task Add
  const handleQuickAdd = useCallback(() => {
    const text = quickInput.trim();
    if (!text) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Basic smart parse for tags and priority
    let priority: 'HIGH' | 'MED' | 'LOW' = 'MED';
    if (text.includes('!high')) priority = 'HIGH';
    if (text.includes('!low')) priority = 'LOW';

    const cleanTitle = text.replace(/!high|!med|!low/gi, '').trim();

    handleComposerSave({
      id: `task_${Date.now()}`,
      title: cleanTitle || text,
      dueDate: selectedDateStr,
      priority,
      tag: 'FOCUS',
    });

    setQuickInput('');
  }, [quickInput, selectedDateStr, handleComposerSave]);

  const renderSection = (key: FocusWidgetKey) => {
    switch (key) {
      case 'weekCalendar':
        if (!vis.weekCalendar) return null;
        return (
          <View
            key="weekCalendar"
            style={[
              styles.weekCalendarContainer,
              { borderBottomColor: theme.colors.border },
              isCompact && { paddingTop: 6, paddingBottom: 8 },
            ]}
          >
            <View style={styles.calendarHeader}>
              <Text style={[styles.monthLabel, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                {format(selectedDate, 'MMMM yyyy')}
              </Text>
              <TouchableOpacity onPress={() => setSelectedDate(new Date())}>
                <Text style={[styles.todayLink, { color: theme.colors.primary, fontFamily: 'Inter_500Medium' }]}>
                  Today
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.daysRow}>
              {weekDays.map((day) => {
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                const dayStr = format(day, 'yyyy-MM-dd');

                // Compute completion for day
                const dayTasks = allTasks.filter((t) => isTaskScheduledForDate(t, dayStr));
                const dayDone = dayTasks.filter((t) => t.completed).length;
                const hasTasks = dayTasks.length > 0;
                const isAllDone = hasTasks && dayDone === dayTasks.length;

                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedDate(day);
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.dayChip,
                      isCompact && { height: 48, width: 40 },
                      isExpanded && { height: 62, width: 48 },
                      {
                        backgroundColor: isSelected ? theme.colors.primary : theme.colors.cardPrimary,
                        borderColor: isSelected
                          ? theme.colors.primary
                          : isToday
                          ? theme.colors.text
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayName,
                        {
                          color: isSelected ? theme.colors.primaryText : theme.colors.textSecondary,
                          fontFamily: 'Inter_500Medium',
                        },
                      ]}
                    >
                      {format(day, 'EEE')}
                    </Text>
                    <Text
                      style={[
                        styles.dayNum,
                        {
                          color: isSelected ? theme.colors.primaryText : theme.colors.text,
                          fontFamily: isToday ? 'Inter_700Bold' : 'Inter_600SemiBold',
                        },
                      ]}
                    >
                      {format(day, 'd')}
                    </Text>
                    {hasTasks && (
                      <View
                        style={[
                          styles.taskDot,
                          {
                            backgroundColor: isSelected
                              ? theme.colors.primaryText
                              : isAllDone
                              ? '#10B981'
                              : '#F59E0B',
                          },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case 'progressBar':
        if (!vis.progressBar) return null;
        return (
          <View
            key="progressBar"
            style={[styles.progressContainer, isCompact && { paddingTop: 8, paddingBottom: 6 }]}
          >
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                {completedCount} of {totalCount} completed ({completionPercent}%)
              </Text>
              <Text style={[styles.progressDate, { color: theme.colors.textSecondary }]}>
                {format(selectedDate, 'EEE, MMM d')}
              </Text>
            </View>
            <View style={[styles.progressBarTrack, { backgroundColor: theme.colors.secondary }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${completionPercent}%`,
                    backgroundColor: completionPercent === 100 ? '#10B981' : theme.colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        );

      case 'quickComposer':
        if (!vis.quickComposer) return null;
        return (
          <View
            key="quickComposer"
            style={[
              styles.composerContainer,
              { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
              isCompact && { marginVertical: 6, paddingVertical: 1 },
            ]}
          >
            <MaterialIcons name="add" size={18} color={theme.colors.textSecondary} style={{ marginLeft: 8 }} />
            <TextInput
              style={[styles.composerInput, { color: theme.colors.text }]}
              placeholder="Add task... (!high for urgent)"
              placeholderTextColor={theme.colors.textSecondary}
              value={quickInput}
              onChangeText={setQuickInput}
              onSubmitEditing={handleQuickAdd}
              returnKeyType="done"
            />
            {quickInput.trim().length > 0 ? (
              <TouchableOpacity onPress={handleQuickAdd} style={[styles.quickAddBtn, { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.quickAddBtnText, { color: theme.colors.primaryText, fontFamily: 'Inter_600SemiBold' }]}>
                  Add
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={onOpenComposer} style={{ padding: 8 }}>
                <MaterialIcons name="tune" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        );

      case 'agenda':
        if (!vis.agenda) return null;
        return (
          <View key="agenda" style={styles.agendaSection}>
            {/* Agenda Header with Grouping Toggle */}
            <View style={styles.agendaHeaderRow}>
              <Text style={[styles.agendaHeading, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
                AGENDA
              </Text>
              <View style={[styles.groupToggleWrap, { backgroundColor: theme.colors.secondary }]}>
                <TouchableOpacity
                  style={[styles.toggleBtn, groupBy === 'priority' && [styles.toggleBtnActive, { backgroundColor: theme.colors.cardPrimary }]]}
                  onPress={() => setGroupBy('priority')}
                >
                  <Text style={[styles.toggleBtnText, { color: groupBy === 'priority' ? theme.colors.text : theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                    Priority
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, groupBy === 'timeblock' && [styles.toggleBtnActive, { backgroundColor: theme.colors.cardPrimary }]]}
                  onPress={() => setGroupBy('timeblock')}
                >
                  <Text style={[styles.toggleBtnText, { color: groupBy === 'timeblock' ? theme.colors.text : theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                    Time Block
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {totalCount === 0 ? (
              <View style={styles.emptyAgenda}>
                <MaterialIcons name="event-available" size={36} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyAgendaTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  No tasks scheduled for this day
                </Text>
                <Text style={[styles.emptyAgendaSubtitle, { color: theme.colors.textSecondary }]}>
                  Type above to add an action item or take a well-deserved breather!
                </Text>
              </View>
            ) : (
              groupedTasks.map((group) => (
                <View key={group.id} style={styles.groupContainer}>
                  <View style={styles.groupHeaderRow}>
                    <View style={[styles.groupDot, { backgroundColor: group.color }]} />
                    <Text style={[styles.groupTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                      {group.label.toUpperCase()} ({group.tasks.length})
                    </Text>
                  </View>

                  {group.tasks.map((task) => {
                    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                    const subtasksDone = hasSubtasks ? task.subtasks!.filter((st) => st.done).length : 0;
                    const hasAttachments = task.attachments && task.attachments.length > 0;

                    return (
                      <TouchableOpacity
                        key={task.id}
                        style={[
                          styles.taskCard,
                          { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
                          isCompact && { padding: 9, marginBottom: 6 },
                          isExpanded && { padding: 15, marginBottom: 12 },
                        ]}
                        onPress={() => onToggleTask(task.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.taskCheckbox,
                            { borderColor: task.completed ? theme.colors.primary : theme.colors.border },
                            task.completed && { backgroundColor: theme.colors.primary },
                          ]}
                        >
                          {task.completed && (
                            <MaterialIcons name="check" size={12} color={theme.colors.primaryText} />
                          )}
                        </View>

                        <View style={styles.taskTextCol}>
                          <Text
                            style={[
                              styles.taskTitle,
                              {
                                color: task.completed ? theme.colors.textSecondary : theme.colors.text,
                                textDecorationLine: task.completed ? 'line-through' : 'none',
                                fontFamily: 'Inter_500Medium',
                              },
                            ]}
                          >
                            {task.title}
                          </Text>

                          {/* Task Metadata Row */}
                          <View style={styles.taskMetaRow}>
                            {task.tag && (
                              <View style={[styles.tagBadge, { backgroundColor: theme.colors.secondary }]}>
                                <Text style={[styles.tagBadgeText, { color: theme.colors.textSecondary }]}>
                                  #{task.tag}
                                </Text>
                              </View>
                            )}

                            {task.dueTime && (
                              <View style={styles.timeMeta}>
                                <MaterialIcons name="schedule" size={11} color={theme.colors.textSecondary} />
                                <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                                  {task.dueTime}
                                </Text>
                              </View>
                            )}

                            {/* Subtask Progress indicator */}
                            {hasSubtasks && (
                              <View style={[styles.subtaskBadge, { backgroundColor: theme.colors.secondary }]}>
                                <MaterialIcons name="checklist" size={11} color="#10B981" />
                                <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                                  {subtasksDone}/{task.subtasks!.length}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Contextual Linked Attachments */}
                          {hasAttachments && (
                            <View style={styles.attachmentsRow}>
                              {task.attachments!.map((att) => (
                                <View
                                  key={att.id}
                                  style={[
                                    styles.attachmentPill,
                                    { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border },
                                  ]}
                                >
                                  <MaterialIcons
                                    name={att.type === 'image' ? 'image' : att.type === 'link' ? 'link' : 'attachment'}
                                    size={11}
                                    color={theme.colors.primary}
                                  />
                                  <Text
                                    style={[styles.attachmentText, { color: theme.colors.text }]}
                                    numberOfLines={1}
                                  >
                                    {att.name || att.linkMeta?.title || 'Attachment'}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        );

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
  weekCalendarContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthLabel: {
    fontSize: 16,
    letterSpacing: -0.3,
  },
  todayLink: {
    fontSize: 12,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayChip: {
    width: 44,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  dayName: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  dayNum: {
    fontSize: 14,
    marginTop: 2,
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: 13,
  },
  progressDate: {
    fontSize: 11,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  composerContainer: {
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  composerInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  quickAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 4,
  },
  quickAddBtnText: {
    fontSize: 12,
  },
  agendaSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  agendaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  agendaHeading: {
    fontSize: 12,
    letterSpacing: 0.8,
  },
  groupToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  toggleBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  toggleBtnText: {
    fontSize: 11,
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  groupDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  groupTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  taskCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskTextCol: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 4,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagBadgeText: {
    fontSize: 10.5,
  },
  timeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  subtaskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 11,
  },
  attachmentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  attachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 160,
  },
  attachmentText: {
    fontSize: 10.5,
  },
  emptyAgenda: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyAgendaTitle: {
    fontSize: 14,
  },
  emptyAgendaSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 260,
  },
});
