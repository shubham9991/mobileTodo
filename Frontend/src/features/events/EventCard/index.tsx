import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';

type TagType = 'work' | 'personal' | 'review' | 'health' | 'learning';

const TAG_CONFIG: Record<TagType, { text: string; bg: string }> = {
  work:     { text: '#6366F1', bg: '#EEF2FF' },
  personal: { text: '#71717A', bg: '#F4F4F5' },
  review:   { text: '#F97316', bg: '#FFF7ED' },
  health:   { text: '#22C55E', bg: '#F0FDF4' },
  learning: { text: '#EC4899', bg: '#FDF2F8' },
};

interface EventCardProps {
  event: {
    id: string;
    startTime: string;
    endTime: string;
    title: string;
    tag: string;
    tagType: string;
    location: string;
    attendees: number;
    hasReminder: boolean;
    color: string;
    description?: string;
  };
}

export const EventCard = ({ event }: EventCardProps) => {
  const { theme } = useTheme();
  const tagStyle = TAG_CONFIG[event.tagType as TagType] || TAG_CONFIG.work;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
      {/* Time Column */}
      <View style={styles.timeCol}>
        <Text style={[styles.startTime, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
          {event.startTime.split(' ')[0]}
        </Text>
        <Text style={[styles.ampm, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          {event.startTime.split(' ')[1]}
        </Text>
        {/* Vertical connector line */}
        <View style={[styles.timeLine, { backgroundColor: theme.colors.border }]} />
        <Text style={[styles.endTime, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          {event.endTime.split(' ')[0]}
          {'\n'}{event.endTime.split(' ')[1]}
        </Text>
      </View>

      {/* Color dot */}
      <View style={[styles.dot, { backgroundColor: event.color }]} />

      {/* Event Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
          {event.title}
        </Text>

        {event.description ? (
          <Text
            style={[styles.description, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}
            numberOfLines={1}
          >
            {event.description}
          </Text>
        ) : null}

        {/* Meta */}
        <View style={styles.metaRow}>
          <View style={[styles.tagPill, { backgroundColor: tagStyle.bg }]}>
            <Text style={[styles.tagText, { color: tagStyle.text, fontFamily: 'Inter_600SemiBold' }]}>
              {event.tag}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <MaterialIcons name="place" size={11} color={theme.colors.textSecondary} />
            <Text style={[styles.metaText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              {event.location}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <MaterialIcons name="group" size={11} color={theme.colors.textSecondary} />
            <Text style={[styles.metaText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              {event.attendees}
            </Text>
          </View>

          {event.hasReminder && (
            <MaterialIcons name="notifications-none" size={13} color={theme.colors.textSecondary} />
          )}
        </View>
      </View>

      {/* Chevron */}
      <MaterialIcons name="chevron-right" size={18} color={theme.colors.border} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timeCol: {
    width: 44,
    alignItems: 'center',
  },
  startTime: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  ampm: {
    fontSize: 10,
    marginBottom: 4,
  },
  timeLine: {
    width: 1,
    height: 16,
    marginVertical: 2,
  },
  endTime: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  content: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 14,
    letterSpacing: -0.1,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
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
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaText: { fontSize: 11 },
});
