import React, { useState } from 'react';
import { ShopProfile, Language } from '../types';
import { translations } from '../i18n/translations';
import {
  Lock,
  Store,
  Phone,
  User,
  Mail,
  MapPin,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Delete,
  ArrowLeft,
  ShieldCheck,
  Save,
  Cloud,
  CloudDownload,
  RefreshCw,
  Sparkles,
  Smartphone,
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

  // Active view: 'phone_login' | 'register' | 'unlock' | 'forgot_pin'
  const [mode, setMode] = useState<'unlock' | 'phone_login' | 'register' | 'forgot_pin'>(
    isRegistered && profile.pin ? 'unlock' : 'phone_login'
  );

  // Phone Login State (Direct Cloud Restore & Login)
  const [loginPhone, setLoginPhone] = useState(
    profile.phone || (typeof localStorage !== 'undefined' ? localStorage.getItem('sd_registered_phone') || '' : '')
  );
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Registration Form State
  const [shopName, setShopName] = useState(profile.shopName || '');
  const [ownerName, setOwnerName] = useState(profile.ownerName || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [email, setEmail] = useState(profile.email || '');
  const [address, setAddress] = useState(profile.address || '');
  const [regPin, setRegPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [regError, setRegError] = useState('');

  // Unlock PIN State
  const [enteredPin, setEnteredPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isWrongPin, setIsWrongPin] = useState(false);

  // Forgot PIN State
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  // Cloud restore on reinstall state
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [detectedCloudData, setDetectedCloudData] = useState<{
    hasCloudData: boolean;
    profile?: any;
    stats?: { products: number; sales: number; customers: number };
    lastSyncedAt?: string;
  } | null>(null);
  const [isCheckingCloud, setIsCheckingCloud] = useState(false);
  const [isRestoringCloud, setIsRestoringCloud] = useState(false);
  const [showDirectCloudRestore, setShowDirectCloudRestore] = useState(false);
  const [directPhone, setDirectPhone] = useState('');
  const [directError, setDirectError] = useState('');

  // Function to execute cloud restore during onboarding/reinstall with strict PIN check
  const handleExecuteCloudRestore = async (phoneToRestore: string, pinToCheck?: string) => {
    setIsRestoringCloud(true);
    setDirectError('');
    setLoginError('');
    try {
      const cleanPin = (pinToCheck || '').trim();
      const res = await CloudSync.restoreFromCloud(phoneToRestore, cleanPin);
      if (res.success) {
        if (cleanPin && cleanPin.length === 4) {
          const currentProf = DB.getProfile();
          DB.saveProfile({ ...currentProf, pin: cleanPin, isRegistered: true });
        }
        if (onDataRestored) {
          onDataRestored();
        }
        onUnlock();
      } else {
        setDirectError(res.message);
        setLoginError(res.message);
      }
    } catch (err: any) {
      const msg = 'ক্লাউড থেকে তথ্য পুনরুদ্ধারে ত্রুটি: ' + err.message;
      setDirectError(msg);
      setLoginError(msg);
    } finally {
      setIsRestoringCloud(false);
      setIsLoggingIn(false);
    }
  };

  // Direct Phone Login Handler with mandatory 4-digit PIN verification
  const handlePhoneLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const clean = loginPhone.replace(/\D/g, '');
    if (clean.length < 10) {
      setLoginError('সঠিক ১০ বা ১১ ডিজিটের মোবাইল নম্বর দিন।');
      return;
    }
    const cleanPin = loginPin.trim();
    if (!cleanPin || cleanPin.length !== 4) {
      setLoginError('আপনার অ্যাকাউন্টের ৪ সংখ্যার গোপন পিন (PIN) লিখুন।');
      return;
    }
    setIsLoggingIn(true);
    await handleExecuteCloudRestore(loginPhone, cleanPin);
    try {
      await CloudSync.ensurePermanentTrial(loginPhone);
    } catch (_) {}
  };

  // Check cloud backup when phone is entered in registration
  const handleCheckPhoneForCloud = async (phoneToCheck: string) => {
    const clean = phoneToCheck.replace(/\D/g, '');
    if (clean.length >= 10) {
      setIsCheckingCloud(true);
      try {
        const checkRes = await CloudSync.checkCloudBackup(phoneToCheck);
        if (checkRes.hasCloudData) {
          setDetectedCloudData(checkRes);
          setShowRestorePrompt(true);
        }
      } catch (_) {
        // ignore network error
      } finally {
        setIsCheckingCloud(false);
      }
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
        if (next === profile.pin) {
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

  // Handle Initial Registration Submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!shopName.trim()) {
      setRegError(t.shopNameRequired);
      return;
    }
    if (!ownerName.trim()) {
      setRegError(t.ownerNameRequired);
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setRegError(t.invalidPhone);
      return;
    }
    if (regPin.length !== 4) {
      setRegError(t.pinMustBe4Digits);
      return;
    }
    if (regPin !== confirmPin) {
      setRegError(t.pinMismatch);
      return;
    }

    // Check if cloud backup exists for this phone and verify PIN before restoring
    try {
      const cloudCheck = await CloudSync.checkCloudBackup(phone);
      if (cloudCheck.hasCloudData) {
        const restoreRes = await CloudSync.restoreFromCloud(phone, regPin.trim());
        if (!restoreRes.success) {
          setRegError('এই মোবাইল নম্বরে ইতিমধ্যে একটি দোকান চালু আছে। সেই অ্যাকাউন্টের সঠিক ৪ সংখ্যার পিন দিন অথবা লগইন পেজে গিয়ে প্রবেশ করুন।');
          return;
        }
        if (onDataRestored) {
          onDataRestored();
        }
      }
      await CloudSync.ensurePermanentTrial(phone);
    } catch (_) {}

    const updatedProfile: ShopProfile = {
      ...DB.getProfile(),
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      pin: regPin.trim(),
      isRegistered: true,
      language: language,
    };

    onSaveProfile(updatedProfile);
    if (onDataRestored) {
      onDataRestored();
    }
    onUnlock();
  };


  // Step 1: Verify Registered Phone in Forgot PIN (NO OTP required!)
  const handleVerifyForgotPhone = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    const inputClean = normalizePhone(forgotPhone);
    const profileClean = normalizePhone(profile.phone || '');

    if (!inputClean || inputClean.length < 10) {
      setForgotError(t.invalidPhone);
      return;
    }

    // Match either full cleaned digits or last 10 digits
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

  // Step 2: Set and Save New PIN
  const handleSaveNewPin = (e: React.FormEvent) => {
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

    const updatedProfile: ShopProfile = {
      ...profile,
      pin: newPin.trim(),
      isRegistered: true,
    };

    onSaveProfile(updatedProfile);
    setForgotSuccess(t.pinResetSuccess);

    setTimeout(() => {
      onUnlock();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-md my-auto overflow-hidden rounded-3xl bg-white shadow-2xl border border-emerald-100 dark:bg-slate-900 dark:border-emerald-900/40">
        
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
              : mode === 'phone_login'
              ? 'মোবাইল নম্বর দিয়ে লগইন'
              : t.registerTitle}
          </h2>
          <p className="text-xs text-emerald-100/90 mt-1 max-w-xs mx-auto">
            {mode === 'unlock'
              ? t.loginSubtitle
              : mode === 'forgot_pin'
              ? t.forgotPinSubtitle
              : mode === 'phone_login'
              ? 'মোবাইল নম্বর দিয়ে লগইন করলেই সমস্ত পুরনো তথ্য স্বয়ংক্রিয়ভাবে ফিরে আসবে'
              : t.registerSubtitle}
          </p>
        </div>

        {/* Tab Switcher for Phone Login vs New Store Registration */}
        {(mode === 'phone_login' || mode === 'register') && (
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMode('phone_login');
                setLoginError('');
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'phone_login'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>মোবাইল দিয়ে লগইন</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setRegError('');
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'register'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>নতুন দোকান খুলুন</span>
            </button>
          </div>
        )}

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
                    setForgotStep(1);
                    setForgotPhone('');
                    setForgotError('');
                    setForgotSuccess('');
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
        {/* 2. PHONE LOGIN MODE: Direct Mobile Login & Cloud Restore */}
        {/* ======================================================== */}
        {mode === 'phone_login' && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center space-y-1">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm">
                <CloudDownload className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                পূর্বের দোকানের সমস্ত ডেটা ফিরে পান
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                মোবাইল নম্বর দিয়ে লগইন করলেই আপনার ১৪টি পণ্য, বাকি খাতা ও বিক্রির সমস্ত তথ্য সাথে সাথে লোড হবে।
              </p>
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
                  দোকানের রেজিস্টার্ড মোবাইল নম্বর *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-base font-bold tracking-wide focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  ৪ সংখ্যার পিন নম্বর (ঐচ্ছিক/ডিফল্ট: 1234)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-base font-mono tracking-widest text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn || isRestoringCloud}
                  className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold rounded-2xl shadow-lg shadow-emerald-700/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {isLoggingIn || isRestoringCloud ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>ক্লাউড থেকে ডেটা লোড হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <CloudDownload className="w-4 h-4" />
                      <span>লগইন করুন ও পূর্বের সমস্ত ডেটা লোড করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setRegError('');
                }}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 underline font-semibold cursor-pointer"
              >
                নতুন দোকান? এখানে ক্লিক করে নতুন দোকান খুলুন
              </button>
            </div>
          </div>
        )}


        {/* ======================================================== */}
        {/* 2. REGISTRATION MODE: First Install Registration Screen   */}
        {/* ======================================================== */}
        {mode === 'register' && (
          <div className="p-5 sm:p-6 space-y-4">
            {/* Quick Cloud Restore on Reinstall (পুনরায় ইনস্টল বা ফোন পরিবর্তনের পর ক্লাউড রিস্টোর) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0 shadow-sm">
                  <CloudDownload className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block text-xs font-bold text-blue-900 dark:text-blue-100">
                    পূর্বের দোকানের হিসাব আছে?
                  </span>
                  <span className="block text-[10px] text-blue-700/90 dark:text-blue-300">
                    মোবাইল নম্বর দিয়ে ক্লাউড ব্যাকআপ রিস্টোর করুন
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDirectCloudRestore(!showDirectCloudRestore);
                  setDirectPhone(phone || '');
                  setDirectError('');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-sm transition active:scale-95 shrink-0 cursor-pointer"
              >
                {showDirectCloudRestore ? 'ফর্ম দেখুন' : 'রিস্টোর'}
              </button>
            </div>

            {/* Direct Cloud Restore Box */}
            {showDirectCloudRestore ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-blue-300 dark:border-blue-700 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>ক্লাউড থেকে তাৎক্ষণিক ডেটা রিস্টোর</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  পূর্বে ব্যবহৃত মোবাইল নম্বর দিন। আপনার পণ্য, দৈনিক বিক্রি ও বাকির খাতার সকল তথ্য ফিরে আসবে।
                </p>

                {directError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                    {directError}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={directPhone}
                    onChange={(e) => setDirectPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="flex-1 p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    disabled={isRestoringCloud}
                    onClick={() => handleExecuteCloudRestore(directPhone)}
                    className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold shrink-0 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isRestoringCloud ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>রিস্টোর হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <CloudDownload className="w-3.5 h-3.5" />
                        <span>রিস্টোর করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Detected Cloud Backup Notification Banner */}
            {showRestorePrompt && detectedCloudData?.hasCloudData && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-700 text-left space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>এই নম্বরে পূর্বের ক্লাউড ব্যাকআপ পাওয়া গেছে!</span>
                </div>
                {detectedCloudData.profile && (
                  <p className="text-xs text-slate-700 dark:text-slate-200 font-semibold">
                    দোকানের নাম: <strong>{detectedCloudData.profile.shopName}</strong> (পণ্য: {detectedCloudData.stats?.products || 0} টি, বিক্রি: {detectedCloudData.stats?.sales || 0} টি)
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isRestoringCloud}
                    onClick={() => handleExecuteCloudRestore(phone)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isRestoringCloud ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudDownload className="w-3.5 h-3.5" />
                    )}
                    <span>হ্যাঁ, পূর্বের ডাটা ফিরিয়ে আনুন</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRestorePrompt(false)}
                    className="py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                  >
                    না
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {regError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-2xl border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {/* 1. দোকানের নাম (Shop Name) * */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {t.shopName} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Store className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder={t.shopNamePlaceholder}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 2. মালিকের নাম (Owner Name) * */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {t.ownerName} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder={t.ownerNamePlaceholder}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 3. মোবাইল নম্বর (Mobile Number) * */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {t.phone} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPhone(val);
                      if (val.replace(/\D/g, '').length === 11) {
                        handleCheckPhoneForCloud(val);
                      }
                    }}
                    onBlur={() => handleCheckPhoneForCloud(phone)}
                    placeholder={t.phonePlaceholder}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {language === 'bn'
                    ? 'এই নম্বরটি পিন ভুলে গেলে পিন রিসেট করার জন্য প্রয়োজন হবে।'
                    : 'This number is required to recover your PIN if forgotten.'}
                </p>
              </div>

            {/* 4. ইমেইল (ঐচ্ছিক) (Email - optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                {t.email}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 5. দোকানের ঠিকানা (Shop Address) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                {t.address}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t.addressPlaceholder}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 6 & 7: ৪ সংখ্যার লগইন পিন এবং পিন নিশ্চিতকরণ */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {language === 'bn' ? '৪ সংখ্যার পিন *' : '4-Digit PIN *'}
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
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-base font-mono tracking-widest text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {t.confirmPin} *
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-base font-mono tracking-widest text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Submit Button: 'তথ্য সংরক্ষণ করুন' */}
            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-lg shadow-emerald-700/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm"
              >
                <Save className="w-4 h-4" />
                <span>{t.saveInfoBtn}</span>
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
                        className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>{t.verifyPhoneBtn}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMode('unlock');
                          setUnlockError('');
                          setEnteredPin('');
                        }}
                        className="w-full py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1.5"
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
                        className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm"
                      >
                        <Save className="w-4 h-4" />
                        <span>{t.saveNewPinBtn}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMode('unlock');
                          setUnlockError('');
                          setEnteredPin('');
                        }}
                        className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
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
