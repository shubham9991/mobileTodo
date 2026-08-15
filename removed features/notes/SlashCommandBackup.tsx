/**
 * BACKUP OF REMOVED FEATURE: Slash Command Menu ("/")
 *
 * This file contains:
 * 1. SlashCommandPlugin (Lexical editor plugin that intercepts "/" keypress and notifies React Native).
 * 2. SlashCommandMenu (Native React Native bottom sheet modal listing commands).
 * 3. DELETE_SLASH command handler.
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
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $getNodeByKey, $isTextNode, LexicalEditor } from 'lexical';

// ─── 1. Lexical Editor Plugin: SlashCommandPlugin ────────────────────────────

export function SlashCommandPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const slashActiveRef = useRef(false);

  useEffect(() => {
    const unregister = editor.registerUpdateListener(({ editorState, dirtyLeaves }) => {
      if (dirtyLeaves.size === 0) return;

      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

        const anchor = selection.anchor;
        const node = $getNodeByKey(anchor.key);
        if (!$isTextNode(node)) return;

        const textBefore = node.getTextContent().slice(0, anchor.offset);
        const isSlashTrigger = textBefore === '/' || textBefore.endsWith(' /') || textBefore.endsWith('\n/');

        if (isSlashTrigger) {
          if (!slashActiveRef.current) {
            slashActiveRef.current = true;
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'SLASH_MENU_OPEN',
            }));
          }
        } else {
          if (slashActiveRef.current) {
            slashActiveRef.current = false;
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'SLASH_MENU_CLOSE',
            }));
          }
        }
      });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && slashActiveRef.current) {
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'SLASH_MENU_CLOSE' }));
        slashActiveRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const handleClose = () => {
      slashActiveRef.current = false;
    };
    (window as any).__slashMenuClose = handleClose;

    return () => {
      unregister();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor]);

  return null;
}

// ─── 2. DELETE_SLASH Command for Lexical App.tsx ─────────────────────────────

export function handleDeleteSlash(editor: LexicalEditor, restoreSelection: () => void) {
  editor.update(() => {
    restoreSelection();
    const sel = $getSelection();
    if ($isRangeSelection(sel) && sel.isCollapsed()) {
      sel.modify('extend', true, 'character');
      sel.deleteCharacter(true);
    }
  });
}

// ─── 3. Native Component: SlashCommandMenu ───────────────────────────────────

export type SlashAction = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  section: string;
  command: string;
  payload?: string;
};

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
  // Layout
  { section: 'Layout', label: 'Align Left',      icon: 'format-align-left',    command: 'FORMAT_ELEMENT', payload: 'left' },
  { section: 'Layout', label: 'Align Center',    icon: 'format-align-center',  command: 'FORMAT_ELEMENT', payload: 'center' },
  { section: 'Layout', label: 'Align Right',     icon: 'format-align-right',   command: 'FORMAT_ELEMENT', payload: 'right' },
  { section: 'Layout', label: 'Align Justify',   icon: 'format-align-justify', command: 'FORMAT_ELEMENT', payload: 'justify' },
];

const SECTIONS = ['Text', 'Lists', 'Insert', 'Layout'];

interface SlashCommandMenuProps {
  visible: boolean;
  onClose: () => void;
  sendCommand: (type: string, payload?: string) => void;
  onSpecialAction: (action: string) => void;
  isDark: boolean;
}

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
    setTimeout(() => {
      sendCommand('DELETE_SLASH');
      if (item.command.startsWith('__')) {
        switch (item.command) {
          case '__TABLE_MODAL__':
            onSpecialAction('TABLE_MODAL');
            break;
          case '__IMAGE__':
            onSpecialAction('INSERT_IMAGE_NATIVE');
            break;
        }
      } else {
        sendCommand(item.command, item.payload);
      }
    }, 80);
  }, [sendCommand, onClose, onSpecialAction]);

  const colors = isDark ? DARK : LIGHT;
  const sections = SECTIONS.map(sec => ({
    title: sec,
    data: filtered.filter(i => i.section === sec),
  })).filter(s => s.data.length > 0);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
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
        </View>
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
                  style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.pressed : 'transparent' }]}
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

const LIGHT = { card: '#FFFFFF', text: '#09090B', muted: '#71717A', border: '#E4E4E7', pressed: 'rgba(99,102,241,0.06)', iconBg: 'rgba(99,102,241,0.08)', accent: '#6366F1' };
const DARK = { card: '#18181B', text: '#FAFAFA', muted: '#A1A1AA', border: '#3F3F46', pressed: 'rgba(129,140,248,0.1)', iconBg: 'rgba(129,140,248,0.12)', accent: '#818CF8' };

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24, elevation: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  sectionHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 15, fontWeight: '400' },
});
