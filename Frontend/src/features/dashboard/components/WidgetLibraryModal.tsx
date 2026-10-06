import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { BentoWidgetKey } from '../dashboardPrefsStore';

export interface WidgetLibraryItem {
  id: BentoWidgetKey;
  title: string;
  category: 'productivity' | 'core' | 'creativity';
  desc: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
}

export const ALL_LIBRARY_WIDGETS: WidgetLibraryItem[] = [
  {
    id: 'pomodoro',
    title: 'Pomodoro Sprint Timer',
    category: 'productivity',
    desc: '25m Focus / 5m Break sprint timer with session counter & linked task',
    icon: 'timer',
    color: '#EF4444',
  },
  {
    id: 'scratchpad',
    title: 'Quick Scratchpad',
    category: 'creativity',
    desc: 'Instant sticky memo card with 1-tap "Convert to Note" button',
    icon: 'sticky-note-2',
    color: '#F59E0B',
  },
  {
    id: 'habits',
    title: 'Daily Habit & Streak Tracker',
    category: 'productivity',
    desc: 'Track hydration, reading & workouts with continuous 🔥 streak count',
    icon: 'local-fire-department',
    color: '#F97316',
  },
  {
    id: 'productivityStats',
    title: 'Productivity Velocity Score',
    category: 'productivity',
    desc: 'Real-time daily completion percentage, notes count & sketches count',
    icon: 'insights',
    color: '#8B5CF6',
  },
  {
    id: 'tasks',
    title: "Today's Tasks Checklist",
    category: 'core',
    desc: 'Rapid task check-offs, details inspection & quick-add sheet access',
    icon: 'check-circle-outline',
    color: '#10B981',
  },
  {
    id: 'recentNote',
    title: 'Recent Note Snippet',
    category: 'core',
    desc: 'Preview of your latest note with 1-tap full editor opening',
    icon: 'description',
    color: '#F59E0B',
  },
  {
    id: 'sketch',
    title: 'Latest Canvas Sketch',
    category: 'creativity',
    desc: 'Visual canvas thumbnail with live drawing studio launcher',
    icon: 'brush',
    color: '#6366F1',
  },
  {
    id: 'quickCapture',
    title: 'Quick Capture Action Dock',
    category: 'core',
    desc: 'Fast 1-tap buttons to spawn +Task, +Note, and +Sketch instantly',
    icon: 'bolt',
    color: '#3B82F6',
  },
  {
    id: 'recentSketches',
    title: 'Recent Canvas Sketches Carousel',
    category: 'creativity',
    desc: 'Multi-sketch gallery displaying all recent tldraw canvases',
    icon: 'palette',
    color: '#8B5CF6',
  },
  {
    id: 'upcoming',
    title: 'Upcoming Deadlines Strip',
    category: 'core',
    desc: 'Timeline of tasks scheduled for tomorrow and later this week',
    icon: 'calendar-month',
    color: '#06B6D4',
  },
];

interface WidgetLibraryModalProps {
  visible: boolean;
  onClose: () => void;
  activeWidgetIds: BentoWidgetKey[];
  onAddWidget: (id: BentoWidgetKey) => void;
}

export const WidgetLibraryModal = ({
  visible,
  onClose,
  activeWidgetIds,
  onAddWidget,
}: WidgetLibraryModalProps) => {
  const { theme } = useTheme();

  const handleAdd = (id: BentoWidgetKey) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onAddWidget(id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <SafeAreaView style={[styles.sheet, { backgroundColor: theme.colors.cardPrimary }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <View>
              <Text style={[styles.title, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                Widget Library
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Add widgets to customize your dashboard page
              </Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialIcons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* List */}
          <FlatList
            data={ALL_LIBRARY_WIDGETS}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isAlreadyAdded = activeWidgetIds.includes(item.id);

              return (
                <View
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: theme.colors.secondary,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
                    <MaterialIcons name={item.icon} size={22} color={item.color} />
                  </View>

                  <View style={styles.itemTextWrap}>
                    <Text style={[styles.itemTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.itemDesc, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                      {item.desc}
                    </Text>
                  </View>

                  {isAlreadyAdded ? (
                    <View style={[styles.addedBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                      <MaterialIcons name="check" size={14} color={theme.colors.primary} />
                      <Text style={[styles.addedText, { color: theme.colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                        Active
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() => handleAdd(item.id)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="add" size={18} color="#fff" />
                      <Text style={[styles.addBtnText, { color: '#fff', fontFamily: 'Inter_600SemiBold' }]}>
                        Add
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    height: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13.5,
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addedText: {
    fontSize: 11,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
  },
});
