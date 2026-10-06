import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { Task } from '../../../core/dummyData';
import { WidgetSize } from '../dashboardPrefsStore';

interface PomodoroWidgetProps {
  tasks?: Task[];
  size?: WidgetSize;
  onLongPress?: () => void;
  onOpenTaskDetail?: (taskId: string) => void;
}

type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

const MODE_DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_LABELS: Record<TimerMode, string> = {
  focus: 'Focus Sprint',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

const MODE_COLORS: Record<TimerMode, string> = {
  focus: '#EF4444',
  shortBreak: '#10B981',
  longBreak: '#3B82F6',
};

export const PomodoroWidget = ({
  tasks = [],
  size = 'half',
  onLongPress,
  onOpenTaskDetail,
}: PomodoroWidgetProps) => {
  const { theme } = useTheme();
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState<number>(MODE_DURATIONS.focus);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedSessions, setCompletedSessions] = useState<number>(0);
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const linkedTask = tasks.find(t => t.id === linkedTaskId) || tasks[0] || null;

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            if (mode === 'focus') {
              setCompletedSessions(s => s + 1);
              setMode('shortBreak');
              return MODE_DURATIONS.shortBreak;
            } else {
              setMode('focus');
              return MODE_DURATIONS.focus;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode]);

  const toggleStartPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsRunning(r => !r);
  }, []);

  const resetTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsRunning(false);
    setTimeLeft(MODE_DURATIONS[mode]);
  }, [mode]);

  const switchMode = useCallback((newMode: TimerMode) => {
    Haptics.selectionAsync().catch(() => {});
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(MODE_DURATIONS[newMode]);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const total = MODE_DURATIONS[mode];
  const progressPercent = Math.max(0, Math.min(100, Math.round(((total - timeLeft) / total) * 100)));
  const modeColor = MODE_COLORS[mode];

  const isFull = size === 'full';

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
      {/* Widget Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="timer" size={15} color={modeColor} />
          <Text style={[styles.title, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
            POMODORO
          </Text>
        </View>
        <View style={[styles.sessionBadge, { backgroundColor: `${modeColor}15` }]}>
          <Text style={[styles.sessionText, { color: modeColor, fontFamily: 'Inter_600SemiBold' }]}>
            {completedSessions}/4 🍅
          </Text>
        </View>
      </View>

      {/* Mode Selector Strip */}
      <View style={[styles.modeTabs, { backgroundColor: theme.colors.secondary }]}>
        {(['focus', 'shortBreak', 'longBreak'] as const).map(m => {
          const active = mode === m;
          return (
            <TouchableOpacity
              key={m}
              style={[
                styles.modeTab,
                active && { backgroundColor: theme.colors.cardPrimary },
              ]}
              onPress={() => switchMode(m)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modeTabText,
                  {
                    color: active ? modeColor : theme.colors.textSecondary,
                    fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  },
                ]}
              >
                {m === 'focus' ? '25m' : m === 'shortBreak' ? '5m' : '15m'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main Countdown Display */}
      <View style={styles.timerCenter}>
        <Text style={[styles.timerDigits, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
          {timeFormatted}
        </Text>
        <Text style={[styles.modeSubText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          {MODE_LABELS[mode]}
        </Text>

        {/* Progress Bar */}
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
          <View
            style={[
              styles.progressBar,
              { width: `${progressPercent}%`, backgroundColor: modeColor },
            ]}
          />
        </View>
      </View>

      {/* Linked Task Spotlight (if full-width or has linked task) */}
      {isFull && linkedTask && (
        <TouchableOpacity
          style={[styles.taskSpotlight, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}
          onPress={() => onOpenTaskDetail && onOpenTaskDetail(linkedTask.id)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="flag" size={13} color={modeColor} />
          <Text style={[styles.taskSpotlightText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>
            {linkedTask.title}
          </Text>
        </TouchableOpacity>
      )}

      {/* Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: modeColor }]}
          onPress={toggleStartPause}
          activeOpacity={0.8}
        >
          <MaterialIcons name={isRunning ? 'pause' : 'play-arrow'} size={18} color="#fff" />
          <Text style={[styles.actionBtnText, { color: '#fff', fontFamily: 'Inter_600SemiBold' }]}>
            {isRunning ? 'Pause' : 'Start'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: theme.colors.secondary }]}
          onPress={resetTimer}
          activeOpacity={0.7}
        >
          <MaterialIcons name="refresh" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
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
    gap: 5,
  },
  title: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  sessionBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sessionText: {
    fontSize: 10,
  },
  modeTabs: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    marginBottom: 8,
  },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 3,
    borderRadius: 6,
  },
  modeTabText: {
    fontSize: 10.5,
  },
  timerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  timerDigits: {
    fontSize: 26,
    letterSpacing: -0.5,
  },
  modeSubText: {
    fontSize: 10,
    marginTop: -2,
    marginBottom: 6,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  taskSpotlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 0.5,
    marginVertical: 4,
  },
  taskSpotlightText: {
    fontSize: 11,
    flex: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 12,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
