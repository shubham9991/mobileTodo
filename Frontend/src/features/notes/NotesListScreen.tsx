/**
 * NotesListScreen — full notes list with grid/list toggle,
 * real data from notesStore, multi-select mode, and navigation to NoteScreen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, RefreshControl, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import {
  getAllNotes, deleteNote, updateNotePin,
  type Note,
} from '../../core/db/notesStore';
import { NoteCardSkeleton } from '../../core/components/Skeleton';
import { BottomNavbar } from '../../layout/BottomNavbar';
import { useFabBottom } from '../../core/hooks/useFabBottom';
import { FABMenu } from '../../core/components/FABMenu';

type ViewMode = 'grid' | 'list';

function EmptyState({ color }: { color: string }) {
  return (
    <View style={styles.emptyState}>
      <MaterialIcons name="description" size={52} color={color} style={{ opacity: 0.3 }} />
      <Text style={[styles.emptyTitle, { color }]}>No notes yet</Text>
      <Text style={[styles.emptySubtitle, { color }]}>Tap + to create your first note</Text>
    </View>
  );
}

interface NoteCardProps {
  note: Note;
  viewMode: ViewMode;
  onPress: () => void;
  onLongPress: () => void;
  isSelected: boolean;
  isSelectionMode: boolean;
  onDelete: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function NoteCard({ note, viewMode, onPress, onLongPress, isSelected, isSelectionMode, onDelete, theme }: NoteCardProps) {
  const c = theme.colors;
  const isGrid = viewMode === 'grid';

  // Check if notes have titles. If empty or literally "Untitled", we don't display it as a title header
  const hasTitle = note.title && note.title.trim() !== '' && note.title.toLowerCase() !== 'untitled';

  return (
    <TouchableOpacity
      style={[
        styles.noteCard,
        isGrid ? styles.noteCardGrid : styles.noteCardList,
        { 
          backgroundColor: isSelected ? `${c.primary}12` : c.cardPrimary, 
          borderColor: isSelected ? c.primary : c.border,
          borderWidth: isSelected ? 1.5 : 1,
        },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Multi-select checkbox indicator */}
      {isSelectionMode && (
        <View style={[styles.selectIndicator, { borderColor: isSelected ? c.primary : c.border }]}>
          {isSelected && <View style={[styles.selectDot, { backgroundColor: c.primary }]} />}
        </View>
      )}

      <View style={styles.noteCardContent}>
        {hasTitle && (
          <Text
            style={[styles.noteCardTitle, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}
            numberOfLines={2}
          >
            {note.title}
          </Text>
        )}
        <Text
          style={[styles.noteCardPreview, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]}
          numberOfLines={isGrid ? (hasTitle ? 6 : 9) : (hasTitle ? 3 : 5)}
        >
          {note.preview || ''}
        </Text>
      </View>


    </TouchableOpacity>
  );
}

export function NotesListScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const c = theme.colors;
  const fabBottom = useFabBottom();

  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  
  // Selection states
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const isSelectionMode = selectedNoteIds.length > 0;

  const loadNotes = useCallback(async () => {
    const all = await getAllNotes();
    // Pinned notes always at top
    const sorted = [
      ...all.filter(n => n.pinned),
      ...all.filter(n => !n.pinned),
    ];
    setNotes(sorted);
    setFilteredNotes(sorted);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Search filter
  useEffect(() => {
    if (!search.trim()) { setFilteredNotes(notes); return; }
    const q = search.toLowerCase();
    setFilteredNotes(notes.filter(n =>
      n.title.toLowerCase().includes(q) || n.preview.toLowerCase().includes(q)
    ));
  }, [search, notes]);

  const openNote = useCallback((noteId: string, noteTitle: string) => {
    router.push({ pathname: '/note', params: { noteId, noteTitle } });
  }, [router]);

  const createNewNote = useCallback(() => {
    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/note', params: { noteId: id, noteTitle: '' } });
  }, [router]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteNote(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await loadNotes();
  }, [loadNotes]);

  // Multi-select management handlers
  const toggleNoteSelection = useCallback((noteId: string) => {
    setSelectedNoteIds(prev => {
      if (prev.includes(noteId)) {
        return prev.filter(id => id !== noteId);
      } else {
        return [...prev, noteId];
      }
    });
  }, []);

  const handleCardPress = useCallback((note: Note) => {
    if (isSelectionMode) {
      toggleNoteSelection(note.id);
    } else {
      openNote(note.id, note.title);
    }
  }, [isSelectionMode, toggleNoteSelection, openNote]);

  const handleCardLongPress = useCallback((note: Note) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    toggleNoteSelection(note.id);
  }, [toggleNoteSelection]);

  const handleSelectAll = useCallback(() => {
    if (selectedNoteIds.length === filteredNotes.length) {
      setSelectedNoteIds([]);
    } else {
      setSelectedNoteIds(filteredNotes.map(n => n.id));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [selectedNoteIds, filteredNotes]);

  const handleBulkPin = useCallback(async () => {
    if (selectedNoteIds.length === 0) return;
    const selectedNotes = notes.filter(n => selectedNoteIds.includes(n.id));
    const allPinned = selectedNotes.every(n => n.pinned);
    for (const id of selectedNoteIds) {
      await updateNotePin(id, !allPinned);
    }
    setSelectedNoteIds([]);
    await loadNotes();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [selectedNoteIds, notes, loadNotes]);

  const handleBulkDelete = useCallback(() => {
    if (selectedNoteIds.length === 0) return;
    Alert.alert('Delete Notes', `Delete the ${selectedNoteIds.length} selected notes?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        for (const id of selectedNoteIds) {
          await deleteNote(id);
        }
        setSelectedNoteIds([]);
        await loadNotes();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }}
    ]);
  }, [selectedNoteIds, loadNotes]);

  const renderNoteCardItem = useCallback((item: Note) => {
    const isSelected = selectedNoteIds.includes(item.id);
    return (
      <NoteCard
        key={item.id}
        note={item}
        viewMode={viewMode}
        theme={theme}
        isSelected={isSelected}
        isSelectionMode={isSelectionMode}
        onPress={() => handleCardPress(item)}
        onLongPress={() => handleCardLongPress(item)}
        onDelete={() => handleDelete(item.id)}
      />
    );
  }, [viewMode, theme, selectedNoteIds, isSelectionMode, handleCardPress, handleCardLongPress, handleDelete]);

  // Split notes into Pinned and Others
  const pinnedNotes = filteredNotes.filter(n => n.pinned);
  const otherNotes = filteredNotes.filter(n => !n.pinned);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'left', 'right']}>
      {/* Header Switch */}
      {isSelectionMode ? (
        <View style={[styles.header, { backgroundColor: `${c.primary}12`, borderBottomWidth: 1, borderBottomColor: c.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => setSelectedNoteIds([])} style={styles.iconBtn}>
              <MaterialIcons name="close" size={24} color={c.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: c.text, fontFamily: 'Inter_700Bold', fontSize: 18 }]}>
              {selectedNoteIds.length} selected
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.iconBtn}>
              <MaterialIcons 
                name={selectedNoteIds.length === filteredNotes.length ? "deselect" : "select-all"} 
                size={22} 
                color={c.textSecondary} 
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkPin} style={styles.iconBtn}>
              <MaterialIcons name="push-pin" size={22} color={c.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkDelete} style={styles.iconBtn}>
              <MaterialIcons name="delete-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: c.text, fontFamily: 'Inter_700Bold' }]}>Notes</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')} style={styles.iconBtn}>
              <MaterialIcons name={viewMode === 'grid' ? 'view-list' : 'grid-view'} size={22} color={c.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.newBtn, { backgroundColor: c.primary }]} onPress={createNewNote}>
              <MaterialIcons name="add" size={20} color={c.primaryText} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: c.secondary, borderColor: c.border }]}>
        <MaterialIcons name="search" size={18} color={c.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: c.text, fontFamily: 'Inter_400Regular' }]}
          placeholder="Search notes…"
          placeholderTextColor={c.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={16} color={c.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      {!loading && notes.length > 0 && (
        <Text style={[styles.statsText, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
          {search ? ` matching "${search}"` : ''}
          {'  ·  '}{notes.filter(n => n.pinned).length} pinned
        </Text>
      )}

      {/* Note list / grid */}
      {loading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 }}>
          <NoteCardSkeleton />
          <NoteCardSkeleton />
          <NoteCardSkeleton />
          <NoteCardSkeleton />
        </View>
      ) : filteredNotes.length === 0 ? (
        <EmptyState color={c.textSecondary} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: fabBottom + 90 }]}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => { setRefreshing(true); loadNotes(); }} 
              tintColor={c.primary} 
            />
          }
        >
          {/* Pinned Section */}
          {pinnedNotes.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeader, { color: c.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                PINNED
              </Text>
              {viewMode === 'grid' ? (
                <View style={styles.masonryRow}>
                  <View style={styles.masonryCol}>
                    {pinnedNotes.filter((_, idx) => idx % 2 === 0).map(renderNoteCardItem)}
                  </View>
                  <View style={styles.masonryCol}>
                    {pinnedNotes.filter((_, idx) => idx % 2 === 1).map(renderNoteCardItem)}
                  </View>
                </View>
              ) : (
                <View style={styles.listCol}>
                  {pinnedNotes.map(renderNoteCardItem)}
                </View>
              )}
            </View>
          )}

          {/* Others Section */}
          {otherNotes.length > 0 && (
            <View style={styles.sectionContainer}>
              {pinnedNotes.length > 0 && (
                <Text style={[styles.sectionHeader, { color: c.textSecondary, fontFamily: 'Inter_600SemiBold', marginTop: 12 }]}>
                  OTHERS
                </Text>
              )}
              {viewMode === 'grid' ? (
                <View style={styles.masonryRow}>
                  <View style={styles.masonryCol}>
                    {otherNotes.filter((_, idx) => idx % 2 === 0).map(renderNoteCardItem)}
                  </View>
                  <View style={styles.masonryCol}>
                    {otherNotes.filter((_, idx) => idx % 2 === 1).map(renderNoteCardItem)}
                  </View>
                </View>
              ) : (
                <View style={styles.listCol}>
                  {otherNotes.map(renderNoteCardItem)}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
      <FABMenu bottom={fabBottom} />
      <BottomNavbar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    height: 56,
  },
  headerTitle: { fontSize: 28, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { padding: 6 },
  newBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  statsText: { fontSize: 11, paddingHorizontal: 16, marginBottom: 8, letterSpacing: 0.2 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },
  masonryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  masonryCol: {
    flex: 1,
    gap: 10,
  },
  listCol: {
    gap: 10,
  },
  noteCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    overflow: 'hidden',
  },
  noteCardGrid: { 
    width: '100%',
    minHeight: 45,
    maxHeight: 240, // Logical height constraint
  },
  noteCardList: { 
    width: '100%',
    minHeight: 45,
    maxHeight: 180, // Logical list height constraint
  },
  noteCardContent: { gap: 4, marginBottom: 4 },
  noteCardTitle: { fontSize: 14, letterSpacing: -0.1, lineHeight: 19 },
  noteCardPreview: { fontSize: 12, lineHeight: 17 },
  noteCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteCardMeta: { flexDirection: 'row', alignItems: 'center' },
  noteCardTime: { fontSize: 11 },
  deleteBtn: { padding: 2 },
  pinDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptySubtitle: { fontSize: 14, opacity: 0.6 },
});
