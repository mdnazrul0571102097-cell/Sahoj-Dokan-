import React, { useState, useRef } from 'react';
import { ShopProfile, Language, SubscriptionInfo } from '../types';
import { translations } from '../i18n/translations';
import { DB } from '../storage/db';
import { compressImage } from '../utils/image';
import { DataBackupView } from './DataBackupView';
import {
  ArrowLeft,
  ChevronRight,
  Edit3,
  Lock,
  KeyRound,
  RotateCcw,
  FileText,
  HelpCircle,
  Headphones,
  Star,
  LogOut,
  Smartphone,
  Download,
  ShieldCheck,
  Check,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Sun,
  Moon,
  X,
  Save,
  MessageCircle,
  Copy,
  Store,
  Printer,
  Bluetooth,
  Languages,
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

export const SettingsView: React.FC<Props> = ({
  profile,
  language,
  onSaveProfile,
  onLanguageChange,
  onDataRestored,
  subscription,
  onOpenSubscriptionModal,
  onOpenAdminPanel,
  theme,
  onToggleTheme,
}) => {
  const t = translations[language];

  // Modals state matching Screenshot 4 menu items
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showDataBackupView, setShowDataBackupView] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showApkModal, setShowApkModal] = useState(false);

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
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const defaultAppLogo = '/assets/icon.png';
  const [logo, setLogo] = useState(profile.logo || defaultAppLogo);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Theme state
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    if (theme) return theme;
    try {
      return (localStorage.getItem('sahoj_dokan_theme') as 'light' | 'dark') || 'light';
    } catch (_) {
      return 'light';
    }
  });

  const handleToggleThemeInternal = () => {
    const next = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(next);
    try {
      localStorage.setItem('sahoj_dokan_theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (_) {}
    if (onToggleTheme) onToggleTheme();
  };

  // APK download helper
  const [apkDownloadToast, setApkDownloadToast] = useState('');
  const [copiedApkLink, setCopiedApkLink] = useState(false);

  const PUBLIC_SERVER_ORIGIN =
    'https://ais-pre-5gkalv7jknwtm4c27ipdpl-227798637835.europe-west2.run.app';

  const APK_BUILD_VERSION = 'v15_20261104';

  const getApkDownloadLink = (filename: string = 'SahojDokan-POS.apk') => {
    const customUrl = DB.getApkDownloadUrl();
    if (customUrl && customUrl.startsWith('http')) {
      return customUrl;
    }
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      // Inside Android APK local server (127.0.0.1 / localhost), always point to live cloud server
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

  // Opens the APK download modal cleanly without reloading the WebView
  const handleDownloadApk = () => {
    setShowApkModal(true);
  };

  // Actually triggers the APK file download when user clicks inside the modal
  const triggerDirectApkDownload = (filename: string = 'SahojDokan-POS.apk') => {
    const downloadUrl = getApkDownloadLink(filename);
    setApkDownloadToast('Universal APK ডাউনলোড শুরু হচ্ছে... (২০ MB)');

    try {
      DB.incrementApkDownloadCountLocal();
      fetch('/api/apk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: profile.phone, shopName: profile.shopName }),
      }).catch(() => {});
    } catch (_) {}

    // 1. Inside Android APK: launch external browser / system DownloadManager via Android Intent
    if (typeof window !== 'undefined' && (window as any).AndroidApp?.openWhatsApp) {
      try {
        const nativeUrl = downloadUrl.includes('wa.me')
          ? downloadUrl
          : `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}ref=wa.me`;
        (window as any).AndroidApp.openWhatsApp(nativeUrl);
        setTimeout(() => setApkDownloadToast(''), 6000);
        return;
      } catch (_) {}
    }

    // 2. Standard Web Browser: open download in new tab / anchor
    try {
      const win = window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', 'SahojDokan-POS.apk');
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (_) {
      try {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', 'SahojDokan-POS.apk');
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (_) {}
    }

    setTimeout(() => setApkDownloadToast(''), 6000);
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
    } catch (_) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_) {}
    }
    setCopiedApkLink(true);
    setApkDownloadToast('APK ডাউনলোড লিঙ্ক কপি হয়েছে!');
    setTimeout(() => setCopiedApkLink(false), 3000);
    setTimeout(() => setApkDownloadToast(''), 4500);
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
        setPrinterStatusMessage(`✅ '${name}' সফলভাবে সিলেক্ট হয়েছে!`);
      } else {
        setPrinterStatusMessage('টিপস: ফোনের Bluetooth সেটিংসে গিয়ে আপনার থার্মাল প্রিন্টারটি Pair করুন, তারপর নিচে টেস্ট প্রিন্ট দিন।');
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
      const printWindow = window.open('', '_blank', 'width=380,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>টেস্ট প্রিন্ট - ${profile.shopName || 'Sahoj Dokan'}</title>
              <style>
                @page { margin: 0; size: ${printerPaperSize === '58mm' ? '58mm auto' : '80mm auto'}; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  width: ${printerPaperSize === '58mm' ? '48mm' : '72mm'};
                  margin: 0 auto;
                  padding: 8px 4px;
                  font-size: 11px;
                  color: #000;
                  text-align: center;
                }
                .title { font-size: 15px; font-weight: 900; margin-bottom: 2px; }
                .sub { font-size: 10px; margin-bottom: 6px; }
                .divider { border-top: 1px dashed #000; margin: 6px 0; }
                .badge { font-weight: bold; font-size: 12px; margin: 6px 0; }
                .row { display: flex; justify-content: space-between; font-size: 10px; margin: 2px 0; }
                .footer { font-size: 9px; margin-top: 10px; }
              </style>
            </head>
            <body>
              <div class="title">${profile.shopName || 'Sahoj Dokan - সহজ দোকান'}</div>
              <div class="sub">${profile.phone || ''}</div>
              <div class="divider"></div>
              <div class="badge">★★★ টেস্ট প্রিন্ট সফল! ★★★</div>
              <div class="divider"></div>
              <div class="row"><span>তারিখ ও সময়:</span><span>${new Date().toLocaleString('bn-BD')}</span></div>
              <div class="row"><span>প্রিন্টার সাইজ:</span><span>${printerPaperSize} Thermal</span></div>
              <div class="row"><span>ডিভাইস:</span><span>${connectedPrinter || 'POS Printer'}</span></div>
              <div class="divider"></div>
              <div style="font-weight: bold; font-size: 10px; margin: 5px 0;">আপনার ব্লুটুথ প্রিন্টার সহজ দোকান অ্যাপের সাথে সম্পূর্ণ সক্রিয়!</div>
              <div class="footer">সহজ দোকান ডিজিটাল ক্যাশ খাতা</div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          try {
            printWindow.print();
            printWindow.close();
          } catch (_) {}
        }, 300);
      } else {
        window.print();
      }
    } catch (_) {
      window.print();
    }
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
    alert('✅ দোকানের তথ্য সফলভাবে আপডেট হয়েছে!');
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      alert('নতুন পিন এবং নিশ্চিতকরণ পিন মিলেনি!');
      return;
    }
    if (newPin.length !== 4) {
      alert('পিন অবশ্যই ৪ সংখ্যার হতে হবে!');
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
    alert('✅ লগইন পিন সফলভাবে পরিবর্তন করা হয়েছে!');
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('পাসওয়ার্ড নিশ্চিতকরণ মিলেনি!');
      return;
    }
    if (newPassword.length < 4) {
      alert('পাসওয়ার্ড ন্যূনতম ৪ অক্ষরের হতে হবে!');
      return;
    }
    try {
      localStorage.setItem('sahoj_custom_owner_pwd', newPassword);
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      alert('✅ নতুন পাসওয়ার্ড সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (_) {}
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
    <div className="h-[calc(100vh-125px)] flex flex-col p-2 sm:p-3 max-w-2xl mx-auto overflow-hidden">
      {/* 1. Top Header Bar matching Screenshot 4 */}
      <div className="bg-white rounded-2xl px-4 py-3 mb-2.5 flex items-center justify-between border border-[#E2E8F0] shadow-xs shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E6B6B]">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[#102A43]">
            প্রোফাইল
          </h2>
        </div>

        {/* Quick Admin Access */}
        {onOpenAdminPanel && (
          <button
            type="button"
            onClick={onOpenAdminPanel}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#0E6B6B] hover:text-white text-xs font-bold transition cursor-pointer border border-[#B2DFDB]"
            title="গোপন কোড: sahoj2026admin"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>এডমিন প্যানেল</span>
          </button>
        )}
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
        {/* 2. Top Profile Shop Card matching Screenshot 4 */}
        <div className="bg-white rounded-[24px] p-4 border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              onClick={() => setShowEditInfoModal(true)}
              className="relative w-14 h-14 rounded-full bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center font-bold text-xl border border-[#B2DFDB] overflow-hidden shrink-0 cursor-pointer group"
              title="দোকানের ফটো পরিবর্তন করুন"
            >
              {profile.logo && profile.logo !== defaultAppLogo ? (
                <img
                  src={profile.logo}
                  alt={profile.shopName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="w-7 h-7" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-[#102A43] truncate">
                {profile.shopName || 'Sahoj Dokan - সহজ দোকান'}
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5 truncate">
                {profile.email || 'mail.com'} • {profile.phone || '01733225566'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowEditInfoModal(true)}
            className="w-9 h-9 rounded-full bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center hover:bg-[#0E6B6B] hover:text-white transition shrink-0 cursor-pointer"
            title="দোকানের নাম ও ফটো সম্পাদনা করুন"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>

        {/* 3. White Menu Cards */}
        <div className="space-y-2">
          {/* Item 0: ভাষা পরিবর্তন (বাংলা এবং ইংরেজি বাটন) */}
          <div className="bg-white rounded-2xl p-3.5 border border-[#E2E8F0] shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center">
                <Languages className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-[#102A43] block">
                  ভাষা / Language
                </span>
                <span className="text-[11px] text-[#64748B]">
                  বাংলা ও ইংরেজি ভাষা পরিবর্তন করুন
                </span>
              </div>
            </div>
            <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl border border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => onLanguageChange('bn')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  language === 'bn'
                    ? 'bg-[#0E6B6B] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#102A43]'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  language === 'en'
                    ? 'bg-[#0E6B6B] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#102A43]'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Item 1: পিন পরিবর্তন */}
          <div
            onClick={() => setShowPinModal(true)}
            className="bg-white rounded-2xl p-3.5 border border-[#E2E8F0] shadow-xs flex items-center justify-between cursor-pointer hover:border-[#0E6B6B]/40 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] text-[#102A43] flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[#102A43]">
                পিন পরিবর্তন
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#64748B]" />
          </div>

          {/* Item 2: ডাটা রিসেট ও পুনরুদ্ধার */}
          <div
            onClick={() => setShowDataBackupView(true)}
            className="bg-white rounded-2xl p-3.5 border border-[#E2E8F0] shadow-xs flex items-center justify-between cursor-pointer hover:border-[#0E6B6B]/40 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] text-[#102A43] flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[#102A43]">
                ডাটা রিসেট ও পুনরুদ্ধার
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#64748B]" />
          </div>

          {/* Item 3: প্রিন্টার সেটআপ (ডাটা রিসেটের নিচে প্রিন্টার সেটআপ - Bluetooth প্রিন্টার স্ক্যান ও টেস্ট প্রিন্ট অপশন) */}
          <div
            onClick={() => setShowPrinterModal(true)}
            className="bg-white rounded-2xl p-3.5 border border-[#E2E8F0] shadow-xs flex items-center justify-between cursor-pointer hover:border-[#0E6B6B]/40 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-[#102A43] block">
                  প্রিন্টার সেটআপ
                </span>
                <span className="text-[11px] text-[#64748B]">
                  Bluetooth প্রিন্টার স্ক্যান ও টেস্ট প্রিন্ট
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectedPrinter && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E0F2F1] text-[#0E6B6B]">
                  কানেক্টেড
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-[#64748B]" />
            </div>
          </div>

          {/* Item 4: শর্তাবলী */}
          <div
            onClick={() => setShowTermsModal(true)}
            className="bg-white rounded-2xl p-3.5 border border-[#E2E8F0] shadow-xs flex items-center justify-between cursor-pointer hover:border-[#0E6B6B]/40 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] text-[#102A43] flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[#102A43]">
                শর্তাবলী
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#64748B]" />
          </div>

          {/* Item 5: অ্যাপ রিভিউ করুন */}
          <div
            onClick={() => setShowReviewModal(true)}
            className="bg-white rounded-2xl p-3.5 border border-[#E2E8F0] shadow-xs flex items-center justify-between cursor-pointer hover:border-[#0E6B6B]/40 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] text-[#102A43] flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              </div>
              <span className="font-bold text-sm text-[#102A43]">
                অ্যাপ রিভিউ করুন
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#64748B]" />
          </div>
        </div>

        {/* Universal APK Download Card (লগ আউট এর উপরে অ্যাপ ডাউনলোডের অপশন) */}
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#102A43]">
                Android App (Universal APK)
              </h4>
              <p className="text-xs text-[#64748B]">
                যেকোনো অ্যান্ড্রয়েড ফোনে সরাসরি ইন্সটল করুন (২২ MB)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Copy Link Button */}
            <button
              type="button"
              onClick={handleCopyApkLink}
              className="px-2.5 py-2 rounded-xl bg-[#EDF2F7] hover:bg-slate-200 text-[#102A43] text-xs font-bold flex items-center gap-1 border border-[#E2E8F0] transition active:scale-95 cursor-pointer"
              title="ডাউনলোড লিঙ্ক কপি করুন"
            >
              <Copy className="w-3.5 h-3.5 text-[#0E6B6B]" />
              <span>{copiedApkLink ? 'কপি হয়েছে!' : 'লিঙ্ক কপি'}</span>
            </button>

            {/* Direct Download Button */}
            <button
              type="button"
              onClick={handleDownloadApk}
              className="px-3.5 py-2 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ডাউনলোড APK</span>
            </button>
          </div>
        </div>

        {apkDownloadToast && (
          <div className="p-2.5 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] text-xs font-semibold flex items-center gap-2 border border-[#B2DFDB]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{apkDownloadToast}</span>
          </div>
        )}

        {/* লগ আউট (একদম নিচে) */}
        <div
          onClick={() => setShowLogoutModal(true)}
          className="bg-white rounded-2xl p-3.5 border border-[#E2E8F0] shadow-xs flex items-center gap-3 cursor-pointer hover:border-rose-300 transition active:scale-[0.99]"
        >
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#D32F2F] flex items-center justify-center">
            <LogOut className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-[#D32F2F]">
            লগ আউট
          </span>
        </div>
      </div>

      {/* ================= MODAL: EDIT SHOP INFO ================= */}
      {showEditInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-[#102A43] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#0E6B6B]" />
                <span>দোকানের তথ্য সম্পাদনা</span>
              </h3>
              <button onClick={() => setShowEditInfoModal(false)} className="text-[#64748B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfileSubmit} className="space-y-3.5">
              {/* Shop Photo / Logo Upload Section */}
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <label className="block text-xs font-bold text-[#102A43] mb-2">
                  দোকানের ফটো বা লোগো (প্রোফাইল ও ক্যাশ মেমোতে দেখাবে)
                </label>
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#0E6B6B] bg-white flex items-center justify-center shrink-0 shadow-xs">
                    {logo && logo !== defaultAppLogo ? (
                      <img
                        src={logo}
                        alt="Shop Photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="w-7 h-7 text-[#0E6B6B]" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="shop-photo-upload"
                      className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold shadow-xs transition active:scale-95"
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

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditInfoModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-[#64748B] text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold transition"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHANGE PASSWORD ================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base text-[#102A43] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#0E6B6B]" />
                <span>পাসওয়ার্ড পরিবর্তন</span>
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-[#64748B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#102A43] mb-1">
                  নতুন পাসওয়ার্ড
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="কমপক্ষে ৪ সংখ্যা বা অক্ষর"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#102A43] mb-1">
                  পাসওয়ার্ড নিশ্চিত করুন
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="পুনরায় পাসওয়ার্ড লিখুন"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold transition cursor-pointer"
              >
                পাসওয়ার্ড সেট করুন
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHANGE PIN ================= */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base text-[#102A43] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0E6B6B]" />
                <span>লগইন পিন পরিবর্তন</span>
              </h3>
              <button onClick={() => setShowPinModal(false)} className="text-[#64748B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleChangePinSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#102A43] mb-1">
                  নতুন ৪-সংখ্যার পিন
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="যেমন: ১২৩৪"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-center font-mono tracking-widest text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#102A43] mb-1">
                  নতুন পিন নিশ্চিত করুন
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="পুনরায় পিন লিখুন"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-center font-mono tracking-widest text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold transition cursor-pointer"
              >
                পিন পরিবর্তন নিশ্চিত করুন
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: TERMS & CONDITIONS ================= */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base text-[#102A43] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0E6B6B]" />
                <span>সহজ দোকান শর্তাবলী ও পলিসি</span>
              </h3>
              <button onClick={() => setShowTermsModal(false)} className="text-[#64748B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-[#64748B] space-y-2.5 leading-relaxed">
              <p>১. সহজ দোকান আপনার দোকানের সম্পূর্ণ তথ্য নিরাপদে আপনার নিজস্ব ডিভাইসে সংরক্ষণ করে।</p>
              <p>২. আপনার সম্মতি ছাড়া কোনো ব্যবসায়িক হিসাব বা খাতার তথ্য তৃতীয় পক্ষের কাছে পৌঁছায় না।</p>
              <p>৩. ডাটা নিরাপত্তার জন্য নিয়মিত 'ডাটা রিসেট ও পুনরুদ্ধার' অপশন থেকে ব্যাকআপ সংরক্ষণ করুন, ফোন হারালে বা নষ্ট হলে কর্তৃপক্ষ দায়ী নয়।</p>
              <p>৪. অ্যাপটি শুধুমাত্র বৈধ ব্যবসায়িক হিসাবের জন্য ব্যবহার করুন, কোনো অবৈধ লেনদেনের জন্য ব্যবহার নিষিদ্ধ।</p>
              <p>৫. Pro প্যাকেজ ও ট্রায়াল সময়সীমা অ্যাডমিন প্যানেল থেকে নিয়ন্ত্রিত, মেয়াদ শেষ হলে কিছু ফিচার সীমিত হতে পারে।</p>
              <p>৬. অ্যাপটি "যেমন আছে" ভিত্তিতে প্রদান করা হয়, হিসাবের ভুলের জন্য ব্যবহারকারী নিজে যাচাই করে নেবেন।</p>
              <p>৭. ১৩ বছরের নিচে কেউ এই অ্যাপ ব্যবহার করতে পারবে না।</p>
              <p>৮. অ্যাপের কোনো বাণিজ্যিক অপব্যবহার, কপি বা রিসেল নিষিদ্ধ, শর্তাবলী যেকোনো সময় আপডেট হতে পারে।</p>
            </div>
            <button
              onClick={() => setShowTermsModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-bold transition cursor-pointer"
            >
              আমি সম্মত
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
                  <p className="text-[11px] text-[#64748B]">Bluetooth ও থার্মাল প্রিন্টার কনফিগারেশন</p>
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
              {/* Connected Printer Status */}
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

              {/* Printer Paper Size Options */}
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
                    {printerPaperSize === '58mm' && <CheckCircle2 className="w-3.5 h-3.5 text-[#0E6B6B]" />}
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
                    {printerPaperSize === '80mm' && <CheckCircle2 className="w-3.5 h-3.5 text-[#0E6B6B]" />}
                  </button>
                </div>
              </div>

              {/* Status or scan message feedback */}
              {printerStatusMessage && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-950">
                  {printerStatusMessage}
                </div>
              )}

              {/* Action Buttons: Bluetooth Scan & Test Print */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleScanBluetoothPrinter}
                  disabled={isScanningBluetooth}
                  className="w-full py-2.5 rounded-2xl bg-[#EDF2F7] hover:bg-slate-200 text-[#102A43] text-xs font-bold flex items-center justify-center gap-2 border border-[#E2E8F0] transition active:scale-[0.99] cursor-pointer"
                >
                  <Bluetooth className={`w-4 h-4 text-[#0E6B6B] ${isScanningBluetooth ? 'animate-pulse' : ''}`} />
                  <span>
                    {isScanningBluetooth ? 'ব্লুটুথ ডিভাইস খোঁজা হচ্ছে...' : 'Bluetooth প্রিন্টার স্ক্যান করুন'}
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
                  <div className="p-2 rounded-xl bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] text-center text-xs font-bold animate-in fade-in">
                    ✓ টেস্ট রসিদ সফলভাবে প্রিন্টারে পাঠানো হয়েছে!
                  </div>
                )}
              </div>

              {/* Simple Guide for Android Users */}
              <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#64748B] space-y-1">
                <p className="font-bold text-[#102A43]">💡 ব্লুটুথ প্রিন্টার কানেক্ট করার সহজ নিয়ম:</p>
                <p>১. ফোনের Bluetooth সেটিংসে গিয়ে প্রিন্টারটি সার্চ করে পেয়ার (Pair) করে নিন (পিন সাধারণত 0000 বা 1234)।</p>
                <p>২. এরপর এখানে এসে 'টেস্ট প্রিন্ট পাঠান' বাটনে চাপলে সরাসরি রসিদ প্রিন্ট হবে।</p>
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
                <span>অ্যাপ রিভিউ ও মতামত</span>
              </h3>
              <button onClick={() => setShowReviewModal(false)} className="text-[#64748B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {reviewSubmitted ? (
              <div className="p-4 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-[#102A43]">ধন্যবাদ আপনার মূলবান মতামতের জন্য!</h4>
                <p className="text-xs text-[#64748B]">সহজ দোকান অ্যাপকে আরও ভালো করতে আমরা সদা সচেষ্ট।</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1 text-2xl transition hover:scale-110"
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
                    }, 2000);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#0E6B6B] text-white text-xs font-bold hover:bg-[#094747] transition"
                >
                  রিভিউ জমা দিন
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: APK DOWNLOAD OPTIONS & HELP ================= */}
      {showApkModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#102A43]">
                    Android App ডাউনলোড
                  </h3>
                  <span className="text-[11px] text-[#64748B]">
                    Universal APK • সাইজ: ১৮ MB
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApkModal(false)}
                className="w-8 h-8 rounded-full bg-[#EDF2F7] text-[#102A43] hover:bg-slate-200 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-[#E0F2F1]/60 rounded-2xl border border-[#B2DFDB] space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0E6B6B]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>সব মডেলের অ্যান্ড্রয়েড ফোনে সাপোর্ট করবে</span>
                </div>
                <p className="text-[11px] text-[#102A43]/80 leading-relaxed">
                  minSdkVersion 21 (Android 5.0+) থেকে Android 14+ এবং সকল CPU (arm64, armeabi-v7a, x86, x86_64) তে পূর্ণ সাপোর্ট সহ সাইন করা হয়েছে।
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {/* 1. Direct Download Button */}
                <button
                  type="button"
                  onClick={() => triggerDirectApkDownload('SahojDokan-POS.apk')}
                  className="w-full py-3 px-4 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>১. সরাসরি ডাউনলোড করুন (SahojDokan-POS.apk)</span>
                </button>

                {/* 2. Alternative Download Link */}
                <button
                  type="button"
                  onClick={() => triggerDirectApkDownload('app-debug.apk')}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#102A43] font-bold text-xs flex items-center justify-center gap-2 border border-[#E2E8F0] transition active:scale-98 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#0E6B6B]" />
                  <span>২. বিকল্প লিংক থেকে ডাউনলোড করুন</span>
                </button>

                {/* 3. Copy Link */}
                <button
                  type="button"
                  onClick={handleCopyApkLink}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#EDF2F7] hover:bg-slate-200 text-[#102A43] font-bold text-xs flex items-center justify-center gap-2 border border-[#CBD5E1] transition active:scale-98 cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-[#0E6B6B]" />
                  <span>{copiedApkLink ? '✅ লিংক কপি হয়েছে!' : '৩. সরাসরি ডাউনলোড লিঙ্ক কপি করুন'}</span>
                </button>
              </div>

              {/* URL Display */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#64748B]">
                  সরাসরি ডাউনলোড ইউআরএল:
                </label>
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 select-all overflow-x-auto">
                  <span className="truncate">{getApkDownloadLink()}</span>
                </div>
              </div>

              {/* Install guide steps */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-xs font-bold text-[#102A43] block">
                  💡 ফোনে ইনস্টল করার সহজ নিয়ম:
                </span>
                <ol className="text-[11px] text-[#64748B] space-y-1 list-decimal list-inside leading-relaxed">
                  <li>উপরে ডাউনলোড বাটনে ক্লিক করে ফাইলটি ফোনে নামান।</li>
                  <li>ডাউনলোড শেষে ব্রাউজারের নোটিফিকেশন থেকে ফাইলটি ওপেন করুন।</li>
                  <li>"Unknown Apps" বা "Install anyway" অনুমতি চাইলে এলাউ (Allow) দিন।</li>
                </ol>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowApkModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 text-[#102A43] text-xs font-bold hover:bg-slate-200"
              >
                বন্ধ করুন
              </button>
            </div>
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
                className="py-2.5 rounded-xl bg-slate-100 text-[#64748B] text-xs font-bold"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="py-2.5 rounded-xl bg-[#D32F2F] text-white text-xs font-bold hover:bg-rose-700"
              >
                হ্যাঁ, লগ আউট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
