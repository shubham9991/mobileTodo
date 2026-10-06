import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { format } from 'date-fns';
import { useTheme } from '../../../themes/ThemeContext';
import { WidgetSize } from '../dashboardPrefsStore';

interface HabitTrackerWidgetProps {
  size?: WidgetSize;
  onLongPress?: () => void;
}

interface Habit {
  id: string;
  name: string;
  emoji: string;
  completed: boolean;
}

interface HabitState {
  date: string;
  streak: number;
  habits: Habit[];
}

const HABITS_FILE = `${FileSystem.documentDirectory}habit_tracker.json`;

const DEFAULT_HABITS: Habit[] = [
  { id: 'water', name: 'Hydrate 2L', emoji: '💧', completed: false },
  { id: 'read', name: 'Read 20m', emoji: '📖', completed: false },
  { id: 'workout', name: 'Workout', emoji: '🏃', completed: false },
  { id: 'meditate', name: 'Mindfulness', emoji: '🧘', completed: false },
];

export const HabitTrackerWidget = ({
  size = 'half',
  onLongPress,
}: HabitTrackerWidgetProps) => {
  const { theme } = useTheme();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [streak, setStreak] = useState<number>(3);

  // Load saved state
  useEffect(() => {
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(HABITS_FILE);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(HABITS_FILE);
          const data = JSON.parse(raw) as HabitState;
          if (data.date === todayStr) {
            setHabits(data.habits || DEFAULT_HABITS);
            setStreak(data.streak || 1);
          } else {
            // New day: retain streak if previous day was all completed
            const prevAllDone = data.habits && data.habits.every(h => h.completed);
            setStreak(prevAllDone ? (data.streak || 0) + 1 : Math.max(1, data.streak || 1));
            setHabits(DEFAULT_HABITS);
          }
        }
      } catch {}
    })();
  }, [todayStr]);

  const saveState = async (newHabits: Habit[], newStreak: number) => {
    try {
      const data: HabitState = {
        date: todayStr,
        streak: newStreak,
        habits: newHabits,
      };
      await FileSystem.writeAsStringAsync(HABITS_FILE, JSON.stringify(data));
    } catch {}
  };

  const toggleHabit = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setHabits(prev => {
        const next = prev.map(h => (h.id === id ? { ...h, completed: !h.completed } : h));
        const allDone = next.every(h => h.completed);
        const nextStreak = allDone ? streak + 1 : streak;
        saveState(next, nextStreak);
        return next;
      });
    },
    [streak, todayStr]
  );

  const completedCount = habits.filter(h => h.completed).length;
  const isFull = size === 'full';
  const displayHabits = isFull ? habits : habits.slice(0, 3);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.cardPrimary,
          borderColor: theme.colors.border,
          flex: isFull ? undefined : 1,
          width: isFull ? '100%' : undefined,
        },
      ]}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.9}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="local-fire-department" size={15} color="#F97316" />
          <Text style={[styles.title, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
            DAILY HABITS
          </Text>
        </View>
        <View style={[styles.streakBadge, { backgroundColor: '#F9731618' }]}>
          <Text style={[styles.streakText, { color: '#F97316', fontFamily: 'Inter_600SemiBold' }]}>
            🔥 {streak}d streak
          </Text>
        </View>
      </View>

      {/* Habit Items */}
      <View style={styles.habitsList}>
        {displayHabits.map(h => (
          <TouchableOpacity
            key={h.id}
            style={[
              styles.habitRow,
              {
                backgroundColor: h.completed ? `${theme.colors.primary}12` : theme.colors.secondary,
              },
            ]}
            onPress={() => toggleHabit(h.id)}
            activeOpacity={0.7}
          >
            <View style={styles.habitLeft}>
              <Text style={styles.habitEmoji}>{h.emoji}</Text>
              <Text
                style={[
                  styles.habitName,
                  {
                    color: h.completed ? theme.colors.textSecondary : theme.colors.text,
                    textDecorationLine: h.completed ? 'line-through' : 'none',
                    fontFamily: h.completed ? 'Inter_400Regular' : 'Inter_500Medium',
                  },
                ]}
                numberOfLines={1}
              >
                {h.name}
              </Text>
            </View>
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: h.completed ? theme.colors.primary : theme.colors.border,
                  backgroundColor: h.completed ? theme.colors.primary : 'transparent',
                },
              ]}
            >
              {h.completed && <MaterialIcons name="check" size={12} color="#fff" />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Progress Footer */}
      <View style={styles.footer}>
        <Text style={[styles.progressText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          {completedCount}/{habits.length} completed
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${(completedCount / habits.length) * 100}%`,
                backgroundColor: '#F97316',
              },
            ]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    minHeight: 155,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  streakBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  streakText: {
    fontSize: 10,
  },
  habitsList: {
    gap: 5,
    marginVertical: 2,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  habitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  habitEmoji: {
    fontSize: 13,
  },
  habitName: {
    fontSize: 11.5,
    flex: 1,
  },
  checkbox: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: 6,
    gap: 4,
  },
  progressText: {
    fontSize: 10,
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 1.5,
  },
});
