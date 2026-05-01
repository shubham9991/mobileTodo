/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Smart Parser — 3-Engine Parallel Intelligence System
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Engine 1 — TFLite Intent Classifier  (react-native-fast-tflite)
 *   Classifies the overarching task category (tag) using a custom on-device
 *   model. Input: tokenized text. Output: probability array → top label.
 *
 * Engine 2 — compromise NLP  (100% pure JS, zero native build deps)
 *   Extracts named places from the sentence (cities, countries, landmarks)
 *   using lightweight offline NLP. No download, no crash risk.
 *
 * Engine 3 — Regex / String Matching   (pure JS)
 *   Catches virtual meeting links (Zoom, Meet, Teams) and micro-locations
 *   (Room 4, 2nd floor) that NLP is not trained for.
 *
 * Date Engine — chrono-node
 *   Parses any natural language time expression into a JS Date, including
 *   relative phrases like "day after tomorrow at 5pm" or "next Friday".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { loadTensorflowModel } from 'react-native-fast-tflite';
import * as chrono from 'chrono-node';
import { format } from 'date-fns';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nlp = require('compromise');

// ─── Label map for TFLite output ─────────────────────────────────────────────
// Must match the training order of your CSV. Exactly 12 labels, index 0-11.
const TFLITE_LABELS: string[] = [
  'Education',
  'Entertainment',
  'Finance',
  'Health',
  'Personal',
  'Productivity',
  'Self-Improvement',
  'Shopping',
  'Social',
  'Technology',
  'Travel',
  'Work',
];

// ─── Tokenizer ────────────────────────────────────────────────────────────────
// A simple hash-based bag-of-words tokenizer. Must match whatever your model
// was trained against (adjust VOCAB_SIZE / MAX_SEQUENCE_LENGTH accordingly).
const VOCAB_SIZE = 128;
const MAX_SEQUENCE_LENGTH = 64;

function tokenize(text: string): Int32Array {
  const tokens = new Int32Array(MAX_SEQUENCE_LENGTH).fill(0);
  const words = text.toLowerCase().trim().split(/\s+/);
  words.slice(0, MAX_SEQUENCE_LENGTH).forEach((word, i) => {
    let hash = 0;
    for (let c = 0; c < word.length; c++) {
      hash = (hash * 31 + word.charCodeAt(c)) >>> 0;
    }
    tokens[i] = (hash % (VOCAB_SIZE - 1)) + 1;
  });
  return tokens;
}

// ─── Singleton TFLite model ───────────────────────────────────────────────────
let _tfliteModel: Awaited<ReturnType<typeof loadTensorflowModel>> | null = null;
let _tfliteLoading = false;

async function getTfliteModel() {
  if (_tfliteModel) return _tfliteModel;
  if (_tfliteLoading) return null;
  try {
    _tfliteLoading = true;
    _tfliteModel = await loadTensorflowModel(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../../assets/MLTodo/model.tflite'),
      [] // CPU delegate (default)
    );
    return _tfliteModel;
  } catch (e) {
    console.warn('[SmartParser] TFLite model load failed:', e);
    return null;
  } finally {
    _tfliteLoading = false;
  }
}

// ─── Engine 1: TFLite Tag Classification ─────────────────────────────────────
async function runTfliteEngine(text: string): Promise<string | null> {
  try {
    const model = await getTfliteModel();
    if (!model) return null;

    console.log('[SmartParser] Model Inputs:', model.inputs);
    console.log('[SmartParser] Model Outputs:', model.outputs);

    let inputBuffer: ArrayBuffer;
    if (model.inputs[0]?.dataType === 'string') {
      // TFLite string tensors often expect a specific encoding (Pascal strings),
      // but some runtimes allow raw UTF-8. Let's try raw UTF-8 first.
      const encoder = new TextEncoder();
      const bytes = encoder.encode(text);
      inputBuffer = bytes.buffer;
    } else {
      const tokens = tokenize(text);
      if (model.inputs[0]?.dataType === 'float32') {
        inputBuffer = new Float32Array(tokens).buffer;
      } else {
        inputBuffer = tokens.buffer;
      }
    }

    const output = model.runSync([inputBuffer]);

    if (!output || !output[0]) return null;

    const probabilities = new Float32Array(output[0] as ArrayBuffer);
    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let i = 0; i < probabilities.length; i++) {
      if (probabilities[i] > maxVal) {
        maxVal = probabilities[i];
        maxIdx = i;
      }
    }

    // Only return a label if confidence is reasonably high
    if (maxVal < 0.3) return null;
    return TFLITE_LABELS[maxIdx] ?? null;
  } catch (e: any) {
    if (e && e.message && e.message.includes('unresolved-ops')) {
      // Suppress 'unresolved-ops' warning because we safely fall back to the other engines
    } else {
      console.warn('[SmartParser] TFLite inference error:', e);
    }
    return null;
  }
}

// ─── Engine 2: compromise NLP Place Extraction ───────────────────────────────
// Pure JavaScript — no native code, no ContentProvider, no crash.
// Extracts formal place names: cities, countries, geographic landmarks.
function runCompromiseEngine(text: string): string[] {
  try {
    const doc = nlp(text);
    // Extract Places (cities, countries, landmarks)
    const places: string[] = doc.places().out('array') as string[];
    // Also pull out proper nouns that look capitalised but weren't caught above
    const properNouns: string[] = (doc.match('#ProperNoun+').out('array') as string[])
      .filter((p: string) => p.length > 2 && /^[A-Z]/.test(p));

    // Merge, dedupe, trim
    const combined = Array.from(new Set([...places, ...properNouns]))
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 1);

    return combined;
  } catch (e) {
    console.warn('[SmartParser] compromise error:', e);
    return [];
  }
}

// ─── Engine 3: Regex / String Micro-Location Matching ────────────────────────
const VIRTUAL_MEETING_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bzoom(\.us)?\b/i, label: 'Zoom' },
  { pattern: /\bgoogle\s*meet\b/i, label: 'Google Meet' },
  { pattern: /\bmeet\.google\b/i, label: 'Google Meet' },
  { pattern: /\bmicrosoft\s*teams\b/i, label: 'Microsoft Teams' },
  { pattern: /\bteams\b/i, label: 'Microsoft Teams' },
  { pattern: /\bskype\b/i, label: 'Skype' },
  { pattern: /\bwebex\b/i, label: 'Webex' },
];

const MICRO_LOCATION_PATTERNS: RegExp[] = [
  /\broom\s+\d+\b/i,
  /\b\d+\s*(st|nd|rd|th)\s+floor\b/i,
  /\bfloor\s+\d+\b/i,
  /\bbuilding\s+[a-z\d]+\b/i,
  /\bblock\s+[a-z\d]+\b/i,
  /\bgate\s+\d+\b/i,
  /\bsector\s+\d+\b/i,
  /\bphase\s+\d+\b/i,
  /\bhall\s+\d+\b/i,
  /\bapartment\s+\w+\b/i,
  /\bflat\s+\w+\b/i,
  /\boffice\s+no\.?\s*\d+\b/i,
];

function runRegexEngine(text: string): string[] {
  const found = new Set<string>();

  for (const { pattern, label } of VIRTUAL_MEETING_PATTERNS) {
    if (pattern.test(text)) found.add(label);
  }

  for (const pattern of MICRO_LOCATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const loc = match[0].replace(/\b\w/g, (c) => c.toUpperCase());
      found.add(loc);
    }
  }

  return Array.from(found);
}

// ─── Date Engine: chrono-node ─────────────────────────────────────────────────
export interface ParsedDateTime {
  date: Date | null;
  dateLabel: string | null;
  time: string | null;
}

function runChronoEngine(text: string): ParsedDateTime {
  try {
    const results = chrono.parse(text);
    if (!results || results.length === 0) {
      return { date: null, dateLabel: null, time: null };
    }

    const result = results[0];
    const date = result.start.date();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    let dateLabel: string;
    if (dateOnly.getTime() === today.getTime()) {
      dateLabel = 'Today';
    } else if (dateOnly.getTime() === tomorrow.getTime()) {
      dateLabel = 'Tomorrow';
    } else {
      dateLabel = format(date, 'MMM d');
    }

    let time: string | null = null;
    if (result.start.isCertain('hour')) {
      time = format(date, 'h:mm a');
    }

    return { date, dateLabel, time };
  } catch (e) {
    console.warn('[SmartParser] chrono-node error:', e);
    return { date: null, dateLabel: null, time: null };
  }
}

// ─── Combined Result Type ─────────────────────────────────────────────────────
export interface SmartParseResult {
  /** Detected tag/category from TFLite (e.g. "Work", "Health") */
  tag: string | null;
  /** All detected locations merged from compromise NLP + Regex engines */
  locations: string[];
  date: Date | null;
  dateLabel: string | null;
  time: string | null;
}

// ─── Main Export: Run All 3 Engines in Parallel ───────────────────────────────
export async function smartParseText(text: string): Promise<SmartParseResult> {
  if (!text || text.trim().length < 2) {
    return { tag: null, locations: [], date: null, dateLabel: null, time: null };
  }

  // Engine 2 (compromise) + Engine 3 (regex) + Date Engine are all synchronous.
  // Engine 1 (TFLite) is async — run it in parallel.
  const compromiseLocations = runCompromiseEngine(text);
  const regexLocations = runRegexEngine(text);
  const chronoResult = runChronoEngine(text);

  // Merge & deduplicate locations
  const allLocations = Array.from(new Set([...compromiseLocations, ...regexLocations]));

  // TFLite async
  const tfliteTag = await runTfliteEngine(text);

  return {
    tag: tfliteTag,
    locations: allLocations,
    date: chronoResult.date,
    dateLabel: chronoResult.dateLabel,
    time: chronoResult.time,
  };
}

// ─── Synchronous fallback (no async, instant result for real-time UI) ─────────
// Used on every keystroke. Returns compromise + regex locations + chrono date.
export function smartParseTextSync(text: string): {
  regexLocations: string[];
  nlpLocations: string[];
  chronoResult: ParsedDateTime;
} {
  return {
    regexLocations: runRegexEngine(text),
    nlpLocations: runCompromiseEngine(text),
    chronoResult: runChronoEngine(text),
  };
}
