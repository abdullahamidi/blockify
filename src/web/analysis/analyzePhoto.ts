import type { ImageSegmenter } from '@mediapipe/tasks-vision';
import { extractFeatures, type AnalysisResult } from './features';

const MODEL_URL =
  import.meta.env.VITE_SEGMENTER_MODEL_URL ||
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
const WASM_BASE = import.meta.env.VITE_MEDIAPIPE_WASM_BASE || '/mediapipe';

let segmenterPromise: Promise<ImageSegmenter> | null = null;

async function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      const make = (delegate: 'GPU' | 'CPU') =>
        ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'IMAGE',
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
      try {
        return await make('GPU');
      } catch {
        return await make('CPU');
      }
    })();
    segmenterPromise.catch(() => (segmenterPromise = null));
  }
  return segmenterPromise;
}

/** Modeli arka planda önceden yükle (kullanıcı fotoğraf seçerken) */
export function preloadSegmenter(): void {
  getSegmenter().catch(() => undefined);
}

export async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error('Görsel açılamadı. Lütfen JPG veya PNG bir fotoğraf deneyin.');
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function drawScaled(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Sipariş kontrolü için küçük bir JPEG kopyası (yalnızca müşteri izin verirse gönderilir) */
export function makeThumbnail(img: HTMLImageElement, maxSide = 320): string {
  return drawScaled(img, maxSide).toDataURL('image/jpeg', 0.8);
}

export interface Segmentation {
  rgba: Uint8ClampedArray;
  labels: Uint8Array;
  w: number;
  h: number;
}

/** Görseli kişi bölgelerine ayırır (saç, yüz, ten, kıyafet, aksesuar). */
export async function segmentImage(img: HTMLImageElement): Promise<Segmentation> {
  const canvas = drawScaled(img, 640);
  const segmenter = await getSegmenter();
  const result = segmenter.segment(canvas);
  try {
    const mask = result.categoryMask;
    if (!mask) throw new Error('Segmentasyon sonucu alınamadı');
    const labels = new Uint8Array(mask.getAsUint8Array());
    const w = mask.width;
    const h = mask.height;
    let rgbaCanvas = canvas;
    if (w !== canvas.width || h !== canvas.height) {
      rgbaCanvas = document.createElement('canvas');
      rgbaCanvas.width = w;
      rgbaCanvas.height = h;
      rgbaCanvas.getContext('2d')!.drawImage(canvas, 0, 0, w, h);
    }
    const rgba = rgbaCanvas.getContext('2d')!.getImageData(0, 0, w, h).data;
    return { rgba, labels, w, h };
  } finally {
    result.close();
  }
}

export async function analyzePhoto(img: HTMLImageElement): Promise<AnalysisResult> {
  const { rgba, labels, w, h } = await segmentImage(img);
  return extractFeatures(rgba, labels, w, h);
}
