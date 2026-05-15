/**
 * ScheduleView — Agenda (list) view for MasterCalendarScreen.
 * Groups calendar items by date with proper card styling and tap interactions.
 */
import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { parseISO, format, addDays, eachDayOfInterval } from 'date-fns';
import { useTheme } from '../../../themes/ThemeContext';
import { CalendarItem } from '../../hooks/useCalendarData';
import { useDashboard } from '../../../core/DashboardContext';
import { TaskItem } from '../../tasks/TaskItem';
import { Task } from '../../../core/dummyData';

interface Props {
  startISO: string;
  endISO: string;
  getItemsForDate: (iso: string) => CalendarItem[];
  onItemPress?: (item: CalendarItem) => void;
  onSlotPress?: (iso: string, time?: string) => void;
}

function friendlyDate(iso: string): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  if (iso === today) return 'Today';
  if (iso === tomorrow) return 'Tomorrow';
  const d = parseISO(iso);
  return format(d, 'EEE, MMM d');
}

function timeLabel(item: CalendarItem): string {
  if (item.time) return item.time;
  if (item.endDate && item.endDate !== item.startDate) {
    return `${format(parseISO(item.startDate), 'MMM d')} – ${format(parseISO(item.endDate), 'MMM d')}`;
  }
  return 'All day';
}

export const ScheduleView: React.FC<Props> = ({
  startISO, endISO, getItemsForDate, onItemPress, onSlotPress,
}) => {
  const { theme } = useTheme();
  const { taskGroups, updateTask } = useDashboard();
  const days = eachDayOfInterval({ start: parseISO(startISO), end: parseISO(endISO) });

  // Only show days that have items OR are today
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const visibleDays = days.filter(day => {
    const iso = format(day, 'yyyy-MM-dd');
    return getItemsForDate(iso).length > 0 || iso === todayISO;
  });

  if (visibleDays.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="event-note" size={52} color={theme.colors.textSecondary} style={{ opacity: 0.4 }} />
        <Text style={[styles.emptyTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
          All clear!
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          No tasks or events in this period.{'\n'}Tap the + button to add one.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 100, paddingTop: 4 }}
    >
      {visibleDays.map(day => {
        const iso = format(day, 'yyyy-MM-dd');
        const items = getItemsForDate(iso);
        const isToday = iso === todayISO;

        return (
          <View key={iso} style={styles.daySection}>
            {/* Day Header */}
            <View style={styles.dayHeader}>
              <View style={[
                styles.dayBubble,
                isToday && { backgroundColor: theme.colors.primary }
              ]}>
                <Text style={[
                  styles.dayNum,
                  { color: isToday ? '#FFF' : theme.colors.text, fontFamily: 'Inter_700Bold' }
                ]}>
                  {format(day, 'd')}
                </Text>
              </View>
              <Text style={[
                styles.dayLabel,
                { color: isToday ? theme.colors.primary : theme.colors.textSecondary },
                { fontFamily: isToday ? 'Inter_700Bold' : 'Inter_500Medium' }
              ]}>
                {friendlyDate(iso)}
              </Text>
              {/* Add task for this day */}
              <TouchableOpacity
                onPress={() => onSlotPress?.(iso)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="add" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Items */}
            {items.length === 0 ? (
              <TouchableOpacity
                onPress={() => onSlotPress?.(iso)}
                style={[styles.emptyDay, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.emptyDayText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  Free — tap to add
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.itemsList}>
                {items.map((item, idx) => {
                  if (item.type === 'task' && item.taskId) {
                    const originalTask = taskGroups.flatMap(g => g.tasks).find(t => t.id === item.taskId);
                    if (originalTask) {
                      return (
                        <TaskItem
                          key={item.id}
                          task={originalTask}
                          onPress={() => onItemPress?.(item)}
                          onToggle={(id, completed) => updateTask(id, t => ({ ...t, completed }))}
                        />
                      );
                    }
                  }

                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => onItemPress?.(item)}
                      activeOpacity={0.7}
                      style={[
                        styles.itemCard,
                        {
                          backgroundColor: theme.colors.cardPrimary || theme.colors.background,
                          borderColor: theme.colors.border,
                        }
                      ]}
                    >
                      {/* Checkbox / Icon */}
                      <View style={[
                        styles.checkbox,
                        item.completed ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } : { borderColor: theme.colors.border }
                      ]}>
                        {item.completed && <MaterialIcons name="check" size={11} color="#FFF" />}
                        {!item.completed && item.type !== 'task' && item.type !== 'event' && (
                          <MaterialIcons
                            name={item.type === 'birthday' ? 'cake' : item.type === 'holiday' ? 'flag' : 'event'}
                            size={11}
                            color={item.color || theme.colors.textSecondary}
                          />
                        )}
                      </View>

                      {/* Content */}
                      <View style={styles.itemContent}>
                        <Text style={[
                          styles.itemTitle,
                          { color: theme.colors.text, fontFamily: 'Inter_500Medium', letterSpacing: -0.1 },
                          item.completed && { textDecorationLine: 'line-through', color: theme.colors.textSecondary }
                        ]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        
                        <View style={styles.dueRow}>
                          <MaterialIcons name="schedule" size={11} color={theme.colors.textSecondary} />
                          <Text style={[styles.dueText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                            {timeLabel(item)}
                          </Text>
                        </View>

                        {item.tag && (
                          <View style={styles.metaRow}>
                            <View style={[styles.tagPill, { backgroundColor: `${item.color || theme.colors.primary}15` }]}>
                              <Text style={[styles.tagText, { color: item.color || theme.colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                                {item.tag}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>

                      <View style={styles.actionsHint}>
                        <MaterialIcons name="chevron-right" size={18} color={theme.colors.border} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 60,
  },
  emptyTitle: { fontSize: 18, letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  daySection: { marginBottom: 4 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  dayBubble: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  dayNum: { fontSize: 14 },
  dayLabel: { fontSize: 14, flex: 1 },
  itemsList: { gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderRadius: 12,
    paddingVertical: 12,
    paddingRight: 10,
    paddingLeft: 12,
    gap: 10,
  },
  iconWrap: {
    width: 34, height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 14 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTime: { fontSize: 11 },
  tagPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10 },
  emptyDay: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyDayText: { fontSize: 13 },
});
