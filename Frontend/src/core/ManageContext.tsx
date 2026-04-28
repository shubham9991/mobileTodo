import React, { createContext, useContext, useState, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ManagedPriority {
  id: string;       // 'HIGH' | 'MED' | 'LOW' | custom
  label: string;
  color: string;
  icon: string;     // MaterialIcons name
  isDefault: boolean; // cannot delete defaults, but can edit
}

export interface ManagedTag {
  id: string;
  label: string;
  color: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
export const DEFAULT_PRIORITIES: ManagedPriority[] = [
  { id: 'HIGH', label: 'High',   color: '#EF4444', icon: 'flag', isDefault: true },
  { id: 'MED',  label: 'Medium', color: '#F97316', icon: 'flag', isDefault: true },
  { id: 'LOW',  label: 'Low',    color: '#22C55E', icon: 'flag', isDefault: true },
];

export const DEFAULT_TAGS: ManagedTag[] = [
  { id: 'work',     label: 'Work',     color: '#6366F1' },
  { id: 'personal', label: 'Personal', color: '#71717A' },
  { id: 'health',   label: 'Health',   color: '#22C55E' },
  { id: 'learning', label: 'Learning', color: '#EC4899' },
  { id: 'review',   label: 'Review',   color: '#F97316' },
];

export const DEFAULT_REMINDER_PRESETS = [
  'At due time',
  '5 min before',
  '15 min before',
  '30 min before',
  '1 hr before',
  '2 hrs before',
  '1 day before',
];

export const PALETTE_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#22C55E',
  '#14B8A6', '#6366F1', '#8B5CF6', '#EC4899',
  '#71717A', '#0891B2', '#DB2777', '#7C3AED',
  '#059669', '#DC2626', '#EA580C', '#16A34A',
];

// ─── Context ──────────────────────────────────────────────────────────────────
interface ManageContextType {
  priorities:        ManagedPriority[];
  tags:              ManagedTag[];
  reminderPresets:   string[];
  defaultPriority:   string | null;
  setPriorities:     (p: ManagedPriority[]) => void;
  addPriority:       (p: Omit<ManagedPriority, 'isDefault'>) => void;
  updatePriority:    (id: string, changes: Partial<Pick<ManagedPriority, 'label' | 'color'>>) => void;
  deletePriority:    (id: string) => void;
  reorderPriorities: (from: number, to: number) => void;
  setTags:           (t: ManagedTag[]) => void;
  addTag:            (t: Omit<ManagedTag, 'id'>) => void;
  updateTag:         (id: string, changes: Partial<Pick<ManagedTag, 'label' | 'color'>>) => void;
  deleteTag:         (id: string) => void;
  setReminderPresets:(r: string[]) => void;
  addReminderPreset: (r: string) => void;
  deleteReminderPreset: (r: string) => void;
  setDefaultPriority:(id: string | null) => void;
}

const ManageContext = createContext<ManageContextType>({
  priorities:        DEFAULT_PRIORITIES,
  tags:              DEFAULT_TAGS,
  reminderPresets:   DEFAULT_REMINDER_PRESETS,
  defaultPriority:   null,
  setPriorities:     () => {},
  addPriority:       () => {},
  updatePriority:    () => {},
  deletePriority:    () => {},
  reorderPriorities: () => {},
  setTags:           () => {},
  addTag:            () => {},
  updateTag:         () => {},
  deleteTag:         () => {},
  setReminderPresets:() => {},
  addReminderPreset: () => {},
  deleteReminderPreset: () => {},
  setDefaultPriority:() => {},
});

export const ManageProvider = ({ children }: { children: ReactNode }) => {
  const [priorities,      setPriorities]      = useState<ManagedPriority[]>(DEFAULT_PRIORITIES);
  const [tags,            setTags]            = useState<ManagedTag[]>(DEFAULT_TAGS);
  const [reminderPresets, setReminderPresets] = useState<string[]>(DEFAULT_REMINDER_PRESETS);
  const [defaultPriority, setDefaultPriority] = useState<string | null>(null);

  const addPriority = (p: Omit<ManagedPriority, 'isDefault'>) =>
    setPriorities(prev => [...prev, { ...p, isDefault: false }]);

  const updatePriority = (id: string, changes: Partial<Pick<ManagedPriority, 'label' | 'color'>>) =>
    setPriorities(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));

  const deletePriority = (id: string) =>
    setPriorities(prev => prev.filter(p => p.id !== id || p.isDefault));

  const reorderPriorities = (from: number, to: number) =>
    setPriorities(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });

  const addTag = (t: Omit<ManagedTag, 'id'>) => {
    const id = t.label.toLowerCase().replace(/\s+/g, '-');
    setTags(prev => [...prev, { id, ...t }]);
  };

  const updateTag = (id: string, changes: Partial<Pick<ManagedTag, 'label' | 'color'>>) =>
    setTags(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t));

  const deleteTag = (id: string) =>
    setTags(prev => prev.filter(t => t.id !== id));

  const addReminderPreset = (r: string) =>
    setReminderPresets(prev => prev.includes(r) ? prev : [...prev, r]);

  const deleteReminderPreset = (r: string) =>
    setReminderPresets(prev => prev.filter(x => x !== r));

  return (
    <ManageContext.Provider value={{
      priorities, tags, reminderPresets, defaultPriority,
      setPriorities, addPriority, updatePriority, deletePriority, reorderPriorities,
      setTags, addTag, updateTag, deleteTag,
      setReminderPresets, addReminderPreset, deleteReminderPreset,
      setDefaultPriority,
    }}>
      {children}
    </ManageContext.Provider>
  );
};

export const useManage = () => useContext(ManageContext);
