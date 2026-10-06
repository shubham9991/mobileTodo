import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { useDashboard } from '../../../core/DashboardContext';
import { getAllNotes, Note, formatRelativeTime } from '../../../core/db/notesStore';
import { getAllDrawings, generateDrawingId, DrawingMeta, formatDrawingTime } from '../../drawing/drawingStore';
import { Task } from '../../../core/dummyData';
import { BentoWidgetKey, WidgetSize } from '../dashboardPrefsStore';

// Components & Widgets
import { RecentSketchesWidget } from '../components/RecentSketchesWidget';
import { Upcoming } from '../Upcoming';
import { PomodoroWidget } from '../components/PomodoroWidget';
import { ScratchpadWidget } from '../components/ScratchpadWidget';
import { HabitTrackerWidget } from '../components/HabitTrackerWidget';
import { ProductivityStatsWidget } from '../components/ProductivityStatsWidget';
import { BentoGrid } from '../components/BentoGrid';

// Modals
import { QuickTasksModal } from '../components/QuickTasksModal';
import { WidgetContextMenuModal } from '../components/WidgetContextMenuModal';
import { WidgetLibraryModal } from '../components/WidgetLibraryModal';
import { TaskDetailModal } from '../../tasks/TaskDetailModal';

interface BentoHubViewProps {
  onOpenComposer: () => void;
  onToggleTask: (taskId: string) => void;
}

const WIDGET_TITLES: Record<BentoWidgetKey, { title: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  statusBar: { title: 'Status Summary & Greeting', icon: 'wb-sunny' },
  heroCard: { title: 'Primary Focus Hero Card', icon: 'bolt' },
  tasks: { title: "Today's Tasks Checklist", icon: 'check-circle-outline' },
  recentNote: { title: 'Recent Note Snippet', icon: 'description' },
  sketch: { title: 'Latest Canvas Sketch', icon: 'brush' },
  quickCapture: { title: 'Quick Capture Action Dock', icon: 'bolt' },
  pomodoro: { title: 'Pomodoro Sprint Timer', icon: 'timer' },
  scratchpad: { title: 'Quick Scratchpad Memo', icon: 'sticky-note-2' },
  habits: { title: 'Daily Habit & Streak Tracker', icon: 'local-fire-department' },
  productivityStats: { title: 'Productivity Velocity Score', icon: 'insights' },
  recentSketches: { title: 'Recent Canvas Sketches Carousel', icon: 'palette' },
  upcoming: { title: 'Upcoming Deadlines Strip', icon: 'calendar-month' },
  bentoGrid: { title: 'Bento Grid', icon: 'grid-view' },
};

export const BentoHubView = ({ onOpenComposer, onToggleTask }: BentoHubViewProps) => {
  const { theme } = useTheme();
  const router = useRouter();
  const {
    taskGroups,
    dashboardPrefs,
    updateWidgetVis,
    updateWidgetOrder,
    updateWidgetSize,
    handleComposerSave,
  } = useDashboard();

  const [notes, setNotes] = useState<Note[]>([]);
  const [sketches, setSketches] = useState<DrawingMeta[]>([]);

  // Modals state
  const [selectedDetailTaskId, setSelectedDetailTaskId] = useState<string | null>(null);
  const [showQuickTasks, setShowQuickTasks] = useState<boolean>(false);
  const [contextMenuWidget, setContextMenuWidget] = useState<BentoWidgetKey | null>(null);
  const [showLibraryModal, setShowLibraryModal] = useState<boolean>(false);

  const vis = dashboardPrefs.widgetVisibility.bento;
  const order = dashboardPrefs.widgetOrder?.bento || [
    'statusBar',
    'heroCard',
    'tasks',
    'recentNote',
    'sketch',
    'quickCapture',
    'pomodoro',
    'scratchpad',
    'habits',
    'productivityStats',
    'recentSketches',
    'upcoming',
  ];
  const sizes: Record<string, WidgetSize> = dashboardPrefs.widgetSizes || {};
  const density = dashboardPrefs.density || 'comfortable';

  const loadData = useCallback(async () => {
    try {
      const [n, d] = await Promise.all([getAllNotes(), getAllDrawings()]);
      setNotes(n);
      setSketches(d);
    } catch {
      // safe fallback
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // All flat tasks
  const allTasks = useMemo(() => {
    return taskGroups.reduce<Task[]>((acc, g) => [...acc, ...g.tasks], []);
  }, [taskGroups]);

  const pendingTasks = useMemo(() => {
    return allTasks.filter((t) => !t.completed);
  }, [allTasks]);

  // Hero focus task: the first high priority task or first pending task
  const heroTask = useMemo(() => {
    return pendingTasks.find((t) => t.priority === 'HIGH') || pendingTasks[0] || null;
  }, [pendingTasks]);

  // Greeting calculation
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const handleOpenNote = (note: Note) => {
    router.push({ pathname: '/note', params: { noteId: note.id, noteTitle: note.title } });
  };

  const handleCreateNote = () => {
    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    router.push({ pathname: '/note', params: { noteId: id, noteTitle: '' } });
  };

  const handleOpenSketch = (sketch: DrawingMeta) => {
    router.push({ pathname: '/drawing', params: { drawingId: sketch.id, drawingTitle: sketch.title } });
  };

  const handleCreateSketch = () => {
    const id = generateDrawingId();
    router.push({ pathname: '/drawing', params: { drawingId: id, drawingTitle: 'Untitled Sketch' } });
  };

  const handleQuickAddTask = (title: string) => {
    handleComposerSave({
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      priority: 'MED',
      tag: 'PERSONAL',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  // Context Menu Actions
  const handleOpenContextMenu = (key: BentoWidgetKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setContextMenuWidget(key);
  };

  const handleToggleWidgetSize = () => {
    if (!contextMenuWidget) return;
    const current = sizes[contextMenuWidget] || (['statusBar', 'heroCard', 'recentSketches', 'upcoming'].includes(contextMenuWidget) ? 'full' : 'half');
    const next: WidgetSize = current === 'half' ? 'full' : 'half';
    updateWidgetSize(contextMenuWidget, next);
  };

  const handleMoveWidget = (dir: 1 | -1) => {
    if (!contextMenuWidget) return;
    const arr = [...order];
    const idx = arr.indexOf(contextMenuWidget);
    if (idx === -1) return;
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    updateWidgetOrder('bento', arr);
  };

  const handleRemoveWidget = () => {
    if (!contextMenuWidget) return;
    updateWidgetVis('bento', contextMenuWidget, false);
  };

  const handleAddWidgetFromLibrary = (id: BentoWidgetKey) => {
    updateWidgetVis('bento', id, true);
    if (!order.includes(id)) {
      updateWidgetOrder('bento', [...order, id]);
    }
  };

  // Density metrics
  const isCompact = density === 'compact';
  const isExpanded = density === 'expanded';
  const tileMinHeight = isCompact ? 130 : isExpanded ? 165 : 150;
  const taskCount = isCompact ? 2 : isExpanded ? 4 : 3;

  // Individual Widget Renderers
  const renderWidget = (key: BentoWidgetKey, forcedSize?: WidgetSize) => {
    const currentSize = forcedSize || sizes[key] || (['statusBar', 'heroCard', 'recentSketches', 'upcoming'].includes(key) ? 'full' : 'half');

    switch (key) {
      case 'statusBar':
        return (
          <TouchableOpacity
            key="statusBar"
            style={[styles.statusBar, isCompact && styles.statusBarCompact]}
            onLongPress={() => handleOpenContextMenu('statusBar')}
            delayLongPress={350}
            activeOpacity={0.9}
          >
            <View>
              <Text style={[styles.greetingText, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }, isCompact && { fontSize: 19 }]}>
                {greeting}
              </Text>
              <Text style={[styles.dateText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                {format(new Date(), 'EEEE, MMMM d')}
              </Text>
            </View>

            {/* Triad Live Metric Chips */}
            <View style={styles.metricRow}>
              <View style={[styles.metricChip, { backgroundColor: theme.colors.secondary }]}>
                <MaterialIcons name="task-alt" size={13} color="#10B981" />
                <Text style={[styles.metricText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  {pendingTasks.length} {pendingTasks.length === 1 ? 'Task' : 'Tasks'}
                </Text>
              </View>

              <View style={[styles.metricChip, { backgroundColor: theme.colors.secondary }]}>
                <MaterialIcons name="description" size={13} color="#F59E0B" />
                <Text style={[styles.metricText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  {notes.length} Notes
                </Text>
              </View>

              <View style={[styles.metricChip, { backgroundColor: theme.colors.secondary }]}>
                <MaterialIcons name="brush" size={13} color="#6366F1" />
                <Text style={[styles.metricText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  {sketches.length} Sketches
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );

      case 'heroCard':
        if (!heroTask) return null;
        return (
          <TouchableOpacity
            key="heroCard"
            style={[
              styles.heroCardOuter,
              { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
              isCompact && styles.heroCardCompact,
              isExpanded && styles.heroCardExpanded,
            ]}
            onLongPress={() => handleOpenContextMenu('heroCard')}
            delayLongPress={350}
            activeOpacity={0.9}
          >
            <View style={styles.heroHeader}>
              <MaterialIcons name="bolt" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.heroHeaderTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                PRIMARY FOCUS
              </Text>
            </View>

            <View style={[styles.heroCardInner, { backgroundColor: theme.colors.heroCardBg }]}>
              <TouchableOpacity
                style={styles.heroContent}
                onPress={() => setSelectedDetailTaskId(heroTask.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.heroTag, { color: 'rgba(250,250,250,0.6)', fontFamily: 'Inter_500Medium' }]}>
                  {heroTask.tag ? `#${heroTask.tag}` : 'PRIORITY TASK'}
                </Text>
                <Text style={[styles.heroTaskTitle, { color: theme.colors.heroCardText, fontFamily: 'Inter_600SemiBold' }]}>
                  {heroTask.title}
                </Text>
                {heroTask.dueDate && (
                  <Text style={[styles.heroDueText, { color: 'rgba(250,250,250,0.6)', fontFamily: 'Inter_400Regular' }]}>
                    Due: {heroTask.dueDate}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.heroActionBtn, { backgroundColor: theme.colors.cardPrimary }]}
                onPress={() => onToggleTask(heroTask.id)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="check" size={15} color={theme.colors.text} />
                <Text style={[styles.heroActionText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );

      case 'tasks':
        return (
          <TouchableOpacity
            key="tasks"
            style={[
              styles.tile,
              {
                backgroundColor: theme.colors.cardPrimary,
                borderColor: theme.colors.border,
                minHeight: tileMinHeight,
                flex: currentSize === 'half' ? 1 : undefined,
                width: currentSize === 'full' ? '100%' : undefined,
              },
            ]}
            onPress={() => setShowQuickTasks(true)}
            onLongPress={() => handleOpenContextMenu('tasks')}
            delayLongPress={350}
            activeOpacity={0.9}
          >
            {/* Header: Tap opens QuickTasksModal */}
            <TouchableOpacity
              style={styles.tileHeader}
              onPress={() => setShowQuickTasks(true)}
              activeOpacity={0.7}
            >
              <View style={styles.headerLeft}>
                <MaterialIcons name="check-circle-outline" size={14} color="#10B981" />
                <Text style={[styles.tileTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                  TASKS ({pendingTasks.length})
                </Text>
              </View>
              <TouchableOpacity onPress={onOpenComposer} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="add" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </TouchableOpacity>

            <View style={styles.tileBody}>
              {pendingTasks.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyContainer}
                  onPress={() => setShowQuickTasks(true)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="done-all" size={20} color={theme.colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    All done for today!
                  </Text>
                </TouchableOpacity>
              ) : (
                pendingTasks.slice(0, currentSize === 'full' ? taskCount * 2 : taskCount).map((t) => (
                  <View key={t.id} style={styles.taskItemRow}>
                    {/* Checkbox Tap: isolated toggle */}
                    <TouchableOpacity
                      style={styles.miniCheckboxTouch}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        onToggleTask(t.id);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 6 }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.miniCheckbox,
                          { borderColor: t.completed ? theme.colors.primary : theme.colors.border },
                          t.completed && { backgroundColor: theme.colors.primary },
                        ]}
                      >
                        {t.completed && (
                          <MaterialIcons name="check" size={10} color={theme.colors.primaryText} />
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Text Tap: opens TaskDetailModal */}
                    <TouchableOpacity
                      style={styles.taskItemTextTouch}
                      onPress={() => setSelectedDetailTaskId(t.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.taskItemText,
                          {
                            color: t.completed ? theme.colors.textSecondary : theme.colors.text,
                            textDecorationLine: t.completed ? 'line-through' : 'none',
                            fontFamily: 'Inter_400Regular',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {t.title}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </TouchableOpacity>
        );

      case 'recentNote':
        return (
          <TouchableOpacity
            key="recentNote"
            style={[
              styles.tile,
              {
                backgroundColor: theme.colors.cardPrimary,
                borderColor: theme.colors.border,
                minHeight: tileMinHeight,
                flex: currentSize === 'half' ? 1 : undefined,
                width: currentSize === 'full' ? '100%' : undefined,
              },
            ]}
            onPress={() => (notes[0] ? handleOpenNote(notes[0]) : handleCreateNote())}
            onLongPress={() => handleOpenContextMenu('recentNote')}
            delayLongPress={350}
            activeOpacity={0.8}
          >
            <View style={styles.tileHeader}>
              <View style={styles.headerLeft}>
                <MaterialIcons name="description" size={14} color="#F59E0B" />
                <Text style={[styles.tileTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                  RECENT NOTE
                </Text>
              </View>
              {notes[0]?.pinned && (
                <MaterialIcons name="push-pin" size={12} color={theme.colors.primary} />
              )}
            </View>

            {notes[0] ? (
              <View style={styles.tileBody}>
                <Text
                  style={[styles.noteTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}
                  numberOfLines={1}
                >
                  {notes[0].title || 'Untitled Note'}
                </Text>
                <Text
                  style={[styles.noteSnippet, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}
                  numberOfLines={currentSize === 'full' ? 4 : 3}
                >
                  {notes[0].preview || 'No content preview'}
                </Text>
                <View style={styles.tileFooter}>
                  <MaterialIcons name="schedule" size={10} color={theme.colors.textSecondary} />
                  <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
                    {formatRelativeTime(notes[0].updatedAt)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="note-add" size={20} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  Tap to create note
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );

      case 'sketch':
        return (
          <TouchableOpacity
            key="sketch"
            style={[
              styles.tile,
              {
                backgroundColor: theme.colors.cardPrimary,
                borderColor: theme.colors.border,
                minHeight: tileMinHeight,
                flex: currentSize === 'half' ? 1 : undefined,
                width: currentSize === 'full' ? '100%' : undefined,
              },
            ]}
            onPress={() => (sketches[0] ? handleOpenSketch(sketches[0]) : handleCreateSketch())}
            onLongPress={() => handleOpenContextMenu('sketch')}
            delayLongPress={350}
            activeOpacity={0.8}
          >
            <View style={styles.tileHeader}>
              <View style={styles.headerLeft}>
                <MaterialIcons name="brush" size={14} color="#6366F1" />
                <Text style={[styles.tileTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                  LATEST SKETCH
                </Text>
              </View>
              <TouchableOpacity onPress={handleCreateSketch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="add" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            {sketches[0] ? (
              <View style={styles.sketchBody}>
                {sketches[0].thumbnailUri ? (
                  <View style={[styles.sketchThumbWrap, currentSize === 'full' && { height: 75 }]}>
                    <Image source={{ uri: sketches[0].thumbnailUri }} style={styles.sketchImage} resizeMode="cover" />
                  </View>
                ) : (
                  <View style={[styles.sketchPlaceholder, { backgroundColor: theme.colors.secondary }]}>
                    <MaterialIcons name="gesture" size={24} color="#6366F1" />
                  </View>
                )}
                <Text
                  style={[styles.sketchTitleText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}
                  numberOfLines={1}
                >
                  {sketches[0].title || 'Untitled Sketch'}
                </Text>
                <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
                  {formatDrawingTime(sketches[0].updatedAt)}
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="gesture" size={20} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  Tap to start sketch
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );

      case 'quickCapture':
        return (
          <TouchableOpacity
            key="quickCapture"
            style={[
              styles.tile,
              {
                backgroundColor: theme.colors.cardPrimary,
                borderColor: theme.colors.border,
                minHeight: tileMinHeight,
                flex: currentSize === 'half' ? 1 : undefined,
                width: currentSize === 'full' ? '100%' : undefined,
              },
            ]}
            onLongPress={() => handleOpenContextMenu('quickCapture')}
            delayLongPress={350}
            activeOpacity={0.9}
          >
            <View style={styles.tileHeader}>
              <View style={styles.headerLeft}>
                <MaterialIcons name="bolt" size={14} color={theme.colors.primary} />
                <Text style={[styles.tileTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                  QUICK CAPTURE
                </Text>
              </View>
            </View>

            <View style={[styles.captureActionsColumn, currentSize === 'full' && { flexDirection: 'row' }]}>
              <TouchableOpacity
                style={[styles.captureBtn, { backgroundColor: theme.colors.secondary, flex: currentSize === 'full' ? 1 : undefined }]}
                onPress={onOpenComposer}
                activeOpacity={0.7}
              >
                <MaterialIcons name="add-task" size={15} color="#10B981" />
                <Text style={[styles.captureBtnText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                  + Task
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.captureBtn, { backgroundColor: theme.colors.secondary, flex: currentSize === 'full' ? 1 : undefined }]}
                onPress={handleCreateNote}
                activeOpacity={0.7}
              >
                <MaterialIcons name="edit-note" size={16} color="#F59E0B" />
                <Text style={[styles.captureBtnText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                  + Note
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.captureBtn, { backgroundColor: theme.colors.secondary, flex: currentSize === 'full' ? 1 : undefined }]}
                onPress={handleCreateSketch}
                activeOpacity={0.7}
              >
                <MaterialIcons name="gesture" size={15} color="#6366F1" />
                <Text style={[styles.captureBtnText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                  + Sketch
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );

      case 'pomodoro':
        return (
          <PomodoroWidget
            key="pomodoro"
            size={currentSize}
            tasks={pendingTasks}
            onOpenTaskDetail={(id) => setSelectedDetailTaskId(id)}
            onLongPress={() => handleOpenContextMenu('pomodoro')}
          />
        );

      case 'scratchpad':
        return (
          <ScratchpadWidget
            key="scratchpad"
            size={currentSize}
            onNoteCreated={loadData}
            onLongPress={() => handleOpenContextMenu('scratchpad')}
          />
        );

      case 'habits':
        return (
          <HabitTrackerWidget
            key="habits"
            size={currentSize}
            onLongPress={() => handleOpenContextMenu('habits')}
          />
        );

      case 'productivityStats':
        return (
          <ProductivityStatsWidget
            key="productivityStats"
            size={currentSize}
            tasks={allTasks}
            notesCount={notes.length}
            sketchesCount={sketches.length}
            onLongPress={() => handleOpenContextMenu('productivityStats')}
          />
        );

      case 'recentSketches':
        return (
          <TouchableOpacity
            key="recentSketches"
            onLongPress={() => handleOpenContextMenu('recentSketches')}
            delayLongPress={350}
            activeOpacity={0.9}
          >
            <RecentSketchesWidget
              compact={isCompact}
              maxItems={isExpanded ? 4 : 2}
            />
          </TouchableOpacity>
        );

      case 'upcoming':
        return (
          <TouchableOpacity
            key="upcoming"
            onLongPress={() => handleOpenContextMenu('upcoming')}
            delayLongPress={350}
            activeOpacity={0.9}
          >
            <Upcoming />
          </TouchableOpacity>
        );

      case 'bentoGrid':
        return (
          <BentoGrid
            key="bentoGrid"
            tasks={pendingTasks}
            onToggleTask={onToggleTask}
            onPressNewTask={onOpenComposer}
            onOpenTaskDetail={(id) => setSelectedDetailTaskId(id)}
            onOpenQuickTasks={() => setShowQuickTasks(true)}
            onLongPressTile={(tKey) => handleOpenContextMenu(tKey as any)}
            note={notes[0] || null}
            onOpenNote={handleOpenNote}
            onCreateNote={handleCreateNote}
            sketch={sketches[0] || null}
            onOpenSketch={handleOpenSketch}
            onCreateSketch={handleCreateSketch}
            density={density}
          />
        );

      default:
        return null;
    }
  };

  // Group visible widgets into rows (pairs of half-width or single full-width)
  const renderedElements = useMemo(() => {
    const visibleKeys = order.filter((k) => vis[k]);
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < visibleKeys.length) {
      const keyA = visibleKeys[i];
      const isA_Full =
        sizes[keyA] === 'full' || ['statusBar', 'heroCard', 'recentSketches', 'upcoming', 'bentoGrid'].includes(keyA);

      if (isA_Full) {
        elements.push(
          <View key={`row_${keyA}_${i}`} style={styles.fullRow}>
            {renderWidget(keyA, 'full')}
          </View>
        );
        i++;
      } else {
        // Half-width widget: check if next is also half-width
        const keyB = visibleKeys[i + 1];
        const isB_Half =
          keyB &&
          sizes[keyB] !== 'full' &&
          !['statusBar', 'heroCard', 'recentSketches', 'upcoming', 'bentoGrid'].includes(keyB);

        if (keyB && isB_Half) {
          elements.push(
            <View key={`row_${keyA}_${keyB}_${i}`} style={styles.gridRow}>
              {renderWidget(keyA, 'half')}
              {renderWidget(keyB, 'half')}
            </View>
          );
          i += 2;
        } else {
          // Odd half widget
          elements.push(
            <View key={`row_${keyA}_${i}`} style={styles.gridRow}>
              {renderWidget(keyA, 'half')}
              <View style={{ flex: 1 }} />
            </View>
          );
          i++;
        }
      }
    }

    return elements;
  }, [order, vis, sizes, pendingTasks, allTasks, notes, sketches, density, greeting, heroTask]);

  const activeWidgetMeta = contextMenuWidget ? WIDGET_TITLES[contextMenuWidget] : null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={{ flex: 1 }}
      >
        {renderedElements}
      </ScrollView>

      {/* Task Detail Modal */}
      <TaskDetailModal
        visible={!!selectedDetailTaskId}
        taskId={selectedDetailTaskId}
        onClose={() => setSelectedDetailTaskId(null)}
      />

      {/* Quick Tasks Modal */}
      <QuickTasksModal
        visible={showQuickTasks}
        onClose={() => setShowQuickTasks(false)}
        tasks={allTasks}
        onToggleTask={onToggleTask}
        onOpenTaskDetail={(id) => {
          setShowQuickTasks(false);
          setSelectedDetailTaskId(id);
        }}
        onAddTask={handleQuickAddTask}
      />

      {/* Widget Long-Press Context Menu Modal */}
      {contextMenuWidget && activeWidgetMeta && (
        <WidgetContextMenuModal
          visible={!!contextMenuWidget}
          onClose={() => setContextMenuWidget(null)}
          widgetTitle={activeWidgetMeta.title}
          widgetIcon={activeWidgetMeta.icon}
          currentSize={sizes[contextMenuWidget] || (['statusBar', 'heroCard', 'recentSketches', 'upcoming'].includes(contextMenuWidget) ? 'full' : 'half')}
          canMoveUp={order.indexOf(contextMenuWidget) > 0}
          canMoveDown={order.indexOf(contextMenuWidget) < order.length - 1}
          onToggleSize={handleToggleWidgetSize}
          onMoveUp={() => handleMoveWidget(-1)}
          onMoveDown={() => handleMoveWidget(1)}
          onOpenAddLibrary={() => setShowLibraryModal(true)}
          onRemoveWidget={handleRemoveWidget}
        />
      )}

      {/* Widget Library Modal */}
      <WidgetLibraryModal
        visible={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        activeWidgetIds={order.filter((k) => vis[k])}
        onAddWidget={handleAddWidgetFromLibrary}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 90,
  },
  fullRow: {
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  statusBarCompact: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  greetingText: {
    fontSize: 22,
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  metricText: {
    fontSize: 11.5,
  },
  heroCardOuter: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  heroCardCompact: {
    marginBottom: 8,
    padding: 10,
  },
  heroCardExpanded: {
    marginBottom: 18,
    padding: 18,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  heroHeaderTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  heroCardInner: {
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroContent: {
    flex: 1,
  },
  heroTag: {
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  heroTaskTitle: {
    fontSize: 16,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  heroDueText: {
    fontSize: 11,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  heroActionText: {
    fontSize: 12.5,
  },
  tile: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tileTitle: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  tileBody: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  emptyText: {
    fontSize: 11,
    textAlign: 'center',
  },
  taskItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 3.5,
  },
  miniCheckboxTouch: {
    padding: 2,
  },
  miniCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskItemTextTouch: {
    flex: 1,
    paddingVertical: 1,
  },
  taskItemText: {
    fontSize: 12,
  },
  noteTitle: {
    fontSize: 12.5,
    marginBottom: 3,
  },
  noteSnippet: {
    fontSize: 11,
    lineHeight: 15,
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  footerText: {
    fontSize: 10,
  },
  sketchBody: {
    flex: 1,
    alignItems: 'flex-start',
  },
  sketchThumbWrap: {
    width: '100%',
    height: 52,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    marginBottom: 6,
  },
  sketchImage: {
    width: '100%',
    height: '100%',
  },
  sketchPlaceholder: {
    width: '100%',
    height: 52,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  sketchTitleText: {
    fontSize: 12,
    marginBottom: 2,
  },
  captureActionsColumn: {
    flex: 1,
    justifyContent: 'space-around',
    gap: 5,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  captureBtnText: {
    fontSize: 11.5,
  },
});
