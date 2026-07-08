# Scalable Frontend-Only Dashboard & Hierarchical Project Nesting Plan

This document outlines the proposed design and implementation strategy to support multi-view swipeable dashboards, modular widget layouts, and a multi-level nested hierarchy of companies, sub-companies, projects, teams, and tasks, entirely on the **Frontend (client-side)**.

## User Review Required

> [!IMPORTANT]
> **Key Architecture Decisions (Frontend Only):**
> 1. **Client-Side Flat Store & Mock Data:** All nested folders (Companies, Departments, Teams, Projects) and tasks will be managed entirely in `DashboardContext.tsx` using local state. A flat index dictionary structure will be used to ensure $O(1)$ updates and zero-lag lookups.
> 2. **Recursive Selector Hook:** We will implement a custom hook `useSubtreeTasks` that recursively resolves child folder IDs in memory, allowing a view linked to "Company A" to dynamically aggregate all tasks from its child projects and teams.
> 3. **Swipe Navigation:** We will implement the swipeable paginated layout using a horizontal `FlatList` with `pagingEnabled` and custom animation transitions.
> 4. **Bottom Pagination Bar:** Under the swipe content, we will place a custom pagination indicator (`• • • • • +`) where tapping `+` prompts a modal to add a new custom dashboard view page.

---

## 🎨 Proposed Views Catalog
To provide maximum flexibility and scale, each Dashboard page can support one of these major layouts:

1. **Kanban Board View (Columns)**
   - Group tasks into columns dynamically: by **Status** (Inbox, In Progress, Review, Done), **Priority** (High, Med, Low), or **Project**.
2. **Structured List View**
   - Collapsible task lists categorized by due date grouping (Overdue, Today, Upcoming, Backlog).
3. **Calendar Grid View**
   - Full schedule view overlaying task deadlines with event timelines.
4. **Eisenhower Matrix View (2x2)**
   - Quadrant breakdown categorizing tasks by Urgent vs. Important for rapid priority sorting.
5. **Focus Deck View**
   - Minimalist focus interface showing only the active task, an elegant countdown timer, and haptic start buttons.

---

## ⚡ The Widget Library (Our USP)
Widgets are independent UI modules that users can add, remove, and order at the top or within their dashboard page layout:

### A. Focus & Progress Widgets
*   **Hero "Active Task" Focus Card:** Displays the next critical task with an interactive `Start Focus` button that starts a Pomodoro session or focus timer directly in the widget.
*   **Concentric Progress Rings:** Shows visual progress meters for (1) Completed tasks, (2) Active Focus time spent against target, and (3) Completed subtasks.
*   **Habit Checklist Grid:** A row of circular check-in buttons for daily routines (e.g. "Hydrate", "Gym", "Code Review").

### B. Productivity & Input Widgets
*   **Sticky Scratchpad:** A quick post-it note text input block for jotting thoughts or brainstorming instantly. It can be converted into a task or note with one tap.
*   **Category Segmented Tabs:** A segment selector (All / Tasks / Notes / Draw) to filter the dashboard content instantly.
*   **Task Velocity Chart:** A minimal Sparkline chart showing daily/weekly task completion trends.

### C. Context & Collaboration Widgets
*   **Pinned & Recent Notes Deck:** Horizontal card viewer displaying recent rich notes.
*   **Active Team Avatars:** Displays current status of active team members in that space (e.g., "Sarah: Focusing on App.tsx", "Joe: Offline").
*   **Activity Audit Feed:** Shows real-time changes inside the current company/project directory.

---

## Proposed Changes

We will group the changes into the following core areas:

### 1. Data Models & Schemas

#### Nested Folder/Project Nodes
We represent any folder hierarchy (Company, Division, Project, Team) as a flat key-value list of `ProjectNode` objects:

```typescript
export type NodeType = 'COMPANY' | 'FOLDER' | 'PROJECT' | 'TEAM';

export interface ProjectNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;      // Direct parent node for nesting
  color?: string;               // Node color representation
  icon?: string;                // MaterialIcons name
  childIds: string[];           // Direct children ids for quick lookup
}
```

#### Custom Dashboard View Configuration
Each swipeable dashboard view page is dynamically defined by this configuration structure:

```typescript
export interface DashboardView {
  id: string;
  name: string;
  layout: 'list' | 'board' | 'calendar';
  showCompleted: boolean;
  grouping: 'none' | 'priority' | 'tag' | 'dueDate' | 'project';
  sorting: 'manual' | 'dueDate' | 'priority' | 'created' | 'alphabetical';
  
  // Custom scope and filters
  filterDate: 'all' | 'today' | 'tomorrow' | 'overdue' | 'week';
  filterPriorities: ('HIGH' | 'MED' | 'LOW')[];
  filterTags: string[];
  filterSourceNodeId: string | null; // Id of Company/Project in the hierarchy. Null = All.
  
  // Widget toggles on this specific page
  widgets: {
    id: string; // 'hero' | 'tabs' | 'upcoming-strip' | 'stats' | 'notes'
    visible: boolean;
  }[];
}
```

---

### 2. Components & Layouts

#### [NEW] [FolderTree.tsx](file:///c:/Users/Shubham/Desktop/TODO/Frontend/src/features/dashboard/FolderTree.tsx)
- Renders the company/project nested navigation menu.
- Supports collapsible node rows with visual indentation representing depth levels.
- Clicking any node filters the active dashboard view context to that scope.

#### [NEW] [DashboardPager.tsx](file:///c:/Users/Shubham/Desktop/TODO/Frontend/src/features/dashboard/DashboardPager.tsx)
- Container that manages swiping between multiple dashboard views.
- Displays the custom pagination strip `• • • • • +` at the bottom of the screens.
- Triggers a beautiful bottom-sheet modal to add or edit dashboard views when `+` is tapped.

#### [NEW] [ViewConfigModal.tsx](file:///c:/Users/Shubham/Desktop/TODO/Frontend/src/features/dashboard/ViewConfigModal.tsx)
- Recreates the "Display Settings" panel from the screenshot.
- Includes Layout selectors, completed task toggles, sorting/grouping, filter options, and widget visibility switches.

#### [MODIFY] [DashboardContext.tsx](file:///c:/Users/Shubham/Desktop/TODO/Frontend/src/core/DashboardContext.tsx)
- Extends the existing state provider to store:
  - `views`: List of all custom dashboard pages.
  - `nodes`: List of all nested companies, projects, and folders.
  - `activeViewIndex`: Index of the currently active view page.
- Provides CRUD functions for views and folders in memory.

#### [MODIFY] [Dashboard.tsx](file:///c:/Users/Shubham/Desktop/TODO/Frontend/src/features/dashboard/Dashboard.tsx)
- Mounts `DashboardPager` to enable swiping between pages.
- Each page renders a dynamic layout (List of tasks, Kanban board columns, or Calendar agenda view) depending on its configuration.

---

## Verification Plan

### Manual Verification
1. **Swipe Performance Test**: Swiping between 5 custom views with 100+ tasks to verify 60fps render performance.
2. **Dynamic Filter Verification**: Verify changing filters (e.g. show only High Priority tasks) instantly updates the active swipe view.
3. **Nesting Check**: Add a nested hierarchy (Company -> Project -> Team) and verify that clicking the parent node resolves all tasks inside the children nodes correctly.
