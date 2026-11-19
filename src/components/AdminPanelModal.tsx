import React, { useState, useEffect, useCallback } from 'react';
import { PaymentRequest, SubscriptionInfo, ShopProfile, Language, RegisteredShopUser } from '../types';
import { DB } from '../storage/db';
import { CloudSync } from '../services/cloudSync';
import { firestore } from '../services/firebase';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { showToast } from './Toast';
import {
  ShieldAlert,
  Users,
  CheckCircle2,
  XCircle,
  Sparkles,
  Lock,
  Unlock,
  Ban,
  Download,
  Smartphone,
  Search,
  Eye,
  EyeOff,
  X,
  KeyRound,
  Copy,
  Check,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Crown,
  Settings,
  LogOut,
  Link2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: ShopProfile;
  currentSubscription: SubscriptionInfo;
  language: Language;
  onSubscriptionUpdated: (newSub: SubscriptionInfo) => void;
}

type AdminTab = 'payments' | 'users' | 'license' | 'settings';

const DEFAULT_ADMIN_PASSWORD = 'sahoj2026admin';

export const AdminPanelModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentProfile,
  onSubscriptionUpdated,
}) => {
  // Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [isVerifyingLogin, setIsVerifyingLogin] = useState(false);
  const [authError, setAuthError] = useState('');

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('payments');

  // Payment Requests State
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Inline Reject State (replaces browser prompt())
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('টাকা পাওয়া যায়নি বা ভুল Transaction ID');

  // Manual License Generator State
  const [manualPhone, setManualPhone] = useState('');
  const [manualPlan, setManualPlan] = useState<'monthly' | 'yearly' | 'lifetime'>('yearly');
  const [generatedKeyResult, setGeneratedKeyResult] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  // Change Admin Password State
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [showChangePasswords, setShowChangePasswords] = useState(false);
  const [passChangeSuccess, setPassChangeSuccess] = useState('');
  const [passChangeError, setPassChangeError] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Custom APK Update Link State
  const [customApkUrl, setCustomApkUrl] = useState(() => DB.getApkDownloadUrl());
  const [isSavingApkUrl, setIsSavingApkUrl] = useState(false);
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
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [directBlockPhone, setDirectBlockPhone] = useState('');
  const [directBlockReason, setDirectBlockReason] = useState('');
  const [blockActionLoading, setBlockActionLoading] = useState<string | null>(null);

  // Resolve authoritative active admin password from Firestore (with local fallback)
  const resolveActiveAdminPassword = useCallback(async (): Promise<string> => {
    try {
      const snap = await getDoc(doc(firestore, 'admin_config', 'credentials'));
      if (snap.exists()) {
        const cloudPass = String(snap.data()?.adminPassword || '').trim();
        if (cloudPass.length >= 4) {
          DB.saveAdminPassword(cloudPass);
          return cloudPass;
        }
      }
    } catch (_) {
      // Offline or Firestore unavailable -> fall back to local DB
    }
    return DB.getAdminPassword() || DEFAULT_ADMIN_PASSWORD;
  }, []);

  // Sync admin password & APK URL from Firestore when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      await resolveActiveAdminPassword();
      try {
        const apkSnap = await getDoc(doc(firestore, 'app_config', 'apk_update'));
        if (!cancelled && apkSnap.exists()) {
          const cloudUrl = String(apkSnap.data()?.apkDownloadUrl || '').trim();
          if (cloudUrl) {
            DB.saveApkDownloadUrl(cloudUrl);
            setCustomApkUrl(cloudUrl);
          }
        }
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, resolveActiveAdminPassword]);

  // Close & lock modal cleanly
  const handleCloseModal = () => {
    setIsAdminAuthenticated(false);
    setAdminPinInput('');
    setAuthError('');
    setRejectingRequestId(null);
    setPreviewImage(null);
    onClose();
  };

  // Load Users & Downloads from CloudSync (Firestore + Server + Local)
  const fetchUsersAndDownloads = useCallback(async () => {
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
  }, []);

  // Load Payment Requests from Local DB + Firestore + optional Server API
  const fetchRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    const local = DB.getPaymentRequests();
    const mergedMap = new Map<string, PaymentRequest>();
    const putReq = (r: PaymentRequest) => {
      if (!r || !r.id) return;
      const existing = mergedMap.get(r.id);
      if (!existing) {
        mergedMap.set(r.id, r);
        return;
      }
      // Prefer reviewed (approved/rejected) over pending
      if (existing.status === 'pending' && r.status !== 'pending') {
        mergedMap.set(r.id, { ...existing, ...r });
      }
    };

    local.forEach(putReq);

    // 1. Fetch from Firebase Firestore ('payment_requests')
    try {
      const snap = await getDocs(collection(firestore, 'payment_requests'));
      snap.forEach((docSnap) => {
        const d = docSnap.data() as PaymentRequest;
        if (d) {
          putReq({ ...d, id: d.id || docSnap.id });
        }
      });
    } catch (_) {}

    // 2. Fetch from Server API if reachable
    try {
      const res = await fetch('/api/payment-requests');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.requests)) {
          data.requests.forEach((r: PaymentRequest) => putReq(r));
        }
      }
    } catch (_) {}

    const sorted = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    setPaymentRequests(sorted);
    DB.savePaymentRequests(sorted);
    setIsLoadingRequests(false);
  }, []);

  useEffect(() => {
    if (isOpen && isAdminAuthenticated) {
      fetchRequests();
      fetchUsersAndDownloads();
    }
  }, [isOpen, isAdminAuthenticated, fetchRequests, fetchUsersAndDownloads]);

  if (!isOpen) return null;

  // Handle Admin Password Login (strictly verifies active cloud/local password)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const entered = adminPinInput.trim();
    if (!entered) {
      setAuthError('অনুগ্রহ করে অ্যাডমিন পাসওয়ার্ড লিখুন।');
      return;
    }

    setIsVerifyingLogin(true);
    try {
      const activePass = await resolveActiveAdminPassword();
      if (entered === activePass) {
        setIsAdminAuthenticated(true);
        setAdminPinInput('');
        setAuthError('');
      } else {
        setAuthError('ভুল অ্যাডমিন পাসওয়ার্ড! সঠিক গোপন পাসওয়ার্ড দিয়ে প্রবেশ করুন।');
      }
    } finally {
      setIsVerifyingLogin(false);
    }
  };

  // Handle Admin Password Change (disables old password + syncs to Firebase Firestore)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassChangeError('');
    setPassChangeSuccess('');

    const enteredCurrent = currentPassInput.trim();
    const cleanNew = newPassInput.trim();
    const cleanConfirm = confirmPassInput.trim();

    if (cleanNew.length < 4) {
      setPassChangeError('নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setPassChangeError('নতুন পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ড মিলছে না!');
      return;
    }

    setIsChangingPass(true);
    try {
      const activePass = await resolveActiveAdminPassword();
      if (enteredCurrent !== activePass) {
        setPassChangeError('বর্তমান পাসওয়ার্ড সঠিক নয়!');
        setIsChangingPass(false);
        return;
      }

      if (cleanNew === activePass) {
        setPassChangeError('নতুন পাসওয়ার্ড বর্তমান পাসওয়ার্ডের চেয়ে আলাদা হতে হবে।');
        setIsChangingPass(false);
        return;
      }

      // 1. Save locally immediately
      DB.saveAdminPassword(cleanNew);

      // 2. Sync to Firebase Firestore for all devices
      let cloudSynced = false;
      try {
        await setDoc(
          doc(firestore, 'admin_config', 'credentials'),
          {
            adminPassword: cleanNew,
            isCustomPassword: true,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        cloudSynced = true;
      } catch (_) {}

      // 3. Sync to optional Express backend if online
      try {
        await fetch('/api/admin/change-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPin: enteredCurrent, newPin: cleanNew }),
        });
      } catch (_) {}

      const msg = cloudSynced
        ? 'অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তিত ও ক্লাউডে সিঙ্ক হয়েছে! এখন থেকে শুধু নতুন পাসওয়ার্ড কাজ করবে।'
        : 'এই ফোনে পাসওয়ার্ড পরিবর্তিত হয়েছে (ইন্টারনেট না থাকায় ক্লাউড সিঙ্ক বাকি আছে)।';

      setPassChangeSuccess(msg);
      showToast('অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!', 'success');
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
    } catch (err: any) {
      setPassChangeError('পাসওয়ার্ড পরিবর্তনে ত্রুটি: ' + (err?.message || 'আবার চেষ্টা করুন'));
    } finally {
      setIsChangingPass(false);
    }
  };

  // Save Custom APK Download / Update Link (Local + Firebase Firestore)
  const handleSaveApkUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingApkUrl(true);
    const cleanUrl = customApkUrl.trim();
    DB.saveApkDownloadUrl(cleanUrl);

    let cloudSaved = false;
    try {
      await setDoc(
        doc(firestore, 'app_config', 'apk_update'),
        {
          apkDownloadUrl: cleanUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      cloudSaved = true;
    } catch (_) {}

    const msg = cloudSaved
      ? 'APK ডাউনলোড ও আপডেট লিংক সফলভাবে ক্লাউডে সংরক্ষিত হয়েছে!'
      : 'APK লিংক লোকালি সংরক্ষিত হয়েছে (অনলাইন হলে আবার সেভ করুন)।';
    setApkUrlSavedToast(msg);
    showToast(msg, 'success');
    setTimeout(() => setApkUrlSavedToast(''), 4000);
    setIsSavingApkUrl(false);
  };

  // Toggle User Block / Unblock
  const handleToggleUserBlock = async (
    targetPhone: string,
    shouldBlock: boolean,
    customReason?: string
  ) => {
    const clean = targetPhone.replace(/\D/g, '').slice(-10);
    if (!clean || clean.length < 10) {
      showToast('সঠিক ১০ বা ১১ ডিজিটের মোবাইল নম্বর দিন!', 'warning');
      return;
    }

    setBlockActionLoading(clean);
    try {
      const res = await CloudSync.toggleBlockUser(clean, shouldBlock, customReason);
      showToast(res.message, shouldBlock ? 'warning' : 'success');
      await fetchUsersAndDownloads();
    } catch (err: any) {
      showToast('ত্রুটি: ' + (err?.message || 'আপডেট করা যায়নি'), 'error');
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

  // Approve Payment Request -> Generate Signed License Key + Sync Local/Server/Firestore
  const handleApprove = async (req: PaymentRequest) => {
    setActionLoading(req.id);
    const durationDays = req.plan === 'yearly' ? 365 : 30;
    const activePin = DB.getAdminPassword() || DEFAULT_ADMIN_PASSWORD;

    let generatedLicenseKey = '';
    try {
      const res = await fetch('/api/admin/approve-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          adminPin: activePin,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        generatedLicenseKey = data.licenseKey;
      }
    } catch (_) {}

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
      const sig = Math.abs(
        req.shopPhone.split('').reduce((a, b) => a + b.charCodeAt(0), 0) * 8831
      )
        .toString(16)
        .toUpperCase()
        .padStart(12, 'A');
      generatedLicenseKey = `SAHOJ-${req.plan.toUpperCase()}-${b64}-${sig}`;
    }

    const reviewedAt = new Date().toISOString();
    const updatedFields = {
      status: 'approved' as const,
      reviewedAt,
      generatedLicenseKey,
    };

    DB.updatePaymentRequest(req.id, updatedFields);

    // Sync approval to Firebase Firestore
    try {
      await setDoc(
        doc(firestore, 'payment_requests', req.id),
        { ...req, ...updatedFields },
        { merge: true }
      );
    } catch (_) {}

    // If this payment was for the current active shop, activate immediately
    const currentNorm = (currentProfile.phone || '').replace(/\D/g, '').slice(-10);
    const reqNorm = (req.shopPhone || '').replace(/\D/g, '').slice(-10);
    if (req.shopId === currentProfile.shopId || (currentNorm && currentNorm === reqNorm)) {
      const updatedSub = DB.activatePro(req.plan, durationDays, generatedLicenseKey);
      onSubscriptionUpdated(updatedSub);
    }

    setPaymentRequests((prev) =>
      prev.map((item) => (item.id === req.id ? { ...item, ...updatedFields } : item))
    );
    showToast('পেমেন্ট অনুমোদন ও লাইসেন্স কোড তৈরি হয়েছে!', 'success');
    setActionLoading(null);
  };

  // Confirm Inline Reject Payment Request (no browser prompt())
  const handleConfirmReject = async (req: PaymentRequest) => {
    const reason = rejectReasonInput.trim() || 'টাকা পাওয়া যায়নি বা ভুল Transaction ID';
    setActionLoading(req.id);
    const activePin = DB.getAdminPassword() || DEFAULT_ADMIN_PASSWORD;

    try {
      await fetch('/api/admin/reject-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          reason,
          adminPin: activePin,
        }),
      });
    } catch (_) {}

    const reviewedAt = new Date().toISOString();
    const updatedFields = {
      status: 'rejected' as const,
      reviewedAt,
      rejectionReason: reason,
    };

    DB.updatePaymentRequest(req.id, updatedFields);

    try {
      await setDoc(
        doc(firestore, 'payment_requests', req.id),
        { ...req, ...updatedFields },
        { merge: true }
      );
    } catch (_) {}

    setPaymentRequests((prev) =>
      prev.map((item) => (item.id === req.id ? { ...item, ...updatedFields } : item))
    );
    setRejectingRequestId(null);
    setRejectReasonInput('টাকা পাওয়া যায়নি বা ভুল Transaction ID');
    showToast('পেমেন্ট আবেদন বাতিল করা হয়েছে।', 'info');
    setActionLoading(null);
  };

  // Manual License Key Generator
  const handleGenerateManualLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhoneDigits = manualPhone.replace(/\D/g, '');
    if (cleanPhoneDigits.length < 10) {
      showToast('গ্রাহকের সঠিক ১০ বা ১১ ডিজিটের মোবাইল নম্বর দিন!', 'warning');
      return;
    }

    setIsGeneratingKey(true);
    const durationDays =
      manualPlan === 'lifetime' ? 36500 : manualPlan === 'yearly' ? 365 : 30;
    const activePin = DB.getAdminPassword() || DEFAULT_ADMIN_PASSWORD;
    let key = '';

    try {
      const res = await fetch('/api/admin/generate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: manualPhone.trim(),
          plan: manualPlan,
          adminPin: activePin,
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
      const expiresAt =
        manualPlan === 'lifetime'
          ? new Date('2099-12-31').getTime()
          : now + durationDays * 24 * 3600 * 1000;
      const payload = {
        shopId: `SD-${cleanPhoneDigits.slice(-10)}`,
        shopPhone: manualPhone.trim(),
        plan: manualPlan,
        issuedAt: now,
        expiresAt,
      };
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      const sig = Math.abs(
        manualPhone.trim().split('').reduce((a, b) => a + b.charCodeAt(0), 0) * 8831
      )
        .toString(16)
        .toUpperCase()
        .padStart(12, 'B');
      key = `SAHOJ-${manualPlan.toUpperCase()}-${b64}-${sig}`;
    }

    setGeneratedKeyResult(key);
    setCopiedKey(false);
    setIsGeneratingKey(false);
    showToast('Pro লাইসেন্স কোড সফলভাবে তৈরি হয়েছে!', 'success');
  };

  // Copy Key with safe clipboard fallback
  const copyTextSafe = (text: string, toastMessage: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    showToast(toastMessage, 'success');
  };

  const handleCopyKey = () => {
    if (!generatedKeyResult) return;
    copyTextSafe(generatedKeyResult, 'লাইসেন্স কোড কপি হয়েছে!');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Send Key to customer via WhatsApp
  const handleSendKeyWhatsApp = (phone: string, key: string, plan: string) => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-11);
    const fullPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    const planText =
      plan === 'lifetime'
        ? 'আজীবন (Lifetime)'
        : plan === 'yearly'
        ? 'বার্ষিক (৩৬৫ দিন)'
        : 'মাসিক (৩০ দিন)';
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

  // Computed stats
  const pendingRequests = paymentRequests.filter((r) => r.status === 'pending');
  const approvedRequests = paymentRequests.filter((r) => r.status === 'approved');
  const activeUsersCount = registeredUsers.filter((u) => !u.isBlocked).length;
  const blockedUsersCount = registeredUsers.filter((u) => u.isBlocked).length;

  const filteredRequests = paymentRequests.filter((r) => {
    const matchFilter = selectedFilter === 'all' || r.status === selectedFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      (r.shopName || '').toLowerCase().includes(q) ||
      (r.shopPhone || '').includes(q) ||
      (r.senderPhone || '').includes(q) ||
      (r.transactionId || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const filteredUsers = registeredUsers.filter((u) => {
    const matchTab =
      userFilter === 'all' ||
      (userFilter === 'active' && !u.isBlocked) ||
      (userFilter === 'blocked' && u.isBlocked);
    if (!matchTab) return false;
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.shopName || '').toLowerCase().includes(q) ||
      (u.ownerName || '').toLowerCase().includes(q) ||
      (u.fullPhone || '').includes(q) ||
      (u.phone || '').includes(q) ||
      (u.shopId || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2.5 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden rounded-3xl bg-[#F8FAFC] shadow-2xl border border-slate-200/80">
        {/* ================= TOP HEADER ================= */}
        <div className="bg-gradient-to-r from-[#102A43] via-[#0E4D5C] to-[#0E6B6B] px-4 py-3.5 sm:px-5 sm:py-4 text-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-400 text-[#102A43] flex items-center justify-center shadow-sm shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base truncate">
                  সহজ দোকান — অ্যাডমিন প্যানেল
                </h3>
                {isAdminAuthenticated && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-400/20 text-emerald-200 text-[10px] font-bold border border-emerald-300/30">
                    আনলকড
                  </span>
                )}
              </div>
              <p className="text-[11px] text-teal-100/85 truncate">
                পেমেন্ট যাচাই, ইউজার কন্ট্রোল, লাইসেন্স ও নিরাপত্তা ব্যবস্থাপনা
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAdminAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setIsAdminAuthenticated(false);
                  setAdminPinInput('');
                  showToast('অ্যাডমিন প্যানেল লক করা হয়েছে।', 'info');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                title="অ্যাডমিন প্যানেল লক করুন"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">লক</span>
              </button>
            )}
            <button
              type="button"
              data-modal-close="true"
              onClick={handleCloseModal}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95 cursor-pointer"
              aria-label="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= 1. LOGIN SCREEN ================= */}
        {!isAdminAuthenticated ? (
          <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 sm:p-10 bg-white">
            <form onSubmit={handleAdminLogin} className="w-full max-w-sm text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-[#E0F2F1] text-[#0E6B6B] mx-auto flex items-center justify-center shadow-inner border border-[#B2DFDB]">
                <Lock className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="font-black text-lg text-[#102A43]">
                  অ্যাডমিন পাসওয়ার্ড দিন
                </h4>
                <p className="text-xs text-[#64748B]">
                  এই অংশটি শুধুমাত্র অ্যাপের মালিকের জন্য সুরক্ষিত।
                </p>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 text-[#D32F2F] text-xs font-bold border border-rose-200 flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="relative">
                <input
                  type={showAdminPin ? 'text' : 'password'}
                  autoFocus
                  required
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  placeholder="গোপন পাসওয়ার্ড লিখুন"
                  className="w-full px-4 py-3.5 pr-12 rounded-2xl border-2 border-[#CBD5E1] focus:border-[#0E6B6B] bg-[#F8FAFC] text-[#102A43] placeholder-[#94A3B8] text-center font-mono text-base font-bold tracking-wider focus:ring-2 focus:ring-[#0E6B6B]/20 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#102A43] p-1.5 cursor-pointer"
                  title={showAdminPin ? 'লুকান' : 'দেখুন'}
                >
                  {showAdminPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isVerifyingLogin}
                className="w-full py-3 px-4 bg-[#0E6B6B] hover:bg-[#094747] disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl shadow-md transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                {isVerifyingLogin ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>যাচাই করা হচ্ছে...</span>
                  </>
                ) : (
                  <span>প্রবেশ করুন</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* ================= 2. AUTHENTICATED DASHBOARD ================= */
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Compact Top KPI Strip */}
            <div className="px-3.5 pt-3 pb-2.5 sm:px-5 bg-white border-b border-slate-200 shrink-0 space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-[#64748B]">মোট ডাউনলোড</span>
                    <span className="text-sm sm:text-base font-black text-[#102A43] tabular-nums">
                      {totalDownloads} জন
                    </span>
                  </div>
                </div>

                <div className="px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-[#64748B]">রেজিস্টার্ড দোকান</span>
                    <span className="text-sm sm:text-base font-black text-[#102A43] tabular-nums">
                      {registeredUsers.length} টি
                    </span>
                  </div>
                </div>

                <div className="px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-amber-800">অপেক্ষমান পেমেন্ট</span>
                    <span className="text-sm sm:text-base font-black text-amber-900 tabular-nums">
                      {pendingRequests.length} টি
                    </span>
                  </div>
                </div>

                <div className="px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#2E7D32] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-emerald-800">অনুমোদিত Pro</span>
                    <span className="text-sm sm:text-base font-black text-[#1B5E20] tabular-nums">
                      {approvedRequests.length} টি
                    </span>
                  </div>
                </div>
              </div>

              {/* Clean 4-Tab Navigation Bar */}
              <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-2xl">
                {(
                  [
                    {
                      id: 'payments' as const,
                      label: 'পেমেন্ট',
                      Icon: CreditCard,
                      badge: pendingRequests.length,
                    },
                    {
                      id: 'users' as const,
                      label: 'ইউজার ও ব্লক',
                      Icon: Users,
                      badge: blockedUsersCount,
                    },
                    {
                      id: 'license' as const,
                      label: 'লাইসেন্স',
                      Icon: KeyRound,
                      badge: 0,
                    },
                    {
                      id: 'settings' as const,
                      label: 'পাসওয়ার্ড ও লিংক',
                      Icon: Settings,
                      badge: 0,
                    },
                  ] as const
                ).map(({ id, label, Icon, badge }) => {
                  const isActive = activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        isActive
                          ? 'bg-[#0E6B6B] text-white shadow-sm'
                          : 'text-[#486581] hover:text-[#102A43] hover:bg-white/70'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{label}</span>
                      {badge > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none ${
                            isActive
                              ? 'bg-white text-[#0E6B6B]'
                              : id === 'payments'
                              ? 'bg-amber-500 text-white'
                              : 'bg-rose-600 text-white'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ================= TAB BODY ================= */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
              {/* ---------- TAB 1: PAYMENTS ---------- */}
              {activeTab === 'payments' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-[#102A43]">
                        পেমেন্ট আবেদন ({filteredRequests.length})
                      </h4>
                      <button
                        type="button"
                        onClick={fetchRequests}
                        disabled={isLoadingRequests}
                        className="px-2.5 py-1 rounded-lg bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#B2DFDB] text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRequests ? 'animate-spin' : ''}`} />
                        <span>রিফ্রেশ</span>
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1 sm:w-52">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="নাম, ফোন বা TrxID..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-[#F8FAFC] text-[#102A43] focus:outline-none focus:border-[#0E6B6B]"
                        />
                      </div>

                      <div className="flex p-0.5 rounded-xl bg-slate-100 text-[11px] font-bold">
                        {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setSelectedFilter(tab)}
                            className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg transition cursor-pointer ${
                              selectedFilter === tab
                                ? 'bg-white text-[#0E6B6B] shadow-xs'
                                : 'text-[#64748B] hover:text-[#102A43]'
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

                  {filteredRequests.length === 0 ? (
                    <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-1.5">
                      <CreditCard className="w-9 h-9 text-slate-300 mx-auto" />
                      <p className="text-sm font-bold text-[#486581]">
                        কোনো পেমেন্ট আবেদন পাওয়া যায়নি
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        নতুন পেমেন্ট এলে রিফ্রেশ চাপলেই এখানে দেখাবে।
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-extrabold text-sm text-[#102A43]">
                                  {req.shopName}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                                  {req.shopId}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                  {req.plan === 'yearly' ? '৭৯৯৳ বার্ষিক' : '৯৯৳ মাসিক'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-[#486581]">
                                <span>
                                  TrxID:{' '}
                                  <strong className="font-mono text-[#0E6B6B] font-black">
                                    {req.transactionId}
                                  </strong>
                                </span>
                                <span>
                                  প্রেরক: <strong className="text-[#102A43]">{req.senderPhone}</strong>
                                </span>
                                <span>দোকান: {req.shopPhone}</span>
                                <span className="text-[11px] text-[#94A3B8]">
                                  {new Date(req.createdAt).toLocaleString('bn-BD')}
                                </span>
                              </div>

                              {req.rejectionReason && (
                                <p className="text-[11px] text-[#D32F2F] font-bold">
                                  বাতিলের কারণ: {req.rejectionReason}
                                </p>
                              )}

                              {req.generatedLicenseKey && (
                                <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px]">
                                  <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[220px] sm:max-w-xs">
                                    {req.generatedLicenseKey}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyTextSafe(
                                        req.generatedLicenseKey || '',
                                        'লাইসেন্স কোড কপি হয়েছে!'
                                      )
                                    }
                                    className="px-2 py-0.5 rounded-md bg-[#E0F2F1] text-[#0E6B6B] font-bold hover:bg-[#B2DFDB] cursor-pointer"
                                  >
                                    কপি
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSendKeyWhatsApp(
                                        req.shopPhone,
                                        req.generatedLicenseKey || '',
                                        req.plan
                                      )
                                    }
                                    className="px-2 py-0.5 rounded-md bg-emerald-100 text-[#2E7D32] font-bold hover:bg-emerald-200 cursor-pointer"
                                  >
                                    WhatsApp
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {req.screenshot && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(req.screenshot || null)}
                                  className="w-11 h-11 rounded-xl overflow-hidden border border-slate-300 bg-slate-100 relative group cursor-pointer"
                                  title="স্ক্রিনশট বড় করে দেখুন"
                                >
                                  <img
                                    src={req.screenshot}
                                    alt="Payment"
                                    className="w-full h-full object-cover"
                                  />
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
                                    className="px-3.5 py-2 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] disabled:opacity-50 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>অনুমোদন</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={actionLoading === req.id}
                                    onClick={() => {
                                      setRejectingRequestId(req.id);
                                      setRejectReasonInput('টাকা পাওয়া যায়নি বা ভুল Transaction ID');
                                    }}
                                    className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-[#D32F2F] hover:bg-rose-100 font-bold text-xs transition active:scale-95 cursor-pointer"
                                  >
                                    বাতিল
                                  </button>
                                </div>
                              ) : req.status === 'approved' ? (
                                <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-[#2E7D32] font-bold text-xs flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>অনুমোদিত</span>
                                </span>
                              ) : (
                                <span className="px-3 py-1.5 rounded-xl bg-rose-100 text-[#D32F2F] font-bold text-xs flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>বাতিলকৃত</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Inline Reject Confirmation Box (Android WebView safe) */}
                          {rejectingRequestId === req.id && (
                            <div className="pt-2.5 border-t border-rose-100 bg-rose-50/70 -mx-3.5 -mb-3.5 sm:-mx-4 sm:-mb-4 px-3.5 py-3 sm:px-4 rounded-b-2xl space-y-2">
                              <label className="block text-xs font-bold text-[#D32F2F]">
                                বাতিল করার কারণ লিখুন:
                              </label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  value={rejectReasonInput}
                                  onChange={(e) => setRejectReasonInput(e.target.value)}
                                  placeholder="যেমন: টাকা পাওয়া যায়নি বা ভুল Transaction ID"
                                  className="flex-1 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-[#102A43] focus:outline-none focus:border-[#D32F2F]"
                                />
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setRejectingRequestId(null)}
                                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-[#64748B] hover:bg-slate-100 cursor-pointer"
                                  >
                                    ফিরে যান
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionLoading === req.id}
                                    onClick={() => handleConfirmReject(req)}
                                    className="px-3.5 py-2 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                                  >
                                    বাতিল নিশ্চিত করুন
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ---------- TAB 2: USERS & BLOCK CONTROL ---------- */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  {/* Direct Phone Block / Unblock Card */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-sm text-[#102A43]">
                          নম্বর দিয়ে সরাসরি ব্লক / আনব্লক করুন
                        </h4>
                        <p className="text-xs text-[#64748B]">
                          যেকোনো গ্রাহকের মোবাইল নম্বর লিখে তাৎক্ষণিক অ্যাপ বন্ধ বা চালু করুন
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={fetchUsersAndDownloads}
                        disabled={isLoadingUsers}
                        className="px-3 py-1.5 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#B2DFDB] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                        <span>রিফ্রেশ</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        type="tel"
                        value={directBlockPhone}
                        onChange={(e) => setDirectBlockPhone(e.target.value)}
                        placeholder="মোবাইল নম্বর (017xxxxxxxx)"
                        className="px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-300 text-xs font-bold text-[#102A43] placeholder-slate-400 focus:outline-none focus:border-[#0E6B6B]"
                      />
                      <input
                        type="text"
                        value={directBlockReason}
                        onChange={(e) => setDirectBlockReason(e.target.value)}
                        placeholder="কারণ (ঐচ্ছিক, যেমন: মেয়াদ শেষ)"
                        className="px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-300 text-xs font-medium text-[#102A43] placeholder-slate-400 focus:outline-none focus:border-[#0E6B6B]"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleDirectBlockSubmit(e, true)}
                        disabled={!directBlockPhone.trim() || Boolean(blockActionLoading)}
                        className="px-3 py-2.5 rounded-xl bg-[#D32F2F] hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>ব্লক করুন</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDirectBlockSubmit(e, false)}
                        disabled={!directBlockPhone.trim() || Boolean(blockActionLoading)}
                        className="px-3 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>আনব্লক করুন</span>
                      </button>
                    </div>
                  </div>

                  {/* Registered Users Search + Filter */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold self-start">
                        <button
                          type="button"
                          onClick={() => setUserFilter('all')}
                          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                            userFilter === 'all'
                              ? 'bg-white text-[#0E6B6B] shadow-xs'
                              : 'text-[#64748B]'
                          }`}
                        >
                          সব ({registeredUsers.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserFilter('active')}
                          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                            userFilter === 'active'
                              ? 'bg-white text-[#2E7D32] shadow-xs'
                              : 'text-[#64748B]'
                          }`}
                        >
                          সচল ({activeUsersCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserFilter('blocked')}
                          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                            userFilter === 'blocked'
                              ? 'bg-white text-[#D32F2F] shadow-xs'
                              : 'text-[#64748B]'
                          }`}
                        >
                          ব্লক ({blockedUsersCount})
                        </button>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          placeholder="দোকান, মালিক বা ফোন নম্বর খুঁজুন..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-[#F8FAFC] text-[#102A43] focus:outline-none focus:border-[#0E6B6B]"
                        />
                      </div>
                    </div>

                    {filteredUsers.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#94A3B8]">
                        কোনো ইউজার পাওয়া যায়নি।
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                        {filteredUsers.map((u) => (
                          <div
                            key={u.phone}
                            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition ${
                              u.isBlocked
                                ? 'bg-rose-50/70 border-rose-200'
                                : 'bg-[#F8FAFC] border-slate-200'
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-extrabold text-xs sm:text-sm text-[#102A43] truncate">
                                  {u.shopName || 'সহজ দোকান'}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200/80 text-slate-700">
                                  {u.shopId}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    u.isBlocked
                                      ? 'bg-[#D32F2F] text-white'
                                      : u.status === 'pro'
                                      ? 'bg-amber-400 text-[#102A43]'
                                      : 'bg-[#E0F2F1] text-[#0E6B6B]'
                                  }`}
                                >
                                  {u.isBlocked
                                    ? 'ব্লক করা'
                                    : u.plan === 'lifetime'
                                    ? 'আজীবন Pro'
                                    : u.status === 'pro'
                                    ? 'Pro গ্রাহক'
                                    : '৬০ দিন ট্রায়াল'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#486581]">
                                <span className="font-mono font-bold text-[#102A43]">
                                  {u.fullPhone}
                                </span>
                                {u.ownerName && <span>মালিক: {u.ownerName}</span>}
                                <span>পণ্য: {u.productsCount ?? 0}</span>
                                <span>বিক্রি: {u.salesCount ?? 0}</span>
                                <span>
                                  সক্রিয়: {new Date(u.lastActiveAt).toLocaleDateString('bn-BD')}
                                </span>
                              </div>

                              {u.isBlocked && u.blockReason && (
                                <p className="text-[11px] font-bold text-[#D32F2F]">
                                  কারণ: {u.blockReason}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {u.isBlocked ? (
                                <button
                                  type="button"
                                  disabled={blockActionLoading === u.phone}
                                  onClick={() => handleToggleUserBlock(u.phone, false)}
                                  className="px-3.5 py-2 rounded-xl bg-[#2E7D32] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>আনব্লক করুন</span>
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
                                  className="px-3.5 py-2 rounded-xl bg-[#D32F2F] hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>ব্লক করুন</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ---------- TAB 3: LICENSE GENERATOR & OWNER MODE ---------- */}
              {activeTab === 'license' && (
                <div className="space-y-4">
                  {/* Manual License Generator */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center shrink-0">
                          <KeyRound className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-[#102A43]">
                            সরাসরি Pro লাইসেন্স কী জেনারেটর
                          </h4>
                          <p className="text-xs text-[#64748B]">
                            গ্রাহকের মোবাইল নম্বর দিয়ে তাৎক্ষণিক লাইসেন্স কোড তৈরি ও WhatsApp-এ পাঠান
                          </p>
                        </div>
                      </div>
                    </div>

                    <form
                      onSubmit={handleGenerateManualLicense}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                    >
                      <input
                        type="tel"
                        required
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        placeholder="গ্রাহকের মোবাইল নম্বর (017xxxxxxxx)"
                        className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-[#F8FAFC] text-[#102A43] placeholder-slate-400 text-xs font-bold focus:ring-2 focus:ring-[#0E6B6B]/20 focus:border-[#0E6B6B] focus:outline-none"
                      />

                      <select
                        value={manualPlan}
                        onChange={(e) => setManualPlan(e.target.value as any)}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-[#F8FAFC] text-[#102A43] text-xs font-bold focus:ring-2 focus:ring-[#0E6B6B]/20 focus:border-[#0E6B6B] focus:outline-none"
                      >
                        <option value="yearly">বার্ষিক Pro (৩৬৫ দিন - ৭৯৯৳)</option>
                        <option value="monthly">মাসিক Pro (৩০ দিন - ৯৯৳)</option>
                        <option value="lifetime">আজীবন ফ্রি Pro (Lifetime)</option>
                      </select>

                      <button
                        type="submit"
                        disabled={isGeneratingKey}
                        className="px-4 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] disabled:opacity-60 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isGeneratingKey ? 'তৈরি হচ্ছে...' : 'লাইসেন্স তৈরি করুন'}</span>
                      </button>
                    </form>

                    {generatedKeyResult && (
                      <div className="p-3.5 rounded-xl bg-[#F0FDFA] border border-[#B2DFDB] space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-[#0E6B6B]">
                            ডিজিটাল স্বাক্ষরযুক্ত লাইসেন্স কোড প্রস্তুত:
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={handleCopyKey}
                              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-[#102A43] hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedKey ? (
                                <Check className="w-3.5 h-3.5 text-[#2E7D32]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>{copiedKey ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleSendKeyWhatsApp(manualPhone, generatedKeyResult, manualPlan)
                              }
                              className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1EBE5D] text-[#102A43] text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp-এ পাঠান</span>
                            </button>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white font-mono text-[11px] break-all select-all text-[#102A43] border border-[#B2DFDB]">
                          {generatedKeyResult}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Master Owner Lifetime Activation Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50/70 to-amber-50 border border-amber-300 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-400 text-[#102A43] shrink-0 shadow-xs">
                          <Crown className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-sm text-[#102A43]">
                              অ্যাপের মালিক মোড (Lifetime Pro)
                            </h4>
                            <span className="px-2 py-0.5 rounded-md bg-amber-400 text-[#102A43] text-[10px] font-black">
                              স্থায়ী ফ্রি
                            </span>
                          </div>
                          <p className="text-xs text-[#486581] mt-1 leading-relaxed">
                            এই ফোনে কোনো ট্রায়াল সীমা বা সাবস্ক্রিপশন ফি ছাড়াই আজীবনের জন্য সব Pro সুবিধা চালু করুন।
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = DB.activateOwnerLifetime();
                          onSubscriptionUpdated(updated);
                          showToast(
                            'অভিনন্দন! এই ফোনে আজীবন আনলিমিটেড Pro এক্সেস সক্রিয় হয়েছে।',
                            'success'
                          );
                        }}
                        className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#102A43] font-extrabold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Crown className="w-4 h-4" />
                        <span>এই ফোনে আজীবন Pro চালু করুন</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------- TAB 4: PASSWORD & APK SETTINGS ---------- */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  {/* Admin Password Change Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center shrink-0">
                          <Lock className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-[#102A43]">
                            অ্যাডমিন প্যানেল পাসওয়ার্ড পরিবর্তন
                          </h4>
                          <p className="text-xs text-[#64748B]">
                            পাসওয়ার্ড পরিবর্তন করলে পুরোনো পাসওয়ার্ড বন্ধ হয়ে যাবে এবং সব ডিভাইসে নতুন পাসওয়ার্ড কাজ করবে
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowChangePasswords((v) => !v)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-[#486581] flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {showChangePasswords ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>লুকান</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>দেখুন</span>
                          </>
                        )}
                      </button>
                    </div>

                    {passChangeSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#2E7D32] text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{passChangeSuccess}</span>
                      </div>
                    )}

                    {passChangeError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#D32F2F] text-xs font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{passChangeError}</span>
                      </div>
                    )}

                    <form onSubmit={handleChangePassword} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#486581] mb-1">
                            বর্তমান পাসওয়ার্ড
                          </label>
                          <input
                            type={showChangePasswords ? 'text' : 'password'}
                            placeholder="বর্তমান পাসওয়ার্ড দিন"
                            value={currentPassInput}
                            onChange={(e) => setCurrentPassInput(e.target.value)}
                            required
                            className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-300 text-xs text-[#102A43] placeholder-slate-400 font-bold focus:outline-none focus:border-[#0E6B6B] focus:ring-2 focus:ring-[#0E6B6B]/20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#486581] mb-1">
                            নতুন পাসওয়ার্ড
                          </label>
                          <input
                            type={showChangePasswords ? 'text' : 'password'}
                            placeholder="কমপক্ষে ৪ অক্ষর"
                            value={newPassInput}
                            onChange={(e) => setNewPassInput(e.target.value)}
                            required
                            minLength={4}
                            className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-300 text-xs text-[#102A43] placeholder-slate-400 font-bold focus:outline-none focus:border-[#0E6B6B] focus:ring-2 focus:ring-[#0E6B6B]/20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#486581] mb-1">
                            নতুন পাসওয়ার্ড নিশ্চিত করুন
                          </label>
                          <input
                            type={showChangePasswords ? 'text' : 'password'}
                            placeholder="পুনরায় নতুন পাসওয়ার্ড দিন"
                            value={confirmPassInput}
                            onChange={(e) => setConfirmPassInput(e.target.value)}
                            required
                            minLength={4}
                            className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-300 text-xs text-[#102A43] placeholder-slate-400 font-bold focus:outline-none focus:border-[#0E6B6B] focus:ring-2 focus:ring-[#0E6B6B]/20"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isChangingPass}
                          className="px-5 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] disabled:opacity-50 text-white text-xs font-extrabold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          {isChangingPass ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>সংরক্ষণ হচ্ছে...</span>
                            </>
                          ) : (
                            <span>নতুন পাসওয়ার্ড সেভ করুন</span>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* APK Download & Customer Update Link Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                        <Link2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-[#102A43]">
                          অ্যাপ (APK) ডাউনলোড ও আপডেট লিংক
                        </h4>
                        <p className="text-xs text-[#64748B]">
                          নতুন আপডেটের গুগল ড্রাইভ বা ডাউনলোড লিংক এখানে সেভ করলে ক্লাউডে সংরক্ষিত থাকবে
                        </p>
                      </div>
                    </div>

                    {apkUrlSavedToast && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[#2E7D32] text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{apkUrlSavedToast}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveApkUrl} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="url"
                        placeholder="https://... (ফাঁকা রাখলে ডিফল্ট লিংক চলবে)"
                        value={customApkUrl}
                        onChange={(e) => setCustomApkUrl(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-300 text-xs text-[#102A43] focus:outline-none focus:border-[#0E6B6B] font-mono"
                      />
                      <button
                        type="submit"
                        disabled={isSavingApkUrl}
                        className="px-4 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] disabled:opacity-50 text-white font-bold text-xs shadow-xs active:scale-95 transition cursor-pointer shrink-0"
                      >
                        {isSavingApkUrl ? 'সংরক্ষণ হচ্ছে...' : 'লিংক সংরক্ষণ করুন'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Screenshot Fullscreen Viewer Modal */}
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-60 bg-black/90 p-4 flex items-center justify-center"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-lg max-h-[85vh] bg-slate-900 rounded-2xl p-2 border border-slate-700 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 p-2 rounded-full bg-rose-600 text-white font-bold shadow-lg cursor-pointer"
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
