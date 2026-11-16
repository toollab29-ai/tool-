import { VideoProject, BulletItem, ImageSequenceSlot } from '../types';
import { parseParagraphTokens, parseScriptToBullets } from './scriptParser';
import {
  clampZoom,
  evaluateImageTransformAtTime,
  evaluateTrackTransformAtTime,
  getActiveSequenceSlotsAtTime,
} from './keyframeAnimation';

export interface ColoredToken {
  text: string;
  color: string;
}

export interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderLayoutInfo {
  panelBounds: RectBox;
  mediaBounds: RectBox;
  headerBounds?: RectBox;
  bodyBounds?: RectBox;
  usedBulletFontSize1080: number;
  requestedBulletFontSize1080: number;
  wasAutoFitted: boolean;
  overflowWarning: boolean;
}

/**
 * Draws a rounded rectangle path on a 2D canvas context.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function resolveFontDeclaration(
  fontFamily: string,
  fontSizePx: number,
  isHeading: boolean,
  customWeight?: number
): string {
  const weight = customWeight || (isHeading ? 800 : 500);
  switch (fontFamily) {
    case 'Anton':
      return `400 ${fontSizePx}px "Anton", Impact, sans-serif`;
    case 'Bebas Neue':
      return `400 ${fontSizePx}px "Bebas Neue", Impact, sans-serif`;
    case 'Oswald':
      return `${customWeight || (isHeading ? 700 : 600)} ${fontSizePx}px "Oswald", sans-serif`;
    case 'Montserrat':
      return `${customWeight || (isHeading ? 800 : 600)} ${fontSizePx}px "Montserrat", sans-serif`;
    case 'Roboto':
      return `${customWeight || (isHeading ? 700 : 500)} ${fontSizePx}px "Roboto", sans-serif`;
    case 'Inter':
      return `${weight} ${fontSizePx}px "Inter", system-ui, sans-serif`;
    case 'Georgia':
    case 'serif':
      return `${customWeight || (isHeading ? 700 : 500)} ${fontSizePx}px Georgia, serif`;
    case 'monospace':
      return `${customWeight || (isHeading ? 700 : 500)} ${fontSizePx}px "JetBrains Mono", monospace`;
    default:
      return `${weight} ${fontSizePx}px "Inter", system-ui, -apple-system, sans-serif`;
  }
}

/**
 * Wraps colored word tokens into lines that fit within maxWidth.
 */
function wrapColoredTokens(
  ctx: CanvasRenderingContext2D,
  tokens: ColoredToken[],
  maxWidth: number
): ColoredToken[][] {
  if (tokens.length === 0) return [];
  const lines: ColoredToken[][] = [];
  let currentLine: ColoredToken[] = [];
  let currentLineWidth = 0;
  const spaceW = ctx.measureText(' ').width;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenW = ctx.measureText(token.text).width;
    const neededW = currentLine.length === 0 ? tokenW : currentLineWidth + spaceW + tokenW;

    if (neededW > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [token];
      currentLineWidth = tokenW;
    } else {
      currentLine.push(token);
      currentLineWidth = neededW;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

function measureColoredLineWidth(ctx: CanvasRenderingContext2D, line: ColoredToken[]): number {
  if (line.length === 0) return 0;
  const spaceW = ctx.measureText(' ').width;
  let w = 0;
  for (let i = 0; i < line.length; i++) {
    w += ctx.measureText(line[i].text).width;
    if (i < line.length - 1) w += spaceW;
  }
  return w;
}

function drawColoredLine(
  ctx: CanvasRenderingContext2D,
  line: ColoredToken[],
  x: number,
  y: number,
  maxWidth: number,
  align: 'left' | 'center' | 'right'
) {
  if (line.length === 0) return;
  const lineW = measureColoredLineWidth(ctx, line);
  const spaceW = ctx.measureText(' ').width;

  let cursorX = x;
  if (align === 'center') {
    cursorX = x + (maxWidth - lineW) / 2;
  } else if (align === 'right') {
    cursorX = x + maxWidth - lineW;
  }

  ctx.textAlign = 'left';
  for (let i = 0; i < line.length; i++) {
    const token = line[i];
    ctx.fillStyle = token.color;
    ctx.fillText(token.text, cursorX, y);
    cursorX += ctx.measureText(token.text).width + spaceW;
  }
}

// High-performance background blur cache for static images (never used for videos so videos animate smoothly)
let cachedBgCanvas: HTMLCanvasElement | null = null;
let cachedBgKey = '';

function getBlurredImageBackgroundCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
  naturalWidth: number,
  naturalHeight: number,
  bgBlur: number,
  bgDarkness: number,
  bgScale: number
): HTMLCanvasElement {
  const imgSrc = img.src || 'image';
  const key = `${imgSrc}_${width}x${height}_${naturalWidth}x${naturalHeight}_${bgBlur}_${bgDarkness}_${bgScale}`;

  if (
    cachedBgCanvas &&
    cachedBgKey === key &&
    cachedBgCanvas.width === width &&
    cachedBgCanvas.height === height
  ) {
    return cachedBgCanvas;
  }

  if (!cachedBgCanvas) {
    cachedBgCanvas = document.createElement('canvas');
  }
  cachedBgCanvas.width = width;
  cachedBgCanvas.height = height;

  const bgCtx = cachedBgCanvas.getContext('2d');
  if (!bgCtx) return cachedBgCanvas;

  bgCtx.clearRect(0, 0, width, height);

  const bgBaseScale = Math.max(width / naturalWidth, height / naturalHeight) * bgScale;
  const bgW = naturalWidth * bgBaseScale;
  const bgH = naturalHeight * bgBaseScale;
  const bgX = (width - bgW) / 2;
  const bgY = (height - bgH) / 2;

  const blurAmount = Math.max(0, bgBlur);
  bgCtx.save();
  if (blurAmount > 0) {
    bgCtx.filter = `blur(${blurAmount}px)`;
  }
  bgCtx.drawImage(img, bgX, bgY, bgW, bgH);
  bgCtx.filter = 'none';

  if (bgDarkness > 0) {
    bgCtx.fillStyle = `rgba(0, 0, 0, ${bgDarkness})`;
    bgCtx.fillRect(0, 0, width, height);
  }
  bgCtx.restore();

  cachedBgKey = key;
  return cachedBgCanvas;
}

function drawBlurredBackdrop(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  width: number,
  height: number,
  naturalWidth: number,
  naturalHeight: number,
  bgBlur: number,
  bgDarkness: number,
  bgScale: number
) {
  if (media instanceof HTMLImageElement) {
    const bgCanvas = getBlurredImageBackgroundCanvas(
      media,
      width,
      height,
      naturalWidth,
      naturalHeight,
      bgBlur,
      bgDarkness,
      bgScale
    );
    ctx.drawImage(bgCanvas, 0, 0);
    return;
  }

  // Video element: draw live frame so background video animates smoothly
  const bgBaseScale = Math.max(width / naturalWidth, height / naturalHeight) * bgScale;
  const bgW = naturalWidth * bgBaseScale;
  const bgH = naturalHeight * bgBaseScale;
  const bgX = (width - bgW) / 2;
  const bgY = (height - bgH) / 2;

  ctx.save();
  if (bgBlur > 0) {
    ctx.filter = `blur(${bgBlur}px)`;
  }
  ctx.drawImage(media, bgX, bgY, bgW, bgH);
  ctx.filter = 'none';

  if (bgDarkness > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${bgDarkness})`;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function resolveBulletBaseColor(
  bullet: BulletItem,
  index: number,
  project: VideoProject
): string {
  const white = project.script.textColor || '#ffffff';
  const yellow = project.script.yellowColor || '#facc15';
  const red = project.script.emergencyColor || '#ef4444';

  if (bullet.colorMode === 'white') return white;
  if (bullet.colorMode === 'yellow') return yellow;
  if (bullet.colorMode === 'red') return red;

  if (project.script.bulletColorMode === 'white-with-highlights') {
    return white;
  }

  // Alternating white and yellow
  const startYellow = project.script.alternateStartColor === 'yellow';
  const isEven = index % 2 === 0;
  if (startYellow) {
    return isEven ? yellow : white;
  }
  return isEven ? white : yellow;
}

function getBulletTokens(
  bullet: BulletItem,
  index: number,
  project: VideoProject
): ColoredToken[] {
  const baseColor = resolveBulletBaseColor(bullet, index, project);
  const yellow = project.script.yellowColor || '#facc15';
  const red = project.script.emergencyColor || '#ef4444';
  const words = bullet.text.split(/\s+/).filter(Boolean);
  const highlighted = new Set(bullet.highlightedWords || []);
  const emergency = new Set(bullet.emergencyWords || []);

  return words.map((word, wi) => {
    let color = baseColor;
    if (emergency.has(wi)) {
      color = red;
    } else if (highlighted.has(wi)) {
      color = yellow;
    }
    return { text: word, color };
  });
}

function getHeadingTokens(project: VideoProject): ColoredToken[] {
  const raw = project.heading.uppercase
    ? project.heading.text.toUpperCase()
    : project.heading.text;
  const words = raw.split(/\s+/).filter(Boolean);
  const highlighted = new Set(project.heading.highlightedWordIndices || []);
  const baseColor = project.heading.color || '#ffffff';
  const hlColor = project.heading.highlightColor || '#facc15';

  return words.map((word, idx) => ({
    text: word,
    color: highlighted.has(idx) ? hlColor : baseColor,
  }));
}

/**
 * Computes full-canvas unrestricted image destination rectangle preserving aspect ratio.
 * No small fixed zoom zone: zooming expands freely across the entire 9:16 canvas.
 */
export function computeFullCanvasImageRect(
  width: number,
  height: number,
  slot: ImageSequenceSlot,
  natW: number = 1080,
  natH: number = 720,
  zoomOverride?: number,
  posXOverride?: number,
  posYOverride?: number
): { x: number; y: number; width: number; height: number } {
  const safeNatW = Math.max(1, natW);
  const safeNatH = Math.max(1, natH);
  const basePct = Math.max(20, Math.min(200, slot.baseScalePercent || 88)) / 100;
  const scaleRatio = width / 1080;

  // Base fit preserves natural aspect ratio without locking into a cropped container
  const maxBaseW = width * basePct;
  const maxBaseH = height * (basePct * 0.45);
  const baseScale = Math.min(maxBaseW / safeNatW, maxBaseH / safeNatH);
  const baseW = safeNatW * baseScale;
  const baseH = safeNatH * baseScale;

  const minZ = slot.minZoom ?? 0.1;
  const maxZ = slot.maxZoom ?? 10.0;
  const zoom = clampZoom(
    zoomOverride !== undefined ? zoomOverride : slot.zoom ?? 1.0,
    minZ,
    maxZ
  );
  const effectivePosX = posXOverride !== undefined ? posXOverride : slot.posX ?? 0;
  const effectivePosY = posYOverride !== undefined ? posYOverride : slot.posY ?? 0;

  const anchorX = width / 2;
  const anchorY = height * 0.75;
  const centerX = anchorX + effectivePosX * scaleRatio;
  const centerY = anchorY + effectivePosY * scaleRatio;

  const drawW = baseW * zoom;
  const drawH = baseH * zoom;

  return {
    x: centerX - drawW / 2,
    y: centerY - drawH / 2,
    width: drawW,
    height: drawH,
  };
}

/**
 * Draws a sequential image layer unrestricted across the entire 9:16 video canvas.
 * Only the 9:16 canvas edges clip the output (plus optional corner radius on the image's own expanded bounds).
 */
function drawSequenceImageLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scaleRatio: number,
  slot: ImageSequenceSlot,
  el: HTMLImageElement | HTMLVideoElement | null,
  currentTimeSec: number,
  transitionAlpha: number,
  interactiveEdit: boolean
): { x: number; y: number; width: number; height: number } | null {
  if (!slot || !slot.visible || !slot.url || !el) return null;

  const isReady =
    el instanceof HTMLVideoElement
      ? el.readyState >= 2
      : el.complete && el.naturalWidth > 0;
  if (!isReady) return null;

  const natW =
    el instanceof HTMLVideoElement
      ? el.videoWidth || 1080
      : el.naturalWidth || 1080;
  const natH =
    el instanceof HTMLVideoElement
      ? el.videoHeight || 720
      : el.naturalHeight || 720;

  const transform = evaluateImageTransformAtTime(slot, currentTimeSec, interactiveEdit);
  const rect = computeFullCanvasImageRect(
    width,
    height,
    slot,
    natW,
    natH,
    transform.zoom,
    transform.posX,
    transform.posY
  );

  const effOpacity = transform.opacity ?? slot.opacity ?? 1.0;
  const alpha = Math.max(0, Math.min(1, effOpacity * transitionAlpha));
  if (alpha <= 0.001) return rect;

  const radius = Math.round((slot.borderRadius ?? 20) * scaleRatio);
  const rotDeg = transform.rotation ?? slot.rotation ?? 0;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (Math.abs(rotDeg) > 0.01) {
    ctx.translate(cx, cy);
    ctx.rotate((rotDeg * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  if (slot.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.58)';
    ctx.shadowBlur = 32 * scaleRatio;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 12 * scaleRatio;
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.shadowColor = 'transparent';
  }

  // Draw expanded image across full canvas (clip only to the image's own expanded corners if radius > 0)
  if (radius > 0) {
    ctx.save();
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
    ctx.clip();
    ctx.drawImage(el, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  } else {
    ctx.drawImage(el, rect.x, rect.y, rect.width, rect.height);
  }

  if (slot.borderEnabled) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = Math.max(1, 2 * scaleRatio);
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
    ctx.stroke();
  }

  ctx.restore();
  return rect;
}

/**
 * Computes panel and media layout geometry (shared between renderer and interactive canvas bounds).
 */
export function computeLayoutBounds(
  width: number,
  height: number,
  project: VideoProject,
  naturalWidth: number = 1080,
  naturalHeight: number = 1920,
  currentTimeSec: number = 0,
  interactiveEdit: boolean = false
): {
  panelBounds: RectBox;
  mediaBounds: RectBox;
  panelScale: number;
} {
  const panelTrackEffective =
    project.panelTransform && (project.panelTransform.keyframes?.length || 0) > 0
      ? project.panelTransform
      : undefined;
  const panelEval = evaluateTrackTransformAtTime(
    panelTrackEffective,
    currentTimeSec,
    interactiveEdit,
    {
      zoom: project.panel.panelScale ?? 1.0,
      posX: project.panel.posX || 0,
      posY: project.panel.posY ?? -22,
    },
    0.35,
    2.2
  );

  const panelW = width * ((project.panel.widthPercent || 88) / 100) * panelEval.zoom;
  const panelH = height * ((project.panel.heightPercent || 48) / 100) * panelEval.zoom;
  const panelX = (width - panelW) / 2 + (panelEval.posX / 100) * (width * 0.5);
  const panelY = (height - panelH) / 2 + (panelEval.posY / 100) * (height * 0.5);

  const bgTrackEffective =
    project.adjust.bgTrack && (project.adjust.bgTrack.keyframes?.length || 0) > 0
      ? project.adjust.bgTrack
      : undefined;
  const bgEval = evaluateTrackTransformAtTime(
    bgTrackEffective,
    currentTimeSec,
    interactiveEdit,
    {
      zoom: project.adjust.scale || 1.0,
      posX: project.adjust.moveX || 0,
      posY: project.adjust.moveY || 0,
    },
    0.25,
    4.0
  );

  const manualZoomScale = bgEval.zoom;
  const imgAspect = naturalWidth / Math.max(1, naturalHeight);
  const fitMode = project.adjust.fitMode || 'fill';

  let mediaW: number;
  let mediaH: number;
  let baseMediaX: number;
  let baseMediaY: number;

  if (project.adjust.backgroundFitMode === 'framed') {
    const contentWidth = panelW;
    mediaW = contentWidth * manualZoomScale;
    mediaH = (contentWidth / imgAspect) * manualZoomScale;
    const maxImgH = height * 0.42;
    if (mediaH > maxImgH && manualZoomScale <= 1.0) {
      mediaH = maxImgH;
      mediaW = mediaH * imgAspect;
    }
    baseMediaX = (width - mediaW) / 2;
    baseMediaY = height * 0.08;
  } else if (fitMode === 'fit') {
    const containScale = Math.min(width / naturalWidth, height / naturalHeight) * manualZoomScale;
    mediaW = naturalWidth * containScale;
    mediaH = naturalHeight * containScale;
    baseMediaX = (width - mediaW) / 2;
    baseMediaY = (height - mediaH) / 2;
  } else {
    // 'fill' or 'custom': Full-screen cover mode behind the black panel preserving aspect ratio
    const coverScale = Math.max(width / naturalWidth, height / naturalHeight) * manualZoomScale;
    mediaW = naturalWidth * coverScale;
    mediaH = naturalHeight * coverScale;
    baseMediaX = (width - mediaW) / 2;
    baseMediaY = (height - mediaH) / 2;
  }

  const moveScaleX = width * 0.65;
  const moveScaleY = height * 0.65;
  const mediaX = baseMediaX + (bgEval.posX / 100) * moveScaleX;
  const mediaY = baseMediaY + (bgEval.posY / 100) * moveScaleY;

  return {
    panelBounds: { x: panelX, y: panelY, width: panelW, height: panelH },
    mediaBounds: { x: mediaX, y: mediaY, width: mediaW, height: mediaH },
    panelScale: panelEval.zoom,
  };
}

export interface Template2LayoutBounds {
  panelBounds: RectBox;
  dividerRect: RectBox;
  lowerBounds: RectBox;
  bottomAccentRect: RectBox;
  panelScale: number;
}

/**
 * Computes geometry for Template 2 (2-Split Documentary layout) with proportional group scaling.
 */
export function computeTemplate2LayoutBounds(
  width: number,
  height: number,
  project: VideoProject,
  currentTimeSec: number = 0,
  interactiveEdit: boolean = false
): Template2LayoutBounds {
  const scaleRatio = width / 1080;
  const t2 = project.template2;

  const panelTrackEffective =
    t2.panelTransform && (t2.panelTransform.keyframes?.length || 0) > 0
      ? t2.panelTransform
      : undefined;
  const panelEval = evaluateTrackTransformAtTime(
    panelTrackEffective,
    currentTimeSec,
    interactiveEdit,
    {
      zoom: t2.panel.panelScale ?? 1.0,
      posX: t2.panel.posX || 0,
      posY: t2.panel.posY || 0,
    },
    0.35,
    2.2
  );

  const panelScale = panelEval.zoom;
  const basePanelW = width * (Math.max(50, Math.min(100, t2.panel.widthPercent || 98)) / 100);
  const basePanelH = height * (Math.max(24, Math.min(72, t2.panel.heightPercent || 48)) / 100);
  const panelW = basePanelW * panelScale;
  const panelH = basePanelH * panelScale;

  const topInset =
    (t2.panel.borderRadius || 0) > 0 && (t2.panel.widthPercent || 98) < 100
      ? 10 * scaleRatio
      : 0;

  const baseCenterY = topInset + basePanelH / 2 + (panelEval.posY / 100) * (height * 0.5);
  const panelX = (width - panelW) / 2 + (panelEval.posX / 100) * (width * 0.5);
  const panelY = baseCenterY - panelH / 2;

  const bottomAccentH = t2.accents.bottomAccentEnabled
    ? Math.max(1, (t2.accents.bottomAccentHeight || 10) * scaleRatio)
    : 0;
  const bottomAccentY = height - bottomAccentH;

  const dividerH = t2.accents.dividerEnabled
    ? Math.max(1, (t2.accents.dividerHeight || 6) * scaleRatio * Math.min(1.5, panelScale))
    : 0;
  const dividerY = panelY + panelH;
  const isDefaultSpan = Math.abs(panelScale - 1) < 0.01 && Math.abs(panelEval.posX) < 0.5;

  const lowerNaturalTop = Math.max(0, dividerY + dividerH);
  const lowerNaturalH = Math.max(80 * scaleRatio, bottomAccentY - lowerNaturalTop);
  const heightMult = (t2.lowerMedia.heightPercent || 50) / 50;
  const lowerH = Math.max(80 * scaleRatio, lowerNaturalH * heightMult);
  const lowerY = lowerNaturalTop + ((t2.lowerMedia.offsetY || 0) / 100) * (height * 0.5);

  return {
    panelBounds: { x: panelX, y: panelY, width: panelW, height: panelH },
    dividerRect: {
      x: isDefaultSpan ? 0 : panelX,
      y: dividerY,
      width: isDefaultSpan ? width : panelW,
      height: dividerH,
    },
    lowerBounds: { x: 0, y: lowerY, width, height: lowerH },
    bottomAccentRect: { x: 0, y: bottomAccentY, width, height: bottomAccentH },
    panelScale,
  };
}

/**
 * Computes destination rectangle for Template 2 background media respecting Fill / Fit / Custom modes.
 */
export function computeTemplate2BgRect(
  width: number,
  height: number,
  lowerBounds: RectBox,
  project: VideoProject,
  natW: number = 1080,
  natH: number = 1920,
  currentTimeSec: number = 0,
  interactiveEdit: boolean = false,
  motionScale: number = 1.0,
  motionOffsetX: number = 0,
  motionOffsetY: number = 0
): RectBox {
  const safeNatW = Math.max(1, natW);
  const safeNatH = Math.max(1, natH);
  const t2 = project.template2;

  const bgTrackEffective =
    t2.lowerMedia.bgTrack && (t2.lowerMedia.bgTrack.keyframes?.length || 0) > 0
      ? t2.lowerMedia.bgTrack
      : undefined;
  const bgEval = evaluateTrackTransformAtTime(
    bgTrackEffective,
    currentTimeSec,
    interactiveEdit,
    {
      zoom: t2.lowerMedia.bgScale || 1.0,
      posX: t2.lowerMedia.bgMoveX || 0,
      posY: t2.lowerMedia.bgMoveY || 0,
    },
    0.25,
    4.0
  );

  const fitMode = t2.lowerMedia.bgFitMode || 'fill';
  const baseScale =
    fitMode === 'fit'
      ? Math.min(lowerBounds.width / safeNatW, lowerBounds.height / safeNatH)
      : Math.max(lowerBounds.width / safeNatW, lowerBounds.height / safeNatH);

  const effectiveScale = baseScale * bgEval.zoom * motionScale;
  const drawW = safeNatW * effectiveScale;
  const drawH = safeNatH * effectiveScale;
  const drawX =
    lowerBounds.x +
    (lowerBounds.width - drawW) / 2 +
    (bgEval.posX / 100) * (width * 0.5) +
    motionOffsetX;
  const drawY =
    lowerBounds.y +
    (lowerBounds.height - drawH) / 2 +
    (bgEval.posY / 100) * (height * 0.5) +
    motionOffsetY;

  return { x: drawX, y: drawY, width: drawW, height: drawH };
}

/**
 * Computes the anchor point and canonical 1080p scale ratio for image slots.
 */
export function getSlotAnchorPoint(
  width: number,
  height: number,
  project: VideoProject,
  currentTimeSec: number = 0,
  interactiveEdit: boolean = false
): { anchorX: number; anchorY: number; scaleRatio: number } {
  const scaleRatio = width / 1080;
  if (project.activeTemplate === 'template-2') {
    const t2Bounds = computeTemplate2LayoutBounds(
      width,
      height,
      project,
      currentTimeSec,
      interactiveEdit
    );
    return {
      anchorX: t2Bounds.lowerBounds.x + t2Bounds.lowerBounds.width / 2,
      anchorY: t2Bounds.lowerBounds.y + t2Bounds.lowerBounds.height / 2,
      scaleRatio,
    };
  }
  return {
    anchorX: width / 2,
    anchorY: height * 0.75,
    scaleRatio,
  };
}

/**
 * Computes destination rectangle for a lower-zone media element inside Template 2's lowerBounds
 * using unrestricted canonical 1080p pixel offsets.
 */
export function computeTemplate2SlotRect(
  lowerBounds: RectBox,
  slot: ImageSequenceSlot,
  natW: number = 1080,
  natH: number = 720,
  zoomOverride?: number,
  posXOverride?: number,
  posYOverride?: number,
  fillMode: 'cover' | 'contain' = 'cover',
  canvasWidth?: number
): RectBox {
  const safeNatW = Math.max(1, natW);
  const safeNatH = Math.max(1, natH);
  const scaleRatio = (canvasWidth || lowerBounds.width || 1080) / 1080;

  const fitScale =
    fillMode === 'contain'
      ? Math.min(lowerBounds.width / safeNatW, lowerBounds.height / safeNatH)
      : Math.max(lowerBounds.width / safeNatW, lowerBounds.height / safeNatH);

  const minZ = slot.minZoom ?? 0.1;
  const maxZ = slot.maxZoom ?? 10.0;
  const zoom = clampZoom(
    zoomOverride !== undefined ? zoomOverride : slot.zoom ?? 1.0,
    minZ,
    maxZ
  );
  const effectivePosX = posXOverride !== undefined ? posXOverride : slot.posX ?? 0;
  const effectivePosY = posYOverride !== undefined ? posYOverride : slot.posY ?? 0;

  const drawW = safeNatW * fitScale * zoom;
  const drawH = safeNatH * fitScale * zoom;

  const anchorX = lowerBounds.x + lowerBounds.width / 2;
  const anchorY = lowerBounds.y + lowerBounds.height / 2;
  const centerX = anchorX + effectivePosX * scaleRatio;
  const centerY = anchorY + effectivePosY * scaleRatio;

  return {
    x: centerX - drawW / 2,
    y: centerY - drawH / 2,
    width: drawW,
    height: drawH,
  };
}

function renderTemplate2Frame(
  canvas: HTMLCanvasElement,
  project: VideoProject,
  media: HTMLImageElement | HTMLVideoElement | null,
  normalizedTime: number,
  logoImg: HTMLImageElement | null = null,
  overlayElements: Record<string, HTMLImageElement | HTMLVideoElement> = {},
  interactiveEdit: boolean = false
): RenderLayoutInfo {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const scaleRatio = width / 1080;
  const t2 = project.template2;
  const currentTimeSec = normalizedTime * (project.durationSeconds || 8.0);

  if (!ctx) {
    return {
      panelBounds: { x: 0, y: 0, width, height: height * 0.5 },
      mediaBounds: { x: 0, y: height * 0.5, width, height: height * 0.5 },
      usedBulletFontSize1080: t2.text.fontSize,
      requestedBulletFontSize1080: t2.text.fontSize,
      wasAutoFitted: false,
      overflowWarning: false,
    };
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b0c10';
  ctx.fillRect(0, 0, width, height);

  const layoutBounds = computeTemplate2LayoutBounds(
    width,
    height,
    project,
    currentTimeSec,
    interactiveEdit
  );
  const { panelBounds, dividerRect, lowerBounds, bottomAccentRect, panelScale } = layoutBounds;

  // Seamless loop motion for background media
  let motionScale = 1.0;
  let motionOffsetX = 0;
  let motionOffsetY = 0;
  if (t2.lowerMedia.bgMotionType === 'ken-burns') {
    const cycle = (Math.sin(normalizedTime * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    motionScale = 1.0 + cycle * 0.04;
  } else if (t2.lowerMedia.bgMotionType === 'subtle-drift') {
    motionOffsetX = Math.sin(normalizedTime * Math.PI * 2) * 8 * scaleRatio;
    motionOffsetY = Math.cos(normalizedTime * Math.PI * 2) * 8 * scaleRatio;
  }

  let computedBgMediaRect: RectBox = { ...lowerBounds };

  // LAYER 1: BACKGROUND MEDIA (rendered across canvas BEHIND all other elements; never hard-clipped away)
  if (media) {
    const isMediaReady =
      media instanceof HTMLVideoElement
        ? media.readyState >= 2 && media.videoWidth > 0
        : media.complete && media.naturalWidth > 0;

    if (isMediaReady) {
      const natW =
        media instanceof HTMLVideoElement
          ? media.videoWidth || 1080
          : media.naturalWidth || 1080;
      const natH =
        media instanceof HTMLVideoElement
          ? media.videoHeight || 1920
          : media.naturalHeight || 1920;

      computedBgMediaRect = computeTemplate2BgRect(
        width,
        height,
        lowerBounds,
        project,
        natW,
        natH,
        currentTimeSec,
        interactiveEdit,
        motionScale,
        motionOffsetX,
        motionOffsetY
      );

      ctx.save();
      ctx.drawImage(
        media,
        computedBgMediaRect.x,
        computedBgMediaRect.y,
        computedBgMediaRect.width,
        computedBgMediaRect.height
      );

      if ((t2.lowerMedia.bgDimness || 0) > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${t2.lowerMedia.bgDimness})`;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.restore();
    }
  } else {
    const hasSeqImages = (project.imageSequence || []).some((s) => s.visible && !!s.url);
    if (!hasSeqImages) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = `600 ${Math.round(24 * scaleRatio)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        'Upload background video/image or 3-image sequence in "Add Media"',
        lowerBounds.x + lowerBounds.width / 2,
        lowerBounds.y + lowerBounds.height / 2
      );
      ctx.restore();
    }
  }

  // LAYER 2: SEQUENTIAL IMAGES BEHIND PANEL (full-canvas unrestricted transform, never clipped to a tiny zone)
  const activeSequenceSlots = getActiveSequenceSlotsAtTime(
    project.imageSequence || [],
    project.sequenceTransition || { enabled: true, type: 'crossfade', duration: 0.35 },
    currentTimeSec
  );

  for (const entry of activeSequenceSlots) {
    if (entry.slot.zOrder === 'above-panel') continue;
    const el = overlayElements[entry.slot.id];
    if (!el || !entry.slot.visible || !entry.slot.url) continue;
    const isReady =
      el instanceof HTMLVideoElement
        ? el.readyState >= 2 && el.videoWidth > 0
        : el.complete && el.naturalWidth > 0;
    if (!isReady) continue;

    const natW =
      el instanceof HTMLVideoElement ? el.videoWidth || 1080 : el.naturalWidth || 1080;
    const natH =
      el instanceof HTMLVideoElement ? el.videoHeight || 720 : el.naturalHeight || 720;

    const transform = evaluateImageTransformAtTime(entry.slot, currentTimeSec, interactiveEdit);
    const rect = computeTemplate2SlotRect(
      lowerBounds,
      entry.slot,
      natW,
      natH,
      transform.zoom,
      transform.posX,
      transform.posY,
      t2.lowerMedia.slotBaseFill || 'cover',
      width
    );

    const effOpacity = transform.opacity ?? entry.slot.opacity ?? 1.0;
    const alpha = Math.max(0, Math.min(1, effOpacity * entry.alpha));
    if (alpha <= 0.001) continue;

    const rotDeg = transform.rotation ?? entry.slot.rotation ?? 0;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const radius = Math.round((entry.slot.borderRadius ?? 0) * scaleRatio);

    ctx.save();
    ctx.globalAlpha = alpha;
    if (Math.abs(rotDeg) > 0.01) {
      ctx.translate(cx, cy);
      ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    if (radius > 0) {
      ctx.save();
      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
      ctx.clip();
      ctx.drawImage(el, rect.x, rect.y, rect.width, rect.height);
      ctx.restore();
    } else {
      ctx.drawImage(el, rect.x, rect.y, rect.width, rect.height);
    }
    ctx.restore();
  }

  // LAYER 3: UPPER BLACK PANEL WITH ROUNDED CORNERS & PROPORTIONAL GROUP SCALING
  const panelScaleRatio = scaleRatio * panelScale;
  const panelRadius = Math.round((t2.panel.borderRadius ?? 28) * panelScaleRatio);
  const hex = (t2.panel.backgroundColor || '#000000').replace('#', '');
  const r = parseInt(hex.substring(0, 2) || '00', 16);
  const g = parseInt(hex.substring(2, 4) || '00', 16);
  const b = parseInt(hex.substring(4, 6) || '00', 16);

  ctx.save();
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${t2.panel.opacity ?? 1.0})`;
  roundRect(ctx, panelBounds.x, panelBounds.y, panelBounds.width, panelBounds.height, panelRadius);
  ctx.fill();

  if (t2.panel.borderEnabled) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = Math.max(1, 2 * panelScaleRatio);
    ctx.stroke();
  }
  ctx.restore();

  // Clip branding + paragraph inside upper panel
  ctx.save();
  roundRect(ctx, panelBounds.x, panelBounds.y, panelBounds.width, panelBounds.height, panelRadius);
  ctx.clip();

  const padX = (t2.panel.paddingX ?? 44) * panelScaleRatio;
  const padY = (t2.panel.paddingY ?? 28) * panelScaleRatio;
  const innerX = panelBounds.x + padX;
  const innerW = Math.max(60 * panelScaleRatio, panelBounds.width - padX * 2);
  let cursorY = panelBounds.y + padY;
  const innerBottomY = panelBounds.y + panelBounds.height - padY;

  const headerEval = evaluateTrackTransformAtTime(
    t2.brandingTransform,
    currentTimeSec,
    interactiveEdit,
    { zoom: 1.0, posX: 0, posY: 0 },
    0.35,
    2.5
  );
  const bodyEval = evaluateTrackTransformAtTime(
    t2.textTransform,
    currentTimeSec,
    interactiveEdit,
    { zoom: 1.0, posX: 0, posY: 0 },
    0.35,
    2.5
  );

  // LAYER 4A: TOP-CENTER CHANNEL BRANDING (proportional to panelScale + headerEval)
  const hasLogo =
    t2.branding.showBranding && logoImg && logoImg.complete && logoImg.naturalWidth > 0;
  const channelName = t2.branding.showBranding ? (t2.branding.channelName || '').trim() : '';
  const subtitle = t2.branding.showBranding ? (t2.branding.subtitle || '').trim() : '';
  const hasText = channelName.length > 0 || subtitle.length > 0;

  let headerBounds: RectBox = {
    x: innerX,
    y: cursorY,
    width: innerW,
    height: 60 * panelScaleRatio,
  };

  if (hasLogo || hasText) {
    const hScale = panelScaleRatio * headerEval.zoom;
    const logoSize = (t2.branding.logoSize || 78) * hScale;
    const nameSize = (t2.branding.channelNameSize || 34) * hScale;
    const subSize = (t2.branding.subtitleSize || 22) * hScale;
    const gapX = hasLogo && hasText ? 18 * hScale : 0;

    ctx.font = `800 ${nameSize}px "Montserrat", "Inter", sans-serif`;
    const nameW = channelName ? ctx.measureText(channelName).width : 0;
    ctx.font = `500 ${subSize}px "Inter", sans-serif`;
    const subW = subtitle ? ctx.measureText(subtitle).width : 0;
    const textColW = Math.max(nameW, subW);

    const logoDrawSize = hasLogo ? logoSize : 0;
    const totalGroupW = logoDrawSize + gapX + textColW;
    const groupStartX =
      innerX +
      (innerW - totalGroupW) / 2 +
      (t2.branding.logoOffsetX || 0) * panelScaleRatio +
      (headerEval.posX / 100) * panelBounds.width;

    const textStackH =
      (channelName ? nameSize * 1.15 : 0) + (subtitle ? subSize * 1.25 : 0);
    const headerH = Math.max(logoDrawSize, textStackH);
    const headerTopY =
      cursorY +
      (t2.branding.logoOffsetY || 0) * panelScaleRatio +
      (headerEval.posY / 100) * panelBounds.height;

    headerBounds = {
      x: groupStartX - 12 * panelScaleRatio,
      y: headerTopY - 8 * panelScaleRatio,
      width: totalGroupW + 24 * panelScaleRatio,
      height: headerH + 16 * panelScaleRatio,
    };

    if (hasLogo && logoImg) {
      const lx = groupStartX;
      const ly = headerTopY + (headerH - logoDrawSize) / 2;
      ctx.save();
      if (t2.branding.logoShape === 'circle') {
        ctx.beginPath();
        ctx.arc(lx + logoDrawSize / 2, ly + logoDrawSize / 2, logoDrawSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      } else if (t2.branding.logoShape === 'rounded') {
        roundRect(ctx, lx, ly, logoDrawSize, logoDrawSize, 14 * hScale);
        ctx.clip();
      }

      const aspect = logoImg.naturalWidth / Math.max(1, logoImg.naturalHeight);
      let dw = logoDrawSize;
      let dh = logoDrawSize;
      if (aspect > 1) {
        dw = logoDrawSize * aspect;
      } else {
        dh = logoDrawSize / aspect;
      }
      ctx.drawImage(
        logoImg,
        lx + (logoDrawSize - dw) / 2,
        ly + (logoDrawSize - dh) / 2,
        dw,
        dh
      );
      ctx.restore();
    }

    if (hasText) {
      const tx = groupStartX + logoDrawSize + gapX;
      let ty = headerTopY + (headerH - textStackH) / 2;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (channelName) {
        ctx.font = `800 ${nameSize}px "Montserrat", "Inter", sans-serif`;
        ctx.fillStyle = t2.branding.channelNameColor || '#ffffff';
        ctx.fillText(channelName, tx, ty);
        ty += nameSize * 1.15;
      }
      if (subtitle) {
        ctx.font = `500 ${subSize}px "Inter", sans-serif`;
        ctx.fillStyle = t2.branding.subtitleColor || '#9ca3af';
        ctx.fillText(subtitle, tx, ty);
      }
      ctx.restore();
    }

    cursorY = headerTopY + headerH + (t2.branding.headerMarginBottom ?? 24) * panelScaleRatio;
  }

  // LAYER 4B: PARAGRAPH-STYLE TEXT WITH PROPORTIONAL PANEL SCALING + INDIVIDUAL BODY TRACK
  const availTextH = Math.max(36 * panelScaleRatio, innerBottomY - cursorY);
  const requestedFontSize1080 = t2.text.fontSize || 38;
  let activeFontSize = requestedFontSize1080 * panelScaleRatio * bodyEval.zoom;
  let activeLineHeight = t2.text.lineHeight || 1.28;

  const orangeSet = new Set(t2.text.orangeWords || []);
  const blueSet = new Set(t2.text.blueWords || []);
  const mainColor = t2.text.textColor || '#ffffff';
  const orangeColor = t2.text.orangeColor || '#f59e0b';
  const blueColor = t2.text.blueColor || '#38bdf8';

  const { lines: rawParagraphs } = parseParagraphTokens(t2.text.content || '');

  const measureParagraphLayout = (
    fontSizePx: number,
    lineHeightMult: number
  ): {
    wrappedLines: (ColoredToken[] | null)[];
    totalHeight: number;
    singleWordOverflows: boolean;
  } => {
    ctx.font = resolveFontDeclaration(
      t2.text.fontFamily,
      fontSizePx,
      false,
      t2.text.fontWeight || 700
    );
    const wrappedLines: (ColoredToken[] | null)[] = [];
    let totalHeight = 0;
    let singleWordOverflows = false;
    const step = fontSizePx * lineHeightMult;

    for (const paraWords of rawParagraphs) {
      if (paraWords.length === 0) {
        wrappedLines.push(null);
        totalHeight += step * 0.45;
        continue;
      }

      const coloredTokens: ColoredToken[] = paraWords.map((w) => {
        let color = mainColor;
        if (blueSet.has(w.index)) {
          color = blueColor;
        } else if (orangeSet.has(w.index)) {
          color = orangeColor;
        }
        if (ctx.measureText(w.text).width > innerW) {
          singleWordOverflows = true;
        }
        return { text: w.text, color };
      });

      const paraWrapped = wrapColoredTokens(ctx, coloredTokens, innerW);
      for (const wl of paraWrapped) {
        wrappedLines.push(wl);
        totalHeight += step;
      }
    }

    return { wrappedLines, totalHeight, singleWordOverflows };
  };

  let pLayout = measureParagraphLayout(activeFontSize, activeLineHeight);
  let wasAutoFitted = false;

  if (t2.text.autoFitText !== false && Math.abs(bodyEval.zoom - 1.0) < 0.02) {
    const minFontSize = 14 * panelScaleRatio;
    let guard = 0;
    while (
      (pLayout.totalHeight > availTextH || pLayout.singleWordOverflows) &&
      activeFontSize > minFontSize &&
      guard < 60
    ) {
      wasAutoFitted = true;
      activeFontSize = Math.max(minFontSize, activeFontSize - 1.2 * panelScaleRatio);
      if (activeLineHeight > 1.12 && pLayout.totalHeight > availTextH) {
        activeLineHeight = Math.max(1.12, activeLineHeight - 0.015);
      }
      pLayout = measureParagraphLayout(activeFontSize, activeLineHeight);
      guard++;
    }
  }

  const overflowWarning = pLayout.totalHeight > availTextH;
  const bodyStartY =
    cursorY +
    (t2.text.textOffsetY || 0) * panelScaleRatio +
    (bodyEval.posY / 100) * availTextH;
  const bodyStartX =
    innerX +
    (t2.text.textOffsetX || 0) * panelScaleRatio +
    (bodyEval.posX / 100) * innerW;

  const bodyBounds: RectBox = {
    x: bodyStartX,
    y: bodyStartY,
    width: innerW,
    height: Math.max(40 * panelScaleRatio, pLayout.totalHeight),
  };

  if (pLayout.wrappedLines.length > 0) {
    ctx.save();
    ctx.font = resolveFontDeclaration(
      t2.text.fontFamily,
      activeFontSize,
      false,
      t2.text.fontWeight || 700
    );
    ctx.textBaseline = 'top';
    const step = activeFontSize * activeLineHeight;
    let py = bodyStartY;

    for (const line of pLayout.wrappedLines) {
      if (line === null) {
        py += step * 0.45;
      } else {
        drawColoredLine(ctx, line, bodyStartX, py, innerW, t2.text.textAlign || 'left');
        py += step;
      }
    }
    ctx.restore();
  }

  ctx.restore(); // End upper panel clip

  // Optional sequence slots marked 'above-panel'
  for (const entry of activeSequenceSlots) {
    if (entry.slot.zOrder !== 'above-panel') continue;
    const el = overlayElements[entry.slot.id];
    if (!el || !entry.slot.visible || !entry.slot.url) continue;
    const isReady =
      el instanceof HTMLVideoElement
        ? el.readyState >= 2 && el.videoWidth > 0
        : el.complete && el.naturalWidth > 0;
    if (!isReady) continue;

    const natW =
      el instanceof HTMLVideoElement ? el.videoWidth || 1080 : el.naturalWidth || 1080;
    const natH =
      el instanceof HTMLVideoElement ? el.videoHeight || 720 : el.naturalHeight || 720;
    const transform = evaluateImageTransformAtTime(entry.slot, currentTimeSec, interactiveEdit);
    const rect = computeTemplate2SlotRect(
      lowerBounds,
      entry.slot,
      natW,
      natH,
      transform.zoom,
      transform.posX,
      transform.posY,
      t2.lowerMedia.slotBaseFill || 'cover',
      width
    );
    const effOpacity = transform.opacity ?? entry.slot.opacity ?? 1.0;
    const alpha = Math.max(0, Math.min(1, effOpacity * entry.alpha));
    if (alpha <= 0.001) continue;

    const rotDeg = transform.rotation ?? entry.slot.rotation ?? 0;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const radius = Math.round((entry.slot.borderRadius ?? 0) * scaleRatio);

    ctx.save();
    ctx.globalAlpha = alpha;
    if (Math.abs(rotDeg) > 0.01) {
      ctx.translate(cx, cy);
      ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    if (radius > 0) {
      ctx.save();
      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
      ctx.clip();
      ctx.drawImage(el, rect.x, rect.y, rect.width, rect.height);
      ctx.restore();
    } else {
      ctx.drawImage(el, rect.x, rect.y, rect.width, rect.height);
    }
    ctx.restore();
  }

  // LAYER 5A: THIN HORIZONTAL DIVIDER BETWEEN UPPER PANEL AND LOWER FOOTAGE
  if (t2.accents.dividerEnabled && dividerRect.height > 0) {
    ctx.save();
    ctx.fillStyle = t2.accents.dividerColor || '#1d9bf0';
    ctx.fillRect(dividerRect.x, dividerRect.y, dividerRect.width, dividerRect.height);
    ctx.restore();
  }

  // LAYER 5B: OPTIONAL THIN ACCENT STRIP ALONG BOTTOM EDGE
  if (t2.accents.bottomAccentEnabled && bottomAccentRect.height > 0) {
    ctx.save();
    ctx.fillStyle = t2.accents.bottomAccentColor || '#1d9bf0';
    ctx.fillRect(
      bottomAccentRect.x,
      bottomAccentRect.y,
      bottomAccentRect.width,
      bottomAccentRect.height
    );
    ctx.restore();
  }

  return {
    panelBounds,
    mediaBounds: computedBgMediaRect,
    headerBounds,
    bodyBounds,
    usedBulletFontSize1080: Math.round(activeFontSize / panelScaleRatio),
    requestedBulletFontSize1080: requestedFontSize1080,
    wasAutoFitted,
    overflowWarning,
  };
}

/**
 * Main render function that draws a single frame onto the canvas.
 * Routes between Template 1 (original) and Template 2 (documentary 2-split).
 */
export function renderCanvasFrame(
  canvas: HTMLCanvasElement,
  project: VideoProject,
  media: HTMLImageElement | HTMLVideoElement | null,
  normalizedTime: number,
  logoImg: HTMLImageElement | null = null,
  overlayElements: Record<string, HTMLImageElement | HTMLVideoElement> = {},
  interactiveEdit: boolean = false
): RenderLayoutInfo {
  if (project.activeTemplate === 'template-2') {
    return renderTemplate2Frame(
      canvas,
      project,
      media,
      normalizedTime,
      logoImg,
      overlayElements,
      interactiveEdit
    );
  }

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const scaleRatio = width / 1080;
  const currentTimeSec = normalizedTime * (project.durationSeconds || 8.0);

  if (!ctx) {
    return {
      panelBounds: { x: 0, y: 0, width, height },
      mediaBounds: { x: 0, y: 0, width, height },
      usedBulletFontSize1080: project.script.fontSize,
      requestedBulletFontSize1080: project.script.fontSize,
      wasAutoFitted: false,
      overflowWarning: false,
    };
  }

  // Clear canvas with neutral dark charcoal (never blue)
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#111216';
  ctx.fillRect(0, 0, width, height);

  const naturalWidth =
    media instanceof HTMLVideoElement
      ? media.videoWidth || 1080
      : media instanceof HTMLImageElement
      ? media.naturalWidth || 1080
      : 1080;
  const naturalHeight =
    media instanceof HTMLVideoElement
      ? media.videoHeight || 1920
      : media instanceof HTMLImageElement
      ? media.naturalHeight || 1920
      : 1920;

  // 1. CALCULATE SEAMLESS LOOP MOTION
  let motionScale = 1.0;
  let motionOffsetY = 0;
  let motionOffsetX = 0;

  if (project.adjust.motionType === 'ken-burns') {
    const cycle = (Math.sin(normalizedTime * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    motionScale = 1.0 + cycle * (project.adjust.motionIntensity || 0.03);
    motionOffsetY = Math.sin(normalizedTime * Math.PI * 2) * 5 * scaleRatio;
  } else if (project.adjust.motionType === 'subtle-drift') {
    motionOffsetX = Math.sin(normalizedTime * Math.PI * 2) * 6 * scaleRatio;
    motionOffsetY = Math.cos(normalizedTime * Math.PI * 2) * 6 * scaleRatio;
  }

  const baseBounds = computeLayoutBounds(
    width,
    height,
    project,
    naturalWidth,
    naturalHeight,
    currentTimeSec,
    interactiveEdit
  );
  const t1PanelScale = baseBounds.panelScale || 1.0;
  const panelScaleRatio = scaleRatio * t1PanelScale;

  // 2. DRAW USER-SUPPLIED WEATHER BACKGROUND MEDIA
  if (media) {
    const isMediaReady =
      media instanceof HTMLVideoElement
        ? media.readyState >= 2 && media.videoWidth > 0
        : media.complete && media.naturalWidth > 0;

    if (isMediaReady) {
      if (project.adjust.backgroundFitMode === 'framed') {
        drawBlurredBackdrop(
          ctx,
          media,
          width,
          height,
          naturalWidth,
          naturalHeight,
          Math.max(12, project.adjust.bgBlur),
          project.adjust.bgDarkness,
          project.adjust.bgScale
        );

        const mW = baseBounds.mediaBounds.width * motionScale;
        const mH = baseBounds.mediaBounds.height * motionScale;
        const mX = baseBounds.mediaBounds.x - (mW - baseBounds.mediaBounds.width) / 2 + motionOffsetX;
        const mY = baseBounds.mediaBounds.y - (mH - baseBounds.mediaBounds.height) / 2 + motionOffsetY;
        const imgRadius = Math.round(project.adjust.imageBorderRadius * scaleRatio);

        ctx.save();
        if (project.adjust.imageShadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
          ctx.shadowBlur = 32 * scaleRatio;
          ctx.shadowOffsetY = 12 * scaleRatio;
        }
        roundRect(ctx, mX, mY, mW, mH, imgRadius);
        if (project.adjust.imageShadow) {
          ctx.fillStyle = '#000000';
          ctx.fill();
          ctx.shadowColor = 'transparent';
        }
        ctx.clip();
        ctx.drawImage(media, mX, mY, mW, mH);
        ctx.restore();
      } else {
        const mW = baseBounds.mediaBounds.width * motionScale;
        const mH = baseBounds.mediaBounds.height * motionScale;
        const mX = baseBounds.mediaBounds.x - (mW - baseBounds.mediaBounds.width) / 2 + motionOffsetX;
        const mY = baseBounds.mediaBounds.y - (mH - baseBounds.mediaBounds.height) / 2 + motionOffsetY;

        const exposesEdges = mX > 0 || mY > 0 || mX + mW < width || mY + mH < height;
        if (exposesEdges && project.adjust.fitMode !== 'fit') {
          drawBlurredBackdrop(
            ctx,
            media,
            width,
            height,
            naturalWidth,
            naturalHeight,
            Math.max(24, project.adjust.bgBlur),
            Math.max(0.35, project.adjust.bgDarkness),
            project.adjust.bgScale
          );
        }

        ctx.save();
        if (project.adjust.bgBlur > 0) {
          ctx.filter = `blur(${project.adjust.bgBlur * scaleRatio}px)`;
        }
        ctx.drawImage(media, mX, mY, mW, mH);
        ctx.filter = 'none';

        if (project.adjust.bgDarkness > 0) {
          ctx.fillStyle = `rgba(0, 0, 0, ${project.adjust.bgDarkness})`;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
      }
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#18181b');
    grad.addColorStop(0.5, '#121215');
    grad.addColorStop(1, '#09090b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = `600 ${Math.round(24 * scaleRatio)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hintY = Math.max(80 * scaleRatio, baseBounds.panelBounds.y * 0.55);
    ctx.fillText('Upload your weather footage in "Add Media"', width / 2, hintY);
    ctx.restore();
  }

  // 2B. DRAW LAYER 2: SEQUENTIAL WEATHER IMAGE(S)
  const activeSequenceSlots = getActiveSequenceSlotsAtTime(
    project.imageSequence || [],
    project.sequenceTransition || { enabled: true, type: 'crossfade', duration: 0.35 },
    currentTimeSec
  );

  for (const entry of activeSequenceSlots) {
    if (entry.slot.zOrder !== 'above-panel') {
      drawSequenceImageLayer(
        ctx,
        width,
        height,
        scaleRatio,
        entry.slot,
        overlayElements[entry.slot.id] || null,
        currentTimeSec,
        entry.alpha,
        interactiveEdit
      );
    }
  }

  // 3. DRAW BLACK ROUNDED TEMPLATE PANEL
  const { x: panelX, y: panelY, width: panelW, height: panelH } = baseBounds.panelBounds;
  const panelRadius = Math.round((project.panel.borderRadius ?? 32) * panelScaleRatio);

  ctx.save();
  if (project.panel.shadowEnabled) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowBlur = 44 * panelScaleRatio;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 18 * panelScaleRatio;
  }

  const hex = (project.panel.backgroundColor || '#000000').replace('#', '');
  const r = parseInt(hex.substring(0, 2) || '00', 16);
  const g = parseInt(hex.substring(2, 4) || '00', 16);
  const b = parseInt(hex.substring(4, 6) || '00', 16);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${project.panel.opacity ?? 0.94})`;

  roundRect(ctx, panelX, panelY, panelW, panelH, panelRadius);
  ctx.fill();
  ctx.restore();

  if (project.panel.borderEnabled) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = Math.max(1, 2 * panelScaleRatio);
    roundRect(ctx, panelX, panelY, panelW, panelH, panelRadius);
    ctx.stroke();
    ctx.restore();
  }

  // Clip all template text & branding cleanly inside the black rounded panel
  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, panelH, panelRadius);
  ctx.clip();

  const padX = (project.panel.paddingX ?? 42) * panelScaleRatio;
  const padY = (project.panel.paddingY ?? 38) * panelScaleRatio;
  const innerX = panelX + padX;
  const innerW = Math.max(60 * panelScaleRatio, panelW - padX * 2);
  let cursorY = panelY + padY;
  const innerBottomY = panelY + panelH - padY;

  const headerEval = evaluateTrackTransformAtTime(
    project.brandingTransform,
    currentTimeSec,
    interactiveEdit,
    { zoom: 1.0, posX: 0, posY: 0 },
    0.35,
    2.5
  );
  const bodyEval = evaluateTrackTransformAtTime(
    project.textTransform,
    currentTimeSec,
    interactiveEdit,
    { zoom: 1.0, posX: 0, posY: 0 },
    0.35,
    2.5
  );

  // 4. DRAW CHANNEL BRANDING AT TOP OF BLACK PANEL (Logo + "24 SKY ALERT")
  const hasLogo =
    project.branding.showBranding &&
    logoImg &&
    logoImg.complete &&
    logoImg.naturalWidth > 0;
  const channelNameText = project.branding.showBranding ? project.branding.channelName.trim() : '';
  const hasChannelName = channelNameText.length > 0;

  let headerBounds: RectBox = {
    x: innerX,
    y: cursorY,
    width: innerW,
    height: 60 * panelScaleRatio,
  };

  if (hasLogo || hasChannelName) {
    const hScale = panelScaleRatio * headerEval.zoom;
    const logoTargetSize = (project.branding.logoSize || 64) * hScale;
    const channelFontSize = (project.branding.channelNameSize || 32) * hScale;
    const gapBetweenLogoAndName = hasLogo && hasChannelName ? 16 * hScale : 0;

    let drawnLogoW = 0;
    let drawnLogoH = 0;
    if (hasLogo && logoImg) {
      const logoAspect = logoImg.naturalWidth / Math.max(1, logoImg.naturalHeight);
      if (project.branding.logoShape === 'circle') {
        drawnLogoW = logoTargetSize;
        drawnLogoH = logoTargetSize;
      } else if (logoAspect >= 1) {
        drawnLogoW = logoTargetSize;
        drawnLogoH = logoTargetSize / logoAspect;
        if (drawnLogoH < logoTargetSize * 0.55) {
          drawnLogoH = logoTargetSize * 0.75;
          drawnLogoW = drawnLogoH * logoAspect;
        }
      } else {
        drawnLogoH = logoTargetSize;
        drawnLogoW = logoTargetSize * logoAspect;
      }
      const maxLogoW = innerW * 0.35;
      if (drawnLogoW > maxLogoW) {
        const s = maxLogoW / drawnLogoW;
        drawnLogoW *= s;
        drawnLogoH *= s;
      }
    }

    ctx.font = `800 ${channelFontSize}px "Montserrat", "Inter", sans-serif`;
    const channelNameW = hasChannelName ? ctx.measureText(channelNameText).width : 0;
    const totalBrandW = drawnLogoW + gapBetweenLogoAndName + channelNameW;

    let brandStartX = innerX;
    if (project.branding.headerAlign === 'center') {
      brandStartX = innerX + (innerW - totalBrandW) / 2;
    } else if (project.branding.headerAlign === 'right') {
      brandStartX = innerX + innerW - totalBrandW;
    }
    brandStartX += (headerEval.posX / 100) * panelW;

    const rowHeight = Math.max(drawnLogoH, hasChannelName ? channelFontSize * 1.15 : 0);
    const headerTopY = cursorY + (headerEval.posY / 100) * panelH;

    headerBounds = {
      x: brandStartX - 8 * panelScaleRatio,
      y: headerTopY - 4 * panelScaleRatio,
      width: totalBrandW + 16 * panelScaleRatio,
      height: rowHeight + 8 * panelScaleRatio,
    };

    if (hasLogo && logoImg) {
      const lx = brandStartX + (project.branding.logoOffsetX || 0) * hScale;
      const ly =
        headerTopY +
        (rowHeight - drawnLogoH) / 2 +
        (project.branding.logoOffsetY || 0) * hScale;

      ctx.save();
      if (project.branding.logoShape === 'circle') {
        ctx.beginPath();
        ctx.arc(lx + drawnLogoW / 2, ly + drawnLogoH / 2, Math.min(drawnLogoW, drawnLogoH) / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      } else if (project.branding.logoShape === 'rounded') {
        roundRect(ctx, lx, ly, drawnLogoW, drawnLogoH, 10 * hScale);
        ctx.clip();
      }
      ctx.drawImage(logoImg, lx, ly, drawnLogoW, drawnLogoH);
      ctx.restore();
    }

    if (hasChannelName) {
      const nx =
        brandStartX +
        drawnLogoW +
        gapBetweenLogoAndName +
        (project.branding.channelNameOffsetX || 0) * hScale;
      const ny =
        headerTopY +
        rowHeight / 2 +
        (project.branding.channelNameOffsetY || 0) * hScale;

      ctx.save();
      ctx.font = `800 ${channelFontSize}px "Montserrat", "Inter", sans-serif`;
      ctx.fillStyle = project.branding.channelNameColor || '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(channelNameText, nx, ny);
      ctx.restore();
    }

    cursorY = headerTopY + rowHeight + 18 * panelScaleRatio;
  }

  // 5. DRAW EDITABLE "DID YOU KNOW?" HEADING
  const headingTokens = getHeadingTokens(project);
  let headingFontSize = (project.heading.fontSize || 88) * panelScaleRatio;
  let headingLines: ColoredToken[][] = [];

  if (headingTokens.length > 0) {
    const maxHeadingHeight = Math.max(80 * panelScaleRatio, (innerBottomY - cursorY) * 0.42);
    for (let attempt = 0; attempt < 24; attempt++) {
      ctx.font = resolveFontDeclaration(project.heading.fontFamily, headingFontSize, true);
      headingLines = wrapColoredTokens(ctx, headingTokens, innerW);
      const hHeight = headingLines.length * (headingFontSize * 1.06);
      const widestWord = Math.max(
        0,
        ...headingTokens.map((t) => ctx.measureText(t.text).width)
      );
      if (hHeight <= maxHeadingHeight && widestWord <= innerW) {
        break;
      }
      headingFontSize = Math.max(24 * panelScaleRatio, headingFontSize * 0.92);
    }

    const headingLineH = headingFontSize * 1.06;
    const hOffsetX = (project.heading.offsetX || 0) * panelScaleRatio;
    const hOffsetY = (project.heading.offsetY || 0) * panelScaleRatio;

    ctx.save();
    ctx.font = resolveFontDeclaration(project.heading.fontFamily, headingFontSize, true);
    ctx.textBaseline = 'top';

    let hy = cursorY + hOffsetY;
    for (const line of headingLines) {
      drawColoredLine(
        ctx,
        line,
        innerX + hOffsetX,
        hy,
        innerW,
        project.heading.align || 'center'
      );
      hy += headingLineH;
    }
    ctx.restore();

    cursorY += headingLines.length * headingLineH + (project.heading.marginBottom ?? 28) * panelScaleRatio;
  }

  // 6. DRAW FORMATTED BULLET POINTS WITH DETERMINISTIC AUTO-FIT
  const bullets =
    project.script.bullets && project.script.bullets.length > 0
      ? project.script.bullets
      : parseScriptToBullets(project.script.text);

  const availBulletHeight = Math.max(40 * panelScaleRatio, innerBottomY - cursorY);
  const requestedFontSize1080 = project.script.fontSize || 34;
  let activeFontSize = requestedFontSize1080 * panelScaleRatio * bodyEval.zoom;
  let activeLineHeight = project.script.lineHeight || 1.36;
  let activeBulletSpacing = (project.script.bulletSpacing ?? 20) * panelScaleRatio;

  interface PreparedBullet {
    baseColor: string;
    lines: ColoredToken[][];
    symbolWidth: number;
  }

  const measureBulletsLayout = (
    fontSizePx: number,
    lineHeightMult: number,
    bulletGapPx: number
  ): { prepared: PreparedBullet[]; totalHeight: number; singleWordOverflows: boolean } => {
    ctx.font = resolveFontDeclaration(project.script.fontFamily, fontSizePx, false);
    const symbolStr = `${project.script.bulletSymbol || '•'} `;
    const symbolWidth = ctx.measureText(symbolStr).width + 4 * panelScaleRatio;
    const maxLineW = Math.max(40 * panelScaleRatio, innerW - symbolWidth);

    let totalHeight = 0;
    let singleWordOverflows = false;
    const prepared: PreparedBullet[] = [];

    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const baseColor = resolveBulletBaseColor(b, i, project);
      const tokens = getBulletTokens(b, i, project);
      for (const tok of tokens) {
        if (ctx.measureText(tok.text).width > maxLineW) {
          singleWordOverflows = true;
        }
      }
      const lines = wrapColoredTokens(ctx, tokens, maxLineW);
      const lineCount = Math.max(1, lines.length);
      totalHeight += lineCount * (fontSizePx * lineHeightMult);
      if (i < bullets.length - 1) {
        totalHeight += bulletGapPx;
      }
      prepared.push({ baseColor, lines, symbolWidth });
    }

    return { prepared, totalHeight, singleWordOverflows };
  };

  let layout = measureBulletsLayout(activeFontSize, activeLineHeight, activeBulletSpacing);
  let wasAutoFitted = false;

  if (project.script.autoFitText !== false && Math.abs(bodyEval.zoom - 1.0) < 0.02) {
    const minFontSize = 14 * panelScaleRatio;
    let safetyIter = 0;
    while (
      (layout.totalHeight > availBulletHeight || layout.singleWordOverflows) &&
      activeFontSize > minFontSize &&
      safetyIter < 60
    ) {
      wasAutoFitted = true;
      activeFontSize = Math.max(minFontSize, activeFontSize - 1.2 * panelScaleRatio);
      if (activeBulletSpacing > 6 * panelScaleRatio) {
        activeBulletSpacing = Math.max(6 * panelScaleRatio, activeBulletSpacing * 0.94);
      }
      if (activeLineHeight > 1.15 && layout.totalHeight > availBulletHeight) {
        activeLineHeight = Math.max(1.15, activeLineHeight - 0.015);
      }
      layout = measureBulletsLayout(activeFontSize, activeLineHeight, activeBulletSpacing);
      safetyIter++;
    }
  }

  const overflowWarning = layout.totalHeight > availBulletHeight;
  const tOffsetX = (project.script.textOffsetX || 0) * panelScaleRatio + (bodyEval.posX / 100) * innerW;
  const tOffsetY = (project.script.textOffsetY || 0) * panelScaleRatio + (bodyEval.posY / 100) * availBulletHeight;
  const bodyBounds: RectBox = {
    x: innerX + tOffsetX,
    y: cursorY + tOffsetY,
    width: innerW,
    height: Math.max(40 * panelScaleRatio, layout.totalHeight),
  };

  if (layout.prepared.length > 0) {
    ctx.save();
    ctx.font = resolveFontDeclaration(project.script.fontFamily, activeFontSize, false);
    ctx.textBaseline = 'top';

    let by = cursorY + tOffsetY;
    const lineStep = activeFontSize * activeLineHeight;
    const bulletAlign = project.script.textAlign || 'left';
    const symbolStr = project.script.bulletSymbol || '•';

    for (let i = 0; i < layout.prepared.length; i++) {
      const item = layout.prepared[i];
      const maxTextW = Math.max(40 * panelScaleRatio, innerW - item.symbolWidth);

      if (bulletAlign === 'center') {
        for (let li = 0; li < item.lines.length; li++) {
          const line = item.lines[li];
          const lineWithBullet: ColoredToken[] =
            li === 0 ? [{ text: symbolStr, color: item.baseColor }, ...line] : line;
          drawColoredLine(ctx, lineWithBullet, innerX + tOffsetX, by, innerW, 'center');
          by += lineStep;
        }
      } else {
        ctx.fillStyle = item.baseColor;
        ctx.textAlign = 'left';
        ctx.fillText(symbolStr, innerX + tOffsetX, by);

        for (let li = 0; li < item.lines.length; li++) {
          drawColoredLine(
            ctx,
            item.lines[li],
            innerX + tOffsetX + item.symbolWidth,
            by,
            maxTextW,
            bulletAlign
          );
          by += lineStep;
        }
      }

      if (i < layout.prepared.length - 1) {
        by += activeBulletSpacing;
      }
    }

    ctx.restore();
  }

  ctx.restore();

  for (const entry of activeSequenceSlots) {
    if (entry.slot.zOrder === 'above-panel') {
      drawSequenceImageLayer(
        ctx,
        width,
        height,
        scaleRatio,
        entry.slot,
        overlayElements[entry.slot.id] || null,
        currentTimeSec,
        entry.alpha,
        interactiveEdit
      );
    }
  }

  return {
    panelBounds: baseBounds.panelBounds,
    mediaBounds: baseBounds.mediaBounds,
    headerBounds,
    bodyBounds,
    usedBulletFontSize1080: Math.round(activeFontSize / panelScaleRatio),
    requestedBulletFontSize1080: requestedFontSize1080,
    wasAutoFitted,
    overflowWarning,
  };
}

export interface LayerBounds {
  image: RectBox;
  text: RectBox;
  headerBounds?: RectBox;
  bodyBounds?: RectBox;
  overlayMap: Record<string, RectBox>;
}

/**
 * Calculates exact pixel bounds for Background Media layer, Black Template Panel layer,
 * individual text elements, and active sequential Weather Image(s) at the given timestamp.
 */
export function getCanvasLayerBounds(
  width: number,
  height: number,
  project: VideoProject,
  naturalWidth: number = 1080,
  naturalHeight: number = 1920,
  overlayNaturalSizes: Record<string, { width: number; height: number }> = {},
  currentTimeSec: number = 0,
  interactiveEdit: boolean = false
): LayerBounds {
  const activeSlots = getActiveSequenceSlotsAtTime(
    project.imageSequence || [],
    project.sequenceTransition || { enabled: true, type: 'crossfade', duration: 0.35 },
    currentTimeSec
  );

  if (project.activeTemplate === 'template-2') {
    const t2Bounds = computeTemplate2LayoutBounds(
      width,
      height,
      project,
      currentTimeSec,
      interactiveEdit
    );
    const bgRect = computeTemplate2BgRect(
      width,
      height,
      t2Bounds.lowerBounds,
      project,
      naturalWidth,
      naturalHeight,
      currentTimeSec,
      interactiveEdit
    );
    const overlayMap: Record<string, RectBox> = {};

    for (const { slot } of activeSlots) {
      const nat = overlayNaturalSizes[slot.id] || { width: 1080, height: 720 };
      const transform = evaluateImageTransformAtTime(
        slot,
        currentTimeSec,
        interactiveEdit
      );
      overlayMap[slot.id] = computeTemplate2SlotRect(
        t2Bounds.lowerBounds,
        slot,
        nat.width,
        nat.height,
        transform.zoom,
        transform.posX,
        transform.posY,
        project.template2.lowerMedia.slotBaseFill || 'cover',
        width
      );
    }

    return {
      image: bgRect,
      text: t2Bounds.panelBounds,
      overlayMap,
    };
  }

  const { panelBounds, mediaBounds } = computeLayoutBounds(
    width,
    height,
    project,
    naturalWidth,
    naturalHeight,
    currentTimeSec,
    interactiveEdit
  );

  const overlayMap: Record<string, RectBox> = {};

  for (const { slot } of activeSlots) {
    const nat = overlayNaturalSizes[slot.id] || { width: 1080, height: 720 };
    const transform = evaluateImageTransformAtTime(
      slot,
      currentTimeSec,
      interactiveEdit
    );
    overlayMap[slot.id] = computeFullCanvasImageRect(
      width,
      height,
      slot,
      nat.width,
      nat.height,
      transform.zoom,
      transform.posX,
      transform.posY
    );
  }

  return {
    image: mediaBounds,
    text: panelBounds,
    overlayMap,
  };
}
