import React, { useMemo, useRef, useState } from 'react';
import {
  AnimationEasing,
  AutoAnimationPreset,
  ImageKeyframe,
  KeyframedTransformTrack,
  TimelineTrackId,
  VideoProject,
} from '../types';
import {
  AUTO_ANIMATION_PRESET_OPTIONS,
  clampKeyframeTimeWithNeighbors,
  clampTrackScale,
  clampZoom,
  evaluateImageTransformAtTime,
  evaluateTrackTransformAtTime,
  findKeyframeNearTime,
  sortKeyframes,
} from '../utils/keyframeAnimation';
import {
  Play,
  Pause,
  RotateCcw,
  Diamond,
  Trash2,
  ZoomIn,
  ZoomOut,
  Plus,
  Sparkles,
  Film,
  Image as ImageIcon,
  Square,
  Type,
  Shield,
} from 'lucide-react';

interface KeyframeTimelineProps {
  project: VideoProject;
  playheadTime: number;
  isPlaying: boolean;
  selectedTrackId: TimelineTrackId;
  autoKeyframesEnabled?: boolean;
  onToggleAutoKeyframes?: () => void;
  onSelectTrack: (trackId: TimelineTrackId) => void;
  onSeekPlayhead: (timeSec: number) => void;
  onTogglePlay: () => void;
  onAddOrUpdateKeyframe: (trackId: TimelineTrackId) => void;
  onMoveKeyframeTime: (trackId: TimelineTrackId, kfId: string, newTimeSec: number) => void;
  onUpdateKeyframeFields: (
    trackId: TimelineTrackId,
    kfId: string,
    patch: {
      time?: number;
      zoom?: number;
      posX?: number;
      posY?: number;
      opacity?: number;
      rotation?: number;
    }
  ) => void;
  onDeleteKeyframe: (trackId: TimelineTrackId, kfId: string) => void;
  onApplyTrackPreset: (
    trackId: TimelineTrackId,
    preset: AutoAnimationPreset,
    customDurationSec?: number
  ) => void;
  onUpdateTrackMeta: (
    trackId: TimelineTrackId,
    patch: { easing?: AnimationEasing; animationDuration?: number }
  ) => void;
  onResetTrackScale: (trackId: TimelineTrackId) => void;
  onResetTrackPosition: (trackId: TimelineTrackId) => void;
}

interface TrackDescriptor {
  id: TimelineTrackId;
  label: string;
  sublabel: string;
  colorClass: string;
  badgeClass: string;
  diamondClass: string;
  keyframes: ImageKeyframe[];
  easing: AnimationEasing;
  animationPreset: AutoAnimationPreset;
  animationDuration?: number;
  pendingEditTime?: number;
  clipStart: number;
  clipEnd: number;
  minTime: number;
  maxTime: number;
  minScale: number;
  maxScale: number;
  hasContent: boolean;
  icon: 'bg' | 'img' | 'panel' | 'header' | 'body';
}

export const KeyframeTimeline: React.FC<KeyframeTimelineProps> = ({
  project,
  playheadTime,
  isPlaying,
  selectedTrackId,
  autoKeyframesEnabled = false,
  onToggleAutoKeyframes,
  onSelectTrack,
  onSeekPlayhead,
  onTogglePlay,
  onAddOrUpdateKeyframe,
  onMoveKeyframeTime,
  onUpdateKeyframeFields,
  onDeleteKeyframe,
  onApplyTrackPreset,
  onUpdateTrackMeta,
  onResetTrackScale,
  onResetTrackPosition,
}) => {
  const durationSec = Math.max(2, project.durationSeconds || 8);
  const [timelineZoom, setTimelineZoom] = useState<number>(1);
  const [selectedKfByTrack, setSelectedKfByTrack] = useState<Partial<Record<TimelineTrackId, string>>>({});
  const laneScrollRef = useRef<HTMLDivElement>(null);
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [draggingKf, setDraggingKf] = useState<{
    trackId: TimelineTrackId;
    kfId: string;
  } | null>(null);
  const draggingKfRef = useRef<{
    trackId: TimelineTrackId;
    kfId: string;
  } | null>(null);

  const isT2 = project.activeTemplate === 'template-2';

  const getTrackData = (track: KeyframedTransformTrack | undefined, fallbackScale = 1, fallbackX = 0, fallbackY = 0): KeyframedTransformTrack => ({
    scale: track?.scale ?? fallbackScale,
    posX: track?.posX ?? fallbackX,
    posY: track?.posY ?? fallbackY,
    animationPreset: track?.animationPreset ?? 'none',
    animationDuration: track?.animationDuration,
    easing: track?.easing ?? 'ease-in-out',
    keyframes: track?.keyframes ?? [],
    pendingEditTime: track?.pendingEditTime,
  });

  const tracks: TrackDescriptor[] = useMemo(() => {
    const bgTrack = isT2
      ? getTrackData(
          project.template2.lowerMedia.bgTrack,
          project.template2.lowerMedia.bgScale || 1,
          project.template2.lowerMedia.bgMoveX || 0,
          project.template2.lowerMedia.bgMoveY || 0
        )
      : getTrackData(
          project.adjust.bgTrack,
          project.adjust.scale || 1,
          project.adjust.moveX || 0,
          project.adjust.moveY || 0
        );

    const panelTrack = isT2
      ? getTrackData(
          project.template2.panelTransform,
          project.template2.panel.panelScale ?? 1,
          project.template2.panel.posX || 0,
          project.template2.panel.posY || 0
        )
      : getTrackData(
          project.panelTransform,
          project.panel.panelScale ?? 1,
          project.panel.posX || 0,
          project.panel.posY ?? -22
        );

    const headerTrack = isT2
      ? getTrackData(project.template2.brandingTransform, 1, 0, 0)
      : getTrackData(project.brandingTransform, 1, 0, 0);

    const bodyTrack = isT2
      ? getTrackData(project.template2.textTransform, 1, 0, 0)
      : getTrackData(project.textTransform, 1, 0, 0);

    const s0 = project.imageSequence[0];
    const s1 = project.imageSequence[1];
    const s2 = project.imageSequence[2];

    const list: TrackDescriptor[] = [
      {
        id: 'background',
        label: 'Background',
        sublabel: project.mediaName ? project.mediaName : 'No footage',
        colorClass: 'text-rose-300',
        badgeClass: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
        diamondClass: 'bg-rose-400 border-neutral-950',
        keyframes: sortKeyframes(bgTrack.keyframes),
        easing: bgTrack.easing,
        animationPreset: bgTrack.animationPreset,
        animationDuration: bgTrack.animationDuration,
        pendingEditTime: bgTrack.pendingEditTime,
        clipStart: 0,
        clipEnd: durationSec,
        minTime: 0,
        maxTime: durationSec,
        minScale: 0.25,
        maxScale: 4.0,
        hasContent: !!project.mediaUrl,
        icon: 'bg',
      },
      ...[s0, s1, s2].filter(Boolean).map((slot, idx) => ({
        id: (`slot-${idx + 1}`) as TimelineTrackId,
        label: `Image ${idx + 1}`,
        sublabel: slot.url ? `${slot.startTime.toFixed(1)}–${slot.endTime.toFixed(1)}s` : 'Empty slot',
        colorClass: 'text-amber-300',
        badgeClass: 'bg-amber-400/15 border-amber-400/50 text-amber-300',
        diamondClass: 'bg-amber-400 border-neutral-950',
        keyframes: sortKeyframes(slot.keyframes || []),
        easing: slot.easing || 'ease-in-out',
        animationPreset: slot.animationPreset || 'none',
        animationDuration: slot.animationDuration,
        pendingEditTime: slot.pendingEditTime,
        clipStart: slot.startTime,
        clipEnd: slot.endTime,
        minTime: 0,
        maxTime: durationSec,
        minScale: slot.minZoom ?? 0.1,
        maxScale: slot.maxZoom ?? 10.0,
        hasContent: !!slot.url,
        icon: 'img' as const,
      })),
      {
        id: 'panel',
        label: 'Text Panel',
        sublabel: panelTrack.keyframes.length ? `${panelTrack.keyframes.length} kf` : 'Static',
        colorClass: 'text-sky-300',
        badgeClass: 'bg-sky-500/15 border-sky-400/50 text-sky-300',
        diamondClass: 'bg-sky-400 border-neutral-950',
        keyframes: sortKeyframes(panelTrack.keyframes),
        easing: panelTrack.easing,
        animationPreset: panelTrack.animationPreset,
        animationDuration: panelTrack.animationDuration,
        pendingEditTime: panelTrack.pendingEditTime,
        clipStart: 0,
        clipEnd: durationSec,
        minTime: 0,
        maxTime: durationSec,
        minScale: 0.35,
        maxScale: 2.2,
        hasContent: true,
        icon: 'panel',
      },
      {
        id: 'text-header',
        label: 'Header / Logo',
        sublabel: headerTrack.keyframes.length ? `${headerTrack.keyframes.length} kf` : 'Static',
        colorClass: 'text-violet-300',
        badgeClass: 'bg-violet-500/15 border-violet-400/50 text-violet-300',
        diamondClass: 'bg-violet-400 border-neutral-950',
        keyframes: sortKeyframes(headerTrack.keyframes),
        easing: headerTrack.easing,
        animationPreset: headerTrack.animationPreset,
        animationDuration: headerTrack.animationDuration,
        pendingEditTime: headerTrack.pendingEditTime,
        clipStart: 0,
        clipEnd: durationSec,
        minTime: 0,
        maxTime: durationSec,
        minScale: 0.35,
        maxScale: 2.5,
        hasContent: true,
        icon: 'header',
      },
      {
        id: 'text-body',
        label: 'Body Text',
        sublabel: bodyTrack.keyframes.length ? `${bodyTrack.keyframes.length} kf` : 'Static',
        colorClass: 'text-cyan-300',
        badgeClass: 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300',
        diamondClass: 'bg-cyan-400 border-neutral-950',
        keyframes: sortKeyframes(bodyTrack.keyframes),
        easing: bodyTrack.easing,
        animationPreset: bodyTrack.animationPreset,
        animationDuration: bodyTrack.animationDuration,
        pendingEditTime: bodyTrack.pendingEditTime,
        clipStart: 0,
        clipEnd: durationSec,
        minTime: 0,
        maxTime: durationSec,
        minScale: 0.35,
        maxScale: 2.5,
        hasContent: true,
        icon: 'body',
      },
    ];
    return list;
  }, [project, isT2, durationSec]);

  const activeTrack = tracks.find((t) => t.id === selectedTrackId) || tracks[0];

  // Current evaluated value at playhead for the selected track
  const activeTrackCurrentVal = useMemo(() => {
    if (activeTrack.id.startsWith('slot-')) {
      const idx = Number(activeTrack.id.replace('slot-', '')) - 1;
      const slot = project.imageSequence[idx];
      return slot
        ? evaluateImageTransformAtTime(slot, playheadTime, !isPlaying)
        : { zoom: 1, posX: 0, posY: 0, opacity: 1, rotation: 0 };
    }
    if (activeTrack.id === 'background') {
      return isT2
        ? evaluateTrackTransformAtTime(
            project.template2.lowerMedia.bgTrack,
            playheadTime,
            !isPlaying,
            {
              zoom: project.template2.lowerMedia.bgScale || 1,
              posX: project.template2.lowerMedia.bgMoveX || 0,
              posY: project.template2.lowerMedia.bgMoveY || 0,
            },
            0.25,
            4.0
          )
        : evaluateTrackTransformAtTime(
            project.adjust.bgTrack,
            playheadTime,
            !isPlaying,
            {
              zoom: project.adjust.scale || 1,
              posX: project.adjust.moveX || 0,
              posY: project.adjust.moveY || 0,
            },
            0.25,
            4.0
          );
    }
    if (activeTrack.id === 'panel') {
      return isT2
        ? evaluateTrackTransformAtTime(
            project.template2.panelTransform,
            playheadTime,
            !isPlaying,
            {
              zoom: project.template2.panel.panelScale ?? 1,
              posX: project.template2.panel.posX || 0,
              posY: project.template2.panel.posY || 0,
            },
            0.35,
            2.2
          )
        : evaluateTrackTransformAtTime(
            project.panelTransform,
            playheadTime,
            !isPlaying,
            {
              zoom: project.panel.panelScale ?? 1,
              posX: project.panel.posX || 0,
              posY: project.panel.posY ?? -22,
            },
            0.35,
            2.2
          );
    }
    if (activeTrack.id === 'text-header') {
      return evaluateTrackTransformAtTime(
        isT2 ? project.template2.brandingTransform : project.brandingTransform,
        playheadTime,
        !isPlaying,
        { zoom: 1, posX: 0, posY: 0 },
        0.35,
        2.5
      );
    }
    return evaluateTrackTransformAtTime(
      isT2 ? project.template2.textTransform : project.textTransform,
      playheadTime,
      !isPlaying,
      { zoom: 1, posX: 0, posY: 0 },
      0.35,
      2.5
    );
  }, [activeTrack.id, project, isT2, playheadTime, isPlaying]);

  const nearKf = findKeyframeNearTime(activeTrack.keyframes, playheadTime, 0.14);
  const selectedKf =
    activeTrack.keyframes.find((k) => k.id === selectedKfByTrack[activeTrack.id]) ||
    nearKf ||
    null;

  const clientXToTime = (clientX: number): number => {
    const rect = trackAreaRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Number((ratio * durationSec).toFixed(2));
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDraggingPlayhead(true);
    onSeekPlayhead(clientXToTime(e.clientX));
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPlayhead) {
      onSeekPlayhead(clientXToTime(e.clientX));
    }
  };

  const handleRulerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPlayhead) {
      setDraggingPlayhead(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const renderTrackIcon = (icon: TrackDescriptor['icon']) => {
    switch (icon) {
      case 'bg':
        return <Film className="w-3 h-3 text-rose-400 shrink-0" />;
      case 'img':
        return <ImageIcon className="w-3 h-3 text-amber-400 shrink-0" />;
      case 'panel':
        return <Square className="w-3 h-3 text-sky-400 shrink-0" />;
      case 'header':
        return <Shield className="w-3 h-3 text-violet-400 shrink-0" />;
      case 'body':
        return <Type className="w-3 h-3 text-cyan-400 shrink-0" />;
    }
  };

  const rulerTicks = useMemo(() => {
    const step = durationSec <= 4 ? 0.5 : timelineZoom >= 2 ? 0.5 : 1.0;
    const ticks: number[] = [];
    for (let t = 0; t <= durationSec + 0.001; t += step) {
      ticks.push(Number(t.toFixed(2)));
    }
    return ticks;
  }, [durationSec, timelineZoom]);

  const maxTrackSpan = Math.max(0.2, durationSec - activeTrack.clipStart);

  return (
    <section
      aria-label="Multi-Track Keyframe Timeline"
      className="mt-5 bg-neutral-900 border border-neutral-800 rounded-xl shadow-sm overflow-hidden"
    >
      {/* Top Timeline Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-neutral-950/90 border-b border-neutral-800">
        {/* Left: Playback + Timecode + Track badge */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer transition-colors"
            title={isPlaying ? 'Pause Timeline' : 'Play Timeline'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSeekPlayhead(0)}
            className="p-1.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 cursor-pointer"
            title="Jump to 0.00s"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <span className="text-xs font-mono font-bold text-neutral-100 bg-neutral-900 px-2.5 py-1 rounded border border-neutral-800 tabular-nums">
            {playheadTime.toFixed(2)}s / {durationSec.toFixed(1)}s
          </span>

          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${activeTrack.badgeClass}`}
          >
            Track: {activeTrack.label}
          </span>
        </div>

        {/* Center/Right: Keyframe Add/Delete + Auto Keyframes + Auto Preset + Duration + Easing + Timeline Zoom */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onAddOrUpdateKeyframe(activeTrack.id)}
            className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            title={`Add or update keyframe on ${activeTrack.label} at ${playheadTime.toFixed(2)}s`}
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            <Diamond className="w-3 h-3 fill-current" />
            <span>{nearKf ? 'Update Keyframe' : 'Add Keyframe'}</span>
          </button>

          {onToggleAutoKeyframes && (
            <button
              type="button"
              onClick={onToggleAutoKeyframes}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border cursor-pointer transition-colors ${
                autoKeyframesEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/70 shadow-sm'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
              }`}
              title="Automatically record or update a keyframe whenever you move or zoom at any timestamp"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  autoKeyframesEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
                }`}
              />
              <span>Auto Keyframes {autoKeyframesEnabled ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {selectedKf && (
            <button
              type="button"
              onClick={() => onDeleteKeyframe(activeTrack.id, selectedKf.id)}
              className="px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/70 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
              title="Delete selected keyframe"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          )}

          {/* Auto-Animation Preset Dropdown (per active track) */}
          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-0.5">
            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
            <select
              aria-label="Track Auto-Animation Preset"
              value={activeTrack.animationPreset}
              onChange={(e) =>
                onApplyTrackPreset(activeTrack.id, e.target.value as AutoAnimationPreset)
              }
              className="bg-transparent text-[11px] text-neutral-100 py-1 focus:outline-none cursor-pointer"
            >
              {AUTO_ANIMATION_PRESET_OPTIONS.filter(
                (opt) => opt.id !== 'custom' || activeTrack.animationPreset === 'custom'
              ).map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-neutral-900 text-neutral-100">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Animation Duration (s) */}
          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-0.5">
            <span className="text-[10px] text-neutral-400">Dur</span>
            <input
              type="number"
              min={0.2}
              max={Number(maxTrackSpan.toFixed(2))}
              step={0.1}
              value={Number((activeTrack.animationDuration || maxTrackSpan).toFixed(2))}
              onChange={(e) => {
                const val = Math.max(0.2, Math.min(maxTrackSpan, Number(e.target.value) || maxTrackSpan));
                if (activeTrack.animationPreset !== 'none' && activeTrack.animationPreset !== 'custom') {
                  onApplyTrackPreset(activeTrack.id, activeTrack.animationPreset, val);
                } else {
                  onUpdateTrackMeta(activeTrack.id, { animationDuration: val });
                }
              }}
              className="w-12 bg-transparent text-[11px] font-mono text-amber-300 text-right focus:outline-none"
              title="Animation duration in seconds"
            />
            <span className="text-[10px] text-neutral-500">s</span>
          </div>

          {/* Easing Selector */}
          <select
            aria-label="Track Easing"
            value={activeTrack.easing}
            onChange={(e) =>
              onUpdateTrackMeta(activeTrack.id, { easing: e.target.value as AnimationEasing })
            }
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-[11px] text-neutral-200 focus:outline-none cursor-pointer"
          >
            <option value="linear">Linear</option>
            <option value="ease-in">Ease In</option>
            <option value="ease-out">Ease Out</option>
            <option value="ease-in-out">Ease In-Out</option>
          </select>

          {/* Timeline Horizontal Zoom */}
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setTimelineZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
              disabled={timelineZoom <= 1}
              className="p-1 text-neutral-300 hover:text-white disabled:opacity-40 cursor-pointer"
              title="Zoom Out Timeline"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] font-mono text-neutral-300">
              {timelineZoom.toFixed(1)}x
            </span>
            <button
              type="button"
              onClick={() => setTimelineZoom((z) => Math.min(6, Number((z + 0.5).toFixed(1))))}
              disabled={timelineZoom >= 6}
              className="p-1 text-neutral-300 hover:text-white disabled:opacity-40 cursor-pointer"
              title="Zoom In Timeline"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Track Body: Left Fixed Track Headers + Right Scrollable Horizontal Tracks */}
      <div className="flex">
        {/* Track Labels Column */}
        <div className="w-40 sm:w-44 shrink-0 border-r border-neutral-800 bg-neutral-950/60">
          <div className="h-7 px-3 border-b border-neutral-800 flex items-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Tracks (7)
          </div>
          {tracks.map((tr) => {
            const isSel = tr.id === activeTrack.id;
            return (
              <button
                key={tr.id}
                type="button"
                onClick={() => onSelectTrack(tr.id)}
                className={`w-full h-9 px-3 border-b border-neutral-800/70 flex items-center justify-between gap-1.5 text-left transition-colors cursor-pointer ${
                  isSel
                    ? 'bg-neutral-800/90 text-white'
                    : 'hover:bg-neutral-900/80 text-neutral-400'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {renderTrackIcon(tr.icon)}
                  <span className={`text-[11px] font-semibold truncate ${isSel ? tr.colorClass : ''}`}>
                    {tr.label}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-neutral-500 shrink-0">
                  {tr.keyframes.length > 0 ? `${tr.keyframes.length}◆` : '—'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Ruler + 7 Keyframe Track Lanes */}
        <div ref={laneScrollRef} className="flex-1 overflow-x-auto bg-neutral-950/30">
          <div
            ref={trackAreaRef}
            style={{ width: `${timelineZoom * 100}%`, minWidth: '100%' }}
            className="relative select-none"
          >
            {/* Interactive Time Ruler */}
            <div
              onPointerDown={handleRulerPointerDown}
              onPointerMove={handleRulerPointerMove}
              onPointerUp={handleRulerPointerUp}
              onPointerCancel={handleRulerPointerUp}
              style={{ touchAction: 'none' }}
              className="h-7 border-b border-neutral-800 bg-neutral-950 relative cursor-ew-resize"
            >
              {rulerTicks.map((tick) => {
                const leftPct = (tick / durationSec) * 100;
                return (
                  <div
                    key={tick}
                    style={{ left: `${leftPct}%` }}
                    className="absolute top-0 bottom-0 border-l border-neutral-800 pointer-events-none"
                  >
                    <span className="text-[9px] font-mono text-neutral-500 pl-1">
                      {tick.toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 7 Track Lanes */}
            {tracks.map((tr) => {
              const isSel = tr.id === activeTrack.id;
              const spanStartPct = (tr.clipStart / durationSec) * 100;
              const spanWidthPct = Math.max(
                1,
                ((tr.clipEnd - tr.clipStart) / durationSec) * 100
              );

              return (
                <div
                  key={tr.id}
                  onPointerDown={(e) => {
                    onSelectTrack(tr.id);
                    const clickedTime = clientXToTime(e.clientX);
                    onSeekPlayhead(clickedTime);
                  }}
                  className={`h-9 border-b border-neutral-800/70 relative cursor-pointer transition-colors ${
                    isSel ? 'bg-neutral-900/70' : 'hover:bg-neutral-900/35'
                  }`}
                >
                  {/* Active Clip Window Bar */}
                  <div
                    style={{ left: `${spanStartPct}%`, width: `${spanWidthPct}%` }}
                    className={`absolute top-1.5 bottom-1.5 rounded border pointer-events-none ${
                      tr.hasContent
                        ? isSel
                          ? 'bg-neutral-800/80 border-neutral-600'
                          : 'bg-neutral-900/60 border-neutral-800'
                        : 'bg-neutral-950/40 border-dashed border-neutral-800/60'
                    }`}
                  >
                    <span className="text-[9px] font-mono text-neutral-500 px-1.5 leading-6 truncate block">
                      {tr.sublabel}
                    </span>
                  </div>

                  {/* Draggable Keyframe Diamonds */}
                  {tr.keyframes.map((kf) => {
                    const leftPct = Math.max(0, Math.min(100, (kf.time / durationSec) * 100));
                    const isKfSel = isSel && selectedKf?.id === kf.id;

                    return (
                      <div
                        key={kf.id}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onSelectTrack(tr.id);
                          setSelectedKfByTrack((prev) => ({ ...prev, [tr.id]: kf.id }));
                          onSeekPlayhead(kf.time);
                          const dragInfo = { trackId: tr.id, kfId: kf.id };
                          draggingKfRef.current = dragInfo;
                          setDraggingKf(dragInfo);
                          try {
                            e.currentTarget.setPointerCapture(e.pointerId);
                          } catch {
                            // ignore
                          }
                        }}
                        onPointerMove={(e) => {
                          const active = draggingKfRef.current || draggingKf;
                          if (active && active.trackId === tr.id && active.kfId === kf.id) {
                            e.stopPropagation();
                            const rawTime = clientXToTime(e.clientX);
                            const safeTime = clampKeyframeTimeWithNeighbors(
                              tr.keyframes,
                              kf.id,
                              rawTime,
                              tr.minTime,
                              tr.maxTime,
                              0.05
                            );
                            onMoveKeyframeTime(tr.id, kf.id, safeTime);
                            onSeekPlayhead(safeTime);
                          }
                        }}
                        onPointerUp={(e) => {
                          const active = draggingKfRef.current || draggingKf;
                          if (active && active.trackId === tr.id && active.kfId === kf.id) {
                            e.stopPropagation();
                            draggingKfRef.current = null;
                            setDraggingKf(null);
                            try {
                              e.currentTarget.releasePointerCapture(e.pointerId);
                            } catch {
                              // ignore
                            }
                          }
                        }}
                        onPointerCancel={() => {
                          draggingKfRef.current = null;
                          setDraggingKf(null);
                        }}
                        style={{ left: `${leftPct}%`, touchAction: 'none' }}
                        title={`${tr.label} @ ${kf.time.toFixed(2)}s · ${Math.round(
                          kf.zoom * 100
                        )}% (Drag left/right)`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 p-1 cursor-ew-resize"
                      >
                        <div
                          className={`w-3 h-3 rotate-45 border transition-transform ${
                            isKfSel
                              ? 'bg-white border-amber-400 scale-125 shadow-md ring-2 ring-amber-400/50'
                              : tr.diamondClass
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Continuous Playhead Needle across Ruler & All 7 Tracks */}
            <div
              style={{
                left: `${Math.max(0, Math.min(100, (playheadTime / durationSec) * 100))}%`,
              }}
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-30"
            >
              <div className="w-2.5 h-2.5 -ml-[4px] bg-rose-500 rotate-45 border border-white shadow" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Compact Inspector Strip for Selected Track / Keyframe */}
      <div className="px-4 py-2.5 bg-neutral-950/90 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className={`font-bold ${activeTrack.colorClass}`}>
            {activeTrack.label}
          </span>

          {selectedKf ? (
            <>
              <label className="flex items-center gap-1 text-neutral-400">
                <span>Time:</span>
                <input
                  type="number"
                  min={activeTrack.minTime}
                  max={activeTrack.maxTime}
                  step={0.05}
                  value={selectedKf.time}
                  onChange={(e) => {
                    const safeT = clampKeyframeTimeWithNeighbors(
                      activeTrack.keyframes,
                      selectedKf.id,
                      Number(e.target.value),
                      activeTrack.minTime,
                      activeTrack.maxTime,
                      0.05
                    );
                    onUpdateKeyframeFields(activeTrack.id, selectedKf.id, { time: safeT });
                    onSeekPlayhead(safeT);
                  }}
                  className="w-16 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 font-mono text-neutral-100"
                />
                <span>s</span>
              </label>

              <label className="flex items-center gap-1 text-neutral-400">
                <span>Scale:</span>
                <input
                  type="number"
                  min={Math.round(activeTrack.minScale * 100)}
                  max={Math.round(activeTrack.maxScale * 100)}
                  step={5}
                  value={Math.round(selectedKf.zoom * 100)}
                  onChange={(e) => {
                    const raw = Number(e.target.value) / 100;
                    const clamped =
                      activeTrack.id.startsWith('slot-')
                        ? clampZoom(raw, activeTrack.minScale, activeTrack.maxScale)
                        : clampTrackScale(raw, activeTrack.minScale, activeTrack.maxScale);
                    onUpdateKeyframeFields(activeTrack.id, selectedKf.id, { zoom: clamped });
                  }}
                  className="w-16 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 font-mono text-amber-300"
                />
                <span>%</span>
              </label>

              <label className="flex items-center gap-1 text-neutral-400">
                <span>X:</span>
                <input
                  type="number"
                  step={10}
                  value={Math.round(selectedKf.posX)}
                  onChange={(e) =>
                    onUpdateKeyframeFields(activeTrack.id, selectedKf.id, {
                      posX: Number(e.target.value) || 0,
                    })
                  }
                  className="w-16 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 font-mono text-neutral-100"
                />
                <span>px</span>
              </label>

              <label className="flex items-center gap-1 text-neutral-400">
                <span>Y:</span>
                <input
                  type="number"
                  step={10}
                  value={Math.round(selectedKf.posY)}
                  onChange={(e) =>
                    onUpdateKeyframeFields(activeTrack.id, selectedKf.id, {
                      posY: Number(e.target.value) || 0,
                    })
                  }
                  className="w-16 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 font-mono text-neutral-100"
                />
                <span>px</span>
              </label>

              {activeTrack.id.startsWith('slot-') && (
                <>
                  <label className="flex items-center gap-1 text-neutral-400">
                    <span>Rot:</span>
                    <input
                      type="number"
                      min={-360}
                      max={360}
                      step={5}
                      value={Math.round(selectedKf.rotation ?? 0)}
                      onChange={(e) =>
                        onUpdateKeyframeFields(activeTrack.id, selectedKf.id, {
                          rotation: Number(e.target.value) || 0,
                        })
                      }
                      className="w-14 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 font-mono text-neutral-100"
                    />
                    <span>°</span>
                  </label>
                  <label className="flex items-center gap-1 text-neutral-400">
                    <span>Opac:</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round((selectedKf.opacity ?? 1) * 100)}
                      onChange={(e) =>
                        onUpdateKeyframeFields(activeTrack.id, selectedKf.id, {
                          opacity: Math.max(0, Math.min(1, (Number(e.target.value) || 0) / 100)),
                        })
                      }
                      className="w-14 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 font-mono text-neutral-100"
                    />
                    <span>%</span>
                  </label>
                </>
              )}
            </>
          ) : (
            <span className="text-neutral-400 font-mono">
              Scale: {Math.round(activeTrackCurrentVal.zoom * 100)}% · X:{' '}
              {Math.round(activeTrackCurrentVal.posX)} · Y:{' '}
              {Math.round(activeTrackCurrentVal.posY)}
              {activeTrack.pendingEditTime !== undefined &&
              Math.abs(playheadTime - activeTrack.pendingEditTime) < 0.06 ? (
                <span className="text-amber-300 ml-2">
                  · Unsaved transform @ {playheadTime.toFixed(2)}s (click + Add Keyframe)
                </span>
              ) : (
                <span className="text-neutral-500 ml-2">
                  · Drag on preview or click + Add Keyframe
                </span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onResetTrackPosition(activeTrack.id)}
            className="px-2 py-1 text-[10px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Reset Pos</span>
          </button>
          <button
            type="button"
            onClick={() => onResetTrackScale(activeTrack.id)}
            className="px-2 py-1 text-[10px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Reset Scale</span>
          </button>
        </div>
      </div>
    </section>
  );
};
