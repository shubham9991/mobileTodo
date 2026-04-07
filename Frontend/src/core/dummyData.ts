// Dummy data for the entire dashboard
export type Priority = 'HIGH' | 'MED' | 'LOW';
export type TagType = 'work' | 'personal' | 'review' | 'health' | 'learning';

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
  children?: Subtask[];
}

export interface Attachment {
  id: string;
  type: 'image' | 'document' | 'link';
  uri: string;
  name: string;
  mimeType?: string;
  linkMeta?: { title?: string; favicon?: string; domain?: string };
}

export interface Task {
  id: string;
  title: string;
  tag: string;
  tagType: TagType;
  priority?: Priority;
  subtasks?: Subtask[];
  attachments?: Attachment[];
  comments?: number;
  commentsList?: { id: string; text: string; date: string }[];
  hasReminder?: boolean;
  completed: boolean;
  dueDate?: string;
  dueTime?: string;
}
export const dummyData = {
  user: {
    name: 'Shubham',
    todaysFocusCount: 3,
  },

  heroWidget: {
    label: 'NEXT TASK • WORK',
    title: 'UI Review',
    subtitle: 'Starting at 10:30 AM',
  },

  quickFilters: ['Tomorrow', '6 PM', 'Work'],

  todaysTasks: [
    {
      id: '1',
      title: 'Finalize Design System',
      tag: 'WORK',
      tagType: 'work',
      priority: 'HIGH',
      subtasks: [
        { id: '1', text: 'Research competitors', done: true },
        { id: '2', text: 'Draft outline', done: true },
        { id: '3', text: 'Write first section', done: false },
        { id: '4', text: 'Review and edit', done: false },
        { id: '5', text: 'Final submission', done: false },
      ],
      comments: 3,
      hasReminder: true,
      completed: false,
    },
    {
      id: '2',
      title: 'Update roadmap',
      tag: 'PERSONAL',
      tagType: 'personal',
      priority: 'MED',
      subtasks: [{ id: '1', text: 'Update roadmap', done: true }],
      hasReminder: false,
      completed: true,
    },
  ],

  recentNotes: [
    {
      id: '1',
      title: 'Project Modular Vision',
      preview: 'Explore shadow/ui patterns for mobile...',
      time: '2m ago',
      pinned: true,
      tag: 'WORK',
    },
    {
      id: '2',
      title: 'Meeting Assets',
      preview: 'Review the latest feedback from stakeholders...',
      time: '1h ago',
      pinned: false,
      tag: 'WORK',
    },
    {
      id: '3',
      title: 'Recipe: Mushroom Risotto (Food)',
      preview: 'Ingredients: arborio rice, mushrooms, chicken broth...',
      time: '2d ago',
      pinned: false,
      tag: 'FOOD',
    },
  ],

  upcoming: {
    label: 'NEXT 4 DAYS',
    days: [
      { day: 'THU', date: 24, isActive: true },
      { day: 'FRI', date: 25, isActive: false },
      { day: 'SAT', date: 26, isActive: false },
      { day: 'SUN', date: 27, isActive: false },
    ],
    events: [
      {
        id: '1',
        time: '09:00 AM',
        title: 'Quarterly Review Meeting',
        tag: 'WORK',
        tagType: 'work',
        location: 'Main Hall',
        comments: 2,
        hasReminder: true,
        dotColor: '#007AFF',
      },
      {
        id: '2',
        time: '11:30 AM',
        title: 'Catch up with Sarah',
        tag: 'PERSONAL',
        tagType: 'personal',
        location: 'Google Meet',
        subtasks: [{ id: '1', text: 'Catch up with Sarah', done: false }],
        hasReminder: false,
        dotColor: '#8E8E93',
      },
      {
        id: '3',
        time: '03:00 PM',
        title: 'Project Handover',
        tag: 'REVIEW',
        tagType: 'review',
        location: 'Shared Drive',
        subtasks: [
          { id: '1', text: 'Prepare handover document', done: false },
          { id: '2', text: 'Schedule meeting with team', done: false },
          { id: '3', text: 'Transfer project files', done: false },
          { id: '4', text: 'Update project status', done: false },
          { id: '5', text: 'Send confirmation email', done: false },
        ],
        priority: 'HIGH',
        hasReminder: false,
        dotColor: '#FF9500',
      },
    ],
  },

  taskStats: {
    total: 12,
    active: 9,
    completed: 3,
  },

  taskGroups: [
    {
      id: 'today',
      label: 'Today',
      tasks: [
        {
          id: 't1',
          title: 'Finalize Design System',
          tag: 'WORK',
          tagType: 'work' as TagType,
          priority: 'HIGH' as Priority,
          subtasks: [
            { id: '1', text: 'Research competitors', done: true },
            { id: '2', text: 'Draft outline', done: true },
            { id: '3', text: 'Write first section', done: false },
            { id: '4', text: 'Review and edit', done: false },
            { id: '5', text: 'Final submission', done: false },
          ],
          comments: 3,
          hasReminder: true,
          completed: false,
          dueDate: 'Today',
          dueTime: '10:30 AM',
        },
        {
          id: 't2',
          title: 'Review PR #42 — Auth module',
          tag: 'WORK',
          tagType: 'work' as TagType,
          priority: 'MED' as Priority,
          subtasks: [
            { id: '1', text: 'Review code changes', done: true },
            { id: '2', text: 'Test authentication flow', done: false },
          ],
          comments: 1,
          hasReminder: false,
          completed: false,
          dueDate: 'Today',
          dueTime: '2:00 PM',
        },
        {
          id: 't3',
          title: 'Update roadmap',
          tag: 'PERSONAL',
          tagType: 'personal' as TagType,
          priority: 'MED' as Priority,
          subtasks: [{ id: '1', text: 'Update roadmap', done: true }],
          hasReminder: false,
          completed: true,
          dueDate: 'Today',
        },
      ],
    },
    {
      id: 'week',
      label: 'This Week',
      tasks: [
        {
          id: 't4',
          title: 'Write onboarding copy for v2',
          tag: 'WORK',
          tagType: 'work' as TagType,
          priority: 'LOW' as Priority,
          comments: 2,
          hasReminder: true,
          completed: false,
          dueDate: 'Fri, Mar 28',
          dueTime: '5:00 PM',
        },
        {
          id: 't5',
          title: 'Gym — Leg Day',
          tag: 'HEALTH',
          tagType: 'health' as TagType,
          hasReminder: true,
          completed: false,
          dueDate: 'Sat, Mar 29',
          dueTime: '7:00 AM',
        },
        {
          id: 't6',
          title: 'Read "Atomic Habits" Ch. 4–6',
          tag: 'LEARNING',
          tagType: 'learning' as TagType,
          priority: 'LOW' as Priority,
          hasReminder: false,
          completed: false,
          dueDate: 'Sun, Mar 30',
        },
        {
          id: 't7',
          title: 'Send weekly progress report',
          tag: 'WORK',
          tagType: 'work' as TagType,
          priority: 'HIGH' as Priority,
          subtasks: [
            { id: '1', text: 'Gather project updates', done: true },
            { id: '2', text: 'Draft report content', done: true },
            { id: '3', text: 'Send to stakeholders', done: true },
          ],
          comments: 5,
          hasReminder: true,
          completed: false,
          dueDate: 'Fri, Mar 28',
          dueTime: '6:00 PM',
        },
      ],
    },
    {
      id: 'completed',
      label: 'Completed',
      tasks: [
        {
          id: 't8',
          title: 'Setup Expo Router navigation',
          tag: 'WORK',
          tagType: 'work' as TagType,
          completed: true,
          dueDate: 'Yesterday',
        },
        {
          id: 't9',
          title: 'Create theme system architecture',
          tag: 'WORK',
          tagType: 'work' as TagType,
          completed: true,
          dueDate: 'Yesterday',
        },
        {
          id: 't10',
          title: 'Buy groceries for the week (Food)',
          tag: 'FOOD',
          tagType: 'personal' as TagType,
          completed: true,
          dueDate: 'Last Week',
        },
      ],
    },
  ],

  eventsData: {
    stats: { total: 8, today: 2, thisWeek: 6 },

    // Week days for the calendar strip (centred on THU Mar 27)
    weekDays: [
      { day: 'MON', date: 24, month: 'Mar', hasEvent: true  },
      { day: 'TUE', date: 25, month: 'Mar', hasEvent: false },
      { day: 'WED', date: 26, month: 'Mar', hasEvent: true  },
      { day: 'THU', date: 27, month: 'Mar', hasEvent: true  },
      { day: 'FRI', date: 28, month: 'Mar', hasEvent: true  },
      { day: 'SAT', date: 29, month: 'Mar', hasEvent: false },
      { day: 'SUN', date: 30, month: 'Mar', hasEvent: false },
    ],

    // Events keyed by date number for fast lookup
    eventsByDate: {
      24: [
        {
          id: 'e1',
          startTime: '10:00 AM',
          endTime:   '11:00 AM',
          title:     'Design Sync',
          tag:       'WORK',
          tagType:   'work',
          location:  'Google Meet',
          attendees: 4,
          hasReminder: true,
          color:     '#6366F1',
          description: 'Weekly sync to review design progress and unblock the team.',
        },
        {
          id: 'e2',
          startTime: '02:30 PM',
          endTime:   '03:00 PM',
          title:     'Coffee with Alex',
          tag:       'PERSONAL',
          tagType:   'personal',
          location:  'Starbucks, MG Road',
          attendees: 2,
          hasReminder: false,
          color:     '#71717A',
          description: '',
        },
      ],
      26: [
        {
          id: 'e3',
          startTime: '09:00 AM',
          endTime:   '10:30 AM',
          title:     'Sprint Planning',
          tag:       'WORK',
          tagType:   'work',
          location:  'Conf Room B',
          attendees: 7,
          hasReminder: true,
          color:     '#6366F1',
          description: 'Plan scope for Sprint 12 — capacity, stories and blockers.',
        },
      ],
      27: [
        {
          id: 'e4',
          startTime: '09:00 AM',
          endTime:   '10:00 AM',
          title:     'Quarterly Review Meeting',
          tag:       'WORK',
          tagType:   'work',
          location:  'Main Hall',
          attendees: 12,
          hasReminder: true,
          color:     '#007AFF',
          description: 'Q1 results presentation to leadership.',
        },
        {
          id: 'e5',
          startTime: '11:30 AM',
          endTime:   '12:00 PM',
          title:     'Catch up with Sarah',
          tag:       'PERSONAL',
          tagType:   'personal',
          location:  'Google Meet',
          attendees: 2,
          hasReminder: false,
          color:     '#71717A',
          description: '',
        },
        {
          id: 'e6',
          startTime: '03:00 PM',
          endTime:   '04:30 PM',
          title:     'Project Handover',
          tag:       'REVIEW',
          tagType:   'review',
          location:  'Shared Drive',
          attendees: 5,
          hasReminder: false,
          color:     '#F97316',
          description: 'Transfer ownership of the Retail Plugin project.',
        },
      ],
      28: [
        {
          id: 'e7',
          startTime: '05:00 PM',
          endTime:   '06:00 PM',
          title:     'Write Weekly Report',
          tag:       'WORK',
          tagType:   'work',
          location:  'Remote',
          attendees: 1,
          hasReminder: true,
          color:     '#6366F1',
          description: '',
        },
        {
          id: 'e8',
          startTime: '07:00 PM',
          endTime:   '08:30 PM',
          title:     'Team Dinner',
          tag:       'PERSONAL',
          tagType:   'personal',
          location:  'The Fatty Bao, Indiranagar',
          attendees: 8,
          hasReminder: true,
          color:     '#EC4899',
          description: 'End-of-sprint team dinner celebration.',
        },
      ],
    } as Record<number, any[]>,
  },
};
