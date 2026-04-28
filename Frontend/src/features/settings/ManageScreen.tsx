import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal,
  TextInput, Pressable, Alert, LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../themes/ThemeContext';
import { TopNavbar } from '../../layout/TopNavbar';
import { BottomNavbar } from '../../layout/BottomNavbar';
import {
  useManage, ManagedPriority, ManagedTag, PALETTE_COLORS,
} from '../../core/ManageContext';

// ─── Shared Bottom Sheet ──────────────────────────────────────────────────────
const Sheet = ({
  visible, onClose, title, children,
}: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sh.overlay} onPress={onClose}>
        <Pressable style={[sh.panel, { backgroundColor: theme.colors.cardPrimary }]} onPress={() => {}}>
          <View style={[sh.handle, { backgroundColor: theme.colors.border }]} />
          <Text style={[sh.title, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>{title}</Text>
          <View style={[sh.divider, { backgroundColor: theme.colors.border }]} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Colour Picker Row ────────────────────────────────────────────────────────
const ColorPicker = ({ selected, onSelect }: { selected: string; onSelect: (c: string) => void }) => (
  <View style={cp.grid}>
    {PALETTE_COLORS.map(c => (
      <TouchableOpacity key={c} style={[cp.swatch, { backgroundColor: c }, selected === c && cp.swatchActive]} onPress={() => onSelect(c)}>
        {selected === c && <MaterialIcons name="check" size={12} color="#FFF" />}
      </TouchableOpacity>
    ))}
  </View>
);

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
        <TextInput
          style={[ms.sheetInput, { color: theme.colors.text, borderColor: theme.colors.border, fontFamily: 'Inter_500Medium' }]}
          placeholder="e.g. Critical"
          placeholderTextColor={theme.colors.textSecondary}
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
        <TextInput
          style={[ms.sheetInput, { color: theme.colors.text, borderColor: theme.colors.border, fontFamily: 'Inter_500Medium' }]}
          placeholder="Label"
          placeholderTextColor={theme.colors.textSecondary}
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
// TAG MANAGER
// ──────────────────────────────────────────────────────────────────────────────
const TagManager = () => {
  const { theme } = useTheme();
  const { tags, addTag, updateTag, deleteTag } = useManage();

  const [showAdd, setShowAdd]       = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedTag | null>(null);
  const [newLabel, setNewLabel]     = useState('');
  const [newColor, setNewColor]     = useState(PALETTE_COLORS[5]);

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
      }},
    ]);
  };

  return (
    <>
      <SectionHdr label="TAGS" action="Add" onAction={openAdd} />
      <Card>
        {tags.map((t, i) => (
          <View key={t.id} style={[ms.row, i < tags.length - 1 && ms.rowBorder, { borderBottomColor: theme.colors.border }]}>
            <View style={[ms.tagChip, { backgroundColor: `${t.color}22`, borderColor: t.color }]}>
              <View style={[ms.tagDot, { backgroundColor: t.color }]} />
              <Text style={[ms.tagChipTxt, { color: t.color, fontFamily: 'Inter_600SemiBold' }]}>{t.label}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => openEdit(t)} style={ms.iconBtn}>
              <MaterialIcons name="edit" size={17} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDelete(t)} style={ms.iconBtn}>
              <MaterialIcons name="delete-outline" size={17} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}
      </Card>

      {/* Add Sheet */}
      <Sheet visible={showAdd} onClose={() => setShowAdd(false)} title="New Tag">
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>Name</Text>
        <TextInput
          style={[ms.sheetInput, { color: theme.colors.text, borderColor: theme.colors.border, fontFamily: 'Inter_500Medium' }]}
          placeholder="e.g. Finance"
          placeholderTextColor={theme.colors.textSecondary}
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
        <TextInput
          style={[ms.sheetInput, { color: theme.colors.text, borderColor: theme.colors.border, fontFamily: 'Inter_500Medium' }]}
          placeholder="Tag name"
          placeholderTextColor={theme.colors.textSecondary}
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
  const [newPreset, setNewPreset] = useState('');

  const commitAdd = () => {
    if (!newPreset.trim()) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addReminderPreset(newPreset.trim());
    setNewPreset('');
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
        <Text style={[ms.sheetLabel2, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          Preset label (e.g. "2 days before")
        </Text>
        <TextInput
          style={[ms.sheetInput, { color: theme.colors.text, borderColor: theme.colors.border, fontFamily: 'Inter_500Medium' }]}
          placeholder="2 days before"
          placeholderTextColor={theme.colors.textSecondary}
          value={newPreset}
          onChangeText={setNewPreset}
          autoFocus
        />
        <TouchableOpacity style={[ms.doneBtn, { backgroundColor: theme.colors.primary }]} onPress={commitAdd}>
          <Text style={[ms.doneTxt, { color: '#FFF', fontFamily: 'Inter_600SemiBold' }]}>Add Preset</Text>
        </TouchableOpacity>
      </Sheet>
    </>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// TASK DEFAULTS SECTION
// ──────────────────────────────────────────────────────────────────────────────
const TaskDefaultsSection = () => {
  const { theme } = useTheme();
  const { priorities, defaultPriority, setDefaultPriority } = useManage();
  const active = priorities.find(p => p.id === defaultPriority);

  return (
    <>
      <SectionHdr label="TASK DEFAULTS" />
      <Card>
        <View style={[ms.row, { borderBottomColor: theme.colors.border }]}>
          <View style={[ms.iconWrap, { backgroundColor: theme.colors.secondary }]}>
            <MaterialIcons name="outlined-flag" size={16} color={theme.colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ms.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Default Priority</Text>
            <Text style={[ms.rowSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              {active ? active.label : 'None — set one from Priorities above'}
            </Text>
          </View>
          {active && (
            <View style={[ms.colorDot, { backgroundColor: active.color, marginRight: 0 }]} />
          )}
        </View>
      </Card>
      <Text style={[ms.hint, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
        Tap "Set default" next to a priority above to activate it here.
      </Text>
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* Hero header */}
        <View style={[ms.hero, { borderBottomColor: theme.colors.border }]}>
          <View style={[ms.heroIcon, { backgroundColor: theme.colors.primary }]}>
            <MaterialIcons name="tune" size={22} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ms.heroTitle, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>Manage</Text>
            <Text style={[ms.heroSub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Personalise priorities, tags &amp; reminders
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <PriorityManager />
          <View style={ms.gap} />
          <TagManager />
          <View style={ms.gap} />
          <ReminderPresetsManager />
          <View style={ms.gap} />
          <TaskDefaultsSection />
        </View>
      </ScrollView>
      <BottomNavbar />
    </SafeAreaView>
  );
};

// ─── Shared sheet styles ──────────────────────────────────────────────────────
const sh = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  panel:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, maxHeight: '85%' },
  handle:  { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:   { fontSize: 18, letterSpacing: -0.3, marginBottom: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 16 },
});

// ─── Color picker styles ──────────────────────────────────────────────────────
const cp = StyleSheet.create({
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 12 },
  swatch:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)' },
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
  sheetLabel2: { fontSize: 13, marginBottom: 8 },
  sheetInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, marginBottom: 4,
  },
  doneBtn:   { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  doneTxt:   { fontSize: 15 },

  // Hint
  hint: { fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 4, paddingHorizontal: 2 },
});
