import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Modal, StyleSheet, TouchableOpacity, Pressable, View, Text,
  Platform, KeyboardAvoidingView, Image, TextInput,
  Alert, Dimensions, ScrollView, Keyboard, Linking,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetFooter,
} from '@gorhom/bottom-sheet';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
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
        <View style={vm.diffCol}>
          <View style={[vm.pill, { backgroundColor: '#FEF2F2' }]}>
            <Text style={[vm.diffTxt, { color: '#EF4444' }]}>− {entry.from}</Text>
          </View>
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
  diffCol: { flexDirection: 'column', alignItems: 'flex-start', gap: 4, marginBottom: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  diffTxt: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 18 },
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

const getFileCategoryInfo = (fileName: string, mimeType?: string, theme?: any) => {
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() || 'FILE' : 'FILE';

  if (['PDF'].includes(ext) || mimeType === 'application/pdf') {
    return { ext, bg: '#FEF2F2', border: '#FCA5A5', text: '#EF4444', icon: 'picture-as-pdf', label: 'PDF Document' };
  }
  if (['DOC', 'DOCX', 'TXT', 'RTF', 'PAGES', 'MD'].includes(ext) || mimeType?.includes('word') || mimeType?.includes('text')) {
    return { ext, bg: '#EFF6FF', border: '#93C5FD', text: '#3B82F6', icon: 'description', label: 'Word Document' };
  }
  if (['XLS', 'XLSX', 'CSV', 'NUMBERS'].includes(ext) || mimeType?.includes('sheet') || mimeType?.includes('csv')) {
    return { ext, bg: '#F0FDF4', border: '#86EFAC', text: '#10B981', icon: 'table-chart', label: 'Spreadsheet' };
  }
  if (['PPT', 'PPTX', 'KEY'].includes(ext) || mimeType?.includes('presentation')) {
    return { ext, bg: '#FFF7ED', border: '#FDBA74', text: '#F97316', icon: 'slideshow', label: 'Presentation' };
  }
  if (['ZIP', 'RAR', 'TAR', '7Z', 'GZ'].includes(ext) || mimeType?.includes('zip')) {
    return { ext, bg: '#FEF3C7', border: '#FCD34D', text: '#D97706', icon: 'folder-zip', label: 'Archive' };
  }
  if (['MP3', 'WAV', 'M4A', 'FLAC', 'AAC', 'OGG'].includes(ext) || mimeType?.startsWith('audio/')) {
    return { ext, bg: '#F5F3FF', border: '#C4B5FD', text: '#8B5CF6', icon: 'audiotrack', label: 'Audio' };
  }
  if (['MP4', 'MOV', 'AVI', 'MKV', 'WEBM'].includes(ext) || mimeType?.startsWith('video/')) {
    return { ext, bg: '#FFF1F2', border: '#FDA4AF', text: '#F43F5E', icon: 'movie', label: 'Video' };
  }
  if (['JS', 'TS', 'TSX', 'JSX', 'HTML', 'CSS', 'JSON', 'PY', 'JAVA', 'CPP', 'C', 'PHP'].includes(ext)) {
    return { ext, bg: '#EEF2FF', border: '#A5B4FC', text: '#6366F1', icon: 'code', label: 'Code File' };
  }
  return {
    ext,
    bg: theme ? `${theme.colors.primary}15` : '#F1F5F9',
    border: theme ? `${theme.colors.primary}30` : '#CBD5E1',
    text: theme ? theme.colors.primary : '#64748B',
    icon: 'insert-drive-file',
    label: 'Document',
  };
};

const DocumentIcon = ({ fileName, mimeType, theme, size = 44, variant = 'list' }: { fileName: string; mimeType?: string; theme: any; size?: number; variant?: 'list' | 'grid' }) => {
  const info = getFileCategoryInfo(fileName, mimeType, theme);

  if (variant === 'grid') {
    return (
      <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: info.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: info.border, position: 'relative' }}>
        <MaterialIcons name={info.icon as any} size={28} color={info.text} />
        <View style={{ position: 'absolute', bottom: -5, backgroundColor: info.text, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
          <Text style={{ color: '#ffffff', fontSize: 8, fontFamily: 'Inter_700Bold' }} numberOfLines={1}>
            {info.ext.slice(0, 4)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: info.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: info.border }}>
      <MaterialIcons name={info.icon as any} size={size * 0.46} color={info.text} />
      <Text style={{ color: info.text, fontSize: 8.5, fontFamily: 'Inter_700Bold', marginTop: 1 }} numberOfLines={1}>
        {info.ext.slice(0, 4)}
      </Text>
    </View>
  );
};

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatCommentDate = (c: any) => {
  if (c.timestamp) {
    const diff = Math.floor((Date.now() - c.timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const d = new Date(c.timestamp);
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return c.date || 'Just now';
};

// ─── Comment Input Bar ──────────────────────────────────────────────────────────
// Rendered inside BottomSheetFooter: always sticky at the bottom of the BottomSheet,
// elevates automatically above keyboard via Gorhom's native reanimated keyboard tracking.
const CommentInputBar = React.memo(({ theme, onSend, onTextChange, onFocus }: any) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(text);
    setText('');
    onTextChange('');
  };

  return (
    <View style={[
      st.commentBar,
      {
        backgroundColor: theme.colors.cardPrimary,
        borderTopColor: theme.colors.border,
        paddingVertical: 10,
        paddingHorizontal: 16,
      }
    ]}>
      <View style={[
        st.commentInputWrap,
        {
          backgroundColor: theme.colors.secondary,
          borderColor: theme.colors.border,
        }
      ]}>
        <MaterialIcons
          name="chat-bubble-outline"
          size={18}
          color={theme.colors.textSecondary}
          style={{ marginLeft: 12, marginRight: 2 }}
        />
        <BottomSheetTextInput
          style={[st.commentInput, { color: theme.colors.text }]}
          placeholder="Add a comment or note…"
          placeholderTextColor={theme.colors.textSecondary}
          value={text}
          onChangeText={(val) => { setText(val); onTextChange(val); }}
          onFocus={onFocus}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity
          style={[
            st.sendBtn,
            {
              backgroundColor: text.trim() ? theme.colors.primary : `${theme.colors.primary}20`,
            }
          ]}
          onPress={handleSend}
          disabled={!text.trim()}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="arrow-upward"
            size={18}
            color={text.trim() ? '#ffffff' : theme.colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});
CommentInputBar.displayName = 'CommentInputBar';


// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatHistoryDate = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  if (days === 1) return 'Yesterday';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

interface DraggableSubtaskRowProps {
  item: Subtask;
  index: number;
  isDragging: boolean;
  isHovered: boolean;
  theme: any;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDragStart: (index: number) => void;
  onDragUpdate: (index: number, translationY: number, absoluteY?: number) => void;
  onDragEnd: (index: number) => void;
}

const DraggableSubtaskRow = React.memo(function DraggableSubtaskRow({
  item,
  index,
  isDragging,
  isHovered,
  theme,
  onToggle,
  onDelete,
  onEdit,
  onDragStart,
  onDragUpdate,
  onDragEnd,
}: DraggableSubtaskRowProps) {
  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetY([-2, 2])
      .failOffsetX([-30, 30])
      .shouldCancelWhenOutside(false)
      .hitSlop({ top: 16, bottom: 16, left: 16, right: 24 })
      .onStart(() => {
        'worklet';
        runOnJS(onDragStart)(index);
      })
      .onUpdate((e) => {
        'worklet';
        runOnJS(onDragUpdate)(index, e.translationY, e.absoluteY);
      })
      .onEnd(() => {
        'worklet';
        runOnJS(onDragEnd)(index);
      })
      .onFinalize(() => {
        'worklet';
        runOnJS(onDragEnd)(index);
      });
  }, [index, onDragStart, onDragUpdate, onDragEnd]);

  return (
    <View
      style={[
        st.checklistRow,
        isDragging && [
          st.checklistRowDragging,
          {
            backgroundColor: `${theme.colors.primary}20`,
            borderRadius: 8,
            elevation: 4,
            transform: [{ scale: 1.01 }],
          },
        ],
        isHovered && !isDragging && {
          backgroundColor: `${theme.colors.primary}12`,
          borderRadius: 8,
        },
      ]}
    >
      {/* 6-dots Drag Handle */}
      <GestureDetector gesture={panGesture}>
        <View style={st.dragHandle}>
          <MaterialIcons
            name="drag-indicator"
            size={20}
            color={isDragging ? theme.colors.primary : theme.colors.textSecondary}
            style={{ opacity: isDragging ? 1 : 0.55 }}
          />
        </View>
      </GestureDetector>

      {/* Square Checkbox [ ] */}
      <TouchableOpacity
        style={[st.keepCheckbox, { borderColor: theme.colors.textSecondary }]}
        onPress={() => onToggle(item.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      />

      {/* Editable Text — tapping opens composer in edit mode */}
      <TouchableOpacity
        style={st.checklistTextWrap}
        onPress={() => onEdit(item.id, item.text)}
        activeOpacity={0.7}
      >
        <Text
          style={[st.checklistText, { color: theme.colors.text }]}
          numberOfLines={0}
        >
          {item.text || <Text style={{ color: theme.colors.textSecondary }}>Add subtask</Text>}
        </Text>
      </TouchableOpacity>

      {/* Delete Button ✕ */}
      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={st.checklistDeleteBtn}
        activeOpacity={0.7}
      >
        <MaterialIcons name="close" size={18} color={theme.colors.textSecondary} style={{ opacity: 0.6 }} />
      </TouchableOpacity>
    </View>
  );
});
// ─── Subtask Quick Composer Modal ─────────────────────────────────────────────
interface SubtaskComposerModalProps {
  visible: boolean;
  onClose: () => void;
  onAddSubtask: (title: string) => void;
  editingItem?: { id: string; text: string } | null;
  onEditSubtask?: (id: string, text: string) => void;
}

const SubtaskComposerModal = ({
  visible,
  onClose,
  onAddSubtask,
  editingItem,
  onEditSubtask,
}: SubtaskComposerModalProps) => {
  const isEditMode = !!editingItem;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setText(isEditMode ? editingItem!.text : '');
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [visible, editingItem]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isEditMode) {
      onEditSubtask?.(editingItem!.id, trimmed);
    } else {
      onAddSubtask(trimmed);
    }
    setText('');
    onClose();
  };

  const handleAddAndKeepOpen = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddSubtask(trimmed);
    setText('');
    inputRef.current?.focus();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[subComposerStyles.flex, { paddingBottom: keyboardHeight }]}>
        <Pressable style={subComposerStyles.backdrop} onPress={onClose} />

        <View
          style={[
            subComposerStyles.sheet,
            {
              backgroundColor: theme.colors.cardPrimary,
              borderTopColor: theme.colors.border,
              paddingBottom: Math.max(insets.bottom, 16) + 6,
            },
          ]}
        >
          {/* Header */}
          <View style={subComposerStyles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="checklist" size={18} color={theme.colors.primary} />
              <Text style={[subComposerStyles.headerTitle, { color: theme.colors.text }]}>
                {isEditMode ? 'Edit Subtask' : 'New Subtask'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={subComposerStyles.closeBtn}
            >
              <MaterialIcons name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Subtask Input */}
          <View style={subComposerStyles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={[
                subComposerStyles.input,
                { color: theme.colors.text, fontFamily: 'Inter_500Medium' },
              ]}
              placeholder="What needs to be done?"
              placeholderTextColor={theme.colors.textSecondary}
              value={text}
              onChangeText={setText}
              returnKeyType="next"
              onSubmitEditing={handleAddAndKeepOpen}
              blurOnSubmit={false}
              autoFocus
            />
          </View>

          {/* Action Bar */}
          <View style={[subComposerStyles.actionBar, { borderTopColor: theme.colors.border }]}>
            {!isEditMode && (
              <TouchableOpacity
                style={[
                  subComposerStyles.addMoreBtn,
                  { backgroundColor: text.trim() ? `${theme.colors.primary}15` : 'transparent' },
                ]}
                onPress={handleAddAndKeepOpen}
                disabled={!text.trim()}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="add"
                  size={16}
                  color={text.trim() ? theme.colors.primary : theme.colors.textSecondary}
                  style={{ opacity: text.trim() ? 1 : 0.4 }}
                />
                <Text
                  style={[
                    subComposerStyles.addMoreTxt,
                    {
                      color: text.trim() ? theme.colors.primary : theme.colors.textSecondary,
                      opacity: text.trim() ? 1 : 0.4,
                    },
                  ]}
                >
                  Add &amp; next
                </Text>
              </TouchableOpacity>
            )}
            {isEditMode && <View style={{ flex: 1 }} />}

            <TouchableOpacity
              style={[
                subComposerStyles.confirmBtn,
                {
                  backgroundColor: text.trim() ? theme.colors.primary : `${theme.colors.primary}50`,
                },
              ]}
              onPress={handleAdd}
              disabled={!text.trim()}
              activeOpacity={0.8}
            >
              <Text style={subComposerStyles.confirmTxt}>{isEditMode ? 'Save' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const TaskDetailModal = ({ visible, taskId, onClose }: TaskDetailModalProps) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { taskGroups, updateTask, deleteTask, handleComposerSave, addHistoryEvent, taskHistory } = useDashboard();

  // Replaced `newComment` state with a Ref to prevent re-renders when typing
  const unsavedTextRef = useRef('');

  const [activeTab, setActiveTab] = useState<Tab>('subtasks');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [editComposerVisible, setEditComposerVisible] = useState(false);
  const [subtaskComposerVisible, setSubtaskComposerVisible] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<{ id: string; text: string } | null>(null);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [attachmentToRename, setAttachmentToRename] = useState<any | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [attFilter, setAttFilter] = useState<'all' | 'image' | 'document'>('all');
  const [attViewMode, setAttViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAttForMenu, setSelectedAttForMenu] = useState<any | null>(null);
  const [selectedCommentForMenu, setSelectedCommentForMenu] = useState<any | null>(null);
  const [lightboxAttachment, setLightboxAttachment] = useState<any | null>(null);
  const [showUploadDropdown, setShowUploadDropdown] = useState(false);

  // Subtask Checklist states & refs
  const [isAccordionCollapsed, setIsAccordionCollapsed] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const hoverIdxRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const dragStartScrollYRef = useRef(0);
  const dragIndexRef = useRef<number | null>(null);
  const lastTranslationYRef = useRef(0);
  const autoScrollTimerRef = useRef<any>(null);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const subtaskListRef = useRef<any>(null);
  const commentsScrollRef = useRef<any>(null);

  // Stable bottom inset: ensures the input bar never touches the Android 3-button navigation bar or home indicator
  const bottomInset = useMemo(
    () => Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 12) + 4,
    [insets.bottom]
  );

  const snapPoints = useMemo(() => ['70%', '80%', '90%', '100%'], []);

  const dismiss = useCallback(() => {
    unsavedTextRef.current = '';
    setShowUploadDropdown(false);
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
  const { topDone, topTotal, nestedDone, nestedTotal } = useMemo(() => {
    let td = 0; let tt = 0; let nd = 0; let nt = 0;
    if (task?.subtasks) {
      tt = task.subtasks.length;
      task.subtasks.forEach((s: any) => {
        if (s.done) td++;
        const children = s.subtasks || s.children;
        if (children && children.length > 0) {
          nt += children.length;
          nd += children.filter((ns: any) => ns.done).length;
        }
      });
    }
    return { topDone: td, topTotal: tt, nestedDone: nd, nestedTotal: nt };
  }, [task?.subtasks]);

  const overallTotal = topTotal + nestedTotal;
  const overallDone = topDone + nestedDone;
  const progress = overallTotal > 0 ? overallDone / overallTotal : 0;

  // Split into unchecked and checked subtasks
  const uncheckedSubs = useMemo(() => ((task?.subtasks as Subtask[]) || []).filter(s => !s.done), [task?.subtasks]);
  const checkedSubs = useMemo(() => ((task?.subtasks as Subtask[]) || []).filter(s => s.done), [task?.subtasks]);

  // Toggle item checked state (checking moves down to accordion, unchecking moves back up)
  const handleToggleSubtask = (id: string) => {
    if (!task) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const allSubs = (task.subtasks as Subtask[]) || [];
    const target = allSubs.find(s => s.id === id);
    if (!target) return;

    const newDone = !target.done;
    const otherSubs = allSubs.filter(s => s.id !== id);
    const updatedTarget = { ...target, done: newDone, completed: newDone };

    let nextSubs: Subtask[];
    if (newDone) {
      // Moved to bottom (checked list)
      nextSubs = [...otherSubs, updatedTarget];
    } else {
      // Moved back to active list (at the end of unchecked items)
      const unchecks = otherSubs.filter(s => !s.done);
      const checks = otherSubs.filter(s => s.done);
      nextSubs = [...unchecks, updatedTarget, ...checks];
    }

    updateTask(task.id, (t: any) => ({ ...t, subtasks: nextSubs }));
    addHistoryEvent(task.id, {
      action: newDone
        ? `Marked subtask as done: "${target.text || ''}"`
        : `Unmarked subtask as done: "${target.text || ''}"`,
      icon: newDone ? 'check-circle' : 'radio-button-unchecked',
    });
  };


  // Delete a subtask item
  const handleDeleteSubtaskItem = (id: string) => {
    if (!task) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const allSubs = (task.subtasks as Subtask[]) || [];
    const target = allSubs.find(s => s.id === id);
    const nextSubs = allSubs.filter(s => s.id !== id);
    updateTask(task.id, (t: any) => ({ ...t, subtasks: nextSubs }));
    addHistoryEvent(task.id, { action: `Deleted subtask: "${target?.text || ''}"`, icon: 'delete-outline' });
  };

  // Add new subtask from composer popup or inline
  const handleAddNewSubtask = (title: string) => {
    if (!task || !title.trim()) return;
    const newId = `st_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newSub: Subtask = { id: newId, text: title.trim(), title: title.trim(), done: false };

    const currentSubs = (task.subtasks as Subtask[]) || [];
    const unchecks = currentSubs.filter(s => !s.done);
    const checks = currentSubs.filter(s => s.done);
    const nextSubs = [...unchecks, newSub, ...checks];

    updateTask(task.id, (t: any) => ({ ...t, subtasks: nextSubs }));
    addHistoryEvent(task.id, { action: `Added subtask: "${title.trim()}"`, icon: 'add-circle' });
    setTimeout(() => {
      subtaskListRef.current?.scrollToEnd?.({ animated: true });
    }, 100);
  };

  // Open composer in edit mode for an existing subtask
  const handleEditSubtask = useCallback((id: string, text: string) => {
    setEditingSubtask({ id, text });
    setSubtaskComposerVisible(true);
  }, []);

  // Save edited subtask text
  const handleSaveEditedSubtask = useCallback((id: string, newText: string) => {
    if (!task || !newText.trim()) return;
    updateTask(task.id, (t: any) => ({
      ...t,
      subtasks: (t.subtasks || []).map((s: Subtask) =>
        s.id === id ? { ...s, text: newText.trim(), title: newText.trim() } : s
      ),
    }));
    addHistoryEvent(task.id, { action: `Edited subtask: "${newText.trim()}"`, icon: 'edit' });
    setEditingSubtask(null);
  }, [task, updateTask, addHistoryEvent]);

  // Add a new unchecked item (opens clean composer popup)
  const handleAddSubtaskItem = () => {
    setEditingSubtask(null);
    setSubtaskComposerVisible(true);
  };

  // Auto-scrolling and Drag Reordering Handlers for unchecked items
  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);

  const updateHoverTarget = useCallback((idx: number, transY: number) => {
    const effectiveTransY = transY + (scrollOffsetRef.current - dragStartScrollYRef.current);
    const estimatedRowHeight = 40;
    const diff = Math.round(effectiveTransY / estimatedRowHeight);
    const target = Math.max(0, Math.min(uncheckedSubs.length - 1, idx + diff));
    if (target !== hoverIdxRef.current) {
      hoverIdxRef.current = target;
      setHoverIdx(target);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [uncheckedSubs.length]);

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
    dragStartScrollYRef.current = scrollOffsetRef.current;
    lastTranslationYRef.current = 0;
    setDraggingIdx(index);
    setHoverIdx(index);
    hoverIdxRef.current = index;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleDragUpdate = useCallback((index: number, translationY: number, absoluteY?: number) => {
    lastTranslationYRef.current = translationY;
    updateHoverTarget(index, translationY);

    const screenHeight = Dimensions.get('window').height;
    const topThreshold = insets.top + 240;
    const bottomThreshold = screenHeight - Math.max(insets.bottom, 20) - 120;

    if (absoluteY !== undefined) {
      if (absoluteY < topThreshold && scrollOffsetRef.current > 0) {
        if (!autoScrollTimerRef.current) {
          autoScrollTimerRef.current = setInterval(() => {
            const currentScroll = scrollOffsetRef.current;
            const newY = Math.max(0, currentScroll - 16);
            subtaskListRef.current?.scrollTo({ y: newY, animated: false });
            scrollOffsetRef.current = newY;
            if (dragIndexRef.current !== null) {
              updateHoverTarget(dragIndexRef.current, lastTranslationYRef.current);
            }
            if (newY <= 0) {
              stopAutoScroll();
            }
          }, 20);
        }
      } else if (absoluteY > bottomThreshold) {
        if (!autoScrollTimerRef.current) {
          autoScrollTimerRef.current = setInterval(() => {
            const currentScroll = scrollOffsetRef.current;
            const newY = currentScroll + 16;
            subtaskListRef.current?.scrollTo({ y: newY, animated: false });
            scrollOffsetRef.current = newY;
            if (dragIndexRef.current !== null) {
              updateHoverTarget(dragIndexRef.current, lastTranslationYRef.current);
            }
          }, 20);
        }
      } else {
        stopAutoScroll();
      }
    }
  }, [insets.top, insets.bottom, updateHoverTarget, stopAutoScroll]);

  const handleDragEnd = useCallback((index: number) => {
    stopAutoScroll();
    const finalTarget = hoverIdxRef.current;
    if (finalTarget !== null && finalTarget !== index && index >= 0 && index < uncheckedSubs.length && task) {
      const reordered = [...uncheckedSubs];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(finalTarget, 0, moved);
      const next = [...reordered, ...checkedSubs];
      updateTask(task.id, (t: any) => ({ ...t, subtasks: next }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setDraggingIdx(null);
    setHoverIdx(null);
    hoverIdxRef.current = null;
    dragIndexRef.current = null;
  }, [uncheckedSubs, checkedSubs, task, updateTask, stopAutoScroll]);

  const switchTab = (tab: Tab) => {
    Haptics.selectionAsync();
    setShowUploadDropdown(false);
    setActiveTab(tab);
  };

  const handleOpenAtt = async (att: any) => {
    try {
      if (Platform.OS === 'android') {
        let contentUri = att.uri;
        if (contentUri.startsWith('file://')) {
          contentUri = await FileSystem.getContentUriAsync(contentUri);
        }
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1,
            type: att.mimeType || '*/*'
          });
        } catch (innerErr) {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(contentUri);
          } else {
            throw innerErr;
          }
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(att.uri, { UTI: att.mimeType });
        } else {
          await Linking.openURL(att.uri);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open file');
    }
  };

  // Add comment directly from the isolated component (no attachments)
  const handleAddComment = useCallback((text: string) => {
    if (!task || !text.trim()) return;
    Haptics.selectionAsync();
    const newComment = {
      id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      text: text.trim(),
      date: 'Just now',
      timestamp: Date.now(),
      author: 'Shubham',
    };
    updateTask(task.id, (t: any) => ({
      ...t,
      commentsList: [...(t.commentsList ?? []), newComment],
    }));
    addHistoryEvent(task.id, { action: 'Added a comment', icon: 'chat-bubble-outline' });
    setTimeout(() => {
      commentsScrollRef.current?.scrollToEnd?.({ animated: true });
    }, 150);
  }, [task, updateTask, addHistoryEvent]);

  const handleDeleteComment = useCallback((comment: any) => {
    if (!task || !comment) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSelectedCommentForMenu(null);
          updateTask(task.id, (t: any) => ({
            ...t,
            commentsList: (t.commentsList ?? []).filter((c: any) => c.id !== comment.id),
          }));
          addHistoryEvent(task.id, { action: 'Deleted a comment', icon: 'delete-outline' });
        },
      },
    ]);
  }, [task, updateTask, addHistoryEvent]);

  const handleCopyComment = useCallback(async (text: string) => {
    if (!text) return;
    setSelectedCommentForMenu(null);
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied ✓', 'Comment copied to clipboard.');
  }, []);

  // Sticky bottom footer for the Comments tab
  const renderFooter = useCallback(
    (props: any) => {
      if (activeTab !== 'comments') return null;
      return (
        <BottomSheetFooter {...props} bottomInset={bottomInset}>
          <CommentInputBar
            theme={theme}
            onSend={handleAddComment}
            onTextChange={(val: string) => { unsavedTextRef.current = val; }}
            onFocus={() => {
              setTimeout(() => commentsScrollRef.current?.scrollToEnd?.({ animated: true }), 200);
            }}
          />
        </BottomSheetFooter>
      );
    },
    [activeTab, theme, bottomInset, handleAddComment]
  );

  // Attachment statistics & helpers
  const attachmentStats = useMemo(() => {
    const atts = task?.attachments || [];
    const totalSize = atts.reduce((acc: number, a: any) => acc + (a.size || 0), 0);
    const imageCount = atts.filter((a: any) => a.type === 'image').length;
    const docCount = atts.length - imageCount;
    return {
      total: atts.length,
      totalSizeFormatted: formatBytes(totalSize),
      imageCount,
      docCount,
    };
  }, [task?.attachments]);

  const filteredAttachments = useMemo(() => {
    const atts = task?.attachments || [];
    if (attFilter === 'image') return atts.filter((a: any) => a.type === 'image');
    if (attFilter === 'document') return atts.filter((a: any) => a.type !== 'image');
    return atts;
  }, [task?.attachments, attFilter]);

  const handleAddFromCamera = useCallback(async () => {
    if (!task) return;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is required to take photos.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets?.[0]) {
        const a = res.assets[0];
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = a.fileName || `Photo_${dateStr}_${Math.floor(Math.random() * 1000)}.jpg`;
        const newAtt = {
          id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          uri: a.uri,
          name: fileName,
          type: 'image',
          size: a.fileSize || 0,
          mimeType: a.mimeType || 'image/jpeg',
          createdAt: Date.now(),
        };
        updateTask(task.id, (t: any) => ({
          ...t,
          attachments: [...(t.attachments ?? []), newAtt],
        }));
        addHistoryEvent(task.id, { action: `Captured photo: "${fileName}"`, icon: 'camera-alt' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Could not open camera.');
    }
  }, [task, updateTask, addHistoryEvent]);

  const handleAddFromLibrary = useCallback(async () => {
    if (!task) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: 10,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newAtts = res.assets.map((a, idx) => ({
          id: `att_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          uri: a.uri,
          name: a.fileName || `Image_${idx + 1}_${Date.now().toString().slice(-4)}.jpg`,
          type: 'image',
          size: a.fileSize || 0,
          mimeType: a.mimeType || 'image/jpeg',
          createdAt: Date.now(),
        }));
        updateTask(task.id, (t: any) => ({
          ...t,
          attachments: [...(t.attachments ?? []), ...newAtts],
        }));
        addHistoryEvent(task.id, {
          action: newAtts.length === 1 ? `Attached image: "${newAtts[0].name}"` : `Attached ${newAtts.length} images`,
          icon: 'photo-library',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Could not open photo library.');
    }
  }, [task, updateTask, addHistoryEvent]);

  const handleAddFromFiles = useCallback(async () => {
    if (!task) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newAtts = res.assets.map((a, idx) => {
          const isImg = a.mimeType?.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|bmp|svg)$/i.test(a.name);
          return {
            id: `att_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
            uri: a.uri,
            name: a.name || 'File',
            type: isImg ? 'image' : 'document',
            size: a.size || 0,
            mimeType: a.mimeType,
            createdAt: Date.now(),
          };
        });
        updateTask(task.id, (t: any) => ({
          ...t,
          attachments: [...(t.attachments ?? []), ...newAtts],
        }));
        addHistoryEvent(task.id, {
          action: newAtts.length === 1 ? `Attached file: "${newAtts[0].name}"` : `Attached ${newAtts.length} files`,
          icon: 'attach-file',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Could not pick document.');
    }
  }, [task, updateTask, addHistoryEvent]);

  const handleShareAtt = useCallback(async (att: any) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(att.uri, { UTI: att.mimeType, dialogTitle: `Share ${att.name}` });
      } else {
        await Linking.openURL(att.uri);
      }
    } catch {
      Alert.alert('Error', 'Could not share file.');
    }
  }, []);

  const handleDeleteAtt = useCallback((att: any) => {
    if (!task) return;
    Alert.alert('Delete Attachment', `Are you sure you want to delete "${att.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          updateTask(task.id, (t: any) => ({
            ...t,
            attachments: t.attachments?.filter((a: any) => a.id !== att.id),
          }));
          addHistoryEvent(task.id, { action: `Removed attachment: "${att.name}"`, icon: 'delete-outline' });
        },
      },
    ]);
  }, [task, updateTask, addHistoryEvent]);

  const attachmentActionItems: SheetItem[] = useMemo(() => {
    if (!selectedAttForMenu) return [];
    const isImg = selectedAttForMenu.type === 'image';
    return [
      {
        label: isImg ? 'Preview Full Screen' : 'Open Document',
        icon: isImg ? 'fullscreen' : 'open-in-new',
        onPress: () => {
          if (isImg) {
            setLightboxAttachment(selectedAttForMenu);
          } else {
            handleOpenAtt(selectedAttForMenu);
          }
        },
      },
      {
        label: 'Share File',
        icon: 'share',
        onPress: () => handleShareAtt(selectedAttForMenu),
      },
      {
        label: 'Rename Attachment',
        icon: 'edit',
        onPress: () => {
          setAttachmentToRename(selectedAttForMenu);
          setRenameInput(selectedAttForMenu.name);
        },
      },
      {
        label: 'Delete Attachment',
        icon: 'delete-outline',
        destructive: true,
        onPress: () => handleDeleteAtt(selectedAttForMenu),
      },
    ];
  }, [selectedAttForMenu, handleOpenAtt, handleShareAtt, handleDeleteAtt]);

  const commentActionItems: SheetItem[] = useMemo(() => {
    if (!selectedCommentForMenu) return [];
    return [
      {
        label: 'Copy Comment Text',
        icon: 'content-copy',
        onPress: () => {
          if (selectedCommentForMenu.text) {
            handleCopyComment(selectedCommentForMenu.text);
          }
        },
      },
      {
        label: 'Delete Comment',
        icon: 'delete-outline',
        destructive: true,
        onPress: () => {
          handleDeleteComment(selectedCommentForMenu);
        },
      },
    ];
  }, [selectedCommentForMenu, handleCopyComment, handleDeleteComment]);

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
    { label: 'Delete Task', icon: 'delete-outline', destructive: true, onPress: () => Alert.alert('Delete Task', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); deleteTask(task.id); dismiss(); } }]) },
  ];

  const versionHistory: VersionEntry[] = useMemo(() => {
    const events = taskHistory[task?.id ?? ''] ?? [];
    return [...events].reverse().map(e => ({
      id: e.id,
      action: e.action,
      from: e.from,
      to: e.to,
      date: formatHistoryDate(e.timestamp),
      icon: e.icon,
    }));
  }, [taskHistory, task?.id]);


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
            animationConfigs={{ duration: 350, dampingRatio: 0.82, stiffness: 140 }}
            backgroundStyle={{ backgroundColor: theme.colors.cardPrimary }}
            handleIndicatorStyle={{ backgroundColor: theme.colors.border, width: 40, height: 5 }}
            keyboardBehavior="extend"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustPan"
            topInset={insets.top}
            footerComponent={renderFooter}
          >

            {/* Transparent backdrop when dropdown is open */}
            {showUploadDropdown && (
              <Pressable
                style={[StyleSheet.absoluteFillObject, { zIndex: 40 }]}
                onPress={() => setShowUploadDropdown(false)}
              />
            )}

            {/* ════════════ STATIC HEADER — plain View, direct child of BottomSheet ════════════ */}
            <View style={[st.header, { backgroundColor: theme.colors.cardPrimary, zIndex: 50, position: 'relative' }]}>
              {/* 3-dot menu */}
              <View style={st.toolbar}>
                <TouchableOpacity style={st.toolBtn} onPress={() => { Haptics.selectionAsync(); setShowActionMenu(true); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialIcons name="more-vert" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              {/* Title */}
              <Text
                pointerEvents="none"
                style={[
                  st.title,
                  { color: theme.colors.text },
                  task.title.length > 60 && { fontSize: 18, lineHeight: 24 }
                ]}
                numberOfLines={3}
              >
                {task.title}
              </Text>

              {/* Description */}
              {!!task.description && (
                <Text pointerEvents="none" style={[st.desc, { color: theme.colors.textSecondary }]} numberOfLines={4}>
                  {task.description}
                </Text>
              )}

              {/* Badges */}
              <View pointerEvents="none" style={st.badgeRow}>
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

              {/* Due date & time details */}
              {(task.dueDate || task.dueEndDate || task.dueTime || task.dueEndTime) && (
                <View pointerEvents="none" style={st.dateRow}>
                  <MaterialIcons name="event" size={14} color={theme.colors.textSecondary} />
                  <Text style={[st.dateTxt, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                    {(() => {
                      let label = '';
                      if (task.dueDate && task.dueEndDate && task.dueDate !== task.dueEndDate) {
                        label = `${task.dueDate} - ${task.dueEndDate}`;
                      } else if (task.dueDate) {
                        label = task.dueDate;
                      } else if (task.dueEndDate) {
                        label = task.dueEndDate;
                      } else {
                        label = 'No date';
                      }
                      if (task.dueTime) {
                        if (task.dueEndTime) {
                          label += `  ·  ${task.dueTime} - ${task.dueEndTime}`;
                        } else {
                          label += `  ·  ${task.dueTime}`;
                        }
                      } else if (task.dueEndTime) {
                        label += `  ·  ${task.dueEndTime}`;
                      }
                      return label;
                    })()}
                  </Text>
                </View>
              )}

              {/* Progress */}
              {overallTotal > 0 && (
                <View pointerEvents="none" style={st.progressWrap}>
                  <View style={st.progressRow}>
                    <Text style={[st.progressLabel, { color: theme.colors.textSecondary }]}>
                      {overallDone}/{overallTotal} completed{nestedTotal > 0 ? ` (${nestedDone}/${nestedTotal} nested)` : ''}
                    </Text>
                    <Text style={[st.progressPct, { color: theme.colors.primary }]}>{Math.round(progress * 100)}%</Text>
                  </View>
                  <View style={[st.progressTrack, { backgroundColor: `${theme.colors.primary}22`, flexDirection: 'row' }]}>
                    {topDone > 0 && <View style={[st.progressFill, { width: `${(topDone / overallTotal) * 100}%`, backgroundColor: theme.colors.primary }]} />}
                    {nestedDone > 0 && <View style={[st.progressFill, { width: `${(nestedDone / overallTotal) * 100}%`, backgroundColor: '#38BDF8' }]} />}
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
                      onPress={() => {
                        if (tab === 'attachments' && active) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setShowUploadDropdown(prev => !prev);
                        } else {
                          setShowUploadDropdown(false);
                          switchTab(tab);
                        }
                      }}
                      activeOpacity={0.75}
                    >
                      <MaterialIcons name={ICONS[tab] as any} size={13} color={active ? '#fff' : theme.colors.textSecondary} />
                      <Text style={[st.tabTxt, { color: active ? '#fff' : theme.colors.textSecondary, fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
                        {LABELS[tab]}
                      </Text>
                      {tab === 'attachments' && active && (
                        <MaterialIcons name={showUploadDropdown ? "arrow-drop-up" : "arrow-drop-down"} size={16} color="#fff" style={{ marginLeft: -3 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Contextual Dropdown anchored directly under the Attachments button */}
              {showUploadDropdown && activeTab === 'attachments' && (
                <View style={st.dropdownAnchor}>
                  <View style={[st.dropdownMenu, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
                    <TouchableOpacity
                      style={st.dropdownItem}
                      onPress={() => {
                        setShowUploadDropdown(false);
                        setTimeout(handleAddFromLibrary, 100);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[st.dropdownIconWrap, { backgroundColor: '#EFF6FF' }]}>
                        <MaterialIcons name="photo-library" size={17} color="#3B82F6" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.dropdownItemText, { color: theme.colors.text }]}>Photo Library</Text>
                        <Text style={[st.dropdownItemSub, { color: theme.colors.textSecondary }]}>Choose from gallery</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={[st.dropdownDivider, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity
                      style={st.dropdownItem}
                      onPress={() => {
                        setShowUploadDropdown(false);
                        setTimeout(handleAddFromCamera, 100);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[st.dropdownIconWrap, { backgroundColor: '#FDF2F8' }]}>
                        <MaterialIcons name="photo-camera" size={17} color="#EC4899" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.dropdownItemText, { color: theme.colors.text }]}>Take Photo</Text>
                        <Text style={[st.dropdownItemSub, { color: theme.colors.textSecondary }]}>Snap with camera</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={[st.dropdownDivider, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity
                      style={st.dropdownItem}
                      onPress={() => {
                        setShowUploadDropdown(false);
                        setTimeout(handleAddFromFiles, 100);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[st.dropdownIconWrap, { backgroundColor: '#F0FDF4' }]}>
                        <MaterialIcons name="upload-file" size={17} color="#10B981" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.dropdownItemText, { color: theme.colors.text }]}>Upload Files</Text>
                        <Text style={[st.dropdownItemSub, { color: theme.colors.textSecondary }]}>PDF, Word, or Docs</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* ════════════ SCROLLABLE CONTENT — BottomSheetScrollView direct child of BottomSheet ════════════ */}
            {activeTab === 'subtasks' && (
              <BottomSheetScrollView
                ref={subtaskListRef}
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                scrollEnabled={draggingIdx === null}
                onScroll={(e) => {
                  scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                contentContainerStyle={{
                  paddingTop: 8,
                  paddingBottom: Math.max(insets.bottom, 20) + 120,
                }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Active Unchecked Items */}
                {uncheckedSubs.map((item, index) => (
                  <DraggableSubtaskRow
                    key={item.id}
                    item={item}
                    index={index}
                    isDragging={draggingIdx === index}
                    isHovered={hoverIdx === index && draggingIdx !== null}
                    theme={theme}
                    onToggle={handleToggleSubtask}
                    onDelete={handleDeleteSubtaskItem}
                    onEdit={handleEditSubtask}
                    onDragStart={handleDragStart}
                    onDragUpdate={handleDragUpdate}
                    onDragEnd={handleDragEnd}
                  />
                ))}

                {/* "+ Add subtask" Button — aligned with checklist columns */}
                <TouchableOpacity
                  style={st.addListItemBtn}
                  onPress={() => handleAddSubtaskItem()}
                  activeOpacity={0.7}
                >
                  <View style={st.dragHandleSpacer} />
                  <MaterialIcons name="add" size={18} color={theme.colors.primary} style={{ opacity: 0.9 }} />
                  <Text style={[st.addListItemTxt, { color: theme.colors.primary, fontFamily: 'Inter_500Medium' }]}>
                    Add subtask
                  </Text>
                </TouchableOpacity>

                {/* ── Collapsible Accordion for Checked Items ── */}
                {checkedSubs.length > 0 && (
                  <View style={st.checkedSection}>
                    <View style={[st.checklistDivider, { backgroundColor: theme.colors.border }]} />

                    {/* Accordion Header */}
                    <TouchableOpacity
                      style={st.accordionHeader}
                      onPress={() => setIsAccordionCollapsed((c) => !c)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name={isAccordionCollapsed ? 'keyboard-arrow-right' : 'keyboard-arrow-down'}
                        size={20}
                        color={theme.colors.textSecondary}
                      />
                      <Text style={[st.accordionLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                        {checkedSubs.length} checked {checkedSubs.length === 1 ? 'item' : 'items'}
                      </Text>
                    </TouchableOpacity>

                    {/* Checked Items List — no extra left space, wrapped multi-line text, non-editable */}
                    {!isAccordionCollapsed &&
                      checkedSubs.map((item) => (
                        <View key={item.id} style={st.checkedRow}>
                          {/* Checked Box [✓] */}
                          <TouchableOpacity
                            style={[
                              st.keepCheckbox,
                              st.keepCheckboxChecked,
                              { backgroundColor: theme.colors.textSecondary, borderColor: theme.colors.textSecondary },
                            ]}
                            onPress={() => handleToggleSubtask(item.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons name="check" size={12} color="#fff" />
                          </TouchableOpacity>

                          {/* Non-editable Strikethrough Text with wrapping */}
                          <View style={st.checklistTextWrap}>
                            <Text
                              style={[
                                st.checklistText,
                                {
                                  color: theme.colors.textSecondary,
                                  textDecorationLine: 'line-through',
                                  opacity: 0.65,
                                },
                              ]}
                              numberOfLines={0}
                            >
                              {item.text}
                            </Text>
                          </View>

                          {/* Delete Button ✕ */}
                          <TouchableOpacity
                            onPress={() => handleDeleteSubtaskItem(item.id)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={st.checklistDeleteBtn}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons name="close" size={18} color={theme.colors.textSecondary} style={{ opacity: 0.6 }} />
                          </TouchableOpacity>
                        </View>
                      ))}
                  </View>
                )}
              </BottomSheetScrollView>
            )}

            {activeTab === 'comments' && (
              <BottomSheetScrollView
                ref={commentsScrollRef}
                style={{ flex: 1 }}
                nestedScrollEnabled={true}
                contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                {(task.commentsList?.length ?? 0) > 0 ? (
                  <View style={{ gap: 14 }}>
                    {/* Header Strip with Counter */}
                    <View style={commentStyles.headerRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialIcons name="forum" size={16} color={theme.colors.primary} />
                        <Text style={[commentStyles.headerTitle, { color: theme.colors.text }]}>
                          Discussion ({task.commentsList!.length})
                        </Text>
                      </View>
                      <Text style={[commentStyles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                        Long press to copy / delete
                      </Text>
                    </View>

                    {/* Comments List */}
                    {(task.commentsList as any[]).map((c: any, index: number) => {
                      const isLast = index === task.commentsList!.length - 1;
                      return (
                        <View key={c.id} style={commentStyles.commentThread}>
                          {/* Left Avatar + Thread Line */}
                          <View style={commentStyles.avatarColumn}>
                            <View style={[commentStyles.avatarCircle, { backgroundColor: theme.colors.primary }]}>
                              <Text style={commentStyles.avatarInitial}>
                                {c.author ? c.author.charAt(0).toUpperCase() : 'S'}
                              </Text>
                            </View>
                            {!isLast && (
                              <View style={[commentStyles.threadLine, { backgroundColor: theme.colors.border }]} />
                            )}
                          </View>

                          {/* Right Content Bubble */}
                          <TouchableOpacity
                            activeOpacity={0.92}
                            onLongPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              setSelectedCommentForMenu(c);
                            }}
                            style={[
                              commentStyles.bubbleCard,
                              {
                                backgroundColor: theme.colors.secondary,
                                borderColor: theme.colors.border,
                              },
                            ]}
                          >
                            {/* Card Header: Author + Tag + Date + 3-Dots */}
                            <View style={commentStyles.bubbleHeader}>
                              <View style={commentStyles.authorGroup}>
                                <Text style={[commentStyles.authorName, { color: theme.colors.text }]}>
                                  {c.author || 'Shubham'}
                                </Text>
                                <View style={[commentStyles.authorBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                                  <Text style={[commentStyles.authorBadgeTxt, { color: theme.colors.primary }]}>
                                    Author
                                  </Text>
                                </View>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[commentStyles.commentTime, { color: theme.colors.textSecondary }]}>
                                  {formatCommentDate(c)}
                                </Text>
                                <TouchableOpacity
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  onPress={() => {
                                    Haptics.selectionAsync();
                                    setSelectedCommentForMenu(c);
                                  }}
                                  style={commentStyles.menuDotsBtn}
                                >
                                  <MaterialIcons name="more-vert" size={16} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Comment Text */}
                            {!!c.text && (
                              <Text style={[commentStyles.commentBody, { color: theme.colors.text }]}>
                                {c.text}
                              </Text>
                            )}

                            {/* Comment Attachment (if any) */}
                            {c.attachment && (
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                  if (c.attachment.type === 'image') {
                                    setLightboxAttachment(c.attachment);
                                  } else {
                                    handleOpenAtt(c.attachment);
                                  }
                                }}
                                style={[
                                  commentStyles.attCard,
                                  {
                                    backgroundColor: theme.colors.cardPrimary,
                                    borderColor: theme.colors.border,
                                  },
                                ]}
                              >
                                {c.attachment.type === 'image' ? (
                                  <Image source={{ uri: c.attachment.uri }} style={commentStyles.attImage} resizeMode="cover" />
                                ) : (
                                  <DocumentIcon fileName={c.attachment.name} theme={theme} size={36} />
                                )}
                                <View style={{ flex: 1, gap: 2 }}>
                                  <Text style={[commentStyles.attName, { color: theme.colors.text }]} numberOfLines={1}>
                                    {c.attachment.name}
                                  </Text>
                                  {!!c.attachment.size && (
                                    <Text style={[commentStyles.attSize, { color: theme.colors.textSecondary }]}>
                                      {formatBytes(c.attachment.size)}
                                    </Text>
                                  )}
                                </View>
                                <MaterialIcons name="chevron-right" size={18} color={theme.colors.textSecondary} />
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  /* Modern Empty State */
                  <View style={[commentStyles.emptyBox, { borderColor: theme.colors.border }]}>
                    <View style={[commentStyles.emptyIconCircle, { backgroundColor: `${theme.colors.primary}14` }]}>
                      <MaterialIcons name="chat-bubble-outline" size={28} color={theme.colors.primary} />
                    </View>
                    <Text style={[commentStyles.emptyTitle, { color: theme.colors.text }]}>No Comments Yet</Text>
                    <Text style={[commentStyles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                      Add notes, update task progress, or log discussions for this task.
                    </Text>

                    {/* Quick Starter Chips */}
                    <View style={commentStyles.quickChipsContainer}>
                      <Text style={[commentStyles.quickChipsHeader, { color: theme.colors.textSecondary }]}>
                        QUICK SUGGESTIONS
                      </Text>
                      {[
                        '🚀 Made good progress on this',
                        '⏳ Waiting for next steps',
                        '✅ Ready for review',
                      ].map((prompt, pIdx) => (
                        <TouchableOpacity
                          key={pIdx}
                          style={[
                            commentStyles.promptChip,
                            {
                              backgroundColor: theme.colors.secondary,
                              borderColor: theme.colors.border,
                            },
                          ]}
                          onPress={() => {
                            handleAddComment(prompt);
                          }}
                          activeOpacity={0.75}
                        >
                          <MaterialIcons name="add-comment" size={14} color={theme.colors.primary} />
                          <Text style={[commentStyles.promptChipText, { color: theme.colors.text }]}>
                            {prompt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </BottomSheetScrollView>
            )}

            {activeTab === 'attachments' && (
              <BottomSheetScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 20) + 120 }}
                showsVerticalScrollIndicator={true}
              >
                {/* ─── Attachments Content ─── */}
                {(task.attachments?.length ?? 0) > 0 ? (
                  <View style={{ gap: 14 }}>
                    {/* Header Bar: Count + Total Size + Filter + View Mode */}
                    <View style={attStyles.controlBar}>
                      <View style={attStyles.statsWrap}>
                        <Text style={[attStyles.statsTitle, { color: theme.colors.text }]}>
                          Files ({task.attachments!.length})
                        </Text>
                        <Text style={[attStyles.statsSize, { color: theme.colors.textSecondary }]}>
                          · {attachmentStats.totalSizeFormatted}
                        </Text>
                      </View>

                      {/* View Mode Toggle */}
                      <View style={[attStyles.viewModeToggle, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
                        <TouchableOpacity
                          style={[
                            attStyles.viewModeBtn,
                            attViewMode === 'grid' && { backgroundColor: theme.colors.cardPrimary, elevation: 1 },
                          ]}
                          onPress={() => { Haptics.selectionAsync(); setAttViewMode('grid'); }}
                        >
                          <MaterialIcons
                            name="grid-view"
                            size={16}
                            color={attViewMode === 'grid' ? theme.colors.primary : theme.colors.textSecondary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            attStyles.viewModeBtn,
                            attViewMode === 'list' && { backgroundColor: theme.colors.cardPrimary, elevation: 1 },
                          ]}
                          onPress={() => { Haptics.selectionAsync(); setAttViewMode('list'); }}
                        >
                          <MaterialIcons
                            name="view-list"
                            size={18}
                            color={attViewMode === 'list' ? theme.colors.primary : theme.colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Filter Pills (All / Photos / Docs) */}
                    {(attachmentStats.imageCount > 0 && attachmentStats.docCount > 0) && (
                      <View style={attStyles.filterRow}>
                        <TouchableOpacity
                          style={[
                            attStyles.filterPill,
                            attFilter === 'all'
                              ? { backgroundColor: theme.colors.primary }
                              : { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border, borderWidth: 1 },
                          ]}
                          onPress={() => { Haptics.selectionAsync(); setAttFilter('all'); }}
                        >
                          <Text
                            style={[
                              attStyles.filterPillTxt,
                              { color: attFilter === 'all' ? '#fff' : theme.colors.textSecondary },
                            ]}
                          >
                            All ({task.attachments!.length})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            attStyles.filterPill,
                            attFilter === 'image'
                              ? { backgroundColor: theme.colors.primary }
                              : { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border, borderWidth: 1 },
                          ]}
                          onPress={() => { Haptics.selectionAsync(); setAttFilter('image'); }}
                        >
                          <Text
                            style={[
                              attStyles.filterPillTxt,
                              { color: attFilter === 'image' ? '#fff' : theme.colors.textSecondary },
                            ]}
                          >
                            Photos ({attachmentStats.imageCount})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            attStyles.filterPill,
                            attFilter === 'document'
                              ? { backgroundColor: theme.colors.primary }
                              : { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border, borderWidth: 1 },
                          ]}
                          onPress={() => { Haptics.selectionAsync(); setAttFilter('document'); }}
                        >
                          <Text
                            style={[
                              attStyles.filterPillTxt,
                              { color: attFilter === 'document' ? '#fff' : theme.colors.textSecondary },
                            ]}
                          >
                            Docs ({attachmentStats.docCount})
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Grid Mode */}
                    {attViewMode === 'grid' ? (
                      <View style={attStyles.gridContainer}>
                        {filteredAttachments.map((att: any) => {
                          const isImg = att.type === 'image';

                          if (isImg) {
                            return (
                              <TouchableOpacity
                                key={att.id}
                                style={[attStyles.gridCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.secondary }]}
                                activeOpacity={0.85}
                                onPress={() => setLightboxAttachment(att)}
                                onLongPress={() => {
                                  Haptics.selectionAsync();
                                  setSelectedAttForMenu(att);
                                }}
                              >
                                <Image source={{ uri: att.uri }} style={attStyles.gridImage} resizeMode="cover" />

                                {/* Top overlay menu button */}
                                <TouchableOpacity
                                  style={attStyles.gridMenuBtn}
                                  onPress={() => {
                                    Haptics.selectionAsync();
                                    setSelectedAttForMenu(att);
                                  }}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <MaterialIcons name="more-vert" size={17} color="#fff" />
                                </TouchableOpacity>

                                {/* Bottom title overlay */}
                                <View style={attStyles.gridImageBottomBar}>
                                  <Text style={attStyles.gridImageTitle} numberOfLines={1}>
                                    {att.name}
                                  </Text>
                                  <Text style={attStyles.gridImageMeta}>
                                    {formatBytes(att.size)}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          }

                          return (
                            <TouchableOpacity
                              key={att.id}
                              style={[
                                attStyles.gridDocCard,
                                {
                                  backgroundColor: theme.colors.secondary,
                                  borderColor: theme.colors.border,
                                },
                              ]}
                              activeOpacity={0.75}
                              onPress={() => handleOpenAtt(att)}
                              onLongPress={() => {
                                Haptics.selectionAsync();
                                setSelectedAttForMenu(att);
                              }}
                            >
                              <TouchableOpacity
                                style={attStyles.gridDocMenuBtn}
                                onPress={() => {
                                  Haptics.selectionAsync();
                                  setSelectedAttForMenu(att);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <MaterialIcons name="more-vert" size={18} color={theme.colors.textSecondary} />
                              </TouchableOpacity>

                              <View style={attStyles.gridDocIconArea}>
                                <DocumentIcon fileName={att.name} mimeType={att.mimeType} theme={theme} variant="grid" />
                              </View>

                              <View style={attStyles.gridDocInfoArea}>
                                <Text style={[attStyles.gridDocName, { color: theme.colors.text }]} numberOfLines={2}>
                                  {att.name}
                                </Text>
                                <View style={attStyles.gridDocMetaRow}>
                                  <Text style={[attStyles.gridDocSize, { color: theme.colors.textSecondary }]}>
                                    {formatBytes(att.size)}
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      /* List Mode */
                      <View style={{ gap: 10 }}>
                        {filteredAttachments.map((att: any) => {
                          const isImg = att.type === 'image';
                          const fileCat = getFileCategoryInfo(att.name, att.mimeType, theme);

                          return (
                            <TouchableOpacity
                              key={att.id}
                              style={[
                                attStyles.listItem,
                                {
                                  backgroundColor: theme.colors.secondary,
                                  borderColor: theme.colors.border,
                                },
                              ]}
                              activeOpacity={0.75}
                              onPress={() => {
                                if (isImg) {
                                  setLightboxAttachment(att);
                                } else {
                                  handleOpenAtt(att);
                                }
                              }}
                              onLongPress={() => {
                                Haptics.selectionAsync();
                                setSelectedAttForMenu(att);
                              }}
                            >
                              {/* Left Thumbnail */}
                              <View style={[attStyles.listThumbWrap, { backgroundColor: theme.colors.cardPrimary }]}>
                                {isImg ? (
                                  <Image source={{ uri: att.uri }} style={attStyles.listThumbImg} resizeMode="cover" />
                                ) : (
                                  <DocumentIcon fileName={att.name} mimeType={att.mimeType} theme={theme} size={42} />
                                )}
                              </View>

                              {/* Middle Info */}
                              <View style={attStyles.listInfo}>
                                <Text style={[attStyles.listName, { color: theme.colors.text }]} numberOfLines={1}>
                                  {att.name}
                                </Text>
                                <View style={attStyles.listMetaRow}>
                                  <View style={[attStyles.typeBadge, { backgroundColor: fileCat.bg }]}>
                                    <Text style={[attStyles.typeBadgeTxt, { color: fileCat.text }]}>
                                      {isImg ? 'IMAGE' : fileCat.ext.slice(0, 4)}
                                    </Text>
                                  </View>
                                  <Text style={[attStyles.listMetaTxt, { color: theme.colors.textSecondary }]}>
                                    {formatBytes(att.size)}
                                  </Text>
                                </View>
                              </View>

                              {/* Right Actions */}
                              <View style={attStyles.listActionsRow}>
                                <TouchableOpacity
                                  onPress={() => handleShareAtt(att)}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  style={attStyles.listActionBtn}
                                >
                                  <MaterialIcons name="share" size={18} color={theme.colors.textSecondary} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  onPress={() => {
                                    Haptics.selectionAsync();
                                    setSelectedAttForMenu(att);
                                  }}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  style={attStyles.listActionBtn}
                                >
                                  <MaterialIcons name="more-vert" size={20} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : (
                  /* ─── Sleek Empty State with Action Cards ─── */
                  <View style={[attStyles.emptyContainer, { borderColor: `${theme.colors.border}90`, backgroundColor: `${theme.colors.secondary}40` }]}>
                    <View style={[attStyles.emptyIconGlow, { backgroundColor: `${theme.colors.primary}15` }]}>
                      <MaterialIcons name="cloud-upload" size={32} color={theme.colors.primary} />
                    </View>
                    <Text style={[attStyles.emptyTitleText, { color: theme.colors.text }]}>
                      No Attachments Yet
                    </Text>
                    <Text style={[attStyles.emptySubtitleText, { color: theme.colors.textSecondary }]}>
                      Upload reference photos, PDFs, spreadsheets, or documents to keep them linked with this task.
                    </Text>

                    {/* 3 Upload Cards */}
                    <View style={attStyles.emptyUploadGrid}>
                      <TouchableOpacity
                        style={[attStyles.emptyUploadCard, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}
                        onPress={handleAddFromLibrary}
                        activeOpacity={0.75}
                      >
                        <View style={[attStyles.emptyUploadIconCircle, { backgroundColor: '#EFF6FF' }]}>
                          <MaterialIcons name="photo-library" size={20} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[attStyles.emptyUploadCardTitle, { color: theme.colors.text }]}>Photo Library</Text>
                          <Text style={[attStyles.emptyUploadCardDesc, { color: theme.colors.textSecondary }]}>Choose from device gallery</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color={theme.colors.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[attStyles.emptyUploadCard, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}
                        onPress={handleAddFromCamera}
                        activeOpacity={0.75}
                      >
                        <View style={[attStyles.emptyUploadIconCircle, { backgroundColor: '#FDF2F8' }]}>
                          <MaterialIcons name="photo-camera" size={20} color="#EC4899" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[attStyles.emptyUploadCardTitle, { color: theme.colors.text }]}>Take Photo</Text>
                          <Text style={[attStyles.emptyUploadCardDesc, { color: theme.colors.textSecondary }]}>Snap with device camera</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color={theme.colors.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[attStyles.emptyUploadCard, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}
                        onPress={handleAddFromFiles}
                        activeOpacity={0.75}
                      >
                        <View style={[attStyles.emptyUploadIconCircle, { backgroundColor: '#F0FDF4' }]}>
                          <MaterialIcons name="upload-file" size={20} color="#10B981" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[attStyles.emptyUploadCardTitle, { color: theme.colors.text }]}>Upload Files</Text>
                          <Text style={[attStyles.emptyUploadCardDesc, { color: theme.colors.textSecondary }]}>PDF, Word, spreadsheets & more</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </BottomSheetScrollView>
            )}

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
            {versionHistory.length === 0 ? (
              <View style={[st.emptyState, { paddingVertical: 40 }]}>
                <View style={[st.emptyIcon, { backgroundColor: `${theme.colors.primary}12` }]}>
                  <MaterialIcons name="history" size={30} color={theme.colors.primary} />
                </View>
                <Text style={[st.emptyTitle, { color: theme.colors.text }]}>No history yet</Text>
                <Text style={[st.emptySubtitle, { color: theme.colors.textSecondary }]}>Actions you take on this task will appear here</Text>
              </View>
            ) : (
              versionHistory.map((entry, i) => <VersionItem key={entry.id} entry={entry} isLast={i === versionHistory.length - 1} theme={theme} />)
            )}
          </ScrollView>
        </View>
      </Modal>

      <TaskDetailModal visible={!!selectedSubtaskId} taskId={selectedSubtaskId!} onClose={() => setSelectedSubtaskId(null)} />

      <SubtaskComposerModal
        visible={subtaskComposerVisible}
        onClose={() => { setSubtaskComposerVisible(false); setEditingSubtask(null); }}
        onAddSubtask={handleAddNewSubtask}
        editingItem={editingSubtask}
        onEditSubtask={handleSaveEditedSubtask}
      />

      <TaskComposer
        visible={editComposerVisible}
        onClose={() => setEditComposerVisible(false)}
        initialTitle={task.title}
        initialDescription={task.description}
        initialPriority={task.priority}
        initialDueDate={task.dueDate}
        initialDueEndDate={task.dueEndDate}
        initialDueTime={task.dueTime}
        initialDueEndTime={task.dueEndTime}
        initialReminder={task.hasReminder ? 'At due time' : ''}
        initialTags={task.tag ? [task.tag.toLowerCase().replace(/\s+/g, '-')] : []}
        editMode={true}
        onSave={(taskData: any) => {
          addHistoryEvent(task.id, {
            action: task.title !== taskData.title ? 'Edited task title' : 'Edited task details',
            from: task.title !== taskData.title ? task.title : undefined,
            to: task.title !== taskData.title ? taskData.title : undefined,
            icon: 'edit',
          });
          updateTask(task.id, (t: any) => ({
            ...t,
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            dueDate: taskData.dueDate,
            dueEndDate: taskData.dueEndDate,
            dueTime: taskData.dueTime,
            dueEndTime: taskData.dueEndTime,
            hasReminder: !!taskData.reminder,
            tag: taskData.tags?.[0]?.label,
            tagType: taskData.tags?.[0]?.label,
          }));
          setEditComposerVisible(false);
        }}
      />
      {/* Rename Attachment Modal */}
      <Modal visible={!!attachmentToRename} transparent animationType="fade" onRequestClose={() => setAttachmentToRename(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '80%', backgroundColor: theme.colors.cardPrimary, padding: 20, borderRadius: 16 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 12, color: theme.colors.text }}>Rename Attachment</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, color: theme.colors.text, marginBottom: 20, fontFamily: 'Inter_400Regular' }}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              selectTextOnFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setAttachmentToRename(null)} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (renameInput.trim() && task && attachmentToRename) {
                    updateTask(task.id, (t: any) => ({
                      ...t,
                      attachments: t.attachments?.map((a: any) => a.id === attachmentToRename.id ? { ...a, name: renameInput.trim() } : a)
                    }));
                    addHistoryEvent(task.id, { action: `Renamed attachment to "${renameInput.trim()}"`, icon: 'edit' });
                  }
                  setAttachmentToRename(null);
                }}
                style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: theme.colors.primary, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Attachment Options Action Sheet */}
      <AndroidSheet
        visible={!!selectedAttForMenu}
        title={selectedAttForMenu ? `ATTACHMENT OPTIONS: ${selectedAttForMenu.name}`.toUpperCase() : 'ATTACHMENT OPTIONS'}
        items={attachmentActionItems}
        onClose={() => setSelectedAttForMenu(null)}
        theme={theme}
      />

      {/* Comment Options Action Sheet */}
      <AndroidSheet
        visible={!!selectedCommentForMenu}
        title="COMMENT OPTIONS"
        items={commentActionItems}
        onClose={() => setSelectedCommentForMenu(null)}
        theme={theme}
      />

      {/* Fullscreen Image Lightbox Modal */}
      <Modal
        visible={!!lightboxAttachment}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxAttachment(null)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: '#09090b', justifyContent: 'space-between' }}>
          {/* Header */}
          <View style={{
            paddingTop: Math.max(insets.top, 16) + 8,
            paddingBottom: 14,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(0,0,0,0.65)',
          }}>
            <TouchableOpacity
              onPress={() => setLightboxAttachment(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialIcons name="close" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={{ flex: 1, paddingHorizontal: 12, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 13.5, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>
                {lightboxAttachment?.name}
              </Text>
              {!!lightboxAttachment?.size && (
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                  {formatBytes(lightboxAttachment.size)}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => {
                if (lightboxAttachment) handleShareAtt(lightboxAttachment);
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialIcons name="share" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Centered Image */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 12 }}>
            {lightboxAttachment && (
              <Image
                source={{ uri: lightboxAttachment.uri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            )}
          </View>

          {/* Bottom Actions */}
          <View style={{
            paddingBottom: Math.max(insets.bottom, 16) + 12,
            paddingTop: 12,
            paddingHorizontal: 20,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 16,
            backgroundColor: 'rgba(0,0,0,0.65)',
          }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(255,255,255,0.18)',
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: 24,
              }}
              onPress={() => {
                if (lightboxAttachment) handleOpenAtt(lightboxAttachment);
              }}
            >
              <MaterialIcons name="open-in-new" size={17} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Open External</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: 24,
              }}
              onPress={() => {
                const target = lightboxAttachment;
                setLightboxAttachment(null);
                setTimeout(() => {
                  if (target) handleDeleteAtt(target);
                }, 200);
              }}
            >
              <MaterialIcons name="delete-outline" size={17} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  dropdownAnchor: {
    position: 'absolute',
    top: '100%',
    right: 20,
    marginTop: -4,
    zIndex: 999,
  },
  dropdownMenu: {
    width: 215,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 16,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  dropdownIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  dropdownItemSub: {
    fontSize: 10.5,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    marginVertical: 2,
  },
  // Google Keep style checklist styles
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 16,
    gap: 8,
    minHeight: 38,
  },
  checkedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 16,
    paddingLeft: 20,
    gap: 8,
    minHeight: 38,
  },
  checklistRowDragging: {
    opacity: 0.7,
    backgroundColor: '#00000008',
    borderRadius: 8,
  },
  dragHandle: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  dragHandleSpacer: {
    width: 22,
  },
  keepCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  keepCheckboxChecked: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistTextWrap: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  checklistText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  checklistDeleteBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  addListItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  addListItemTxt: {
    fontSize: 15,
  },
  checkedSection: {
    marginTop: 6,
  },
  checklistDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  accordionLabel: {
    fontSize: 13,
  },
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
  commentBar: { borderTopWidth: StyleSheet.hairlineWidth },
  commentInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
    minHeight: 38,
    maxHeight: 110,
    fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  attPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, borderWidth: 1 },
  attPreviewImg: { width: 36, height: 36, borderRadius: 6 },
  attPreviewName: { flex: 1, fontSize: 12 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8 },
  attListItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, gap: 14 },
  attListThumb: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  attListImg: { width: '100%', height: '100%' },
  attListInfo: { flex: 1, gap: 4 },
  attListName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  attListMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  historyNote: { fontSize: 13, lineHeight: 20, marginBottom: 20 },
});

const subComposerStyles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  closeBtn: {
    padding: 4,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    minHeight: 40,
    paddingVertical: 6,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
    marginBottom: 8,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  addMoreTxt: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  confirmBtn: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmTxt: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});

const attStyles = StyleSheet.create({
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  statsSize: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  viewModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  viewModeBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  filterPillTxt: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: (SW - 32 - 12) / 2,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridMenuBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  gridImageBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  gridImageTitle: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  gridImageMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  gridDocCard: {
    width: (SW - 32 - 12) / 2,
    height: 140,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    justifyContent: 'space-between',
    position: 'relative',
  },
  gridDocMenuBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  gridDocIconArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  gridDocInfoArea: {
    gap: 2,
  },
  gridDocName: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 16,
  },
  gridDocMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  gridDocSize: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  listThumbWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listThumbImg: {
    width: '100%',
    height: '100%',
  },
  listInfo: {
    flex: 1,
    gap: 4,
  },
  listName: {
    fontSize: 13.5,
    fontFamily: 'Inter_600SemiBold',
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  typeBadgeTxt: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
  },
  listMetaTxt: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  listActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    marginTop: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyIconGlow: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitleText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  emptySubtitleText: {
    fontSize: 12.5,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  emptyUploadGrid: {
    width: '100%',
    flexDirection: 'column',
    gap: 8,
  },
  emptyUploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  emptyUploadIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyUploadCardTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyUploadCardDesc: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
});

const commentStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 13.5,
    fontFamily: 'Inter_700Bold',
  },
  headerSubtitle: {
    fontSize: 11.5,
    fontFamily: 'Inter_400Regular',
  },
  commentThread: {
    flexDirection: 'row',
    gap: 10,
  },
  avatarColumn: {
    alignItems: 'center',
    width: 34,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 13.5,
    fontFamily: 'Inter_700Bold',
  },
  threadLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
    borderRadius: 1,
    opacity: 0.6,
  },
  bubbleCard: {
    flex: 1,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 13.5,
    fontFamily: 'Inter_600SemiBold',
  },
  authorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  authorBadgeTxt: {
    fontSize: 9.5,
    fontFamily: 'Inter_700Bold',
  },
  commentTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  menuDotsBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentBody: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20.5,
  },
  attCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  attImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  attName: {
    fontSize: 12.5,
    fontFamily: 'Inter_600SemiBold',
  },
  attSize: {
    fontSize: 10.5,
    fontFamily: 'Inter_400Regular',
  },
  emptyBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  emptySubtitle: {
    fontSize: 12.5,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  quickChipsContainer: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  quickChipsHeader: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
    marginBottom: 2,
    textAlign: 'center',
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  promptChipText: {
    fontSize: 12.5,
    fontFamily: 'Inter_500Medium',
  },
});

export default TaskDetailModal;
