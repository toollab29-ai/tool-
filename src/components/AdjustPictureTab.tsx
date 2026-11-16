import React, { useRef, useState } from 'react';
import {
  AdjustSettings,
  AnimationEasing,
  AutoAnimationPreset,
  BackgroundFitMode,
  ImageKeyframe,
  ImageSequenceSlot,
  SequenceTransitionSettings,
  SequenceTransitionType,
  TemplateId,
  Template2LowerMediaSettings,
} from '../types';
import {
  AUTO_ANIMATION_PRESET_OPTIONS,
  clampTrackScale,
  clampZoom,
  evaluateImageTransformAtTime,
  evaluateTrackTransformAtTime,
  findKeyframeNearTime,
  generateSlotPresetKeyframes,
  remapKeyframesToSlotWindow,
  sortKeyframes,
} from '../utils/keyframeAnimation';
import {
  Move,
  ZoomIn,
  Layers,
  RotateCcw,
  Maximize2,
  Sparkles,
  Image as ImageIcon,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  Trash2,
  Diamond,
  Clock,
  Sliders,
  Upload,
} from 'lucide-react';

interface AdjustPictureTabProps {
  activeTemplate: TemplateId;
  adjust: AdjustSettings;
  template2LowerMedia: Template2LowerMediaSettings;
  imageSequence: ImageSequenceSlot[];
  activeSequenceIndex: 0 | 1 | 2;
  sequenceTransition: SequenceTransitionSettings;
  videoDurationSec: number;
  playheadTime: number;
  isPreviewPlaying: boolean;
  autoKeyframesEnabled?: boolean;
  onToggleAutoKeyframes?: () => void;
  onTogglePreviewPlay: () => void;
  onSeekPlayhead: (timeSec: number) => void;
  onChange: (updated: Partial<AdjustSettings>) => void;
  onChangeTemplate2LowerMedia: (updated: Partial<Template2LowerMediaSettings>) => void;
  onChangeBackgroundTransform?: (updated: { zoom?: number; posX?: number; posY?: number }) => void;
  onSelectSequenceSlot: (slotIndex: 0 | 1 | 2, jumpPlayhead?: boolean) => void;
  onUpdateSequenceSlot: (
    slotIndex: 0 | 1 | 2,
    updated: Partial<ImageSequenceSlot>
  ) => void;
  onChangeSlotTransform: (
    slotIndex: 0 | 1 | 2,
    updated: {
      zoom?: number;
      posX?: number;
      posY?: number;
      opacity?: number;
      rotation?: number;
    }
  ) => void;
  onResetSequenceTimings: () => void;
  onUpdateTransition: (updated: Partial<SequenceTransitionSettings>) => void;
  onPreviewAndCreate: () => void;
  onNextToTemplate?: () => void;
  onNextToSound?: () => void;
  onGoToMedia?: () => void;
}

export const AdjustPictureTab: React.FC<AdjustPictureTabProps> = ({
  activeTemplate,
  adjust,
  template2LowerMedia,
  imageSequence,
  activeSequenceIndex,
  sequenceTransition,
  videoDurationSec,
  playheadTime,
  isPreviewPlaying,
  autoKeyframesEnabled = false,
  onToggleAutoKeyframes,
  onTogglePreviewPlay,
  onSeekPlayhead,
  onChange,
  onChangeTemplate2LowerMedia,
  onChangeBackgroundTransform,
  onSelectSequenceSlot,
  onUpdateSequenceSlot,
  onChangeSlotTransform,
  onResetSequenceTimings,
  onUpdateTransition,
  onPreviewAndCreate,
  onNextToTemplate,
  onNextToSound,
  onGoToMedia,
}) => {
  const [activeTarget, setActiveTarget] = useState<'sequence' | 'background'>('sequence');
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isScrubbingTimeline, setIsScrubbingTimeline] = useState(false);

  const durationSec = Math.max(2, videoDurationSec || 8);
  const bgLiveTransform =
    activeTemplate === 'template-2'
      ? evaluateTrackTransformAtTime(
          template2LowerMedia.bgTrack,
          playheadTime,
          !isPreviewPlaying,
          {
            zoom: template2LowerMedia.bgScale || 1.0,
            posX: template2LowerMedia.bgMoveX || 0,
            posY: template2LowerMedia.bgMoveY || 0,
          },
          0.25,
          4.0
        )
      : evaluateTrackTransformAtTime(
          adjust.bgTrack,
          playheadTime,
          !isPreviewPlaying,
          {
            zoom: adjust.scale || 1.0,
            posX: adjust.moveX || 0,
            posY: adjust.moveY || 0,
          },
          0.25,
          4.0
        );

  const updateBgTransform = (patch: { zoom?: number; posX?: number; posY?: number }) => {
    if (onChangeBackgroundTransform) {
      onChangeBackgroundTransform(patch);
      return;
    }
    if (activeTemplate === 'template-2') {
      onChangeTemplate2LowerMedia({
        ...(patch.zoom !== undefined ? { bgScale: clampTrackScale(patch.zoom, 0.25, 4.0) } : {}),
        ...(patch.posX !== undefined ? { bgMoveX: patch.posX } : {}),
        ...(patch.posY !== undefined ? { bgMoveY: patch.posY } : {}),
      });
    } else {
      onChange({
        ...(patch.zoom !== undefined ? { scale: clampTrackScale(patch.zoom, 0.25, 4.0) } : {}),
        ...(patch.posX !== undefined ? { moveX: patch.posX } : {}),
        ...(patch.posY !== undefined ? { moveY: patch.posY } : {}),
      });
    }
  };
  const activeSlot = imageSequence[activeSequenceIndex] || imageSequence[0];
  const sortedKeyframes = activeSlot ? sortKeyframes(activeSlot.keyframes || []) : [];
  const slotMinZoom = activeSlot?.minZoom ?? 0.1;
  const slotMaxZoom = activeSlot?.maxZoom ?? 10.0;
  const minZoomPct = Math.round(slotMinZoom * 100);
  const maxZoomPct = Math.round(slotMaxZoom * 100);

  // Clamp evaluation time inside activeSlot window if playhead is elsewhere so user sees slot's state clearly
  const effectiveEvalTime = activeSlot
    ? Math.max(activeSlot.startTime, Math.min(activeSlot.endTime, playheadTime))
    : playheadTime;

  const liveTransform = activeSlot
    ? evaluateImageTransformAtTime(activeSlot, playheadTime, !isPreviewPlaying)
    : { zoom: 1.0, posX: 0, posY: 0, opacity: 1.0, rotation: 0 };

  const displayTransform = activeSlot
    ? playheadTime >= activeSlot.startTime && playheadTime <= activeSlot.endTime
      ? liveTransform
      : evaluateImageTransformAtTime(activeSlot, effectiveEvalTime, false)
    : { zoom: 1.0, posX: 0, posY: 0, opacity: 1.0, rotation: 0 };

  const currentZoomPct = Math.round(
    clampZoom(displayTransform.zoom, slotMinZoom, slotMaxZoom) * 100
  );
  const nearKeyframe = activeSlot
    ? findKeyframeNearTime(sortedKeyframes, playheadTime, 0.08)
    : null;
  const activeSelectedKf =
    sortedKeyframes.find((k) => k.id === selectedKeyframeId) || nearKeyframe || null;

  const hasPendingUncommittedEdit =
    !!activeSlot &&
    (activeSlot.keyframes?.length || 0) > 0 &&
    !nearKeyframe &&
    activeSlot.pendingEditTime !== undefined &&
    Math.abs(playheadTime - activeSlot.pendingEditTime) < 0.08;

  const seekFromClientX = (clientX: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeekPlayhead(Number((ratio * durationSec).toFixed(2)));
  };

  const handleApplySlotPreset = (preset: AutoAnimationPreset, customDurSec?: number) => {
    if (!activeSlot) return;
    if (preset === 'none') {
      onUpdateSequenceSlot(activeSequenceIndex, {
        animationPreset: 'none',
        keyframes: [],
        zoom: 1.0,
        pendingEditTime: undefined,
      });
      setSelectedKeyframeId(null);
      return;
    }

    const hasExistingKfs = (activeSlot.keyframes?.length || 0) > 0;
    const basePosX = hasExistingKfs ? activeSlot.posX ?? 0 : displayTransform.posX ?? activeSlot.posX ?? 0;
    const basePosY = hasExistingKfs ? activeSlot.posY ?? 0 : displayTransform.posY ?? activeSlot.posY ?? 0;
    const baseZoomVal = hasExistingKfs
      ? clampZoom(activeSlot.zoom ?? 1.0, slotMinZoom, slotMaxZoom)
      : clampZoom(displayTransform.zoom ?? 1.0, slotMinZoom, slotMaxZoom);
    const slotSpan = Math.max(0.2, activeSlot.endTime - activeSlot.startTime);
    const maxSpan = Math.max(0.2, durationSec - activeSlot.startTime);
    const animDur = customDurSec
      ? Math.max(0.2, Math.min(maxSpan, customDurSec))
      : activeSlot.animationDuration
      ? Math.max(0.2, Math.min(maxSpan, activeSlot.animationDuration))
      : slotSpan;
    const animEnd = Number(Math.min(durationSec, activeSlot.startTime + animDur).toFixed(2));

    const generated = generateSlotPresetKeyframes(
      preset,
      activeSlot.startTime,
      animEnd,
      basePosX,
      basePosY,
      activeSlot.slotNumber,
      baseZoomVal,
      slotMinZoom,
      slotMaxZoom
    );
    onUpdateSequenceSlot(activeSequenceIndex, {
      animationPreset: preset,
      animationDuration: Number(animDur.toFixed(2)),
      endTime: Math.max(activeSlot.endTime, animEnd),
      easing: activeSlot.easing || 'ease-in-out',
      keyframes: generated,
      pendingEditTime: undefined,
    });
    if (generated.length > 0) {
      setSelectedKeyframeId(generated[0].id);
      onSeekPlayhead(activeSlot.startTime);
    }
  };

  const handleUpdateSlotTiming = (field: 'startTime' | 'endTime', val: number) => {
    if (!activeSlot) return;
    const oldStart = activeSlot.startTime;
    const oldEnd = activeSlot.endTime;
    const nextStart =
      field === 'startTime'
        ? Math.max(0, Math.min(oldEnd - 0.2, Number(val.toFixed(2))))
        : oldStart;
    const nextEnd =
      field === 'endTime'
        ? Math.min(durationSec, Math.max(nextStart + 0.2, Number(val.toFixed(2))))
        : oldEnd;

    const remappedKfs = remapKeyframesToSlotWindow(
      activeSlot.keyframes || [],
      oldStart,
      oldEnd,
      nextStart,
      nextEnd
    );

    onUpdateSequenceSlot(activeSequenceIndex, {
      startTime: nextStart,
      endTime: nextEnd,
      keyframes: remappedKfs,
      pendingEditTime: undefined,
    });
  };

  const handleAddOrUpdateKeyframe = () => {
    if (!activeSlot) return;
    const clampedT = Number(Math.max(0, Math.min(durationSec, playheadTime)).toFixed(2));
    const evalT = evaluateImageTransformAtTime(activeSlot, clampedT, !isPreviewPlaying);

    const nextStart = Math.min(activeSlot.startTime, clampedT);
    const nextEnd = Math.max(activeSlot.endTime, clampedT);

    const existingNear = findKeyframeNearTime(activeSlot.keyframes || [], clampedT, 0.08);
    if (existingNear) {
      const updatedKfs = sortKeyframes(
        activeSlot.keyframes.map((k) =>
          k.id === existingNear.id
            ? {
                ...k,
                time: clampedT,
                zoom: clampZoom(evalT.zoom, slotMinZoom, slotMaxZoom),
                posX: Math.round(evalT.posX),
                posY: Math.round(evalT.posY),
                opacity: evalT.opacity,
                rotation: evalT.rotation,
              }
            : k
        )
      );
      onUpdateSequenceSlot(activeSequenceIndex, {
        startTime: nextStart,
        endTime: nextEnd,
        animationPreset: 'custom',
        keyframes: updatedKfs,
        pendingEditTime: undefined,
      });
      setSelectedKeyframeId(existingNear.id);
    } else {
      const newKf: ImageKeyframe = {
        id: `kf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        time: clampedT,
        zoom: clampZoom(evalT.zoom, slotMinZoom, slotMaxZoom),
        posX: Math.round(evalT.posX),
        posY: Math.round(evalT.posY),
        opacity: evalT.opacity,
        rotation: evalT.rotation,
      };
      const updatedKfs = sortKeyframes([...(activeSlot.keyframes || []), newKf]);
      onUpdateSequenceSlot(activeSequenceIndex, {
        startTime: nextStart,
        endTime: nextEnd,
        animationPreset: 'custom',
        keyframes: updatedKfs,
        pendingEditTime: undefined,
      });
      setSelectedKeyframeId(newKf.id);
    }
  };

  const handleUpdateKeyframeField = (
    kfId: string,
    patch: Partial<Omit<ImageKeyframe, 'id'>>
  ) => {
    if (!activeSlot) return;
    const updatedKfs = sortKeyframes(
      (activeSlot.keyframes || []).map((k) =>
        k.id === kfId
          ? {
              ...k,
              ...patch,
              time:
                patch.time !== undefined
                  ? Math.max(0, Math.min(durationSec, Number(patch.time.toFixed(2))))
                  : k.time,
              zoom:
                patch.zoom !== undefined
                  ? clampZoom(patch.zoom, slotMinZoom, slotMaxZoom)
                  : k.zoom,
            }
          : k
      )
    );
    const minKfT = updatedKfs.length ? Math.min(...updatedKfs.map((k) => k.time)) : activeSlot.startTime;
    const maxKfT = updatedKfs.length ? Math.max(...updatedKfs.map((k) => k.time)) : activeSlot.endTime;

    onUpdateSequenceSlot(activeSequenceIndex, {
      startTime: Math.min(activeSlot.startTime, minKfT),
      endTime: Math.max(activeSlot.endTime, maxKfT),
      animationPreset: 'custom',
      keyframes: updatedKfs,
      pendingEditTime: undefined,
    });
    if (patch.time !== undefined) {
      onSeekPlayhead(Math.max(0, Math.min(durationSec, Number(patch.time.toFixed(2)))));
    }
  };

  const handleDeleteKeyframe = (kfId: string) => {
    if (!activeSlot) return;
    const remaining = (activeSlot.keyframes || []).filter((k) => k.id !== kfId);
    onUpdateSequenceSlot(activeSequenceIndex, {
      animationPreset: remaining.length === 0 ? 'none' : 'custom',
      keyframes: remaining,
      pendingEditTime: undefined,
    });
    if (selectedKeyframeId === kfId) {
      setSelectedKeyframeId(null);
    }
  };

  const handleResetSlotAnimation = () => {
    if (!activeSlot) return;
    const clampedResetZoom = clampZoom(1.0, slotMinZoom, slotMaxZoom);
    const defaultKfs = activeSlot.url
      ? generateSlotPresetKeyframes(
          'zoom-in',
          activeSlot.startTime,
          activeSlot.endTime,
          0,
          0,
          activeSlot.slotNumber,
          clampedResetZoom,
          slotMinZoom,
          slotMaxZoom
        )
      : [];
    onUpdateSequenceSlot(activeSequenceIndex, {
      animationPreset: activeSlot.url ? 'zoom-in' : 'none',
      easing: 'ease-in-out',
      keyframes: defaultKfs,
      zoom: clampedResetZoom,
      posX: 0,
      posY: 0,
      rotation: 0,
      opacity: 1.0,
      pendingEditTime: undefined,
    });
    setSelectedKeyframeId(defaultKfs[0]?.id || null);
    onSeekPlayhead(activeSlot.startTime);
  };

  const defaultPeakPct = activeSlot
    ? Math.round(
        clampZoom(
          Number(
            (
              displayTransform.zoom +
              Math.max(0.02, displayTransform.zoom * 0.07)
            ).toFixed(2)
          ),
          slotMinZoom,
          slotMaxZoom
        ) * 100
      )
    : 107;

  return (
    <div className="space-y-5">
      {/* Switcher between 3-Image Sequence & Background Footage */}
      <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800">
        <button
          type="button"
          onClick={() => setActiveTarget('sequence')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTarget === 'sequence'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>
            Image Sequence ({imageSequence.filter((s) => !!s.url).length}/3)
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTarget('background')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTarget === 'background'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>
            {activeTemplate === 'template-2'
              ? 'Lower Background (~50%)'
              : 'Background Footage'}
          </span>
        </button>
      </div>

      {activeTarget === 'sequence' ? (
        <div className="space-y-4">
          {/* 1. VISUAL 3-IMAGE SEQUENCE TIMELINE */}
          <div className="bg-neutral-950/70 border border-neutral-800 p-4 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onTogglePreviewPlay}
                  className="w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer transition-colors"
                  title={isPreviewPlaying ? 'Pause sequence' : 'Play sequence'}
                >
                  {isPreviewPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>
                <div>
                  <div className="text-xs font-semibold text-neutral-100 flex items-center gap-2">
                    <span>Image Sequence Timeline</span>
                    <span className="text-[11px] font-mono text-rose-400">
                      {playheadTime.toFixed(2)}s / {durationSec.toFixed(1)}s
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    Click a slot or drag the playhead to preview & edit each image's keyframes
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onResetSequenceTimings}
                className="text-[11px] text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset timings to 0–2.5s, 2.5–5s, 5–8s (scaled to duration)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Auto Split Timings</span>
              </button>
            </div>

            {/* Unified Multi-Slot Sequence Track */}
            <div className="space-y-1.5 pt-1">
              <div
                ref={timelineRef}
                onPointerDown={(e) => {
                  setIsScrubbingTimeline(true);
                  seekFromClientX(e.clientX);
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // ignore
                  }
                }}
                onPointerMove={(e) => {
                  if (isScrubbingTimeline) {
                    seekFromClientX(e.clientX);
                  }
                }}
                onPointerUp={(e) => {
                  if (isScrubbingTimeline) {
                    setIsScrubbingTimeline(false);
                    try {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    } catch {
                      // ignore
                    }
                  }
                }}
                onPointerCancel={() => setIsScrubbingTimeline(false)}
                className="relative h-18 bg-neutral-900 border border-neutral-800 rounded-lg cursor-ew-resize select-none overflow-visible"
                style={{ touchAction: 'none' }}
              >
                {/* 3 Sequential Slot Blocks */}
                {imageSequence.map((slot, idx) => {
                  const leftPct = Math.max(0, Math.min(100, (slot.startTime / durationSec) * 100));
                  const widthPct = Math.max(
                    3,
                    Math.min(100 - leftPct, ((slot.endTime - slot.startTime) / durationSec) * 100)
                  );
                  const isSel = idx === activeSequenceIndex;

                  return (
                    <div
                      key={slot.id}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onSelectSequenceSlot(idx as 0 | 1 | 2, false);
                        setSelectedKeyframeId(null);
                        seekFromClientX(e.clientX);
                      }}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`absolute top-1.5 bottom-1.5 rounded-md border px-1.5 py-1 flex flex-col justify-between transition-colors cursor-pointer overflow-hidden ${
                        isSel
                          ? 'bg-amber-400/20 border-amber-400 z-10'
                          : slot.url
                          ? 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-500'
                          : 'bg-neutral-950/60 border-dashed border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 pointer-events-none">
                        <span
                          className={`text-[10px] font-bold truncate ${
                            isSel ? 'text-amber-300' : 'text-neutral-200'
                          }`}
                        >
                          Img {slot.slotNumber}
                        </span>
                        <span className="text-[9px] font-mono text-neutral-400 shrink-0">
                          {slot.startTime.toFixed(1)}–{slot.endTime.toFixed(1)}s
                        </span>
                      </div>
                      <div className="text-[9px] font-mono text-neutral-300 truncate pointer-events-none">
                        {slot.url
                          ? slot.keyframes?.length
                            ? `${Math.round(slot.keyframes[0].zoom * 100)}%→${Math.round(
                                slot.keyframes[slot.keyframes.length - 1].zoom * 100
                              )}%`
                            : `${Math.round(slot.zoom * 100)}%`
                          : 'Empty'}
                      </div>
                    </div>
                  );
                })}

                {/* Transition Boundary Badges */}
                {sequenceTransition.enabled && sequenceTransition.type !== 'hard-cut' && (
                  <>
                    {[imageSequence[0]?.endTime, imageSequence[1]?.endTime]
                      .filter((t): t is number => t !== undefined && t > 0 && t < durationSec)
                      .map((boundaryT, i) => (
                        <div
                          key={`tr-${i}`}
                          style={{ left: `${(boundaryT / durationSec) * 100}%` }}
                          className="absolute top-0 bottom-0 -translate-x-1/2 flex items-center pointer-events-none z-20"
                          title={`Transition at ${boundaryT.toFixed(1)}s`}
                        >
                          <div className="px-1 py-0.5 rounded bg-sky-500/90 text-white text-[8px] font-bold shadow">
                            ⇄
                          </div>
                        </div>
                      ))}
                  </>
                )}

                {/* Keyframe Diamond Markers across all 3 slots */}
                {imageSequence.flatMap((slot, sIdx) =>
                  (slot.keyframes || []).map((kf) => {
                    const leftPct = Math.max(0, Math.min(100, (kf.time / durationSec) * 100));
                    const isSlotActive = sIdx === activeSequenceIndex;
                    const isKfSelected = isSlotActive && activeSelectedKf?.id === kf.id;
                    return (
                      <button
                        key={kf.id}
                        type="button"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onSelectSequenceSlot(sIdx as 0 | 1 | 2, false);
                          setSelectedKeyframeId(kf.id);
                          onSeekPlayhead(kf.time);
                        }}
                        title={`Image ${slot.slotNumber} · ${kf.time.toFixed(2)}s · ${Math.round(
                          kf.zoom * 100
                        )}%`}
                        style={{ left: `${leftPct}%` }}
                        className="absolute bottom-1 -translate-x-1/2 z-30 flex flex-col items-center cursor-pointer"
                      >
                        <div
                          className={`w-3 h-3 rotate-45 border transition-transform ${
                            isKfSelected
                              ? 'bg-amber-300 border-white scale-125 shadow'
                              : isSlotActive
                              ? 'bg-amber-400 border-neutral-950'
                              : 'bg-neutral-400/70 border-neutral-950'
                          }`}
                        />
                      </button>
                    );
                  })
                )}

                {/* Playhead Needle */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-40"
                  style={{
                    left: `${Math.min(100, Math.max(0, (playheadTime / durationSec) * 100))}%`,
                  }}
                >
                  <div className="w-3 h-3 -ml-[5px] -mt-1 rounded-full bg-rose-500 border-2 border-white shadow" />
                </div>
              </div>

              <div className="flex justify-between text-[10px] font-mono text-neutral-500 px-0.5">
                <span>0.0s</span>
                <span>{(durationSec * 0.25).toFixed(1)}s</span>
                <span>{(durationSec * 0.5).toFixed(1)}s</span>
                <span>{(durationSec * 0.75).toFixed(1)}s</span>
                <span>{durationSec.toFixed(1)}s</span>
              </div>
            </div>

            {/* Transition Mode & Duration Controls */}
            <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-neutral-400 font-medium">Transition:</span>
                {(
                  [
                    { id: 'crossfade', label: 'Crossfade' },
                    { id: 'fade-in-out', label: 'Fade In/Out' },
                    { id: 'hard-cut', label: 'Hard Cut' },
                  ] as { id: SequenceTransitionType; label: string }[]
                ).map((tr) => {
                  const active =
                    tr.id === 'hard-cut'
                      ? !sequenceTransition.enabled || sequenceTransition.type === 'hard-cut'
                      : sequenceTransition.enabled && sequenceTransition.type === tr.id;
                  return (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() =>
                        onUpdateTransition({
                          enabled: tr.id !== 'hard-cut',
                          type: tr.id,
                        })
                      }
                      className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer transition-colors ${
                        active
                          ? 'bg-sky-500/20 text-sky-300 border-sky-400/60'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                      }`}
                    >
                      {tr.label}
                    </button>
                  );
                })}
              </div>

              {sequenceTransition.enabled && sequenceTransition.type !== 'hard-cut' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-400">Duration:</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={sequenceTransition.duration}
                    onChange={(e) =>
                      onUpdateTransition({ duration: Number(e.target.value) })
                    }
                    className="w-20 accent-sky-400 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-sky-300 w-8 text-right">
                    {sequenceTransition.duration.toFixed(2)}s
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2. SLOT SELECTOR TABS (Image 1 | Image 2 | Image 3) */}
          <div className="grid grid-cols-3 gap-2">
            {([0, 1, 2] as const).map((idx) => {
              const slot = imageSequence[idx];
              if (!slot) return null;
              const isSel = idx === activeSequenceIndex;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    onSelectSequenceSlot(idx, true);
                    setSelectedKeyframeId(null);
                  }}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                    isSel
                      ? 'bg-amber-400/15 border-amber-400 text-white shadow-sm'
                      : 'bg-neutral-950/70 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <div className="w-8 h-8 rounded bg-black overflow-hidden border border-neutral-700 shrink-0 flex items-center justify-center">
                    {slot.url ? (
                      slot.type === 'video' ? (
                        <video src={slot.url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={slot.url} alt={slot.name} className="w-full h-full object-cover" />
                      )
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-neutral-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold truncate">
                      Image {slot.slotNumber}
                    </div>
                    <div className="text-[9px] font-mono text-amber-300 truncate">
                      {slot.startTime.toFixed(1)}–{slot.endTime.toFixed(1)}s
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3. SELECTED SLOT EDITOR */}
          {!activeSlot?.url ? (
            <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-6 text-center space-y-3">
              <Upload className="w-7 h-7 text-amber-400 mx-auto" />
              <div className="text-xs font-semibold text-neutral-200">
                Image {activeSequenceIndex + 1} Slot is Empty
              </div>
              <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                Upload an image into Image {activeSequenceIndex + 1} ({activeSlot?.startTime.toFixed(1)}s – {activeSlot?.endTime.toFixed(1)}s) in Add Media to edit its full-canvas zoom and keyframes.
              </p>
              {onGoToMedia && (
                <button
                  type="button"
                  onClick={onGoToMedia}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Upload in Add Media →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Slot Header: Timing, Visibility & Layer Order */}
              <div className="bg-neutral-950/70 border border-neutral-800 p-4 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-amber-300 truncate max-w-[240px]">
                    Image {activeSlot.slotNumber} · {activeSlot.name || 'Weather Image'}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSequenceSlot(activeSequenceIndex, {
                          visible: !activeSlot.visible,
                        })
                      }
                      className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer border ${
                        activeSlot.visible
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                      }`}
                    >
                      {activeSlot.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>{activeSlot.visible ? 'Visible' : 'Hidden'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSequenceSlot(activeSequenceIndex, {
                          zOrder: activeSlot.zOrder === 'above-panel' ? 'below-panel' : 'above-panel',
                        })
                      }
                      className={`px-2 py-1 text-[10px] font-medium rounded flex items-center gap-1 cursor-pointer border ${
                        activeSlot.zOrder === 'above-panel'
                          ? 'bg-amber-400 text-black border-amber-300 font-bold'
                          : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
                      }`}
                    >
                      {activeSlot.zOrder === 'above-panel' ? (
                        <ArrowUp className="w-2.5 h-2.5" />
                      ) : (
                        <ArrowDown className="w-2.5 h-2.5" />
                      )}
                      <span>
                        {activeSlot.zOrder === 'above-panel' ? 'Above Panel' : 'Behind Panel'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Editable Start / End Timings */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-800/80">
                  <div>
                    <label className="text-[10px] text-neutral-400 flex items-center gap-1 mb-1">
                      <Clock className="w-2.5 h-2.5 text-amber-400" />
                      Start Time (s)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, activeSlot.endTime - 0.2)}
                      step={0.1}
                      value={activeSlot.startTime}
                      onChange={(e) =>
                        handleUpdateSlotTiming('startTime', Number(e.target.value))
                      }
                      className="w-full px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 flex items-center gap-1 mb-1">
                      <Clock className="w-2.5 h-2.5 text-amber-400" />
                      End Time (s)
                    </label>
                    <input
                      type="number"
                      min={Math.min(durationSec, activeSlot.startTime + 0.2)}
                      max={durationSec}
                      step={0.1}
                      value={activeSlot.endTime}
                      onChange={(e) =>
                        handleUpdateSlotTiming('endTime', Number(e.target.value))
                      }
                      className="w-full px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-100"
                    />
                  </div>
                </div>
              </div>

              {/* Full-Canvas Unrestricted Image Zoom Controls (10% – 1000%, configurable) */}
              <div className="bg-neutral-950/70 border border-neutral-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <ZoomIn className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-neutral-200">
                      Full-Canvas Zoom ({minZoomPct}% – {maxZoomPct}%)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={minZoomPct}
                      max={maxZoomPct}
                      step={5}
                      value={currentZoomPct}
                      onChange={(e) =>
                        onChangeSlotTransform(activeSequenceIndex, {
                          zoom: clampZoom(
                            (Number(e.target.value) || 100) / 100,
                            slotMinZoom,
                            slotMaxZoom
                          ),
                        })
                      }
                      className="w-16 text-xs font-mono font-bold text-amber-300 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 tabular-nums text-right"
                    />
                    <span className="text-[11px] font-mono text-neutral-400">%</span>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeSlotTransform(activeSequenceIndex, { zoom: 1.0 })
                      }
                      className="text-[11px] text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Reset Zoom</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSlotTransform(activeSequenceIndex, {
                        zoom: clampZoom(
                          Number((displayTransform.zoom - 0.1).toFixed(2)),
                          slotMinZoom,
                          slotMaxZoom
                        ),
                      })
                    }
                    disabled={currentZoomPct <= minZoomPct}
                    className="px-2.5 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-700 text-neutral-100 font-bold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>−</span>
                    <span className="hidden sm:inline text-[10px]">Out</span>
                  </button>

                  <input
                    type="range"
                    min={minZoomPct}
                    max={maxZoomPct}
                    step={1}
                    value={currentZoomPct}
                    onChange={(e) =>
                      onChangeSlotTransform(activeSequenceIndex, {
                        zoom: clampZoom(
                          Number(e.target.value) / 100,
                          slotMinZoom,
                          slotMaxZoom
                        ),
                      })
                    }
                    className="flex-1 accent-amber-400 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      onChangeSlotTransform(activeSequenceIndex, {
                        zoom: clampZoom(
                          Number((displayTransform.zoom + 0.1).toFixed(2)),
                          slotMinZoom,
                          slotMaxZoom
                        ),
                      })
                    }
                    disabled={currentZoomPct >= maxZoomPct}
                    className="px-2.5 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-700 text-neutral-100 font-bold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>+</span>
                    <span className="hidden sm:inline text-[10px]">In</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {[25, 50, 100, 150, 200, 400, 600, 800].map((pct) => {
                      const isOverZone = pct > maxZoomPct || pct < minZoomPct;
                      return (
                        <button
                          key={pct}
                          type="button"
                          disabled={isOverZone}
                          onClick={() =>
                            onChangeSlotTransform(activeSequenceIndex, {
                              zoom: clampZoom(pct / 100, slotMinZoom, slotMaxZoom),
                            })
                          }
                          className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                            isOverZone
                              ? 'bg-neutral-950 text-neutral-600 border border-neutral-900 cursor-not-allowed opacity-50'
                              : Math.abs(currentZoomPct - pct) <= 3
                              ? 'bg-amber-400 text-black font-bold cursor-pointer'
                              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 cursor-pointer'
                          }`}
                          title={
                            isOverZone
                              ? `Blocked by Zoom Zone Bar (${maxZoomPct}% max)`
                              : `Set zoom to ${pct}%`
                          }
                        >
                          {pct}%
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                    <span>Min:</span>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      step={5}
                      value={minZoomPct}
                      onChange={(e) =>
                        onUpdateSequenceSlot(activeSequenceIndex, {
                          minZoom: Math.max(0.05, Math.min(1.0, (Number(e.target.value) || 10) / 100)),
                        })
                      }
                      className="w-12 px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 font-mono text-neutral-200 text-right"
                      title="Minimum zoom (%)"
                    />
                    <span>%</span>
                  </div>
                </div>

                {/* Image Zoom Zone Bar — hard upper zoom boundary */}
                <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                        <span>Zoom Zone Limit Bar</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                          Max {maxZoomPct}%
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        Image, mouse wheel aur keyframes is zone limit se zyada zoom nahi honge
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={25}
                        max={2000}
                        step={5}
                        value={maxZoomPct}
                        onChange={(e) => {
                          const rawPct = Math.max(25, Math.min(2000, Number(e.target.value) || 100));
                          const nextMax = Math.max(slotMinZoom + 0.05, rawPct / 100);
                          onUpdateSequenceSlot(activeSequenceIndex, { maxZoom: nextMax });
                        }}
                        className="w-16 px-1.5 py-0.5 rounded bg-neutral-950 border border-neutral-700 font-mono text-xs font-bold text-emerald-300 text-right"
                        title="Max Zoom Zone Cap (%)"
                      />
                      <span className="text-[10px] font-mono text-neutral-400">%</span>
                    </div>
                  </div>

                  {/* Visual Zone Meter + Slider */}
                  <div className="space-y-1.5">
                    <div className="relative h-2.5 w-full rounded-full bg-neutral-950 border border-neutral-800 overflow-hidden">
                      {/* Allowed zoom zone fill */}
                      <div
                        className="absolute inset-y-0 left-0 bg-emerald-500/30 border-r-2 border-emerald-400"
                        style={{
                          width: `${Math.max(3, Math.min(100, (maxZoomPct / 1000) * 100))}%`,
                        }}
                      />
                      {/* Current zoom indicator bar */}
                      <div
                        className="absolute inset-y-0 left-0 bg-amber-400/80 transition-all duration-75"
                        style={{
                          width: `${Math.max(1, Math.min(100, (currentZoomPct / 1000) * 100))}%`,
                        }}
                      />
                    </div>

                    <input
                      type="range"
                      min={25}
                      max={1000}
                      step={5}
                      value={Math.min(1000, maxZoomPct)}
                      onChange={(e) => {
                        const nextMax = Math.max(slotMinZoom + 0.05, Number(e.target.value) / 100);
                        onUpdateSequenceSlot(activeSequenceIndex, { maxZoom: nextMax });
                      }}
                      className="w-full accent-emerald-400 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                      title="Slide to set Image Max Zoom Zone Bar"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-[10px] text-neutral-500">Quick Zone Cap:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[100, 120, 150, 200, 300, 500, 1000].map((capPct) => (
                        <button
                          key={capPct}
                          type="button"
                          onClick={() =>
                            onUpdateSequenceSlot(activeSequenceIndex, {
                              maxZoom: Math.max(slotMinZoom + 0.05, capPct / 100),
                            })
                          }
                          className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer ${
                            Math.abs(maxZoomPct - capPct) <= 2
                              ? 'bg-emerald-500 text-black font-bold'
                              : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                          }`}
                        >
                          {capPct === 1000 ? '1000% (Max)' : `${capPct}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {hasPendingUncommittedEdit && (
                  <div className="text-[10px] text-amber-300 font-medium">
                    Previewing @ {playheadTime.toFixed(2)}s — click Add Keyframe below or enable Auto Keyframes
                  </div>
                )}
              </div>

              {/* Automatic & Manual Keyframes for this Slot */}
              <div className="bg-neutral-950/70 border border-neutral-800 p-4 rounded-xl space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Image {activeSlot.slotNumber} Keyframes & Animation</span>
                  </h4>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {onToggleAutoKeyframes && (
                      <button
                        type="button"
                        onClick={onToggleAutoKeyframes}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border cursor-pointer transition-colors ${
                          autoKeyframesEnabled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/70'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            autoKeyframesEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
                          }`}
                        />
                        <span>Auto KF: {autoKeyframesEnabled ? 'ON' : 'OFF'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleAddOrUpdateKeyframe}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Diamond className="w-3 h-3 fill-current" />
                      <span>{nearKeyframe ? 'Update Keyframe' : 'Add Keyframe'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetSlotAnimation}
                      className="px-2 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-[11px] cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Auto-Animation Preset Selector (Slides + Zoom + Pan + Combos) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-8">
                    <label className="text-[10px] text-neutral-400 block mb-1">
                      Automatic Slide / Zoom Preset
                    </label>
                    <select
                      value={activeSlot.animationPreset}
                      onChange={(e) =>
                        handleApplySlotPreset(e.target.value as AutoAnimationPreset)
                      }
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    >
                      {AUTO_ANIMATION_PRESET_OPTIONS.filter(
                        (opt) => opt.id !== 'custom' || activeSlot.animationPreset === 'custom'
                      ).map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="text-[10px] text-neutral-400 block mb-1">
                      Anim Duration (s)
                    </label>
                    <input
                      type="number"
                      min={0.2}
                      max={Math.max(0.2, Number((durationSec - activeSlot.startTime).toFixed(2)))}
                      step={0.1}
                      value={Number(
                        (
                          activeSlot.animationDuration ||
                          activeSlot.endTime - activeSlot.startTime
                        ).toFixed(2)
                      )}
                      onChange={(e) => {
                        const d = Number(e.target.value);
                        if (activeSlot.animationPreset !== 'none' && activeSlot.animationPreset !== 'custom') {
                          handleApplySlotPreset(activeSlot.animationPreset, d);
                        } else {
                          onUpdateSequenceSlot(activeSequenceIndex, { animationDuration: d });
                        }
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono text-amber-300"
                    />
                  </div>
                </div>

                {/* Quick Slide & Zoom Preset Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'slide-left-right', label: 'Slide L → R', sub: 'Proportional L→R' },
                      { id: 'slide-right-left', label: 'Slide R → L', sub: 'Proportional R→L' },
                      { id: 'slide-in-left', label: 'Slide In Left', sub: 'Gentle In Left' },
                      { id: 'slide-in-right', label: 'Slide In Right', sub: 'Gentle In Right' },
                      { id: 'zoom-in', label: 'Zoom In', sub: `${currentZoomPct}%→${defaultPeakPct}%` },
                      { id: 'zoom-out', label: 'Zoom Out', sub: `${defaultPeakPct}%→${currentZoomPct}%` },
                      { id: 'zoom-in-slide-left', label: 'Zoom + Slide L', sub: 'Light Zoom + L' },
                      { id: 'none', label: 'Static (None)', sub: 'No keyframes' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleApplySlotPreset(opt.id)}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                        activeSlot.animationPreset === opt.id
                          ? 'border-amber-400 bg-amber-400/15 text-white'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div className="text-[11px] font-semibold">{opt.label}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{opt.sub}</div>
                    </button>
                  ))}
                </div>

                {/* Easing Curve */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-neutral-400">Interpolation:</span>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'ease-in-out', label: 'Ease In-Out' },
                        { id: 'linear', label: 'Linear' },
                        { id: 'ease-in', label: 'Ease In' },
                        { id: 'ease-out', label: 'Ease Out' },
                      ] as { id: AnimationEasing; label: string }[]
                    ).map((curve) => (
                      <button
                        key={curve.id}
                        type="button"
                        onClick={() =>
                          onUpdateSequenceSlot(activeSequenceIndex, { easing: curve.id })
                        }
                        className={`px-2 py-1 rounded text-[10px] font-medium border cursor-pointer transition-colors ${
                          (activeSlot.easing || 'ease-in-out') === curve.id
                            ? 'bg-amber-400 text-black border-amber-300 font-bold'
                            : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
                        }`}
                      >
                        {curve.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keyframes Chips & Inspector */}
                {sortedKeyframes.length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-neutral-800/80">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {sortedKeyframes.map((kf, idx) => {
                          const isSel = activeSelectedKf?.id === kf.id;
                          return (
                            <button
                              key={kf.id}
                              type="button"
                              onClick={() => {
                                setSelectedKeyframeId(kf.id);
                                onSeekPlayhead(kf.time);
                              }}
                              className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-1 cursor-pointer border transition-colors ${
                                isSel
                                  ? 'bg-amber-400 text-black border-amber-300 font-bold'
                                  : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                              }`}
                            >
                              <span>K{idx + 1}</span>
                              <span>· {kf.time.toFixed(2)}s</span>
                              <span>· {Math.round(kf.zoom * 100)}%</span>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplySlotPreset('none')}
                        className="text-[10px] text-neutral-400 hover:text-rose-400 cursor-pointer"
                      >
                        Clear Keyframes
                      </button>
                    </div>

                    {activeSelectedKf && (
                      <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-amber-300">
                            Edit Keyframe ({activeSelectedKf.time.toFixed(2)}s)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteKeyframe(activeSelectedKf.id)}
                            className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-neutral-400 block mb-1">
                              Time (s)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={durationSec}
                              step={0.1}
                              value={activeSelectedKf.time}
                              onChange={(e) =>
                                handleUpdateKeyframeField(activeSelectedKf.id, {
                                  time: Number(e.target.value),
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-100"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-neutral-400 block mb-1">
                              Zoom (%)
                            </label>
                            <input
                              type="number"
                              min={minZoomPct}
                              max={maxZoomPct}
                              step={5}
                              value={Math.round(activeSelectedKf.zoom * 100)}
                              onChange={(e) =>
                                handleUpdateKeyframeField(activeSelectedKf.id, {
                                  zoom: (Number(e.target.value) || 100) / 100,
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-xs font-mono text-amber-300"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-neutral-400 block mb-1">
                              Horizontal X (px)
                            </label>
                            <input
                              type="number"
                              step={10}
                              value={Math.round(activeSelectedKf.posX)}
                              onChange={(e) =>
                                handleUpdateKeyframeField(activeSelectedKf.id, {
                                  posX: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-100"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-neutral-400 block mb-1">
                              Vertical Y (px)
                            </label>
                            <input
                              type="number"
                              step={10}
                              value={Math.round(activeSelectedKf.posY)}
                              onChange={(e) =>
                                handleUpdateKeyframeField(activeSelectedKf.id, {
                                  posY: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-100"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-neutral-400 block mb-1">
                              Rotation (°)
                            </label>
                            <input
                              type="number"
                              min={-360}
                              max={360}
                              step={5}
                              value={Math.round(activeSelectedKf.rotation ?? 0)}
                              onChange={(e) =>
                                handleUpdateKeyframeField(activeSelectedKf.id, {
                                  rotation: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-100"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-neutral-400 block mb-1">
                              Opacity (%)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={5}
                              value={Math.round((activeSelectedKf.opacity ?? 1) * 100)}
                              onChange={(e) =>
                                handleUpdateKeyframeField(activeSelectedKf.id, {
                                  opacity: Math.max(0, Math.min(1, (Number(e.target.value) || 0) / 100)),
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-100"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Full-Canvas Unrestricted Position, Rotation, Base Size, Opacity & Corners */}
              <div className="bg-neutral-950/70 border border-neutral-800 p-4 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-amber-400" />
                    <span>Full-Canvas Position (px), Rotation & Appearance</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeSlotTransform(activeSequenceIndex, {
                        posX: 0,
                        posY: 0,
                        rotation: 0,
                        opacity: 1.0,
                      });
                      onUpdateSequenceSlot(activeSequenceIndex, {
                        baseScalePercent: 88,
                        opacity: 1.0,
                        rotation: 0,
                        borderRadius: 20,
                      });
                    }}
                    className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Position</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-neutral-400">Horizontal X (px)</span>
                      <input
                        type="number"
                        step={10}
                        value={Math.round(displayTransform.posX)}
                        onChange={(e) =>
                          onChangeSlotTransform(activeSequenceIndex, {
                            posX: Number(e.target.value) || 0,
                          })
                        }
                        className="w-20 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-100 text-right"
                      />
                    </div>
                    <input
                      type="range"
                      min={-1200}
                      max={1200}
                      step={5}
                      value={Math.max(-1200, Math.min(1200, Math.round(displayTransform.posX)))}
                      onChange={(e) =>
                        onChangeSlotTransform(activeSequenceIndex, {
                          posX: Number(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-neutral-400">Vertical Y (px)</span>
                      <input
                        type="number"
                        step={10}
                        value={Math.round(displayTransform.posY)}
                        onChange={(e) =>
                          onChangeSlotTransform(activeSequenceIndex, {
                            posY: Number(e.target.value) || 0,
                          })
                        }
                        className="w-20 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-100 text-right"
                      />
                    </div>
                    <input
                      type="range"
                      min={-1600}
                      max={1200}
                      step={5}
                      value={Math.max(-1600, Math.min(1200, Math.round(displayTransform.posY)))}
                      onChange={(e) =>
                        onChangeSlotTransform(activeSequenceIndex, {
                          posY: Number(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-neutral-400 flex items-center gap-1">
                        <Sliders className="w-2.5 h-2.5" />
                        Base Size (at 100%)
                      </span>
                      <span className="text-neutral-200 font-mono">
                        {activeSlot.baseScalePercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={150}
                      value={activeSlot.baseScalePercent}
                      onChange={(e) =>
                        onUpdateSequenceSlot(activeSequenceIndex, {
                          baseScalePercent: Number(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-neutral-400">Rotation (°) & Corners</span>
                      <span className="text-neutral-200 font-mono">
                        {Math.round(displayTransform.rotation ?? activeSlot.rotation ?? 0)}° · {activeSlot.borderRadius}px
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        value={Math.round(displayTransform.rotation ?? activeSlot.rotation ?? 0)}
                        onChange={(e) =>
                          onChangeSlotTransform(activeSequenceIndex, {
                            rotation: Number(e.target.value),
                          })
                        }
                        className="w-1/2 accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                        title="Rotation (degrees)"
                      />
                      <input
                        type="range"
                        min={0}
                        max={48}
                        value={activeSlot.borderRadius}
                        onChange={(e) =>
                          onUpdateSequenceSlot(activeSequenceIndex, {
                            borderRadius: Number(e.target.value),
                          })
                        }
                        className="w-1/2 accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                        title="Corner Radius"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-neutral-400">Opacity</span>
                      <span className="text-neutral-200 font-mono">
                        {Math.round((displayTransform.opacity ?? activeSlot.opacity ?? 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.0}
                      step={0.05}
                      value={displayTransform.opacity ?? activeSlot.opacity ?? 1.0}
                      onChange={(e) =>
                        onChangeSlotTransform(activeSequenceIndex, {
                          opacity: Number(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeTemplate === 'template-2' ? (
        <div className="space-y-5">
          {/* Template 2 Lower Section Bounds & Background Fit Mode */}
          <div className="bg-neutral-950/70 border border-neutral-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold text-neutral-200">
                  Template 2 Background & Lower Section (~50%)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onChangeTemplate2LowerMedia({
                    heightPercent: 50,
                    offsetY: 0,
                    bgFitMode: 'fill',
                    bgScale: 1.0,
                    bgMoveX: 0,
                    bgMoveY: 0,
                  });
                  updateBgTransform({ zoom: 1.0, posX: 0, posY: 0 });
                }}
                className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Background Fill / Fit / Custom Mode */}
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1.5">
                Background Positioning Mode (Layer 1)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'fill', label: 'Fill', sub: 'Edge-to-edge' },
                    { id: 'fit', label: 'Fit', sub: 'Whole frame' },
                    { id: 'custom', label: 'Custom', sub: 'Drag & wheel' },
                  ] as { id: BackgroundFitMode; label: string; sub: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeTemplate2LowerMedia({ bgFitMode: m.id })}
                    className={`p-2 rounded-lg border text-left text-xs cursor-pointer transition-colors ${
                      (template2LowerMedia.bgFitMode || 'fill') === m.id
                        ? 'border-sky-400 bg-sky-500/15 text-white'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-[10px] text-neutral-400">{m.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-400">Lower Area Size</span>
                  <span className="text-sky-300 font-mono">
                    {template2LowerMedia.heightPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={35}
                  max={70}
                  value={template2LowerMedia.heightPercent}
                  onChange={(e) =>
                    onChangeTemplate2LowerMedia({ heightPercent: Number(e.target.value) })
                  }
                  className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-400">Lower Vertical Offset</span>
                  <span className="text-sky-300 font-mono">
                    {template2LowerMedia.offsetY}
                  </span>
                </div>
                <input
                  type="range"
                  min={-25}
                  max={25}
                  value={template2LowerMedia.offsetY}
                  onChange={(e) =>
                    onChangeTemplate2LowerMedia({ offsetY: Number(e.target.value) })
                  }
                  className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onChangeTemplate2LowerMedia({ slotBaseFill: 'cover' })}
                className={`p-2 rounded-lg border text-left text-xs cursor-pointer ${
                  template2LowerMedia.slotBaseFill !== 'contain'
                    ? 'border-sky-400 bg-sky-500/10 text-white'
                    : 'border-neutral-800 bg-neutral-900/60 text-neutral-400'
                }`}
              >
                <div className="font-semibold">3-Image Fill (No Gaps)</div>
                <div className="text-[10px] text-neutral-400">Edge-to-edge lower footage</div>
              </button>

              <button
                type="button"
                onClick={() => onChangeTemplate2LowerMedia({ slotBaseFill: 'contain' })}
                className={`p-2 rounded-lg border text-left text-xs cursor-pointer ${
                  template2LowerMedia.slotBaseFill === 'contain'
                    ? 'border-sky-400 bg-sky-500/10 text-white'
                    : 'border-neutral-800 bg-neutral-900/60 text-neutral-400'
                }`}
              >
                <div className="font-semibold">3-Image Fit Aspect</div>
                <div className="text-[10px] text-neutral-400">Show whole width/height</div>
              </button>
            </div>
          </div>

          {/* Lower Background Video/Image Zoom & Position */}
          <div className="bg-neutral-950/70 border border-neutral-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ZoomIn className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold text-neutral-200">
                  Background Zoom & Position (0.25x – 4.00x)
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-sky-300 bg-neutral-900 px-2.5 py-0.5 rounded border border-neutral-800">
                {bgLiveTransform.zoom.toFixed(2)}x ({Math.round(bgLiveTransform.zoom * 100)}%)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  updateBgTransform({
                    zoom: clampTrackScale(Number((bgLiveTransform.zoom - 0.1).toFixed(2)), 0.25, 4.0),
                  })
                }
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-bold text-sm cursor-pointer"
              >
                -
              </button>
              <input
                type="range"
                min={0.25}
                max={4.0}
                step={0.05}
                value={bgLiveTransform.zoom}
                onChange={(e) =>
                  updateBgTransform({ zoom: Number(e.target.value) })
                }
                className="flex-1 accent-sky-400 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
              <button
                type="button"
                onClick={() =>
                  updateBgTransform({
                    zoom: clampTrackScale(Number((bgLiveTransform.zoom + 0.1).toFixed(2)), 0.25, 4.0),
                  })
                }
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-bold text-sm cursor-pointer"
              >
                +
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-400">Move X</span>
                  <span className="text-neutral-200 font-mono">{Math.round(bgLiveTransform.posX)}</span>
                </div>
                <input
                  type="range"
                  min={-150}
                  max={150}
                  value={Math.round(bgLiveTransform.posX)}
                  onChange={(e) =>
                    updateBgTransform({ posX: Number(e.target.value), ...(template2LowerMedia.bgFitMode !== 'custom' ? {} : {}) })
                  }
                  className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-400">Move Y</span>
                  <span className="text-neutral-200 font-mono">{Math.round(bgLiveTransform.posY)}</span>
                </div>
                <input
                  type="range"
                  min={-150}
                  max={150}
                  value={Math.round(bgLiveTransform.posY)}
                  onChange={(e) =>
                    updateBgTransform({ posY: Number(e.target.value) })
                  }
                  className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-800/80">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-400">Dimming</span>
                  <span className="text-neutral-200 font-mono">
                    {Math.round(template2LowerMedia.bgDimness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.6}
                  step={0.05}
                  value={template2LowerMedia.bgDimness}
                  onChange={(e) =>
                    onChangeTemplate2LowerMedia({ bgDimness: Number(e.target.value) })
                  }
                  className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Loop Motion
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['static', 'subtle-drift', 'ken-burns'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onChangeTemplate2LowerMedia({ bgMotionType: m })}
                      className={`py-1 rounded text-[10px] font-medium border cursor-pointer ${
                        template2LowerMedia.bgMotionType === m
                          ? 'bg-sky-500 text-black border-sky-300 font-bold'
                          : 'bg-neutral-900 text-neutral-300 border-neutral-800'
                      }`}
                    >
                      {m === 'static' ? 'Static' : m === 'subtle-drift' ? 'Drift' : 'Zoom'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Background Layout Mode */}
          <div className="bg-neutral-950/70 border border-neutral-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-neutral-200">
                  Weather Background Layout
                </span>
              </div>
              <span className="text-[11px] text-neutral-400">
                Bottom layer (Layer 1)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange({ backgroundFitMode: 'cover' })}
                className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  adjust.backgroundFitMode !== 'framed'
                    ? 'border-amber-400 bg-amber-500/10 text-white'
                    : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="text-xs font-semibold">Full-Screen Background</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  Fills 9:16 screen behind sequence & panel
                </div>
              </button>

              <button
                type="button"
                onClick={() => onChange({ backgroundFitMode: 'framed' })}
                className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  adjust.backgroundFitMode === 'framed'
                    ? 'border-amber-400 bg-amber-500/10 text-white'
                    : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="text-xs font-semibold">Framed Card + Blur</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  Rounded clip card over blurred backdrop
                </div>
              </button>
            </div>

            {adjust.backgroundFitMode !== 'framed' && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(
                  [
                    { id: 'fill', label: 'Fill', sub: 'Cover 9:16' },
                    { id: 'fit', label: 'Fit', sub: 'Show entire frame' },
                    { id: 'custom', label: 'Custom', sub: 'Free drag & wheel' },
                  ] as { id: BackgroundFitMode; label: string; sub: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChange({ fitMode: m.id })}
                    className={`p-2 rounded-lg border text-left text-xs cursor-pointer transition-colors ${
                      (adjust.fitMode || 'fill') === m.id
                        ? 'border-rose-500 bg-rose-500/15 text-white'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-[10px] text-neutral-400">{m.sub}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual Background Zoom In / Zoom Out */}
          <div className="bg-neutral-950/70 border border-neutral-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ZoomIn className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold text-neutral-200">
                  Background Footage Zoom & Crop (0.25x – 4.00x)
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-rose-400 bg-neutral-900 px-2.5 py-0.5 rounded border border-neutral-800">
                {bgLiveTransform.zoom.toFixed(2)}x ({Math.round(bgLiveTransform.zoom * 100)}%)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  updateBgTransform({
                    zoom: clampTrackScale(Number((bgLiveTransform.zoom - 0.1).toFixed(2)), 0.25, 4.0),
                  })
                }
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
              >
                -
              </button>

              <input
                type="range"
                min={0.25}
                max={4.0}
                step={0.02}
                value={bgLiveTransform.zoom}
                onChange={(e) => updateBgTransform({ zoom: Number(e.target.value) })}
                className="flex-1 accent-rose-600 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />

              <button
                type="button"
                onClick={() =>
                  updateBgTransform({
                    zoom: clampTrackScale(Number((bgLiveTransform.zoom + 0.1).toFixed(2)), 0.25, 4.0),
                  })
                }
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
              >
                +
              </button>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[0.7, 1.0, 1.25, 1.5, 2.0, 3.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateBgTransform({ zoom: preset })}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                      Math.abs(bgLiveTransform.zoom - preset) < 0.03
                        ? 'bg-rose-600 text-white font-semibold'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                    }`}
                  >
                    {preset.toFixed(2)}x
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => updateBgTransform({ zoom: 1.0, posX: 0, posY: 0 })}
                className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 p-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Background Footage Position */}
          <div className="bg-neutral-950/70 border border-neutral-800 p-4 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-rose-500" />
                Background Footage Position
              </h4>
              <span className="text-[11px] text-rose-400/90 font-medium">
                Drag or scroll wheel on preview
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-neutral-400">Move left / right (X)</span>
                <span className="text-neutral-200 font-mono tabular-nums bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  {Math.round(bgLiveTransform.posX) > 0
                    ? `+${Math.round(bgLiveTransform.posX)}`
                    : Math.round(bgLiveTransform.posX)}
                </span>
              </div>
              <input
                type="range"
                min={-150}
                max={150}
                value={Math.round(bgLiveTransform.posX)}
                onChange={(e) => updateBgTransform({ posX: Number(e.target.value) })}
                className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-neutral-400">Move up / down (Y)</span>
                <span className="text-neutral-200 font-mono tabular-nums bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  {Math.round(bgLiveTransform.posY) > 0
                    ? `+${Math.round(bgLiveTransform.posY)}`
                    : Math.round(bgLiveTransform.posY)}
                </span>
              </div>
              <input
                type="range"
                min={-150}
                max={150}
                value={Math.round(bgLiveTransform.posY)}
                onChange={(e) => updateBgTransform({ posY: Number(e.target.value) })}
                className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Contrast Dimming, Blur & Motion */}
          <div className="border-t border-neutral-800/80 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-400">Blur Intensity</span>
                  <span className="text-neutral-200 font-mono tabular-nums bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                    {adjust.bgBlur}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={adjust.bgBlur}
                  onChange={(e) => onChange({ bgBlur: Number(e.target.value) })}
                  className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-400">Background Dimming</span>
                  <span className="text-neutral-200 font-mono tabular-nums bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                    {Math.round(adjust.bgDarkness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.7}
                  step={0.05}
                  value={adjust.bgDarkness}
                  onChange={(e) => onChange({ bgDarkness: Number(e.target.value) })}
                  className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-neutral-400 flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Seamless Loop Motion (for still background photos)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'static', label: 'Static (Original)' },
                    { id: 'subtle-drift', label: 'Subtle Drift' },
                    { id: 'ken-burns', label: 'Slow Zoom' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange({ motionType: opt.id })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                      adjust.motionType === opt.id
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
        {onNextToTemplate ? (
          <button
            type="button"
            onClick={onNextToTemplate}
            className="w-full sm:w-1/2 py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Next: Template Settings</span>
            <span>→</span>
          </button>
        ) : onNextToSound ? (
          <button
            type="button"
            onClick={onNextToSound}
            className="w-full sm:w-1/2 py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Next: Background Sound</span>
            <span>→</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPreviewAndCreate}
          className={`${
            onNextToTemplate || onNextToSound ? 'w-full sm:w-1/2' : 'w-full'
          } py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-rose-950`}
        >
          <span>Preview & Export</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
};
