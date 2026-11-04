import React from 'react';
import { SubscriptionInfo, Language } from '../types';
import { getSubscriptionDetails } from '../utils/license';
import { Sparkles, AlertTriangle, Clock, ArrowRight, ShieldAlert } from 'lucide-react';

interface Props {
  subscription: SubscriptionInfo;
  language: Language;
  onOpenSubscriptionModal: (preferredPlan?: 'monthly' | 'yearly') => void;
}

export const TrialBanner: React.FC<Props> = ({
  subscription,
  language,
  onOpenSubscriptionModal,
}) => {
  const details = getSubscriptionDetails(subscription);

  // If active Pro with plenty of days, or trial with > 3 days left, do not clutter
  if (details.mode === 'pro' && !details.isExpiringSoon) {
    return null;
  }
  if (details.mode === 'trial' && !details.isExpiringSoon) {
    return null;
  }

  // 1. Expired / Normal Mode Banner
  if (details.mode === 'normal') {
    return (
      <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-rose-700 text-white px-3 sm:px-4 py-3 shadow-md border-b border-rose-800 animate-in fade-in duration-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-xl bg-white/20 shrink-0 mt-0.5 backdrop-blur-sm">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-snug">
                {language === 'bn'
                  ? 'আপনার ৬০ দিনের ফ্রি ট্রায়াল শেষ হয়েছে (Normal Mode)'
                  : 'Your 60-day free trial has expired (Normal Mode)'}
              </h3>
              <p className="text-xs text-amber-100 mt-0.5 leading-relaxed">
                {language === 'bn'
                  ? 'আপনার পুরোনো সকল তথ্য ও বাকি খাতা নিরাপদে সংরক্ষিত আছে। নতুন প্রোডাক্ট যোগ, বারকোড স্ক্যান, বিক্রি ও অন্যান্য Pro সুবিধা চালু করতে আপনার পছন্দের সাবস্ক্রিপশন নিন।'
                  : 'All your past products, sales, and due ledger remain securely accessible. Upgrade to Pro to resume adding products, barcode scanning, and full selling features.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
            <button
              onClick={() => onOpenSubscriptionModal('monthly')}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/30 transition active:scale-95"
            >
              মাসিক ৯৯৳
            </button>
            <button
              onClick={() => onOpenSubscriptionModal('yearly')}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/30 transition active:scale-95"
            >
              বার্ষিক ৭৯৯৳
            </button>
            <button
              onClick={() => onOpenSubscriptionModal()}
              className="px-4 py-2 rounded-xl bg-white text-rose-800 hover:bg-amber-50 font-black text-xs sm:text-sm shadow-md transition active:scale-95 flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-600 fill-amber-500" />
              <span>{language === 'bn' ? 'Pro চালু করুন' : 'Upgrade to Pro'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Trial Last Day / Expiring Soon Banner (<= 3 days)
  if (details.isExpiringSoon) {
    const isToday = details.isLastDay;
    return (
      <div className={`text-white px-3 sm:px-4 py-2.5 shadow-md border-b ${
        isToday
          ? 'bg-gradient-to-r from-rose-700 via-amber-600 to-rose-800 border-rose-900'
          : 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 border-amber-800'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-200 animate-pulse shrink-0" />
            <p className="text-xs sm:text-sm font-semibold">
              {isToday
                ? (language === 'bn'
                    ? '⚠️ আপনার ফ্রি ট্রায়ালের আজই শেষ দিন! নিরবচ্ছিন্ন সেবা পেতে এখনই প্যাকেজ বেছে নিন।'
                    : '⚠️ Today is the last day of your free trial! Choose a package to keep uninterrupted Pro features.')
                : (language === 'bn'
                    ? `⚠️ আপনার ৬০ দিনের ট্রায়ালের আর মাত্র ${details.daysRemaining} দিন বাকি আছে! এখনই Pro সাবস্ক্রিপশন নিশ্চিত করুন।`
                    : `⚠️ Only ${details.daysRemaining} days remaining in your 60-day trial! Subscribe to Pro now.`)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenSubscriptionModal()}
              className="px-3.5 py-1.5 rounded-xl bg-white text-slate-900 hover:bg-amber-50 font-bold text-xs shadow transition active:scale-95 flex items-center gap-1"
            >
              <span>{language === 'bn' ? 'প্যাকেজ দেখুন' : 'View Plans'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
