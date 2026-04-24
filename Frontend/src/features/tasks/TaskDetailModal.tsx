import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Modal, StyleSheet, TouchableOpacity, Pressable, View, Text,
  Platform, KeyboardAvoidingView, Image, TextInput,
  Alert, Dimensions, ScrollView, Keyboard, // <--- Added Keyboard import
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetTextInput,
  BottomSheetFooter,
} from '@gorhom/bottom-sheet';
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

const { width: SW } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────
// ... (Keep your PRIORITY_META, TAG_META, TABS, VersionItem, AndroidSheet, and styles exactly the same)
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

// ─── NEW COMPONENT: Isolated Comment Input ─────────────────────────────────────
// By isolating this, typing text no longer causes the parent Modal to remount!
const CommentInputBar = ({ theme, insets, onSend, onPickAtt, commentAtt, onTextChange }: any) => {
  const [text, setText] = useState('');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // Listen to keyboard state to remove the gap dynamically
  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const handleSend = () => {
    if (!text.trim() && !commentAtt) return;
    onSend(text, commentAtt);
    setText('');
    onTextChange(''); // Clear parent's warning ref
  };

  // If keyboard is visible, padding is 8px. If hidden, use the safe area inset!
  const dynamicPaddingBottom = isKeyboardVisible
    ? 8
    : Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 16);

  return (
    <View style={[
      st.commentBar,
      {
        backgroundColor: theme.colors.cardPrimary,
        borderTopColor: theme.colors.border,
        paddingBottom: dynamicPaddingBottom,
        paddingTop: 8
      }
    ]}>
      <TouchableOpacity style={st.attachBtn} onPress={onPickAtt}>
        <MaterialIcons name="add-photo-alternate" size={24} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      <BottomSheetTextInput
        style={[st.commentInput, { color: theme.colors.text, backgroundColor: theme.colors.secondary }]}
        placeholder="Add a comment…"
        placeholderTextColor={theme.colors.textSecondary}
        value={text}
        onChangeText={(val) => {
          setText(val);
          onTextChange(val); // Keep parent updated for the "Discard" warning ONLY
        }}
        onSubmitEditing={handleSend}
        returnKeyType="send"
        multiline
      />

      <TouchableOpacity
        style={[st.sendBtn, { backgroundColor: (text.trim() || commentAtt) ? theme.colors.primary : theme.colors.border }]}
        onPress={handleSend}
        disabled={!text.trim() && !commentAtt}
      >
        <MaterialIcons name="send" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};


// ─── Main Component ───────────────────────────────────────────────────────────
export const TaskDetailModal = ({ visible, taskId, onClose }: TaskDetailModalProps) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { taskGroups, updateTask, handleComposerSave } = useDashboard();

  // Replaced `newComment` state with a Ref to prevent re-renders when typing
  const unsavedTextRef = useRef('');
  const [commentAtt, setCommentAtt] = useState<{ uri: string; name: string; type: 'image' | 'file' } | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>('subtasks');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [editComposerVisible, setEditComposerVisible] = useState(false);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const subtaskListRef = useRef<any>(null);

  const snapPoints = useMemo(() => ['70%', '80%', '90%', '100%'], []);

  const dismiss = useCallback(() => {
    unsavedTextRef.current = '';
    setCommentAtt(null);
    setActiveTab('subtasks');
    bottomSheetRef.current?.close();
  }, []);

  const handleSheetClose = useCallback(() => { onClose(); }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.45}
        pressBehavior="close"
        onPress={() => {
          if (unsavedTextRef.current.trim()) {
            Alert.alert('Unsaved input', 'You have unsaved text. Discard it?', [
              { text: 'Keep editing', style: 'cancel' },
              { text: 'Discard', style: 'destructive', onPress: dismiss },
            ]);
          } else { dismiss(); }
        }}
      />
    ),
    [dismiss]
  );

  const task = useMemo(() => {
    if (!taskId) return null;
    const findInSubs = (parent: any, subs: any[]): any => {
      for (const s of subs) {
        if (s.id === taskId) return { ...s, title: s.title || s.text, completed: s.done ?? s.completed, subtasks: s.subtasks || s.children || [], parentId: parent.id };
        const children = s.subtasks || s.children;
        if (children?.length) { const f = findInSubs(parent, children); if (f) return f; }
      }
      return null;
    };
    for (const group of taskGroups) {
      const found = group.tasks.find((t: any) => t.id === taskId);
      if (found) return found as any;
      for (const t of group.tasks) {
        const children = (t as any).subtasks || (t as any).children;
        if (children?.length) { const f = findInSubs(t, children); if (f) return f; }
      }
    }
    return null;
  }, [taskGroups, taskId]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (visible && task) {
      // Reset state so it always starts fresh on the subtasks tab
      setActiveTab('subtasks');
      unsavedTextRef.current = '';
      setCommentAtt(null);

      // 150ms gives the Modal and BottomSheet enough time to mount and attach the ref
      // on slower devices before attempting to snap it open.
      timer = setTimeout(() => bottomSheetRef.current?.snapToIndex(0), 150);
    } else if (!visible) {
      bottomSheetRef.current?.close();
    }
    return () => clearTimeout(timer);
  }, [visible, task?.id]);

  const priority = task?.priority ? PRIORITY_META[task.priority] : null;
  const tagColor = TAG_META[task?.tagType?.toLowerCase() ?? 'personal'] ?? TAG_META.personal;
  const subtasksDone = task?.subtasks?.filter((s: any) => s.done).length ?? 0;
  const subtasksTotal = task?.subtasks?.length ?? 0;
  const progress = subtasksTotal > 0 ? subtasksDone / subtasksTotal : 0;

  const toggleSubtask = (subId: string) => {
    if (!task) return;
    Haptics.selectionAsync();
    updateTask(task.id, (t: any) => ({ ...t, subtasks: t.subtasks?.map((s: any) => s.id === subId ? { ...s, done: !s.done } : s) }));
  };

  const switchTab = (tab: Tab) => { Haptics.selectionAsync(); setActiveTab(tab); };

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

  // Refactored to accept text directly from the isolated component
  const handleAddComment = useCallback((text: string, att: any) => {
    if (!task) return;
    Haptics.selectionAsync();
    updateTask(task.id, (t: any) => ({
      ...t,
      commentsList: [...(t.commentsList ?? []), { id: Date.now().toString(), text: text.trim(), date: 'Just now', attachment: att ?? undefined }],
    }));
    setCommentAtt(null);
  }, [task, updateTask]);

  const handleClose = () => {
    if (unsavedTextRef.current.trim()) {
      Alert.alert('Unsaved input', 'You have unsaved text. Discard it?', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: dismiss },
      ]);
    } else { dismiss(); }
  };

  const actionItems: SheetItem[] = [
    { label: 'View Task History', icon: 'history', onPress: () => { setShowActionMenu(false); setTimeout(() => setShowHistoryModal(true), 200); } },
    { label: 'Edit Task', icon: 'edit', onPress: () => { setShowActionMenu(false); setTimeout(() => setEditComposerVisible(true), 200); } },
    { label: 'Duplicate Task', icon: 'content-copy', onPress: () => { if (!task) return; Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); handleComposerSave({ ...task, id: `t${Date.now()}`, title: `${task.title} (Copy)`, completed: false, commentsList: [] }); Alert.alert('Duplicated ✓'); } },
    { label: 'Move to List', icon: 'folder-open', onPress: () => Alert.alert('Move Task', 'Coming soon.') },
    { label: 'Save as Template', icon: 'bookmark-add', onPress: () => Alert.alert('Template Saved', 'Saved as reusable template.') },
    { label: 'Share Task', icon: 'share', onPress: () => Alert.alert('Share', `"${task?.title}"`) },
    { label: 'Archive Task', icon: 'archive', onPress: () => { if (!task) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateTask(task.id, (t: any) => ({ ...t, archived: true })); dismiss(); } },
    { label: 'Delete Task', icon: 'delete-outline', destructive: true, onPress: () => Alert.alert('Delete Task', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); dismiss(); } }]) },
  ];

  const versionHistory: VersionEntry[] = [
    { id: 'v4', action: 'You marked a subtask as done', date: '5 min ago', icon: 'check-circle' },
    { id: 'v3', action: 'You changed priority', from: 'LOW', to: 'HIGH', date: '1 hour ago', icon: 'flag' },
    { id: 'v2', action: 'You added 2 subtasks', date: 'Yesterday, 4:30 PM', icon: 'add-circle' },
    { id: 'v1', action: 'You created this task', date: 'Apr 5, 10:30 AM', icon: 'add-task' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  const renderFooter = useCallback(
    (props: any) => {
      if (activeTab !== 'comments') return null;

      return (
        <BottomSheetFooter {...props} bottomInset={0}>
          <CommentInputBar
            theme={theme}
            insets={insets}
            onSend={handleAddComment}
            onPickAtt={() => pickCommentAtt('gallery')}
            commentAtt={commentAtt}
            onTextChange={(val: string) => { unsavedTextRef.current = val; }}
          />
        </BottomSheetFooter>
      );
    },
    [activeTab, theme, insets.bottom, handleAddComment, commentAtt]
  );

  if (!task) return null;

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
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            onClose={handleSheetClose}
            activeOffsetY={[-4, 4]}
            failOffsetX={[-10, 10]}
            animationConfigs={{ duration: 350, dampingRatio: 0.82, stiffness: 140 }}
            backgroundStyle={{ backgroundColor: theme.colors.cardPrimary }}
            handleIndicatorStyle={{ backgroundColor: theme.colors.border, width: 40, height: 5 }}
            footerComponent={renderFooter}
            keyboardBehavior="extend"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustPan"
          >
            <BottomSheetView style={st.sheetContainer}>

              {/* ════════════ STATIC HEADER ════════════ */}
              <View style={[st.header, { backgroundColor: theme.colors.cardPrimary }]}>
                {/* 3-dot menu */}
                <View style={st.toolbar}>
                  <TouchableOpacity style={st.toolBtn} onPress={() => { Haptics.selectionAsync(); setShowActionMenu(true); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialIcons name="more-vert" size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Title */}
                <Text
                  style={[
                    st.title,
                    { color: theme.colors.text },
                    task.title.length > 60 && { fontSize: 18, lineHeight: 24 } // dynamically reduce text size for long titles
                  ]}
                >
                  {task.title}
                </Text>

                {/* Badges */}
                <View style={st.badgeRow}>
                  {priority && (
                    <View style={[st.badge, { backgroundColor: priority.bg }]}>
                      <MaterialIcons name="flag" size={12} color={priority.color} />
                      <Text style={[st.badgeTxt, { color: priority.color }]}>{priority.label}</Text>
                    </View>
                  )}
                  {task.tag && (
                    <View style={[st.badge, { backgroundColor: tagColor.bg }]}>
                      <View style={[st.tagDot, { backgroundColor: tagColor.text }]} />
                      <Text style={[st.badgeTxt, { color: tagColor.text }]}>{task.tag}</Text>
                    </View>
                  )}
                  {task.hasReminder && (
                    <View style={[st.badge, { backgroundColor: `${theme.colors.primary}18` }]}>
                      <MaterialIcons name="notifications" size={12} color={theme.colors.primary} />
                      <Text style={[st.badgeTxt, { color: theme.colors.primary }]}>Reminder</Text>
                    </View>
                  )}
                </View>

                {/* Due date */}
                {(task.dueDate || task.dueTime) && (
                  <View style={st.dateRow}>
                    <MaterialIcons name="event" size={14} color={theme.colors.textSecondary} />
                    <Text style={[st.dateTxt, { color: theme.colors.textSecondary }]}>
                      {task.dueDate || 'No date'}{task.dueTime ? `  ·  ${task.dueTime}` : ''}
                    </Text>
                  </View>
                )}

                {/* Progress */}
                {subtasksTotal > 0 && (
                  <View style={st.progressWrap}>
                    <View style={st.progressRow}>
                      <Text style={[st.progressLabel, { color: theme.colors.textSecondary }]}>{subtasksDone}/{subtasksTotal} completed</Text>
                      <Text style={[st.progressPct, { color: theme.colors.primary }]}>{Math.round(progress * 100)}%</Text>
                    </View>
                    <View style={[st.progressTrack, { backgroundColor: `${theme.colors.primary}22` }]}>
                      <View style={[st.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.colors.primary }]} />
                    </View>
                  </View>
                )}

                <View style={[st.divider, { backgroundColor: theme.colors.border }]} />

                {/* Tab pills */}
                <View style={st.tabBar}>
                  {(TABS as readonly Tab[]).map(tab => {
                    const active = activeTab === tab;
                    const LABELS: Record<Tab, string> = { subtasks: 'Subtasks', comments: 'Comments', attachments: 'Attachments' };
                    const ICONS: Record<Tab, string> = { subtasks: 'checklist', comments: 'chat-bubble-outline', attachments: 'attach-file' };
                    return (
                      <TouchableOpacity
                        key={tab}
                        style={[st.tabPill, { backgroundColor: active ? theme.colors.primary : theme.colors.secondary }]}
                        onPress={() => switchTab(tab)}
                        activeOpacity={0.75}
                      >
                        <MaterialIcons name={ICONS[tab] as any} size={13} color={active ? '#fff' : theme.colors.textSecondary} />
                        <Text style={[st.tabTxt, { color: active ? '#fff' : theme.colors.textSecondary, fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
                          {LABELS[tab]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ════════════ SCROLLABLE CONTENT ════════════ */}
              <View style={{ flex: 1 }}>
                {activeTab === 'subtasks' && (
                  <BottomSheetScrollView ref={subtaskListRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 4, paddingBottom: Math.max(insets.bottom, 20) + 24 }}>
                    {/* Your existing Subtasks map */}
                    {(task.subtasks?.length ?? 0) === 0 ? (
                      <View style={st.emptyState}>
                        <View style={[st.emptyIcon, { backgroundColor: `${theme.colors.primary}12` }]}><MaterialIcons name="checklist" size={30} color={theme.colors.primary} /></View>
                        <Text style={[st.emptyTitle, { color: theme.colors.text }]}>No subtasks yet</Text>
                        <Text style={[st.emptySubtitle, { color: theme.colors.textSecondary }]}>Break this task into smaller steps</Text>
                      </View>
                    ) : (
                      (task.subtasks as Subtask[]).map((sub) => {
                        const sp = (sub as any).priority ? PRIORITY_META[(sub as any).priority] : null;
                        const stk = (sub as any).tagType?.toLowerCase() || 'personal';
                        const sc = TAG_META[stk] || TAG_META.personal;
                        return (
                          <TouchableOpacity key={sub.id} activeOpacity={0.72} onPress={() => { Haptics.selectionAsync(); setSelectedSubtaskId(sub.id); }} style={[st.subtaskRow, { borderBottomColor: theme.colors.border }]}>
                            <TouchableOpacity style={[st.checkbox, { backgroundColor: sub.done ? theme.colors.primary : 'transparent', borderColor: sub.done ? theme.colors.primary : theme.colors.border }]} onPress={(e) => { e.stopPropagation(); toggleSubtask(sub.id); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              {sub.done && <MaterialIcons name="check" size={11} color="#fff" />}
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={2} style={[st.subtaskLabel, { color: sub.done ? theme.colors.textSecondary : theme.colors.text, textDecorationLine: sub.done ? 'line-through' : 'none', opacity: sub.done ? 0.5 : 1, fontFamily: 'Inter_500Medium' }]}>{sub.text}</Text>
                              {!sub.done && (sp || (sub as any).tag || (sub as any).dueDate) && (
                                <View style={st.metaRow}>
                                  {sp && <View style={[st.miniBadge, { backgroundColor: sp.bg }]}><MaterialIcons name="flag" size={9} color={sp.color} /><Text style={[st.miniBadgeTxt, { color: sp.color }]}>{sp.label}</Text></View>}
                                  {(sub as any).tag && <View style={[st.miniBadge, { backgroundColor: sc.bg }]}><View style={[st.tagDot, { backgroundColor: sc.text, width: 4, height: 4 }]} /><Text style={[st.miniBadgeTxt, { color: sc.text }]}>{(sub as any).tag}</Text></View>}
                                  {(sub as any).dueDate && <View style={st.metaChip}><MaterialIcons name="event" size={10} color={theme.colors.textSecondary} /><Text style={[st.metaChipTxt, { color: theme.colors.textSecondary }]}>{(sub as any).dueDate}</Text></View>}
                                  <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto' }}>
                                    {((sub as any).subtasks?.length ?? 0) > 0 && <View style={st.metaChip}><MaterialIcons name="checklist" size={10} color={theme.colors.textSecondary} /><Text style={[st.metaChipTxt, { color: theme.colors.textSecondary }]}>{(sub as any).subtasks.length}</Text></View>}
                                    {((sub as any).attachments?.length ?? 0) > 0 && <MaterialIcons name="attach-file" size={10} color={theme.colors.textSecondary} />}
                                  </View>
                                </View>
                              )}
                            </View>
                            <MaterialIcons name="chevron-right" size={16} color={theme.colors.border} />
                          </TouchableOpacity>
                        );
                      })
                    )}
                    <View style={{ paddingTop: 14, paddingHorizontal: 16 }}>
                      <TouchableOpacity style={[st.addBtn, { borderColor: `${theme.colors.primary}55` }]} onPress={() => setComposerVisible(true)} activeOpacity={0.75}>
                        <View style={[st.addBtnIcon, { backgroundColor: `${theme.colors.primary}15` }]}><MaterialIcons name="add" size={16} color={theme.colors.primary} /></View>
                        <Text style={[st.addBtnTxt, { color: theme.colors.primary }]}>Add subtask</Text>
                      </TouchableOpacity>
                    </View>
                  </BottomSheetScrollView>
                )}

                {activeTab === 'comments' && (
                  <View style={{ flex: 1 }}>
                    <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 20) + 80 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      {(task.commentsList?.length ?? 0) > 0 ? (
                        <View style={{ gap: 12 }}>
                          {(task.commentsList as any[]).map((c: any) => (
                            <View key={c.id} style={st.commentRow}>
                              <View style={[st.avatar, { backgroundColor: theme.colors.primary }]}><Text style={st.avatarTxt}>S</Text></View>
                              <View style={{ flex: 1 }}>
                                <View style={[st.bubble, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
                                  <Text style={[st.commentMeta, { color: theme.colors.textSecondary }]}>Shubham · {c.date}</Text>
                                  {!!c.text && <Text style={[st.commentTxt, { color: theme.colors.text }]}>{c.text}</Text>}
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={st.emptyState}>
                          <View style={[st.emptyIcon, { backgroundColor: `${theme.colors.primary}12` }]}><MaterialIcons name="chat-bubble-outline" size={30} color={theme.colors.primary} /></View>
                          <Text style={[st.emptyTitle, { color: theme.colors.text }]}>No comments yet</Text>
                          <Text style={[st.emptySubtitle, { color: theme.colors.textSecondary }]}>Start the conversation below</Text>
                        </View>
                      )}

                      {commentAtt && (
                        <View style={[st.attPreview, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border, marginTop: 12 }]}>
                          {commentAtt.type === 'image'
                            ? <Image source={{ uri: commentAtt.uri }} style={st.attPreviewImg} resizeMode="cover" />
                            : <MaterialIcons name="insert-drive-file" size={20} color={theme.colors.primary} />
                          }
                          <Text style={[st.attPreviewName, { color: theme.colors.text }]} numberOfLines={1}>{commentAtt.name}</Text>
                          <TouchableOpacity onPress={() => setCommentAtt(null)}>
                            <MaterialIcons name="close" size={16} color={theme.colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </BottomSheetScrollView>
                  </View>
                )}

                {activeTab === 'attachments' && (
                  <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
                    {/* Your existing Attachments map */}
                    {(task.attachments?.length ?? 0) > 0 ? (
                      <View style={{ gap: 16 }}>
                        <Text style={[st.sectionLabel, { color: theme.colors.textSecondary }]}>TASK ATTACHMENTS ({task.attachments?.length})</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                          {task.attachments!.map((att: any) => (
                            <TouchableOpacity key={att.id} style={[st.attCard, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border, width: (SW - 44) / 2 }]} activeOpacity={0.8}>
                              {att.type === 'image'
                                ? <Image source={{ uri: att.uri }} style={st.attImg} resizeMode="cover" />
                                : <View style={[st.attIconBox, { backgroundColor: `${theme.colors.primary}15` }]}><MaterialIcons name={att.type === 'link' ? 'link' : 'description'} size={28} color={theme.colors.primary} /></View>
                              }
                              <View style={{ padding: 8, borderTopWidth: 1, borderColor: theme.colors.border }}>
                                <Text style={[st.attName, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>{att.name}</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View style={st.emptyState}>
                        <View style={[st.emptyIcon, { backgroundColor: `${theme.colors.primary}12` }]}><MaterialIcons name="attachment" size={30} color={theme.colors.primary} /></View>
                        <Text style={[st.emptyTitle, { color: theme.colors.text }]}>No attachments</Text>
                        <Text style={[st.emptySubtitle, { color: theme.colors.textSecondary }]}>No files attached to this task</Text>
                      </View>
                    )}
                  </BottomSheetScrollView>
                )}
              </View>

            </BottomSheetView>
          </BottomSheet>
        </GestureHandlerRootView>
      </Modal>

      <AndroidSheet visible={showActionMenu} title="TASK OPTIONS" items={actionItems} onClose={() => setShowActionMenu(false)} theme={theme} />

      {/* History modal */}
      <Modal visible={showHistoryModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowHistoryModal(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.cardPrimary }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
            <Text style={{ fontSize: 18, color: theme.colors.text, fontFamily: 'Inter_700Bold' }}>Task History</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)} style={{ padding: 4 }}>
              <MaterialIcons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
            <Text style={[st.historyNote, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>All changes to this task are recorded below.</Text>
            {versionHistory.map((entry, i) => <VersionItem key={entry.id} entry={entry} isLast={i === versionHistory.length - 1} theme={theme} />)}
          </ScrollView>
        </View>
      </Modal>

      <TaskDetailModal visible={!!selectedSubtaskId} taskId={selectedSubtaskId!} onClose={() => setSelectedSubtaskId(null)} />

      <TaskComposer
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
        initialTitle=""
        onSave={(taskData: any) => {
          const newChild: any = { ...taskData, id: `c_${Date.now()}`, text: taskData.title, done: false };
          updateTask(task.id, (t: any) => ({ ...t, subtasks: [...(t.subtasks ?? []), newChild] }));
          setTimeout(() => subtaskListRef.current?.scrollToEnd?.({ animated: true }), 100);
        }}
      />

      <TaskComposer
        visible={editComposerVisible}
        onClose={() => setEditComposerVisible(false)}
        initialTitle={task.title}
        initialDescription={task.description}
        editMode={true}
        onSave={(taskData: any) => {
          updateTask(task.id, (t: any) => ({
            ...t,
            title: taskData.title,
            description: taskData.description,
          }));
          setEditComposerVisible(false);
        }}
      />
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  sheetContainer: { flex: 1, flexDirection: 'column' },
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  toolBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 30, marginBottom: 10, letterSpacing: -0.4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: '#f1f5f9' },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  dateTxt: { fontSize: 13, fontWeight: '500' },
  progressWrap: { marginBottom: 12 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: '500' },
  progressPct: { fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  divider: { height: StyleSheet.hairlineWidth },
  tabBar: { flexDirection: 'row', paddingVertical: 10, gap: 6 },
  tabPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
  tabTxt: { fontSize: 12, fontWeight: '600' },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  subtaskLabel: { fontSize: 15, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  miniBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  miniBadgeTxt: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaChipTxt: { fontSize: 11, fontWeight: '500' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12 },
  addBtnIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addBtnTxt: { fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, opacity: 0.6, textAlign: 'center' },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  bubble: { flex: 1, padding: 12, borderRadius: 16, borderTopLeftRadius: 4, borderWidth: 1 },
  commentMeta: { fontSize: 11, marginBottom: 5, fontWeight: '600' },
  commentTxt: { fontSize: 14, lineHeight: 20 },

  // NOTE: paddingBottom is intentionally removed here, we apply it dynamically in the component!
  commentBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth },

  attachBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  commentInput: { flex: 1, fontSize: 14, paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 9 : 7, paddingBottom: Platform.OS === 'ios' ? 9 : 7, borderRadius: 20, minHeight: 38, maxHeight: 110, marginBottom: 3 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  attPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, borderWidth: 1 },
  attPreviewImg: { width: 36, height: 36, borderRadius: 6 },
  attPreviewName: { flex: 1, fontSize: 12 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8 },
  attCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  attIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', margin: 12 },
  attImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  attName: { fontSize: 12, lineHeight: 16 },
  historyNote: { fontSize: 13, lineHeight: 20, marginBottom: 20 },
});

export default TaskDetailModal;
