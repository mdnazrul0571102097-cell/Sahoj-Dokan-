import React, { useState } from 'react';
import { ShopProfile, Language } from '../types';
import { translations } from '../i18n/translations';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { SubscriptionInfo } from '../types';
import { getSubscriptionDetails } from '../utils/license';
import {
  Download,
  Languages,
  Crown,
  MessageCircle,
  User,
  Sparkles,
  ExternalLink,
  X,
} from 'lucide-react';

interface Props {
  profile: ShopProfile;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onLock: () => void;
  onOpenLanguageModal: () => void;
  subscription?: SubscriptionInfo;
  onOpenSubscriptionModal?: () => void;
  onOpenAdminPanel?: () => void;
}

export const Header: React.FC<Props> = ({
  profile,
  language,
  onLanguageChange,
  onLock,
  onOpenLanguageModal,
  subscription,
  onOpenSubscriptionModal,
  onOpenAdminPanel,
}) => {
  const t = translations[language];
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const subDetails = subscription ? getSubscriptionDetails(subscription) : null;

  const handleOpenExternalLink = (url: string) => {
    setShowSupportModal(false);
    if (typeof window !== 'undefined' && (window as any).AndroidApp?.openWhatsApp) {
      try {
        (window as any).AndroidApp.openWhatsApp(url);
        return;
      } catch (_) {}
    }
    try {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (_) {}
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white text-[#102A43] shadow-xs border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2">
          {/* Left: Logo & Shop Identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0 w-10 h-10 rounded-[14px] overflow-hidden bg-[#E0F2F1] p-1 border border-[#B2DFDB] flex items-center justify-center">
              <img
                src={profile.logo || '/assets/icon.png'}
                alt="Sahoj Dokan Logo"
                className="w-full h-full object-contain rounded-[10px]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/icon.png';
                }}
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-base sm:text-lg leading-tight tracking-tight text-[#102A43] whitespace-nowrap">
                Sahoj Dokan
              </h1>
              <p className="text-[10px] sm:text-[11px] font-semibold text-[#0E6B6B] truncate">
                {profile.shopName && profile.shopName !== 'Sahoj Dokan' ? profile.shopName : 'ডিজিটাল ক্যাশ খাতা'}
              </p>
            </div>
          </div>

          {/* Right: OWNER Badge & Support Button (Right-aligned next to each other) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Install PWA Button if available on desktop */}
            {isInstallable && !isInstalled && (
              <button
                onClick={install}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] text-xs font-bold border border-[#B2DFDB] transition active:scale-95"
                title="Install Sahoj Dokan App"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'ইন্সটল' : 'Install'}</span>
              </button>
            )}

            {/* Minimal & Sleek Subscription Status Badge placed right next to Support */}
            {subDetails && onOpenSubscriptionModal && (
              <button
                type="button"
                onClick={onOpenSubscriptionModal}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-black shadow-2xs transition active:scale-95 cursor-pointer ${
                  subDetails.badgeText === '👑 OWNER' || subscription?.isOwner
                    ? 'bg-amber-400 text-slate-950 border border-amber-500/50'
                    : 'bg-[#E0F2F1] text-[#0E6B6B] border border-[#B2DFDB]'
                }`}
                title="সাবস্ক্রিপশন ও লাইসেন্স বিবরণ"
              >
                {subDetails.badgeText === '👑 OWNER' || subscription?.isOwner ? (
                  <>
                    <Crown className="w-3.5 h-3.5 fill-current" />
                    <span>OWNER</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#0E6B6B]" />
                    <span>PRO</span>
                  </>
                )}
              </button>
            )}

            {/* Support Button (Opens WhatsApp & Facebook Options) */}
            <button
              type="button"
              onClick={() => setShowSupportModal(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-[#E8F5E9] hover:bg-[#C8E6C9] text-[#2E7D32] text-xs font-bold border border-[#A5D6A7] transition active:scale-95 cursor-pointer shadow-2xs"
              title="সহায়তা ও সাপোর্ট"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-current text-[#2E7D32]" />
              <span className="text-xs font-bold">সাপোর্ট</span>
            </button>
          </div>
        </div>
      </header>

      {/* iOS Install Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#102A43]">
              {language === 'bn' ? 'আইফোনে ইন্সটল করার নিয়ম' : 'Install on iPhone / iPad'}
            </h3>
            <div className="mt-3 text-xs text-[#64748B] space-y-2 leading-relaxed">
              <p>১. Safari ব্রাউজারের নিচে <strong>Share (শেয়ার)</strong> বাটনে চাপুন।</p>
              <p>২. নিচে স্ক্রল করে <strong>Add to Home Screen (হোম স্ক্রিনে যোগ করুন)</strong> নির্বাচন করুন।</p>
              <p>৩. এরপর অ্যাপটি সবসময় ইন্টারনেট ছাড়া অফলাইনে এক ক্লিকে খুলবে।</p>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#0E6B6B] text-white text-xs font-bold hover:bg-[#0B5656]"
            >
              {language === 'bn' ? 'বুঝেছি' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Support Modal (WhatsApp & Facebook) */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#102A43]">
                    সহায়তা ও যোগাযোগ
                  </h3>
                  <p className="text-[11px] text-[#64748B]">সহজ দোকান কাস্টমার সাপোর্ট</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="w-8 h-8 rounded-full bg-[#EDF2F7] hover:bg-slate-200 text-[#64748B] flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#64748B] mt-3 mb-4 leading-relaxed">
              আপনার যেকোনো প্রশ্ন, সমস্যা বা পরামর্শের জন্য আমাদের সাথে নিচের মাধ্যমে যুক্ত হতে পারেন:
            </p>

            <div className="space-y-3">
              {/* Option 1: WhatsApp Group & Direct Chat */}
              <button
                type="button"
                onClick={() =>
                  handleOpenExternalLink(
                    'https://chat.whatsapp.com/DuhyPtXqF4fBzfvGZoGt1W?s=cl&p=a&mlu=4&ilr=4&iam=2'
                  )
                }
                className="w-full text-left group flex items-center justify-between p-3.5 rounded-2xl bg-[#E8F5E9] hover:bg-[#C8E6C9] border border-[#A5D6A7] transition active:scale-[0.98] shadow-2xs cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#2E7D32] text-white flex items-center justify-center shadow-xs shrink-0">
                    <MessageCircle className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#102A43]">
                      হোয়াটসঅ্যাপ গ্রুপ ও সাপোর্ট
                    </h4>
                    <p className="text-[11px] text-[#2E7D32] font-medium mt-0.5">
                      সরাসরি গ্রুপে যুক্ত হন ও মেসেজ দিন
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-[#2E7D32] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>

              {/* Option 2: Facebook Page */}
              <button
                type="button"
                onClick={() =>
                  handleOpenExternalLink('https://www.facebook.com/share/19E8zGc9s5/')
                }
                className="w-full text-left group flex items-center justify-between p-3.5 rounded-2xl bg-[#E7F3FF] hover:bg-[#D0E7FF] border border-[#B3D7FF] transition active:scale-[0.98] shadow-2xs cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#1877F2] text-white flex items-center justify-center shadow-xs shrink-0">
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#102A43]">
                      ফেসবুক পেইজ
                    </h4>
                    <p className="text-[11px] text-[#1877F2] font-medium mt-0.5">
                      আমাদের অফিসিয়াল পেইজে যোগ দিন
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-[#1877F2] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSupportModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#EDF2F7] hover:bg-slate-200 text-[#102A43] text-xs font-bold transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}
    </>
  );
};
