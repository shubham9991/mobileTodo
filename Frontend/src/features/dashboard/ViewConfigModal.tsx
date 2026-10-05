import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ScrollView, 
  Switch,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../themes/ThemeContext';
import { useDashboard, DashboardView } from '../../core/DashboardContext';
import { useManage } from '../../core/ManageContext';
import {
  DashboardViewMode,
  DisplayDensity,
  ViewWidgetVisibility,
  ViewWidgetOrder,
  BentoWidgetKey,
  FocusWidgetKey,
  StudioWidgetKey,
  MinimalWidgetKey,
  DEFAULT_PREFERENCES,
  saveDashboardPreferences,
} from './dashboardPrefsStore';

interface ViewConfigModalProps {
  visible: boolean;
  onClose: () => void;
  view: DashboardView;
}

const BENTO_WIDGET_META: Record<BentoWidgetKey, { label: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  statusBar: { label: 'Daily Status Summary & Greeting', icon: 'wb-sunny' },
  heroCard: { label: 'Hero Focus Card', icon: 'bolt' },
  bentoGrid: { label: 'Bento 2x2 Matrix Grid', icon: 'grid-view' },
  recentSketches: { label: 'Recent Canvas Sketches Widget', icon: 'brush' },
  upcoming: { label: 'Upcoming Deadlines Strip', icon: 'calendar-month' },
};

const FOCUS_WIDGET_META: Record<FocusWidgetKey, { label: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  weekCalendar: { label: 'Week Strip Calendar with Progress', icon: 'calendar-view-week' },
  progressBar: { label: 'Day Completion Progress Bar', icon: 'linear-scale' },
  quickComposer: { label: 'Inline Quick Task Composer', icon: 'add-task' },
  agenda: { label: 'Execution Agenda (Priority / Time Block)', icon: 'format-list-bulleted' },
};

const STUDIO_WIDGET_META: Record<StudioWidgetKey, { label: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  ideationBar: { label: 'Quick Ideation Bar (Note/Sketch)', icon: 'lightbulb-outline' },
  filterPills: { label: 'Creative Filter & Category Pills', icon: 'filter-list' },
  creativeFeed: { label: 'Unified 2-Column Creative Feed', icon: 'auto-awesome-mosaic' },
  taskRadar: { label: 'Background Task Radar Pill', icon: 'radar' },
};

const MINIMAL_WIDGET_META: Record<MinimalWidgetKey, { label: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  calmHeader: { label: 'Calm Greeting & Date Header', icon: 'spa' },
  recentsCarousel: { label: 'Pick Up Where You Left Off Carousel', icon: 'history' },
  ruleOfThree: { label: 'Rule of Three Essentials', icon: 'looks-3' },
  microDock: { label: 'Universal Micro Quick Dock', icon: 'more-horiz' },
};

export const ViewConfigModal = ({ visible, onClose, view }: ViewConfigModalProps) => {
  const { theme } = useTheme();
  const {
    views,
    updateView,
    nodes,
    setActiveViewIndex,
    activeViewMode,
    setActiveViewMode,
    dashboardPrefs,
    setDashboardPrefs,
    updateDensity,
    updateDefaultMode,
    updateSwipePagerSetting,
    updateWidgetOrder,
  } = useDashboard();
  const { tags } = useManage();
  
  // Dashboard multi-view preferences local state
  const [localViewMode, setLocalViewMode] = useState<DashboardViewMode>(activeViewMode);
  const [localDefaultMode, setLocalDefaultMode] = useState<DashboardViewMode>(dashboardPrefs.defaultViewMode);
  const [localDensity, setLocalDensity] = useState<DisplayDensity>(dashboardPrefs.density);
  const [localSwipePager, setLocalSwipePager] = useState<boolean>(dashboardPrefs.enableSwipePager);
  const [localWidgetVis, setLocalWidgetVis] = useState<ViewWidgetVisibility>(dashboardPrefs.widgetVisibility);
  const [localWidgetOrder, setLocalWidgetOrder] = useState<ViewWidgetOrder>(dashboardPrefs.widgetOrder);

  // Track which page we are currently editing
  const [selectedViewId, setSelectedViewId] = useState<string>(view.id);
  const [applyToAll, setApplyToAll] = useState<boolean>(false);

  // Active view details
  const currentEditingView = views.find(v => v.id === selectedViewId) || view;

  // Local state copy of active page configuration
  const [layout, setLayout] = useState<DashboardView['layout']>(currentEditingView.layout);
  const [showCompleted, setShowCompleted] = useState<boolean>(currentEditingView.showCompleted);
  const [grouping, setGrouping] = useState<DashboardView['grouping']>(currentEditingView.grouping);
  const [sorting, setSorting] = useState<DashboardView['sorting']>(currentEditingView.sorting);
  const [filterDate, setFilterDate] = useState<DashboardView['filterDate']>(currentEditingView.filterDate);
  const [filterPriorities, setFilterPriorities] = useState<DashboardView['filterPriorities']>(currentEditingView.filterPriorities);
  const [filterTags, setFilterTags] = useState<string[]>(currentEditingView.filterTags);
  const [filterSourceNodeId, setFilterSourceNodeId] = useState<string | null>(currentEditingView.filterSourceNodeId);
  const [widgets, setWidgets] = useState<DashboardView['widgets']>(currentEditingView.widgets);

  // Sync state when modal becomes visible or when editing target changes
  useEffect(() => {
    if (visible) {
      setLocalViewMode(activeViewMode);
      setLocalDefaultMode(dashboardPrefs.defaultViewMode);
      setLocalDensity(dashboardPrefs.density);
      setLocalSwipePager(dashboardPrefs.enableSwipePager);
      setLocalWidgetVis(dashboardPrefs.widgetVisibility);
      setLocalWidgetOrder(dashboardPrefs.widgetOrder);

      setLayout(currentEditingView.layout);
      setShowCompleted(currentEditingView.showCompleted);
      setGrouping(currentEditingView.grouping);
      setSorting(currentEditingView.sorting);
      setFilterDate(currentEditingView.filterDate);
      setFilterPriorities(currentEditingView.filterPriorities);
      setFilterTags(currentEditingView.filterTags);
      setFilterSourceNodeId(currentEditingView.filterSourceNodeId);
      setWidgets(currentEditingView.widgets);
    }
  }, [visible, selectedViewId, activeViewMode, dashboardPrefs]);

  // Sync target selection with current active page on open
  useEffect(() => {
    if (visible) {
      setSelectedViewId(view.id);
      setApplyToAll(false);
    }
  }, [visible, view.id]);

  const togglePriority = (priority: 'HIGH' | 'MED' | 'LOW') => {
    if (filterPriorities.includes(priority)) {
      setFilterPriorities(prev => prev.filter(p => p !== priority));
    } else {
      setFilterPriorities(prev => [...prev, priority]);
    }
  };

  const toggleTag = (tagId: string) => {
    if (filterTags.includes(tagId)) {
      setFilterTags(prev => prev.filter(t => t !== tagId));
    } else {
      setFilterTags(prev => [...prev, tagId]);
    }
  };

  const toggleWidget = (widgetId: string) => {
    setWidgets(prev => prev.map(w => w.id === widgetId ? { ...w, visible: !w.visible } : w));
  };

  const moveWidget = (index: number, dir: 1 | -1) => {
    const arr = [...widgets];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    setWidgets(arr);
  };

  const moveModeWidget = <V extends DashboardViewMode>(mode: V, index: number, dir: 1 | -1) => {
    const list = [...localWidgetOrder[mode]] as any[];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    setLocalWidgetOrder(prev => ({ ...prev, [mode]: list }));
  };

  const handleSave = () => {
    // 1. Save Dashboard multi-view preferences
    setActiveViewMode(localViewMode);
    updateDefaultMode(localDefaultMode);
    updateDensity(localDensity);
    updateSwipePagerSetting(localSwipePager);
    updateWidgetOrder(localViewMode, localWidgetOrder[localViewMode]);
    setDashboardPrefs(prev => {
      const updated = {
        ...prev,
        activeViewMode: localViewMode,
        defaultViewMode: localDefaultMode,
        density: localDensity,
        enableSwipePager: localSwipePager,
        widgetVisibility: localWidgetVis,
        widgetOrder: localWidgetOrder,
      };
      saveDashboardPreferences(updated);
      return updated;
    });

    if (applyToAll) {
      // Copy settings configuration to ALL pages
      views.forEach(v => {
        updateView(v.id, {
          layout,
          showCompleted,
          grouping,
          sorting,
          filterDate,
          filterPriorities,
          filterTags,
          filterSourceNodeId,
          widgets,
        });
      });
    } else {
      // Update only current configured view
      updateView(selectedViewId, {
        layout,
        showCompleted,
        grouping,
        sorting,
        filterDate,
        filterPriorities,
        filterTags,
        filterSourceNodeId,
        widgets,
      });
    }

    // Scroll active view to match the configured page selection
    const targetIndex = views.findIndex(v => v.id === selectedViewId);
    if (targetIndex !== -1) {
      setActiveViewIndex(targetIndex);
    }

    onClose();
  };

  const handleReset = () => {
    // Reset dashboard preferences
    setLocalViewMode(DEFAULT_PREFERENCES.activeViewMode);
    setLocalDefaultMode(DEFAULT_PREFERENCES.defaultViewMode);
    setLocalDensity(DEFAULT_PREFERENCES.density);
    setLocalSwipePager(DEFAULT_PREFERENCES.enableSwipePager);
    setLocalWidgetVis(DEFAULT_PREFERENCES.widgetVisibility);
    setLocalWidgetOrder(DEFAULT_PREFERENCES.widgetOrder);
    setDashboardPrefs(DEFAULT_PREFERENCES);
    saveDashboardPreferences(DEFAULT_PREFERENCES);

    setLayout('list');
    setShowCompleted(true);
    setGrouping('none');
    setSorting('dueDate');
    setFilterDate('all');
    setFilterPriorities(['HIGH', 'MED', 'LOW']);
    setFilterTags([]);
    setFilterSourceNodeId(null);
    setWidgets([
      { id: 'tasks', visible: true },
      { id: 'hero', visible: true },
      { id: 'tabs', visible: true },
      { id: 'notes', visible: true },
      { id: 'upcoming', visible: true },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        
        <SafeAreaView style={[styles.bottomSheet, { backgroundColor: theme.colors.cardPrimary }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.headerTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
              Display settings ({currentEditingView.name})
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialIcons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* ── Dashboard Multi-View Mode (The 4 Pillars) ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              DASHBOARD WORKSPACE VIEW
            </Text>
            <View style={styles.viewModeGrid}>
              {([
                { id: 'bento', label: 'Bento Hub', desc: 'All-in-one command matrix', icon: 'view-quilt' },
                { id: 'focus', label: 'Focus Stream', desc: 'Tasks & agenda timeline', icon: 'bolt' },
                { id: 'studio', label: 'Creative Studio', desc: 'Notes & canvas workspace', icon: 'palette' },
                { id: 'minimal', label: 'Minimalist', desc: 'Calm essentials & recents', icon: 'crop-free' },
              ] as const).map(mode => {
                const isSelected = localViewMode === mode.id;
                return (
                  <TouchableOpacity
                    key={mode.id}
                    style={[
                      styles.modeCard,
                      {
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: isSelected ? theme.colors.secondary : 'transparent',
                      },
                    ]}
                    onPress={() => setLocalViewMode(mode.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modeCardTop}>
                      <MaterialIcons
                        name={mode.icon as any}
                        size={22}
                        color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                      />
                      <View style={[styles.radioCircle, { position: 'relative', top: 0, right: 0, borderColor: isSelected ? theme.colors.primary : theme.colors.border }]}>
                        {isSelected && <View style={[styles.radioDot, { backgroundColor: theme.colors.primary }]} />}
                      </View>
                    </View>
                    <Text style={[styles.modeCardTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                      {mode.label}
                    </Text>
                    <Text style={[styles.modeCardDesc, { color: theme.colors.textSecondary }]}>
                      {mode.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Default Launch View ── */}
            <View style={styles.optionRow}>
              <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Default Launch View</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {([
                  { id: 'bento', label: 'Bento Hub' },
                  { id: 'focus', label: 'Focus Stream' },
                  { id: 'studio', label: 'Creative Studio' },
                  { id: 'minimal', label: 'Minimalist' },
                ] as const).map(dm => {
                  const isSelected = localDefaultMode === dm.id;
                  return (
                    <TouchableOpacity
                      key={dm.id}
                      style={[
                        styles.chip,
                        { backgroundColor: isSelected ? theme.colors.primary : theme.colors.accentBg }
                      ]}
                      onPress={() => setLocalDefaultMode(dm.id)}
                    >
                      <Text style={{ color: isSelected ? '#fff' : theme.colors.textSecondary, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                        {dm.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Display Density ── */}
            <View style={[styles.optionRow, { marginTop: 12 }]}>
              <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Display Density</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([
                  { id: 'compact', label: 'Compact' },
                  { id: 'comfortable', label: 'Comfortable' },
                  { id: 'expanded', label: 'Expanded' },
                ] as const).map(den => {
                  const isSelected = localDensity === den.id;
                  return (
                    <TouchableOpacity
                      key={den.id}
                      style={[
                        styles.chip,
                        { flex: 1, alignItems: 'center', backgroundColor: isSelected ? theme.colors.primary : theme.colors.accentBg }
                      ]}
                      onPress={() => setLocalDensity(den.id)}
                    >
                      <Text style={{ color: isSelected ? '#fff' : theme.colors.textSecondary, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                        {den.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Swipe Pager Toggle ── */}
            <View style={[styles.switchRow, { borderBottomColor: theme.colors.border, marginTop: 4 }]}>
              <View>
                <Text style={[styles.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                  Swipe Paging
                </Text>
                <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]}>
                  Swipe horizontally between dashboard views
                </Text>
              </View>
              <Switch
                value={localSwipePager}
                onValueChange={setLocalSwipePager}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
              />
            </View>

            {/* ── Active View Widgets Visibility ── */}
            {/* ── Active View Widgets Visibility & Ordering ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              WIDGET REORDER & VISIBILITY ({localViewMode.toUpperCase()} VIEW)
            </Text>

            {localViewMode === 'bento' && (
              <View style={styles.widgetsContainer}>
                {localWidgetOrder.bento.map((key, index) => {
                  const meta = BENTO_WIDGET_META[key] || { label: key, icon: 'widgets' };
                  return (
                    <View key={key} style={[styles.widgetRow, { borderBottomColor: theme.colors.border }]}>
                      <View style={styles.widgetInfo}>
                        <MaterialIcons name={meta.icon} size={20} color={theme.colors.text} />
                        <Text style={[styles.widgetName, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                          {meta.label}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={{ opacity: index === 0 ? 0.3 : 1, padding: 4 }}
                          onPress={() => moveModeWidget('bento', index, -1)}
                          disabled={index === 0}
                        >
                          <MaterialIcons name="keyboard-arrow-up" size={22} color={theme.colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ opacity: index === localWidgetOrder.bento.length - 1 ? 0.3 : 1, padding: 4 }}
                          onPress={() => moveModeWidget('bento', index, 1)}
                          disabled={index === localWidgetOrder.bento.length - 1}
                        >
                          <MaterialIcons name="keyboard-arrow-down" size={22} color={theme.colors.text} />
                        </TouchableOpacity>
                        <Switch
                          value={localWidgetVis.bento[key]}
                          onValueChange={(val) => setLocalWidgetVis(p => ({ ...p, bento: { ...p.bento, [key]: val } }))}
                          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {localViewMode === 'focus' && (
              <View style={styles.widgetsContainer}>
                {localWidgetOrder.focus.map((key, index) => {
                  const meta = FOCUS_WIDGET_META[key] || { label: key, icon: 'widgets' };
                  return (
                    <View key={key} style={[styles.widgetRow, { borderBottomColor: theme.colors.border }]}>
                      <View style={styles.widgetInfo}>
                        <MaterialIcons name={meta.icon} size={20} color={theme.colors.text} />
                        <Text style={[styles.widgetName, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                          {meta.label}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={{ opacity: index === 0 ? 0.3 : 1, padding: 4 }}
                          onPress={() => moveModeWidget('focus', index, -1)}
                          disabled={index === 0}
                        >
                          <MaterialIcons name="keyboard-arrow-up" size={22} color={theme.colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ opacity: index === localWidgetOrder.focus.length - 1 ? 0.3 : 1, padding: 4 }}
                          onPress={() => moveModeWidget('focus', index, 1)}
                          disabled={index === localWidgetOrder.focus.length - 1}
                        >
                          <MaterialIcons name="keyboard-arrow-down" size={22} color={theme.colors.text} />
                        </TouchableOpacity>
                        <Switch
                          value={localWidgetVis.focus[key]}
                          onValueChange={(val) => setLocalWidgetVis(p => ({ ...p, focus: { ...p.focus, [key]: val } }))}
                          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {localViewMode === 'studio' && (
              <View style={styles.widgetsContainer}>
                {localWidgetOrder.studio.map((key, index) => {
                  const meta = STUDIO_WIDGET_META[key] || { label: key, icon: 'widgets' };
                  return (
                    <View key={key} style={[styles.widgetRow, { borderBottomColor: theme.colors.border }]}>
                      <View style={styles.widgetInfo}>
                        <MaterialIcons name={meta.icon} size={20} color={theme.colors.text} />
                        <Text style={[styles.widgetName, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                          {meta.label}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={{ opacity: index === 0 ? 0.3 : 1, padding: 4 }}
                          onPress={() => moveModeWidget('studio', index, -1)}
                          disabled={index === 0}
                        >
                          <MaterialIcons name="keyboard-arrow-up" size={22} color={theme.colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ opacity: index === localWidgetOrder.studio.length - 1 ? 0.3 : 1, padding: 4 }}
                          onPress={() => moveModeWidget('studio', index, 1)}
                          disabled={index === localWidgetOrder.studio.length - 1}
                        >
                          <MaterialIcons name="keyboard-arrow-down" size={22} color={theme.colors.text} />
                        </TouchableOpacity>
                        <Switch
                          value={localWidgetVis.studio[key]}
                          onValueChange={(val) => setLocalWidgetVis(p => ({ ...p, studio: { ...p.studio, [key]: val } }))}
                          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {localViewMode === 'minimal' && (
              <View style={styles.widgetsContainer}>
                {localWidgetOrder.minimal.map((key, index) => {
                  const meta = MINIMAL_WIDGET_META[key] || { label: key, icon: 'widgets' };
                  return (
                    <View key={key} style={[styles.widgetRow, { borderBottomColor: theme.colors.border }]}>
                      <View style={styles.widgetInfo}>
                        <MaterialIcons name={meta.icon} size={20} color={theme.colors.text} />
                        <Text style={[styles.widgetName, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                          {meta.label}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={{ opacity: index === 0 ? 0.3 : 1, padding: 4 }}
                          onPress={() => moveModeWidget('minimal', index, -1)}
                          disabled={index === 0}
                        >
                          <MaterialIcons name="keyboard-arrow-up" size={22} color={theme.colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ opacity: index === localWidgetOrder.minimal.length - 1 ? 0.3 : 1, padding: 4 }}
                          onPress={() => moveModeWidget('minimal', index, 1)}
                          disabled={index === localWidgetOrder.minimal.length - 1}
                        >
                          <MaterialIcons name="keyboard-arrow-down" size={22} color={theme.colors.text} />
                        </TouchableOpacity>
                        <Switch
                          value={localWidgetVis.minimal[key]}
                          onValueChange={(val) => setLocalWidgetVis(p => ({ ...p, minimal: { ...p.minimal, [key]: val } }))}
                          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ height: 16 }} />

            {/* ── Page Selection ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              SELECT PAGE TO CONFIGURE
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {views.map((v) => {
                const isSelected = selectedViewId === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.chip,
                      { 
                        backgroundColor: isSelected ? theme.colors.primary : theme.colors.accentBg 
                      }
                    ]}
                    onPress={() => setSelectedViewId(v.id)}
                  >
                    <Text style={{ 
                      color: isSelected ? '#fff' : theme.colors.textSecondary,
                      fontSize: 12,
                      fontFamily: 'Inter_600SemiBold'
                    }}>
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Layout Selector ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              LAYOUT
            </Text>
            <View style={styles.layoutRow}>
              {([
                { id: 'list', label: 'List', icon: 'view-list' },
                { id: 'calendar', label: 'Calendar', icon: 'calendar-month' },
                { id: 'paged', label: 'Paged', icon: 'pages' },
              ] as const).map(item => {
                const isSelected = layout === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.layoutCard,
                      { 
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: isSelected ? theme.colors.secondary : 'transparent' 
                      }
                    ]}
                    onPress={() => setLayout(item.id)}
                  >
                    <MaterialIcons 
                      name={item.icon} 
                      size={24} 
                      color={isSelected ? theme.colors.primary : theme.colors.textSecondary} 
                    />
                    <Text style={[
                      styles.layoutLabel, 
                      { 
                        color: isSelected ? theme.colors.text : theme.colors.textSecondary,
                        fontFamily: 'Inter_500Medium'
                      }
                    ]}>
                      {item.label}
                    </Text>
                    <View style={[
                      styles.radioCircle, 
                      { borderColor: isSelected ? theme.colors.primary : theme.colors.border }
                    ]}>
                      {isSelected && <View style={[styles.radioDot, { backgroundColor: theme.colors.primary }]} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Show Completed Toggles ── */}
            <View style={[styles.switchRow, { borderBottomColor: theme.colors.border }]}>
              <View>
                <Text style={[styles.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                  Completed tasks
                </Text>
                <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]}>
                  Show completed tasks in list
                </Text>
              </View>
              <Switch
                value={showCompleted}
                onValueChange={setShowCompleted}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
              />
            </View>

            {/* ── Grouping & Sorting ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              SORT & GROUP
            </Text>
            
            <View style={styles.optionSelectGroup}>
              {/* Grouping option */}
              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Grouping</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {([
                    { id: 'none', label: 'None' },
                    { id: 'priority', label: 'Priority' },
                    { id: 'tag', label: 'Tag' },
                    { id: 'dueDate', label: 'Due Date' },
                    { id: 'project', label: 'Project' },
                  ] as const).map(opt => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.chip,
                        { 
                          backgroundColor: grouping === opt.id ? theme.colors.primary : theme.colors.accentBg 
                        }
                      ]}
                      onPress={() => setGrouping(opt.id)}
                    >
                      <Text style={{ 
                        color: grouping === opt.id ? '#fff' : theme.colors.textSecondary,
                        fontSize: 12,
                        fontFamily: 'Inter_500Medium'
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Sorting option */}
              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Sorting</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {([
                    { id: 'dueDate', label: 'Due Date' },
                    { id: 'priority', label: 'Priority' },
                    { id: 'created', label: 'Created Date' },
                    { id: 'alphabetical', label: 'Alphabetical' },
                  ] as const).map(opt => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.chip,
                        { 
                          backgroundColor: sorting === opt.id ? theme.colors.primary : theme.colors.accentBg 
                        }
                      ]}
                      onPress={() => setSorting(opt.id)}
                    >
                      <Text style={{ 
                        color: sorting === opt.id ? '#fff' : theme.colors.textSecondary,
                        fontSize: 12,
                        fontFamily: 'Inter_500Medium'
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* ── Filters ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              FILTERS
            </Text>

            <View style={styles.optionSelectGroup}>
              {/* Date Filter */}
              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Date Range</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {([
                    { id: 'all', label: 'All Time' },
                    { id: 'today', label: 'Today' },
                    { id: 'tomorrow', label: 'Tomorrow' },
                    { id: 'week', label: 'This Week' },
                  ] as const).map(opt => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.chip,
                        { 
                          backgroundColor: filterDate === opt.id ? theme.colors.primary : theme.colors.accentBg 
                        }
                      ]}
                      onPress={() => setFilterDate(opt.id)}
                    >
                      <Text style={{ 
                        color: filterDate === opt.id ? '#fff' : theme.colors.textSecondary,
                        fontSize: 12,
                        fontFamily: 'Inter_500Medium'
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Priorities filter */}
              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Priorities</Text>
                <View style={styles.chipContainer}>
                  {(['HIGH', 'MED', 'LOW'] as const).map(pri => {
                    const active = filterPriorities.includes(pri);
                    return (
                      <TouchableOpacity
                        key={pri}
                        style={[
                          styles.chip,
                          { backgroundColor: active ? theme.colors.primary : theme.colors.accentBg }
                        ]}
                        onPress={() => togglePriority(pri)}
                      >
                        <Text style={{ 
                          color: active ? '#fff' : theme.colors.textSecondary,
                          fontSize: 12,
                          fontFamily: 'Inter_500Medium'
                        }}>
                          {pri}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Tags/Labels filter */}
              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Tags</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {tags.map(t => {
                    const active = filterTags.includes(t.id);
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.chip,
                          { 
                            backgroundColor: active ? theme.colors.primary : theme.colors.accentBg,
                          }
                        ]}
                        onPress={() => toggleTag(t.id)}
                      >
                        <Text style={{ 
                          color: active ? '#fff' : theme.colors.textSecondary,
                          fontSize: 12,
                          fontFamily: 'Inter_500Medium'
                        }}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Source scope project node filter */}
              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Source Space</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      { backgroundColor: filterSourceNodeId === null ? theme.colors.primary : theme.colors.accentBg }
                    ]}
                    onPress={() => setFilterSourceNodeId(null)}
                  >
                    <Text style={{ color: filterSourceNodeId === null ? '#fff' : theme.colors.textSecondary, fontSize: 12 }}>
                      All Folders
                    </Text>
                  </TouchableOpacity>
                  {Object.values(nodes).map(node => {
                    const active = filterSourceNodeId === node.id;
                    return (
                      <TouchableOpacity
                        key={node.id}
                        style={[
                          styles.chip,
                          { backgroundColor: active ? theme.colors.primary : theme.colors.accentBg }
                        ]}
                        onPress={() => setFilterSourceNodeId(node.id)}
                      >
                        <Text style={{ 
                          color: active ? '#fff' : theme.colors.textSecondary,
                          fontSize: 12,
                          fontFamily: 'Inter_500Medium'
                        }}>
                          {node.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* ── Widgets Management ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              ACTIVE WIDGETS
            </Text>

            <View style={styles.widgetsContainer}>
              {widgets.map((w, index) => (
                <View key={w.id} style={[styles.widgetRow, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.widgetInfo}>
                    <MaterialIcons 
                      name={w.id === 'hero' ? 'bolt' : w.id === 'tabs' ? 'tab' : w.id === 'tasks' ? 'check-circle-outline' : w.id === 'notes' ? 'description' : 'calendar-month'} 
                      size={20} 
                      color={theme.colors.text} 
                    />
                    <Text style={[styles.widgetName, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                      {w.id === 'hero' ? 'Hero Next Focus' : w.id === 'tabs' ? 'Category Tabs' : w.id === 'tasks' ? 'Tasks List' : w.id === 'notes' ? 'Recent Notes' : 'Upcoming Timeline'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={{ opacity: index === 0 ? 0.3 : 1, padding: 4 }}
                      onPress={() => moveWidget(index, -1)}
                      disabled={index === 0}
                    >
                      <MaterialIcons name="keyboard-arrow-up" size={22} color={theme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ opacity: index === widgets.length - 1 ? 0.3 : 1, padding: 4 }}
                      onPress={() => moveWidget(index, 1)}
                      disabled={index === widgets.length - 1}
                    >
                      <MaterialIcons name="keyboard-arrow-down" size={22} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Switch
                      value={w.visible}
                      onValueChange={() => toggleWidget(w.id)}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    />
                  </View>
                </View>
              ))}
            </View>
            
            <View style={{ height: 20 }} />

            {/* ── Scope of Settings ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              APPLY SETTINGS TO
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  { 
                    backgroundColor: !applyToAll ? theme.colors.primary : theme.colors.accentBg,
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 12
                  }
                ]}
                onPress={() => setApplyToAll(false)}
              >
                <Text style={{ 
                  color: !applyToAll ? '#fff' : theme.colors.textSecondary,
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 12
                }}>
                  {`Just "${currentEditingView.name}"`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.chip,
                  { 
                    backgroundColor: applyToAll ? theme.colors.primary : theme.colors.accentBg,
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 12
                  }
                ]}
                onPress={() => setApplyToAll(true)}
              >
                <Text style={{ 
                  color: applyToAll ? '#fff' : theme.colors.textSecondary,
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 12
                }}>
                  All {views.length} Pages
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={[styles.resetText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                Reset all
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]} onPress={handleSave}>
              <Text style={styles.saveText}>
                Save settings
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 16,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 16,
  },
  viewModeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  modeCard: {
    width: '48%',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  modeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modeCardTitle: {
    fontSize: 13,
    marginBottom: 2,
  },
  modeCardDesc: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  layoutRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  layoutCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    alignItems: 'flex-start',
    gap: 8,
    position: 'relative',
  },
  layoutLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 12,
    right: 12,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 14,
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  optionSelectGroup: {
    gap: 16,
    marginBottom: 16,
  },
  optionRow: {
    gap: 8,
  },
  optionLabel: {
    fontSize: 13,
  },
  chipScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 4,
  },
  widgetsContainer: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  widgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  widgetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  widgetName: {
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resetBtn: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  resetText: {
    fontSize: 14,
  },
  saveBtn: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
