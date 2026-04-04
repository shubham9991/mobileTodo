import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
      {/* Title row */}
      <View style={styles.titleRow}>
        <View>
          <Text style={[styles.title, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
            My Tasks
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {active} active · {completed} done
          </Text>
        </View>
        <TouchableOpacity style={[styles.newBtn, { backgroundColor: theme.colors.primary }]}>
          <MaterialIcons name="add" size={16} color={theme.colors.primaryText} />
          <Text style={[styles.newBtnText, { color: theme.colors.primaryText, fontFamily: 'Inter_600SemiBold' }]}>
            New Task
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {[
          { label: 'Total', value: total, color: theme.colors.text },
          { label: 'Active', value: active, color: '#6366F1' },
          { label: 'Done', value: completed, color: '#22C55E' },
        ].map((stat) => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
            <Text style={[styles.statValue, { color: stat.color, fontFamily: 'Inter_700Bold' }]}>
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              {stat.label}
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
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newBtnText: {
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 20,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
