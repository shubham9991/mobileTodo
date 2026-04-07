import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';

interface TasksHeaderProps {
  total: number;
  completed: number;
}

export const TasksHeader = ({ total, completed }: TasksHeaderProps) => {
  const { theme } = useTheme();
  const active = total - completed;

  return (
    <View style={[styles.container, { borderBottomColor: theme.colors.border }]}>
      {/* Stats Row */}
      <View style={styles.statsRow}>
        {[
          { label: 'Total', value: total, color: theme.colors.text, icon: 'list-alt' as any },
          { label: 'Active', value: active, color: '#6366F1', icon: 'pending-actions' as any },
          { label: 'Done', value: completed, color: '#22C55E', icon: 'check-circle' as any },
        ].map((stat) => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
            <View style={styles.statHeader}>
              <MaterialIcons name={stat.icon} size={16} color={stat.color} />
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                {stat.label}
              </Text>
            </View>
            <Text style={[styles.statValue, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
              {stat.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  statValue: {
    fontSize: 24,
    letterSpacing: -0.5,
  },
});
