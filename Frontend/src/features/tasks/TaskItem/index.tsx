import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Pressable } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';
import { Task, Subtask } from '../../../core/dummyData';

type TagType = 'work' | 'personal' | 'review' | 'health' | 'learning';

const TAG_CONFIG: Record<TagType, { text: string; bg: string }> = {
  work:     { text: '#6366F1', bg: '#EEF2FF' },
  personal: { text: '#71717A', bg: '#F4F4F5' },
  review:   { text: '#F97316', bg: '#FFF7ED' },
  health:   { text: '#22C55E', bg: '#F0FDF4' },
  learning: { text: '#EC4899', bg: '#FDF2F8' },
};

// Priority → left stripe color + badge config
const PRIORITY_CONFIG: Record<string, { stripe: string; text: string; bg: string }> = {
  HIGH: { stripe: '#EF4444', text: '#EF4444', bg: '#FEF2F2' },
  MED:  { stripe: '#F97316', text: '#F97316', bg: '#FFF7ED' },
  LOW:  { stripe: '#22C55E', text: '#22C55E', bg: '#F0FDF4' },
};

interface TaskItemProps {
  task: Task;
  onToggle?: (id: string, completed: boolean) => void;
  onPress?: (task: Task) => void;
  onLongPress?: (task: Task) => void;
}

export const TaskItem = ({ task, onToggle, onPress, onLongPress }: TaskItemProps) => {
  const { theme } = useTheme();
  const [done, setDone] = useState(task.completed);
  const [isPressed, setIsPressed] = useState(false);

  const tagStyle  = TAG_CONFIG[task.tagType as TagType] || TAG_CONFIG.work;
  const priConfig = task.priority ? PRIORITY_CONFIG[task.priority] : null;

  // Derive subtask display text from Subtask[] array
  const subtaskText = task.subtasks && task.subtasks.length > 0
    ? `${task.subtasks.filter((s: Subtask) => s.done).length}/${task.subtasks.length}`
    : undefined;

  // Check if task has attachments
  const hasAttachments = task.attachments && task.attachments.length > 0;
  const attachmentCount = task.attachments?.length ?? 0;

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newState = !done;
    setDone(newState);
    if (onToggle) {
      onToggle(task.id, newState);
    }
  }, [done, onToggle, task.id]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(task);
    }
  }, [onPress, task]);

  const handleLongPress = useCallback(() => {
    if (onLongPress) {
      onLongPress(task);
    }
  }, [onLongPress, task]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      style={({ pressed }) => [
        styles.card,
        { 
          backgroundColor: theme.colors.cardPrimary, 
          borderColor: isPressed || pressed ? theme.colors.primary : theme.colors.border,
        },
        (isPressed || pressed) && styles.cardPressed,
      ]}
    >
      <View style={[styles.inner, done && { opacity: 0.55 }]}>
        {/* Checkbox */}
        <TouchableOpacity
          style={[
            styles.checkbox,
            { borderColor: done ? theme.colors.primary : theme.colors.border },
            done && { backgroundColor: theme.colors.primary },
            !done && (isPressed) && { borderColor: theme.colors.primary },
          ]}
          onPress={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          {done && <MaterialIcons name="check" size={11} color={theme.colors.primaryText} />}
          {!done && (isPressed) && (
            <View style={[styles.checkPreview, { backgroundColor: theme.colors.primary }]} />
          )}
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.content}>
          {/* Title + Priority Badge */}
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: theme.colors.text, fontFamily: 'Inter_500Medium' },
                done && { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {task.title}
            </Text>

            {priConfig && !done && (
              <View style={[styles.priorityBadge, { backgroundColor: priConfig.bg }]}>
                <View style={[styles.dot, { backgroundColor: priConfig.text }]} />
                <Text style={[styles.priorityText, { color: priConfig.text, fontFamily: 'Inter_600SemiBold' }]}>
                  {task.priority}
                </Text>
              </View>
            )}
          </View>

          {/* Due date row */}
          {(task.dueDate || task.dueTime) && (
            <View style={styles.dueRow}>
              <MaterialIcons name="schedule" size={11} color={theme.colors.textSecondary} />
              <Text style={[styles.dueText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                {task.dueDate}{task.dueTime ? ` · ${task.dueTime}` : ''}
              </Text>
            </View>
          )}

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={[styles.tagPill, { backgroundColor: tagStyle.bg }]}>
              <Text style={[styles.tagText, { color: tagStyle.text, fontFamily: 'Inter_600SemiBold' }]}>
                {task.tag}
              </Text>
            </View>

            {subtaskText && (
              <View style={styles.metaItem}>
                <MaterialIcons name="account-tree" size={11} color={theme.colors.textSecondary} />
                <Text style={[styles.metaText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  {subtaskText}
                </Text>
              </View>
            )}

            {hasAttachments && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="paperclip" size={11} color={theme.colors.textSecondary} />
                <Text style={[styles.metaText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  {attachmentCount}
                </Text>
              </View>
            )}

            {task.comments !== undefined && (
              <View style={styles.metaItem}>
                <MaterialIcons name="chat-bubble-outline" size={11} color={theme.colors.textSecondary} />
                <Text style={[styles.metaText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  {task.comments}
                </Text>
              </View>
            )}

            {task.hasReminder && (
              <MaterialIcons name="notifications-none" size={13} color={theme.colors.textSecondary} />
            )}
          </View>
        </View>

        {/* Chevron / Actions hint */}
        <View style={styles.actionsHint}>
          {subtaskText && (
            <View style={[styles.subtaskBadge, { backgroundColor: theme.colors.secondary }]}>
              <Text style={[styles.subtaskText, { color: theme.colors.textSecondary }]}>
                {subtaskText}
              </Text>
            </View>
          )}
          {hasAttachments && (
            <View style={[styles.attachmentBadge, { backgroundColor: theme.colors.secondary }]}>
              <MaterialCommunityIcons name="paperclip" size={10} color={theme.colors.textSecondary} />
              <Text style={[styles.attachmentText, { color: theme.colors.textSecondary }]}>
                {attachmentCount}
              </Text>
            </View>
          )}
          <MaterialIcons name="chevron-right" size={18} color={theme.colors.border} />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
    flexDirection: 'row',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardPressed: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkPreview: {
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.3,
  },
  content: { flex: 1, gap: 5 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    flex: 1,
    letterSpacing: -0.1,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  priorityText: { fontSize: 10, letterSpacing: 0.3 },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dueText: { fontSize: 11 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: { fontSize: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaText: { fontSize: 11 },
  actionsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtaskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subtaskText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attachmentText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
});
