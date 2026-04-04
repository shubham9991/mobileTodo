import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';
import { dummyData, Subtask } from '../../../core/dummyData';

type TagType = 'work' | 'personal' | 'review';

const TAG_CONFIG: Record<TagType, { text: string; bg: string }> = {
  work:     { text: '#6366F1', bg: '#EEF2FF' },
  personal: { text: '#71717A', bg: '#F4F4F5' },
  review:   { text: '#F97316', bg: '#FFF7ED' },
};

export const Upcoming = () => {
  const { theme } = useTheme();
  const { days, events, label } = dummyData.upcoming;
  const [activeDay, setActiveDay] = useState(24);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Upcoming</Text>
        <Text style={[styles.labelText, { color: theme.colors.textSecondary }]}>{label}</Text>
      </View>

      {/* Day Selector */}
      <View style={styles.dayRow}>
        {days.map((d) => {
          const isActive = activeDay === d.date;
          return (
            <TouchableOpacity
              key={d.date}
              style={[
                styles.dayBox,
                {
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.cardPrimary,
                  borderColor: isActive ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setActiveDay(d.date)}
            >
              <Text style={[
                styles.dayLabel,
                { color: isActive ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary },
              ]}>
                {d.day}
              </Text>
              <Text style={[
                styles.dayDate,
                { color: isActive ? '#FFFFFF' : theme.colors.text },
              ]}>
                {d.date}
              </Text>
              {isActive && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Events */}
      {events.map((event) => {
        const tagStyle = TAG_CONFIG[event.tagType as TagType] || TAG_CONFIG.work;
        const priorityStyle = event.priority === 'HIGH'
          ? { text: '#EF4444', bg: '#FEF2F2' }
          : null;

        return (
          <View
            key={event.id}
            style={[styles.eventCard, {
              backgroundColor: theme.colors.cardPrimary,
              borderColor: theme.colors.border,
            }]}
          >
            {/* Time */}
            <View style={styles.timeCol}>
              <Text style={[styles.timeHour, { color: theme.colors.textSecondary }]}>
                {event.time.split(' ')[0]}
              </Text>
              <Text style={[styles.timeAmPm, { color: theme.colors.textSecondary }]}>
                {event.time.split(' ')[1]}
              </Text>
            </View>

            {/* Indicator Dot */}
            <View style={[styles.dot, { backgroundColor: event.dotColor }]} />

            {/* Event Info */}
            <View style={styles.eventContent}>
              <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{event.title}</Text>
              <View style={styles.eventMeta}>
                <View style={[styles.tagPill, { backgroundColor: tagStyle.bg }]}>
                  <Text style={[styles.tagText, { color: tagStyle.text }]}>{event.tag}</Text>
                </View>

                <View style={styles.metaItem}>
                  <MaterialIcons name="place" size={11} color={theme.colors.textSecondary} />
                  <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                    {event.location}
                  </Text>
                </View>

                {event.comments !== undefined && (
                  <View style={styles.metaItem}>
                    <MaterialIcons name="chat-bubble-outline" size={11} color={theme.colors.textSecondary} />
                    <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{event.comments}</Text>
                  </View>
                )}

                {event.hasReminder && (
                  <MaterialIcons name="notifications-none" size={13} color={theme.colors.textSecondary} />
                )}

                {event.subtasks && event.subtasks.length > 0 && (
                  <View style={styles.metaItem}>
                    <MaterialIcons name="account-tree" size={11} color={theme.colors.textSecondary} />
                    <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                      {`${(event.subtasks as Subtask[]).filter((s) => s.done).length}/${event.subtasks.length}`}
                    </Text>
                  </View>
                )}

                {priorityStyle && (
                  <View style={[styles.tagPill, { backgroundColor: priorityStyle.bg }]}>
                    <Text style={[styles.tagText, { color: priorityStyle.text }]}>● HIGH</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Chevron */}
            <MaterialIcons name="chevron-right" size={18} color={theme.colors.border} />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dayRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  dayBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  dayDate: {
    fontSize: 18,
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 6,
    gap: 10,
  },
  timeCol: {
    width: 36,
    alignItems: 'flex-end',
  },
  timeHour: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeAmPm: {
    fontSize: 9,
    fontWeight: '500',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
    letterSpacing: -0.1,
  },
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaText: {
    fontSize: 11,
  },
});
