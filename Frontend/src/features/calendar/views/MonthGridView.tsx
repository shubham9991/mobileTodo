/**
 * MonthGridView — Full-screen month calendar with dynamic chip fitting.
 * Calculates how many task chips each cell can show based on available height.
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, LayoutChangeEvent,
} from 'react-native';
import {
  format, parseISO, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
} from 'date-fns';
import { useTheme } from '../../../themes/ThemeContext';
import { CalendarItem } from '../../hooks/useCalendarData';

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CHIP_HEIGHT  = 15; // height of one chip row (font 8 + paddingVertical 2*2 + gap 2)
const DAY_NUM_H    = 30; // day number bubble + top margin
const CELL_PADDING = 6;  // bottom padding of cell

interface Props {
  monthISO: string;
  selectedISO: string;
  onSelectDate: (iso: string) => void;
  onOverflowPress?: (iso: string) => void;
  getItemsForDate: (iso: string) => CalendarItem[];
  onItemPress?: (item: CalendarItem) => void;
}

export const MonthGridView: React.FC<Props> = ({
  monthISO, selectedISO, onSelectDate, onOverflowPress,
  getItemsForDate, onItemPress,
}) => {
  const { theme } = useTheme();
  const todayISO    = format(new Date(), 'yyyy-MM-dd');
  const monthDate   = parseISO(monthISO);

  // Measure actual grid body height
  const [gridHeight, setGridHeight] = useState(0);
  const onGridLayout = useCallback((e: LayoutChangeEvent) => {
    setGridHeight(e.nativeEvent.layout.height);
  }, []);

  const gridDays = useMemo(() => {
    const mStart    = startOfMonth(monthDate);
    const mEnd      = endOfMonth(monthDate);
    const gridStart = startOfWeek(mStart, { weekStartsOn: 0 });
    const gridEnd   = endOfWeek(mEnd,   { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [monthISO]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < gridDays.length; i += 7) result.push(gridDays.slice(i, i + 7));
    return result;
  }, [gridDays]);

  // Dynamic max chips: how many fit in each cell's available space
  const maxChips = useMemo(() => {
    if (!gridHeight || !weeks.length) return 2;
    const rowH     = gridHeight / weeks.length;
    const available = rowH - DAY_NUM_H - CELL_PADDING;
    return Math.max(1, Math.floor(available / CHIP_HEIGHT));
  }, [gridHeight, weeks.length]);

  return (
    <View style={{ flex: 1 }}>
      {/* Day-of-week header */}
      <View style={[styles.weekHeader, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
        {DAYS_OF_WEEK.map((d, i) => (
          <View key={i} style={styles.dayHeaderCell}>
            <Text style={[styles.dayHeaderText, {
              color: (i === 0 || i === 6) ? theme.colors.primary + 'AA' : theme.colors.textSecondary,
              fontFamily: 'Inter_600SemiBold',
            }]}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid body — measured for dynamic chip count */}
      <View style={{ flex: 1 }} onLayout={onGridLayout}>
        {weeks.map((week, wi) => (
          <View key={wi} style={[styles.week, { borderTopColor: theme.colors.border }]}>
            {week.map(day => {
              const iso            = format(day, 'yyyy-MM-dd');
              const isCurrentMonth = isSameMonth(day, monthDate);
              const isToday        = iso === todayISO;
              const isSelected     = iso === selectedISO;
              const isWeekend      = day.getDay() === 0 || day.getDay() === 6;

              // De-duplicate: one chip per unique task per day
              const rawItems = getItemsForDate(iso);
              const seen     = new Set<string>();
              const unique: CalendarItem[] = [];
              rawItems.forEach(item => {
                const key = item.taskId ?? item.title;
                if (!seen.has(key)) { seen.add(key); unique.push(item); }
              });

              const visibleChips = unique.slice(0, maxChips);
              const overflow     = unique.length - maxChips;

              return (
                <TouchableOpacity
                  key={iso}
                  style={[
                    styles.dayCell,
                    isWeekend && !isCurrentMonth && { backgroundColor: theme.colors.background },
                    isWeekend && isCurrentMonth && { backgroundColor: `${theme.colors.border}30` },
                  ]}
                  onPress={() => onSelectDate(iso)}
                  activeOpacity={0.7}
                >
                  {/* Day number */}
                  <View style={styles.dayNumRow}>
                    <View style={[
                      styles.dayNumBubble,
                      isToday     && !isSelected && { borderWidth: 1.5, borderColor: theme.colors.primary },
                      isSelected  && { backgroundColor: theme.colors.primary },
                    ]}>
                      <Text style={[styles.dayNum, {
                        color: !isCurrentMonth
                          ? theme.colors.textSecondary + '50'
                          : isSelected ? '#FFF'
                          : isToday   ? theme.colors.primary
                          : isWeekend ? theme.colors.primary + 'CC'
                          : theme.colors.text,
                        fontFamily: isToday || isSelected ? 'Inter_700Bold' : 'Inter_400Regular',
                      }]}>
                        {format(day, 'd')}
                      </Text>
                    </View>
                  </View>

                  {/* Task chips */}
                  <View style={styles.chipsContainer}>
                    {visibleChips.map((item, i) => {
                      const emoji = item.type === 'birthday' ? '🎂 ' : item.type === 'holiday' ? '🎌 ' : '';
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => onItemPress?.(item)}
                          activeOpacity={0.75}
                          style={[styles.chip, {
                            backgroundColor: item.completed ? `${item.color}50` : `${item.color}D0`,
                          }]}
                        >
                          <Text style={styles.chipText} numberOfLines={1}>
                            {emoji}{item.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    {overflow > 0 && (
                      <TouchableOpacity
                        onPress={() => onOverflowPress?.(iso)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Text style={[styles.overflowText, { color: theme.colors.primary }]}>
                          +{overflow} more
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  weekHeader: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: { fontSize: 11 },
  week: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    flex: 1,
  },
  dayCell: {
    flex: 1,
    paddingBottom: 4,
    paddingHorizontal: 1,
    overflow: 'hidden',
  },
  dayNumRow: {
    alignItems: 'flex-start',
    paddingLeft: 3,
    paddingTop: 3,
    marginBottom: 2,
  },
  dayNumBubble: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  dayNum: { fontSize: 11 },
  chipsContainer: { gap: 2, paddingHorizontal: 2 },
  chip: {
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  chipText: {
    color: '#FFF',
    fontSize: 8,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 11,
  },
  overflowText: {
    fontSize: 8,
    fontFamily: 'Inter_600SemiBold',
    paddingHorizontal: 2,
    marginTop: 1,
  },
});
