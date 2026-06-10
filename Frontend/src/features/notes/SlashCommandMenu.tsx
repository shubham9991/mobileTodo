/**
 * SlashCommandMenu — Native React Native modal shown when user types "/"
 * in the Lexical editor. Displays 33 block/insert options in grouped sections.
 *
 * On item tap:
 *   1. Sends DELETE_SLASH to remove the "/" character from the editor.
 *   2. Sends the corresponding command to execute the action.
 *   3. Closes itself.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// ── Types ─────────────────────────────────────────────────────────────────────
export type SlashAction = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  section: string;
  /** What to do when tapped — either a fixed command or a special handler key */
  command: string;
  payload?: string;
};

// ── All 33 commands ───────────────────────────────────────────────────────────
const SLASH_ITEMS: SlashAction[] = [
  // Text
  { section: 'Text', label: 'Paragraph',     icon: 'subject',          command: 'SET_PARAGRAPH' },
  { section: 'Text', label: 'Heading 1',     icon: 'title',            command: 'SET_HEADING',  payload: 'h1' },
  { section: 'Text', label: 'Heading 2',     icon: 'title',            command: 'SET_HEADING',  payload: 'h2' },
  { section: 'Text', label: 'Heading 3',     icon: 'title',            command: 'SET_HEADING',  payload: 'h3' },
  { section: 'Text', label: 'Quote',         icon: 'format-quote',     command: 'SET_QUOTE' },
  { section: 'Text', label: 'Code Block',    icon: 'code',             command: 'SET_CODE' },
  // Lists
  { section: 'Lists', label: 'Bulleted List',  icon: 'format-list-bulleted', command: 'INSERT_UL' },
  { section: 'Lists', label: 'Numbered List',  icon: 'format-list-numbered', command: 'INSERT_OL' },
  { section: 'Lists', label: 'Check List',     icon: 'check-box',           command: 'INSERT_CHECK' },
  // Insert
  { section: 'Insert', label: 'Table',         icon: 'table-chart',     command: '__TABLE_MODAL__' },
  { section: 'Insert', label: 'Poll',          icon: 'poll',            command: 'INSERT_POLL' },
  { section: 'Insert', label: 'Divider',       icon: 'horizontal-rule', command: 'INSERT_HR' },
  { section: 'Insert', label: 'Page Break',    icon: 'insert-page-break', command: 'INSERT_PAGE_BREAK' },
  { section: 'Insert', label: 'Image',         icon: 'image',           command: '__IMAGE__' },
  { section: 'Insert', label: 'Collapsible',   icon: 'unfold-more',     command: 'INSERT_COLLAPSIBLE' },
  { section: 'Insert', label: 'Equation',      icon: 'functions',       command: '__EQUATION__' },
  // Date
  { section: 'Date', label: 'Today',           icon: 'today',           command: '__DATE_TODAY__' },
  { section: 'Date', label: 'Tomorrow',        icon: 'event',           command: '__DATE_TOMORROW__' },
  { section: 'Date', label: 'Yesterday',       icon: 'history',         command: '__DATE_YESTERDAY__' },
  // Media
  { section: 'Media', label: 'Embed YouTube',  icon: 'play-circle-filled', command: '__YOUTUBE__' },
  { section: 'Media', label: 'Embed X / Tweet', icon: 'chat',           command: '__TWEET__' },
  // Layout
  { section: 'Layout', label: 'Columns Layout',  icon: 'view-column',   command: 'INSERT_COLUMNS' },
  { section: 'Layout', label: 'Align Left',      icon: 'format-align-left',    command: 'FORMAT_ELEMENT', payload: 'left' },
  { section: 'Layout', label: 'Align Center',    icon: 'format-align-center',  command: 'FORMAT_ELEMENT', payload: 'center' },
  { section: 'Layout', label: 'Align Right',     icon: 'format-align-right',   command: 'FORMAT_ELEMENT', payload: 'right' },
  { section: 'Layout', label: 'Align Justify',   icon: 'format-align-justify', command: 'FORMAT_ELEMENT', payload: 'justify' },
];

const SECTIONS = ['Text', 'Lists', 'Insert', 'Date', 'Media', 'Layout'];

// ── Date helpers ──────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function getDateForCommand(command: string): string {
  const today = new Date();
  if (command === '__DATE_TODAY__') return formatDate(today);
  if (command === '__DATE_TOMORROW__') { const t = new Date(today); t.setDate(t.getDate() + 1); return formatDate(t); }
  if (command === '__DATE_YESTERDAY__') { const y = new Date(today); y.setDate(y.getDate() - 1); return formatDate(y); }
  return '';
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface SlashCommandMenuProps {
  visible: boolean;
  onClose: () => void;
  sendCommand: (type: string, payload?: string) => void;
  /** Called when a special action is needed (e.g., __TABLE_MODAL__) */
  onSpecialAction: (action: string) => void;
  isDark: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SlashCommandMenu({ visible, onClose, sendCommand, onSpecialAction, isDark }: SlashCommandMenuProps) {
  const [query, setQuery] = useState('');
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setQuery('');
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const filtered = query.trim()
    ? SLASH_ITEMS.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : SLASH_ITEMS;

  const handleSelect = useCallback((item: SlashAction) => {
    onClose();
    // Small delay: let the menu close animation start, then fire command
    setTimeout(() => {
      // 1. Delete the "/" character the user typed
      sendCommand('DELETE_SLASH');

      // 2. Execute the command
      if (item.command.startsWith('__')) {
        // Special actions need extra native handling
        switch (item.command) {
          case '__TABLE_MODAL__':
            onSpecialAction('TABLE_MODAL');
            break;
          case '__IMAGE__':
            onSpecialAction('INSERT_IMAGE_NATIVE');
            break;
          case '__EQUATION__':
            onSpecialAction('EQUATION_MODAL');
            break;
          case '__YOUTUBE__':
            onSpecialAction('YOUTUBE_MODAL');
            break;
          case '__TWEET__':
            onSpecialAction('TWEET_MODAL');
            break;
          case '__DATE_TODAY__':
          case '__DATE_TOMORROW__':
          case '__DATE_YESTERDAY__':
            sendCommand('INSERT_DATE', getDateForCommand(item.command));
            break;
        }
      } else {
        sendCommand(item.command, item.payload);
      }
    }, 80);
  }, [sendCommand, onClose, onSpecialAction]);

  const colors = isDark ? DARK : LIGHT;

  // Group items by section for rendering
  const sections = SECTIONS.map(sec => ({
    title: sec,
    data: filtered.filter(i => i.section === sec),
  })).filter(s => s.data.length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle bar */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Search */}
        <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
          <MaterialIcons name="search" size={18} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search commands…"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <MaterialIcons name="close" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {/* List */}
        <FlatList
          data={sections}
          keyExtractor={s => s.title}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          renderItem={({ item: section }) => (
            <View>
              <Text style={[styles.sectionHeader, { color: colors.muted }]}>{section.title.toUpperCase()}</Text>
              {section.data.map(item => (
                <Pressable
                  key={item.label}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? colors.pressed : 'transparent' },
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <View style={[styles.iconBox, { backgroundColor: colors.iconBg }]}>
                    <MaterialIcons name={item.icon} size={18} color={colors.accent} />
                  </View>
                  <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
                  <MaterialIcons name="chevron-right" size={16} color={colors.border} />
                </Pressable>
              ))}
            </View>
          )}
          style={{ maxHeight: Dimensions.get('window').height * 0.55 }}
        />
      </Animated.View>
    </Modal>
  );
}

// ── Colors ────────────────────────────────────────────────────────────────────
const LIGHT = {
  card: '#FFFFFF',
  text: '#09090B',
  muted: '#71717A',
  border: '#E4E4E7',
  pressed: 'rgba(99,102,241,0.06)',
  iconBg: 'rgba(99,102,241,0.08)',
  accent: '#6366F1',
};
const DARK = {
  card: '#18181B',
  text: '#FAFAFA',
  muted: '#A1A1AA',
  border: '#3F3F46',
  pressed: 'rgba(129,140,248,0.1)',
  iconBg: 'rgba(129,140,248,0.12)',
  accent: '#818CF8',
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
});
