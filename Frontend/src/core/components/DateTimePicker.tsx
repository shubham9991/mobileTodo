import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Dimensions, Keyboard, Modal,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Calendar, DateData } from 'react-native-calendars';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useManage } from '../ManageContext';
import { useDashboard } from '../DashboardContext';
import { format, parseISO, eachDayOfInterval, isValid, addDays, differenceInCalendarDays } from 'date-fns';
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import BottomSheet, {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';

// ─── TimeSlot: drag to change, tap ✏ icon to type ──────────────────────────
/**
 * Gesture zone is a pure View (no TextInput) → pan works 100%.
 * Tap the pencil icon to switch to TextInput for keyboard entry.
 * Arrow chevrons show drag direction affordance.
 */
const TimeSlot = ({ value, onChange, min, max, pad, theme: t }: any) => {
  const [editing, setEditing] = useState(false);
  const startValRef = useRef(0);
  const currentValRef = useRef(value);
  currentValRef.current = value;

  const panGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-8, 8])
    .onStart(() => {
      startValRef.current = parseInt(currentValRef.current || String(min), 10);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onUpdate((e) => {
      const delta = Math.floor(-e.translationY / 10);
      let v = startValRef.current + delta;
      const range = max - min + 1;
      while (v < min) v += range;
      while (v > max) v -= range;
      const formatted = pad ? String(v).padStart(2, '0') : String(v);
      if (formatted !== currentValRef.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(formatted);
      }
    })
    .onEnd(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid); }),
    [min, max, pad, onChange]);

  const bg = t?.colors?.secondary ?? '#1E1E2E';
  const border = t?.colors?.border ?? '#333';
  const text = t?.colors?.text ?? '#FFF';
  const dim = t?.colors?.textSecondary ?? '#888';
  const primary = t?.colors?.primary ?? '#6366F1';

  return (
    <View style={{ alignItems: 'center' }}>
      {editing ? (
        <TextInput
          autoFocus
          style={{
            width: 74, height: 74, borderRadius: 16,
            backgroundColor: primary + '20',
            borderWidth: 2, borderColor: primary,
            color: text, fontSize: 32, textAlign: 'center',
            fontFamily: 'Inter_700Bold',
          }}
          value={value}
          onChangeText={(s) => {
            const n = parseInt(s, 10);
            if (s === '' || (!isNaN(n) && n >= 0)) onChange(s);
          }}
          onBlur={() => {
            const n = parseInt(value || String(min), 10);
            const clamped = Math.min(max, Math.max(min, isNaN(n) ? min : n));
            onChange(pad ? String(clamped).padStart(2, '0') : String(clamped));
            setEditing(false);
          }}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
        />
      ) : (
        <GestureDetector gesture={panGesture}>
          <View style={{
            width: 74, height: 74, borderRadius: 16,
            backgroundColor: bg, borderWidth: 1.5, borderColor: border,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <MaterialIcons name="keyboard-arrow-up" size={14} color={dim} style={{ position: 'absolute', top: 4 }} />
            <Text style={{ color: text, fontSize: 32, fontFamily: 'Inter_700Bold' }}>
              {value || (pad ? '00' : '0')}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={14} color={dim} style={{ position: 'absolute', bottom: 4 }} />
          </View>
        </GestureDetector>
      )}
      {/* Toggle edit mode */}
      <TouchableOpacity
        onPress={() => setEditing(e => !e)}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        style={{ marginTop: 5 }}
      >
        <MaterialIcons name={editing ? 'check' : 'edit'} size={13} color={editing ? primary : dim} />
      </TouchableOpacity>
    </View>
  );
};


// ─── Day Cell ─────────────────────────────────────────────────────────
const DayCell = React.memo(({ date, state, marking, theme, onDayPress, onGlideStart }: any) => {
  const isSelected = !!marking?.color;
  const isStart = marking?.startingDay;
  const isEnd = marking?.endingDay;
  const isToday = state === 'today';
  const isDisabled = state === 'disabled';

  const numColor = isSelected ? '#fff'
    : isDisabled ? theme.colors.textSecondary + '40'
      : isToday ? theme.colors.primary
        : theme.colors.text;

  const dayOfWeek = new Date(date.dateString).getDay();
  const roundLeft = isStart || dayOfWeek === 0;
  const roundRight = isEnd || dayOfWeek === 6;
  const selRadius = {
    borderTopLeftRadius: roundLeft ? 20 : 0,
    borderBottomLeftRadius: roundLeft ? 20 : 0,
    borderTopRightRadius: roundRight ? 20 : 0,
    borderBottomRightRadius: roundRight ? 20 : 0,
  };

  // Only count incomplete tasks for the badge
  const busyTasks: { color: string; title: string }[] = marking?.busyTasks ?? [];
  const count = busyTasks.length; // already filtered to incomplete in buildMarkedDates
  // Pick the dominant color (most frequent tag color)
  const badgeColor = busyTasks[0]?.color ?? null;

  return (
    <TouchableOpacity
      onPress={() => onDayPress(date)}
      onLongPress={() => onGlideStart(date.dateString)}
      delayLongPress={500}
      activeOpacity={0.75}
      style={{ width: '100%', alignItems: 'center', paddingVertical: 2 }}
    >
      <View style={[{
        width: '100%', alignItems: 'center',
        paddingTop: 5, paddingBottom: 6,
        backgroundColor: isSelected ? theme.colors.primary : 'transparent',
      }, selRadius]}>
        {/* Date number with badge */}
        <View style={{ position: 'relative', width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
          {/* Today ring */}
          {isToday && !isSelected && (
            <View style={{
              position: 'absolute', width: 28, height: 28, borderRadius: 14,
              borderWidth: 1.5, borderColor: theme.colors.primary,
            }} />
          )}
          <Text style={{
            color: numColor, fontSize: 13,
            fontFamily: isToday || isSelected ? 'Inter_700Bold' : 'Inter_400Regular',
          }}>
            {date.day}
          </Text>

          {/* Count badge — top-right corner, only when not selected and has tasks */}
          {!isSelected && count > 0 && badgeColor && (
            <View style={{
              position: 'absolute', top: -3, right: -3,
              minWidth: 14, height: 14, borderRadius: 7,
              backgroundColor: badgeColor,
              alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: count > 9 ? 2 : 0,
              borderWidth: 1.5, borderColor: theme.colors.background,
            }}>
              <Text style={{ color: '#fff', fontSize: 7.5, fontFamily: 'Inter_700Bold', lineHeight: 10 }}>
                {count > 9 ? '9+' : count}
              </Text>
            </View>
          )}
        </View>

        {/* Colored dot row (one dot per unique tag color) */}
        {!isSelected && count > 0 && (
          <View style={{ flexDirection: 'row', gap: 2, marginTop: 3, justifyContent: 'center' }}>
            {[...new Set(busyTasks.map(t => t.color))].slice(0, 4).map((c, i) => (
              <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c }} />
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});
DayCell.displayName = 'DayCell';

// ─── Busy Tasks Preview (shown below calendar on date tap) ───────────────────
const BusyTasksPreview = ({ selectedISO, theme, allTasks }: {
  selectedISO: string;
  theme: any;
  allTasks: any[];
}) => {
  const dayTasks = useMemo(() => allTasks.filter(t => {
    if (!t.dueDate || t.completed) return false;
    const s = toISO(t.dueDate);
    if (!s) return false;
    const e = t.dueEndDate ? toISO(t.dueEndDate) : s;
    if (!e) return s === selectedISO;
    return selectedISO >= s && selectedISO <= e;
  }), [allTasks, selectedISO]);

  if (dayTasks.length === 0) return null;

  const TAG_COLORS_MAP: Record<string, string> = {
    work: '#6366F1', personal: '#8B5CF6', health: '#22C55E',
    learning: '#EC4899', review: '#F97316',
  };

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' }}>
        <Text style={{
          fontSize: 11, fontFamily: 'Inter_700Bold',
          color: theme.colors.textSecondary, letterSpacing: 0.8,
        }}>
          SCHEDULE FOR {format(parseISO(selectedISO), 'MMM d').toUpperCase()}
        </Text>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: theme.colors.primary }}>
          {dayTasks.length} {dayTasks.length === 1 ? 'Task' : 'Tasks'}
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {dayTasks.map((t: any) => {
          const color = TAG_COLORS_MAP[t.tagType ?? 'personal'] ?? theme.colors.primary;
          const isMultiDay = !!t.dueEndDate && toISO(t.dueEndDate) !== toISO(t.dueDate);
          const startISO = toISO(t.dueDate);
          const endISO = t.dueEndDate ? toISO(t.dueEndDate) : startISO;

          return (
            <View key={t.id} style={{
              backgroundColor: theme.colors.secondary,
              borderRadius: 14,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: theme.colors.text,
                  fontSize: 13,
                  fontFamily: 'Inter_700Bold',
                  marginBottom: 4,
                }} numberOfLines={1}>
                  {t.title}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialIcons name={isMultiDay ? 'date-range' : 'event'} size={14} color={color} />
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontFamily: 'Inter_500Medium' }}>
                      {isMultiDay
                        ? (startISO === selectedISO ? 'Starts today' : endISO === selectedISO ? 'Ends today' : 'Multi-day')
                        : 'Single day'
                      }
                    </Text>
                  </View>

                  {t.dueTime && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MaterialIcons name="access-time" size={14} color={theme.colors.textSecondary} />
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontFamily: 'Inter_500Medium' }}>
                        {t.dueTime}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Tag Badge */}
              {t.tag && (
                <View style={{
                  backgroundColor: `${color}15`,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  marginLeft: 8,
                }}>
                  <Text style={{ color, fontSize: 10, fontFamily: 'Inter_700Bold' }}>
                    {t.tag.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};


// ─── Types ────────────────────────────────────────────────────────────────────
interface DateTimePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: string, time: string | null, endDate?: string | null) => void;
  initialDate?: string;
  initialTime?: string;
  initialEndDate?: string;
}

const TIME_OPTIONS = [
  { label: 'No time', value: null },
  { label: '9:00 AM', value: '9:00 AM' },
  { label: '12:00 PM', value: '12:00 PM' },
  { label: '3:00 PM', value: '3:00 PM' },
  { label: '6:00 PM', value: '6:00 PM' },
  { label: '9:00 PM', value: '9:00 PM' },
  { label: 'Custom', value: 'custom' },
];

const QUICK_DATES = [
  { label: 'Today', offset: 0 },
  { label: 'Tomorrow', offset: 1 },
  { label: 'Next Mon', offset: 'nextMonday' as const },
  { label: 'Next Week', offset: 7 },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
function toISO(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const today = new Date();
  const lower = s.toLowerCase();
  if (lower === 'today') return format(today, 'yyyy-MM-dd');
  if (lower === 'tomorrow') return format(addDays(today, 1), 'yyyy-MM-dd');
  const a = new Date(`${s}, ${today.getFullYear()}`);
  return isValid(a) ? format(a, 'yyyy-MM-dd') : null;
}

function fromISO(iso: string): string {
  const d = parseISO(iso);
  const today = format(new Date(), 'yyyy-MM-dd');
  const tmrw = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  if (iso === today) return 'Today';
  if (iso === tmrw) return 'Tomorrow';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function buildMarkedDates(
  startISO: string | null,
  endISO: string | null,
  tasks: any[],
  tags: any[],
  calendarMarkings: any[],
  primaryColor: string,
  showHistory: boolean,
): Record<string, any> {
  const marks: Record<string, any> = {};

  function ensureDay(iso: string) {
    if (!marks[iso]) marks[iso] = { busyTasks: [] };
    if (!marks[iso].busyTasks) marks[iso].busyTasks = [];
  }

  // ── 1. Busy tasks: one chip per day each task spans ──────────────────
  if (showHistory) {
    tasks.forEach(task => {
      if (!task.dueDate || task.completed) return; // Skip completed tasks
      const s = toISO(task.dueDate);
      if (!s) return;
      const sd = parseISO(s);
      if (!isValid(sd)) return;

      const e = task.dueEndDate ? toISO(task.dueEndDate) : s;
      const ed = e ? parseISO(e) : sd;

      const tagId = task.tagType ?? 'work';
      const tagSetting = calendarMarkings.find((m: any) => m.tagId === tagId);
      if (tagSetting && !tagSetting.visible) return;
      const color = tags.find((t: any) => t.id === tagId)?.color ?? primaryColor;

      // Push a chip entry on every day this task touches
      try {
        eachDayOfInterval({ start: sd, end: ed }).forEach(day => {
          const iso = format(day, 'yyyy-MM-dd');
          ensureDay(iso);
          marks[iso].busyTasks.push({ color, title: task.title });
        });
      } catch { /**/ }
    });
  }

  // ── 2. User's own date selection (pill highlight) ─────────────────
  if (startISO) {
    const resolvedEnd = (endISO && endISO >= startISO) ? endISO : startISO;
    try {
      const sd = parseISO(startISO);
      const ed = parseISO(resolvedEnd);
      eachDayOfInterval({ start: sd, end: ed }).forEach((day, idx, arr) => {
        const iso = format(day, 'yyyy-MM-dd');
        if (!marks[iso]) marks[iso] = {};
        marks[iso].startingDay = idx === 0;
        marks[iso].endingDay = idx === arr.length - 1;
        marks[iso].color = primaryColor;
        marks[iso].textColor = '#fff';
      });
    } catch { /**/ }
  }

  return marks;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DateTimePicker({ visible, onClose, onConfirm, initialDate, initialTime, initialEndDate }: DateTimePickerProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { tags, calendarMarkings } = useManage();
  const { taskGroups } = useDashboard();
  const allTasks = useMemo(() => taskGroups.flatMap(g => g.tasks), [taskGroups]);

  // ── Bottom sheet ───────────────────────────────────────────────────────────
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['100%'], []);

  // Present the BottomSheet after the RN Modal has mounted.
  // We use a short delay so the Modal window is fully ready before present().
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => {
        Keyboard.dismiss();
        bottomSheetRef.current?.present();
      }, 50);
      return () => clearTimeout(t);
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        onPress={onClose}
      />
    ),
    [onClose],
  );

  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const [startISO, setStartISO] = useState<string>(todayISO);
  const [endISO, setEndISO] = useState<string | null>(null);
  const [isGlidingState, setIsGlidingState] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // Track current month for gesture grid calculation
  const [currentMonthISO, setCurrentMonthISO] = useState<string>(todayISO);
  const [calendarLayout, setCalendarLayout] = useState({ width: 0, height: 0 });
  const calendarContainerRef = useRef<View>(null);
  const calendarPagePos = useRef({ x: 0, y: 0 });

  const isGliding = useRef(false);
  const glideStartISO = useRef<string | null>(null);
  const lastHoveredISO = useRef<string | null>(null);

  // Map absolute screen x,y -> calendar date
  const getDateFromAbsCoords = useCallback((absX: number, absY: number): string | null => {
    const { x, y, width, height } = { ...calendarPagePos.current, ...calendarLayout };
    if (!width || !height) return null;
    const rx = absX - x;
    const ry = absY - y;
    const HEADER_H = 52; // calendar header (month + day names)
    if (ry < HEADER_H) return null;
    const monthStart = parseISO(currentMonthISO);
    monthStart.setDate(1);
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(0);
    const numRows = Math.ceil((monthStart.getDay() + nextMonth.getDate()) / 7);
    const colW = width / 7;
    const rowH = (height - HEADER_H) / numRows;
    const col = Math.min(6, Math.max(0, Math.floor(rx / colW)));
    const row = Math.floor((ry - HEADER_H) / rowH);
    if (row < 0 || row >= numRows) return null;
    const gridStart = new Date(monthStart);
    gridStart.setDate(1 - monthStart.getDay()); // start of week containing 1st
    return format(addDays(gridStart, row * 7 + col), 'yyyy-MM-dd');
  }, [calendarLayout, currentMonthISO]);

  const onGlideStart = useCallback((startDateISO: string) => {
    isGliding.current = true;
    glideStartISO.current = startDateISO;
    lastHoveredISO.current = startDateISO;
    setStartISO(startDateISO);
    setEndISO(null);
    setIsGlidingState(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Overlay Pan — fires only while isGliding.current is true (set by onGlideStart)
  const overlayPanGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      if (!isGliding.current) return;
      const hover = getDateFromAbsCoords(e.absoluteX, e.absoluteY);
      if (!hover || hover === lastHoveredISO.current) return;
      lastHoveredISO.current = hover;
      const anchor = glideStartISO.current!;
      if (hover >= anchor) {
        setStartISO(anchor);
        setEndISO(hover);
      } else {
        setStartISO(hover);
        setEndISO(anchor);
      }
      Haptics.selectionAsync();
    })
    .onEnd(() => {
      isGliding.current = false;
      glideStartISO.current = null;
      lastHoveredISO.current = null;
      setIsGlidingState(false);
    }), [getDateFromAbsCoords]);

  // Time state
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customHour, setCustomHour] = useState('9');
  const [customMinute, setCustomMinute] = useState('00');
  const [customPeriod, setCustomPeriod] = useState<'AM' | 'PM'>('AM');

  useEffect(() => {
    if (!visible) return;
    setStartISO(initialDate ? (toISO(initialDate) ?? todayISO) : todayISO);
    setEndISO(initialEndDate ? (toISO(initialEndDate) ?? null) : null);
    if (initialTime && initialTime !== 'No time') {
      const preset = TIME_OPTIONS.find(t => t.value === initialTime);
      if (preset) { setSelectedTime(initialTime); setIsCustomTime(false); }
      else {
        const m = initialTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (m) { setSelectedTime('custom'); setIsCustomTime(true); setCustomHour(m[1]); setCustomMinute(m[2]); setCustomPeriod(m[3].toUpperCase() as 'AM' | 'PM'); }
      }
    } else { setSelectedTime(null); setIsCustomTime(false); }
  }, [visible, initialDate, initialEndDate, initialTime, todayISO]);

  const markedDates = useMemo(
    () => buildMarkedDates(startISO, endISO, allTasks, tags, calendarMarkings, theme.colors.primary, showHistory),
    [startISO, endISO, allTasks, tags, calendarMarkings, theme.colors.primary, showHistory]
  );

  // Days selected count
  const daysSelected = useMemo(() => {
    if (!endISO || endISO === startISO) return 1;
    return differenceInCalendarDays(parseISO(endISO), parseISO(startISO)) + 1;
  }, [startISO, endISO]);

  // Conflict detection: tasks on the same date+time as currently selected
  const conflicts = useMemo(() => {
    const effectiveTime = isCustomTime
      ? `${customHour || '9'}:${customMinute || '00'} ${customPeriod}`
      : selectedTime;
    if (!effectiveTime) return [];
    return allTasks.filter(t => {
      if (!t.dueDate || t.completed || !t.dueTime) return false;
      const iso = toISO(t.dueDate);
      return iso === startISO && t.dueTime === effectiveTime;
    });
  }, [allTasks, startISO, selectedTime, isCustomTime, customHour, customMinute, customPeriod]);

  // Tap: first tap = start, second tap = end (if after start), third = reset
  const handleDayPress = useCallback((day: DateData) => {
    Haptics.selectionAsync();
    const iso = day.dateString;
    if (!startISO || endISO || iso < startISO) {
      // Reset: new start
      setStartISO(iso);
      setEndISO(null);
    } else if (iso === startISO) {
      // Tapped same day → clear end
      setEndISO(null);
    } else {
      // Set end
      setEndISO(iso);
    }
  }, [startISO, endISO]);

  const handleConfirm = useCallback(() => {
    const dateLabel = fromISO(startISO);
    const endLabel = endISO && endISO !== startISO ? fromISO(endISO) : null;
    let timeStr: string | null = null;
    if (isCustomTime) timeStr = `${customHour || '9'}:${customMinute || '00'} ${customPeriod}`;
    else timeStr = selectedTime;
    onConfirm(dateLabel, timeStr, endLabel);
    onClose();
  }, [startISO, endISO, selectedTime, isCustomTime, customHour, customMinute, customPeriod, onConfirm, onClose]);

  const hasRange = endISO && endISO !== startISO;

  const calTheme = {
    backgroundColor: theme.colors.background,
    calendarBackground: theme.colors.background,
    textSectionTitleColor: theme.colors.textSecondary,
    selectedDayBackgroundColor: theme.colors.primary,
    selectedDayTextColor: '#fff',
    todayTextColor: theme.colors.primary,
    dayTextColor: theme.colors.text,
    textDisabledColor: theme.colors.textSecondary + '40',
    arrowColor: theme.colors.textSecondary,
    monthTextColor: theme.colors.text,
    indicatorColor: theme.colors.primary,
    textDayFontFamily: 'Inter_500Medium',
    textMonthFontFamily: 'Inter_600SemiBold',
    textDayHeaderFontFamily: 'Inter_500Medium',
    textDayFontSize: 14,
    textMonthFontSize: 16,
    textDayHeaderFontSize: 12,
  };

  const s = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    handle: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    handleIndicator: {
      backgroundColor: theme.colors.border,
      width: 40,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
    headerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: theme.colors.text, textAlign: 'center', flex: 1 },
    historyToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    historyToggleText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
    // Conflict
    conflictRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
    conflictText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#D97706', flex: 1 },
    // Legend
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 4, paddingTop: 2 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendLine: { width: 14, height: 3, borderRadius: 2 },
    legendText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: theme.colors.textSecondary },
    // Quick chips
    quickRow: { paddingHorizontal: 16, paddingVertical: 8 },
    quickScroll: { flexDirection: 'row', gap: 8 },
    quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.secondary, borderWidth: 1, borderColor: theme.colors.border },
    quickChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    quickChipText: { fontSize: 13, color: theme.colors.text, fontFamily: 'Inter_500Medium' },
    quickChipTextActive: { color: '#fff' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginHorizontal: 16, marginVertical: 6 },
    // Time
    timeSection: { padding: 16, paddingTop: 10 },
    timeLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: theme.colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },
    timeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    timeChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: theme.colors.secondary, borderWidth: 1, borderColor: theme.colors.border },
    timeChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    timeChipText: { fontSize: 13, color: theme.colors.text, fontFamily: 'Inter_500Medium' },
    timeChipTextActive: { color: '#fff' },
    customTime: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      marginTop: 12, gap: 12, padding: 20,
      backgroundColor: theme.colors.secondary,
      borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border,
    },
    timeSep: { fontSize: 36, fontFamily: 'Inter_700Bold', color: theme.colors.primary, marginBottom: 24 },
    periodToggle: { flexDirection: 'column', marginLeft: 6, backgroundColor: theme.colors.background, borderRadius: 12, padding: 4, gap: 4 },
    periodBtn: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8 },
    periodBtnActive: { backgroundColor: theme.colors.primary },
    periodBtnTxt: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: theme.colors.textSecondary, textAlign: 'center' },
    periodBtnTxtActive: { color: '#fff' },
    confirmBtn: {
      marginHorizontal: 16, marginTop: 10, marginBottom: 4,
      paddingVertical: 15, borderRadius: 16, alignItems: 'center',
    },
    confirmTxt: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  }), [theme, isDark]);

  return (
    // Own RN Modal → creates a native window layer that sits ABOVE the
    // TaskComposer Modal. GestureHandlerRootView + BottomSheetModalProvider
    // give the sheet fully isolated gesture & keyboard context.
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <BottomSheetModal
            ref={bottomSheetRef}
            snapPoints={snapPoints}
            onDismiss={onClose}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            backgroundStyle={{ backgroundColor: theme.colors.background }}
            handleIndicatorStyle={{ backgroundColor: theme.colors.border, width: 40 }}
            handleStyle={{ backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            topInset={insets.top}
          >
            {/* Header */}
            <View style={s.header}>
              <TouchableOpacity onPress={onClose} style={{ padding: 8, width: 60 }}>
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <Text style={s.headerTitle}>Date & Time</Text>
              <View style={{ width: 60, alignItems: 'flex-end' }}>
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowHistory(!showHistory); }}
                  style={[s.historyToggle, showHistory && { backgroundColor: `${theme.colors.primary}20` }]}
                >
                  <MaterialIcons
                    name={showHistory ? 'visibility' : 'visibility-off'}
                    size={16}
                    color={showHistory ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text style={[s.historyToggleText, { color: showHistory ? theme.colors.primary : theme.colors.textSecondary }]}>Busy</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Conflict Warning */}
            {conflicts.length > 0 && (
              <View style={[s.conflictRow, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                <MaterialIcons name="warning-amber" size={16} color="#D97706" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.conflictText, { fontFamily: 'Inter_700Bold', marginBottom: 1 }]}>
                    Time conflict!
                  </Text>
                  <Text style={[s.conflictText, { opacity: 0.85 }]}>
                    "{conflicts[0].title}" is already at this time{conflicts.length > 1 ? ` (+${conflicts.length - 1} more)` : ''}
                  </Text>
                </View>
              </View>
            )}

            {/* Scrollable content — calendar, task preview, quick dates */}
            <BottomSheetScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {/* Calendar */}
              <View
                ref={calendarContainerRef}
                onLayout={() => {
                  calendarContainerRef.current?.measureInWindow((x, y, width, height) => {
                    calendarPagePos.current = { x, y };
                    setCalendarLayout({ width, height });
                  });
                }}
              >
                <Calendar
                  current={startISO}
                  onMonthChange={(m: any) => setCurrentMonthISO(m.dateString)}
                  markingType="period"
                  markedDates={markedDates}
                  enableSwipeMonths={false}
                  theme={calTheme}
                  renderArrow={(dir: 'left' | 'right') => (
                    <MaterialIcons name={dir === 'left' ? 'chevron-left' : 'chevron-right'} size={24} color={theme.colors.textSecondary} />
                  )}
                  dayComponent={(props: any) => (
                    <DayCell
                      {...props}
                      theme={theme}
                      onDayPress={handleDayPress}
                      onGlideStart={onGlideStart}
                    />
                  )}
                />
                {isGlidingState && (
                  <GestureDetector gesture={overlayPanGesture}>
                    <View style={StyleSheet.absoluteFillObject} />
                  </GestureDetector>
                )}
              </View>

              {/* Busy Tasks Preview */}
              <BusyTasksPreview
                selectedISO={startISO}
                theme={theme}
                allTasks={allTasks}
              />

              {/* Quick date chips */}
              <View style={s.quickRow}>
                <GHScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
                  <View style={s.quickScroll}>
                    {QUICK_DATES.map((q) => {
                      const today = new Date(); today.setHours(0, 0, 0, 0);
                      let qDate = new Date(today);
                      if (q.offset === 'nextMonday') { const d = (8 - today.getDay()) % 7 || 7; qDate.setDate(today.getDate() + d); }
                      else qDate.setDate(today.getDate() + (q.offset as number));
                      const qISO = format(qDate, 'yyyy-MM-dd');
                      const isActive = startISO === qISO;
                      return (
                        <TouchableOpacity
                          key={q.label}
                          style={[s.quickChip, isActive && s.quickChipActive]}
                          onPress={() => { Haptics.selectionAsync(); setStartISO(qISO); setEndISO(null); }}
                        >
                          <Text style={[s.quickChipText, isActive && s.quickChipTextActive]}>{q.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </GHScrollView>
              </View>
            </BottomSheetScrollView>

            {/* ── Time section — outside BottomSheetScrollView so pan gestures work ── */}
            <View style={s.divider} />
            <View style={[s.timeSection, { paddingTop: 12 }]}>
              <Text style={s.timeLabel}>TIME</Text>

              <GHScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
                keyboardShouldPersistTaps="always"
              >
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {TIME_OPTIONS.map((t) => {
                    const isActive = t.value === 'custom' ? isCustomTime : selectedTime === t.value;
                    return (
                      <TouchableOpacity
                        key={t.label}
                        style={[s.timeChip, isActive && s.timeChipActive]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          if (t.value === 'custom') { setSelectedTime('custom'); setIsCustomTime(true); }
                          else { setSelectedTime(t.value); setIsCustomTime(false); }
                        }}
                      >
                        <Text style={[s.timeChipText, isActive && s.timeChipTextActive]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </GHScrollView>

              {isCustomTime && (
                <View style={[
                  s.customTime,
                  { backgroundColor: theme.colors.cardPrimary ?? theme.colors.secondary, borderColor: theme.colors.border }
                ]}>
                  <View style={{ alignItems: 'center', gap: 2 }}>
                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.6 }}>HOUR</Text>
                    <TimeSlot theme={theme} value={customHour} onChange={setCustomHour} min={1} max={12} pad={false} />
                  </View>

                  <Text style={s.timeSep}>:</Text>

                  <View style={{ alignItems: 'center', gap: 2 }}>
                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.6 }}>MIN</Text>
                    <TimeSlot theme={theme} value={customMinute} onChange={setCustomMinute} min={0} max={59} pad={true} />
                  </View>

                  <View style={[s.periodToggle, { backgroundColor: theme.colors.background }]}>
                    {(['AM', 'PM'] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[s.periodBtn, customPeriod === p && s.periodBtnActive]}
                        onPress={() => { Haptics.selectionAsync(); setCustomPeriod(p); }}
                      >
                        <Text style={[s.periodBtnTxt, customPeriod === p && s.periodBtnTxtActive]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Confirm button */}
            <TouchableOpacity
              onPress={handleConfirm}
              style={[s.confirmBtn, { backgroundColor: conflicts.length > 0 ? '#D97706' : theme.colors.primary, marginBottom: Math.max(insets.bottom, 48) }]}
            >
              <Text style={s.confirmTxt}>
                {conflicts.length > 0
                  ? `⚠️ Confirm anyway • ${fromISO(startISO)}`
                  : hasRange
                    ? `Confirm ${fromISO(startISO)} → ${fromISO(endISO!)} (${daysSelected} days)`
                    : `Confirm ${fromISO(startISO)}`}
              </Text>
            </TouchableOpacity>
          </BottomSheetModal>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
