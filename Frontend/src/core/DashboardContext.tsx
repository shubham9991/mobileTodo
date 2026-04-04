import React, { createContext, useContext, useState, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type SectionId = 'hero' | 'search' | 'tabs' | 'tasks' | 'notes' | 'upcoming';
export type LayoutMode = 'compact' | 'comfortable' | 'expanded';

export const SECTION_META: Record<SectionId, { label: string; icon: string }> = {
  hero:     { label: 'Hero Widget',    icon: 'bolt'          },
  search:   { label: 'Search & Filter',icon: 'search'        },
  tabs:     { label: 'Category Tabs',  icon: 'tab'           },
  tasks:    { label: "Today's Tasks",  icon: 'task-alt'      },
  notes:    { label: 'Recent Notes',   icon: 'description'   },
  upcoming: { label: 'Upcoming',       icon: 'calendar-month'},
};

export const DEFAULT_ORDER: SectionId[]   = ['hero', 'search', 'tabs', 'tasks', 'notes', 'upcoming'];
export const DEFAULT_VIS: Record<SectionId, boolean> = {
  hero: true, search: true, tabs: true, tasks: true, notes: true, upcoming: true,
};

export const LAYOUT_MODES = [
  { id: 'compact'     as LayoutMode, label: 'Compact',     desc: 'Tighter spacing, more content visible'   },
  { id: 'comfortable' as LayoutMode, label: 'Comfortable', desc: 'Balanced spacing (default)'              },
  { id: 'expanded'    as LayoutMode, label: 'Expanded',    desc: 'Larger cards, better readability'        },
];

// ─── Context ──────────────────────────────────────────────────────────────────
interface DashboardContextType {
  sectionOrder:         SectionId[];
  sectionVisibility:    Record<SectionId, boolean>;
  layoutMode:           LayoutMode;
  setSectionOrder:      (order: SectionId[]) => void;
  toggleSectionVisibility: (id: SectionId) => void;
  setLayoutMode:        (mode: LayoutMode) => void;
}

const DashboardContext = createContext<DashboardContextType>({
  sectionOrder:            DEFAULT_ORDER,
  sectionVisibility:       DEFAULT_VIS,
  layoutMode:              'comfortable',
  setSectionOrder:         () => {},
  toggleSectionVisibility: () => {},
  setLayoutMode:           () => {},
});

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [sectionOrder, setSectionOrder]           = useState<SectionId[]>(DEFAULT_ORDER);
  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionId, boolean>>(DEFAULT_VIS);
  const [layoutMode, setLayoutMode]               = useState<LayoutMode>('comfortable');

  const toggleSectionVisibility = (id: SectionId) =>
    setSectionVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <DashboardContext.Provider value={{
      sectionOrder, sectionVisibility, layoutMode,
      setSectionOrder, toggleSectionVisibility, setLayoutMode,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);
