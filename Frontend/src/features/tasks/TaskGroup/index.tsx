import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';
import { Task } from '../../../core/dummyData';
import { TaskItem } from '../TaskItem';

interface Props {
  label: string;
  tasks: Task[];
  defaultOpen?: boolean;
  onTaskToggle?: (taskId: string, completed: boolean) => void;
  onTaskPress?: (task: Task) => void;
}

export const TaskGroup = ({ label, tasks, defaultOpen = true, onTaskToggle, onTaskPress }: Props) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressRatio  = tasks.length > 0 ? completedCount / tasks.length : 0;
  const allDone        = completedCount === tasks.length;

  return (
    <View style={styles.container}>
      {/* Group Header */}
      <TouchableOpacity style={styles.groupHeader} onPress={() => setOpen((o) => !o)} activeOpacity={0.7}>
        <View style={styles.groupLeft}>
          <Text style={[styles.groupLabel, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
            {label}
          </Text>
          <View style={[styles.countPill, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
            <Text style={[styles.countText, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              {tasks.length}
            </Text>
          </View>

          {allDone ? (
            <View style={styles.allDoneRow}>
              <MaterialIcons name="check-circle" size={13} color="#22C55E" />
              <Text style={[styles.allDoneText, { fontFamily: 'Inter_500Medium' }]}>All done!</Text>
            </View>
          ) : completedCount > 0 ? (
            <Text style={[styles.progressText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              {completedCount}/{tasks.length} done
            </Text>
          ) : null}
        </View>
        <MaterialIcons
          name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={20}
          color={theme.colors.textSecondary}
        />
      </TouchableOpacity>

      {/* ── Progress Bar ──────────────────────────────── */}
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.secondary, marginHorizontal: 16, marginBottom: 8 }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progressRatio * 100}%`,
              backgroundColor: allDone ? '#22C55E' : theme.colors.primary,
            },
          ]}
        />
      </View>

      {/* Task List */}
      {open && (
        <View style={styles.taskList}>
          {tasks.map((task) => (
            <TaskItem 
              key={task.id} 
              task={task} 
              onToggle={onTaskToggle}
              onPress={onTaskPress}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  groupLabel: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  countPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  countText: { fontSize: 11 },
  progressText: { fontSize: 12 },
  allDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  allDoneText: {
    fontSize: 12,
    color: '#22C55E',
  },
  progressTrack: {
    height: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  taskList: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
});
