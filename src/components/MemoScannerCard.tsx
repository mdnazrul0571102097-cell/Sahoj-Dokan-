import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, CheckCircle2, WifiOff, AlertCircle } from 'lucide-react';
import { scanMemoFileWithAI, ScannedMemoResult } from '../utils/memoScanner';

interface Props {
  onMemoExtracted: (result: ScannedMemoResult) => void;
}

export const MemoScannerCard: React.FC<Props> = ({ onMemoExtracted }) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'offline' | 'error';
    text: string;
  } | null>(null);

  const checkOnlineBeforePick = (): boolean => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatusMessage({
        type: 'offline',
        text: 'মেমো স্ক্যান করতে অনুগ্রহ করে ফোনের ইন্টারনেট (Data/WiFi) চালু করুন।',
      });
      return false;
    }
    return true;
  };

  const handleOpenCamera = () => {
    if (isScanning) return;
    if (!checkOnlineBeforePick()) return;
    setStatusMessage(null);
    cameraInputRef.current?.click();
  };

  const handleOpenGallery = () => {
    if (isScanning) return;
    if (!checkOnlineBeforePick()) return;
    setStatusMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatusMessage({
        type: 'offline',
        text: 'মেমো স্ক্যান করতে অনুগ্রহ করে ফোনের ইন্টারনেট (Data/WiFi) চালু করুন।',
      });
      return;
    }

    setIsScanning(true);
    setStatusMessage(null);

    try {
      const result = await scanMemoFileWithAI(file);
      if (!result.items || result.items.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'মেমো থেকে কোনো পণ্য পড়া যায়নি। অনুগ্রহ করে আরও পরিষ্কার ছবি দিয়ে চেষ্টা করুন।',
        });
        return;
      }
      onMemoExtracted(result);
      setStatusMessage({
        type: 'success',
        text: '✅ মেমো থেকে তথ্য বসানো হয়েছে! নিচে সবকিছু মিলিয়ে দেখে সংরক্ষণ করুন।',
      });
    } catch (err: any) {
      const msg =
        err?.message ||
        'মেমো পড়া যায়নি। অনুগ্রহ করে পরিষ্কার ছবি বা PDF দিয়ে আবার চেষ্টা করুন।';
      const isOfflineMsg = msg.includes('ইন্টারনেট') || msg.includes('Data/WiFi');
      setStatusMessage({
        type: isOfflineMsg ? 'offline' : 'error',
        text: msg,
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Dark-blue / slate AI Memo Scanner Card */}
      <div className="rounded-[20px] bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F2942] text-white p-3.5 sm:p-4 shadow-md border border-slate-700/80 space-y-3">
        <div>
          <h4 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
            <span>📷 মেমো থেকে অটো স্টক / ক্রয়</span>
          </h4>
          <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed mt-1">
            আড়ত বা ডিলারের মেমোর ছবি তুলুন বা গ্যালারি/PDF দিন। সাপ্লাইয়ারের নাম, পণ্যের নাম, পরিমাণ ও দাম নিজে থেকেই নিচের ঘরে বসে যাবে। সেভ করার আগে আপনি মিলিয়ে নিতে পারবেন।
          </p>
        </div>

        {/* Hidden Inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileSelected}
          className="hidden"
        />

        {isScanning ? (
          <div className="w-full py-3 px-4 rounded-2xl bg-white/10 border border-sky-400/40 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-extrabold text-sky-200">
            <Loader2 className="w-4 h-4 animate-spin text-sky-300 shrink-0" />
            <span>মেমো পড়া হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleOpenCamera}
              className="py-2.5 px-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Camera className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span>📷 ছবি তুলুন</span>
            </button>

            <button
              type="button"
              onClick={handleOpenGallery}
              className="py-2.5 px-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/25 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 shrink-0 stroke-[2.2]" />
              <span>🖼️ গ্যালারি / PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Inline Status / Feedback Banner */}
      {statusMessage && (
        <div
          className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold flex items-start gap-2 animate-in fade-in duration-150 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : statusMessage.type === 'offline'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : statusMessage.type === 'offline' ? (
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="leading-snug">{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
};
