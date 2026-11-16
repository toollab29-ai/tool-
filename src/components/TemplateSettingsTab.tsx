import React, { useRef, useState } from 'react';
import {
  BrandingSettings,
  HeadingSettings,
  PanelSettings,
  ScriptSettings,
} from '../types';
import {
  Upload,
  Trash2,
  Type,
  Layout,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCcw,
  ShieldAlert,
  Image as ImageIcon,
  Palette,
} from 'lucide-react';

interface TemplateSettingsTabProps {
  branding: BrandingSettings;
  heading: HeadingSettings;
  panel: PanelSettings;
  script: ScriptSettings;
  onUpdateBranding: (updated: Partial<BrandingSettings>) => void;
  onUpdateHeading: (updated: Partial<HeadingSettings>) => void;
  onUpdatePanel: (updated: Partial<PanelSettings>) => void;
  onUpdateScript: (updated: Partial<ScriptSettings>) => void;
  onRestoreDefaults: () => void;
  onNextToSound: () => void;
  lastSavedAt: string | null;
}

const HEADING_FONTS = [
  { value: 'Anton', label: 'Anton (Bold Display — Recommended)' },
  { value: 'Bebas Neue', label: 'Bebas Neue (Tall Condensed)' },
  { value: 'Oswald', label: 'Oswald (Broadcast Condensed)' },
  { value: 'Montserrat', label: 'Montserrat (Heavy Geometric)' },
  { value: 'Inter', label: 'Inter (Clean Sans-Serif)' },
  { value: 'Georgia', label: 'Georgia (Editorial Serif)' },
  { value: 'monospace', label: 'Monospace (Alert Ticker)' },
];

const BULLET_FONTS = [
  { value: 'Inter', label: 'Inter (Clean Sans-Serif — Recommended)' },
  { value: 'Roboto', label: 'Roboto (News Readable)' },
  { value: 'Montserrat', label: 'Montserrat (Modern Bold)' },
  { value: 'Oswald', label: 'Oswald (Condensed)' },
  { value: 'Georgia', label: 'Georgia (Serif)' },
  { value: 'monospace', label: 'Monospace' },
];

export const TemplateSettingsTab: React.FC<TemplateSettingsTabProps> = ({
  branding,
  heading,
  panel,
  script,
  onUpdateBranding,
  onUpdateHeading,
  onUpdatePanel,
  onUpdateScript,
  onRestoreDefaults,
  onNextToSound,
  lastSavedAt,
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);

    if (!file.type.startsWith('image/')) {
      setLogoError('Please select a PNG, JPG, SVG, or WEBP logo image.');
      return;
    }

    // Read as DataURL so logo persists cleanly in localStorage across reloads
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateBranding({
          logoDataUrl: reader.result,
          logoName: file.name,
          showBranding: true,
        });
      }
    };
    reader.onerror = () => {
      setLogoError('Failed to read the logo file. Please try another image.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const headingWords = (heading.uppercase ? heading.text.toUpperCase() : heading.text)
    .split(/\s+/)
    .filter(Boolean);

  const toggleHeadingWordHighlight = (idx: number) => {
    const current = new Set(heading.highlightedWordIndices || []);
    if (current.has(idx)) {
      current.delete(idx);
    } else {
      current.add(idx);
    }
    onUpdateHeading({ highlightedWordIndices: Array.from(current).sort((a, b) => a - b) });
  };

  return (
    <div className="space-y-6">
      {/* Saved Locally Banner + Restore Default Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-950/80 border border-neutral-800 rounded-xl p-3.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-neutral-200 font-medium">
            Template & Branding Auto-Saved Locally
          </span>
          {lastSavedAt && (
            <span className="text-[11px] text-neutral-500 font-mono">
              ({lastSavedAt})
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRestoreDefaults}
          className="px-3 py-1.5 text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span>Restore Default 24 SKY ALERT Template</span>
        </button>
      </div>

      {/* SECTION 1: MY CHANNEL BRANDING */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              1. Channel Branding (24 SKY ALERT)
            </h3>
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={branding.showBranding}
              onChange={(e) => onUpdateBranding({ showBranding: e.target.checked })}
              className="accent-rose-600 w-4 h-4 cursor-pointer"
            />
            <span>Show in video</span>
          </label>
        </div>

        {/* Logo Upload / Preview / Replace / Remove */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div className="sm:col-span-5">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />

            {!branding.logoDataUrl ? (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-neutral-700 hover:border-amber-400/70 bg-neutral-900/60 hover:bg-neutral-900 rounded-xl p-4 text-center transition-colors cursor-pointer"
              >
                <ImageIcon className="w-6 h-6 text-amber-400 mx-auto mb-1.5" />
                <div className="text-xs font-semibold text-neutral-200">
                  Upload Channel Logo
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  PNG, SVG, JPG (saved locally)
                </div>
              </button>
            ) : (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg bg-black border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={branding.logoDataUrl}
                    alt="Channel logo"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-xs font-medium text-neutral-200 truncate">
                    {branding.logoName || 'Channel Logo'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="px-2 py-1 text-[11px] font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBranding({ logoDataUrl: null, logoName: '' })
                      }
                      className="px-2 py-1 text-[11px] font-medium bg-neutral-800 hover:bg-rose-950 text-rose-400 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            {logoError && (
              <div className="text-[11px] text-rose-400 mt-1">{logoError}</div>
            )}
          </div>

          <div className="sm:col-span-7 space-y-3">
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">
                Channel Name (beside logo)
              </label>
              <input
                type="text"
                value={branding.channelName}
                onChange={(e) => onUpdateBranding({ channelName: e.target.value })}
                placeholder="24 SKY ALERT"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Header Alignment
                </label>
                <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                  {(['left', 'center', 'right'] as const).map((al) => (
                    <button
                      key={al}
                      type="button"
                      onClick={() => onUpdateBranding({ headerAlign: al })}
                      className={`flex-1 py-1 text-[11px] rounded flex items-center justify-center cursor-pointer ${
                        branding.headerAlign === al
                          ? 'bg-neutral-700 text-white font-semibold'
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

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Logo Frame Shape
                </label>
                <select
                  value={branding.logoShape}
                  onChange={(e) =>
                    onUpdateBranding({
                      logoShape: e.target.value as BrandingSettings['logoShape'],
                    })
                  }
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="rounded">Rounded</option>
                  <option value="circle">Circle</option>
                  <option value="square">Square</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Logo & Channel Name Size / Position */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-neutral-800/80">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Logo Size</span>
              <span className="text-neutral-200 font-mono">{branding.logoSize}px</span>
            </div>
            <input
              type="range"
              min={28}
              max={150}
              value={branding.logoSize}
              onChange={(e) => onUpdateBranding({ logoSize: Number(e.target.value) })}
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Name Size</span>
              <span className="text-neutral-200 font-mono">{branding.channelNameSize}px</span>
            </div>
            <input
              type="range"
              min={18}
              max={64}
              value={branding.channelNameSize}
              onChange={(e) =>
                onUpdateBranding({ channelNameSize: Number(e.target.value) })
              }
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Logo Offset X</span>
              <span className="text-neutral-200 font-mono">{branding.logoOffsetX}px</span>
            </div>
            <input
              type="range"
              min={-160}
              max={160}
              value={branding.logoOffsetX}
              onChange={(e) =>
                onUpdateBranding({ logoOffsetX: Number(e.target.value) })
              }
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Logo Offset Y</span>
              <span className="text-neutral-200 font-mono">{branding.logoOffsetY}px</span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              value={branding.logoOffsetY}
              onChange={(e) =>
                onUpdateBranding({ logoOffsetY: Number(e.target.value) })
              }
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Channel Name X</span>
              <span className="text-neutral-200 font-mono">{branding.channelNameOffsetX}px</span>
            </div>
            <input
              type="range"
              min={-160}
              max={160}
              value={branding.channelNameOffsetX}
              onChange={(e) =>
                onUpdateBranding({ channelNameOffsetX: Number(e.target.value) })
              }
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Channel Name Y</span>
              <span className="text-neutral-200 font-mono">{branding.channelNameOffsetY}px</span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              value={branding.channelNameOffsetY}
              onChange={(e) =>
                onUpdateBranding({ channelNameOffsetY: Number(e.target.value) })
              }
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
            <span className="text-[11px] text-neutral-300">Channel Name Color</span>
            <input
              type="color"
              value={branding.channelNameColor}
              onChange={(e) =>
                onUpdateBranding({ channelNameColor: e.target.value })
              }
              className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: EDITABLE "DID YOU KNOW?" HEADING */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              2. Editable Heading ("DID YOU KNOW?")
            </h3>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={heading.uppercase}
              onChange={(e) => onUpdateHeading({ uppercase: e.target.checked })}
              className="accent-amber-400 w-3.5 h-3.5 cursor-pointer"
            />
            <span>ALL CAPS</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Heading Text
            </label>
            <input
              type="text"
              value={heading.text}
              onChange={(e) => onUpdateHeading({ text: e.target.value })}
              placeholder="DID YOU KNOW?"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Heading Font
            </label>
            <select
              value={heading.fontFamily}
              onChange={(e) => onUpdateHeading({ fontFamily: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-400"
            >
              {HEADING_FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clickable Word Chips for Yellow Highlighting */}
        {headingWords.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-neutral-400">
                Click words below to toggle Yellow highlight:
              </span>
              <span className="text-[10px] text-amber-400 font-medium">
                Highlighted = Yellow · Others = Base Color
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 bg-neutral-900/70 p-2.5 rounded-lg border border-neutral-800">
              {headingWords.map((word, idx) => {
                const isYellow = (heading.highlightedWordIndices || []).includes(idx);
                return (
                  <button
                    key={`${word}-${idx}`}
                    type="button"
                    onClick={() => toggleHeadingWordHighlight(idx)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                      isYellow
                        ? 'bg-amber-400 text-black border-amber-300 shadow-sm'
                        : 'bg-neutral-800 text-white border-neutral-700 hover:border-neutral-500'
                    }`}
                  >
                    {word}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Heading Size</span>
              <span className="text-neutral-200 font-mono">{heading.fontSize}px</span>
            </div>
            <input
              type="range"
              min={36}
              max={132}
              value={heading.fontSize}
              onChange={(e) => onUpdateHeading({ fontSize: Number(e.target.value) })}
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Vertical Pos</span>
              <span className="text-neutral-200 font-mono">{heading.offsetY}px</span>
            </div>
            <input
              type="range"
              min={-60}
              max={80}
              value={heading.offsetY}
              onChange={(e) => onUpdateHeading({ offsetY: Number(e.target.value) })}
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Gap Below</span>
              <span className="text-neutral-200 font-mono">{heading.marginBottom}px</span>
            </div>
            <input
              type="range"
              min={8}
              max={64}
              value={heading.marginBottom}
              onChange={(e) =>
                onUpdateHeading({ marginBottom: Number(e.target.value) })
              }
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Alignment
            </label>
            <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
              {(['left', 'center', 'right'] as const).map((al) => (
                <button
                  key={al}
                  type="button"
                  onClick={() => onUpdateHeading({ align: al })}
                  className={`flex-1 py-1 text-[11px] rounded flex items-center justify-center cursor-pointer ${
                    heading.align === al
                      ? 'bg-neutral-700 text-white font-semibold'
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

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between bg-neutral-900 px-3 py-2 rounded-lg border border-neutral-800">
            <span className="text-xs text-neutral-300">Base Heading Color</span>
            <input
              type="color"
              value={heading.color}
              onChange={(e) => onUpdateHeading({ color: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
            />
          </div>
          <div className="flex items-center justify-between bg-neutral-900 px-3 py-2 rounded-lg border border-neutral-800">
            <span className="text-xs text-neutral-300">Highlight Color (Yellow)</span>
            <input
              type="color"
              value={heading.highlightColor}
              onChange={(e) => onUpdateHeading({ highlightColor: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: BULLET FORMATTING & COLORS */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              3. Bullet Text Formatting & Colors
            </h3>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={script.autoFitText !== false}
              onChange={(e) => onUpdateScript({ autoFitText: e.target.checked })}
              className="accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Auto-fit (Prevent Overflow)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Bullet Color Pattern
            </label>
            <select
              value={script.bulletColorMode}
              onChange={(e) =>
                onUpdateScript({
                  bulletColorMode: e.target.value as ScriptSettings['bulletColorMode'],
                })
              }
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-400"
            >
              <option value="alternating">Alternating White & Yellow</option>
              <option value="white-with-highlights">White + Highlighted Words</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              First Bullet Color
            </label>
            <select
              value={script.alternateStartColor}
              onChange={(e) =>
                onUpdateScript({
                  alternateStartColor: e.target.value as 'white' | 'yellow',
                })
              }
              disabled={script.bulletColorMode !== 'alternating'}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs text-neutral-200 disabled:opacity-50 focus:outline-none focus:border-amber-400"
            >
              <option value="white">Start White → Yellow</option>
              <option value="yellow">Start Yellow → White</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Bullet Font
            </label>
            <select
              value={script.fontFamily}
              onChange={(e) => onUpdateScript({ fontFamily: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-400"
            >
              {BULLET_FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Text Size</span>
              <span className="text-neutral-200 font-mono">{script.fontSize}px</span>
            </div>
            <input
              type="range"
              min={20}
              max={54}
              value={script.fontSize}
              onChange={(e) => onUpdateScript({ fontSize: Number(e.target.value) })}
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Line Spacing</span>
              <span className="text-neutral-200 font-mono">{script.lineHeight}x</span>
            </div>
            <input
              type="range"
              min={1.15}
              max={1.75}
              step={0.05}
              value={script.lineHeight}
              onChange={(e) => onUpdateScript({ lineHeight: Number(e.target.value) })}
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Bullet Gap</span>
              <span className="text-neutral-200 font-mono">{script.bulletSpacing}px</span>
            </div>
            <input
              type="range"
              min={6}
              max={48}
              value={script.bulletSpacing}
              onChange={(e) =>
                onUpdateScript({ bulletSpacing: Number(e.target.value) })
              }
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Bullet Symbol
            </label>
            <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
              {(['•', '▪', '▸', '—'] as const).map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => onUpdateScript({ bulletSymbol: sym })}
                  className={`flex-1 py-1 text-xs rounded cursor-pointer ${
                    script.bulletSymbol === sym
                      ? 'bg-neutral-700 text-amber-400 font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Bullet Text X</span>
              <span className="text-neutral-200 font-mono">{script.textOffsetX}px</span>
            </div>
            <input
              type="range"
              min={-60}
              max={60}
              value={script.textOffsetX}
              onChange={(e) => onUpdateScript({ textOffsetX: Number(e.target.value) })}
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Bullet Text Y</span>
              <span className="text-neutral-200 font-mono">{script.textOffsetY}px</span>
            </div>
            <input
              type="range"
              min={-60}
              max={80}
              value={script.textOffsetY}
              onChange={(e) => onUpdateScript({ textOffsetY: Number(e.target.value) })}
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-800">
            <span className="text-[11px] text-neutral-300">White</span>
            <input
              type="color"
              value={script.textColor}
              onChange={(e) => onUpdateScript({ textColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
          </div>

          <div className="flex items-center justify-between bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-800">
            <span className="text-[11px] text-neutral-300">Yellow</span>
            <input
              type="color"
              value={script.yellowColor}
              onChange={(e) => onUpdateScript({ yellowColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
          </div>
        </div>
      </div>

      {/* SECTION 4: BLACK PANEL DIMENSIONS & POSITION */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layout className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              4. Black Panel Size & Position
            </h3>
          </div>
          <span className="text-[11px] text-neutral-400">
            Drag directly on preview or use sliders
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Panel Width</span>
              <span className="text-neutral-200 font-mono">{panel.widthPercent}%</span>
            </div>
            <input
              type="range"
              min={60}
              max={98}
              value={panel.widthPercent}
              onChange={(e) =>
                onUpdatePanel({ widthPercent: Number(e.target.value) })
              }
              className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Panel Height</span>
              <span className="text-neutral-200 font-mono">{panel.heightPercent}%</span>
            </div>
            <input
              type="range"
              min={28}
              max={90}
              value={panel.heightPercent}
              onChange={(e) =>
                onUpdatePanel({ heightPercent: Number(e.target.value) })
              }
              className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Horizontal (X)</span>
              <span className="text-neutral-200 font-mono">
                {panel.posX > 0 ? `+${panel.posX}` : panel.posX}
              </span>
            </div>
            <input
              type="range"
              min={-45}
              max={45}
              value={panel.posX}
              onChange={(e) => onUpdatePanel({ posX: Number(e.target.value) })}
              className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Vertical (Y)</span>
              <span className="text-neutral-200 font-mono">
                {panel.posY > 0 ? `+${panel.posY}` : panel.posY}
              </span>
            </div>
            <input
              type="range"
              min={-45}
              max={45}
              value={panel.posY}
              onChange={(e) => onUpdatePanel({ posY: Number(e.target.value) })}
              className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Corner Radius</span>
              <span className="text-neutral-200 font-mono">{panel.borderRadius}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={56}
              value={panel.borderRadius}
              onChange={(e) =>
                onUpdatePanel({ borderRadius: Number(e.target.value) })
              }
              className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Panel Opacity</span>
              <span className="text-neutral-200 font-mono">
                {Math.round(panel.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.45}
              max={1.0}
              step={0.02}
              value={panel.opacity}
              onChange={(e) => onUpdatePanel({ opacity: Number(e.target.value) })}
              className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Padding X</span>
              <span className="text-neutral-200 font-mono">{panel.paddingX}px</span>
            </div>
            <input
              type="range"
              min={16}
              max={72}
              value={panel.paddingX}
              onChange={(e) => onUpdatePanel({ paddingX: Number(e.target.value) })}
              className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Padding Y</span>
              <span className="text-neutral-200 font-mono">{panel.paddingY}px</span>
            </div>
            <input
              type="range"
              min={16}
              max={72}
              value={panel.paddingY}
              onChange={(e) => onUpdatePanel({ paddingY: Number(e.target.value) })}
              className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Continue CTA */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onNextToSound}
          className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-rose-950"
        >
          <span>Continue to Background Sound</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
};
