/**
 * drawingStore — local file-system persistence for tldraw drawings.
 * Uses expo-file-system to read/write JSON snapshots in the app's document directory.
 */
import * as FileSystem from 'expo-file-system/legacy';

const DRAWINGS_DIR = `${FileSystem.documentDirectory}drawings/`;

export interface DrawingMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thumbnailUri?: string; // path to saved thumbnail png
  wordCount?: number;
}

// ── Ensure the drawings directory exists ──────────────────────────────────────
async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DRAWINGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DRAWINGS_DIR, { intermediates: true });
  }
}

// ── Meta index helpers ────────────────────────────────────────────────────────
const META_FILE = `${DRAWINGS_DIR}index.json`;

async function readMeta(): Promise<DrawingMeta[]> {
  await ensureDir();
  const info = await FileSystem.getInfoAsync(META_FILE);
  if (!info.exists) return [];
  const raw = await FileSystem.readAsStringAsync(META_FILE);
  try { return JSON.parse(raw) as DrawingMeta[]; } catch { return []; }
}

async function writeMeta(metas: DrawingMeta[]) {
  await FileSystem.writeAsStringAsync(META_FILE, JSON.stringify(metas));
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Get all drawing metadata (sorted newest first) */
export async function getAllDrawings(): Promise<DrawingMeta[]> {
  const metas = await readMeta();
  return metas.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Get the raw tldraw snapshot JSON string for a drawing */
export async function getDrawing(id: string): Promise<string | null> {
  await ensureDir();
  const path = `${DRAWINGS_DIR}${id}.json`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  return FileSystem.readAsStringAsync(path);
}

/** Save/update a drawing snapshot and update metadata */
export async function saveDrawing(
  id: string,
  snapshotJson: string,
  title?: string
): Promise<void> {
  await ensureDir();
  const path = `${DRAWINGS_DIR}${id}.json`;
  await FileSystem.writeAsStringAsync(path, snapshotJson);

  const metas = await readMeta();
  const now = Date.now();
  const existing = metas.find(m => m.id === id);

  if (existing) {
    existing.updatedAt = now;
    if (title !== undefined) existing.title = title;
  } else {
    metas.push({
      id,
      title: title || 'Untitled Sketch',
      createdAt: now,
      updatedAt: now,
    });
  }
  await writeMeta(metas);
}

/** Save a base64 PNG thumbnail for a drawing and update metadata */
export async function saveThumbnail(id: string, base64DataUrl: string): Promise<string | null> {
  await ensureDir();
  const thumbPath = `${DRAWINGS_DIR}${id}_thumb.png`;
  // Strip the "data:image/png;base64," prefix
  const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
  try {
    await FileSystem.writeAsStringAsync(thumbPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    // Update meta with thumbnail URI
    const metas = await readMeta();
    const m = metas.find(meta => meta.id === id);
    if (m) {
      m.thumbnailUri = thumbPath;
      await writeMeta(metas);
    }
    return thumbPath;
  } catch (err) {
    console.error('[drawingStore] saveThumbnail error', err);
    return null;
  }
}

/** Update the title of a drawing */
export async function updateDrawingTitle(id: string, title: string): Promise<void> {
  const metas = await readMeta();
  const m = metas.find(meta => meta.id === id);
  if (m) {
    m.title = title;
    await writeMeta(metas);
  }
}

/** Delete a drawing and its thumbnail */
export async function deleteDrawing(id: string): Promise<void> {
  const snapshotPath = `${DRAWINGS_DIR}${id}.json`;
  const thumbPath = `${DRAWINGS_DIR}${id}_thumb.png`;

  const [snapInfo, thumbInfo] = await Promise.all([
    FileSystem.getInfoAsync(snapshotPath),
    FileSystem.getInfoAsync(thumbPath),
  ]);
  if (snapInfo.exists) await FileSystem.deleteAsync(snapshotPath, { idempotent: true });
  if (thumbInfo.exists) await FileSystem.deleteAsync(thumbPath, { idempotent: true });

  const metas = await readMeta();
  await writeMeta(metas.filter(m => m.id !== id));
}

/** Generate a unique drawing ID */
export function generateDrawingId(): string {
  return `drawing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Format relative time (shared with notes) */
export function formatDrawingTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
