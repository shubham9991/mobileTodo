/**
 * NotesListScreen — full notes list with grid/list toggle,
 * real data from notesStore, swipe-to-delete, and navigation to NoteScreen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, TextInput, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import {
  getAllNotes, deleteNote, updateNotePin,
  formatRelativeTime, type Note,
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
  onPin: () => void;
  onDelete: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function NoteCard({ note, viewMode, onPress, onPin, onDelete, theme }: NoteCardProps) {
  const c = theme.colors;
  const isGrid = viewMode === 'grid';

  return (
    <TouchableOpacity
      style={[
        styles.noteCard,
        isGrid ? styles.noteCardGrid : styles.noteCardList,
        { backgroundColor: c.cardPrimary, borderColor: c.border },
      ]}
      onPress={onPress}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPin();
      }}
      activeOpacity={0.7}
    >
      {/* Pin icon */}
      {note.pinned && (
        <View style={[styles.pinDot, { backgroundColor: c.primary }]}>
          <MaterialIcons name="push-pin" size={10} color="#fff" />
        </View>
      )}

      <View style={styles.noteCardContent}>
        <Text
          style={[styles.noteCardTitle, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}
          numberOfLines={isGrid ? 2 : 1}
        >
          {note.title || 'Untitled'}
        </Text>
        <Text
          style={[styles.noteCardPreview, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]}
          numberOfLines={isGrid ? 4 : 2}
        >
          {note.preview || 'No content yet'}
        </Text>
      </View>

      <View style={styles.noteCardFooter}>
        <View style={styles.noteCardMeta}>
          <MaterialIcons name="schedule" size={11} color={c.textSecondary} />
          <Text style={[styles.noteCardTime, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {' '}{formatRelativeTime(note.updatedAt)}
          </Text>
          {note.wordCount > 0 && (
            <Text style={[styles.noteCardTime, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              {'  ·  '}{note.wordCount}w
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
          <MaterialIcons name="delete-outline" size={15} color={c.textSecondary} />
        </TouchableOpacity>
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

  const handlePin = useCallback(async (id: string, currentlyPinned: boolean) => {
    await updateNotePin(id, !currentlyPinned);
    await loadNotes();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [loadNotes]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteNote(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await loadNotes();
  }, [loadNotes]);

  const renderItem = useCallback(({ item }: { item: Note }) => (
    <NoteCard
      note={item}
      viewMode={viewMode}
      theme={theme}
      onPress={() => openNote(item.id, item.title)}
      onPin={() => handlePin(item.id, item.pinned)}
      onDelete={() => handleDelete(item.id)}
    />
  ), [viewMode, theme, openNote, handlePin, handleDelete]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
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
        <View style={[styles.grid, { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 }]}>
          <NoteCardSkeleton />
          <NoteCardSkeleton />
          <NoteCardSkeleton />
          <NoteCardSkeleton />
        </View>
      ) : filteredNotes.length === 0 ? (
        <EmptyState color={c.textSecondary} />
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode} // Forces re-render when switching grid↔list
          contentContainerStyle={[styles.list, { paddingBottom: fabBottom + 80 }]}
          columnWrapperStyle={viewMode === 'grid' ? { gap: 10 } : undefined}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotes(); }} tintColor={c.primary} />}
          showsVerticalScrollIndicator={false}
        />
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
  list: { padding: 16, paddingTop: 4 },
  grid: {},
  noteCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    overflow: 'hidden',
  },
  noteCardGrid: { flex: 1, minHeight: 120 },
  noteCardList: { width: '100%' },
  noteCardContent: { flex: 1, gap: 4, marginBottom: 10 },
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
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptySubtitle: { fontSize: 14, opacity: 0.6 },
});
