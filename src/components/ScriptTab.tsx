import React, { useState } from 'react';
import { BulletItem, ScriptSettings } from '../types';
import {
  bulletsToRawScript,
  findNumericWordIndices,
  parseScriptToBullets,
} from '../utils/scriptParser';
import {
  Type,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Highlighter,
  AlignLeft,
  AlignCenter,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface ScriptTabProps {
  script: ScriptSettings;
  onChange: (updated: Partial<ScriptSettings>) => void;
  onNext: () => void;
  onLoadPreset: (presetId: string) => void;
  autoFitInfo?: {
    usedFontSize: number;
    requestedFontSize: number;
    wasAutoFitted: boolean;
    overflowWarning: boolean;
  };
}

export const ScriptTab: React.FC<ScriptTabProps> = ({
  script,
  onChange,
  onNext,
  onLoadPreset,
  autoFitInfo,
}) => {
  const [expandedBulletId, setExpandedBulletId] = useState<string | null>(null);

  const bullets: BulletItem[] =
    script.bullets && script.bullets.length > 0
      ? script.bullets
      : parseScriptToBullets(script.text);

  const wordCount = script.text.trim().split(/\s+/).filter(Boolean).length;

  const handleRawScriptChange = (newRaw: string) => {
    const parsedBullets = parseScriptToBullets(newRaw, bullets);
    onChange({
      text: newRaw,
      bullets: parsedBullets,
    });
  };

  const handleUpdateBullet = (idx: number, patch: Partial<BulletItem>) => {
    const nextBullets = bullets.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    onChange({
      bullets: nextBullets,
      text: bulletsToRawScript(nextBullets),
    });
  };

  const handleAddBullet = () => {
    const newBullet: BulletItem = {
      id: `bullet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: 'New weather update bullet point.',
      colorMode: 'auto',
      highlightedWords: [],
      emergencyWords: [],
    };
    const nextBullets = [...bullets, newBullet];
    onChange({
      bullets: nextBullets,
      text: bulletsToRawScript(nextBullets),
    });
    setExpandedBulletId(newBullet.id);
  };

  const handleDeleteBullet = (idx: number) => {
    const nextBullets = bullets.filter((_, i) => i !== idx);
    onChange({
      bullets: nextBullets,
      text: bulletsToRawScript(nextBullets),
    });
  };

  const handleMoveBullet = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= bullets.length) return;
    const nextBullets = [...bullets];
    const [moved] = nextBullets.splice(idx, 1);
    nextBullets.splice(targetIdx, 0, moved);
    onChange({
      bullets: nextBullets,
      text: bulletsToRawScript(nextBullets),
    });
  };

  const handleCycleWordHighlight = (bulletIdx: number, wordIdx: number) => {
    const bullet = bullets[bulletIdx];
    const yellowSet = new Set(bullet.highlightedWords || []);
    const redSet = new Set(bullet.emergencyWords || []);

    if (!yellowSet.has(wordIdx) && !redSet.has(wordIdx)) {
      // Normal -> Yellow highlight
      yellowSet.add(wordIdx);
    } else if (yellowSet.has(wordIdx)) {
      // Yellow -> Red emergency accent
      yellowSet.delete(wordIdx);
      redSet.add(wordIdx);
    } else {
      // Red -> Normal
      redSet.delete(wordIdx);
    }

    handleUpdateBullet(bulletIdx, {
      highlightedWords: Array.from(yellowSet).sort((a, b) => a - b),
      emergencyWords: Array.from(redSet).sort((a, b) => a - b),
    });
  };

  const handleHighlightAllNumbers = () => {
    const nextBullets = bullets.map((b) => {
      const numericIndices = findNumericWordIndices(b.text);
      const merged = Array.from(
        new Set([...(b.highlightedWords || []), ...numericIndices])
      ).sort((a, b) => a - b);
      return { ...b, highlightedWords: merged };
    });
    onChange({
      bullets: nextBullets,
    });
  };

  const handleClearAllHighlights = () => {
    const nextBullets = bullets.map((b) => ({
      ...b,
      highlightedWords: [],
      emergencyWords: [],
      colorMode: 'auto' as const,
    }));
    onChange({ bullets: nextBullets });
  };

  return (
    <div className="space-y-5">
      {/* Sample Weather Templates */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-neutral-300">
            Sample Weather Bulletin Templates:
          </label>
          <span className="text-[11px] text-neutral-400">
            Replace with your verified script below
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onLoadPreset('preset-severe-storm')}
            className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-800/80 hover:border-neutral-700 text-left transition-colors cursor-pointer group"
          >
            <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-400">
              🌪️ Severe Storm
            </div>
            <div className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
              Tornado warnings & wind gusts...
            </div>
          </button>

          <button
            type="button"
            onClick={() => onLoadPreset('preset-flash-flood')}
            className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-800/80 hover:border-neutral-700 text-left transition-colors cursor-pointer group"
          >
            <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-400">
              🌊 Flash Flood
            </div>
            <div className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
              Rainfall totals & road closures...
            </div>
          </button>

          <button
            type="button"
            onClick={() => onLoadPreset('preset-hurricane-surge')}
            className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-800/80 hover:border-neutral-700 text-left transition-colors cursor-pointer group"
          >
            <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-400">
              🌀 Hurricane Surge
            </div>
            <div className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
              Peak winds & coastal surge...
            </div>
          </button>
        </div>
      </div>

      {/* Paste Weather Script Area */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-amber-400" />
            Paste Your Weather Script (Auto-Detects Bullet Points)
          </label>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400 font-mono tabular-nums">
              {bullets.length} bullets · {wordCount} words
            </span>
          </div>
        </div>

        <textarea
          rows={6}
          value={script.text}
          onChange={(e) => handleRawScriptChange(e.target.value)}
          placeholder={`Paste your completed weather script here (one bullet per line, with or without • or -):\n• Main weather event\n• Verified numbers & wind speeds\n• Affected locations & impacts`}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition-colors resize-y leading-relaxed"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleHighlightAllNumbers}
              className="px-2.5 py-1 text-[11px] font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Highlight numbers & measurements in yellow without changing any text"
            >
              <Highlighter className="w-3 h-3" />
              <span>Highlight Numbers in Yellow</span>
            </button>

            <button
              type="button"
              onClick={handleClearAllHighlights}
              className="px-2.5 py-1 text-[11px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 rounded-md cursor-pointer transition-colors"
            >
              Reset Highlights
            </button>
          </div>

          {autoFitInfo && (
            <div className="text-[11px] flex items-center gap-1">
              {autoFitInfo.overflowWarning ? (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Enable Auto-fit or increase panel height to fit all text</span>
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
                  Original wording preserved · Fits panel cleanly
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Individual Bullet Editor + Word-Level Highlighting */}
      <div className="border-t border-neutral-800/80 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-neutral-200">
              Formatted Bullet Points ({bullets.length})
            </h4>
            <p className="text-[11px] text-neutral-400">
              Change individual bullet colors or click "Highlight Words" to mark key terms in yellow/red.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddBullet}
            className="px-2.5 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add Bullet</span>
          </button>
        </div>

        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
          {bullets.map((bullet, idx) => {
            const words = bullet.text.split(/\s+/).filter(Boolean);
            const isExpanded = expandedBulletId === bullet.id;

            return (
              <div
                key={bullet.id}
                className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-3 space-y-2.5"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400 mt-1.5 shrink-0 w-5">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={bullet.text}
                    onChange={(e) =>
                      handleUpdateBullet(idx, { text: e.target.value })
                    }
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveBullet(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveBullet(idx, 1)}
                      disabled={idx === bullets.length - 1}
                      className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBullet(idx)}
                      className="p-1 text-neutral-400 hover:text-rose-400 cursor-pointer"
                      title="Remove bullet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Per-Bullet Color & Word Highlight Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 pl-7">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-neutral-500 mr-1">Color:</span>
                    {(
                      [
                        { id: 'auto', label: 'Auto' },
                        { id: 'white', label: 'White' },
                        { id: 'yellow', label: 'Yellow' },
                        { id: 'red', label: 'Red Alert' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleUpdateBullet(idx, { colorMode: opt.id })}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded border cursor-pointer transition-colors ${
                          bullet.colorMode === opt.id
                            ? opt.id === 'yellow'
                              ? 'bg-amber-400 text-black border-amber-300'
                              : opt.id === 'red'
                              ? 'bg-red-600 text-white border-red-500'
                              : opt.id === 'white'
                              ? 'bg-white text-black border-white'
                              : 'bg-rose-600 text-white border-rose-500'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBulletId(isExpanded ? null : bullet.id)
                    }
                    className={`px-2 py-0.5 text-[10px] font-medium rounded border flex items-center gap-1 cursor-pointer transition-colors ${
                      isExpanded ||
                      bullet.highlightedWords.length > 0 ||
                      (bullet.emergencyWords?.length || 0) > 0
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>
                      Highlight Words (
                      {bullet.highlightedWords.length +
                        (bullet.emergencyWords?.length || 0)}
                      )
                    </span>
                  </button>
                </div>

                {/* Clickable Word Highlighting Chips */}
                {isExpanded && words.length > 0 && (
                  <div className="ml-7 p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 space-y-1.5">
                    <div className="text-[10px] text-neutral-400">
                      Click any word to cycle:{' '}
                      <span className="text-neutral-200">Normal</span> →{' '}
                      <span className="text-amber-400 font-semibold">Yellow</span> →{' '}
                      <span className="text-red-400 font-semibold">Red Alert</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {words.map((word, wi) => {
                        const isYellow = bullet.highlightedWords.includes(wi);
                        const isRed = (bullet.emergencyWords || []).includes(wi);
                        return (
                          <button
                            key={`${word}-${wi}`}
                            type="button"
                            onClick={() => handleCycleWordHighlight(idx, wi)}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer border transition-colors ${
                              isRed
                                ? 'bg-red-600 text-white border-red-400 font-bold'
                                : isYellow
                                ? 'bg-amber-400 text-black border-amber-300 font-bold'
                                : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-600'
                            }`}
                          >
                            {word}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Text Size & Alignment Controls */}
      <div className="border-t border-neutral-800/80 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-neutral-400">Bullet Font Size</span>
            <span className="text-neutral-200 font-mono tabular-nums">
              {script.fontSize}px
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={54}
            value={script.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-neutral-400">Line Spacing</span>
            <span className="text-neutral-200 font-mono tabular-nums">
              {script.lineHeight}x
            </span>
          </div>
          <input
            type="range"
            min={1.15}
            max={1.75}
            step={0.05}
            value={script.lineHeight}
            onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
            className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="text-[11px] text-neutral-400 block mb-1">
            Bullet Alignment
          </label>
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              type="button"
              onClick={() => onChange({ textAlign: 'left' })}
              className={`flex-1 py-1 text-xs font-medium rounded flex items-center justify-center gap-1 cursor-pointer ${
                script.textAlign === 'left'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>Left</span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ textAlign: 'center' })}
              className={`flex-1 py-1 text-xs font-medium rounded flex items-center justify-center gap-1 cursor-pointer ${
                script.textAlign === 'center'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <AlignCenter className="w-3.5 h-3.5" />
              <span>Center</span>
            </button>
          </div>
        </div>
      </div>

      {/* Next Step CTA */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onNext}
          className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-rose-950"
        >
          <span>Continue to Add Media (Weather Footage)</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
};
