import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';
import { dummyData, Subtask } from '../../../core/dummyData';
import { TaskCardSkeleton } from '../../../core/components/Skeleton';

type TagType = 'work' | 'personal' | 'review';

const TAG_CONFIG: Record<TagType, { text: string; bg: string }> = {
  work:     { text: '#6366F1', bg: '#EEF2FF' },
  personal: { text: '#71717A', bg: '#F4F4F5' },
  review:   { text: '#F97316', bg: '#FFF7ED' },
};

const PRIORITY_CONFIG: Record<string, { text: string; bg: string }> = {
  HIGH: { text: '#EF4444', bg: '#FEF2F2' },
  MED:  { text: '#F97316', bg: '#FFF7ED' },
};

export const TodaysTasks = () => {
  const { theme } = useTheme();
  const tasks = dummyData.todaysTasks;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
          TODAY'S TASKS
        </Text>
        <View style={[styles.countBadge, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
          <Text style={[styles.countText, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
            {tasks.length} TOTAL
          </Text>
        </View>
      </View>

      {loading ? (
        <>
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </>
      ) : (
        tasks.map((task) => {
          const tagStyle = TAG_CONFIG[task.tagType as TagType] || TAG_CONFIG.work;
          const priorityStyle = PRIORITY_CONFIG[task.priority || ''];

          return (
            <View
              key={task.id}
              style={[styles.taskCard, {
                backgroundColor: theme.colors.cardPrimary,
                borderColor: theme.colors.border,
              }]}
            >
              <View style={styles.taskRow}>
                <TouchableOpacity style={[
                  styles.checkbox,
                  { borderColor: task.completed ? theme.colors.primary : theme.colors.border },
                  task.completed && { backgroundColor: theme.colors.primary },
                ]}>
                  {task.completed && (
                    <MaterialIcons name="check" size={11} color={theme.colors.primaryText} />
                  )}
                </TouchableOpacity>

                <View style={styles.taskContent}>
                  <View style={styles.titleRow}>
                    <Text style={[
                      styles.taskTitle,
                      { color: theme.colors.text, fontFamily: 'Inter_500Medium' },
                      task.completed && { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
                    ]}>
                      {task.title}
                    </Text>

                    {priorityStyle && (
                      <View style={[styles.badge, { backgroundColor: priorityStyle.bg }]}>
                        <View style={[styles.dot, { backgroundColor: priorityStyle.text }]} />
                        <Text style={[styles.badgeText, { color: priorityStyle.text, fontFamily: 'Inter_600SemiBold' }]}>
                          {task.priority}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.metaRow}>
                    <View style={[styles.tagPill, { backgroundColor: tagStyle.bg }]}>
                      <Text style={[styles.tagText, { color: tagStyle.text, fontFamily: 'Inter_600SemiBold' }]}>
                        {task.tag}
                      </Text>
                    </View>

                    {task.subtasks && task.subtasks.length > 0 && (
                      <View style={styles.metaItem}>
                        <MaterialIcons name="account-tree" size={12} color={theme.colors.textSecondary} />
                        <Text style={[styles.metaText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                          {`${(task.subtasks as Subtask[]).filter((s) => s.done).length}/${task.subtasks.length}`}
                        </Text>
                      </View>
                    )}

                    {task.comments !== undefined && (
                      <View style={styles.metaItem}>
                        <MaterialIcons name="chat-bubble-outline" size={12} color={theme.colors.textSecondary} />
                        <Text style={[styles.metaText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                          {task.comments}
                        </Text>
                      </View>
                    )}

                    {task.hasReminder && (
                      <MaterialIcons name="notifications-none" size={14} color={theme.colors.textSecondary} />
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        })
      )}
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
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  countText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  taskCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskContent: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  taskTitle: {
    fontSize: 14,
    flex: 1,
    letterSpacing: -0.1,
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
    fontSize: 10,
    letterSpacing: 0.3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  tagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: { fontSize: 12 },
});
