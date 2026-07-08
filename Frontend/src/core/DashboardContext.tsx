import React, { createContext, useContext, useState, ReactNode } from 'react';
import { format, addDays, parse, isValid } from 'date-fns';
import { dummyData, Task } from './dummyData';

// ─── Types ────────────────────────────────────────────────────────────────────
export type SectionId = 'hero' | 'tabs' | 'tasks' | 'notes' | 'upcoming';
export type LayoutMode = 'compact' | 'comfortable' | 'expanded';

export type NodeType = 'COMPANY' | 'FOLDER' | 'PROJECT' | 'TEAM';

export interface ProjectNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  color?: string;
  icon?: string;
  childIds: string[];
}

export interface DashboardView {
  id: string;
  name: string;
  layout: 'list' | 'calendar';
  showCompleted: boolean;
  grouping: 'none' | 'priority' | 'tag' | 'dueDate' | 'project';
  sorting: 'manual' | 'dueDate' | 'priority' | 'created' | 'alphabetical';
  filterDate: 'all' | 'today' | 'tomorrow' | 'overdue' | 'week';
  filterPriorities: ('HIGH' | 'MED' | 'LOW')[];
  filterTags: string[];
  filterSourceNodeId: string | null;
  widgets: { id: string; visible: boolean }[];
}

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

// Helper to recursively get all descendant node IDs
export function getDescendantNodeIds(nodes: Record<string, ProjectNode>, rootId: string): string[] {
  const result: string[] = [rootId];
  const traverse = (id: string) => {
    const node = nodes[id];
    if (node && node.childIds) {
      node.childIds.forEach(childId => {
        result.push(childId);
        traverse(childId);
      });
    }
  };
  traverse(rootId);
  return result;
}

// ─── Default Nodes & Views Seed Data ──────────────────────────────────────────
export const DEFAULT_NODES: Record<string, ProjectNode> = {
  company_worksphere: {
    id: 'company_worksphere',
    name: 'WorkSphere',
    type: 'COMPANY',
    parentId: null,
    color: '#6366F1',
    icon: 'business',
    childIds: ['company_modular', 'company_nayayein'],
  },
  company_modular: {
    id: 'company_modular',
    name: 'Modular Inc',
    type: 'COMPANY',
    parentId: 'company_worksphere',
    color: '#8B5CF6',
    icon: 'corporate-fare',
    childIds: ['project_getting_started', 'project_weekly_review'],
  },
  project_getting_started: {
    id: 'project_getting_started',
    name: 'Getting Started',
    type: 'PROJECT',
    parentId: 'company_modular',
    color: '#10B981',
    icon: 'emoji-objects',
    childIds: [],
  },
  project_weekly_review: {
    id: 'project_weekly_review',
    name: 'Weekly Review',
    type: 'PROJECT',
    parentId: 'company_modular',
    color: '#F59E0B',
    icon: 'fact-check',
    childIds: [],
  },
  company_nayayein: {
    id: 'company_nayayein',
    name: 'Nayayein Rajyam',
    type: 'COMPANY',
    parentId: 'company_worksphere',
    color: '#EC4899',
    icon: 'domain',
    childIds: ['project_team_setup', 'project_msm', 'project_vhm'],
  },
  project_team_setup: {
    id: 'project_team_setup',
    name: 'Team Setup Guide',
    type: 'PROJECT',
    parentId: 'company_nayayein',
    color: '#3B82F6',
    icon: 'groups',
    childIds: [],
  },
  project_msm: {
    id: 'project_msm',
    name: 'Msm',
    type: 'PROJECT',
    parentId: 'company_nayayein',
    color: '#EF4444',
    icon: 'folder',
    childIds: [],
  },
  project_vhm: {
    id: 'project_vhm',
    name: 'Vhm',
    type: 'PROJECT',
    parentId: 'company_nayayein',
    color: '#14B8A6',
    icon: 'work',
    childIds: [],
  },
};

export const DEFAULT_VIEWS: DashboardView[] = [
  {
    id: 'view_inbox',
    name: 'Inbox',
    layout: 'list',
    showCompleted: true,
    grouping: 'none',
    sorting: 'dueDate',
    filterDate: 'all',
    filterPriorities: ['HIGH', 'MED', 'LOW'],
    filterTags: [],
    filterSourceNodeId: null,
    widgets: [
      { id: 'hero', visible: true },
      { id: 'tabs', visible: true },
      { id: 'tasks', visible: true },
      { id: 'notes', visible: true },
      { id: 'upcoming', visible: true },
    ],
  },
  {
    id: 'view_guyu',
    name: 'Guyu',
    layout: 'list',
    showCompleted: false,
    grouping: 'none',
    sorting: 'dueDate',
    filterDate: 'all',
    filterPriorities: ['HIGH', 'MED', 'LOW'],
    filterTags: [],
    filterSourceNodeId: null,
    widgets: [
      { id: 'hero', visible: true },
      { id: 'tabs', visible: true },
      { id: 'tasks', visible: true },
      { id: 'notes', visible: false },
      { id: 'upcoming', visible: false },
    ],
  },
  {
    id: 'view_shjjh',
    name: 'Shjjh',
    layout: 'list',
    showCompleted: false,
    grouping: 'priority',
    sorting: 'manual',
    filterDate: 'all',
    filterPriorities: ['HIGH', 'MED', 'LOW'],
    filterTags: [],
    filterSourceNodeId: null,
    widgets: [
      { id: 'hero', visible: false },
      { id: 'tabs', visible: false },
      { id: 'tasks', visible: true },
      { id: 'notes', visible: false },
      { id: 'upcoming', visible: false },
    ],
  },
  {
    id: 'view_beeu',
    name: 'Beeu',
    layout: 'calendar',
    showCompleted: true,
    grouping: 'none',
    sorting: 'dueDate',
    filterDate: 'all',
    filterPriorities: ['HIGH', 'MED', 'LOW'],
    filterTags: [],
    filterSourceNodeId: null,
    widgets: [
      { id: 'hero', visible: false },
      { id: 'tabs', visible: false },
      { id: 'tasks', visible: true },
      { id: 'notes', visible: false },
      { id: 'upcoming', visible: true },
    ],
  },
];

// ─── Date Normalizer ─────────────────────────────────────────────────────────
function normalizeToISO(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const today = new Date();
  const lower = dateStr.toLowerCase().trim();
  if (lower === 'today') return format(today, 'yyyy-MM-dd');
  if (lower === 'tomorrow') return format(addDays(today, 1), 'yyyy-MM-dd');
  const withDay = dateStr.match(/^\w+,\s+(\w+)\s+(\d{1,2})$/);
  if (withDay) {
    const d = parse(`${withDay[1]} ${withDay[2]} ${today.getFullYear()}`, 'MMM d yyyy', today);
    if (isValid(d)) return format(d, 'yyyy-MM-dd');
  }
  const monthDay = dateStr.match(/^(\w+)\s+(\d{1,2})$/);
  if (monthDay) {
    const d = parse(`${monthDay[1]} ${monthDay[2]} ${today.getFullYear()}`, 'MMM d yyyy', today);
    if (isValid(d)) return format(d, 'yyyy-MM-dd');
  }
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
  views: DashboardView[];
  activeViewIndex: number;
  nodes: Record<string, ProjectNode>;
  activeNodeId: string | null;
  setSectionOrder: (order: SectionId[]) => void;
  toggleSectionVisibility: (id: SectionId) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setTaskGroups: React.Dispatch<React.SetStateAction<TaskGroup[]>>;
  setViews: React.Dispatch<React.SetStateAction<DashboardView[]>>;
  setActiveViewIndex: (index: number) => void;
  setActiveNodeId: (id: string | null) => void;
  handleComposerSave: (taskData: any) => void;
  updateTask: (taskId: string, updater: (t: Task) => Task) => void;
  deleteTask: (taskId: string) => void;
  addHistoryEvent: (taskId: string, event: Omit<HistoryEvent, 'id' | 'timestamp'>) => void;
  createView: (view: Omit<DashboardView, 'id'>) => void;
  updateView: (id: string, changes: Partial<DashboardView>) => void;
  deleteView: (id: string) => void;
  createProjectNode: (node: Omit<ProjectNode, 'id' | 'childIds'>) => void;
  deleteProjectNode: (id: string) => void;
  updateProjectNode: (id: string, changes: Partial<ProjectNode>) => void;
}

const DashboardContext = createContext<DashboardContextType>({
  sectionOrder: DEFAULT_ORDER,
  sectionVisibility: DEFAULT_VIS,
  layoutMode: 'comfortable',
  taskGroups: [],
  taskHistory: {},
  views: DEFAULT_VIEWS,
  activeViewIndex: 0,
  nodes: DEFAULT_NODES,
  activeNodeId: null,
  setSectionOrder: () => { },
  toggleSectionVisibility: () => { },
  setLayoutMode: () => { },
  setTaskGroups: () => { },
  setViews: () => { },
  setActiveViewIndex: () => { },
  setActiveNodeId: () => { },
  handleComposerSave: () => { },
  updateTask: () => { },
  deleteTask: () => { },
  addHistoryEvent: () => { },
  createView: () => { },
  updateView: () => { },
  deleteView: () => { },
  createProjectNode: () => { },
  deleteProjectNode: () => { },
  updateProjectNode: () => { },
});

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(DEFAULT_ORDER);
  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionId, boolean>>(DEFAULT_VIS);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('comfortable');
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>(dummyData.taskGroups as any);
  const [taskHistory, setTaskHistory] = useState<Record<string, HistoryEvent[]>>({});
  
  // Custom multi-view state
  const [views, setViews] = useState<DashboardView[]>(DEFAULT_VIEWS);
  const [activeViewIndex, setActiveViewIndex] = useState<number>(0);
  
  // Custom nested hierarchy state
  const [nodes, setNodes] = useState<Record<string, ProjectNode>>(DEFAULT_NODES);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

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
      dueDate: normalizeToISO(taskData.dueDate),
      dueEndDate: normalizeToISO(taskData.dueEndDate),
      dueTime: taskData.dueTime,
      dueEndTime: taskData.dueEndTime,
      hasReminder: !!taskData.reminder,
      subtasks: taskData.subtasks,
      attachments: taskData.attachments,
      nodeId: taskData.nodeId || activeNodeId || undefined,
    };

    setTaskGroups(prev => {
      const todayISO = format(new Date(), 'yyyy-MM-dd');
      const dueISO = newTask.dueDate || '';
      const targetGroupId = !dueISO || dueISO <= todayISO ? 'today' : 'week';
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

  // View CRUD actions
  const createView = (view: Omit<DashboardView, 'id'>) => {
    const id = `view_${Date.now()}`;
    const newView: DashboardView = { id, ...view };
    setViews(prev => [...prev, newView]);
  };

  const updateView = (id: string, changes: Partial<DashboardView>) => {
    setViews(prev => prev.map(v => v.id === id ? { ...v, ...changes } : v));
  };

  const deleteView = (id: string) => {
    setViews(prev => {
      if (prev.length <= 1) return prev; // Keep at least one view
      const filtered = prev.filter(v => v.id !== id);
      // Adjust active view index if it went out of bounds
      setActiveViewIndex(old => Math.min(old, filtered.length - 1));
      return filtered;
    });
  };

  // Hierarchy Node actions
  const createProjectNode = (node: Omit<ProjectNode, 'id' | 'childIds'>) => {
    const id = `node_${Date.now()}`;
    const newNode: ProjectNode = { id, ...node, childIds: [] };
    
    setNodes(prev => {
      const next = { ...prev, [id]: newNode };
      // If there is a parent, append to parent's childIds
      if (node.parentId && next[node.parentId]) {
        next[node.parentId] = {
          ...next[node.parentId],
          childIds: [...next[node.parentId].childIds, id],
        };
      }
      return next;
    });
  };

  const deleteProjectNode = (id: string) => {
    setNodes(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      const nodeToDelete = next[id];
      
      // Clean up parent's child reference
      if (nodeToDelete.parentId && next[nodeToDelete.parentId]) {
        next[nodeToDelete.parentId] = {
          ...next[nodeToDelete.parentId],
          childIds: next[nodeToDelete.parentId].childIds.filter(cid => cid !== id),
        };
      }
      
      // Recursive delete children helper
      const removeNodeAndChildren = (nid: string) => {
        const item = next[nid];
        if (item) {
          item.childIds.forEach(childId => removeNodeAndChildren(childId));
          delete next[nid];
        }
      };
      
      removeNodeAndChildren(id);
      if (activeNodeId === id) {
        setActiveNodeId(null);
      }
      return next;
    });
  };

  const updateProjectNode = (id: string, changes: Partial<ProjectNode>) => {
    setNodes(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], ...changes },
      };
    });
  };

  return (
    <DashboardContext.Provider value={{
      sectionOrder, sectionVisibility, layoutMode, taskGroups, taskHistory,
      views, activeViewIndex, nodes, activeNodeId,
      setSectionOrder, toggleSectionVisibility, setLayoutMode,
      setTaskGroups, setViews, setActiveViewIndex, setActiveNodeId,
      handleComposerSave, updateTask, deleteTask, addHistoryEvent,
      createView, updateView, deleteView,
      createProjectNode, deleteProjectNode, updateProjectNode,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);
