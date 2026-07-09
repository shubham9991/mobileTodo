import React, { useState, useCallback, useMemo } from 'react';
import { 
  ScrollView, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions,
  FlatList,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { format, addDays } from 'date-fns';
import { useTheme } from '../../themes/ThemeContext';
import { useDashboard, DashboardView, ProjectNode, getDescendantNodeIds } from '../../core/DashboardContext';
import { TopNavbar } from '../../layout/TopNavbar';
import { BottomNavbar } from '../../layout/BottomNavbar';
import { useFabBottom } from '../../core/hooks/useFabBottom';
import { FABMenu } from '../../core/components/FABMenu';

// Existing Widget Components
import { HeroWidgetSection } from './HeroWidgetSection';
import { CategoryTabs } from './CategoryTabs';
import { RecentNotes } from './RecentNotes';
import { Upcoming } from './Upcoming';

// New Custom Components
import { FolderTree } from './FolderTree';
import { ViewConfigModal } from './ViewConfigModal';
import { DashboardPager } from './DashboardPager';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Priority ranking for sorting
const PRIORITY_ORDER: Record<string, number> = { HIGH: 3, MED: 2, LOW: 1 };

// ─── Memoized Task Card ──────────────────────────────────────────────────────
// Extracted outside Dashboard so React.memo works correctly.
// onToggle is stable (useCallback in parent), so the card only re-renders
// when its own task data changes — not when any other task is toggled.
interface TaskCardProps {
  task: any;
  compact?: boolean;
  onToggle: (id: string) => void;
  theme: any;
}

const TaskCard = React.memo(({ task, compact = false, onToggle, theme }: TaskCardProps) => {
  const handlePress = useCallback(() => onToggle(task.id), [task.id, onToggle]);

  return (
    <View
      style={[
        cardStyles.taskCard,
        { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
        compact && { padding: 10, marginHorizontal: 0 }
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        style={[
          cardStyles.checkbox,
          { borderColor: task.completed ? theme.colors.primary : theme.colors.border },
          task.completed && { backgroundColor: theme.colors.primary }
        ]}
      >
        {task.completed && (
          <MaterialIcons name="check" size={11} color={theme.colors.primaryText} />
        )}
      </TouchableOpacity>

      <View style={cardStyles.cardContent}>
        <Text
          style={[
            cardStyles.cardTitle,
            {
              color: task.completed ? theme.colors.textSecondary : theme.colors.text,
              fontFamily: 'Inter_500Medium',
              textDecorationLine: task.completed ? 'line-through' : 'none'
            },
            compact && { fontSize: 13 }
          ]}
        >
          {task.title}
        </Text>
        <View style={cardStyles.cardMetaRow}>
          {task.priority && (
            <View style={[cardStyles.priorityPill, {
              backgroundColor: task.priority === 'HIGH' ? theme.colors.dangerBg : theme.colors.warningBg
            }]}>
              <Text style={{
                color: task.priority === 'HIGH' ? theme.colors.danger : theme.colors.warning,
                fontSize: 9,
                fontWeight: '600'
              }}>
                {task.priority}
              </Text>
            </View>
          )}
          {task.tag && !compact && (
            <Text style={[cardStyles.tagText, { color: theme.colors.textSecondary }]}>
              #{task.tag}
            </Text>
          )}
          {task.dueDate && !compact && (
            <View style={cardStyles.dateMeta}>
              <MaterialIcons name="schedule" size={11} color={theme.colors.textSecondary} />
              <Text style={[cardStyles.dateText, { color: theme.colors.textSecondary }]}>
                {task.dueDate}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

// Shared styles for TaskCard (outside component so they're never recreated)
const cardStyles = StyleSheet.create({
  taskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, marginBottom: 6, lineHeight: 20 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 11 },
  dateMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 11 },
});

// ─── Memoized Animated Calendar Day Cell ──────────────────────────────────────
// Design from user's sketch:
//   • Days WITH tasks  → faint track outer border + dark inner card + white number.
//     As tasks are completed, the outer border animates from thin (0) → thick (3).
//   • Days WITHOUT tasks → plain date number (selected = solid primary bg).
interface CalendarDayCellProps {
  day: Date;
  dayIndex: number;
  isSelected: boolean;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFirstOfMonth: boolean;
  dayTasks: any[];
  theme: any;
  onPress: (dateStr: string) => void;
}

const CalendarDayCell = React.memo(({
  day, dayIndex, isSelected, isCurrentMonth, isToday, isFirstOfMonth,
  dayTasks, theme, onPress,
}: CalendarDayCellProps) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  const completedCount = dayTasks.filter(t => t.completed).length;
  const totalCount = dayTasks.length;
  const ratio = totalCount === 0 ? 0 : completedCount / totalCount;
  const hasTasks = totalCount > 0;

  // Animate a single progress value 0 → 1 whenever ratio changes
  const progressAnim = React.useRef(new Animated.Value(ratio)).current;
  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: ratio,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [ratio]);

  // The active border width grows from 0 (nothing complete) to 3 (all complete)
  const animBorderWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 3],
    extrapolate: 'clamp',
  });

  const primary  = theme.colors.primary;
  const priText  = theme.colors.primaryText;
  const textCol  = isCurrentMonth ? theme.colors.text : theme.colors.textSecondary;
  const trackCol = `${theme.colors.border}55`;
  const ff = isToday && !isSelected ? 'Inter_700Bold'
           : isSelected             ? 'Inter_600SemiBold'
           :                          'Inter_400Regular';

  // ── Days WITHOUT tasks ── plain date chip ──────────────────────────────────
  if (!hasTasks) {
    return (
      <TouchableOpacity
        key={dayIndex}
        onPress={() => onPress(dateStr)}
        activeOpacity={0.7}
        style={[cellStyles.cell, isSelected && { backgroundColor: primary }]}
      >
        {isFirstOfMonth && !isCurrentMonth ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 7, color: isSelected ? priText : theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', opacity: 0.8 }}>
              {format(day, 'MMM')}
            </Text>
            <Text style={{ fontSize: 10, color: isSelected ? priText : theme.colors.textSecondary, fontFamily: 'Inter_400Regular', lineHeight: 12 }}>
              1
            </Text>
          </View>
        ) : (
          <Text style={[cellStyles.dayText, { color: isSelected ? priText : textCol, fontFamily: ff }]}>
            {format(day, 'd')}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  // ── Days WITH tasks ── faint track + animated growing border + dark inner card
  return (
    <TouchableOpacity
      key={dayIndex}
      onPress={() => onPress(dateStr)}
      activeOpacity={0.8}
      style={[
        cellStyles.cell,
        // Faint static track shows the outline shape at all times
        { borderWidth: 1, borderColor: isSelected ? primary : trackCol },
      ]}
    >
      {/* Animated active border — grows thicker as tasks complete */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { borderRadius: 8, borderWidth: animBorderWidth, borderColor: primary },
        ]}
      />

      {/* Inner solid dark card — always present for task days */}
      <View style={[cellStyles.innerCard, { backgroundColor: primary }]}>
        {isFirstOfMonth && !isCurrentMonth ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 7, color: priText, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', opacity: 0.8 }}>
              {format(day, 'MMM')}
            </Text>
            <Text style={{ fontSize: 10, color: priText, fontFamily: 'Inter_400Regular', lineHeight: 12 }}>
              1
            </Text>
          </View>
        ) : (
          <Text style={[cellStyles.dayText, { color: priText, fontFamily: isToday ? 'Inter_700Bold' : 'Inter_400Regular' }]}>
            {format(day, 'd')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

const cellStyles = StyleSheet.create({
  cell: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inner dark card — 4 px inset from outer border so the growing border is clearly visible
  innerCard: {
    position: 'absolute',
    top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13.5,
    lineHeight: 16,
    textAlign: 'center',
  },
});








export const Dashboard = () => {
  const { theme } = useTheme();
  const { 
    views, 
    activeViewIndex, 
    setActiveViewIndex,
    nodes, 
    taskGroups, 
    updateTask 
  } = useDashboard();
  
  const fabBottom = useFabBottom();

  // Memoized flat list of all tasks for quick status lookup and calendar cell progress indicators
  const allTasks = React.useMemo(() => {
    return taskGroups.reduce<any[]>((acc, group) => [...acc, ...group.tasks], []);
  }, [taskGroups]);
  
  // Modal states
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedViewToEdit, setSelectedViewToEdit] = useState<DashboardView | null>(null);

  // Helper to calculate first day of grid (Monday of the week containing month start)
  const getGridStartDateForDate = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = firstDay.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - diffToMonday);
    return format(startDate, 'yyyy-MM-dd');
  };

  // Calendar strip selected date state
  const [selectedCalDate, setSelectedCalDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isCalExpanded, setIsCalExpanded] = useState(false);
  const [currentVisibleMonthYear, setCurrentVisibleMonthYear] = useState(() => format(new Date(), 'MMMM yyyy'));

  // Calendar static anchor reference (so lists don't regenerate on date selection, keeping scrolling stable)
  const calendarAnchorDate = React.useRef(new Date());

  // Generate 101 weeks (50 in past, 50 in future) for smooth native physics infinite scrolling
  const weeksData = React.useMemo(() => {
    const anchor = calendarAnchorDate.current;
    let dayOfWeek = anchor.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const anchorMonday = new Date(anchor);
    anchorMonday.setDate(anchor.getDate() + diffToMonday);

    const list: { id: string; days: Date[] }[] = [];
    for (let w = -50; w <= 50; w++) {
      const weekMonday = new Date(anchorMonday);
      weekMonday.setDate(anchorMonday.getDate() + w * 7);
      
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekMonday);
        d.setDate(weekMonday.getDate() + i);
        days.push(d);
      }
      
      list.push({
        id: format(weekMonday, 'yyyy-MM-dd'),
        days,
      });
    }
    return list;
  }, []);

  // Compute FlatList week index corresponding to a selected date
  const getWeekIndex = React.useCallback((dateStr: string) => {
    try {
      const targetDate = new Date(dateStr + 'T00:00:00');
      const anchor = calendarAnchorDate.current;
      let dayOfWeek = anchor.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const anchorMonday = new Date(anchor);
      anchorMonday.setDate(anchor.getDate() + diffToMonday);

      const diffTime = targetDate.getTime() - anchorMonday.getTime();
      const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
      return Math.max(0, Math.min(100, 50 + diffWeeks));
    } catch {
      return 50;
    }
  }, []);

  const verticalListRef = React.useRef<FlatList>(null);
  const horizontalListRef = React.useRef<FlatList>(null);

  // Sync FlatList scroll offset whenever the expansion toggle changes
  React.useEffect(() => {
    if (isCalExpanded) {
      setTimeout(() => {
        verticalListRef.current?.scrollToIndex({
          index: getWeekIndex(selectedCalDate),
          animated: false,
          viewPosition: 0.5,
        });
      }, 80);
    } else {
      setTimeout(() => {
        horizontalListRef.current?.scrollToIndex({
          index: getWeekIndex(selectedCalDate),
          animated: false,
          viewPosition: 0.5,
        });
      }, 80);
    }
  }, [isCalExpanded]);

  // Update calendar header month dynamically when scrolling vertical grid
  const handleVerticalScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const visibleIndex = Math.round(y / 46); // Cell height 40 + marginBottom 6
    const targetWeekIndex = Math.max(0, Math.min(100, visibleIndex + 2));
    const week = weeksData[targetWeekIndex];
    if (week) {
      const middleDay = week.days[3];
      setCurrentVisibleMonthYear(format(middleDay, 'MMMM yyyy'));
    }
  };

  // Sync selected date when paging through horizontal week strip
  const handleHorizontalScrollEnd = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    const week = weeksData[index];
    if (week) {
      const currentSelectedDay = new Date(selectedCalDate + 'T00:00:00').getDay();
      const newDayIndex = currentSelectedDay === 0 ? 6 : currentSelectedDay - 1;
      const targetDay = week.days[newDayIndex];
      setSelectedCalDate(format(targetDay, 'yyyy-MM-dd'));
    }
  };

  const activeView = views[activeViewIndex] || views[0];

  // ─── Task Resolution and Filtering ─────────────────────────────────────────
  const resolveViewTasks = (view: DashboardView) => {
    // Flatten tasks across groups (Today, This Week, Completed)
    const allTasks = taskGroups.reduce<any[]>((acc, group) => [...acc, ...group.tasks], []);
    
    // Resolve child nodes recursively if source scope filter is active
    const scopeNodeIds = view.filterSourceNodeId 
      ? getDescendantNodeIds(nodes, view.filterSourceNodeId) 
      : [];

    return allTasks.filter(task => {
      // 1. Completed state
      if (!view.showCompleted && task.completed) return false;

      // 2. Folder scope
      if (view.filterSourceNodeId && (!task.nodeId || !scopeNodeIds.includes(task.nodeId))) {
        return false;
      }

      // 3. Priority scope
      if (view.filterPriorities.length > 0 && task.priority) {
        if (!view.filterPriorities.includes(task.priority)) return false;
      }

      // 4. Tags scope
      if (view.filterTags.length > 0) {
        if (!task.tagType || !view.filterTags.includes(task.tagType)) return false;
      }

      return true;
    });
  };

  // ─── Task Sorting ──────────────────────────────────────────────────────────
  const sortTasks = (tasks: any[], sorting: DashboardView['sorting']) => {
    return [...tasks].sort((a, b) => {
      if (sorting === 'dueDate') {
        const dateA = a.dueDate || '9999-99-99';
        const dateB = b.dueDate || '9999-99-99';
        return dateA.localeCompare(dateB);
      }
      if (sorting === 'priority') {
        const valA = PRIORITY_ORDER[a.priority || ''] || 0;
        const valB = PRIORITY_ORDER[b.priority || ''] || 0;
        return valB - valA;
      }
      if (sorting === 'alphabetical') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });
  };

  // ─── Rendering Layout Views ────────────────────────────────────────────────
  const renderListLayout = (tasks: any[], view: DashboardView) => {
    const sorted = sortTasks(tasks, view.sorting);
    
    // 1. Group tasks if grouping setting is enabled
    if (view.grouping !== 'none') {
      const groups: Record<string, any[]> = {};
      
      sorted.forEach(t => {
        let key = 'Other';
        if (view.grouping === 'priority') key = t.priority || 'No Priority';
        else if (view.grouping === 'tag') key = t.tag || 'Unlabeled';
        else if (view.grouping === 'project') key = nodes[t.nodeId]?.name || 'Inbox';
        else if (view.grouping === 'dueDate') key = t.dueDate || 'Backlog';

        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });

      return Object.keys(groups).map(groupName => (
        <View key={groupName} style={styles.groupContainer}>
          <Text style={[styles.groupHeader, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
            {groupName.toUpperCase()} ({groups[groupName].length})
          </Text>
          {groups[groupName].map(t => renderTaskCard(t))}
        </View>
      ));
    }

    // 2. Plain List
    return (
      <View style={styles.listContainer}>
        {sorted.map(t => renderTaskCard(t))}
        {sorted.length === 0 && renderEmptyState()}
      </View>
    );
  };

  // ─── Week Row Renderer (pulled out so useCallback FlatList helpers can call it) ───
  // ─── Stable select date callback ───
  const handleSelectCalDate = useCallback((dateStr: string) => {
    setSelectedCalDate(dateStr);
    Haptics.selectionAsync().catch(() => {});
  }, []);

  // ─── Week Row Renderer (passes data to memoized CalendarDayCell) ───
  const renderWeekRowMemo = useCallback((rowDays: Date[], middleDate: Date) => {
    const today = format(new Date(), 'yyyy-MM-dd');

    return (
      <View style={styles.calWidgetRow}>
        {rowDays.map((day, dayIndex) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isSelected = selectedCalDate === dateStr;
          const isCurrentMonth = day.getMonth() === middleDate.getMonth();
          const isToday = today === dateStr;
          const isFirstOfMonth = day.getDate() === 1;

          // Filter day's tasks
          const dayTasks = allTasks.filter(t => {
            if (!t.dueDate) return false;
            let formattedDue = t.dueDate;
            if (t.dueDate === 'Today') formattedDue = format(new Date(), 'yyyy-MM-dd');
            else if (t.dueDate === 'Tomorrow') formattedDue = format(addDays(new Date(), 1), 'yyyy-MM-dd');
            return formattedDue === dateStr;
          });

          return (
            <CalendarDayCell
              key={dayIndex}
              day={day}
              dayIndex={dayIndex}
              isSelected={isSelected}
              isCurrentMonth={isCurrentMonth}
              isToday={isToday}
              isFirstOfMonth={isFirstOfMonth}
              dayTasks={dayTasks}
              theme={theme}
              onPress={handleSelectCalDate}
            />
          );
        })}
      </View>
    );
  }, [allTasks, selectedCalDate, theme, handleSelectCalDate]);

  // ─── Stable FlatList helpers (must be useCallback so FlatList skips re-renders) ───
  const weekKeyExtractor = useCallback((item: { id: string }) => item.id, []);
  const verticalGetItemLayout = useCallback((_: any, index: number) => ({ length: 46, offset: 46 * index, index }), []);
  const horizontalGetItemLayout = useCallback((_: any, index: number) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index }), []);

  const verticalRenderItem = useCallback(({ item }: { item: { id: string; days: Date[] } }) => {
    const baseDate = new Date(selectedCalDate + 'T00:00:00');
    return renderWeekRowMemo(item.days, baseDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCalDate, allTasks]);

  const horizontalRenderItem = useCallback(({ item }: { item: { id: string; days: Date[] } }) => {
    const baseDate = new Date(selectedCalDate + 'T00:00:00');
    return (
      <View style={{ width: SCREEN_WIDTH }}>
        {renderWeekRowMemo(item.days, baseDate)}
      </View>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCalDate, allTasks]);

  // ─── Unified Premium Calendar Widget ───
  const renderCalendarWidget = () => {
    const baseDate = new Date(selectedCalDate + 'T00:00:00');
    const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    return (
      <View style={[styles.calWidgetContainer, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          style={styles.calWidgetHeader} 
          onPress={() => setIsCalExpanded(!isCalExpanded)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.calWidgetMonthText, 
            { color: isCalExpanded ? '#E53935' : theme.colors.text }
          ]}>
            {isCalExpanded ? currentVisibleMonthYear : format(baseDate, 'MMMM yyyy')}
          </Text>
          <MaterialIcons 
            name={isCalExpanded ? 'arrow-drop-up' : 'arrow-drop-down'} 
            size={24} 
            color={isCalExpanded ? '#E53935' : theme.colors.textSecondary} 
          />
        </TouchableOpacity>
        <View style={[styles.calWidgetWeekdaysRow, { borderBottomColor: theme.colors.border }]}>
          {weekdays.map((wd, i) => {
            const isWeekend = i === 5 || i === 6;
            return (
              <Text 
                key={i} 
                style={[
                  styles.calWidgetWeekdayText, 
                  { 
                    color: isWeekend ? theme.colors.textSecondary : theme.colors.text,
                    opacity: isWeekend ? 0.5 : 0.8 
                  }
                ]}
              >
                {wd}
              </Text>
            );
          })}
        </View>

        {isCalExpanded ? (
          /* Expanded: Vertical FlatList supporting native momentum scroll & row snapping */
          <FlatList
            ref={verticalListRef}
            data={weeksData}
            renderItem={verticalRenderItem}
            keyExtractor={weekKeyExtractor}
            getItemLayout={verticalGetItemLayout}
            initialScrollIndex={getWeekIndex(selectedCalDate)}
            onScroll={handleVerticalScroll}
            scrollEventThrottle={16}
            snapToInterval={46}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            style={{ height: 276 }}
          />
        ) : (
          /* Collapsed: Horizontal FlatList with paging support */
          <FlatList
            ref={horizontalListRef}
            data={weeksData}
            horizontal
            pagingEnabled
            renderItem={horizontalRenderItem}
            keyExtractor={weekKeyExtractor}
            getItemLayout={horizontalGetItemLayout}
            initialScrollIndex={getWeekIndex(selectedCalDate)}
            onMomentumScrollEnd={handleHorizontalScrollEnd}
            showsHorizontalScrollIndicator={false}
          />
        )}

        <TouchableOpacity 
          style={styles.calWidgetDragHandleContainer}
          onPress={() => setIsCalExpanded(!isCalExpanded)}
          activeOpacity={0.8}
        >
          <View style={[styles.calWidgetDragHandle, { backgroundColor: theme.colors.border }]} />
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Horizontal Tabs for View Switcher when Pager is disabled ───
  const renderViewTabs = () => {
    return (
      <View style={[styles.tabsRowContainer, { borderBottomColor: theme.colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRowScroll}>
          {views.map((v, index) => {
            const isActive = index === activeViewIndex;
            return (
              <TouchableOpacity
                key={v.id}
                style={[
                  styles.tabChip,
                  { backgroundColor: isActive ? theme.colors.primary : theme.colors.secondary }
                ]}
                onPress={() => {
                  setActiveViewIndex(index);
                  Haptics.selectionAsync().catch(() => {});
                }}
              >
                <Text style={[
                  styles.tabChipText,
                  { color: isActive ? '#fff' : theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }
                ]}>
                  {v.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderCalendarLayout = (tasks: any[]) => {
    const dayTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      let formattedDue = t.dueDate;
      if (t.dueDate === 'Today') formattedDue = format(new Date(), 'yyyy-MM-dd');
      else if (t.dueDate === 'Tomorrow') formattedDue = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      
      return formattedDue === selectedCalDate;
    });

    return (
      <View style={{ flex: 1, flexDirection: 'column' }}>
        {/* Calendar widget is OUTSIDE the ScrollView — no gesture conflicts */}
        {renderCalendarWidget()}

        {/* Tasks list scrolls independently below the calendar */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.calendarList, { paddingHorizontal: 16, paddingBottom: 80 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.calendarListHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.calendarListTitle, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
              Overdue
            </Text>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#E53935', fontSize: 13, marginRight: 4 }}>Reschedule</Text>
              <MaterialIcons name="expand-more" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {dayTasks.map(t => renderTaskCard(t))}
          {dayTasks.length === 0 && (
            <View style={styles.calEmptyState}>
              <MaterialIcons name="event-busy" size={32} color={theme.colors.textSecondary} />
              <Text style={[styles.calEmptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                No tasks scheduled for this day
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };


  // ─── Stable toggle callback — identity only changes when updateTask changes ───
  const handleToggleTask = useCallback((taskId: string) => {
    updateTask(taskId, t => ({ ...t, completed: !t.completed }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [updateTask]);

  // ─── Single Task Card UI (delegates to memoized TaskCard component) ───
  const renderTaskCard = (task: any, compact = false) => (
    <TaskCard
      key={task.id}
      task={task}
      compact={compact}
      onToggle={handleToggleTask}
      theme={theme}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <MaterialIcons name="done-all" size={32} color={theme.colors.textSecondary} style={{ marginBottom: 8 }} />
      <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }}>
        No tasks meet your filters!
      </Text>
    </View>
  );

  // ─── Rendering Single Page Content ─────────────────────────────────────────
  const renderPageView = (view: DashboardView) => {
    const resolvedTasks = resolveViewTasks(view);

    // Calendar layout: use flex View (not ScrollView) so calendar widget owns vertical gestures
    if (view.layout === 'calendar') {
      return (
        <View style={{ flex: 1 }}>
          {renderCalendarLayout(resolvedTasks)}
        </View>
      );
    }

    // All other layouts: master vertical ScrollView
    return (
      <ScrollView 
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        style={{ flex: 1 }}
      >
        {/* Dynamic Display settings pill trigger */}
        <TouchableOpacity 
          style={[styles.configTriggerPill, { backgroundColor: theme.colors.secondary }]}
          onPress={() => {
            setSelectedViewToEdit(view);
            setShowSettings(true);
          }}
        >
          <MaterialIcons name="tune" size={15} color={theme.colors.primary} />
          <Text style={[styles.configTriggerText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
            Layout: {view.layout.toUpperCase()} • Grouping: {view.grouping.toUpperCase()} • Edit
          </Text>
        </TouchableOpacity>

        {/* Render widgets in their configured order */}
        {view.widgets.map((widget) => {
          if (!widget.visible) return null;
          
          switch (widget.id) {
            case 'hero':
              return <HeroWidgetSection key="hero" />;
            case 'tabs':
              return <CategoryTabs key="tabs" />;
            case 'notes':
              return <RecentNotes key="notes" />;
            case 'upcoming':
              return <Upcoming key="upcoming" />;
            case 'tasks':
              return (
                <View key="tasks" style={styles.workspaceSection}>
                  <View style={styles.workspaceHeader}>
                    <Text style={[styles.workspaceTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                      {view.name.toUpperCase()} WORKSPACE
                    </Text>
                    <Text style={[styles.workspaceCount, { color: theme.colors.textSecondary }]}>
                      {resolvedTasks.length} tasks
                    </Text>
                  </View>
                  {renderListLayout(resolvedTasks, view)}
                </View>
              );
            default:
              return null;
          }
        })}
      </ScrollView>
    );
  };


  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* Top Navigation Navbar with Menu sidebar trigger */}
      <TopNavbar onPressMenu={() => setShowSidebar(true)} />

      {/* Render horizontal tabs for views if pagination is OFF */}
      {activeView.layout !== 'paged' && renderViewTabs()}

      {/* Swipe Pager content */}
      <View style={{ flex: 1 }}>
        {activeView.layout === 'paged' ? (
          <DashboardPager 
            renderPageView={renderPageView}
            onPressAddView={() => {
              setSelectedViewToEdit(activeView);
              setShowSettings(true);
            }}
          />
        ) : (
          renderPageView(activeView)
        )}
      </View>

      <FABMenu bottom={fabBottom} />

      <BottomNavbar />

      {/* Slideout Collapsible project tree sidebar drawer */}
      <FolderTree 
        visible={showSidebar} 
        onClose={() => setShowSidebar(false)} 
      />

      {/* Bottom Sheet Display View Configurations modal */}
      {selectedViewToEdit && (
        <ViewConfigModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          view={selectedViewToEdit}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  configTriggerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  configTriggerText: {
    fontSize: 11,
  },
  workspaceSection: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  workspaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  workspaceTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  workspaceCount: {
    fontSize: 11,
  },
  listContainer: {
    gap: 6,
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupHeader: {
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 4,
  },
  


  // Custom Calendar Strip Styling
  calStripContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 16,
    marginBottom: 16,
  },
  calStripScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  calStripDay: {
    width: 52,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  calStripDaySelected: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  calStripDayName: {
    fontSize: 9,
  },
  calStripDayNum: {
    fontSize: 15,
  },
  calendarContainer: {
    flex: 1,
  },
  calendarHeader: {
    marginBottom: 12,
  },
  calendarTitle: {
    fontSize: 14,
  },
  calendarList: {
    gap: 6,
  },
  calEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  calEmptyText: {
    fontSize: 13,
  },

  // Task Card
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginBottom: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 14,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
  },
  dateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  // Unified Premium Calendar Widget Styling
  calWidgetContainer: {
    paddingTop: 16,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  calWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  calWidgetMonthText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginRight: 4,
  },
  calWidgetWeekdaysRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  calWidgetWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: 'Inter_600SemiBold',
    marginHorizontal: 2,
    letterSpacing: 0.8,
  },
  calWidgetDatesContainer: {
    paddingHorizontal: 4,
  },
  calWidgetRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  calWidgetDayCell: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  calWidgetDayText: {
    lineHeight: 18,
  },
  calWidgetDragHandleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  calWidgetDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  calendarListHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarListTitle: {
    fontSize: 15,
  },
  // View Switcher Tab Styling
  tabsRowContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  tabsRowScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabChipText: {
    fontSize: 12,
  },
});
