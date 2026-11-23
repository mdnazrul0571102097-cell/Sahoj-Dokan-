import React, { useState } from 'react';
import { ShopProfile, Language } from '../types';
import { translations } from '../i18n/translations';
import {
  Lock,
  Phone,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Delete,
  ArrowLeft,
  ShieldCheck,
  Save,
  CloudDownload,
  RefreshCw,
} from 'lucide-react';
import { CloudSync } from '../services/cloudSync';
import { DB } from '../storage/db';

interface Props {
  profile: ShopProfile;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onSaveProfile: (profile: ShopProfile) => void;
  onUnlock: () => void;
  isRegistered: boolean;
  onDataRestored?: () => void;
}

export const AuthModal: React.FC<Props> = ({
  profile,
  language,
  onLanguageChange,
  onSaveProfile,
  onUnlock,
  isRegistered,
  onDataRestored,
}) => {
  const t = translations[language];

  // Active view: 'phone_login' (unified onboarding/login) | 'unlock' | 'forgot_pin'
  const [mode, setMode] = useState<'unlock' | 'phone_login' | 'forgot_pin'>(
    isRegistered && (profile.pinEnabled || profile.isPinLockEnabled) && (profile.appLockPin || profile.pin)
      ? 'unlock'
      : 'phone_login'
  );

  // Unified Phone Login & Instant Onboarding State (Smart Cloud-Aware)
  const [loginPhone, setLoginPhone] = useState(
    profile.phone || (typeof localStorage !== 'undefined' ? localStorage.getItem('sd_registered_phone') || '' : '')
  );
  const [loginPin, setLoginPin] = useState('');
  const [showLoginPinStep, setShowLoginPinStep] = useState(false);
  const [loginShopNameHint, setLoginShopNameHint] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRestoringCloud, setIsRestoringCloud] = useState(false);

  // Unlock PIN State
  const [enteredPin, setEnteredPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isWrongPin, setIsWrongPin] = useState(false);

  // Forgot PIN State (supports both local App Lock unlock and Cloud Login Case B)
  const [forgotOrigin, setForgotOrigin] = useState<'unlock' | 'phone_login'>('unlock');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [isProcessingForgot, setIsProcessingForgot] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  // Execute cloud restore with cloud-aware PIN handling
  const handleExecuteCloudRestore = async (phoneToRestore: string, pinToCheck?: string) => {
    setIsRestoringCloud(true);
    setLoginError('');
    try {
      const cleanPin = (pinToCheck || '').trim();
      const res = await CloudSync.restoreFromCloud(phoneToRestore, cleanPin || undefined);
      if (res.success) {
        try {
          await CloudSync.ensurePermanentTrial(phoneToRestore);
        } catch (_) {}
        if (onDataRestored) {
          onDataRestored();
        }
        onUnlock();
      } else if (res.requiresPin) {
        // Cloud account has PIN Lock explicitly enabled -> reveal PIN step
        setMode('phone_login');
        setLoginPhone(phoneToRestore);
        setShowLoginPinStep(true);
        setLoginError(cleanPin ? res.message : '');
      } else {
        setLoginError(res.message);
      }
    } catch (err: any) {
      const msg = 'ক্লাউড থেকে তথ্য পুনরুদ্ধারে ত্রুটি: ' + err.message;
      setLoginError(msg);
    } finally {
      setIsRestoringCloud(false);
      setIsLoggingIn(false);
    }
  };

  // Unified Mobile Number Action (Existing User -> Restore/PIN | New User -> Auto-Create & Enter Home)
  const handlePhoneLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedPhone = loginPhone.trim();
    const clean = trimmedPhone.replace(/\D/g, '');
    if (clean.length < 10) {
      setLoginError('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।');
      return;
    }

    // Step 2: PIN box is already revealed (Existing user with PIN Lock enabled) -> verify PIN and restore
    if (showLoginPinStep) {
      const cleanPin = loginPin.trim();
      if (cleanPin.length !== 4) {
        setLoginError('আপনার অ্যাকাউন্টের ৪ সংখ্যার পিন নম্বর লিখুন।');
        return;
      }
      setIsLoggingIn(true);
      await handleExecuteCloudRestore(trimmedPhone, cleanPin);
      return;
    }

    // Step 1: Check shop record in Firebase
    setIsLoggingIn(true);
    try {
      const checkRes = await CloudSync.checkCloudBackup(trimmedPhone);

      // (a) Existing number in Firebase -> keep exact current PIN & restore behavior
      if (checkRes.hasCloudData) {
        const isCloudPinLocked = Boolean(
          checkRes.pinEnabled === true ||
            checkRes.profile?.pinEnabled === true ||
            checkRes.profile?.isPinLockEnabled === true
        );

        if (isCloudPinLocked) {
          // Existing user with PIN Lock enabled -> prompt for 4-digit PIN + Forget PIN
          setLoginShopNameHint(checkRes.profile?.shopName || '');
          setShowLoginPinStep(true);
          setLoginPin('');
          setLoginError('');
          setIsLoggingIn(false);
          return;
        }

        // Existing user without PIN Lock -> load all existing shop data and go straight to Home
        await handleExecuteCloudRestore(trimmedPhone);
        return;
      }

      // (b) New number (not in Firebase) -> auto-create profile with defaults & go directly to Home
      try {
        await CloudSync.ensurePermanentTrial(trimmedPhone);
      } catch (_) {}

      const newShopProfile: ShopProfile = {
        ...DB.getProfile(),
        shopName: 'আমার দোকান',
        ownerName: '',
        phone: trimmedPhone,
        email: '',
        address: '',
        pin: '1234',
        pinEnabled: false,
        appLockPin: '',
        isPinLockEnabled: false,
        isRegistered: true,
        language: language,
      };

      onSaveProfile(newShopProfile);
      DB.saveProfile(newShopProfile);
      // Sync new user record to Firebase immediately in background without blocking entry
      CloudSync.syncNow().catch(() => {});

      if (onDataRestored) {
        onDataRestored();
      }
      setIsLoggingIn(false);
      onUnlock();
    } catch (err: any) {
      setLoginError('লগইন যাচাই করতে সমস্যা হয়েছে: ' + (err?.message || 'আবার চেষ্টা করুন'));
      setIsLoggingIn(false);
    }
  };

  // Helper to normalize Bangladeshi phone numbers for robust matching
  const normalizePhone = (num: string) => {
    const digits = num.replace(/\D/g, '');
    if (digits.length > 11 && digits.startsWith('880')) {
      return digits.slice(2);
    }
    return digits;
  };

  // Handle Numeric Keypad input during Unlock
  const handleKeypadPress = (num: string) => {
    if (enteredPin.length < 4) {
      const next = enteredPin + num;
      setEnteredPin(next);
      setUnlockError('');
      setIsWrongPin(false);

      if (next.length === 4) {
        const activeLockPin = profile.appLockPin || profile.pin;
        if (next === activeLockPin) {
          onUnlock();
        } else {
          setIsWrongPin(true);
          setUnlockError(t.wrongPin);
          setTimeout(() => {
            setEnteredPin('');
            setIsWrongPin(false);
          }, 700);
        }
      }
    }
  };

  const handleKeypadBackspace = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setUnlockError('');
    setIsWrongPin(false);
  };

  // Step 1: Verify Registered Phone in Forgot PIN (works for both local App Lock & Cloud Mobile Login)
  const handleVerifyForgotPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    const inputClean = normalizePhone(forgotPhone);
    if (!inputClean || inputClean.length < 10) {
      setForgotError(t.invalidPhone);
      return;
    }

    if (forgotOrigin === 'phone_login') {
      setIsProcessingForgot(true);
      try {
        const checkRes = await CloudSync.checkCloudBackup(forgotPhone);
        if (checkRes.hasCloudData) {
          setForgotStep(2);
          setForgotError('');
        } else {
          setForgotError('এই মোবাইল নম্বরে কোনো রেজিস্টার্ড দোকান পাওয়া যায়নি।');
        }
      } catch (_) {
        setForgotError('নেটওয়ার্ক সমস্যা হয়েছে। ইন্টারনেট চালু রেখে আবার চেষ্টা করুন।');
      } finally {
        setIsProcessingForgot(false);
      }
      return;
    }

    const profileClean = normalizePhone(profile.phone || '');
    const isMatched =
      inputClean === profileClean ||
      (inputClean.length >= 10 &&
        profileClean.length >= 10 &&
        inputClean.slice(-10) === profileClean.slice(-10));

    if (isMatched) {
      setForgotStep(2);
      setForgotError('');
    } else {
      setForgotError(t.phoneMismatchError);
    }
  };

  // Step 2: Set and Save New PIN (updates local DB + Firebase cloud shop record)
  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (newPin.length !== 4) {
      setForgotError(t.pinMustBe4Digits);
      return;
    }
    if (newPin !== confirmNewPin) {
      setForgotError(t.pinMismatch);
      return;
    }

    setIsProcessingForgot(true);
    const cleanNewPin = newPin.trim();
    try {
      if (forgotOrigin === 'phone_login') {
        const targetPhone = forgotPhone.trim() || loginPhone.trim();
        await CloudSync.updateCloudPinSettings(targetPhone, true, cleanNewPin);
        const restoreRes = await CloudSync.restoreFromCloud(targetPhone, cleanNewPin);
        if (!restoreRes.success) {
          setForgotError(restoreRes.message || 'পিন রিসেট করে ডেটা লোড করা যায়নি।');
          setIsProcessingForgot(false);
          return;
        }
        const restoredProfile: ShopProfile = {
          ...DB.getProfile(),
          pin: cleanNewPin,
          pinEnabled: true,
          appLockPin: cleanNewPin,
          isPinLockEnabled: true,
          isRegistered: true,
        };
        onSaveProfile(restoredProfile);
        DB.saveProfile(restoredProfile);
        if (onDataRestored) {
          onDataRestored();
        }
        setForgotSuccess(t.pinResetSuccess);
        setTimeout(() => {
          onUnlock();
        }, 900);
        return;
      }

      const updatedProfile: ShopProfile = {
        ...profile,
        pin: cleanNewPin,
        pinEnabled: true,
        appLockPin: cleanNewPin,
        isPinLockEnabled: true,
        isRegistered: true,
      };

      onSaveProfile(updatedProfile);
      DB.saveProfile(updatedProfile);
      if (updatedProfile.phone) {
        CloudSync.updateCloudPinSettings(updatedProfile.phone, true, cleanNewPin).catch(() => {});
      }
      setForgotSuccess(t.pinResetSuccess);

      setTimeout(() => {
        onUnlock();
      }, 900);
    } finally {
      setIsProcessingForgot(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-md md:max-w-xl my-auto overflow-hidden rounded-3xl bg-white shadow-2xl border border-emerald-100 dark:bg-slate-900 dark:border-emerald-900/40">
        {/* Top Header with App Logo & Instant Language Switcher */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-900 p-5 sm:p-6 text-white text-center relative shadow-sm">
          {/* Language Switcher in top-right */}
          <div className="absolute top-4 right-4 flex items-center bg-black/25 backdrop-blur-md rounded-full p-0.5 border border-white/20">
            <button
              type="button"
              onClick={() => onLanguageChange('bn')}
              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-full transition-all ${
                language === 'bn'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-full transition-all ${
                language === 'en'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              English
            </button>
          </div>

          {/* Logo */}
          <div className="mx-auto mb-3 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white/10 p-1.5 shadow-inner backdrop-blur-md border border-white/20">
            <img
              src={profile.logo || '/assets/aistudio/file_000000004a3c81f5869dca542232e290_f5f4ef0c.png'}
              alt="Sahoj Dokan POS"
              className="h-full w-full object-contain drop-shadow"
            />
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {mode === 'unlock'
              ? profile.shopName || t.appName
              : mode === 'forgot_pin'
              ? t.forgotPinTitle
              : t.appName}
          </h2>
          <p className="text-xs text-emerald-100/90 mt-1 max-w-xs mx-auto">
            {mode === 'unlock'
              ? t.loginSubtitle
              : mode === 'forgot_pin'
              ? t.forgotPinSubtitle
              : 'মোবাইল নম্বর দিয়ে সাথে সাথে শুরু করুন বা লগইন করুন'}
          </p>
        </div>

        {/* ======================================================== */}
        {/* 1. UNLOCK MODE: 4-Digit PIN Keypad Screen                */}
        {/* ======================================================== */}
        {mode === 'unlock' && (
          <div className="p-5 sm:p-6">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold mb-5 text-sm">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t.loginTitle}</span>
              </div>

              {/* PIN Indicator Dots */}
              <div className={`flex gap-4 mb-6 ${isWrongPin ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((index) => {
                  const isFilled = enteredPin.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                        isWrongPin
                          ? 'border-rose-500 bg-rose-500 scale-110'
                          : isFilled
                          ? 'bg-emerald-600 border-emerald-600 scale-125 shadow-sm'
                          : 'border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800'
                      }`}
                    />
                  );
                })}
              </div>

              {unlockError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold mb-4 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-1.5 rounded-full border border-rose-200 dark:border-rose-900/60 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              {/* Touch Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[280px]">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="h-14 sm:h-16 rounded-2xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 active:scale-95 text-slate-800 dark:bg-slate-800 dark:text-white dark:hover:bg-emerald-950 font-bold text-2xl flex items-center justify-center transition shadow-sm"
                  >
                    {language === 'bn'
                      ? digit.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[parseInt(d)])
                      : digit}
                  </button>
                ))}

                {/* Empty slot for balance */}
                <div className="h-14 sm:h-16 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-emerald-600/30 dark:text-emerald-400/30" />
                </div>

                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-14 sm:h-16 rounded-2xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 active:scale-95 text-slate-800 dark:bg-slate-800 dark:text-white dark:hover:bg-emerald-950 font-bold text-2xl flex items-center justify-center transition shadow-sm"
                >
                  {language === 'bn' ? '০' : '0'}
                </button>

                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  title="Backspace"
                  className="h-14 sm:h-16 rounded-2xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 active:scale-95 dark:bg-slate-800 dark:text-slate-300 font-bold flex items-center justify-center transition shadow-sm"
                >
                  <Delete className="w-6 h-6" />
                </button>
              </div>

              {/* Forgot PIN & Mobile Restore Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 w-full flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForgotOrigin('unlock');
                    setForgotStep(1);
                    setForgotPhone('');
                    setForgotError('');
                    setForgotSuccess('');
                    setNewPin('');
                    setConfirmNewPin('');
                    setMode('forgot_pin');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 py-1 px-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{t.forgotPin}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('phone_login');
                    setLoginError('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline py-1 px-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>মোবাইল নম্বর দিয়ে ডেটা রিস্টোর / লগইন</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. UNIFIED PHONE ONBOARDING & LOGIN SCREEN               */}
        {/* ======================================================== */}
        {mode === 'phone_login' && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
              <div className="flex flex-col items-center text-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <CloudDownload className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                  সহজ প্রবেশ ও ব্যাকআপ
                </h3>
              </div>
              <div className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed space-y-1 text-left">
                <p>• নতুন ব্যবহারকারী: শুধু আপনার মোবাইল নম্বর দিয়েই সাথে সাথে শুরু করুন।</p>
                <p>• পুরনো ব্যবহারকারী: আগের নম্বরটি দিলেই আপনার সব পণ্য, বাকি খাতা ও হিসাব ফিরে পাবেন।</p>
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handlePhoneLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  মোবাইল নম্বর *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={loginPhone}
                    onChange={(e) => {
                      setLoginPhone(e.target.value);
                      if (showLoginPinStep) {
                        setShowLoginPinStep(false);
                        setLoginPin('');
                        setLoginShopNameHint('');
                        setLoginError('');
                      }
                    }}
                    placeholder="017xxxxxxxx"
                    className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-base font-bold tracking-wide focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Existing User with PIN Lock ON: Reveal 4-digit PIN box & Forget PIN */}
              {showLoginPinStep && (
                <div className="space-y-2.5 p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {loginShopNameHint
                        ? `"${loginShopNameHint}" দোকানে পিন লক চালু আছে। প্রবেশ করতে ৪ সংখ্যার পিন দিন।`
                        : 'এই দোকানে পিন লক চালু আছে। প্রবেশ করতে ৪ সংখ্যার পিন নম্বর দিন।'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                      ৪ সংখ্যার পিন নম্বর *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        autoFocus
                        required
                        maxLength={4}
                        inputMode="numeric"
                        value={loginPin}
                        onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-base font-mono tracking-widest text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotOrigin('phone_login');
                        setForgotPhone(loginPhone.trim());
                        setForgotStep(1);
                        setForgotError('');
                        setForgotSuccess('');
                        setNewPin('');
                        setConfirmNewPin('');
                        setMode('forgot_pin');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>পিন ভুলে গেছেন? (Forget PIN)</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn || isRestoringCloud}
                  className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold rounded-2xl shadow-lg shadow-emerald-700/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {isLoggingIn || isRestoringCloud ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>
                        {showLoginPinStep ? 'পিন যাচাই ও ডেটা লোড হচ্ছে...' : 'যাচাই ও লোড হচ্ছে...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <CloudDownload className="w-4 h-4" />
                      <span>
                        {showLoginPinStep
                          ? 'পিন যাচাই করে লগইন করুন'
                          : 'শুরু করুন / লগইন করুন'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. FORGOT PIN MODE: Reset PIN with Mobile Number (NO OTP) */}
        {/* ======================================================== */}
        {mode === 'forgot_pin' && (
          <div className="p-5 sm:p-6 space-y-4">
            {forgotSuccess ? (
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                  {forgotSuccess}
                </h4>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {language === 'bn'
                    ? 'অ্যাপে সরাসরি প্রবেশ করা হচ্ছে...'
                    : 'Unlocking app now...'}
                </p>
              </div>
            ) : (
              <>
                {forgotError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-2xl border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{forgotError}</span>
                  </div>
                )}

                {/* STEP 1: Enter Registered Mobile Number */}
                {forgotStep === 1 && (
                  <form onSubmit={handleVerifyForgotPhone} className="space-y-4">
                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                      <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                        {language === 'bn'
                          ? 'রেজিস্ট্রেশনের সময় যে মোবাইল নম্বরটি দিয়েছিলেন, সেটি নিচে দিন।'
                          : 'Enter your registered mobile number below.'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                        {t.enterRegisteredPhone} *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          type="tel"
                          required
                          value={forgotPhone}
                          onChange={(e) => setForgotPhone(e.target.value)}
                          placeholder={t.enterRegisteredPhonePlaceholder}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={isProcessingForgot}
                        className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold rounded-2xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        {isProcessingForgot ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                        <span>{isProcessingForgot ? 'যাচাই হচ্ছে...' : t.verifyPhoneBtn}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMode(forgotOrigin);
                          setUnlockError('');
                          setEnteredPin('');
                          setLoginError('');
                        }}
                        className="w-full py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{t.backToLogin}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 2: Set New PIN directly (No OTP) */}
                {forgotStep === 2 && (
                  <form onSubmit={handleSaveNewPin} className="space-y-4">
                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {language === 'bn'
                          ? 'মোবাইল নম্বর যাচাই সফল হয়েছে! এবার নতুন ৪ সংখ্যার পিন দিন।'
                          : 'Mobile number verified! Please enter your new 4-digit PIN.'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                          {t.newPin} *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <KeyRound className="w-4 h-4" />
                          </div>
                          <input
                            type="password"
                            maxLength={4}
                            inputMode="numeric"
                            required
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="••••"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-base font-mono tracking-widest text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                          {t.confirmNewPin} *
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          inputMode="numeric"
                          required
                          value={confirmNewPin}
                          onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-base font-mono tracking-widest text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={isProcessingForgot}
                        className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold rounded-2xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        {isProcessingForgot ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>{isProcessingForgot ? 'সংরক্ষণ হচ্ছে...' : t.saveNewPinBtn}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMode(forgotOrigin);
                          setUnlockError('');
                          setEnteredPin('');
                          setLoginError('');
                        }}
                        className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                      >
                        {t.backToLogin}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
