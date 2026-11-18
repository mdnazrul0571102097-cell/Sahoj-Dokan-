import React, { useEffect, useRef, useState } from 'react';
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
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AppMode, MemoAttachmentItem } from '../types';
import {
  compressMemoFile,
  prepareAndScanMemoWithAI,
  ScannedMemoResult,
} from '../utils/memoScanner';

export type MemoAttachment = MemoAttachmentItem;

interface Props {
  onMemoExtracted: (result: ScannedMemoResult) => void;
  onAttachmentChange?: (attachment: MemoAttachment | null) => void;
  attachment?: MemoAttachment | null;
  attachments?: MemoAttachment[];
  onAttachmentsChange?: (attachments: MemoAttachment[]) => void;
  allowMultiple?: boolean;
  maxAttachments?: number;
  compact?: boolean;
  appMode?: AppMode;
  onOpenSubscriptionModal?: () => void;
}

const isPdfItem = (item?: MemoAttachment | null): boolean =>
  Boolean(
    item?.mimeType?.includes('pdf') ||
      item?.dataUrl?.startsWith('data:application/pdf') ||
      item?.name?.toLowerCase().endsWith('.pdf')
  );

export const MemoScannerCard: React.FC<Props> = ({
  onMemoExtracted,
  onAttachmentChange,
  attachment,
  attachments,
  onAttachmentsChange,
  allowMultiple = false,
  maxAttachments = 4,
  compact = false,
  appMode = 'trial',
  onOpenSubscriptionModal,
}) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const limitToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAiLocked = appMode === 'normal';
  const isMultiMode = allowMultiple || attachments !== undefined || onAttachmentsChange !== undefined;

  const [isScanning, setIsScanning] = useState(false);
  const [localAttachment, setLocalAttachment] = useState<MemoAttachment | null>(null);
  const [localAttachments, setLocalAttachments] = useState<MemoAttachment[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [limitToast, setLimitToast] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'info' | 'pro_locked';
    text: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (limitToastTimerRef.current) {
        clearTimeout(limitToastTimerRef.current);
      }
    };
  }, []);

  const showLimitToast = (msg: string) => {
    setLimitToast(msg);
    if (limitToastTimerRef.current) {
      clearTimeout(limitToastTimerRef.current);
    }
    limitToastTimerRef.current = setTimeout(() => {
      setLimitToast('');
    }, 3500);
  };

  const effectiveAttachment = attachment !== undefined ? attachment : localAttachment;
  const effectiveAttachments: MemoAttachment[] = isMultiMode
    ? attachments !== undefined
      ? attachments
      : localAttachments
    : effectiveAttachment?.dataUrl
    ? [effectiveAttachment]
    : [];

  const updateAttachment = (next: MemoAttachment | null) => {
    setLocalAttachment(next);
    if (onAttachmentChange) {
      onAttachmentChange(next);
    }
  };

  const updateAttachmentsList = (nextList: MemoAttachment[]) => {
    const capped = nextList.slice(0, maxAttachments);
    setLocalAttachments(capped);
    if (onAttachmentsChange) {
      onAttachmentsChange(capped);
    }
    if (onAttachmentChange) {
      onAttachmentChange(capped[0] || null);
    }
  };

  const handleOpenCamera = () => {
    if (isScanning) return;
    if (isMultiMode && effectiveAttachments.length >= maxAttachments) {
      showLimitToast('সর্বোচ্চ ৪টি মেমোর ছবি যুক্ত করা যাবে');
      return;
    }
    setStatusMessage(null);
    cameraInputRef.current?.click();
  };

  const handleOpenGallery = () => {
    if (isScanning) return;
    if (isMultiMode && effectiveAttachments.length >= maxAttachments) {
      showLimitToast('সর্বোচ্চ ৪টি মেমোর ছবি যুক্ত করা যাবে');
      return;
    }
    setStatusMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles: File[] = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (pickedFiles.length === 0) return;

    // Legacy single-photo mode (e.g. BulkPurchaseManager)
    if (!isMultiMode) {
      const file = pickedFiles[0];
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
      return;
    }

    // Multi-photo mode (max 4 photos, strict Canvas compression, Smart Auto-Scan only when 1 total photo)
    const currentList = effectiveAttachments;
    const remainingSlots = Math.max(0, maxAttachments - currentList.length);

    if (remainingSlots === 0) {
      showLimitToast('সর্বোচ্চ ৪টি মেমোর ছবি যুক্ত করা যাবে');
      return;
    }

    let filesToProcess = pickedFiles;
    if (pickedFiles.length > remainingSlots) {
      showLimitToast('সর্বোচ্চ ৪টি মেমোর ছবি যুক্ত করা যাবে');
      filesToProcess = pickedFiles.slice(0, remainingSlots);
    }

    const willTotalCount = currentList.length + filesToProcess.length;
    setIsScanning(true);
    setStatusMessage(null);

    try {
      if (willTotalCount === 1 && filesToProcess.length === 1) {
        // Exactly 1 total photo -> Keep existing AI Auto-Scan active (respecting Pro/60-day trial)
        const outcome = await prepareAndScanMemoWithAI(filesToProcess[0], {
          skipAiScan: isAiLocked,
        });

        if (outcome.attachmentDataUrl) {
          updateAttachmentsList([
            {
              dataUrl: outcome.attachmentDataUrl,
              mimeType: outcome.attachmentMimeType,
              name: outcome.attachmentName,
            },
          ]);
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
                ? '📎 মেমোর ছবি যুক্ত হয়েছে। নেটওয়ার্ক ধীর/অফলাইন থাকায় নিচে নিজে টাকার অঙ্ক বসান।'
                : '📎 মেমোর ছবি যুক্ত হয়েছে। নিচের ঘরে নিজে হাতে টাকার অঙ্ক বসিয়ে সেভ করুন।',
          });
        }
      } else {
        // 2 to 4 photos -> Bypass AI Auto-Scan completely, compress & attach cleanly for manual entry
        const newlyAdded: MemoAttachment[] = [];
        for (const f of filesToProcess) {
          try {
            const compressed = await compressMemoFile(f);
            if (compressed.dataUrl) {
              newlyAdded.push({
                dataUrl: compressed.dataUrl,
                mimeType: compressed.mimeType,
                name: compressed.name,
              });
            }
          } catch (_) {
            // Skip unreadable individual file without aborting the batch
          }
        }

        const nextList = [...currentList, ...newlyAdded].slice(0, maxAttachments);
        updateAttachmentsList(nextList);

        if (newlyAdded.length > 0) {
          setStatusMessage({
            type: 'info',
            text: `📎 ${nextList.length}টি মেমোর ছবি যুক্ত হয়েছে — নিচের ঘরে নিজে টাকার অঙ্ক বসিয়ে সেভ করুন।`,
          });
        } else {
          setStatusMessage({
            type: 'info',
            text: '📎 ছবিগুলো লোড করতে সমস্যা হয়েছে, নিচে নিজে টাকার অঙ্ক বসিয়ে ক্রয় সেভ করতে পারবেন।',
          });
        }
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

  const handleRemoveAt = (index: number) => {
    const nextList = effectiveAttachments.filter((_, idx) => idx !== index);
    updateAttachmentsList(nextList);
    if (nextList.length === 0) {
      setStatusMessage(null);
      setShowPreviewModal(false);
    } else if (previewIndex >= nextList.length) {
      setPreviewIndex(nextList.length - 1);
    }
  };

  const isSinglePdf = !isMultiMode && isPdfItem(effectiveAttachment);
  const imageIndices = effectiveAttachments
    .map((att, idx) => (!isPdfItem(att) && Boolean(att.dataUrl) ? idx : -1))
    .filter((idx) => idx >= 0);
  const activePreviewItem = effectiveAttachments[previewIndex] || effectiveAttachments[0] || null;

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
          multiple={isMultiMode}
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
                : 'ছবি প্রস্তুত করা হচ্ছে, অপেক্ষা করুন...'}
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

        {/* Compact Horizontal 48x48 Thumbnail Strip Inside the Dark Card (Zero Vertical Bloat) */}
        {isMultiMode && effectiveAttachments.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5">
            {effectiveAttachments.map((att, idx) => {
              const isPdf = isPdfItem(att);
              return (
                <div key={`${att.name || 'memo'}_${idx}`} className="relative w-12 h-12 shrink-0">
                  {isPdf ? (
                    <div
                      className="w-12 h-12 rounded-xl bg-white/15 border border-white/25 flex flex-col items-center justify-center text-white"
                      title={att.name || 'PDF ফাইল'}
                    >
                      <FileText className="w-4 h-4 text-sky-300" />
                      <span className="text-[8px] font-bold mt-0.5">PDF</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewIndex(idx);
                        setShowPreviewModal(true);
                      }}
                      className="w-12 h-12 rounded-xl overflow-hidden border border-emerald-300/80 bg-white block cursor-pointer focus:outline-none hover:opacity-90 transition"
                      title={`মেমো #${idx + 1} বড় করে দেখুন`}
                    >
                      <img
                        src={att.dataUrl}
                        alt={`মেমো ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAt(idx);
                    }}
                    aria-label="ছবি সরান"
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xs border border-slate-900 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5 stroke-[3]" />
                  </button>
                </div>
              );
            })}
            <span className="text-[10px] font-extrabold text-slate-300 ml-auto shrink-0 px-1">
              {effectiveAttachments.length}/{maxAttachments}
            </span>
          </div>
        )}

        {/* Brief Max-4 Warning Toast */}
        {limitToast && (
          <div className="px-2.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1.5 animate-in fade-in duration-150">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
            <span>{limitToast}</span>
          </div>
        )}
      </div>

      {/* Legacy Single-Attachment Receipt Preview Chip (used only when allowMultiple is false) */}
      {!isMultiMode && effectiveAttachment?.dataUrl && (
        <div className="px-2.5 py-2 rounded-xl bg-[#F0FDF4] border border-emerald-200 flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div
            onClick={() => !isSinglePdf && setShowPreviewModal(true)}
            className={`flex items-center gap-2 min-w-0 flex-1 ${
              !isSinglePdf ? 'cursor-pointer' : ''
            }`}
          >
            {isSinglePdf ? (
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
            {!isSinglePdf && (
              <button
                type="button"
                onClick={() => {
                  setPreviewIndex(0);
                  setShowPreviewModal(true);
                }}
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
          className="w-full text-left px-3 py-2 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 text-amber-950 text-[11px] font-extrabold flex items-center gap-2 shadow-2xs transition active:scale-[0.99] cursor-pointer animate-in fade-in duration-150"
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

      {/* Fullscreen Memo Image Preview Modal (supports multi-photo prev/next cycling) */}
      {showPreviewModal && activePreviewItem?.dataUrl && !isPdfItem(activePreviewItem) && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 p-3 sm:p-6 flex flex-col items-center justify-center backdrop-blur-xs"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="w-full max-w-lg md:max-w-xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2.5 bg-[#0F172A] text-white flex items-center justify-between gap-2">
              <span className="text-xs font-bold truncate">
                সংযুক্ত মেমো / রসিদের ছবি
                {imageIndices.length > 1
                  ? ` (${imageIndices.indexOf(previewIndex) + 1}/${imageIndices.length})`
                  : ''}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {imageIndices.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const pos = imageIndices.indexOf(previewIndex);
                        const prevPos = (pos - 1 + imageIndices.length) % imageIndices.length;
                        setPreviewIndex(imageIndices[prevPos]);
                      }}
                      className="p-1 rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                      title="আগের ছবি"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const pos = imageIndices.indexOf(previewIndex);
                        const nextPos = (pos + 1) % imageIndices.length;
                        setPreviewIndex(imageIndices[nextPos]);
                      }}
                      className="p-1 rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                      title="পরের ছবি"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1 rounded-full hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-900 p-2 flex items-center justify-center">
              <img
                src={activePreviewItem.dataUrl}
                alt={`সংযুক্ত মেমোর ছবি ${previewIndex + 1}`}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
