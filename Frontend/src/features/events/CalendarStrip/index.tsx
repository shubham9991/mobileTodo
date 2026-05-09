import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';
import { useManage } from '../../../core/ManageContext';
import { dummyData } from '../../../core/dummyData';
import { format, parseISO, eachDayOfInterval, isValid } from 'date-fns';

interface Props {
  activeDate: string | null; // ISO string 'YYYY-MM-DD', null = nothing selected
  onSelectDate: (isoDate: string) => void;
}

// Utility: try to parse a date string (ISO first, then human-readable)
function tryParseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // ISO: 2026-03-25
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = parseISO(dateStr);
    return isValid(d) ? d : null;
  }
  // "Fri, Mar 28" → try appending current year
  const yearAttempt = new Date(`${dateStr}, 2026`);
  if (isValid(yearAttempt)) return yearAttempt;
  return null;
}

export const CalendarStrip = ({ activeDate, onSelectDate }: Props) => {
  const { theme } = useTheme();
  const { tags, calendarMarkings } = useManage();

  // Default to today
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const currentISO = activeDate ?? todayISO;

  // Build a lookup: tagId → color (only visible ones)
  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    tags.forEach(t => {
      const setting = calendarMarkings.find(m => m.tagId === t.id);
      if (!setting || setting.visible) {
        map[t.id] = t.color;
      }
    });
    return map;
  }, [tags, calendarMarkings]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    // ── 1. Multi-Period Marking from period tasks ──────────────────────────────
    const allTasks = dummyData.taskGroups.flatMap(g => g.tasks);
    allTasks.forEach(task => {
      if (!task.dueDate || !task.dueEndDate) return;
      const start = tryParseDate(task.dueDate);
      const end = tryParseDate(task.dueEndDate);
      if (!start || !end || end < start) return;

      // Get the tag color for this task
      const tagId = task.tagType ?? 'work';
      const setting = calendarMarkings.find(m => m.tagId === tagId);
      if (setting && !setting.visible) return; // hidden by user

      const color = tagColorMap[tagId] ?? theme.colors.primary;

      // Expand every day in the interval
      const days = eachDayOfInterval({ start, end });
      days.forEach((day, idx) => {
        const iso = format(day, 'yyyy-MM-dd');
        if (!marks[iso]) marks[iso] = { periods: [] };
        if (!marks[iso].periods) marks[iso].periods = [];

        marks[iso].periods.push({
          startingDay: idx === 0,
          endingDay: idx === days.length - 1,
          color,
        });
      });
    });

    // ── 2. Multi-Dot Marking from events (single-day events) ─────────────────
    Object.entries(dummyData.eventsData.eventsByDate).forEach(([dayStr, events]) => {
      const dayNum = parseInt(dayStr, 10);
      const iso = `2026-03-${String(dayNum).padStart(2, '0')}`;
      const evtList = events as any[];
      if (!evtList.length) return;

      // Up to 3 dots to avoid overcrowding
      const dots = evtList.slice(0, 3).map((e: any) => {
        const tagSetting = calendarMarkings.find(m => m.tagId === e.tagType);
        const visible = !tagSetting || tagSetting.visible;
        return visible ? { key: e.id, color: e.color ?? theme.colors.primary } : null;
      }).filter(Boolean);

      if (dots.length === 0) return;

      if (!marks[iso]) marks[iso] = {};
      // For days that already have period marks, we can't mix markingTypes.
      // We use periods if present, otherwise dots.
      if (!marks[iso].periods) {
        marks[iso].dots = dots;
      }
    });

    // ── 3. Active selected day ────────────────────────────────────────────────
    if (!marks[currentISO]) marks[currentISO] = {};
    marks[currentISO].selected = true;
    marks[currentISO].selectedColor = theme.colors.primary;

    // ── 4. Today highlight (if not selected) ─────────────────────────────────
    if (todayISO !== currentISO) {
      if (!marks[todayISO]) marks[todayISO] = {};
      marks[todayISO].marked = true;
      marks[todayISO].dotColor = theme.colors.primary;
    }

    return marks;
  }, [currentISO, todayISO, tagColorMap, calendarMarkings, theme.colors.primary]);

  // Determine markingType: use 'multi-period' if any day has period data, else 'multi-dot'
  const hasAnyPeriod = useMemo(
    () => Object.values(markedDates).some((m: any) => m.periods?.length > 0),
    [markedDates]
  );

  return (
    <View style={[styles.container, {
      backgroundColor: theme.colors.background,
      borderBottomColor: theme.colors.border,
    }]}>
      <Calendar
        current={currentISO}
        onDayPress={(day: DateData) => onSelectDate(day.dateString)}
        markingType={hasAnyPeriod ? 'multi-period' : 'multi-dot'}
        markedDates={markedDates}
        enableSwipeMonths={false}
        theme={{
          backgroundColor: theme.colors.background,
          calendarBackground: theme.colors.background,
          textSectionTitleColor: theme.colors.textSecondary,
          selectedDayBackgroundColor: theme.colors.primary,
          selectedDayTextColor: '#ffffff',
          todayTextColor: theme.colors.primary,
          dayTextColor: theme.colors.text,
          textDisabledColor: theme.colors.textSecondary + '40',
          dotColor: theme.colors.primary,
          selectedDotColor: '#ffffff',
          arrowColor: theme.colors.textSecondary,
          disabledArrowColor: theme.colors.border,
          monthTextColor: theme.colors.text,
          indicatorColor: theme.colors.primary,
          textDayFontFamily: 'Inter_500Medium',
          textMonthFontFamily: 'Inter_600SemiBold',
          textDayHeaderFontFamily: 'Inter_500Medium',
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
        }}
        renderArrow={(direction: 'left' | 'right') => (
          <MaterialIcons
            name={direction === 'left' ? 'chevron-left' : 'chevron-right'}
            size={24}
            color={theme.colors.textSecondary}
          />
        )}
      />

      {/* Legend row */}
      <View style={styles.legend}>
        {Object.entries(tagColorMap).slice(0, 5).map(([tagId, color]) => {
          const tag = dummyData.taskGroups
            .flatMap(g => g.tasks)
            .find(t => t.tagType === tagId);
          const label = tagId.charAt(0).toUpperCase() + tagId.slice(1);
          return (
            <View key={tagId} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={[styles.legendLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
  },
});
