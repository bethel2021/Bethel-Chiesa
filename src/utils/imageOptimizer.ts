import { DATA_IMAGE_URI_REGEX } from './urlSafety';

export type ImageOptimizationPreset = 'hero' | 'banner' | 'poster' | 'avatar';

export interface OptimizedImageResult {
  dataUrl: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  originalBytes: number;
  optimizedBytes: number;
  formatLabel: 'WebP' | 'JPEG' | 'PNG';
  wasResized: boolean;
  wasCompressed: boolean;
}

const MAX_INPUT_FILE_BYTES = 20 * 1024 * 1024; // 20 MB raw file safety limit

const PRESET_CONFIG: Record<
  ImageOptimizationPreset,
  { maxDimension: number; quality: number; targetMaxChars: number }
> = {
  hero: { maxDimension: 1920, quality: 0.84, targetMaxChars: 240_000 },
  banner: { maxDimension: 1440, quality: 0.82, targetMaxChars: 170_000 },
  poster: { maxDimension: 1200, quality: 0.8, targetMaxChars: 120_000 },
  avatar: { maxDimension: 480, quality: 0.82, targetMaxChars: 45_000 },
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('无法读取图片文件内容，请重试。'));
        return;
      }
      resolve(reader.result.replace(/^data:image\/jpg;base64,/, 'data:image/jpeg;base64,'));
    };
    reader.onerror = () => reject(new Error('读取图片文件失败，请重试。'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法解析该图片文件，请确认文件未损坏。'));
    };
    img.src = objectUrl;
  });
}

function approximateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  return Math.round((dataUrl.length - commaIdx - 1) * 0.75);
}

function detectDataUrlFormat(dataUrl: string): 'WebP' | 'JPEG' | 'PNG' {
  if (dataUrl.startsWith('data:image/webp')) return 'WebP';
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  return 'JPEG';
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  quality: number,
  fillOpaqueBackground: boolean
): string {
  // Prefer WebP when browser supports encoding it; Safari older builds fall back to image/png
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp;base64,')) {
    return webp;
  }

  // Fallback to JPEG; ensure transparent pixels flatten nicely on warm off-white if needed
  if (fillOpaqueBackground) {
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx = copy.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FAF8F4';
      ctx.fillRect(0, 0, copy.width, copy.height);
      ctx.drawImage(canvas, 0, 0);
      return copy.toDataURL('image/jpeg', quality);
    }
  }
  return canvas.toDataURL('image/jpeg', quality);
}

export async function optimizeUploadedImage(
  file: File,
  preset: ImageOptimizationPreset = 'banner'
): Promise<OptimizedImageResult> {
  const allowedMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
  const normalizedMime = file.type.toLowerCase();
  if (!allowedMimes.has(normalizedMime)) {
    throw new Error('请选择 JPG、PNG 或 WebP 格式的图片文件。');
  }
  if (file.size > MAX_INPUT_FILE_BYTES) {
    throw new Error('图片文件超过 20 MB 上限，请先裁剪或选用较小的图片，或填写外链网址。');
  }

  const config = PRESET_CONFIG[preset];
  const img = await loadImageElement(file);
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  if (!originalWidth || !originalHeight) {
    throw new Error('无法识别图片分辨率，请换一张图片重试。');
  }

  const maxSide = Math.max(originalWidth, originalHeight);
  const scale = maxSide > config.maxDimension ? config.maxDimension / maxSide : 1;
  const targetWidth = Math.max(1, Math.round(originalWidth * scale));
  const targetHeight = Math.max(1, Math.round(originalHeight * scale));
  const wasResized = targetWidth < originalWidth || targetHeight < originalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const rawFallback = await readFileAsDataUrl(file);
    if (!DATA_IMAGE_URI_REGEX.test(rawFallback)) {
      throw new Error('图片编码格式不支持，请上传标准 JPG、PNG 或 WebP 图片。');
    }
    return {
      dataUrl: rawFallback,
      originalWidth,
      originalHeight,
      width: originalWidth,
      height: originalHeight,
      originalBytes: file.size,
      optimizedBytes: approximateDataUrlBytes(rawFallback),
      formatLabel: detectDataUrlFormat(rawFallback),
      wasResized: false,
      wasCompressed: false,
    };
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const mayHaveAlpha = normalizedMime === 'image/png' || normalizedMime === 'image/webp';
  let candidate = encodeCanvas(canvas, config.quality, mayHaveAlpha);

  // Gentle adaptive pass if a very detailed/noisy photo is still larger than the target ceiling
  if (candidate.length > config.targetMaxChars) {
    const secondPass = encodeCanvas(canvas, Math.max(0.66, config.quality - 0.12), mayHaveAlpha);
    if (secondPass.length < candidate.length) {
      candidate = secondPass;
    }
  }

  // Never inflate a tiny already-optimized image when no downscaling occurred
  if (!wasResized) {
    const rawOriginal = await readFileAsDataUrl(file);
    if (DATA_IMAGE_URI_REGEX.test(rawOriginal) && rawOriginal.length <= candidate.length) {
      return {
        dataUrl: rawOriginal,
        originalWidth,
        originalHeight,
        width: originalWidth,
        height: originalHeight,
        originalBytes: file.size,
        optimizedBytes: approximateDataUrlBytes(rawOriginal),
        formatLabel: detectDataUrlFormat(rawOriginal),
        wasResized: false,
        wasCompressed: false,
      };
    }
  }

  if (!DATA_IMAGE_URI_REGEX.test(candidate)) {
    throw new Error('图片转码失败，请换用 JPG、PNG 或 WebP 图片重试。');
  }

  const optimizedBytes = approximateDataUrlBytes(candidate);
  return {
    dataUrl: candidate,
    originalWidth,
    originalHeight,
    width: targetWidth,
    height: targetHeight,
    originalBytes: file.size,
    optimizedBytes,
    formatLabel: detectDataUrlFormat(candidate),
    wasResized,
    wasCompressed: optimizedBytes < file.size,
  };
}
