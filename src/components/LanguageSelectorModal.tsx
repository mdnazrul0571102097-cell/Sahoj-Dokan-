import React from 'react';
import { Language } from '../types';
import { translations } from '../i18n/translations';
import { Check, Languages, Sparkles } from 'lucide-react';

interface Props {
  currentLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
  isInitialSetup?: boolean;
  onClose?: () => void;
}

export const LanguageSelectorModal: React.FC<Props> = ({
  currentLanguage,
  onSelectLanguage,
  isInitialSetup = false,
  onClose,
}) => {
  const t = translations[currentLanguage];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-emerald-100 dark:bg-slate-900 dark:border-emerald-900/40">
        {/* Header with App Branding */}
        <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-900 p-6 text-center text-white relative">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 p-1.5 shadow-inner backdrop-blur-md border border-white/20">
            <img
              src="/assets/aistudio/file_000000004a3c81f5869dca542232e290_f5f4ef0c.png"
              alt="Sahoj Dokan POS"
              className="h-full w-full object-contain drop-shadow"
            />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sahoj Dokan POS</h2>
          <p className="text-emerald-100 text-sm mt-1">সহজ দোকান পয়েন্ট অব সেল</p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-2 border border-emerald-200">
              <Languages className="w-3.5 h-3.5" />
              <span>Language / ভাষা</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              ভাষা নির্বাচন করুন
            </h3>
            <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
              অ্যাপটি বাংলায় ব্যবহার করতে চান নাকি ইংরেজিতে?
            </p>
          </div>

          <div className="space-y-3">
            {/* Bengali Option */}
            <button
              onClick={() => onSelectLanguage('bn')}
              className={`w-full group flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                currentLanguage === 'bn'
                  ? 'border-emerald-600 bg-emerald-50/80 shadow-md ring-2 ring-emerald-500/20 dark:bg-emerald-950/30'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white font-bold text-xl flex items-center justify-center shadow-sm">
                  বাং
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-slate-800 dark:text-white">
                      বাংলা (বাংলাদেশী ভার্সন)
                    </span>
                    <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      প্রস্তাবিত
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    সহজ বাংলা শব্দ, টাকার প্রতীক ৳ ও স্পষ্ট হিসাব
                  </p>
                </div>
              </div>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                  currentLanguage === 'bn'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'border-slate-300 bg-white dark:bg-slate-700'
                }`}
              >
                {currentLanguage === 'bn' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </button>

            {/* English Option */}
            <button
              onClick={() => onSelectLanguage('en')}
              className={`w-full group flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                currentLanguage === 'en'
                  ? 'border-emerald-600 bg-emerald-50/80 shadow-md ring-2 ring-emerald-500/20 dark:bg-emerald-950/30'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-xl bg-slate-700 text-white font-bold text-xl flex items-center justify-center shadow-sm">
                  EN
                </div>
                <div>
                  <span className="font-bold text-lg text-slate-800 dark:text-white">
                    English
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Standard English POS interface and receipts
                  </p>
                </div>
              </div>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                  currentLanguage === 'en'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'border-slate-300 bg-white dark:bg-slate-700'
                }`}
              >
                {currentLanguage === 'en' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => {
                if (onClose) onClose();
              }}
              className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-semibold rounded-2xl shadow-lg shadow-emerald-700/25 transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {currentLanguage === 'bn' ? 'এপ্সে প্রবেশ করুন' : 'Continue into App'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
