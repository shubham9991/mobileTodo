/**
 * Notes data store — persists notes using expo-file-system as JSON files.
 * Each note's content is the Lexical JSON AST (lossless round-trip).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, ToastAndroid } from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Note {
  id: string;
  title: string;
  /** Lexical EditorState JSON AST — the single source of truth */
  content: object;
  /** Cached HTML derived from the AST — used for rich previews */
  contentHtml: string;
  /** Plain text for card preview snippets */
  preview: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  wordCount: number;
  tag?: string;
}

// ── Paths ─────────────────────────────────────────────────────────────────────
const NOTES_DIR = `${FileSystem.documentDirectory}notes/`;
const INDEX_FILE = `${NOTES_DIR}index.json`;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function ensureDir() {
  const info = await FileSystem.getInfoAsync(NOTES_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(NOTES_DIR, { intermediates: true });
}

function noteFile(id: string) { return `${NOTES_DIR}${id}.json`; }

async function readIndex(): Promise<string[]> {
  try {
    const raw = await FileSystem.readAsStringAsync(INDEX_FILE);
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function writeIndex(ids: string[]) {
  await FileSystem.writeAsStringAsync(INDEX_FILE, JSON.stringify(ids));
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function getAllNotes(): Promise<Note[]> {
  await ensureDir();
  const ids = await readIndex();
  const notes: Note[] = [];
  for (const id of ids) {
    try {
      const raw = await FileSystem.readAsStringAsync(noteFile(id));
      notes.push(JSON.parse(raw) as Note);
    } catch {
      // skip corrupted notes
    }
  }
  // Sort by updatedAt desc
  return notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getNote(id: string): Promise<Note | null> {
  await ensureDir();
  try {
    const raw = await FileSystem.readAsStringAsync(noteFile(id));
    return JSON.parse(raw) as Note;
  } catch {
    return null;
  }
}

export async function saveNote(note: Note): Promise<void> {
  await ensureDir();
  await FileSystem.writeAsStringAsync(noteFile(note.id), JSON.stringify(note));
  const ids = await readIndex();
  if (!ids.includes(note.id)) {
    ids.unshift(note.id);
    await writeIndex(ids);
  }
}

export async function deleteNote(id: string): Promise<void> {
  await ensureDir();
  try {
    await FileSystem.deleteAsync(noteFile(id), { idempotent: true });
  } catch {}
  const ids = await readIndex();
  await writeIndex(ids.filter(i => i !== id));
}

export async function updateNotePin(id: string, pinned: boolean): Promise<void> {
  const note = await getNote(id);
  if (!note) return;
  await saveNote({ ...note, pinned, updatedAt: new Date().toISOString() });
}

/** Creates a new blank Note object (not yet persisted — call saveNote to persist). */
export function createBlankNote(id: string, title = ''): Note {
  const now = new Date().toISOString();
  return {
    id,
    title,
    content: {},
    contentHtml: '',
    preview: '',
    createdAt: now,
    updatedAt: now,
    pinned: false,
    wordCount: 0,
  };
}

/** Generates a simple preview string from plain text, supporting checklists and preserving formatting. */
export function buildPreview(text: string, html?: string, maxLen = 500): string {
  if (html && (html.includes('listItemChecked') || html.includes('listItemUnchecked') || html.includes('keep-checklist'))) {
    const liRegex = /<li[^>]*class="[^"]*listItem(Checked|Unchecked)[^"]*"[^>]*>(.*?)<\/li>/gi;
    let match;
    const lines: string[] = [];
    
    liRegex.lastIndex = 0;
    while ((match = liRegex.exec(html)) !== null) {
      const type = match[1]; // Checked or Unchecked
      const content = match[2];
      const cleanContent = content.replace(/<[^>]*>/g, '').trim();
      const isChecked = type === 'Checked';
      lines.push(`${isChecked ? '☑' : '☐'} ${cleanContent}`);
    }
    
    if (lines.length > 0) {
      return lines.slice(0, 15).join('\n');
    }
  }

  if (text && text.trim().length > 0) {
    return text.trim().slice(0, maxLen);
  }

  if (html) {
    if (html.includes('<img')) return '🖼️ Photo note';
    if (html.includes('poll-container') || html.includes('poll-wrapper')) return '📊 Poll';
    if (html.includes('<table')) return '📊 Table';
  }

  return '';
}

/** Formats relative time for note cards (e.g., "2m ago", "3h ago", "Jun 2"). */
export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Toast notification system for discarded notes ────────────────────────────
export function showNoteToast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  }
}

// ── Recursive AST check for meaningful content ───────────────────────────────
function hasMeaningfulAstContent(nodes: any[]): boolean {
  for (const node of nodes) {
    if (!node) continue;

    // Media / Embeds that constitute substantive content
    if (node.type === 'image' && node.src && String(node.src).trim().length > 0) {
      return true;
    }
    if (node.type === 'youtube' && (node.videoUrl || node.url || node.videoId)) {
      return true;
    }
    if (node.type === 'tweet-card' && (node.tweetId || node.url)) {
      return true;
    }
    if (node.type === 'link-preview' && node.url) {
      return true;
    }
    if (node.type === 'equation' && node.equation && String(node.equation).trim().length > 0) {
      return true;
    }

    // Keep checklist: must have at least one item with non-whitespace text
    if (node.type === 'keep-checklist') {
      if (Array.isArray(node.items)) {
        const hasText = node.items.some((it: any) => {
          const t = String(it.text || '').replace(/<[^>]*>/g, '').replace(/[\s\u200B\uFEFF\u00A0]+/g, '');
          return t.length > 0;
        });
        if (hasText) return true;
      }
      continue;
    }

    // Poll: must have non-default question or non-default options
    if (node.type === 'poll') {
      const q = String(node.question || '').trim();
      if (q.length > 0 && q !== 'Poll') return true;
      if (Array.isArray(node.options)) {
        const hasOpt = node.options.some((o: any) => {
          const ot = String(o.text || '').trim();
          return ot.length > 0 && ot !== 'Option';
        });
        if (hasOpt) return true;
      }
      continue;
    }

    // Structural dividers alone (HR / Page Break) do not count as substantive content
    if (node.type === 'horizontalrule' || node.type === 'hr' || node.type === 'page-break') {
      continue;
    }

    // Direct text property (e.g. TextNode)
    if (typeof node.text === 'string') {
      const clean = node.text.replace(/[\s\u200B\uFEFF\u00A0]+/g, '');
      if (clean.length > 0) return true;
    }

    // Nested children (paragraphs, headings, code blocks, lists, tables, collapsibles, quotes)
    if (Array.isArray(node.children) && node.children.length > 0) {
      if (hasMeaningfulAstContent(node.children)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determines whether a note has no substantive content and should be automatically discarded.
 * Checks title, AST nodes, plain text, and HTML.
 */
export function isNoteEmpty(
  title?: string,
  contentJson?: any,
  contentHtml?: string,
  plainText?: string
): boolean {
  // 1. Check title: if user provided a meaningful title (not blank and not 'untitled'), it's not empty
  const cleanTitle = (title || '').trim();
  if (cleanTitle.length > 0 && cleanTitle.toLowerCase() !== 'untitled') {
    return false;
  }

  // 2. Check Lexical AST JSON (the source of truth)
  if (contentJson && typeof contentJson === 'object') {
    const root = (contentJson as any).root;
    if (root && Array.isArray(root.children) && root.children.length > 0) {
      if (hasMeaningfulAstContent(root.children)) {
        return false;
      }
    }
  }

  // 3. Check plain text
  if (plainText) {
    const cleanText = plainText.replace(/[\s\u200B\uFEFF\u00A0]+/g, '');
    if (cleanText.length > 0) {
      return false;
    }
  }

  // 4. Check HTML
  if (contentHtml) {
    if (/<img[^>]+src=["'][^"']+["']/i.test(contentHtml)) return false;
    if (
      contentHtml.includes('editor-youtube') ||
      contentHtml.includes('editor-equation') ||
      contentHtml.includes('editor-tweet') ||
      contentHtml.includes('editor-link-preview')
    ) {
      return false;
    }
    if (contentHtml.includes('poll-wrapper') || contentHtml.includes('poll-container')) {
      const pollText = contentHtml.replace(/<[^>]*>/g, '').replace(/[\s\u200B\uFEFF\u00A0]+/g, '');
      if (pollText.length > 0 && pollText !== 'Poll' && pollText !== '0votes') {
        return false;
      }
    }
    const strippedHtml = contentHtml
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, '')
      .replace(/&#160;/g, '')
      .replace(/[\s\u200B\uFEFF\u00A0]+/g, '');
    if (strippedHtml.length > 0) {
      return false;
    }
  }

  return true;
}
