import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Switch, Dimensions, Alert,
} from 'react-native';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, ACCENT_COLORS } from '../../themes/ThemeContext';
import {
  useDashboard, SectionId, SECTION_META, LAYOUT_MODES, DEFAULT_ORDER,
} from '../../core/DashboardContext';
import {
  useManage, DockMode, ALL_AVAILABLE_DOCK_ITEMS, DockItem,
} from '../../core/ManageContext';
// Removed TopNavbar import to break the require cycle
import { BottomNavbar } from '../../layout/BottomNavbar';
import { SettingRow, ToggleRow, SectionHeader, SettingsCard } from './components/SettingRow';

// ─── Owned data ───────────────────────────────────────────────────────────────
const OWNED_THEMES = [
  { id: 'default', name: 'Default', bg: '#FFFFFF', accent: '#18181B' },
  { id: 'dusk', name: 'Dusk', bg: '#1C1C2E', accent: '#7C3AED' },
  { id: 'forest', name: 'Forest', bg: '#0D1F0F', accent: '#22C55E' },
];
const OWNED_PLUGINS = [
  { id: 'finance', name: 'Finance Tracker', icon: 'account-balance', enabled: true, desc: 'Budget, expenses & goals' },
  { id: 'retail', name: 'Retail Manager', icon: 'storefront', enabled: false, desc: 'Inventory & order tracking' },
];

const ALARM_TONES = [
  { id: 'default',  label: 'Default',       icon: 'notifications' as const,       desc: 'System notification sound' },
  { id: 'gentle',   label: 'Gentle Chime',  icon: 'music-note' as const,           desc: 'Soft chime for quiet alarms' },
  { id: 'classic',  label: 'Classic Alarm', icon: 'alarm' as const,                desc: 'Traditional loud alarm tone' },
  { id: 'bell',     label: 'Bell Ring',     icon: 'notifications-active' as const,  desc: 'Repeating bell pattern' },
  { id: 'silent',   label: 'Silent',        icon: 'volume-off' as const,           desc: 'Vibrate only, no sound' },
];

const getToneLabel = (uriOrId: string) => {
  const preset = ALARM_TONES.find(t => t.id === uriOrId);
  if (preset) return preset.label;
  try {
    const decoded = decodeURIComponent(uriOrId);
    const parts = decoded.split('/');
    const filename = parts[parts.length - 1];
    return filename || 'Custom Tone';
  } catch (e) {
    return 'Custom Tone';
  }
};
const WIDGETS = [
  { id: 'focus', label: 'Focus Timer', icon: 'timer' },
  { id: 'ring', label: 'Progress Ring', icon: 'donut-large' },
  { id: 'quote', label: 'Quote of Day', icon: 'format-quote' },
  { id: 'weather', label: 'Weather', icon: 'wb-sunny' },
  { id: 'habit', label: 'Habit Tracker', icon: 'repeat' },
  { id: 'streak', label: 'Streak Counter', icon: 'local-fire-department' },
];

// ─── Bottom Sheet wrapper ─────────────────────────────────────────────────────
const Sheet = ({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) => {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={[s.panel, { backgroundColor: theme.colors.cardPrimary }]} onPress={() => { }}>
          <View style={[s.handle, { backgroundColor: theme.colors.border }]} />
          <Text style={[s.sheetTitle, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>{title}</Text>
          <View style={[s.divider, { backgroundColor: theme.colors.border }]} />
          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
          <TouchableOpacity style={[s.doneBtn, { backgroundColor: theme.colors.primary }]} onPress={onClose}>
            <Text style={[s.doneTxt, { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' }]}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Section Visibility Modal ─────────────────────────────────────────────────
const VisibilityModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { theme } = useTheme();
  const { sectionVisibility, toggleSectionVisibility } = useDashboard();
  const sections = DEFAULT_ORDER;

  return (
    <Sheet visible={visible} onClose={onClose} title="Section Visibility">
      {sections.map((id, i) => {
        const meta = SECTION_META[id as SectionId];
        if (!meta) return null;
        const isOn = sectionVisibility[id as SectionId];
        return (
          <TouchableOpacity
            key={id}
            style={[s.sheetRow, i < sections.length - 1 && s.rowBorder, { borderBottomColor: theme.colors.border }]}
            onPress={() => toggleSectionVisibility(id as SectionId)}
          >
            <View style={[s.sheetIcon, { backgroundColor: isOn ? theme.colors.primary : theme.colors.secondary }]}>
              <MaterialIcons name={meta.icon as any} size={15} color={isOn ? '#FFFFFF' : theme.colors.textSecondary} />
            </View>
            <Text style={[s.sheetLabel, { flex: 1, color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
              {meta.label}
            </Text>
            <View style={[s.vizPill, { backgroundColor: isOn ? theme.colors.primary : theme.colors.secondary }]}>
              <MaterialIcons
                name={isOn ? 'visibility' : 'visibility-off'}
                size={13}
                color={isOn ? '#FFFFFF' : theme.colors.textSecondary}
              />
              <Text style={[s.vizTxt, { color: isOn ? '#FFFFFF' : theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                {isOn ? 'ON' : 'OFF'}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </Sheet>
  );
};

// ─── Section Order Modal ──────────────────────────────────────────────────────
const OrderModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { theme } = useTheme();
  const { sectionOrder, setSectionOrder } = useDashboard();
  const [localOrder, setLocalOrder] = useState<SectionId[]>([...sectionOrder]);

  const move = (index: number, dir: 1 | -1) => {
    const arr = [...localOrder];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    setLocalOrder(arr);
  };

  const commit = () => { setSectionOrder(localOrder); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={[s.panel, { backgroundColor: theme.colors.cardPrimary }]} onPress={() => { }}>
          <View style={[s.handle, { backgroundColor: theme.colors.border }]} />
          <Text style={[s.sheetTitle, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>Section Order</Text>
          <Text style={[s.sheetNote, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            Use ↑↓ to reorder. Changes apply when you tap Save.
          </Text>
          <View style={[s.divider, { backgroundColor: theme.colors.border }]} />
          {localOrder.map((id, i) => {
            const meta = SECTION_META[id];
            if (!meta) return null;
            return (
              <View
                key={id}
                style={[s.sheetRow, i < localOrder.length - 1 && s.rowBorder, { borderBottomColor: theme.colors.border }]}
              >
                <View style={[s.sheetIcon, { backgroundColor: theme.colors.secondary }]}>
                  <MaterialIcons name={meta.icon as any} size={15} color={theme.colors.text} />
                </View>
                <Text style={[s.sheetLabel, { flex: 1, color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                  {meta.label}
                </Text>
                <View style={s.arrowRow}>
                  <TouchableOpacity
                    style={[s.arrowBtn, { backgroundColor: theme.colors.secondary, opacity: i === 0 ? 0.3 : 1 }]}
                    onPress={() => move(i, -1)}
                  >
                    <MaterialIcons name="keyboard-arrow-up" size={18} color={theme.colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.arrowBtn, { backgroundColor: theme.colors.secondary, opacity: i === localOrder.length - 1 ? 0.3 : 1 }]}
                    onPress={() => move(i, 1)}
                  >
                    <MaterialIcons name="keyboard-arrow-down" size={18} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <TouchableOpacity style={[s.doneBtn, { backgroundColor: theme.colors.primary, marginTop: 16 }]} onPress={commit}>
            <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Save Order</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Widget Customise Modal ───────────────────────────────────────────────────
const WidgetsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { theme } = useTheme();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    focus: true, ring: true, quote: true, weather: false, habit: false, streak: false,
  });
  return (
    <Sheet visible={visible} onClose={onClose} title="Customize Widgets">
      <Text style={[s.sheetNote, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
        Toggle widgets to show or hide them on your dashboard hero card.
      </Text>
      {WIDGETS.map((w, i) => (
        <TouchableOpacity
          key={w.id}
          style={[s.sheetRow, i < WIDGETS.length - 1 && s.rowBorder, { borderBottomColor: theme.colors.border }]}
          onPress={() => setEnabled((e) => ({ ...e, [w.id]: !e[w.id] }))}
        >
          <View style={[s.sheetIcon, { backgroundColor: enabled[w.id] ? theme.colors.primary : theme.colors.secondary }]}>
            <MaterialIcons name={w.icon as any} size={15} color={enabled[w.id] ? '#FFFFFF' : theme.colors.textSecondary} />
          </View>
          <Text style={[s.sheetLabel, { flex: 1, color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>{w.label}</Text>
          <View style={[s.checkCircle, {
            backgroundColor: enabled[w.id] ? theme.colors.primary : 'transparent',
            borderColor: enabled[w.id] ? theme.colors.primary : theme.colors.border,
          }]}>
            {enabled[w.id] && <MaterialIcons name="check" size={12} color="#FFFFFF" />}
          </View>
        </TouchableOpacity>
      ))}
    </Sheet>
  );
};

// ─── Alarm Tone Full Screen Modal ─────────────────────────────────────────────
const AlarmToneModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { theme } = useTheme();
  const { alarmTone, setAlarmTone } = useManage();
  const [previewPlayer, setPreviewPlayer] = useState<AudioPlayer | null>(null);

  // Clean up sound on unmount/re-selection
  useEffect(() => {
    return () => {
      if (previewPlayer) {
        previewPlayer.release();
      }
    };
  }, [previewPlayer]);

  const playPreview = async (toneId: string) => {
    try {
      if (previewPlayer) {
        previewPlayer.pause();
        previewPlayer.release();
        setPreviewPlayer(null);
      }

      if (toneId === 'silent') return;

      let soundAsset;
      if (toneId === 'gentle') {
        soundAsset = require('../../../assets/sounds/chimes.mp3');
      } else if (toneId === 'classic') {
        soundAsset = require('../../../assets/sounds/constant_beep.mp3');
      } else if (toneId === 'bell') {
        soundAsset = require('../../../assets/sounds/bell.mp3');
      } else if (toneId === 'default') {
        soundAsset = require('../../../assets/sounds/chimes.mp3');
      } else {
        // Custom picked URI
        soundAsset = { uri: toneId };
      }

      const player = createAudioPlayer(soundAsset);
      player.play();
      setPreviewPlayer(player);

      setTimeout(() => {
        try {
          player.pause();
        } catch (e) {}
      }, 4000);

    } catch (err) {
      console.warn('Failed to play sound preview:', err);
    }
  };

  const handlePickCustomFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const pickedAsset = res.assets[0];
      setAlarmTone(pickedAsset.uri);
      playPreview(pickedAsset.uri);
    } catch (err) {
      console.warn('Pick custom file error:', err);
    }
  };

  const isCustomSelected = !ALARM_TONES.some(t => t.id === alarmTone);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border
        }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4, marginRight: 12 }}>
            <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, color: theme.colors.text, fontFamily: 'Inter_600SemiBold', flex: 1 }}>
            Alarm Tune
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 }}>
          {/* Section: Presets */}
          <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
            BUILT-IN TONES
          </Text>
          
          <View style={{ borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.cardPrimary, overflow: 'hidden', marginBottom: 24 }}>
            {ALARM_TONES.map((tone, idx) => {
              const isSelected = alarmTone === tone.id;
              return (
                <TouchableOpacity
                  key={tone.id}
                  style={[
                    s.sheetRow,
                    { paddingHorizontal: 14, borderBottomWidth: idx < ALARM_TONES.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: theme.colors.border },
                  ]}
                  onPress={() => {
                    setAlarmTone(tone.id);
                    playPreview(tone.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[s.sheetIcon, { backgroundColor: isSelected ? theme.colors.primary : theme.colors.secondary }]}>
                    <MaterialIcons name={tone.icon} size={15} color={isSelected ? '#FFFFFF' : theme.colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 14, color: theme.colors.text, fontFamily: 'Inter_500Medium' }}>
                      {tone.label}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                      {tone.desc}
                    </Text>
                  </View>
                  <View style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 1.5,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {isSelected && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary }} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section: Custom music */}
          <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
            CUSTOM MUSIC
          </Text>

          {isCustomSelected && (
            <View style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.cardPrimary,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <View style={[s.sheetIcon, { backgroundColor: theme.colors.primary }]}>
                <MaterialIcons name="audiotrack" size={15} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={{ fontSize: 14, color: theme.colors.text, fontFamily: 'Inter_500Medium' }} numberOfLines={1}>
                  {getToneLabel(alarmTone)}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                  Selected from device
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setAlarmTone('default');
                }}
                style={{ padding: 4 }}
              >
                <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              height: 52,
              borderRadius: 26,
              borderWidth: 1.5,
              borderColor: theme.colors.primary,
              backgroundColor: theme.colors.primary + '10',
              gap: 8,
            }}
            onPress={handlePickCustomFile}
          >
            <MaterialIcons name="library-music" size={18} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.primary, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>
              Select Custom Audio File
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ─── Layout Mode Modal ────────────────────────────────────────────────────────
const LayoutModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { theme } = useTheme();
  const { layoutMode, setLayoutMode } = useDashboard();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={[s.panel, { backgroundColor: theme.colors.cardPrimary }]} onPress={() => { }}>
          <View style={[s.handle, { backgroundColor: theme.colors.border }]} />
          <Text style={[s.sheetTitle, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>Layout Mode</Text>
          <View style={[s.divider, { backgroundColor: theme.colors.border }]} />
          {LAYOUT_MODES.map((m, i) => {
            const isActive = m.id === layoutMode;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  s.layoutRow,
                  i < LAYOUT_MODES.length - 1 && s.rowBorder,
                  { borderBottomColor: theme.colors.border },
                  isActive && { backgroundColor: theme.colors.secondary },
                ]}
                onPress={() => { setLayoutMode(m.id); onClose(); }}
              >
                <View style={[s.sheetIcon, { backgroundColor: isActive ? theme.colors.primary : theme.colors.secondary }]}>
                  <MaterialIcons
                    name={m.id === 'compact' ? 'view-agenda' : m.id === 'comfortable' ? 'view-stream' : 'view-day'}
                    size={15}
                    color={isActive ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                </View>
                {/* Label block — flex: 1 ensures it takes remaining space and text wraps */}
                <View style={s.layoutLabelWrap}>
                  <Text style={[s.layoutLabel, {
                    color: theme.colors.text,
                    fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_500Medium',
                  }]}>
                    {m.label}
                  </Text>
                  <Text style={[s.layoutDesc, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {m.desc}
                  </Text>
                </View>
                {isActive
                  ? <MaterialIcons name="check" size={18} color={theme.colors.primary} />
                  : <MaterialIcons name="chevron-right" size={18} color={theme.colors.border} />}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[s.doneBtn, { backgroundColor: theme.colors.secondary, marginTop: 16 }]} onPress={onClose}>
            <Text style={{ color: theme.colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Dock Customizer Modal (Separate Page) ──────────────────────────────────
// Behaviour:
//   • ALL added tiles always visible regardless of mode
//   • Tiles within mode limit  → full colour (active)
//   • Tiles beyond mode limit  → greyed out (won't show on dock)
//   • Tap greyed tile          → swaps it to the last active position
//   • Tap active tile          → removes it
//   • Hold + drag              → reorders
const DockCustomizerModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { theme } = useTheme();
  const { dockMode, dockItems, reorderDockItems, removeDockItem, addDockItem, addDockItemAtIndex } = useManage();
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const dragIdxSV = useSharedValue(-1);
  const hoverIdxSV = useSharedValue(-1);

  const availableToAdd = ALL_AVAILABLE_DOCK_ITEMS.filter(
    a => !dockItems.some(d => d.id === a.id)
  );

  const containerWidth = Dimensions.get('window').width - 60;
  const colWidth = Math.floor(containerWidth / 4) - 0.5;
  const activeCount = dockItems.length;

  // Mode limit: how many tiles are "live" in the dock
  const modeLimit = dockMode === 'compact' ? 4 : dockMode === 'expanded-2row' ? 8 : 99;

  // Grid always shows ALL current tiles (preserves full customisation view)
  const gridRows = Math.max(1, Math.ceil(activeCount / 4));
  const gridHeight = gridRows * 98;

  const handleAddItem = (item: DockItem) => {
    // No hard block — just add; tiles beyond limit appear greyed
    addDockItem(item);
  };

  // Promote a greyed tile into the active zone by moving it to index (modeLimit-1)
  const promoteToActive = useCallback((fromIdx: number) => {
    const targetIdx = Math.min(modeLimit - 1, activeCount - 1);
    if (fromIdx !== targetIdx) reorderDockItems(fromIdx, targetIdx);
  }, [modeLimit, activeCount, reorderDockItems]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 16,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
          }}>
            <TouchableOpacity onPress={onClose} style={{ padding: 4, marginRight: 12 }}>
              <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 20, color: theme.colors.text, fontFamily: 'Inter_600SemiBold', flex: 1 }}>
              Edit Dock Layout
            </Text>
          </View>

          <ScrollView
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 64, paddingTop: 16 }}
          >
            <View style={{ paddingHorizontal: 30 }}>
              <Text style={[tileStyles.gridTitle, { color: theme.colors.text }]}>Dock Tiles</Text>
              <Text style={[tileStyles.gridSubtitle, { color: theme.colors.textSecondary }]}>
                Greyed tiles won’t show in current mode. Tap them to activate.
              </Text>

              {/* Full tile grid — ALL tiles shown */}
              <View style={{ width: containerWidth, height: gridHeight, position: 'relative', marginTop: 12 }}>
                {/* Empty slot backgrounds */}
                {Array.from({ length: gridRows * 4 }).map((_, idx) => (
                  <View
                    key={`slot-${idx}`}
                    style={[tileStyles.slot, {
                      left: (idx % 4) * colWidth,
                      top: Math.floor(idx / 4) * 98,
                      width: colWidth,
                    }]}
                  >
                    <View style={[tileStyles.slotCircle, { borderColor: theme.colors.border }]} />
                  </View>
                ))}

                {/* All dock tiles — active ones coloured, inactive ones greyed */}
                {dockItems.map((item, idx) => {
                  const isActive = idx < modeLimit;
                  return (
                    <ActiveTile
                      key={item.id}
                      item={item}
                      index={idx}
                      colWidth={colWidth}
                      activeCount={activeCount}
                      activeGridHeight={gridHeight}
                      containerWidth={containerWidth}
                      isGreyed={!isActive}
                      onRemove={isActive
                        ? () => removeDockItem(item.id)
                        : () => promoteToActive(idx)}
                      onSwap={reorderDockItems}
                      setScrollEnabled={setScrollEnabled}
                      dragIdxSV={dragIdxSV}
                      hoverIdxSV={hoverIdxSV}
                      theme={theme}
                    />
                  );
                })}
              </View>

              {/* Separator */}
              <View style={[tileStyles.editorSeparator, { borderTopColor: theme.colors.border }]}>
                <Text style={[tileStyles.instructionTxt, { color: theme.colors.textSecondary }]}>
                  Hold &amp; drag to reorder • Tap to remove / activate
                </Text>
              </View>

              <Text style={[tileStyles.gridTitle, { color: theme.colors.text, marginTop: 10 }]}>Available Tiles</Text>
              <Text style={[tileStyles.gridSubtitle, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
                Tap to add
              </Text>

              {availableToAdd.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: containerWidth }}>
                  {availableToAdd.map((item, idx) => (
                    <AvailableTile
                      key={item.id}
                      item={item}
                      index={idx}
                      onPressAtIndex={addDockItemAtIndex}
                      colWidth={colWidth}
                      activeGridHeight={gridHeight}
                      containerWidth={containerWidth}
                      activeCount={activeCount}
                      dragIdxSV={dragIdxSV}
                      hoverIdxSV={hoverIdxSV}
                      theme={theme}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[tileStyles.emptyAvailableTxt, { color: theme.colors.textSecondary }]}>
                  All available items are in your dock.
                </Text>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
};

// ─── Appearance Section ───────────────────────────────────────────────────────
const AppearanceSection = () => {
  const { theme, isDark, toggleDark, accentId, setAccent } = useTheme();
  const [activeTheme, setActiveTheme] = useState('default');
  const thumbColor = isDark ? '#FFFFFF' : '#18181B';

  return (
    <SettingsCard>
      {/* Dark Mode */}
      <View style={[s.inlineRow, { borderBottomColor: theme.colors.border }]}>
        <View style={[s.iconWrap, { backgroundColor: theme.colors.secondary }]}>
          <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={16} color={theme.colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Dark Mode</Text>
          <Text style={[s.rowSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {isDark ? 'Dark is active' : 'Light is active'}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.pillTrack, { backgroundColor: isDark ? theme.colors.primary : theme.colors.secondary, borderColor: theme.colors.border }]}
          onPress={toggleDark}
        >
          <View style={[s.pillThumb, { backgroundColor: thumbColor, transform: [{ translateX: isDark ? 20 : 2 }] }]} />
        </TouchableOpacity>
      </View>

      {/* Accent Colour — label row */}
      <View style={[s.inlineRow, { borderBottomColor: theme.colors.border }]}>
        <View style={[s.iconWrap, { backgroundColor: theme.colors.secondary }]}>
          <MaterialIcons name="palette" size={16} color={theme.colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Accent Colour</Text>
          <Text style={[s.rowSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {ACCENT_COLORS.find((c) => c.id === accentId)?.label}
          </Text>
        </View>
      </View>

      {/* Accent grid — equal padding top & bottom */}
      <View style={[s.accentGrid, { borderBottomColor: theme.colors.border }]}>
        {ACCENT_COLORS.map((color) => {
          const isActive = accentId === color.id;
          return (
            <TouchableOpacity key={color.id} style={s.accentItem} onPress={() => setAccent(color.id)}>
              <View style={[
                s.accentSwatch,
                { backgroundColor: color.value },
                isActive && { borderWidth: 3, borderColor: theme.colors.border },
              ]}>
                {isActive && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
              </View>
              <Text style={[s.accentLabel, {
                color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular',
              }]}>
                {color.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Theme label row */}
      <View style={[s.inlineRow, { borderBottomColor: theme.colors.border }]}>
        <View style={[s.iconWrap, { backgroundColor: theme.colors.secondary }]}>
          <MaterialIcons name="style" size={16} color={theme.colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Theme</Text>
          <Text style={[s.rowSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {OWNED_THEMES.length} owned
          </Text>
        </View>
      </View>

      {/* Theme cards — equal top & bottom padding */}
      <View style={[s.themeRowWrap, { borderBottomColor: theme.colors.border }]}>
        {OWNED_THEMES.map((t) => {
          const isActive = activeTheme === t.id;
          const isDarkTheme = t.bg !== '#FFFFFF';
          return (
            <TouchableOpacity
              key={t.id}
              style={[s.themeCard, { backgroundColor: t.bg, borderColor: isActive ? theme.colors.primary : theme.colors.border }, isActive && { borderWidth: 2 }]}
              onPress={() => setActiveTheme(t.id)}
            >
              <View style={[s.themeAccentDot, { backgroundColor: t.accent }]} />
              <Text style={[s.themeName, { color: isDarkTheme ? '#FAFAFA' : '#09090B', fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>
                {t.name}
              </Text>
              {isActive && (
                <View style={[s.activeBadge, { backgroundColor: theme.colors.primary }]}>
                  <MaterialIcons name="check" size={10} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={s.marketBtn}>
        <MaterialIcons name="shopping-bag" size={14} color={theme.colors.textSecondary} />
        <Text style={[s.marketTxt, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
          Browse more themes in Marketplace
        </Text>
        <MaterialIcons name="chevron-right" size={14} color={theme.colors.border} />
      </TouchableOpacity>
    </SettingsCard>
  );
};

// ─── Plugin Section ───────────────────────────────────────────────────────────
const PluginSection = () => {
  const { theme } = useTheme();
  const [plugins, setPlugins] = useState(OWNED_PLUGINS);
  const toggle = (id: string) => setPlugins((prev) => prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p));
  return (
    <SettingsCard>
      {plugins.map((p, i) => (
        <View key={p.id} style={[s.inlineRow, { borderBottomColor: theme.colors.border }, i < plugins.length - 1 && s.rowBorder]}>
          <View style={[s.iconWrap, { backgroundColor: theme.colors.secondary }]}>
            <MaterialIcons name={p.icon as any} size={16} color={theme.colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>{p.name}</Text>
            <Text style={[s.rowSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>{p.desc}</Text>
          </View>
          <TouchableOpacity style={{ padding: 4 }}>
            <MaterialIcons name="tune" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.pluginToggle, { backgroundColor: p.enabled ? theme.colors.primary : theme.colors.secondary }]} onPress={() => toggle(p.id)}>
            <Text style={[s.pluginTxt, { color: p.enabled ? '#FFFFFF' : theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              {p.enabled ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={[s.getMoreRow, { borderTopColor: theme.colors.border }]}>
        <MaterialIcons name="add-circle-outline" size={16} color={theme.colors.textSecondary} />
        <Text style={[s.getMoreTxt, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
          Get more plugins from Marketplace
        </Text>
        <MaterialIcons name="chevron-right" size={16} color={theme.colors.border} />
      </TouchableOpacity>
    </SettingsCard>
  );
};

// ─── Calendar Interaction Section ────────────────────────────────────────────
const CalendarInteractionSection = () => {
  const { theme } = useTheme();
  const { longPressDateStart, setLongPressDateStart } = useManage();

  return (
    <SettingsCard>
      <View style={[s.inlineRow, { borderBottomColor: theme.colors.border }]}>
        <View style={[s.iconWrap, { backgroundColor: theme.colors.secondary }]}>
          <MaterialIcons name="touch-app" size={16} color={theme.colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
            Long Press for Date Range
          </Text>
          <Text style={[s.rowSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {longPressDateStart
              ? 'Tap = single date. Long press = extend range'
              : 'Tap any future date to extend the range automatically'}
          </Text>
        </View>
        <Switch
          value={longPressDateStart}
          onValueChange={setLongPressDateStart}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          thumbColor="#fff"
        />
      </View>
    </SettingsCard>
  );
};

// ─── Profile Card ─────────────────────────────────────────────────────────────
const ProfileCard = () => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity style={[s.profileCard, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
      <View style={[s.avatar, { backgroundColor: theme.colors.primary }]}>
        <Text style={[s.avatarTxt, { fontFamily: 'Inter_700Bold', color: '#FFFFFF' }]}>S</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.profileName, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>Shubham</Text>
        <Text style={[s.profileEmail, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>shubham@example.com</Text>
      </View>
      <View style={[s.proBadge, { backgroundColor: theme.colors.text }]}>
        <Text style={[s.proBadgeTxt, { color: theme.colors.background, fontFamily: 'Inter_600SemiBold' }]}>PRO</Text>
      </View>
      <MaterialIcons name="chevron-right" size={18} color={theme.colors.border} />
    </TouchableOpacity>
  );
};

// Haptic feedback wrappers
const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const hapticMed   = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

// ──────────────────────────────────────────────────────────────────────────────
// ACTIVE DOCK TILE
//   isGreyed=false → full colour, tap removes
//   isGreyed=true  → dimmed, tap promotes to active zone
//   Long-press + drag always reorders regardless of greyed state
// ──────────────────────────────────────────────────────────────────────────────
const ActiveTile = React.memo(({
  item,
  index,
  colWidth,
  activeCount,
  activeGridHeight,
  containerWidth,
  isGreyed,
  onRemove,
  onSwap,
  setScrollEnabled,
  dragIdxSV,
  hoverIdxSV,
  theme,
}: {
  item: DockItem;
  index: number;
  colWidth: number;
  activeCount: number;
  activeGridHeight: number;
  containerWidth: number;
  isGreyed: boolean;
  onRemove: () => void;
  onSwap: (from: number, to: number) => void;
  setScrollEnabled: (enabled: boolean) => void;
  dragIdxSV: SharedValue<number>;
  hoverIdxSV: SharedValue<number>;
  theme: any;
}) => {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(false);
  const lastHover = useSharedValue(-1);

  const c = index % 4;
  const r = Math.floor(index / 4);
  const originalX = c * colWidth;
  const originalY = r * 98;

  const finalizeSwap = useCallback((from: number, to: number) => {
    onSwap(from, to);
    tx.value = 0;
    ty.value = 0;
    dragIdxSV.value = -1;
    hoverIdxSV.value = -1;
  }, [onSwap, dragIdxSV, hoverIdxSV, tx, ty]);

  const resetDrag = useCallback(() => {
    dragIdxSV.value = -1;
    hoverIdxSV.value = -1;
  }, [dragIdxSV, hoverIdxSV]);

  const startTime = useSharedValue(0);

  // ── Unified gesture handler: handles tap & drag reordering ─────────────────
  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onStart(() => {
      startTime.value = Date.now();
    })
    .onUpdate((e) => {
      if (!isDragging.value) {
        const dist = Math.sqrt(e.translationX * e.translationX + e.translationY * e.translationY);
        // Drag starts if touch moves > 8px OR touch is held > 250ms
        if (dist > 8 || (Date.now() - startTime.value) > 250) {
          isDragging.value = true;
          scale.value = withSpring(1.15);
          dragIdxSV.value = index;
          hoverIdxSV.value = index;
          lastHover.value = index;
          runOnJS(hapticMed)();
          runOnJS(setScrollEnabled)(false);
        }
      }

      if (isDragging.value) {
        tx.value = e.translationX;
        ty.value = e.translationY;

        const centerX = originalX + colWidth / 2 + e.translationX;
        const centerY = originalY + 49 + e.translationY;

        const targetCol = Math.max(0, Math.min(3, Math.floor(centerX / colWidth)));
        const targetRow = Math.max(0, Math.min(1, Math.floor(centerY / 98)));
        const targetIdx = Math.min(activeCount - 1, targetRow * 4 + targetCol);

        hoverIdxSV.value = targetIdx;

        if (targetIdx !== lastHover.value) {
          lastHover.value = targetIdx;
          runOnJS(hapticLight)();
        }
      }
    })
    .onEnd(() => {
      if (!isDragging.value) {
        // Tap detected (only active tiles with '-' badge can be removed on tap)
        if (!isGreyed) {
          runOnJS(hapticLight)();
          runOnJS(onRemove)();
        }
      } else {
        runOnJS(setScrollEnabled)(true);

        const target = hoverIdxSV.value;
        scale.value = withSpring(1);

        const currentY = originalY + ty.value;
        const currentX = originalX + tx.value;

        // Check if dragged outside the active grid bounds
        const outOfBounds =
          currentY < -40 ||
          currentY > activeGridHeight + 40 ||
          currentX < -40 ||
          currentX > containerWidth + 40;

        if (outOfBounds) {
          runOnJS(onRemove)();
          isDragging.value = false;
          tx.value = 0;
          ty.value = 0;
          runOnJS(resetDrag)();
        } else if (target !== -1 && target !== index) {
          const targetCol = target % 4;
          const targetRow = Math.floor(target / 4);
          const targetTx = targetCol * colWidth - originalX;
          const targetTy = targetRow * 98 - originalY;

          tx.value = withSpring(targetTx, { mass: 0.6, damping: 15, stiffness: 220 });
          ty.value = withSpring(targetTy, { mass: 0.6, damping: 15, stiffness: 220 }, (done) => {
            if (done) {
              isDragging.value = false;
              runOnJS(finalizeSwap)(index, target);
            }
          });
        } else {
          tx.value = withSpring(0, { mass: 0.6, damping: 15, stiffness: 220 });
          ty.value = withSpring(0, { mass: 0.6, damping: 15, stiffness: 220 }, (done) => {
            if (done) {
              isDragging.value = false;
              runOnJS(resetDrag)();
            }
          });
        }
        lastHover.value = -1;
      }
    });

  const composedGesture = panGesture;

  const animatedStyle = useAnimatedStyle(() => {
    if (isDragging.value) {
      return {
        transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
        zIndex: 999,
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        elevation: 8,
      };
    }

    const dIdx = dragIdxSV.value;
    const hIdx = hoverIdxSV.value;

    if (dIdx === -1 || hIdx === -1) {
      return {
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
        zIndex: 1,
      };
    }

    // Shift non-dragged tiles to show where dragged tile will land
    let vIdx = index;
    if (dIdx < hIdx) {
      if (index > dIdx && index <= hIdx) vIdx = index - 1;
    } else if (dIdx > hIdx) {
      if (index >= hIdx && index < dIdx) vIdx = index + 1;
    }

    const offsetX = (vIdx % 4) * colWidth - originalX;
    const offsetY = Math.floor(vIdx / 4) * 98 - originalY;

    return {
      transform: [
        { translateX: withSpring(offsetX, { mass: 0.5, damping: 18, stiffness: 240 }) },
        { translateY: withSpring(offsetY, { mass: 0.5, damping: 18, stiffness: 240 }) },
        { scale: 1 },
      ],
      zIndex: 1,
    };
  });

  // Greyed tiles render at lower opacity with a distinct style
  const iconBg = isGreyed
    ? `${theme.colors.textSecondary}28`
    : theme.colors.primary;
  const iconColor = isGreyed ? theme.colors.textSecondary : '#FFF';
  const labelColor = isGreyed ? theme.colors.textSecondary : theme.colors.text;

  return (
    <GestureDetector gesture={composedGesture}>
      <AnimatedReanimated.View
        style={[
          tileStyles.tileContainer,
          { position: 'absolute', left: originalX, top: originalY, width: colWidth, height: 98 },
          animatedStyle,
        ]}
      >
        <View style={[tileStyles.circleIcon, { backgroundColor: iconBg }]}>
          <MaterialIcons name={item.icon as any} size={24} color={iconColor} />
          {/* Badge: active = "−" remove icon, greyed = no badge */}
          {!isGreyed && (
            <View style={tileStyles.badgeRemove}>
              <MaterialIcons name="remove" size={10} color="#FFF" />
            </View>
          )}
        </View>
        <Text style={[tileStyles.tileLabel, { color: labelColor }]} numberOfLines={1}>
          {item.label}
        </Text>
      </AnimatedReanimated.View>
    </GestureDetector>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// AVAILABLE DOCK TILE — drag to insert at index
// ──────────────────────────────────────────────────────────────────────────────
const AvailableTile = React.memo(({
  item,
  index,
  onPressAtIndex,
  colWidth,
  activeGridHeight,
  containerWidth,
  activeCount,
  dragIdxSV,
  hoverIdxSV,
  theme,
}: {
  item: DockItem;
  index: number;
  onPressAtIndex: (item: DockItem, idx: number) => void;
  colWidth: number;
  activeGridHeight: number;
  containerWidth: number;
  activeCount: number;
  dragIdxSV: SharedValue<number>;
  hoverIdxSV: SharedValue<number>;
  theme: any;
}) => {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(false);
  const startTime = useSharedValue(0);
  const lastHover = useSharedValue(-1);

  const availCol = index % 4;
  const availRow = Math.floor(index / 4);
  const availX = availCol * colWidth;
  const availY = availRow * 98;

  // Position relative to active grid top-left
  const tileX_rel_active = availX;

  const resetDrag = useCallback(() => {
    dragIdxSV.value = -1;
    hoverIdxSV.value = -1;
  }, [dragIdxSV, hoverIdxSV]);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onStart(() => {
      startTime.value = Date.now();
    })
    .onUpdate((e) => {
      const gridHeight = activeGridHeight;
      const tileY_rel_active = gridHeight + 96 + availY;

      if (!isDragging.value) {
        const dist = Math.sqrt(e.translationX * e.translationX + e.translationY * e.translationY);
        // Drag starts if touch moves > 8px OR touch is held > 250ms
        if (dist > 8 || (Date.now() - startTime.value) > 250) {
          isDragging.value = true;
          scale.value = withSpring(1.15);
          dragIdxSV.value = activeCount; // Virtual index representing the new item
          runOnJS(hapticMed)();
        }
      }

      if (isDragging.value) {
        tx.value = e.translationX;
        ty.value = e.translationY;

        const currentX = tileX_rel_active + e.translationX;
        const currentY = tileY_rel_active + e.translationY;

        // Check if hovering over active grid area
        const inActiveGrid =
          currentY >= -20 &&
          currentY <= gridHeight + 20 &&
          currentX >= -20 &&
          currentX <= containerWidth + 20;

        if (inActiveGrid) {
          const targetCol = Math.max(0, Math.min(3, Math.floor((currentX + colWidth / 2) / colWidth)));
          const targetRow = Math.max(0, Math.min(1, Math.floor((currentY + 49) / 98)));
          const targetIdx = Math.max(0, Math.min(activeCount, targetRow * 4 + targetCol));

          hoverIdxSV.value = targetIdx;

          if (targetIdx !== lastHover.value) {
            lastHover.value = targetIdx;
            runOnJS(hapticLight)();
          }
        } else {
          hoverIdxSV.value = -1;
          lastHover.value = -1;
        }
      }
    })
    .onEnd(() => {
      scale.value = withSpring(1);
      if (!isDragging.value) {
        // Tap detected -> do nothing
      } else {
        const gridHeight = activeGridHeight;
        const tileY_rel_active = gridHeight + 96 + availY;

        const currentX = tileX_rel_active + tx.value;
        const currentY = tileY_rel_active + ty.value;

        const inActiveGrid =
          currentY >= -20 &&
          currentY <= gridHeight + 20 &&
          currentX >= -20 &&
          currentX <= containerWidth + 20;

        if (inActiveGrid && hoverIdxSV.value !== -1) {
          const targetIdx = hoverIdxSV.value;
          runOnJS(hapticLight)();
          runOnJS(onPressAtIndex)(item, targetIdx);
        }

        runOnJS(resetDrag)();
        tx.value = withSpring(0);
        ty.value = withSpring(0);
        isDragging.value = false;
        lastHover.value = -1;
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    if (isDragging.value) {
      return {
        transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
        zIndex: 999,
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        elevation: 8,
      };
    }
    return {
      transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      zIndex: 1,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <AnimatedReanimated.View
        style={[
          tileStyles.tileContainer,
          { width: colWidth, height: 98 },
          animatedStyle,
        ]}
      >
        <View style={[tileStyles.circleIcon, { backgroundColor: `${theme.colors.textSecondary}18` }]}>
          <MaterialIcons name={item.icon as any} size={24} color={theme.colors.textSecondary} />
        </View>
        <Text style={[tileStyles.tileLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {item.label}
        </Text>
      </AnimatedReanimated.View>
    </GestureDetector>
  );
});

const DOCK_MODES: { mode: DockMode; label: string; sub: string }[] = [
  { mode: 'compact',       label: 'Standard',  sub: '4 tabs, always visible'  },
  { mode: 'expanded-2row', label: '2-Row',      sub: 'Swipe up for 2nd row'    },
  { mode: 'fullscreen',    label: 'Fullscreen', sub: 'Swipe up for app drawer' },
];

const OPACITY_PRESETS = [0.2, 0.4, 0.6, 0.8, 1.0];

// Minimal phone wireframe showing each dock mode
const PhoneMockup = ({
  mode, bgColor, accentColor,
}: { mode: DockMode; bgColor: string; accentColor: string }) => (
  <View style={[dm.phone, { borderColor: accentColor }]}>
    <View style={[dm.phoneScreen, { backgroundColor: bgColor }]}>
      {mode === 'fullscreen' && (
        <View style={dm.fsGrid}>
          {[0,1,2,3,4,5].map(i => (
            <View key={i} style={[dm.fsDot, { backgroundColor: accentColor }]} />
          ))}
        </View>
      )}
      {mode === 'expanded-2row' && (
        <View style={dm.twoRowMock}>
          <View style={[dm.mockRow, { backgroundColor: `${accentColor}50` }]} />
          <View style={[dm.mockRow, { backgroundColor: accentColor }]} />
        </View>
      )}
      {mode === 'compact' && (
        <View style={dm.compactMock}>
          <View style={[dm.mockRow, { backgroundColor: accentColor }]} />
        </View>
      )}
    </View>
  </View>
);

const DockSettingsManager = ({
  setShowDock,
}: {
  setShowDock: (show: boolean) => void;
}) => {
  const { theme } = useTheme();
  const {
    dockMode, setDockMode,
    dockItems,
    hideDock, setHideDock,
  } = useManage();

  const isCompact = dockMode === 'compact';

  return (
    <>
      {/* ─ Mode selector cards ──────────────────────────────────── */}
      <View style={dm.modeRow}>
        {DOCK_MODES.map(({ mode, label, sub }) => {
          const active = dockMode === mode;
          return (
            <TouchableOpacity
              key={mode}
              style={[
                dm.modeCard,
                {
                  backgroundColor: active
                    ? `${theme.colors.primary}12`
                    : theme.colors.cardPrimary,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setDockMode(mode)}
              activeOpacity={0.8}
            >
              <PhoneMockup
                mode={mode}
                bgColor={theme.colors.secondary}
                accentColor={active ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text
                style={[
                  dm.modeLabel,
                  {
                    color: active ? theme.colors.primary : theme.colors.text,
                    fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
                  },
                ]}
              >
                {label}
              </Text>
              <Text style={[dm.modeSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                {sub}
              </Text>
              {active && (
                <MaterialIcons name="check-circle" size={14} color={theme.colors.primary} style={{ marginTop: 2 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─ Customize active tiles settings row ────────────────── */}
      <SettingsCard>
        <ToggleRow
          icon="visibility-off"
          label="Hide Navigation Dock"
          subtitle="Replaces bottom bar with a quick action FAB"
          value={hideDock}
          onChange={setHideDock}
        />
        <SettingRow
          icon="widgets"
          label="Customize Active Tiles"
          value={`${dockItems.length} active`}
          onPress={() => setShowDock(true)}
          isLast
        />
      </SettingsCard>
    </>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const SettingsScreen = ({ onClose }: { onClose?: () => void }) => {
  const { theme } = useTheme();
  const { sectionVisibility, layoutMode } = useDashboard();
  const { alarmTone, dockItems, fabPosition, setFabPosition } = useManage();
  const [notif, setNotif] = useState(true);
  const [remind, setRemind] = useState(true);
  const [sync, setSync] = useState(false);
  const [showVis, setShowVis] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [showWidgets, setShowWidgets] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [showTones, setShowTones] = useState(false);
  const [showDock, setShowDock] = useState(false);

  const visibleCount = Object.values(sectionVisibility).filter(Boolean).length;
  const activeMode = LAYOUT_MODES.find((m) => m.id === layoutMode)?.label ?? 'Comfortable';
  const activeTone = getToneLabel(alarmTone);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={{ padding: 4, marginLeft: -4, marginRight: 8 }}>
            <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <Text style={{ fontSize: 20, letterSpacing: -0.4, color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }}>
          Settings
        </Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <ProfileCard />
        </View>

        <SectionHeader label="APPEARANCE" />
        <AppearanceSection />

        <SectionHeader label="DOCK" />
        <DockSettingsManager setShowDock={setShowDock} />

        <SectionHeader label="DASHBOARD" />
        <SettingsCard>
          <SettingRow icon="dashboard" label="Customize Widgets" value="3 active" onPress={() => setShowWidgets(true)} />
          <SettingRow icon="view-list" label="Section Visibility" value={`${visibleCount} / 6 on`} onPress={() => setShowVis(true)} />
          <SettingRow icon="swap-vert" label="Section Order" onPress={() => setShowOrder(true)} />
          <SettingRow icon="space-dashboard" label="Layout Mode" value={activeMode} onPress={() => setShowLayout(true)} isLast />
        </SettingsCard>

        <SectionHeader label="PLUGINS" />
        <PluginSection />

        <SectionHeader label="APP SETTINGS" />
        <SettingsCard>
          <ToggleRow icon="notifications-none" label="Push Notifications" subtitle="Task reminders and updates" value={notif} onChange={setNotif} />
          <ToggleRow icon="alarm" label="Default Reminders" subtitle="30 min before due time" value={remind} onChange={setRemind} />
          <ToggleRow icon="cloud-sync" label="Sync & Backup" subtitle="Auto-sync every 6 hours" value={sync} onChange={setSync} />
          <SettingRow icon="music-note" label="Alarm Tune" value={activeTone} onPress={() => setShowTones(true)} />
          {/* FAB Position Segmented Row */}
          <View style={[s.inlineRow, { borderBottomColor: theme.colors.border }]}>
            <View style={[s.iconWrap, { backgroundColor: theme.colors.secondary }]}>
              <MaterialIcons name="touch-app" size={16} color={theme.colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>FAB Alignment</Text>
              <Text style={[s.rowSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Position of the quick action button
              </Text>
            </View>
            {/* Segmented Control */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: theme.colors.secondary,
              borderRadius: 8,
              padding: 3,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 6,
                  backgroundColor: fabPosition === 'left' ? theme.colors.primary : 'transparent',
                }}
                onPress={() => setFabPosition('left')}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 12,
                  color: fabPosition === 'left' ? '#FFFFFF' : theme.colors.textSecondary,
                  fontFamily: fabPosition === 'left' ? 'Inter_600SemiBold' : 'Inter_500Medium',
                }}>
                  Left
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 6,
                  backgroundColor: fabPosition === 'right' ? theme.colors.primary : 'transparent',
                }}
                onPress={() => setFabPosition('right')}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 12,
                  color: fabPosition === 'right' ? '#FFFFFF' : theme.colors.textSecondary,
                  fontFamily: fabPosition === 'right' ? 'Inter_600SemiBold' : 'Inter_500Medium',
                }}>
                  Right
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <SettingRow icon="lock" label="Privacy & Data" onPress={() => { }} />
          <SettingRow icon="help-outline" label="Help & Support" onPress={() => { }} isLast />
        </SettingsCard>

        <SectionHeader label="CALENDAR" />
        <CalendarInteractionSection />

        <SectionHeader label="ACCOUNT" />
        <SettingsCard>
          <SettingRow icon="inventory-2" label="My Purchases" value="5 items" onPress={() => { }} />
          <SettingRow icon="manage-accounts" label="Manage Account" onPress={() => { }} />
          <SettingRow icon="logout" label="Log Out" onPress={() => { }} danger isLast />
        </SettingsCard>

        <Text style={[s.version, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          Modular v1.0.0 · Build 100
        </Text>
      </ScrollView>

      <VisibilityModal visible={showVis} onClose={() => setShowVis(false)} />
      <OrderModal visible={showOrder} onClose={() => setShowOrder(false)} />
      <WidgetsModal visible={showWidgets} onClose={() => setShowWidgets(false)} />
      <LayoutModal visible={showLayout} onClose={() => setShowLayout(false)} />
      <AlarmToneModal visible={showTones} onClose={() => setShowTones(false)} />
      <DockCustomizerModal visible={showDock} onClose={() => setShowDock(false)} />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },

  // Profile
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 18 },
  profileName: { fontSize: 15 },
  profileEmail: { fontSize: 12, marginTop: 1 },
  proBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  proBadgeTxt: { fontSize: 10, letterSpacing: 0.5 },

  // Row primitives
  inlineRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14 },
  rowSub: { fontSize: 12, marginTop: 1 },

  // Dark mode pill — always contrast
  pillTrack: { width: 46, height: 28, borderRadius: 14, borderWidth: 1, justifyContent: 'center' },
  pillThumb: { width: 22, height: 22, borderRadius: 11, position: 'absolute' },

  // Accent grid — EQUAL top & bottom via paddingVertical
  accentGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingVertical: 14,     // ← equal top and bottom
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accentItem: { width: '25%', alignItems: 'center', paddingVertical: 4, gap: 5 },
  accentSwatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  accentLabel: { fontSize: 11 },

  // Theme cards — EQUAL top & bottom
  themeRowWrap: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,      // ← equal top and bottom
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  themeCard: { flex: 1, height: 64, borderRadius: 8, borderWidth: 1, padding: 8, justifyContent: 'flex-end', position: 'relative', overflow: 'hidden' },
  themeAccentDot: { width: 16, height: 16, borderRadius: 8, position: 'absolute', top: 8, right: 8 },
  themeName: { fontSize: 10 },
  activeBadge: { position: 'absolute', bottom: 6, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  marketBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  marketTxt: { fontSize: 13, flex: 1 },

  // Plugin
  pluginToggle: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  pluginTxt: { fontSize: 11 },
  getMoreRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  getMoreTxt: { flex: 1, fontSize: 13 },

  // Bottom sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  panel: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12, maxHeight: '85%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, letterSpacing: -0.3, marginBottom: 4 },
  sheetNote: { fontSize: 13, lineHeight: 18, marginBottom: 12, marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  doneBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  doneTxt: { fontSize: 15 },

  // Sheet rows
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  sheetIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetLabel: { fontSize: 14 },

  // Layout mode row — allows text to wrap
  layoutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12, borderBottomWidth: 0, paddingHorizontal: 4, borderRadius: 8 },
  layoutLabelWrap: { flex: 1, flexShrink: 1, marginRight: 4 },
  layoutLabel: { fontSize: 14, letterSpacing: -0.1 },
  layoutDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },

  vizPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  vizTxt: { fontSize: 11 },
  checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  arrowRow: { flexDirection: 'row', gap: 6 },
  arrowBtn: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },

  version: { textAlign: 'center', fontSize: 12, marginTop: 24, marginBottom: 8 },
});

// Custom Stylesheet for the Premium Tile Grid Editor
const tileStyles = StyleSheet.create({
  gridTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
  gridSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    lineHeight: 14,
  },
  tileContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  circleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tileLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 8,
    textAlign: 'center',
    width: '95%',
  },
  badgeRemove: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeAdd: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  slot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    height: 98,
  },
  slotCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  editorSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginVertical: 12,
    paddingTop: 10,
    alignItems: 'center',
  },
  instructionTxt: {
    fontSize: 10.5,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  emptyAvailableTxt: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

const dm = StyleSheet.create({
  // Mode selector
  modeRow:  { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  modeCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 6,
  },
  modeLabel: { fontSize: 12, textAlign: 'center' },
  modeSub:   { fontSize: 10, textAlign: 'center', lineHeight: 13 },

  // Phone wireframe mockup
  phone: {
    width: 42,
    height: 66,
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  phoneScreen: {
    flex: 1,
    padding: 3,
    justifyContent: 'flex-end',
  },
  // Compact mock: single row at bottom
  compactMock: { alignItems: 'stretch' },
  // 2-row mock
  twoRowMock:  { gap: 2 },
  mockRow:     { height: 8, borderRadius: 3 },
  // Fullscreen grid mock
  fsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
    alignContent: 'center',
    marginBottom: 4,
  },
  fsDot: { width: 8, height: 8, borderRadius: 2 },

  // Row badge
  rowBadge:    { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginRight: 4 },
  rowBadgeTxt: { fontSize: 10 },

  // Backdrop settings
  bdStyleRow:  { flexDirection: 'row', gap: 6 },
  bdStylePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  bdStyleTxt:  { fontSize: 12 },
  opacityRow:  { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  opacityPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, minWidth: 46, alignItems: 'center' },
  opacityTxt:  { fontSize: 11 },
});
