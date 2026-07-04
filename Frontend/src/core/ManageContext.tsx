import React, { createContext, useContext, useState, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ManagedPriority {
  id: string; // 'HIGH' | 'MED' | 'LOW' | custom
  label: string;
  color: string;
  icon: string; // MaterialIcons name
  isDefault: boolean; // cannot delete defaults, but can edit
}

export interface ManagedTag {
  id: string;
  label: string;
  color: string;
  isDefault?: boolean; // true if built-in
}

// Per-tag calendar marking preferences
export type MarkingStyle = "dot" | "period" | "custom";
export interface CalendarMarkingSetting {
  tagId: string;
  style: MarkingStyle; // dot | period | custom
  visible: boolean; // show/hide in calendar
  customEmoji?: string; // optional emoji for 'custom' style
}

export interface Birthday {
  id: string;
  name: string;
  date: string; // "MM-DD" format, e.g. "12-25"
}

// ─── Dock Types ───────────────────────────────────────────────────────────────
export type DockMode = 'compact' | 'expanded-2row' | 'fullscreen';
export type FabPosition = 'right' | 'left' | 'freeflow';

export interface DockItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  match: string;
}

export const ALL_AVAILABLE_DOCK_ITEMS: DockItem[] = [
  { id: 'home',     label: 'Home',     icon: 'home',           route: '/(tabs)/',         match: '/'         },
  { id: 'tasks',    label: 'Tasks',    icon: 'checklist',      route: '/(tabs)/tasks',    match: '/tasks'    },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-month', route: '/(tabs)/calendar', match: '/calendar' },
  { id: 'manage',   label: 'Manage',   icon: 'tune',           route: '/(tabs)/manage',   match: '/manage'   },
  { id: 'notes',    label: 'Notes',    icon: 'sticky-note-2',  route: '/(tabs)/notes',    match: '/notes'    },
  { id: 'events',   label: 'Events',   icon: 'event',          route: '/(tabs)/events',   match: '/events'   },
  { id: 'settings', label: 'Settings', icon: 'settings',       route: '/(tabs)/settings', match: '/settings' },
];

export const DEFAULT_DOCK_ITEMS: DockItem[] = ALL_AVAILABLE_DOCK_ITEMS.slice(0, 4);

// ─── Defaults ─────────────────────────────────────────────────────────────────
export const DEFAULT_PRIORITIES: ManagedPriority[] = [
  {
    id: "HIGH",
    label: "High",
    color: "#EF4444",
    icon: "flag",
    isDefault: true,
  },
  {
    id: "MED",
    label: "Medium",
    color: "#F97316",
    icon: "flag",
    isDefault: true,
  },
  { id: "LOW", label: "Low", color: "#22C55E", icon: "flag", isDefault: true },
];

export const DEFAULT_TAGS: ManagedTag[] = [
  { id: "work", label: "Work", color: "#6366F1", isDefault: true },
  { id: "personal", label: "Personal", color: "#71717A", isDefault: true },
  { id: "health", label: "Health", color: "#22C55E", isDefault: true },
  { id: "learning", label: "Learning", color: "#EC4899", isDefault: true },
  { id: "review", label: "Review", color: "#F97316", isDefault: true },
  { id: "shopping", label: "Shopping", color: "#F59E0B", isDefault: true },
  { id: "finance", label: "Finance", color: "#10B981", isDefault: true },
  { id: "fitness", label: "Fitness", color: "#14B8A6", isDefault: true },
  { id: "home", label: "Home", color: "#3B82F6", isDefault: true },
  { id: "ideas", label: "Ideas", color: "#8B5CF6", isDefault: true },
];

export const DEFAULT_REMINDER_PRESETS = [
  "At due time",
  "5 min before",
  "15 min before",
  "30 min before",
  "1 hr before",
  "2 hrs before",
  "1 day before",
];

export const PALETTE_COLORS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#22C55E",
  "#14B8A6",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#71717A",
  "#0891B2",
  "#DB2777",
  "#7C3AED",
  "#059669",
  "#DC2626",
  "#EA580C",
  "#16A34A",
];

// ─── Context ──────────────────────────────────────────────────────────────────
interface ManageContextType {
  priorities: ManagedPriority[];
  tags: ManagedTag[];
  reminderPresets: string[];
  defaultPriority: string | null;
  // Calendar
  calendarMarkings: CalendarMarkingSetting[];
  updateCalendarMarking: (
    tagId: string,
    changes: Partial<Omit<CalendarMarkingSetting, "tagId">>,
  ) => void;
  // Birthdays
  birthdays: Birthday[];
  addBirthday: (b: Omit<Birthday, "id">) => void;
  deleteBirthday: (id: string) => void;
  // Priorities
  setPriorities: (p: ManagedPriority[]) => void;
  addPriority: (p: Omit<ManagedPriority, "isDefault">) => void;
  updatePriority: (
    id: string,
    changes: Partial<Pick<ManagedPriority, "label" | "color">>,
  ) => void;
  deletePriority: (id: string) => void;
  reorderPriorities: (from: number, to: number) => void;
  // Tags
  setTags: (t: ManagedTag[]) => void;
  addTag: (t: Omit<ManagedTag, "id">) => void;
  updateTag: (
    id: string,
    changes: Partial<Pick<ManagedTag, "label" | "color">>,
  ) => void;
  deleteTag: (id: string) => void;
  // Reminders
  setReminderPresets: (r: string[]) => void;
  addReminderPreset: (r: string) => void;
  deleteReminderPreset: (r: string) => void;
  setDefaultPriority: (id: string | null) => void;
  // Alarm tone
  alarmTone: string;
  setAlarmTone: (tone: string) => void;
  // Calendar interaction
  longPressDateStart: boolean;
  setLongPressDateStart: (v: boolean) => void;
  // Dock customization
  dockMode: DockMode;
  dockItems: DockItem[];
  isDockExpanded: boolean;
  setIsDockExpanded: (expanded: boolean) => void;
  setDockMode: (mode: DockMode) => void;
  reorderDockItems: (from: number, to: number) => void;
  addDockItem: (item: DockItem) => void;
  addDockItemAtIndex: (item: DockItem, index: number) => void;
  removeDockItem: (id: string) => void;
  hideDock: boolean;
  setHideDock: (hide: boolean) => void;
  fabPosition: FabPosition;
  setFabPosition: (pos: FabPosition) => void;
  fabFreeflowPos: { x: number; y: number };
  setFabFreeflowPos: (pos: { x: number; y: number }) => void;
}

const ManageContext = createContext<ManageContextType>({
  priorities: DEFAULT_PRIORITIES,
  tags: DEFAULT_TAGS,
  reminderPresets: DEFAULT_REMINDER_PRESETS,
  defaultPriority: null,
  calendarMarkings: [],
  updateCalendarMarking: () => {},
  birthdays: [],
  addBirthday: () => {},
  deleteBirthday: () => {},
  setPriorities: () => {},
  addPriority: () => {},
  updatePriority: () => {},
  deletePriority: () => {},
  reorderPriorities: () => {},
  setTags: () => {},
  addTag: () => {},
  updateTag: () => {},
  deleteTag: () => {},
  setReminderPresets: () => {},
  addReminderPreset: () => {},
  deleteReminderPreset: () => {},
  setDefaultPriority: () => {},
  alarmTone: 'default',
  setAlarmTone: () => {},
  longPressDateStart: false,
  setLongPressDateStart: () => {},
  dockMode: 'compact',
  dockItems: DEFAULT_DOCK_ITEMS,
  isDockExpanded: false,
  setIsDockExpanded: () => {},
  setDockMode: () => {},
  reorderDockItems: () => {},
  addDockItem: () => {},
  addDockItemAtIndex: () => {},
  removeDockItem: () => {},
  hideDock: false,
  setHideDock: () => {},
  fabPosition: 'right',
  setFabPosition: () => {},
  fabFreeflowPos: { x: 0, y: 0 },
  setFabFreeflowPos: () => {},
});

export const ManageProvider = ({ children }: { children: ReactNode }) => {
  const [priorities, setPriorities] =
    useState<ManagedPriority[]>(DEFAULT_PRIORITIES);
  const [tags, setTags] = useState<ManagedTag[]>(DEFAULT_TAGS);
  const [reminderPresets, setReminderPresets] = useState<string[]>(
    DEFAULT_REMINDER_PRESETS,
  );
  const [defaultPriority, setDefaultPriority] = useState<string | null>(null);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [longPressDateStart, setLongPressDateStart] = useState(false);
  const [alarmTone, setAlarmTone] = useState<string>('default');
  const [dockMode, setDockMode] = useState<DockMode>('compact');
  const [dockItems, setDockItems] = useState<DockItem[]>(DEFAULT_DOCK_ITEMS);
  const [isDockExpanded, setIsDockExpanded] = useState(false);
  const [hideDock, setHideDock] = useState(false);
  const [fabPosition, setFabPosition] = useState<FabPosition>('right');
  const [fabFreeflowPos, setFabFreeflowPos] = useState({ x: 0, y: 0 });

  const selectDockMode = (mode: DockMode) => {
    setDockMode(mode);
  };

  const reorderDockItems = (from: number, to: number) =>
    setDockItems(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });

  const addDockItem = (item: DockItem) =>
    setDockItems(prev => {
      if (prev.some(d => d.id === item.id)) return prev;
      return [...prev, item];
    });

  const addDockItemAtIndex = (item: DockItem, index: number) =>
    setDockItems(prev => {
      const filtered = prev.filter(d => d.id !== item.id);
      const arr = [...filtered];
      const targetIdx = Math.max(0, Math.min(prev.length, index));
      arr.splice(targetIdx, 0, item);
      return arr;
    });

  const removeDockItem = (id: string) =>
    setDockItems(prev => prev.length > 1 ? prev.filter(d => d.id !== id) : prev);

  const addBirthday = (b: Omit<Birthday, "id">) => {
    const id = `bday_${Date.now()}`;
    setBirthdays((prev) => [...prev, { id, ...b }]);
  };
  const deleteBirthday = (id: string) =>
    setBirthdays((prev) => prev.filter((b) => b.id !== id));

  // Initialise one CalendarMarkingSetting per default tag
  const [calendarMarkings, setCalendarMarkings] = useState<
    CalendarMarkingSetting[]
  >(
    DEFAULT_TAGS.map((t) => ({
      tagId: t.id,
      style: "dot" as MarkingStyle,
      visible: true,
    })),
  );

  const updateCalendarMarking = (
    tagId: string,
    changes: Partial<Omit<CalendarMarkingSetting, "tagId">>,
  ) =>
    setCalendarMarkings((prev) =>
      prev.map((m) => (m.tagId === tagId ? { ...m, ...changes } : m)),
    );

  const addPriority = (p: Omit<ManagedPriority, "isDefault">) =>
    setPriorities((prev) => [...prev, { ...p, isDefault: false }]);

  const updatePriority = (
    id: string,
    changes: Partial<Pick<ManagedPriority, "label" | "color">>,
  ) =>
    setPriorities((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    );

  const deletePriority = (id: string) =>
    setPriorities((prev) => prev.filter((p) => p.id !== id || p.isDefault));

  const reorderPriorities = (from: number, to: number) =>
    setPriorities((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });

  const addTag = (t: Omit<ManagedTag, "id">) => {
    const id = t.label.toLowerCase().replace(/\s+/g, "-");
    setTags((prev) => [...prev, { id, ...t }]);
  };

  const updateTag = (
    id: string,
    changes: Partial<Pick<ManagedTag, "label" | "color">>,
  ) =>
    setTags((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    );

  const deleteTag = (id: string) =>
    setTags((prev) => prev.filter((t) => t.id !== id));

  const addReminderPreset = (r: string) =>
    setReminderPresets((prev) => (prev.includes(r) ? prev : [...prev, r]));

  const deleteReminderPreset = (r: string) =>
    setReminderPresets((prev) => prev.filter((x) => x !== r));

  // Sync calendarMarkings when tags change (add new tag → add its marking entry)
  const syncMarkings = (newTags: ManagedTag[]) => {
    setCalendarMarkings((prev) => {
      const existing = new Set(prev.map((m) => m.tagId));
      const added = newTags
        .filter((t) => !existing.has(t.id))
        .map((t) => ({
          tagId: t.id,
          style: "dot" as MarkingStyle,
          visible: true,
        }));
      return [...prev, ...added];
    });
  };

  const addTagAndSync = (t: Omit<ManagedTag, "id">) => {
    const id = t.label.toLowerCase().replace(/\s+/g, "-");
    const newTag = { id, ...t, isDefault: false };
    setTags((prev) => {
      const next = [...prev, newTag];
      syncMarkings(next);
      return next;
    });
  };

  return (
    <ManageContext.Provider
      value={{
        priorities,
        tags,
        reminderPresets,
        defaultPriority,
        calendarMarkings,
        updateCalendarMarking,
        birthdays,
        addBirthday,
        deleteBirthday,
        setPriorities,
        addPriority,
        updatePriority,
        deletePriority,
        reorderPriorities,
        setTags,
        addTag: addTagAndSync,
        updateTag,
        deleteTag,
        setReminderPresets,
        addReminderPreset,
        deleteReminderPreset,
        setDefaultPriority,
        alarmTone,
        setAlarmTone,
        longPressDateStart,
        setLongPressDateStart,
         dockMode, setDockMode: selectDockMode,
        dockItems, reorderDockItems, addDockItem, addDockItemAtIndex, removeDockItem,
        isDockExpanded, setIsDockExpanded,
        hideDock, setHideDock,
        fabPosition, setFabPosition,
        fabFreeflowPos, setFabFreeflowPos,
      }}
    >
      {children}
    </ManageContext.Provider>
  );
};

export const useManage = () => useContext(ManageContext);

// Convenience hook: returns the CalendarMarkingSetting for a given tagId (or a default)
export const useTagMarking = (tagId: string): CalendarMarkingSetting =>
  useManage().calendarMarkings.find((m) => m.tagId === tagId) ?? {
    tagId,
    style: "dot",
    visible: true,
  };
