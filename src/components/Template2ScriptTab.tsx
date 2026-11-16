import React, { useRef, useState } from 'react';
import { Template2TextSettings } from '../types';
import { TEMPLATE2_SCRIPT_PRESETS } from '../utils/presets';
import {
  mapSelectionRangeToWordIndices,
  parseParagraphTokens,
} from '../utils/scriptParser';
import {
  Type,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CheckCircle2,
  AlertTriangle,
  Eraser,
} from 'lucide-react';

interface Template2ScriptTabProps {
  textSettings: Template2TextSettings;
  onChange: (updated: Partial<Template2TextSettings>) => void;
  onNext: () => void;
  autoFitInfo?: {
    usedFontSize: number;
    requestedFontSize: number;
    wasAutoFitted: boolean;
    overflowWarning: boolean;
  };
}

const T2_FONTS = [
  { value: 'Inter', label: 'Inter (Clean Documentary)' },
  { value: 'Montserrat', label: 'Montserrat (Bold Geometric)' },
  { value: 'Roboto', label: 'Roboto (Editorial)' },
  { value: 'Oswald', label: 'Oswald (Condensed)' },
  { value: 'Georgia', label: 'Georgia (Serif)' },
  { value: 'monospace', label: 'Monospace' },
];

export const Template2ScriptTab: React.FC<Template2ScriptTabProps> = ({
  textSettings,
  onChange,
  onNext,
  autoFitInfo,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [brushMode, setBrushMode] = useState<'orange' | 'blue' | 'clear'>('orange');
  const [anchorWordIdx, setAnchorWordIdx] = useState<number | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);

  const { flatWords } = parseParagraphTokens(textSettings.content || '');
  const orangeSet = new Set(textSettings.orangeWords || []);
  const blueSet = new Set(textSettings.blueWords || []);

  const handleTextChange = (newContent: string) => {
    const { flatWords: nextWords } = parseParagraphTokens(newContent);
    const maxIdx = nextWords.length;
    onChange({
      content: newContent,
      orangeWords: (textSettings.orangeWords || []).filter((i) => i < maxIdx),
      blueWords: (textSettings.blueWords || []).filter((i) => i < maxIdx),
    });
  };

  const applyIndicesHighlight = (
    indices: number[],
    mode: 'orange' | 'blue' | 'clear'
  ) => {
    if (indices.length === 0) return;
    const nextOrange = new Set(textSettings.orangeWords || []);
    const nextBlue = new Set(textSettings.blueWords || []);

    for (const idx of indices) {
      if (mode === 'orange') {
        nextBlue.delete(idx);
        nextOrange.add(idx);
      } else if (mode === 'blue') {
        nextOrange.delete(idx);
        nextBlue.add(idx);
      } else {
        nextOrange.delete(idx);
        nextBlue.delete(idx);
      }
    }

    onChange({
      orangeWords: Array.from(nextOrange).sort((a, b) => a - b),
      blueWords: Array.from(nextBlue).sort((a, b) => a - b),
    });
  };

  const handleHighlightTextareaSelection = (mode: 'orange' | 'blue' | 'clear') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const indices = mapSelectionRangeToWordIndices(textSettings.content, start, end);

    if (indices.length === 0) {
      setSelectionNotice('Select a word or phrase inside the text box first.');
      setTimeout(() => setSelectionNotice(null), 2500);
      return;
    }

    applyIndicesHighlight(indices, mode);
    setSelectionNotice(null);
  };

  const handleWordChipClick = (
    wordIdx: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (e.shiftKey && anchorWordIdx !== null) {
      const from = Math.min(anchorWordIdx, wordIdx);
      const to = Math.max(anchorWordIdx, wordIdx);
      const range: number[] = [];
      for (let i = from; i <= to; i++) range.push(i);
      applyIndicesHighlight(range, brushMode);
      setAnchorWordIdx(wordIdx);
      return;
    }

    setAnchorWordIdx(wordIdx);
    const isOrange = orangeSet.has(wordIdx);
    const isBlue = blueSet.has(wordIdx);

    if (brushMode === 'clear') {
      applyIndicesHighlight([wordIdx], 'clear');
    } else if (brushMode === 'orange') {
      applyIndicesHighlight([wordIdx], isOrange ? 'clear' : 'orange');
    } else {
      applyIndicesHighlight([wordIdx], isBlue ? 'clear' : 'blue');
    }
  };

  return (
    <div className="space-y-5">
      {/* Sample Documentary Weather Paragraphs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-neutral-300">
            Template 2 Weather Story Presets:
          </label>
          <span className="text-[11px] text-neutral-400">
            Paragraph style (white + orange/yellow + blue highlights)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TEMPLATE2_SCRIPT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                onChange({
                  content: preset.content,
                  orangeWords: [...preset.orangeWords],
                  blueWords: [...preset.blueWords],
                })
              }
              className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-800/80 hover:border-sky-500/50 text-left transition-colors cursor-pointer group"
            >
              <div className="text-xs font-semibold text-neutral-200 group-hover:text-sky-400">
                {preset.label}
              </div>
              <div className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                {preset.preview}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Large Editable Paragraph Area */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-sky-400" />
            Paragraph Story Content (Upper Panel)
          </label>
          <span className="text-xs text-neutral-400 font-mono tabular-nums">
            {flatWords.length} words · {textSettings.content.length} chars
          </span>
        </div>

        <textarea
          ref={textareaRef}
          rows={6}
          value={textSettings.content}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Write or paste your documentary-style weather explanation paragraph here..."
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-sky-400 transition-colors resize-y leading-relaxed"
        />

        {/* Phrase Selection Highlight Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleHighlightTextareaSelection('orange')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
              title="Drag-select text above then click to highlight in orange/yellow"
            >
              <Highlighter className="w-3 h-3" />
              <span>Selection → Orange/Yellow</span>
            </button>

            <button
              type="button"
              onClick={() => handleHighlightTextareaSelection('blue')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
              title="Drag-select text above then click to highlight in blue"
            >
              <Highlighter className="w-3 h-3" />
              <span>Selection → Blue</span>
            </button>

            <button
              type="button"
              onClick={() => handleHighlightTextareaSelection('clear')}
              className="px-2 py-1 text-[11px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded-md flex items-center gap-1 cursor-pointer"
            >
              <Eraser className="w-3 h-3" />
              <span>Clear Selection</span>
            </button>
          </div>

          {autoFitInfo && (
            <div className="text-[11px] flex items-center gap-1">
              {autoFitInfo.overflowWarning ? (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Increase upper panel height or enable Auto-fit</span>
                </span>
              ) : autoFitInfo.wasAutoFitted ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>
                    Auto-fitted to {autoFitInfo.usedFontSize}px (from {autoFitInfo.requestedFontSize}px)
                  </span>
                </span>
              ) : (
                <span className="text-neutral-400">
                  Fits upper black panel cleanly
                </span>
              )}
            </div>
          )}
        </div>

        {selectionNotice && (
          <div className="text-[11px] text-amber-400 mt-1.5">{selectionNotice}</div>
        )}
      </div>

      {/* Interactive Word & Phrase Painter */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-neutral-200">
              Click Words or Shift+Click Phrases to Highlight
            </h4>
            <p className="text-[10px] text-neutral-400">
              Choose highlight color, then click any word (hold Shift to highlight an entire phrase)
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setBrushMode('orange')}
              className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                brushMode === 'orange'
                  ? 'bg-amber-500 text-black border-amber-300'
                  : 'bg-neutral-900 text-amber-300 border-neutral-800 hover:border-amber-500/50'
              }`}
            >
              Orange/Yellow ({textSettings.orangeWords.length})
            </button>
            <button
              type="button"
              onClick={() => setBrushMode('blue')}
              className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                brushMode === 'blue'
                  ? 'bg-sky-400 text-black border-sky-200'
                  : 'bg-neutral-900 text-sky-300 border-neutral-800 hover:border-sky-400/50'
              }`}
            >
              Blue ({textSettings.blueWords.length})
            </button>
            <button
              type="button"
              onClick={() => setBrushMode('clear')}
              className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer transition-colors ${
                brushMode === 'clear'
                  ? 'bg-white text-black border-white'
                  : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:text-white'
              }`}
            >
              White
            </button>
            <button
              type="button"
              onClick={() => onChange({ orangeWords: [], blueWords: [] })}
              className="px-2 py-1 rounded text-[10px] text-neutral-400 hover:text-rose-400 bg-neutral-900 border border-neutral-800 cursor-pointer"
            >
              Reset All
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto bg-neutral-900/70 p-2.5 rounded-lg border border-neutral-800">
          {flatWords.length === 0 ? (
            <span className="text-xs text-neutral-500">Type paragraph text above to highlight words.</span>
          ) : (
            flatWords.map((w) => {
              const isOrange = orangeSet.has(w.index);
              const isBlue = blueSet.has(w.index);
              return (
                <button
                  key={`${w.index}-${w.text}`}
                  type="button"
                  onClick={(e) => handleWordChipClick(w.index, e)}
                  style={{
                    backgroundColor: isBlue
                      ? textSettings.blueColor
                      : isOrange
                      ? textSettings.orangeColor
                      : undefined,
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer border transition-colors ${
                    isBlue || isOrange
                      ? 'text-black border-white/40 shadow-xs'
                      : 'bg-neutral-950 text-neutral-200 border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  {w.text}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Paragraph Font, Weight, Spacing & Colors */}
      <div className="border-t border-neutral-800/80 pt-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Font Family
            </label>
            <select
              value={textSettings.fontFamily}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-sky-400"
            >
              {T2_FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Font Weight
            </label>
            <select
              value={textSettings.fontWeight}
              onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-sky-400"
            >
              <option value={400}>400 · Regular</option>
              <option value={500}>500 · Medium</option>
              <option value={600}>600 · Semi-Bold</option>
              <option value={700}>700 · Bold (Reference)</option>
              <option value={800}>800 · Extra Bold</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Text Alignment
            </label>
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
              {(['left', 'center', 'right'] as const).map((al) => (
                <button
                  key={al}
                  type="button"
                  onClick={() => onChange({ textAlign: al })}
                  className={`flex-1 py-1 text-xs rounded flex items-center justify-center cursor-pointer ${
                    textSettings.textAlign === al
                      ? 'bg-neutral-800 text-sky-400 font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {al === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                  {al === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                  {al === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-400">Paragraph Font Size</span>
              <span className="text-neutral-200 font-mono">{textSettings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={20}
              max={56}
              value={textSettings.fontSize}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-400">Line Spacing</span>
              <span className="text-neutral-200 font-mono">{textSettings.lineHeight}x</span>
            </div>
            <input
              type="range"
              min={1.05}
              max={1.75}
              step={0.03}
              value={textSettings.lineHeight}
              onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center justify-between bg-neutral-950 px-2.5 py-1.5 rounded-lg border border-neutral-800">
            <span className="text-[11px] text-neutral-300">Main White</span>
            <input
              type="color"
              value={textSettings.textColor}
              onChange={(e) => onChange({ textColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
          </div>

          <div className="flex items-center justify-between bg-neutral-950 px-2.5 py-1.5 rounded-lg border border-neutral-800">
            <span className="text-[11px] text-amber-300">Orange/Yellow</span>
            <input
              type="color"
              value={textSettings.orangeColor}
              onChange={(e) => onChange({ orangeColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
          </div>

          <div className="flex items-center justify-between bg-neutral-950 px-2.5 py-1.5 rounded-lg border border-neutral-800">
            <span className="text-[11px] text-sky-300">Blue Phrase</span>
            <input
              type="color"
              value={textSettings.blueColor}
              onChange={(e) => onChange({ blueColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
          </div>
        </div>
      </div>

      {/* Next Step CTA */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onNext}
          className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <span>Continue to Add Media (Lower Footage & 3 Images)</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
};
