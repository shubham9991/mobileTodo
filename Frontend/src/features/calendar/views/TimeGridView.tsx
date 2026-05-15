/**
 * TimeGridView — Shared component for Day, 3-Day, and Week views.
 *
 * Features:
 *  • Point-in-time tasks (no end time) → compact pill with left accent bar
 *  • Ranged tasks (start + end time)   → full block sized by duration
 *  • Tap ANYWHERE in a day column to quick-create: resolves to nearest 30-min slot
 *  • "Now" line with pulsing dot
 *  • Half-hour tick marks for readability
 */
import React, { useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native';
import { format, parseISO } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { CalendarItem } from '../../hooks/useCalendarData';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM → 11 PM
const HOUR_HEIGHT = 72;           // px per hour
const HALF_HEIGHT = HOUR_HEIGHT / 2;
const TIME_COL_WIDTH = 52;
const POINT_TASK_HEIGHT = 28;     // compact pill height for point-in-time tasks
const MIN_BLOCK_HEIGHT = 32;      // minimum height for ranged blocks

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  const startMinutes = 6 * 60;
  return ((minutes - startMinutes) / 60) * HOUR_HEIGHT;
}

/** Round minutes to nearest 30-min boundary and return a formatted time label */
function snapToHalfHour(rawMinutesIntoHour: number, hour: number): string {
  const snapped = rawMinutesIntoHour < 30 ? 0 : 30;
  const totalH = hour;
  const period = totalH < 12 ? 'AM' : 'PM';
  const displayH = totalH === 0 ? 12 : totalH > 12 ? totalH - 12 : totalH;
  return `${displayH}:${String(snapped).padStart(2, '0')} ${period}`;
}

/** Determine if an item has a real end time (ranged) or is point-in-time */
function isRangedItem(item: CalendarItem): boolean {
  return !!(item as any).endTime;
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  days: string[];
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
    const scrollTo = Math.max(0, top - 120);
    setTimeout(() => scrollRef.current?.scrollTo({ y: scrollTo, animated: true }), 300);
  }, []);

  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nowTop = minutesToTop(nowMinutes);
  const showNowLine = nowMinutes >= 6 * 60 && nowMinutes <= 23 * 60;

  const colWidth = days.length === 1 ? undefined : days.length <= 3 ? 120 : 80;



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
            <View style={{ width: TIME_COL_WIDTH, justifyContent: 'center' }}>
              <Text style={[styles.allDayLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 11 }]}>
                All-day
              </Text>
            </View>
            {days.map(iso => {
              const dayAllDay = allDayItems.filter(i => i._col === iso);
              return (
                <View key={iso} style={[styles.dayCol, colWidth ? { width: colWidth } : { flex: 1 }, { alignItems: 'stretch', paddingHorizontal: 6, gap: 6 }]}>
                  {dayAllDay.slice(0, 3).map(item => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => onItemPress?.(item)}
                      activeOpacity={0.7}
                      style={[styles.allDayCard, { 
                        backgroundColor: theme.colors.cardPrimary || theme.colors.background,
                        borderColor: theme.colors.border,
                      }]}
                    >
                      <View style={[styles.allDayIconWrap, { backgroundColor: `${item.color}15` }]}>
                        <MaterialIcons name="event" size={12} color={item.color} />
                      </View>
                      <Text style={[styles.allDayCardText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {dayAllDay.length > 3 && (
                    <Text style={[styles.moreText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
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
          {/* Vertical divider for time column */}
          <View style={{
            position: 'absolute', left: TIME_COL_WIDTH, top: 0, bottom: 0,
            width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border,
            zIndex: 0
          }} />

          {/* Hour + half-hour labels and lines */}
          {HOURS.map(h => {
            const topH = (h - 6) * HOUR_HEIGHT;
            const topHalf = topH + HALF_HEIGHT;
            const label = h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`;
            return (
              <React.Fragment key={h}>
                {/* Full hour row */}
                <View style={[styles.hourRow, { top: topH }]}>
                  <View style={{ width: TIME_COL_WIDTH, alignItems: 'flex-end', paddingRight: 8 }}>
                    <Text style={[styles.hourLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                      {label}
                    </Text>
                  </View>
                  <View style={[styles.hourLine, { backgroundColor: theme.colors.border }]} />
                </View>

                {/* Half-hour tick */}
                <View style={[styles.halfHourRow, { top: topHalf }]}>
                  <View style={{ width: TIME_COL_WIDTH, alignItems: 'flex-end', paddingRight: 8 }}>
                    <View style={[styles.halfHourTick, { backgroundColor: theme.colors.border }]} />
                  </View>
                  <View style={[styles.halfHourLine, { backgroundColor: theme.colors.border + '60' }]} />
                </View>
              </React.Fragment>
            );
          })}

          {/* Day Columns */}
          <View style={[styles.colsRow, { height: HOURS.length * HOUR_HEIGHT }]}>
            <View style={{ width: TIME_COL_WIDTH }} />

            {days.map(iso => {
              const allItems = getItemsForDate(iso).filter(i => !i.isAllDay && i.time);
              const isToday = iso === todayISO;

              return (
                <View
                  key={iso}
                  style={[
                    styles.dayCol,
                    colWidth ? { width: colWidth } : { flex: 1 },
                    {
                      borderLeftColor: theme.colors.border,
                      borderLeftWidth: StyleSheet.hairlineWidth,
                      alignItems: 'stretch',
                    }
                  ]}
                >
                  {/* Interactive Half-Hour Slots */}
                  {HOURS.flatMap(h => {
                    const topH = (h - 6) * HOUR_HEIGHT;
                    const topHalf = topH + HALF_HEIGHT;
                    const handleSlot = (mins: number) => {
                      Haptics.selectionAsync();
                      onSlotPress?.(iso, snapToHalfHour(mins, h));
                    };
                    return [
                      <Pressable
                        key={`${h}:00`}
                        style={({ pressed }) => [
                          { position: 'absolute', top: topH, left: 0, right: 0, height: HALF_HEIGHT },
                          pressed && { backgroundColor: `${theme.colors.primary}20` }
                        ]}
                        onPress={() => handleSlot(0)}
                      />,
                      <Pressable
                        key={`${h}:30`}
                        style={({ pressed }) => [
                          { position: 'absolute', top: topHalf, left: 0, right: 0, height: HALF_HEIGHT },
                          pressed && { backgroundColor: `${theme.colors.primary}20` }
                        ]}
                        onPress={() => handleSlot(30)}
                      />
                    ];
                  })}

                  {/* Task blocks */}
                  {allItems.map(item => {
                    const startMins = timeToMinutes(item.time!);
                    if (startMins < 0) return null;
                    const top = minutesToTop(startMins);
                    const endTime = (item as any).endTime as string | undefined;
                    const endMins = endTime ? timeToMinutes(endTime) : null;
                    const durationMins = endMins ? endMins - startMins : 0;
                    const isRanged = durationMins > 0;
                    const blockHeight = isRanged
                      ? Math.max(MIN_BLOCK_HEIGHT, (durationMins / 60) * HOUR_HEIGHT - 4)
                      : POINT_TASK_HEIGHT;

                    if (isRanged) {
                      // Full ranged block
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={(e) => { e.stopPropagation(); onItemPress?.(item); }}
                          style={[
                            styles.rangedBlock,
                            {
                              top,
                              height: blockHeight,
                              backgroundColor: `${item.color}22`,
                            }
                          ]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.blockTitle, { color: item.color, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={2}>
                            {item.title}
                          </Text>
                          {blockHeight > 40 && (
                            <Text style={[styles.blockTime, { color: `${item.color}BB`, fontFamily: 'Inter_400Regular' }]}>
                              {item.time} – {endTime}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    } else {
                      // Point-in-time pill
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={(e) => { e.stopPropagation(); onItemPress?.(item); }}
                          style={[
                            styles.pointPill,
                            {
                              top,
                              backgroundColor: theme.colors.cardPrimary || theme.colors.background,
                              borderColor: theme.colors.border,
                            }
                          ]}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.pointDot, { backgroundColor: item.color }]} />
                          <Text style={[styles.pointTitle, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={[styles.pointTime, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                            {item.time}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
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

          {/* Floating "tap to add" hint at bottom if Day view */}
          {days.length === 1 && (
            <View style={[styles.tapHint, { bottom: 12, left: TIME_COL_WIDTH + 8 }]} pointerEvents="none">
              <MaterialIcons name="touch-app" size={13} color={theme.colors.textSecondary} />
              <Text style={[styles.tapHintText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Tap to add
              </Text>
            </View>
          )}
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

  // All-day
  allDaySection: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  allDayLabel: { fontSize: 10, textAlign: 'right', paddingRight: 8, opacity: 0.8 },
  allDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 0,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  allDayIconWrap: {
    width: 20, height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allDayCardText: { fontSize: 11, flex: 1, letterSpacing: -0.1 },
  moreText: { fontSize: 10, marginTop: 4, textAlign: 'center' },

  // Grid
  gridContainer: { position: 'relative' },
  hourRow: {
    position: 'absolute',
    left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: HOUR_HEIGHT,
  },
  hourLabel: { fontSize: 10, opacity: 0.7 },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth },
  halfHourRow: {
    position: 'absolute',
    left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 1,
  },
  halfHourTick: { width: 6, height: StyleSheet.hairlineWidth, alignSelf: 'center' },
  halfHourLine: { flex: 1, height: StyleSheet.hairlineWidth },

  colsRow: {
    position: 'absolute',
    left: 0, right: 0, top: 0,
    flexDirection: 'row',
  },

  // Ranged task block
  rangedBlock: {
    position: 'absolute',
    left: 4, right: 4,
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  blockTitle: { fontSize: 12, letterSpacing: -0.1 },
  blockTime: { fontSize: 10, marginTop: 2, opacity: 0.9 },

  // Point-in-time pill
  pointPill: {
    position: 'absolute',
    left: 4, right: 4,
    height: 32,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pointDot: {
    width: 8, height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  pointTitle: { fontSize: 12, flex: 1, letterSpacing: -0.1 },
  pointTime: { fontSize: 10, flexShrink: 0, opacity: 0.8 },

  // Now line
  nowLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  nowDot: {
    width: 10, height: 10,
    borderRadius: 5,
    left: -5,
  },

  // Tap hint
  tapHint: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    opacity: 0.6,
  },
  tapHintText: { fontSize: 11, letterSpacing: 0.2 },
});
