import React, { useMemo, useState } from 'react';
import { ShopNote } from '../types';
import {
  ArrowLeft,
  Check,
  NotebookPen,
  Pin,
  Search,
  Share2,
  Trash2,
  X,
  Clock,
  MessageCircle,
  Pencil,
} from 'lucide-react';

interface Props {
  notes: ShopNote[];
  shopName?: string;
  onAddNote: (content: string) => void;
  onUpdateNote: (id: string, content: string) => void;
  onToggleComplete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onBackToMenu: () => void;
}

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const BANGLA_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const toBanglaDigits = (val: string | number): string =>
  String(val).replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);

const formatBanglaDateTime = (iso: string): string => {
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return '';
    const day = toBanglaDigits(dt.getDate());
    const month = BANGLA_MONTHS[dt.getMonth()] || '';
    const year = toBanglaDigits(dt.getFullYear());

    const hour24 = dt.getHours();
    const minute = String(dt.getMinutes()).padStart(2, '0');
    let period = 'রাত';
    if (hour24 >= 5 && hour24 < 12) period = 'সকাল';
    else if (hour24 >= 12 && hour24 < 15) period = 'দুপুর';
    else if (hour24 >= 15 && hour24 < 18) period = 'বিকাল';
    else if (hour24 >= 18 && hour24 < 20) period = 'সন্ধ্যা';

    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const timeStr = `${period} ${toBanglaDigits(hour12)}:${toBanglaDigits(minute)}`;
    return `${day} ${month} ${year} • ${timeStr}`;
  } catch {
    return '';
  }
};

const PASTEL_STYLES = [
  'bg-[#F0FDFA] border-[#B2DFDB]',
  'bg-[#EFF6FF] border-[#BFDBFE]',
  'bg-[#F5F3FF] border-[#DDD6FE]',
  'bg-[#FDF2F8] border-[#FBCFE8]',
];

export const ShopNotebookView: React.FC<Props> = ({
  notes,
  shopName = 'সহজ দোকান',
  onAddNote,
  onUpdateNote,
  onToggleComplete,
  onTogglePin,
  onDeleteNote,
  onBackToMenu,
}) => {
  const [noteInput, setNoteInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [shareFallbackNote, setShareFallbackNote] = useState<{
    id: string;
    text: string;
    copied: boolean;
  } | null>(null);

  const handleSaveEdit = (id: string) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    onUpdateNote(id, trimmed);
    setEditingNoteId(null);
    setEditingText('');
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = noteInput.trim();
    if (!trimmed) return;
    onAddNote(trimmed);
    setNoteInput('');
  };

  const filteredAndSortedNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? notes.filter((n) => (n.content || '').toLowerCase().includes(q))
      : notes;

    return [...filtered].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notes, searchQuery]);

  const handleShareNote = async (note: ShopNote) => {
    const dateLine = formatBanglaDateTime(note.createdAt);
    const shareText = `📒 ${shopName} — নোট\n${dateLine ? `🕒 ${dateLine}\n` : ''}\n${note.content}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${shopName} - দোকানের নোট`,
          text: shareText,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // Fallback for desktop / WebViews without navigator.share: copy to clipboard + offer WhatsApp link
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = shareText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }

    setShareFallbackNote({ id: note.id, text: shareText, copied });
  };

  return (
    <div className="min-h-[calc(100vh-110px)] flex flex-col p-2.5 sm:p-3 max-w-4xl md:max-w-5xl md:mx-auto md:w-full mx-auto pb-20 lg:pb-8 space-y-3">
      {/* Top Bar */}
      <div className="bg-white rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2 border border-[#E2E8F0] shadow-2xs shrink-0">
        <button
          type="button"
          onClick={onBackToMenu}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] font-extrabold text-xs sm:text-sm transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>হিসাব / মেনু</span>
        </button>

        <div className="flex items-center gap-1.5">
          <NotebookPen className="w-4 h-4 text-[#0E6B6B] shrink-0" />
          <h2 className="text-sm sm:text-base font-black text-[#102A43]">
            দোকানের নোটবুক
          </h2>
        </div>

        <span className="text-xs font-extrabold text-[#64748B] tabular-nums px-2">
          {toBanglaDigits(notes.length)} টি
        </span>
      </div>

      {/* Top Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="নোট খুঁজুন..."
          className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white border border-[#E2E8F0] text-sm font-semibold text-[#102A43] placeholder:text-[#94A3B8] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="খোঁজা মুছুন"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Single Clean Multi-Line Input Composer */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-[22px] p-3.5 sm:p-4 border border-[#E2E8F0] shadow-2xs space-y-2.5"
      >
        <textarea
          rows={3}
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            }
          }}
          placeholder="এখানে আপনার জরুরি নোট লিখুন..."
          className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm sm:text-base font-medium text-[#102A43] placeholder:text-[#94A3B8] resize-none focus:outline-none focus:ring-2 focus:ring-[#0E6B6B] focus:bg-white transition"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[#64748B]">
            দোকানের প্রয়োজনীয় কথা, অর্ডার লিস্ট বা হিসাব লিখে রাখুন
          </span>
          <button
            type="submit"
            disabled={!noteInput.trim()}
            className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition active:scale-95 shrink-0 ${
              noteInput.trim()
                ? 'bg-[#0E6B6B] hover:bg-[#094747] text-white shadow-xs cursor-pointer'
                : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
            }`}
          >
            সেভ করুন
          </button>
        </div>
      </form>

      {/* Notes List */}
      {filteredAndSortedNotes.length === 0 ? (
        <div className="bg-white rounded-[22px] p-8 border border-[#E2E8F0] text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#FFFBEB] text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <NotebookPen className="w-6 h-6" />
          </div>
          <p className="text-sm font-extrabold text-[#102A43]">
            {searchQuery.trim()
              ? 'খোঁজা অনুযায়ী কোনো নোট পাওয়া যায়নি'
              : 'এখনো কোনো নোট লেখা হয়নি'}
          </p>
          <p className="text-xs text-[#64748B]">
            {searchQuery.trim()
              ? 'অন্য কোনো শব্দ দিয়ে খুঁজে দেখুন।'
              : 'উপরের বক্সে দোকানের যেকোনো জরুরি নোট লিখে "সেভ করুন" চাপুন।'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAndSortedNotes.map((note, idx) => {
            const cardTone = note.isCompleted
              ? 'bg-[#F8FAFC] border-[#E2E8F0] opacity-85'
              : note.isPinned
              ? 'bg-[#FFFBEB] border-amber-300 shadow-xs'
              : PASTEL_STYLES[idx % PASTEL_STYLES.length];

            const isDeleting = confirmDeleteId === note.id;
            const isEditing = editingNoteId === note.id;
            const isSharingFallback = shareFallbackNote?.id === note.id;

            return (
              <div
                key={note.id}
                className={`rounded-[20px] p-3.5 sm:p-4 border transition space-y-2.5 ${cardTone}`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Check / Complete Circle Toggle */}
                  <button
                    type="button"
                    onClick={() => onToggleComplete(note.id)}
                    aria-label={note.isCompleted ? 'অসম্পূর্ণ করুন' : 'সম্পন্ন করুন'}
                    className="min-w-[36px] min-h-[36px] -ml-1 -mt-1 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <span
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                        note.isCompleted
                          ? 'bg-[#0E6B6B] border-[#0E6B6B] text-white'
                          : 'bg-white border-[#94A3B8] hover:border-[#0E6B6B] text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  </button>

                  {/* Note Text or Inline Edit Box */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(note.id);
                            }
                          }}
                          autoFocus
                          placeholder="নোটের লেখা লিখুন..."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#0E6B6B] text-sm sm:text-[15px] font-medium text-[#102A43] resize-none focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingText('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white border border-[#CBD5E1] text-xs font-bold text-[#475569] cursor-pointer"
                          >
                            বাতিল
                          </button>
                          <button
                            type="button"
                            disabled={!editingText.trim()}
                            onClick={() => handleSaveEdit(note.id)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition ${
                              editingText.trim()
                                ? 'bg-[#0E6B6B] hover:bg-[#094747] text-white cursor-pointer'
                                : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                            }`}
                          >
                            আপডেট সেভ করুন
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className={`text-sm sm:text-[15px] font-semibold leading-relaxed whitespace-pre-wrap break-words ${
                          note.isCompleted
                            ? 'line-through text-[#64748B]'
                            : 'text-[#102A43]'
                        }`}
                      >
                        {note.content}
                      </p>
                    )}
                  </div>

                  {/* Pin to Top Toggle */}
                  <button
                    type="button"
                    onClick={() => onTogglePin(note.id)}
                    aria-label={note.isPinned ? 'পিন সরান' : 'উপরে পিন করুন'}
                    title={note.isPinned ? 'পিন সরান' : 'উপরে পিন করুন'}
                    className={`min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center transition shrink-0 cursor-pointer ${
                      note.isPinned
                        ? 'bg-amber-200/80 text-amber-900 border border-amber-300'
                        : 'bg-white/80 hover:bg-white text-[#64748B] border border-black/5'
                    }`}
                  >
                    <Pin className={`w-4 h-4 ${note.isPinned ? 'fill-amber-700' : ''}`} />
                  </button>
                </div>

                {/* Bottom Meta & Actions Row */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-black/5">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#64748B]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{formatBanglaDateTime(note.createdAt)}</span>
                    </span>
                    {note.isPinned && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-800 font-extrabold">📌 পিন করা</span>
                      </>
                    )}
                    {note.isCompleted && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#0E6B6B] font-extrabold">✓ সম্পন্ন</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(null);
                        setShareFallbackNote(null);
                        if (isEditing) {
                          setEditingNoteId(null);
                          setEditingText('');
                        } else {
                          setEditingNoteId(note.id);
                          setEditingText(note.content);
                        }
                      }}
                      className={`h-8 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                        isEditing
                          ? 'bg-[#0E6B6B] border-[#0E6B6B] text-white'
                          : 'bg-white hover:bg-[#E0F2F1] border-[#CBD5E1] hover:border-[#80CBC4] text-[#102A43]'
                      }`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>এডিট</span>
                    </button>

                    {/* One-Tap Share Button */}
                    <button
                      type="button"
                      onClick={() => handleShareNote(note)}
                      className="h-8 px-3 rounded-xl bg-white hover:bg-[#E0F2F1] border border-[#CBD5E1] hover:border-[#80CBC4] text-[#0E6B6B] text-xs font-extrabold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>শেয়ার</span>
                    </button>

                    {/* Delete Icon */}
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDeleteId((prev) => (prev === note.id ? null : note.id))
                      }
                      aria-label="নোট মুছুন"
                      title="নোট মুছুন"
                      className="w-8 h-8 rounded-xl bg-white hover:bg-rose-50 border border-[#CBD5E1] hover:border-rose-300 text-[#D32F2F] inline-flex items-center justify-center transition active:scale-95 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Share Fallback Bar (if navigator.share isn't available on desktop/older WebView) */}
                {isSharingFallback && shareFallbackNote && (
                  <div className="p-2.5 rounded-xl bg-white border border-[#B2DFDB] flex items-center justify-between gap-2 flex-wrap text-xs">
                    <span className="font-bold text-[#0E6B6B]">
                      {shareFallbackNote.copied
                        ? '✓ নোটটি কপি হয়েছে! এখন WhatsApp বা মেসেঞ্জারে পাঠান:'
                        : 'WhatsApp-এ পাঠান:'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(shareFallbackNote.text)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1EBE5D] text-white font-extrabold inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setShareFallbackNote(null)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#F1F5F9] text-[#475569] font-bold cursor-pointer"
                      >
                        বন্ধ
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Delete Confirmation Prompt */}
                {isDeleting && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2 flex-wrap text-xs">
                    <span className="font-extrabold text-[#D32F2F]">
                      এই নোটটি কি স্থায়ীভাবে মুছে ফেলবেন?
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteNote(note.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#D32F2F] hover:bg-[#B71C1C] text-white font-extrabold cursor-pointer"
                      >
                        হ্যাঁ, মুছুন
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#CBD5E1] text-[#475569] font-bold cursor-pointer"
                      >
                        বাতিল
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
