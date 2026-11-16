import { useState, useEffect, useCallback, useRef } from 'react';
import {
  VideoProject,
  ExportedVideo,
  WeatherTemplateSettings,
  ImageSequenceSlot,
  ImageKeyframe,
  KeyframedTransformTrack,
  SequenceTransitionSettings,
  TemplateId,
  Template2Settings,
  TimelineTrackId,
  AutoAnimationPreset,
  AnimationEasing,
} from './types';
import {
  PRESET_PROJECTS,
  DEFAULT_WEATHER_TEMPLATE,
  DEFAULT_TEMPLATE_2,
  cloneDefaultTemplate2,
  createDefaultSequenceSlots,
  createEmptyTransformTrack,
  rescaleSequenceTimings,
} from './utils/presets';
import {
  loadTemplateSettingsFromStorage,
  saveTemplateSettingsToStorage,
  loadTemplate2SettingsFromStorage,
  saveTemplate2SettingsToStorage,
  loadActiveTemplateFromStorage,
  saveActiveTemplateToStorage,
} from './utils/storage';
import {
  clampKeyframeTimeWithNeighbors,
  clampTrackScale,
  clampZoom,
  evaluateTrackTransformAtTime,
  findKeyframeNearTime,
  generateSlotPresetKeyframes,
  generateTrackPresetKeyframes,
  remapTrackDuration,
  sortKeyframes,
} from './utils/keyframeAnimation';
import { TopNav } from './components/TopNav';
import { TemplateSelector } from './components/TemplateSelector';
import { ScriptTab } from './components/ScriptTab';
import { Template2ScriptTab } from './components/Template2ScriptTab';
import { AddMediaTab } from './components/AddMediaTab';
import { AdjustPictureTab } from './components/AdjustPictureTab';
import { TemplateSettingsTab } from './components/TemplateSettingsTab';
import { Template2SettingsTab } from './components/Template2SettingsTab';
import { BackgroundSoundTab } from './components/BackgroundSoundTab';
import { DesignPreview } from './components/DesignPreview';
import { KeyframeTimeline } from './components/KeyframeTimeline';
import { CreateVideoModal } from './components/CreateVideoModal';
import { SavedLoopsTab } from './components/SavedLoopsTab';
import {
  FileText,
  Image as ImageIcon,
  Sliders,
  LayoutTemplate,
  Music,
} from 'lucide-react';

function buildInitialProject(): VideoProject {
  const base = PRESET_PROJECTS[0];
  const savedT1 = loadTemplateSettingsFromStorage();
  const savedT2 = loadTemplate2SettingsFromStorage();
  const savedActiveTemplate = loadActiveTemplateFromStorage() || 'template-1';

  const mergedPanel = {
    ...base.panel,
    ...(savedT1?.panel || {}),
  };
  if (mergedPanel.heightPercent === 58 && mergedPanel.posY === 4) {
    mergedPanel.heightPercent = base.panel.heightPercent;
    mergedPanel.posY = base.panel.posY;
  }

  const defaultT2 = cloneDefaultTemplate2();
  const mergedT2: Template2Settings = {
    branding: { ...defaultT2.branding, ...(savedT2?.branding || {}) },
    panel: { ...defaultT2.panel, ...(savedT2?.panel || {}) },
    text: {
      ...defaultT2.text,
      ...(savedT2?.text || {}),
      orangeWords: savedT2?.text?.orangeWords || defaultT2.text.orangeWords,
      blueWords: savedT2?.text?.blueWords || defaultT2.text.blueWords,
    },
    accents: { ...defaultT2.accents, ...(savedT2?.accents || {}) },
    lowerMedia: {
      ...defaultT2.lowerMedia,
      ...(savedT2?.lowerMedia || {}),
      bgFitMode: savedT2?.lowerMedia?.bgFitMode || defaultT2.lowerMedia.bgFitMode,
      bgTrack: savedT2?.lowerMedia?.bgTrack || defaultT2.lowerMedia.bgTrack,
    },
    panelTransform:
      savedT2?.panelTransform ||
      createEmptyTransformTrack(
        savedT2?.panel?.panelScale ?? defaultT2.panel.panelScale ?? 1.0,
        savedT2?.panel?.posX ?? defaultT2.panel.posX,
        savedT2?.panel?.posY ?? defaultT2.panel.posY
      ),
    brandingTransform: savedT2?.brandingTransform || createEmptyTransformTrack(1.0, 0, 0),
    textTransform: savedT2?.textTransform || createEmptyTransformTrack(1.0, 0, 0),
  };

  return {
    ...base,
    activeTemplate: savedActiveTemplate,
    branding: {
      ...base.branding,
      ...(savedT1?.branding || {}),
    },
    heading: {
      ...base.heading,
      ...(savedT1?.heading || {}),
    },
    panel: mergedPanel,
    script: {
      ...base.script,
      ...(savedT1?.bulletStyle || {}),
    },
    panelTransform:
      savedT1?.panelTransform ||
      createEmptyTransformTrack(
        mergedPanel.panelScale ?? 1.0,
        mergedPanel.posX,
        mergedPanel.posY
      ),
    brandingTransform: savedT1?.brandingTransform || createEmptyTransformTrack(1.0, 0, 0),
    textTransform: savedT1?.textTransform || createEmptyTransformTrack(1.0, 0, 0),
    template2: mergedT2,
    autoKeyframesEnabled: false,
  };
}

function getTrackBoundsConfig(trackId: TimelineTrackId, prev: VideoProject) {
  const dur = Math.max(2, prev.durationSeconds || 8);
  if (trackId.startsWith('slot-')) {
    const slotIdx = Number(trackId.replace('slot-', '')) - 1;
    const slot = prev.imageSequence[slotIdx];
    return {
      minTime: 0,
      maxTime: dur,
      minScale: slot?.minZoom ?? 0.1,
      maxScale: slot?.maxZoom ?? 10.0,
      defaultScale: 1.0,
      defaultPosX: 0,
      defaultPosY: 0,
    };
  }
  if (trackId === 'background') {
    return {
      minTime: 0,
      maxTime: dur,
      minScale: 0.25,
      maxScale: 4.0,
      defaultScale: 1.0,
      defaultPosX: 0,
      defaultPosY: 0,
    };
  }
  if (trackId === 'panel') {
    return {
      minTime: 0,
      maxTime: dur,
      minScale: 0.35,
      maxScale: 2.2,
      defaultScale: 1.0,
      defaultPosX: 0,
      defaultPosY: prev.activeTemplate === 'template-2' ? 0 : -22,
    };
  }
  return {
    minTime: 0,
    maxTime: dur,
    minScale: 0.35,
    maxScale: 2.5,
    defaultScale: 1.0,
    defaultPosX: 0,
    defaultPosY: 0,
  };
}

function readTrackFromProject(prev: VideoProject, trackId: TimelineTrackId): KeyframedTransformTrack {
  const isT2 = prev.activeTemplate === 'template-2';
  if (trackId.startsWith('slot-')) {
    const slotIdx = Number(trackId.replace('slot-', '')) - 1;
    const slot = prev.imageSequence[slotIdx];
    return {
      scale: slot?.zoom ?? 1.0,
      posX: slot?.posX ?? 0,
      posY: slot?.posY ?? 0,
      animationPreset: slot?.animationPreset ?? 'none',
      animationDuration: slot?.animationDuration,
      easing: slot?.easing ?? 'ease-in-out',
      keyframes: slot?.keyframes ?? [],
      pendingEditTime: slot?.pendingEditTime,
    };
  }
  if (trackId === 'background') {
    if (isT2) {
      return (
        prev.template2.lowerMedia.bgTrack ||
        createEmptyTransformTrack(
          prev.template2.lowerMedia.bgScale || 1.0,
          prev.template2.lowerMedia.bgMoveX || 0,
          prev.template2.lowerMedia.bgMoveY || 0
        )
      );
    }
    return (
      prev.adjust.bgTrack ||
      createEmptyTransformTrack(
        prev.adjust.scale || 1.0,
        prev.adjust.moveX || 0,
        prev.adjust.moveY || 0
      )
    );
  }
  if (trackId === 'panel') {
    if (isT2) {
      return (
        prev.template2.panelTransform ||
        createEmptyTransformTrack(
          prev.template2.panel.panelScale ?? 1.0,
          prev.template2.panel.posX || 0,
          prev.template2.panel.posY || 0
        )
      );
    }
    return (
      prev.panelTransform ||
      createEmptyTransformTrack(
        prev.panel.panelScale ?? 1.0,
        prev.panel.posX || 0,
        prev.panel.posY ?? -22
      )
    );
  }
  if (trackId === 'text-header') {
    const t = isT2 ? prev.template2.brandingTransform : prev.brandingTransform;
    return t || createEmptyTransformTrack(1.0, 0, 0);
  }
  const t = isT2 ? prev.template2.textTransform : prev.textTransform;
  return t || createEmptyTransformTrack(1.0, 0, 0);
}

function writeTrackToProject(
  prev: VideoProject,
  trackId: TimelineTrackId,
  nextTrack: KeyframedTransformTrack
): VideoProject {
  const isT2 = prev.activeTemplate === 'template-2';
  if (trackId.startsWith('slot-')) {
    const slotIdx = Number(trackId.replace('slot-', '')) - 1;
    return {
      ...prev,
      imageSequence: prev.imageSequence.map((slot, idx) => {
        if (idx !== slotIdx) return slot;
        const minZ = slot.minZoom ?? 0.1;
        const maxZ = slot.maxZoom ?? 10.0;
        let nextStart = slot.startTime;
        let nextEnd = slot.endTime;
        if (nextTrack.keyframes.length > 0) {
          const minKfT = Math.min(...nextTrack.keyframes.map((k) => k.time));
          const maxKfT = Math.max(...nextTrack.keyframes.map((k) => k.time));
          if (minKfT < nextStart) nextStart = minKfT;
          if (maxKfT > nextEnd) nextEnd = maxKfT;
        }
        return {
          ...slot,
          startTime: Number(nextStart.toFixed(2)),
          endTime: Number(Math.max(nextStart + 0.1, nextEnd).toFixed(2)),
          zoom: clampZoom(nextTrack.scale, minZ, maxZ),
          posX: nextTrack.posX,
          posY: nextTrack.posY,
          animationPreset: nextTrack.animationPreset,
          animationDuration: nextTrack.animationDuration,
          easing: nextTrack.easing,
          keyframes: nextTrack.keyframes,
          pendingEditTime: nextTrack.pendingEditTime,
        };
      }),
    };
  }
  if (trackId === 'background') {
    if (isT2) {
      return {
        ...prev,
        template2: {
          ...prev.template2,
          lowerMedia: {
            ...prev.template2.lowerMedia,
            bgScale: nextTrack.scale,
            bgMoveX: nextTrack.posX,
            bgMoveY: nextTrack.posY,
            bgTrack: nextTrack,
          },
        },
      };
    }
    return {
      ...prev,
      adjust: {
        ...prev.adjust,
        scale: nextTrack.scale,
        moveX: nextTrack.posX,
        moveY: nextTrack.posY,
        bgTrack: nextTrack,
      },
    };
  }
  if (trackId === 'panel') {
    if (isT2) {
      return {
        ...prev,
        template2: {
          ...prev.template2,
          panel: {
            ...prev.template2.panel,
            panelScale: nextTrack.scale,
            posX: nextTrack.posX,
            posY: nextTrack.posY,
          },
          panelTransform: nextTrack,
        },
      };
    }
    return {
      ...prev,
      panel: {
        ...prev.panel,
        panelScale: nextTrack.scale,
        posX: nextTrack.posX,
        posY: nextTrack.posY,
      },
      panelTransform: nextTrack,
    };
  }
  if (trackId === 'text-header') {
    if (isT2) {
      return {
        ...prev,
        template2: {
          ...prev.template2,
          brandingTransform: nextTrack,
        },
      };
    }
    return {
      ...prev,
      brandingTransform: nextTrack,
    };
  }
  if (isT2) {
    return {
      ...prev,
      template2: {
        ...prev.template2,
        textTransform: nextTrack,
      },
    };
  }
  return {
    ...prev,
    textTransform: nextTrack,
  };
}

export default function App() {
  const [project, setProject] = useState<VideoProject>(buildInitialProject);
  const [loadedMedia, setLoadedMedia] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [mediaLoadError, setMediaLoadError] = useState<string | null>(null);
  const [loadedLogo, setLoadedLogo] = useState<HTMLImageElement | null>(null);
  const [loadedLogoT2, setLoadedLogoT2] = useState<HTMLImageElement | null>(null);
  const [loadedOverlayMap, setLoadedOverlayMap] = useState<
    Record<string, HTMLImageElement | HTMLVideoElement>
  >({});
  const overlayCacheRef = useRef<
    Record<string, { url: string; el: HTMLImageElement | HTMLVideoElement }>
  >({});

  const [playheadTime, setPlayheadTime] = useState<number>(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(true);
  const [selectedTrackId, setSelectedTrackId] = useState<TimelineTrackId>('panel');
  const playheadRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);
  playheadRef.current = playheadTime;
  isPlayingRef.current = isPreviewPlaying;

  const [activeTopTab, setActiveTopTab] = useState<'create' | 'export' | 'history'>('create');
  const [workspaceSubTab, setWorkspaceSubTab] = useState<
    'script' | 'media' | 'adjust' | 'template' | 'sound'
  >('script');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [savedVideos, setSavedVideos] = useState<ExportedVideo[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastSavedAtT2, setLastSavedAtT2] = useState<string | null>(null);
  const [autoFitInfo, setAutoFitInfo] = useState<{
    usedFontSize: number;
    requestedFontSize: number;
    wasAutoFitted: boolean;
    overflowWarning: boolean;
  }>({
    usedFontSize: 34,
    requestedFontSize: 34,
    wasAutoFitted: false,
    overflowWarning: false,
  });

  // Persist activeTemplate selection
  useEffect(() => {
    saveActiveTemplateToStorage(project.activeTemplate);
  }, [project.activeTemplate]);

  // Persist Template 1 branding + template settings independently to localStorage
  useEffect(() => {
    const templateToSave: WeatherTemplateSettings = {
      branding: project.branding,
      heading: project.heading,
      panel: project.panel,
      bulletStyle: {
        bulletColorMode: project.script.bulletColorMode,
        alternateStartColor: project.script.alternateStartColor,
        bulletSymbol: project.script.bulletSymbol,
        fontSize: project.script.fontSize,
        autoFitText: project.script.autoFitText,
        fontFamily: project.script.fontFamily,
        lineHeight: project.script.lineHeight,
        bulletSpacing: project.script.bulletSpacing,
        textAlign: project.script.textAlign,
        textColor: project.script.textColor,
        yellowColor: project.script.yellowColor,
        emergencyColor: project.script.emergencyColor,
        textOffsetX: project.script.textOffsetX,
        textOffsetY: project.script.textOffsetY,
      },
      panelTransform: project.panelTransform,
      brandingTransform: project.brandingTransform,
      textTransform: project.textTransform,
    };
    if (saveTemplateSettingsToStorage(templateToSave)) {
      setLastSavedAt(new Date().toLocaleTimeString());
    }
  }, [
    project.branding,
    project.heading,
    project.panel,
    project.panelTransform,
    project.brandingTransform,
    project.textTransform,
    project.script.bulletColorMode,
    project.script.alternateStartColor,
    project.script.bulletSymbol,
    project.script.fontSize,
    project.script.autoFitText,
    project.script.fontFamily,
    project.script.lineHeight,
    project.script.bulletSpacing,
    project.script.textAlign,
    project.script.textColor,
    project.script.yellowColor,
    project.script.emergencyColor,
    project.script.textOffsetX,
    project.script.textOffsetY,
  ]);

  // Persist Template 2 settings independently to localStorage
  useEffect(() => {
    if (saveTemplate2SettingsToStorage(project.template2)) {
      setLastSavedAtT2(new Date().toLocaleTimeString());
    }
  }, [project.template2]);

  // Load uploaded Template 1 channel logo image
  useEffect(() => {
    if (!project.branding.logoDataUrl) {
      setLoadedLogo(null);
      return;
    }
    const img = new Image();
    img.onload = () => setLoadedLogo(img);
    img.onerror = () => {
      console.warn('Failed to decode Template 1 channel logo');
      setLoadedLogo(null);
    };
    img.src = project.branding.logoDataUrl;
  }, [project.branding.logoDataUrl]);

  // Load uploaded Template 2 circular channel logo image independently
  useEffect(() => {
    if (!project.template2.branding.logoDataUrl) {
      setLoadedLogoT2(null);
      return;
    }
    const img = new Image();
    img.onload = () => setLoadedLogoT2(img);
    img.onerror = () => {
      console.warn('Failed to decode Template 2 channel logo');
      setLoadedLogoT2(null);
    };
    img.src = project.template2.branding.logoDataUrl;
  }, [project.template2.branding.logoDataUrl]);

  // Load background media cleanly whenever project.mediaUrl / project.mediaType changes
  useEffect(() => {
    if (!project.mediaUrl) {
      setLoadedMedia(null);
      setMediaLoadError(null);
      return;
    }

    let cancelled = false;
    setLoadedMedia(null);
    setMediaLoadError(null);
    const isRemote =
      project.mediaUrl.startsWith('http://') || project.mediaUrl.startsWith('https://');

    if (project.mediaType === 'video') {
      const video = document.createElement('video');
      if (isRemote) {
        video.crossOrigin = 'anonymous';
      }
      video.preload = 'auto';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;

      const handleReady = () => {
        if (cancelled) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;
        setMediaLoadError(null);
        setLoadedMedia(video);
        if (isPlayingRef.current) {
          video.play().catch(() => {});
        }
      };

      video.onloadeddata = handleReady;
      video.oncanplay = handleReady;
      video.onerror = () => {
        if (cancelled) return;
        const msg =
          'Background video could not be decoded. Please upload a standard H.264 MP4 or WebM clip.';
        console.warn(msg, project.mediaUrl);
        setLoadedMedia(null);
        setMediaLoadError(msg);
      };

      video.src = project.mediaUrl;
      video.load();

      return () => {
        cancelled = true;
        video.onloadeddata = null;
        video.oncanplay = null;
        video.onerror = null;
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
    } else {
      const img = new Image();
      if (isRemote) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = async () => {
        try {
          if (typeof img.decode === 'function') {
            await img.decode();
          }
        } catch {
          // ignore decode error if already complete
        }
        if (!cancelled) {
          if (img.naturalWidth > 0) {
            setMediaLoadError(null);
            setLoadedMedia(img);
          } else {
            setMediaLoadError('Background image has zero dimensions or is unreadable.');
          }
        }
      };
      img.onerror = () => {
        if (cancelled) return;
        const msg =
          'Background image could not be loaded. Try JPG, PNG, or WebP.';
        console.warn(msg, project.mediaUrl);
        setLoadedMedia(null);
        setMediaLoadError(msg);
      };
      img.src = project.mediaUrl;

      return () => {
        cancelled = true;
      };
    }
  }, [project.mediaUrl, project.mediaType]);

  // Load & cache each of the 3 sequence slots independently
  const sequenceSig = (project.imageSequence || [])
    .map((s) => `${s.id}:${s.url}:${s.type}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;
    const slots = project.imageSequence || [];

    for (const slot of slots) {
      const cached = overlayCacheRef.current[slot.id];
      if (cached && (!slot.url || cached.url !== slot.url)) {
        if (cached.el instanceof HTMLVideoElement) {
          cached.el.pause();
          cached.el.removeAttribute('src');
          cached.el.load();
        }
        delete overlayCacheRef.current[slot.id];
      }
    }

    const syncStateFromCache = () => {
      if (cancelled) return;
      const next: Record<string, HTMLImageElement | HTMLVideoElement> = {};
      for (const [id, entry] of Object.entries(overlayCacheRef.current)) {
        next[id] = entry.el;
      }
      setLoadedOverlayMap(next);
    };

    let needsAsync = false;

    for (const slot of slots) {
      if (!slot.url) continue;
      const existing = overlayCacheRef.current[slot.id];
      if (existing && existing.url === slot.url) {
        continue;
      }

      needsAsync = true;
      const isRemote = slot.url.startsWith('http://') || slot.url.startsWith('https://');
      if (slot.type === 'video') {
        const video = document.createElement('video');
        if (isRemote) {
          video.crossOrigin = 'anonymous';
        }
        video.preload = 'auto';
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.onloadeddata = () => {
          if (cancelled) return;
          if (isPlayingRef.current) {
            video.play().catch(() => {});
          }
          overlayCacheRef.current[slot.id] = { url: slot.url, el: video };
          syncStateFromCache();
        };
        video.onerror = () => {
          console.warn('Failed to load sequence video at', slot.url);
        };
        video.src = slot.url;
        video.load();
      } else {
        const img = new Image();
        if (isRemote) {
          img.crossOrigin = 'anonymous';
        }
        img.onload = async () => {
          try {
            if (typeof img.decode === 'function') {
              await img.decode();
            }
          } catch {
            // ignore decode error
          }
          if (!cancelled && img.naturalWidth > 0) {
            overlayCacheRef.current[slot.id] = { url: slot.url, el: img };
            syncStateFromCache();
          }
        };
        img.onerror = () => {
          console.warn('Failed to load sequence image at', slot.url);
        };
        img.src = slot.url;
      }
    }

    if (!needsAsync) {
      syncStateFromCache();
    }

    return () => {
      cancelled = true;
    };
  }, [sequenceSig]);

  // Load sample weather script preset while preserving branding, media, and sequence
  const handleLoadPreset = (presetId: string) => {
    const found = PRESET_PROJECTS.find((p) => p.id === presetId);
    if (found) {
      setProject((prev) => ({
        ...prev,
        title: found.title,
        script: {
          ...prev.script,
          text: found.script.text,
          bullets: found.script.bullets,
        },
      }));
    }
  };

  const handleSelectMedia = (url: string, name: string, type: 'image' | 'video') => {
    setMediaLoadError(null);
    setProject((prev) => ({
      ...prev,
      mediaUrl: url,
      mediaName: name,
      mediaType: type,
    }));
  };

  const handleRemoveBackgroundMedia = () => {
    setMediaLoadError(null);
    setLoadedMedia(null);
    setProject((prev) => ({
      ...prev,
      mediaUrl: '',
      mediaName: '',
      mediaType: 'video',
    }));
  };

  const handleAssignSequenceSlot = (
    slotIndex: 0 | 1 | 2,
    url: string,
    name: string,
    type: 'image' | 'video'
  ) => {
    setProject((prev) => {
      const updated = prev.imageSequence.map((slot, idx) => {
        if (idx !== slotIndex) return slot;
        const minZ = slot.minZoom ?? 0.1;
        const maxZ = slot.maxZoom ?? 10.0;
        const autoKeyframes = generateSlotPresetKeyframes(
          'zoom-in',
          slot.startTime,
          slot.endTime,
          slot.posX ?? 0,
          slot.posY ?? 0,
          slot.slotNumber,
          clampZoom(1.0, minZ, maxZ),
          minZ,
          maxZ
        );
        return {
          ...slot,
          url,
          name,
          type,
          visible: true,
          zoom: clampZoom(1.0, minZ, maxZ),
          animationPreset: 'zoom-in' as const,
          easing: slot.easing || 'ease-in-out',
          keyframes: autoKeyframes,
          pendingEditTime: undefined,
        };
      });
      return {
        ...prev,
        imageSequence: updated,
        activeSequenceIndex: slotIndex,
      };
    });
  };

  const handleUpdateSequenceSlot = useCallback(
    (slotIndex: 0 | 1 | 2, updated: Partial<ImageSequenceSlot>) => {
      setProject((prev) => ({
        ...prev,
        imageSequence: prev.imageSequence.map((slot, idx) => {
          if (idx !== slotIndex) return slot;
          const merged = { ...slot, ...updated };
          const minZ = merged.minZoom ?? 0.1;
          const maxZ = merged.maxZoom ?? 10.0;
          const clampedZoom = clampZoom(merged.zoom, minZ, maxZ);
          const clampedKfs =
            updated.minZoom !== undefined || updated.maxZoom !== undefined
              ? (merged.keyframes || []).map((k) => ({
                  ...k,
                  zoom: clampZoom(k.zoom, minZ, maxZ),
                }))
              : merged.keyframes;
          return {
            ...merged,
            zoom: clampedZoom,
            keyframes: clampedKfs,
          };
        }),
      }));
    },
    []
  );

  const handleRemoveSequenceSlot = (slotIndex: 0 | 1 | 2) => {
    setProject((prev) => ({
      ...prev,
      imageSequence: prev.imageSequence.map((slot, idx) =>
        idx === slotIndex
          ? {
              ...slot,
              url: '',
              name: '',
              keyframes: [],
              zoom: 1.0,
              pendingEditTime: undefined,
            }
          : slot
      ),
    }));
  };

  const clearAllPendingEdits = (prev: VideoProject): VideoProject => {
    const clearTrack = (t: KeyframedTransformTrack | undefined) =>
      t?.pendingEditTime !== undefined ? { ...t, pendingEditTime: undefined } : t;
    return {
      ...prev,
      imageSequence: prev.imageSequence.map((s) =>
        s.pendingEditTime !== undefined ? { ...s, pendingEditTime: undefined } : s
      ),
      adjust: {
        ...prev.adjust,
        bgTrack: clearTrack(prev.adjust.bgTrack),
      },
      panelTransform: clearTrack(prev.panelTransform),
      brandingTransform: clearTrack(prev.brandingTransform),
      textTransform: clearTrack(prev.textTransform),
      template2: {
        ...prev.template2,
        lowerMedia: {
          ...prev.template2.lowerMedia,
          bgTrack: clearTrack(prev.template2.lowerMedia.bgTrack),
        },
        panelTransform: clearTrack(prev.template2.panelTransform),
        brandingTransform: clearTrack(prev.template2.brandingTransform),
        textTransform: clearTrack(prev.template2.textTransform),
      },
    };
  };

  const handleSeekPlayhead = useCallback((timeSec: number) => {
    setIsPreviewPlaying(false);
    isPlayingRef.current = false;
    setPlayheadTime(timeSec);
    playheadRef.current = timeSec;
    setProject((prev) => clearAllPendingEdits(prev));
  }, []);

  const handleSelectSequenceSlot = useCallback(
    (slotIndex: 0 | 1 | 2, jumpPlayhead: boolean = false) => {
      setSelectedTrackId((`slot-${slotIndex + 1}`) as TimelineTrackId);
      setProject((prev) => {
        if (jumpPlayhead) {
          const slot = prev.imageSequence[slotIndex];
          if (slot) {
            const targetT = Number((slot.startTime + 0.05).toFixed(2));
            setIsPreviewPlaying(false);
            isPlayingRef.current = false;
            setPlayheadTime(targetT);
            playheadRef.current = targetT;
          }
        }
        return prev.activeSequenceIndex === slotIndex
          ? prev
          : { ...prev, activeSequenceIndex: slotIndex };
      });
    },
    []
  );

  const handleToggleAutoKeyframes = useCallback(() => {
    setProject((prev) => ({
      ...prev,
      autoKeyframesEnabled: !prev.autoKeyframesEnabled,
    }));
  }, []);

  const handlePauseForEdit = useCallback(() => {
    if (isPlayingRef.current) {
      setIsPreviewPlaying(false);
      isPlayingRef.current = false;
    }
  }, []);

  // Unified transform update handler across ALL 7 tracks (slot-1..3, background, panel, text-header, text-body)
  const handleChangeTrackTransform = useCallback(
    (
      trackId: TimelineTrackId,
      updated: {
        zoom?: number;
        posX?: number;
        posY?: number;
        opacity?: number;
        rotation?: number;
      }
    ) => {
      const t = playheadRef.current;
      const paused = !isPlayingRef.current;

      setProject((prev) => {
        const cfg = getTrackBoundsConfig(trackId, prev);
        const curTrack = readTrackFromProject(prev, trackId);
        const slotFallbackOpacity = trackId.startsWith('slot-')
          ? prev.imageSequence[Number(trackId.replace('slot-', '')) - 1]?.opacity ?? 1
          : 1;
        const slotFallbackRot = trackId.startsWith('slot-')
          ? prev.imageSequence[Number(trackId.replace('slot-', '')) - 1]?.rotation ?? 0
          : 0;

        const curEval = evaluateTrackTransformAtTime(
          curTrack,
          t,
          paused,
          {
            zoom: curTrack.scale,
            posX: curTrack.posX,
            posY: curTrack.posY,
            opacity: slotFallbackOpacity,
            rotation: slotFallbackRot,
          },
          cfg.minScale,
          cfg.maxScale
        );

        const nextZoom =
          updated.zoom !== undefined
            ? clampTrackScale(updated.zoom, cfg.minScale, cfg.maxScale)
            : curEval.zoom;
        const nextPosX = updated.posX !== undefined ? updated.posX : curEval.posX;
        const nextPosY = updated.posY !== undefined ? updated.posY : curEval.posY;
        const nextOpacity = updated.opacity !== undefined ? updated.opacity : curEval.opacity;
        const nextRotation = updated.rotation !== undefined ? updated.rotation : curEval.rotation;

        let workingPrev = prev;
        if (trackId.startsWith('slot-') && (updated.opacity !== undefined || updated.rotation !== undefined)) {
          const sIdx = Number(trackId.replace('slot-', '')) - 1;
          workingPrev = {
            ...prev,
            imageSequence: prev.imageSequence.map((s, idx) =>
              idx === sIdx
                ? {
                    ...s,
                    ...(updated.opacity !== undefined ? { opacity: updated.opacity } : {}),
                    ...(updated.rotation !== undefined ? { rotation: updated.rotation } : {}),
                  }
                : s
            ),
          };
        }

        const kfs = curTrack.keyframes || [];
        const clampedT = Number(Math.max(cfg.minTime, Math.min(cfg.maxTime, t)).toFixed(2));
        const nearKf = findKeyframeNearTime(kfs, clampedT, 0.08);

        if (prev.autoKeyframesEnabled) {
          if (nearKf) {
            return writeTrackToProject(workingPrev, trackId, {
              ...curTrack,
              scale: nextZoom,
              posX: nextPosX,
              posY: nextPosY,
              animationPreset: 'custom',
              pendingEditTime: undefined,
              keyframes: sortKeyframes(
                kfs.map((k) =>
                  k.id === nearKf.id
                    ? {
                        ...k,
                        zoom: nextZoom,
                        posX: nextPosX,
                        posY: nextPosY,
                        opacity: nextOpacity,
                        rotation: nextRotation,
                      }
                    : k
                )
              ),
            });
          }
          const newKf: ImageKeyframe = {
            id: `kf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
            time: clampedT,
            zoom: nextZoom,
            posX: nextPosX,
            posY: nextPosY,
            opacity: nextOpacity,
            rotation: nextRotation,
          };
          return writeTrackToProject(workingPrev, trackId, {
            ...curTrack,
            scale: nextZoom,
            posX: nextPosX,
            posY: nextPosY,
            animationPreset: 'custom',
            pendingEditTime: undefined,
            keyframes: sortKeyframes([...kfs, newKf]),
          });
        }

        if (kfs.length === 0) {
          return writeTrackToProject(workingPrev, trackId, {
            ...curTrack,
            scale: nextZoom,
            posX: nextPosX,
            posY: nextPosY,
            pendingEditTime: undefined,
          });
        }

        // If an automatic preset (e.g. 'zoom-in', 'slide-left-right') is active and Auto KF is OFF,
        // keep the preset motion gently scaled around the user's new base zoom/position so shrinking
        // an image never leaves behind a huge old keyframe endpoint.
        if (curTrack.animationPreset !== 'none' && curTrack.animationPreset !== 'custom') {
          const baseZoomForPreset =
            updated.zoom !== undefined ? nextZoom : curTrack.scale;
          const deltaX = updated.posX !== undefined ? nextPosX - curEval.posX : 0;
          const deltaY = updated.posY !== undefined ? nextPosY - curEval.posY : 0;
          const basePosXForPreset = Math.round((curTrack.posX || 0) + deltaX);
          const basePosYForPreset = Math.round((curTrack.posY || 0) + deltaY);

          const slotObj = trackId.startsWith('slot-')
            ? workingPrev.imageSequence[Number(trackId.replace('slot-', '')) - 1]
            : undefined;
          const winStart = slotObj ? slotObj.startTime : cfg.minTime;
          const winEnd =
            curTrack.animationDuration !== undefined
              ? Math.min(
                  cfg.maxTime,
                  winStart + Math.max(0.2, curTrack.animationDuration)
                )
              : slotObj
              ? slotObj.endTime
              : cfg.maxTime;
          const isTextOrPanel = trackId.startsWith('text-') || trackId === 'panel';
          const relStep = isTextOrPanel
            ? Math.max(0.01, baseZoomForPreset * 0.04)
            : Math.max(0.02, baseZoomForPreset * 0.07);
          const peakZ = clampTrackScale(
            Number((baseZoomForPreset + relStep).toFixed(2)),
            cfg.minScale,
            cfg.maxScale
          );

          const regenerated = generateTrackPresetKeyframes(
            curTrack.animationPreset,
            winStart,
            winEnd,
            baseZoomForPreset,
            basePosXForPreset,
            basePosYForPreset,
            peakZ,
            isTextOrPanel ? 8 : 100,
            cfg.minScale,
            cfg.maxScale
          );

          return writeTrackToProject(workingPrev, trackId, {
            ...curTrack,
            scale: baseZoomForPreset,
            posX: basePosXForPreset,
            posY: basePosYForPreset,
            keyframes: regenerated,
            pendingEditTime: undefined,
          });
        }

        if (nearKf) {
          return writeTrackToProject(workingPrev, trackId, {
            ...curTrack,
            scale: nextZoom,
            posX: nextPosX,
            posY: nextPosY,
            pendingEditTime: undefined,
            keyframes: sortKeyframes(
              kfs.map((k) =>
                k.id === nearKf.id
                  ? {
                      ...k,
                      zoom: nextZoom,
                      posX: nextPosX,
                      posY: nextPosY,
                      opacity: nextOpacity,
                      rotation: nextRotation,
                    }
                  : k
              )
            ),
          });
        }

        return writeTrackToProject(workingPrev, trackId, {
          ...curTrack,
          scale: nextZoom,
          posX: nextPosX,
          posY: nextPosY,
          pendingEditTime: clampedT,
        });
      });
    },
    []
  );

  const handleChangeSlotTransform = useCallback(
    (
      slotIndex: 0 | 1 | 2,
      updated: {
        zoom?: number;
        posX?: number;
        posY?: number;
        opacity?: number;
        rotation?: number;
      }
    ) => {
      handleChangeTrackTransform((`slot-${slotIndex + 1}`) as TimelineTrackId, updated);
    },
    [handleChangeTrackTransform]
  );

  const handleAddOrUpdateTrackKeyframe = useCallback((trackId: TimelineTrackId) => {
    const t = playheadRef.current;
    const paused = !isPlayingRef.current;

    setProject((prev) => {
      const cfg = getTrackBoundsConfig(trackId, prev);
      const clampedT = Number(Math.max(cfg.minTime, Math.min(cfg.maxTime, t)).toFixed(2));
      const curTrack = readTrackFromProject(prev, trackId);
      const slotFallbackOpacity = trackId.startsWith('slot-')
        ? prev.imageSequence[Number(trackId.replace('slot-', '')) - 1]?.opacity ?? 1
        : 1;
      const slotFallbackRot = trackId.startsWith('slot-')
        ? prev.imageSequence[Number(trackId.replace('slot-', '')) - 1]?.rotation ?? 0
        : 0;

      const evalT = evaluateTrackTransformAtTime(
        curTrack,
        clampedT,
        paused,
        {
          zoom: curTrack.scale,
          posX: curTrack.posX,
          posY: curTrack.posY,
          opacity: slotFallbackOpacity,
          rotation: slotFallbackRot,
        },
        cfg.minScale,
        cfg.maxScale
      );

      const nearKf = findKeyframeNearTime(curTrack.keyframes || [], clampedT, 0.08);
      if (nearKf) {
        const updatedKfs = sortKeyframes(
          curTrack.keyframes.map((k) =>
            k.id === nearKf.id
              ? {
                  ...k,
                  time: clampedT,
                  zoom: clampTrackScale(evalT.zoom, cfg.minScale, cfg.maxScale),
                  posX: Math.round(evalT.posX),
                  posY: Math.round(evalT.posY),
                  opacity: evalT.opacity,
                  rotation: evalT.rotation,
                }
              : k
          )
        );
        return writeTrackToProject(prev, trackId, {
          ...curTrack,
          animationPreset: 'custom',
          keyframes: updatedKfs,
          pendingEditTime: undefined,
        });
      }

      const newKf: ImageKeyframe = {
        id: `kf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        time: clampedT,
        zoom: clampTrackScale(evalT.zoom, cfg.minScale, cfg.maxScale),
        posX: Math.round(evalT.posX),
        posY: Math.round(evalT.posY),
        opacity: evalT.opacity,
        rotation: evalT.rotation,
      };
      const updatedKfs = sortKeyframes([...(curTrack.keyframes || []), newKf]);
      return writeTrackToProject(prev, trackId, {
        ...curTrack,
        animationPreset: 'custom',
        keyframes: updatedKfs,
        pendingEditTime: undefined,
      });
    });
  }, []);

  const handleMoveTrackKeyframeTime = useCallback(
    (trackId: TimelineTrackId, kfId: string, newTimeSec: number) => {
      setProject((prev) => {
        const cfg = getTrackBoundsConfig(trackId, prev);
        const curTrack = readTrackFromProject(prev, trackId);
        const safeTime = clampKeyframeTimeWithNeighbors(
          curTrack.keyframes,
          kfId,
          newTimeSec,
          cfg.minTime,
          cfg.maxTime,
          0.05
        );
        const updatedKfs = sortKeyframes(
          curTrack.keyframes.map((k) =>
            k.id === kfId ? { ...k, time: safeTime } : k
          )
        );
        return writeTrackToProject(prev, trackId, {
          ...curTrack,
          animationPreset: 'custom',
          keyframes: updatedKfs,
          pendingEditTime: undefined,
        });
      });
    },
    []
  );

  const handleUpdateTrackKeyframeFields = useCallback(
    (
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
    ) => {
      setProject((prev) => {
        const cfg = getTrackBoundsConfig(trackId, prev);
        const curTrack = readTrackFromProject(prev, trackId);
        const updatedKfs = sortKeyframes(
          curTrack.keyframes.map((k) => {
            if (k.id !== kfId) return k;
            const nextT =
              patch.time !== undefined
                ? clampKeyframeTimeWithNeighbors(
                    curTrack.keyframes,
                    kfId,
                    patch.time,
                    cfg.minTime,
                    cfg.maxTime,
                    0.05
                  )
                : k.time;
            const nextZ =
              patch.zoom !== undefined
                ? clampTrackScale(patch.zoom, cfg.minScale, cfg.maxScale)
                : k.zoom;
            return {
              ...k,
              ...patch,
              time: nextT,
              zoom: nextZ,
            };
          })
        );
        return writeTrackToProject(prev, trackId, {
          ...curTrack,
          animationPreset: 'custom',
          keyframes: updatedKfs,
          pendingEditTime: undefined,
        });
      });
    },
    []
  );

  const handleDeleteTrackKeyframe = useCallback(
    (trackId: TimelineTrackId, kfId: string) => {
      setProject((prev) => {
        const curTrack = readTrackFromProject(prev, trackId);
        const remaining = (curTrack.keyframes || []).filter((k) => k.id !== kfId);
        return writeTrackToProject(prev, trackId, {
          ...curTrack,
          animationPreset: remaining.length === 0 ? 'none' : 'custom',
          keyframes: remaining,
          pendingEditTime: undefined,
        });
      });
    },
    []
  );

  const handleApplyTrackPreset = useCallback(
    (trackId: TimelineTrackId, preset: AutoAnimationPreset, customDurationSec?: number) => {
      setProject((prev) => {
        const cfg = getTrackBoundsConfig(trackId, prev);
        const curTrack = readTrackFromProject(prev, trackId);
        if (preset === 'none') {
          return writeTrackToProject(prev, trackId, {
            ...curTrack,
            animationPreset: 'none',
            keyframes: [],
            pendingEditTime: undefined,
          });
        }

        const slotObj = trackId.startsWith('slot-')
          ? prev.imageSequence[Number(trackId.replace('slot-', '')) - 1]
          : undefined;
        const winStart = slotObj ? slotObj.startTime : cfg.minTime;
        const winEnd = slotObj ? slotObj.endTime : cfg.maxTime;
        const defaultSpan = Math.max(0.2, winEnd - winStart);
        const maxPossibleSpan = Math.max(0.2, cfg.maxTime - winStart);

        const animDur = customDurationSec
          ? Math.max(0.2, Math.min(maxPossibleSpan, customDurationSec))
          : curTrack.animationDuration
          ? Math.max(0.2, Math.min(maxPossibleSpan, curTrack.animationDuration))
          : defaultSpan;
        const animEnd = Number(Math.min(cfg.maxTime, winStart + animDur).toFixed(2));
        const baseZ = clampTrackScale(curTrack.scale || cfg.defaultScale, cfg.minScale, cfg.maxScale);
        const isTextOrPanel = trackId.startsWith('text-') || trackId === 'panel';
        const relStep = isTextOrPanel
          ? Math.max(0.01, baseZ * 0.04)
          : Math.max(0.02, baseZ * 0.07);
        const peakZoom = clampTrackScale(
          Number((baseZ + relStep).toFixed(2)),
          cfg.minScale,
          cfg.maxScale
        );

        const generated = generateTrackPresetKeyframes(
          preset,
          winStart,
          animEnd,
          baseZ,
          curTrack.posX ?? cfg.defaultPosX,
          curTrack.posY ?? cfg.defaultPosY,
          peakZoom,
          isTextOrPanel ? 8 : 100,
          cfg.minScale,
          cfg.maxScale
        );

        return writeTrackToProject(prev, trackId, {
          ...curTrack,
          animationPreset: preset,
          animationDuration: Number(animDur.toFixed(2)),
          easing: curTrack.easing || 'ease-in-out',
          keyframes: generated,
          pendingEditTime: undefined,
        });
      });
    },
    []
  );

  const handleUpdateTrackMeta = useCallback(
    (
      trackId: TimelineTrackId,
      patch: { easing?: AnimationEasing; animationDuration?: number }
    ) => {
      setProject((prev) => {
        const curTrack = readTrackFromProject(prev, trackId);
        return writeTrackToProject(prev, trackId, {
          ...curTrack,
          ...patch,
        });
      });
    },
    []
  );

  const handleResetTrackPosition = useCallback(
    (trackId: TimelineTrackId) => {
      setProject((prev) => {
        const cfg = getTrackBoundsConfig(trackId, prev);
        const curTrack = readTrackFromProject(prev, trackId);
        if (curTrack.keyframes.length === 0) {
          return writeTrackToProject(prev, trackId, {
            ...curTrack,
            posX: cfg.defaultPosX,
            posY: cfg.defaultPosY,
            pendingEditTime: undefined,
          });
        }
        const nearKf = findKeyframeNearTime(curTrack.keyframes, playheadRef.current, 0.08);
        if (nearKf) {
          return writeTrackToProject(prev, trackId, {
            ...curTrack,
            posX: cfg.defaultPosX,
            posY: cfg.defaultPosY,
            keyframes: curTrack.keyframes.map((k) =>
              k.id === nearKf.id ? { ...k, posX: cfg.defaultPosX, posY: cfg.defaultPosY } : k
            ),
          });
        }
        return writeTrackToProject(prev, trackId, {
          ...curTrack,
          posX: cfg.defaultPosX,
          posY: cfg.defaultPosY,
          keyframes: curTrack.keyframes.map((k) => ({
            ...k,
            posX: cfg.defaultPosX,
            posY: cfg.defaultPosY,
          })),
        });
      });
    },
    []
  );

  const handleResetTrackScale = useCallback((trackId: TimelineTrackId) => {
    setProject((prev) => {
      const cfg = getTrackBoundsConfig(trackId, prev);
      const curTrack = readTrackFromProject(prev, trackId);
      if (curTrack.keyframes.length === 0) {
        return writeTrackToProject(prev, trackId, {
          ...curTrack,
          scale: cfg.defaultScale,
          pendingEditTime: undefined,
        });
      }
      const nearKf = findKeyframeNearTime(curTrack.keyframes, playheadRef.current, 0.08);
      if (nearKf) {
        return writeTrackToProject(prev, trackId, {
          ...curTrack,
          scale: cfg.defaultScale,
          keyframes: curTrack.keyframes.map((k) =>
            k.id === nearKf.id ? { ...k, zoom: cfg.defaultScale } : k
          ),
        });
      }
      return writeTrackToProject(prev, trackId, {
        ...curTrack,
        scale: cfg.defaultScale,
        keyframes: curTrack.keyframes.map((k) => ({ ...k, zoom: cfg.defaultScale })),
      });
    });
  }, []);

  const handleResetSequenceTimings = () => {
    setProject((prev) => {
      const defaults = createDefaultSequenceSlots(prev.durationSeconds);
      return {
        ...prev,
        imageSequence: prev.imageSequence.map((slot, idx) => {
          const def = defaults[idx];
          const nextKfs =
            slot.url && slot.animationPreset !== 'none'
              ? generateSlotPresetKeyframes(
                  slot.animationPreset === 'custom' ? 'zoom-in' : slot.animationPreset,
                  def.startTime,
                  def.endTime,
                  slot.posX ?? 0,
                  slot.posY ?? 0,
                  slot.slotNumber
                )
              : [];
          return {
            ...slot,
            startTime: def.startTime,
            endTime: def.endTime,
            keyframes: nextKfs,
            pendingEditTime: undefined,
          };
        }),
      };
    });
  };

  const handleUpdateTransition = (updated: Partial<SequenceTransitionSettings>) => {
    setProject((prev) => ({
      ...prev,
      sequenceTransition: {
        ...prev.sequenceTransition,
        ...updated,
      },
    }));
  };

  const handleTogglePreviewPlay = useCallback(() => {
    setIsPreviewPlaying((prevPlaying) => {
      const next = !prevPlaying;
      isPlayingRef.current = next;
      if (next) {
        setProject((prevProj) => clearAllPendingEdits(prevProj));
      }
      return next;
    });
  }, []);

  const handleUpdateDuration = (sec: number) => {
    setProject((prev) => ({
      ...prev,
      durationSeconds: sec,
      imageSequence: rescaleSequenceTimings(
        prev.imageSequence,
        prev.durationSeconds,
        sec
      ),
      adjust: {
        ...prev.adjust,
        bgTrack: remapTrackDuration(prev.adjust.bgTrack, prev.durationSeconds, sec),
      },
      panelTransform: remapTrackDuration(prev.panelTransform, prev.durationSeconds, sec),
      brandingTransform: remapTrackDuration(prev.brandingTransform, prev.durationSeconds, sec),
      textTransform: remapTrackDuration(prev.textTransform, prev.durationSeconds, sec),
      template2: {
        ...prev.template2,
        lowerMedia: {
          ...prev.template2.lowerMedia,
          bgTrack: remapTrackDuration(
            prev.template2.lowerMedia.bgTrack,
            prev.durationSeconds,
            sec
          ),
        },
        panelTransform: remapTrackDuration(
          prev.template2.panelTransform,
          prev.durationSeconds,
          sec
        ),
        brandingTransform: remapTrackDuration(
          prev.template2.brandingTransform,
          prev.durationSeconds,
          sec
        ),
        textTransform: remapTrackDuration(
          prev.template2.textTransform,
          prev.durationSeconds,
          sec
        ),
      },
    }));
    setPlayheadTime((prevT) => Math.min(sec, prevT));
  };

  const handleSaveExport = (exported: ExportedVideo) => {
    setSavedVideos((prev) => [exported, ...prev]);
  };

  const handleDeleteExport = (id: string) => {
    setSavedVideos((prev) => {
      const target = prev.find((v) => v.id === id);
      if (target) {
        try {
          if (target.videoUrl.startsWith('blob:')) URL.revokeObjectURL(target.videoUrl);
          if (target.posterUrl.startsWith('blob:')) URL.revokeObjectURL(target.posterUrl);
        } catch {
          // ignore
        }
      }
      return prev.filter((v) => v.id !== id);
    });
  };

  const handleRestoreTemplateDefaults = () => {
    setProject((prev) => ({
      ...prev,
      branding: {
        ...DEFAULT_WEATHER_TEMPLATE.branding,
        logoDataUrl: prev.branding.logoDataUrl,
        logoName: prev.branding.logoName,
      },
      heading: { ...DEFAULT_WEATHER_TEMPLATE.heading },
      panel: { ...DEFAULT_WEATHER_TEMPLATE.panel },
      script: {
        ...prev.script,
        ...DEFAULT_WEATHER_TEMPLATE.bulletStyle,
      },
      panelTransform: createEmptyTransformTrack(
        DEFAULT_WEATHER_TEMPLATE.panel.panelScale ?? 1.0,
        DEFAULT_WEATHER_TEMPLATE.panel.posX,
        DEFAULT_WEATHER_TEMPLATE.panel.posY
      ),
      brandingTransform: createEmptyTransformTrack(1.0, 0, 0),
      textTransform: createEmptyTransformTrack(1.0, 0, 0),
    }));
  };

  const handleRestoreTemplate2Defaults = () => {
    setProject((prev) => ({
      ...prev,
      template2: {
        ...cloneDefaultTemplate2(),
        branding: {
          ...DEFAULT_TEMPLATE_2.branding,
          logoDataUrl: prev.template2.branding.logoDataUrl,
          logoName: prev.template2.branding.logoName,
        },
        text: {
          ...prev.template2.text,
          fontFamily: DEFAULT_TEMPLATE_2.text.fontFamily,
          fontSize: DEFAULT_TEMPLATE_2.text.fontSize,
          fontWeight: DEFAULT_TEMPLATE_2.text.fontWeight,
          lineHeight: DEFAULT_TEMPLATE_2.text.lineHeight,
          textAlign: DEFAULT_TEMPLATE_2.text.textAlign,
          textColor: DEFAULT_TEMPLATE_2.text.textColor,
          orangeColor: DEFAULT_TEMPLATE_2.text.orangeColor,
          blueColor: DEFAULT_TEMPLATE_2.text.blueColor,
          autoFitText: DEFAULT_TEMPLATE_2.text.autoFitText,
          textOffsetX: DEFAULT_TEMPLATE_2.text.textOffsetX,
          textOffsetY: DEFAULT_TEMPLATE_2.text.textOffsetY,
        },
      },
    }));
  };

  const handleLayoutInfoChange = useCallback(
    (info: {
      usedFontSize: number;
      requestedFontSize: number;
      wasAutoFitted: boolean;
      overflowWarning: boolean;
    }) => {
      setAutoFitInfo(info);
    },
    []
  );

  const populatedSeqCount = project.imageSequence.filter((s) => !!s.url).length;
  const activeLogo = project.activeTemplate === 'template-2' ? loadedLogoT2 : loadedLogo;
  const activeBgFitMode =
    project.activeTemplate === 'template-2'
      ? project.template2.lowerMedia.bgFitMode || 'fill'
      : project.adjust.fitMode || 'fill';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-rose-600 selection:text-white">
      {/* Top Header Navigation */}
      <TopNav
        title={project.title}
        onTitleChange={(newTitle) =>
          setProject((prev) => ({ ...prev, title: newTitle }))
        }
        activeTab={activeTopTab}
        onTabChange={(tab) => {
          setActiveTopTab(tab);
          if (tab === 'export') {
            setIsCreateModalOpen(true);
          }
        }}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        savedCount={savedVideos.length}
        durationSeconds={project.durationSeconds}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {activeTopTab === 'history' ? (
          <SavedLoopsTab
            savedVideos={savedVideos}
            onDeleteVideo={handleDeleteExport}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Workspace */}
              <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-5">
                {/* Workspace Header */}
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                      24 SKY ALERT · Weather Shorts Builder
                    </div>
                    <h1 className="text-base md:text-lg font-bold text-neutral-100">
                      Make your weather Short
                    </h1>
                  </div>
                  <div className="text-xs text-neutral-400">
                    9:16 Vertical <span className="text-neutral-600">·</span>{' '}
                    {project.resolution === '1080p' ? '1080×1920' : '720×1280'}
                  </div>
                </div>

                {/* Independent Template 1 / Template 2 Selector */}
                <TemplateSelector
                  activeTemplate={project.activeTemplate}
                  onSelectTemplate={(templateId: TemplateId) =>
                    setProject((prev) => ({ ...prev, activeTemplate: templateId }))
                  }
                />

                {/* 5 Organized Workspace Sections */}
                <div className="flex items-center border-b border-neutral-800 gap-4 md:gap-5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setWorkspaceSubTab('script')}
                    className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                      workspaceSubTab === 'script'
                        ? 'border-rose-500 text-rose-500'
                        : 'border-transparent text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Script</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkspaceSubTab('media')}
                    className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                      workspaceSubTab === 'media'
                        ? 'border-rose-500 text-rose-500'
                        : 'border-transparent text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Add Media</span>
                    {(project.mediaUrl || populatedSeqCount > 0) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkspaceSubTab('adjust')}
                    className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                      workspaceSubTab === 'adjust'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Sequence & Keyframes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkspaceSubTab('template')}
                    className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                      workspaceSubTab === 'template'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <LayoutTemplate className="w-3.5 h-3.5" />
                    <span>Template Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkspaceSubTab('sound')}
                    className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                      workspaceSubTab === 'sound'
                        ? 'border-rose-500 text-rose-500'
                        : 'border-transparent text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Background Sound</span>
                    {project.audio.enabled && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </button>
                </div>

                {/* Active Tab Body */}
                <div className="pt-1">
                  {workspaceSubTab === 'script' &&
                    (project.activeTemplate === 'template-2' ? (
                      <Template2ScriptTab
                        textSettings={project.template2.text}
                        onChange={(updated) =>
                          setProject((prev) => ({
                            ...prev,
                            template2: {
                              ...prev.template2,
                              text: { ...prev.template2.text, ...updated },
                            },
                          }))
                        }
                        onNext={() => setWorkspaceSubTab('media')}
                        autoFitInfo={autoFitInfo}
                      />
                    ) : (
                      <ScriptTab
                        script={project.script}
                        onChange={(updated) =>
                          setProject((prev) => ({
                            ...prev,
                            script: { ...prev.script, ...updated },
                          }))
                        }
                        onNext={() => setWorkspaceSubTab('media')}
                        onLoadPreset={handleLoadPreset}
                        autoFitInfo={autoFitInfo}
                      />
                    ))}

                  {workspaceSubTab === 'media' && (
                    <AddMediaTab
                      activeTemplate={project.activeTemplate}
                      currentMediaUrl={project.mediaUrl}
                      currentMediaName={project.mediaName}
                      currentMediaType={project.mediaType}
                      mediaLoadError={mediaLoadError}
                      bgFitMode={activeBgFitMode}
                      imageSequence={project.imageSequence}
                      activeSequenceIndex={project.activeSequenceIndex}
                      onSelectMedia={handleSelectMedia}
                      onRemoveBackgroundMedia={handleRemoveBackgroundMedia}
                      onChangeBgFitMode={(mode) => {
                        setProject((prev) =>
                          prev.activeTemplate === 'template-2'
                            ? {
                                ...prev,
                                template2: {
                                  ...prev.template2,
                                  lowerMedia: { ...prev.template2.lowerMedia, bgFitMode: mode },
                                },
                              }
                            : {
                                ...prev,
                                adjust: { ...prev.adjust, fitMode: mode },
                              }
                        );
                      }}
                      onResetBgTransform={() => {
                        handleResetTrackPosition('background');
                        handleResetTrackScale('background');
                      }}
                      onAssignSequenceSlot={handleAssignSequenceSlot}
                      onUpdateSequenceSlot={handleUpdateSequenceSlot}
                      onRemoveSequenceSlot={handleRemoveSequenceSlot}
                      onSelectSequenceSlot={handleSelectSequenceSlot}
                      onNext={() => setWorkspaceSubTab('adjust')}
                    />
                  )}

                  {workspaceSubTab === 'adjust' && (
                    <AdjustPictureTab
                      activeTemplate={project.activeTemplate}
                      adjust={project.adjust}
                      template2LowerMedia={project.template2.lowerMedia}
                      imageSequence={project.imageSequence}
                      activeSequenceIndex={project.activeSequenceIndex}
                      sequenceTransition={project.sequenceTransition}
                      videoDurationSec={project.durationSeconds}
                      playheadTime={playheadTime}
                      isPreviewPlaying={isPreviewPlaying}
                      autoKeyframesEnabled={!!project.autoKeyframesEnabled}
                      onToggleAutoKeyframes={handleToggleAutoKeyframes}
                      onTogglePreviewPlay={handleTogglePreviewPlay}
                      onSeekPlayhead={handleSeekPlayhead}
                      onChange={(updated) =>
                        setProject((prev) => ({
                          ...prev,
                          adjust: {
                            ...prev.adjust,
                            ...updated,
                            bgTrack: prev.adjust.bgTrack
                              ? {
                                  ...prev.adjust.bgTrack,
                                  ...(updated.scale !== undefined ? { scale: updated.scale } : {}),
                                  ...(updated.moveX !== undefined ? { posX: updated.moveX } : {}),
                                  ...(updated.moveY !== undefined ? { posY: updated.moveY } : {}),
                                }
                              : undefined,
                          },
                        }))
                      }
                      onChangeTemplate2LowerMedia={(updated) =>
                        setProject((prev) => ({
                          ...prev,
                          template2: {
                            ...prev.template2,
                            lowerMedia: {
                              ...prev.template2.lowerMedia,
                              ...updated,
                              bgTrack: prev.template2.lowerMedia.bgTrack
                                ? {
                                    ...prev.template2.lowerMedia.bgTrack,
                                    ...(updated.bgScale !== undefined ? { scale: updated.bgScale } : {}),
                                    ...(updated.bgMoveX !== undefined ? { posX: updated.bgMoveX } : {}),
                                    ...(updated.bgMoveY !== undefined ? { posY: updated.bgMoveY } : {}),
                                  }
                                : undefined,
                            },
                          },
                        }))
                      }
                      onChangeBackgroundTransform={(patch) =>
                        handleChangeTrackTransform('background', patch)
                      }
                      onSelectSequenceSlot={handleSelectSequenceSlot}
                      onUpdateSequenceSlot={handleUpdateSequenceSlot}
                      onChangeSlotTransform={handleChangeSlotTransform}
                      onResetSequenceTimings={handleResetSequenceTimings}
                      onUpdateTransition={handleUpdateTransition}
                      onGoToMedia={() => setWorkspaceSubTab('media')}
                      onNextToTemplate={() => setWorkspaceSubTab('template')}
                      onNextToSound={() => setWorkspaceSubTab('sound')}
                      onPreviewAndCreate={() => setIsCreateModalOpen(true)}
                    />
                  )}

                  {workspaceSubTab === 'template' &&
                    (project.activeTemplate === 'template-2' ? (
                      <Template2SettingsTab
                        settings={project.template2}
                        onUpdateBranding={(updated) =>
                          setProject((prev) => ({
                            ...prev,
                            template2: {
                              ...prev.template2,
                              branding: { ...prev.template2.branding, ...updated },
                            },
                          }))
                        }
                        onUpdatePanel={(updated) =>
                          setProject((prev) => ({
                            ...prev,
                            template2: {
                              ...prev.template2,
                              panel: { ...prev.template2.panel, ...updated },
                              panelTransform: prev.template2.panelTransform
                                ? {
                                    ...prev.template2.panelTransform,
                                    ...(updated.panelScale !== undefined
                                      ? { scale: updated.panelScale }
                                      : {}),
                                    ...(updated.posX !== undefined ? { posX: updated.posX } : {}),
                                    ...(updated.posY !== undefined ? { posY: updated.posY } : {}),
                                  }
                                : undefined,
                            },
                          }))
                        }
                        onUpdateText={(updated) =>
                          setProject((prev) => ({
                            ...prev,
                            template2: {
                              ...prev.template2,
                              text: { ...prev.template2.text, ...updated },
                            },
                          }))
                        }
                        onUpdateAccents={(updated) =>
                          setProject((prev) => ({
                            ...prev,
                            template2: {
                              ...prev.template2,
                              accents: { ...prev.template2.accents, ...updated },
                            },
                          }))
                        }
                        onUpdateLowerMedia={(updated) =>
                          setProject((prev) => ({
                            ...prev,
                            template2: {
                              ...prev.template2,
                              lowerMedia: {
                                ...prev.template2.lowerMedia,
                                ...updated,
                                bgTrack: prev.template2.lowerMedia.bgTrack
                                  ? {
                                      ...prev.template2.lowerMedia.bgTrack,
                                      ...(updated.bgScale !== undefined ? { scale: updated.bgScale } : {}),
                                      ...(updated.bgMoveX !== undefined ? { posX: updated.bgMoveX } : {}),
                                      ...(updated.bgMoveY !== undefined ? { posY: updated.bgMoveY } : {}),
                                    }
                                  : undefined,
                              },
                            },
                          }))
                        }
                        onRestoreDefaults={handleRestoreTemplate2Defaults}
                        onNextToSound={() => setWorkspaceSubTab('sound')}
                        lastSavedAt={lastSavedAtT2}
                      />
                    ) : (
                      <TemplateSettingsTab
                        branding={project.branding}
                        heading={project.heading}
                        panel={project.panel}
                        script={project.script}
                        onUpdateBranding={(updated) =>
                          setProject((prev) => ({
                            ...prev,
                            branding: { ...prev.branding, ...updated },
                          }))
                        }
                        onUpdateHeading={(updated) =>
                          setProject((prev) => ({
                            ...prev,
                            heading: { ...prev.heading, ...updated },
                          }))
                        }
                        onUpdatePanel={(updated) =>
                          setProject((prev) => ({
                            ...prev,
                            panel: { ...prev.panel, ...updated },
                            panelTransform: prev.panelTransform
                              ? {
                                  ...prev.panelTransform,
                                  ...(updated.panelScale !== undefined
                                    ? { scale: updated.panelScale }
                                    : {}),
                                  ...(updated.posX !== undefined ? { posX: updated.posX } : {}),
                                  ...(updated.posY !== undefined ? { posY: updated.posY } : {}),
                                }
                              : undefined,
                          }))
                        }
                        onUpdateScript={(updated) =>
                          setProject((prev) => ({
                            ...prev,
                            script: { ...prev.script, ...updated },
                          }))
                        }
                        onRestoreDefaults={handleRestoreTemplateDefaults}
                        onNextToSound={() => setWorkspaceSubTab('sound')}
                        lastSavedAt={lastSavedAt}
                      />
                    ))}

                  {workspaceSubTab === 'sound' && (
                    <BackgroundSoundTab
                      audio={project.audio}
                      onChange={(updated) =>
                        setProject((prev) => ({
                          ...prev,
                          audio: { ...prev.audio, ...updated },
                        }))
                      }
                      onPreviewAndCreate={() => setIsCreateModalOpen(true)}
                    />
                  )}
                </div>
              </div>

              {/* Right Column: Live 9:16 Preview & Controls */}
              <div className="lg:col-span-5 sticky top-20">
                <DesignPreview
                  project={project}
                  loadedMedia={loadedMedia}
                  mediaLoadError={mediaLoadError}
                  loadedLogo={activeLogo}
                  loadedOverlayMap={loadedOverlayMap}
                  playheadTime={playheadTime}
                  isPlaying={isPreviewPlaying}
                  selectedTrackId={selectedTrackId}
                  autoKeyframesEnabled={!!project.autoKeyframesEnabled}
                  onToggleAutoKeyframes={handleToggleAutoKeyframes}
                  onPauseForEdit={handlePauseForEdit}
                  onSelectTrack={setSelectedTrackId}
                  onPlayheadChange={setPlayheadTime}
                  onTogglePlaying={handleTogglePreviewPlay}
                  onOpenCreateModal={() => setIsCreateModalOpen(true)}
                  onUpdateDuration={handleUpdateDuration}
                  onUpdateAdjust={(updated) =>
                    setProject((prev) => ({
                      ...prev,
                      adjust: { ...prev.adjust, ...updated },
                    }))
                  }
                  onUpdatePanel={(updated) =>
                    setProject((prev) => ({
                      ...prev,
                      panel: { ...prev.panel, ...updated },
                    }))
                  }
                  onUpdateT2Panel={(updated) =>
                    setProject((prev) => ({
                      ...prev,
                      template2: {
                        ...prev.template2,
                        panel: { ...prev.template2.panel, ...updated },
                      },
                    }))
                  }
                  onUpdateT2LowerMedia={(updated) =>
                    setProject((prev) => ({
                      ...prev,
                      template2: {
                        ...prev.template2,
                        lowerMedia: { ...prev.template2.lowerMedia, ...updated },
                      },
                    }))
                  }
                  onSelectSequenceSlot={handleSelectSequenceSlot}
                  onChangeSlotTransform={handleChangeSlotTransform}
                  onChangeTrackTransform={handleChangeTrackTransform}
                  onResetTrackPosition={handleResetTrackPosition}
                  onResetTrackScale={handleResetTrackScale}
                  onLayoutInfoChange={handleLayoutInfoChange}
                />
              </div>
            </div>

            {/* Horizontal Multi-Track Keyframe Timeline Dock */}
            <KeyframeTimeline
              project={project}
              playheadTime={playheadTime}
              isPlaying={isPreviewPlaying}
              selectedTrackId={selectedTrackId}
              autoKeyframesEnabled={!!project.autoKeyframesEnabled}
              onToggleAutoKeyframes={handleToggleAutoKeyframes}
              onSelectTrack={(trackId) => {
                setSelectedTrackId(trackId);
                if (trackId.startsWith('slot-')) {
                  const idx = (Number(trackId.replace('slot-', '')) - 1) as 0 | 1 | 2;
                  handleSelectSequenceSlot(idx, false);
                }
              }}
              onSeekPlayhead={handleSeekPlayhead}
              onTogglePlay={handleTogglePreviewPlay}
              onAddOrUpdateKeyframe={handleAddOrUpdateTrackKeyframe}
              onMoveKeyframeTime={handleMoveTrackKeyframeTime}
              onUpdateKeyframeFields={handleUpdateTrackKeyframeFields}
              onDeleteKeyframe={handleDeleteTrackKeyframe}
              onApplyTrackPreset={handleApplyTrackPreset}
              onUpdateTrackMeta={handleUpdateTrackMeta}
              onResetTrackScale={handleResetTrackScale}
              onResetTrackPosition={handleResetTrackPosition}
            />
          </>
        )}
      </main>

      {/* Preview & Export Modal */}
      <CreateVideoModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        project={project}
        loadedMedia={loadedMedia}
        loadedLogo={activeLogo}
        loadedOverlayMap={loadedOverlayMap}
        onSaveExport={handleSaveExport}
        onUpdateDuration={handleUpdateDuration}
        onUpdateResolution={(res) =>
          setProject((prev) => ({ ...prev, resolution: res }))
        }
        onOpenSoundTab={() => {
          setActiveTopTab('create');
          setWorkspaceSubTab('sound');
        }}
        onUpdateAudio={(audioUpdate) =>
          setProject((prev) => ({
            ...prev,
            audio: { ...prev.audio, ...audioUpdate },
          }))
        }
      />
    </div>
  );
}
