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
import { TaskComposer } from '../../core/components/TaskComposer';

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

const TABS = ['subtasks', 'comments', 'attachments'] as const;
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

// ─── Main Modal ───────────────────────────────────────────────────────────────
export const TaskDetailModal = ({ visible, taskId, onClose }: TaskDetailModalProps) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { taskGroups, updateTask, handleComposerSave } = useDashboard();

  const [newComment, setNewComment] = useState('');
  const [commentAtt, setCommentAtt] = useState<{ uri: string; name: string; type: 'image' | 'file' } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('subtasks');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // ── Bottom-sheet animation ─────────────────────────────────────────────────
  const panelY = useRef(new Animated.Value(SH)).current;  // starts off screen
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const snapState = useRef<'compact' | 'full'>('compact');

  // Fixed snap points: compact = bottom 70% of screen, full = 100%
  const SNAP_FULL = 0;           // 0% from top = 100% height
  const SNAP_COMPACT = SH * 0.3; // 30% from top = 70% height

  // --- ADD THESE NEW ANIMATED VALUES ---
  // Smoothly expand top padding when dragging to full screen to dodge the notch
  const headerPaddingTop = panelY.interpolate({
    inputRange: [SNAP_FULL, Math.max(1, SNAP_COMPACT)],
    outputRange: [Math.max(insets.top + 8, 20), 16], // Full screen = Safe Area, Compact = 16px
    extrapolate: 'clamp',
  });

  // Smoothly flatten the top corners when dragging to full screen
  const sheetRadius = panelY.interpolate({
    inputRange: [SNAP_FULL, Math.max(1, SNAP_COMPACT)],
    outputRange: [0, 16], // 0 radius at full screen, 16 radius at compact
    extrapolate: 'clamp',
  });
  // -------------------------------------

  // Ref for DraggableFlatList to scroll when adding child subtask
  const subtaskListRef = useRef<any>(null);

  const snapTo = useCallback((state: 'compact' | 'full', onDone?: () => void) => {
    snapState.current = state;
    const toValue = state === 'full' ? SNAP_FULL : SNAP_COMPACT;
    Animated.spring(panelY, {
      toValue, damping: 32, stiffness: 350, mass: 0.8, useNativeDriver: false,
    }).start(onDone);
  }, [panelY]);

  const dismiss = useCallback(() => {
    // Reset transient state immediately before animation
    setNewComment('');
    setCommentAtt(null);
    setActiveTab('subtasks');
    snapState.current = 'compact';

    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(panelY, { toValue: SH, duration: 300, useNativeDriver: false }),
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
        Animated.spring(panelY, { toValue: SNAP_COMPACT, damping: 30, stiffness: 300, mass: 0.8, useNativeDriver: false }),
      ]).start();
    } else {
      // Reset ALL transient UI state every time modal closes
      setNewComment('');
      setCommentAtt(null);
      setActiveTab('subtasks');
      snapState.current = 'compact';
    }
  }, [visible]);

  // ── Handle drag (PanResponder) ──────────────────────────────────────────────
  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        const isVertical = Math.abs(gs.dy) > 5 && Math.abs(gs.dy) > Math.abs(gs.dx);
        // If the panel is in compact mode (70% height), any vertical gesture should move the panel
        if (isVertical && snapState.current === 'compact') return true;
        // If pulling down from full-screen, we move the panel
        if (isVertical && gs.dy > 5) return true;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        const isVertical = Math.abs(gs.dy) > 5 && Math.abs(gs.dy) > Math.abs(gs.dx);
        if (!isVertical) return false;

        // In compact mode, we want the panel to catch ALL vertical swipes 
        // to move it between 70% and 100% (or down to dismiss).
        if (snapState.current === 'compact') return true;

        // In full-screen mode, we only capture significant downward swipes to collapse it.
        // Small downward swipes or any upward swipes are handled by the internal ScrollViews.
        if (snapState.current === 'full' && gs.dy > 30) return true;

        return false;
      },
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
      onShouldBlockNativeResponder: () => true,
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

    const findInSubtasks = (parentTask: any, subs: any[]): any => {
      for (const s of subs) {
        if (s.id === taskId) {
          return {
            ...s,
            id: s.id,
            title: s.title || s.text,
            completed: s.done !== undefined ? s.done : s.completed,
            tag: s.tag,
            tagType: s.tagType,
            subtasks: s.subtasks || s.children || [],
            parentId: parentTask.id,
          };
        }
        const children = s.subtasks || s.children;
        if (children && children.length > 0) {
          const found = findInSubtasks(parentTask, children);
          if (found) return found;
        }
      }
      return null;
    };

    for (const group of taskGroups) {
      const found = group.tasks.find(t => t.id === taskId);
      if (found) return found as any;
      for (const t of group.tasks) {
        const children = t.subtasks || (t as any).children;
        if (children && children.length > 0) {
          const subFound = findInSubtasks(t, children);
          if (subFound) return subFound;
        }
      }
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

  const openSubtaskDetail = (sub: Subtask) => {
    Haptics.selectionAsync();
    setSelectedSubtaskId(sub.id);
  };

  const addSubtask = () => {
    if (!subtaskInput.trim()) {
      Keyboard.dismiss();
      return;
    }
    Haptics.selectionAsync();
    const newChild: Subtask = { id: `c_${Date.now()}`, text: subtaskInput.trim(), done: false };
    updateTask(task.id, t => ({
      ...t,
      subtasks: [...(t.subtasks ?? []), newChild],
    }));
    setSubtaskInput('');
    setTimeout(() => {
      subtaskListRef.current?.scrollToEnd?.({ animated: true });
    }, 100);
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
    { label: 'View Task History', icon: 'history', onPress: () => { setShowActionMenu(false); setTimeout(() => setShowHistoryModal(true), 200); } },
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

  // ── Hero Header ────────────────────────────────────────────────────────────
  const Header = () => (
    <Animated.View style={[st.headerNew, { paddingTop: headerPaddingTop }]}>
      <View style={[st.toolbar, { zIndex: 10 }]}>
        <TouchableOpacity 
          style={st.toolBtn} 
          onPress={() => { Haptics.selectionAsync(); setShowActionMenu(true); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="more-vert" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <Text style={st.titleNew}>{task.title}</Text>

      {/* Badges Row */}
      <View style={st.badgesRowNew}>
        {priority && (
          <View style={[st.badgePill, { backgroundColor: priority.bg }]}>
            <MaterialIcons name="flag" size={14} color={priority.color} />
            <Text style={[st.pillTextNew, { color: priority.color }]}>{priority.label}</Text>
          </View>
        )}
        <View style={[st.badgePill, { backgroundColor: tagColor.bg }]}>
          <View style={[st.tagDotNew, { backgroundColor: tagColor.text }]} />
          <Text style={[st.pillTextNew, { color: tagColor.text }]}>{task.tag}</Text>
        </View>
        {task.hasReminder && (
          <View style={st.badgePill}>
            <MaterialIcons name="notifications" size={14} color={theme.colors.primary} />
            <Text style={[st.pillTextNew, { color: theme.colors.primary }]}>Reminder</Text>
          </View>
        )}
      </View>

      {/* Date/Time Hero Row */}
      {(task.dueDate || task.dueTime) && (
        <View style={st.dateRowNew}>
          <MaterialIcons name="event" size={16} color={theme.colors.textSecondary} />
          <Text style={st.dateTextNew}>
            {task.dueDate || 'No date'} {task.dueTime ? `at ${task.dueTime}` : ''}
          </Text>
        </View>
      )}
    </Animated.View>
  );

  // ── Subtask Page — DraggableFlatList with nested support ─────────────────
  const SubtasksPage = () => (
    <View style={{ width: SW, flex: 1 }}>
      <DraggableFlatList
        ref={subtaskListRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 100 }}
        data={task.subtasks ?? []}
        keyExtractor={item => item.id}
        activationDistance={5}
        onDragBegin={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        onDragEnd={({ data }) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          updateTask(task.id, t => ({ ...t, subtasks: data }));
        }}
        ListEmptyComponent={
          <View style={[st.emptyState, { paddingVertical: 40 }]}>
            <MaterialIcons name="checklist" size={40} color={theme.colors.border} />
            <Text style={[st.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>No subtasks yet</Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ height: 80 }} />
        }
        renderItem={({ item: sub, drag, isActive }: RenderItemParams<Subtask>) => {
          // Safe metadata lookups
          const subPriority = (sub as any).priority ? PRIORITY_META[(sub as any).priority] : null;
          const subTagType = (sub as any).tagType?.toLowerCase() || 'personal';
          const subTagColor = TAG_META[subTagType] || TAG_META.personal;

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onLongPress={drag}
              delayLongPress={150}
              onPress={() => openSubtaskDetail(sub)}
              style={[
                st.subtaskCardNew,
                isActive && st.subtaskDragging,
                { alignItems: 'flex-start' } // Align to top for multi-line support
              ]}
            >
              {/* Checkbox */}
              <TouchableOpacity
                style={[st.checkboxNew, {
                  backgroundColor: sub.done ? theme.colors.primary : 'transparent',
                  borderColor: sub.done ? theme.colors.primary : theme.colors.border,
                  marginTop: 2, // Align with first line of text
                }]}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleSubtask(sub.id);
                }}
              >
                {sub.done && <MaterialIcons name="check" size={12} color="#fff" />}
              </TouchableOpacity>

              {/* Main Content Area */}
              <View style={{ flex: 1 }}>
                {/* Subtask Label */}
                <Text style={[st.subtaskLabelNew, {
                  color: sub.done ? theme.colors.textSecondary : theme.colors.text,
                  textDecorationLine: sub.done ? 'line-through' : 'none',
                  opacity: sub.done ? 0.5 : 1,
                  fontFamily: 'Inter_500Medium',
                }]}>
                  {sub.text}
                </Text>

                {/* Metadata Row (The "Everything" display) */}
                {!sub.done && (
                  <View style={[st.subtaskMetaRow, { marginTop: 4 }]}>
                    {/* Priority Badge */}
                    {subPriority && (
                      <View style={[st.miniBadge, { backgroundColor: subPriority.bg }]}>
                        <MaterialIcons name="flag" size={10} color={subPriority.color} />
                        <Text style={[st.miniBadgeText, { color: subPriority.color }]}>{subPriority.label}</Text>
                      </View>
                    )}

                    {/* Tag Pill */}
                    {(sub as any).tag && (
                      <View style={[st.miniBadge, { backgroundColor: subTagColor.bg }]}>
                        <View style={[st.tagDotNew, { backgroundColor: subTagColor.text, width: 4, height: 4 }]} />
                        <Text style={[st.miniBadgeText, { color: subTagColor.text }]}>{(sub as any).tag}</Text>
                      </View>
                    )}

                    {/* Due Date */}
                    {(sub as any).dueDate && (
                      <View style={st.indicatorRow}>
                        <MaterialIcons name="event" size={12} color={theme.colors.textSecondary} />
                        <Text style={[st.indicatorText, { color: theme.colors.textSecondary }]}>{(sub as any).dueDate}</Text>
                      </View>
                    )}

                    {/* Nested Indicators */}
                    <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto' }}>
                      {((sub as any).subtasks?.length ?? 0) > 0 && (
                        <View style={st.indicatorRow}>
                          <MaterialIcons name="checklist" size={12} color={theme.colors.textSecondary} />
                          <Text style={[st.indicatorText, { color: theme.colors.textSecondary }]}>{(sub as any).subtasks.length}</Text>
                        </View>
                      )}
                      {((sub as any).attachments?.length ?? 0) > 0 && (
                        <MaterialIcons name="attach-file" size={12} color={theme.colors.textSecondary} />
                      )}
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  // ── Comments Page ──────────────────────────────────────────────────────────
  const CommentsPage = () => (
    <ScrollView
      style={{ width: SW }}
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
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

    </ScrollView>
  );

  // ── Attachments Page ────────────────────────────────────────────────────────
  const AttachmentsPage = () => (
    <ScrollView
      style={{ width: SW }}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
      showsVerticalScrollIndicator={false}
    >
      {(task.attachments?.length ?? 0) > 0 ? (
        <View style={{ gap: 16 }}>
          <Text style={[st.sectionLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold', marginBottom: 4 }]}>
            TASK ATTACHMENTS ({task.attachments?.length})
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {task.attachments!.map(att => (
              <TouchableOpacity
                key={att.id}
                style={[st.attCard, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border, width: (SW - 44) / 2 }]}
                activeOpacity={0.8}
              >
                {att.type === 'image'
                  ? <Image source={{ uri: att.uri }} style={st.attImg} resizeMode="cover" />
                  : <View style={[st.attIconBox, { backgroundColor: `${theme.colors.primary}15` }]}>
                    <MaterialIcons name={att.type === 'link' ? 'link' : 'description'} size={28} color={theme.colors.primary} />
                  </View>
                }
                <View style={{ padding: 8, backgroundColor: theme.colors.cardPrimary, borderTopWidth: 1, borderColor: theme.colors.border }}>
                  <Text style={[st.attName, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>
                    {att.name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <View style={st.emptyState}>
          <MaterialIcons name="attachment" size={48} color={theme.colors.border} />
          <Text style={[st.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
            No attachments for this task
          </Text>
        </View>
      )}
    </ScrollView>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    if (newComment.trim()) {
      Alert.alert('Unsaved input', 'You have unsaved text. Discard it?', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard', style: 'destructive', onPress: () => {
            setNewComment('');
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
      <Modal
        visible={visible}
        animationType="none"
        transparent
        onRequestClose={handleClose}
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
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
            {...handlePan.panHandlers}
            style={[
              st.panel,
              { 
                backgroundColor: theme.colors.cardPrimary,
                transform: [{ translateY: panelY }],
                borderTopLeftRadius: sheetRadius,
                borderTopRightRadius: sheetRadius,
              },
            ]}
          >
            {/* Hero Header */}
            <Header />

            {/* Progress Bar moved here for better hierarchy */}
            {subtasksTotal > 0 && (
              <View style={[st.progressWrap, { paddingHorizontal: 20, marginTop: 4, marginBottom: 12 }]}>
                <View style={st.progressBarBg}>
                  <View style={[st.progressBarFill, { width: `${progress * 100}%`, backgroundColor: theme.colors.primary }]} />
                </View>
                <View style={st.progressHeader}>
                  <Text style={[st.progressText, { color: theme.colors.textSecondary }]}>{subtasksDone}/{subtasksTotal} Subtasks</Text>
                  <Text style={[st.progressText, { color: theme.colors.primary, fontWeight: '700' }]}>{Math.round(progress * 100)}%</Text>
                </View>
              </View>
            )}

            {/* THE MAGIC FIX: This Animated View pushes the floor up perfectly by the amount the panel translates down */}
            <Animated.View style={{ flex: 1, paddingBottom: panelY }}>
              
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                style={{ flex: 1 }}
              >
                {/* Tab Bar */}
                <View style={[st.tabBarNew, { backgroundColor: theme.colors.cardPrimary }]}>
                  {TABS.map(tab => {
                    const active = activeTab === tab;
                    const labels = { subtasks: 'Subtasks', comments: 'Comments', attachments: 'Attachments' };
                    const icons = { subtasks: 'checklist', comments: 'chat-bubble-outline', attachments: 'attach-file' };
                    return (
                      <TouchableOpacity
                        key={tab}
                        style={[st.tabPill, active && { backgroundColor: theme.colors.primary }]}
                        onPress={() => switchTab(tab)}
                      >
                        <MaterialIcons name={icons[tab] as any} size={15} color={active ? '#fff' : theme.colors.textSecondary} />
                        <Text style={[st.tabTextNew, { color: active ? '#fff' : theme.colors.textSecondary, fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
                          {labels[tab]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Content Pages */}
                <ScrollView 
                  ref={tabScrollRef} 
                  horizontal 
                  pagingEnabled 
                  scrollEventThrottle={16} 
                  showsHorizontalScrollIndicator={false} 
                  onMomentumScrollEnd={handleTabScroll} 
                  style={{ flex: 1 }} 
                  keyboardShouldPersistTaps="handled"
                >
                  {SubtasksPage()}
                  {CommentsPage()}
                  {AttachmentsPage()} 
                </ScrollView>

                {/* DYNAMIC STICKY INPUT BAR */}
                {activeTab !== 'attachments' && (
                  <View style={[
                    st.commentBarSticky, 
                    { 
                      backgroundColor: theme.colors.cardPrimary, 
                      borderTopColor: theme.colors.border, 
                      paddingBottom: Math.max(insets.bottom, 12),
                      paddingTop: 12
                    }
                  ]}>
                    <TouchableOpacity 
                      style={st.miniAttachBtnNew} 
                      onPress={() => activeTab === 'comments' ? pickCommentAtt('gallery') : null}
                      activeOpacity={activeTab === 'comments' ? 0.7 : 1}
                    >
                      <MaterialIcons 
                        name={activeTab === 'comments' ? "add-photo-alternate" : "subdirectory-arrow-right"} 
                        size={24} 
                        color={theme.colors.textSecondary} 
                      />
                    </TouchableOpacity>

                    <TextInput
                      style={[st.commentInputNew, { color: theme.colors.text, backgroundColor: theme.colors.secondary }]}
                      placeholder={activeTab === 'comments' ? "Add a comment…" : "Quick add subtask…"}
                      placeholderTextColor={theme.colors.textSecondary}
                      value={activeTab === 'comments' ? newComment : subtaskInput}
                      onChangeText={activeTab === 'comments' ? setNewComment : setSubtaskInput}
                      onSubmitEditing={activeTab === 'comments' ? handleAddComment : addSubtask}
                      returnKeyType="send"
                      multiline={activeTab === 'comments'}
                    />

                    <TouchableOpacity
                      style={[
                        st.sendBtnNew, 
                        { backgroundColor: ((activeTab === 'comments' ? (newComment.trim() || commentAtt) : subtaskInput.trim()) ? theme.colors.primary : theme.colors.border) }
                      ]}
                      onPress={activeTab === 'comments' ? handleAddComment : addSubtask}
                    >
                      <MaterialIcons name={activeTab === 'comments' ? "send" : "add"} size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </KeyboardAvoidingView>
              
            </Animated.View>
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>
      <AndroidSheet visible={showActionMenu} title="TASK OPTIONS" items={actionItems} onClose={() => setShowActionMenu(false)} theme={theme} />

      {/* History Modal */}
      <Modal visible={showHistoryModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowHistoryModal(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.cardPrimary }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
            <Text style={{ fontSize: 18, color: theme.colors.text, fontFamily: 'Inter_700Bold' }}>Task History</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)} style={{ padding: 4 }}>
              <MaterialIcons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[st.historyNote, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>All changes to this task are recorded below.</Text>
            {versionHistory.map((entry, i) => <VersionItem key={entry.id} entry={entry} isLast={i === versionHistory.length - 1} theme={theme} />)}
          </ScrollView>
        </View>
      </Modal>

      {/* Recursive Render for Subtasks */}
      <TaskDetailModal
        visible={!!selectedSubtaskId}
        taskId={selectedSubtaskId!}
        onClose={() => setSelectedSubtaskId(null)}
      />

      {/* Composer for creating new Subtasks */}
      <TaskComposer
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
        initialTitle=""
        onSave={(taskData: any) => {
          const newChild: any = {
            ...taskData,
            id: `c_${Date.now()}`,
            text: taskData.title,
            done: false,
          };
          updateTask(task.id, t => ({
            ...t,
            subtasks: [...(t.subtasks ?? []), newChild],
          }));
          setTimeout(() => subtaskListRef.current?.scrollToEnd?.({ animated: true }), 100);
        }}
      />
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },

  panel: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: SH,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    overflow: 'hidden',
    paddingBottom: 0,
  },
  handleWrap: { paddingTop: 6, paddingBottom: 4, alignItems: 'center' },
  handle: { width: 40, height: 5, borderRadius: 3, opacity: 0.2 },

  // New Hero Header
  headerNew: {
    paddingHorizontal: 20,
    paddingBottom: 2,
  },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 0 },
  toolBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  titleNew: { fontSize: 26, fontWeight: '800', lineHeight: 32, marginBottom: 8, letterSpacing: -0.5 },

  progressWrap: { marginBottom: 12 },
  progressBarBg: { height: 6, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { fontSize: 12, fontWeight: '600' },

  badgesRowNew: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  badgePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#f1f5f9' },
  pillTextNew: { fontSize: 12, fontWeight: '700' },
  tagDotNew: { width: 6, height: 6, borderRadius: 3 },

  dateRowNew: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateTextNew: { fontSize: 13, fontWeight: '600', color: '#636e72' },

  // New Pill Tabs
  tabBarNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f2f6',
    marginHorizontal: 4,
  },
  tabTextNew: { fontSize: 13, fontWeight: '600' },

  // Subtask Card Style
  subtaskCardNew: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderColor: '#eee',
    backgroundColor: 'transparent',
  },
  checkboxNew: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.8, alignItems: 'center', justifyContent: 'center',
    marginRight: 10, flexShrink: 0
  },
  subtaskLabelNew: { flex: 1, fontSize: 16, lineHeight: 24 },
  expandBtnNew: { padding: 6, marginLeft: 8 },
  childBadgeNew: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', fontWeight: '800' },

  // Children
  childrenContainer: {
    marginLeft: 36,
    paddingVertical: 6,
  },
  addChildRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  indentLineThin: { width: 1.5, height: '100%', borderRadius: 1, opacity: 0.25 },
  childInput: { flex: 1, fontSize: 14, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  addChildBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cancelChildBtn: { padding: 4 },
  addNestedTrigger: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginTop: 4 },
  addNestedText: { fontSize: 13, fontWeight: '600' },

  // Sticky Comment Bar
  commentBarSticky: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  miniAttachBtnNew: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  commentInputNew: { flex: 1, fontSize: 15, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, maxHeight: 100 },
  sendBtnNew: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  // Comment Row
  commentRow: { flexDirection: 'row', gap: 12, marginBottom: 16, paddingHorizontal: 20 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  commentBubble: { flex: 1, padding: 14, borderRadius: 20, borderTopLeftRadius: 4, borderWidth: 1 },
  commentMeta: { fontSize: 11, marginBottom: 6, fontWeight: '600' },
  commentTxt: { fontSize: 15, lineHeight: 22 },

  // Misc
  historyNote: { fontSize: 14, lineHeight: 22, marginBottom: 20, paddingHorizontal: 20 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '700' },
  emptySubText: { fontSize: 14, textAlign: 'center', opacity: 0.6 },

  addSubtaskBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, marginHorizontal: 20 },
  addSubtaskText: { fontSize: 14, fontWeight: '600' },
  indicatorRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  indicatorText: { fontSize: 11, fontWeight: '600' },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8 },
  attCard: { width: 140, height: 140, borderRadius: 12, borderWidth: 1, overflow: 'hidden', padding: 12, justifyContent: 'space-between' },
  attIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  attImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  attName: { fontSize: 13, lineHeight: 18 },

  subtaskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

export default TaskDetailModal;
