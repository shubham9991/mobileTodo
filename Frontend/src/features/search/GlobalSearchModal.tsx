import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, Pressable
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../themes/ThemeContext';
import { dummyData } from '../../core/dummyData';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CATEGORIES = ['All', 'Work', 'Personal', 'Food', 'Health', 'Learning'];

export const GlobalSearchModal = ({ visible, onClose }: Props) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Flatten all tasks
  const allTasks = useMemo(() => {
    return dummyData.taskGroups.flatMap(group => group.tasks);
  }, []);

  const allNotes = useMemo(() => {
    return dummyData.recentNotes;
  }, []);

  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => {
      const matchCat = activeCategory === 'All' || task.tag?.toUpperCase() === activeCategory.toUpperCase();
      const matchQuery = query === '' || 
        task.title.toLowerCase().includes(query.toLowerCase()) ||
        task.subtasks?.some(st => st.text.toLowerCase().includes(query.toLowerCase()));
      return matchCat && matchQuery;
    });
  }, [allTasks, query, activeCategory]);

  const filteredNotes = useMemo(() => {
    return allNotes.filter(note => {
      const matchCat = activeCategory === 'All' || note.tag?.toUpperCase() === activeCategory.toUpperCase();
      const matchQuery = query === '' || 
        note.title.toLowerCase().includes(query.toLowerCase()) ||
        note.preview.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [allNotes, query, activeCategory]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.modalOverlay, { backgroundColor: theme.colors.background }]}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose}>
              <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <View style={[styles.searchBar, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
              <MaterialIcons name="search" size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search tasks, notes..."
                placeholderTextColor={theme.colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <MaterialIcons name="cancel" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Categories */}
          <View style={{ borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {CATEGORIES.map(cat => {
                const isActive = activeCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isActive ? theme.colors.primary : theme.colors.secondary,
                        borderColor: isActive ? theme.colors.primary : theme.colors.border,
                      }
                    ]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text style={[
                      styles.categoryText,
                      { color: isActive ? '#FFFFFF' : theme.colors.textSecondary, fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular' }
                    ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
            {(filteredTasks.length === 0 && filteredNotes.length === 0) ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="search-off" size={48} color={theme.colors.border} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No results found.</Text>
              </View>
            ) : (
              <>
                {filteredTasks.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Tasks</Text>
                    {filteredTasks.map(task => (
                      <View key={task.id} style={[styles.resultCard, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
                        <MaterialCommunityIcons name={task.completed ? 'check-circle' : 'circle-outline'} size={20} color={task.completed ? '#22C55E' : theme.colors.textSecondary} />
                        <View style={styles.resultBody}>
                          <Text style={[styles.resultTitle, { color: theme.colors.text, textDecorationLine: task.completed ? 'line-through' : 'none', opacity: task.completed ? 0.6 : 1 }]}>
                            {task.title}
                          </Text>
                          <Text style={[styles.resultSubtitle, { color: theme.colors.textSecondary }]}>
                            {task.tag} • {task.dueDate || 'No Date'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {filteredNotes.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notes</Text>
                    {filteredNotes.map(note => (
                      <View key={note.id} style={[styles.resultCard, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
                        <MaterialIcons name="sticky-note-2" size={20} color={theme.colors.primary} />
                        <View style={styles.resultBody}>
                          <Text style={[styles.resultTitle, { color: theme.colors.text }]}>
                            {note.title}
                          </Text>
                          <Text style={[styles.resultSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                            {note.preview}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 13,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  resultBody: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
});
