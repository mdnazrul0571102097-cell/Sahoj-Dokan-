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

/**
 * Resizes & compresses camera/gallery images via Canvas (max 1024px width, 0.7 JPEG quality)
 * so Android APK WebView never runs out of memory or hits mobile network timeouts.
 * Always resolves with the prepared attachment even if AI cannot read blurry handwriting, internet is slow/offline, or AI auto-scan is Pro-locked after the 60-day trial.
 */
export async function prepareAndScanMemoWithAI(
  file: File,
  options?: { skipAiScan?: boolean }
): Promise<MemoScanOutcome> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  let base64Data = '';
  let mimeType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');

  if (isPdf) {
    base64Data = await readFileAsDataUrl(file);
    mimeType = 'application/pdf';
  } else {
    // Resize via browser Canvas to max 1024px width & compress to 0.7 JPEG quality
    base64Data = await compressImage(file, 1024, 1600, 0.7);
    if (!base64Data) {
      base64Data = await readFileAsDataUrl(file);
    } else {
      mimeType = 'image/jpeg';
    }
  }

  if (!base64Data) {
    throw new Error('ফাইল লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
  }

  // Keep localStorage/CloudSync safe if a huge raw PDF was chosen (images are already ~80-130KB JPEG)
  const safeAttachmentDataUrl =
    isPdf && base64Data.length > 2_000_000 ? '' : base64Data;

  if (options?.skipAiScan) {
    return {
      attachmentDataUrl: safeAttachmentDataUrl,
      attachmentMimeType: mimeType,
      attachmentName: file.name || (isPdf ? 'memo.pdf' : 'memo.jpg'),
      aiSuccess: false,
      aiStatus: 'pro_locked',
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      attachmentDataUrl: safeAttachmentDataUrl,
      attachmentMimeType: mimeType,
      attachmentName: file.name || (isPdf ? 'memo.pdf' : 'memo.jpg'),
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
          attachmentName: file.name || (isPdf ? 'memo.pdf' : 'memo.jpg'),
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
    attachmentName: file.name || (isPdf ? 'memo.pdf' : 'memo.jpg'),
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
