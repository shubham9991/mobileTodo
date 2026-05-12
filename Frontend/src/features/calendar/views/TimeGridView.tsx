/**
 * TimeGridView — Shared component for Day, 3-Day, and Week views.
 * Renders a vertical hourly grid with a "Now" line and positioned task blocks.
 */
import React, { useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { useTheme } from '../../../themes/ThemeContext';
import { CalendarItem } from '../../hooks/useCalendarData';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM
const HOUR_HEIGHT = 64;
const TIME_COL_WIDTH = 52;

function timeToMinutes(time: string): number {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return -1;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function minutesToTop(minutes: number): number {
  const startMinutes = 6 * 60; // starts at 6 AM
  return ((minutes - startMinutes) / 60) * HOUR_HEIGHT;
}

interface Props {
  days: string[]; // ISO dates to show
  getItemsForDate: (iso: string) => CalendarItem[];
  onItemPress?: (item: CalendarItem) => void;
  onSlotPress?: (iso: string, time: string) => void;
}

export const TimeGridView: React.FC<Props> = ({
  days, getItemsForDate, onItemPress, onSlotPress,
}) => {
  const { theme } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  // Scroll to current time on mount
  useEffect(() => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const top = minutesToTop(minutes);
    const scrollTo = Math.max(0, top - 80);
    setTimeout(() => scrollRef.current?.scrollTo({ y: scrollTo, animated: true }), 300);
  }, []);

  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nowTop = minutesToTop(nowMinutes);
  const showNowLine = nowMinutes >= 6 * 60 && nowMinutes <= 23 * 60;

  const colWidth = days.length === 1
    ? undefined // flex:1
    : days.length <= 3 ? 120 : 80;

  return (
    <View style={styles.root}>
      {/* Column Headers */}
      <View style={[styles.headerRow, { borderBottomColor: theme.colors.border }]}>
        <View style={{ width: TIME_COL_WIDTH }} />
        {days.map(iso => {
          const isToday = iso === todayISO;
          const d = parseISO(iso);
          return (
            <View key={iso} style={[styles.dayCol, colWidth ? { width: colWidth } : { flex: 1 }]}>
              <Text style={[
                styles.headerDayName,
                { color: isToday ? theme.colors.primary : theme.colors.textSecondary },
                { fontFamily: 'Inter_500Medium' }
              ]}>
                {format(d, 'EEE').toUpperCase()}
              </Text>
              <View style={[
                styles.headerDayNum,
                isToday && { backgroundColor: theme.colors.primary }
              ]}>
                <Text style={[
                  styles.headerDayNumText,
                  { color: isToday ? '#FFF' : theme.colors.text },
                  { fontFamily: 'Inter_700Bold' }
                ]}>
                  {format(d, 'd')}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* All-Day Section */}
      {(() => {
        const allDayItems = days.flatMap(iso =>
          getItemsForDate(iso).filter(i => i.isAllDay).map(i => ({ ...i, _col: iso }))
        );
        if (allDayItems.length === 0) return null;
        return (
          <View style={[styles.allDaySection, { borderBottomColor: theme.colors.border }]}>
            <View style={{ width: TIME_COL_WIDTH }}>
              <Text style={[styles.allDayLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                All-day
              </Text>
            </View>
            {days.map(iso => {
              const dayAllDay = allDayItems.filter(i => i._col === iso);
              return (
                <View key={iso} style={[styles.dayCol, colWidth ? { width: colWidth } : { flex: 1 }]}>
                  {dayAllDay.slice(0, 3).map(item => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => onItemPress?.(item)}
                      style={[styles.allDayChip, { backgroundColor: item.color }]}
                    >
                      <Text style={styles.allDayChipText} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {dayAllDay.length > 3 && (
                    <Text style={[styles.moreText, { color: theme.colors.textSecondary }]}>
                      +{dayAllDay.length - 3} more
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        );
      })()}

      {/* Scrollable Time Grid */}
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View style={[styles.gridContainer, { height: HOURS.length * HOUR_HEIGHT }]}>
          {/* Hour Labels + Lines */}
          {HOURS.map(h => {
            const top = (h - 6) * HOUR_HEIGHT;
            const label = h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`;
            return (
              <View key={h} style={[styles.hourRow, { top }]}>
                <View style={{ width: TIME_COL_WIDTH, alignItems: 'flex-end', paddingRight: 8 }}>
                  <Text style={[styles.hourLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {label}
                  </Text>
                </View>
                <View style={[styles.hourLine, { backgroundColor: theme.colors.border, flex: 1 }]} />
              </View>
            );
          })}

          {/* Day Columns */}
          <View style={[styles.colsRow, { height: HOURS.length * HOUR_HEIGHT }]}>
            <View style={{ width: TIME_COL_WIDTH }} />
            {days.map(iso => {
              const timedItems = getItemsForDate(iso).filter(i => !i.isAllDay && i.time);
              const isToday = iso === todayISO;
              return (
                <View
                  key={iso}
                  style={[
                    styles.dayCol,
                    colWidth ? { width: colWidth } : { flex: 1 },
                    { borderLeftColor: theme.colors.border, borderLeftWidth: StyleSheet.hairlineWidth }
                  ]}
                >
                  {/* Tap zones */}
                  {HOURS.map(h => (
                    <TouchableOpacity
                      key={h}
                      style={{ height: HOUR_HEIGHT }}
                      onPress={() => {
                        const label = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
                        onSlotPress?.(iso, label);
                      }}
                      activeOpacity={0.3}
                    />
                  ))}

                  {/* Task blocks */}
                  {timedItems.map(item => {
                    const mins = timeToMinutes(item.time!);
                    if (mins < 0) return null;
                    const top = minutesToTop(mins);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => onItemPress?.(item)}
                        style={[
                          styles.taskBlock,
                          {
                            top,
                            backgroundColor: `${item.color}CC`,
                            height: HOUR_HEIGHT - 4,
                            left: 2,
                            right: 2,
                          }
                        ]}
                      >
                        <Text style={[styles.taskBlockTitle, { fontFamily: 'Inter_600SemiBold' }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={[styles.taskBlockTime, { fontFamily: 'Inter_400Regular' }]}>
                          {item.time}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Now line */}
                  {isToday && showNowLine && (
                    <View style={[styles.nowLine, { top: nowTop, backgroundColor: theme.colors.primary }]}>
                      <View style={[styles.nowDot, { backgroundColor: theme.colors.primary }]} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayCol: { alignItems: 'center', paddingHorizontal: 2 },
  headerDayName: { fontSize: 10, letterSpacing: 0.5 },
  headerDayNum: {
    width: 28, height: 28,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  headerDayNumText: { fontSize: 14 },
  allDaySection: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 32,
  },
  allDayLabel: { fontSize: 10, textAlign: 'right', paddingRight: 8, paddingTop: 4 },
  allDayChip: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 2,
  },
  allDayChipText: { color: '#FFF', fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  moreText: { fontSize: 10, marginTop: 2 },
  gridContainer: { position: 'relative' },
  hourRow: {
    position: 'absolute',
    left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: HOUR_HEIGHT,
  },
  hourLabel: { fontSize: 10 },
  hourLine: { height: StyleSheet.hairlineWidth },
  colsRow: {
    position: 'absolute',
    left: 0, right: 0, top: 0,
    flexDirection: 'row',
  },
  taskBlock: {
    position: 'absolute',
    borderRadius: 4,
    padding: 4,
    overflow: 'hidden',
  },
  taskBlockTitle: { color: '#FFF', fontSize: 11 },
  taskBlockTime: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },
  nowLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowDot: {
    width: 8, height: 8,
    borderRadius: 4,
    left: -4,
  },
});
