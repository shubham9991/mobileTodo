import React, { createContext, useContext, useState, ReactNode } from 'react';

import { dummyData, Task } from './dummyData';

// ─── Types ────────────────────────────────────────────────────────────────────
export type SectionId = 'hero' | 'tabs' | 'tasks' | 'notes' | 'upcoming';
export type LayoutMode = 'compact' | 'comfortable' | 'expanded';

export const SECTION_META: Record<SectionId, { label: string; icon: string }> = {
  hero:     { label: 'Hero Widget',    icon: 'bolt'          },
  tabs:     { label: 'Category Tabs',  icon: 'tab'           },
  tasks:    { label: "Today's Tasks",  icon: 'task-alt'      },
  notes:    { label: 'Recent Notes',   icon: 'description'   },
  upcoming: { label: 'Upcoming',       icon: 'calendar-month'},
};

export const DEFAULT_ORDER: SectionId[]   = ['hero', 'tabs', 'tasks', 'notes', 'upcoming'];
export const DEFAULT_VIS: Record<SectionId, boolean> = {
  hero: true, tabs: true, tasks: true, notes: true, upcoming: true,
};

export const LAYOUT_MODES = [
  { id: 'compact'     as LayoutMode, label: 'Compact',     desc: 'Tighter spacing, more content visible'   },
  { id: 'comfortable' as LayoutMode, label: 'Comfortable', desc: 'Balanced spacing (default)'              },
  { id: 'expanded'    as LayoutMode, label: 'Expanded',    desc: 'Larger cards, better readability'        },
];

export interface TaskGroup {
  id: string;
  label: string;
  tasks: Task[];
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface DashboardContextType {
  sectionOrder:         SectionId[];
  sectionVisibility:    Record<SectionId, boolean>;
  layoutMode:           LayoutMode;
  taskGroups:           TaskGroup[];
  setSectionOrder:      (order: SectionId[]) => void;
  toggleSectionVisibility: (id: SectionId) => void;
  setLayoutMode:        (mode: LayoutMode) => void;
  setTaskGroups:        React.Dispatch<React.SetStateAction<TaskGroup[]>>;
  handleComposerSave:   (taskData: any) => void;
  updateTask:           (taskId: string, updater: (t: Task) => Task) => void;
}

const DashboardContext = createContext<DashboardContextType>({
  sectionOrder:            DEFAULT_ORDER,
  sectionVisibility:       DEFAULT_VIS,
  layoutMode:              'comfortable',
  taskGroups:              [],
  setSectionOrder:         () => {},
  toggleSectionVisibility: () => {},
  setLayoutMode:           () => {},
  setTaskGroups:           () => {},
  handleComposerSave:      () => {},
  updateTask:              () => {},
});

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [sectionOrder, setSectionOrder]           = useState<SectionId[]>(DEFAULT_ORDER);
  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionId, boolean>>(DEFAULT_VIS);
  const [layoutMode, setLayoutMode]               = useState<LayoutMode>('comfortable');
  const [taskGroups, setTaskGroups]               = useState<TaskGroup[]>(dummyData.taskGroups as any);

  const toggleSectionVisibility = (id: SectionId) =>
    setSectionVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleComposerSave = (taskData: any) => {
    const newTask: Task = {
      id: taskData.id,
      title: taskData.title,
      tag: taskData.tag || 'PERSONAL',
      tagType: (taskData.tags?.[0]?.id || 'personal') as any,
      priority: taskData.priority,
      completed: false,
      dueDate: taskData.dueDate,
      dueTime: taskData.dueTime,
      hasReminder: !!taskData.reminder,
      subtasks: taskData.subtasks,
      attachments: taskData.attachments,
    };
    
    setTaskGroups(prev => {
      const targetGroupId = newTask.dueDate === 'Today' ? 'today' : 'week';
      return prev.map(g => 
        g.id === targetGroupId 
          ? { ...g, tasks: [newTask, ...g.tasks] }
          : g
      );
    });
  };

  const updateTask = (taskId: string, updater: (t: Task) => Task) => {
    setTaskGroups((prev) => 
      prev.map((group) => ({
        ...group,
        tasks: group.tasks.map((t) => (t.id === taskId ? updater(t) : t)),
      }))
    );
  };

  return (
    <DashboardContext.Provider value={{
      sectionOrder, sectionVisibility, layoutMode, taskGroups,
      setSectionOrder, toggleSectionVisibility, setLayoutMode,
      setTaskGroups, handleComposerSave, updateTask,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);
