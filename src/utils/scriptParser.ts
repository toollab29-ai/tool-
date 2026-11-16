import { BulletItem } from '../types';

const BULLET_PREFIX_REGEX = /^[\s]*(?:[•●▪▫▸►\-–—*]|\d+[.)])\s+/;

/**
 * Parses a pasted or typed weather script into structured bullet points
 * while preserving the exact original wording of each point.
 */
export function parseScriptToBullets(
  rawScript: string,
  existingBullets: BulletItem[] = []
): BulletItem[] {
  const lines = rawScript
    .split(/\r?\n/)
    .map((line) => line.replace(BULLET_PREFIX_REGEX, '').trim())
    .filter((line) => line.length > 0);

  return lines.map((lineText, idx) => {
    // Try to preserve existing formatting if text matches or index matches closely
    const exactMatch = existingBullets.find((b) => b.text.trim() === lineText);
    if (exactMatch) {
      return {
        ...exactMatch,
        text: lineText,
      };
    }

    const indexMatch = existingBullets[idx];
    if (indexMatch) {
      // Keep colorMode and keep any highlighted word indices that are still in range
      const wordCount = lineText.split(/\s+/).filter(Boolean).length;
      return {
        id: indexMatch.id,
        text: lineText,
        colorMode: indexMatch.colorMode,
        highlightedWords: indexMatch.highlightedWords.filter((wi) => wi < wordCount),
        emergencyWords: (indexMatch.emergencyWords || []).filter((wi) => wi < wordCount),
      };
    }

    return {
      id: `bullet-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      text: lineText,
      colorMode: 'auto',
      highlightedWords: [],
      emergencyWords: [],
    };
  });
}

/**
 * Serializes structured bullets back into a clean bulleted raw script string.
 */
export function bulletsToRawScript(bullets: BulletItem[]): string {
  return bullets.map((b) => `• ${b.text}`).join('\n');
}

/**
 * Helper to find word indices in a bullet that contain numbers, measurements, or time indicators
 * (does NOT alter text wording in any way).
 */
export function findNumericWordIndices(text: string): number[] {
  const words = text.split(/\s+/).filter(Boolean);
  const indices: number[] = [];
  words.forEach((w, idx) => {
    if (/\d/.test(w)) {
      indices.push(idx);
    }
  });
  return indices;
}

export interface ParagraphWordToken {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
}

/**
 * Splits paragraph-style content into lines while assigning deterministic global word indices
 * and exact character offsets so UI phrase/word selection and canvas rendering match 1:1.
 */
export function parseParagraphTokens(content: string): {
  lines: ParagraphWordToken[][];
  flatWords: ParagraphWordToken[];
} {
  const flatWords: ParagraphWordToken[] = [];
  const rawLines = (content || '').split(/\r?\n/);
  const lines: ParagraphWordToken[][] = [];

  let charCursor = 0;
  let globalIdx = 0;

  for (let li = 0; li < rawLines.length; li++) {
    const rawLine = rawLines[li];
    const lineTokens: ParagraphWordToken[] = [];
    const wordRegex = /\S+/g;
    let match: RegExpExecArray | null;

    while ((match = wordRegex.exec(rawLine)) !== null) {
      const token: ParagraphWordToken = {
        text: match[0],
        index: globalIdx++,
        startChar: charCursor + match.index,
        endChar: charCursor + match.index + match[0].length,
      };
      lineTokens.push(token);
      flatWords.push(token);
    }

    lines.push(lineTokens);
    // Advance charCursor past this line and its newline separator
    charCursor += rawLine.length + 1;
  }

  return { lines, flatWords };
}

/**
 * Maps a textarea [selectionStart, selectionEnd] range onto overlapping word indices.
 */
export function mapSelectionRangeToWordIndices(
  content: string,
  selectionStart: number,
  selectionEnd: number
): number[] {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  if (end <= start) return [];

  const { flatWords } = parseParagraphTokens(content);
  return flatWords
    .filter((w) => w.endChar > start && w.startChar < end)
    .map((w) => w.index);
}
