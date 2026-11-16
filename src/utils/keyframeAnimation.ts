import {
  AnimationEasing,
  AutoAnimationPreset,
  ImageKeyframe,
  ImageSequenceSlot,
  KeyframedTransformTrack,
  SequenceTransitionSettings,
} from '../types';

export interface EvaluatedImageTransform {
  zoom: number;
  posX: number;
  posY: number;
  opacity: number;
  rotation: number;
}

export interface ActiveSequenceRenderSlot {
  slot: ImageSequenceSlot;
  alpha: number;
}

export const AUTO_ANIMATION_PRESET_OPTIONS: {
  id: AutoAnimationPreset;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'none', label: 'None (Static)', shortLabel: 'None' },
  { id: 'slide-left-right', label: 'Slide Left to Right', shortLabel: 'Slide L→R' },
  { id: 'slide-right-left', label: 'Slide Right to Left', shortLabel: 'Slide R→L' },
  { id: 'slide-in-left', label: 'Slide In From Left', shortLabel: 'In Left' },
  { id: 'slide-in-right', label: 'Slide In From Right', shortLabel: 'In Right' },
  { id: 'slide-out-left', label: 'Slide Out to Left', shortLabel: 'Out Left' },
  { id: 'slide-out-right', label: 'Slide Out to Right', shortLabel: 'Out Right' },
  { id: 'zoom-in-slide-left', label: 'Zoom In + Slide Left', shortLabel: 'ZI + Slide L' },
  { id: 'zoom-in-slide-right', label: 'Zoom In + Slide Right', shortLabel: 'ZI + Slide R' },
  { id: 'zoom-in', label: 'Zoom In', shortLabel: 'Zoom In' },
  { id: 'zoom-out', label: 'Zoom Out', shortLabel: 'Zoom Out' },
  { id: 'zoom-in-out', label: 'Zoom In + Out', shortLabel: 'Zoom In/Out' },
  { id: 'pan-left', label: 'Pan Left', shortLabel: 'Pan Left' },
  { id: 'pan-right', label: 'Pan Right', shortLabel: 'Pan Right' },
  { id: 'pan-up', label: 'Pan Up', shortLabel: 'Pan Up' },
  { id: 'pan-down', label: 'Pan Down', shortLabel: 'Pan Down' },
  { id: 'zoom-in-pan-left', label: 'Zoom In + Pan Left', shortLabel: 'ZI + Pan L' },
  { id: 'zoom-in-pan-right', label: 'Zoom In + Pan Right', shortLabel: 'ZI + Pan R' },
  { id: 'zoom-out-pan-left', label: 'Zoom Out + Pan Left', shortLabel: 'ZO + Pan L' },
  { id: 'zoom-out-pan-right', label: 'Zoom Out + Pan Right', shortLabel: 'ZO + Pan R' },
  { id: 'custom', label: 'Custom Position Animation', shortLabel: 'Custom' },
];

export const DEFAULT_MIN_ZOOM = 0.1; // 10%
export const DEFAULT_MAX_ZOOM = 10.0; // 1000%

export function clampZoom(
  zoom: number,
  minZoom: number = DEFAULT_MIN_ZOOM,
  maxZoom: number = DEFAULT_MAX_ZOOM
): number {
  if (!Number.isFinite(zoom)) return 1.0;
  const lo = Math.max(0.05, Math.min(minZoom, maxZoom));
  const hi = Math.max(lo + 0.05, maxZoom);
  return Math.max(lo, Math.min(hi, zoom));
}

export function clampTrackScale(scale: number, min = 0.1, max = 10.0): number {
  if (!Number.isFinite(scale)) return 1.0;
  return Math.max(min, Math.min(max, scale));
}

export function applyEasing(t: number, easing: AnimationEasing): number {
  const x = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear':
      return x;
    case 'ease-in':
      return x * x * x;
    case 'ease-out':
      return 1 - Math.pow(1 - x, 3);
    case 'ease-in-out':
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}

export function sortKeyframes(keyframes: ImageKeyframe[]): ImageKeyframe[] {
  return [...keyframes].sort((a, b) => a.time - b.time);
}

/**
 * Clamps a moved keyframe timestamp inside [minTime, maxTime] while preventing
 * overlapping collisions with neighboring keyframes (minimum gap 0.05s).
 */
export function clampKeyframeTimeWithNeighbors(
  keyframes: ImageKeyframe[],
  kfId: string,
  desiredTime: number,
  minTime: number,
  maxTime: number,
  minGap: number = 0.05
): number {
  const sorted = sortKeyframes(keyframes);
  const idx = sorted.findIndex((k) => k.id === kfId);
  let low = minTime;
  let high = maxTime;

  if (idx !== -1) {
    if (idx > 0) {
      low = Math.max(low, sorted[idx - 1].time + minGap);
    }
    if (idx < sorted.length - 1) {
      high = Math.min(high, sorted[idx + 1].time - minGap);
    }
  }

  if (low > high) {
    return Number(((minTime + maxTime) / 2).toFixed(2));
  }
  return Number(Math.max(low, Math.min(high, desiredTime)).toFixed(2));
}

function interpolateKeyframesAtTime(
  keyframes: ImageKeyframe[],
  timeSec: number,
  easing: AnimationEasing,
  fallback: EvaluatedImageTransform,
  minScale: number,
  maxScale: number
): EvaluatedImageTransform {
  if (!keyframes || keyframes.length === 0) {
    return {
      zoom: clampTrackScale(fallback.zoom, minScale, maxScale),
      posX: fallback.posX,
      posY: fallback.posY,
      opacity: fallback.opacity,
      rotation: fallback.rotation,
    };
  }

  const sorted = sortKeyframes(keyframes);
  if (sorted.length === 1 || timeSec <= sorted[0].time) {
    return {
      zoom: clampTrackScale(sorted[0].zoom, minScale, maxScale),
      posX: sorted[0].posX,
      posY: sorted[0].posY,
      opacity: sorted[0].opacity ?? fallback.opacity,
      rotation: sorted[0].rotation ?? fallback.rotation,
    };
  }

  const last = sorted[sorted.length - 1];
  if (timeSec >= last.time) {
    return {
      zoom: clampTrackScale(last.zoom, minScale, maxScale),
      posX: last.posX,
      posY: last.posY,
      opacity: last.opacity ?? fallback.opacity,
      rotation: last.rotation ?? fallback.rotation,
    };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const k0 = sorted[i];
    const k1 = sorted[i + 1];
    if (timeSec >= k0.time && timeSec <= k1.time) {
      const span = k1.time - k0.time;
      if (span <= 0.0001) {
        return {
          zoom: clampTrackScale(k1.zoom, minScale, maxScale),
          posX: k1.posX,
          posY: k1.posY,
          opacity: k1.opacity ?? fallback.opacity,
          rotation: k1.rotation ?? fallback.rotation,
        };
      }
      const rawT = (timeSec - k0.time) / span;
      const e = applyEasing(rawT, easing || 'ease-in-out');
      const op0 = k0.opacity ?? fallback.opacity;
      const op1 = k1.opacity ?? fallback.opacity;
      const rot0 = k0.rotation ?? fallback.rotation;
      const rot1 = k1.rotation ?? fallback.rotation;

      return {
        zoom: clampTrackScale(k0.zoom + (k1.zoom - k0.zoom) * e, minScale, maxScale),
        posX: k0.posX + (k1.posX - k0.posX) * e,
        posY: k0.posY + (k1.posY - k0.posY) * e,
        opacity: op0 + (op1 - op0) * e,
        rotation: rot0 + (rot1 - rot0) * e,
      };
    }
  }

  return {
    zoom: clampTrackScale(last.zoom, minScale, maxScale),
    posX: last.posX,
    posY: last.posY,
    opacity: last.opacity ?? fallback.opacity,
    rotation: last.rotation ?? fallback.rotation,
  };
}

/**
 * Evaluates a slot's zoom, unrestricted X/Y position (1080p canonical px), opacity, and rotation
 * strictly from the current video timestamp and its time-based keyframes.
 */
export function evaluateImageTransformAtTime(
  slot: ImageSequenceSlot,
  timeSec: number,
  allowPendingEdit: boolean = false
): EvaluatedImageTransform {
  const minZ = slot.minZoom ?? DEFAULT_MIN_ZOOM;
  const maxZ = slot.maxZoom ?? DEFAULT_MAX_ZOOM;
  const fallback: EvaluatedImageTransform = {
    zoom: clampZoom(slot.zoom ?? 1.0, minZ, maxZ),
    posX: slot.posX ?? 0,
    posY: slot.posY ?? 0,
    opacity: slot.opacity ?? 1.0,
    rotation: slot.rotation ?? 0,
  };

  if (
    allowPendingEdit &&
    slot.pendingEditTime !== undefined &&
    Math.abs(timeSec - slot.pendingEditTime) < 0.08
  ) {
    return fallback;
  }

  return interpolateKeyframesAtTime(
    slot.keyframes || [],
    timeSec,
    slot.easing || 'ease-in-out',
    fallback,
    minZ,
    maxZ
  );
}

/**
 * Evaluates a general transform track (background, complete text panel, header/logo, body text)
 * at a given timestamp. When no keyframes exist, returns the fallback/static track transform.
 */
export function evaluateTrackTransformAtTime(
  track: KeyframedTransformTrack | undefined,
  timeSec: number,
  allowPendingEdit: boolean = false,
  fallback: Partial<EvaluatedImageTransform> = { zoom: 1.0, posX: 0, posY: 0 },
  minScale: number = 0.1,
  maxScale: number = 10.0
): EvaluatedImageTransform {
  const baseFb: EvaluatedImageTransform = {
    zoom: fallback.zoom ?? 1.0,
    posX: fallback.posX ?? 0,
    posY: fallback.posY ?? 0,
    opacity: fallback.opacity ?? 1.0,
    rotation: fallback.rotation ?? 0,
  };

  if (!track) {
    return {
      ...baseFb,
      zoom: clampTrackScale(baseFb.zoom, minScale, maxScale),
    };
  }

  const staticTransform: EvaluatedImageTransform = {
    zoom: clampTrackScale(track.scale ?? baseFb.zoom, minScale, maxScale),
    posX: track.posX ?? baseFb.posX,
    posY: track.posY ?? baseFb.posY,
    opacity: baseFb.opacity,
    rotation: baseFb.rotation,
  };

  if (
    allowPendingEdit &&
    track.pendingEditTime !== undefined &&
    Math.abs(timeSec - track.pendingEditTime) < 0.08
  ) {
    return staticTransform;
  }

  return interpolateKeyframesAtTime(
    track.keyframes || [],
    timeSec,
    track.easing || 'ease-in-out',
    staticTransform,
    minScale,
    maxScale
  );
}

/**
 * Returns light default target end zoom at 100% scale (107% gentle motion).
 */
export function getDefaultEndZoomForSlot(_slotNumber: 1 | 2 | 3): number {
  return 1.07;
}

/**
 * Generates automatic position & zoom keyframes for ANY track with light, size-proportional motion.
 * When an image is shrunk small (e.g. zoom = 0.25 or 0.4), both the zoom delta (~+7% relative)
 * and slide/pan distance scale down proportionally so motion never blows up on small images.
 */
export function generateTrackPresetKeyframes(
  preset: AutoAnimationPreset,
  startTime: number,
  endTime: number,
  baseZoom: number = 1.0,
  basePosX: number = 0,
  basePosY: number = 0,
  peakZoom?: number,
  slideDistancePx: number = 100,
  minZoom: number = DEFAULT_MIN_ZOOM,
  maxZoom: number = DEFAULT_MAX_ZOOM
): ImageKeyframe[] {
  const s = Number(Math.max(0, startTime).toFixed(2));
  const e = Number(Math.max(s + 0.1, endTime).toFixed(2));
  const mid = Number(((s + e) / 2).toFixed(2));
  const startZ = clampZoom(Number(baseZoom.toFixed(2)), minZoom, maxZoom);
  const relEndZ = Number((startZ + Math.max(0.02, startZ * 0.07)).toFixed(2));
  const endZ = clampZoom(
    peakZoom !== undefined ? Math.max(startZ, peakZoom) : relEndZ,
    minZoom,
    maxZoom
  );

  // Scale slide/pan pixel motion down smoothly when image is small (e.g. 0.3x zoom -> 30% of slide)
  const zoomScaleFactor =
    slideDistancePx >= 30 ? Math.max(0.25, Math.min(1.25, startZ)) : 1.0;
  const effSlide =
    slideDistancePx >= 30
      ? Math.max(12, Math.round(slideDistancePx * zoomScaleFactor))
      : slideDistancePx;
  const edgeSlide =
    slideDistancePx >= 30
      ? Math.max(24, Math.round(effSlide * 2.0))
      : Math.max(8, Math.round(effSlide * 2.0));
  const panDist = Math.max(6, Math.round(effSlide * 0.5));
  const comboSlide = Math.max(8, Math.round(effSlide * 0.75));

  const uid = () =>
    `kf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  switch (preset) {
    case 'slide-left-right':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX - effSlide, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX + effSlide, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'slide-right-left':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX + effSlide, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX - effSlide, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'slide-in-left':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX - edgeSlide, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'slide-in-right':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX + edgeSlide, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'slide-out-left':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX - edgeSlide, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'slide-out-right':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX + edgeSlide, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'zoom-in-slide-left':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX + comboSlide, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: endZ, posX: basePosX - comboSlide, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'zoom-in-slide-right':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX - comboSlide, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: endZ, posX: basePosX + comboSlide, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'zoom-in':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: endZ, posX: basePosX, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'zoom-out':
      return [
        { id: uid(), time: s, zoom: endZ, posX: basePosX, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'zoom-in-out':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: mid, zoom: endZ, posX: basePosX, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'pan-left':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX + panDist, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX - panDist, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'pan-right':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX - panDist, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX + panDist, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'pan-up':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX, posY: basePosY + panDist, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX, posY: basePosY - panDist, opacity: 1, rotation: 0 },
      ];
    case 'pan-down':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX, posY: basePosY - panDist, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX, posY: basePosY + panDist, opacity: 1, rotation: 0 },
      ];
    case 'zoom-in-pan-left':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX + panDist, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: endZ, posX: basePosX - panDist, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'zoom-in-pan-right':
      return [
        { id: uid(), time: s, zoom: startZ, posX: basePosX - panDist, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: endZ, posX: basePosX + panDist, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'zoom-out-pan-left':
      return [
        { id: uid(), time: s, zoom: endZ, posX: basePosX + panDist, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX - panDist, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'zoom-out-pan-right':
      return [
        { id: uid(), time: s, zoom: endZ, posX: basePosX - panDist, posY: basePosY, opacity: 1, rotation: 0 },
        { id: uid(), time: e, zoom: startZ, posX: basePosX + panDist, posY: basePosY, opacity: 1, rotation: 0 },
      ];
    case 'none':
    default:
      return [];
  }
}

/**
 * Generates automatic keyframes mapped strictly to the slot's [startTime, endTime] window.
 */
export function generateSlotPresetKeyframes(
  preset: AutoAnimationPreset,
  startTime: number,
  endTime: number,
  basePosX: number,
  basePosY: number,
  _slotNumber: 1 | 2 | 3 = 1,
  baseZoom: number = 1.0,
  minZoom: number = DEFAULT_MIN_ZOOM,
  maxZoom: number = DEFAULT_MAX_ZOOM
): ImageKeyframe[] {
  const safeStartZ = clampZoom(baseZoom, minZoom, maxZoom);
  const relPeak = clampZoom(
    Number((safeStartZ + Math.max(0.02, safeStartZ * 0.07)).toFixed(2)),
    minZoom,
    maxZoom
  );
  return generateTrackPresetKeyframes(
    preset,
    startTime,
    endTime,
    safeStartZ,
    basePosX,
    basePosY,
    relPeak,
    100,
    minZoom,
    maxZoom
  );
}

/**
 * Remaps existing keyframes proportionally when a slot's [startTime, endTime] or project duration changes.
 */
export function remapKeyframesToSlotWindow(
  keyframes: ImageKeyframe[],
  oldStart: number,
  oldEnd: number,
  newStart: number,
  newEnd: number
): ImageKeyframe[] {
  const oldSpan = Math.max(0.05, oldEnd - oldStart);
  const newSpan = Math.max(0.05, newEnd - newStart);
  return sortKeyframes(
    keyframes.map((kf) => {
      const norm = Math.max(0, Math.min(1, (kf.time - oldStart) / oldSpan));
      const remapped = Number((newStart + norm * newSpan).toFixed(2));
      return {
        ...kf,
        time: remapped,
      };
    })
  );
}

export function remapTrackDuration(
  track: KeyframedTransformTrack | undefined,
  oldDuration: number,
  newDuration: number
): KeyframedTransformTrack | undefined {
  if (!track) return track;
  return {
    ...track,
    animationDuration: track.animationDuration
      ? Number(Math.min(newDuration, track.animationDuration).toFixed(2))
      : undefined,
    keyframes: remapKeyframesToSlotWindow(
      track.keyframes || [],
      0,
      Math.max(0.5, oldDuration),
      0,
      Math.max(0.5, newDuration)
    ),
  };
}

/**
 * Finds an existing keyframe near a given timestamp (within toleranceSec).
 */
export function findKeyframeNearTime(
  keyframes: ImageKeyframe[],
  timeSec: number,
  toleranceSec: number = 0.08
): ImageKeyframe | null {
  let closest: ImageKeyframe | null = null;
  let bestDist = Infinity;
  for (const kf of keyframes) {
    const d = Math.abs(kf.time - timeSec);
    if (d <= toleranceSec && d < bestDist) {
      closest = kf;
      bestDist = d;
    }
  }
  return closest;
}

/**
 * Determines which sequential image(s) are visible at `timeSec` and their transition alpha.
 */
export function getActiveSequenceSlotsAtTime(
  sequence: ImageSequenceSlot[],
  transition: SequenceTransitionSettings,
  timeSec: number
): ActiveSequenceRenderSlot[] {
  const populated = sequence.filter((s) => s.visible && !!s.url);
  if (populated.length === 0) return [];

  const sorted = [...populated].sort((a, b) => a.startTime - b.startTime);

  const covering = sorted.filter((s, idx) => {
    const isLast = idx === sorted.length - 1;
    const withinEnd =
      isLast || (s.keyframes && s.keyframes.length > 0)
        ? timeSec <= s.endTime + 0.05 &&
          !sorted.some(
            (other) =>
              other.id !== s.id &&
              Math.abs(other.startTime - s.endTime) <= 0.05 &&
              timeSec >= other.startTime
          )
        : timeSec < s.endTime;
    return timeSec >= s.startTime && (timeSec < s.endTime || withinEnd);
  });

  if (covering.length === 0) {
    return [];
  }

  // If multiple slots intentionally overlap at this timestamp (e.g. expanded keyframe spans),
  // return all covering slots sorted by slotNumber so each image animates independently.
  if (covering.length > 1) {
    return [...covering]
      .sort((a, b) => a.slotNumber - b.slotNumber)
      .map((slot) => ({ slot, alpha: 1.0 }));
  }

  const primary = covering[0];
  const primaryIdx = sorted.findIndex((s) => s.id === primary.id);
  const isTransitionActive =
    transition.enabled &&
    transition.type !== 'hard-cut' &&
    transition.duration > 0.02;

  if (!isTransitionActive) {
    return [{ slot: primary, alpha: 1.0 }];
  }

  const slotLen = Math.max(0.2, primary.endTime - primary.startTime);
  const effectiveDur = Math.min(transition.duration, slotLen * 0.48);

  if (transition.type === 'fade-in-out') {
    let alpha = 1.0;
    const distFromStart = timeSec - primary.startTime;
    const distToEnd = primary.endTime - timeSec;
    if (primaryIdx > 0 && distFromStart < effectiveDur) {
      alpha = Math.min(alpha, Math.max(0, distFromStart / effectiveDur));
    }
    if (primaryIdx < sorted.length - 1 && distToEnd < effectiveDur) {
      alpha = Math.min(alpha, Math.max(0, distToEnd / effectiveDur));
    }
    return [{ slot: primary, alpha: Math.max(0, Math.min(1, alpha)) }];
  }

  const half = effectiveDur / 2;

  if (primaryIdx > 0) {
    const prevSlot = sorted[primaryIdx - 1];
    const boundary = primary.startTime;
    const prevSpan = Math.max(0.2, prevSlot.endTime - prevSlot.startTime);
    const localHalf = Math.min(half, prevSpan * 0.24);
    if (
      Math.abs(prevSlot.endTime - primary.startTime) <= 0.15 &&
      timeSec >= boundary - localHalf &&
      timeSec <= boundary + localHalf
    ) {
      const p = Math.max(0, Math.min(1, (timeSec - (boundary - localHalf)) / (localHalf * 2)));
      return [
        { slot: prevSlot, alpha: 1 - p },
        { slot: primary, alpha: p },
      ];
    }
  }

  if (primaryIdx < sorted.length - 1) {
    const nextSlot = sorted[primaryIdx + 1];
    const boundary = primary.endTime;
    const nextSpan = Math.max(0.2, nextSlot.endTime - nextSlot.startTime);
    const localHalf = Math.min(half, nextSpan * 0.24);
    if (
      Math.abs(primary.endTime - nextSlot.startTime) <= 0.15 &&
      timeSec >= boundary - localHalf &&
      timeSec <= boundary + localHalf
    ) {
      const p = Math.max(0, Math.min(1, (timeSec - (boundary - localHalf)) / (localHalf * 2)));
      return [
        { slot: primary, alpha: 1 - p },
        { slot: nextSlot, alpha: p },
      ];
    }
  }

  return [{ slot: primary, alpha: 1.0 }];
}
