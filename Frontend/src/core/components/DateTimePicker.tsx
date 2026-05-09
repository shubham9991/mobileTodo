import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Dimensions,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useManage } from '../ManageContext';
import { dummyData } from '../dummyData';
import { format, parseISO, eachDayOfInterval, isValid, addDays, startOfWeek } from 'date-fns';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// ─── Draggable numeric input ──────────────────────────────────────────────────
const DraggableInput = ({ value, onChange, min, max, style, pad, placeholder, placeholderTextColor }: any) => {
  const startValRef = useRef(parseInt(value || String(min), 10));
  const currentValRef = useRef(value);
  currentValRef.current = value;

  const panGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-10, 10]) // Require 10px vertical movement to activate
    .onStart(() => {
      startValRef.current = parseInt(currentValRef.current || String(min), 10);
    })
    .onUpdate((e) => {
      const delta = Math.floor(-e.translationY / 15);
      let newVal = startValRef.current + delta;
      const range = max - min + 1;
      while (newVal < min) newVal += range;
      while (newVal > max) newVal -= range;
      const formatted = pad ? String(newVal).padStart(2, '0') : String(newVal);
      if (formatted !== currentValRef.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(formatted);
      }
    }), [min, max, pad, onChange]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View>
        <TextInput
          style={style} value={value}
          onChangeText={(t) => { const n = parseInt(t, 10); if (t === '' || (!isNaN(n) && n >= 0)) onChange(t); }}
          keyboardType="number-pad" maxLength={2}
          placeholder={placeholder} placeholderTextColor={placeholderTextColor}
        />
      </Animated.View>
    </GestureDetector>
  );
};

// ─── Day Cell Component ───────────────────────────────────────────────────────
const DayCell = React.memo(({ date, state, marking, theme, onDayPress, onGlideStart }: any) => {
  const isSelected = marking?.color != null;
  const isStart = marking?.startingDay;
  const isEnd = marking?.endingDay;
  const isToday = state === 'today';

  const textColor = isSelected ? '#fff'
    : state === 'disabled' ? theme.colors.textSecondary + '40'
      : isToday ? theme.colors.primary
        : theme.colors.text;

  const selBg = theme.colors.primary;

  // Calculate day of week to round corners at screen edges
  const dateObj = new Date(date.dateString);
  const dayOfWeek = dateObj.getDay(); // 0 is Sunday
  const roundLeft = isStart || dayOfWeek === 0;
  const roundRight = isEnd || dayOfWeek === 6;

  const borderRadius = {
    borderTopLeftRadius: roundLeft ? 24 : 0,
    borderBottomLeftRadius: roundLeft ? 24 : 0,
    borderTopRightRadius: roundRight ? 24 : 0,
    borderBottomRightRadius: roundRight ? 24 : 0,
  };

  return (
    <TouchableOpacity
      onPress={() => onDayPress(date)}
      onLongPress={() => onGlideStart(date.dateString)}
      delayLongPress={600}
      activeOpacity={0.75}
      style={{ width: '100%', alignItems: 'center', paddingVertical: 2 }}
    >
      <View style={[{ width: '100%', alignItems: 'center', paddingVertical: 6, backgroundColor: isSelected ? selBg : 'transparent' }, borderRadius]}>
        <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: textColor, fontSize: 14, fontFamily: 'Inter_500Medium', fontWeight: (isStart || isEnd || isToday) ? '700' : '400' }}>
            {date.day}
          </Text>
        </View>

        {/* Multi-Dots */}
        {marking?.dots && marking.dots.length > 0 && (
          <View style={{ flexDirection: 'row', marginTop: 2, justifyContent: 'center', alignItems: 'center', gap: 3 }}>
            {marking.dots.map((d: any, i: number) => (
              <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: d.color }} />
            ))}
          </View>
        )}

        {/* Multi-Period Lines */}
        {marking?.periods && marking.periods.length > 0 && (
          <View style={{ width: '100%', marginTop: 2 }}>
            {marking.periods.map((p: any, i: number) => (
              <View
                key={i}
                style={{
                  height: 3,
                  backgroundColor: p.color,
                  marginBottom: 2,
                  marginLeft: p.startingDay ? 8 : 0,
                  marginRight: p.endingDay ? 8 : 0,
                  borderRadius: (p.startingDay || p.endingDay) ? 2 : 0
                }}
              />
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});
DayCell.displayName = 'DayCell';


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
  tags: any[],
  calendarMarkings: any[],
  primaryColor: string,
  showHistory: boolean,
): Record<string, any> {
  const marks: Record<string, any> = {};

  // ── 1. Historical tasks (multi-period colored lines) ────────────
  if (showHistory) {
    dummyData.taskGroups.flatMap(g => g.tasks).forEach(task => {
      if (!task.dueDate) return;
      const s = toISO(task.dueDate);
      if (!s) return;
      const sd = parseISO(s);
      if (!isValid(sd)) return;
      const e = task.dueEndDate ? toISO(task.dueEndDate) : s;
      const ed = e ? parseISO(e) : sd;

      const tagId = task.tagType ?? 'work';
      const tagSetting = calendarMarkings.find((m: any) => m.tagId === tagId);
      if (tagSetting && !tagSetting.visible) return;
      const color = (tags.find((t: any) => t.id === tagId)?.color ?? primaryColor);

      if (s === e) {
        if (!marks[s]) marks[s] = {};
        if (!marks[s].dots) marks[s].dots = [];
        marks[s].dots.push({ color: color });
      } else {
        try {
          eachDayOfInterval({ start: sd, end: ed }).forEach((day, idx, arr) => {
            const iso = format(day, 'yyyy-MM-dd');
            if (!marks[iso]) marks[iso] = {};
            if (!marks[iso].periods) marks[iso].periods = [];
            marks[iso].periods.push({
              startingDay: idx === 0,
              endingDay: idx === arr.length - 1,
              color: color
            });
          });
        } catch { /**/ }
      }
    });
  }


  // ── 2. User's date selection (period pill in primary color) ───────────────
  if (startISO) {
    const resolvedEnd = (endISO && endISO >= startISO) ? endISO : startISO;
    try {
      const sd = parseISO(startISO); const ed = parseISO(resolvedEnd);
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
    () => buildMarkedDates(startISO, endISO, tags, calendarMarkings, theme.colors.primary, showHistory),
    [startISO, endISO, tags, calendarMarkings, theme.colors.primary, showHistory]
  );

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
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    container: { backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
    headerTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text, textAlign: 'center', flex: 1 },
    selectionBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: theme.colors.secondary, borderRadius: 12, padding: 12, gap: 8 },
    selectionDate: { flex: 1, alignItems: 'center' },
    selectionLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: theme.colors.textSecondary, marginBottom: 2 },
    selectionValue: { fontSize: 14, fontFamily: 'Inter_700Bold', color: theme.colors.text },
    selectionValueActive: { color: theme.colors.primary },
    selectionArrow: { color: theme.colors.textSecondary },
    selectionDivider: { width: 1, height: 36, backgroundColor: theme.colors.border },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendLine: { width: 16, height: 3, borderRadius: 2 },
    legendText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#aaa' },
    quickRow: { paddingHorizontal: 16, paddingVertical: 8 },
    quickScroll: { flexDirection: 'row', gap: 8 },
    quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.secondary, borderWidth: 1, borderColor: theme.colors.border },
    quickChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    quickChipText: { fontSize: 13, color: theme.colors.text, fontFamily: 'Inter_500Medium' },
    quickChipTextActive: { color: '#fff' },
    divider: { height: 1, backgroundColor: theme.colors.border, marginHorizontal: 16, marginVertical: 4 },
    timeSection: { padding: 16, paddingTop: 12 },
    timeLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, letterSpacing: 0.6, marginBottom: 10 },
    timeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.secondary },
    timeChipActive: { backgroundColor: theme.colors.primary },
    timeChipText: { fontSize: 13, color: theme.colors.text, fontFamily: 'Inter_500Medium' },
    timeChipTextActive: { color: '#fff' },
    customTime: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, gap: 6, padding: 16, backgroundColor: theme.colors.secondary, borderRadius: 12 },
    timeInput: { width: 60, height: 54, borderRadius: 8, backgroundColor: theme.colors.background, color: theme.colors.text, fontSize: 22, textAlign: 'center', fontWeight: '700' },
    timeSep: { fontSize: 24, fontWeight: '700', color: theme.colors.textSecondary },
    periodToggle: { flexDirection: 'row', marginLeft: 10, backgroundColor: theme.colors.background, borderRadius: 8, padding: 4 },
    periodBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6 },
    periodBtnActive: { backgroundColor: theme.colors.primary },
    periodBtnTxt: { fontSize: 14, fontWeight: '500', color: theme.colors.text },
    periodBtnTxtActive: { color: '#fff' },
    confirmBtn: { backgroundColor: theme.colors.primary, marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    confirmTxt: { color: '#fff', fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  }), [theme, isDark]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={s.overlay}>
          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={[s.container, { paddingBottom: insets.bottom }]}>

            {/* Header */}
            <View style={s.header}>
              <TouchableOpacity onPress={onClose} style={{ padding: 8, width: 40 }}>
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <Text style={s.headerTitle}>Date & Time</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowHistory(!showHistory);
                }}
                style={{ padding: 8, width: 40, alignItems: 'flex-end' }}
              >
                <MaterialCommunityIcons
                  name={showHistory ? "calendar-check" : "calendar-blank"}
                  size={22}
                  color={showHistory ? theme.colors.primary : theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Selection summary bar removed as requested */}

            {/* Legend */}
            <View style={s.legendRow}>
              <View style={s.legendItem}>
                <View style={[s.legendLine, { backgroundColor: theme.colors.primary }]} />
                <Text style={s.legendText}>Your selection</Text>
              </View>
              {tags.slice(0, 3).map(t => (
                <View key={t.id} style={s.legendItem}>
                  <View style={[s.legendLine, { backgroundColor: t.color + 'AA' }]} />
                  <Text style={s.legendText}>{t.label}</Text>
                </View>
              ))}
            </View>

            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Calendar with per-day long-press + transparent overlay for glide */}
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
                {/* Transparent overlay — only active during glide, captures pan movement */}
                {isGlidingState && (
                  <GestureDetector gesture={overlayPanGesture}>
                    <View style={StyleSheet.absoluteFillObject} />
                  </GestureDetector>
                )}
              </View>

              {/* Quick date chips */}
              <View style={s.quickRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
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
                </ScrollView>
              </View>

              <View style={s.divider} />

              {/* Time section */}
              <View style={s.timeSection}>
                <Text style={s.timeLabel}>TIME</Text>
                <View style={s.timeChips}>
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

                {isCustomTime && (
                  <View style={s.customTime}>
                    <DraggableInput style={s.timeInput} value={customHour} onChange={setCustomHour} min={1} max={12} pad={false} placeholder="9" placeholderTextColor={theme.colors.textSecondary} />
                    <Text style={s.timeSep}>:</Text>
                    <DraggableInput style={s.timeInput} value={customMinute} onChange={setCustomMinute} min={0} max={59} pad={true} placeholder="00" placeholderTextColor={theme.colors.textSecondary} />
                    <View style={s.periodToggle}>
                      {(['AM', 'PM'] as const).map((p, i) => (
                        <TouchableOpacity key={p} style={[s.periodBtn, customPeriod === p && s.periodBtnActive]} onPress={() => { Haptics.selectionAsync(); setCustomPeriod(p); }}>
                          <Text style={[s.periodBtnTxt, customPeriod === p && s.periodBtnTxtActive]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity onPress={handleConfirm} style={s.confirmBtn}>
              <Text style={s.confirmTxt}>
                {hasRange ? `Confirm  ${fromISO(startISO)}  →  ${fromISO(endISO!)}` : `Confirm  ${fromISO(startISO)}`}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
