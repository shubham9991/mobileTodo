/**
 * NoteToolbar — Premium MS Word Mobile–style formatting toolbar
 * for the Lexical editor embedded in a React Native WebView.
 *
 * Layout Architecture:
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  MINI BAR  (floats above keyboard when typing)           │
 *  │  B I U S | ¶ • 1. ✓ | ↩ ↪ | ▲expand                  │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  EXPANDED PANEL  (keyboard dismissed, tap ▲)             │
 *  │  [Home ▾]                          [↩] [↪]   [▼]       │
 *  │  ──────────────────────────────────────────────────────  │
 *  │  [Font Family Selector]            [−][16][+]           │
 *  │  [  B  ] [  I  ] [  U  ] [  ab ]                       │
 *  │  ──────────────────────────────────────────────────────  │
 *  │  🖊  Highlight                                    ›      │
 *  │  A   Font Color                                   ›      │
 *  │  ¶   Paragraph Style                              ›      │
 *  │  Aₓ  Clear Formatting                                    │
 *  └──────────────────────────────────────────────────────────┘
 *
 * Sub-panels replace the main content (not a modal) with a back header.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  Pressable,
  Keyboard,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../themes/ThemeContext';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import type { SelectionState } from './useEditorBridge';
import { ON_DEMAND_FONTS, downloadFont, loadFont, isFontDownloaded } from './fontManager';
import * as Font from 'expo-font';

// ─── Constants ──────────────────────────────────────────────────────────────

/** MS Word Mobile accent — used for active states and navigation labels */
const WORD_BLUE = '#0F6CBD';

const TEXT_COLORS = [
  '#09090B', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#3B82F6', '#6366F1', '#8B5CF6',
  '#EC4899', '#14B8A6', '#FFFFFF', '#71717A',
];

const HIGHLIGHT_COLORS = [
  'rgba(250,204,21,0.65)', 'rgba(239,68,68,0.4)',
  'rgba(59,130,246,0.4)', 'rgba(34,197,94,0.4)',
  'rgba(168,85,247,0.4)', 'rgba(249,115,22,0.4)',
  'rgba(20,184,166,0.4)', 'rgba(236,72,153,0.4)',
];

const FONT_FAMILIES: { id: string; label: string; fontStyle?: string }[] = [
  { id: 'System', label: 'System Default' },
  { id: 'Roboto', label: 'Roboto', fontStyle: 'Roboto_400Regular' },
  { id: 'Montserrat', label: 'Montserrat', fontStyle: 'Montserrat_400Regular' },
  { id: 'Lora', label: 'Lora', fontStyle: 'Lora_400Regular' },
  { id: 'Playfair Display', label: 'Playfair Display', fontStyle: 'PlayfairDisplay_400Regular' },
  { id: 'Georgia', label: 'Georgia', fontStyle: 'Georgia' },
  { id: 'Times New Roman', label: 'Times New Roman', fontStyle: 'Times New Roman' },
  { id: 'Courier New', label: 'Courier New', fontStyle: 'Courier New' },
];

const FONT_SIZES = [
  '10', '11', '12', '13', '14', '15', '16',
  '18', '20', '24', '28', '32', '36', '48', '64', '72',
];

const PARA_STYLES = [
  { id: 'paragraph', label: 'Body Text', icon: 'notes', cmd: 'SET_PARAGRAPH' },
  { id: 'h1', label: 'Heading 1', icon: 'looks-one', cmd: 'SET_HEADING', payload: 'h1' },
  { id: 'h2', label: 'Heading 2', icon: 'looks-two', cmd: 'SET_HEADING', payload: 'h2' },
  { id: 'h3', label: 'Heading 3', icon: 'looks-3', cmd: 'SET_HEADING', payload: 'h3' },
  { id: 'quote', label: 'Block Quote', icon: 'format-quote', cmd: 'SET_QUOTE' },
  { id: 'code', label: 'Code Block', icon: 'code', cmd: 'SET_CODE' },
  { id: 'bullet', label: 'Bulleted List', icon: 'format-list-bulleted', cmd: 'INSERT_UL' },
  { id: 'number', label: 'Numbered List', icon: 'format-list-numbered', cmd: 'INSERT_OL' },
  { id: 'check', label: 'Checklist', icon: 'checklist', cmd: 'INSERT_CHECK' },
];

type TabId = 'home' | 'insert' | 'layout';
type SubPanel = 'none' | 'fontFamily' | 'fontSize' | 'highlight' | 'fontColor' | 'paraStyle';

interface Props {
  sendCommand: (type: string, payload?: string) => void;
  selectionState: SelectionState;
  isEditorReady: boolean;
  onActionTriggered?: (type: string, payload?: string) => void;
  blurWebView?: () => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function NoteToolbar({
  sendCommand,
  selectionState,
  isEditorReady,
  onActionTriggered,
  blurWebView,
}: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

  // Panel state
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [subPanel, setSubPanel] = useState<SubPanel>('none');
  const [showTabDropdown, setShowTabDropdown] = useState(false);

  // Keyboard visibility tracking (for safe bottom padding on Android)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false),
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Modals
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [showEquationModal, setShowEquationModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [equation, setEquation] = useState('');

  // Font download states
  const [downloadedFonts, setDownloadedFonts] = useState<Record<string, boolean>>({});
  const [downloadingFonts, setDownloadingFonts] = useState<Record<string, number>>({});

  // Pre-load on-demand fonts for previews
  useEffect(() => {
    (async () => {
      const toLoad: Record<string, string> = {};
      for (const f of ON_DEMAND_FONTS) {
        if (!Font.isLoaded(f.regularName)) toLoad[f.regularName] = f.regularUrl;
      }
      if (Object.keys(toLoad).length > 0) {
        try { await Font.loadAsync(toLoad); } catch {}
      }
    })();
  }, []);

  // Sync download states
  useEffect(() => {
    (async () => {
      const status: Record<string, boolean> = {};
      for (const font of FONT_FAMILIES) {
        const isOnDemand = ON_DEMAND_FONTS.some(f => f.id === font.id);
        status[font.id] = isOnDemand ? (await isFontDownloaded(font.id)) : true;
      }
      setDownloadedFonts(status);
    })();
  }, []);

  // Helpers
  const cmd = useCallback((type: string, payload?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendCommand(type, payload);
    onActionTriggered?.(type, payload);
  }, [sendCommand, onActionTriggered]);

  const collapse = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExpanded(false);
    setShowTabDropdown(false);
    setSubPanel('none');
  }, []);

  const expand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    blurWebView?.();
    setTimeout(() => {
      setIsExpanded(true);
      setSubPanel('none');
    }, 80);
  }, [blurWebView]);

  const handleFontSelect = async (fontId: string) => {
    if (downloadedFonts[fontId]) {
      cmd('SET_FONT_FAMILY', fontId);
      setSubPanel('none');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDownloadingFonts(prev => ({ ...prev, [fontId]: 0 }));
    const success = await downloadFont(fontId, p => {
      setDownloadingFonts(prev => ({ ...prev, [fontId]: p }));
    });
    if (success) {
      await loadFont(fontId);
      setDownloadedFonts(prev => ({ ...prev, [fontId]: true }));
      cmd('SET_FONT_FAMILY', fontId);
      setSubPanel('none');
    }
    setDownloadingFonts(prev => { const n = { ...prev }; delete n[fontId]; return n; });
  };

  const currentFontSizeNum = parseInt(selectionState.fontSize ?? '16px', 10) || 16;

  const changeFontSize = (delta: number) => {
    const newSize = Math.max(8, Math.min(96, currentFontSizeNum + delta));
    cmd('SET_FONT_SIZE', `${newSize}px`);
  };

  // ─── Derived styles ──────────────────────────────────────────────────────
  const bgPanel   = isDark ? '#111112' : '#FFFFFF';
  const bgHeader  = isDark ? '#1C1C1E' : '#F2F2F7';
  const bgPill    = isDark ? '#2C2C2E' : '#F1F3F5';
  const textPrimary   = isDark ? '#E4E4E7' : '#18181B';
  const textSecondary = isDark ? '#A1A1AA' : '#71717A';
  const borderCol = isDark ? '#3F3F46' : '#E4E4E7';
  const accentBlue = WORD_BLUE;

  // ─── Bottom padding for mini bar ─────────────────────────────────────────
  const miniBarPaddingBottom = isKeyboardVisible
    ? 6
    : Platform.OS === 'android'
      ? (insets.bottom > 0 ? insets.bottom + 6 : 28)
      : Math.max(insets.bottom, 6);

  // ─── Bottom padding for expanded panel ───────────────────────────────────
  const panelPaddingBottom = Platform.OS === 'android'
    ? (insets.bottom > 0 ? insets.bottom + 8 : 24)
    : Math.max(insets.bottom, 8);

  // ─── Tab label helper ─────────────────────────────────────────────────────
  const tabLabel = activeTab === 'home' ? 'Home' : activeTab === 'insert' ? 'Insert' : 'Layout';

  const subPanelTitle = subPanel === 'fontFamily' ? 'Fonts'
    : subPanel === 'fontSize'  ? 'Font Size'
    : subPanel === 'highlight' ? 'Highlight'
    : subPanel === 'fontColor' ? 'Font Color'
    : subPanel === 'paraStyle' ? 'Paragraph Style' : '';

  // ─── Mini Bar ────────────────────────────────────────────────────────────
  const renderMiniBar = () => (
    <KeyboardStickyView offset={{ closed: 0, opened: -(insets.bottom) }}>
      <View style={[styles.miniBar, {
        backgroundColor: bgHeader,
        borderTopColor: borderCol,
        paddingBottom: miniBarPaddingBottom,
      }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.miniScroll}
        >
          {/* Bold */}
          <TouchableOpacity
            style={[styles.miniBtn, selectionState.bold && { backgroundColor: accentBlue + '22' }]}
            onPress={() => cmd('FORMAT_TEXT', 'bold')}
          >
            <Text style={[styles.miniBtnTextBold, { color: selectionState.bold ? accentBlue : textPrimary }]}>B</Text>
          </TouchableOpacity>

          {/* Italic */}
          <TouchableOpacity
            style={[styles.miniBtn, selectionState.italic && { backgroundColor: accentBlue + '22' }]}
            onPress={() => cmd('FORMAT_TEXT', 'italic')}
          >
            <Text style={[styles.miniBtnTextItalic, { color: selectionState.italic ? accentBlue : textPrimary }]}>I</Text>
          </TouchableOpacity>

          {/* Underline */}
          <TouchableOpacity
            style={[styles.miniBtn, selectionState.underline && { backgroundColor: accentBlue + '22' }]}
            onPress={() => cmd('FORMAT_TEXT', 'underline')}
          >
            <Text style={[styles.miniBtnTextUnderline, { color: selectionState.underline ? accentBlue : textPrimary }]}>U</Text>
          </TouchableOpacity>

          {/* Strikethrough */}
          <TouchableOpacity
            style={[styles.miniBtn, selectionState.strikethrough && { backgroundColor: accentBlue + '22' }]}
            onPress={() => cmd('FORMAT_TEXT', 'strikethrough')}
          >
            <Text style={[styles.miniBtnTextStrike, { color: selectionState.strikethrough ? accentBlue : textPrimary }]}>ab</Text>
          </TouchableOpacity>

          <View style={[styles.miniSep, { backgroundColor: borderCol }]} />

          {/* Bullet list */}
          <TouchableOpacity
            style={[styles.miniBtn, selectionState.blockType === 'bullet' && { backgroundColor: accentBlue + '22' }]}
            onPress={() => cmd('INSERT_UL')}
          >
            <MaterialIcons name="format-list-bulleted" size={19} color={selectionState.blockType === 'bullet' ? accentBlue : textPrimary} />
          </TouchableOpacity>

          {/* Numbered list */}
          <TouchableOpacity
            style={[styles.miniBtn, selectionState.blockType === 'number' && { backgroundColor: accentBlue + '22' }]}
            onPress={() => cmd('INSERT_OL')}
          >
            <MaterialIcons name="format-list-numbered" size={19} color={selectionState.blockType === 'number' ? accentBlue : textPrimary} />
          </TouchableOpacity>

          {/* Checklist */}
          <TouchableOpacity
            style={[styles.miniBtn, selectionState.blockType === 'check' && { backgroundColor: accentBlue + '22' }]}
            onPress={() => cmd('INSERT_CHECK')}
          >
            <MaterialIcons name="checklist" size={19} color={selectionState.blockType === 'check' ? accentBlue : textPrimary} />
          </TouchableOpacity>

          <View style={[styles.miniSep, { backgroundColor: borderCol }]} />

          {/* Undo */}
          <TouchableOpacity style={styles.miniBtn} onPress={() => cmd('UNDO')} disabled={!isEditorReady}>
            <MaterialIcons name="undo" size={19} color={isEditorReady ? textPrimary : textSecondary} />
          </TouchableOpacity>

          {/* Redo */}
          <TouchableOpacity style={styles.miniBtn} onPress={() => cmd('REDO')} disabled={!isEditorReady}>
            <MaterialIcons name="redo" size={19} color={isEditorReady ? textPrimary : textSecondary} />
          </TouchableOpacity>
        </ScrollView>

        {/* Expand button */}
        <TouchableOpacity style={styles.miniExpandBtn} onPress={expand}>
          <MaterialIcons name="keyboard-arrow-up" size={24} color={accentBlue} />
        </TouchableOpacity>
      </View>
    </KeyboardStickyView>
  );

  // ─── Expanded Panel Header ────────────────────────────────────────────────
  const renderHeader = () => {
    if (subPanel !== 'none') {
      // Sub-panel back header
      return (
        <View style={[styles.panelHeader, { backgroundColor: bgHeader, borderBottomColor: borderCol }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSubPanel('none')}>
            <MaterialIcons name="arrow-back" size={20} color={textPrimary} />
            <Text style={[styles.backTitle, { color: textPrimary }]}>{subPanelTitle}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.headerIconBtn} onPress={collapse}>
            <MaterialIcons name="keyboard-arrow-down" size={24} color={accentBlue} />
          </TouchableOpacity>
        </View>
      );
    }

    // Main header with tab dropdown
    return (
      <View style={[styles.panelHeader, { backgroundColor: bgHeader, borderBottomColor: borderCol }]}>
        {/* Tab selector */}
        <TouchableOpacity
          style={styles.tabTrigger}
          onPress={() => setShowTabDropdown(v => !v)}
        >
          <Text style={[styles.tabTriggerText, { color: accentBlue }]}>{tabLabel}</Text>
          <MaterialIcons
            name={showTabDropdown ? 'arrow-drop-up' : 'arrow-drop-down'}
            size={20}
            color={accentBlue}
          />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* Undo / Redo / Collapse */}
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => cmd('UNDO')} disabled={!isEditorReady}>
            <MaterialIcons name="undo" size={20} color={isEditorReady ? textPrimary : textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => cmd('REDO')} disabled={!isEditorReady}>
            <MaterialIcons name="redo" size={20} color={isEditorReady ? textPrimary : textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={collapse}>
            <MaterialIcons name="keyboard-arrow-down" size={24} color={accentBlue} />
          </TouchableOpacity>
        </View>

        {/* Tab Dropdown Menu */}
        {showTabDropdown && (
          <View style={[styles.tabDropdown, { backgroundColor: bgHeader, borderColor: borderCol }]}>
            {(['home', 'insert', 'layout'] as TabId[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabDropdownItem, { borderBottomColor: borderCol }]}
                onPress={() => { setActiveTab(tab); setShowTabDropdown(false); }}
              >
                <Text style={[
                  styles.tabDropdownLabel,
                  { color: activeTab === tab ? accentBlue : textPrimary },
                  activeTab === tab && { fontFamily: 'Inter_600SemiBold' },
                ]}>
                  {tab === 'home' ? 'Home' : tab === 'insert' ? 'Insert' : 'Layout'}
                </Text>
                {activeTab === tab && (
                  <MaterialIcons name="check" size={16} color={accentBlue} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ─── Home Tab ─────────────────────────────────────────────────────────────
  const renderHomeTab = () => (
    <View style={styles.homeContent}>

      {/* ── Row 1: Font Selector + Size Stepper ── */}
      <View style={styles.fontControlsRow}>
        {/* Font Family Selector */}
        <TouchableOpacity
          style={[styles.fontFamilyBtn, { backgroundColor: bgPill }]}
          onPress={() => setSubPanel('fontFamily')}
        >
          <Text style={[styles.fontFamilyBtnText, { color: textPrimary }]} numberOfLines={1}>
            {selectionState.fontFamily && selectionState.fontFamily !== 'System'
              ? selectionState.fontFamily
              : 'System Default'}
          </Text>
          <MaterialIcons name="keyboard-arrow-right" size={18} color={textSecondary} />
        </TouchableOpacity>

        {/* Font Size Stepper */}
        <View style={[styles.fontSizeStepper, { backgroundColor: bgPill }]}>
          <TouchableOpacity style={styles.stepperBtn} onPress={() => changeFontSize(-1)}>
            <MaterialIcons name="remove" size={16} color={textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.stepperCenter} onPress={() => setSubPanel('fontSize')}>
            <Text style={[styles.stepperText, { color: textPrimary }]}>{currentFontSizeNum}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stepperBtn} onPress={() => changeFontSize(1)}>
            <MaterialIcons name="add" size={16} color={textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Row 2: Format Buttons (B / I / U / ab) ── */}
      <View style={[styles.formatBtnRow, { gap: 8, paddingHorizontal: 16, marginBottom: 8 }]}>
        {/* B */}
        <TouchableOpacity
          style={[styles.formatBtn, { backgroundColor: selectionState.bold ? (isDark ? '#2D3A4F' : '#D1E8FF') : bgPill }]}
          onPress={() => cmd('FORMAT_TEXT', 'bold')}
        >
          <Text style={[styles.fmtB, { color: selectionState.bold ? accentBlue : textPrimary }]}>B</Text>
        </TouchableOpacity>

        {/* I */}
        <TouchableOpacity
          style={[styles.formatBtn, { backgroundColor: selectionState.italic ? (isDark ? '#2D3A4F' : '#D1E8FF') : bgPill }]}
          onPress={() => cmd('FORMAT_TEXT', 'italic')}
        >
          <Text style={[styles.fmtI, { color: selectionState.italic ? accentBlue : textPrimary }]}>I</Text>
        </TouchableOpacity>

        {/* U */}
        <TouchableOpacity
          style={[styles.formatBtn, { backgroundColor: selectionState.underline ? (isDark ? '#2D3A4F' : '#D1E8FF') : bgPill }]}
          onPress={() => cmd('FORMAT_TEXT', 'underline')}
        >
          <Text style={[styles.fmtU, { color: selectionState.underline ? accentBlue : textPrimary }]}>U</Text>
        </TouchableOpacity>

        {/* ab (strikethrough) */}
        <TouchableOpacity
          style={[styles.formatBtn, { backgroundColor: selectionState.strikethrough ? (isDark ? '#2D3A4F' : '#D1E8FF') : bgPill }]}
          onPress={() => cmd('FORMAT_TEXT', 'strikethrough')}
        >
          <Text style={[styles.fmtAb, { color: selectionState.strikethrough ? accentBlue : textPrimary }]}>ab</Text>
        </TouchableOpacity>

        {/* Superscript */}
        <TouchableOpacity
          style={[styles.formatBtn, { backgroundColor: selectionState.superscript ? (isDark ? '#2D3A4F' : '#D1E8FF') : bgPill }]}
          onPress={() => cmd('FORMAT_TEXT', 'superscript')}
        >
          <Text style={[styles.fmtSup, { color: selectionState.superscript ? accentBlue : textPrimary }]}>x²</Text>
        </TouchableOpacity>

        {/* Subscript */}
        <TouchableOpacity
          style={[styles.formatBtn, { backgroundColor: selectionState.subscript ? (isDark ? '#2D3A4F' : '#D1E8FF') : bgPill }]}
          onPress={() => cmd('FORMAT_TEXT', 'subscript')}
        >
          <Text style={[styles.fmtSub, { color: selectionState.subscript ? accentBlue : textPrimary }]}>x₂</Text>
        </TouchableOpacity>

        {/* Code */}
        <TouchableOpacity
          style={[styles.formatBtn, { backgroundColor: selectionState.code ? (isDark ? '#2D3A4F' : '#D1E8FF') : bgPill }]}
          onPress={() => cmd('FORMAT_TEXT', 'code')}
        >
          <MaterialIcons name="code" size={16} color={selectionState.code ? accentBlue : textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Divider ── */}
      <View style={[styles.divider, { backgroundColor: borderCol }]} />

      {/* ── List Row: Highlight ── */}
      <WordRow
        left={<View style={{ width: 22, alignItems: 'center' }}>
          <MaterialIcons name="border-color" size={18} color={textPrimary} />
          {selectionState.highlight && <View style={[styles.colorBar, { backgroundColor: 'rgba(250,204,21,0.8)' }]} />}
        </View>}
        label="Highlight"
        rightLabel={selectionState.highlight ? 'On' : undefined}
        onPress={() => setSubPanel('highlight')}
        textColor={textPrimary}
        textSecondary={textSecondary}
        borderCol={borderCol}
        accentBlue={accentBlue}
      />

      {/* ── List Row: Font Color ── */}
      <WordRow
        left={<View style={{ width: 22, alignItems: 'center', position: 'relative' }}>
          <MaterialIcons name="format-color-text" size={20} color={textPrimary} />
          <View style={[styles.colorBar, { backgroundColor: '#E53935' }]} />
        </View>}
        label="Font Color"
        onPress={() => setSubPanel('fontColor')}
        textColor={textPrimary}
        textSecondary={textSecondary}
        borderCol={borderCol}
        accentBlue={accentBlue}
      />

      {/* ── List Row: Paragraph Style ── */}
      <WordRow
        left={<View style={{ width: 22, alignItems: 'center' }}>
          <MaterialIcons name="notes" size={20} color={textPrimary} />
        </View>}
        label="Paragraph Style"
        rightLabel={getBlockLabel(selectionState.blockType)}
        onPress={() => setSubPanel('paraStyle')}
        textColor={textPrimary}
        textSecondary={textSecondary}
        borderCol={borderCol}
        accentBlue={accentBlue}
      />

      {/* ── List Row: Clear Formatting ── */}
      <WordRow
        left={<View style={{ width: 22, alignItems: 'center' }}>
          <MaterialIcons name="format-clear" size={20} color={textPrimary} />
        </View>}
        label="Clear Formatting"
        showChevron={false}
        onPress={() => cmd('CLEAR_FORMATTING')}
        textColor={textPrimary}
        textSecondary={textSecondary}
        borderCol={borderCol}
        accentBlue={accentBlue}
      />
    </View>
  );

  // ─── Insert Tab ───────────────────────────────────────────────────────────
  const renderInsertTab = () => (
    <View style={styles.insertGrid}>
      {[
        { icon: 'link', label: 'Link', onPress: () => setShowLinkModal(true) },
        { icon: 'table-chart', label: 'Table', onPress: () => cmd('INSERT_TABLE', '3,3') },
        { icon: 'horizontal-rule', label: 'Divider', onPress: () => cmd('INSERT_HR') },
        { icon: 'expand-more', label: 'Collapsible', onPress: () => cmd('INSERT_COLLAPSIBLE') },
        { icon: 'play-circle-outline', label: 'YouTube', onPress: () => setShowYouTubeModal(true) },
        { icon: 'functions', label: 'Equation', onPress: () => setShowEquationModal(true) },
        { icon: 'check-box-outline-blank', label: 'Checklist', onPress: () => cmd('INSERT_CHECK') },
        { icon: 'format-list-bulleted', label: 'Bullet List', onPress: () => cmd('INSERT_UL') },
        { icon: 'format-list-numbered', label: 'Numbered List', onPress: () => cmd('INSERT_OL') },
      ].map(item => (
        <TouchableOpacity
          key={item.label}
          style={styles.insertItem}
          onPress={item.onPress}
        >
          <View style={[styles.insertIconWrap, { backgroundColor: bgPill }]}>
            <MaterialIcons name={item.icon as any} size={22} color={textPrimary} />
          </View>
          <Text style={[styles.insertLabel, { color: textSecondary }]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── Layout Tab ───────────────────────────────────────────────────────────
  const renderLayoutTab = () => (
    <View style={styles.insertGrid}>
      {[
        { icon: 'format-align-left', label: 'Left', onPress: () => cmd('FORMAT_ELEMENT', 'left'), active: selectionState.align === 'left' },
        { icon: 'format-align-center', label: 'Center', onPress: () => cmd('FORMAT_ELEMENT', 'center'), active: selectionState.align === 'center' },
        { icon: 'format-align-right', label: 'Right', onPress: () => cmd('FORMAT_ELEMENT', 'right'), active: selectionState.align === 'right' },
        { icon: 'format-align-justify', label: 'Justify', onPress: () => cmd('FORMAT_ELEMENT', 'justify'), active: selectionState.align === 'justify' },
        { icon: 'format-indent-increase', label: 'Indent', onPress: () => cmd('INDENT') },
        { icon: 'format-indent-decrease', label: 'Outdent', onPress: () => cmd('OUTDENT') },
      ].map(item => (
        <TouchableOpacity
          key={item.label}
          style={styles.insertItem}
          onPress={item.onPress}
        >
          <View style={[
            styles.insertIconWrap,
            { backgroundColor: item.active ? (isDark ? '#2D3A4F' : '#D1E8FF') : bgPill },
          ]}>
            <MaterialIcons name={item.icon as any} size={22} color={item.active ? accentBlue : textPrimary} />
          </View>
          <Text style={[styles.insertLabel, { color: item.active ? accentBlue : textSecondary }]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── Fonts Sub-Panel ─────────────────────────────────────────────────────
  const renderFontPanel = () => (
    <View>
      {FONT_FAMILIES.map(font => {
        const isActive = selectionState.fontFamily === font.id
          || (font.id === 'System' && (!selectionState.fontFamily || selectionState.fontFamily === 'System'));
        const isDownloaded = downloadedFonts[font.id] ?? false;
        const dlProgress = downloadingFonts[font.id];
        const isDownloading = dlProgress !== undefined;

        return (
          <TouchableOpacity
            key={font.id}
            style={[styles.listRow, { borderBottomColor: borderCol }]}
            onPress={() => handleFontSelect(font.id)}
          >
            <Text style={[
              styles.listRowLabel,
              {
                color: isActive ? accentBlue : textPrimary,
                fontFamily: font.fontStyle,
                fontWeight: isActive ? '700' : '400',
              }
            ]}>
              {font.label}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isDownloading ? (
                <Text style={[styles.downloadPct, { color: accentBlue }]}>
                  {Math.round(dlProgress * 100)}%
                </Text>
              ) : !isDownloaded ? (
                <MaterialIcons name="cloud-download" size={20} color={accentBlue} />
              ) : isActive ? (
                <MaterialIcons name="check" size={20} color={accentBlue} />
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─── Font Size Sub-Panel ─────────────────────────────────────────────────
  const renderFontSizePanel = () => (
    <View>
      {FONT_SIZES.map(sz => {
        const isActive = currentFontSizeNum === parseInt(sz, 10);
        return (
          <TouchableOpacity
            key={sz}
            style={[styles.listRow, { borderBottomColor: borderCol }]}
            onPress={() => { cmd('SET_FONT_SIZE', `${sz}px`); setSubPanel('none'); }}
          >
            <Text style={[
              styles.listRowLabel,
              { color: isActive ? accentBlue : textPrimary },
              isActive && { fontFamily: 'Inter_700Bold' },
            ]}>
              {sz}
            </Text>
            {isActive && <MaterialIcons name="check" size={20} color={accentBlue} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─── Color Sub-Panel ─────────────────────────────────────────────────────
  const renderColorPanel = (type: 'highlight' | 'fontColor') => {
    const colors = type === 'highlight' ? HIGHLIGHT_COLORS : TEXT_COLORS;

    return (
      <View style={styles.colorPanelWrap}>
        {/* Clear / Auto option */}
        <TouchableOpacity
          style={[styles.colorClearBtn, { borderColor: borderCol }]}
          onPress={() => {
            if (type === 'highlight') cmd('SET_HIGHLIGHT_COLOR', '');
            else cmd('SET_TEXT_COLOR', '');
            setSubPanel('none');
          }}
        >
          <MaterialIcons
            name={type === 'highlight' ? 'format-color-reset' : 'brightness-auto'}
            size={22}
            color={textPrimary}
          />
          <Text style={[styles.colorClearLabel, { color: textSecondary }]}>
            {type === 'highlight' ? 'No Fill' : 'Auto'}
          </Text>
        </TouchableOpacity>

        <View style={styles.colorGrid}>
          {colors.map(color => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorSwatch,
                {
                  backgroundColor: color,
                  borderColor: borderCol,
                  borderWidth: color.toLowerCase() === '#ffffff' ? 1.5 : 0,
                }
              ]}
              onPress={() => {
                if (type === 'highlight') cmd('SET_HIGHLIGHT_COLOR', color);
                else cmd('SET_TEXT_COLOR', color);
                setSubPanel('none');
              }}
            />
          ))}
        </View>
      </View>
    );
  };

  // ─── Paragraph Style Sub-Panel ───────────────────────────────────────────
  const renderParaStylePanel = () => (
    <View>
      {PARA_STYLES.map(style => {
        const isActive = selectionState.blockType === style.id;
        return (
          <TouchableOpacity
            key={style.id}
            style={[styles.listRow, { borderBottomColor: borderCol }]}
            onPress={() => {
              if (style.payload) cmd(style.cmd, style.payload);
              else cmd(style.cmd);
              setSubPanel('none');
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <MaterialIcons name={style.icon as any} size={20} color={isActive ? accentBlue : textPrimary} />
              <Text style={[
                styles.listRowLabel,
                { color: isActive ? accentBlue : textPrimary },
                isActive && { fontFamily: 'Inter_700Bold' },
              ]}>
                {style.label}
              </Text>
            </View>
            {isActive && <MaterialIcons name="check" size={20} color={accentBlue} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─── Panel Content ────────────────────────────────────────────────────────
  const renderPanelContent = () => {
    if (subPanel === 'fontFamily') return renderFontPanel();
    if (subPanel === 'fontSize') return renderFontSizePanel();
    if (subPanel === 'highlight') return renderColorPanel('highlight');
    if (subPanel === 'fontColor') return renderColorPanel('fontColor');
    if (subPanel === 'paraStyle') return renderParaStylePanel();

    // Main tabs
    if (activeTab === 'home') return renderHomeTab();
    if (activeTab === 'insert') return renderInsertTab();
    if (activeTab === 'layout') return renderLayoutTab();
    return null;
  };

  // ─── Modal helpers ────────────────────────────────────────────────────────
  function ModalCard({ children }: { children: React.ReactNode }) {
    return (
      <Modal visible transparent animationType="fade">
        <Pressable
          style={[styles.modalOverlay]}
          onPress={() => { setShowLinkModal(false); setShowYouTubeModal(false); setShowEquationModal(false); }}
        >
          <Pressable>
            <View style={[styles.modalCard, { backgroundColor: bgHeader, borderColor: borderCol }]}>
              {children}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Mini Bar */}
      {!isExpanded && renderMiniBar()}

      {/* Expanded Panel */}
      {isExpanded && (
        <View style={[styles.expandedPanel, {
          backgroundColor: bgPanel,
          borderTopColor: borderCol,
          paddingBottom: panelPaddingBottom,
        }]}>
          {renderHeader()}

          <ScrollView
            style={styles.panelScroll}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            {renderPanelContent()}
          </ScrollView>
        </View>
      )}

      {/* ── Link Modal ── */}
      {showLinkModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowLinkModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowLinkModal(false)}>
            <Pressable>
              <View style={[styles.modalCard, { backgroundColor: bgHeader, borderColor: borderCol }]}>
                <Text style={[styles.modalTitle, { color: textPrimary }]}>Insert Link</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: bgPanel, borderColor: borderCol, color: textPrimary }]}
                  placeholder="https://…"
                  placeholderTextColor={textSecondary}
                  value={linkUrl}
                  onChangeText={setLinkUrl}
                  autoFocus
                  keyboardType="url"
                  autoCapitalize="none"
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={[styles.modalCancelBtn, { backgroundColor: borderCol }]}
                    onPress={() => setShowLinkModal(false)}
                  >
                    <Text style={{ color: textSecondary, fontFamily: 'Inter_500Medium' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalOkBtn, { backgroundColor: accentBlue }]}
                    onPress={() => { cmd('TOGGLE_LINK', linkUrl); setLinkUrl(''); setShowLinkModal(false); }}
                  >
                    <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Insert</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── YouTube Modal ── */}
      {showYouTubeModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowYouTubeModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowYouTubeModal(false)}>
            <Pressable>
              <View style={[styles.modalCard, { backgroundColor: bgHeader, borderColor: borderCol }]}>
                <Text style={[styles.modalTitle, { color: textPrimary }]}>Embed YouTube</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: bgPanel, borderColor: borderCol, color: textPrimary }]}
                  placeholder="https://youtube.com/watch?v=…"
                  placeholderTextColor={textSecondary}
                  value={youtubeUrl}
                  onChangeText={setYoutubeUrl}
                  autoFocus
                  keyboardType="url"
                  autoCapitalize="none"
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={[styles.modalCancelBtn, { backgroundColor: borderCol }]}
                    onPress={() => setShowYouTubeModal(false)}
                  >
                    <Text style={{ color: textSecondary, fontFamily: 'Inter_500Medium' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalOkBtn, { backgroundColor: '#FF0000' }]}
                    onPress={() => {
                      const id = extractYouTubeId(youtubeUrl);
                      if (id) { cmd('INSERT_YOUTUBE', id); setYoutubeUrl(''); setShowYouTubeModal(false); }
                    }}
                  >
                    <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Embed</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Equation Modal ── */}
      {showEquationModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowEquationModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowEquationModal(false)}>
            <Pressable>
              <View style={[styles.modalCard, { backgroundColor: bgHeader, borderColor: borderCol }]}>
                <Text style={[styles.modalTitle, { color: textPrimary }]}>LaTeX Equation</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: bgPanel, borderColor: borderCol, color: textPrimary }]}
                  placeholder="e.g. \frac{1}{2}mv^2"
                  placeholderTextColor={textSecondary}
                  value={equation}
                  onChangeText={setEquation}
                  autoFocus
                  autoCapitalize="none"
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={[styles.modalCancelBtn, { backgroundColor: borderCol }]}
                    onPress={() => setShowEquationModal(false)}
                  >
                    <Text style={{ color: textSecondary, fontFamily: 'Inter_500Medium' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalOkBtn, { backgroundColor: accentBlue }]}
                    onPress={() => {
                      cmd('INSERT_EQUATION', JSON.stringify({ equation, inline: false }));
                      setEquation('');
                      setShowEquationModal(false);
                    }}
                  >
                    <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Insert</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getBlockLabel(blockType: string): string {
  switch (blockType) {
    case 'h1': return 'Heading 1';
    case 'h2': return 'Heading 2';
    case 'h3': return 'Heading 3';
    case 'quote': return 'Quote';
    case 'code': return 'Code';
    case 'bullet': return 'Bullet';
    case 'number': return 'Numbered';
    case 'check': return 'Checklist';
    default: return 'Body';
  }
}

// ─── WordRow Sub-Component ────────────────────────────────────────────────────

interface WordRowProps {
  left: React.ReactNode;
  label: string;
  onPress: () => void;
  textColor: string;
  textSecondary: string;
  borderCol: string;
  accentBlue: string;
  rightLabel?: string;
  showChevron?: boolean;
}

function WordRow({
  left, label, onPress, textColor, textSecondary, borderCol, accentBlue,
  rightLabel, showChevron = true,
}: WordRowProps) {
  return (
    <TouchableOpacity
      style={[styles.wordRow, { borderBottomColor: borderCol }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.wordRowLeft}>
        {left}
        <Text style={[styles.wordRowLabel, { color: textColor }]}>{label}</Text>
      </View>
      <View style={styles.wordRowRight}>
        {rightLabel && (
          <Text style={[styles.wordRowRightLabel, { color: accentBlue }]}>{rightLabel}</Text>
        )}
        {showChevron && (
          <MaterialIcons name="keyboard-arrow-right" size={20} color={textSecondary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Mini Bar ──
  miniBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  miniScroll: {
    alignItems: 'center',
    gap: 2,
    paddingRight: 10,
  },
  miniBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtnTextBold: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  miniBtnTextItalic: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    fontStyle: 'italic',
  },
  miniBtnTextUnderline: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    textDecorationLine: 'underline',
  },
  miniBtnTextStrike: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textDecorationLine: 'line-through',
  },
  miniSep: {
    width: 1,
    height: 22,
    marginHorizontal: 5,
    borderRadius: 1,
  },
  miniExpandBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },

  // ── Expanded Panel ──
  expandedPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    minHeight: 280,
  },
  panelHeader: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    zIndex: 10,
  },
  tabTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  tabTriggerText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab Dropdown
  tabDropdown: {
    position: 'absolute',
    top: 46,
    left: 10,
    minWidth: 140,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    zIndex: 100,
  },
  tabDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabDropdownLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },

  // Back header (sub-panels)
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.3,
  },

  // Panel scroll area
  panelScroll: {
    flex: 1,
  },

  // ── Home Tab ──
  homeContent: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  fontControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 10,
  },
  fontFamilyBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  fontFamilyBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  fontSizeStepper: {
    width: 104,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stepperBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCenter: {
    width: 36,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },

  // Format Buttons
  formatBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formatBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fmtB: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  fmtI: {
    fontSize: 17,
    fontFamily: 'Inter_500Medium',
    fontStyle: 'italic',
  },
  fmtU: {
    fontSize: 17,
    fontFamily: 'Inter_500Medium',
    textDecorationLine: 'underline',
  },
  fmtAb: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textDecorationLine: 'line-through',
  },
  fmtSup: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  fmtSub: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
    marginVertical: 6,
  },

  // Word-style list rows
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  wordRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  wordRowLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  wordRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wordRowRightLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  colorBar: {
    position: 'absolute',
    bottom: -2,
    left: 1,
    right: 1,
    height: 3,
    borderRadius: 2,
  },

  // ── Insert / Layout Grid ──
  insertGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 12,
  },
  insertItem: {
    width: '30%',
    alignItems: 'center',
    gap: 6,
  },
  insertIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insertLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },

  // ── Sub-panel list rows ──
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listRowLabel: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  downloadPct: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },

  // ── Color Panel ──
  colorPanelWrap: {
    padding: 16,
    gap: 16,
  },
  colorClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  colorClearLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  colorSwatch: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    gap: 12,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  modalBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalOkBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
});
