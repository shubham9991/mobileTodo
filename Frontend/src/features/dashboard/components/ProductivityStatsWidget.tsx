import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';
import { Task } from '../../../core/dummyData';
import { WidgetSize } from '../dashboardPrefsStore';

interface ProductivityStatsWidgetProps {
  tasks?: Task[];
  notesCount?: number;
  sketchesCount?: number;
  size?: WidgetSize;
  onLongPress?: () => void;
}

export const ProductivityStatsWidget = ({
  tasks = [],
  notesCount = 0,
  sketchesCount = 0,
  size = 'half',
  onLongPress,
}: ProductivityStatsWidgetProps) => {
  const { theme } = useTheme();

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

  let badge = 'Getting Started';
  let badgeColor = '#64748B';
  if (completionRate >= 80) {
    badge = 'Super Productive ⚡';
    badgeColor = '#10B981';
  } else if (completionRate >= 50) {
    badge = 'Steady Progress 🚀';
    badgeColor = '#3B82F6';
  } else if (completedTasks > 0) {
    badge = 'On Track 🎯';
    badgeColor = '#F59E0B';
  }

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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="insights" size={15} color="#8B5CF6" />
          <Text style={[styles.title, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
            PRODUCTIVITY
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${badgeColor}18` }]}>
          <Text style={[styles.badgeText, { color: badgeColor, fontFamily: 'Inter_600SemiBold' }]}>
            {badge}
          </Text>
        </View>
      </View>

      {/* Main Metric: Completion Rate */}
      <View style={styles.rateRow}>
        <View style={styles.rateNumberWrap}>
          <Text style={[styles.rateDigits, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
            {completionRate}%
          </Text>
          <Text style={[styles.rateSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {completedTasks} of {totalTasks} tasks done
          </Text>
        </View>

        {/* Progress track */}
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
          <View
            style={[
              styles.progressBar,
              { width: `${completionRate}%`, backgroundColor: '#8B5CF6' },
            ]}
          />
        </View>
      </View>

      {/* Sub Metrics: Notes & Sketches */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: theme.colors.secondary }]}>
          <MaterialIcons name="description" size={13} color="#F59E0B" />
          <Text style={[styles.statVal, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
            {notesCount}
          </Text>
          <Text style={[styles.statLbl, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            Notes
          </Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: theme.colors.secondary }]}>
          <MaterialIcons name="brush" size={13} color="#6366F1" />
          <Text style={[styles.statVal, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
            {sketchesCount}
          </Text>
          <Text style={[styles.statLbl, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            Sketches
          </Text>
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
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 9.5,
  },
  rateRow: {
    marginVertical: 4,
    gap: 6,
  },
  rateNumberWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  rateDigits: {
    fontSize: 24,
    letterSpacing: -0.5,
  },
  rateSub: {
    fontSize: 11,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statVal: {
    fontSize: 12,
  },
  statLbl: {
    fontSize: 10.5,
  },
});
