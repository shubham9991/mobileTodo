/**
 * useCalendarData - Unified data hook for MasterCalendarScreen.
 * Merges Tasks (including multi-day ranges), regional Holidays, and Birthdays.
 */
import { useMemo, useCallback } from 'react';
import { format, parseISO, eachDayOfInterval, isValid, addDays } from 'date-fns';
import { useManage } from '../ManageContext';
import { useDashboard } from '../DashboardContext';

// ─── Types ────────────────────────────────────────────────────────────────────
export type CalendarItemType = 'task' | 'holiday' | 'birthday';

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  date: string;        // ISO yyyy-MM-dd of this occurrence
  startDate: string;   // ISO of first day
  endDate?: string;    // ISO of last day (multi-day tasks)
  time?: string;
  dueEndTime?: string;
  color: string;
  tag?: string;
  tagType?: string;
  taskId?: string;     // original task id for actions
  completed?: boolean;
  isAllDay: boolean;
  isRangeStart?: boolean;
  isRangeEnd?: boolean;
  isRangeMid?: boolean;
}

// ─── Tag Color Map ─────────────────────────────────────────────────────────────
export const TAG_COLORS: Record<string, string> = {
  work: '#6366F1',
  personal: '#8B5CF6',
  health: '#22C55E',
  learning: '#EC4899',
  review: '#F97316',
  holiday: '#EF4444',
  birthday: '#F59E0B',
};

// ─── Utility: Parse various date string formats to ISO ───────────────────────
export function toISO(dateStr?: string): string | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const today = new Date();
  const lower = dateStr.toLowerCase();
  if (lower === 'today') return format(today, 'yyyy-MM-dd');
  if (lower === 'tomorrow') return format(addDays(today, 1), 'yyyy-MM-dd');
  // Try "Mon, Apr 28" style
  const attempt = new Date(`${dateStr}, ${today.getFullYear()}`);
  if (isValid(attempt)) return format(attempt, 'yyyy-MM-dd');
  // Try "Apr 28" style
  const attempt2 = new Date(`${dateStr} ${today.getFullYear()}`);
  if (isValid(attempt2)) return format(attempt2, 'yyyy-MM-dd');
  return null;
}

// ─── Main Hook ────────────────────────────────────────────────────────────────
export function useCalendarData(startISO: string, endISO: string): {
  itemsByDate: Record<string, CalendarItem[]>;
  allItems: CalendarItem[];
  getItemsForDate: (iso: string) => CalendarItem[];
} {
  const { tags, calendarMarkings, birthdays } = useManage();
  const { taskGroups } = useDashboard();

  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = { ...TAG_COLORS };
    tags.forEach(t => { map[t.id] = t.color; });
    return map;
  }, [tags]);

  const allItems = useMemo(() => {
    const items: CalendarItem[] = [];
    const rangeStart = parseISO(startISO);
    const rangeEnd = parseISO(endISO);
    if (!isValid(rangeStart) || !isValid(rangeEnd)) return items;

    // ── 1. Tasks ──────────────────────────────────────────────────────────────
    const allTasks = taskGroups.flatMap(g => g.tasks);
    allTasks.forEach(task => {
      const taskStartISO = toISO(task.dueDate);
      if (!taskStartISO) return;
      const taskEndISO = task.dueEndDate ? toISO(task.dueEndDate) : taskStartISO;
      if (!taskEndISO) return;

      const tagId = task.tagType ?? 'personal';
      const tagSetting = calendarMarkings.find(m => m.tagId === tagId);
      if (tagSetting && !tagSetting.visible) return;
      const color = tagColorMap[tagId] ?? TAG_COLORS.work;

      const isMultiDay = taskStartISO !== taskEndISO;
      const taskStart = parseISO(taskStartISO);
      const taskEnd = parseISO(taskEndISO);
      if (!isValid(taskStart) || !isValid(taskEnd)) return;

      const daysInRange = isMultiDay
        ? eachDayOfInterval({ start: taskStart, end: taskEnd })
        : [taskStart];

      daysInRange.forEach((day, idx) => {
        const dayISO = format(day, 'yyyy-MM-dd');
        if (dayISO < startISO || dayISO > endISO) return;

        items.push({
          id: `task-${task.id}-${dayISO}`,
          taskId: task.id,
          type: 'task',
          title: task.title,
          date: dayISO,
          startDate: taskStartISO,
          endDate: isMultiDay ? taskEndISO : undefined,
          time: task.dueTime,
          dueEndTime: task.dueEndTime,
          color,
          tag: task.tag,
          tagType: tagId,
          completed: task.completed,
          isAllDay: !task.dueTime && !task.dueEndTime,
          isRangeStart: isMultiDay ? idx === 0 : undefined,
          isRangeMid: isMultiDay ? (idx > 0 && idx < daysInRange.length - 1) : undefined,
          isRangeEnd: isMultiDay ? idx === daysInRange.length - 1 : undefined,
        });
      });
    });

    // ── 2. Birthdays ─────────────────────────────────────────────────────────
    if (birthdays && birthdays.length > 0) {
      birthdays.forEach(b => {
        const [month, day] = b.date.split('-');
        const years = new Set<number>();
        for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) years.add(y);

        years.forEach(year => {
          const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          if (iso < startISO || iso > endISO) return;
          items.push({
            id: `bday-${b.id}-${iso}`,
            type: 'birthday',
            title: `${b.name}'s Birthday`,
            date: iso,
            startDate: iso,
            color: TAG_COLORS.birthday,
            isAllDay: true,
          });
        });
      });
    }

    // Sort: holidays/birthdays first (all-day), then timed items by time
    return items.sort((a, b) => {
      // Type priority: birthday=0, holiday=1, task=2
      const typePri = (x: CalendarItem) =>
        x.type === 'birthday' ? 0 : x.type === 'holiday' ? 1 : 2;
      if (typePri(a) !== typePri(b)) return typePri(a) - typePri(b);
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      return 0;
    });
  }, [taskGroups, calendarMarkings, tagColorMap, startISO, endISO, birthdays]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    allItems.forEach(item => {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    });
    return map;
  }, [allItems]);

  // Stable callback reference — won't cause child re-renders
  const getItemsForDate = useCallback(
    (iso: string) => itemsByDate[iso] ?? [],
    [itemsByDate]
  );

  return { itemsByDate, allItems, getItemsForDate };
}

// ─── Conflict Detection ───────────────────────────────────────────────────────
export function detectConflicts(
  items: CalendarItem[],
  newStartTime: string,
  newDate: string
): CalendarItem[] {
  return items.filter(item => {
    if (item.date !== newDate || !item.time || !newStartTime) return false;
    return item.time === newStartTime;
  });
}
