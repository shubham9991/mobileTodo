/**
 * NotesListScreen — full notes list with grid/list toggle,
 * Google Keep style native rich content preview, multi-select mode, and navigation to NoteScreen.
 */
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, RefreshControl, Alert, Image
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

// ── Data Parser for Google Keep-Style Native Previews ─────────────────────────

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface TableData {
  headers?: string[];
  rows: string[][];
  totalRows: number;
  totalCols: number;
}

interface PollOptionData {
  uid: string;
  text: string;
  pct: number;
  voted: boolean;
}

interface PollData {
  question: string;
  options: PollOptionData[];
  totalVotes: number;
}

interface ParsedNoteContent {
  imageSrc?: string;
  checklists?: ChecklistItem[];
  table?: TableData;
  poll?: PollData;
  code?: { language: string; snippet: string };
  quote?: string;
  textSnippet: string;
}

function parseNoteData(note: Note): ParsedNoteContent {
  const result: ParsedNoteContent = {
    textSnippet: '',
  };

  // 1. Try Lexical AST JSON
  const root = (note.content as any)?.root;
  if (root && Array.isArray(root.children)) {
    const textPieces: string[] = [];

    for (const node of root.children) {
      if (!result.imageSrc && node.type === 'image' && node.src) {
        result.imageSrc = node.src;
      }

      if (!result.checklists && node.type === 'keep-checklist' && Array.isArray(node.items)) {
        result.checklists = node.items.map((it: any) => ({
          id: it.id || Math.random().toString(),
          text: (it.text || '').replace(/<[^>]*>/g, '').trim(),
          checked: !!it.checked,
        })).filter((it: ChecklistItem) => it.text.length > 0);
      }

      if (!result.checklists && node.type === 'list' && node.listType === 'check' && Array.isArray(node.children)) {
        result.checklists = node.children.map((li: any) => {
          const text = (li.children || []).map((c: any) => c.text || '').join('').trim();
          return {
            id: Math.random().toString(),
            text,
            checked: !!li.checked,
          };
        }).filter((it: ChecklistItem) => it.text.length > 0);
      }

      if (!result.table && node.type === 'table' && Array.isArray(node.children)) {
        const rawRows: string[][] = node.children.map((rowNode: any) => {
          if (!Array.isArray(rowNode.children)) return [];
          return rowNode.children.map((cellNode: any) => {
            if (!Array.isArray(cellNode.children)) return '';
            return cellNode.children
              .map((p: any) => (p.children || []).map((t: any) => t.text || '').join(''))
              .join(' ')
              .trim();
          });
        });

        if (rawRows.length > 0) {
          const totalCols = Math.max(...rawRows.map(r => r.length), 0);
          result.table = {
            headers: rawRows[0],
            rows: rawRows.slice(1, 4),
            totalRows: rawRows.length,
            totalCols,
          };
        }
      }

      if (!result.poll && node.type === 'poll') {
        const options = Array.isArray(node.options) ? node.options : [];
        const totalVotes = options.reduce((s: number, o: any) => s + (Array.isArray(o.votes) ? o.votes.length : 0), 0);
        result.poll = {
          question: node.question || 'Poll',
          options: options.map((o: any) => ({
            uid: o.uid || Math.random().toString(),
            text: o.text || 'Option',
            pct: totalVotes > 0 ? Math.round(((Array.isArray(o.votes) ? o.votes.length : 0) / totalVotes) * 100) : 0,
            voted: Array.isArray(o.votes) && o.votes.includes(node.voterId),
          })),
          totalVotes,
        };
      }

      if (!result.code && node.type === 'code') {
        const snippet = (node.children || []).map((t: any) => t.text || '').join('\n').trim();
        if (snippet) {
          result.code = {
            language: node.language || 'code',
            snippet,
          };
        }
      }

      if (!result.quote && node.type === 'quote') {
        result.quote = (node.children || []).map((t: any) => t.text || '').join(' ').trim();
      }

      if (node.type === 'paragraph' || node.type === 'heading') {
        const pText = (node.children || []).map((t: any) => {
          if (t.type === 'image' && !result.imageSrc) {
            result.imageSrc = t.src;
          }
          return t.text || '';
        }).join('').trim();
        if (pText) textPieces.push(pText);
      }
    }

    if (textPieces.length > 0) {
      result.textSnippet = textPieces.join('\n');
    }
  }

  // 2. HTML Fallback
  if (!result.imageSrc && note.contentHtml) {
    const imgMatch = note.contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      result.imageSrc = imgMatch[1];
    }
  }

  if (!result.checklists && note.contentHtml && (note.contentHtml.includes('listItemChecked') || note.contentHtml.includes('listItemUnchecked'))) {
    const liRegex = /<li[^>]*class="[^"]*listItem(Checked|Unchecked)[^"]*"[^>]*>(.*?)<\/li>/gi;
    let match;
    const items: ChecklistItem[] = [];
    while ((match = liRegex.exec(note.contentHtml)) !== null) {
      const checked = match[1] === 'Checked';
      const text = match[2].replace(/<[^>]*>/g, '').trim();
      if (text) items.push({ id: Math.random().toString(), text, checked });
    }
    if (items.length > 0) result.checklists = items;
  }

  if (!result.table && note.contentHtml && note.contentHtml.includes('<table')) {
    const rowMatches = note.contentHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if (rowMatches && rowMatches.length > 0) {
      const rows: string[][] = rowMatches.map(tr => {
        const cellMatches = tr.match(/<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi) || [];
        return cellMatches.map(c => c.replace(/<[^>]*>/g, '').trim());
      });
      const totalCols = Math.max(...rows.map(r => r.length), 0);
      result.table = {
        headers: rows[0],
        rows: rows.slice(1, 4),
        totalRows: rows.length,
        totalCols,
      };
    }
  }

  // 3. Fallback to preview text
  if (!result.textSnippet && note.preview) {
    result.textSnippet = note.preview;
  }

  return result;
}

// ── Native Google Keep Style Content Renderer ────────────────────────────────

interface NoteContentPreviewProps {
  note: Note;
  theme: ReturnType<typeof useTheme>['theme'];
  isGrid: boolean;
  hasTitle: boolean;
}

function NoteContentPreview({ note, theme, isGrid, hasTitle }: NoteContentPreviewProps) {
  const c = theme.colors;
  const parsed = useMemo(() => parseNoteData(note), [note]);

  return (
    <View style={styles.contentWrap}>
      {/* 1. Image Preview (Google Keep style banner / thumbnail) */}
      {!!parsed.imageSrc && (
        <View style={[styles.imageCardWrap, { backgroundColor: c.secondary }]}>
          <Image
            source={{ uri: parsed.imageSrc }}
            style={[styles.noteImage, { height: isGrid ? 120 : 150 }]}
            resizeMode="cover"
          />
        </View>
      )}

      {/* 2. Checklists Preview */}
      {parsed.checklists && parsed.checklists.length > 0 && (
        <View style={styles.checklistWrap}>
          {parsed.checklists.slice(0, isGrid ? 4 : 5).map((item, idx) => (
            <View key={item.id || idx} style={styles.checkItemRow}>
              <MaterialIcons
                name={item.checked ? "check-box" : "check-box-outline-blank"}
                size={16}
                color={item.checked ? c.primary : c.textSecondary}
                style={{ marginTop: 1, marginRight: 6 }}
              />
              <Text
                style={[
                  styles.checkItemText,
                  {
                    color: item.checked ? c.textSecondary : c.text,
                    textDecorationLine: item.checked ? 'line-through' : 'none',
                    opacity: item.checked ? 0.6 : 1,
                  }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.text}
              </Text>
            </View>
          ))}
          {parsed.checklists.length > (isGrid ? 4 : 5) && (
            <Text style={[styles.moreCounterText, { color: c.textSecondary }]}>
              +{parsed.checklists.length - (isGrid ? 4 : 5)} more items
            </Text>
          )}
        </View>
      )}

      {/* 3. Table Preview (Clean, never squished!) */}
      {parsed.table && (
        <View style={[styles.tableWrap, { borderColor: c.border, backgroundColor: c.secondary + '40' }]}>
          {/* Table Header */}
          {parsed.table.headers && parsed.table.headers.length > 0 && (
            <View style={[styles.tableRowHeader, { backgroundColor: c.primary + '14', borderBottomColor: c.border }]}>
              {parsed.table.headers.slice(0, 3).map((h, i) => (
                <Text
                  key={i}
                  style={[styles.tableHeaderCell, { color: c.text, borderRightColor: i < 2 ? c.border : 'transparent' }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {h || `Col ${i + 1}`}
                </Text>
              ))}
              {parsed.table.totalCols > 3 && (
                <Text style={[styles.tableHeaderCell, { color: c.textSecondary, flex: 0.5, textAlign: 'center' }]}>
                  +{parsed.table.totalCols - 3}
                </Text>
              )}
            </View>
          )}

          {/* Table Rows (Max 3) */}
          {parsed.table.rows.map((row, rIdx) => (
            <View
              key={rIdx}
              style={[
                styles.tableRowItem,
                {
                  borderBottomColor: rIdx < parsed.table!.rows.length - 1 ? c.border : 'transparent',
                  backgroundColor: rIdx % 2 === 0 ? 'transparent' : c.cardPrimary + '60'
                }
              ]}
            >
              {row.slice(0, 3).map((cell, cIdx) => (
                <Text
                  key={cIdx}
                  style={[
                    styles.tableBodyCell,
                    { color: c.textSecondary, borderRightColor: cIdx < 2 ? c.border : 'transparent' }
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {cell || '—'}
                </Text>
              ))}
              {parsed.table!.totalCols > 3 && (
                <Text style={[styles.tableBodyCell, { color: c.textSecondary, flex: 0.5, textAlign: 'center' }]}>
                  …
                </Text>
              )}
            </View>
          ))}

          {/* Table Footer info badge */}
          {(parsed.table.totalRows > 4 || parsed.table.totalCols > 3) && (
            <View style={[styles.tableBadgeFooter, { borderTopColor: c.border, backgroundColor: c.secondary }]}>
              <MaterialIcons name="grid-on" size={11} color={c.textSecondary} style={{ marginRight: 4 }} />
              <Text style={[styles.tableBadgeText, { color: c.textSecondary }]}>
                {parsed.table.totalRows} × {parsed.table.totalCols} table
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 4. Poll Preview */}
      {parsed.poll && (
        <View style={[styles.pollWrap, { borderColor: c.border, backgroundColor: c.secondary + '60' }]}>
          <View style={styles.pollHeaderRow}>
            <Text style={{ fontSize: 13, marginRight: 4 }}>📊</Text>
            <Text style={[styles.pollQuestionTitle, { color: c.text }]} numberOfLines={1}>
              {parsed.poll.question}
            </Text>
          </View>
          {parsed.poll.options.slice(0, 3).map((opt, i) => (
            <View key={opt.uid || i} style={[styles.pollOptionBox, { backgroundColor: c.cardPrimary, borderColor: c.border }]}>
              <View style={[styles.pollFillBar, { width: `${opt.pct}%`, backgroundColor: c.primary + '22' }]} />
              <View style={styles.pollOptionInner}>
                <MaterialIcons
                  name={opt.voted ? "radio-button-checked" : "radio-button-unchecked"}
                  size={12}
                  color={opt.voted ? c.primary : c.textSecondary}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.pollOptionText, { color: c.text }]} numberOfLines={1}>
                  {opt.text}
                </Text>
                <Text style={[styles.pollOptionPctText, { color: c.textSecondary }]}>
                  {opt.pct}%
                </Text>
              </View>
            </View>
          ))}
          <Text style={[styles.pollTotalText, { color: c.textSecondary }]}>
            {parsed.poll.totalVotes} vote{parsed.poll.totalVotes !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* 5. Code Block Preview */}
      {parsed.code && (
        <View style={[styles.codeWrap, { backgroundColor: c.secondary, borderColor: c.border }]}>
          <View style={styles.codeHeader}>
            <Text style={[styles.codeLangText, { color: c.primary }]}>{parsed.code.language}</Text>
          </View>
          <Text style={[styles.codeSnippetText, { color: c.text }]} numberOfLines={3}>
            {parsed.code.snippet}
          </Text>
        </View>
      )}

      {/* 6. Quote Preview */}
      {!!parsed.quote && (
        <View style={[styles.quoteWrap, { borderLeftColor: c.primary }]}>
          <Text style={[styles.quoteText, { color: c.textSecondary }]} numberOfLines={3}>
            "{parsed.quote}"
          </Text>
        </View>
      )}

      {/* 7. Text Snippet Preview */}
      {!!parsed.textSnippet && !parsed.checklists && (
        <Text
          style={[styles.noteCardPreview, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]}
          numberOfLines={isGrid ? (hasTitle ? (parsed.imageSrc ? 2 : 5) : 8) : 4}
          ellipsizeMode="tail"
        >
          {parsed.textSnippet}
        </Text>
      )}
    </View>
  );
}

// ── NoteCard Component ────────────────────────────────────────────────────────

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
      activeOpacity={0.75}
    >
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
        <NoteContentPreview
          note={note}
          theme={theme}
          isGrid={isGrid}
          hasTitle={!!hasTitle}
        />
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
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const isSelectionMode = selectedNoteIds.length > 0;

  const loadNotes = useCallback(async () => {
    const all = await getAllNotes();
    const sorted = [...all.filter(n => n.pinned), ...all.filter(n => !n.pinned)];
    setNotes(sorted);
    setFilteredNotes(sorted);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  useEffect(() => {
    if (!search.trim()) { setFilteredNotes(notes); return; }
    const q = search.toLowerCase();
    setFilteredNotes(notes.filter(n => n.title.toLowerCase().includes(q) || n.preview.toLowerCase().includes(q)));
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

  const toggleNoteSelection = useCallback((noteId: string) => {
    setSelectedNoteIds(prev => prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]);
  }, []);

  const handleCardPress = useCallback((note: Note) => {
    if (isSelectionMode) { toggleNoteSelection(note.id); } else { openNote(note.id, note.title); }
  }, [isSelectionMode, toggleNoteSelection, openNote]);

  const handleCardLongPress = useCallback((note: Note) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    toggleNoteSelection(note.id);
  }, [toggleNoteSelection]);

  const handleSelectAll = useCallback(() => {
    if (selectedNoteIds.length === filteredNotes.length) { setSelectedNoteIds([]); }
    else { setSelectedNoteIds(filteredNotes.map(n => n.id)); }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [selectedNoteIds, filteredNotes]);

  const handleBulkPin = useCallback(async () => {
    if (selectedNoteIds.length === 0) return;
    const allPinned = notes.filter(n => selectedNoteIds.includes(n.id)).every(n => n.pinned);
    for (const id of selectedNoteIds) { await updateNotePin(id, !allPinned); }
    setSelectedNoteIds([]);
    await loadNotes();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [selectedNoteIds, notes, loadNotes]);

  const handleBulkDelete = useCallback(() => {
    if (selectedNoteIds.length === 0) return;
    Alert.alert('Delete Notes', `Delete the ${selectedNoteIds.length} selected notes?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        for (const id of selectedNoteIds) { await deleteNote(id); }
        setSelectedNoteIds([]);
        await loadNotes();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }}
    ]);
  }, [selectedNoteIds, loadNotes]);

  const renderNoteCardItem = useCallback((item: Note) => {
    const isSelected = selectedNoteIds.includes(item.id);
    return (
      <NoteCard key={item.id} note={item} viewMode={viewMode} theme={theme} isSelected={isSelected} isSelectionMode={isSelectionMode}
        onPress={() => handleCardPress(item)} onLongPress={() => handleCardLongPress(item)} onDelete={() => handleDelete(item.id)} />
    );
  }, [viewMode, theme, selectedNoteIds, isSelectionMode, handleCardPress, handleCardLongPress, handleDelete]);

  const pinnedNotes = filteredNotes.filter(n => n.pinned);
  const otherNotes = filteredNotes.filter(n => !n.pinned);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top', 'left', 'right']}>
      {isSelectionMode ? (
        <View style={[styles.header, { backgroundColor: (c.primary + '12'), borderBottomWidth: 1, borderBottomColor: c.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => setSelectedNoteIds([])} style={styles.iconBtn}>
              <MaterialIcons name="close" size={24} color={c.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: c.text, fontFamily: 'Inter_700Bold', fontSize: 18 }]}>{selectedNoteIds.length} selected</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.iconBtn}>
              <MaterialIcons name={selectedNoteIds.length === filteredNotes.length ? "deselect" : "select-all"} size={22} color={c.textSecondary} />
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

      <View style={[styles.searchBar, { backgroundColor: c.secondary, borderColor: c.border }]}>
        <MaterialIcons name="search" size={18} color={c.textSecondary} />
        <TextInput style={[styles.searchInput, { color: c.text, fontFamily: 'Inter_400Regular' }]} placeholder="Search notes…" placeholderTextColor={c.textSecondary} value={search} onChangeText={setSearch} />
        {search.length > 0 && (<TouchableOpacity onPress={() => setSearch('')}><MaterialIcons name="close" size={16} color={c.textSecondary} /></TouchableOpacity>)}
      </View>

      {!loading && notes.length > 0 && (
        <Text style={[styles.statsText, { color: c.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}{search ? ` matching "${search}"` : ''}{'  ·  '}{notes.filter(n => n.pinned).length} pinned
        </Text>
      )}

      {loading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 }}>
          <NoteCardSkeleton /><NoteCardSkeleton /><NoteCardSkeleton /><NoteCardSkeleton />
        </View>
      ) : filteredNotes.length === 0 ? (
        <EmptyState color={c.textSecondary} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: fabBottom + 90 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotes(); }} tintColor={c.primary} />}
        >
          {pinnedNotes.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeader, { color: c.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>PINNED</Text>
              {viewMode === 'grid' ? (
                <View style={styles.masonryRow}>
                  <View style={styles.masonryCol}>{pinnedNotes.filter((_, idx) => idx % 2 === 0).map(renderNoteCardItem)}</View>
                  <View style={styles.masonryCol}>{pinnedNotes.filter((_, idx) => idx % 2 === 1).map(renderNoteCardItem)}</View>
                </View>
              ) : (<View style={styles.listCol}>{pinnedNotes.map(renderNoteCardItem)}</View>)}
            </View>
          )}
          {otherNotes.length > 0 && (
            <View style={styles.sectionContainer}>
              {pinnedNotes.length > 0 && <Text style={[styles.sectionHeader, { color: c.textSecondary, fontFamily: 'Inter_600SemiBold', marginTop: 12 }]}>OTHERS</Text>}
              {viewMode === 'grid' ? (
                <View style={styles.masonryRow}>
                  <View style={styles.masonryCol}>{otherNotes.filter((_, idx) => idx % 2 === 0).map(renderNoteCardItem)}</View>
                  <View style={styles.masonryCol}>{otherNotes.filter((_, idx) => idx % 2 === 1).map(renderNoteCardItem)}</View>
                </View>
              ) : (<View style={styles.listCol}>{otherNotes.map(renderNoteCardItem)}</View>)}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, height: 56 },
  headerTitle: { fontSize: 28, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { padding: 6 },
  newBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  statsText: { fontSize: 11, paddingHorizontal: 16, marginBottom: 8, letterSpacing: 0.2 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },
  sectionContainer: { marginBottom: 16 },
  sectionHeader: { fontSize: 11, letterSpacing: 1.2, marginBottom: 10, marginLeft: 4 },
  masonryRow: { flexDirection: 'row', gap: 10 },
  masonryCol: { flex: 1, gap: 10 },
  listCol: { gap: 10 },

  // Card Structure (Google Keep dynamic height)
  noteCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    overflow: 'hidden',
  },
  noteCardGrid: {
    width: '100%',
    maxHeight: 280,
  },
  noteCardList: {
    width: '100%',
    maxHeight: 220,
  },
  noteCardContent: {
    gap: 4,
  },
  noteCardTitle: {
    fontSize: 14.5,
    letterSpacing: -0.2,
    lineHeight: 20,
    marginBottom: 4,
  },
  contentWrap: {
    gap: 6,
  },

  // 1. Image
  imageCardWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  noteImage: {
    width: '100%',
    borderRadius: 8,
  },

  // 2. Checklists
  checklistWrap: {
    gap: 4,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkItemText: {
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
  },
  moreCounterText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },

  // 3. Table (Unsqueezed compact preview)
  tableWrap: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 2,
  },
  tableRowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 4,
    borderRightWidth: 0.5,
  },
  tableRowItem: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    paddingVertical: 3.5,
    paddingHorizontal: 4,
  },
  tableBodyCell: {
    flex: 1,
    fontSize: 10.5,
    paddingHorizontal: 4,
    borderRightWidth: 0.5,
  },
  tableBadgeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    borderTopWidth: 0.5,
  },
  tableBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
  },

  // 4. Poll
  pollWrap: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    gap: 5,
  },
  pollHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  pollQuestionTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  pollOptionBox: {
    borderRadius: 6,
    borderWidth: 0.5,
    overflow: 'hidden',
    position: 'relative',
    height: 22,
    justifyContent: 'center',
  },
  pollFillBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 6,
  },
  pollOptionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    zIndex: 1,
  },
  pollOptionText: {
    fontSize: 10.5,
    flex: 1,
  },
  pollOptionPctText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  pollTotalText: {
    fontSize: 10,
    textAlign: 'right',
    marginTop: 1,
  },

  // 5. Code
  codeWrap: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 6,
    gap: 2,
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  codeLangText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  codeSnippetText: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
  },

  // 6. Quote
  quoteWrap: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginVertical: 2,
  },
  quoteText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
  },

  // 7. General text snippet
  noteCardPreview: {
    fontSize: 12,
    lineHeight: 17,
  },

  selectIndicator: {
    position: 'absolute',
    top: 8, right: 8,
    width: 18, height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  selectDot: { width: 10, height: 10, borderRadius: 5 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptySubtitle: { fontSize: 14, opacity: 0.6 },
});
