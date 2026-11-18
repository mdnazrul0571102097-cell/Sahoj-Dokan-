import { ProductUnit } from '../types';
import { compressImage } from './image';
import { CLOUD_ENDPOINTS, getApiBaseUrl } from '../services/cloudSync';

export interface ScannedMemoItem {
  name: string;
  quantity: number;
  unit: ProductUnit;
  purchasePrice: number;
}

export interface ScannedMemoResult {
  supplierName: string;
  memoNumber: string;
  items: ScannedMemoItem[];
}

export interface MemoScanOutcome {
  attachmentDataUrl: string;
  attachmentMimeType: string;
  attachmentName: string;
  aiSuccess: boolean;
  aiStatus: 'extracted' | 'partial_or_unreadable' | 'offline_or_slow' | 'pro_locked';
  result?: ScannedMemoResult;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(new Error('ফাইল পড়া সম্ভব হয়নি।'));
    reader.readAsDataURL(file);
  });
}

function getScanEndpoints(): string[] {
  const urls: string[] = [];

  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const port = window.location.port;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const isWebServer =
      window.location.protocol.startsWith('http') && (!isLocalhost || port === '3000');

    if (isWebServer) {
      urls.push('/api/ai/scan-memo');
    }
  }

  urls.push(`${getApiBaseUrl()}/api/ai/scan-memo`);
  for (const ep of CLOUD_ENDPOINTS) {
    urls.push(`${ep}/api/ai/scan-memo`);
  }

  return Array.from(new Set(urls));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 25000
): Promise<Response> {
  if (typeof AbortController === 'undefined') {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const MAX_MEMO_DIMENSION = 1024;
const DEFAULT_MEMO_JPEG_QUALITY = 0.65;
const TARGET_MAX_MEMO_BYTES = 130 * 1024; // Strict <= 130 KB target per image

function estimateDataUrlBytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Math.round((base64.length * 3) / 4);
}

/**
 * Compresses an uploaded memo image strictly via HTML5 Canvas:
 * - Max width/height: 1024px (aspect ratio preserved)
 * - Format: image/jpeg, default quality 0.65
 * - Target binary payload <= 80KB - 130KB so localStorage & Firebase stay fast.
 */
export async function compressMemoFile(file: File): Promise<{
  dataUrl: string;
  mimeType: string;
  name: string;
}> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    const pdfDataUrl = await readFileAsDataUrl(file);
    const safePdfUrl = pdfDataUrl.length > 2_000_000 ? '' : pdfDataUrl;
    if (!pdfDataUrl) {
      throw new Error('ফাইল লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
    return {
      dataUrl: safePdfUrl,
      mimeType: 'application/pdf',
      name: file.name || 'memo.pdf',
    };
  }

  let dataUrl = await compressImage(
    file,
    MAX_MEMO_DIMENSION,
    MAX_MEMO_DIMENSION,
    DEFAULT_MEMO_JPEG_QUALITY
  );

  if (!dataUrl) {
    dataUrl = await readFileAsDataUrl(file);
  }

  if (!dataUrl) {
    throw new Error('ফাইল লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
  }

  // Adaptive step-down only if an ultra-dense photo still exceeds ~130KB at 1024px / 0.65
  if (dataUrl.startsWith('data:image/') && estimateDataUrlBytes(dataUrl) > TARGET_MAX_MEMO_BYTES) {
    const passes: Array<[number, number]> = [
      [1024, 0.55],
      [900, 0.5],
      [800, 0.45],
    ];
    for (const [dim, q] of passes) {
      const nextUrl = await compressImage(dataUrl, dim, dim, q);
      if (nextUrl && estimateDataUrlBytes(nextUrl) < estimateDataUrlBytes(dataUrl)) {
        dataUrl = nextUrl;
      }
      if (estimateDataUrlBytes(dataUrl) <= TARGET_MAX_MEMO_BYTES) {
        break;
      }
    }
  }

  return {
    dataUrl,
    mimeType: dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : file.type || 'image/jpeg',
    name: file.name || 'memo.jpg',
  };
}

/**
 * Resizes & compresses camera/gallery images via Canvas (max 1024x1024, 0.65 JPEG quality, <=130KB)
 * so Android APK WebView never runs out of memory or hits mobile network timeouts.
 * Always resolves with the prepared attachment even if AI cannot read blurry handwriting, internet is slow/offline, or AI auto-scan is Pro-locked after the 60-day trial.
 */
export async function prepareAndScanMemoWithAI(
  file: File,
  options?: { skipAiScan?: boolean }
): Promise<MemoScanOutcome> {
  const prepared = await compressMemoFile(file);
  const base64Data = prepared.dataUrl;
  const mimeType = prepared.mimeType;
  const safeAttachmentDataUrl = prepared.dataUrl;

  if (options?.skipAiScan) {
    return {
      attachmentDataUrl: safeAttachmentDataUrl,
      attachmentMimeType: mimeType,
      attachmentName: prepared.name,
      aiSuccess: false,
      aiStatus: 'pro_locked',
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      attachmentDataUrl: safeAttachmentDataUrl,
      attachmentMimeType: mimeType,
      attachmentName: prepared.name,
      aiSuccess: false,
      aiStatus: 'offline_or_slow',
    };
  }

  const endpoints = getScanEndpoints();
  let hadAnyHttpResponse = false;

  for (const url of endpoints) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ base64Data, mimeType }),
        },
        25000
      );

      hadAnyHttpResponse = true;
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        const rawData = json.data;
        const parsedResult: ScannedMemoResult = {
          supplierName: String(rawData.supplierName || '').trim(),
          memoNumber: String(rawData.memoNumber || '').trim(),
          items: Array.isArray(rawData.items)
            ? rawData.items.map((it: any) => ({
                name: String(it.name || '').trim(),
                quantity: Math.max(0.01, Number(it.quantity) || 1),
                unit: (['kg', 'gm', 'liter', 'packet', 'piece', 'dozen'].includes(it.unit)
                  ? it.unit
                  : 'piece') as ProductUnit,
                purchasePrice: Math.max(0, Number(it.purchasePrice) || 0),
              }))
            : [],
        };

        const hasUsefulData =
          parsedResult.items.length > 0 ||
          Boolean(parsedResult.supplierName) ||
          Boolean(parsedResult.memoNumber);

        return {
          attachmentDataUrl: safeAttachmentDataUrl,
          attachmentMimeType: mimeType,
          attachmentName: prepared.name,
          aiSuccess: hasUsefulData,
          aiStatus: hasUsefulData ? 'extracted' : 'partial_or_unreadable',
          result: parsedResult,
        };
      }
    } catch (_) {
      // Try next endpoint cleanly without crashing
    }
  }

  return {
    attachmentDataUrl: safeAttachmentDataUrl,
    attachmentMimeType: mimeType,
    attachmentName: prepared.name,
    aiSuccess: false,
    aiStatus: hadAnyHttpResponse ? 'partial_or_unreadable' : 'offline_or_slow',
  };
}

export async function scanMemoFileWithAI(file: File): Promise<ScannedMemoResult> {
  const outcome = await prepareAndScanMemoWithAI(file);
  if (outcome.aiSuccess && outcome.result) {
    return outcome.result;
  }
  throw new Error(
    outcome.aiStatus === 'offline_or_slow'
      ? 'ইন্টারনেট সংযোগ ধীর বা বিচ্ছিন্ন।'
      : 'মেমো থেকে পণ্য পড়া যায়নি।'
  );
}
