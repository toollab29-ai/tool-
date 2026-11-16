import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  VideoProject,
  AdjustSettings,
  PanelSettings,
  Template2PanelSettings,
  Template2LowerMediaSettings,
  TimelineTrackId,
} from '../types';
import {
  renderCanvasFrame,
  getCanvasLayerBounds,
  getSlotAnchorPoint,
  RenderLayoutInfo,
  RectBox,
} from '../utils/canvasRenderer';
import {
  clampTrackScale,
  clampZoom,
  evaluateImageTransformAtTime,
  evaluateTrackTransformAtTime,
  getActiveSequenceSlotsAtTime,
} from '../utils/keyframeAnimation';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  Sparkles,
  Music,
  Volume2,
  VolumeX,
  Clock,
  Move,
  Layers,
  AlertTriangle,
  Diamond,
} from 'lucide-react';

type PreviewLayerKind = 'image' | 'text' | 'overlay' | 'text-header' | 'text-body';
type CornerId = 'nw' | 'ne' | 'sw' | 'se';

interface DesignPreviewProps {
  project: VideoProject;
  loadedMedia: HTMLImageElement | HTMLVideoElement | null;
  mediaLoadError?: string | null;
  loadedLogo: HTMLImageElement | null;
  loadedOverlayMap: Record<string, HTMLImageElement | HTMLVideoElement>;
  playheadTime: number;
  isPlaying: boolean;
  selectedTrackId?: TimelineTrackId;
  autoKeyframesEnabled?: boolean;
  onToggleAutoKeyframes?: () => void;
  onPauseForEdit?: () => void;
  onSelectTrack?: (trackId: TimelineTrackId) => void;
  onPlayheadChange: (timeSec: number) => void;
  onTogglePlaying: () => void;
  onOpenCreateModal: () => void;
  onUpdateDuration?: (sec: number) => void;
  onUpdateAdjust?: (updated: Partial<AdjustSettings>) => void;
  onUpdatePanel?: (updated: Partial<PanelSettings>) => void;
  onUpdateT2Panel?: (updated: Partial<Template2PanelSettings>) => void;
  onUpdateT2LowerMedia?: (updated: Partial<Template2LowerMediaSettings>) => void;
  onSelectSequenceSlot: (slotIndex: 0 | 1 | 2, jumpPlayhead?: boolean) => void;
  onChangeSlotTransform: (
    slotIndex: 0 | 1 | 2,
    updated: { zoom?: number; posX?: number; posY?: number; opacity?: number; rotation?: number }
  ) => void;
  onChangeTrackTransform?: (
    trackId: TimelineTrackId,
    updated: { zoom?: number; posX?: number; posY?: number; opacity?: number; rotation?: number }
  ) => void;
  onResetTrackPosition?: (trackId: TimelineTrackId) => void;
  onResetTrackScale?: (trackId: TimelineTrackId) => void;
  onLayoutInfoChange?: (info: {
    usedFontSize: number;
    requestedFontSize: number;
    wasAutoFitted: boolean;
    overflowWarning: boolean;
  }) => void;
}

// Selection boxes track true unrestricted canvas coordinates 1:1 (viewportRef clips with overflow-hidden).

export const DesignPreview: React.FC<DesignPreviewProps> = ({
  project,
  loadedMedia,
  mediaLoadError,
  loadedLogo,
  loadedOverlayMap,
  playheadTime,
  isPlaying,
  selectedTrackId,
  autoKeyframesEnabled = false,
  onToggleAutoKeyframes,
  onPauseForEdit,
  onSelectTrack,
  onPlayheadChange,
  onTogglePlaying,
  onOpenCreateModal,
  onUpdateDuration,
  onUpdateAdjust,
  onUpdatePanel,
  onUpdateT2Panel,
  onUpdateT2LowerMedia,
  onSelectSequenceSlot,
  onChangeSlotTransform,
  onChangeTrackTransform,
  onResetTrackPosition,
  onResetTrackScale,
  onLayoutInfoChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isPreviewMuted, setIsPreviewMuted] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastLayoutSigRef = useRef<string>('');
  const liveLayoutInfoRef = useRef<RenderLayoutInfo | null>(null);

  const [selectedLayer, setSelectedLayer] = useState<PreviewLayerKind>('text');
  const [hoveredTarget, setHoveredTarget] = useState<{
    kind: PreviewLayerKind;
    slotIndex?: 0 | 1 | 2;
  } | null>(null);

  const [activeDrag, setActiveDrag] = useState<{
    kind: PreviewLayerKind;
    slotIndex?: 0 | 1 | 2;
    mode: 'move' | 'resize';
    corner?: CornerId;
  } | null>(null);

  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initX: number;
    initY: number;
    initZoom: number;
    centerPxX: number;
    centerPxY: number;
    initDist: number;
  } | null>(null);

  const durationSec = project.durationSeconds || 8.0;
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const playheadRef = useRef<number>(playheadTime);

  useEffect(() => {
    if (!isPlaying || Math.abs(playheadRef.current - playheadTime) > 0.15) {
      playheadRef.current = playheadTime;
    }
  }, [playheadTime, isPlaying]);

  // Sync preview layer selection when user clicks a track in the horizontal timeline
  useEffect(() => {
    if (!selectedTrackId) return;
    if (selectedTrackId === 'background') setSelectedLayer('image');
    else if (selectedTrackId === 'panel') setSelectedLayer('text');
    else if (selectedTrackId === 'text-header') setSelectedLayer('text-header');
    else if (selectedTrackId === 'text-body') setSelectedLayer('text-body');
    else if (selectedTrackId.startsWith('slot-')) setSelectedLayer('overlay');
  }, [selectedTrackId]);

  const canvasW = project.resolution === '1080p' ? 1080 : 720;
  const canvasH = project.resolution === '1080p' ? 1920 : 1280;

  const naturalWidth =
    loadedMedia instanceof HTMLVideoElement
      ? loadedMedia.videoWidth || 1080
      : loadedMedia instanceof HTMLImageElement
      ? loadedMedia.naturalWidth || 1080
      : 1080;
  const naturalHeight =
    loadedMedia instanceof HTMLVideoElement
      ? loadedMedia.videoHeight || 1920
      : loadedMedia instanceof HTMLImageElement
      ? loadedMedia.naturalHeight || 1920
      : 1920;

  const overlayNaturalSizes = useMemo(() => {
    const map: Record<string, { width: number; height: number }> = {};
    for (const slot of project.imageSequence || []) {
      const el = loadedOverlayMap[slot.id];
      if (el instanceof HTMLVideoElement) {
        map[slot.id] = {
          width: el.videoWidth || 1080,
          height: el.videoHeight || 720,
        };
      } else if (el instanceof HTMLImageElement) {
        map[slot.id] = {
          width: el.naturalWidth || 1080,
          height: el.naturalHeight || 720,
        };
      } else {
        map[slot.id] = { width: 1080, height: 720 };
      }
    }
    return map;
  }, [project.imageSequence, loadedOverlayMap]);

  const activeSequenceAtPlayhead = useMemo(() => {
    return getActiveSequenceSlotsAtTime(
      project.imageSequence || [],
      project.sequenceTransition,
      playheadTime
    ).filter((entry) => !!loadedOverlayMap[entry.slot.id]);
  }, [project.imageSequence, project.sequenceTransition, playheadTime, loadedOverlayMap]);

  const primaryVisibleSlot =
    activeSequenceAtPlayhead.find(
      (e) => e.slot.slotNumber - 1 === project.activeSequenceIndex
    )?.slot ||
    activeSequenceAtPlayhead[activeSequenceAtPlayhead.length - 1]?.slot ||
    null;
  const hasVisibleSeqImage = activeSequenceAtPlayhead.length > 0;

  const layerBounds = useMemo(() => {
    return getCanvasLayerBounds(
      canvasW,
      canvasH,
      project,
      naturalWidth,
      naturalHeight,
      overlayNaturalSizes,
      playheadTime,
      !isPlaying
    );
  }, [
    canvasW,
    canvasH,
    project,
    naturalWidth,
    naturalHeight,
    overlayNaturalSizes,
    playheadTime,
    isPlaying,
  ]);

  const activeTrackForSelection: TimelineTrackId = useMemo(() => {
    if (selectedLayer === 'image') return 'background';
    if (selectedLayer === 'text-header') return 'text-header';
    if (selectedLayer === 'text-body') return 'text-body';
    if (selectedLayer === 'overlay') {
      const slotNum =
        primaryVisibleSlot?.slotNumber || ((project.activeSequenceIndex + 1) as 1 | 2 | 3);
      return (`slot-${slotNum}`) as TimelineTrackId;
    }
    return 'panel';
  }, [selectedLayer, primaryVisibleSlot, project.activeSequenceIndex]);

  const readLayerTransform = useCallback(
    (kind: PreviewLayerKind, slotIndex?: 0 | 1 | 2) => {
      const isT2 = project.activeTemplate === 'template-2';
      if (kind === 'overlay') {
        const idx = slotIndex ?? project.activeSequenceIndex ?? 0;
        const slot = project.imageSequence[idx];
        return slot
          ? evaluateImageTransformAtTime(slot, playheadTime, !isPlaying)
          : { zoom: 1.0, posX: 0, posY: 0 };
      }
      if (kind === 'image') {
        return isT2
          ? evaluateTrackTransformAtTime(
              project.template2.lowerMedia.bgTrack,
              playheadTime,
              !isPlaying,
              {
                zoom: project.template2.lowerMedia.bgScale || 1.0,
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
                zoom: project.adjust.scale || 1.0,
                posX: project.adjust.moveX || 0,
                posY: project.adjust.moveY || 0,
              },
              0.25,
              4.0
            );
      }
      if (kind === 'text-header') {
        return evaluateTrackTransformAtTime(
          isT2 ? project.template2.brandingTransform : project.brandingTransform,
          playheadTime,
          !isPlaying,
          { zoom: 1.0, posX: 0, posY: 0 },
          0.35,
          2.5
        );
      }
      if (kind === 'text-body') {
        return evaluateTrackTransformAtTime(
          isT2 ? project.template2.textTransform : project.textTransform,
          playheadTime,
          !isPlaying,
          { zoom: 1.0, posX: 0, posY: 0 },
          0.35,
          2.5
        );
      }
      return isT2
        ? evaluateTrackTransformAtTime(
            project.template2.panelTransform,
            playheadTime,
            !isPlaying,
            {
              zoom: project.template2.panel.panelScale ?? 1.0,
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
              zoom: project.panel.panelScale ?? 1.0,
              posX: project.panel.posX || 0,
              posY: project.panel.posY ?? -22,
            },
            0.35,
            2.2
          );
    },
    [project, playheadTime, isPlaying]
  );

  const writeLayerTransform = useCallback(
    (
      kind: PreviewLayerKind,
      patch: { zoom?: number; posX?: number; posY?: number },
      slotIndex?: 0 | 1 | 2
    ) => {
      if (kind === 'overlay') {
        const idx =
          slotIndex ??
          (primaryVisibleSlot
            ? ((primaryVisibleSlot.slotNumber - 1) as 0 | 1 | 2)
            : project.activeSequenceIndex);
        onChangeSlotTransform(idx, patch);
        return;
      }

      const trackId: TimelineTrackId =
        kind === 'image'
          ? 'background'
          : kind === 'text-header'
          ? 'text-header'
          : kind === 'text-body'
          ? 'text-body'
          : 'panel';

      if (onChangeTrackTransform) {
        onChangeTrackTransform(trackId, patch);
        return;
      }

      // Legacy fallback if onChangeTrackTransform is omitted
      if (kind === 'image') {
        if (project.activeTemplate === 'template-2') {
          onUpdateT2LowerMedia?.({
            ...(patch.zoom !== undefined ? { bgScale: clampTrackScale(patch.zoom, 0.25, 4.0) } : {}),
            ...(patch.posX !== undefined ? { bgMoveX: patch.posX } : {}),
            ...(patch.posY !== undefined ? { bgMoveY: patch.posY } : {}),
          });
        } else {
          onUpdateAdjust?.({
            ...(patch.zoom !== undefined ? { scale: clampTrackScale(patch.zoom, 0.25, 4.0) } : {}),
            ...(patch.posX !== undefined ? { moveX: patch.posX } : {}),
            ...(patch.posY !== undefined ? { moveY: patch.posY } : {}),
          });
        }
      } else if (kind === 'text') {
        if (project.activeTemplate === 'template-2') {
          onUpdateT2Panel?.({
            ...(patch.zoom !== undefined ? { panelScale: clampTrackScale(patch.zoom, 0.35, 2.2) } : {}),
            ...(patch.posX !== undefined ? { posX: patch.posX } : {}),
            ...(patch.posY !== undefined ? { posY: patch.posY } : {}),
          });
        } else {
          onUpdatePanel?.({
            ...(patch.zoom !== undefined ? { panelScale: clampTrackScale(patch.zoom, 0.35, 2.2) } : {}),
            ...(patch.posX !== undefined ? { posX: patch.posX } : {}),
            ...(patch.posY !== undefined ? { posY: patch.posY } : {}),
          });
        }
      }
    },
    [
      primaryVisibleSlot,
      project.activeSequenceIndex,
      project.activeTemplate,
      onChangeSlotTransform,
      onChangeTrackTransform,
      onUpdateT2LowerMedia,
      onUpdateAdjust,
      onUpdateT2Panel,
      onUpdatePanel,
    ]
  );

  const hitTestLayer = (
    canvasX: number,
    canvasY: number
  ): { kind: PreviewLayerKind; slotIndex?: 0 | 1 | 2 } => {
    const isInsidePanel =
      canvasX >= layerBounds.text.x &&
      canvasX <= layerBounds.text.x + layerBounds.text.width &&
      canvasY >= layerBounds.text.y &&
      canvasY <= layerBounds.text.y + layerBounds.text.height;

    const hitAbove = [...activeSequenceAtPlayhead]
      .reverse()
      .filter((e) => e.slot.zOrder === 'above-panel')
      .find((e) => {
        const b = layerBounds.overlayMap[e.slot.id];
        return (
          b &&
          canvasX >= b.x &&
          canvasX <= b.x + b.width &&
          canvasY >= b.y &&
          canvasY <= b.y + b.height
        );
      });

    if (hitAbove) {
      return { kind: 'overlay', slotIndex: (hitAbove.slot.slotNumber - 1) as 0 | 1 | 2 };
    }

    if (isInsidePanel) {
      // If already working inside Header or Body mode, keep direct click hit on that sub-element
      const hb = liveLayoutInfoRef.current?.headerBounds;
      const bb = liveLayoutInfoRef.current?.bodyBounds;
      if (selectedLayer === 'text-header' || selectedLayer === 'text-body') {
        if (
          hb &&
          canvasX >= hb.x &&
          canvasX <= hb.x + hb.width &&
          canvasY >= hb.y &&
          canvasY <= hb.y + hb.height
        ) {
          return { kind: 'text-header' };
        }
        if (
          bb &&
          canvasX >= bb.x &&
          canvasX <= bb.x + bb.width &&
          canvasY >= bb.y &&
          canvasY <= bb.y + bb.height
        ) {
          return { kind: 'text-body' };
        }
      }
      return { kind: 'text' };
    }

    const hitBelow = [...activeSequenceAtPlayhead]
      .reverse()
      .filter((e) => e.slot.zOrder !== 'above-panel')
      .find((e) => {
        const b = layerBounds.overlayMap[e.slot.id];
        return (
          b &&
          canvasX >= b.x &&
          canvasX <= b.x + b.width &&
          canvasY >= b.y &&
          canvasY <= b.y + b.height
        );
      });

    if (hitBelow) {
      return { kind: 'overlay', slotIndex: (hitBelow.slot.slotNumber - 1) as 0 | 1 | 2 };
    }

    return { kind: 'image' };
  };

  const getActiveSelectionBox = (): RectBox | null => {
    if (selectedLayer === 'overlay') {
      if (primaryVisibleSlot && layerBounds.overlayMap[primaryVisibleSlot.id]) {
        return layerBounds.overlayMap[primaryVisibleSlot.id];
      }
      return null;
    }
    if (selectedLayer === 'image') {
      return layerBounds.image;
    }
    if (selectedLayer === 'text-header') {
      return liveLayoutInfoRef.current?.headerBounds || layerBounds.text;
    }
    if (selectedLayer === 'text-body') {
      return liveLayoutInfoRef.current?.bodyBounds || layerBounds.text;
    }
    return layerBounds.text;
  };

  const startInteractionDrag = (
    e: React.PointerEvent,
    hit: { kind: PreviewLayerKind; slotIndex?: 0 | 1 | 2 },
    mode: 'move' | 'resize',
    boxForResize?: RectBox,
    corner?: CornerId
  ) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    onPauseForEdit?.();

    setSelectedLayer(hit.kind);
    if (hit.kind === 'overlay' && hit.slotIndex !== undefined) {
      onSelectSequenceSlot(hit.slotIndex, false);
      onSelectTrack?.((`slot-${hit.slotIndex + 1}`) as TimelineTrackId);
    } else if (hit.kind === 'image') {
      onSelectTrack?.('background');
    } else if (hit.kind === 'text-header') {
      onSelectTrack?.('text-header');
    } else if (hit.kind === 'text-body') {
      onSelectTrack?.('text-body');
    } else {
      onSelectTrack?.('panel');
    }

    const cur = readLayerTransform(hit.kind, hit.slotIndex);
    setActiveDrag({ ...hit, mode, corner });

    let centerPxX = rect.left + rect.width / 2;
    let centerPxY = rect.top + rect.height / 2;
    if (boxForResize) {
      centerPxX = rect.left + ((boxForResize.x + boxForResize.width / 2) / canvasW) * rect.width;
      centerPxY = rect.top + ((boxForResize.y + boxForResize.height / 2) / canvasH) * rect.height;
    }
    const initDist = Math.max(
      12,
      Math.hypot(e.clientX - centerPxX, e.clientY - centerPxY)
    );

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initX: cur.posX,
      initY: cur.posY,
      initZoom: cur.zoom,
      centerPxX,
      centerPxY,
      initDist,
    };

    try {
      viewportRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const canvasX = ((e.clientX - rect.left) / rect.width) * canvasW;
    const canvasY = ((e.clientY - rect.top) / rect.height) * canvasH;

    const hit = hitTestLayer(canvasX, canvasY);
    startInteractionDrag(e, hit, 'move');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (activeDrag && dragStartRef.current) {
      if (activeDrag.mode === 'resize') {
        const curDist = Math.max(
          8,
          Math.hypot(
            e.clientX - dragStartRef.current.centerPxX,
            e.clientY - dragStartRef.current.centerPxY
          )
        );
        const ratio = curDist / Math.max(12, dragStartRef.current.initDist);
        const rawZoom = dragStartRef.current.initZoom * ratio;

        if (activeDrag.kind === 'overlay') {
          const slot =
            activeDrag.slotIndex !== undefined
              ? project.imageSequence[activeDrag.slotIndex]
              : primaryVisibleSlot;
          writeLayerTransform(
            'overlay',
            {
              zoom: clampZoom(
                Number(rawZoom.toFixed(2)),
                slot?.minZoom ?? 0.1,
                slot?.maxZoom ?? 10.0
              ),
            },
            activeDrag.slotIndex
          );
        } else if (activeDrag.kind === 'image') {
          writeLayerTransform('image', {
            zoom: clampTrackScale(Number(rawZoom.toFixed(2)), 0.25, 4.0),
          });
        } else if (activeDrag.kind === 'text') {
          writeLayerTransform('text', {
            zoom: clampTrackScale(Number(rawZoom.toFixed(2)), 0.35, 2.2),
          });
        } else {
          writeLayerTransform(activeDrag.kind, {
            zoom: clampTrackScale(Number(rawZoom.toFixed(2)), 0.35, 2.5),
          });
        }
        return;
      }

      const deltaPxX = e.clientX - dragStartRef.current.clientX;
      const deltaPxY = e.clientY - dragStartRef.current.clientY;

      if (activeDrag.kind === 'image') {
        if (project.activeTemplate === 'template-2') {
          const pctDeltaX = (deltaPxX / rect.width) * 200;
          const pctDeltaY = (deltaPxY / rect.height) * 200;
          writeLayerTransform('image', {
            posX: Math.round(
              Math.max(-150, Math.min(150, dragStartRef.current.initX + pctDeltaX))
            ),
            posY: Math.round(
              Math.max(-150, Math.min(150, dragStartRef.current.initY + pctDeltaY))
            ),
          });
        } else {
          const pctDeltaX = (deltaPxX / rect.width) * 100 * (1 / 0.65);
          const pctDeltaY = (deltaPxY / rect.height) * 100 * (1 / 0.65);
          writeLayerTransform('image', {
            posX: Math.round(
              Math.max(-150, Math.min(150, dragStartRef.current.initX + pctDeltaX))
            ),
            posY: Math.round(
              Math.max(-150, Math.min(150, dragStartRef.current.initY + pctDeltaY))
            ),
          });
        }
      } else if (activeDrag.kind === 'overlay' && activeDrag.slotIndex !== undefined) {
        // 1:1 canonical 1080p pixel drag with ZERO min/max clamping
        const pxDeltaX = (deltaPxX / rect.width) * 1080;
        const pxDeltaY = (deltaPxY / rect.height) * 1920;
        writeLayerTransform(
          'overlay',
          {
            posX: Math.round(dragStartRef.current.initX + pxDeltaX),
            posY: Math.round(dragStartRef.current.initY + pxDeltaY),
          },
          activeDrag.slotIndex
        );
      } else if (activeDrag.kind === 'text-header' || activeDrag.kind === 'text-body') {
        const panelBox = layerBounds.text;
        const pctDeltaX =
          (deltaPxX / Math.max(20, (panelBox.width / canvasW) * rect.width)) * 100;
        const pctDeltaY =
          (deltaPxY / Math.max(20, (panelBox.height / canvasH) * rect.height)) * 100;
        writeLayerTransform(activeDrag.kind, {
          posX: Math.round(
            Math.max(-100, Math.min(100, dragStartRef.current.initX + pctDeltaX))
          ),
          posY: Math.round(
            Math.max(-100, Math.min(100, dragStartRef.current.initY + pctDeltaY))
          ),
        });
      } else {
        const pctDeltaX = (deltaPxX / rect.width) * 200;
        const pctDeltaY = (deltaPxY / rect.height) * 200;
        writeLayerTransform('text', {
          posX: Math.round(
            Math.max(-60, Math.min(60, dragStartRef.current.initX + pctDeltaX))
          ),
          posY: Math.round(
            Math.max(-60, Math.min(60, dragStartRef.current.initY + pctDeltaY))
          ),
        });
      }
    } else {
      const canvasX = ((e.clientX - rect.left) / rect.width) * canvasW;
      const canvasY = ((e.clientY - rect.top) / rect.height) * canvasH;
      setHoveredTarget(hitTestLayer(canvasX, canvasY));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeDrag) {
      try {
        viewportRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setActiveDrag(null);
      dragStartRef.current = null;
    }
  };

  // Non-passive mouse wheel listener for smooth zoom toward pointer without scrolling the page
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      onPauseForEdit?.();

      const rect = vp.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const mouseCanvasX = ((e.clientX - rect.left) / rect.width) * canvasW;
      const mouseCanvasY = ((e.clientY - rect.top) / rect.height) * canvasH;
      const zoomFactor = e.deltaY < 0 ? 1.07 : 1 / 1.07;

      const slotIdx =
        selectedLayer === 'overlay' && primaryVisibleSlot
          ? ((primaryVisibleSlot.slotNumber - 1) as 0 | 1 | 2)
          : undefined;
      const cur = readLayerTransform(selectedLayer, slotIdx);

      if (selectedLayer === 'overlay' && slotIdx !== undefined && primaryVisibleSlot) {
        const minZ = primaryVisibleSlot.minZoom ?? 0.1;
        const maxZ = primaryVisibleSlot.maxZoom ?? 10.0;
        const nextZoom = clampZoom(Number((cur.zoom * zoomFactor).toFixed(3)), minZ, maxZ);
        if (Math.abs(nextZoom - cur.zoom) < 0.001) return;
        const k = nextZoom / Math.max(0.01, cur.zoom);
        const box = layerBounds.overlayMap[primaryVisibleSlot.id];
        if (box) {
          const { anchorX, anchorY, scaleRatio } = getSlotAnchorPoint(
            canvasW,
            canvasH,
            project,
            playheadTime,
            true
          );
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          const newCx = mouseCanvasX - k * (mouseCanvasX - cx);
          const newCy = mouseCanvasY - k * (mouseCanvasY - cy);
          const newPosX = (newCx - anchorX) / scaleRatio;
          const newPosY = (newCy - anchorY) / scaleRatio;
          writeLayerTransform(
            'overlay',
            {
              zoom: Number(nextZoom.toFixed(2)),
              posX: Math.round(newPosX),
              posY: Math.round(newPosY),
            },
            slotIdx
          );
        } else {
          writeLayerTransform('overlay', { zoom: Number(nextZoom.toFixed(2)) }, slotIdx);
        }
        return;
      }

      if (selectedLayer === 'image') {
        const nextZoom = clampTrackScale(Number((cur.zoom * zoomFactor).toFixed(3)), 0.25, 4.0);
        const k = nextZoom / Math.max(0.01, cur.zoom);
        const box = layerBounds.image;
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const newCx = mouseCanvasX - k * (mouseCanvasX - cx);
        const newCy = mouseCanvasY - k * (mouseCanvasY - cy);
        const dx = newCx - cx;
        const dy = newCy - cy;
        const moveDivX = project.activeTemplate === 'template-2' ? canvasW * 0.5 : canvasW * 0.65;
        const moveDivY = project.activeTemplate === 'template-2' ? canvasH * 0.5 : canvasH * 0.65;
        const pctDx = (dx / Math.max(1, moveDivX)) * 100;
        const pctDy = (dy / Math.max(1, moveDivY)) * 100;
        writeLayerTransform('image', {
          zoom: Number(nextZoom.toFixed(2)),
          posX: Math.round(Math.max(-150, Math.min(150, cur.posX + pctDx))),
          posY: Math.round(Math.max(-150, Math.min(150, cur.posY + pctDy))),
        });
        return;
      }

      if (selectedLayer === 'text') {
        const nextZoom = clampTrackScale(Number((cur.zoom * zoomFactor).toFixed(3)), 0.35, 2.2);
        writeLayerTransform('text', { zoom: Number(nextZoom.toFixed(2)) });
        return;
      }

      const nextZoom = clampTrackScale(Number((cur.zoom * zoomFactor).toFixed(3)), 0.35, 2.5);
      writeLayerTransform(selectedLayer, { zoom: Number(nextZoom.toFixed(2)) });
    };

    vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => vp.removeEventListener('wheel', handleWheel);
  }, [
    canvasW,
    canvasH,
    selectedLayer,
    primaryVisibleSlot,
    layerBounds,
    project,
    playheadTime,
    readLayerTransform,
    writeLayerTransform,
    onPauseForEdit,
  ]);

  // Sync preview audio playback
  useEffect(() => {
    if (!project.audio.customAudioUrl || !project.audio.enabled || isPreviewMuted) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      return;
    }

    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(project.audio.customAudioUrl);
    } else if (previewAudioRef.current.src !== project.audio.customAudioUrl) {
      previewAudioRef.current.src = project.audio.customAudioUrl;
    }

    previewAudioRef.current.volume = Math.max(0, Math.min(1, project.audio.volume ?? 0.7));
    previewAudioRef.current.loop = project.audio.loop ?? true;

    if (isPlaying) {
      previewAudioRef.current.play().catch(() => {});
    } else {
      previewAudioRef.current.pause();
    }

    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, [
    isPlaying,
    project.audio.customAudioUrl,
    project.audio.enabled,
    project.audio.volume,
    project.audio.loop,
    isPreviewMuted,
  ]);

  // Sync background & sequence video play/pause AND paused scrubbing seeking
  useEffect(() => {
    const syncVideo = (v: HTMLVideoElement) => {
      if (isPlaying) {
        v.play().catch(() => {});
      } else {
        v.pause();
        if (Number.isFinite(v.duration) && v.duration > 0 && !v.seeking) {
          const target = Math.max(0, Math.min(v.duration - 0.02, playheadTime % v.duration));
          if (Math.abs(v.currentTime - target) > 0.04) {
            try {
              v.currentTime = target;
            } catch {
              // ignore seek error before metadata ready
            }
          }
        }
      }
    };

    if (loadedMedia instanceof HTMLVideoElement) {
      syncVideo(loadedMedia);
    }
    for (const el of Object.values(loadedOverlayMap)) {
      if (el instanceof HTMLVideoElement) {
        syncVideo(el);
      }
    }
  }, [isPlaying, playheadTime, loadedMedia, loadedOverlayMap]);

  // Playback loop synchronized to shared playhead time
  useEffect(() => {
    let lastUiSyncMs = 0;

    const tick = (now: number) => {
      if (lastTimeRef.current !== null && isPlaying) {
        const deltaSec = (now - lastTimeRef.current) / 1000;
        playheadRef.current = (playheadRef.current + deltaSec) % durationSec;
        if (now - lastUiSyncMs >= 32) {
          lastUiSyncMs = now;
          onPlayheadChange(playheadRef.current);
        }
      }
      lastTimeRef.current = now;

      if (canvasRef.current) {
        const normalized = durationSec > 0 ? playheadRef.current / durationSec : 0;
        const info: RenderLayoutInfo = renderCanvasFrame(
          canvasRef.current,
          project,
          loadedMedia,
          normalized,
          loadedLogo,
          loadedOverlayMap,
          !isPlaying
        );
        liveLayoutInfoRef.current = info;

        const sig = `${info.usedBulletFontSize1080}_${info.requestedBulletFontSize1080}_${info.wasAutoFitted}_${info.overflowWarning}`;
        if (sig !== lastLayoutSigRef.current) {
          lastLayoutSigRef.current = sig;
          onLayoutInfoChange?.({
            usedFontSize: info.usedBulletFontSize1080,
            requestedFontSize: info.requestedBulletFontSize1080,
            wasAutoFitted: info.wasAutoFitted,
            overflowWarning: info.overflowWarning,
          });
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      lastTimeRef.current = null;
    };
  }, [
    isPlaying,
    project,
    loadedMedia,
    loadedLogo,
    loadedOverlayMap,
    durationSec,
    onPlayheadChange,
    onLayoutInfoChange,
  ]);

  const handleDownloadSnapshot = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${project.title.replace(/[^a-zA-Z0-9]/g, '_')}_poster.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const activeSlotZoom = primaryVisibleSlot
    ? clampZoom(
        evaluateImageTransformAtTime(primaryVisibleSlot, playheadTime, !isPlaying).zoom,
        primaryVisibleSlot.minZoom ?? 0.1,
        primaryVisibleSlot.maxZoom ?? 10.0
      )
    : 1.0;

  const selectedTransform = readLayerTransform(
    selectedLayer,
    primaryVisibleSlot ? ((primaryVisibleSlot.slotNumber - 1) as 0 | 1 | 2) : undefined
  );

  const selectionBox = getActiveSelectionBox();

  const selectionBorderColor =
    selectedLayer === 'overlay'
      ? 'border-emerald-400'
      : selectedLayer === 'image'
      ? 'border-rose-400'
      : selectedLayer === 'text-header'
      ? 'border-violet-400'
      : selectedLayer === 'text-body'
      ? 'border-cyan-400'
      : 'border-amber-400';

  const handleBgColor =
    selectedLayer === 'overlay'
      ? 'bg-emerald-400'
      : selectedLayer === 'image'
      ? 'bg-rose-400'
      : selectedLayer === 'text-header'
      ? 'bg-violet-400'
      : selectedLayer === 'text-body'
      ? 'bg-cyan-400'
      : 'bg-amber-400';

  const corners: { id: CornerId; styleClass: string; cursor: string }[] = [
    { id: 'nw', styleClass: '-top-1.5 -left-1.5', cursor: 'nwse-resize' },
    { id: 'ne', styleClass: '-top-1.5 -right-1.5', cursor: 'nesw-resize' },
    { id: 'sw', styleClass: '-bottom-1.5 -left-1.5', cursor: 'nesw-resize' },
    { id: 'se', styleClass: '-bottom-1.5 -right-1.5', cursor: 'nwse-resize' },
  ];

  const selectionLabel =
    selectedLayer === 'overlay'
      ? `Img ${primaryVisibleSlot?.slotNumber || 1}`
      : selectedLayer === 'image'
      ? 'Bg'
      : selectedLayer === 'text-header'
      ? 'Header'
      : selectedLayer === 'text-body'
      ? 'Body'
      : 'Panel';

  return (
    <div className="flex flex-col h-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 md:p-5">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-200">
              Live 9:16 Preview
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                project.activeTemplate === 'template-2'
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                  : 'bg-amber-400/15 text-amber-300 border-amber-400/40'
              }`}
            >
              {project.activeTemplate === 'template-2' ? 'Template 2' : 'Template 1'}
            </span>
            <span className="text-[11px] font-mono text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
              {project.resolution === '1080p' ? '1080 × 1920' : '720 × 1280'}
            </span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            {(project.activeTemplate === 'template-2'
              ? project.template2.branding.channelName
              : project.branding.channelName) || '24 SKY ALERT'}{' '}
            <span className="text-neutral-600">·</span> Output length{' '}
            <span className="text-rose-400 font-mono font-medium">
              {durationSec.toFixed(1)}s
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live scale +/- quick stepper for currently selected target */}
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => {
                const slotIdx =
                  selectedLayer === 'overlay' && primaryVisibleSlot
                    ? ((primaryVisibleSlot.slotNumber - 1) as 0 | 1 | 2)
                    : undefined;
                const minS =
                  selectedLayer === 'overlay'
                    ? primaryVisibleSlot?.minZoom ?? 0.1
                    : selectedLayer === 'image'
                    ? 0.25
                    : 0.35;
                const maxS =
                  selectedLayer === 'overlay'
                    ? primaryVisibleSlot?.maxZoom ?? 10.0
                    : selectedLayer === 'image'
                    ? 4.0
                    : selectedLayer === 'text'
                    ? 2.2
                    : 2.5;
                writeLayerTransform(
                  selectedLayer,
                  { zoom: clampTrackScale(Number((selectedTransform.zoom - 0.1).toFixed(2)), minS, maxS) },
                  slotIdx
                );
              }}
              className="w-6 h-6 rounded flex items-center justify-center text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 font-bold transition-colors cursor-pointer"
              title="Zoom Out Selected (-10%)"
            >
              -
            </button>
            <span className="px-1.5 text-[11px] font-mono font-bold text-amber-300">
              {Math.round(selectedTransform.zoom * 100)}%
              {selectedLayer === 'overlay' &&
                primaryVisibleSlot &&
                (primaryVisibleSlot.maxZoom ?? 10) < 10 && (
                  <span className="text-emerald-300/90 font-normal ml-1">
                    / {Math.round((primaryVisibleSlot.maxZoom ?? 10) * 100)}%
                  </span>
                )}
            </span>
            <button
              type="button"
              onClick={() => {
                const slotIdx =
                  selectedLayer === 'overlay' && primaryVisibleSlot
                    ? ((primaryVisibleSlot.slotNumber - 1) as 0 | 1 | 2)
                    : undefined;
                const minS =
                  selectedLayer === 'overlay'
                    ? primaryVisibleSlot?.minZoom ?? 0.1
                    : selectedLayer === 'image'
                    ? 0.25
                    : 0.35;
                const maxS =
                  selectedLayer === 'overlay'
                    ? primaryVisibleSlot?.maxZoom ?? 10.0
                    : selectedLayer === 'image'
                    ? 4.0
                    : selectedLayer === 'text'
                    ? 2.2
                    : 2.5;
                writeLayerTransform(
                  selectedLayer,
                  { zoom: clampTrackScale(Number((selectedTransform.zoom + 0.1).toFixed(2)), minS, maxS) },
                  slotIdx
                );
              }}
              className="w-6 h-6 rounded flex items-center justify-center text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 font-bold transition-colors cursor-pointer"
              title="Zoom In Selected (+10%)"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadSnapshot}
            title="Download high-res PNG snapshot"
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg text-xs transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Media load error banner if background media failed */}
      {mediaLoadError && (
        <div className="mb-2 bg-rose-950/50 border border-rose-500/40 rounded-lg p-2 flex items-center gap-2 text-[11px] text-rose-200">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="truncate">{mediaLoadError}</span>
        </div>
      )}

      {/* Interactive Layer Selection + Reset Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-800/80 mb-2">
        <div className="flex flex-wrap items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-[11px]">
          <span className="text-neutral-400 font-medium px-1 flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-400" />
            Select:
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedLayer('text');
              onSelectTrack?.('panel');
            }}
            className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
              selectedLayer === 'text'
                ? 'bg-amber-400 text-black font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            Panel Group
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedLayer('text-header');
              onSelectTrack?.('text-header');
            }}
            className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
              selectedLayer === 'text-header'
                ? 'bg-violet-400 text-black font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            Header
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedLayer('text-body');
              onSelectTrack?.('text-body');
            }}
            className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
              selectedLayer === 'text-body'
                ? 'bg-cyan-400 text-black font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            Body
          </button>
          {hasVisibleSeqImage &&
            activeSequenceAtPlayhead.map((entry) => {
              const sIdx = (entry.slot.slotNumber - 1) as 0 | 1 | 2;
              const isSelectedSlot =
                selectedLayer === 'overlay' &&
                primaryVisibleSlot?.id === entry.slot.id;
              return (
                <button
                  key={entry.slot.id}
                  type="button"
                  onClick={() => {
                    setSelectedLayer('overlay');
                    onSelectSequenceSlot(sIdx, false);
                    onSelectTrack?.((`slot-${entry.slot.slotNumber}`) as TimelineTrackId);
                  }}
                  className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    isSelectedSlot
                      ? 'bg-emerald-400 text-black font-semibold shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  Img {entry.slot.slotNumber}
                </button>
              );
            })}
          <button
            type="button"
            onClick={() => {
              setSelectedLayer('image');
              onSelectTrack?.('background');
            }}
            className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
              selectedLayer === 'image'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            Bg
          </button>
        </div>

        <div className="flex items-center gap-1">
          {onToggleAutoKeyframes && (
            <button
              type="button"
              onClick={onToggleAutoKeyframes}
              className={`text-[10px] font-semibold px-2 py-1 rounded border transition-colors cursor-pointer flex items-center gap-1 ${
                autoKeyframesEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60 shadow-sm'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white border-neutral-800'
              }`}
              title="When enabled, moving or zooming automatically records keyframes at the playhead"
            >
              <Diamond className={`w-2.5 h-2.5 ${autoKeyframesEnabled ? 'fill-emerald-400 text-emerald-300' : ''}`} />
              <span>Auto KF: {autoKeyframesEnabled ? 'ON' : 'OFF'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (onResetTrackPosition) {
                onResetTrackPosition(activeTrackForSelection);
              } else if (selectedLayer === 'image') {
                if (project.activeTemplate === 'template-2') {
                  onUpdateT2LowerMedia?.({ bgMoveX: 0, bgMoveY: 0 });
                } else {
                  onUpdateAdjust?.({ moveX: 0, moveY: 0 });
                }
              } else if (selectedLayer === 'overlay' && primaryVisibleSlot) {
                onChangeSlotTransform(
                  (primaryVisibleSlot.slotNumber - 1) as 0 | 1 | 2,
                  { posX: 0, posY: 0 }
                );
              } else if (selectedLayer === 'text') {
                if (project.activeTemplate === 'template-2') {
                  onUpdateT2Panel?.({ posX: 0, posY: 0 });
                } else {
                  onUpdatePanel?.({ posX: 0, posY: -22 });
                }
              }
            }}
            className="text-[10px] text-neutral-300 hover:text-white bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
            title={`Reset ${selectionLabel} position only`}
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Reset Pos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onResetTrackScale) {
                onResetTrackScale(activeTrackForSelection);
              } else if (selectedLayer === 'image') {
                if (project.activeTemplate === 'template-2') {
                  onUpdateT2LowerMedia?.({ bgScale: 1.0 });
                } else {
                  onUpdateAdjust?.({ scale: 1.0 });
                }
              } else if (selectedLayer === 'overlay' && primaryVisibleSlot) {
                onChangeSlotTransform(
                  (primaryVisibleSlot.slotNumber - 1) as 0 | 1 | 2,
                  { zoom: 1.0 }
                );
              } else if (selectedLayer === 'text') {
                if (project.activeTemplate === 'template-2') {
                  onUpdateT2Panel?.({ panelScale: 1.0 });
                } else {
                  onUpdatePanel?.({ panelScale: 1.0 });
                }
              }
            }}
            className="text-[10px] text-neutral-300 hover:text-white bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
            title={`Reset ${selectionLabel} scale only`}
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Reset Scale</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport with 9:16 Phone Aspect Ratio */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[420px] max-h-[640px] py-1">
        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            cursor: activeDrag
              ? activeDrag.mode === 'resize'
                ? 'nwse-resize'
                : 'grabbing'
              : hoveredTarget
              ? 'grab'
              : 'default',
            touchAction: 'none',
          }}
          className="relative aspect-9/16 h-full max-h-[580px] rounded-2xl overflow-hidden shadow-2xl border-4 border-neutral-800 bg-neutral-950 flex items-center justify-center select-none"
        >
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* Selection Bounding Box + 4 Interactive Corner Resize Handles */}
          {selectionBox && (
            <div
              style={{
                left: `${(selectionBox.x / canvasW) * 100}%`,
                top: `${(selectionBox.y / canvasH) * 100}%`,
                width: `${(selectionBox.width / canvasW) * 100}%`,
                height: `${(selectionBox.height / canvasH) * 100}%`,
              }}
              className={`absolute pointer-events-none border-2 ${selectionBorderColor} transition-none z-20`}
            >
              {activeDrag && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-neutral-950/95 border border-neutral-700 text-white text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 whitespace-nowrap pointer-events-none z-30">
                  <Move className="w-2.5 h-2.5 text-amber-400" />
                  <span>
                    {selectionLabel} · {Math.round(selectedTransform.zoom * 100)}%
                  </span>
                </div>
              )}

              {corners.map((c) => (
                <div
                  key={c.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const slotIdx =
                      selectedLayer === 'overlay' && primaryVisibleSlot
                        ? ((primaryVisibleSlot.slotNumber - 1) as 0 | 1 | 2)
                        : undefined;
                    startInteractionDrag(
                      e,
                      { kind: selectedLayer, slotIndex: slotIdx },
                      'resize',
                      selectionBox,
                      c.id
                    );
                  }}
                  style={{ cursor: c.cursor, touchAction: 'none' }}
                  title={`Drag corner to resize ${selectionLabel}`}
                  className={`absolute ${c.styleClass} w-3.5 h-3.5 rounded-sm ${handleBgColor} border-2 border-neutral-950 shadow-md pointer-events-auto z-30 hover:scale-125 transition-transform`}
                />
              ))}
            </div>
          )}

          {/* Floating Live Badge */}
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-[10px] font-medium text-white/90 flex items-center gap-1.5 pointer-events-none z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>
              {selectionLabel} · {Math.round(selectedTransform.zoom * 100)}%
              {selectedLayer === 'overlay' &&
                primaryVisibleSlot &&
                (primaryVisibleSlot.maxZoom ?? 10) < 10 &&
                ` (Max ${Math.round((primaryVisibleSlot.maxZoom ?? 10) * 100)}%)`}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-neutral-400 mt-1.5 flex items-center gap-1 font-medium">
          <span>
            Click to select · Drag to move · Scroll wheel to zoom toward pointer · Drag corners to resize
          </span>
        </div>
      </div>

      {/* Timecode & Playback Control Bar */}
      <div className="pt-4 border-t border-neutral-800 mt-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlaying}
              className="w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                playheadRef.current = 0;
                onPlayheadChange(0);
                if (loadedMedia instanceof HTMLVideoElement) {
                  loadedMedia.currentTime = 0;
                }
                for (const el of Object.values(loadedOverlayMap)) {
                  if (el instanceof HTMLVideoElement) {
                    el.currentTime = 0;
                  }
                }
              }}
              title="Reset time"
              className="p-1 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-neutral-200 text-xs tabular-nums">
              {playheadTime.toFixed(2)}s / {durationSec.toFixed(1)}s
            </span>
            {project.audio.enabled && (
              <button
                type="button"
                onClick={() => setIsPreviewMuted(!isPreviewMuted)}
                className={`p-1 rounded transition-colors cursor-pointer ml-1 ${
                  isPreviewMuted
                    ? 'text-neutral-500 hover:text-neutral-300'
                    : 'text-rose-400 hover:text-rose-300'
                }`}
                title={isPreviewMuted ? 'Unmute preview sound' : 'Mute preview sound'}
              >
                {isPreviewMuted ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {project.audio.enabled && (
              <span
                className="text-[10px] bg-rose-950/40 border border-rose-900/50 text-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono truncate max-w-[130px]"
                title={project.audio.customAudioName || 'Audio enabled'}
              >
                <Music className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">
                  {project.audio.customAudioName ||
                    (project.audio.ambientTrack !== 'none'
                      ? project.audio.ambientTrack.replace('-', ' ')
                      : 'Sound ON')}
                </span>
              </span>
            )}
            <span className="text-[11px] text-emerald-400 font-medium">
              {Math.round(durationSec)}s Short Ready
            </span>
          </div>
        </div>

        {/* Progress scrubber bar */}
        <div className="w-full">
          <input
            type="range"
            min={0}
            max={durationSec}
            step={0.05}
            value={playheadTime}
            onChange={(e) => {
              const t = Number(e.target.value);
              if (isPlaying) onTogglePlaying();
              playheadRef.current = t;
              onPlayheadChange(t);
            }}
            className="w-full accent-rose-600 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Timeline Duration Selector: 2s to 10s */}
        <div className="pt-2 pb-0.5">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-neutral-400 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3 text-rose-500" />
              Video Duration (2s – 10s):
            </span>
            <span className="font-mono text-rose-400 font-bold text-[11px] bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
              {Math.round(durationSec)}s
            </span>
          </div>
          <div className="grid grid-cols-9 gap-1">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onUpdateDuration && onUpdateDuration(sec)}
                className={`py-1 rounded text-[11px] font-semibold font-mono text-center cursor-pointer transition-all ${
                  Math.round(durationSec) === sec
                    ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400 font-bold'
                    : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800/80'
                }`}
                title={`Set duration to ${sec}s`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Action Prompt */}
        <div className="pt-2 flex items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-400 truncate">
            {primaryVisibleSlot ? (
              <>
                Img {primaryVisibleSlot.slotNumber} Zoom:{' '}
                <span className="text-emerald-400 font-mono font-medium">
                  {Math.round(activeSlotZoom * 100)}%
                </span>
              </>
            ) : (
              <>
                {selectionLabel}:{' '}
                <span className="text-neutral-200 font-mono font-medium">
                  {Math.round(selectedTransform.zoom * 100)}%
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-sm shadow-rose-950 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Preview & Export Short</span>
          </button>
        </div>
      </div>
    </div>
  );
};
