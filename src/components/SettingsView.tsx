import React, { useState, useRef } from 'react';
import { ShopProfile, Language, SubscriptionInfo } from '../types';
import { DB } from '../storage/db';
import { compressImage } from '../utils/image';
import { DataBackupView } from './DataBackupView';
import { firestore } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  ChevronRight,
  Edit3,
  Lock,
  KeyRound,
  RotateCcw,
  FileText,
  Star,
  LogOut,
  Smartphone,
  Download,
  CheckCircle2,
  Upload,
  X,
  Share2,
  Copy,
  Store,
  Printer,
  Bluetooth,
  Languages,
  RefreshCw,
  Sparkles,
  AlertCircle,
  TrendingUp,
  Trash2,
} from 'lucide-react';

interface Props {
  profile: ShopProfile;
  language: Language;
  onSaveProfile: (profile: ShopProfile) => void;
  onLanguageChange: (lang: Language) => void;
  onDataRestored: () => void;
  subscription?: SubscriptionInfo;
  onOpenSubscriptionModal?: () => void;
  onOpenAdminPanel?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

const CURRENT_APP_VERSION = '1.0.0';

interface RemoteVersionInfo {
  version: string;
  downloadUrl?: string;
  releaseNotes?: string;
  sizeMb?: string;
}

export const SettingsView: React.FC<Props> = ({
  profile,
  language,
  onSaveProfile,
  onLanguageChange,
  onDataRestored,
  subscription,
  onOpenAdminPanel,
}) => {
  // Modals state
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showDataBackupView, setShowDataBackupView] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showWipeDemoModal, setShowWipeDemoModal] = useState(false);
  const [keepProductsOnWipe, setKeepProductsOnWipe] = useState(true);
  const [quickSaleMargin, setQuickSaleMargin] = useState<number>(() =>
    DB.getQuickSaleProfitMargin()
  );

  // In-App Updater state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateAvailableInfo, setUpdateAvailableInfo] = useState<RemoteVersionInfo | null>(null);
  const [showUpdateConfirmModal, setShowUpdateConfirmModal] = useState(false);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Toast feedback state (replaces intrusive browser alerts)
  const [statusToast, setStatusToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setStatusToast({ message, type });
    setTimeout(() => {
      setStatusToast((prev) => (prev?.message === message ? null : prev));
    }, 3800);
  };

  // Super Admin Authentication Visibility Check
  const [adminUnlockedBySecretTap, setAdminUnlockedBySecretTap] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sahoj_super_admin_unlocked') === 'true';
    } catch (_) {
      return false;
    }
  });
  const secretTapCountRef = useRef(0);
  const secretTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSuperAdminVisible = Boolean(
    subscription?.isOwner ||
      (profile.phone && profile.phone.replace(/\D/g, '').endsWith('1733414031')) ||
      adminUnlockedBySecretTap
  );

  const handleHeaderSecretTap = () => {
    secretTapCountRef.current += 1;
    if (secretTapTimerRef.current) clearTimeout(secretTapTimerRef.current);
    if (secretTapCountRef.current >= 5) {
      secretTapCountRef.current = 0;
      setAdminUnlockedBySecretTap(true);
      try {
        localStorage.setItem('sahoj_super_admin_unlocked', 'true');
      } catch (_) {}
      showToast('সুপার-এডমিন অপশন আনলক হয়েছে', 'info');
    } else {
      secretTapTimerRef.current = setTimeout(() => {
        secretTapCountRef.current = 0;
      }, 1800);
    }
  };

  // Printer configuration state
  const [printerPaperSize, setPrinterPaperSize] = useState<'58mm' | '80mm'>(() => {
    try {
      return (localStorage.getItem('sahoj_printer_paper') as '58mm' | '80mm') || '58mm';
    } catch (_) {
      return '58mm';
    }
  });
  const [connectedPrinter, setConnectedPrinter] = useState<string>(() => {
    try {
      return localStorage.getItem('sahoj_printer_name') || '';
    } catch (_) {
      return '';
    }
  });
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [printerStatusMessage, setPrinterStatusMessage] = useState('');
  const [testPrintSuccess, setTestPrintSuccess] = useState(false);

  // Form states for profile editing
  const [shopName, setShopName] = useState(profile.shopName || 'Sahoj Dokan - সহজ দোকান');
  const [ownerName, setOwnerName] = useState(profile.ownerName || 'স্বত্বাধিকারী');
  const [phone, setPhone] = useState(profile.phone || '01733225566');
  const [email, setEmail] = useState(profile.email || 'mail.com');
  const [address, setAddress] = useState(profile.address || '');
  const [pin, setPin] = useState(profile.pin || '1234');

  // 3-field PIN change states
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Review state
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const defaultAppLogo = '/assets/icon.png';
  const [logo, setLogo] = useState(profile.logo || defaultAppLogo);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [copiedApkLink, setCopiedApkLink] = useState(false);

  const PUBLIC_SERVER_ORIGIN =
    'https://ais-pre-5gkalv7jknwtm4c27ipdpl-227798637835.europe-west2.run.app';
  const APK_BUILD_VERSION = 'v15_20261104';

  const getApkDownloadLink = (filename: string = 'SahojDokan-POS.apk', customDirectUrl?: string) => {
    if (customDirectUrl && customDirectUrl.startsWith('http')) {
      return customDirectUrl;
    }
    const customUrl = DB.getApkDownloadUrl();
    if (customUrl && customUrl.startsWith('http')) {
      return customUrl;
    }
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (
        host === '127.0.0.1' ||
        host === 'localhost' ||
        window.location.protocol === 'file:' ||
        window.location.protocol === 'capacitor:'
      ) {
        return `${PUBLIC_SERVER_ORIGIN}/${filename}?v=${APK_BUILD_VERSION}`;
      }
      return `${window.location.origin}/${filename}?v=${APK_BUILD_VERSION}`;
    }
    return `${PUBLIC_SERVER_ORIGIN}/${filename}?v=${APK_BUILD_VERSION}`;
  };

  // Compare semantic versions (e.g., "1.0.1" > "1.0.0")
  const isNewerVersion = (remoteVer: string, currentVer: string): boolean => {
    const cleanRemote = remoteVer.replace(/^v/i, '').trim();
    const cleanCurrent = currentVer.replace(/^v/i, '').trim();
    if (!cleanRemote || cleanRemote === cleanCurrent) return false;
    const rParts = cleanRemote.split('.').map((n) => parseInt(n, 10) || 0);
    const cParts = cleanCurrent.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
      const r = rParts[i] || 0;
      const c = cParts[i] || 0;
      if (r > c) return true;
      if (r < c) return false;
    }
    return false;
  };

  // Automatic Online App Update (Clears cache, syncs service worker & downloads/reloads latest online build)
  const handleCheckForUpdate = async () => {
    if (isCheckingUpdate) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showToast('অটো আপডেটের জন্য ইন্টারনেট (অনলাইন) সংযোগ চালু করুন!', 'error');
      return;
    }

    setIsCheckingUpdate(true);
    showToast('অনলাইনে নতুন আপডেট চেক ও সিঙ্ক করা হচ্ছে...', 'info');

    try {
      // 1. Refresh Service Workers & clear stale caches so online updates apply immediately
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.update();
          }
        } catch (_) {}
      }
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        } catch (_) {}
      }

      let remoteInfo: RemoteVersionInfo | null = null;

      // 2. Check Firebase Firestore `app_config/apk_release` or `app_stats/downloads`
      if (firestore) {
        try {
          const releaseSnap = await getDoc(doc(firestore, 'app_config', 'apk_release'));
          if (releaseSnap.exists()) {
            const data = releaseSnap.data();
            if (data?.version) {
              remoteInfo = {
                version: String(data.version),
                downloadUrl: data.downloadUrl || data.apkUrl || undefined,
                releaseNotes:
                  data.releaseNotes ||
                  'নতুন ফিচার, দ্রুততর পারফরম্যান্স এবং উন্নত ক্যাশ ও পুঁজি ট্র্যাকার যুক্ত করা হয়েছে।',
                sizeMb: data.sizeMb || '১৮ MB',
              };
            }
          }

          if (!remoteInfo) {
            const statsSnap = await getDoc(doc(firestore, 'app_stats', 'downloads'));
            if (statsSnap.exists()) {
              const sData = statsSnap.data();
              if (sData?.latestVersion && isNewerVersion(String(sData.latestVersion), CURRENT_APP_VERSION)) {
                remoteInfo = {
                  version: String(sData.latestVersion),
                  downloadUrl: sData.apkUrl || undefined,
                  releaseNotes:
                    sData.releaseNotes ||
                    'নতুন ফিচার ও পারফরম্যান্স ইমপ্রুভমেন্টসহ নতুন আপডেট পাওয়া গেছে।',
                  sizeMb: '১৮ MB',
                };
              }
            }
          }
        } catch (_) {}
      }

      // 3. Also check server `/api/app-version` if available
      if (!remoteInfo) {
        try {
          const res = await fetch('/api/app-version', { method: 'GET', cache: 'no-store' });
          if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const json = await res.json();
              if (json?.version && isNewerVersion(String(json.version), CURRENT_APP_VERSION)) {
                remoteInfo = {
                  version: String(json.version),
                  downloadUrl: json.downloadUrl,
                  releaseNotes: json.releaseNotes,
                  sizeMb: json.sizeMb || '১৮ MB',
                };
              }
            }
          }
        } catch (_) {}
      }

      if (remoteInfo && isNewerVersion(remoteInfo.version, CURRENT_APP_VERSION)) {
        setUpdateAvailableInfo(remoteInfo);
        setShowUpdateConfirmModal(true);
        triggerDirectApkDownload('SahojDokan-Signed-Universal.apk', remoteInfo.downloadUrl);
      } else {
        // Fetch latest online entry point with cache-busting and auto-reload
        try {
          await fetch(`${window.location.pathname}?auto_update=${Date.now()}`, {
            cache: 'no-store',
          });
        } catch (_) {}
        showToast('✅ অনলাইন থেকে সর্বশেষ আপডেট স্বয়ংক্রিয়ভাবে সিঙ্ক হয়েছে!', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 900);
      }
    } catch (_) {
      showToast('অ্যাপটি সর্বশেষ অনলাইন ভার্সনে আপডেট আছে', 'success');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // Trigger background APK download and launch installer
  const triggerDirectApkDownload = (
    filename: string = 'SahojDokan-POS.apk',
    customDirectUrl?: string
  ) => {
    const downloadUrl = getApkDownloadLink(filename, customDirectUrl);
    setIsDownloadingUpdate(true);
    setDownloadProgress(15);

    const progressTimer = setInterval(() => {
      setDownloadProgress((prev) => (prev < 90 ? prev + 25 : prev));
    }, 350);

    try {
      DB.incrementApkDownloadCountLocal();
      fetch('/api/apk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: profile.phone, shopName: profile.shopName }),
      }).catch(() => {});
    } catch (_) {}

    setTimeout(() => {
      clearInterval(progressTimer);
      setDownloadProgress(100);

      // 1. Inside Android APK: launch system DownloadManager / Installer
      if (typeof window !== 'undefined' && (window as any).AndroidApp?.openWhatsApp) {
        try {
          const nativeUrl = downloadUrl.includes('wa.me')
            ? downloadUrl
            : `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}ref=wa.me`;
          (window as any).AndroidApp.openWhatsApp(nativeUrl);
          setIsDownloadingUpdate(false);
          setShowUpdateConfirmModal(false);
          showToast('নতুন আপডেট ডাউনলোড শুরু হয়েছে, ডাউনলোড শেষে ইনস্টল করুন', 'success');
          return;
        } catch (_) {}
      }

      // 2. Standard Web Browser / WebView anchor trigger
      try {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', 'SahojDokan-POS.apk');
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (_) {}

      setIsDownloadingUpdate(false);
      setShowUpdateConfirmModal(false);
      showToast('নতুন APK ডাউনলোড শুরু হয়েছে, নোটিফিকেশন থেকে ইনস্টল করুন', 'success');
    }, 1100);
  };

  // Share App Link directly via WhatsApp, Native Share, or Copy
  const getShareMessage = () => {
    const url = getApkDownloadLink();
    return `🏪 *সহজ দোকান (Sahoj Dokan POS)* — দোকানের বেচাকেনা, বাকি খাতা, স্টক ও লাভ-ক্ষতির সেরা ডিজিটাল হিসাব অ্যাপ!\n\n📲 সরাসরি অ্যান্ড্রয়েড অ্যাপ ডাউনলোড লিংক:\n${url}`;
  };

  const handleShareApp = async () => {
    const shareText = getShareMessage();
    const url = getApkDownloadLink();

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'সহজ দোকান (Sahoj Dokan POS)',
          text: shareText,
          url,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    setShowShareModal(true);
  };

  const handleShareViaWhatsApp = () => {
    const text = encodeURIComponent(getShareMessage());
    const waUrl = `https://api.whatsapp.com/send?text=${text}`;
    if (typeof window !== 'undefined' && (window as any).AndroidApp?.openWhatsApp) {
      try {
        (window as any).AndroidApp.openWhatsApp(waUrl);
        setShowShareModal(false);
        return;
      } catch (_) {}
    }
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowShareModal(false);
  };

  const handleShareViaSms = () => {
    const body = encodeURIComponent(getShareMessage());
    window.location.href = `sms:?body=${body}`;
    setShowShareModal(false);
  };

  const handleCopyApkLink = () => {
    const url = getApkDownloadLink();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (_) {}
    setCopiedApkLink(true);
    showToast('অ্যাপ ডাউনলোড লিংক কপি হয়েছে!', 'success');
    setTimeout(() => setCopiedApkLink(false), 3000);
  };

  const handleScanBluetoothPrinter = async () => {
    setIsScanningBluetooth(true);
    setPrinterStatusMessage('');
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            '000018f0-0000-1000-8000-00805f9b34fb',
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
            '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          ],
        });
        const name = device.name || 'Bluetooth POS Printer';
        setConnectedPrinter(name);
        try {
          localStorage.setItem('sahoj_printer_name', name);
        } catch (_) {}
        setPrinterStatusMessage(`✅ '${name}' সফলভাবে সংযুক্ত হয়েছে!`);
      } else {
        setPrinterStatusMessage(
          'টিপস: ফোনের Bluetooth সেটিংসে গিয়ে থার্মাল প্রিন্টারটি Pair করুন, তারপর নিচে টেস্ট প্রিন্ট দিন।'
        );
      }
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        setPrinterStatusMessage(err.message || 'ব্লুটুথ স্ক্যান সম্পন্ন হয়নি।');
      }
    } finally {
      setIsScanningBluetooth(false);
    }
  };

  const handleTestPrint = () => {
    setTestPrintSuccess(true);
    try {
      window.print();
    } catch (_) {}
    setTimeout(() => setTestPrintSuccess(false), 3500);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 200, 200, 0.85);
      setLogo(compressed);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: ShopProfile = {
      ...profile,
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      logo,
      pin,
    };
    onSaveProfile(updated);
    DB.saveProfile(updated);
    setShowEditInfoModal(false);
    showToast('দোকানের প্রোফাইল তথ্য সফলভাবে আপডেট হয়েছে!', 'success');
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    const currentSavedPin = profile.pin || '1234';
    if (oldPin.trim() !== currentSavedPin) {
      setPinError('বর্তমান পিনটি সঠিক নয়! সঠিক পিন দিয়ে আবার চেষ্টা করুন।');
      return;
    }
    if (newPin.length !== 4) {
      setPinError('নতুন পিন অবশ্যই ৪ সংখ্যার হতে হবে!');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('নতুন পিন এবং নিশ্চিতকরণ পিন মিলেনি!');
      return;
    }

    const updated: ShopProfile = { ...profile, pin: newPin };
    onSaveProfile(updated);
    DB.saveProfile(updated);
    setPin(newPin);
    setShowPinModal(false);
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    showToast('লগইন পিন সফলভাবে পরিবর্তন করা হয়েছে!', 'success');
  };

  if (showDataBackupView) {
    return (
      <DataBackupView
        profile={profile}
        language={language}
        onBack={() => setShowDataBackupView(false)}
        onDataRestored={onDataRestored}
      />
    );
  }

  return (
    <div className="h-[calc(100vh-112px)] flex flex-col px-2.5 py-1.5 max-w-2xl mx-auto overflow-hidden select-none">
      {/* ১. ক্লিন সাব-হেডার (কোনো ব্যাক অ্যারো নেই, সুপার-এডমিন ছাড়া এডমিন বাটন লুকানো) */}
      <div className="bg-white rounded-xl px-3.5 py-2 mb-1.5 flex items-center justify-between border border-[#E2E8F0] shadow-2xs shrink-0">
        <div
          onClick={handleHeaderSecretTap}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-2 h-4 rounded-full bg-[#0E6B6B]" />
          <h2 className="text-sm sm:text-base font-extrabold text-[#102A43] tracking-tight">
            {language === 'bn' ? 'সেটিংস ও প্রোফাইল' : 'Settings & Profile'}
          </h2>
        </div>

        {onOpenAdminPanel && isSuperAdminVisible && (
          <button
            type="button"
            onClick={onOpenAdminPanel}
            aria-label="এডমিন প্যানেল"
            className="w-8 h-8 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#0E6B6B] hover:text-white flex items-center justify-center transition cursor-pointer border border-[#B2DFDB] shadow-2xs active:scale-95"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* টোস্ট নোটিফিকেশন বার */}
      {statusToast && (
        <div
          className={`mb-1.5 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border shadow-xs animate-in fade-in duration-200 shrink-0 ${
            statusToast.type === 'error'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : statusToast.type === 'info'
              ? 'bg-sky-50 text-sky-800 border-sky-200'
              : 'bg-[#E0F2F1] text-[#0E6B6B] border-[#B2DFDB]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {statusToast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{statusToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusToast(null)}
            className="text-current opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* মূল কন্টেন্ট: কোনো ক, খ, গ হেডার ছাড়া প্রত্যেকটি অপশন আলাদা ও আকর্ষণীয় কার্ড হিসেবে */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 pb-4">
        {/* ১. শপ প্রোফাইল কার্ড */}
        <div className="bg-gradient-to-r from-[#E0F2F1]/70 via-white to-[#E8F5E9]/60 rounded-2xl px-3.5 py-2.5 border border-[#80CBC4] shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              onClick={() => setShowEditInfoModal(true)}
              className="relative w-11 h-11 rounded-xl bg-[#0E6B6B] text-white flex items-center justify-center font-bold border border-[#0E6B6B]/20 overflow-hidden shrink-0 cursor-pointer shadow-2xs"
              title="দোকানের তথ্য ও ফটো পরিবর্তন করুন"
            >
              {profile.logo && profile.logo !== defaultAppLogo ? (
                <img
                  src={profile.logo}
                  alt={profile.shopName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-[#102A43] truncate leading-tight">
                {profile.shopName || 'Sahoj Dokan - সহজ দোকান'}
              </h3>
              <p className="text-[11px] text-[#486581] font-semibold truncate mt-0.5">
                {profile.ownerName ? `${profile.ownerName} • ` : ''}
                {profile.phone || '01733225566'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowEditInfoModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-[#0E6B6B] text-white hover:bg-[#094747] text-[11px] font-bold flex items-center gap-1 transition shrink-0 cursor-pointer shadow-2xs"
          >
            <Edit3 className="w-3 h-3" />
            <span>{language === 'bn' ? 'এডিট' : 'Edit'}</span>
          </button>
        </div>

        {/* ২. ভাষা পরিবর্তন (স্বতন্ত্র কার্ড) */}
        <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-sky-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 border border-sky-200">
              <Languages className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-xs sm:text-sm text-[#102A43] block leading-tight">
                {language === 'bn' ? 'ভাষা পরিবর্তন' : 'Language'}
              </span>
              <span className="text-[10.5px] text-[#64748B] block truncate">
                {language === 'bn' ? 'বাংলা / English ইন্টারফেস' : 'Switch app language'}
              </span>
            </div>
          </div>

          <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-xl border border-[#E2E8F0] shrink-0">
            <button
              type="button"
              onClick={() => {
                onLanguageChange('bn');
                showToast('ভাষা বাংলায় পরিবর্তন করা হয়েছে', 'success');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                language === 'bn'
                  ? 'bg-[#0E6B6B] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#102A43]'
              }`}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => {
                onLanguageChange('en');
                showToast('Language changed to English', 'success');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                language === 'en'
                  ? 'bg-[#0E6B6B] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#102A43]'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* ৩. ব্লুটুথ থার্মাল প্রিন্টার সেটআপ ও টেস্ট প্রিন্ট (স্বতন্ত্র কার্ড) */}
        <div
          onClick={() => setShowPrinterModal(true)}
          className="bg-white rounded-2xl px-3.5 py-2.5 border border-indigo-200/80 shadow-2xs flex items-center justify-between cursor-pointer hover:border-indigo-400 transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200">
              <Printer className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-xs sm:text-sm text-[#102A43] block leading-tight">
                {language === 'bn'
                  ? 'ব্লুটুথ থার্মাল প্রিন্টার সেটআপ ও টেস্ট প্রিন্ট'
                  : 'Bluetooth Thermal Printer & Test Print'}
              </span>
              <span className="text-[10.5px] text-[#64748B] block truncate">
                {connectedPrinter
                  ? `${connectedPrinter} (${printerPaperSize})`
                  : `কাগজ সাইজ: ${printerPaperSize} • স্ক্যান ও টেস্ট প্রিন্ট`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${
                connectedPrinter
                  ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {connectedPrinter ? 'কানেক্টেড' : printerPaperSize}
            </span>
            <ChevronRight className="w-4 h-4 text-[#64748B]" />
          </div>
        </div>

        {/* ৪. দ্রুত বিক্রির ডিফল্ট লাভের হার (%) (স্বতন্ত্র কমপ্যাক্ট কার্ড) */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-emerald-200/90 shadow-2xs space-y-2">
          {/* Top Row: বাংলা লেখা এক লাইনে উপরে */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center shrink-0 border border-emerald-200">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <span className="font-extrabold text-xs sm:text-sm text-[#102A43] truncate">
                {language === 'bn'
                  ? 'দ্রুত বিক্রির ডিফল্ট লাভের হার (%)'
                  : 'Quick Sale Default Profit Margin (%)'}
              </span>
            </div>
            <span className="text-[11px] font-black text-[#2E7D32] bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0">
              {quickSaleMargin}% সেট করা
            </span>
          </div>

          {/* Bottom Row: নিচে বাটন ও কাস্টম ইনপুট */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {[0, 10, 15, 20].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  setQuickSaleMargin(pct);
                  DB.saveQuickSaleProfitMargin(pct);
                  onDataRestored();
                  showToast(`দ্রুত বিক্রির ডিফল্ট লাভ ${pct}% সেট করা হয়েছে`, 'success');
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer text-center active:scale-95 ${
                  quickSaleMargin === pct
                    ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-2xs'
                    : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-emerald-50'
                }`}
              >
                {pct}%
              </button>
            ))}
            <div className="relative w-16 shrink-0">
              <input
                type="number"
                min="0"
                max="100"
                value={quickSaleMargin}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  setQuickSaleMargin(val);
                  DB.saveQuickSaleProfitMargin(val);
                  onDataRestored();
                }}
                className="w-full pl-2 pr-5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-black text-[#102A43] text-center focus:outline-none focus:border-[#0E6B6B]"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#64748B]">
                %
              </span>
            </div>
          </div>
        </div>

        {/* ৫. অ্যাপ লক / পিন পরিবর্তন (স্বতন্ত্র কার্ড) */}
        <div
          onClick={() => {
            setOldPin('');
            setNewPin('');
            setConfirmPin('');
            setPinError('');
            setShowPinModal(true);
          }}
          className="bg-white rounded-2xl px-3.5 py-2.5 border border-amber-200/90 shadow-2xs flex items-center justify-between cursor-pointer hover:border-amber-400 transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-xs sm:text-sm text-[#102A43] block leading-tight">
                {language === 'bn' ? 'অ্যাপ লক / পিন পরিবর্তন' : 'App Lock / Change PIN'}
              </span>
              <span className="text-[10.5px] text-[#64748B] block truncate">
                {language === 'bn'
                  ? 'বর্তমান পিন যাচাই করে নতুন ৪-সংখ্যার পিন সেট করুন'
                  : 'Verify current PIN and set new 4-digit PIN'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
        </div>

        {/* ৬. ডাটা ব্যাকআপ ও রিসেট (স্বতন্ত্র কার্ড) */}
        <div
          onClick={() => setShowDataBackupView(true)}
          className="bg-white rounded-2xl px-3.5 py-2.5 border border-teal-200/90 shadow-2xs flex items-center justify-between cursor-pointer hover:border-[#0E6B6B] transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center shrink-0 border border-[#B2DFDB]">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-xs sm:text-sm text-[#102A43] block leading-tight">
                {language === 'bn' ? 'ডাটা ব্যাকআপ ও রিসেট' : 'Data Backup & Reset'}
              </span>
              <span className="text-[10.5px] text-[#64748B] block truncate">
                {language === 'bn'
                  ? 'ক্লাউড সিঙ্ক, ফাইল ব্যাকআপ ডাউনলোড ও রিস্টোর'
                  : 'Cloud sync, export backup & restore'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
        </div>

        {/* ৭. সব ডেমো ও পরীক্ষামূলক ডাটা চিরস্থায়ী মুছুন (স্বতন্ত্র কার্ড) */}
        <div
          onClick={() => setShowWipeDemoModal(true)}
          className="bg-white rounded-2xl px-3.5 py-2.5 border border-rose-200 shadow-2xs flex items-center justify-between cursor-pointer hover:bg-rose-50/40 transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#D32F2F] flex items-center justify-center shrink-0 border border-rose-200">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-xs sm:text-sm text-[#D32F2F] block leading-tight">
                {language === 'bn'
                  ? 'সব ডেমো ও পরীক্ষামূলক ডাটা চিরস্থায়ী মুছুন'
                  : 'Wipe All Demo & Test Data Permanently'}
              </span>
              <span className="text-[10.5px] text-[#64748B] block truncate">
                {language === 'bn'
                  ? 'পণ্য অক্ষুণ্ণ রেখে সকল ডেমো বিক্রি, খরচ ও বকেয়া ৳০ করে ফ্রেশ শুরু করুন'
                  : 'Reset all demo sales, expenses, capital & dues to ৳0'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#D32F2F] shrink-0" />
        </div>

        {/* ৮. অ্যাপ আপডেট ও ভার্সন + মিনিমাইজড অটো আপডেট ও শেয়ার বাটন (স্বতন্ত্র কার্ড) */}
        <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-cyan-200/90 shadow-2xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-[#0E6B6B] flex items-center justify-center shrink-0 border border-cyan-200">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-xs sm:text-sm text-[#102A43] block leading-tight truncate">
                {language === 'bn' ? 'অ্যাপ আপডেট ও শেয়ার' : 'App Update & Share'}
              </span>
              <span className="text-[10px] font-semibold text-[#64748B] block truncate">
                ভার্সন: v{CURRENT_APP_VERSION} • অনলাইন অটো-আপডেট
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* মিনিমাইজড অটো আপডেট বাটন */}
            <button
              type="button"
              onClick={handleCheckForUpdate}
              disabled={isCheckingUpdate}
              className="px-2 py-1 rounded-lg bg-[#0E6B6B] hover:bg-[#094747] text-white text-[10px] font-extrabold flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              title="অনলাইনে ক্লিক করলে স্বয়ংক্রিয়ভাবে সর্বশেষ আপডেট হবে"
            >
              <RefreshCw
                className={`w-2.5 h-2.5 ${isCheckingUpdate ? 'animate-spin' : ''}`}
              />
              <span>{isCheckingUpdate ? 'আপডেট হচ্ছে...' : 'আপডেট দেখুন'}</span>
            </button>

            {/* মিনিমাইজড অ্যাপ শেয়ার বাটন */}
            <button
              type="button"
              onClick={handleShareApp}
              className="px-2 py-1 rounded-lg bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] text-[10px] font-extrabold flex items-center gap-1 border border-[#80CBC4] transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="অন্য দোকানদারকে অ্যাপ শেয়ার করুন"
            >
              <Share2 className="w-2.5 h-2.5" />
              <span>অ্যাপ শেয়ার</span>
            </button>
          </div>
        </div>

        {/* ৯. ব্যবহার নির্দেশিকা ও শর্তাবলী (স্বতন্ত্র কার্ড) */}
        <div
          onClick={() => setShowTermsModal(true)}
          className="bg-white rounded-2xl px-3.5 py-2.5 border border-purple-200/80 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-400 transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-xs sm:text-sm text-[#102A43] block leading-tight truncate">
                {language === 'bn'
                  ? 'ব্যবহার নির্দেশিকা ও শর্তাবলী'
                  : 'User Guide & Terms'}
              </span>
              <span className="text-[10.5px] text-[#64748B] block truncate">
                অ্যাপ ব্যবহারের নিয়ম ও গোপনীয়তা নীতিমালা
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
        </div>

        {/* ১০. অ্যাপ রেটিং দিন (স্বতন্ত্র কার্ড) */}
        <div
          onClick={() => setShowReviewModal(true)}
          className="bg-white rounded-2xl px-3.5 py-2.5 border border-yellow-300/80 shadow-2xs flex items-center justify-between cursor-pointer hover:border-amber-400 transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 border border-amber-200">
              <Star className="w-4 h-4 fill-amber-500" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-xs sm:text-sm text-[#102A43] block leading-tight truncate">
                {language === 'bn' ? 'অ্যাপ রেটিং দিন' : 'Rate This App'}
              </span>
              <span className="text-[10.5px] text-[#64748B] block truncate">
                আপনার মতামত ও ৫-স্টার রেটিং দিন
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
        </div>

        {/* ১১. লগ আউট (স্বতন্ত্র কার্ড বাটন) */}
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          className="w-full py-2.5 px-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-[#D32F2F] border border-rose-200 shadow-2xs flex items-center justify-center gap-2 text-xs font-extrabold transition active:scale-[0.99] cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{language === 'bn' ? 'লগ আউট করুন' : 'Log Out'}</span>
        </button>
      </div>

      {/* ================= MODAL: IN-APP UPDATE CONFIRMATION ================= */}
      {showUpdateConfirmModal && updateAvailableInfo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#102A43]">
                    নতুন আপডেট পাওয়া গেছে!
                  </h3>
                  <span className="text-[11px] font-bold text-[#0E6B6B]">
                    ভার্সন v{updateAvailableInfo.version.replace(/^v/i, '')} •{' '}
                    {updateAvailableInfo.sizeMb || '১৮ MB'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUpdateConfirmModal(false)}
                className="text-[#64748B] hover:text-[#102A43] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#102A43] space-y-1">
              <p className="font-bold text-[#0E6B6B]">এই আপডেটে যা থাকছে:</p>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                {updateAvailableInfo.releaseNotes}
              </p>
            </div>

            {isDownloadingUpdate && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold text-[#0E6B6B]">
                  <span>নতুন APK ডাউনলোড হচ্ছে...</span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-[#0E6B6B] transition-all duration-300 rounded-full"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isDownloadingUpdate}
                onClick={() => setShowUpdateConfirmModal(false)}
                className="py-2.5 rounded-xl bg-slate-100 text-[#64748B] text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                পরে করব
              </button>
              <button
                type="button"
                disabled={isDownloadingUpdate}
                onClick={() =>
                  triggerDirectApkDownload(
                    'SahojDokan-POS.apk',
                    updateAvailableInfo.downloadUrl
                  )
                }
                className="py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isDownloadingUpdate ? 'ডাউনলোড হচ্ছে...' : 'এখনই আপডেট করুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SHARE APP LINK ================= */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#102A43]">
                    অ্যাপ শেয়ার করুন
                  </h3>
                  <span className="text-[11px] text-[#64748B]">
                    অন্য দোকানদারকে অ্যাপের লিংক পাঠান
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-[#64748B] hover:text-[#102A43] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleShareViaWhatsApp}
                className="w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>হোয়াটসঅ্যাপে (WhatsApp) শেয়ার করুন</span>
              </button>

              <button
                type="button"
                onClick={handleShareViaSms}
                className="w-full py-2.5 px-4 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] font-bold text-xs flex items-center justify-center gap-2 border border-[#B2DFDB] transition cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>মেসেজে (SMS) লিংক পাঠান</span>
              </button>

              <button
                type="button"
                onClick={handleCopyApkLink}
                className="w-full py-2.5 px-4 rounded-xl bg-[#F1F5F9] hover:bg-slate-200 text-[#102A43] font-bold text-xs flex items-center justify-center gap-2 border border-[#CBD5E1] transition cursor-pointer"
              >
                <Copy className="w-4 h-4 text-[#0E6B6B]" />
                <span>{copiedApkLink ? '✅ লিংক কপি হয়েছে!' : 'ডাউনলোড লিংক কপি করুন'}</span>
              </button>

              <button
                type="button"
                onClick={() => triggerDirectApkDownload('SahojDokan-POS.apk')}
                className="w-full py-2 px-4 rounded-xl bg-white hover:bg-slate-50 text-[#64748B] font-semibold text-[11px] flex items-center justify-center gap-1.5 border border-[#E2E8F0] transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#0E6B6B]" />
                <span>এই ফোনে সরাসরি APK ডাউনলোড করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT SHOP INFO ================= */}
      {showEditInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-4 sm:p-5 shadow-2xl border border-[#E2E8F0] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base text-[#102A43] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#0E6B6B]" />
                <span>দোকানের তথ্য সম্পাদনা</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditInfoModal(false)}
                className="text-[#64748B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfileSubmit} className="space-y-3">
              <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <label className="block text-xs font-bold text-[#102A43] mb-2">
                  দোকানের ফটো বা লোগো (প্রোফাইল ও ক্যাশ মেমোতে দেখাবে)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-[#0E6B6B] bg-white flex items-center justify-center shrink-0">
                    {logo && logo !== defaultAppLogo ? (
                      <img
                        src={logo}
                        alt="Shop Photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="w-6 h-6 text-[#0E6B6B]" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="shop-photo-upload"
                      className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold transition active:scale-95"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>নিজের দোকানের ফটো নিন</span>
                    </label>
                    <input
                      id="shop-photo-upload"
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleLogoUpload}
                    />
                    {logo && logo !== defaultAppLogo && (
                      <button
                        type="button"
                        onClick={() => setLogo(defaultAppLogo)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] text-[11px] font-semibold hover:bg-slate-100"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>ডিফল্ট লোগো</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#102A43] mb-1">
                  দোকানের নাম
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#102A43] mb-1">
                  মালিকের নাম
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#102A43] mb-1">
                    মোবাইল নম্বর
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#102A43] mb-1">
                    ইমেইল
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#102A43] mb-1">
                  ঠিকানা
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="বাজার রোড, ঢাকা"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>

              <div className="pt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditInfoModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-[#64748B] text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold transition cursor-pointer"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHANGE PIN (3 INPUT FIELDS) ================= */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base text-[#102A43] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0E6B6B]" />
                <span>লগইন পিন পরিবর্তন</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="text-[#64748B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePinSubmit} className="space-y-3">
              {/* ১. বর্তমান পিন */}
              <div>
                <label className="block text-xs font-semibold text-[#102A43] mb-1">
                  ১. বর্তমান পিন
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={oldPin}
                  onChange={(e) => {
                    setOldPin(e.target.value.replace(/\D/g, ''));
                    setPinError('');
                  }}
                  placeholder="বর্তমান ৪-সংখ্যার পিন দিন"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-center font-mono tracking-widest text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>

              {/* ২. নতুন পিন */}
              <div>
                <label className="block text-xs font-semibold text-[#102A43] mb-1">
                  ২. নতুন পিন
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value.replace(/\D/g, ''));
                    setPinError('');
                  }}
                  placeholder="নতুন ৪-সংখ্যার পিন (যেমন: ১২৩৪)"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-center font-mono tracking-widest text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>

              {/* ৩. নতুন পিন নিশ্চিত করুন */}
              <div>
                <label className="block text-xs font-semibold text-[#102A43] mb-1">
                  ৩. নতুন পিন নিশ্চিত করুন
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/\D/g, ''));
                    setPinError('');
                  }}
                  placeholder="পুনরায় নতুন পিন লিখুন"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-center font-mono tracking-widest text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>

              {pinError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
                  {pinError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold transition cursor-pointer"
              >
                পিন যাচাই ও পরিবর্তন নিশ্চিত করুন
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: USER GUIDE & TERMS ================= */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base text-[#102A43] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0E6B6B]" />
                <span>ব্যবহার নির্দেশিকা ও শর্তাবলী</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="text-[#64748B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-[#64748B] space-y-2.5 leading-relaxed">
              <p className="font-bold text-[#102A43]">📌 সংক্ষিপ্ত ব্যবহার নির্দেশিকা:</p>
              <p>
                • <b>পণ্য ও স্টক:</b> স্টক মেনু থেকে পণ্য যোগ করুন অথবা বারকোড স্ক্যান করে সরাসরি বিক্রি করুন।
              </p>
              <p>
                • <b>দ্রুত বিক্রি ও চলমান পুঁজি:</b> স্টক এন্ট্রি ছাড়াই ‘দ্রুত বিক্রি’ বাটনে বেচাকেনা ও লাভ এন্ট্রি করা যায় এবং চলমান পুঁজি স্বয়ংক্রিয়ভাবে হিসাব হয়।
              </p>
              <p>
                • <b>বাকি খাতা ও পাইকারি হিসাব:</b> কাস্টমারের বকেয়া এবং মহাজনের পাইকারি ক্রয় সহজেই ট্র্যাক করুন।
              </p>
              <hr className="border-[#E2E8F0] my-1.5" />
              <p className="font-bold text-[#102A43]">🔒 শর্তাবলী ও ডাটা পলিসি:</p>
              <p>১. সহজ দোকান আপনার দোকানের সম্পূর্ণ তথ্য নিরাপদে আপনার নিজস্ব ডিভাইসে ও ক্লাউড ব্যাকআপে সংরক্ষণ করে।</p>
              <p>২. আপনার সম্মতি ছাড়া কোনো ব্যবসায়িক হিসাব বা খাতার তথ্য তৃতীয় পক্ষের কাছে পৌঁছায় না।</p>
              <p>৩. ডাটা নিরাপত্তার জন্য নিয়মিত 'ডাটা ব্যাকআপ ও রিসেট' অপশন থেকে ব্যাকআপ সংরক্ষণ করুন।</p>
              <p>৪. অ্যাপটি শুধুমাত্র বৈধ ব্যবসায়িক হিসাবের জন্য ব্যবহার করুন।</p>
            </div>
            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold transition cursor-pointer"
            >
              বুঝেছি ও সম্মত
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: PRINTER SETUP ================= */}
      {showPrinterModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#102A43]">
                    প্রিন্টার সেটআপ
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Bluetooth ও থার্মাল প্রিন্টার কনফিগারেশন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrinterModal(false)}
                className="w-8 h-8 rounded-full bg-[#EDF2F7] hover:bg-slate-200 text-[#64748B] flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bluetooth className="w-4 h-4 text-[#0E6B6B]" />
                    <span className="text-xs font-bold text-[#102A43]">বর্তমান প্রিন্টার:</span>
                  </div>
                  {connectedPrinter ? (
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]">
                      সংযুক্ত
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-[#64748B]">
                      ডিফল্ট সিস্টেম প্রিন্টার
                    </span>
                  )}
                </div>
                <p className="text-sm font-black text-[#0E6B6B] mt-1 truncate">
                  {connectedPrinter || 'যেকোনো 58mm / 80mm থার্মাল প্রিন্টার'}
                </p>

                {connectedPrinter && (
                  <button
                    type="button"
                    onClick={() => {
                      setConnectedPrinter('');
                      try {
                        localStorage.removeItem('sahoj_printer_name');
                      } catch (_) {}
                    }}
                    className="text-[11px] font-bold text-[#D32F2F] hover:underline mt-1 block"
                  >
                    প্রিন্টার রিমুভ করুন
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1.5">
                  রসিদের কাগজ সাইজ (Thermal Paper Size)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPrinterPaperSize('58mm');
                      try {
                        localStorage.setItem('sahoj_printer_paper', '58mm');
                      } catch (_) {}
                    }}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      printerPaperSize === '58mm'
                        ? 'bg-[#E0F2F1] text-[#0E6B6B] border-[#0E6B6B] shadow-2xs ring-1 ring-[#0E6B6B]'
                        : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-slate-50'
                    }`}
                  >
                    <span>58mm (২ ইঞ্চি)</span>
                    {printerPaperSize === '58mm' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0E6B6B]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrinterPaperSize('80mm');
                      try {
                        localStorage.setItem('sahoj_printer_paper', '80mm');
                      } catch (_) {}
                    }}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      printerPaperSize === '80mm'
                        ? 'bg-[#E0F2F1] text-[#0E6B6B] border-[#0E6B6B] shadow-2xs ring-1 ring-[#0E6B6B]'
                        : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-slate-50'
                    }`}
                  >
                    <span>80mm (৩ ইঞ্চি)</span>
                    {printerPaperSize === '80mm' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0E6B6B]" />
                    )}
                  </button>
                </div>
              </div>

              {printerStatusMessage && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-950">
                  {printerStatusMessage}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleScanBluetoothPrinter}
                  disabled={isScanningBluetooth}
                  className="w-full py-2.5 rounded-2xl bg-[#EDF2F7] hover:bg-slate-200 text-[#102A43] text-xs font-bold flex items-center justify-center gap-2 border border-[#E2E8F0] transition active:scale-[0.99] cursor-pointer"
                >
                  <Bluetooth
                    className={`w-4 h-4 text-[#0E6B6B] ${
                      isScanningBluetooth ? 'animate-pulse' : ''
                    }`}
                  />
                  <span>
                    {isScanningBluetooth
                      ? 'ব্লুটুথ ডিভাইস খোঁজা হচ্ছে...'
                      : 'Bluetooth প্রিন্টার স্ক্যান করুন'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleTestPrint}
                  className="w-full py-3 rounded-2xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99] cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ টেস্ট প্রিন্ট পাঠান ({printerPaperSize})</span>
                </button>

                {testPrintSuccess && (
                  <div className="p-2 rounded-xl bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] text-center text-xs font-bold">
                    ✓ টেস্ট রসিদ সফলভাবে প্রিন্টারে পাঠানো হয়েছে!
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPrinterModal(false)}
              className="mt-2 w-full py-2.5 rounded-xl bg-[#EDF2F7] text-[#102A43] text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
            >
              সম্পন্ন
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: APP REVIEW ================= */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base text-[#102A43] flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>অ্যাপ রেটিং ও মতামত</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-[#64748B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {reviewSubmitted ? (
              <div className="p-4 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-[#102A43]">
                  ধন্যবাদ আপনার মূল্যবান মতামতের জন্য!
                </h4>
                <p className="text-xs text-[#64748B]">
                  সহজ দোকান অ্যাপকে আরও ভালো করতে আমরা সদা সচেষ্ট।
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1 text-2xl transition hover:scale-110 cursor-pointer"
                    >
                      {s <= rating ? '⭐' : '☆'}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="আপনার দোকানের অভিজ্ঞতা বা নতুন ফিচারের পরামর্শ লিখুন..."
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setReviewSubmitted(true);
                    setTimeout(() => {
                      setShowReviewModal(false);
                      setReviewSubmitted(false);
                      setReviewText('');
                      showToast('আপনার রেটিং সফলভাবে জমা হয়েছে!', 'success');
                    }, 1500);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#0E6B6B] text-white text-xs font-bold hover:bg-[#094747] transition cursor-pointer"
                >
                  রেটিং জমা দিন
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: LOG OUT CONFIRMATION ================= */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-rose-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-[#D32F2F] mx-auto flex items-center justify-center">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-[#102A43]">
              আপনি কি অ্যাপ থেকে লগ আউট করতে চান?
            </h3>
            <p className="text-xs text-[#64748B]">
              লগ আউট করলে পুনরায় ৪-সংখ্যার পিন দিয়ে প্রবেশ করতে হবে।
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="py-2.5 rounded-xl bg-slate-100 text-[#64748B] text-xs font-bold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="py-2.5 rounded-xl bg-[#D32F2F] text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                হ্যাঁ, লগ আউট করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: WIPE ALL DEMO & TEST DATA ================= */}
      {showWipeDemoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-rose-200 space-y-3.5">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-[#D32F2F] mx-auto flex items-center justify-center border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-[#102A43]">
                আপনি কি নিশ্চিত সব ডাটা মুছে ফ্রেশ শুরু করতে চান?
              </h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                এটি সকল ডেমো ও পরীক্ষামূলক বিক্রি, দ্রুত বিক্রি, ইনভয়েস, খরচের খাতা, মালিকের লেনদেন, শুরুর পুঁজি এবং কাস্টমার/মহাজনের বকেয়া চিরস্থায়ীভাবে মুছে <strong>৳০</strong> করে দেবে।
              </p>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] cursor-pointer">
              <input
                type="checkbox"
                checked={keepProductsOnWipe}
                onChange={(e) => setKeepProductsOnWipe(e.target.checked)}
                className="w-4 h-4 accent-[#0E6B6B] rounded cursor-pointer"
              />
              <span className="text-xs font-bold text-[#102A43]">
                পণ্য ও স্টক তালিকা অক্ষুণ্ণ রাখুন (প্রোফাইল ও পণ্য থাকবে)
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowWipeDemoModal(false)}
                className="py-2.5 rounded-xl bg-slate-100 text-[#64748B] text-xs font-bold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  DB.wipeAllDemoData(keepProductsOnWipe);
                  onDataRestored();
                  setShowWipeDemoModal(false);
                  showToast(
                    'সব ডেমো ও পরীক্ষামূলক হিসাব চিরস্থায়ীভাবে মুছে ৳০ করা হয়েছে!',
                    'success'
                  );
                }}
                className="py-2.5 rounded-xl bg-[#D32F2F] hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                হ্যাঁ, মুছে ফ্রেশ শুরু করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
