import React, { useState } from 'react';
import { 
  ScrollView, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
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

export const Dashboard = () => {
  const { theme } = useTheme();
  const { 
    views, 
    activeViewIndex, 
    nodes, 
    taskGroups, 
    updateTask 
  } = useDashboard();
  
  const fabBottom = useFabBottom();
  
  // Modal states
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedViewToEdit, setSelectedViewToEdit] = useState<DashboardView | null>(null);

  // Calendar strip selected date state
  const [selectedCalDate, setSelectedCalDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

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



  // ─── Premium Weekly Calendar Strip ───
  const renderCalendarStrip = () => {
    const dates: Date[] = [];
    const today = new Date();
    
    // Generate dates: 3 days ago to 10 days in future
    for (let i = -3; i <= 10; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      dates.push(d);
    }

    return (
      <View style={[styles.calStripContainer, { borderBottomColor: theme.colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calStripScroll}>
          {dates.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const isSelected = selectedCalDate === dateStr;
            const dayName = format(date, 'EEE').toUpperCase();
            const dayNum = format(date, 'd');
            const isToday = format(today, 'yyyy-MM-dd') === dateStr;

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.calStripDay,
                  { backgroundColor: theme.colors.secondary },
                  isSelected && [styles.calStripDaySelected, { backgroundColor: theme.colors.primary }],
                  isToday && !isSelected && { borderWidth: 1.5, borderColor: theme.colors.primary }
                ]}
                onPress={() => setSelectedCalDate(dateStr)}
              >
                <Text style={[
                  styles.calStripDayName, 
                  { color: isSelected ? '#fff' : theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }
                ]}>
                  {dayName}
                </Text>
                <Text style={[
                  styles.calStripDayNum, 
                  { color: isSelected ? '#fff' : theme.colors.text, fontFamily: 'Inter_700Bold' }
                ]}>
                  {dayNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderCalendarLayout = (tasks: any[]) => {
    // Filter tasks scheduled specifically for the selected date
    const dayTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      // Resolve text date values (Today/Tomorrow) to matching format string
      let formattedDue = t.dueDate;
      if (t.dueDate === 'Today') formattedDue = format(new Date(), 'yyyy-MM-dd');
      else if (t.dueDate === 'Tomorrow') formattedDue = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      
      return formattedDue === selectedCalDate;
    });

    return (
      <View style={styles.calendarContainer}>
        {renderCalendarStrip()}

        <View style={styles.calendarHeader}>
          <Text style={[styles.calendarTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
            Agenda for {format(new Date(selectedCalDate + 'T00:00:00'), 'EEEE, MMMM d')}
          </Text>
        </View>

        <View style={styles.calendarList}>
          {dayTasks.map(t => renderTaskCard(t))}
          {dayTasks.length === 0 && (
            <View style={styles.calEmptyState}>
              <MaterialIcons name="event-busy" size={32} color={theme.colors.textSecondary} />
              <Text style={[styles.calEmptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                No tasks scheduled for this day
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ─── Single Task Card UI ───
  const renderTaskCard = (task: any, compact = false) => {
    const handleToggleCompleted = () => {
      updateTask(task.id, t => ({ ...t, completed: !t.completed }));
    };

    return (
      <View 
        key={task.id} 
        style={[
          styles.taskCard, 
          { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
          compact && { padding: 10, marginHorizontal: 0 }
        ]}
      >
        <TouchableOpacity 
          onPress={handleToggleCompleted}
          style={[
            styles.checkbox,
            { borderColor: task.completed ? theme.colors.primary : theme.colors.border },
            task.completed && { backgroundColor: theme.colors.primary }
          ]}
        >
          {task.completed && (
            <MaterialIcons name="check" size={11} color={theme.colors.primaryText} />
          )}
        </TouchableOpacity>
        
        <View style={styles.cardContent}>
          <Text style={[
            styles.cardTitle, 
            { 
              color: task.completed ? theme.colors.textSecondary : theme.colors.text,
              fontFamily: 'Inter_500Medium',
              textDecorationLine: task.completed ? 'line-through' : 'none'
            },
            compact && { fontSize: 13 }
          ]}>
            {task.title}
          </Text>
          <View style={styles.cardMetaRow}>
            {task.priority && (
              <View style={[styles.priorityPill, { 
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
              <Text style={[styles.tagText, { color: theme.colors.textSecondary }]}>
                #{task.tag}
              </Text>
            )}
            {task.dueDate && !compact && (
              <View style={styles.dateMeta}>
                <MaterialIcons name="schedule" size={11} color={theme.colors.textSecondary} />
                <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
                  {task.dueDate}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

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
    
    // Map widget IDs to render conditions
    const widgetVisibility = view.widgets.reduce<Record<string, boolean>>((acc, w) => {
      acc[w.id] = w.visible;
      return acc;
    }, {});

    const showWidgets = widgetVisibility['hero'] || widgetVisibility['tabs'] || widgetVisibility['notes'] || widgetVisibility['upcoming'];



    // List and Calendar layouts run in a single master vertical ScrollView
    return (
      <ScrollView 
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

        {/* Widgets section */}
        {widgetVisibility['hero'] && <HeroWidgetSection />}
        {widgetVisibility['tabs'] && <CategoryTabs />}
        {widgetVisibility['notes'] && <RecentNotes />}
        {widgetVisibility['upcoming'] && <Upcoming />}

        {/* Main tasks list or calendar workspace */}
        {widgetVisibility['tasks'] && (
          <View style={styles.workspaceSection}>
            <View style={styles.workspaceHeader}>
              <Text style={[styles.workspaceTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                {view.name.toUpperCase()} WORKSPACE
              </Text>
              <Text style={[styles.workspaceCount, { color: theme.colors.textSecondary }]}>
                {resolvedTasks.length} tasks
              </Text>
            </View>
            
            {view.layout === 'list' && renderListLayout(resolvedTasks, view)}
            {view.layout === 'calendar' && renderCalendarLayout(resolvedTasks)}
          </View>
        )}
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

      {/* Swipe Pager content */}
      <View style={{ flex: 1 }}>
        <DashboardPager 
          renderPageView={renderPageView}
          onPressAddView={() => {
            setSelectedViewToEdit(activeView);
            setShowSettings(true);
          }}
        />
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
});
