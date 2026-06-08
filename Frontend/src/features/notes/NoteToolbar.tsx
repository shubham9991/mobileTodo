/**
 * NoteToolbar — Faithful Microsoft Word Mobile–style formatting toolbar.
 *
 * Design language:
 *  • Pure white / very light gray surfaces (dark-mode adapted)
 *  • ONE accent color only: #0F6CBD (Word blue) — used only for active states
 *  • All icons are monochrome, same size, same gray — no colors
 *  • Format buttons: equal-width flat pills with hairline border when active
 *  • List rows: iOS-settings style — icon + label + chevron, hairline dividers
 *  • No section labels, no colored badges, no gradients, no glow
 *  • Paragraph style panel shows REAL text-size previews like Word does
 */

import React, { useState, useCallback, useEffect } from 'react';
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
  BackHandler,
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

const WORD_BLUE = '#0F6CBD';

const TEXT_COLORS = [
  '#000000', '#C00000', '#FF0000', '#FF8C00',
  '#FFD700', '#00B050', '#0070C0', '#7030A0',
  '#FFFFFF', '#808080', '#1F3864', '#833C00',
];

const HIGHLIGHT_COLORS = [
  '#FFFF00', '#00FF00', '#00FFFF', '#FF00FF',
  '#0000FF', '#FF0000', '#000080', '#008080',
  '#00FF00', '#800080', '#808000', '#C0C0C0',
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
  '8', '9', '10', '11', '12', '14', '16',
  '18', '20', '22', '24', '26', '28', '36', '48', '72',
];

// Paragraph styles — Word Mobile grid: each card shows pure styled text preview, no sub-label
const PARA_STYLES = [
  { id: 'paragraph', label: 'Normal', cmd: 'SET_PARAGRAPH', previewText: 'AaBbCcDd', subLabel: 'Normal', fontSize: 13, bold: false, italic: false },
  { id: 'h1', label: 'Heading 1', cmd: 'SET_HEADING', payload: 'h1', previewText: 'AaBbCcDd', subLabel: 'Heading 1', fontSize: 17, bold: true, italic: false },
  { id: 'h2', label: 'Heading 2', cmd: 'SET_HEADING', payload: 'h2', previewText: 'AaBbCcDd', subLabel: 'Heading 2', fontSize: 15, bold: true, italic: false },
  { id: 'h3', label: 'Heading 3', cmd: 'SET_HEADING', payload: 'h3', previewText: 'AaBbCcDd', subLabel: 'Heading 3', fontSize: 13, bold: true, italic: false },
  { id: 'quote', label: 'Quote', cmd: 'SET_QUOTE', previewText: 'AaBbCcDd', subLabel: 'Quote', fontSize: 13, bold: false, italic: true },
];

const BULLET_STYLES = [
  { id: 'disc', label: '•  Bullet', lines: ['•  Item one', '•  Item two', '•  Item three'], cmd: 'INSERT_UL' },
  { id: 'circle', label: '○  Circle', lines: ['○  Item one', '○  Item two', '○  Item three'], cmd: 'INSERT_UL' },
  { id: 'square', label: '▪  Square', lines: ['▪  Item one', '▪  Item two', '▪  Item three'], cmd: 'INSERT_UL' },
];

const NUMBERED_STYLES = [
  { id: 'decimal', label: '1.  Numbered', lines: ['1.  Item one', '2.  Item two', '3.  Item three'], cmd: 'INSERT_OL' },
  { id: 'lower-alpha', label: 'a.  Alpha', lines: ['a.  Item one', 'b.  Item two', 'c.  Item three'], cmd: 'INSERT_OL' },
  { id: 'upper-alpha', label: 'A.  Alpha', lines: ['A.  Item one', 'B.  Item two', 'C.  Item three'], cmd: 'INSERT_OL' },
  { id: 'lower-roman', label: 'i.  Roman', lines: ['i.  Item one', 'ii.  Item two', 'iii.  Item three'], cmd: 'INSERT_OL' },
  { id: 'upper-roman', label: 'I.  Roman', lines: ['I.  Item one', 'II.  Item two', 'III.  Item three'], cmd: 'INSERT_OL' },
];

const PAGE_SIZES = [
  { id: 'pageless', label: 'Pageless', desc: 'Infinite scroll' },
  { id: 'a4', label: 'A4', desc: '8.27" × 11.69"' },
  { id: 'letter', label: 'Letter', desc: '8.5" × 11"' },
  { id: 'legal', label: 'Legal', desc: '8.5" × 14"' },
  { id: 'tabloid', label: 'Tabloid', desc: '11" × 17"' },
  { id: 'a3', label: 'A3', desc: '11.69" × 16.54"' },
  { id: 'a5', label: 'A5', desc: '5.83" × 8.27"' },
  { id: 'b4', label: 'B4', desc: '9.84" × 13.90"' },
  { id: 'b5', label: 'B5', desc: '6.93" × 9.84"' },
  { id: 'statement', label: 'Statement', desc: '5.5" × 8.5"' },
  { id: 'executive', label: 'Executive', desc: '7.25" × 10.5"' },
  { id: 'folio', label: 'Folio', desc: '8.5" × 13"' },
];

const MARGIN_OPTIONS = [
  { id: 'narrow', label: 'Narrow', desc: '0.25"' },
  { id: 'normal', label: 'Normal', desc: '0.4"' },
  { id: 'moderate', label: 'Moderate', desc: '0.75"' },
  { id: 'wide', label: 'Wide', desc: '1"' },
];

const LINE_SPACINGS = [
  { id: '1', label: 'Single', desc: '1' },
  { id: '1.15', label: '1.15 Lines', desc: '1.15' },
  { id: '1.5', label: '1.5 Lines', desc: '1.5' },
  { id: '2', label: 'Double', desc: '2' },
  { id: '2.5', label: '2.5 Lines', desc: '2.5' },
  { id: '3', label: 'Triple', desc: '3' },
];

const LANGUAGE_OPTIONS: { id: string; label: string }[] = [
  { id: '', label: 'Plain Text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'css', label: 'CSS' },
  { id: 'html', label: 'HTML' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'c', label: 'C' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'sql', label: 'SQL' },
  { id: 'swift', label: 'Swift' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'objectivec', label: 'Objective-C' },
  { id: 'xml', label: 'XML' },
];

type TabId = 'home' | 'insert' | 'layout';
type SubPanel =
  | 'none' | 'fontFamily' | 'fontSize' | 'highlight' | 'fontColor'
  | 'paraStyle' | 'bulletStyle' | 'numberedStyle' | 'textTransform'
  | 'codeLanguage' | 'pageSize' | 'orientation' | 'margins' | 'lineSpacing';

interface Props {
  sendCommand: (type: string, payload?: string) => void;
  selectionState: SelectionState;
  isEditorReady: boolean;
  onActionTriggered?: (type: string, payload?: string) => void;
  blurWebView?: () => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function NoteToolbar({ sendCommand, selectionState, isEditorReady, onActionTriggered, blurWebView }: Props) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [subPanel, setSubPanel] = useState<SubPanel>('none');
  const [showTabDropdown, setShowTabDropdown] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const [pageSize, setPageSize] = useState('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margins, setMargins] = useState('normal');
  const [lineSpacing, setLineSpacing] = useState('1');

  // Modals
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [showEquationModal, setShowEquationModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showTweetModal, setShowTweetModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [equation, setEquation] = useState('');
  const [tweetUrl, setTweetUrl] = useState('');
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableHoverRow, setTableHoverRow] = useState(3);
  const [tableHoverCol, setTableHoverCol] = useState(3);

  const [downloadedFonts, setDownloadedFonts] = useState<Record<string, boolean>>({});
  const [downloadingFonts, setDownloadingFonts] = useState<Record<string, number>>({});

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setIsKeyboardVisible(true);
      setIsExpanded(false);
      setSubPanel('none');
      setShowTabDropdown(false);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    (async () => {
      const toLoad: Record<string, string> = {};
      for (const f of ON_DEMAND_FONTS) { if (!Font.isLoaded(f.regularName)) toLoad[f.regularName] = f.regularUrl; }
      if (Object.keys(toLoad).length > 0) { try { await Font.loadAsync(toLoad); } catch {} }
    })();
  }, []);

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

  const cmd = useCallback((type: string, payload?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendCommand(type, payload);
    onActionTriggered?.(type, payload);
  }, [sendCommand, onActionTriggered]);

  const collapse = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(false);
    setShowTabDropdown(false);
    setSubPanel('none');
  }, []);

  const expand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    blurWebView?.();
    setTimeout(() => { setIsExpanded(true); setSubPanel('none'); }, 80);
  }, [blurWebView]);

  // ─── Back handler: when sub-panel is open, go to home; else collapse ─────
  useEffect(() => {
    if (!isExpanded) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (subPanel !== 'none') {
        setSubPanel('none');
        return true; // consumed — don't close screen
      }
      collapse();
      return true; // consumed — don't close screen
    });
    return () => handler.remove();
  }, [isExpanded, subPanel, collapse]);

  const sendPageLayout = (overrides: Partial<{ pageSize: string; orientation: string; margins: string; lineSpacing: string }>) => {
    const layout = { pageSize, orientation, margins, lineSpacing, ...overrides };
    sendCommand('PAGE_LAYOUT', JSON.stringify(layout));
  };

  const handleFontSelect = async (fontId: string) => {
    if (downloadedFonts[fontId]) { cmd('SET_FONT_FAMILY', fontId); setSubPanel('none'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDownloadingFonts(prev => ({ ...prev, [fontId]: 0 }));
    const success = await downloadFont(fontId, p => setDownloadingFonts(prev => ({ ...prev, [fontId]: p })));
    if (success) {
      await loadFont(fontId);
      setDownloadedFonts(prev => ({ ...prev, [fontId]: true }));
      cmd('SET_FONT_FAMILY', fontId);
      setSubPanel('none');
    }
    setDownloadingFonts(prev => { const n = { ...prev }; delete n[fontId]; return n; });
  };

  const currentFontSizeNum = parseInt(selectionState.fontSize ?? '16px', 10) || 16;
  const changeFontSize = (delta: number) => cmd('SET_FONT_SIZE', `${Math.max(8, Math.min(96, currentFontSizeNum + delta))}px`);

  // ─── Color tokens — Word-faithful ────────────────────────────────────────
  // Light: pure white surfaces, #F5F5F5 secondary, #E8E8E8 borders
  // Dark:  #1C1C1E surfaces, #2C2C2E secondary, #3A3A3C borders
  const surface    = isDark ? '#1C1C1E' : '#FFFFFF';
  const surfaceSub = isDark ? '#2C2C2E' : '#F5F5F5';
  const border     = isDark ? '#3A3A3C' : '#E0E0E0';
  const borderHair = isDark ? '#2E2E30' : '#EBEBEB';
  const textPri    = isDark ? '#EBEBF5' : '#111111';
  const textSec    = isDark ? '#8E8E93' : '#888888';
  const blue       = WORD_BLUE;

  const miniPb = isKeyboardVisible ? 4 : Platform.OS === 'android' ? (insets.bottom > 0 ? insets.bottom + 4 : 24) : Math.max(insets.bottom, 4);
  const panelPb = Platform.OS === 'android' ? (insets.bottom > 0 ? insets.bottom + 6 : 20) : Math.max(insets.bottom, 6);

  const subPanelTitle: Record<SubPanel, string> = {
    none: '', fontFamily: 'Font', fontSize: 'Font Size',
    highlight: 'Highlight Color', fontColor: 'Text Color',
    paraStyle: 'Styles', bulletStyle: 'Bullet List', numberedStyle: 'Numbered List',
    textTransform: 'Change Case', codeLanguage: 'Language',
    pageSize: 'Page Size', orientation: 'Orientation', margins: 'Margins', lineSpacing: 'Line Spacing',
  };

  // ─── Code Mini Bar ────────────────────────────────────────────────────────
  const renderCodeMiniBar = () => {
    const langLabel = LANGUAGE_OPTIONS.find(l => l.id === (selectionState.codeLanguage || ''))?.label ?? 'Plain Text';
    return (
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View style={[S.miniBar, { backgroundColor: surface, borderTopColor: border, paddingBottom: miniPb }]}>
          <TouchableOpacity
            style={[S.langPill, { borderColor: blue }]}
            onPress={() => { blurWebView?.(); setTimeout(() => { setIsExpanded(true); setSubPanel('codeLanguage'); }, 80); }}
          >
            <MaterialIcons name="code" size={14} color={blue} />
            <Text style={[S.langPillText, { color: blue }]} numberOfLines={1}>{langLabel}</Text>
            <MaterialIcons name="keyboard-arrow-right" size={14} color={blue} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <MiniBtn icon="format-indent-decrease" onPress={() => cmd('OUTDENT')} color={textPri} />
          <MiniBtn icon="format-indent-increase" onPress={() => cmd('INDENT')} color={textPri} />
          <MiniSep color={border} />
          <MiniBtn icon="undo" onPress={() => cmd('UNDO')} color={isEditorReady ? textPri : textSec} disabled={!isEditorReady} />
          <MiniBtn icon="redo" onPress={() => cmd('REDO')} color={isEditorReady ? textPri : textSec} disabled={!isEditorReady} />
          <MiniSep color={border} />
          <MiniBtn icon="content-copy" onPress={() => cmd('COPY_CODE')} color={textPri} />
          <MiniBtn icon="file-download" onPress={() => cmd('DOWNLOAD_CODE')} color={textPri} />
          <MiniExpandBtn onPress={expand} blue={blue} surface={surfaceSub} />
        </View>
      </KeyboardStickyView>
    );
  };

  // ─── Mini Bar ─────────────────────────────────────────────────────────────
  const renderMiniBar = () => (
    <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
      <View style={[S.miniBar, { backgroundColor: surface, borderTopColor: border, paddingBottom: miniPb }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={S.miniScroll}>
          {/* B */}
          <MiniFormatBtn active={selectionState.bold} onPress={() => cmd('FORMAT_TEXT', 'bold')} blue={blue} surface={surfaceSub}>
            <Text style={[S.miniB, { color: selectionState.bold ? blue : textPri }]}>B</Text>
          </MiniFormatBtn>
          {/* I */}
          <MiniFormatBtn active={selectionState.italic} onPress={() => cmd('FORMAT_TEXT', 'italic')} blue={blue} surface={surfaceSub}>
            <Text style={[S.miniI, { color: selectionState.italic ? blue : textPri }]}>I</Text>
          </MiniFormatBtn>
          {/* U */}
          <MiniFormatBtn active={selectionState.underline} onPress={() => cmd('FORMAT_TEXT', 'underline')} blue={blue} surface={surfaceSub}>
            <Text style={[S.miniU, { color: selectionState.underline ? blue : textPri }]}>U</Text>
          </MiniFormatBtn>
          {/* S */}
          <MiniFormatBtn active={selectionState.strikethrough} onPress={() => cmd('FORMAT_TEXT', 'strikethrough')} blue={blue} surface={surfaceSub}>
            <Text style={[S.miniS, { color: selectionState.strikethrough ? blue : textPri }]}>S</Text>
          </MiniFormatBtn>
          <MiniSep color={border} />
          {/* Bullet */}
          <MiniFormatBtn active={selectionState.blockType === 'bullet'} onPress={() => cmd('INSERT_UL')} blue={blue} surface={surfaceSub}>
            <MaterialIcons name="format-list-bulleted" size={20} color={selectionState.blockType === 'bullet' ? blue : textPri} />
          </MiniFormatBtn>
          {/* Numbered */}
          <MiniFormatBtn active={selectionState.blockType === 'number'} onPress={() => cmd('INSERT_OL')} blue={blue} surface={surfaceSub}>
            <MaterialIcons name="format-list-numbered" size={20} color={selectionState.blockType === 'number' ? blue : textPri} />
          </MiniFormatBtn>
          {/* Check */}
          <MiniFormatBtn active={selectionState.blockType === 'check'} onPress={() => cmd('INSERT_CHECK')} blue={blue} surface={surfaceSub}>
            <MaterialIcons name="checklist" size={20} color={selectionState.blockType === 'check' ? blue : textPri} />
          </MiniFormatBtn>
          <MiniSep color={border} />
          <MiniBtn icon="undo" onPress={() => cmd('UNDO')} color={isEditorReady ? textPri : textSec} disabled={!isEditorReady} />
          <MiniBtn icon="redo" onPress={() => cmd('REDO')} color={isEditorReady ? textPri : textSec} disabled={!isEditorReady} />
        </ScrollView>
        <MiniExpandBtn onPress={expand} blue={blue} surface={surfaceSub} />
      </View>
    </KeyboardStickyView>
  );

  // ─── Panel Header ─────────────────────────────────────────────────────────
  const renderHeader = () => {
    if (subPanel !== 'none') {
      return (
        <View style={[S.header, { backgroundColor: surfaceSub, borderBottomColor: border }]}>
          <TouchableOpacity style={S.backRow} onPress={() => setSubPanel('none')}>
            <MaterialIcons name="arrow-back-ios" size={16} color={blue} />
            <Text style={[S.headerTabText, { color: textPri }]}>{subPanelTitle[subPanel]}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={S.headerIconBtn} onPress={collapse}>
            <MaterialIcons name="keyboard-arrow-down" size={24} color={textSec} />
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={[S.header, { backgroundColor: surfaceSub, borderBottomColor: border }]}>
        <TouchableOpacity style={S.tabTrigger} onPress={() => setShowTabDropdown(v => !v)}>
          <Text style={[S.headerTabText, { color: blue }]}>
            {activeTab === 'home' ? 'Home' : activeTab === 'insert' ? 'Insert' : 'Layout'}
          </Text>
          <MaterialIcons name={showTabDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color={blue} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={S.headerRight}>
          <TouchableOpacity style={S.headerIconBtn} onPress={() => cmd('UNDO')} disabled={!isEditorReady}>
            <MaterialIcons name="undo" size={20} color={isEditorReady ? textPri : textSec} />
          </TouchableOpacity>
          <TouchableOpacity style={S.headerIconBtn} onPress={() => cmd('REDO')} disabled={!isEditorReady}>
            <MaterialIcons name="redo" size={20} color={isEditorReady ? textPri : textSec} />
          </TouchableOpacity>
          <View style={[S.headerSep, { backgroundColor: border }]} />
          <TouchableOpacity style={S.headerIconBtn} onPress={collapse}>
            <MaterialIcons name="keyboard-arrow-down" size={24} color={textSec} />
          </TouchableOpacity>
        </View>

        {showTabDropdown && <Pressable style={S.dropBackdrop} onPress={() => setShowTabDropdown(false)} />}
        {showTabDropdown && (
          <View style={[S.dropdown, { backgroundColor: surface, borderColor: border }]}>
            {(['home', 'insert', 'layout'] as TabId[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[S.dropItem, { borderBottomColor: borderHair }]}
                onPress={() => { setActiveTab(tab); setShowTabDropdown(false); setSubPanel('none'); }}
              >
                <Text style={[S.dropItemText, { color: activeTab === tab ? blue : textPri }]}>
                  {tab === 'home' ? 'Home' : tab === 'insert' ? 'Insert' : 'Layout'}
                </Text>
                {activeTab === tab && <MaterialIcons name="check" size={16} color={blue} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ─── HOME TAB ─────────────────────────────────────────────────────────────
  const renderHomeTab = () => (
    <View>
      {/* Row 1: Font + Size — tap font name opens sub-panel directly (no dropdown) */}
      <View style={[S.fontRow, { borderBottomColor: border }]}>
        <TouchableOpacity
          style={[S.fontPicker, { borderColor: border }]}
          onPress={() => setSubPanel('fontFamily')}
        >
          <MaterialIcons name="text-format" size={16} color={textSec} style={{ marginRight: 6 }} />
          <Text style={[S.fontPickerText, { color: textPri }]} numberOfLines={1}>
            {selectionState.fontFamily && selectionState.fontFamily !== 'System' ? selectionState.fontFamily : 'System Default'}
          </Text>
          <MaterialIcons name="chevron-right" size={16} color={textSec} />
        </TouchableOpacity>
        <View style={[S.sizeStepper, { borderColor: border }]}>
          <TouchableOpacity style={S.stepBtn} onPress={() => changeFontSize(-1)}>
            <MaterialIcons name="remove" size={18} color={textPri} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSubPanel('fontSize')} style={S.sizeCenter}>
            <Text style={[S.sizeText, { color: textPri }]}>{currentFontSizeNum}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.stepBtn} onPress={() => changeFontSize(1)}>
            <MaterialIcons name="add" size={18} color={textPri} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Row 2: Format buttons — B I U S | x² x₂ ⌥ */}
      <View style={[S.fmtRow, { borderBottomColor: border }]}>
        <View style={{ flex: 4, flexDirection: 'row' }}>
          {[
            { fmt: 'bold', active: selectionState.bold, child: <Text style={[S.fB, { color: selectionState.bold ? blue : textPri }]}>B</Text> },
            { fmt: 'italic', active: selectionState.italic, child: <Text style={[S.fI, { color: selectionState.italic ? blue : textPri }]}>I</Text> },
            { fmt: 'underline', active: selectionState.underline, child: <Text style={[S.fU, { color: selectionState.underline ? blue : textPri }]}>U</Text> },
            { fmt: 'strikethrough', active: selectionState.strikethrough, child: <Text style={[S.fS, { color: selectionState.strikethrough ? blue : textPri }]}>S</Text> },
          ].map(({ fmt, active, child }) => (
            <View key={fmt} style={S.gridCell}>
              <TouchableOpacity
                style={[S.fmtBtn, active && { backgroundColor: blue + '15', borderColor: blue + '50', borderWidth: 1 }]}
                onPress={() => cmd('FORMAT_TEXT', fmt)}
              >
                {child}
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={[S.fmtSep, { backgroundColor: border }]} />

        <View style={{ flex: 2, flexDirection: 'row' }}>
          {[
            { fmt: 'superscript', active: selectionState.superscript, label: 'x²' },
            { fmt: 'subscript', active: selectionState.subscript, label: 'x₂' },
          ].map(item => (
            <View key={item.fmt} style={S.gridCell}>
              <TouchableOpacity
                style={[S.fmtBtn, item.active && { backgroundColor: blue + '15', borderColor: blue + '50', borderWidth: 1 }]}
                onPress={() => cmd('FORMAT_TEXT', item.fmt)}
              >
                <Text style={[S.fSup, { color: item.active ? blue : textPri }]}>{item.label}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      {/* Row 3: Alignment */}
      <View style={[S.alignRow, { borderBottomColor: border }]}>
        <View style={{ flex: 4, flexDirection: 'row' }}>
          {[
            { a: 'left', icon: 'format-align-left' },
            { a: 'center', icon: 'format-align-center' },
            { a: 'right', icon: 'format-align-right' },
            { a: 'justify', icon: 'format-align-justify' },
          ].map(({ a, icon }) => (
            <View key={a} style={S.gridCell}>
              <TouchableOpacity
                style={[S.alignBtn, selectionState.align === a && { backgroundColor: blue + '15' }]}
                onPress={() => cmd('FORMAT_ELEMENT', a)}
              >
                <MaterialIcons name={icon as any} size={20} color={selectionState.align === a ? blue : textPri} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={[S.fmtSep, { backgroundColor: border }]} />

        <View style={{ flex: 2, flexDirection: 'row' }}>
          <View style={S.gridCell}>
            <TouchableOpacity style={S.alignBtn} onPress={() => cmd('OUTDENT')}>
              <MaterialIcons name="format-indent-decrease" size={20} color={textPri} />
            </TouchableOpacity>
          </View>
          <View style={S.gridCell}>
            <TouchableOpacity style={S.alignBtn} onPress={() => cmd('INDENT')}>
              <MaterialIcons name="format-indent-increase" size={20} color={textPri} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Word-style list rows */}
      <Row icon="notes" label="Styles" rightText={getBlockLabel(selectionState.blockType)} onPress={() => setSubPanel('paraStyle')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} active={['paragraph','h1','h2','h3','quote'].includes(selectionState.blockType)} />
      <Row icon="format-list-bulleted" label="Bullet List" onPress={() => setSubPanel('bulletStyle')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} active={selectionState.blockType === 'bullet'} />
      <Row icon="format-list-numbered" label="Numbered List" onPress={() => setSubPanel('numberedStyle')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} active={selectionState.blockType === 'number'} />
      <Row icon="checklist" label="Checklist" showChevron={false} onPress={() => cmd('INSERT_CHECK')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} active={selectionState.blockType === 'check'} />
      {/* Inline Code + Code Block — single row 2 column */}
      <View style={[S.codeRow, { borderBottomColor: borderHair }]}>
        <TouchableOpacity
          style={[
            S.codeCell,
            selectionState.code && { backgroundColor: isDark ? '#0F6CBD1F' : '#0F6CBD0A' },
            { borderRightColor: borderHair, borderRightWidth: StyleSheet.hairlineWidth }
          ]}
          onPress={() => cmd('FORMAT_TEXT', 'code')}
          activeOpacity={0.6}
        >
          <MaterialIcons name="code" size={20} color={selectionState.code ? blue : textSec} />
          <Text style={[S.codeCellText, { color: selectionState.code ? blue : textPri }]}>Inline Code</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            S.codeCell,
            selectionState.blockType === 'code' && { backgroundColor: isDark ? '#0F6CBD1F' : '#0F6CBD0A' }
          ]}
          onPress={() => cmd('SET_CODE')}
          activeOpacity={0.6}
        >
          <MaterialIcons name="terminal" size={20} color={selectionState.blockType === 'code' ? blue : textSec} />
          <Text style={[S.codeCellText, { color: selectionState.blockType === 'code' ? blue : textPri }]}>Code Block</Text>
        </TouchableOpacity>
      </View>
      <Row icon="border-color" label="Highlight" rightText={selectionState.highlight ? 'On' : ''} onPress={() => setSubPanel('highlight')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} colorBar="rgba(250,204,21,0.85)" />
      <Row icon="format-color-text" label="Text Color" onPress={() => setSubPanel('fontColor')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} colorBar="#C00000" />
      <Row icon="text-fields" label="Change Case" onPress={() => setSubPanel('textTransform')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} />
      <Row icon="format-clear" label="Clear Formatting" showChevron={false} onPress={() => cmd('CLEAR_FORMATTING')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} />
    </View>
  );

  // ─── INSERT TAB ───────────────────────────────────────────────────────────
  const renderInsertTab = () => {
    const items = [
      { icon: 'table-chart', label: 'Table', onPress: () => setShowTableModal(true) },
      { icon: 'image', label: 'Image', onPress: () => cmd('INSERT_IMAGE_NATIVE') },
      { icon: 'link', label: 'Link', onPress: () => setShowLinkModal(true) },
      { icon: 'horizontal-rule', label: 'H. Rule', onPress: () => cmd('INSERT_HR') },
      { icon: 'insert-page-break', label: 'Page Break', onPress: () => cmd('INSERT_PAGE_BREAK') },
      { icon: 'functions', label: 'Equation', onPress: () => setShowEquationModal(true) },
      { icon: 'play-circle-outline', label: 'YouTube', onPress: () => setShowYouTubeModal(true) },
      { icon: 'alternate-email', label: 'Tweet / X', onPress: () => setShowTweetModal(true) },
      { icon: 'expand-more', label: 'Collapsible', onPress: () => cmd('INSERT_COLLAPSIBLE') },
      { icon: 'today', label: 'Date', onPress: () => cmd('INSERT_DATE', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })) },
      { icon: 'note', label: 'Sticky Note', onPress: () => cmd('INSERT_STICKY_NOTE') },
      { icon: 'view-column', label: 'Columns', onPress: () => cmd('INSERT_COLUMNS') },
    ];
    return (
      <View style={S.insertGrid}>
        {items.map(item => (
          <TouchableOpacity key={item.label} style={[S.insertItem, { borderColor: border }]} onPress={item.onPress}>
            <MaterialIcons name={item.icon as any} size={24} color={textPri} />
            <Text style={[S.insertLabel, { color: textSec }]} numberOfLines={2}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ─── LAYOUT TAB ───────────────────────────────────────────────────────────
  const renderLayoutTab = () => (
    <View>
      {/* Alignment row */}
      <View style={[S.alignRow, { borderBottomColor: border }]}>
        <View style={{ flex: 4, flexDirection: 'row' }}>
          {[
            { a: 'left', icon: 'format-align-left' },
            { a: 'center', icon: 'format-align-center' },
            { a: 'right', icon: 'format-align-right' },
            { a: 'justify', icon: 'format-align-justify' },
          ].map(({ a, icon }) => (
            <View key={a} style={S.gridCell}>
              <TouchableOpacity style={[S.alignBtn, selectionState.align === a && { backgroundColor: blue + '15' }]} onPress={() => cmd('FORMAT_ELEMENT', a)}>
                <MaterialIcons name={icon as any} size={20} color={selectionState.align === a ? blue : textPri} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={[S.fmtSep, { backgroundColor: border }]} />

        <View style={{ flex: 2, flexDirection: 'row' }}>
          <View style={S.gridCell}>
            <TouchableOpacity style={S.alignBtn} onPress={() => cmd('OUTDENT')}>
              <MaterialIcons name="format-indent-decrease" size={20} color={textPri} />
            </TouchableOpacity>
          </View>
          <View style={S.gridCell}>
            <TouchableOpacity style={S.alignBtn} onPress={() => cmd('INDENT')}>
              <MaterialIcons name="format-indent-increase" size={20} color={textPri} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Row icon="article" label="Page Size" rightText={PAGE_SIZES.find(p => p.id === pageSize)?.label ?? 'A4'} onPress={() => setSubPanel('pageSize')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} />
      <Row icon={orientation === 'portrait' ? 'crop-portrait' : 'crop-landscape'} label="Orientation" rightText={orientation === 'portrait' ? 'Portrait' : 'Landscape'} onPress={() => setSubPanel('orientation')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} />
      <Row icon="margin" label="Margins" rightText={MARGIN_OPTIONS.find(m => m.id === margins)?.label ?? 'Normal'} onPress={() => setSubPanel('margins')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} />
      <Row icon="format-line-spacing" label="Line Spacing" rightText={LINE_SPACINGS.find(l => l.id === lineSpacing)?.label ?? 'Single'} onPress={() => setSubPanel('lineSpacing')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} />
    </View>
  );

  // ─── SUB-PANELS ───────────────────────────────────────────────────────────

  const renderFontPanel = () => (
    <View>
      {FONT_FAMILIES.map(font => {
        const isActive = selectionState.fontFamily === font.id || (font.id === 'System' && (!selectionState.fontFamily || selectionState.fontFamily === 'System'));
        const isDownloaded = downloadedFonts[font.id] ?? false;
        const dlProgress = downloadingFonts[font.id];
        return (
          <TouchableOpacity key={font.id} style={[S.listRow, { borderBottomColor: borderHair }]} onPress={() => handleFontSelect(font.id)}>
            <Text style={[S.listRowLabel, { color: isActive ? blue : textPri, fontFamily: font.fontStyle, fontWeight: isActive ? '600' : '400' }]}>
              {font.label}
            </Text>
            {dlProgress !== undefined
              ? <Text style={[S.listRowSub, { color: blue }]}>{Math.round(dlProgress * 100)}%</Text>
              : !isDownloaded
                ? <MaterialIcons name="cloud-download" size={20} color={textSec} />
                : isActive
                  ? <MaterialIcons name="check" size={20} color={blue} />
                  : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderFontSizePanel = () => (
    <View>
      {FONT_SIZES.map(sz => {
        const isActive = currentFontSizeNum === parseInt(sz, 10);
        return (
          <TouchableOpacity key={sz} style={[S.listRow, { borderBottomColor: borderHair }]} onPress={() => { cmd('SET_FONT_SIZE', `${sz}px`); setSubPanel('none'); }}>
            <Text style={[S.listRowLabel, { color: isActive ? blue : textPri, fontWeight: isActive ? '600' : '400' }]}>{sz}</Text>
            {isActive && <MaterialIcons name="check" size={20} color={blue} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderColorPanel = (type: 'highlight' | 'fontColor') => {
    const colors = type === 'highlight' ? HIGHLIGHT_COLORS : TEXT_COLORS;
    return (
      <View style={S.colorWrap}>
        <TouchableOpacity
          style={[S.clearBtn, { borderColor: border }]}
          onPress={() => { type === 'highlight' ? cmd('SET_HIGHLIGHT_COLOR', '') : cmd('SET_TEXT_COLOR', ''); setSubPanel('none'); }}
        >
          <MaterialIcons name={type === 'highlight' ? 'format-color-reset' : 'brightness-auto'} size={20} color={textPri} />
          <Text style={[S.clearBtnText, { color: textSec }]}>{type === 'highlight' ? 'No Highlight' : 'Automatic'}</Text>
        </TouchableOpacity>
        <View style={S.colorGrid}>
          {colors.map((color, i) => (
            <TouchableOpacity
              key={i}
              style={[S.colorSwatch, { backgroundColor: color, borderWidth: color === '#FFFFFF' ? 1 : 0, borderColor: border }]}
              onPress={() => { type === 'highlight' ? cmd('SET_HIGHLIGHT_COLOR', color) : cmd('SET_TEXT_COLOR', color); setSubPanel('none'); }}
            />
          ))}
        </View>
      </View>
    );
  };

  // ─── Para Styles — Word Mobile card grid: styled text only, no sub-label ──
  const renderParaStylePanel = () => (
    <View>
      <View style={S.styleGrid}>
        {PARA_STYLES.map(style => {
          const isActive = selectionState.blockType === style.id;
          return (
            <TouchableOpacity
              key={style.id}
              style={[S.styleCard, { borderColor: isActive ? blue : border, backgroundColor: isActive ? blue + '0D' : surface }]}
              onPress={() => { (style as any).payload ? cmd(style.cmd, (style as any).payload) : cmd(style.cmd); setSubPanel('none'); }}
            >
              <Text style={{
                fontSize: style.fontSize,
                fontFamily: style.bold ? 'Inter_700Bold' : style.italic ? 'Inter_500Medium' : 'Inter_400Regular',
                fontStyle: style.italic ? 'italic' : 'normal',
                color: isActive ? blue : textPri,
                textAlign: 'left',
              }} numberOfLines={2}>
                {style.previewText}
              </Text>
              <Text style={[S.styleCardLabel, { color: isActive ? blue : textSec }]}>{style.subLabel}</Text>
              {isActive && (
                <View style={[S.styleCardCheck, { backgroundColor: blue }]}>
                  <MaterialIcons name="check" size={10} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ─── Bullet Style — 3-card visual grid showing multi-line preview ─────────
  const renderBulletStylePanel = () => (
    <View style={S.listTypeGrid}>
      {BULLET_STYLES.map(style => {
        const isActive = selectionState.blockType === 'bullet';
        return (
          <TouchableOpacity
            key={style.id}
            style={[S.listTypeCard, { borderColor: isActive ? blue : border, backgroundColor: isActive ? blue + '0D' : surface }]}
            onPress={() => { cmd(style.cmd); setSubPanel('none'); }}
          >
            <View style={S.listTypeLines}>
              {style.lines.map((line, i) => (
                <Text key={i} style={[S.listTypeLine, { color: isActive ? blue : textPri }]} numberOfLines={1}>{line}</Text>
              ))}
            </View>
            <Text style={[S.listTypeLabel, { color: isActive ? blue : textSec }]}>{style.label}</Text>
            {isActive && (
              <View style={[S.styleCardCheck, { backgroundColor: blue }]}>
                <MaterialIcons name="check" size={10} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─── Numbered Style — 5-card grid ────────────────────────────────────────
  const renderNumberedStylePanel = () => (
    <View>
      <View style={S.listTypeGrid}>
        {NUMBERED_STYLES.map(style => {
          const isActive = selectionState.blockType === 'number';
          return (
            <TouchableOpacity
              key={style.id}
              style={[S.listTypeCard, { borderColor: isActive ? blue : border, backgroundColor: isActive ? blue + '0D' : surface }]}
              onPress={() => { cmd(style.cmd); setSubPanel('none'); }}
            >
              <View style={S.listTypeLines}>
                {style.lines.map((line, i) => (
                  <Text key={i} style={[S.listTypeLine, { color: isActive ? blue : textPri }]} numberOfLines={1}>{line}</Text>
                ))}
              </View>
              <Text style={[S.listTypeLabel, { color: isActive ? blue : textSec }]}>{style.label}</Text>
              {isActive && (
                <View style={[S.styleCardCheck, { backgroundColor: blue }]}>
                  <MaterialIcons name="check" size={10} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ─── Change Case — large visual tiles ────────────────────────────────────
  const renderTextTransformPanel = () => (
    <View style={{ padding: 12, gap: 10 }}>
      {[
        { id: 'uppercase', display: 'AA', title: 'UPPERCASE', desc: 'ALL LETTERS CAPITALIZED' },
        { id: 'lowercase', display: 'aa', title: 'lowercase', desc: 'all letters lowercase' },
        { id: 'capitalize', display: 'Aa', title: 'Capitalize Each Word', desc: 'Title Case' },
      ].map(t => (
        <TouchableOpacity
          key={t.id}
          style={[S.caseCard, { borderColor: border, backgroundColor: surface }]}
          onPress={() => { cmd('TEXT_TRANSFORM', t.id); setSubPanel('none'); }}
          activeOpacity={0.7}
        >
          <View style={[S.caseIconBox, { backgroundColor: surfaceSub }]}>
            <Text style={[S.caseIconText, { color: blue }]}>{t.display}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[S.caseTitle, { color: textPri }]}>{t.title}</Text>
            <Text style={[S.caseDesc, { color: textSec }]}>{t.desc}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={textSec} />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCodeLangPanel = () => (
    <View>
      {LANGUAGE_OPTIONS.map(lang => {
        const isActive = (selectionState.codeLanguage || '') === lang.id;
        return (
          <TouchableOpacity key={lang.id || '__plain__'} style={[S.listRow, { borderBottomColor: borderHair }]} onPress={() => { cmd('SET_CODE_LANGUAGE', lang.id); setSubPanel('none'); setIsExpanded(false); }}>
            <Text style={[S.listRowLabel, { color: isActive ? blue : textPri, fontWeight: isActive ? '600' : '400' }]}>{lang.label}</Text>
            {isActive && <MaterialIcons name="check" size={20} color={blue} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderPageSizePanel = () => (
    <View>
      {PAGE_SIZES.map(p => {
        const isActive = pageSize === p.id;
        return (
          <TouchableOpacity key={p.id} style={[S.listRow, { borderBottomColor: borderHair }]} onPress={() => { setPageSize(p.id); sendPageLayout({ pageSize: p.id }); setSubPanel('none'); }}>
            <View style={{ flex: 1 }}>
              <Text style={[S.listRowLabel, { color: isActive ? blue : textPri, fontWeight: isActive ? '600' : '400' }]}>{p.label}</Text>
              <Text style={[S.listRowSub, { color: textSec }]}>{p.desc}</Text>
            </View>
            {isActive && <MaterialIcons name="check" size={20} color={blue} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderOrientationPanel = () => (
    <View>
      {(['portrait', 'landscape'] as const).map(o => {
        const isActive = orientation === o;
        return (
          <TouchableOpacity key={o} style={[S.listRow, { borderBottomColor: borderHair }]} onPress={() => { setOrientation(o); sendPageLayout({ orientation: o }); setSubPanel('none'); }}>
            <MaterialIcons name={o === 'portrait' ? 'crop-portrait' : 'crop-landscape'} size={20} color={isActive ? blue : textSec} style={{ marginRight: 12 }} />
            <Text style={[S.listRowLabel, { color: isActive ? blue : textPri, fontWeight: isActive ? '600' : '400' }]}>
              {o === 'portrait' ? 'Portrait' : 'Landscape'}
            </Text>
            {isActive && <MaterialIcons name="check" size={20} color={blue} style={{ marginLeft: 'auto' }} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderMarginsPanel = () => (
    <View>
      {MARGIN_OPTIONS.map(m => {
        const isActive = margins === m.id;
        return (
          <TouchableOpacity key={m.id} style={[S.listRow, { borderBottomColor: borderHair }]} onPress={() => { setMargins(m.id); sendPageLayout({ margins: m.id }); setSubPanel('none'); }}>
            <View style={{ flex: 1 }}>
              <Text style={[S.listRowLabel, { color: isActive ? blue : textPri, fontWeight: isActive ? '600' : '400' }]}>{m.label}</Text>
              <Text style={[S.listRowSub, { color: textSec }]}>{m.desc}</Text>
            </View>
            {isActive && <MaterialIcons name="check" size={20} color={blue} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderLineSpacingPanel = () => (
    <View>
      {LINE_SPACINGS.map(l => {
        const isActive = lineSpacing === l.id;
        return (
          <TouchableOpacity key={l.id} style={[S.listRow, { borderBottomColor: borderHair }]} onPress={() => { setLineSpacing(l.id); sendPageLayout({ lineSpacing: l.id }); setSubPanel('none'); }}>
            <Text style={[S.listRowLabel, { color: isActive ? blue : textPri, fontWeight: isActive ? '600' : '400' }]}>{l.label}</Text>
            {isActive && <MaterialIcons name="check" size={20} color={blue} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─── Panel content router ─────────────────────────────────────────────────
  const renderContent = () => {
    if (subPanel === 'fontFamily') return renderFontPanel();
    if (subPanel === 'fontSize') return renderFontSizePanel();
    if (subPanel === 'highlight') return renderColorPanel('highlight');
    if (subPanel === 'fontColor') return renderColorPanel('fontColor');
    if (subPanel === 'paraStyle') return renderParaStylePanel();
    if (subPanel === 'bulletStyle') return renderBulletStylePanel();
    if (subPanel === 'numberedStyle') return renderNumberedStylePanel();
    if (subPanel === 'textTransform') return renderTextTransformPanel();
    if (subPanel === 'codeLanguage') return renderCodeLangPanel();
    if (subPanel === 'pageSize') return renderPageSizePanel();
    if (subPanel === 'orientation') return renderOrientationPanel();
    if (subPanel === 'margins') return renderMarginsPanel();
    if (subPanel === 'lineSpacing') return renderLineSpacingPanel();
    if (activeTab === 'home') return renderHomeTab();
    if (activeTab === 'insert') return renderInsertTab();
    if (activeTab === 'layout') return renderLayoutTab();
    return null;
  };

  // ─── Table modal ─────────────────────────────────────────────────────────
  const TABLE_MAX = 8;
  const renderTableModal = () => (
    <Modal visible transparent animationType="fade" onRequestClose={() => setShowTableModal(false)}>
      <Pressable style={S.modalOverlay} onPress={() => setShowTableModal(false)}>
        <Pressable>
          <View style={[S.modalCard, { backgroundColor: surface, borderColor: border }]}>
            <Text style={[S.modalTitle, { color: textPri }]}>Insert Table</Text>
            {tableHoverRow > 0 && tableHoverCol > 0 && (
              <Text style={[S.modalSub, { color: blue }]}>{tableHoverRow} × {tableHoverCol}</Text>
            )}
            {/* Visual grid */}
            <View style={S.tGrid}>
              {Array.from({ length: TABLE_MAX }, (_, ri) =>
                Array.from({ length: TABLE_MAX }, (_, ci) => {
                  const r = ri + 1, c = ci + 1;
                  const hl = r <= tableHoverRow && c <= tableHoverCol;
                  return (
                    <TouchableOpacity
                      key={`${r}-${c}`}
                      style={[S.tCell, { borderColor: hl ? blue : border, backgroundColor: hl ? blue + '20' : surfaceSub }]}
                      onPress={() => { setTableRows(r); setTableCols(c); }}
                      onPressIn={() => { setTableHoverRow(r); setTableHoverCol(c); }}
                    />
                  );
                })
              )}
            </View>
            {/* Steppers */}
            <View style={S.tStepperRow}>
              {[{ label: 'Rows', val: tableRows, set: setTableRows }, { label: 'Columns', val: tableCols, set: setTableCols }].map(({ label, val, set }) => (
                <View key={label} style={S.tStepperGroup}>
                  <Text style={[S.tStepLabel, { color: textSec }]}>{label}</Text>
                  <View style={[S.tStepper, { borderColor: border }]}>
                    <TouchableOpacity style={S.tStepBtn} onPress={() => set(v => Math.max(1, v - 1))}>
                      <MaterialIcons name="remove" size={16} color={textPri} />
                    </TouchableOpacity>
                    <Text style={[S.tStepVal, { color: textPri }]}>{val}</Text>
                    <TouchableOpacity style={S.tStepBtn} onPress={() => set(v => Math.min(TABLE_MAX, v + 1))}>
                      <MaterialIcons name="add" size={16} color={textPri} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
            <View style={S.modalBtns}>
              <TouchableOpacity style={[S.modalCancelBtn, { borderColor: border }]} onPress={() => setShowTableModal(false)}>
                <Text style={[S.modalCancelText, { color: textSec }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.modalOkBtn, { backgroundColor: blue }]} onPress={() => { cmd('INSERT_TABLE', `${tableRows},${tableCols}`); setShowTableModal(false); }}>
                <Text style={S.modalOkText}>Insert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ─── Simple input modal ───────────────────────────────────────────────────
  const renderInputModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    onConfirm: () => void,
    confirmLabel: string,
    multiline = false,
    keyboardType: 'default' | 'url' = 'url',
  ) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={S.modalOverlay} onPress={onClose}>
        <Pressable>
          <View style={[S.modalCard, { backgroundColor: surface, borderColor: border }]}>
            <Text style={[S.modalTitle, { color: textPri }]}>{title}</Text>
            <TextInput
              style={[S.modalInput, { borderColor: border, color: textPri, backgroundColor: surfaceSub }]}
              placeholder={placeholder}
              placeholderTextColor={textSec}
              value={value}
              onChangeText={onChange}
              autoFocus
              keyboardType={keyboardType}
              autoCapitalize="none"
              multiline={multiline}
            />
            <View style={S.modalBtns}>
              <TouchableOpacity style={[S.modalCancelBtn, { borderColor: border }]} onPress={onClose}>
                <Text style={[S.modalCancelText, { color: textSec }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.modalOkBtn, { backgroundColor: blue }]} onPress={onConfirm}>
                <Text style={S.modalOkText}>{confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {!isExpanded && selectionState.blockType === 'code' && renderCodeMiniBar()}
      {!isExpanded && selectionState.blockType !== 'code' && renderMiniBar()}

      {isExpanded && (
        <View style={[S.panel, { backgroundColor: surface, borderTopColor: border, paddingBottom: panelPb }]}>
          {renderHeader()}
          <ScrollView style={S.panelScroll} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false} onScrollBeginDrag={() => setShowTabDropdown(false)}>
            {renderContent()}
          </ScrollView>
        </View>
      )}

      {/* Modals */}
      {renderInputModal(showLinkModal, () => setShowLinkModal(false), 'Insert Link', linkUrl, setLinkUrl, 'https://', () => { cmd('TOGGLE_LINK', linkUrl); setLinkUrl(''); setShowLinkModal(false); }, 'Insert')}
      {renderInputModal(showYouTubeModal, () => setShowYouTubeModal(false), 'YouTube Video', youtubeUrl, setYoutubeUrl, 'https://youtube.com/watch?v=…', () => { const id = extractYouTubeId(youtubeUrl); if (id) { cmd('INSERT_YOUTUBE', id); setYoutubeUrl(''); setShowYouTubeModal(false); } }, 'Embed')}
      {renderInputModal(showTweetModal, () => setShowTweetModal(false), 'Tweet / X Post', tweetUrl, setTweetUrl, 'https://x.com/…', () => { cmd('INSERT_TWEET', tweetUrl); setTweetUrl(''); setShowTweetModal(false); }, 'Embed')}
      {renderInputModal(showEquationModal, () => setShowEquationModal(false), 'LaTeX Equation', equation, setEquation, 'e.g. \\frac{1}{2}mv^2', () => { cmd('INSERT_EQUATION', JSON.stringify({ equation, inline: false })); setEquation(''); setShowEquationModal(false); }, 'Insert', true, 'default')}
      {showTableModal && renderTableModal()}
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
    case 'bullet': return 'List Bullet';
    case 'number': return 'List Number';
    case 'check': return 'Checklist';
    default: return 'Normal';
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MiniBtn({ icon, onPress, color, disabled = false }: { icon: string; onPress: () => void; color: string; disabled?: boolean }) {
  return (
    <TouchableOpacity style={S.miniBtn} onPress={onPress} disabled={disabled}>
      <MaterialIcons name={icon as any} size={20} color={color} />
    </TouchableOpacity>
  );
}

function MiniSep({ color }: { color: string }) {
  return <View style={[S.miniSep, { backgroundColor: color }]} />;
}

function MiniFormatBtn({ active, onPress, blue, surface, children }: { active: boolean; onPress: () => void; blue: string; surface: string; children: React.ReactNode }) {
  return (
    <TouchableOpacity style={[S.miniBtn, active && { backgroundColor: blue + '18' }]} onPress={onPress}>
      {children}
    </TouchableOpacity>
  );
}

function MiniExpandBtn({ onPress, blue, surface }: { onPress: () => void; blue: string; surface: string }) {
  return (
    <TouchableOpacity style={[S.miniExpandBtn, { backgroundColor: surface }]} onPress={onPress}>
      <MaterialIcons name="keyboard-arrow-up" size={22} color={blue} />
    </TouchableOpacity>
  );
}

interface RowProps {
  icon: string;
  label: string;
  onPress: () => void;
  textPri: string;
  textSec: string;
  borderCol: string;
  blue: string;
  rightText?: string;
  showChevron?: boolean;
  active?: boolean;
  colorBar?: string;
}

function Row({ icon, label, onPress, textPri, textSec, borderCol, blue, rightText, showChevron = true, active, colorBar }: RowProps) {
  return (
    <TouchableOpacity style={[S.row, { borderBottomColor: borderCol }]} onPress={onPress} activeOpacity={0.6}>
      <View style={S.rowLeft}>
        <View style={S.rowIconWrap}>
          <MaterialIcons name={icon as any} size={20} color={active ? blue : textSec} />
          {colorBar && <View style={[S.rowColorBar, { backgroundColor: colorBar }]} />}
        </View>
        <Text style={[S.rowLabel, { color: active ? blue : textPri }]}>{label}</Text>
      </View>
      <View style={S.rowRight}>
        {rightText ? <Text style={[S.rowRight2, { color: blue }]}>{rightText}</Text> : null}
        {showChevron && <MaterialIcons name="chevron-right" size={20} color={textSec} />}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles — clean, Word-faithful ───────────────────────────────────────────

const S = StyleSheet.create({

  // ── Mini bar ──
  miniBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  miniScroll: {
    alignItems: 'center',
    gap: 1,
    paddingRight: 6,
  },
  miniBtn: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSep: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    marginHorizontal: 4,
  },
  miniExpandBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  miniB: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  miniI: { fontSize: 16, fontFamily: 'Inter_500Medium', fontStyle: 'italic' },
  miniU: { fontSize: 16, fontFamily: 'Inter_500Medium', textDecorationLine: 'underline' },
  miniS: { fontSize: 15, fontFamily: 'Inter_500Medium', textDecorationLine: 'line-through' },

  // Lang pill (code mini bar)
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 160,
  },
  langPillText: { fontSize: 13, fontFamily: 'Inter_500Medium', flexShrink: 1 },

  // ── Expanded panel ──
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 280,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  panelScroll: { flex: 1 },

  // Panel header
  header: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    zIndex: 10,
  },
  tabTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  headerTabText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerSep: { width: StyleSheet.hairlineWidth, height: 18, marginHorizontal: 4 },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  // Tab dropdown
  dropBackdrop: { position: 'absolute', top: 46, left: 0, right: 0, bottom: -800, zIndex: 99 },
  dropdown: {
    position: 'absolute', top: 44, left: 12,
    minWidth: 150, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 2, elevation: 12, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, zIndex: 100,
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropItemText: { fontSize: 14, fontFamily: 'Inter_400Regular' },

  // ── Home: font row ──
  fontRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fontPicker: {
    flex: 1, height: 38, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 6,
  },
  fontPickerText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  sizeStepper: {
    width: 100, height: 38, flexDirection: 'row', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, overflow: 'hidden',
  },
  stepBtn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  sizeCenter: { width: 32, height: '100%', alignItems: 'center', justifyContent: 'center' },
  sizeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // ── Home: format buttons row ──
  fmtRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fmtBtn: {
    width: 38, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
  },
  fmtSep: { width: StyleSheet.hairlineWidth, height: 22, marginHorizontal: 4 },
  fB: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  fI: { fontSize: 17, fontFamily: 'Inter_500Medium', fontStyle: 'italic' },
  fU: { fontSize: 17, fontFamily: 'Inter_500Medium', textDecorationLine: 'underline' },
  fS: { fontSize: 16, fontFamily: 'Inter_600SemiBold', textDecorationLine: 'line-through' },
  fSup: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // ── Home: alignment row ──
  alignRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  alignBtn: { width: 38, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  gridCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Word-style list rows ──
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  rowIconWrap: { width: 24, alignItems: 'center', position: 'relative' },
  rowColorBar: { position: 'absolute', bottom: -3, left: 0, right: 0, height: 3, borderRadius: 2 },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rowRight2: { fontSize: 13, fontFamily: 'Inter_400Regular' },

  // ── Code 2-column row ──
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  codeCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: '100%',
    paddingVertical: 12,
  },
  codeCellText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },

  // ── Insert grid ──
  insertGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 10, paddingVertical: 14, gap: 10,
  },
  insertItem: {
    width: '22%', minWidth: 72,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 8,
  },
  insertLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  // ── Sub-panel list rows ──
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listRowLabel: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  listRowSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },

  // ── Para Styles: Word Mobile card grid ──
  styleGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12,
  },
  styleCard: {
    width: '47%', minHeight: 70, borderWidth: 1.5, borderRadius: 8,
    padding: 10, gap: 4, position: 'relative',
  },
  styleCardLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  styleCardCheck: {
    position: 'absolute', top: 4, right: 4,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── List type card grid (bullet / numbered) ──
  listTypeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12,
  },
  listTypeCard: {
    width: '30%', borderWidth: 1.5, borderRadius: 8,
    padding: 10, gap: 6, position: 'relative',
  },
  listTypeLines: { gap: 3 },
  listTypeLine: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  listTypeLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 2 },

  // ── Change Case cards ──
  caseCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderWidth: 1, borderRadius: 10,
  },
  caseIconBox: {
    width: 48, height: 48, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  caseIconText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  caseTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  caseDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },

  // Bullet/numbered preview (kept for compat)
  bulletPreview: { fontSize: 16, fontFamily: 'Inter_600SemiBold', width: 60 },

  // Style row (legacy, kept for compat)
  styleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 60,
  },

  // ── Color panel ──
  colorWrap: { padding: 16, gap: 16 },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start',
  },
  clearBtnText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorSwatch: { width: 36, height: 36, borderRadius: 4 },

  // ── Table modal ──
  tGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 3,
    alignSelf: 'center', width: 8 * 32 + 7 * 3,
  },
  tCell: { width: 32, height: 32, borderRadius: 3, borderWidth: 1 },
  tStepperRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 8 },
  tStepperGroup: { alignItems: 'center', gap: 4 },
  tStepLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  tStepper: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, overflow: 'hidden', width: 96, height: 36 },
  tStepBtn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  tStepVal: { width: 32, textAlign: 'center', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // ── Modals ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', maxWidth: 360,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    padding: 20, gap: 14,
    elevation: 12, shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16,
  },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: -6 },
  modalInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'Inter_400Regular',
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  modalCancelBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  modalCancelText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  modalOkBtn: { paddingVertical: 9, paddingHorizontal: 18, borderRadius: 8 },
  modalOkText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
