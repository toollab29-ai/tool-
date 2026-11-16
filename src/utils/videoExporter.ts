import { VideoProject, RenderProgress } from '../types';
import { renderCanvasFrame } from './canvasRenderer';
import { createLoopAudioBuffer } from './audioGenerator';

export interface ExportResult {
  videoBlob: Blob;
  videoUrl: string;
  posterBlob: Blob;
  posterUrl: string;
  mimeType: string;
  durationSec: number;
}

export class VideoRendererEngine {
  private abortController: AbortController | null = null;

  public cancel() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  public async renderVideo(
    project: VideoProject,
    img: HTMLImageElement | HTMLVideoElement | null,
    onProgress: (progress: RenderProgress) => void,
    logoImg: HTMLImageElement | null = null,
    overlayElements: Record<string, HTMLImageElement | HTMLVideoElement> = {}
  ): Promise<ExportResult> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Ensure custom web fonts (Anton, Oswald, Bebas Neue, Montserrat, Inter) are loaded before rendering
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    } catch {
      // ignore
    }

    // Helper to ensure an HTMLVideoElement has decoded frames (readyState >= 2) and starts cleanly at t=0
    const prepareVideoForExport = async (v: HTMLVideoElement) => {
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      if (v.readyState < 2) {
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(() => {
            cleanup();
            resolve();
          }, 4000);
          const cleanup = () => {
            window.clearTimeout(timer);
            v.removeEventListener('loadeddata', onReady);
            v.removeEventListener('canplay', onReady);
            v.removeEventListener('error', onReady);
          };
          const onReady = () => {
            cleanup();
            resolve();
          };
          v.addEventListener('loadeddata', onReady);
          v.addEventListener('canplay', onReady);
          v.addEventListener('error', onReady);
          if (v.readyState === 0) {
            try {
              v.load();
            } catch {
              // ignore
            }
          }
        });
      }
      try {
        v.currentTime = 0;
      } catch {
        // ignore seek error before metadata
      }
      try {
        await v.play();
      } catch {
        // ignore autoplay restrictions
      }
    };

    // Ensure background media is completely loaded & decoded before export
    let resolvedBgMedia = img;
    if (!resolvedBgMedia && project.mediaUrl) {
      const isRemoteBg =
        project.mediaUrl.startsWith('http://') || project.mediaUrl.startsWith('https://');
      if (project.mediaType === 'video') {
        resolvedBgMedia = await new Promise<HTMLVideoElement | null>((resolve) => {
          const v = document.createElement('video');
          if (isRemoteBg) v.crossOrigin = 'anonymous';
          v.preload = 'auto';
          v.muted = true;
          v.loop = true;
          v.playsInline = true;
          v.onloadeddata = () => resolve(v);
          v.onerror = () => resolve(null);
          v.src = project.mediaUrl;
          v.load();
        });
      } else {
        resolvedBgMedia = await new Promise<HTMLImageElement | null>((resolve) => {
          const bImg = new Image();
          if (isRemoteBg) bImg.crossOrigin = 'anonymous';
          bImg.onload = () => resolve(bImg);
          bImg.onerror = () => resolve(null);
          bImg.src = project.mediaUrl;
        });
      }
    }

    if (resolvedBgMedia instanceof HTMLVideoElement) {
      await prepareVideoForExport(resolvedBgMedia);
    } else if (resolvedBgMedia instanceof HTMLImageElement && !resolvedBgMedia.complete) {
      const bgImgEl = resolvedBgMedia;
      await new Promise<void>((resolve) => {
        bgImgEl.onload = () => resolve();
        bgImgEl.onerror = () => resolve();
      });
    }

    // Ensure all sequential weather images or videos are completely loaded & decoded before rendering frames
    const resolvedOverlays: Record<string, HTMLImageElement | HTMLVideoElement> = {};
    for (const slot of project.imageSequence || []) {
      if (!slot.url || !slot.visible) continue;

      let el: HTMLImageElement | HTMLVideoElement | null =
        overlayElements[slot.id] || null;

      if (!el) {
        const isRemoteSlot =
          slot.url.startsWith('http://') || slot.url.startsWith('https://');
        if (slot.type === 'video') {
          el = await new Promise<HTMLVideoElement | null>((resolve) => {
            const v = document.createElement('video');
            if (isRemoteSlot) v.crossOrigin = 'anonymous';
            v.preload = 'auto';
            v.muted = true;
            v.loop = true;
            v.playsInline = true;
            v.onloadeddata = () => resolve(v);
            v.onerror = () => resolve(null);
            v.src = slot.url;
            v.load();
          });
        } else {
          el = await new Promise<HTMLImageElement | null>((resolve) => {
            const oImg = new Image();
            if (isRemoteSlot) oImg.crossOrigin = 'anonymous';
            oImg.onload = async () => {
              try {
                if (typeof oImg.decode === 'function') {
                  await oImg.decode();
                }
              } catch {
                // ignore decode fallback
              }
              resolve(oImg);
            };
            oImg.onerror = () => resolve(null);
            oImg.src = slot.url;
          });
        }
      } else if (el instanceof HTMLImageElement && !el.complete) {
        const imgEl = el;
        await new Promise<void>((resolve) => {
          imgEl.onload = () => resolve();
          imgEl.onerror = () => resolve();
        });
      }

      if (el instanceof HTMLVideoElement) {
        await prepareVideoForExport(el);
      }

      if (el) {
        resolvedOverlays[slot.id] = el;
      }
    }

    const width = project.resolution === '1080p' ? 1080 : 720;
    const height = project.resolution === '1080p' ? 1920 : 1280;
    const fps = project.fps || 30;
    const duration = Math.max(2, Math.min(10, project.durationSeconds || 8.0));
    const targetDurationMs = duration * 1000;
    const totalFrames = Math.round(duration * fps);

    // Create offscreen canvas for rendering
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = width;
    renderCanvas.height = height;

    // Render first frame as poster
    renderCanvasFrame(renderCanvas, project, resolvedBgMedia, 0, logoImg, resolvedOverlays, false);
    const posterBlob = await new Promise<Blob>((resolve) => {
      renderCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png');
    });
    const posterUrl = URL.createObjectURL(posterBlob);

    // Setup MediaStream from canvas
    const stream = renderCanvas.captureStream(fps);

    // Setup Audio if enabled
    let audioCtx: AudioContext | null = null;
    let audioSourceNode: AudioBufferSourceNode | null = null;

    if (project.audio.enabled && (project.audio.customAudioUrl || (project.audio.ambientTrack && project.audio.ambientTrack !== 'none'))) {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        const dest = audioCtx.createMediaStreamDestination();
        
        let audioBuffer: AudioBuffer | null = null;

        if (project.audio.customAudioUrl) {
          const resp = await fetch(project.audio.customAudioUrl);
          const arrayBuffer = await resp.arrayBuffer();
          audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
            audioCtx!.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
          });
        } else if (project.audio.ambientTrack && project.audio.ambientTrack !== 'none') {
          audioBuffer = await createLoopAudioBuffer(audioCtx, project.audio.ambientTrack, duration);
        }

        if (audioBuffer) {
          audioSourceNode = audioCtx.createBufferSource();
          audioSourceNode.buffer = audioBuffer;
          audioSourceNode.loop = project.audio.loop ?? true;

          const gainNode = audioCtx.createGain();
          gainNode.gain.value = project.audio.volume ?? 0.7;
          audioSourceNode.connect(gainNode);
          gainNode.connect(dest);

          dest.stream.getAudioTracks().forEach((track) => {
            stream.addTrack(track);
          });
        }
      } catch (err) {
        console.warn('Audio stream setup warning:', err);
      }
    }

    const mimeTypes = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    let selectedMimeType = '';
    if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }
    }

    const recordedChunks: Blob[] = [];
    const bitrate = project.resolution === '1080p' ? 8_000_000 : 4_000_000;
    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = selectedMimeType
        ? new MediaRecorder(stream, {
            mimeType: selectedMimeType,
            videoBitsPerSecond: bitrate,
          })
        : new MediaRecorder(stream, { videoBitsPerSecond: bitrate });
    } catch {
      mediaRecorder = new MediaRecorder(stream);
    }
    if (!selectedMimeType) {
      selectedMimeType = mediaRecorder.mimeType || 'video/webm';
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    return new Promise<ExportResult>((resolve, reject) => {
      const startTime = performance.now();
      let animId: number | null = null;
      let timerId: any = null;
      let isCompleted = false;

      const cleanupAndStop = () => {
        if (isCompleted) return;
        isCompleted = true;

        if (animId) cancelAnimationFrame(animId);
        if (timerId) clearTimeout(timerId);

        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      };

      // Strict safety timeout at targetDurationMs + 70ms to ensure recording NEVER exceeds duration
      const safetyTimeout = setTimeout(() => {
        cleanupAndStop();
      }, targetDurationMs + 70);

      mediaRecorder.onstop = () => {
        clearTimeout(safetyTimeout);
        if (animId) cancelAnimationFrame(animId);
        if (timerId) clearTimeout(timerId);

        if (audioSourceNode) {
          try {
            audioSourceNode.stop();
          } catch {
            // ignore
          }
        }
        if (audioCtx) {
          try {
            audioCtx.close();
          } catch {
            // ignore
          }
        }

        // Stop all tracks so media stream doesn't leak into subsequent renders
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });

        const videoBlob = new Blob(recordedChunks, { type: selectedMimeType });
        const videoUrl = URL.createObjectURL(videoBlob);

        resolve({
          videoBlob,
          videoUrl,
          posterBlob,
          posterUrl,
          mimeType: selectedMimeType,
          durationSec: duration,
        });
      };

      mediaRecorder.onerror = (e) => {
        clearTimeout(safetyTimeout);
        cleanupAndStop();
        reject(new Error(`Recording failed: ${e}`));
      };

      mediaRecorder.start();
      if (audioSourceNode) {
        try {
          audioSourceNode.start(0);
        } catch (err) {
          console.warn('Could not start audio node:', err);
        }
      }

      // Real-time animation loop synchronized to exact duration
      const tick = () => {
        if (signal.aborted) {
          clearTimeout(safetyTimeout);
          cleanupAndStop();
          reject(new Error('Rendering cancelled by user'));
          return;
        }

        const now = performance.now();
        const elapsedMs = now - startTime;

        if (elapsedMs >= targetDurationMs) {
          // Render final frame at end timestamp (normalized 1.0) so export ends accurately on final keyframe state
          renderCanvasFrame(renderCanvas, project, resolvedBgMedia, 1.0, logoImg, resolvedOverlays, false);

          onProgress({
            isRendering: true,
            currentFrame: totalFrames,
            totalFrames,
            progressPercent: 100,
            timeRemainingSec: 0,
          });

          cleanupAndStop();
          return;
        }

        if (resolvedBgMedia instanceof HTMLVideoElement && resolvedBgMedia.paused) {
          resolvedBgMedia.play().catch(() => {});
        }
        const normalizedTime = Math.min(1.0, elapsedMs / targetDurationMs);
        renderCanvasFrame(renderCanvas, project, resolvedBgMedia, normalizedTime, logoImg, resolvedOverlays, false);

        const currentFrame = Math.min(totalFrames, Math.round((elapsedMs / targetDurationMs) * totalFrames));
        const progressPercent = Math.min(99, Math.round((elapsedMs / targetDurationMs) * 100));
        const timeRemainingSec = Math.max(0, Math.ceil((targetDurationMs - elapsedMs) / 1000));

        onProgress({
          isRendering: true,
          currentFrame,
          totalFrames,
          progressPercent,
          timeRemainingSec,
        });

        if (document.hidden) {
          timerId = setTimeout(tick, 1000 / fps);
        } else {
          animId = requestAnimationFrame(tick);
        }
      };

      animId = requestAnimationFrame(tick);
    });
  }
}
