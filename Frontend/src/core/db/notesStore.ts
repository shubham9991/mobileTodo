/**
 * Notes data store — persists notes using expo-file-system as JSON files.
 * Each note's content is the Lexical JSON AST (lossless round-trip).
 */
import * as FileSystem from 'expo-file-system/legacy';

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

/** Generates a simple preview string from plain text. */
export function buildPreview(text: string, maxLen = 120): string {
  return text.replace(/\n+/g, ' ').trim().slice(0, maxLen);
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
