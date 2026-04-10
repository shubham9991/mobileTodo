import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Modal, StyleSheet, TouchableOpacity, Pressable, View, Text,
  ScrollView, Platform, KeyboardAvoidingView, Image, TextInput,
  Alert, Animated, Dimensions, LayoutAnimation, PanResponder, Keyboard,
} from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../themes/ThemeContext';
import { Task, Subtask } from '../../core/dummyData';
import { useDashboard } from '../../core/DashboardContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface VersionEntry {
  id: string; action: string; from?: string; to?: string; date: string; icon: string;
}
interface TaskDetailModalProps {
  visible: boolean; taskId: string | null; onClose: () => void;
}

const { width: SW, height: SH } = Dimensions.get('window');

// Dynamic bottom sheet positions computed on layout.

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITY_META: Record<string, { color: string; bg: string; label: string }> = {
  HIGH: { color: '#EF4444', bg: '#FEF2F2', label: 'High' },
  MED: { color: '#F97316', bg: '#FFF7ED', label: 'Medium' },
  LOW: { color: '#22C55E', bg: '#F0FDF4', label: 'Low' },
};
const TAG_META: Record<string, { text: string; bg: string }> = {
  work: { text: '#6366F1', bg: '#EEF2FF' },
  personal: { text: '#64748B', bg: '#F1F5F9' },
  review: { text: '#F97316', bg: '#FFF7ED' },
  health: { text: '#22C55E', bg: '#F0FDF4' },
  learning: { text: '#EC4899', bg: '#FDF2F8' },
};

const TABS = ['subtasks', 'comments', 'history'] as const;
type Tab = typeof TABS[number];

// ─── Version Timeline ─────────────────────────────────────────────────────────
const VersionItem = ({ entry, isLast, theme }: { entry: VersionEntry; isLast: boolean; theme: any }) => (
  <View style={vm.row}>
    <View style={vm.col}>
      <View style={[vm.dot, { backgroundColor: theme.colors.primary }]}>
        <MaterialIcons name={entry.icon as any} size={10} color="#fff" />
      </View>
      {!isLast && <View style={[vm.line, { backgroundColor: theme.colors.border }]} />}
    </View>
    <View style={vm.content}>
      <Text style={[vm.action, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>{entry.action}</Text>
      {entry.from && entry.to && (
        <View style={vm.diffRow}>
          <View style={[vm.pill, { backgroundColor: '#FEF2F2' }]}>
            <Text style={[vm.diffTxt, { color: '#EF4444' }]}>− {entry.from}</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={12} color="#94A3B8" />
          <View style={[vm.pill, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[vm.diffTxt, { color: '#22C55E' }]}>+ {entry.to}</Text>
          </View>
        </View>
      )}
      <Text style={[vm.date, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>{entry.date}</Text>
    </View>
  </View>
);
const vm = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  col: { alignItems: 'center', width: 24 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, marginTop: 4, marginBottom: 4, borderRadius: 1 },
  content: { flex: 1, paddingBottom: 20 },
  action: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffTxt: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  date: { fontSize: 11 },
});

// ─── Android Action Sheet ──────────────────────────────────────────────────────
type SheetItem = { label: string; icon: string; destructive?: boolean; onPress: () => void };
const AndroidSheet = ({ visible, title, items, onClose, theme }: {
  visible: boolean; title?: string; items: SheetItem[]; onClose: () => void; theme: any;
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={as.overlay} onPress={onClose}>
      <View style={[as.sheet, { backgroundColor: theme.colors.cardPrimary }]}>
        {title && <Text style={[as.title, { color: theme.colors.textSecondary }]}>{title}</Text>}
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[as.row, i < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}
            onPress={() => { onClose(); setTimeout(item.onPress, 120); }}
          >
            <MaterialIcons name={item.icon as any} size={20} color={item.destructive ? '#EF4444' : theme.colors.text} />
            <Text style={[as.label, { color: item.destructive ? '#EF4444' : theme.colors.text, fontFamily: 'Inter_500Medium' }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[as.cancel, { backgroundColor: theme.colors.secondary }]} onPress={onClose}>
          <Text style={[as.cancelText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  </Modal>
);
const as = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: 40, paddingHorizontal: 16 },
  title: { fontSize: 11, letterSpacing: 0.8, textAlign: 'center', paddingVertical: 16, fontFamily: 'Inter_500Medium' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  label: { fontSize: 16 },
  cancel: { borderRadius: 14, alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  cancelText: { fontSize: 16 },
});

// ─── Nested Subtask Row ────────────────────────────────────────────────────────
const NestedSubtaskRow = ({
  child, parentId, theme,
  onToggle, onDelete,
}: {
  child: Subtask; parentId: string; theme: any;
  onToggle: (childId: string, parentId: string) => void;
  onDelete: (childId: string, parentId: string) => void;
}) => (
  <View style={[ns.row, { backgroundColor: theme.colors.cardPrimary }]}>
    {/* Indent line */}
    <View style={[ns.indentLine, { backgroundColor: theme.colors.border }]} />

    <TouchableOpacity
      style={[ns.checkbox, {
        backgroundColor: child.done ? theme.colors.primary : 'transparent',
        borderColor: child.done ? theme.colors.primary : theme.colors.border,
      }]}
      onPress={() => onToggle(child.id, parentId)}
    >
      {child.done && <MaterialIcons name="check" size={10} color="#fff" />}
    </TouchableOpacity>

    <Text style={[ns.text, {
      color: child.done ? theme.colors.textSecondary : theme.colors.text,
      textDecorationLine: child.done ? 'line-through' : 'none',
      fontFamily: 'Inter_400Regular',
    }]}>
      {child.text}
    </Text>

    <TouchableOpacity onPress={() => onDelete(child.id, parentId)} style={ns.deleteBtn}>
      <MaterialIcons name="close" size={14} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  </View>
);
const ns = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingRight: 10, borderRadius: 10, marginBottom: 4 },
  indentLine: { width: 2, height: '100%', borderRadius: 1, marginLeft: 6 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text: { flex: 1, fontSize: 14, lineHeight: 18 },
  deleteBtn: { padding: 4 },
});

// ─── Main Modal ───────────────────────────────────────────────────────────────
export const TaskDetailModal = ({ visible, taskId, onClose }: TaskDetailModalProps) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { taskGroups, updateTask, handleComposerSave } = useDashboard();

  const [newComment, setNewComment] = useState('');
  const [commentAtt, setCommentAtt] = useState<{ uri: string; name: string; type: 'image' | 'file' } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('subtasks');
  const [showActionMenu, setShowActionMenu] = useState(false);

  // Nested subtask state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null);
  const [childInput, setChildInput] = useState('');

  // ── Bottom-sheet animation ─────────────────────────────────────────────────
  const panelY = useRef(new Animated.Value(SH)).current;  // starts off screen
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const snapState = useRef<'compact' | 'full'>('compact');

  // Fixed snap points: compact = bottom 70% of screen, full = 100%
  const SNAP_COMPACT = SH * 0.3; // translateY = 30% → panel fills bottom 70%
  const SNAP_COMPACT_REF = useRef(SNAP_COMPACT);


  // Ref for DraggableFlatList to scroll when adding child subtask
  const subtaskListRef = useRef<any>(null);

  // Scroll to end when adding child subtask input appears
  useEffect(() => {
    if (addingChildFor) {
      setTimeout(() => {
        subtaskListRef.current?.scrollToEnd?.({ animated: true });
      }, 300);
    }
  }, [addingChildFor]);

  const snapTo = useCallback((state: 'compact' | 'full', onDone?: () => void) => {
    snapState.current = state;
    const toValue = state === 'full' ? 0 : SNAP_COMPACT_REF.current;
    Animated.spring(panelY, {
      toValue, damping: 32, stiffness: 350, mass: 0.8, useNativeDriver: true,
    }).start(onDone);
  }, [panelY, SNAP_COMPACT_REF]);

  const dismiss = useCallback(() => {
    // Reset transient state immediately before animation
    setExpandedIds(new Set());
    setAddingChildFor(null);
    setChildInput('');
    setNewComment('');
    setCommentAtt(null);
    setActiveTab('subtasks');
    snapState.current = 'compact';

    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(panelY, { toValue: SH, duration: 300, useNativeDriver: true }),
    ]).start(onClose);
  }, [backdropAnim, panelY, onClose]);

  // Open / close + state reset
  useEffect(() => {
    if (visible) {
      panelY.setValue(SH);
      backdropAnim.setValue(0);
      snapState.current = 'compact';
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(panelY, { toValue: SNAP_COMPACT_REF.current, damping: 30, stiffness: 300, mass: 0.8, useNativeDriver: true }),
      ]).start();
    } else {
      // Reset ALL transient UI state every time modal closes
      setExpandedIds(new Set());
      setAddingChildFor(null);
      setChildInput('');
      setNewComment('');
      setCommentAtt(null);
      setActiveTab('subtasks');
      snapState.current = 'compact';
    }
  }, [visible]);

  // Auto-expand to full screen when keyboard opens for nested subtask
  useEffect(() => {
    const eventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(eventName, () => {
      if (addingChildFor && snapState.current !== 'full') snapTo('full');
    });
    return () => sub.remove();
  }, [addingChildFor, snapTo]);

  // ── Handle drag (PanResponder) ──────────────────────────────────────────────
  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 4 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderGrant: () => {
        panelY.stopAnimation();
        panelY.extractOffset();
      },
      onPanResponderMove: Animated.event(
        [null, { dy: panelY }],
        { useNativeDriver: false } // Fixed desync in fast swipes by handling move on JS thread
      ),
      onPanResponderRelease: (_, gs) => {
        panelY.flattenOffset();
        const state = snapState.current;

        // More sensitive detection for fast swipes
        if (gs.dy < -20 || gs.vy < -0.2) {
          snapTo('full');
        } else if (gs.dy > 60 || gs.vy > 0.3) {
          if (state === 'full') snapTo('compact');
          else dismiss();
        } else {
          snapTo(state);
        }
      },
      onPanResponderTerminate: () => {
        panelY.flattenOffset();
        snapTo(snapState.current);
      },
    })
  ).current;

  // Swipeable tabs
  const tabScrollRef = useRef<ScrollView>(null);
  const switchTab = (tab: Tab) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
    tabScrollRef.current?.scrollTo({ x: TABS.indexOf(tab) * SW, animated: true });
  };
  const handleTabScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (idx >= 0 && idx < TABS.length && TABS[idx] !== activeTab) setActiveTab(TABS[idx]);
  };

  // Find task live
  const task = useMemo(() => {
    if (!taskId) return null;
    for (const group of taskGroups) {
      const found = group.tasks.find(t => t.id === taskId);
      if (found) return found;
    }
    return null;
  }, [taskGroups, taskId]);

  if (!task) return null;

  const priority = task.priority ? PRIORITY_META[task.priority] : null;
  const tagColor = TAG_META[task.tagType?.toLowerCase() ?? 'personal'] ?? TAG_META.personal;

  // ── Subtask helpers ────────────────────────────────────────────────────────
  const toggleSubtask = (subId: string) => {
    Haptics.selectionAsync();
    updateTask(task.id, t => ({
      ...t,
      subtasks: t.subtasks?.map(s => s.id === subId ? { ...s, done: !s.done } : s),
    }));
  };

  const toggleChildDone = (childId: string, parentId: string) => {
    Haptics.selectionAsync();
    updateTask(task.id, t => ({
      ...t,
      subtasks: t.subtasks?.map(s =>
        s.id === parentId
          ? { ...s, children: s.children?.map(c => c.id === childId ? { ...c, done: !c.done } : c) }
          : s
      ),
    }));
  };

  const deleteChild = (childId: string, parentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTask(task.id, t => ({
      ...t,
      subtasks: t.subtasks?.map(s =>
        s.id === parentId
          ? { ...s, children: s.children?.filter(c => c.id !== childId) }
          : s
      ),
    }));
  };

  const addChildSubtask = (parentId: string) => {
    if (!childInput.trim()) return;
    Haptics.selectionAsync();
    const newChild: Subtask = { id: `c_${Date.now()}`, text: childInput.trim(), done: false };
    updateTask(task.id, t => ({
      ...t,
      subtasks: t.subtasks?.map(s =>
        s.id === parentId
          ? { ...s, children: [...(s.children ?? []), newChild] }
          : s
      ),
    }));
    setChildInput('');
    setAddingChildFor(null);
    // Keep it expanded so user sees the new child
    setExpandedIds(prev => new Set([...prev, parentId]));
  };

  const toggleExpand = (id: string) => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Comment helpers ────────────────────────────────────────────────────────
  const pickCommentAtt = async (source: 'camera' | 'gallery' | 'file') => {
    const MAX = 5 * 1024 * 1024;
    if (source === 'file') {
      try {
        const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (!res.canceled && res.assets?.[0]) {
          const a = res.assets[0];
          if (a.size && a.size > MAX) { Alert.alert('Too Large', 'Max 5MB per comment attachment.'); return; }
          if (a.mimeType?.startsWith('video/')) { Alert.alert('Not Allowed', 'Videos cannot be attached.'); return; }
          setCommentAtt({ uri: a.uri, name: a.name || 'File', type: 'file' });
        }
      } catch { Alert.alert('Error', 'Could not pick file.'); }
      return;
    }
    const { status } = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Enable it in Settings.'); return; }
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      if (a.fileSize && a.fileSize > MAX) { Alert.alert('Too Large', 'Max 5MB per attachment.'); return; }
      setCommentAtt({ uri: a.uri, name: a.fileName || 'Photo', type: 'image' });
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim() && !commentAtt) return;
    Haptics.selectionAsync();
    updateTask(task.id, t => ({
      ...t,
      commentsList: [...(t.commentsList ?? []), {
        id: Date.now().toString(), text: newComment.trim(), date: 'Just now',
        attachment: commentAtt ?? undefined,
      } as any],
    }));
    setNewComment('');
    setCommentAtt(null);
  };

  // ── 3-dot actions ──────────────────────────────────────────────────────────
  const actionItems: SheetItem[] = [
    { label: 'Edit Task', icon: 'edit', onPress: () => Alert.alert('Edit Task', 'Editor coming soon.') },
    { label: 'Duplicate Task', icon: 'content-copy', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); handleComposerSave({ ...task, id: `t${Date.now()}`, title: `${task.title} (Copy)`, completed: false, commentsList: [] }); Alert.alert('Duplicated ✓', 'Task copied successfully.'); } },
    { label: 'Move to List', icon: 'folder-open', onPress: () => Alert.alert('Move Task', 'Coming soon.') },
    { label: 'Save as Template', icon: 'bookmark-add', onPress: () => Alert.alert('Template Saved', 'Saved as reusable template.') },
    { label: 'Share Task', icon: 'share', onPress: () => Alert.alert('Share', `"${task.title}"`) },
    { label: 'Archive Task', icon: 'archive', onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateTask(task.id, t => ({ ...t, archived: true })); onClose(); } },
    {
      label: 'Delete Task', icon: 'delete-outline', destructive: true,
      onPress: () => Alert.alert('Delete Task', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); onClose(); } },
      ]),
    },
  ];

  const versionHistory: VersionEntry[] = [
    { id: 'v4', action: 'You marked a subtask as done', date: '5 min ago', icon: 'check-circle' },
    { id: 'v3', action: 'You changed priority', from: 'LOW', to: 'HIGH', date: '1 hour ago', icon: 'flag' },
    { id: 'v2', action: 'You added 2 subtasks', date: 'Yesterday, 4:30 PM', icon: 'add-circle' },
    { id: 'v1', action: 'You created this task', date: 'Apr 5, 10:30 AM', icon: 'add-task' },
  ];

  const subtasksDone = task.subtasks?.filter(s => s.done).length ?? 0;
  const subtasksTotal = task.subtasks?.length ?? 0;
  const progress = subtasksTotal > 0 ? subtasksDone / subtasksTotal : 0;

  // ── Fixed Header ───────────────────────────────────────────────────────────
  const Header = () => (
    <View style={st.header} onLayout={e => { const h = e.nativeEvent.layout.height; setLayoutHeights(p => ({ ...p, header: h })); }}>
      <View style={st.toolbar}>
        <TouchableOpacity style={[st.toolBtn, { backgroundColor: theme.colors.secondary }]} onPress={handleClose}>
          <MaterialIcons name="keyboard-arrow-down" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[st.toolBtn, { backgroundColor: theme.colors.secondary }]} onPress={() => { Haptics.selectionAsync(); setShowActionMenu(true); }}>
          <MaterialIcons name="more-vert" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
      <Text style={[st.title, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]} numberOfLines={3}>{task.title}</Text>
      <View style={st.badgesRow}>
        {priority && (
          <View style={[st.badge, { backgroundColor: priority.bg }]}>
            <MaterialIcons name="flag" size={13} color={priority.color} />
            <Text style={[st.badgeText, { color: priority.color, fontFamily: 'Inter_600SemiBold' }]}>{priority.label}</Text>
          </View>
        )}
        <View style={[st.badge, { backgroundColor: tagColor.bg }]}>
          <View style={[st.tagDot, { backgroundColor: tagColor.text }]} />
          <Text style={[st.badgeText, { color: tagColor.text, fontFamily: 'Inter_600SemiBold' }]}>{task.tag}</Text>
        </View>
        {task.hasReminder && (
          <View style={[st.badge, { backgroundColor: theme.colors.secondary }]}>
            <MaterialIcons name="notifications-active" size={13} color={theme.colors.primary} />
            <Text style={[st.badgeText, { color: theme.colors.primary, fontFamily: 'Inter_500Medium' }]}>Reminder</Text>
          </View>
        )}
      </View>
      {(task.dueDate || task.dueTime) && (
        <View style={[st.dueCard, { backgroundColor: `${theme.colors.primary}0D`, borderColor: `${theme.colors.primary}25` }]}>
          <MaterialIcons name="calendar-today" size={15} color={theme.colors.primary} />
          <Text style={[st.dueText, { color: theme.colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
            {task.dueDate || 'Anytime'}{task.dueTime ? `  ·  ${task.dueTime}` : ''}
          </Text>
        </View>
      )}
      {subtasksTotal > 0 && (
        <View style={st.progressSection}>
          <View style={st.progressHeader}>
            <Text style={[st.progressLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>Subtasks</Text>
            <Text style={[st.progressCount, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>{subtasksDone}/{subtasksTotal}</Text>
          </View>
          <View style={st.segmentedTrack}>
            {Array.from({ length: subtasksTotal }).map((_, i) => (
              <View
                key={i}
                style={[
                  st.progressSegment,
                  {
                    backgroundColor: i < subtasksDone ? theme.colors.primary : theme.colors.border + '30',
                    flex: 1,
                  }
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );

  // ── Subtask Page — DraggableFlatList with nested support ─────────────────
  const SubtasksPage = () => (
    <View style={{ width: SW, flex: 1 }}>
      {subtasksTotal === 0 ? (
        <View style={st.emptyState} onLayout={e => { const h = e.nativeEvent.layout.height; setTabContentHeights(p => ({ ...p, subtasks: h })); }}>
          <MaterialIcons name="checklist" size={40} color={theme.colors.border} />
          <Text style={[st.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>No subtasks yet</Text>
          <Text style={[st.emptySubText, { color: theme.colors.textSecondary }]}>Add subtasks when creating or editing tasks</Text>
        </View>
      ) : (
        <DraggableFlatList
          ref={subtaskListRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 14, paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
          data={task.subtasks ?? []}
          keyExtractor={item => item.id}
          onContentSizeChange={(w, h) => setTabContentHeights(p => ({ ...p, subtasks: h }))}
          activationDistance={5}
          onDragBegin={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
          onDragEnd={({ data }) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            updateTask(task.id, t => ({ ...t, subtasks: data }));
          }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListFooterComponent={
            (task.attachments?.length ?? 0) > 0 ? (
              <View style={{ marginTop: 24 }}>
                <Text style={[st.sectionLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>ATTACHMENTS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {task.attachments!.map(att => (
                    <View key={att.id} style={[st.attCard, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
                      {att.type === 'image'
                        ? <Image source={{ uri: att.uri }} style={st.attImg} resizeMode="cover" />
                        : <View style={[st.attIconBox, { backgroundColor: `${theme.colors.primary}15` }]}>
                          <MaterialIcons name={att.type === 'link' ? 'link' : 'description'} size={22} color={theme.colors.primary} />
                        </View>}
                      <Text style={[st.attName, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]} numberOfLines={2}>{att.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          renderItem={({ item: sub, drag, isActive }: RenderItemParams<Subtask>) => {
            const hasChildren = (sub.children?.length ?? 0) > 0;
            const isExpanded = expandedIds.has(sub.id);
            const isAddingHere = addingChildFor === sub.id;

            return (
              <View style={isActive ? { zIndex: 999 } : undefined}>
                {/* ── Parent Row ── */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onLongPress={drag}
                  delayLongPress={150}
                  onPress={() => !isActive && toggleSubtask(sub.id)}
                  style={[
                    st.subtaskRow,
                    { backgroundColor: isActive ? theme.colors.cardPrimary : theme.colors.secondary },
                    isActive && st.subtaskDragging,
                    (isExpanded || isAddingHere) && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
                  ]}
                >
                  {/* Checkbox */}
                  <TouchableOpacity
                    style={[st.checkbox, {
                      backgroundColor: sub.done ? theme.colors.primary : 'transparent',
                      borderColor: sub.done ? theme.colors.primary : theme.colors.border,
                    }]}
                    onPress={() => toggleSubtask(sub.id)}
                  >
                    {sub.done && <MaterialIcons name="check" size={12} color="#fff" />}
                  </TouchableOpacity>

                  {/* Label */}
                  <Text style={[st.subtaskLabel, {
                    color: sub.done ? theme.colors.textSecondary : theme.colors.text,
                    textDecorationLine: sub.done ? 'line-through' : 'none',
                    fontFamily: 'Inter_400Regular',
                  }]}>
                    {sub.text}
                  </Text>
                  {hasChildren && (
                    <Text style={[st.childBadge, { color: theme.colors.primary, backgroundColor: `${theme.colors.primary}15` }]}>
                      {sub.children!.filter(c => c.done).length}/{sub.children!.length}
                    </Text>
                  )}

                  {/* Expand / collapse button */}
                  <TouchableOpacity
                    onPress={() => {
                      if (!hasChildren && !isAddingHere) {
                        setAddingChildFor(sub.id);
                        setChildInput('');
                      } else {
                        toggleExpand(sub.id);
                      }
                    }}
                    style={st.expandBtn}
                  >
                    <MaterialIcons
                      name={isExpanded || isAddingHere ? 'expand-less' : (hasChildren ? 'expand-more' : 'add')}
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>

                {/* ── Expanded children section ── */}
                {(isExpanded || isAddingHere) && (
                  <View style={[st.childrenContainer, {
                    backgroundColor: theme.colors.secondary,
                    borderColor: theme.colors.border,
                  }]}>
                    {/* Existing children */}
                    {(sub.children ?? []).map(child => (
                      <NestedSubtaskRow
                        key={child.id}
                        child={child}
                        parentId={sub.id}
                        theme={theme}
                        onToggle={toggleChildDone}
                        onDelete={deleteChild}
                      />
                    ))}

                    {/* Add nested subtask input */}
                    {isAddingHere ? (
                      <View style={st.addChildRow}>
                        <View style={[st.indentLineThin, { backgroundColor: theme.colors.primary }]} />
                        <MaterialIcons name="subdirectory-arrow-right" size={14} color={theme.colors.primary} />
                        <TextInput
                          style={[st.childInput, { color: theme.colors.text, fontFamily: 'Inter_400Regular', borderColor: theme.colors.border }]}
                          placeholder="Add nested subtask…"
                          placeholderTextColor={theme.colors.textSecondary}
                          value={childInput}
                          onChangeText={setChildInput}
                          autoFocus
                          returnKeyType="done"
                          onSubmitEditing={() => addChildSubtask(sub.id)}
                        />
                        <TouchableOpacity onPress={() => addChildSubtask(sub.id)} style={[st.addChildBtn, { backgroundColor: childInput.trim() ? theme.colors.primary : theme.colors.border }]}>
                          <MaterialIcons name="check" size={14} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setAddingChildFor(null); setChildInput(''); }} style={st.cancelChildBtn}>
                          <MaterialIcons name="close" size={16} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      /* "Add nested" button when already expanded */
                      <TouchableOpacity
                        style={st.addNestedTrigger}
                        onPress={() => { setAddingChildFor(sub.id); setChildInput(''); }}
                      >
                        <MaterialIcons name="add" size={14} color={theme.colors.primary} />
                        <Text style={[st.addNestedText, { color: theme.colors.primary, fontFamily: 'Inter_500Medium' }]}>Add nested subtask</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );

  // ── Comments Page ──────────────────────────────────────────────────────────
  const CommentsPage = () => (
    <ScrollView
      style={{ width: SW }}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 10 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onContentSizeChange={(w, h) => setTabContentHeights(p => ({ ...p, comments: h }))}
    >
      {/* Comments List first */}
      {(task.commentsList?.length ?? 0) > 0
        ? <View style={{ gap: 12 }}>
          {(task.commentsList as any[] ?? []).map((c: any) => (
            <View key={c.id} style={st.commentRow}>
              <View style={[st.commentAvatar, { backgroundColor: theme.colors.primary }]}><Text style={st.avatarTxt}>S</Text></View>
              <View style={{ flex: 1 }}>
                <View style={[st.commentBubble, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
                  <Text style={[st.commentMeta, { color: theme.colors.textSecondary }]}>Shubham  ·  {c.date}</Text>
                  {!!c.text && <Text style={[st.commentTxt, { color: theme.colors.text }]}>{c.text}</Text>}
                </View>
              </View>
            </View>
          ))}
        </View>
        : <View style={st.emptyState}>
          <MaterialIcons name="chat-bubble-outline" size={36} color={theme.colors.border} />
          <Text style={[st.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>No comments yet</Text>
        </View>
      }

      {/* Attachment Preview */}
      {commentAtt && (
        <View style={[st.attPreviewRow, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border, marginTop: 16 }]}>
          {commentAtt.type === 'image' ? <Image source={{ uri: commentAtt.uri }} style={st.attPreviewImg} resizeMode="cover" /> : <MaterialIcons name="insert-drive-file" size={22} color={theme.colors.primary} />}
          <Text style={[st.attPreviewName, { color: theme.colors.text }]} numberOfLines={1}>{commentAtt.name}</Text>
          <TouchableOpacity onPress={() => setCommentAtt(null)}><MaterialIcons name="close" size={18} color={theme.colors.textSecondary} /></TouchableOpacity>
        </View>
      )}

      {/* Add Comment Input at the bottom */}
      <View style={[st.commentInputCompact, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border, marginTop: 12 }]}>
        <View style={st.commentRowCompact}>
          <TouchableOpacity style={st.miniAttachBtn} onPress={() => pickCommentAtt('gallery')}>
            <MaterialIcons name="photo-library" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TextInput 
            style={[st.commentInputMini, { color: theme.colors.text, fontFamily: 'Inter_400Regular' }]} 
            placeholder="Add a comment…" 
            placeholderTextColor={theme.colors.textSecondary} 
            value={newComment} 
            onChangeText={setNewComment} 
            multiline 
          />
          <TouchableOpacity style={[st.sendBtnMini, { backgroundColor: (newComment.trim() || commentAtt) ? theme.colors.primary : theme.colors.border }]} onPress={handleAddComment}>
            <MaterialIcons name="send" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  // ── History Page ───────────────────────────────────────────────────────────
  const HistoryPage = () => (
    <ScrollView
      style={{ width: SW }}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
      showsVerticalScrollIndicator={false}
      onContentSizeChange={(w, h) => setTabContentHeights(p => ({ ...p, history: h }))}
    >
      <Text style={[st.historyNote, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>All changes to this task are recorded below.</Text>
      {versionHistory.map((entry, i) => <VersionItem key={entry.id} entry={entry} isLast={i === versionHistory.length - 1} theme={theme} />)}
    </ScrollView>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    if (childInput.trim() || newComment.trim()) {
      Alert.alert('Unsaved input', 'You have unsaved text. Discard it?', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard', style: 'destructive', onPress: () => {
            setChildInput(''); setAddingChildFor(null); setNewComment('');
            dismiss();
          }
        },
      ]);
    } else {
      dismiss();
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
        <GestureHandlerRootView style={st.flex}>
          {/* Backdrop: fades independently */}
          <Animated.View style={[st.scrim, {
            opacity: panelY.interpolate({
              inputRange: [0, SH * 0.8],
              outputRange: [1, 0],
              extrapolate: 'clamp'
            })
          }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </Animated.View>

          {/* Panel: full-screen height, slides up via translateY */}
          <Animated.View
            style={[
              st.panel,
              { backgroundColor: theme.colors.cardPrimary },
              { transform: [{ translateY: panelY }] },
            ]}
          >
            {/* Draggable areas: handle and header */}
            <View {...handlePan.panHandlers}>
              <View style={st.handleWrap}>
                <View style={[st.handle, { backgroundColor: theme.colors.border }]} />
              </View>
              <Header />
            </View>

            {/* Everything inside KAV so keyboard pushes content up */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
              style={{ flex: 1 }}
            >
              <View
                style={[st.tabBar, { borderBottomColor: theme.colors.border, borderTopColor: theme.colors.border }]}
                onLayout={e => { const h = e.nativeEvent.layout.height; setLayoutHeights(p => ({ ...p, tabs: h })); }}
              >
                {TABS.map(tab => {
                  const active = activeTab === tab;
                  const labels = { subtasks: 'Subtasks', comments: 'Comments', history: 'History' };
                  const icons = { subtasks: 'checklist', comments: 'chat-bubble-outline', history: 'history' };
                  return (
                    <TouchableOpacity key={tab} style={[st.tab, active && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2.5 }]} onPress={() => switchTab(tab)}>
                      <MaterialIcons name={icons[tab] as any} size={15} color={active ? theme.colors.primary : theme.colors.textSecondary} />
                      <Text style={[st.tabText, { color: active ? theme.colors.primary : theme.colors.textSecondary, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                        {labels[tab]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <ScrollView ref={tabScrollRef} horizontal pagingEnabled scrollEventThrottle={16} showsHorizontalScrollIndicator={false} onMomentumScrollEnd={handleTabScroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {SubtasksPage()}
                {CommentsPage()}
                {HistoryPage()}
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>
      <AndroidSheet visible={showActionMenu} title="TASK OPTIONS" items={actionItems} onClose={() => setShowActionMenu(false)} theme={theme} />
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },

  // Panel: full device height, position at top, translateY slides it into view
  panel: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: SH,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handleWrap: { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2 },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  toolBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, letterSpacing: -0.5, lineHeight: 28, marginBottom: 12 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 12 },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  dueCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, marginBottom: 14, alignSelf: 'flex-start' },
  dueText: { fontSize: 13 },
  progressSection: { marginBottom: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 13 },
  progressCount: { fontSize: 13 },
  segmentedTrack: { flexDirection: 'row', gap: 4, height: 6 },
  progressSegment: { height: 6, borderRadius: 3 },

  // Tab Bar
  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11 },
  tabText: { fontSize: 13 },

  // Subtask rows
  subtaskRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  subtaskDragging: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  subtaskLabel: { flex: 1, fontSize: 15, lineHeight: 20 },
  expandBtn: { padding: 4 },
  childBadge: { fontSize: 11, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, fontFamily: 'Inter_600SemiBold', overflow: 'hidden' },

  // Children container
  childrenContainer: {
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
  },
  addChildRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  indentLineThin: { width: 2, height: 20, borderRadius: 1 },
  childInput: {
    flex: 1, fontSize: 14, paddingVertical: 7, paddingHorizontal: 10,
    borderWidth: 1, borderRadius: 10, fontFamily: 'Inter_400Regular',
  },
  addChildBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelChildBtn: { padding: 4 },
  addNestedTrigger: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, marginTop: 2 },
  addNestedText: { fontSize: 13 },

  // Section label
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginBottom: 10 },

  // Attachments
  attCard: { width: 140, borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  attImg: { width: '100%', height: 80, borderRadius: 8, marginBottom: 2 },
  attIconBox: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  attName: { fontSize: 13, lineHeight: 17 },

  // Comments
  commentInputCompact: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 4 },
  commentRowCompact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniAttachBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  commentInputMini: { flex: 1, fontSize: 14, paddingVertical: 8, maxHeight: 100 },
  sendBtnMini: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  attPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 10 },
  attPreviewImg: { width: 36, height: 36, borderRadius: 8 },
  attPreviewName: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  commentRow: { flexDirection: 'row', gap: 10 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  commentBubble: { flex: 1, padding: 12, borderRadius: 16, borderTopLeftRadius: 4, borderWidth: 1 },
  commentMeta: { fontSize: 11, marginBottom: 4, fontFamily: 'Inter_500Medium' },
  commentTxt: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },

  // History
  historyNote: { fontSize: 13, lineHeight: 18, marginBottom: 20 },

  // Empty states
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 15 },
  emptySubText: { fontSize: 13, textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
