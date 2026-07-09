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

interface ViewConfigModalProps {
  visible: boolean;
  onClose: () => void;
  view: DashboardView;
}

export const ViewConfigModal = ({ visible, onClose, view }: ViewConfigModalProps) => {
  const { theme } = useTheme();
  const { views, updateView, nodes, setActiveViewIndex } = useDashboard();
  const { tags } = useManage();
  
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
  }, [visible, selectedViewId]);

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

  const handleSave = () => {
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
                  Just "{currentEditingView.name}"
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
