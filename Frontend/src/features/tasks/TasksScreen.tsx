import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, TextInput, Text, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../themes/ThemeContext';
import { TopNavbar } from '../../layout/TopNavbar';
import { BottomNavbar } from '../../layout/BottomNavbar';
import { TasksHeader } from './TasksHeader';
import { TaskFilter } from './TaskFilter';
import { TaskGroup as TaskGroupComponent } from './TaskGroup';
import { QuickAddBar } from './QuickAddBar';
import { dummyData, Task, Priority, TagType, Subtask, Attachment } from '../../core/dummyData';
import { useDashboard } from '../../core/DashboardContext';
import { useFabBottom } from '../../core/hooks/useFabBottom';
import { FABMenu } from '../../core/components/FABMenu';
import { TaskComposer } from '../../core/components/TaskComposer';
import { TaskDetailModal } from './TaskDetailModal';

type FilterTab = 'All' | 'Active' | 'Completed';

// Task Group type
interface TaskGroup {
  id: string;
  label: string;
  tasks: Task[];
}

// Generate unique ID
const generateId = () => `t${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ── Empty State ─────────────────────────────────────────────────────────────
const EmptyState = ({ filter }: { filter: FilterTab }) => {
  const { theme } = useTheme();
  return (
    <View style={emptyStyles.container}>
      <View style={[emptyStyles.iconWrap, { backgroundColor: theme.colors.secondary }]}>
        <MaterialIcons name="task-alt" size={36} color={theme.colors.textSecondary} />
      </View>
      <Text style={[emptyStyles.title, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
        {filter === 'Completed' ? 'Nothing here yet' : 'All clear!'}
      </Text>
      <Text style={[emptyStyles.subtitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
        {filter === 'Active'
          ? 'You\'ve completed all your tasks 🎉'
          : filter === 'Completed'
          ? 'Complete a task to see it here.'
          : 'No tasks match your search.'}
      </Text>
    </View>
  );
};

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

// ── Main Screen ─────────────────────────────────────────────────────────────
export const TasksScreen = () => {
  const { theme } = useTheme();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [activeSort, setActiveSort]     = useState('Due Date');
  const [search, setSearch]             = useState('');
  const { taskGroups, setTaskGroups, handleComposerSave } = useDashboard();
  const [showComposer, setShowComposer] = useState(false);
  const [composerInitialTitle, setComposerInitialTitle] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const fabBottom = useFabBottom();

  // Handle quick add - creates a simple task
  const handleQuickAdd = useCallback((title: string) => {
    const newTask: Task = {
      id: generateId(),
      title: title.trim(),
      tag: 'PERSONAL',
      tagType: 'personal' as TagType,
      completed: false,
      dueDate: 'Today',
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    setTaskGroups(prev => 
      prev.map(g => 
        g.id === 'today' 
          ? { ...g, tasks: [newTask, ...g.tasks] }
          : g
      )
    );
  }, []);

  // Handle opening full composer
  const handleQuickAddFocus = useCallback(() => {
    setComposerInitialTitle('');
    setShowComposer(true);
  }, []);

  // Handle saving from full composer is handled by context, but we still need wrapper for TasksScreen specific states if needed
  const localComposerSave = useCallback((taskData: any) => {
    handleComposerSave(taskData);
  }, [handleComposerSave]);

  // Handle task toggle
  const handleTaskToggle = useCallback((taskId: string, completed: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    setTaskGroups(prev => 
      prev.map(group => ({
        ...group,
        tasks: group.tasks.map(t => 
          t.id === taskId ? { ...t, completed } : t
        )
      }))
    );
  }, []);

  const filteredGroups = taskGroups
    .map((group) => ({
      ...group,
      tasks: group.tasks.filter((t: Task) => {
        const matchesFilter =
          activeFilter === 'All' ||
          (activeFilter === 'Active' && !t.completed) ||
          (activeFilter === 'Completed' && t.completed);
        const matchesSearch =
          search.trim() === '' ||
          t.title.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
      }),
    }))
    .filter((group) => group.tasks.length > 0);

  const totalVisible = filteredGroups.reduce((sum, g) => sum + g.tasks.length, 0);
  const totalTasks = taskGroups.reduce((sum, g) => sum + g.tasks.length, 0);
  const completedTasks = taskGroups.reduce((sum, g) => sum + g.tasks.filter(t => t.completed).length, 0);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <TopNavbar />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
      >
        <TasksHeader total={totalTasks} completed={completedTasks} />

        {/* ── Quick Add Bar (Todoist-style) ───────────── */}
        <QuickAddBar 
          onAddTask={handleQuickAdd}
          onFocus={handleQuickAddFocus}
          placeholder="Add a task..."
        />

        {/* ── Inline Search ───────────────────────────── */}
        <View style={[styles.searchWrap, { borderBottomColor: theme.colors.border }]}>
          <View style={[styles.searchBar, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
            <MaterialIcons name="search" size={17} color={theme.colors.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search tasks..."
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.searchInput, { color: theme.colors.text, fontFamily: 'Inter_400Regular' }]}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <MaterialIcons name="cancel" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          {search.length > 0 && (
            <Text style={[styles.searchResult, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              {totalVisible} result{totalVisible !== 1 ? 's' : ''} for &quot;{search}&quot;
            </Text>
          )}
        </View>

        <TaskFilter
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          activeSort={activeSort}
          onSortChange={setActiveSort}
        />

        {/* Groups or Empty State */}
        {filteredGroups.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <View style={styles.groups}>
            {filteredGroups.map((group) => (
              <TaskGroupComponent
                key={group.id}
                label={group.label}
                tasks={group.tasks as Task[]}
                defaultOpen={group.id !== 'completed'}
                onTaskToggle={handleTaskToggle}
                onTaskPress={(task) => { setSelectedTaskId(task.id); setShowDetail(true); }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <FABMenu bottom={fabBottom} />

      <BottomNavbar />

      {/* Full Task Composer Modal */}
      <TaskComposer 
        visible={showComposer} 
        onClose={() => setShowComposer(false)}
        onSave={localComposerSave}
        initialTitle={composerInitialTitle}
      />

      <TaskDetailModal 
        visible={showDetail}
        taskId={selectedTaskId}
        onClose={() => setShowDetail(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    height: 20,
  },
  searchResult: {
    fontSize: 12,
    marginTop: 6,
  },
  groups: { paddingTop: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});
