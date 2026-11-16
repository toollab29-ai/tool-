import React, { useRef, useState } from 'react';
import {
  BackgroundFitMode,
  Template2Settings,
  Template2BrandingSettings,
  Template2PanelSettings,
  Template2TextSettings,
  Template2AccentSettings,
  Template2LowerMediaSettings,
} from '../types';
import {
  Upload,
  Trash2,
  Layout,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCcw,
  ShieldAlert,
  Image as ImageIcon,
  Palette,
  Minus,
  Layers,
} from 'lucide-react';

interface Template2SettingsTabProps {
  settings: Template2Settings;
  onUpdateBranding: (updated: Partial<Template2BrandingSettings>) => void;
  onUpdatePanel: (updated: Partial<Template2PanelSettings>) => void;
  onUpdateText: (updated: Partial<Template2TextSettings>) => void;
  onUpdateAccents: (updated: Partial<Template2AccentSettings>) => void;
  onUpdateLowerMedia: (updated: Partial<Template2LowerMediaSettings>) => void;
  onRestoreDefaults: () => void;
  onNextToSound: () => void;
  lastSavedAt: string | null;
}

const T2_FONTS = [
  { value: 'Inter', label: 'Inter (Clean Documentary)' },
  { value: 'Montserrat', label: 'Montserrat (Heavy Geometric)' },
  { value: 'Roboto', label: 'Roboto (News Editorial)' },
  { value: 'Oswald', label: 'Oswald (Broadcast Condensed)' },
  { value: 'Georgia', label: 'Georgia (Serif)' },
  { value: 'monospace', label: 'Monospace' },
];

export const Template2SettingsTab: React.FC<Template2SettingsTabProps> = ({
  settings,
  onUpdateBranding,
  onUpdatePanel,
  onUpdateText,
  onUpdateAccents,
  onUpdateLowerMedia,
  onRestoreDefaults,
  onNextToSound,
  lastSavedAt,
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const { branding, panel, text, accents, lowerMedia } = settings;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);

    if (!file.type.startsWith('image/')) {
      setLogoError('Please select a PNG, JPG, SVG, or WEBP logo image.');
      return;
    }

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

  return (
    <div className="space-y-6">
      {/* Auto-Save Banner + Restore Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-950/80 border border-sky-900/40 rounded-xl p-3.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-neutral-200 font-medium">
            Template 2 Settings Saved Separately
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
          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
          <span>Restore Template 2 Defaults</span>
        </button>
      </div>

      {/* SECTION 1: TOP-CENTER CHANNEL BRANDING */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              1. Template 2 Top-Center Branding
            </h3>
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={branding.showBranding}
              onChange={(e) => onUpdateBranding({ showBranding: e.target.checked })}
              className="accent-sky-500 w-4 h-4 cursor-pointer"
            />
            <span>Show header</span>
          </label>
        </div>

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
                className="w-full border-2 border-dashed border-neutral-700 hover:border-sky-400/70 bg-neutral-900/60 hover:bg-neutral-900 rounded-xl p-4 text-center transition-colors cursor-pointer"
              >
                <ImageIcon className="w-6 h-6 text-sky-400 mx-auto mb-1.5" />
                <div className="text-xs font-semibold text-neutral-200">
                  Upload Circular Logo
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Saved independently for Template 2
                </div>
              </button>
            ) : (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex items-center gap-3">
                <div
                  className={`w-14 h-14 bg-black border border-neutral-700 flex items-center justify-center overflow-hidden shrink-0 ${
                    branding.logoShape === 'circle'
                      ? 'rounded-full'
                      : branding.logoShape === 'rounded'
                      ? 'rounded-lg'
                      : 'rounded-none'
                  }`}
                >
                  <img
                    src={branding.logoDataUrl}
                    alt="Template 2 Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-xs font-medium text-neutral-200 truncate">
                    {branding.logoName || 'Template 2 Logo'}
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

          <div className="sm:col-span-7 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={branding.channelName}
                  onChange={(e) => onUpdateBranding({ channelName: e.target.value })}
                  placeholder="24 SKY ALERT"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Subtitle / Handle (optional)
                </label>
                <input
                  type="text"
                  value={branding.subtitle}
                  onChange={(e) => onUpdateBranding({ subtitle: e.target.value })}
                  placeholder="@24SkyAlert"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">
                  Logo Shape
                </label>
                <select
                  value={branding.logoShape}
                  onChange={(e) =>
                    onUpdateBranding({
                      logoShape: e.target.value as Template2BrandingSettings['logoShape'],
                    })
                  }
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-[11px] text-neutral-200"
                >
                  <option value="circle">Circle (Ref)</option>
                  <option value="rounded">Rounded</option>
                  <option value="square">Square</option>
                </select>
              </div>

              <div className="flex items-center justify-between bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 mt-4">
                <span className="text-[10px] text-neutral-300">Name</span>
                <input
                  type="color"
                  value={branding.channelNameColor}
                  onChange={(e) =>
                    onUpdateBranding({ channelNameColor: e.target.value })
                  }
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
              </div>

              <div className="flex items-center justify-between bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 mt-4">
                <span className="text-[10px] text-neutral-300">Handle</span>
                <input
                  type="color"
                  value={branding.subtitleColor}
                  onChange={(e) => onUpdateBranding({ subtitleColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-neutral-800/80">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Logo Size</span>
              <span className="text-neutral-200 font-mono">{branding.logoSize}px</span>
            </div>
            <input
              type="range"
              min={36}
              max={130}
              value={branding.logoSize}
              onChange={(e) => onUpdateBranding({ logoSize: Number(e.target.value) })}
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Name Size</span>
              <span className="text-neutral-200 font-mono">{branding.channelNameSize}px</span>
            </div>
            <input
              type="range"
              min={20}
              max={56}
              value={branding.channelNameSize}
              onChange={(e) =>
                onUpdateBranding({ channelNameSize: Number(e.target.value) })
              }
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Subtitle Size</span>
              <span className="text-neutral-200 font-mono">{branding.subtitleSize}px</span>
            </div>
            <input
              type="range"
              min={14}
              max={38}
              value={branding.subtitleSize}
              onChange={(e) =>
                onUpdateBranding({ subtitleSize: Number(e.target.value) })
              }
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Gap Below</span>
              <span className="text-neutral-200 font-mono">{branding.headerMarginBottom}px</span>
            </div>
            <input
              type="range"
              min={8}
              max={56}
              value={branding.headerMarginBottom}
              onChange={(e) =>
                onUpdateBranding({ headerMarginBottom: Number(e.target.value) })
              }
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: UPPER BLACK PANEL SIZE, GROUP SCALE, CORNERS & POSITION */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layout className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              2. Upper Black Panel Size, Scale & Position
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdatePanel({ posX: 0, posY: 0 })}
              className="px-2 py-1 text-[10px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset Pos</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdatePanel({ panelScale: 1.0 })}
              className="px-2 py-1 text-[10px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset Scale</span>
            </button>
          </div>
        </div>

        {/* Complete Panel Group Scale */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-lg p-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-sky-300 font-semibold">
              Panel Group Scale (Logo + Channel + Text Together)
            </span>
            <span className="text-sky-300 font-mono font-bold">
              {Math.round((panel.panelScale ?? 1.0) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.4}
            max={2.0}
            step={0.02}
            value={panel.panelScale ?? 1.0}
            onChange={(e) =>
              onUpdatePanel({ panelScale: Number(e.target.value) })
            }
            className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Panel Width</span>
              <span className="text-neutral-200 font-mono">{panel.widthPercent}%</span>
            </div>
            <input
              type="range"
              min={70}
              max={100}
              value={panel.widthPercent}
              onChange={(e) =>
                onUpdatePanel({ widthPercent: Number(e.target.value) })
              }
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Panel Height</span>
              <span className="text-neutral-200 font-mono">{panel.heightPercent}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={66}
              value={panel.heightPercent}
              onChange={(e) =>
                onUpdatePanel({ heightPercent: Number(e.target.value) })
              }
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Position X</span>
              <span className="text-neutral-200 font-mono">{panel.posX}</span>
            </div>
            <input
              type="range"
              min={-45}
              max={45}
              value={panel.posX}
              onChange={(e) => onUpdatePanel({ posX: Number(e.target.value) })}
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Position Y</span>
              <span className="text-neutral-200 font-mono">{panel.posY}</span>
            </div>
            <input
              type="range"
              min={-35}
              max={45}
              value={panel.posY}
              onChange={(e) => onUpdatePanel({ posY: Number(e.target.value) })}
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
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
              max={48}
              value={panel.borderRadius}
              onChange={(e) =>
                onUpdatePanel({ borderRadius: Number(e.target.value) })
              }
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Text Pad X</span>
              <span className="text-neutral-200 font-mono">{panel.paddingX}px</span>
            </div>
            <input
              type="range"
              min={16}
              max={72}
              value={panel.paddingX}
              onChange={(e) => onUpdatePanel({ paddingX: Number(e.target.value) })}
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Text Pad Y</span>
              <span className="text-neutral-200 font-mono">{panel.paddingY}px</span>
            </div>
            <input
              type="range"
              min={14}
              max={64}
              value={panel.paddingY}
              onChange={(e) => onUpdatePanel({ paddingY: Number(e.target.value) })}
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
            <span className="text-[11px] text-neutral-300">Panel Bg</span>
            <input
              type="color"
              value={panel.backgroundColor}
              onChange={(e) =>
                onUpdatePanel({ backgroundColor: e.target.value })
              }
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: PARAGRAPH TYPOGRAPHY & HIGHLIGHT COLORS */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              3. Paragraph Typography & Highlight Colors
            </h3>
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={text.autoFitText !== false}
              onChange={(e) => onUpdateText({ autoFitText: e.target.checked })}
              className="accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Auto-fit Long Text</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              Font Family
            </label>
            <select
              value={text.fontFamily}
              onChange={(e) => onUpdateText({ fontFamily: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs text-neutral-200"
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
              value={text.fontWeight}
              onChange={(e) => onUpdateText({ fontWeight: Number(e.target.value) })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs text-neutral-200"
            >
              <option value={400}>400 · Regular</option>
              <option value={500}>500 · Medium</option>
              <option value={600}>600 · Semi-Bold</option>
              <option value={700}>700 · Bold</option>
              <option value={800}>800 · Extra Bold</option>
            </select>
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
                  onClick={() => onUpdateText({ textAlign: al })}
                  className={`flex-1 py-1 text-[11px] rounded flex items-center justify-center cursor-pointer ${
                    text.textAlign === al
                      ? 'bg-neutral-700 text-sky-300 font-semibold'
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Text Size</span>
              <span className="text-neutral-200 font-mono">{text.fontSize}px</span>
            </div>
            <input
              type="range"
              min={20}
              max={56}
              value={text.fontSize}
              onChange={(e) => onUpdateText({ fontSize: Number(e.target.value) })}
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Line Spacing</span>
              <span className="text-neutral-200 font-mono">{text.lineHeight}x</span>
            </div>
            <input
              type="range"
              min={1.05}
              max={1.75}
              step={0.03}
              value={text.lineHeight}
              onChange={(e) => onUpdateText({ lineHeight: Number(e.target.value) })}
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Text Pos X</span>
              <span className="text-neutral-200 font-mono">{text.textOffsetX}px</span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={text.textOffsetX}
              onChange={(e) => onUpdateText({ textOffsetX: Number(e.target.value) })}
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Text Pos Y</span>
              <span className="text-neutral-200 font-mono">{text.textOffsetY}px</span>
            </div>
            <input
              type="range"
              min={-50}
              max={60}
              value={text.textOffsetY}
              onChange={(e) => onUpdateText({ textOffsetY: Number(e.target.value) })}
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex items-center justify-between bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
            <span className="text-[11px] text-neutral-300">Main White</span>
            <input
              type="color"
              value={text.textColor}
              onChange={(e) => onUpdateText({ textColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
          </div>

          <div className="flex items-center justify-between bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
            <span className="text-[11px] text-amber-300">Orange / Yellow</span>
            <input
              type="color"
              value={text.orangeColor}
              onChange={(e) => onUpdateText({ orangeColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
          </div>

          <div className="flex items-center justify-between bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
            <span className="text-[11px] text-sky-300">Blue Phrase</span>
            <input
              type="color"
              value={text.blueColor}
              onChange={(e) => onUpdateText({ blueColor: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
          </div>
        </div>
      </div>

      {/* SECTION 4: DIVIDER & BOTTOM EDGE ACCENT */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Minus className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            4. Horizontal Divider & Bottom Edge Accent
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Middle Blue Divider */}
          <div className="p-3 rounded-lg bg-neutral-900/70 border border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-200">
                Middle Horizontal Divider
              </span>
              <label className="flex items-center gap-1.5 text-[11px] text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accents.dividerEnabled}
                  onChange={(e) =>
                    onUpdateAccents({ dividerEnabled: e.target.checked })
                  }
                  className="accent-sky-400 w-3.5 h-3.5 cursor-pointer"
                />
                <span>{accents.dividerEnabled ? 'On' : 'Off'}</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-neutral-400">Color</span>
                <input
                  type="color"
                  value={accents.dividerColor}
                  onChange={(e) =>
                    onUpdateAccents({ dividerColor: e.target.value })
                  }
                  disabled={!accents.dividerEnabled}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 disabled:opacity-40"
                />
              </div>

              <div className="flex-1">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-neutral-400">Thickness</span>
                  <span className="text-neutral-200 font-mono">
                    {accents.dividerHeight}px
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={accents.dividerHeight}
                  disabled={!accents.dividerEnabled}
                  onChange={(e) =>
                    onUpdateAccents({ dividerHeight: Number(e.target.value) })
                  }
                  className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
                />
              </div>
            </div>
          </div>

          {/* Bottom Edge Accent */}
          <div className="p-3 rounded-lg bg-neutral-900/70 border border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-200">
                Bottom Edge Accent Strip
              </span>
              <label className="flex items-center gap-1.5 text-[11px] text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accents.bottomAccentEnabled}
                  onChange={(e) =>
                    onUpdateAccents({ bottomAccentEnabled: e.target.checked })
                  }
                  className="accent-sky-400 w-3.5 h-3.5 cursor-pointer"
                />
                <span>{accents.bottomAccentEnabled ? 'On' : 'Off'}</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-neutral-400">Color</span>
                <input
                  type="color"
                  value={accents.bottomAccentColor}
                  onChange={(e) =>
                    onUpdateAccents({ bottomAccentColor: e.target.value })
                  }
                  disabled={!accents.bottomAccentEnabled}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 disabled:opacity-40"
                />
              </div>

              <div className="flex-1">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-neutral-400">Thickness</span>
                  <span className="text-neutral-200 font-mono">
                    {accents.bottomAccentHeight}px
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={28}
                  value={accents.bottomAccentHeight}
                  disabled={!accents.bottomAccentEnabled}
                  onChange={(e) =>
                    onUpdateAccents({
                      bottomAccentHeight: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: LOWER FOOTAGE AREA SIZE & POSITIONING */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              5. Lower Footage Area (~50%) & Fit
            </h3>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateLowerMedia({
                heightPercent: 50,
                offsetY: 0,
                bgFitMode: 'fill',
                bgScale: 1.0,
                bgMoveX: 0,
                bgMoveY: 0,
              })
            }
            className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Lower Zone</span>
          </button>
        </div>

        {/* Background Fit Mode */}
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'fill', label: 'Bg Fill' },
              { id: 'fit', label: 'Bg Fit' },
              { id: 'custom', label: 'Bg Custom' },
            ] as { id: BackgroundFitMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onUpdateLowerMedia({ bgFitMode: m.id })}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                (lowerMedia.bgFitMode || 'fill') === m.id
                  ? 'bg-sky-500/20 text-sky-300 border-sky-400'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Lower Area Size</span>
              <span className="text-neutral-200 font-mono">{lowerMedia.heightPercent}%</span>
            </div>
            <input
              type="range"
              min={35}
              max={70}
              value={lowerMedia.heightPercent}
              onChange={(e) =>
                onUpdateLowerMedia({ heightPercent: Number(e.target.value) })
              }
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Lower Offset Y</span>
              <span className="text-neutral-200 font-mono">{lowerMedia.offsetY}</span>
            </div>
            <input
              type="range"
              min={-25}
              max={25}
              value={lowerMedia.offsetY}
              onChange={(e) =>
                onUpdateLowerMedia({ offsetY: Number(e.target.value) })
              }
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-neutral-400">Bg Footage Zoom</span>
              <span className="text-neutral-200 font-mono">{lowerMedia.bgScale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.25}
              max={4.0}
              step={0.05}
              value={lowerMedia.bgScale}
              onChange={(e) =>
                onUpdateLowerMedia({ bgScale: Number(e.target.value) })
              }
              className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">
              3-Image Fit
            </label>
            <select
              value={lowerMedia.slotBaseFill}
              onChange={(e) =>
                onUpdateLowerMedia({
                  slotBaseFill: e.target.value as 'cover' | 'contain',
                })
              }
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-[11px] text-neutral-200"
            >
              <option value="cover">Fill Lower Area (No Gaps)</option>
              <option value="contain">Fit Whole Image</option>
            </select>
          </div>
        </div>
      </div>

      {/* Continue CTA */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onNextToSound}
          className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <span>Continue to Background Sound</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
};
