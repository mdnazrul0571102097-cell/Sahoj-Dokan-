import { ProductUnit } from '../types';
import { compressImage } from './image';
import { getApiBaseUrl } from '../services/cloudSync';

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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(new Error('ফাইল পড়া সম্ভব হয়নি।'));
    reader.readAsDataURL(file);
  });
}

export async function scanMemoFileWithAI(file: File): Promise<ScannedMemoResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('মেমো স্ক্যান করতে অনুগ্রহ করে ফোনের ইন্টারনেট (Data/WiFi) চালু করুন।');
  }

  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  let base64Data = '';
  let mimeType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');

  if (isPdf) {
    base64Data = await readFileAsDataUrl(file);
    mimeType = 'application/pdf';
  } else {
    // High-resolution readable JPEG compression (1600px) so Bengali memo digits stay crisp
    base64Data = await compressImage(file, 1600, 1600, 0.85);
    if (!base64Data) {
      base64Data = await readFileAsDataUrl(file);
    } else {
      mimeType = 'image/jpeg';
    }
  }

  if (!base64Data) {
    throw new Error('ফাইল লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
  }

  const endpoints = [
    `${getApiBaseUrl()}/api/ai/scan-memo`,
    '/api/ai/scan-memo',
  ];

  let lastError = 'মেমো পড়া যায়নি। অনুগ্রহ করে পরিষ্কার ছবি বা PDF দিয়ে আবার চেষ্টা করুন।';

  for (const url of Array.from(new Set(endpoints))) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ base64Data, mimeType }),
      });

      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        const rawData = json.data;
        return {
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
      }

      if (json?.error) {
        lastError = json.error;
      }
    } catch (_) {
      // Try next endpoint if primary fails
    }
  }

  throw new Error(lastError);
}
