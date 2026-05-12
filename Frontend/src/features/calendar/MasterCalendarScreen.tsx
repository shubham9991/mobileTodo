/**
 * MasterCalendarScreen — Unified Hub for all calendar views.
 * Schedule / Day / 3-Day / Week / Month with full interactions.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import {
  format, addDays, addWeeks, addMonths,
  subDays, subWeeks, subMonths,
  startOfWeek, endOfWeek, startOfMonth,
} from 'date-fns';
import { useTheme } from '../../themes/ThemeContext';
import { TopNavbar } from '../../layout/TopNavbar';
import { BottomNavbar } from '../../layout/BottomNavbar';
import { FABMenu } from '../../core/components/FABMenu';
import { useFabBottom } from '../../core/hooks/useFabBottom';
import { useCalendarData, CalendarItem } from '../../core/hooks/useCalendarData';
import { ScheduleView } from './views/ScheduleView';
import { TimeGridView } from './views/TimeGridView';
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
  const today = new Date(anchor);
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
  const d = new Date(anchor);
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
  const d = new Date(anchor);
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

  // Detail sheet state
  const [detailItem, setDetailItem] = useState<CalendarItem | null>(null);
  // Task detail state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Day overflow sheet state
  const [overflowDay, setOverflowDay] = useState<string | null>(null);

  // Composer state
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerDate, setComposerDate] = useState('');
  const [composerTime, setComposerTime] = useState('');

  const { start, end, days } = useMemo(() => getRange(anchor, viewMode), [anchor, viewMode]);
  const { getItemsForDate } = useCalendarData(start, end);

  const goBack = () => setAnchor(prev => navigate(prev, viewMode, -1));
  const goForward = () => setAnchor(prev => navigate(prev, viewMode, 1));
  const goToday = () => { setAnchor(todayISO); setSelectedISO(todayISO); };

  const handleSlotPress = useCallback((iso: string, time?: string) => {
    setComposerDate(iso);
    setComposerTime(time || '');
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

  // Month view: selecting a day navigates Day view (single tap on number)
  const handleMonthDaySelect = useCallback((iso: string) => {
    setSelectedISO(iso);
    // Double-intent: switch to day view for that date
    setAnchor(iso);
    setViewMode('day');
  }, []);

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
            getItemsForDate={getItemsForDate}
            onItemPress={handleItemPress}
            onSlotPress={handleSlotPress}
          />
        )}
        {(viewMode === 'day' || viewMode === '3day' || viewMode === 'week') && (
          <TimeGridView
            days={days}
            getItemsForDate={getItemsForDate}
            onItemPress={handleItemPress}
            onSlotPress={handleSlotPress}
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
        onClose={() => { setComposerVisible(false); setComposerDate(''); setComposerTime(''); }}
        onSave={(task) => { handleComposerSave(task); setComposerVisible(false); }}
        initialDueDate={composerDate}
        initialDueTime={composerTime}
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
