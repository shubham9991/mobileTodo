import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { Task } from '../../../core/dummyData';

interface QuickTasksModalProps {
  visible: boolean;
  onClose: () => void;
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
  onOpenTaskDetail: (taskId: string) => void;
  onAddTask: (title: string) => void;
}

export const QuickTasksModal = ({
  visible,
  onClose,
  tasks,
  onToggleTask,
  onOpenTaskDetail,
  onAddTask,
}: QuickTasksModalProps) => {
  const { theme } = useTheme();
  const [quickInput, setQuickInput] = useState('');

  const completedCount = tasks.filter(t => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const handleToggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onToggleTask(id);
  };

  const handleOpenDetail = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    onOpenTaskDetail(id);
  };

  const handleQuickAdd = () => {
    const trimmed = quickInput.trim();
    if (!trimmed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onAddTask(trimmed);
    setQuickInput('');
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.headerLeft}>
                <MaterialIcons name="check-circle" size={20} color="#10B981" />
                <View>
                  <Text style={[styles.title, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                    Today's Quick Tasks
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {completedCount} of {tasks.length} completed ({progressPercent}%)
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <MaterialIcons name="close" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${progressPercent}%`, backgroundColor: '#10B981' },
                ]}
              />
            </View>

            {/* Tasks List */}
            <FlatList
              data={tasks}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.taskRow,
                    {
                      backgroundColor: item.completed ? `${theme.colors.primary}08` : theme.colors.secondary,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  {/* Isolated Checkbox Target */}
                  <TouchableOpacity
                    style={styles.checkboxTouch}
                    onPress={() => handleToggle(item.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: item.completed ? theme.colors.primary : theme.colors.border,
                          backgroundColor: item.completed ? theme.colors.primary : 'transparent',
                        },
                      ]}
                    >
                      {item.completed && <MaterialIcons name="check" size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>

                  {/* Isolated Title / Text Target ("likhe hue par tap karne se task detail") */}
                  <TouchableOpacity
                    style={styles.taskTextTouch}
                    onPress={() => handleOpenDetail(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.taskTitle,
                        {
                          color: item.completed ? theme.colors.textSecondary : theme.colors.text,
                          textDecorationLine: item.completed ? 'line-through' : 'none',
                          fontFamily: item.completed ? 'Inter_400Regular' : 'Inter_500Medium',
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>

                    <View style={styles.metaRow}>
                      {item.priority && (
                        <View
                          style={[
                            styles.priorityTag,
                            {
                              backgroundColor:
                                item.priority === 'HIGH'
                                  ? '#EF444415'
                                  : item.priority === 'MED'
                                  ? '#F9731615'
                                  : '#10B98115',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.priorityText,
                              {
                                color:
                                  item.priority === 'HIGH'
                                    ? '#EF4444'
                                    : item.priority === 'MED'
                                    ? '#F97316'
                                    : '#10B981',
                                fontFamily: 'Inter_600SemiBold',
                              },
                            ]}
                          >
                            {item.priority}
                          </Text>
                        </View>
                      )}

                      {item.tag && (
                        <Text style={[styles.tagText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                          #{item.tag}
                        </Text>
                      )}

                      {item.dueDate && (
                        <View style={styles.dueWrap}>
                          <MaterialIcons name="schedule" size={11} color={theme.colors.textSecondary} />
                          <Text style={[styles.dueText, { color: theme.colors.textSecondary }]}>
                            {item.dueDate}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Arrow cue to open detail */}
                  <TouchableOpacity
                    onPress={() => handleOpenDetail(item.id)}
                    style={styles.arrowTouch}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <MaterialIcons name="chevron-right" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <MaterialIcons name="task-alt" size={40} color="#10B981" />
                  <Text style={[styles.emptyTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                    No tasks for today
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    Use the quick composer below to add your first task!
                  </Text>
                </View>
              }
            />

            {/* Sticky Inline Quick-Add Composer */}
            <View style={[styles.composerWrap, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.cardPrimary }]}>
              <View style={[styles.inputBox, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.colors.text, fontFamily: 'Inter_400Regular' }]}
                  placeholder="Add task for today..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={quickInput}
                  onChangeText={setQuickInput}
                  onSubmitEditing={handleQuickAdd}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[
                    styles.addBtn,
                    {
                      backgroundColor: quickInput.trim() ? theme.colors.primary : theme.colors.border,
                      opacity: quickInput.trim() ? 1 : 0.6,
                    },
                  ]}
                  onPress={handleQuickAdd}
                  disabled={!quickInput.trim()}
                >
                  <MaterialIcons name="add" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressBar: {
    height: '100%',
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  checkboxTouch: {
    paddingRight: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTextTouch: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  priorityTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 9.5,
  },
  tagText: {
    fontSize: 11,
  },
  dueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dueText: {
    fontSize: 10.5,
  },
  arrowTouch: {
    paddingLeft: 6,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  composerWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 8,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
