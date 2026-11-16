import {
  VideoProject,
  BrandingSettings,
  HeadingSettings,
  PanelSettings,
  ImageSequenceSlot,
  SequenceTransitionSettings,
  WeatherTemplateSettings,
  BulletItem,
  Template2Settings,
  KeyframedTransformTrack,
} from '../types';
import { parseScriptToBullets } from './scriptParser';
import { remapKeyframesToSlotWindow } from './keyframeAnimation';

export function createEmptyTransformTrack(
  scale: number = 1.0,
  posX: number = 0,
  posY: number = 0
): KeyframedTransformTrack {
  return {
    scale,
    posX,
    posY,
    animationPreset: 'none',
    easing: 'ease-in-out',
    keyframes: [],
  };
}

export const DEFAULT_BRANDING: BrandingSettings = {
  showBranding: true,
  logoDataUrl: null,
  logoName: '',
  logoSize: 64,
  logoShape: 'rounded',
  logoOffsetX: 0,
  logoOffsetY: 0,
  channelName: '24 SKY ALERT',
  channelNameSize: 32,
  channelNameColor: '#ffffff',
  channelNameOffsetX: 0,
  channelNameOffsetY: 0,
  headerAlign: 'center',
};

export const DEFAULT_HEADING: HeadingSettings = {
  text: 'DID YOU KNOW?',
  fontFamily: 'Anton',
  fontSize: 88,
  color: '#ffffff',
  highlightColor: '#facc15',
  highlightedWordIndices: [2], // "DID YOU" in white, "KNOW?" in yellow
  align: 'center',
  uppercase: true,
  offsetX: 0,
  offsetY: 0,
  marginBottom: 24,
};

export const DEFAULT_PANEL: PanelSettings = {
  widthPercent: 88,
  heightPercent: 48,
  posX: 0,
  posY: -22,
  panelScale: 1.0,
  backgroundColor: '#000000',
  opacity: 0.94,
  borderRadius: 34,
  paddingX: 44,
  paddingY: 34,
  borderEnabled: true,
  shadowEnabled: true,
};

export const DEFAULT_SEQUENCE_TRANSITION: SequenceTransitionSettings = {
  enabled: true,
  type: 'crossfade',
  duration: 0.35,
};

export function createDefaultSequenceSlots(
  durationSec: number = 8
): ImageSequenceSlot[] {
  const D = Math.max(2, durationSec || 8);
  const t1 = Number((D * (2.5 / 8)).toFixed(2));
  const t2 = Number((D * (5.0 / 8)).toFixed(2));
  const t3 = Number(D.toFixed(2));

  const baseSlot = {
    url: '',
    name: '',
    type: 'image' as const,
    visible: true,
    posX: 0,
    posY: 0,
    baseScalePercent: 88,
    zoom: 1.0,
    minZoom: 0.1,
    maxZoom: 10.0,
    rotation: 0,
    opacity: 1.0,
    borderRadius: 20,
    shadow: true,
    borderEnabled: false,
    zOrder: 'below-panel' as const,
    animationPreset: 'zoom-in' as const,
    easing: 'ease-in-out' as const,
    keyframes: [],
  };

  return [
    { ...baseSlot, id: 'slot-1', slotNumber: 1, startTime: 0, endTime: t1 },
    { ...baseSlot, id: 'slot-2', slotNumber: 2, startTime: t1, endTime: t2 },
    { ...baseSlot, id: 'slot-3', slotNumber: 3, startTime: t2, endTime: t3 },
  ];
}

export function rescaleSequenceTimings(
  slots: ImageSequenceSlot[],
  oldDuration: number,
  newDuration: number
): ImageSequenceSlot[] {
  const safeOld = Math.max(0.5, oldDuration || 8);
  const ratio = newDuration / safeOld;

  return slots.map((slot) => {
    const oldStart = slot.startTime;
    const oldEnd = slot.endTime;
    const newStart = Number((oldStart * ratio).toFixed(2));
    const newEnd =
      slot.slotNumber === 3 && Math.abs(oldEnd - safeOld) < 0.1
        ? Number(newDuration.toFixed(2))
        : Number(Math.min(newDuration, oldEnd * ratio).toFixed(2));

    return {
      ...slot,
      startTime: newStart,
      endTime: Math.max(newStart + 0.1, newEnd),
      keyframes: remapKeyframesToSlotWindow(
        slot.keyframes || [],
        oldStart,
        oldEnd,
        newStart,
        Math.max(newStart + 0.1, newEnd)
      ),
    };
  });
}

export const DEFAULT_BULLET_STYLE: WeatherTemplateSettings['bulletStyle'] = {
  bulletColorMode: 'alternating',
  alternateStartColor: 'white',
  bulletSymbol: '•',
  fontSize: 34,
  autoFitText: true,
  fontFamily: 'Inter',
  lineHeight: 1.36,
  bulletSpacing: 18,
  textAlign: 'left',
  textColor: '#ffffff',
  yellowColor: '#facc15',
  emergencyColor: '#ef4444',
  textOffsetX: 0,
  textOffsetY: 0,
};

export const DEFAULT_WEATHER_TEMPLATE: WeatherTemplateSettings = {
  branding: DEFAULT_BRANDING,
  heading: DEFAULT_HEADING,
  panel: DEFAULT_PANEL,
  bulletStyle: DEFAULT_BULLET_STYLE,
  panelTransform: createEmptyTransformTrack(1.0, 0, -22),
  brandingTransform: createEmptyTransformTrack(1.0, 0, 0),
  textTransform: createEmptyTransformTrack(1.0, 0, 0),
};

const DEFAULT_T2_PARAGRAPH =
  'A supercell thunderstorm can rotate for hours inside warm, humid air, creating wind gusts over 100 mph across open plains. When cool downdrafts wrap tightly around the updraft, funnel clouds can drop rapidly beneath the storm base before radar warnings reach nearby towns.';

export const TEMPLATE2_SCRIPT_PRESETS: {
  id: string;
  label: string;
  preview: string;
  content: string;
  orangeWords: number[];
  blueWords: number[];
}[] = [
  {
    id: 't2-supercell',
    label: 'Supercell Story',
    preview: 'Rotating storm updrafts & wind gusts...',
    content: DEFAULT_T2_PARAGRAPH,
    orangeWords: [1, 2, 13, 14, 15, 16], // "supercell thunderstorm", "100 mph across open"
    blueWords: [27, 28, 29, 30], // "drop rapidly beneath the"
  },
  {
    id: 't2-flash-flood',
    label: 'Flash Flood Alert',
    preview: 'Stalled rain bands & river crests...',
    content:
      'Stalled tropical rain bands can dump over 6 inches of rain in under two hours, overwhelming urban drainage systems. Even shallow water rushing across low roadways can sweep a heavy vehicle off course in seconds.',
    orangeWords: [5, 6, 7, 8, 9, 10], // "over 6 inches of rain in"
    blueWords: [21, 22, 23, 24], // "rushing across low roadways"
  },
  {
    id: 't2-hurricane-eye',
    label: 'Hurricane Eye',
    preview: 'Eyewall replacement & storm surge...',
    content:
      'Inside the calm eye of a major hurricane, winds temporarily drop to a light breeze while towering storm clouds circle just miles away. As the eyewall moves ashore, pressure plunges and coastal storm surge rises rapidly.',
    orangeWords: [5, 6, 7, 25, 26, 27],
    blueWords: [13, 14, 33, 34],
  },
];

export const DEFAULT_TEMPLATE_2: Template2Settings = {
  branding: {
    showBranding: true,
    logoDataUrl: null,
    logoName: '',
    logoSize: 78,
    logoShape: 'circle',
    channelName: '24 SKY ALERT',
    channelNameSize: 34,
    channelNameColor: '#ffffff',
    subtitle: '@24SkyAlert',
    subtitleSize: 22,
    subtitleColor: '#9ca3af',
    logoOffsetX: 0,
    logoOffsetY: 0,
    headerMarginBottom: 24,
  },
  panel: {
    widthPercent: 98,
    heightPercent: 48,
    posX: 0,
    posY: 0,
    panelScale: 1.0,
    backgroundColor: '#000000',
    opacity: 1.0,
    borderRadius: 28,
    paddingX: 44,
    paddingY: 28,
    borderEnabled: false,
  },
  text: {
    content: DEFAULT_T2_PARAGRAPH,
    orangeWords: [1, 2, 13, 14, 15, 16],
    blueWords: [27, 28, 29, 30],
    fontFamily: 'Inter',
    fontSize: 38,
    fontWeight: 700,
    lineHeight: 1.28,
    textAlign: 'left',
    textColor: '#ffffff',
    orangeColor: '#f59e0b',
    blueColor: '#38bdf8',
    autoFitText: true,
    textOffsetX: 0,
    textOffsetY: 0,
  },
  accents: {
    dividerEnabled: true,
    dividerColor: '#1d9bf0',
    dividerHeight: 6,
    bottomAccentEnabled: true,
    bottomAccentColor: '#1d9bf0',
    bottomAccentHeight: 10,
  },
  lowerMedia: {
    heightPercent: 50,
    offsetY: 0,
    bgFitMode: 'fill',
    bgScale: 1.0,
    bgMoveX: 0,
    bgMoveY: 0,
    bgDimness: 0,
    bgMotionType: 'static',
    slotBaseFill: 'cover',
    bgTrack: createEmptyTransformTrack(1.0, 0, 0),
  },
  panelTransform: createEmptyTransformTrack(1.0, 0, 0),
  brandingTransform: createEmptyTransformTrack(1.0, 0, 0),
  textTransform: createEmptyTransformTrack(1.0, 0, 0),
};

export function cloneDefaultTemplate2(): Template2Settings {
  return {
    branding: { ...DEFAULT_TEMPLATE_2.branding },
    panel: { ...DEFAULT_TEMPLATE_2.panel },
    text: {
      ...DEFAULT_TEMPLATE_2.text,
      orangeWords: [...DEFAULT_TEMPLATE_2.text.orangeWords],
      blueWords: [...DEFAULT_TEMPLATE_2.text.blueWords],
    },
    accents: { ...DEFAULT_TEMPLATE_2.accents },
    lowerMedia: {
      ...DEFAULT_TEMPLATE_2.lowerMedia,
      bgTrack: createEmptyTransformTrack(1.0, 0, 0),
    },
    panelTransform: createEmptyTransformTrack(1.0, 0, 0),
    brandingTransform: createEmptyTransformTrack(1.0, 0, 0),
    textTransform: createEmptyTransformTrack(1.0, 0, 0),
  };
}

const SAMPLE_TORNADO_SCRIPT = `• Tornado warnings are active across Central Oklahoma until 8:30 PM.
• Peak wind gusts could reach 135 mph near Norman and Moore.
• Baseball-sized hail and intense lightning expected along the I-35 corridor.
• Seek shelter immediately in an interior room on the lowest floor.`;

const SAMPLE_FLOOD_SCRIPT = `• Flash flood emergency issued for Harris County after 6.5 inches of rain.
• Several major highways and underpasses are already impassable.
• An additional 3 to 5 inches of rainfall is forecast through midnight.
• Never drive through flooded roadways—turn around, don't drown.`;

const SAMPLE_HURRICANE_SCRIPT = `• Hurricane winds intensified to 145 mph just 80 miles off the coast.
• Storm surge could reach 10 to 14 feet along low-lying coastal bays.
• Tropical storm force winds arrive before sunrise with heavy squalls.
• Complete all storm preparations before conditions deteriorate tonight.`;

function buildBulletsWithSampleHighlights(raw: string): BulletItem[] {
  return parseScriptToBullets(raw);
}

export const PRESET_PROJECTS: VideoProject[] = [
  {
    id: 'preset-severe-storm',
    title: '24 SKY ALERT — Severe Weather Bulletin',
    activeTemplate: 'template-1',
    durationSeconds: 8,
    fps: 30,
    resolution: '1080p',
    mediaUrl: '',
    mediaName: '',
    mediaType: 'video',
    imageSequence: createDefaultSequenceSlots(8),
    activeSequenceIndex: 0,
    sequenceTransition: { ...DEFAULT_SEQUENCE_TRANSITION },
    branding: { ...DEFAULT_BRANDING },
    heading: { ...DEFAULT_HEADING },
    panel: { ...DEFAULT_PANEL },
    script: {
      text: SAMPLE_TORNADO_SCRIPT,
      bullets: buildBulletsWithSampleHighlights(SAMPLE_TORNADO_SCRIPT),
      ...DEFAULT_BULLET_STYLE,
      boxBackgroundColor: DEFAULT_PANEL.backgroundColor,
      boxOpacity: DEFAULT_PANEL.opacity,
      boxBorderRadius: DEFAULT_PANEL.borderRadius,
      boxPadding: DEFAULT_PANEL.paddingX,
      boxMarginTop: 16,
      boxMaxWidth: DEFAULT_PANEL.widthPercent,
      moveX: DEFAULT_PANEL.posX,
      moveY: DEFAULT_PANEL.posY,
    },
    adjust: {
      backgroundFitMode: 'cover',
      fitMode: 'fill',
      scale: 1.0,
      moveX: 0,
      moveY: 0,
      imageBorderRadius: 18,
      imageShadow: true,
      bgBlur: 0,
      bgDarkness: 0.15,
      bgScale: 1.35,
      motionType: 'static',
      motionIntensity: 0.03,
      bgTrack: createEmptyTransformTrack(1.0, 0, 0),
    },
    panelTransform: createEmptyTransformTrack(1.0, DEFAULT_PANEL.posX, DEFAULT_PANEL.posY),
    brandingTransform: createEmptyTransformTrack(1.0, 0, 0),
    textTransform: createEmptyTransformTrack(1.0, 0, 0),
    template2: cloneDefaultTemplate2(),
    audio: {
      enabled: false,
      ambientTrack: 'none',
      volume: 0.7,
      loop: true,
    },
  },
  {
    id: 'preset-flash-flood',
    title: '24 SKY ALERT — Flash Flood Update',
    activeTemplate: 'template-1',
    durationSeconds: 8,
    fps: 30,
    resolution: '1080p',
    mediaUrl: '',
    mediaName: '',
    mediaType: 'video',
    imageSequence: createDefaultSequenceSlots(8),
    activeSequenceIndex: 0,
    sequenceTransition: { ...DEFAULT_SEQUENCE_TRANSITION },
    branding: { ...DEFAULT_BRANDING },
    heading: { ...DEFAULT_HEADING },
    panel: { ...DEFAULT_PANEL },
    script: {
      text: SAMPLE_FLOOD_SCRIPT,
      bullets: buildBulletsWithSampleHighlights(SAMPLE_FLOOD_SCRIPT),
      ...DEFAULT_BULLET_STYLE,
      boxBackgroundColor: DEFAULT_PANEL.backgroundColor,
      boxOpacity: DEFAULT_PANEL.opacity,
      boxBorderRadius: DEFAULT_PANEL.borderRadius,
      boxPadding: DEFAULT_PANEL.paddingX,
      boxMarginTop: 16,
      boxMaxWidth: DEFAULT_PANEL.widthPercent,
      moveX: DEFAULT_PANEL.posX,
      moveY: DEFAULT_PANEL.posY,
    },
    adjust: {
      backgroundFitMode: 'cover',
      fitMode: 'fill',
      scale: 1.0,
      moveX: 0,
      moveY: 0,
      imageBorderRadius: 18,
      imageShadow: true,
      bgBlur: 0,
      bgDarkness: 0.15,
      bgScale: 1.35,
      motionType: 'static',
      motionIntensity: 0.03,
      bgTrack: createEmptyTransformTrack(1.0, 0, 0),
    },
    panelTransform: createEmptyTransformTrack(1.0, DEFAULT_PANEL.posX, DEFAULT_PANEL.posY),
    brandingTransform: createEmptyTransformTrack(1.0, 0, 0),
    textTransform: createEmptyTransformTrack(1.0, 0, 0),
    template2: cloneDefaultTemplate2(),
    audio: {
      enabled: false,
      ambientTrack: 'none',
      volume: 0.7,
      loop: true,
    },
  },
  {
    id: 'preset-hurricane-surge',
    title: '24 SKY ALERT — Hurricane Surge Alert',
    activeTemplate: 'template-1',
    durationSeconds: 8,
    fps: 30,
    resolution: '1080p',
    mediaUrl: '',
    mediaName: '',
    mediaType: 'video',
    imageSequence: createDefaultSequenceSlots(8),
    activeSequenceIndex: 0,
    sequenceTransition: { ...DEFAULT_SEQUENCE_TRANSITION },
    branding: { ...DEFAULT_BRANDING },
    heading: { ...DEFAULT_HEADING },
    panel: { ...DEFAULT_PANEL },
    script: {
      text: SAMPLE_HURRICANE_SCRIPT,
      bullets: buildBulletsWithSampleHighlights(SAMPLE_HURRICANE_SCRIPT),
      ...DEFAULT_BULLET_STYLE,
      boxBackgroundColor: DEFAULT_PANEL.backgroundColor,
      boxOpacity: DEFAULT_PANEL.opacity,
      boxBorderRadius: DEFAULT_PANEL.borderRadius,
      boxPadding: DEFAULT_PANEL.paddingX,
      boxMarginTop: 16,
      boxMaxWidth: DEFAULT_PANEL.widthPercent,
      moveX: DEFAULT_PANEL.posX,
      moveY: DEFAULT_PANEL.posY,
    },
    adjust: {
      backgroundFitMode: 'cover',
      fitMode: 'fill',
      scale: 1.0,
      moveX: 0,
      moveY: 0,
      imageBorderRadius: 18,
      imageShadow: true,
      bgBlur: 0,
      bgDarkness: 0.15,
      bgScale: 1.35,
      motionType: 'static',
      motionIntensity: 0.03,
      bgTrack: createEmptyTransformTrack(1.0, 0, 0),
    },
    panelTransform: createEmptyTransformTrack(1.0, DEFAULT_PANEL.posX, DEFAULT_PANEL.posY),
    brandingTransform: createEmptyTransformTrack(1.0, 0, 0),
    textTransform: createEmptyTransformTrack(1.0, 0, 0),
    template2: cloneDefaultTemplate2(),
    audio: {
      enabled: false,
      ambientTrack: 'none',
      volume: 0.7,
      loop: true,
    },
  },
];
