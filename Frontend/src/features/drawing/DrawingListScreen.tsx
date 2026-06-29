/**
 * DrawingListScreen — shows all saved drawings in a beautiful masonry-style grid
 * with live thumbnail previews, search, swipe-to-delete, and long-press to rename.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, TextInput, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import {
  getAllDrawings, deleteDrawing, updateDrawingTitle,
  generateDrawingId, formatDrawingTime, type DrawingMeta,
} from './drawingStore';
import { BottomNavbar } from '../../layout/BottomNavbar';
import { useFabBottom } from '../../core/hooks/useFabBottom';
import { FABMenu } from '../../core/components/FABMenu';

function EmptyState({ color }: { color: string }) {
  return (
    <View style={styles.emptyState}>
      <MaterialIcons name="brush" size={56} color={color} style={{ opacity: 0.25 }} />
      <Text style={[styles.emptyTitle, { color }]}>No sketches yet</Text>
      <Text style={[styles.emptySubtitle, { color }]}>Tap + to start drawing</Text>
    </View>
  );
}

interface DrawingCardProps {
  drawing: DrawingMeta;
  onPress: () => void;
  onDelete: () => void;
  onRename: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function DrawingCard({ drawing, onPress, onDelete, onRename, theme }: DrawingCardProps) {
  const c = theme.colors;
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.cardPrimary, borderColor: c.border }]}
      onPress={onPress}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onRename();
      }}
      activeOpacity={0.8}
    >
      {/* Thumbnail */}
      <View style={[styles.thumbContainer, { backgroundColor: c.secondary }]}>
        {drawing.thumbnailUri ? (
          <Image
            source={{ uri: drawing.thumbnailUri }}
            style={styles.thumb}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <MaterialIcons name="brush" size={32} color={c.textSecondary} style={{ opacity: 0.4 }} />
          </View>
        )}
      </View>

      {/* Meta */}
      <View style={styles.cardMeta}>
        <Text
          style={[styles.cardTitle, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}
          numberOfLines={1}
        >
          {drawing.title}
        </Text>
        <View style={styles.cardFooter}>
          <MaterialIcons name="schedule" size={11} color={c.textSecondary} />
          <Text style={[styles.cardTime, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {'  '}{formatDrawingTime(drawing.updatedAt)}
          </Text>
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <MaterialIcons name="delete-outline" size={15} color={c.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function DrawingListScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const c = theme.colors;
  const fabBottom = useFabBottom();

  const [drawings, setDrawings] = useState<DrawingMeta[]>([]);
  const [filtered, setFiltered] = useState<DrawingMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const all = await getAllDrawings();
    setDrawings(all);
    setFiltered(all);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(drawings); return; }
    const q = search.toLowerCase();
    setFiltered(drawings.filter(d => d.title.toLowerCase().includes(q)));
  }, [search, drawings]);

  const openDrawing = useCallback((id: string, title: string) => {
    router.push({ pathname: '/drawing', params: { drawingId: id, drawingTitle: title } });
  }, [router]);

  const createNew = useCallback(() => {
    const id = generateDrawingId();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/drawing', params: { drawingId: id, drawingTitle: '' } });
  }, [router]);

  const handleDelete = useCallback(async (id: string) => {
    Alert.alert(
      'Delete Sketch',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDrawing(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await load();
          },
        },
      ]
    );
  }, [load]);

  const handleRename = useCallback(async (drawing: DrawingMeta) => {
    Alert.prompt(
      'Rename Sketch',
      undefined,
      async (newTitle) => {
        if (!newTitle?.trim()) return;
        await updateDrawingTitle(drawing.id, newTitle.trim());
        await load();
      },
      'plain-text',
      drawing.title
    );
  }, [load]);

  const renderItem = useCallback(({ item }: { item: DrawingMeta }) => (
    <DrawingCard
      drawing={item}
      theme={theme}
      onPress={() => openDrawing(item.id, item.title)}
      onDelete={() => handleDelete(item.id)}
      onRename={() => handleRename(item)}
    />
  ), [theme, openDrawing, handleDelete, handleRename]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: c.text, fontFamily: 'Inter_700Bold' }]}>Sketches</Text>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: c.primary }]}
          onPress={createNew}
        >
          <MaterialIcons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: c.secondary, borderColor: c.border }]}>
        <MaterialIcons name="search" size={18} color={c.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: c.text, fontFamily: 'Inter_400Regular' }]}
          placeholder="Search sketches…"
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
      {!loading && drawings.length > 0 && (
        <Text style={[styles.statsText, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          {filtered.length} {filtered.length === 1 ? 'sketch' : 'sketches'}
          {search ? ` matching "${search}"` : ''}
        </Text>
      )}

      {/* List */}
      {filtered.length === 0 && !loading ? (
        <EmptyState color={c.textSecondary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={[styles.list, { paddingBottom: fabBottom + 80 }]}
          columnWrapperStyle={{ gap: 10 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={c.primary}
            />
          }
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
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  cardMeta: { padding: 10, gap: 4 },
  cardTitle: { fontSize: 13, letterSpacing: -0.1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  cardTime: { fontSize: 11, flex: 1 },
  deleteBtn: { padding: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptySubtitle: { fontSize: 14, opacity: 0.6 },
});
