/**
 * MasterCalendarScreen — Unified Hub for all calendar views.
 * Schedule / Day / 3-Day / Week / Month with full interactions.
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import {
  format, addDays, addWeeks, addMonths,
  subDays, subWeeks, subMonths,
  startOfWeek, endOfWeek, startOfMonth, parseISO, isValid, addHours
} from 'date-fns';
import { useTheme } from '../../themes/ThemeContext';
import { TopNavbar } from '../../layout/TopNavbar';
import { BottomNavbar } from '../../layout/BottomNavbar';
import { FABMenu } from '../../core/components/FABMenu';
import { useFabBottom } from '../../core/hooks/useFabBottom';
import { useCalendarData, CalendarItem } from '../../core/hooks/useCalendarData';
import { ScheduleView } from './views/ScheduleView';
import * as Haptics from 'expo-haptics';
import CalendarKit from '@howljs/calendar-kit';
import type { EventItem as TimelineEvent } from '@howljs/calendar-kit';
import { MonthGridView } from './views/MonthGridView';
import { TaskComposer } from '../../core/components/TaskComposer';
import { useDashboard } from '../../core/DashboardContext';
import TaskDetailModal from '../tasks/TaskDetailModal';

// ─── View Modes ───────────────────────────────────────────────────────────────
type ViewMode = 'schedule' | 'day' | '3day' | 'week' | 'month';

const VIEW_MODES: { id: ViewMode; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'schedule', label: 'Schedule', icon: 'view-agenda' },
  { id: 'day', label: 'Day', icon: 'view-day' },
  { id: '3day', label: '3 Days', icon: 'view-column' },
  { id: 'week', label: 'Week', icon: 'view-week' },
  { id: 'month', label: 'Month', icon: 'grid-view' },
];

// ─── Compute date range ────────────────────────────────────────────────────────
function getRange(anchor: string, mode: ViewMode): { start: string; end: string; days: string[] } {
  const today = parseISO(anchor); // use parseISO to treat as LOCAL date, not UTC midnight
  let start: Date, end: Date;

  switch (mode) {
    case 'day': start = today; end = today; break;
    case '3day': start = today; end = addDays(today, 2); break;
    case 'week':
      start = startOfWeek(today, { weekStartsOn: 0 });
      end = endOfWeek(today, { weekStartsOn: 0 }); break;
    case 'month':
      start = startOfMonth(today);
      end = addDays(addMonths(startOfMonth(today), 1), -1); break;
    default:
      start = today; end = addDays(today, 29); break;
  }

  const startISO = format(start, 'yyyy-MM-dd');
  const endISO = format(end, 'yyyy-MM-dd');
  const days: string[] = [];
  let cur = start;
  while (cur <= end) {
    days.push(format(cur, 'yyyy-MM-dd'));
    cur = addDays(cur, 1);
  }
  return { start: startISO, end: endISO, days };
}

// ─── Navigate ─────────────────────────────────────────────────────────────────
function navigate(anchor: string, mode: ViewMode, dir: 1 | -1): string {
  const d = parseISO(anchor); // use parseISO to treat as LOCAL date, not UTC midnight
  switch (mode) {
    case 'day': return format(dir === 1 ? addDays(d, 1) : subDays(d, 1), 'yyyy-MM-dd');
    case '3day': return format(dir === 1 ? addDays(d, 3) : subDays(d, 3), 'yyyy-MM-dd');
    case 'week': return format(dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1), 'yyyy-MM-dd');
    case 'month': return format(dir === 1 ? addMonths(d, 1) : subMonths(d, 1), 'yyyy-MM-dd');
    default: return format(dir === 1 ? addDays(d, 7) : subDays(d, 7), 'yyyy-MM-dd');
  }
}

// ─── Header Title ─────────────────────────────────────────────────────────────
function getHeaderTitle(anchor: string, mode: ViewMode): string {
  const d = parseISO(anchor); // use parseISO to treat as LOCAL date, not UTC midnight
  switch (mode) {
    case 'month': return format(d, 'MMMM yyyy');
    case 'week': {
      const s = startOfWeek(d, { weekStartsOn: 0 });
      const e = endOfWeek(d, { weekStartsOn: 0 });
      return `${format(s, 'MMM d')} – ${format(e, 'MMM d')}`;
    }
    case '3day': return `${format(d, 'MMM d')} – ${format(addDays(d, 2), 'MMM d')}`;
    case 'day': return format(d, 'EEE, MMMM d');
    default: return format(d, 'MMMM yyyy');
  }
}

// ─── Item Detail Sheet ────────────────────────────────────────────────────────
const ItemDetailSheet: React.FC<{
  item: CalendarItem | null;
  onClose: () => void;
  onToggleComplete?: (taskId: string) => void;
}> = ({ item, onClose, onToggleComplete }) => {
  const { theme } = useTheme();
  if (!item) return null;

  const typeIcon =
    item.type === 'birthday' ? '🎂' :
      item.type === 'holiday' ? '🎌' :
        item.completed ? '✅' : '⬜';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheet.overlay} onPress={onClose}>
        <Pressable
          style={[sheet.panel, { backgroundColor: theme.colors.cardPrimary }]}
          onPress={() => { }}
        >
          {/* Handle */}
          <View style={[sheet.handle, { backgroundColor: theme.colors.border }]} />

          {/* Color accent bar */}
          <View style={[sheet.accentBar, { backgroundColor: item.color }]} />

          {/* Title */}
          <View style={sheet.titleRow}>
            <Text style={sheet.typeEmoji}>{typeIcon}</Text>
            <Text style={[sheet.titleText, {
              color: theme.colors.text,
              fontFamily: 'Inter_700Bold',
              textDecorationLine: item.completed ? 'line-through' : 'none',
              opacity: item.completed ? 0.6 : 1,
            }]}>
              {item.title}
            </Text>
          </View>

          {/* Meta rows */}
          <View style={sheet.metaList}>
            {/* Date */}
            <View style={sheet.metaRow}>
              <MaterialIcons name="calendar-today" size={16} color={item.color} />
              <Text style={[sheet.metaText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                {item.endDate && item.endDate !== item.startDate
                  ? `${format(new Date(item.startDate), 'MMM d')} – ${format(new Date(item.endDate), 'MMM d, yyyy')}`
                  : format(new Date(item.startDate), 'EEEE, MMMM d, yyyy')
                }
              </Text>
            </View>

            {/* Time */}
            {item.time && (
              <View style={sheet.metaRow}>
                <MaterialIcons name="schedule" size={16} color={item.color} />
                <Text style={[sheet.metaText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  {item.time}
                </Text>
              </View>
            )}
            {item.isAllDay && !item.time && (
              <View style={sheet.metaRow}>
                <MaterialIcons name="wb-sunny" size={16} color={item.color} />
                <Text style={[sheet.metaText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  All day
                </Text>
              </View>
            )}

            {/* Tag */}
            {item.tag && (
              <View style={sheet.metaRow}>
                <MaterialIcons name="label" size={16} color={item.color} />
                <View style={[sheet.tagBadge, { backgroundColor: `${item.color}20`, borderColor: `${item.color}50` }]}>
                  <Text style={[{ color: item.color, fontSize: 12, fontFamily: 'Inter_600SemiBold' }]}>
                    {item.tag}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Actions */}
          {item.type === 'task' && item.taskId && onToggleComplete && (
            <TouchableOpacity
              onPress={() => { onToggleComplete(item.taskId!); onClose(); }}
              style={[sheet.actionBtn, {
                backgroundColor: item.completed ? `${theme.colors.primary}15` : theme.colors.primary,
              }]}
            >
              <MaterialIcons
                name={item.completed ? 'replay' : 'check'}
                size={18}
                color={item.completed ? theme.colors.primary : '#FFF'}
              />
              <Text style={[sheet.actionBtnText, {
                color: item.completed ? theme.colors.primary : '#FFF',
                fontFamily: 'Inter_600SemiBold',
              }]}>
                {item.completed ? 'Mark Incomplete' : 'Mark Complete'}
              </Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const sheet = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  panel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    overflow: 'hidden',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  accentBar: {
    height: 3, borderRadius: 2,
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
  },
  typeEmoji: { fontSize: 24 },
  titleText: { fontSize: 20, flex: 1, letterSpacing: -0.4 },
  metaList: { gap: 14, marginBottom: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText: { fontSize: 14, flex: 1 },
  tagBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnText: { fontSize: 15 },
});

// ─── Day Items Bottom Sheet (for "+N more" taps in Month view) ────────────────
const DayItemsSheet: React.FC<{
  iso: string | null;
  items: CalendarItem[];
  onClose: () => void;
  onItemPress: (item: CalendarItem) => void;
}> = ({ iso, items, onClose, onItemPress }) => {
  const { theme } = useTheme();
  if (!iso) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheet.overlay} onPress={onClose}>
        <Pressable
          style={[sheet.panel, { backgroundColor: theme.colors.cardPrimary }]}
          onPress={() => { }}
        >
          <View style={[sheet.handle, { backgroundColor: theme.colors.border }]} />
          <Text style={[{
            fontSize: 17, fontFamily: 'Inter_700Bold',
            color: theme.colors.text, marginBottom: 16,
          }]}>
            {format(new Date(iso), 'EEEE, MMMM d')}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {items.map(item => (
              <TouchableOpacity
                key={item.id}
                onPress={() => { onClose(); onItemPress(item); }}
                style={[daySheet.itemRow, {
                  backgroundColor: `${item.color}15`,
                  borderLeftColor: item.color,
                }]}
              >
                <MaterialIcons
                  name={
                    item.type === 'birthday' ? 'cake' :
                      item.type === 'holiday' ? 'flag' :
                        item.completed ? 'check-circle' : 'radio-button-unchecked'
                  }
                  size={16} color={item.color}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[daySheet.itemTitle, {
                    color: theme.colors.text,
                    fontFamily: 'Inter_600SemiBold',
                    textDecorationLine: item.completed ? 'line-through' : 'none',
                    opacity: item.completed ? 0.6 : 1,
                  }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.time && (
                    <Text style={[daySheet.itemTime, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                      {item.time}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const daySheet = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    marginBottom: 8,
  },
  itemTitle: { fontSize: 14 },
  itemTime: { fontSize: 12, marginTop: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const MasterCalendarScreen: React.FC = () => {
  const { theme } = useTheme();
  const fabBottom = useFabBottom();
  const { handleComposerSave, updateTask } = useDashboard();

  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const [viewMode, setViewMode] = useState<ViewMode>('schedule');
  const [anchor, setAnchor] = useState(todayISO);
  const [showViewPicker, setShowViewPicker] = useState(false);
  const [selectedISO, setSelectedISO] = useState(todayISO);
  const calendarRef = useRef<any>(null);
  // Tracks a date we programmatically navigated to.
  // All onDateChanged callbacks are ignored until CalendarKit confirms
  // this exact date — this handles CalendarKit's native-side late init
  // which fires onDateChanged(today) 1-2 seconds after mount.
  const pendingNavDate = useRef<string | null>(null);
  const pendingNavTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Read ?date= param from Expo Router (set by EventsScreen / other tabs) ──
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  useEffect(() => {
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return;
    setAnchor(dateParam);
    setSelectedISO(dateParam);
    // Block onDateChanged until CalendarKit confirms this date
    if (pendingNavTimeout.current) clearTimeout(pendingNavTimeout.current);
    pendingNavDate.current = dateParam;
    setViewMode('day');
    setTimeout(() => {
      calendarRef.current?.goToDate({ date: dateParam, animated: false });
    }, 100);
    // Safety: release after 5 s if CalendarKit never confirms
    pendingNavTimeout.current = setTimeout(() => {
      pendingNavDate.current = null;
    }, 5000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam]);

  // Detail sheet state
  const [detailItem, setDetailItem] = useState<CalendarItem | null>(null);
  // Task detail state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Day overflow sheet state
  const [overflowDay, setOverflowDay] = useState<string | null>(null);

  const [composerVisible, setComposerVisible] = useState(false);
  const [composerDate, setComposerDate] = useState('');
  const [composerTime, setComposerTime] = useState('');
  const [composerEndTime, setComposerEndTime] = useState('');
  const [feedbackEvent, setFeedbackEvent] = useState<any | null>(null);

  // Expand data fetching window for smooth timeline swiping.
  // NOTE: viewMode is intentionally NOT in the deps — only anchor determines the window.
  // Including viewMode caused a full 120-day data recomputation on every view switch.
  const { start, end } = useMemo(() => {
    const d = parseISO(anchor);
    return {
      start: format(subDays(d, 60), 'yyyy-MM-dd'),
      end: format(addDays(d, 60), 'yyyy-MM-dd'),
    };
  }, [anchor]);

  const { getItemsForDate, allItems } = useCalendarData(start, end);

  const timelineEvents: TimelineEvent[] = useMemo(() => {
    const events: TimelineEvent[] = [];
    allItems.forEach(item => {
      // Skip duplicate range occurrences (CalendarKit handles spanning natively)
      if (item.isRangeMid || item.isRangeEnd) return;

      // Helper: parse "h:mm AM/PM" or "HH:mm" → 24h parts
      const parseTime12 = (t: string): { h: number; min: number } | null => {
        const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (m) {
          let h = parseInt(m[1], 10);
          const min = parseInt(m[2], 10);
          const period = m[3].toUpperCase();
          if (period === 'PM' && h !== 12) h += 12;
          if (period === 'AM' && h === 12) h = 0;
          return { h, min };
        }
        // Try 24h "HH:mm"
        const m2 = t.match(/(\d{1,2}):(\d{2})/);
        if (m2) return { h: parseInt(m2[1], 10), min: parseInt(m2[2], 10) };
        return null;
      };

      const getISOWithTime = (dateISO: string, timeStr?: string, defaultTime: string = '00:00:00'): string => {
        if (!timeStr) return `${dateISO}T${defaultTime}`;
        const parsed = parseTime12(timeStr);
        if (!parsed) return `${dateISO}T${defaultTime}`;
        const hh = parsed.h.toString().padStart(2, '0');
        const mm = parsed.min.toString().padStart(2, '0');
        return `${dateISO}T${hh}:${mm}:00`;
      };

      const dateStartISO = item.startDate || item.date;
      const dateEndISO = item.endDate || dateStartISO;

      let startDateTime: string;
      let endDateTime: string;

      if (item.time) {
        // Timed task or event
        startDateTime = getISOWithTime(dateStartISO, item.time, '00:00:00');
        if (item.dueEndTime) {
          endDateTime = getISOWithTime(dateEndISO, item.dueEndTime, '23:59:00');
        } else {
          // If no end time, default to start time + 1 hour on the end date
          const parsedStart = parseISO(startDateTime);
          if (isValid(parsedStart)) {
            if (item.endDate && item.endDate !== dateStartISO) {
              const parsedEnd = parseISO(`${dateEndISO}T${startDateTime.split('T')[1]}`);
              endDateTime = isValid(parsedEnd)
                ? format(addHours(parsedEnd, 1), "yyyy-MM-dd'T'HH:mm:ss")
                : `${dateEndISO}T23:59:00`;
            } else {
              endDateTime = format(addHours(parsedStart, 1), "yyyy-MM-dd'T'HH:mm:ss");
            }
          } else {
            endDateTime = `${dateEndISO}T23:59:00`;
          }
        }
      } else {
        // All-day task or event
        startDateTime = `${dateStartISO}T00:00:00`;
        endDateTime = `${dateEndISO}T23:59:00`;
      }

      events.push({
        id: item.id,
        title: item.title,
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime },
        color: item.color,
        originalItem: item,
      } as TimelineEvent);
    });
    if (feedbackEvent) {
      events.push(feedbackEvent);
    }
    return events;
  }, [allItems, feedbackEvent]);

  const goBack = () => {
    const newAnchor = navigate(anchor, viewMode, -1);
    setAnchor(newAnchor);
    if (viewMode !== 'month' && viewMode !== 'schedule') {
      calendarRef.current?.goToDate({ date: newAnchor });
    }
  };
  const goForward = () => {
    const newAnchor = navigate(anchor, viewMode, 1);
    setAnchor(newAnchor);
    if (viewMode !== 'month' && viewMode !== 'schedule') {
      calendarRef.current?.goToDate({ date: newAnchor });
    }
  };
  const goToday = () => { 
    setAnchor(todayISO); 
    setSelectedISO(todayISO); 
    if (viewMode !== 'month' && viewMode !== 'schedule') {
      calendarRef.current?.goToDate({ date: todayISO });
    }
  };

  const handleSlotPress = useCallback((iso: string, time?: string, endTime?: string) => {
    setComposerDate(iso);
    setComposerTime(time || '');
    setComposerEndTime(endTime || '');
    setComposerVisible(true);
  }, []);

  // Tap on a task/birthday/holiday → open detail sheet or task detail
  const handleItemPress = useCallback((item: CalendarItem) => {
    if (item.type === 'task' && item.taskId) {
      setSelectedTaskId(item.taskId);
    } else {
      setDetailItem(item);
    }
  }, []);

  // "+N more" in month view → show all items for that day
  const handleOverflowPress = useCallback((iso: string) => {
    setOverflowDay(iso);
  }, []);

  // Toggle task complete from detail sheet
  const handleToggleComplete = useCallback((taskId: string) => {
    updateTask(taskId, t => ({ ...t, completed: !t.completed }));
  }, [updateTask]);

  // Month view: tap a date → switch to Day view showing that exact date.
  // We set pendingNavDate so onDateChanged is blocked until CalendarKit
  // confirms it landed on the right day (handles the 1-2 s native init delay).
  const handleMonthDaySelect = useCallback((iso: string) => {
    setSelectedISO(iso);
    setAnchor(iso);
    if (pendingNavTimeout.current) clearTimeout(pendingNavTimeout.current);
    pendingNavDate.current = iso;
    setViewMode('day');
    // goToDate after a short delay ensures CalendarKit's JS side is mounted
    setTimeout(() => {
      calendarRef.current?.goToDate({ date: iso, animated: false });
    }, 100);
    // Safety: release after 5 s if CalendarKit never fires the correct date
    pendingNavTimeout.current = setTimeout(() => {
      pendingNavDate.current = null;
    }, 5000);
  }, []);

  // ─── Custom Event Renderer for CalendarKit ──────────────────────────────
  const renderEvent = useCallback((event: any) => {
    const rawColor: string = typeof event.color === 'string' && event.color ? event.color : theme.colors.primary;
    const title: string = event.title || '';

    // Format the time label from start/end
    let timeLabel = '';
    if (event.start?.dateTime && event.end?.dateTime) {
      const s = new Date(event.start.dateTime);
      const e = new Date(event.end.dateTime);
      const fmt = (d: Date) => {
        let h = d.getHours();
        const mm = d.getMinutes();
        const p = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${mm.toString().padStart(2, '0')} ${p}`;
      };
      timeLabel = `${fmt(s)} – ${fmt(e)}`;
    }

    // Flash feedback block (tap highlight)
    if (event.id === 'flash-feedback') {
      return (
        <View style={{
          flex: 1,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: theme.colors.primary,
          backgroundColor: 'rgba(99,102,241,0.10)',
        }} />
      );
    }

    return (
      <View style={{ flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
        {/* Solid left accent bar */}
        <View style={{ width: 3, backgroundColor: rawColor }} />
        {/* Content area: solid colored background */}
        <View style={{
          flex: 1,
          backgroundColor: rawColor,
          paddingLeft: 6,
          paddingRight: 4,
          paddingVertical: 4,
          justifyContent: 'center',
        }}>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 12,
              fontFamily: 'Inter_700Bold',
              lineHeight: 16,
            }}
            numberOfLines={2}
          >
            {title}
          </Text>
          {!!timeLabel && (
            <Text
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 10,
                fontFamily: 'Inter_500Medium',
                marginTop: 1,
              }}
              numberOfLines={1}
            >
              {timeLabel}
            </Text>
          )}
        </View>
      </View>
    );
  }, [theme]);

  const currentMeta = VIEW_MODES.find(v => v.id === viewMode)!;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <TopNavbar />

      {/* Calendar Header */}
      <View style={[styles.calHeader, { borderBottomColor: theme.colors.border }]}>
        {/* View Mode Button */}
        <TouchableOpacity
          onPress={() => setShowViewPicker(true)}
          style={[styles.viewBtn, { backgroundColor: `${theme.colors.primary}15` }]}
        >
          <MaterialIcons name={currentMeta.icon} size={15} color={theme.colors.primary} />
          <Text style={[styles.viewBtnText, { color: theme.colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
            {currentMeta.label}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={15} color={theme.colors.primary} />
        </TouchableOpacity>

        {/* Period Title — tap to go today */}
        <TouchableOpacity onPress={goToday} style={styles.titleBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.calTitle, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
            {getHeaderTitle(anchor, viewMode)}
          </Text>
        </TouchableOpacity>

        {/* Arrows */}
        <View style={styles.navArrows}>
          <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 6 }}>
            <MaterialIcons name="chevron-left" size={28} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goForward} hitSlop={{ top: 12, bottom: 12, left: 6, right: 12 }}>
            <MaterialIcons name="chevron-right" size={28} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Active View */}
      <View style={styles.viewContainer}>
        {viewMode === 'schedule' && (
          <ScheduleView
            startISO={start}
            endISO={end}
            anchorISO={anchor}
            getItemsForDate={getItemsForDate}
            onItemPress={handleItemPress}
            onSlotPress={handleSlotPress}
          />
        )}
        {(viewMode === 'day' || viewMode === '3day' || viewMode === 'week') && (
          <CalendarKit
            ref={calendarRef}
            events={timelineEvents}
            initialDate={anchor}
            numberOfDays={viewMode === 'day' ? 1 : viewMode === '3day' ? 3 : 7}
            onDateChanged={(date) => {
              const justDate = date.includes('T')
                ? format(parseISO(date), 'yyyy-MM-dd')
                : date;
              if (!justDate) return;

              // If we're waiting for CalendarKit to confirm a programmatic
              // navigation: keep blocking until it reports the right date.
              if (pendingNavDate.current) {
                if (justDate === pendingNavDate.current) {
                  // CalendarKit landed on the correct date — unlock
                  pendingNavDate.current = null;
                  if (pendingNavTimeout.current) {
                    clearTimeout(pendingNavTimeout.current);
                    pendingNavTimeout.current = null;
                  }
                }
                // Always return here — don't call setAnchor while navigating
                return;
              }

              setAnchor(justDate);
            }}
            onPressDayNumber={(date) => {
              const justDate = date.includes('T') ? format(new Date(date), 'yyyy-MM-dd') : date;
              setAnchor(justDate);
              setViewMode('day');
              // Switch to single-day mode for the tapped date
              setTimeout(() => calendarRef.current?.goToDate({ date: justDate }), 10);
            }}
            onPressEvent={(event: any) => handleItemPress(event.originalItem)}
            onPressBackground={(props: any) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (props.dateTime) {
                const d = new Date(props.dateTime);
                const date = format(d, 'yyyy-MM-dd');
                let h = d.getHours();
                let m = d.getMinutes();
                // Snap to 30-min chunks (e.g. upper half = :00, lower half = :30)
                m = m < 30 ? 0 : 30;

                const period = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;
                const time = `${h12}:${m.toString().padStart(2, '0')} ${period}`;

                const dStart = new Date(d);
                dStart.setMinutes(m);
                const feedbackStart = format(dStart, "yyyy-MM-dd'T'HH:mm:00");

                const dEnd = new Date(d);
                dEnd.setMinutes(m + 30);
                const hEnd = dEnd.getHours();
                const periodEnd = hEnd >= 12 ? 'PM' : 'AM';
                const h12End = hEnd % 12 || 12;
                const endTime = `${h12End}:${dEnd.getMinutes().toString().padStart(2, '0')} ${periodEnd}`;
                const feedbackEnd = format(dEnd, "yyyy-MM-dd'T'HH:mm:00");

                setFeedbackEvent({
                  id: 'flash-feedback',
                  title: '',
                  start: { dateTime: feedbackStart },
                  end: { dateTime: feedbackEnd },
                  color: theme.colors.primary,
                });

                handleSlotPress(date, time, endTime);
              } else if (props.date) {
                handleSlotPress(props.date);
              }
            }}
            allowDragToEdit={true}
            allowDragToCreate={true}
            defaultDuration={30}
            useHaptic={true}
            dragStep={15}
            onDragCreateEventEnd={(event: any) => {
              if (event.start?.dateTime) {
                const d = new Date(event.start.dateTime);
                const date = format(d, 'yyyy-MM-dd');
                let h = d.getHours();
                const period = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                const time = `${h}:${d.getMinutes().toString().padStart(2, '0')} ${period}`;

                let endTime;
                if (event.end?.dateTime) {
                  const dEnd = new Date(event.end.dateTime);
                  let hE = dEnd.getHours();
                  const periodE = hE >= 12 ? 'PM' : 'AM';
                  hE = hE % 12 || 12;
                  endTime = `${hE}:${dEnd.getMinutes().toString().padStart(2, '0')} ${periodE}`;
                }

                handleSlotPress(date, time, endTime);
              } else if (event.start?.date) {
                handleSlotPress(event.start.date);
              }
            }}
            onDragEventEnd={async (event: any) => {
              const orig = event.originalItem as CalendarItem;
              if (orig && orig.type === 'task' && orig.taskId) {
                let newDate = event.start.date;
                let newTime;
                if (event.start.dateTime) {
                  const d = new Date(event.start.dateTime);
                  newDate = format(d, 'yyyy-MM-dd');
                  let h = d.getHours();
                  const period = h >= 12 ? 'PM' : 'AM';
                  h = h % 12 || 12;
                  newTime = `${h}:${d.getMinutes().toString().padStart(2, '0')} ${period}`;
                }
                updateTask(orig.taskId, t => ({ ...t, dueDate: newDate, dueTime: newTime }));
              }
            }}
          theme={{
              primaryColor: theme.colors.primary,
              primaryContainer: theme.colors.primary + '20',
              backgroundColor: theme.colors.background,
              surface: theme.colors.cardPrimary,
              onSurface: theme.colors.text,
              onBackground: theme.colors.text,
              onPrimary: '#FFFFFF',
              border: theme.colors.border,
              text: theme.colors.text,
              subText: theme.colors.textSecondary,
              hourText: { color: theme.colors.textSecondary, fontSize: 11, fontFamily: 'Inter_500Medium' },
              nowIndicator: theme.colors.primary,
              nowIndicatorDot: theme.colors.primary,
              dayName: { color: theme.colors.textSecondary, fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
              dayNumber: { color: theme.colors.text, fontSize: 15, fontFamily: 'Inter_700Bold' },
              dayNumberContainer: { borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
              todayName: { color: theme.colors.primary, fontFamily: 'Inter_700Bold' },
              todayNumber: { color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
              todayNumberContainer: { backgroundColor: theme.colors.primary, borderRadius: 16, width: 32, height: 32 },
              headerContainer: { backgroundColor: theme.colors.cardPrimary, borderBottomColor: theme.colors.border, borderBottomWidth: 1 },
              leftBarWidth: 52,
              slotDuration: { minutes: 60 },
              eventContainerStyle: { borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3, borderWidth: 0 },
          }}
            renderEvent={renderEvent}
          />
        )}
        {viewMode === 'month' && (
          <MonthGridView
            monthISO={anchor}
            selectedISO={selectedISO}
            onSelectDate={handleMonthDaySelect}
            onOverflowPress={handleOverflowPress}
            getItemsForDate={getItemsForDate}
            onItemPress={handleItemPress}
          />
        )}
      </View>

      {/* View Picker Dropdown */}
      <Modal visible={showViewPicker} transparent animationType="fade" onRequestClose={() => setShowViewPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowViewPicker(false)} activeOpacity={1}>
          <View style={[styles.viewPickerCard, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
            <Text style={[styles.viewPickerTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              CALENDAR VIEW
            </Text>
            {VIEW_MODES.map(v => (
              <TouchableOpacity
                key={v.id}
                onPress={() => { setViewMode(v.id); setShowViewPicker(false); }}
                style={[
                  styles.viewPickerRow,
                  viewMode === v.id && { backgroundColor: `${theme.colors.primary}12`, borderRadius: 8 }
                ]}
              >
                <MaterialIcons
                  name={v.icon}
                  size={20}
                  color={viewMode === v.id ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text style={[
                  styles.viewPickerLabel,
                  { color: viewMode === v.id ? theme.colors.primary : theme.colors.text },
                  { fontFamily: viewMode === v.id ? 'Inter_600SemiBold' : 'Inter_500Medium' }
                ]}>
                  {v.label}
                </Text>
                {viewMode === v.id && (
                  <MaterialIcons name="check" size={18} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Task/Event Detail Sheet (for non-tasks) */}
      <ItemDetailSheet
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onToggleComplete={handleToggleComplete}
      />

      {/* Actual Task Detail Modal */}
      <TaskDetailModal
        visible={!!selectedTaskId}
        taskId={selectedTaskId!}
        onClose={() => setSelectedTaskId(null)}
      />

      {/* Day Overflow Sheet (from "+N more" in Month view) */}
      <DayItemsSheet
        iso={overflowDay}
        items={overflowDay ? getItemsForDate(overflowDay) : []}
        onClose={() => setOverflowDay(null)}
        onItemPress={handleItemPress}
      />

      {/* Task Composer */}
      <TaskComposer
        visible={composerVisible}
        onClose={() => { setComposerVisible(false); setComposerDate(''); setComposerTime(''); setComposerEndTime(''); setFeedbackEvent(null); }}
        onSave={(task) => { handleComposerSave(task); setComposerVisible(false); setFeedbackEvent(null); }}
        initialDueDate={composerDate}
        initialDueTime={composerTime}
        initialDueEndTime={composerEndTime || undefined}
      />

      <FABMenu bottom={fabBottom} />
      <BottomNavbar />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewBtnText: { fontSize: 12 },
  titleBtn: { flex: 1, alignItems: 'center' },
  calTitle: { fontSize: 15, letterSpacing: -0.3 },
  navArrows: { flexDirection: 'row', gap: 0 },
  viewContainer: { flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: 12,
    paddingTop: 90,
  },
  viewPickerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    minWidth: 210,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  viewPickerTitle: {
    fontSize: 10,
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  viewPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  viewPickerLabel: { flex: 1, fontSize: 14 },
});
