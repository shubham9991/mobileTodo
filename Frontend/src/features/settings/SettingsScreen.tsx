import React, { useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, ACCENT_COLORS } from '../../themes/ThemeContext';
import {
  useDashboard, SectionId, SECTION_META, LAYOUT_MODES, DEFAULT_ORDER,
} from '../../core/DashboardContext';
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const SettingsScreen = ({ onClose }: { onClose?: () => void }) => {
  const { theme } = useTheme();
  const { sectionVisibility, layoutMode } = useDashboard();
  const [notif, setNotif] = useState(true);
  const [remind, setRemind] = useState(true);
  const [sync, setSync] = useState(false);
  const [showVis, setShowVis] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [showWidgets, setShowWidgets] = useState(false);
  const [showLayout, setShowLayout] = useState(false);

  const visibleCount = Object.values(sectionVisibility).filter(Boolean).length;
  const activeMode = LAYOUT_MODES.find((m) => m.id === layoutMode)?.label ?? 'Comfortable';

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
          <SettingRow icon="lock" label="Privacy & Data" onPress={() => { }} />
          <SettingRow icon="help-outline" label="Help & Support" onPress={() => { }} isLast />
        </SettingsCard>

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
