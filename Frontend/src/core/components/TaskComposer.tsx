import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, Pressable, ScrollView, Platform,
  Animated, LayoutAnimation, Alert, Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../themes/ThemeContext';
import { Attachment, Subtask } from '../dummyData';
import DateTimePicker from './DateTimePicker';
import AttachmentPreview from './AttachmentPreview';
import { parseTaskText } from '../utils/taskParser';
import { smartParseTextSync, smartParseText } from '../utils/smartParser';
import { scheduleReminder, cancelReminder, requestNotificationPermission } from '../utils/notifications';
import LottieView from 'lottie-react-native';
import { useManage } from '../ManageContext';

// ─── Types ───────────────────────────────────────────────────────────────────
type Priority = 'HIGH' | 'MED' | 'LOW';
type ActivePanel = 'priority' | 'date' | 'reminder' | 'tags' | 'subtasks' | 'attachments' | 'location' | null;
interface Tag { id: string; label: string; color: string; }
interface Suggestion { key: string; icon: string; label: string; apply: () => void; }
interface ValidationErrors { title?: string; date?: string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_TAGS: Tag[] = [
  { id: 'work', label: 'Work', color: '#6366F1' },
  { id: 'personal', label: 'Personal', color: '#71717A' },
  { id: 'health', label: 'Health', color: '#22C55E' },
  { id: 'learning', label: 'Learning', color: '#EC4899' },
  { id: 'review', label: 'Review', color: '#F97316' },
];

const PRI_META: Record<Priority, { label: string; color: string; icon: string }> = {
  HIGH: { label: 'High', color: '#EF4444', icon: 'flag' },
  MED: { label: 'Medium', color: '#F97316', icon: 'flag' },
  LOW: { label: 'Low', color: '#22C55E', icon: 'flag' },
};

const REM_CHIPS = ['At due time', '15 min before', '30 min before', '1 hr before', '1 day before'];

// ─── Validation Helpers ──────────────────────────────────────────────────────
const validateTitle = (title: string): string | undefined => {
  const trimmed = title.trim();
  if (trimmed.length > 500) return 'Task name must be less than 500 characters';
  return undefined;
};

const validateDate = (date: string): string | undefined => {
  if (!date) return undefined;
  const validPatterns = [
    /^Today$/i, /^Tomorrow$/i, /^Next (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i,
    /^Next Week$/i, /^In \d+ (days?|weeks?|months?)$/i,
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$/i,
    /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/,
  ];
  if (validPatterns.some(p => p.test(date))) return undefined;
  return undefined;
};

// ─── Sync suggestion builder (runs instantly on every keystroke) ──────────────
// Uses: (1) taskParser for date/priority/reminder/tags, (2) chrono-node for
// robust date parsing, (3) regex engine for virtual/micro-locations.
function buildSyncSuggestions(
  text: string,
  dueDate: string,
  dueTime: string,
  priority: string | null,
  reminder: string,
  selectedTags: string[],
  location: string,
  setDate: (v: string) => void,
  setTime: (v: string) => void,
  setReminder: (v: string) => void,
  setLocation: (v: string) => void,
  addSmartTag: (id: string, label: string) => void,
  setPriority: (v: string) => void,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const parsed = parseTaskText(text);
  const { chronoResult, regexLocations, nlpLocations } = smartParseTextSync(text);

  // ── Date (prefer chrono-node, fallback to taskParser) ──
  const dateLabel = chronoResult.dateLabel ?? parsed.dateLabel;
  if (dateLabel && !dueDate) {
    suggestions.push({
      key: 'dt',
      icon: 'calendar-month',
      label: `Due: ${dateLabel}`,
      apply: () => setDate(dateLabel),
    });
  }

  // ── Time (prefer chrono-node, fallback to taskParser) ──
  const time = chronoResult.time ?? parsed.time;
  if (time && !dueTime) {
    suggestions.push({
      key: 'tm',
      icon: 'schedule',
      label: `Time: ${time}`,
      apply: () => { setTime(time); setReminder('At due time'); },
    });
  }

  // ── Priority ──
  if (parsed.priority && !priority) {
    const pKey = parsed.priority === 'high' ? 'HIGH' : parsed.priority === 'medium' ? 'MED' : 'LOW';
    suggestions.push({
      key: 'pri',
      icon: 'flag',
      label: `Priority: ${parsed.priority}`,
      apply: () => setPriority(pKey),
    });
  }

  // ── Reminder ──
  if (parsed.hasReminder && !reminder) {
    suggestions.push({
      key: 'rem',
      icon: 'notifications-active',
      label: 'Set Reminder',
      apply: () => setReminder('At due time'),
    });
  }

  // ── Regex locations (virtual meetings & micro-locations) ──
  [...regexLocations, ...nlpLocations].forEach((loc) => {
    if (!location && loc && !suggestions.find(s => s.key === `loc-${loc}`)) {
      suggestions.push({
        key: `loc-${loc}`,
        icon: 'location-on',
        label: `Location: ${loc}`,
        apply: () => setLocation(loc),
      });
    }
  });

  // ── Tags (from taskParser keyword dict) ──
  parsed.tags.forEach(tagLabel => {
    const tId = tagLabel.toLowerCase().replace(/\s+/g, '-');
    if (!selectedTags.includes(tId)) {
      suggestions.push({
        key: `tg-${tagLabel}`,
        icon: 'local-offer',
        label: `Tag: ${tagLabel}`,
        apply: () => addSmartTag(tId, tagLabel),
      });
    }
  });

  return suggestions;
}

// ─── Small Pill ───────────────────────────────────────────────────────────────
const Pill = ({ color, icon, label, onRemove }: { color: string; icon?: string; label: string; onRemove: () => void }) => {
  useTheme();
  return (
    <View style={[p.pill, { backgroundColor: `${color}15`, borderColor: `${color}40` }]}>
      {icon && <MaterialIcons name={icon as any} size={11} color={color} />}
      <Text style={[p.pillTxt, { color, fontFamily: 'Inter_600SemiBold' }]}>{label}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <MaterialIcons name="close" size={11} color={color} />
      </TouchableOpacity>
    </View>
  );
};
const p = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  pillTxt: { fontSize: 12 },
});

// ─── Quick chip strip ─────────────────────────────────────────────────────────
const ChipStrip = ({ options, active, onSelect, color }: {
  options: string[]; active: string; onSelect: (v: string) => void; color: string;
}) => {
  const { theme } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 7, paddingHorizontal: 16 }}>
        {options.map((opt) => {
          const isActive = active === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[cs.chip, { backgroundColor: isActive ? color : theme.colors.secondary, borderColor: isActive ? color : theme.colors.border }]}
              onPress={() => onSelect(isActive ? '' : opt)}
            >
              <Text style={[cs.txt, { color: isActive ? '#FFFFFF' : theme.colors.textSecondary, fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
};
const cs = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, borderWidth: 1 },
  txt: { fontSize: 13 },
});

// ─── Priority Panel ───────────────────────────────────────────────────────────
const PriorityPanel = ({ priority, onChange }: { priority: string | null; onChange: (p: string | null) => void }) => {
  const { theme } = useTheme();
  const { priorities } = useManage();
  // Build opts: all managed priority ids + null for "None"
  const managedOpts = priorities.map(p => p.id);
  return (
    <View style={[panel.wrap, { borderTopColor: theme.colors.border }]}>
      <Text style={[panel.title, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>PRIORITY</Text>
      <View style={panel.row}>
        {[...managedOpts, null].map((optId) => {
          const isActive = priority === optId;
          const meta = optId ? priorities.find(p => p.id === optId) : null;
          return (
            <TouchableOpacity
              key={optId ?? 'none'}
              style={[panel.priBtn, {
                backgroundColor: isActive
                  ? (meta ? `${meta.color}15` : theme.colors.secondary)
                  : 'transparent',
                borderColor: isActive
                  ? (meta ? meta.color : theme.colors.textSecondary)
                  : theme.colors.border,
              }]}
              onPress={() => onChange(isActive ? null : optId)}
            >
              <MaterialIcons
                name={meta ? 'flag' : 'outlined-flag'}
                size={16}
                color={isActive
                  ? (meta ? meta.color : theme.colors.text)
                  : theme.colors.textSecondary}
              />
              <Text style={[panel.priTxt, {
                color: isActive
                  ? (meta ? meta.color : theme.colors.text)
                  : theme.colors.textSecondary,
                fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_500Medium'
              }]}>
                {meta ? meta.label : 'None'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ─── Reminder Panel ───────────────────────────────────────────────────────────
const ReminderPanel = ({ reminder, setReminder }: { reminder: string; setReminder: (v: string) => void }) => {
  const { theme } = useTheme();
  const { reminderPresets } = useManage();
  return (
    <View style={[panel.wrap, { borderTopColor: theme.colors.border }]}>
      <Text style={[panel.title, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>REMIND ME</Text>
      <ChipStrip options={reminderPresets} active={reminder} onSelect={setReminder} color="#F97316" />
    </View>
  );
};

// ─── Location Panel ───────────────────────────────────────────────────────────
const LocationPanel = ({ location, setLocation }: { location: string; setLocation: (v: string) => void }) => {
  const { theme } = useTheme();
  return (
    <View style={[panel.wrap, { borderTopColor: theme.colors.border }]}>
      <Text style={[panel.title, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>LOCATION</Text>
      <View style={[panel.newTagRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.secondary }]}>
        <MaterialIcons name="location-on" size={14} color={theme.colors.textSecondary} style={{ marginLeft: 8 }} />
        <TextInput
          style={[{ flex: 1, paddingVertical: 8, paddingHorizontal: 6, fontSize: 13, color: theme.colors.text, fontFamily: 'Inter_400Regular' }]}
          placeholder="Add location..."
          placeholderTextColor={theme.colors.textSecondary}
          value={location}
          onChangeText={setLocation}
          returnKeyType="done"
        />
        {location.trim().length > 0 && (
          <TouchableOpacity onPress={() => setLocation('')} style={{ padding: 8 }}>
            <MaterialIcons name="close" size={14} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── Tags Panel ───────────────────────────────────────────────────────────────
const TagsPanel = ({ allTags, selected, onToggle, newInput, setNewInput, onCreate }: {
  allTags: Tag[]; selected: string[];
  onToggle: (id: string) => void;
  newInput: string; setNewInput: (v: string) => void; onCreate: () => void;
}) => {
  const { theme } = useTheme();
  return (
    <View style={[panel.wrap, { borderTopColor: theme.colors.border }]}>
      <Text style={[panel.title, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>TAGS</Text>
      <View style={panel.tagRow}>
        {allTags.map((tag) => {
          const isActive = selected.includes(tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              style={[panel.tagChip, { backgroundColor: isActive ? `${tag.color}18` : theme.colors.secondary, borderColor: isActive ? tag.color : theme.colors.border }]}
              onPress={() => onToggle(tag.id)}
            >
              {isActive && <MaterialIcons name="check" size={11} color={tag.color} />}
              <Text style={[{ fontSize: 13, color: isActive ? tag.color : theme.colors.textSecondary, fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                {tag.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[panel.newTagRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.secondary }]}>
        <MaterialIcons name="add" size={14} color={theme.colors.textSecondary} style={{ marginLeft: 8 }} />
        <TextInput
          style={[{ flex: 1, paddingVertical: 8, paddingHorizontal: 6, fontSize: 13, color: theme.colors.text, fontFamily: 'Inter_400Regular' }]}
          placeholder="New tag..."
          placeholderTextColor={theme.colors.textSecondary}
          value={newInput}
          onChangeText={setNewInput}
          onSubmitEditing={onCreate}
          returnKeyType="done"
        />
        {newInput.trim() && (
          <TouchableOpacity style={[panel.createBtn, { backgroundColor: '#8B5CF6' }]} onPress={onCreate}>
            <Text style={{ color: '#FFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Create</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// Panel styles (shared across all panels)
const panel = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  title: { fontSize: 10, letterSpacing: 0.8, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  priBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  priTxt: { fontSize: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, borderWidth: 1 },
  newTagRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, overflow: 'hidden', marginTop: 2 },
  createBtn: { paddingHorizontal: 12, paddingVertical: 9 },
});

// ─── Subtasks Panel ───────────────────────────────────────────────────────────
const SubtasksPanel = ({
  subtasks,
  subInput,
  setSubInput,
  onAdd,
  onToggle,
  onDelete,
  inputRef,
}: {
  subtasks: Subtask[];
  subInput: string;
  setSubInput: (v: string) => void;
  onAdd: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  inputRef: React.RefObject<TextInput | null>;
}) => {
  const { theme } = useTheme();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [inputRef]);

  return (
    <View style={[panel.wrap, { borderTopColor: theme.colors.border }]}>
      <Text style={[panel.title, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>SUBTASKS</Text>

      {/* Add subtask input row */}
      <View style={subtaskPanelStyles.inputRow}>
        <View style={{ paddingHorizontal: 2 }}>
          <MaterialIcons name="add" size={20} color={theme.colors.textSecondary} />
        </View>
        <TextInput
          ref={inputRef}
          style={[subtaskPanelStyles.input, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}
          placeholder="Add subtask..."
          placeholderTextColor={theme.colors.textSecondary}
          value={subInput}
          onChangeText={setSubInput}
          onSubmitEditing={onAdd}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        {subInput.trim().length > 0 && (
          <TouchableOpacity
            style={[subtaskPanelStyles.confirmBtn, { backgroundColor: theme.colors.primary }]}
            onPress={onAdd}
          >
            <MaterialIcons name="keyboard-arrow-up" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* List of existing subtasks */}
      {subtasks.map((st) => (
        <View key={st.id} style={subtaskPanelStyles.subtaskRow}>
          <TouchableOpacity
            style={[subtaskPanelStyles.check, { borderColor: st.done ? theme.colors.primary : theme.colors.border, backgroundColor: st.done ? theme.colors.primary : 'transparent' }]}
            onPress={() => onToggle(st.id)}
          >
            {st.done && <MaterialIcons name="check" size={12} color="#FFF" />}
          </TouchableOpacity>
          <Text style={[subtaskPanelStyles.text, {
            color: theme.colors.text,
            opacity: st.done ? 0.5 : 1,
            textDecorationLine: st.done ? 'line-through' : 'none',
            fontFamily: 'Inter_500Medium'
          }]}>
            {st.text}
          </Text>
          <TouchableOpacity
            style={subtaskPanelStyles.deleteBtn}
            onPress={() => onDelete(st.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="close" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

const subtaskPanelStyles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  confirmBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: 15,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Attachments Panel ────────────────────────────────────────────────────────
const AttachmentsPanel = ({
  onAttach,
  onClose,
}: {
  onAttach: (att: Attachment) => void;
  onClose: () => void;
}) => {
  const { theme } = useTheme();
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera permission is needed to take photos. Please enable it in settings.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 20 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Attachments cannot exceed 20MB.');
        return;
      }
      const attachment: Attachment = {
        id: Date.now().toString(),
        type: 'image',
        uri: asset.uri,
        name: asset.fileName || `Photo_${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      };
      onAttach(attachment);
      onClose();
    }
  };

  const handlePhotoLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Photo library permission is needed to select photos. Please enable it in settings.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 20 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Attachments cannot exceed 20MB.');
        return;
      }
      const attachment: Attachment = {
        id: Date.now().toString(),
        type: 'image',
        uri: asset.uri,
        name: asset.fileName || `Image_${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      };
      onAttach(attachment);
      onClose();
    }
  };

  const handleDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        if (asset.size && asset.size > 20 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Attachments cannot exceed 20MB.');
          return;
        }

        if (asset.mimeType?.startsWith('video/') || asset.name?.toLowerCase().match(/\.(mp4|mov|avi|wmv|flv|mkv)$/)) {
          Alert.alert('Invalid File', 'Video attachments are not currently allowed.');
          return;
        }

        const isPdf = asset.mimeType === 'application/pdf' || asset.name?.toLowerCase().endsWith('.pdf');
        const attachment: Attachment = {
          id: Date.now().toString(),
          type: 'document',
          uri: asset.uri,
          name: asset.name || `Document_${Date.now()}`,
          mimeType: asset.mimeType || (isPdf ? 'application/pdf' : 'application/octet-stream'),
        };
        onAttach(attachment);
        onClose();
      }
    } catch {
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const handleLinkSubmit = () => {
    if (!linkUrl.trim()) {
      Alert.alert('Invalid URL', 'Please enter a valid URL');
      return;
    }

    let url = linkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    const domain = extractDomain(url);
    const attachment: Attachment = {
      id: Date.now().toString(),
      type: 'link',
      uri: url,
      name: domain,
      linkMeta: {
        domain,
        title: domain,
      },
    };
    onAttach(attachment);
    setLinkUrl('');
    setShowLinkInput(false);
    onClose();
  };

  const options = [
    { id: 'camera', label: 'Camera', icon: 'photo-camera' as const, action: handleCamera },
    { id: 'gallery', label: 'Gallery', icon: 'photo-library' as const, action: handlePhotoLibrary },
    { id: 'file', label: 'File', icon: 'insert-drive-file' as const, action: handleDocument },
    { id: 'link', label: 'Link', icon: 'link' as const, action: () => setShowLinkInput(true) },
  ];

  return (
    <View style={[panel.wrap, { borderTopColor: theme.colors.border }]}>
      <Text style={[panel.title, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>ATTACHMENTS</Text>

      {!showLinkInput ? (
        <View style={attachPanelStyles.optionsRow}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={attachPanelStyles.optionBtn}
              onPress={opt.action}
            >
              <View style={[attachPanelStyles.optionIconWrap, { backgroundColor: `${theme.colors.primary}15` }]}>
                <MaterialIcons name={opt.icon} size={26} color={theme.colors.primary} />
              </View>
              <Text style={[attachPanelStyles.optionLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={attachPanelStyles.linkContainer}>
          <TextInput
            style={[attachPanelStyles.linkInput, {
              backgroundColor: theme.colors.secondary,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            }]}
            placeholder="Paste URL here..."
            placeholderTextColor={theme.colors.textSecondary}
            value={linkUrl}
            onChangeText={setLinkUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
          />
          <View style={attachPanelStyles.linkButtons}>
            <TouchableOpacity
              style={[attachPanelStyles.linkBtn, { backgroundColor: theme.colors.secondary }]}
              onPress={() => { setShowLinkInput(false); setLinkUrl(''); }}
            >
              <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[attachPanelStyles.linkBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleLinkSubmit}
            >
              <Text style={{ color: '#FFF', fontFamily: 'Inter_600SemiBold' }}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const attachPanelStyles = StyleSheet.create({
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  optionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  optionIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 12,
  },
  linkContainer: {
    paddingVertical: 8,
  },
  linkInput: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
  },
  linkButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  linkBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },
});

// ─── Main Composer ────────────────────────────────────────────────────────────
export const TaskComposer = ({
  visible, onClose, onSave,
  initialTitle = '', initialDescription = '',
  initialPriority = null, initialDueDate = '', initialDueTime = '', initialReminder = '', initialTags = [], initialLocation = '',
  editMode = false
}: {
  visible: boolean;
  onClose: () => void;
  onSave?: (task: any) => void;
  initialTitle?: string;
  initialDescription?: string;
  initialPriority?: string | null;
  initialDueDate?: string;
  initialDueTime?: string;
  initialReminder?: string;
  initialTags?: string[];
  initialLocation?: string;
  editMode?: boolean;
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();


  // Core
  const [title, setTitle] = useState(initialTitle);
  const manage = useManage();
  const [priority, setPriority] = useState<string | null>(initialPriority ?? manage.defaultPriority);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [dueTime, setDueTime] = useState(initialDueTime);
  const [reminder, setReminder] = useState(initialReminder);
  const [location, setLocation] = useState(initialLocation);
  const [description, setDesc] = useState(initialDescription);

  // Tags
  const [allTags, setAllTags] = useState<Tag[]>(() => manage.tags);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [newTagInput, setNewTagInput] = useState('');

  // Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subInput, setSubInput] = useState('');

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // UI
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{ title?: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Nested subtasks in composer
  const [expandedSubIds, setExpandedSubIds] = useState<Set<string>>(new Set());
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null);
  const [childInput, setChildInput] = useState('');

  const appliedRef = useRef(new Set<string>());
  const titleInputRef = useRef<TextInput>(null);
  const subtaskInputRef = useRef<TextInput>(null);
  const lottieRef = useRef<LottieView>(null);

  // Tag helpers
  const addTag = (id: string) => setSelectedTags((p) => p.includes(id) ? p : [...p, id]);
  const removeTag = (id: string) => setSelectedTags((p) => p.filter((t) => t !== id));
  const toggleTag = (id: string) => selectedTags.includes(id) ? removeTag(id) : addTag(id);
  const createTag = () => {
    if (!newTagInput.trim()) return;
    const id = newTagInput.toLowerCase().replace(/\s+/g, '-');
    const cols = ['#7C3AED', '#2563EB', '#DB2777', '#0891B2', '#059669'];
    const color = cols[allTags.length % cols.length];
    setAllTags((prev) => [...prev, { id, label: newTagInput.trim(), color }]);
    addTag(id);
    setNewTagInput('');
  };

  // Subtask helpers
  const addSubtask = () => {
    if (!subInput.trim()) {
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSubtasks((p) => [...p, { id: String(Date.now()), text: subInput.trim(), done: false }]);
    setSubInput('');
    // Keep focus for next subtask
    setTimeout(() => subtaskInputRef.current?.focus(), 50);
  };
  const toggleSubtask = (id: string) => setSubtasks((p) => p.map((s) => s.id === id ? { ...s, done: !s.done } : s));
  const deleteSubtask = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSubtasks((p) => p.filter((s) => s.id !== id));
  };

  // Attachment helpers
  const removeAttachment = (id: string) => {
    setAttachments((p) => p.filter((a) => a.id !== id));
  };

  // Smart detection
  const applySmartTag = useCallback((id: string, label: string) => {
    setAllTags(prev => {
      if (prev.find(t => t.id === id)) return prev;
      const cols = ['#7C3AED', '#2563EB', '#DB2777', '#0891B2', '#059669'];
      const color = cols[prev.length % cols.length];
      return [...prev, { id, label, color }];
    });
    addTag(id);
  }, [allTags.length]);

  useEffect(() => {
    // ── Pass 1: instant sync suggestions (chrono + regex + taskParser) ──────
    const syncFound = buildSyncSuggestions(
      title,
      dueDate, dueTime, priority, reminder, selectedTags, location,
      setDueDate, setDueTime, setReminder, setLocation,
      applySmartTag, setPriority,
    );

    if (syncFound.length !== suggestions.length && (syncFound.length === 0 || suggestions.length === 0)) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setSuggestions(syncFound);

    // ── Pass 2: async background engines (TFLite + ML Kit) ─────────────────
    // Runs after sync pass so UI is never blocked
    let cancelled = false;
    if (title.trim().length >= 4) {
      smartParseText(title).then((result) => {
        if (cancelled) return;

        setSuggestions(prev => {
          const next = [...prev];

          // ML Kit physical locations
          result.locations.forEach(loc => {
            if (!location && !next.find(s => s.key === `loc-${loc}`)) {
              next.push({
                key: `loc-${loc}`,
                icon: 'location-on',
                label: `Location: ${loc}`,
                apply: () => setLocation(loc),
              });
            }
          });

          // TFLite tag
          if (result.tag && !selectedTags.includes(result.tag.toLowerCase().replace(/\s+/g, '-'))) {
            const tId = result.tag.toLowerCase().replace(/[\s&]+/g, '-');
            if (!next.find(s => s.key === `tg-${result.tag}`)) {
              next.push({
                key: `tg-${result.tag}`,
                icon: 'auto-awesome',
                label: `Tag: ${result.tag}`,
                apply: () => applySmartTag(tId, result.tag!),
              });
            }
          }

          return next;
        });
      }).catch(() => { /* silently ignore engine errors */ });
    }

    return () => { cancelled = true; };
  }, [title, applySmartTag, dueDate, dueTime, priority, reminder, selectedTags, location]);

  // Initialize internal states when modal opens
  useEffect(() => {
    requestNotificationPermission();
    if (visible) {
      setTitle(initialTitle);
      setDesc(initialDescription);
      setPriority(initialPriority);
      setDueDate(initialDueDate);
      setDueTime(initialDueTime);
      setReminder(initialReminder);
      setLocation(initialLocation);
      setSelectedTags(initialTags);

      if (initialTags.length > 0 && initialTags[0]) {
        const tId = initialTags[0];
        setAllTags((prev) => {
          if (prev.find((t) => t.id === tId)) return prev;
          return [...prev, { id: tId, label: tId.charAt(0).toUpperCase() + tId.slice(1).replace('-', ' '), color: '#8B5CF6' }];
        });
      }
    }
  }, [visible]);

  // Focus title input when modal opens
  useEffect(() => {
    if (visible) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [visible]);

  const applyS = (s: Suggestion) => {
    s.apply();
  };

  const validateForm = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    const titleError = validateTitle(title);
    const dateError = validateDate(dueDate);

    if (titleError) newErrors.title = titleError;
    if (dateError) newErrors.date = dateError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, dueDate]);

  const handleClose = () => {
    const hasUnsavedChanges =
      title.trim() !== initialTitle.trim() ||
      description.trim() !== initialDescription.trim() ||
      priority !== initialPriority ||
      dueDate !== initialDueDate ||
      dueTime !== initialDueTime ||
      reminder !== initialReminder ||
      location !== initialLocation ||
      JSON.stringify(selectedTags.slice().sort()) !== JSON.stringify(initialTags.slice().sort()) ||
      (!editMode && (
        subtasks.length > 0 ||
        attachments.length > 0
      ));

    if (hasUnsavedChanges) {
      Alert.alert(
        'Discard Task?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setTitle(''); setPriority(null); setDueDate(''); setDueTime(''); setReminder(''); setLocation('');
              setSelectedTags([]); setSubtasks([]); setDesc(''); setAttachments([]);
              setActivePanel(null); setSuggestions([]); setErrors({}); setTouched({});
              setIsSubmitting(false); setSubInput('');
              setShowDatePicker(false);
              appliedRef.current.clear();
              onClose();
            }
          }
        ]
      );
    } else {
      setTitle(initialTitle); setPriority(initialPriority); setDueDate(initialDueDate); setDueTime(initialDueTime); setReminder(initialReminder); setLocation(initialLocation);
      setSelectedTags(initialTags); setSubtasks([]); setDesc(initialDescription); setAttachments([]);
      setActivePanel(null); setSuggestions([]); setErrors({}); setTouched({});
      setIsSubmitting(false); setSubInput('');
      setShowDatePicker(false);
      appliedRef.current.clear();
      onClose();
    }
  };

  const resetForm = () => {
    setTitle(''); setPriority(null); setDueDate(''); setDueTime(''); setReminder(''); setLocation('');
    setSelectedTags([]); setSubtasks([]); setDesc(''); setAttachments([]);
    setActivePanel(null); setSuggestions([]); setErrors({}); setTouched({});
    setIsSubmitting(false); setSubInput('');
    setShowDatePicker(false);
    appliedRef.current.clear();
  };

  const handleSave = async () => {
    setTouched({ title: true });

    if (!validateForm()) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      return;
    }

    setIsSubmitting(true);

    const taskData = {
      id: `t${Date.now()}`,
      title: title.trim(),
      priority: priority || undefined,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      reminder: reminder || undefined,
      location: location || undefined,
      description: description || undefined,
      tags: selectedTags.map(id => allTags.find(t => t.id === id)).filter(Boolean),
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      completed: false,
      tag: selectedTags.length > 0 ? allTags.find(t => t.id === selectedTags[0])?.label.toUpperCase() : undefined,
      tagType: selectedTags.length > 0 ? selectedTags[0] : undefined,
    };

    if (lottieRef.current && !editMode) {
      // The Lottie animation loading phase is between frames 60 and 270
      lottieRef.current.play(60, 270);
    }

    const startTime = Date.now();

    // Simulate the loading phase for a minimum of 700ms
    // (If you add real API calls later, start them before this timer and await them here)
    const elapsed = Date.now() - startTime;
    const remainingTime = Math.max(0, 700 - elapsed);
    if (remainingTime > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }

    if (lottieRef.current && !editMode) {
      // Play the success phase (checkmark popping up and plane flying)
      lottieRef.current.play(270, 372);
      // Wait ~400ms for the checkmark to fully appear on screen before adding the task
      await new Promise(resolve => setTimeout(resolve, 400));
    } else {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Now that the tick mark has appeared, the task "goes" (saves to the list)
    if (onSave) {
      await Promise.resolve(onSave(taskData));
      
      if (taskData.dueDate && taskData.dueTime && taskData.reminder) {
        try {
          await scheduleReminder(
            taskData.id,
            taskData.title,
            taskData.dueDate,
            taskData.dueTime,
            taskData.reminder
          );
        } catch (e) {
          console.error('Failed to schedule reminder', e);
        }
      } else if (editMode) {
        try {
          await cancelReminder(taskData.id);
        } catch (e) {
          console.error('Failed to cancel reminder', e);
        }
      }
    }

    if (editMode) {
      // In edit mode — close the composer after saving
      onClose();
    } else {
      // In create mode — stay open to add the next task
      resetForm();
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  };

  const togglePanel = (panelName: ActivePanel) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActivePanel((prev) => prev === panelName ? null : panelName);
  };
  // Track keyboard height dynamically using standard RN
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  // Divider component
  const Divider = () => (
    <View style={[s.divider, { backgroundColor: theme.colors.border }]} />
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={[s.flex, { paddingBottom: keyboardHeight }]}>
          <Pressable style={s.backdrop} onPress={handleClose} />

          <View style={[s.sheet, {
            backgroundColor: theme.colors.cardPrimary,
            paddingBottom: Math.max(insets.bottom, 12)
          }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              style={{ flexShrink: 1 }}
            >
              {/* Title input */}
              <View>
                <TextInput
                  ref={titleInputRef}
                  style={[
                    s.titleInput,
                    { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' },
                    touched.title && errors.title && { borderBottomWidth: 2, borderBottomColor: '#EF4444' }
                  ]}
                  placeholder="Task name"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={title}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/\n/g, '');
                    setTitle(cleaned);
                    if (touched.title) {
                      const error = validateTitle(cleaned);
                      setErrors(prev => ({ ...prev, title: error }));
                    }
                  }}
                  onBlur={() => {
                    setTouched(prev => ({ ...prev, title: true }));
                    const error = validateTitle(title);
                    setErrors(prev => ({ ...prev, title: error }));
                  }}
                  multiline={true}
                  returnKeyType="send"
                  blurOnSubmit={true}
                  onSubmitEditing={handleSave}
                  maxLength={500}
                />
                {touched.title && errors.title && (
                  <View style={s.errorRow}>
                    <MaterialIcons name="error-outline" size={14} color="#EF4444" />
                    <Text style={[s.errorText, { color: '#EF4444' }]}>{errors.title}</Text>
                  </View>
                )}
              </View>

              {/* Description input */}
              <View style={s.descriptionContainer}>
                <TextInput
                  style={[
                    s.descriptionInput,
                    { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }
                  ]}
                  placeholder="Description"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={description}
                  onChangeText={setDesc}
                  multiline
                  blurOnSubmit={false}
                  textAlignVertical="top"
                />
              </View>

              {/* Subtasks - inline compact list */}
              {subtasks.length > 0 && activePanel !== 'subtasks' && (
                <View style={s.inlineSubtasksSection}>
                  {subtasks.map((st) => {
                    const hasChildren = (st.children?.length ?? 0) > 0;
                    const isExpanded = expandedSubIds.has(st.id);
                    const isAddingHere = addingChildFor === st.id;
                    return (
                      <View key={st.id}>
                        {/* Parent row */}
                        <View style={s.inlineSubtaskRow}>
                          <TouchableOpacity
                            style={[s.inlineSubtaskCheck, { borderColor: st.done ? theme.colors.primary : theme.colors.border, backgroundColor: st.done ? theme.colors.primary : 'transparent' }]}
                            onPress={() => toggleSubtask(st.id)}
                          >
                            {st.done && <MaterialIcons name="check" size={10} color="#FFF" />}
                          </TouchableOpacity>
                          <Text style={[s.inlineSubtaskText, {
                            color: theme.colors.text, opacity: st.done ? 0.5 : 1,
                            textDecorationLine: st.done ? 'line-through' : 'none',
                            fontFamily: 'Inter_500Medium',
                          }]}>{st.text}</Text>
                          {/* Expand/add nested button */}
                          <TouchableOpacity
                            onPress={() => {
                              if (!hasChildren && !isAddingHere) {
                                setAddingChildFor(st.id);
                                setChildInput('');
                              } else {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setExpandedSubIds(prev => {
                                  const next = new Set(prev);
                                  next.has(st.id) ? next.delete(st.id) : next.add(st.id);
                                  return next;
                                });
                              }
                            }}
                            style={{ padding: 4 }}
                          >
                            <MaterialIcons
                              name={isExpanded || isAddingHere ? 'expand-less' : (hasChildren ? 'expand-more' : 'add-circle-outline')}
                              size={16}
                              color={theme.colors.primary}
                            />
                          </TouchableOpacity>
                        </View>

                        {/* Nested children */}
                        {(isExpanded || isAddingHere) && (
                          <View style={[s.nestedContainer, { borderColor: theme.colors.border }]}>
                            {(st.children ?? []).map(child => (
                              <View key={child.id} style={s.nestedChildRow}>
                                <View style={[s.nestedLine, { backgroundColor: theme.colors.border }]} />
                                <TouchableOpacity
                                  style={[s.inlineSubtaskCheck, { borderColor: child.done ? theme.colors.primary : theme.colors.border, backgroundColor: child.done ? theme.colors.primary : 'transparent', width: 16, height: 16, borderRadius: 4 }]}
                                  onPress={() => setSubtasks(prev => prev.map(p => p.id === st.id ? { ...p, children: p.children?.map(c => c.id === child.id ? { ...c, done: !c.done } : c) } : p))}
                                >
                                  {child.done && <MaterialIcons name="check" size={9} color="#FFF" />}
                                </TouchableOpacity>
                                <Text style={[s.inlineSubtaskText, { color: theme.colors.text, opacity: child.done ? 0.5 : 1, fontSize: 13, textDecorationLine: child.done ? 'line-through' : 'none', fontFamily: 'Inter_400Regular' }]}>{child.text}</Text>
                                <TouchableOpacity onPress={() => setSubtasks(prev => prev.map(p => p.id === st.id ? { ...p, children: p.children?.filter(c => c.id !== child.id) } : p))}>
                                  <MaterialIcons name="close" size={13} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                              </View>
                            ))}

                            {/* Add child input */}
                            {isAddingHere && (
                              <View style={s.addChildInputRow}>
                                <MaterialIcons name="subdirectory-arrow-right" size={13} color={theme.colors.primary} />
                                <TextInput
                                  style={[s.addChildInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                                  placeholder="Nested subtask…"
                                  placeholderTextColor={theme.colors.textSecondary}
                                  value={childInput}
                                  onChangeText={setChildInput}
                                  autoFocus
                                  returnKeyType="done"
                                  onSubmitEditing={() => {
                                    if (!childInput.trim()) return;
                                    setSubtasks(prev => prev.map(p => p.id === st.id
                                      ? { ...p, children: [...(p.children ?? []), { id: `c_${Date.now()}`, text: childInput.trim(), done: false }] }
                                      : p
                                    ));
                                    setChildInput('');
                                    setAddingChildFor(null);
                                    setExpandedSubIds(prev => new Set([...prev, st.id]));
                                  }}
                                />
                                <TouchableOpacity onPress={() => { setAddingChildFor(null); setChildInput(''); }}>
                                  <MaterialIcons name="close" size={14} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                              </View>
                            )}

                            {!isAddingHere && (
                              <TouchableOpacity style={s.addMoreNested} onPress={() => { setAddingChildFor(st.id); setChildInput(''); }}>
                                <MaterialIcons name="add" size={13} color={theme.colors.primary} />
                                <Text style={[s.addMoreNestedTxt, { color: theme.colors.primary }]}>Add nested</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Attachment preview */}
              {attachments.length > 0 && (
                <>
                  <Divider />
                  <View style={s.attachmentSection}>
                    <AttachmentPreview
                      attachments={attachments}
                      onRemove={removeAttachment}
                    />
                  </View>
                </>
              )}

              {/* Active selections pills */}
              {(priority || dueDate || dueTime || reminder || location || selectedTags.length > 0) && (
                <>
                  <Divider />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" style={s.pillsRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, flexDirection: 'row', alignItems: 'center' }}>
                    {priority && (() => {
                      const priMeta = manage.priorities.find(p => p.id === priority);
                      return priMeta ? (
                        <Pill
                          color={priMeta.color}
                          icon="flag"
                          label={priMeta.label}
                          onRemove={() => setPriority(null)}
                        />
                      ) : null;
                    })()}
                    {dueDate && (
                      <Pill color="#6366F1" icon="calendar-month" label={dueTime ? `${dueDate} · ${dueTime}` : dueDate} onRemove={() => { setDueDate(''); setDueTime(''); }} />
                    )}
                    {reminder && (
                      <Pill color="#F97316" icon="notifications" label={reminder} onRemove={() => setReminder('')} />
                    )}
                    {location && (
                      <Pill color="#EF4444" icon="location-on" label={location} onRemove={() => setLocation('')} />
                    )}
                    {selectedTags.map((id) => {
                      const tag = allTags.find((t) => t.id === id);
                      if (!tag) return null;
                      return <Pill key={id} color={tag.color} label={tag.label} onRemove={() => removeTag(id)} />;
                    })}
                  </ScrollView>
                </>
              )}

              {/* Smart suggestions */}
              {suggestions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 10, marginVertical: 12 }}
                >
                  {suggestions.map((sg) => (
                    <TouchableOpacity
                      key={sg.key}
                      style={[s.suggChip, { backgroundColor: `${theme.colors.primary}18`, borderColor: `${theme.colors.primary}30` }]}
                      onPress={() => applyS(sg)}
                    >
                      <MaterialIcons name="auto-awesome" size={14} color={theme.colors.primary} />
                      <MaterialIcons name={sg.icon as any} size={15} color={theme.colors.primary} />
                      <Text style={[s.suggTxt, { color: theme.colors.primary, fontFamily: 'Inter_600SemiBold' }]}>{sg.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Active panel - appears above toolbar */}
              {activePanel === 'priority' && (
                <PriorityPanel priority={priority} onChange={setPriority} />
              )}
              {activePanel === 'reminder' && (
                <ReminderPanel reminder={reminder} setReminder={setReminder} />
              )}
              {activePanel === 'location' && (
                <LocationPanel location={location} setLocation={setLocation} />
              )}
              {activePanel === 'tags' && (
                <TagsPanel
                  allTags={allTags} selected={selectedTags} onToggle={toggleTag}
                  newInput={newTagInput} setNewInput={setNewTagInput} onCreate={createTag}
                />
              )}
              {activePanel === 'subtasks' && (
                <SubtasksPanel
                  subtasks={subtasks}
                  subInput={subInput}
                  setSubInput={setSubInput}
                  onAdd={addSubtask}
                  onToggle={toggleSubtask}
                  onDelete={deleteSubtask}
                  inputRef={subtaskInputRef}
                />
              )}
              {activePanel === 'attachments' && (
                <AttachmentsPanel
                  onAttach={(att) => {
                    setAttachments((prev) => [...prev, att]);
                    setActivePanel(null);
                  }}
                  onClose={() => setActivePanel(null)}
                />
              )}

            </ScrollView>

            {/* Bottom Toolbar */}
            <View style={[s.toolbar, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.cardPrimary }]}>
              <View style={s.toolLeft}>
                {/* Calendar - available in both create and edit mode */}
                <TouchableOpacity
                  style={tb.btn}
                  onPress={() => setShowDatePicker(true)}
                >
                  <MaterialIcons
                    name="calendar-month"
                    size={22}
                    color={dueDate ? '#6366F1' : theme.colors.textSecondary}
                  />
                  {dueDate && <View style={[tb.dot, { backgroundColor: '#6366F1' }]} />}
                </TouchableOpacity>

                {/* Priority - available in both create and edit mode */}
                <TouchableOpacity
                  style={tb.btn}
                  onPress={() => togglePanel('priority')}
                >
                  <MaterialIcons
                    name={priority ? 'flag' : 'outlined-flag'}
                    size={22}
                    color={priority ? (manage.priorities.find(p => p.id === priority)?.color ?? theme.colors.textSecondary) : theme.colors.textSecondary}
                  />
                  {priority && <View style={[tb.dot, { backgroundColor: manage.priorities.find(p => p.id === priority)?.color ?? theme.colors.primary }]} />}
                </TouchableOpacity>

                {/* Tags - available in both create and edit mode */}
                <TouchableOpacity
                  style={tb.btn}
                  onPress={() => togglePanel('tags')}
                >
                  <MaterialIcons
                    name="local-offer"
                    size={22}
                    color={selectedTags.length > 0 ? '#8B5CF6' : theme.colors.textSecondary}
                  />
                  {selectedTags.length > 0 && <View style={[tb.dot, { backgroundColor: '#8B5CF6' }]} />}
                </TouchableOpacity>

                {/* Reminder - available in both create and edit mode */}
                <TouchableOpacity
                  style={tb.btn}
                  onPress={() => togglePanel('reminder')}
                >
                  <MaterialIcons
                    name={reminder ? 'notifications' : 'notifications-none'}
                    size={22}
                    color={reminder ? '#F97316' : theme.colors.textSecondary}
                  />
                  {reminder && <View style={[tb.dot, { backgroundColor: '#F97316' }]} />}
                </TouchableOpacity>

                {/* Subtasks - create mode only */}
                {!editMode && (
                  <TouchableOpacity
                    style={tb.btn}
                    onPress={() => togglePanel('subtasks')}
                  >
                    <MaterialIcons
                      name="format-list-bulleted"
                      size={22}
                      color={subtasks.length > 0 ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    {subtasks.length > 0 && (
                      <View style={[tb.badge, { backgroundColor: theme.colors.primary }]}>
                        <Text style={tb.badgeText}>{subtasks.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {/* Attachments - create mode only */}
                {!editMode && (
                  <TouchableOpacity
                    style={tb.btn}
                    onPress={() => togglePanel('attachments')}
                  >
                    <MaterialIcons
                      name="attach-file"
                      size={22}
                      color={attachments.length > 0 ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    {attachments.length > 0 && <View style={[tb.dot, { backgroundColor: theme.colors.primary }]} />}
                  </TouchableOpacity>
                )}

                {/* Location - available in both create and edit mode */}
                <TouchableOpacity
                  style={tb.btn}
                  onPress={() => togglePanel('location')}
                >
                  <MaterialIcons
                    name={location ? 'location-on' : 'location-on'}
                    size={22}
                    color={location ? '#EF4444' : theme.colors.textSecondary}
                  />
                  {location && <View style={[tb.dot, { backgroundColor: '#EF4444' }]} />}
                </TouchableOpacity>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={
                  !editMode
                    ? {
                      width: 54,
                      height: 54,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 1
                    }
                    : [
                      s.saveBtn,
                      {
                        backgroundColor: (editMode || title.trim()) && !errors.title ? theme.colors.primary : theme.colors.secondary,
                        opacity: isSubmitting ? 0.6 : (!title.trim() ? 0.5 : 1)
                      }
                    ]
                }
                onPress={handleSave}
                disabled={(!editMode && !title.trim()) || !!errors.title || isSubmitting}
              >
                {!editMode ? (
                  <LottieView
                    ref={lottieRef}
                    source={(!title.trim() && !isSubmitting) ? require('../../../assets/images/sendBtnDisabled.json') : require('../../../assets/images/sendBtn.json')}
                    style={{ width: 300, height: 300, transform: [{ scale: 1.1 }] }}
                    loop={false}
                    autoPlay={false}
                    speed={2}
                  />
                ) : (
                  <MaterialIcons
                    name="check"
                    size={20}
                    color={(editMode || title.trim()) && !errors.title ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
      </View>
      {/* DateTimePicker Modal */}
      <DateTimePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(date, time) => {
          setDueDate(date);
          setDueTime(time || '');
          setShowDatePicker(false);
        }}
        initialDate={dueDate}
        initialTime={dueTime}
      />
    </Modal>
  );
};

// ─── Toolbar styles ───────────────────────────────────────────────────────────
const tb = StyleSheet.create({
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, right: 8, width: 5, height: 5, borderRadius: 5 },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
});

const s = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingTop: 8,
    maxHeight: '85%',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },

  // Title
  titleInput: { fontSize: 20, lineHeight: 28, paddingHorizontal: 16, paddingBottom: 6, paddingTop: 4, minHeight: 44, maxHeight: 110 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular'
  },

  // Description
  descriptionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 0,
    marginBottom: 0,
  },
  descriptionInput: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 24,
    maxHeight: 200,
    paddingVertical: 4,
  },

  // Divider
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  // Inline Subtasks (compact list when panel is closed)
  inlineSubtasksSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inlineSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  inlineSubtaskCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineSubtaskText: {
    flex: 1,
    fontSize: 15,
  },

  // Attachments
  attachmentSection: {
    paddingVertical: 8,
  },

  // Pills & Suggestions
  pillsRow: { marginVertical: 8 },
  suggChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  suggTxt: { fontSize: 13 },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolLeft: { flexDirection: 'row', alignItems: 'center' },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14 },

  // Nested subtasks in composer
  nestedContainer: {
    borderWidth: StyleSheet.hairlineWidth, borderTopWidth: 0,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    paddingHorizontal: 10, paddingTop: 4, paddingBottom: 8, marginBottom: 4,
  },
  nestedChildRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  nestedLine: { width: 2, height: 16, borderRadius: 1, marginLeft: 4 },
  addChildInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6 },
  addChildInput: { flex: 1, fontSize: 13, paddingVertical: 5, paddingHorizontal: 8, borderWidth: 1, borderRadius: 8 },
  addMoreNested: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 6, paddingLeft: 4 },
  addMoreNestedTxt: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});
