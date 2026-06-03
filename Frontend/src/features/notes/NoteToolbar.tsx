/**
 * NoteToolbar — native React Native formatting toolbar.
 *
 * Architecture:
 *   3 tabs: FORMAT | INSERT | ALIGN
 *   All buttons call sendCommand() which fires injectJavaScript into the WebView.
 *   selectionState.bold/italic/etc drive active-state highlighting.
 *   selectionState.blockType drives the block type indicator.
 *
 * The toolbar is rendered BELOW the WebView in the same flex column,
 * so it naturally sits above the Android software keyboard when the
 * WebView resizes (softwareKeyboardLayoutAdjustment="resize").
 */
import React, { useState, useCallback } from 'react';
import {
  View, TouchableOpacity, ScrollView, StyleSheet,
  Text, Animated, Modal, TextInput, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import { SelectionState } from './useEditorBridge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Color palette for text/highlight color picker ─────────────────────────────
const TEXT_COLORS = [
  '#09090B', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#3B82F6', '#6366F1', '#8B5CF6',
  '#EC4899', '#14B8A6', '#FFFFFF', '#71717A',
];
const HIGHLIGHT_COLORS = [
  'rgba(250,204,21,0.4)', 'rgba(239,68,68,0.3)', 'rgba(59,130,246,0.3)',
  'rgba(34,197,94,0.3)', 'rgba(168,85,247,0.3)', 'rgba(249,115,22,0.3)',
];

interface ToolbarProps {
  sendCommand: (type: string, payload?: string) => void;
  selectionState: SelectionState;
  isEditorReady: boolean;
  onActionTriggered?: (type: string, payload?: string) => void;
}

type TabId = 'format' | 'insert' | 'align';

export function NoteToolbar({ sendCommand, selectionState, isEditorReady, onActionTriggered }: ToolbarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabId>('format');
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'highlight' | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [showEquationModal, setShowEquationModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [equation, setEquation] = useState('');

  const cmd = useCallback((type: string, payload?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendCommand(type, payload);
    onActionTriggered?.(type, payload);
  }, [sendCommand, onActionTriggered]);

  // Styles
  const c = theme.colors;
  const activeBtn = { backgroundColor: c.primary + '22', borderColor: c.primary };
  const inactiveBtn = { backgroundColor: 'transparent', borderColor: c.border };
  const btn = (active: boolean) => ({ ...styles.btn, ...(active ? activeBtn : inactiveBtn) });
  const iconColor = (active: boolean) => active ? c.primary : c.text;
  const textStyle = { color: c.text, fontFamily: 'Inter_600SemiBold' as const };

  // Block type badge
  const blockLabels: Record<string, string> = {
    paragraph: '¶', h1: 'H1', h2: 'H2', h3: 'H3',
    quote: '❝', code: '<>', bullet: '•', number: '1.', check: '☑',
  };
  const blockLabel = blockLabels[selectionState.blockType] ?? '¶';

  const extractYouTubeId = (url: string): string | null => {
    const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  return (
    <>
      <View style={[styles.toolbar, { backgroundColor: c.cardPrimary, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {/* Tab row */}
        <View style={[styles.tabRow, { borderBottomColor: c.border }]}>
          {/* Block type indicator */}
          <View style={[styles.blockBadge, { backgroundColor: c.secondary }]}>
            <Text style={[styles.blockBadgeText, { color: c.primary }]}>{blockLabel}</Text>
          </View>

          {(['format', 'insert', 'align'] as TabId[]).map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && { borderBottomColor: c.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? c.primary : c.textSecondary }]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Undo / Redo always visible */}
          <TouchableOpacity style={[btn(false), styles.utilBtn]} onPress={() => cmd('UNDO')}>
            <MaterialIcons name="undo" size={18} color={c.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[btn(false), styles.utilBtn]} onPress={() => cmd('REDO')}>
            <MaterialIcons name="redo" size={18} color={c.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Button row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.btnScroll}
          contentContainerStyle={styles.btnContent}
          keyboardShouldPersistTaps="always"
        >
          {/* ══ FORMAT TAB ══════════════════════════════════════════════ */}
          {activeTab === 'format' && (
            <>
              <TouchableOpacity style={btn(selectionState.bold)} onPress={() => cmd('FORMAT_TEXT', 'bold')}>
                <MaterialIcons name="format-bold" size={20} color={iconColor(selectionState.bold)} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(selectionState.italic)} onPress={() => cmd('FORMAT_TEXT', 'italic')}>
                <MaterialIcons name="format-italic" size={20} color={iconColor(selectionState.italic)} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(selectionState.underline)} onPress={() => cmd('FORMAT_TEXT', 'underline')}>
                <MaterialIcons name="format-underlined" size={20} color={iconColor(selectionState.underline)} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(selectionState.strikethrough)} onPress={() => cmd('FORMAT_TEXT', 'strikethrough')}>
                <MaterialIcons name="strikethrough-s" size={20} color={iconColor(selectionState.strikethrough)} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(selectionState.highlight)} onPress={() => cmd('FORMAT_TEXT', 'highlight')}>
                <MaterialIcons name="highlight" size={20} color={iconColor(selectionState.highlight)} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(selectionState.code)} onPress={() => cmd('FORMAT_TEXT', 'code')}>
                <MaterialIcons name="code" size={20} color={iconColor(selectionState.code)} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(selectionState.subscript)} onPress={() => cmd('FORMAT_TEXT', 'subscript')}>
                <Text style={[textStyle, { fontSize: 13 }]}>x₂</Text>
              </TouchableOpacity>
              <TouchableOpacity style={btn(selectionState.superscript)} onPress={() => cmd('FORMAT_TEXT', 'superscript')}>
                <Text style={[textStyle, { fontSize: 13 }]}>x²</Text>
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              {/* Headings */}
              {(['h1', 'h2', 'h3'] as const).map(h => (
                <TouchableOpacity key={h} style={btn(selectionState.blockType === h)} onPress={() => cmd('SET_HEADING', h)}>
                  <Text style={[textStyle, { fontSize: 13, color: iconColor(selectionState.blockType === h) }]}>
                    {h.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={btn(selectionState.blockType === 'paragraph')} onPress={() => cmd('SET_PARAGRAPH')}>
                <MaterialIcons name="notes" size={20} color={iconColor(selectionState.blockType === 'paragraph')} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(selectionState.blockType === 'quote')} onPress={() => cmd('SET_QUOTE')}>
                <MaterialIcons name="format-quote" size={20} color={iconColor(selectionState.blockType === 'quote')} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(selectionState.blockType === 'code')} onPress={() => cmd('SET_CODE')}>
                <MaterialIcons name="data-object" size={20} color={iconColor(selectionState.blockType === 'code')} />
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              {/* Lists */}
              <TouchableOpacity style={btn(selectionState.blockType === 'bullet')} onPress={() => cmd('INSERT_UL')}>
                <MaterialIcons name="format-list-bulleted" size={20} color={iconColor(selectionState.blockType === 'bullet')} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(selectionState.blockType === 'number')} onPress={() => cmd('INSERT_OL')}>
                <MaterialIcons name="format-list-numbered" size={20} color={iconColor(selectionState.blockType === 'number')} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(selectionState.blockType === 'check')} onPress={() => cmd('INSERT_CHECK')}>
                <MaterialIcons name="checklist" size={20} color={iconColor(selectionState.blockType === 'check')} />
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              {/* Indent */}
              <TouchableOpacity style={btn(false)} onPress={() => cmd('INDENT')}>
                <MaterialIcons name="format-indent-increase" size={20} color={c.text} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(false)} onPress={() => cmd('OUTDENT')}>
                <MaterialIcons name="format-indent-decrease" size={20} color={c.text} />
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              {/* Color pickers */}
              <TouchableOpacity style={btn(false)} onPress={() => setShowColorPicker('text')}>
                <View style={{ alignItems: 'center' }}>
                  <MaterialIcons name="format-color-text" size={18} color={c.text} />
                  <View style={[styles.colorBar, { backgroundColor: c.primary }]} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={btn(false)} onPress={() => setShowColorPicker('highlight')}>
                <View style={{ alignItems: 'center' }}>
                  <MaterialIcons name="border-color" size={18} color={c.text} />
                  <View style={[styles.colorBar, { backgroundColor: 'rgba(250,204,21,0.8)' }]} />
                </View>
              </TouchableOpacity>

              {/* Clear formatting */}
              <TouchableOpacity style={btn(false)} onPress={() => cmd('CLEAR_FORMATTING')}>
                <MaterialIcons name="format-clear" size={20} color={c.danger} />
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              {/* Text transform */}
              <TouchableOpacity style={btn(false)} onPress={() => cmd('TEXT_TRANSFORM', 'uppercase')}>
                <Text style={[textStyle, { fontSize: 11 }]}>AA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={btn(false)} onPress={() => cmd('TEXT_TRANSFORM', 'lowercase')}>
                <Text style={[textStyle, { fontSize: 11 }]}>aa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={btn(false)} onPress={() => cmd('TEXT_TRANSFORM', 'capitalize')}>
                <Text style={[textStyle, { fontSize: 11 }]}>Aa</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ══ INSERT TAB ══════════════════════════════════════════════ */}
          {activeTab === 'insert' && (
            <>
              <TouchableOpacity style={btn(false)} onPress={() => setShowLinkModal(true)}>
                <MaterialIcons name="link" size={20} color={c.text} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(false)} onPress={() => cmd('INSERT_TABLE', '3,3')}>
                <MaterialIcons name="table-chart" size={20} color={c.text} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(false)} onPress={() => cmd('INSERT_HR')}>
                <MaterialIcons name="horizontal-rule" size={20} color={c.text} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(false)} onPress={() => cmd('INSERT_COLLAPSIBLE')}>
                <MaterialIcons name="expand-more" size={20} color={c.text} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(false)} onPress={() => setShowYoutubeModal(true)}>
                <MaterialIcons name="play-circle-outline" size={20} color={c.text} />
              </TouchableOpacity>
              <TouchableOpacity style={btn(false)} onPress={() => setShowEquationModal(true)}>
                <Text style={[textStyle, { fontSize: 15 }]}>∑</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ══ ALIGN TAB ══════════════════════════════════════════════ */}
          {activeTab === 'align' && (
            <>
              {(['left', 'center', 'right', 'justify', 'start', 'end'] as const).map(align => (
                <TouchableOpacity key={align} style={btn(false)} onPress={() => cmd('FORMAT_ELEMENT', align)}>
                  <MaterialIcons
                    name={`format-align-${align === 'start' ? 'left' : align === 'end' ? 'right' : align}` as any}
                    size={20}
                    color={c.text}
                  />
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </View>

      {/* ── Color Picker Modal ─────────────────────────────────────────── */}
      <Modal visible={showColorPicker !== null} transparent animationType="fade" onRequestClose={() => setShowColorPicker(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowColorPicker(null)}>
          <View style={[styles.colorPanel, { backgroundColor: c.cardPrimary, borderColor: c.border }]}>
            <Text style={[styles.modalTitle, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}>
              {showColorPicker === 'text' ? 'Text Color' : 'Highlight Color'}
            </Text>
            <View style={styles.colorGrid}>
              {(showColorPicker === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS).map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorSwatch, { backgroundColor: color, borderColor: c.border }]}
                  onPress={() => {
                    if (showColorPicker === 'text') cmd('SET_TEXT_COLOR', color);
                    else cmd('SET_HIGHLIGHT_COLOR', color);
                    setShowColorPicker(null);
                  }}
                />
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Link Modal ─────────────────────────────────────────────────── */}
      <Modal visible={showLinkModal} transparent animationType="slide" onRequestClose={() => setShowLinkModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowLinkModal(false)}>
          <View style={[styles.inputPanel, { backgroundColor: c.cardPrimary, borderColor: c.border }]}>
            <Text style={[styles.modalTitle, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}>Insert Link</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: c.secondary, borderColor: c.border, color: c.text, fontFamily: 'Inter_400Regular' }]}
              placeholder="https://..."
              placeholderTextColor={c.textSecondary}
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoFocus
              keyboardType="url"
              autoCapitalize="none"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: c.secondary }]} onPress={() => setShowLinkModal(false)}>
                <Text style={{ color: c.textSecondary, fontFamily: 'Inter_500Medium' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: c.primary }]}
                onPress={() => { cmd('TOGGLE_LINK', linkUrl); setLinkUrl(''); setShowLinkModal(false); }}
              >
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Insert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── YouTube Modal ───────────────────────────────────────────────── */}
      <Modal visible={showYoutubeModal} transparent animationType="slide" onRequestClose={() => setShowYoutubeModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowYoutubeModal(false)}>
          <View style={[styles.inputPanel, { backgroundColor: c.cardPrimary, borderColor: c.border }]}>
            <Text style={[styles.modalTitle, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}>Embed YouTube</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: c.secondary, borderColor: c.border, color: c.text, fontFamily: 'Inter_400Regular' }]}
              placeholder="https://youtube.com/watch?v=..."
              placeholderTextColor={c.textSecondary}
              value={youtubeUrl}
              onChangeText={setYoutubeUrl}
              autoFocus
              keyboardType="url"
              autoCapitalize="none"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: c.secondary }]} onPress={() => setShowYoutubeModal(false)}>
                <Text style={{ color: c.textSecondary, fontFamily: 'Inter_500Medium' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#FF0000' }]}
                onPress={() => {
                  const id = extractYouTubeId(youtubeUrl);
                  if (id) { cmd('INSERT_YOUTUBE', id); setYoutubeUrl(''); setShowYoutubeModal(false); }
                }}
              >
                <MaterialIcons name="play-arrow" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', marginLeft: 4 }}>Embed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Equation Modal ──────────────────────────────────────────────── */}
      <Modal visible={showEquationModal} transparent animationType="slide" onRequestClose={() => setShowEquationModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowEquationModal(false)}>
          <View style={[styles.inputPanel, { backgroundColor: c.cardPrimary, borderColor: c.border }]}>
            <Text style={[styles.modalTitle, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}>LaTeX Equation</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: c.secondary, borderColor: c.border, color: c.text, fontFamily: 'Inter_400Regular' }]}
              placeholder="e.g. \frac{1}{2}mv^2"
              placeholderTextColor={c.textSecondary}
              value={equation}
              onChangeText={setEquation}
              autoFocus
              autoCapitalize="none"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: c.secondary }]} onPress={() => setShowEquationModal(false)}>
                <Text style={{ color: c.textSecondary, fontFamily: 'Inter_500Medium' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: c.primary }]}
                onPress={() => {
                  cmd('INSERT_EQUATION', JSON.stringify({ equation, inline: false }));
                  setEquation('');
                  setShowEquationModal(false);
                }}
              >
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>∑ Insert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const styles = StyleSheet.create({
  toolbar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  blockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  blockBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  tab: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tabText: { fontSize: 10, letterSpacing: 0.5 },
  utilBtn: { width: 32, height: 32, marginLeft: 4 },
  btnScroll: { maxHeight: 50 },
  btnContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    alignItems: 'center',
    flexDirection: 'row',
  },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 24,
    alignSelf: 'center',
    marginHorizontal: 2,
  },
  colorBar: {
    width: 16,
    height: 3,
    borderRadius: 2,
    marginTop: 2,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  colorPanel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 36,
  },
  inputPanel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  modalTitle: { fontSize: 16, marginBottom: 4 },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
