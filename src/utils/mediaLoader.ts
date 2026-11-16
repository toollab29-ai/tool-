/**
 * Validates and converts uploaded image/video files into verified browser-compatible URLs
 * for HTML5 Canvas preview and video export, throwing clear user-facing errors on failure.
 */

const SUPPORTED_IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i;
const SUPPORTED_VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

export function detectMediaFileType(file: File): 'image' | 'video' | null {
  if (file.type.startsWith('video/') || SUPPORTED_VIDEO_EXT.test(file.name)) {
    return 'video';
  }
  if (file.type.startsWith('image/') || SUPPORTED_IMAGE_EXT.test(file.name)) {
    return 'image';
  }
  return null;
}

export async function prepareCompatibleImageUrl(file: File): Promise<string> {
  if (file.size === 0) {
    throw new Error(`"${file.name}" is empty (0 bytes). Please choose a valid image file.`);
  }

  const objectUrl = URL.createObjectURL(file);

  // Test if standard Image element loads & decodes the file cleanly
  const directLoaded = await new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch {
        // ignore decode fallback
      }
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
    };
    img.onerror = () => resolve(false);
    img.src = objectUrl;
  });

  if (directLoaded) {
    if (file.type === 'image/gif' || /\.gif$/i.test(file.name)) {
      return objectUrl;
    }
    // Convert standard images to stable PNG DataURL so blob URLs never expire or lose frame data
    try {
      const bitmap = await createImageBitmap(file);
      const maxDim = 2160;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(objectUrl);
        return dataUrl;
      }
      bitmap.close();
    } catch {
      // Fallback to verified objectUrl if createImageBitmap isn't supported for this image
    }
    return objectUrl;
  }

  // Fallback via createImageBitmap -> PNG DataURL
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width > 0 && bitmap.height > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        URL.revokeObjectURL(objectUrl);
        return canvas.toDataURL('image/png');
      }
    }
    bitmap.close();
  } catch {
    // ignore
  }

  URL.revokeObjectURL(objectUrl);
  throw new Error(
    `Could not load image "${file.name}". Supported formats: JPG, PNG, WebP, GIF.`
  );
}

export async function prepareCompatibleVideoUrl(file: File): Promise<string> {
  if (file.size === 0) {
    throw new Error(`"${file.name}" is empty (0 bytes). Please choose a valid video file.`);
  }

  const objectUrl = URL.createObjectURL(file);

  const probeResult = await new Promise<{ ok: boolean; errorMsg?: string }>((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve({
        ok: false,
        errorMsg: `Timed out loading video "${file.name}". Try MP4 (H.264) or WebM.`,
      });
    }, 8000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.onloadeddata = null;
      video.onerror = null;
    };

    video.onloadeddata = () => {
      cleanup();
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve({ ok: true });
      } else {
        resolve({
          ok: false,
          errorMsg: `Video "${file.name}" has no decodable video frames. Please convert to MP4 or WebM.`,
        });
      }
    };

    video.onerror = () => {
      cleanup();
      resolve({
        ok: false,
        errorMsg: `Browser cannot decode "${file.name}". Please use MP4 (H.264) or WebM.`,
      });
    };

    video.src = objectUrl;
    video.load();
  });

  if (!probeResult.ok) {
    URL.revokeObjectURL(objectUrl);
    throw new Error(
      probeResult.errorMsg || `Failed to load video "${file.name}".`
    );
  }

  return objectUrl;
}
