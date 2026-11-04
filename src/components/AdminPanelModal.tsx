import React, { useState, useEffect } from 'react';
import { PaymentRequest, SubscriptionInfo, ShopProfile, Language, RegisteredShopUser } from '../types';
import { DB } from '../storage/db';
import { getSubscriptionDetails } from '../utils/license';
import { CloudSync } from '../services/cloudSync';
import {
  ShieldAlert,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Lock,
  Unlock,
  Ban,
  Download,
  Smartphone,
  Search,
  Filter,
  Eye,
  EyeOff,
  X,
  KeyRound,
  Copy,
  Check,
  Send,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Phone,
  Crown,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: ShopProfile;
  currentSubscription: SubscriptionInfo;
  language: Language;
  onSubscriptionUpdated: (newSub: SubscriptionInfo) => void;
}

export const AdminPanelModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentProfile,
  currentSubscription,
  language,
  onSubscriptionUpdated,
}) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [showAdminPin, setShowAdminPin] = useState(true);
  const [authError, setAuthError] = useState('');

  // Admin Data states
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Manual License Generator state (100% Free & Automatic)
  const [manualPhone, setManualPhone] = useState('');
  const [manualPlan, setManualPlan] = useState<'monthly' | 'yearly' | 'lifetime'>('yearly');
  const [manualCustomDays, setManualCustomDays] = useState(365);
  const [generatedKeyResult, setGeneratedKeyResult] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Change Admin Password State
  const [showPasswordChangeForm, setShowPasswordChangeForm] = useState(false);
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [passChangeSuccess, setPassChangeSuccess] = useState('');
  const [passChangeError, setPassChangeError] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Custom APK Update Link State
  const [customApkUrl, setCustomApkUrl] = useState(() => DB.getApkDownloadUrl());
  const [apkUrlSavedToast, setApkUrlSavedToast] = useState('');

  // Registered Users, Downloads & Block/Unblock State
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredShopUser[]>(() =>
    DB.getRegisteredUsersLocal()
  );
  const [totalDownloads, setTotalDownloads] = useState<number>(() =>
    Math.max(DB.getApkDownloadCountLocal(), DB.getRegisteredUsersLocal().length, 1)
  );
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [directBlockPhone, setDirectBlockPhone] = useState('');
  const [directBlockReason, setDirectBlockReason] = useState('');
  const [blockActionLoading, setBlockActionLoading] = useState<string | null>(null);
  const [blockStatusToast, setBlockStatusToast] = useState('');

  const handleSaveApkUrl = (e: React.FormEvent) => {
    e.preventDefault();
    DB.saveApkDownloadUrl(customApkUrl.trim());
    setApkUrlSavedToast('APK ডাউনলোড ও আপডেট লিংক সফলভাবে সংরক্ষিত হয়েছে!');
    setTimeout(() => setApkUrlSavedToast(''), 3500);
  };

  const fetchUsersAndDownloads = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await CloudSync.fetchAdminUsersAndDownloads();
      setRegisteredUsers(res.users);
      setTotalDownloads(Math.max(res.totalDownloads, res.users.length, 1));
    } catch (_) {
      const localUsers = DB.getRegisteredUsersLocal();
      setRegisteredUsers(localUsers);
      setTotalDownloads(Math.max(DB.getApkDownloadCountLocal(), localUsers.length, 1));
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleToggleUserBlock = async (
    targetPhone: string,
    shouldBlock: boolean,
    customReason?: string
  ) => {
    const clean = targetPhone.replace(/\D/g, '').slice(-10);
    if (!clean || clean.length < 10) {
      setBlockStatusToast('⚠️ সঠিক ১০ বা ১১ ডিজিটের মোবাইল নম্বর দিন!');
      setTimeout(() => setBlockStatusToast(''), 3500);
      return;
    }

    setBlockActionLoading(clean);
    try {
      const res = await CloudSync.toggleBlockUser(clean, shouldBlock, customReason);
      setBlockStatusToast(res.message);
      setTimeout(() => setBlockStatusToast(''), 4000);
      await fetchUsersAndDownloads();
    } catch (err: any) {
      setBlockStatusToast('ত্রুটি: ' + err.message);
    } finally {
      setBlockActionLoading(null);
    }
  };

  const handleDirectBlockSubmit = async (e: React.FormEvent, shouldBlock: boolean) => {
    e.preventDefault();
    if (!directBlockPhone.trim()) return;
    await handleToggleUserBlock(directBlockPhone.trim(), shouldBlock, directBlockReason.trim());
    setDirectBlockPhone('');
    setDirectBlockReason('');
  };

  // Load payment requests from local DB + optional server sync
  const fetchRequests = async () => {
    // 1. Get from local DB first
    const local = DB.getPaymentRequests();
    setPaymentRequests(local);

    // 2. Fetch server updates if online
    try {
      const res = await fetch('/api/payment-requests');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.requests)) {
          // Merge with local
          const merged = [...data.requests];
          for (const l of local) {
            if (!merged.some((m: any) => m.id === l.id || m.transactionId === l.transactionId)) {
              merged.push(l);
            }
          }
          setPaymentRequests(merged);
          DB.savePaymentRequests(merged);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen && isAdminAuthenticated) {
      fetchRequests();
      fetchUsersAndDownloads();
    }
  }, [isOpen, isAdminAuthenticated]);

  if (!isOpen) return null;

  // Handle Admin PIN / Password Login
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const entered = adminPinInput.trim();
    const savedPass = DB.getAdminPassword();
    // Admin panel opens strictly with sahoj2026admin or saved updated admin password.
    // Zero phone numbers or 4-digit store PINs are permitted.
    if (entered === 'sahoj2026admin' || (savedPass && entered === savedPass)) {
      setIsAdminAuthenticated(true);
      setAdminPinInput('');
    } else {
      setAuthError('ভুল অ্যাডমিন পাসওয়ার্ড! সঠিক গোপন কোড দিয়ে প্রবেশ করুন।');
    }
  };

  // Handle Admin Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassChangeError('');
    setPassChangeSuccess('');

    const saved = DB.getAdminPassword();
    const enteredCurrent = currentPassInput.trim();
    const isValidCurrent = enteredCurrent === 'sahoj2026admin' || (saved && enteredCurrent === saved);

    if (!isValidCurrent) {
      setPassChangeError('বর্তমান পাসওয়ার্ড সঠিক নয়!');
      return;
    }
    if (newPassInput.trim().length < 4) {
      setPassChangeError('নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
      return;
    }
    if (newPassInput !== confirmPassInput) {
      setPassChangeError('নতুন পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ড মিলছে না!');
      return;
    }

    setIsChangingPass(true);
    try {
      const cleanNew = newPassInput.trim();
      DB.saveAdminPassword(cleanNew);

      // Attempt server sync
      try {
        await fetch('/api/admin/change-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPin: currentPassInput, newPin: cleanNew }),
        });
      } catch (_) {}

      // Save to Firebase Firestore admin_config for multi-device sync
      try {
        const { firestore } = await import('../services/firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(
          doc(firestore, 'admin_config', 'credentials'),
          {
            adminPassword: cleanNew,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (_) {}

      setPassChangeSuccess('✅ অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে!');
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setTimeout(() => setPassChangeSuccess(''), 4500);
    } catch (err: any) {
      setPassChangeError('পাসওয়ার্ড পরিবর্তনে ত্রুটি: ' + err.message);
    } finally {
      setIsChangingPass(false);
    }
  };

  // Handle Approve Payment Request
  const handleApprove = async (req: PaymentRequest) => {
    setActionLoading(req.id);
    const durationDays = req.plan === 'yearly' ? 365 : 30;

    // Call server to generate signed license
    let generatedLicenseKey = '';
    try {
      const res = await fetch('/api/admin/approve-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          adminPin: DB.getAdminPassword() || 'sahoj2026admin',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        generatedLicenseKey = data.licenseKey;
      }
    } catch (_) {}

    // Fallback client-side signing if server unreachable
    if (!generatedLicenseKey) {
      const now = Date.now();
      const expiresAt = now + durationDays * 24 * 3600 * 1000;
      const payload = {
        shopId: req.shopId,
        shopPhone: req.shopPhone,
        plan: req.plan,
        issuedAt: now,
        expiresAt,
      };
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      const sig = Math.abs(req.shopPhone.split('').reduce((a, b) => a + b.charCodeAt(0), 0) * 8831).toString(16).toUpperCase().padStart(12, 'A');
      generatedLicenseKey = `SAHOJ-${req.plan.toUpperCase()}-${b64}-${sig}`;
    }

    // Update in local DB
    DB.updatePaymentRequest(req.id, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      generatedLicenseKey,
    });

    // If this payment was for the current active shop, activate immediately!
    const currentNorm = (currentProfile.phone || '').replace(/\D/g, '').slice(-10);
    const reqNorm = (req.shopPhone || '').replace(/\D/g, '').slice(-10);
    if (req.shopId === currentProfile.shopId || (currentNorm && currentNorm === reqNorm)) {
      const updatedSub = DB.activatePro(req.plan, durationDays, generatedLicenseKey);
      onSubscriptionUpdated(updatedSub);
    }

    setPaymentRequests(DB.getPaymentRequests());
    setActionLoading(null);
  };

  // Handle Reject Payment Request
  const handleReject = async (req: PaymentRequest) => {
    const reason = prompt('বাতিল করার কারণ লিখুন (ঐচ্ছিক):', 'টাকা পাওয়া যায়নি বা ভুল Transaction ID') || 'বাতিল';
    setActionLoading(req.id);

    try {
      await fetch('/api/admin/reject-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          reason,
          adminPin: DB.getAdminPassword() || 'sahoj2026admin',
        }),
      });
    } catch (_) {}

    DB.updatePaymentRequest(req.id, {
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      rejectionReason: reason,
    });

    setPaymentRequests(DB.getPaymentRequests());
    setActionLoading(null);
  };

  // Handle Generate Manual License Key (100% Automatic & Free for Admin)
  const handleGenerateManualLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone.trim()) {
      alert('গ্রাহকের মোবাইল নম্বর দিন!');
      return;
    }

    const durationDays =
      manualPlan === 'lifetime' ? 36500 : manualPlan === 'yearly' ? 365 : 30;
    let key = '';

    try {
      const res = await fetch('/api/admin/generate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: manualPhone.trim(),
          plan: manualPlan,
          adminPin: DB.getAdminPassword() || 'sahoj2026admin',
          customDays: durationDays,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        key = data.licenseKey;
      }
    } catch (_) {}

    if (!key) {
      const now = Date.now();
      const expiresAt = now + durationDays * 24 * 3600 * 1000;
      const payload = {
        shopId: `SD-${manualPhone.replace(/\D/g, '').slice(-10)}`,
        shopPhone: manualPhone.trim(),
        plan: manualPlan,
        issuedAt: now,
        expiresAt,
      };
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      const sig = Math.abs(
        manualPhone.split('').reduce((a, b) => a + b.charCodeAt(0), 0) * 8831
      )
        .toString(16)
        .toUpperCase()
        .padStart(12, 'B');
      key = `SAHOJ-${manualPlan.toUpperCase()}-${b64}-${sig}`;
    }

    setGeneratedKeyResult(key);
  };

  // Copy Key
  const handleCopyKey = () => {
    if (generatedKeyResult) {
      navigator.clipboard.writeText(generatedKeyResult);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  // Send Key to customer via WhatsApp
  const handleSendKeyWhatsApp = (phone: string, key: string, plan: string) => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-11);
    const fullPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    const planText =
      plan === 'lifetime' ? 'আজীবন (Lifetime)' : plan === 'yearly' ? 'বার্ষিক (৩৬৫ দিন)' : 'মাসিক (৩০ দিন)';
    const msg =
      `আসসালামু আলাইকুম। সহজ দোকান - Sahoj Dokan থেকে আপনার ${planText} Pro লাইসেন্স কোড নিচে দেওয়া হলো:\n\n` +
      `লাইসেন্স কোড:\n${key}\n\n` +
      `অ্যাপের Pro পেজে গিয়ে "লাইসেন্স কোড পেয়েছেন? সরাসরি সক্রিয় করুন" বক্সে কোডটি পেস্ট করে সক্রিয় করে নিন। ধন্যবাদ!`;
    const url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(msg)}`;
    if (typeof window !== 'undefined' && (window as any).AndroidApp?.openWhatsApp) {
      try {
        (window as any).AndroidApp.openWhatsApp(url);
        return;
      } catch (_) {}
    }
    window.open(url, '_blank');
  };

  // Statistics calculation
  const totalRequests = paymentRequests.length;
  const pendingRequests = paymentRequests.filter((r) => r.status === 'pending');
  const approvedRequests = paymentRequests.filter((r) => r.status === 'approved');
  const rejectedRequests = paymentRequests.filter((r) => r.status === 'rejected');

  const filteredRequests = paymentRequests.filter((r) => {
    const matchFilter = selectedFilter === 'all' || r.status === selectedFilter;
    const matchSearch =
      !searchQuery.trim() ||
      r.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.shopPhone.includes(searchQuery) ||
      r.senderPhone.includes(searchQuery) ||
      r.transactionId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-4xl my-auto overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-300 dark:bg-slate-900 dark:border-slate-800">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow">
              <ShieldAlert className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">সহজ দোকান POS - অ্যাডমিন প্যানেল</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  অফিসিয়াল কন্ট্রোল
                </span>
              </div>
              <p className="text-xs text-slate-400">
                পেমেন্ট যাচাই, লাইসেন্স তৈরি ও গ্রাহক সাবস্ক্রিপশন ব্যবস্থাপনা
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= 1. ADMIN AUTHENTICATION ================= */}
        {!isAdminAuthenticated ? (
          <form onSubmit={handleAdminLogin} className="p-8 max-w-md mx-auto text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mx-auto flex items-center justify-center shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-lg text-slate-800 dark:text-white">
                অ্যাডমিন পিন দিয়ে প্রবেশ করুন
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                এই অংশটি শুধুমাত্র অ্যাপের মালিক বা অ্যাডমিনের জন্য সুরক্ষিত।
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
                {authError}
              </div>
            )}

            <div className="relative">
              <input
                type={showAdminPin ? 'text' : 'password'}
                autoFocus
                required
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                placeholder="অ্যাডমিন পাসওয়ার্ড লিখুন"
                className="w-full px-4 py-3.5 pr-12 rounded-2xl border-2 border-[#0E6B6B] bg-[#102A43] !text-white placeholder-slate-400 text-center font-mono text-lg font-bold tracking-wider focus:ring-2 focus:ring-emerald-400 focus:outline-none shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowAdminPin(!showAdminPin)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white p-1"
                title={showAdminPin ? 'লুকান' : 'দেখুন'}
              >
                {showAdminPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-[#0E6B6B] hover:bg-[#094747] text-white font-bold rounded-2xl shadow transition active:scale-95 cursor-pointer"
            >
              প্রবেশ করুন
            </button>
          </form>
        ) : (
          /* ================= 2. AUTHENTICATED ADMIN DASHBOARD ================= */
          <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto space-y-6">
            
            {/* Special Master Owner Activation Card */}
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/20 via-yellow-400/15 to-amber-500/20 border-2 border-amber-400 dark:border-amber-500/60 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-400 text-slate-950 shrink-0 shadow">
                    <Crown className="w-6 h-6 fill-slate-950" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                        অ্যাপের মালিক মোড (Super Admin Lifetime Access)
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                        স্থায়ী ফ্রি
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                      আপনি এই অ্যাপের সম্মানিত প্রতিষ্ঠাতা ও মালিক। আপনার যেকোনো ফোনে আজীবন কোনো প্রকার ট্রায়াল সীমা বা সাবস্ক্রিপশন ফি ছাড়াই Pro সুবিধা সবসময় চালু থাকবে।
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const updated = DB.activateOwnerLifetime();
                    onSubscriptionUpdated(updated);
                    alert('👑 অভিনন্দন! আপনার ফোনটিতে আজীবন আনলিমিটেড Pro এক্সেস সক্রিয় করা হয়েছে। কোনোদিন কোনো ফি লাগবে না।');
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Crown className="w-4 h-4 fill-slate-950" />
                  <span>এই ফোনে আজীবন Pro চালু করুন</span>
                </button>
              </div>
            </div>

            {/* Summary Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="block text-[11px] font-bold text-slate-500 uppercase">মোট আবেদন</span>
                <span className="text-xl font-black text-slate-800 dark:text-white">{totalRequests}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <span className="block text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">অপেক্ষমান (Pending)</span>
                <span className="text-xl font-black text-amber-800 dark:text-amber-300">{pendingRequests.length}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">অনুমোদিত (Pro চালু)</span>
                <span className="text-xl font-black text-emerald-800 dark:text-emerald-300">{approvedRequests.length}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                <span className="block text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase">বাতিল (Rejected)</span>
                <span className="text-xl font-black text-rose-800 dark:text-rose-300">{rejectedRequests.length}</span>
              </div>
            </div>

            {/* ================= NEW: APP DOWNLOADS, USERS & REMOTE BLOCK/UNBLOCK SECTION ================= */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-[#0E6B6B]/40 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      অ্যাপ ডাউনলোড তালিকা ও ইউজার ব্লক / আনব্লক কন্ট্রোল
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      কে কে অ্যাপ ডাউনলোড ও রেজিস্ট্রেশন করেছে দেখুন এবং যেকোনো ইউজারকে ব্লক বা আনব্লক করুন
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchUsersAndDownloads}
                  disabled={isLoadingUsers}
                  className="px-3 py-1.5 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#0E6B6B] hover:text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                  <span>তালিকা রিফ্রেশ</span>
                </button>
              </div>

              {/* Download & User Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500">মোট ডাউনলোড</span>
                    <span className="text-base font-black text-[#102A43] dark:text-white">
                      {totalDownloads} জন
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500">রেজিস্টার্ড দোকান</span>
                    <span className="text-base font-black text-[#102A43] dark:text-white">
                      {registeredUsers.length} টি
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-emerald-700">সচল ইউজার</span>
                    <span className="text-base font-black text-emerald-800 dark:text-emerald-300">
                      {registeredUsers.filter((u) => !u.isBlocked).length} জন
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <Ban className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-rose-700">ব্লক করা ইউজার</span>
                    <span className="text-base font-black text-rose-800 dark:text-rose-300">
                      {registeredUsers.filter((u) => u.isBlocked).length} জন
                    </span>
                  </div>
                </div>
              </div>

              {blockStatusToast && (
                <div className="p-3 rounded-xl bg-[#102A43] text-white text-xs font-bold flex items-center gap-2 shadow">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{blockStatusToast}</span>
                </div>
              )}

              {/* Direct Phone Number Block / Unblock Box */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 space-y-2.5">
                <span className="block text-xs font-bold text-[#102A43] dark:text-white">
                  মোবাইল নম্বর দিয়ে সরাসরি যেকোনো গ্রাহককে ব্লক বা আনব্লক (খুলে দিন) করুন:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="tel"
                    value={directBlockPhone}
                    onChange={(e) => setDirectBlockPhone(e.target.value)}
                    placeholder="মোবাইল নম্বর (যেমন: 017xxxxxxxx)"
                    className="px-3 py-2 rounded-xl bg-[#102A43] border border-[#0E6B6B] !text-white placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="text"
                    value={directBlockReason}
                    onChange={(e) => setDirectBlockReason(e.target.value)}
                    placeholder="কারণ (ঐচ্ছিক, যেমন: মেয়াদ শেষ)"
                    className="px-3 py-2 rounded-xl bg-[#102A43] border border-[#0E6B6B] !text-white placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={(e) => handleDirectBlockSubmit(e, true)}
                    disabled={!directBlockPhone.trim() || Boolean(blockActionLoading)}
                    className="px-3 py-2 rounded-xl bg-[#D32F2F] hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition active:scale-95 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>ব্লক করুন</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDirectBlockSubmit(e, false)}
                    disabled={!directBlockPhone.trim() || Boolean(blockActionLoading)}
                    className="px-3 py-2 rounded-xl bg-[#2E7D32] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition active:scale-95 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>আনব্লক (খুলে দিন)</span>
                  </button>
                </div>
              </div>

              {/* Search Registered Users */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  ডাউনলোড ও রেজিস্টার্ড ইউজারদের তালিকা ({registeredUsers.length}):
                </span>
                <div className="relative w-48 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="দোকান বা মোবাইল নম্বর খুঁজুন..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-[#102A43] dark:text-white"
                  />
                </div>
              </div>

              {/* Users List */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {registeredUsers
                  .filter((u) => {
                    if (!userSearchQuery.trim()) return true;
                    const q = userSearchQuery.toLowerCase();
                    return (
                      u.shopName.toLowerCase().includes(q) ||
                      u.ownerName.toLowerCase().includes(q) ||
                      u.fullPhone.includes(q) ||
                      u.phone.includes(q) ||
                      u.shopId.toLowerCase().includes(q)
                    );
                  })
                  .map((u) => (
                    <div
                      key={u.phone}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition ${
                        u.isBlocked
                          ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                          : 'bg-[#F8FAFC] dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm text-[#102A43] dark:text-white truncate">
                            {u.shopName || 'সহজ দোকান'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {u.shopId}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.isBlocked
                                ? 'bg-[#D32F2F] text-white'
                                : u.status === 'pro'
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-[#E0F2F1] text-[#0E6B6B]'
                            }`}
                          >
                            {u.isBlocked
                              ? '🚫 ব্লক করা'
                              : u.plan === 'lifetime'
                              ? '👑 আজীবন Pro'
                              : u.status === 'pro'
                              ? '⭐ Pro গ্রাহক'
                              : '৬০ দিন ট্রায়াল'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {u.platform || 'Android APK'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                          <span className="font-bold text-[#102A43] dark:text-slate-200">
                            📞 {u.fullPhone}
                          </span>
                          {u.ownerName && <span>মালিক: {u.ownerName}</span>}
                          <span>পণ্য: {u.productsCount ?? 0}টি</span>
                          <span>বিক্রি: {u.salesCount ?? 0}টি</span>
                          <span>
                            সক্রিয়: {new Date(u.lastActiveAt).toLocaleDateString('bn-BD')}
                          </span>
                        </div>

                        {u.isBlocked && u.blockReason && (
                          <p className="text-[11px] font-bold text-[#D32F2F]">
                            ব্লক কারণ: {u.blockReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {u.isBlocked ? (
                          <button
                            type="button"
                            disabled={blockActionLoading === u.phone}
                            onClick={() => handleToggleUserBlock(u.phone, false)}
                            className="px-3.5 py-2 rounded-xl bg-[#2E7D32] hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>আনব্লক করুন (খুলে দিন)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={blockActionLoading === u.phone}
                            onClick={() =>
                              handleToggleUserBlock(
                                u.phone,
                                true,
                                'অ্যাডমিন কর্তৃক আপনার অ্যাকাউন্ট সাময়িকভাবে বন্ধ করা হয়েছে।'
                              )
                            }
                            className="px-3.5 py-2 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>ব্লক করুন</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Manual License Generator for Customer WhatsApp */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 dark:from-slate-800 dark:to-slate-800/80 border border-emerald-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-700" />
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                    সরাসরি Pro লাইসেন্স কী জেনারেটর (১০০% ফ্রি ও স্বয়ংক্রিয়)
                  </h4>
                </div>
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  আনলিমিটেড ফ্রি তৈরি করুন
                </span>
              </div>

              <form onSubmit={handleGenerateManualLicense} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="tel"
                  required
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="গ্রাহকের মোবাইল নম্বর (০১৭১xxxxxxx)"
                  className="px-3 py-2.5 rounded-xl border border-[#0E6B6B] bg-[#102A43] !text-white placeholder-slate-400 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />

                <select
                  value={manualPlan}
                  onChange={(e) => setManualPlan(e.target.value as any)}
                  className="px-3 py-2.5 rounded-xl border border-[#0E6B6B] bg-[#102A43] !text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="yearly" className="bg-[#102A43] text-white">বার্ষিক Pro (৩৬৫ দিন - ৭৯৯৳)</option>
                  <option value="monthly" className="bg-[#102A43] text-white">মাসিক Pro (৩০ দিন - ৯৯৳)</option>
                  <option value="lifetime" className="bg-[#102A43] text-white">আজীবন ফ্রি Pro (Lifetime)</option>
                </select>

                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-bold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ফ্রি লাইসেন্স তৈরি করুন</span>
                </button>
              </form>

              {generatedKeyResult && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      ডিজিটাল স্বাক্ষরযুক্ত লাইসেন্স কোড তৈরি হয়েছে:
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopyKey}
                        className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1"
                      >
                        {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey ? 'কপি হয়েছে' : 'কপি'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendKeyWhatsApp(manualPhone, generatedKeyResult, manualPlan)}
                        className="px-2.5 py-1 rounded bg-[#25D366] text-slate-950 text-xs font-bold hover:bg-[#1EBE5D] flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp এ পাঠান</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800 font-mono text-[11px] break-all select-all text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                    {generatedKeyResult}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Password Change Section */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                      অ্যাডমিন প্যানেল পাসওয়ার্ড পরিবর্তন
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ডিফল্ট পাসওয়ার্ড: <span className="font-mono text-emerald-500 font-semibold">sahoj2026admin</span> (চাইলে নিজের মতো পরিবর্তন করুন)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChangeForm(!showPasswordChangeForm);
                    setPassChangeError('');
                    setPassChangeSuccess('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                >
                  {showPasswordChangeForm ? 'বাতিল' : 'পাসওয়ার্ড পরিবর্তন করুন'}
                </button>
              </div>

              {passChangeSuccess && (
                <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{passChangeSuccess}</span>
                </div>
              )}

              {passChangeError && (
                <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{passChangeError}</span>
                </div>
              )}

              {showPasswordChangeForm && (
                <form onSubmit={handleChangePassword} className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/60 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        বর্তমান পাসওয়ার্ড
                      </label>
                      <input
                        type={showAdminPin ? 'text' : 'password'}
                        placeholder="বর্তমান পাসওয়ার্ড দিন"
                        value={currentPassInput}
                        onChange={(e) => setCurrentPassInput(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg bg-[#102A43] border border-[#0E6B6B] text-xs !text-white placeholder-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        নতুন পাসওয়ার্ড
                      </label>
                      <input
                        type={showAdminPin ? 'text' : 'password'}
                        placeholder="নতুন পাসওয়ার্ড (যেমন: sahoj2026admin)"
                        value={newPassInput}
                        onChange={(e) => setNewPassInput(e.target.value)}
                        required
                        minLength={4}
                        className="w-full px-3 py-2 rounded-lg bg-[#102A43] border border-[#0E6B6B] text-xs !text-white placeholder-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        নতুন পাসওয়ার্ড কনফার্ম করুন
                      </label>
                      <input
                        type={showAdminPin ? 'text' : 'password'}
                        placeholder="আবার লিখুন"
                        value={confirmPassInput}
                        onChange={(e) => setConfirmPassInput(e.target.value)}
                        required
                        minLength={4}
                        className="w-full px-3 py-2 rounded-lg bg-[#102A43] border border-[#0E6B6B] text-xs !text-white placeholder-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPasswordChangeForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      disabled={isChangingPass}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
                    >
                      {isChangingPass ? 'সংরক্ষণ হচ্ছে...' : 'পাসওয়ার্ড সংরক্ষণ করুন'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* APK Download & Customer Update Link Section */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <span>📱 অ্যাপ (APK) ডাউনলোড ও আপডেট লিংক সেটিংস</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    আপনি নতুন কোনো আপডেট দিলে গুগল ড্রাইভ, ড্রপবক্স বা নিজস্ব সার্ভারের APK লিংক এখানে সেভ করুন। কাস্টমাররা সেটিংস থেকে সরাসরি নতুন ভার্সন ডাউনলোড করতে পারবে।
                  </p>
                </div>
              </div>

              {apkUrlSavedToast && (
                <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{apkUrlSavedToast}</span>
                </div>
              )}

              <form onSubmit={handleSaveApkUrl} className="flex flex-col sm:flex-row gap-2 mt-2">
                <input
                  type="url"
                  placeholder="https://... (গুগল ড্রাইভ বা ডাউনলোড লিংক, ফাঁকা রাখলে ডিফল্ট লিংক চলবে)"
                  value={customApkUrl}
                  onChange={(e) => setCustomApkUrl(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md active:scale-95 transition cursor-pointer shrink-0"
                >
                  লিংক সংরক্ষণ করুন
                </button>
              </form>
            </div>

            {/* Payment Requests Section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                    পেমেন্ট যাচাই ও আবেদন তালিকা ({filteredRequests.length})
                  </h4>
                  <button
                    type="button"
                    onClick={fetchRequests}
                    title="রিফ্রেশ করুন"
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Search box */}
                  <div className="relative flex-1 sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="নাম, ফোন বা TrxID..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  {/* Filter tabs */}
                  <div className="flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setSelectedFilter(tab)}
                        className={`px-2.5 py-1 rounded-lg capitalize transition ${
                          selectedFilter === tab
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {tab === 'all'
                          ? 'সব'
                          : tab === 'pending'
                          ? 'অপেক্ষমান'
                          : tab === 'approved'
                          ? 'অনুমোদিত'
                          : 'বাতিল'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Requests Cards */}
              {filteredRequests.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-400 text-xs">
                  কোনো পেমেন্ট আবেদন পাওয়া যায়নি।
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Left: Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {req.shopName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            {req.shopId}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            {req.plan === 'yearly' ? '৭৯৯৳ বার্ষিক' : '৯৯৳ মাসিক'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                          <span>
                            নগদ TrxID: <strong className="font-mono text-emerald-700 dark:text-emerald-400 font-black">{req.transactionId}</strong>
                          </span>
                          <span>প্রেরক: <strong>{req.senderPhone}</strong></span>
                          <span>দোকান ফোন: {req.shopPhone}</span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(req.createdAt).toLocaleString('bn-BD')}
                          </span>
                        </div>

                        {req.rejectionReason && (
                          <p className="text-[11px] text-rose-600 font-semibold">
                            বাতিলের কারণ: {req.rejectionReason}
                          </p>
                        )}

                        {req.generatedLicenseKey && (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                            <span>লাইসেন্স:</span>
                            <span className="truncate max-w-xs">{req.generatedLicenseKey}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(req.generatedLicenseKey || '');
                                alert('লাইসেন্স কোড কপি হয়েছে');
                              }}
                              className="text-emerald-700 font-bold hover:underline"
                            >
                              [কপি]
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendKeyWhatsApp(req.shopPhone, req.generatedLicenseKey || '', req.plan)}
                              className="text-[#25D366] font-bold hover:underline"
                            >
                              [WhatsApp]
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions & Screenshot Thumbnail */}
                      <div className="flex items-center gap-2 shrink-0">
                        {req.screenshot && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(req.screenshot || null)}
                            className="w-12 h-12 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-600 bg-slate-100 relative group"
                            title="স্ক্রিনশট বড় করে দেখুন"
                          >
                            <img src={req.screenshot} alt="Payment" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                              <Eye className="w-4 h-4" />
                            </div>
                          </button>
                        )}

                        {req.status === 'pending' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={actionLoading === req.id}
                              onClick={() => handleApprove(req)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow transition active:scale-95 flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>অনুমোদন</span>
                            </button>

                            <button
                              type="button"
                              disabled={actionLoading === req.id}
                              onClick={() => handleReject(req)}
                              className="px-3 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs transition active:scale-95"
                            >
                              বাতিল
                            </button>
                          </div>
                        ) : req.status === 'approved' ? (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>অনুমোদিত</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 font-bold text-xs flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>বাতিলকৃত</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Screenshot Fullscreen Viewer Modal */}
        {previewImage && (
          <div className="fixed inset-0 z-60 bg-black/90 p-4 flex items-center justify-center">
            <div className="relative max-w-lg max-h-[85vh] bg-slate-900 rounded-2xl p-2 border border-slate-700 shadow-2xl">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 p-2 rounded-full bg-rose-600 text-white font-bold shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewImage}
                alt="Payment Proof Full"
                className="max-h-[80vh] w-auto mx-auto rounded-xl object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
