import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DraggableInput = ({ value, onChange, min, max, style, pad, placeholder, placeholderTextColor }: any) => {
  const startValRef = useRef(parseInt(value || String(min), 10));
  const currentValRef = useRef(value);
  currentValRef.current = value;

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
    onPanResponderGrant: () => {
      startValRef.current = parseInt(currentValRef.current || String(min), 10);
    },
    onPanResponderMove: (_, gestureState) => {
      const delta = Math.floor(-gestureState.dy / 15);
      let newVal = startValRef.current + delta;
      
      const range = max - min + 1;
      while (newVal < min) newVal += range;
      while (newVal > max) newVal -= range;

      const formatted = pad ? String(newVal).padStart(2, '0') : String(newVal);
      if (formatted !== currentValRef.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(formatted);
      }
    },
  }), [min, max, pad, onChange]);

  return (
    <View {...panResponder.panHandlers}>
      <TextInput
        style={style}
        value={value}
        onChangeText={(text) => {
          const num = parseInt(text, 10);
          if (text === '' || (!isNaN(num) && num >= 0)) {
            onChange(text);
          }
        }}
        keyboardType="number-pad"
        maxLength={2}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
      />
    </View>
  );
};

interface DateTimePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: string, time: string | null) => void;
  initialDate?: string;
  initialTime?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_CELL_SIZE = Math.floor((SCREEN_WIDTH - 64) / 7);

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const QUICK_DATES = [
  { label: 'Today', offset: 0 },
  { label: 'Tomorrow', offset: 1 },
  { label: 'Next Monday', offset: 'nextMonday' as const },
  { label: 'Next Week', offset: 7 },
];

const TIME_OPTIONS = [
  { label: 'No time', value: null },
  { label: '9:00 AM', value: '9:00 AM' },
  { label: '12:00 PM', value: '12:00 PM' },
  { label: '3:00 PM', value: '3:00 PM' },
  { label: '6:00 PM', value: '6:00 PM' },
  { label: '9:00 PM', value: '9:00 PM' },
  { label: 'Custom', value: 'custom' },
];

export default function DateTimePicker({
  visible,
  onClose,
  onConfirm,
  initialDate,
  initialTime,
}: DateTimePickerProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customHour, setCustomHour] = useState('9');
  const [customMinute, setCustomMinute] = useState('00');
  const [customPeriod, setCustomPeriod] = useState<'AM' | 'PM'>('AM');

  // Parse initial values
  useEffect(() => {
    if (visible) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (initialDate) {
        const parsed = parseDateString(initialDate);
        if (parsed) {
          setSelectedDate(parsed);
          setCurrentMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
        } else {
          setSelectedDate(today);
          setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        }
      } else {
        setSelectedDate(today);
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
      }

      if (initialTime) {
        if (initialTime === 'No time') {
          setSelectedTime(null);
          setIsCustomTime(false);
        } else {
          const timeOption = TIME_OPTIONS.find((t) => t.value === initialTime);
          if (timeOption) {
            setSelectedTime(initialTime);
            setIsCustomTime(false);
          } else {
            // Parse custom time
            const match = initialTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (match) {
              setSelectedTime('custom');
              setIsCustomTime(true);
              setCustomHour(match[1]);
              setCustomMinute(match[2]);
              setCustomPeriod(match[3].toUpperCase() as 'AM' | 'PM');
            }
          }
        }
      } else {
        setSelectedTime(null);
        setIsCustomTime(false);
      }
    }
  }, [visible, initialDate, initialTime]);

  const parseDateString = (dateStr: string): Date | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateStr === 'Today') return today;
    if (dateStr === 'Tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    // Try parsing format like "Fri, Apr 3"
    const currentYear = today.getFullYear();
    const parsed = new Date(`${dateStr}, ${currentYear}`);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  };

  const formatDateForConfirm = (date: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate.getTime() === today.getTime()) return 'Today';
    if (checkDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const handleQuickDateSelect = useCallback((offset: number | 'nextMonday') => {
    Haptics.selectionAsync();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let newDate: Date;
    if (offset === 'nextMonday') {
      newDate = new Date(today);
      const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
      newDate.setDate(today.getDate() + daysUntilMonday);
    } else {
      newDate = new Date(today);
      newDate.setDate(today.getDate() + offset);
    }

    setSelectedDate(newDate);
    setCurrentMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
  }, []);

  const handleMonthChange = useCallback((direction: 'prev' | 'next') => {
    Haptics.selectionAsync();
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      return newMonth;
    });
  }, []);

  const handleTimeSelect = useCallback((value: string | null) => {
    Haptics.selectionAsync();
    if (value === 'custom') {
      setSelectedTime('custom');
      setIsCustomTime(true);
    } else {
      setSelectedTime(value);
      setIsCustomTime(false);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedDate) return;

    const dateStr = formatDateForConfirm(selectedDate);
    let timeStr: string | null = null;

    if (isCustomTime) {
      const hour = customHour || '9';
      const minute = customMinute || '00';
      timeStr = `${hour}:${minute} ${customPeriod}`;
    } else {
      timeStr = selectedTime;
    }

    onConfirm(dateStr, timeStr);
    onClose();
  }, [selectedDate, selectedTime, isCustomTime, customHour, customMinute, customPeriod, onConfirm, onClose]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    const days: { date: Date | null; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Previous month days
    const prevMonth = new Date(year, month, 0);
    const daysInPrevMonth = prevMonth.getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Current month days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
      });
    }

    // Next month days to fill the grid
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [currentMonth]);

  const isSelectedDate = useCallback(
    (date: Date) => {
      if (!selectedDate) return false;
      return (
        date.getDate() === selectedDate.getDate() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getFullYear() === selectedDate.getFullYear()
      );
    },
    [selectedDate]
  );

  const monthYearLabel = useMemo(() => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${months[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  }, [currentMonth]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          justifyContent: 'flex-end',
        },
        container: {
          backgroundColor: theme.colors.background,
          borderTopLeftRadius: theme.radii.large,
          borderTopRightRadius: theme.radii.large,
          maxHeight: '90%',
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
        closeButton: {
          padding: 8,
          width: 40,
        },
        headerTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
          textAlign: 'center',
          flex: 1,
        },
        emptyHeaderSpace: {
          width: 40,
        },
        bottomDoneButton: {
          backgroundColor: theme.colors.primary,
          marginHorizontal: 16,
          marginTop: 12,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        bottomDoneText: {
          color: '#FFF',
          fontSize: 16,
          fontWeight: '600',
        },
        quickChipsContainer: {
          paddingHorizontal: theme.spacing.medium,
          paddingVertical: theme.spacing.medium,
        },
        quickChip: {
          paddingHorizontal: theme.spacing.medium,
          paddingVertical: theme.spacing.small,
          borderRadius: theme.radii.round,
          backgroundColor: theme.colors.secondary,
          marginRight: theme.spacing.small,
        },
        quickChipActive: {
          backgroundColor: theme.colors.primary,
        },
        quickChipText: {
          fontSize: 14,
          color: theme.colors.text,
          fontWeight: '500',
        },
        quickChipTextActive: {
          color: theme.colors.primaryText,
        },
        calendarContainer: {
          paddingHorizontal: theme.spacing.medium,
          paddingBottom: theme.spacing.medium,
        },
        monthHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.medium,
        },
        monthNavButton: {
          padding: theme.spacing.small,
        },
        monthYearText: {
          fontSize: 17,
          fontWeight: '600',
          color: theme.colors.text,
        },
        daysOfWeekRow: {
          flexDirection: 'row',
          justifyContent: 'space-around',
          marginBottom: theme.spacing.small,
        },
        dayOfWeekText: {
          fontSize: 13,
          fontWeight: '500',
          color: theme.colors.textSecondary,
          width: DAY_CELL_SIZE,
          textAlign: 'center',
        },
        calendarGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
        },
        dayCell: {
          width: DAY_CELL_SIZE,
          height: DAY_CELL_SIZE,
          justifyContent: 'center',
          alignItems: 'center',
        },
        dayCellTouchable: {
          width: Math.max(36, DAY_CELL_SIZE - 8),
          height: Math.max(36, DAY_CELL_SIZE - 8),
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: theme.radii.round,
        },
        dayCellSelected: {
          backgroundColor: theme.colors.primary,
        },
        dayCellToday: {
          borderWidth: 1.5,
          borderColor: theme.colors.primary,
        },
        dayCellText: {
          fontSize: 15,
          color: theme.colors.text,
        },
        dayCellTextDimmed: {
          color: theme.colors.textSecondary,
          opacity: 0.5,
        },
        dayCellTextSelected: {
          color: theme.colors.primaryText,
          fontWeight: '600',
        },
        divider: {
          height: 1,
          backgroundColor: theme.colors.border,
          marginHorizontal: theme.spacing.medium,
        },
        timeSection: {
          padding: theme.spacing.medium,
        },
        timeLabel: {
          fontSize: 16,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: theme.spacing.medium,
        },
        timeChipsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.small,
        },
        timeChip: {
          paddingHorizontal: theme.spacing.medium,
          paddingVertical: theme.spacing.small,
          borderRadius: theme.radii.round,
          backgroundColor: theme.colors.secondary,
          marginBottom: theme.spacing.small,
        },
        timeChipActive: {
          backgroundColor: theme.colors.primary,
        },
        timeChipText: {
          fontSize: 14,
          color: theme.colors.text,
          fontWeight: '500',
        },
        timeChipTextActive: {
          color: theme.colors.primaryText,
        },
        customTimeContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 12,
          gap: 6,
          paddingVertical: 16,
          backgroundColor: theme.colors.secondary,
          borderRadius: 12,
        },
        customTimeInput: {
          width: 60,
          height: 54,
          borderRadius: 8,
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontSize: 22,
          textAlign: 'center',
          fontWeight: '700',
        },
        customTimeSeparator: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.textSecondary,
        },
        periodToggleContainer: {
          flexDirection: 'row',
          marginLeft: 12,
          backgroundColor: theme.colors.background,
          borderRadius: 8,
          padding: 4,
        },
        periodButton: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 6,
        },
        periodButtonActive: {
          backgroundColor: theme.colors.primary,
        },
        periodButtonLeft: {
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
        },
        periodButtonRight: {
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
        },
        periodButtonText: {
          fontSize: 14,
          fontWeight: '500',
          color: theme.colors.text,
        },
        periodButtonTextActive: {
          color: theme.colors.primaryText,
        },
      }),
    [theme, isDark]
  );

  const handleCustomTimeFocus = useCallback(() => {
    // Delay to allow keyboard to open first
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={[styles.container, { paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Date & Time</Text>
              <View style={styles.emptyHeaderSpace} />
            </View>

            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Calendar */}
              <View style={styles.calendarContainer}>
                {/* Month Navigation */}
                <View style={styles.monthHeader}>
                  <TouchableOpacity onPress={() => handleMonthChange('prev')} style={styles.monthNavButton}>
                    <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.monthYearText}>{monthYearLabel}</Text>
                  <TouchableOpacity onPress={() => handleMonthChange('next')} style={styles.monthNavButton}>
                    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Days of Week */}
                <View style={styles.daysOfWeekRow}>
                  {DAYS_OF_WEEK.map((day, index) => (
                    <Text key={`${day}-${index}`} style={styles.dayOfWeekText}>
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Calendar Grid */}
                <View style={styles.calendarGrid}>
                  {calendarDays.map((day, index) => {
                    if (!day.date) return <View key={index} style={styles.dayCell} />;

                    const selected = isSelectedDate(day.date);
                    const isDimmed = !day.isCurrentMonth;

                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.dayCell}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedDate(day.date!);
                        }}
                      >
                        <View
                          style={[
                            styles.dayCellTouchable,
                            selected && styles.dayCellSelected,
                            day.isToday && !selected && styles.dayCellToday,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayCellText,
                              isDimmed && styles.dayCellTextDimmed,
                              selected && styles.dayCellTextSelected,
                            ]}
                          >
                            {day.date.getDate()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Quick Date Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.quickChipsContainer}
                contentContainerStyle={{ paddingRight: theme.spacing.medium }}
                keyboardShouldPersistTaps="always"
              >
                {QUICK_DATES.map((quick) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  let quickDate: Date;
                  if (quick.offset === 'nextMonday') {
                    quickDate = new Date(today);
                    const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
                    quickDate.setDate(today.getDate() + daysUntilMonday);
                  } else {
                    quickDate = new Date(today);
                    quickDate.setDate(today.getDate() + quick.offset);
                  }
                  const isActive =
                    selectedDate &&
                    quickDate.getDate() === selectedDate.getDate() &&
                    quickDate.getMonth() === selectedDate.getMonth() &&
                    quickDate.getFullYear() === selectedDate.getFullYear();

                  return (
                    <TouchableOpacity
                      key={quick.label}
                      style={[styles.quickChip, isActive && styles.quickChipActive]}
                      onPress={() => handleQuickDateSelect(quick.offset)}
                    >
                      <Text style={[styles.quickChipText, isActive && styles.quickChipTextActive]}>
                        {quick.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Time Section */}
              <View style={styles.timeSection}>
                <Text style={styles.timeLabel}>Time</Text>
                <View style={styles.timeChipsContainer}>
                  {TIME_OPTIONS.map((time) => {
                    const isActive =
                      time.value === 'custom'
                        ? isCustomTime
                        : selectedTime === time.value;

                    return (
                      <TouchableOpacity
                        key={time.label}
                        style={[styles.timeChip, isActive && styles.timeChipActive]}
                        onPress={() => handleTimeSelect(time.value)}
                      >
                        <Text style={[styles.timeChipText, isActive && styles.timeChipTextActive]}>
                          {time.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Time Input */}
                {isCustomTime && (
                  <View style={styles.customTimeContainer}>
                    <DraggableInput
                      style={styles.customTimeInput}
                      value={customHour}
                      onChange={setCustomHour}
                      min={1}
                      max={12}
                      pad={false}
                      placeholder="9"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                    <Text style={styles.customTimeSeparator}>:</Text>
                    <DraggableInput
                      style={styles.customTimeInput}
                      value={customMinute}
                      onChange={setCustomMinute}
                      min={0}
                      max={59}
                      pad={true}
                      placeholder="00"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                    <View style={styles.periodToggleContainer}>
                      <TouchableOpacity
                        style={[
                          styles.periodButton,
                          styles.periodButtonLeft,
                          customPeriod === 'AM' && styles.periodButtonActive,
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setCustomPeriod('AM');
                        }}
                      >
                        <Text
                          style={[
                            styles.periodButtonText,
                            customPeriod === 'AM' && styles.periodButtonTextActive,
                          ]}
                        >
                          AM
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.periodButton,
                          styles.periodButtonRight,
                          customPeriod === 'PM' && styles.periodButtonActive,
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setCustomPeriod('PM');
                        }}
                      >
                        <Text
                          style={[
                            styles.periodButtonText,
                            customPeriod === 'PM' && styles.periodButtonTextActive,
                          ]}
                        >
                          PM
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity onPress={handleConfirm} style={styles.bottomDoneButton}>
              <Text style={styles.bottomDoneText}>Confirm</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
