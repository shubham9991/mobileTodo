import React, { createContext, useContext, useState, ReactNode } from 'react';
import { format, addDays, parse, isValid } from 'date-fns';
import { dummyData, Task } from './dummyData';

// ─── Types ────────────────────────────────────────────────────────────────────
export type SectionId = 'hero' | 'tabs' | 'tasks' | 'notes' | 'upcoming';
export type LayoutMode = 'compact' | 'comfortable' | 'expanded';

export const SECTION_META: Record<SectionId, { label: string; icon: string }> = {
  hero: { label: 'Hero Widget', icon: 'bolt' },
  tabs: { label: 'Category Tabs', icon: 'tab' },
  tasks: { label: "Today's Tasks", icon: 'task-alt' },
  notes: { label: 'Recent Notes', icon: 'description' },
  upcoming: { label: 'Upcoming', icon: 'calendar-month' },
};

export const DEFAULT_ORDER: SectionId[] = ['hero', 'tabs', 'tasks', 'notes', 'upcoming'];
export const DEFAULT_VIS: Record<SectionId, boolean> = {
  hero: true, tabs: true, tasks: true, notes: true, upcoming: true,
};

export const LAYOUT_MODES = [
  { id: 'compact' as LayoutMode, label: 'Compact', desc: 'Tighter spacing, more content visible' },
  { id: 'comfortable' as LayoutMode, label: 'Comfortable', desc: 'Balanced spacing (default)' },
  { id: 'expanded' as LayoutMode, label: 'Expanded', desc: 'Larger cards, better readability' },
];

export interface TaskGroup {
  id: string;
  label: string;
  tasks: Task[];
}

export interface HistoryEvent {
  id: string;
  action: string;
  from?: string;
  to?: string;
  timestamp: number;
  icon: string;
}

// ─── Date Normalizer ─────────────────────────────────────────────────────────
// Converts any human-readable date label to ISO yyyy-MM-dd so the calendar
// never receives an ambiguous string that JS's Date constructor can't parse.
function normalizeToISO(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const today = new Date();
  const lower = dateStr.toLowerCase().trim();
  if (lower === 'today') return format(today, 'yyyy-MM-dd');
  if (lower === 'tomorrow') return format(addDays(today, 1), 'yyyy-MM-dd');
  // "Wed, May 20" format (from DateTimePicker's fromISO)
  const withDay = dateStr.match(/^\w+,\s+(\w+)\s+(\d{1,2})$/);
  if (withDay) {
    const d = parse(`${withDay[1]} ${withDay[2]} ${today.getFullYear()}`, 'MMM d yyyy', today);
    if (isValid(d)) return format(d, 'yyyy-MM-dd');
  }
  // "May 20" format (from smartParser)
  const monthDay = dateStr.match(/^(\w+)\s+(\d{1,2})$/);
  if (monthDay) {
    const d = parse(`${monthDay[1]} ${monthDay[2]} ${today.getFullYear()}`, 'MMM d yyyy', today);
    if (isValid(d)) return format(d, 'yyyy-MM-dd');
  }
  // "next Monday", "May 20, 2026" etc. — last-resort native parse
  const attempt = new Date(dateStr);
  if (isValid(attempt)) return format(attempt, 'yyyy-MM-dd');
  return undefined;
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface DashboardContextType {
  sectionOrder: SectionId[];
  sectionVisibility: Record<SectionId, boolean>;
  layoutMode: LayoutMode;
  taskGroups: TaskGroup[];
  taskHistory: Record<string, HistoryEvent[]>;
  setSectionOrder: (order: SectionId[]) => void;
  toggleSectionVisibility: (id: SectionId) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setTaskGroups: React.Dispatch<React.SetStateAction<TaskGroup[]>>;
  handleComposerSave: (taskData: any) => void;
  updateTask: (taskId: string, updater: (t: Task) => Task) => void;
  deleteTask: (taskId: string) => void;
  addHistoryEvent: (taskId: string, event: Omit<HistoryEvent, 'id' | 'timestamp'>) => void;
}

const DashboardContext = createContext<DashboardContextType>({
  sectionOrder: DEFAULT_ORDER,
  sectionVisibility: DEFAULT_VIS,
  layoutMode: 'comfortable',
  taskGroups: [],
  taskHistory: {},
  setSectionOrder: () => { },
  toggleSectionVisibility: () => { },
  setLayoutMode: () => { },
  setTaskGroups: () => { },
  handleComposerSave: () => { },
  updateTask: () => { },
  deleteTask: () => { },
  addHistoryEvent: () => { },
});

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(DEFAULT_ORDER);
  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionId, boolean>>(DEFAULT_VIS);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('comfortable');
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>(dummyData.taskGroups as any);
  const [taskHistory, setTaskHistory] = useState<Record<string, HistoryEvent[]>>({});

  const addHistoryEvent = (taskId: string, event: Omit<HistoryEvent, 'id' | 'timestamp'>) => {
    const newEvent: HistoryEvent = {
      ...event,
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    setTaskHistory(prev => ({
      ...prev,
      [taskId]: [...(prev[taskId] ?? []), newEvent],
    }));
  };

  const toggleSectionVisibility = (id: SectionId) =>
    setSectionVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleComposerSave = (taskData: any) => {
    const newTask: Task = {
      id: taskData.id,
      title: taskData.title,
      tag: taskData.tag || 'PERSONAL',
      tagType: (taskData.tags?.[0]?.id || taskData.tags?.[0] || 'personal') as any,
      priority: taskData.priority,
      completed: false,
      // ← Normalize to ISO yyyy-MM-dd so the calendar always gets a clean date
      dueDate: normalizeToISO(taskData.dueDate),
      dueEndDate: normalizeToISO(taskData.dueEndDate),
      dueTime: taskData.dueTime,
      dueEndTime: taskData.dueEndTime,
      hasReminder: !!taskData.reminder,
      subtasks: taskData.subtasks,
      attachments: taskData.attachments,
    };

    setTaskGroups(prev => {
      const todayISO = format(new Date(), 'yyyy-MM-dd');
      const dueISO = newTask.dueDate || '';
      // Put in "today" group if due today or earlier, otherwise "week"
      const targetGroupId = !dueISO || dueISO <= todayISO ? 'today' : 'week';
      // Append to matched group; if no group found, append to first group
      const matched = prev.some(g => g.id === targetGroupId);
      return prev.map(g => {
        if (matched ? g.id === targetGroupId : prev.indexOf(g) === 0) {
          return { ...g, tasks: [newTask, ...g.tasks] };
        }
        return g;
      });
    });
    addHistoryEvent(newTask.id, { action: 'Task created', icon: 'add-task' });
  };

  const updateTask = (taskId: string, updater: (t: Task) => Task) => {
    const updateInTree = (subs: any[] | undefined): { changed: boolean; newSubs: any[] } => {
      if (!subs) return { changed: false, newSubs: [] };
      let changed = false;
      const newSubs = subs.map(s => {
        if (s.id === taskId) {
          changed = true;
          const fakeTask = { ...s, title: s.text, completed: s.done } as any;
          const res = updater(fakeTask);
          return {
            ...s,
            ...res,
            text: res.title !== undefined ? res.title : s.text,
            done: res.completed !== undefined ? res.completed : s.done
          };
        }
        const children = s.subtasks || s.children;
        if (children) {
          const res = updateInTree(children);
          if (res.changed) {
            changed = true;
            if (s.subtasks) return { ...s, subtasks: res.newSubs };
            return { ...s, children: res.newSubs };
          }
        }
        return s;
      });
      return { changed, newSubs };
    };

    setTaskGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tasks: group.tasks.map((t) => {
          if (t.id === taskId) return updater(t);
          const { changed, newSubs } = updateInTree(t.subtasks);
          if (changed) {
            return { ...t, subtasks: newSubs };
          }
          return t;
        }),
      }))
    );
  };

  const deleteTask = (taskId: string) => {
    const deleteFromTree = (subs: any[] | undefined): any[] => {
      if (!subs) return [];
      return subs
        .filter((s) => s.id !== taskId)
        .map((s) => {
          const children = s.subtasks || s.children;
          if (children && children.length > 0) {
            if (s.subtasks) return { ...s, subtasks: deleteFromTree(s.subtasks) };
            return { ...s, children: deleteFromTree(s.children) };
          }
          return s;
        });
    };

    setTaskGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tasks: group.tasks
          .filter((t) => t.id !== taskId)
          .map((t) => {
            if (t.subtasks && t.subtasks.length > 0) {
              return { ...t, subtasks: deleteFromTree(t.subtasks) };
            }
            return t;
          }),
      }))
    );
  };

  return (
    <DashboardContext.Provider value={{
      sectionOrder, sectionVisibility, layoutMode, taskGroups, taskHistory,
      setSectionOrder, toggleSectionVisibility, setLayoutMode,
      setTaskGroups, handleComposerSave, updateTask, deleteTask, addHistoryEvent,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);
