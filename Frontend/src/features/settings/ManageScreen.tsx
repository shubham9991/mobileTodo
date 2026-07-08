import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal,
  TextInput, Pressable, Alert, LayoutAnimation, Switch, Animated, Easing, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../themes/ThemeContext';
import { TopNavbar } from '../../layout/TopNavbar';
import { BottomNavbar } from '../../layout/BottomNavbar';
import {
  useManage, ManagedPriority, ManagedTag, PALETTE_COLORS,
  MarkingStyle, CalendarMarkingSetting, DockMode,
  ALL_AVAILABLE_DOCK_ITEMS, DockItem,
} from '../../core/ManageContext';
import { useDashboard, NodeType, ProjectNode } from '../../core/DashboardContext';

// Haptic feedback wrappers
const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const hapticMed   = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

// ─── Shared Top Sheet Modal ──────────────────────────────────────────────────
const Sheet = ({
  visible, onClose, title, children,
}: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.bezier(0.25, 1, 0.5, 1)),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -400,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={sh.overlay}>
        {/* Animated backdrop overlay */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, backgroundColor: 'rgba(0,0,0,0.45)' }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        {/* Animated Top Panel taking 30-40% of screen height */}
        <Animated.View 
          style={[
            sh.panel, 
            { 
              backgroundColor: theme.colors.cardPrimary, 
              paddingTop: insets.top + 14,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={[sh.title, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>{title}</Text>
          <View style={[sh.divider, { backgroundColor: theme.colors.border }]} />
          
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {children}
          </ScrollView>
          <View style={[sh.handle, { backgroundColor: theme.colors.border, marginTop: 10 }]} />
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Sheet TextInput with Focus Highlight ──────────────────────────────────────
const SheetInput = ({
  value, onChangeText, placeholder, autoFocus = false
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  return (
    <TextInput
      style={[
        ms.sheetInput,
        {
          color: theme.colors.text,
          backgroundColor: theme.colors.secondary,
          borderColor: isFocused ? theme.colors.primary : theme.colors.border,
          borderWidth: isFocused ? 1.5 : 1,
          fontFamily: 'Inter_500Medium',
        }
      ]}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textSecondary}
      value={value}
      onChangeText={onChangeText}
      autoFocus={autoFocus}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    />
  );
};

// Memory for color presets to persist custom hex entries during session.
let COLOR_PRESETS_MEM = ['#6366F1', '#71717A', '#22C55E', '#EC4899', '#F97316', '#06B6D4'];

const SPECTRUM_COLORS = [
  '#F43F5E', '#EC4899', '#D946EF', '#A855F7', '#8B5CF6', '#6366F1', '#3B82F6', '#0EA5E9',
  '#06B6D4', '#14B8A6', '#10B981', '#22C55E', '#84CC16', '#EAB308', '#F59E0B', '#F97316',
  '#EF4444', '#B45309', '#78350F', '#000000', '#4B5563', '#9CA3AF', '#D1D5DB', '#FFFFFF'
];

// ─── Colour Picker Row (Premium Single Line: 6 Presets + Custom Hex Input) ────
const ColorPicker = ({ selected, onSelect }: { selected: string; onSelect: (c: string) => void }) => {
  const { theme } = useTheme();
  const [presets, setPresets] = useState(COLOR_PRESETS_MEM);
  const [hexText, setHexText] = useState(selected);
  const [showPalette, setShowPalette] = useState(false);
  const [tempColor, setTempColor] = useState(selected);

  // Sync internal Hex input when selected color changes from outside preset taps
  useEffect(() => {
    setHexText(selected);
    setTempColor(selected);
  }, [selected]);

  // Dynamic presets memory stack (push newly selected/typed color to index 0, shift others)
  const pushToPresets = (color: string) => {
    const cleanCol = color.trim().toUpperCase();
    if (!cleanCol) return;
    
    // Check if it is already the first preset
    if (presets[0] && presets[0].toUpperCase() === cleanCol) return;

    // Filter out duplicates (case insensitive) to keep list unique
    const filtered = presets.filter(p => p.toUpperCase() !== cleanCol);

    // Add to front of presets, keep maximum 6 items
    const nextPresets = [color, ...filtered].slice(0, 6);
    
    setPresets(nextPresets);
    COLOR_PRESETS_MEM = nextPresets;
  };

  useEffect(() => {
    if (selected) {
      pushToPresets(selected);
    }
  }, [selected]);

  const handleHexChange = (text: string) => {
    setHexText(text);
    const cleaned = text.trim();
    // Match optional hashtag, 3 or 6 hex digits
    const hexRegex = /^#?([0-9A-F]{3}|[0-9A-F]{6})$/i;
    if (hexRegex.test(cleaned)) {
      const fullHex = cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
      onSelect(fullHex);
    }
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      {/* Presets Grid */}
      <View style={{ flexDirection: 'row', gap: 8, flex: 1, justifyContent: 'space-between', alignItems: 'center' }}>
        {presets.map(c => {
          const isActive = selected.toLowerCase() === c.toLowerCase();
          return (
            <TouchableOpacity
              key={c}
              style={[
                cp.swatch,
                { backgroundColor: c },
                isActive && cp.swatchActive
              ]}
              onPress={() => { onSelect(c); }}
            >
              {isActive && <MaterialIcons name="check" size={14} color="#FFF" />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Divider */}
      <View style={{ width: 1, height: 26, backgroundColor: theme.colors.border }} />

      {/* Custom HEX Manual Selector */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: selected, borderWidth: 1.5, borderColor: theme.colors.border }}
          onPress={() => {
            setTempColor(selected);
            setShowPalette(true);
          }}
        />
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 5,
            fontSize: 12,
            width: 76,
            color: theme.colors.text,
            backgroundColor: theme.colors.secondary,
            textAlign: 'center',
            fontFamily: 'Inter_600SemiBold'
          }}
          value={hexText}
          onChangeText={handleHexChange}
          placeholder="#HEX"
          placeholderTextColor={theme.colors.textSecondary}
          maxLength={7}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Premium Curated Color Palette spectrum Modal */}
      <Modal visible={showPalette} transparent animationType="fade" onRequestClose={() => setShowPalette(false)}>
        <Pressable style={paletteStyles.overlay} onPress={() => setShowPalette(false)}>
          <Pressable style={[paletteStyles.container, { backgroundColor: theme.colors.cardPrimary }]} onPress={() => {}}>
            <Text style={[paletteStyles.title, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>Select Color</Text>
            
            {/* Color Preview Block */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, backgroundColor: theme.colors.secondary, padding: 12, borderRadius: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: tempColor, borderWidth: 1, borderColor: theme.colors.border }} />
              <View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: theme.colors.textSecondary }}>HEX CODE</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: theme.colors.text }}>{tempColor.toUpperCase()}</Text>
              </View>
            </View>

            {/* Spectrum Colors Grid */}
            <View style={paletteStyles.grid}>
              {SPECTRUM_COLORS.map(c => {
                const isTempActive = tempColor.toLowerCase() === c.toLowerCase();
                return (
                  <TouchableOpacity
                    key={c}
                    activeOpacity={0.85}
                    style={[paletteStyles.swatch, { backgroundColor: c }, isTempActive && paletteStyles.swatchActive]}
                    onPress={() => setTempColor(c)}
                  >
                    {isTempActive && <MaterialIcons name="check" size={14} color="#FFF" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Modal Actions */}
            <View style={paletteStyles.actions}>
              <TouchableOpacity
                style={[paletteStyles.btn, { backgroundColor: theme.colors.secondary }]}
                onPress={() => setShowPalette(false)}
              >
                <Text style={{ color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[paletteStyles.btn, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  onSelect(tempColor);
                  setShowPalette(false);
                }}
              >
                <Text style={{ color: '#FFF', fontFamily: 'Inter_600SemiBold' }}>Select</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const paletteStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  container: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 16,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: '#FFF',
    transform: [{ scale: 1.1 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
});

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHdr = ({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) => {
  const { theme } = useTheme();
  return (
    <View style={[ms.sectionHdr]}>
      <Text style={[ms.sectionLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>{label}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} style={ms.addBtn}>
          <MaterialIcons name="add" size={16} color={theme.colors.primary} />
          <Text style={[ms.addBtnTxt, { color: theme.colors.primary, fontFamily: 'Inter_600SemiBold' }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Card wrapper ─────────────────────────────────────────────────────────────
const Card = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View style={[ms.card, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
      {children}
    </View>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// PRIORITY MANAGER
// ──────────────────────────────────────────────────────────────────────────────
const PriorityManager = () => {
  const { theme } = useTheme();
  const { priorities, addPriority, updatePriority, deletePriority, reorderPriorities, defaultPriority, setDefaultPriority } = useManage();

  const [showAdd, setShowAdd]     = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedPriority | null>(null);
  const [newLabel, setNewLabel]   = useState('');
  const [newColor, setNewColor]   = useState(PALETTE_COLORS[0]);

  const openAdd = () => { setNewLabel(''); setNewColor(PALETTE_COLORS[0]); setShowAdd(true); };
  const openEdit = (p: ManagedPriority) => { setEditTarget(p); setNewLabel(p.label); setNewColor(p.color); };

  const commitAdd = () => {
    if (!newLabel.trim()) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addPriority({ id: `custom_${Date.now()}`, label: newLabel.trim(), color: newColor, icon: 'flag' });
    setShowAdd(false);
  };

  const commitEdit = () => {
    if (!editTarget || !newLabel.trim()) return;
    updatePriority(editTarget.id, { label: newLabel.trim(), color: newColor });
    setEditTarget(null);
  };

  const confirmDelete = (p: ManagedPriority) => {
    Alert.alert('Delete Priority', `Remove "${p.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        deletePriority(p.id);
        if (defaultPriority === p.id) setDefaultPriority(null);
      }},
    ]);
  };

  return (
    <>
      <SectionHdr label="PRIORITIES" action="Add" onAction={openAdd} />
      <Card>
        {priorities.map((p, i) => (
          <View
            key={p.id}
            style={[ms.row, i < priorities.length - 1 && ms.rowBorder, { borderBottomColor: theme.colors.border }]}
          >
            {/* Reorder arrows */}
            <View style={ms.arrowCol}>
              <TouchableOpacity onPress={() => reorderPriorities(i, i - 1)} disabled={i === 0} style={{ opacity: i === 0 ? 0.25 : 1 }}>
                <MaterialIcons name="keyboard-arrow-up" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => reorderPriorities(i, i + 1)} disabled={i === priorities.length - 1} style={{ opacity: i === priorities.length - 1 ? 0.25 : 1 }}>
                <MaterialIcons name="keyboard-arrow-down" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Color dot + label */}
            <View style={[ms.colorDot, { backgroundColor: p.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[ms.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>{p.label}</Text>
              {p.isDefault && (
                <Text style={[ms.rowSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>Built-in</Text>
              )}
            </View>

            {/* Default badge */}
            <TouchableOpacity
              onPress={() => setDefaultPriority(defaultPriority === p.id ? null : p.id)}
              style={[ms.defaultPill, {
                backgroundColor: defaultPriority === p.id ? `${p.color}22` : theme.colors.secondary,
                borderColor: defaultPriority === p.id ? p.color : theme.colors.border,
              }]}
            >
              <Text style={[ms.defaultTxt, { color: defaultPriority === p.id ? p.color : theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                {defaultPriority === p.id ? 'Default' : 'Set default'}
              </Text>
            </TouchableOpacity>

            {/* Edit */}
            <TouchableOpacity onPress={() => openEdit(p)} style={ms.iconBtn}>
              <MaterialIcons name="edit" size={17} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {/* Delete — only non-defaults */}
            {!p.isDefault && (
              <TouchableOpacity onPress={() => confirmDelete(p)} style={ms.iconBtn}>
                <MaterialIcons name="delete-outline" size={17} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </Card>

      {/* Add Sheet */}
      <Sheet visible={showAdd} onClose={() => setShowAdd(false)} title="New Priority">
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>Label</Text>
        <SheetInput
          placeholder="e.g. Critical"
          value={newLabel}
          onChangeText={setNewLabel}
          autoFocus
        />
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 16 }]}>Color</Text>
        <ColorPicker selected={newColor} onSelect={setNewColor} />
        <TouchableOpacity style={[ms.doneBtn, { backgroundColor: theme.colors.primary }]} onPress={commitAdd}>
          <Text style={[ms.doneTxt, { color: '#FFF', fontFamily: 'Inter_600SemiBold' }]}>Add Priority</Text>
        </TouchableOpacity>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet visible={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Priority">
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>Label</Text>
        <SheetInput
          placeholder="Label"
          value={newLabel}
          onChangeText={setNewLabel}
          autoFocus
        />
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 16 }]}>Color</Text>
        <ColorPicker selected={newColor} onSelect={setNewColor} />
        <TouchableOpacity style={[ms.doneBtn, { backgroundColor: theme.colors.primary }]} onPress={commitEdit}>
          <Text style={[ms.doneTxt, { color: '#FFF', fontFamily: 'Inter_600SemiBold' }]}>Save Changes</Text>
        </TouchableOpacity>
      </Sheet>

      <Text style={[ms.hint, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 6, paddingHorizontal: 2 }]}>
        * Tap "Set default" next to a priority above to pre-select it automatically for new tasks.
      </Text>
    </>
  );
};
// ──────────────────────────────────────────────────────────────────────────────
const MARKING_STYLES: MarkingStyle[] = ['dot', 'period', 'custom'];
const MARKING_STYLE_LABELS: Record<MarkingStyle, string> = {
  dot: 'Dot',
  period: 'Period',
  custom: 'Custom',
};
const MARKING_STYLE_ICONS: Record<MarkingStyle, keyof typeof MaterialIcons.glyphMap> = {
  dot: 'circle',
  period: 'horizontal-rule',
  custom: 'emoji-emotions',
};

const TagManager = () => {
  const { theme } = useTheme();
  const {
    tags, addTag, updateTag, deleteTag,
    calendarMarkings, updateCalendarMarking
  } = useManage();

  const [showAdd, setShowAdd]       = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedTag | null>(null);
  const [newLabel, setNewLabel]     = useState('');
  const [newColor, setNewColor]     = useState(PALETTE_COLORS[5]);

  // Track which tag is currently having its calendar appearance settings customized
  const [expandedTagId, setExpandedTagId] = useState<string | null>(null);
  const [emojiInput, setEmojiInput]       = useState('');

  const openAdd  = () => { setNewLabel(''); setNewColor(PALETTE_COLORS[5]); setShowAdd(true); };
  const openEdit = (t: ManagedTag) => { setEditTarget(t); setNewLabel(t.label); setNewColor(t.color); };

  const commitAdd = () => {
    if (!newLabel.trim()) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addTag({ label: newLabel.trim(), color: newColor });
    setShowAdd(false);
  };

  const commitEdit = () => {
    if (!editTarget || !newLabel.trim()) return;
    updateTag(editTarget.id, { label: newLabel.trim(), color: newColor });
    setEditTarget(null);
  };

  const confirmDelete = (t: ManagedTag) => {
    Alert.alert('Delete Tag', `Remove "#${t.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        deleteTag(t.id);
        if (expandedTagId === t.id) setExpandedTagId(null);
      }},
    ]);
  };

  return (
    <>
      <SectionHdr label="TAGS" action="Add" onAction={openAdd} />
      <Card>
        {tags.map((t, i) => {
          const setting: CalendarMarkingSetting = calendarMarkings.find(m => m.tagId === t.id) ?? { tagId: t.id, style: 'dot', visible: true };
          const isExpanded = expandedTagId === t.id;

          return (
            <View key={t.id} style={i < tags.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }}>
              <View style={[ms.row, { paddingBottom: isExpanded ? 4 : 12 }]}>
                {/* Tag label chip with integrated marking style preview */}
                <View style={[ms.tagChip, { backgroundColor: `${t.color}22`, borderColor: t.color, alignItems: 'center' }]}>
                  {setting.visible && setting.style === 'custom' && setting.customEmoji ? (
                    <Text style={{ fontSize: 13, marginRight: 4, marginTop: -1 }}>{setting.customEmoji}</Text>
                  ) : setting.visible && setting.style === 'period' ? (
                    <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: t.color, marginRight: 4 }} />
                  ) : (
                    <View style={[ms.tagDot, { backgroundColor: setting.visible ? t.color : `${t.color}50` }]} />
                  )}
                  <Text style={[ms.tagChipTxt, { color: t.color, fontFamily: 'Inter_600SemiBold' }]}>{t.label}</Text>
                </View>

                <View style={{ flex: 1 }} />

                {/* Calendar visibility toggle (visible in calendar) */}
                <Switch
                  value={setting.visible}
                  onValueChange={(v) => updateCalendarMarking(t.id, { visible: v })}
                  trackColor={{ false: theme.colors.border, true: `${t.color}80` }}
                  thumbColor={setting.visible ? t.color : '#9CA3AF'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />

                {/* Toggle appearance markings styling */}
                <TouchableOpacity
                  onPress={() => {
                    setExpandedTagId(isExpanded ? null : t.id);
                    setEmojiInput(setting.customEmoji ?? '');
                  }}
                  style={ms.iconBtn}
                >
                  <MaterialIcons
                    name={isExpanded ? 'keyboard-arrow-up' : 'calendar-today'}
                    size={17}
                    color={isExpanded ? t.color : theme.colors.textSecondary}
                  />
                </TouchableOpacity>

                {/* Edit & Delete Tag */}
                <TouchableOpacity onPress={() => openEdit(t)} style={ms.iconBtn}>
                  <MaterialIcons name="edit" size={17} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                {!t.isDefault && (
                  <TouchableOpacity onPress={() => confirmDelete(t)} style={ms.iconBtn}>
                    <MaterialIcons name="delete-outline" size={17} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Collapsible Calendar marking settings */}
              {isExpanded && (
                <View style={[cmStyles.stylePickerRow, { backgroundColor: theme.colors.secondary }]}>
                  {MARKING_STYLES.map(style => (
                    <TouchableOpacity
                      key={style}
                      style={[
                        cmStyles.stylePill,
                        {
                          borderColor: setting.style === style ? t.color : theme.colors.border,
                          backgroundColor: setting.style === style ? `${t.color}15` : 'transparent',
                        },
                      ]}
                      onPress={() => updateCalendarMarking(t.id, { style })}
                    >
                      <MaterialIcons
                        name={MARKING_STYLE_ICONS[style]}
                        size={13}
                        color={setting.style === style ? t.color : theme.colors.textSecondary}
                      />
                      <Text style={[
                        cmStyles.stylePillTxt,
                        { color: setting.style === style ? t.color : theme.colors.textSecondary, fontFamily: setting.style === style ? 'Inter_600SemiBold' : 'Inter_400Regular' }
                      ]}>
                        {style === 'custom' && setting.customEmoji ? `Custom (${setting.customEmoji})` : MARKING_STYLE_LABELS[style]}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {/* Custom emoji for calendar marking */}
                  {setting.style === 'custom' && (
                    <View style={[cmStyles.emojiRow, { borderColor: theme.colors.border }]}>
                      <TextInput
                        style={[cmStyles.emojiInput, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}
                        placeholder="Emoji"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={emojiInput}
                        onChangeText={(txt) => {
                          // Filter input to only allow valid emoji surrogate pairs/unicodes
                          const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
                          const matches = txt.match(emojiRegex);
                          setEmojiInput(matches ? matches.join('').slice(0, 2) : ''); // max 2 emojis
                        }}
                        maxLength={4}
                      />
                      <TouchableOpacity
                        style={[cmStyles.emojiSave, { backgroundColor: t.color }]}
                        onPress={() => {
                          const trimmed = emojiInput.trim();
                          if (!trimmed) {
                            Alert.alert('Emoji Required', 'Please enter a valid emoji before saving.');
                            return;
                          }
                          updateCalendarMarking(t.id, { customEmoji: trimmed });
                          setExpandedTagId(null);
                        }}
                      >
                        <Text style={{ color: '#FFF', fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {/* Add Sheet */}
      <Sheet visible={showAdd} onClose={() => setShowAdd(false)} title="New Tag">
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>Name</Text>
        <SheetInput
          placeholder="e.g. Finance"
          value={newLabel}
          onChangeText={setNewLabel}
          autoFocus
        />
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 16 }]}>Color</Text>
        <ColorPicker selected={newColor} onSelect={setNewColor} />
        <TouchableOpacity style={[ms.doneBtn, { backgroundColor: theme.colors.primary }]} onPress={commitAdd}>
          <Text style={[ms.doneTxt, { color: '#FFF', fontFamily: 'Inter_600SemiBold' }]}>Add Tag</Text>
        </TouchableOpacity>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet visible={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Tag">
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>Name</Text>
        <SheetInput
          placeholder="Tag name"
          value={newLabel}
          onChangeText={setNewLabel}
          autoFocus
        />
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 16 }]}>Color</Text>
        <ColorPicker selected={newColor} onSelect={setNewColor} />
        <TouchableOpacity style={[ms.doneBtn, { backgroundColor: theme.colors.primary }]} onPress={commitEdit}>
          <Text style={[ms.doneTxt, { color: '#FFF', fontFamily: 'Inter_600SemiBold' }]}>Save Changes</Text>
        </TouchableOpacity>
      </Sheet>
    </>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// REMINDER PRESETS MANAGER
// ──────────────────────────────────────────────────────────────────────────────
const ReminderPresetsManager = () => {
  const { theme } = useTheme();
  const { reminderPresets, addReminderPreset, deleteReminderPreset } = useManage();
  const [showAdd, setShowAdd]   = useState(false);
  const [valueInput, setValueInput] = useState('15');
  const [unitInput, setUnitInput]   = useState<'minutes' | 'hours' | 'days'>('minutes');

  const commitAdd = () => {
    const val = parseInt(valueInput.trim(), 10);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Offset', 'Please enter a valid positive number for the time offset.');
      return;
    }
    
    let label = '';
    if (unitInput === 'minutes') {
      label = `${val} min before`;
    } else if (unitInput === 'hours') {
      label = `${val} hr${val > 1 ? 's' : ''} before`;
    } else if (unitInput === 'days') {
      label = `${val} day${val > 1 ? 's' : ''} before`;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addReminderPreset(label);
    setValueInput('15');
    setUnitInput('minutes');
    setShowAdd(false);
  };

  const confirmDelete = (r: string) => {
    Alert.alert('Remove Preset', `Remove "${r}" from reminders?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        deleteReminderPreset(r);
      }},
    ]);
  };

  return (
    <>
      <SectionHdr label="REMINDER PRESETS" action="Add" onAction={() => setShowAdd(true)} />
      <Card>
        {reminderPresets.map((r, i) => (
          <View key={r} style={[ms.row, i < reminderPresets.length - 1 && ms.rowBorder, { borderBottomColor: theme.colors.border }]}>
            <MaterialIcons name="notifications-none" size={18} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={[ms.rowLabel, { flex: 1, color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>{r}</Text>
            <TouchableOpacity onPress={() => confirmDelete(r)} style={ms.iconBtn}>
              <MaterialIcons name="remove-circle-outline" size={17} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}
      </Card>

      <Sheet visible={showAdd} onClose={() => setShowAdd(false)} title="New Reminder Preset">
        {/* Offset Value Stepper */}
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
          Offset Time Amount
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginVertical: 10 }}>
          {/* Minus Step Button */}
          <TouchableOpacity
            style={{
              width: 42, height: 42, borderRadius: 21,
              borderWidth: 1, borderColor: theme.colors.border,
              backgroundColor: theme.colors.secondary,
              alignItems: 'center', justifyContent: 'center'
            }}
            onPress={() => {
              const current = parseInt(valueInput, 10) || 0;
              const step = unitInput === 'minutes' ? 5 : 1;
              const next = Math.max(1, current - step);
              setValueInput(String(next));
            }}
          >
            <MaterialIcons name="remove" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          {/* Value TextInput with numeric filtering */}
          <TextInput
            style={{
              borderWidth: 1.5,
              borderColor: theme.colors.primary,
              borderRadius: 12,
              backgroundColor: theme.colors.secondary,
              color: theme.colors.text,
              width: 90,
              height: 42,
              fontSize: 18,
              textAlign: 'center',
              fontFamily: 'Inter_700Bold'
            }}
            keyboardType="numeric"
            value={valueInput}
            onChangeText={(txt) => setValueInput(txt.replace(/[^0-9]/g, ''))}
            maxLength={3}
            autoFocus
          />

          {/* Plus Step Button */}
          <TouchableOpacity
            style={{
              width: 42, height: 42, borderRadius: 21,
              borderWidth: 1, borderColor: theme.colors.border,
              backgroundColor: theme.colors.secondary,
              alignItems: 'center', justifyContent: 'center'
            }}
            onPress={() => {
              const current = parseInt(valueInput, 10) || 0;
              const step = unitInput === 'minutes' ? 5 : 1;
              const next = Math.min(999, current + step);
              setValueInput(String(next));
            }}
          >
            <MaterialIcons name="add" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Time Unit Selector Tabs */}
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold', marginTop: 16 }]}>
          Time Unit
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 12 }}>
          {(['minutes', 'hours', 'days'] as const).map((u) => {
            const isActive = unitInput === u;
            return (
              <TouchableOpacity
                key={u}
                style={[
                  cmStyles.stylePill,
                  {
                    borderColor: isActive ? theme.colors.primary : theme.colors.border,
                    backgroundColor: isActive ? `${theme.colors.primary}15` : 'transparent',
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingVertical: 9
                  }
                ]}
                onPress={() => setUnitInput(u)}
              >
                <Text style={{
                  color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                  fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  fontSize: 12,
                  textTransform: 'capitalize'
                }}>
                  {u}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={[ms.doneBtn, { backgroundColor: theme.colors.primary }]} onPress={commitAdd}>
          <Text style={[ms.doneTxt, { color: '#FFF', fontFamily: 'Inter_600SemiBold' }]}>Add Preset</Text>
        </TouchableOpacity>
      </Sheet>
    </>
  );
};

const cmStyles = StyleSheet.create({
  stylePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  stylePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  stylePillTxt: { fontSize: 11 },
  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
    height: 38,
  },
  emojiInput: { flex: 1, paddingHorizontal: 12, fontSize: 16, height: '100%' },
  emojiSave: { paddingHorizontal: 16, height: '100%', justifyContent: 'center', alignItems: 'center' },
});

// ──────────────────────────────────────────────────────────────────────────────
// HIERARCHY NESTING MANAGER
// ──────────────────────────────────────────────────────────────────────────────
const HierarchyManager = () => {
  const { theme } = useTheme();
  const { nodes, createProjectNode, updateProjectNode, deleteProjectNode } = useDashboard();

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectNode | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<NodeType>('PROJECT');
  const [parentId, setParentId] = useState<string | null>(null);
  const [color, setColor] = useState(PALETTE_COLORS[0]);

  const openAdd = () => {
    setName('');
    setType('PROJECT');
    setParentId(null);
    setColor(PALETTE_COLORS[0]);
    setShowAdd(true);
  };

  const openEdit = (node: ProjectNode) => {
    setEditTarget(node);
    setName(node.name);
    setType(node.type);
    setParentId(node.parentId);
    setColor(node.color || PALETTE_COLORS[0]);
  };

  const commitAdd = () => {
    if (!name.trim()) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    createProjectNode({
      name: name.trim(),
      type,
      parentId,
      color,
      icon: type === 'COMPANY' ? 'business' : type === 'PROJECT' ? 'folder' : 'groups',
    });
    setShowAdd(false);
  };

  const commitEdit = () => {
    if (!editTarget || !name.trim()) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    // Prevent cycles: cannot set parent to itself
    if (parentId === editTarget.id) {
      Alert.alert('Invalid Parent', 'A node cannot be its own parent.');
      return;
    }

    updateProjectNode(editTarget.id, {
      name: name.trim(),
      type,
      parentId,
      color,
      icon: type === 'COMPANY' ? 'business' : type === 'PROJECT' ? 'folder' : 'groups',
    });
    setEditTarget(null);
  };

  const confirmDelete = (node: ProjectNode) => {
    Alert.alert('Delete Space', `Remove "${node.name}" and all of its nested contents?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        deleteProjectNode(node.id);
      }},
    ]);
  };

  // Helper to render tree node recursively
  const renderTreeNode = (nodeId: string, depth: number = 0) => {
    const node = nodes[nodeId];
    if (!node) return null;

    return (
      <View key={node.id}>
        <View style={[
          ms.row, 
          { 
            paddingLeft: depth * 16 + 12, 
            borderBottomColor: theme.colors.border,
            borderBottomWidth: StyleSheet.hairlineWidth 
          }
        ]}>
          <View style={[ms.colorDot, { backgroundColor: node.color || theme.colors.text }]} />
          <View style={{ flex: 1 }}>
            <Text style={[ms.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
              {node.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={[ms.rowSub, { color: theme.colors.textSecondary }]}>
                {node.type}
              </Text>
              {node.parentId && (
                <>
                  <MaterialIcons name="chevron-right" size={12} color={theme.colors.textSecondary} />
                  <Text style={[ms.rowSub, { color: theme.colors.textSecondary }]}>
                    child of {nodes[node.parentId]?.name || 'unknown'}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Edit & Delete Node */}
          <TouchableOpacity onPress={() => openEdit(node)} style={ms.iconBtn}>
            <MaterialIcons name="edit" size={17} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => confirmDelete(node)} style={ms.iconBtn}>
            <MaterialIcons name="delete-outline" size={17} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {node.childIds && node.childIds.map(childId => renderTreeNode(childId, depth + 1))}
      </View>
    );
  };

  // Find top level nodes (ones without parents)
  const topLevelNodeIds = Object.keys(nodes).filter(id => !nodes[id].parentId);

  return (
    <>
      <SectionHdr label="SPACES & PROJECTS HIERARCHY" action="Add" onAction={openAdd} />
      <Card>
        {topLevelNodeIds.map(id => renderTreeNode(id, 0))}
        {topLevelNodeIds.length === 0 && (
          <Text style={{ padding: 16, textAlign: 'center', color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }}>
            No spaces configured yet. Tap Add to create one.
          </Text>
        )}
      </Card>

      {/* Add Hierarchy Sheet */}
      <Sheet visible={showAdd} onClose={() => setShowAdd(false)} title="New Space">
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>Name</Text>
        <SheetInput
          placeholder="e.g. Design Team or Acme Corp"
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 16 }]}>Type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {(['COMPANY', 'PROJECT', 'TEAM'] as NodeType[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[
                ms.typeChip,
                { 
                  backgroundColor: type === t ? theme.colors.primary : theme.colors.secondary,
                }
              ]}
              onPress={() => setType(t)}
            >
              <Text style={{ 
                color: type === t ? '#fff' : theme.colors.textSecondary,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 12
              }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 16 }]}>Parent Node (Nesting)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          <TouchableOpacity
            style={[
              ms.parentChip,
              { 
                backgroundColor: parentId === null ? theme.colors.primary : theme.colors.secondary,
              }
            ]}
            onPress={() => setParentId(null)}
          >
            <Text style={{ color: parentId === null ? '#fff' : theme.colors.textSecondary, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
              None (Top Level)
            </Text>
          </TouchableOpacity>
          {Object.values(nodes).map(node => (
            <TouchableOpacity
              key={node.id}
              style={[
                ms.parentChip,
                { 
                  backgroundColor: parentId === node.id ? theme.colors.primary : theme.colors.secondary,
                }
              ]}
              onPress={() => setParentId(node.id)}
            >
              <Text style={{ color: parentId === node.id ? '#fff' : theme.colors.textSecondary, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                {node.name} ({node.type})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 16 }]}>Color Tag</Text>
        <ColorPicker selected={color} onSelect={setColor} />

        <TouchableOpacity style={[ms.doneBtn, { backgroundColor: theme.colors.primary }]} onPress={commitAdd}>
          <Text style={[ms.doneTxt, { color: '#FFF', fontFamily: 'Inter_600SemiBold' }]}>Create Space</Text>
        </TouchableOpacity>
      </Sheet>

      {/* Edit Hierarchy Sheet */}
      <Sheet visible={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Space">
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>Name</Text>
        <SheetInput
          placeholder="Name"
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 16 }]}>Type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {(['COMPANY', 'PROJECT', 'TEAM'] as NodeType[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[
                ms.typeChip,
                { 
                  backgroundColor: type === t ? theme.colors.primary : theme.colors.secondary,
                }
              ]}
              onPress={() => setType(t)}
            >
              <Text style={{ 
                color: type === t ? '#fff' : theme.colors.textSecondary,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 12
              }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 16 }]}>Parent Node (Nesting)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          <TouchableOpacity
            style={[
              ms.parentChip,
              { 
                backgroundColor: parentId === null ? theme.colors.primary : theme.colors.secondary,
              }
            ]}
            onPress={() => setParentId(null)}
          >
            <Text style={{ color: parentId === null ? '#fff' : theme.colors.textSecondary, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
              None (Top Level)
            </Text>
          </TouchableOpacity>
          {Object.values(nodes)
            .filter(node => editTarget && node.id !== editTarget.id) // Filter out itself to prevent cycle
            .map(node => (
              <TouchableOpacity
                key={node.id}
                style={[
                  ms.parentChip,
                  { 
                    backgroundColor: parentId === node.id ? theme.colors.primary : theme.colors.secondary,
                  }
                ]}
                onPress={() => setParentId(node.id)}
              >
                <Text style={{ color: parentId === node.id ? '#fff' : theme.colors.textSecondary, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                  {node.name} ({node.type})
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>

        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 16 }]}>Color Tag</Text>
        <ColorPicker selected={color} onSelect={setColor} />

        <TouchableOpacity style={[ms.doneBtn, { backgroundColor: theme.colors.primary }]} onPress={commitEdit}>
          <Text style={[ms.doneTxt, { color: '#FFF', fontFamily: 'Inter_600SemiBold' }]}>Save Changes</Text>
        </TouchableOpacity>
      </Sheet>
    </>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ──────────────────────────────────────────────────────────────────────────────
export const ManageScreen = () => {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[ms.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <TopNavbar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <PriorityManager />
          <View style={ms.gap} />
          <TagManager />
          <View style={ms.gap} />
          <HierarchyManager />
          <View style={ms.gap} />
          <ReminderPresetsManager />
        </View>
      </ScrollView>
      <BottomNavbar />
    </SafeAreaView>
  );
};

// ─── Shared sheet styles ──────────────────────────────────────────────────────
const sh = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-start' },
  panel:   { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingHorizontal: 20, paddingBottom: 16, maxHeight: '42%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  handle:  { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  title:   { fontSize: 19, fontFamily: 'Inter_700Bold', letterSpacing: -0.4, marginBottom: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 16 },
});

// ─── Color picker styles ──────────────────────────────────────────────────────
const cp = StyleSheet.create({
  swatch:      { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  swatchActive: {
    borderWidth: 2.5,
    borderColor: '#FFF',
    transform: [{ scale: 1.15 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  container: { flex: 1 },

  // Hero
  hero:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  heroIcon:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 20, letterSpacing: -0.4 },
  heroSub:   { fontSize: 13, marginTop: 1 },

  // Section headers
  sectionHdr:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 4 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.6, flex: 1 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnTxt:    { fontSize: 13 },

  // Card
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 4 },
  gap:  { height: 24 },

  // Row
  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel:  { fontSize: 14 },
  rowSub:    { fontSize: 12, marginTop: 1 },

  // Reorder arrows
  arrowCol: { flexDirection: 'column', alignItems: 'center', gap: 0, marginRight: -2 },

  // Priority
  colorDot:   { width: 14, height: 14, borderRadius: 7, marginRight: 4 },
  defaultPill:{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  defaultTxt: { fontSize: 11 },

  // Tags
  tagChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  tagDot:     { width: 7, height: 7, borderRadius: 4 },
  tagChipTxt: { fontSize: 13 },

  // Icon button
  iconBtn:    { padding: 6 },
  iconWrap:   { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },

  // Sheet inputs
  sheetLabel2: { fontSize: 13, marginBottom: 8, fontFamily: 'Inter_600SemiBold' },
  sheetInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, marginBottom: 4,
  },
  doneBtn:   {
    paddingVertical: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  doneTxt:   { fontSize: 15 },

  // Hint
  hint: { fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 4, paddingHorizontal: 2 },

  // Hierarchy Manager chips
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  parentChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
