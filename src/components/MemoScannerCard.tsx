import React, { useRef, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  Paperclip,
  Eye,
  X,
  FileText,
  Info,
  Lock,
} from 'lucide-react';
import { AppMode } from '../types';
import { prepareAndScanMemoWithAI, ScannedMemoResult } from '../utils/memoScanner';

export interface MemoAttachment {
  dataUrl: string;
  mimeType?: string;
  name?: string;
}

interface Props {
  onMemoExtracted: (result: ScannedMemoResult) => void;
  onAttachmentChange?: (attachment: MemoAttachment | null) => void;
  attachment?: MemoAttachment | null;
  compact?: boolean;
  appMode?: AppMode;
  onOpenSubscriptionModal?: () => void;
}

export const MemoScannerCard: React.FC<Props> = ({
  onMemoExtracted,
  onAttachmentChange,
  attachment,
  compact = false,
  appMode = 'trial',
  onOpenSubscriptionModal,
}) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAiLocked = appMode === 'normal';

  const [isScanning, setIsScanning] = useState(false);
  const [localAttachment, setLocalAttachment] = useState<MemoAttachment | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'info' | 'pro_locked';
    text: string;
  } | null>(null);

  const effectiveAttachment = attachment !== undefined ? attachment : localAttachment;

  const updateAttachment = (next: MemoAttachment | null) => {
    setLocalAttachment(next);
    if (onAttachmentChange) {
      onAttachmentChange(next);
    }
  };

  const handleOpenCamera = () => {
    if (isScanning) return;
    setStatusMessage(null);
    cameraInputRef.current?.click();
  };

  const handleOpenGallery = () => {
    if (isScanning) return;
    setStatusMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsScanning(true);
    setStatusMessage(null);

    try {
      const outcome = await prepareAndScanMemoWithAI(file, {
        skipAiScan: isAiLocked,
      });

      if (outcome.attachmentDataUrl) {
        updateAttachment({
          dataUrl: outcome.attachmentDataUrl,
          mimeType: outcome.attachmentMimeType,
          name: outcome.attachmentName,
        });
      }

      if (outcome.aiStatus === 'pro_locked') {
        setStatusMessage({
          type: 'pro_locked',
          text: '✨ অটোমেটিক মেমো স্ক্যান সুবিধাটি Pro প্যাকেজের অন্তর্ভুক্ত। এক ক্লিকে হিসাব বসাতে Pro আনলক করুন!',
        });
      } else if (outcome.aiSuccess && outcome.result) {
        onMemoExtracted(outcome.result);
        setStatusMessage({
          type: 'success',
          text:
            outcome.result.items.length > 0
              ? '✅ মেমো থেকে তথ্য ও ছবি যুক্ত হয়েছে! নিচে সবকিছু মিলিয়ে দেখে সংরক্ষণ করুন।'
              : '✅ মেমোর ছবি সংযুক্ত ও আংশিক তথ্য বসানো হয়েছে। নিচে টাকার অঙ্ক মিলিয়ে সেভ করুন।',
        });
      } else {
        setStatusMessage({
          type: 'info',
          text:
            outcome.aiStatus === 'offline_or_slow'
              ? '📎 মেমোর ছবিটি রসিদের প্রমাণ হিসেবে যুক্ত হয়েছে। নেটওয়ার্ক ধীর বা অফলাইন থাকায় নিচের ঘরে নিজে হাতে টাকার অঙ্ক বসিয়ে সেভ করুন।'
              : '📎 মেমোর ছবিটি রসিদের প্রমাণ হিসেবে যুক্ত হয়েছে। হাতের লেখা অস্পষ্ট হওয়ায় নিচের ঘরে নিজে হাতে টাকার অঙ্ক বসিয়ে মেমোসহ সেভ করুন।',
        });
      }
    } catch (_) {
      setStatusMessage({
        type: 'info',
        text: '📎 ছবিটি লোড করতে সমস্যা হয়েছে, তবে আপনি নিচের ঘরে নিজে হাতে টাকার অঙ্ক বসিয়ে ক্রয় সেভ করতে পারবেন।',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const isPdfAttachment = Boolean(
    effectiveAttachment?.mimeType?.includes('pdf') ||
      effectiveAttachment?.dataUrl?.startsWith('data:application/pdf') ||
      effectiveAttachment?.name?.toLowerCase().endsWith('.pdf')
  );

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
      {/* Dark-blue / slate AI Memo Scanner Card */}
      <div
        className={
          compact
            ? 'rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F2942] text-white px-3 py-2 shadow-sm border border-slate-700/80 space-y-2'
            : 'rounded-[20px] bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F2942] text-white p-3.5 sm:p-4 shadow-md border border-slate-700/80 space-y-3'
        }
      >
        {compact ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-slate-200 leading-snug">
              {isAiLocked
                ? 'মেমোর ছবি তুলে রসিদ হিসেবে সেভ করা ফ্রি; নিচে টাকার অঙ্ক লিখুন।'
                : 'ডিলারের মেমোর ছবি তুলুন — অটো যোগ হবে বা রসিদ হিসেবে সংযুক্ত থাকবে।'}
            </p>
            {isAiLocked && (
              <button
                type="button"
                onClick={() => onOpenSubscriptionModal?.()}
                className="px-2 py-0.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-black flex items-center gap-1 shrink-0 cursor-pointer transition active:scale-95"
                title="AI অটো-স্ক্যান আনলক করতে Pro প্যাকেজ দেখুন"
              >
                <Lock className="w-2.5 h-2.5 stroke-[2.5]" />
                <span>AI Pro</span>
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                <span>📷 মেমো থেকে অটো স্টক / ক্রয়</span>
              </h4>
              {isAiLocked && (
                <button
                  type="button"
                  onClick={() => onOpenSubscriptionModal?.()}
                  className="px-2.5 py-0.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-black flex items-center gap-1 shrink-0 cursor-pointer transition active:scale-95"
                >
                  <Lock className="w-3 h-3 stroke-[2.5]" />
                  <span>AI অটো-স্ক্যান Pro</span>
                </button>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed mt-1">
              {isAiLocked
                ? 'ছবি বা গ্যালারি থেকে মেমো রসিদের প্রমাণ হিসেবে ফ্রি সেভ করুন। এক ক্লিকে AI অটো-ফিলাপ সুবিধা পেতে Pro আনলক করুন।'
                : 'আড়ত বা ডিলারের মেমোর ছবি তুলুন বা গ্যালারি/PDF দিন। সাপ্লাইয়ারের নাম, পণ্যের নাম, পরিমাণ ও দাম নিজে থেকেই নিচের ঘরে বসে যাবে এবং মেমোর ছবি রসিদের প্রমাণ হিসেবে যুক্ত থাকবে।'}
            </p>
          </div>
        )}

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
          <div
            className={`w-full rounded-xl bg-white/10 border border-sky-400/40 flex items-center justify-center gap-2 font-extrabold text-sky-200 ${
              compact ? 'py-2 px-3 text-xs' : 'py-3 px-4 rounded-2xl text-xs sm:text-sm'
            }`}
          >
            <Loader2 className="w-4 h-4 animate-spin text-sky-300 shrink-0" />
            <span>
              {isAiLocked
                ? 'ছবি ছোট করে রসিদে যুক্ত করা হচ্ছে...'
                : 'ছবি ছোট করে মেমো পড়া হচ্ছে, অপেক্ষা করুন...'}
            </span>
          </div>
        ) : (
          <div className={compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-2.5'}>
            <button
              type="button"
              onClick={handleOpenCamera}
              className={
                compact
                  ? 'py-1.5 px-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer'
                  : 'py-2.5 px-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer'
              }
            >
              <Camera
                className={compact ? 'w-3.5 h-3.5 shrink-0 stroke-[2.5]' : 'w-4 h-4 shrink-0 stroke-[2.5]'}
              />
              <span>{compact ? 'ছবি তুলুন' : '📷 ছবি তুলুন'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenGallery}
              className={
                compact
                  ? 'py-1.5 px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer'
                  : 'py-2.5 px-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/25 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer'
              }
            >
              <ImageIcon
                className={compact ? 'w-3.5 h-3.5 shrink-0 stroke-[2.2]' : 'w-4 h-4 shrink-0 stroke-[2.2]'}
              />
              <span>{compact ? 'গ্যালারি / PDF' : '🖼️ গ্যালারি / PDF'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Attached Memo Receipt Preview Chip */}
      {effectiveAttachment?.dataUrl && (
        <div className="px-2.5 py-2 rounded-xl bg-[#F0FDF4] border border-emerald-200 flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div
            onClick={() => !isPdfAttachment && setShowPreviewModal(true)}
            className={`flex items-center gap-2 min-w-0 flex-1 ${
              !isPdfAttachment ? 'cursor-pointer' : ''
            }`}
          >
            {isPdfAttachment ? (
              <div className="w-9 h-9 rounded-lg bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            ) : (
              <img
                src={effectiveAttachment.dataUrl}
                alt="সংযুক্ত মেমো"
                className="w-9 h-9 rounded-lg object-cover border border-emerald-300 shrink-0 bg-white"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold text-[#102A43] flex items-center gap-1 truncate">
                <Paperclip className="w-3 h-3 text-[#0E6B6B] shrink-0" />
                <span className="truncate">মেমোর ছবি সংযুক্ত (রসিদ প্রমাণ)</span>
              </p>
              <p className="text-[10px] text-[#64748B] truncate">
                {effectiveAttachment.name || 'সংযুক্ত মেমো ফাইল'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!isPdfAttachment && (
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="px-2 py-1 rounded-lg bg-white hover:bg-[#E0F2F1] text-[#0E6B6B] border border-[#B2DFDB] text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                <span>দেখুন</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                updateAttachment(null);
                setStatusMessage(null);
              }}
              className="p-1 rounded-lg bg-white hover:bg-slate-100 text-[#64748B] border border-[#E2E8F0] cursor-pointer"
              title="সংযুক্তি সরান"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Soft Inline Feedback Banner or Clickable Pro Unlock Banner */}
      {statusMessage?.type === 'pro_locked' ? (
        <button
          type="button"
          onClick={() => onOpenSubscriptionModal?.()}
          className="w-full text-left px-3 py-2.5 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 text-amber-950 text-[11px] font-extrabold flex items-center gap-2 shadow-2xs transition active:scale-[0.99] cursor-pointer animate-in fade-in duration-150"
        >
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="leading-snug flex-1">{statusMessage.text}</span>
          <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black shrink-0">
            Pro আনলক
          </span>
        </button>
      ) : (
        statusMessage && (
          <div
            className={`px-3 py-2 rounded-xl border text-[11px] font-bold flex items-start gap-2 animate-in fade-in duration-150 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{statusMessage.text}</span>
          </div>
        )
      )}

      {/* Fullscreen Memo Image Preview Modal so shopkeeper can read blurry memo & enter amounts */}
      {showPreviewModal && effectiveAttachment?.dataUrl && !isPdfAttachment && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 p-3 sm:p-6 flex flex-col items-center justify-center backdrop-blur-xs"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="w-full max-w-lg md:max-w-xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2.5 bg-[#0F172A] text-white flex items-center justify-between">
              <span className="text-xs font-bold truncate">সংযুক্ত মেমো / রসিদের ছবি</span>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-900 p-2 flex items-center justify-center">
              <img
                src={effectiveAttachment.dataUrl}
                alt="সংযুক্ত মেমোর ছবি"
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
