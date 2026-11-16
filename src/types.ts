export type AnimationEasing = 'ease-in-out' | 'linear' | 'ease-in' | 'ease-out';

export type AutoAnimationPreset =
  | 'none'
  | 'slide-left-right'
  | 'slide-right-left'
  | 'slide-in-left'
  | 'slide-in-right'
  | 'slide-out-left'
  | 'slide-out-right'
  | 'zoom-in-slide-left'
  | 'zoom-in-slide-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-in-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'zoom-in-pan-left'
  | 'zoom-in-pan-right'
  | 'zoom-out-pan-left'
  | 'zoom-out-pan-right'
  | 'custom';

export type SequenceTransitionType = 'crossfade' | 'hard-cut' | 'fade-in-out';

export type BackgroundFitMode = 'fill' | 'fit' | 'custom';

export type TimelineTrackId =
  | 'background'
  | 'slot-1'
  | 'slot-2'
  | 'slot-3'
  | 'panel'
  | 'text-header'
  | 'text-body';

export interface ImageKeyframe {
  id: string;
  time: number; // absolute timestamp in seconds within the video timeline
  zoom: number; // scale factor (e.g. 1.0 = 100%, configurable range e.g. 0.1 to 10.0)
  posX: number; // canvas-relative px at 1080p reference (0 = horizontal center, unbounded)
  posY: number; // canvas-relative px at 1080p reference (0 = default anchor Y, unbounded)
  opacity?: number; // 0 to 1
  rotation?: number; // degrees
}

export interface KeyframedTransformTrack {
  scale: number; // default 1.0
  posX: number; // px or % offset depending on track, default 0
  posY: number; // px or % offset depending on track, default 0
  animationPreset: AutoAnimationPreset; // default 'none'
  animationDuration?: number; // seconds, defaults to project duration
  easing: AnimationEasing; // default 'ease-in-out'
  keyframes: ImageKeyframe[];
  pendingEditTime?: number;
}

export interface SequenceTransitionSettings {
  enabled: boolean;
  type: SequenceTransitionType; // default 'crossfade'
  duration: number; // seconds, 0.1 to 1.2 (default 0.35s)
}

export interface ImageSequenceSlot {
  id: string; // 'slot-1' | 'slot-2' | 'slot-3'
  slotNumber: 1 | 2 | 3;
  url: string;
  name: string;
  type: 'image' | 'video';
  visible: boolean;
  startTime: number; // seconds (defaults: 0, 2.5, 5.0 for 8s)
  endTime: number; // seconds (defaults: 2.5, 5.0, 8.0 for 8s)

  // Full-canvas unrestricted placement & appearance (1080p canonical pixels, no fixed crop zone)
  posX: number; // unrestricted horizontal px offset from canvas center at 1080p (e.g. -500 to +500+)
  posY: number; // unrestricted vertical px offset from default lower anchor at 1080p
  baseScalePercent: number; // 20 to 200 (% base canvas size at 100% zoom, default 88)
  zoom: number; // configurable zoom scale (default range 0.1 to 10.0)
  minZoom?: number; // default 0.1 (10%)
  maxZoom?: number; // default 10.0 (1000%)
  rotation?: number; // optional degrees (-360 to 360)
  opacity: number; // 0 to 1, default 1.0
  borderRadius: number; // px at 1080p, default 20
  shadow: boolean;
  borderEnabled: boolean;
  zOrder: 'below-panel' | 'above-panel'; // default 'below-panel' (behind black text panel)

  // Independent keyframe animation per slot
  animationPreset: AutoAnimationPreset;
  animationDuration?: number;
  easing: AnimationEasing; // default 'ease-in-out'
  keyframes: ImageKeyframe[];
  pendingEditTime?: number; // temporary playhead edit before clicking Add Keyframe
}

export interface BulletItem {
  id: string;
  text: string;
  colorMode: 'auto' | 'white' | 'yellow' | 'red';
  highlightedWords: number[]; // word indices highlighted in yellow
  emergencyWords?: number[]; // word indices highlighted in red emergency accent
}

export interface BrandingSettings {
  showBranding: boolean;
  logoDataUrl: string | null;
  logoName: string;
  logoSize: number; // px at 1080p scale
  logoShape: 'rounded' | 'circle' | 'square';
  logoOffsetX: number;
  logoOffsetY: number;
  channelName: string; // e.g. '24 SKY ALERT'
  channelNameSize: number;
  channelNameColor: string;
  channelNameOffsetX: number;
  channelNameOffsetY: number;
  headerAlign: 'left' | 'center' | 'right';
}

export interface HeadingSettings {
  text: string; // e.g. 'DID YOU KNOW?'
  fontFamily: string;
  fontSize: number;
  color: string;
  highlightColor: string;
  highlightedWordIndices: number[];
  align: 'left' | 'center' | 'right';
  uppercase: boolean;
  offsetX: number;
  offsetY: number;
  marginBottom: number;
}

export interface PanelSettings {
  widthPercent: number;
  heightPercent: number;
  posX: number;
  posY: number;
  panelScale?: number; // proportional group scale (default 1.0)
  backgroundColor: string;
  opacity: number;
  borderRadius: number;
  paddingX: number;
  paddingY: number;
  borderEnabled: boolean;
  shadowEnabled: boolean;
}

export interface ScriptSettings {
  text: string;
  bullets: BulletItem[];
  bulletColorMode: 'alternating' | 'white-with-highlights';
  alternateStartColor: 'yellow' | 'white';
  bulletSymbol: '•' | '▪' | '▸' | '—';
  fontSize: number;
  autoFitText: boolean;
  fontFamily: string;
  lineHeight: number;
  bulletSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  textColor: string;
  yellowColor: string;
  emergencyColor: string;
  textOffsetX: number;
  textOffsetY: number;

  // Legacy / compatibility fields kept for panel mapping
  boxBackgroundColor: string;
  boxOpacity: number;
  boxBorderRadius: number;
  boxPadding: number;
  boxMarginTop: number;
  boxMaxWidth: number;
  moveX?: number;
  moveY?: number;
  autoHighlightKeywords?: boolean;
  highlightColor?: string;
  customKeywords?: string[];
  excludedKeywords?: string[];
}

export interface AdjustSettings {
  backgroundFitMode: 'cover' | 'framed';
  fitMode?: BackgroundFitMode; // 'fill' | 'fit' | 'custom'
  scale: number;
  moveX: number;
  moveY: number;
  imageBorderRadius: number;
  imageShadow: boolean;
  bgBlur: number;
  bgDarkness: number;
  bgScale: number;
  motionType: 'static' | 'subtle-drift' | 'ken-burns';
  motionIntensity: number;
  bgTrack?: KeyframedTransformTrack;
}

export interface AudioSettings {
  enabled: boolean;
  ambientTrack: 'none' | 'cinematic-pulse' | 'subtle-mystery' | 'vintage-warmth';
  customAudioUrl?: string;
  customAudioName?: string;
  customAudioSize?: number;
  volume: number;
  loop?: boolean;
}

export interface WeatherTemplateSettings {
  branding: BrandingSettings;
  heading: HeadingSettings;
  panel: PanelSettings;
  bulletStyle: {
    bulletColorMode: 'alternating' | 'white-with-highlights';
    alternateStartColor: 'yellow' | 'white';
    bulletSymbol: '•' | '▪' | '▸' | '—';
    fontSize: number;
    autoFitText: boolean;
    fontFamily: string;
    lineHeight: number;
    bulletSpacing: number;
    textAlign: 'left' | 'center' | 'right';
    textColor: string;
    yellowColor: string;
    emergencyColor: string;
    textOffsetX: number;
    textOffsetY: number;
  };
  panelTransform?: KeyframedTransformTrack;
  brandingTransform?: KeyframedTransformTrack;
  textTransform?: KeyframedTransformTrack;
}

export type TemplateId = 'template-1' | 'template-2';

export interface Template2BrandingSettings {
  showBranding: boolean;
  logoDataUrl: string | null;
  logoName: string;
  logoSize: number; // px at 1080p
  logoShape: 'circle' | 'rounded' | 'square';
  channelName: string; // default '24 SKY ALERT'
  channelNameSize: number;
  channelNameColor: string;
  subtitle: string; // e.g. '@24SkyAlert'
  subtitleSize: number;
  subtitleColor: string;
  logoOffsetX: number;
  logoOffsetY: number;
  headerMarginBottom: number;
}

export interface Template2PanelSettings {
  widthPercent: number; // e.g. 98
  heightPercent: number; // e.g. 48 (upper ~50%)
  posX: number; // -50 to 50
  posY: number; // -50 to 50
  panelScale?: number; // proportional group scale (0.4 to 2.0, default 1.0)
  backgroundColor: string; // '#000000'
  opacity: number; // 1.0
  borderRadius: number; // 28
  paddingX: number; // 44
  paddingY: number; // 28
  borderEnabled: boolean;
}

export interface Template2TextSettings {
  content: string;
  orangeWords: number[]; // word indices highlighted in orange/yellow
  blueWords: number[]; // word indices highlighted in blue
  fontFamily: string;
  fontSize: number; // px at 1080p
  fontWeight: number; // 400 | 500 | 600 | 700 | 800
  lineHeight: number;
  textAlign: 'left' | 'center' | 'right';
  textColor: string; // main white '#ffffff'
  orangeColor: string; // '#f59e0b'
  blueColor: string; // '#38bdf8'
  autoFitText: boolean;
  textOffsetX: number;
  textOffsetY: number;
}

export interface Template2AccentSettings {
  dividerEnabled: boolean;
  dividerColor: string;
  dividerHeight: number; // px at 1080p
  bottomAccentEnabled: boolean;
  bottomAccentColor: string;
  bottomAccentHeight: number; // px at 1080p
}

export interface Template2LowerMediaSettings {
  heightPercent: number; // 35 to 70, default 50
  offsetY: number; // -30 to 30
  bgFitMode?: BackgroundFitMode; // 'fill' | 'fit' | 'custom'
  bgScale: number; // 0.3 to 4.0
  bgMoveX: number; // -100 to 100
  bgMoveY: number; // -100 to 100
  bgDimness: number; // 0 to 0.6
  bgMotionType: 'static' | 'subtle-drift' | 'ken-burns';
  slotBaseFill: 'cover' | 'contain';
  bgTrack?: KeyframedTransformTrack;
}

export interface Template2Settings {
  branding: Template2BrandingSettings;
  panel: Template2PanelSettings;
  text: Template2TextSettings;
  accents: Template2AccentSettings;
  lowerMedia: Template2LowerMediaSettings;
  panelTransform?: KeyframedTransformTrack; // NOT animated by default
  brandingTransform?: KeyframedTransformTrack; // NOT animated by default
  textTransform?: KeyframedTransformTrack; // NOT animated by default
}

export interface VideoProject {
  id: string;
  title: string;
  activeTemplate: TemplateId;
  durationSeconds: number; // default 8s
  fps: number; // 30
  resolution: '1080p' | '720p'; // 1080x1920 or 720x1280
  mediaUrl: string;
  mediaName: string;
  mediaType: 'image' | 'video';
  imageSequence: ImageSequenceSlot[]; // Exactly 3 sequential slots (Image 1, Image 2, Image 3)
  activeSequenceIndex: 0 | 1 | 2;
  autoKeyframesEnabled?: boolean;
  sequenceTransition: SequenceTransitionSettings;
  branding: BrandingSettings;
  heading: HeadingSettings;
  panel: PanelSettings;
  script: ScriptSettings;
  adjust: AdjustSettings;
  panelTransform?: KeyframedTransformTrack;
  brandingTransform?: KeyframedTransformTrack;
  textTransform?: KeyframedTransformTrack;
  template2: Template2Settings;
  audio: AudioSettings;
}

export interface RenderProgress {
  isRendering: boolean;
  currentFrame: number;
  totalFrames: number;
  progressPercent: number;
  timeRemainingSec: number;
  error?: string;
}

export interface ExportedVideo {
  id: string;
  title: string;
  videoUrl: string;
  posterUrl: string;
  duration: number;
  resolution: string;
  sizeBytes: number;
  createdAt: string;
  mimeType?: string;
}
