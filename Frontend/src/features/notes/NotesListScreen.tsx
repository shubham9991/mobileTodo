/**
 * NotesListScreen — full notes list with grid/list toggle,
 * Google Keep style native rich content preview, multi-select mode, and navigation to NoteScreen.
 */
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, RefreshControl, Alert, Image, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
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

interface TextSegment {
  text: string;
  isCode?: boolean;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
}

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

type PreviewBlock =
  | { type: 'paragraph'; segments: TextSegment[]; text: string; isHeading?: boolean; isAllCode?: boolean }
  | { type: 'code'; language: string; snippet: string }
  | { type: 'checklist'; items: ChecklistItem[] }
  | { type: 'table'; data: TableData }
  | { type: 'poll'; data: PollData }
  | { type: 'quote'; text: string }
  | { type: 'image'; src: string }
  | { type: 'hr' }
  | { type: 'collapsible'; title: string; contentSnippet: string; open?: boolean };

function extractNodeText(node: any): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.children)) {
    return node.children
      .map(extractNodeText)
      .filter((t: string) => t.length > 0)
      .join(' ')
      .trim();
  }
  return '';
}

function parseNoteBlocks(note: Note): PreviewBlock[] {
  const blocks: PreviewBlock[] = [];

  // 1. Try Lexical AST JSON — maintains exact sequential block order!
  const root = (note.content as any)?.root;
  if (root && Array.isArray(root.children)) {
    for (const node of root.children) {
      if (!node) continue;

      // Collapsible Container
      if (node.type === 'collapsible-container' && Array.isArray(node.children)) {
        let title = '';
        let contentSnippet = '';
        const isOpen = node.open !== false;

        for (const child of node.children) {
          if (!child) continue;
          if (child.type === 'collapsible-title') {
            title = extractNodeText(child).trim();
          } else if (child.type === 'collapsible-content') {
            contentSnippet = extractNodeText(child).trim();
          }
        }

        blocks.push({
          type: 'collapsible',
          title: title || 'Collapsible',
          contentSnippet,
          open: isOpen,
        });
        continue;
      }

      // Code Block
      if (node.type === 'code') {
        const snippet = (node.children || []).map((t: any) => t.text || '').join('\n').trim();
        if (snippet) {
          blocks.push({
            type: 'code',
            language: node.language || 'code',
            snippet,
          });
        }
        continue;
      }

      // Horizontal Rule
      if (node.type === 'horizontalrule' || node.type === 'hr') {
        blocks.push({ type: 'hr' });
        continue;
      }

      // Standalone Image
      if (node.type === 'image' && node.src) {
        blocks.push({ type: 'image', src: node.src });
        continue;
      }

      // Keep Checklist
      if (node.type === 'keep-checklist' && Array.isArray(node.items)) {
        const items = node.items.map((it: any) => ({
          id: it.id || Math.random().toString(),
          text: (it.text || '').replace(/<[^>]*>/g, '').trim(),
          checked: !!it.checked,
        })).filter((it: ChecklistItem) => it.text.length > 0);
        if (items.length > 0) {
          blocks.push({ type: 'checklist', items });
        }
        continue;
      }

      // Standard List (Checklist, Bullets, Numbers)
      if (node.type === 'list' && Array.isArray(node.children)) {
        if (node.listType === 'check') {
          const items = node.children.map((li: any) => {
            const text = (li.children || []).map((c: any) => c.text || '').join('').trim();
            return {
              id: Math.random().toString(),
              text,
              checked: !!li.checked,
            };
          }).filter((it: ChecklistItem) => it.text.length > 0);
          if (items.length > 0) {
            blocks.push({ type: 'checklist', items });
          }
        } else {
          for (const li of node.children) {
            const text = (li.children || []).map((c: any) => c.text || '').join('').trim();
            if (text) {
              blocks.push({
                type: 'paragraph',
                segments: [{ text: `• ${text}` }],
                text: `• ${text}`,
              });
            }
          }
        }
        continue;
      }

      // Table Node
      if (node.type === 'table' && Array.isArray(node.children)) {
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
          blocks.push({
            type: 'table',
            data: {
              headers: rawRows[0],
              rows: rawRows.slice(1, 4),
              totalRows: rawRows.length,
              totalCols,
            },
          });
        }
        continue;
      }

      // Poll Node
      if (node.type === 'poll') {
        const options = Array.isArray(node.options) ? node.options : [];
        const totalVotes = options.reduce((s: number, o: any) => s + (Array.isArray(o.votes) ? o.votes.length : 0), 0);
        blocks.push({
          type: 'poll',
          data: {
            question: node.question || 'Poll',
            options: options.map((o: any) => ({
              uid: o.uid || Math.random().toString(),
              text: o.text || 'Option',
              pct: totalVotes > 0 ? Math.round(((Array.isArray(o.votes) ? o.votes.length : 0) / totalVotes) * 100) : 0,
              voted: Array.isArray(o.votes) && o.votes.includes(node.voterId),
            })),
            totalVotes,
          },
        });
        continue;
      }

      // Quote Node
      if (node.type === 'quote') {
        const quoteText = (node.children || []).map((t: any) => t.text || '').join(' ').trim();
        if (quoteText) {
          blocks.push({ type: 'quote', text: quoteText });
        }
        continue;
      }

      // Paragraph / Heading Node
      if (node.type === 'paragraph' || node.type === 'heading') {
        for (const child of node.children || []) {
          if (child.type === 'image' && child.src) {
            blocks.push({ type: 'image', src: child.src });
          }
        }

        const segments: TextSegment[] = [];
        let fullText = '';
        for (const child of node.children || []) {
          if (child.type === 'text' && child.text) {
            const format = typeof child.format === 'number' ? child.format : 0;
            const isCode = (format & 16) !== 0;
            const isBold = (format & 1) !== 0;
            const isItalic = (format & 2) !== 0;
            const isStrikethrough = (format & 4) !== 0;
            const isUnderline = (format & 8) !== 0;
            segments.push({
              text: child.text,
              isCode,
              isBold,
              isItalic,
              isStrikethrough,
              isUnderline,
            });
            fullText += child.text;
          }
        }

        if (fullText.trim().length > 0) {
          const isAllCode = segments.length > 0 && segments.every(s => !s.text.trim() || s.isCode);
          blocks.push({
            type: 'paragraph',
            segments,
            text: fullText.trim(),
            isHeading: node.type === 'heading',
            isAllCode,
          });
        }
        continue;
      }
    }
  }

  // Fallback 1: HTML if AST produced no blocks
  if (blocks.length === 0 && note.contentHtml) {
    const html = note.contentHtml;
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      blocks.push({ type: 'image', src: imgMatch[1] });
    }

    if (html.includes('listItemChecked') || html.includes('listItemUnchecked') || html.includes('keep-checklist')) {
      const liRegex = /<li[^>]*class="[^"]*listItem(Checked|Unchecked)[^"]*"[^>]*>(.*?)<\/li>/gi;
      let match;
      const items: ChecklistItem[] = [];
      while ((match = liRegex.exec(html)) !== null) {
        const checked = match[1] === 'Checked';
        const text = match[2].replace(/<[^>]*>/g, '').trim();
        if (text) items.push({ id: Math.random().toString(), text, checked });
      }
      if (items.length > 0) blocks.push({ type: 'checklist', items });
    }

    if (html.includes('<hr')) {
      blocks.push({ type: 'hr' });
    }

    if (html.includes('<table')) {
      const rowMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      if (rowMatches && rowMatches.length > 0) {
        const rows: string[][] = rowMatches.map(tr => {
          const cellMatches = tr.match(/<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi) || [];
          return cellMatches.map(c => c.replace(/<[^>]*>/g, '').trim());
        });
        const totalCols = Math.max(...rows.map(r => r.length), 0);
        blocks.push({
          type: 'table',
          data: {
            headers: rows[0],
            rows: rows.slice(1, 4),
            totalRows: rows.length,
            totalCols,
          },
        });
      }
    }

    if (html.includes('editor-code') || html.includes('<pre')) {
      const codeMatch = html.match(/<code[^>]*class="[^"]*editor-code[^"]*"[^>]*data-highlight-language=["']?([^"'>\s]*)["']?[^>]*>([\s\S]*?)<\/code>/i);
      if (codeMatch) {
        const lang = codeMatch[1] || 'code';
        const snippet = codeMatch[2].replace(/<[^>]*>/g, '').trim();
        if (snippet) {
          blocks.push({ type: 'code', language: lang, snippet });
        }
      }
    }

    if (html.includes('editor-collapsible-container') || html.includes('<details')) {
      const detailsRegex = /<details[^>]*>([\s\S]*?)<\/details>/gi;
      let match;
      while ((match = detailsRegex.exec(html)) !== null) {
        const fullMatch = match[0];
        const inner = match[1];
        const titleMatch = inner.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : 'Collapsible';

        const contentMatch = inner.match(/<div[^>]*class="[^"]*editor-collapsible-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        let contentSnippet = '';
        if (contentMatch) {
          contentSnippet = contentMatch[1].replace(/<[^>]*>/g, '').trim();
        } else {
          contentSnippet = inner.replace(/<summary[^>]*>[\s\S]*?<\/summary>/i, '').replace(/<[^>]*>/g, '').trim();
        }

        const isOpen = !fullMatch.includes('details') || fullMatch.includes('open');
        blocks.push({
          type: 'collapsible',
          title: title || 'Collapsible',
          contentSnippet,
          open: isOpen,
        });
      }
    }
  }

  // Fallback 2: Preview text (ONLY if no blocks were found, and not synthetic marker)
  if (blocks.length === 0 && note.preview && note.preview.trim()) {
    const p = note.preview.trim();
    if (p !== '📊 Poll' && p !== '📊 Table' && p !== '🖼️ Photo note') {
      blocks.push({
        type: 'paragraph',
        segments: [{ text: p }],
        text: p,
      });
    }
  }

  return blocks;
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
  const blocks = useMemo(() => parseNoteBlocks(note), [note]);

  // Determine how many blocks to render without overflowing card maxHeight
  const previewBlocks = useMemo(() => {
    const hasHr = blocks.some(b => b.type === 'hr');
    const hasLarge = blocks.some(b => b.type === 'image' || b.type === 'table' || b.type === 'poll');
    let limit = isGrid ? (hasTitle ? 2 : 3) : 3;
    if (hasHr) {
      limit = isGrid ? (hasTitle ? 3 : 4) : 4;
    }
    if (hasLarge && isGrid) {
      limit = hasTitle ? 1 : 2;
    }
    return blocks.slice(0, Math.max(1, limit));
  }, [blocks, isGrid, hasTitle]);

  if (previewBlocks.length === 0) {
    return null;
  }

  return (
    <View style={styles.contentWrap}>
      {previewBlocks.map((block, idx) => {
        switch (block.type) {
          case 'image':
            return (
              <View key={`img-${idx}`} style={[styles.imageCardWrap, { backgroundColor: c.secondary }]}>
                <Image
                  source={{ uri: block.src }}
                  style={[styles.noteImage, { height: isGrid ? 120 : 150 }]}
                  resizeMode="cover"
                />
              </View>
            );

          case 'checklist':
            return (
              <View key={`chk-${idx}`} style={styles.checklistWrap}>
                {block.items.slice(0, isGrid ? 3 : 5).map((item, iIdx) => (
                  <View key={item.id || iIdx} style={styles.checkItemRow}>
                    <MaterialIcons
                      name={item.checked ? "check-box" : "check-box-outline-blank"}
                      size={15}
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
                {block.items.length > (isGrid ? 3 : 5) && (
                  <Text style={[styles.moreCounterText, { color: c.textSecondary }]}>
                    +{block.items.length - (isGrid ? 3 : 5)} more items
                  </Text>
                )}
              </View>
            );

          case 'code':
            return (
              <View
                key={`code-${idx}`}
                style={[
                  styles.codeBlockWrap,
                  {
                    backgroundColor: c.secondary + '50',
                    borderColor: c.border,
                  }
                ]}
              >
                {/* Header bar */}
                <View
                  style={[
                    styles.codeBlockHeader,
                    {
                      backgroundColor: c.secondary,
                      borderBottomColor: c.border,
                    }
                  ]}
                >
                  <Text style={[styles.codeBlockLang, { color: c.textSecondary }]}>
                    {(block.language || 'code').toUpperCase()}
                  </Text>
                </View>
                {/* Code body */}
                <View style={styles.codeBlockBody}>
                  <Text
                    style={[
                      styles.codeBlockSnippet,
                      {
                        color: c.text,
                        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      }
                    ]}
                    numberOfLines={isGrid ? 3 : 5}
                    ellipsizeMode="tail"
                  >
                    {block.snippet}
                  </Text>
                </View>
              </View>
            );

          case 'table':
            return (
              <View key={`tbl-${idx}`} style={[styles.tableWrap, { borderColor: c.border, backgroundColor: c.secondary + '40' }]}>
                {block.data.headers && block.data.headers.length > 0 && (
                  <View style={[styles.tableRowHeader, { backgroundColor: c.primary + '14', borderBottomColor: c.border }]}>
                    {block.data.headers.slice(0, 3).map((h, i) => (
                      <Text
                        key={i}
                        style={[styles.tableHeaderCell, { color: c.text, borderRightColor: i < 2 ? c.border : 'transparent' }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {h || `Col ${i + 1}`}
                      </Text>
                    ))}
                    {block.data.totalCols > 3 && (
                      <Text style={[styles.tableHeaderCell, { color: c.textSecondary, flex: 0.5, textAlign: 'center' }]}>
                        +{block.data.totalCols - 3}
                      </Text>
                    )}
                  </View>
                )}
                {block.data.rows.map((row, rIdx) => (
                  <View
                    key={rIdx}
                    style={[
                      styles.tableRowItem,
                      {
                        borderBottomColor: rIdx < block.data.rows.length - 1 ? c.border : 'transparent',
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
                    {block.data.totalCols > 3 && (
                      <Text style={[styles.tableBodyCell, { color: c.textSecondary, flex: 0.5, textAlign: 'center' }]}>
                        …
                      </Text>
                    )}
                  </View>
                ))}
                {(block.data.totalRows > 4 || block.data.totalCols > 3) && (
                  <View style={[styles.tableBadgeFooter, { borderTopColor: c.border, backgroundColor: c.secondary }]}>
                    <MaterialIcons name="grid-on" size={11} color={c.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.tableBadgeText, { color: c.textSecondary }]}>
                      {block.data.totalRows} × {block.data.totalCols} table
                    </Text>
                  </View>
                )}
              </View>
            );

          case 'poll':
            return (
              <View key={`poll-${idx}`} style={[styles.pollWrap, { borderColor: c.border, backgroundColor: c.secondary + '60' }]}>
                <View style={styles.pollHeaderRow}>
                  <Text style={{ fontSize: 13, marginRight: 4 }}>📊</Text>
                  <Text style={[styles.pollQuestionTitle, { color: c.text }]} numberOfLines={1}>
                    {block.data.question}
                  </Text>
                </View>
                {block.data.options.slice(0, 3).map((opt, i) => (
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
                  {block.data.totalVotes} vote{block.data.totalVotes !== 1 ? 's' : ''}
                </Text>
              </View>
            );

          case 'quote':
            return (
              <View key={`quote-${idx}`} style={[styles.quoteWrap, { borderLeftColor: c.primary }]}>
                <Text style={[styles.quoteText, { color: c.textSecondary }]} numberOfLines={3}>
                  "{block.text}"
                </Text>
              </View>
            );

          case 'paragraph':
            // If the whole line is inline code (e.g. Hfuggvjg)
            if (block.isAllCode) {
              return (
                <View key={`para-${idx}`} style={styles.inlineCodeRow}>
                  <View
                    style={[
                      styles.inlineCodeBadge,
                      {
                        backgroundColor: c.primary + '15',
                        borderColor: c.primary + '30',
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.inlineCodeText,
                        {
                          color: c.primary,
                          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                        }
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {block.text}
                    </Text>
                  </View>
                </View>
              );
            }

            return (
              <Text
                key={`para-${idx}`}
                style={[
                  styles.noteCardPreview,
                  block.isHeading ? styles.previewHeading : undefined,
                  {
                    color: block.isHeading ? c.text : c.textSecondary,
                    fontFamily: block.isHeading ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  }
                ]}
                numberOfLines={isGrid ? 3 : 4}
                ellipsizeMode="tail"
              >
                {block.segments.map((seg, sIdx) => {
                  if (seg.isCode) {
                    return (
                      <Text
                        key={sIdx}
                        style={{
                          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                          backgroundColor: c.primary + '18',
                          color: c.primary,
                          fontSize: 11.5,
                        }}
                      >
                        {` ${seg.text} `}
                      </Text>
                    );
                  }
                  return (
                    <Text
                      key={sIdx}
                      style={{
                        fontWeight: seg.isBold ? '700' : '400',
                        fontStyle: seg.isItalic ? 'italic' : 'normal',
                        textDecorationLine: seg.isUnderline && seg.isStrikethrough
                          ? 'underline line-through'
                          : seg.isUnderline
                          ? 'underline'
                          : seg.isStrikethrough
                          ? 'line-through'
                          : 'none',
                      }}
                    >
                      {seg.text}
                    </Text>
                  );
                })}
              </Text>
            );

          case 'hr':
            return (
              <View
                key={`hr-${idx}`}
                style={[styles.previewHr, { backgroundColor: c.border }]}
              />
            );

          case 'collapsible':
            return (
              <View
                key={`col-${idx}`}
                style={[
                  styles.collapsibleWrap,
                  {
                    backgroundColor: c.secondary + '30',
                    borderColor: c.border,
                  }
                ]}
              >
                {/* Header bar */}
                <View
                  style={[
                    styles.collapsibleHeader,
                    {
                      backgroundColor: c.secondary,
                      borderBottomColor: block.open !== false && block.contentSnippet ? c.border : 'transparent',
                      borderBottomWidth: block.open !== false && block.contentSnippet ? 0.5 : 0,
                    }
                  ]}
                >
                  <MaterialIcons
                    name={block.open !== false ? "arrow-drop-down" : "arrow-right"}
                    size={18}
                    color={c.textSecondary}
                    style={styles.collapsibleArrow}
                  />
                  <Text
                    style={[styles.collapsibleTitle, { color: c.text }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {block.title || 'Collapsible'}
                  </Text>
                </View>

                {/* Body snippet */}
                {block.open !== false && !!block.contentSnippet && (
                  <View style={styles.collapsibleBody}>
                    <Text
                      style={[styles.collapsibleSnippet, { color: c.textSecondary }]}
                      numberOfLines={isGrid ? 2 : 3}
                      ellipsizeMode="tail"
                    >
                      {block.contentSnippet}
                    </Text>
                  </View>
                )}
              </View>
            );

          default:
            return null;
        }
      })}
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
  const { theme, isDark } = useTheme();
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

  // Reload notes whenever screen comes back into focus (e.g. returning from NoteScreen)
  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

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

  // Inline Code Badge
  inlineCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1,
  },
  inlineCodeBadge: {
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    alignSelf: 'flex-start',
  },
  inlineCodeText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  previewHeading: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  previewHr: {
    height: 1,
    width: '100%',
    marginVertical: 4,
    opacity: 0.7,
  },

  // 5. Code Block (Styled cleanly like NoteEditor)
  codeBlockWrap: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 2,
  },
  codeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderBottomWidth: 1,
  },
  codeBlockLang: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  codeBlockBody: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  codeBlockSnippet: {
    fontSize: 11,
    lineHeight: 16,
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

  // 7. Collapsible Container
  collapsibleWrap: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 2.5,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  collapsibleArrow: {
    marginRight: 2,
    marginLeft: -2,
  },
  collapsibleTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  collapsibleBody: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  collapsibleSnippet: {
    fontSize: 11,
    lineHeight: 16,
  },

  // 8. General text snippet
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
