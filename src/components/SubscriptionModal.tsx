import React, { useState, useRef } from 'react';
import {
  SubscriptionInfo,
  PaymentRequest,
  ShopProfile,
  Language,
} from '../types';
import { translations } from '../i18n/translations';
import { DB } from '../storage/db';
import { compressImage } from '../utils/image';
import { parseAndVerifyLicenseKey, getSubscriptionDetails } from '../utils/license';
import {
  Sparkles,
  Check,
  Copy,
  Upload,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  KeyRound,
  X,
  CreditCard,
  Phone,
  Image as ImageIcon,
  Send,
  Calendar,
  Zap,
  Crown,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subscription: SubscriptionInfo;
  profile: ShopProfile;
  language: Language;
  onSubscriptionUpdated: (newSub: SubscriptionInfo) => void;
  initialPlan?: 'monthly' | 'yearly';
}

export const SubscriptionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  subscription,
  profile,
  language,
  onSubscriptionUpdated,
  initialPlan = 'yearly',
}) => {
  const t = translations[language];
  const nagadNumber = '01733414031';
  const whatsappNumber = '01733414031';

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>(initialPlan);
  const [senderPhone, setSenderPhone] = useState(profile.phone || '');
  const [transactionId, setTransactionId] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // Manual License Key Input
  const [manualKey, setManualKey] = useState('');
  const [manualKeyError, setManualKeyError] = useState('');
  const [manualKeySuccess, setManualKeySuccess] = useState('');
  const [showManualKeyInput, setShowManualKeyInput] = useState(false);

  // Existing requests
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>(() =>
    DB.getPaymentRequests()
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const currentDetails = getSubscriptionDetails(subscription);
  const amount = selectedPlan === 'yearly' ? 799 : 99;
  const planLabel = selectedPlan === 'yearly' ? 'বার্ষিক Pro (৩৬৫ দিন)' : 'মাসিক Pro (৩০ দিন)';

  const handleCopyNagad = () => {
    navigator.clipboard.writeText(nagadNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsCompressing(true);
        // Compress screenshot to max 600px, 0.7 quality to keep storage lightweight
        const compressed = await compressImage(file, 600, 600, 0.7);
        if (compressed) {
          setScreenshot(compressed);
        }
      } catch (err) {
        console.error('Failed to compress screenshot', err);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  // Construct WhatsApp prefilled message
  const handleOpenWhatsApp = () => {
    const shopId = profile.shopId || subscription.shopId;
    const msg =
      `আসসালামু আলাইকুম।\n` +
      `সহজ দোকান POS Pro সাবস্ক্রিপশন নিতে চাই।\n\n` +
      `দোকানের নাম: ${profile.shopName || 'সহজ দোকান'}\n` +
      `দোকানের আইডি: ${shopId}\n` +
      `রেজিস্ট্রেশন নম্বর: ${profile.phone}\n` +
      `নির্বাচিত প্যাকেজ: ${planLabel}\n` +
      `টাকার পরিমাণ: ${amount} ৳\n` +
      `প্রেরকের নগদ নম্বর: ${senderPhone || 'দেওয়া হয়নি'}\n` +
      `Transaction ID: ${transactionId || 'দেওয়া হয়নি'}\n\n` +
      `অনুগ্রহ করে পেমেন্ট যাচাই করে Pro লাইসেন্স সক্রিয় করে দিন। (পেমেন্টের স্ক্রিনশট সংযুক্ত করলাম)`;

    const encoded = encodeURIComponent(msg);
    const url = `https://wa.me/88${whatsappNumber}?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Submit Payment Verification Request
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!senderPhone.trim() || senderPhone.replace(/\D/g, '').length < 11) {
      setFormError('টাকা পাঠানোর সঠিক ১১ সংখ্যার নগদ নম্বর দিন।');
      return;
    }
    if (!transactionId.trim() || transactionId.trim().length < 4) {
      setFormError('নগদের সঠিক Transaction ID (TrxID) লিখুন।');
      return;
    }

    setIsSubmitting(true);

    const shopId = profile.shopId || subscription.shopId;
    const newRequest: PaymentRequest = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shopId,
      shopName: profile.shopName || 'আমার দোকান',
      shopPhone: profile.phone,
      plan: selectedPlan,
      amount,
      senderPhone: senderPhone.trim(),
      transactionId: transactionId.trim().toUpperCase(),
      screenshot,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // 1. Save to local DB first (ensures offline resilient tracking)
    DB.addPaymentRequest(newRequest);
    setPaymentRequests(DB.getPaymentRequests());

    // 2. Sync with server if online
    try {
      await fetch('/api/payment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRequest),
      });
    } catch (err) {
      // Offline fallback: saved in local db, user can click WhatsApp
      console.log('Server sync pending; local request registered.');
    }

    setIsSubmitting(false);
    setSubmitSuccess(true);
  };

  // Handle Manual License Key Activation
  const handleActivateManualKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualKeyError('');
    setManualKeySuccess('');

    if (!manualKey.trim()) {
      setManualKeyError('লাইসেন্স কোড লিখুন বা পেস্ট করুন।');
      return;
    }

    const shopId = profile.shopId || subscription.shopId;
    const result = parseAndVerifyLicenseKey(manualKey.trim(), shopId, profile.phone);

    if (!result.valid || !result.payload) {
      setManualKeyError(result.errorMessage || 'লাইসেন্স কোডটি সঠিক নয়!');
      return;
    }

    // Activated successfully
    const durationDays =
      result.payload.plan === 'lifetime'
        ? 36500
        : result.payload.plan === 'yearly'
        ? 365
        : 30;
    const updated = DB.activatePro(result.payload.plan, durationDays, manualKey.trim());
    onSubscriptionUpdated(updated);

    setManualKeySuccess('অভিনন্দন! আপনার Pro সাবস্ক্রিপশন সফলভাবে সক্রিয় হয়েছে।');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  // Check approved requests to auto-activate
  const handleClaimApprovedRequest = (req: PaymentRequest) => {
    if (req.status === 'approved' && req.generatedLicenseKey) {
      const shopId = profile.shopId || subscription.shopId;
      const result = parseAndVerifyLicenseKey(req.generatedLicenseKey, shopId, profile.phone);
      if (result.valid && result.payload) {
        const durationDays =
          result.payload.plan === 'lifetime'
            ? 36500
            : result.payload.plan === 'yearly'
            ? 365
            : 30;
        const updated = DB.activatePro(result.payload.plan, durationDays, req.generatedLicenseKey);
        onSubscriptionUpdated(updated);
        alert('আপনার Pro লাইসেন্স সফলভাবে সক্রিয় হয়েছে!');
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-xl my-auto overflow-hidden rounded-3xl bg-white shadow-2xl border border-emerald-100 dark:bg-slate-900 dark:border-emerald-900/40">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-green-950 p-5 sm:p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg">
              <Sparkles className="w-6 h-6 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Sahoj Dokan Pro</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                  অফিসিয়াল
                </span>
              </div>
              <p className="text-xs text-emerald-200 mt-0.5">
                সীমাহীন পণ্য, বারকোড স্ক্যান, ক্যাশ মেমো প্রিন্ট ও পূর্ণাঙ্গ হিসাব
              </p>
            </div>
          </div>

          {/* Current Status Badge */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>বর্তমান অবস্থা: <strong>{currentDetails.statusText}</strong></span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 max-h-[75vh] overflow-y-auto space-y-6">

          {/* Special App Owner Banner */}
          {(currentDetails.badgeText === '👑 OWNER' || subscription?.isOwner) && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border-2 border-amber-400 dark:border-amber-500/50 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-400 text-slate-950 shrink-0">
                <Crown className="w-5 h-5 fill-slate-950" />
              </div>
              <div>
                <h4 className="font-black text-sm text-amber-900 dark:text-amber-300">
                  👑 আপনি অ্যাপের মালিক (Super Admin / Creator)
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5 leading-relaxed">
                  আপনার জন্য আজীবন (Lifetime Unlimited) Pro সদস্যপদ সক্রিয় রয়েছে। আপনার কোনো সাবস্ক্রিপশন ফি বা টাকা প্রদান করতে হবে না। নিচের প্যাকেজগুলো সাধারণ দোকানদার গ্রাহকদের জন্য।
                </p>
              </div>
            </div>
          )}

          {/* Package Selection Cards */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
              ১. আপনার প্যাকেজ পছন্দ করুন
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Monthly Plan */}
              <div
                onClick={() => setSelectedPlan('monthly')}
                className={`cursor-pointer rounded-2xl p-4 border-2 transition relative ${
                  selectedPlan === 'monthly'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20 dark:bg-emerald-950/30 dark:border-emerald-500'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-slate-800 dark:text-white">মাসিক Pro</span>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                      selectedPlan === 'monthly'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white dark:bg-slate-700'
                    }`}
                  >
                    {selectedPlan === 'monthly' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">৯৯ ৳</span>
                  <span className="text-xs text-slate-500">/ ৩০ দিন</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  প্রতি মাসে রিচার্জ করে সব প্রিমিয়াম ফিচার ব্যবহার করুন।
                </p>
              </div>

              {/* Yearly Plan (Recommended) */}
              <div
                onClick={() => setSelectedPlan('yearly')}
                className={`cursor-pointer rounded-2xl p-4 border-2 transition relative ${
                  selectedPlan === 'yearly'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20 dark:bg-emerald-950/30 dark:border-emerald-500'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                <span className="absolute -top-2.5 right-3 bg-amber-500 text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded-full shadow-sm">
                  সেরা সাশ্রয়ী (Save 33%)
                </span>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-slate-800 dark:text-white">বার্ষিক Pro</span>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                      selectedPlan === 'yearly'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white dark:bg-slate-700'
                    }`}
                  >
                    {selectedPlan === 'yearly' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">৭৯৯ ৳</span>
                  <span className="text-xs text-slate-500">/ ৩৬৫ দিন</span>
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold mt-2">
                  সারা বছর চিন্তা ছাড়া ব্যবসা চালান। ৩৯৯ টাকা সাশ্রয়!
                </p>
              </div>
            </div>
          </div>

          {/* Payment Method Details (Nagad Send Money) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-emerald-500/10 border border-amber-300/60 dark:border-amber-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  নগদ
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    নগদ (Nagad) সেন্ডমানি
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    নির্বাচিত প্যাকেজ অনুযায়ী <strong className="text-orange-600 dark:text-orange-400 font-extrabold">{amount} টাকা</strong> পাঠান
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-[11px] font-bold dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-900">
                Send Money
              </span>
            </div>

            {/* Nagad Number Copy Card */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-sm">
              <div>
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                  আমাদের অফিসিয়াল নগদ পার্সোনাল নম্বর:
                </span>
                <span className="font-mono text-lg font-black text-slate-900 dark:text-white tracking-wider">
                  {nagadNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyNagad}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'কপি হয়েছে!' : 'কপি করুন'}</span>
              </button>
            </div>
          </div>

          {/* Payment Verification Form */}
          {!submitSuccess ? (
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                ২. টাকা পাঠানোর তথ্য দিন
              </label>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-2 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Sender Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    যে নম্বর থেকে টাকা পাঠিয়েছেন *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="০১৭১xxxxxxx"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Transaction ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    নগদ Transaction ID (TrxID) *
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="যেমন: 7K9J2L3P"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase font-mono text-xs sm:text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Screenshot Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  পেমেন্টের স্ক্রিনশট (ঐচ্ছিক কিন্তু দ্রুত অনুমোদনে সহায়ক)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-sm border border-slate-300 dark:border-slate-600 active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{screenshot ? 'স্ক্রিনশট পরিবর্তন করুন' : 'ছবি আপলোড করুন'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleScreenshotUpload}
                  />

                  {isCompressing && (
                    <span className="text-xs text-slate-500 animate-pulse">প্রসেস হচ্ছে...</span>
                  )}

                  {screenshot && (
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-500 bg-slate-100 dark:bg-slate-800 shrink-0">
                        <img src={screenshot} alt="Screenshot" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-xs text-emerald-600 font-bold">সংযুক্ত হয়েছে</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Important Admin Verification Note */}
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>পেমেন্ট যাচাই নিয়ম:</span>
                </p>
                <p>
                  পেমেন্টের আবেদন জমা দিলেই Pro সাথে সাথে চালু হবে না। অ্যাডমিন নিজের নগদ অ্যাকাউন্টে টাকা পাওয়ার সত্যতা যাচাই করে অনুমোদন দিলে আপনার অ্যাপে ডিজিটাল লাইসেন্স সক্রিয় হবে।
                </p>
              </div>

              {/* Action Buttons: Submit & WhatsApp */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'জমা হচ্ছে...' : 'পেমেন্ট আবেদন জমা দিন'}</span>
                </button>

                {/* WhatsApp Direct Chat Button */}
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="py-3 px-4 bg-[#25D366] hover:bg-[#1EBE5D] text-slate-950 font-black rounded-2xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 text-xs sm:text-sm shrink-0"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp যোগাযোগ</span>
                </button>
              </div>
            </form>
          ) : (
            /* Submission Success Card */
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-base text-emerald-900 dark:text-emerald-200">
                পেমেন্টের আবেদন সফলভাবে জমা হয়েছে!
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                আপনার Transaction ID: <strong>{transactionId}</strong>। অ্যাডমিন টাকা প্রাপ্তি নিশ্চিত করে দ্রুত আপনার Pro লাইসেন্স সক্রিয় করে দেবেন।
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="py-2.5 px-4 bg-[#25D366] hover:bg-[#1EBE5D] text-slate-950 font-bold rounded-xl text-xs shadow flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>হোয়াটসঅ্যাপে স্ক্রিনশট পাঠিয়ে দ্রুত অনুমোদন নিন</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitSuccess(false)}
                  className="py-2.5 px-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs border border-slate-300 dark:border-slate-600"
                >
                  আরেকটি আবেদন
                </button>
              </div>
            </div>
          )}

          {/* Direct License Key Activation Section (Offline / WhatsApp Code) */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowManualKeyInput(!showManualKeyInput)}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{showManualKeyInput ? 'লাইসেন্স কোড ইনপুট লুকান' : 'লাইসেন্স কোড পেয়েছেন? সরাসরি সক্রিয় করুন'}</span>
            </button>

            {showManualKeyInput && (
              <form onSubmit={handleActivateManualKey} className="mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  অ্যাডমিন হোয়াটসঅ্যাপে আপনাকে যে ডিজিটাল Pro লাইসেন্স কোডটি দিয়েছেন, সেটি এখানে পেস্ট করে সরাসরি অফলাইনে বা অনলাইনে সক্রিয় করে নিন।
                </p>

                {manualKeyError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-1.5 border border-rose-200">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{manualKeyError}</span>
                  </div>
                )}
                {manualKeySuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{manualKeySuccess}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    placeholder="SAHOJ-YEARLY-eyJ..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow transition active:scale-95"
                  >
                    সক্রিয় করুন
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Recent Payment Requests List */}
          {paymentRequests.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                আপনার সাম্প্রতিক পেমেন্ট আবেদনসমূহ:
              </h5>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {paymentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-white">
                          TrxID: {req.transactionId}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({req.plan === 'yearly' ? '৭৯৯৳ বার্ষিক' : '৯৯৳ মাসিক'})
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(req.createdAt).toLocaleDateString('bn-BD')} • প্রেরক: {req.senderPhone}
                      </span>
                    </div>

                    <div>
                      {req.status === 'approved' ? (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            অনুমোদিত
                          </span>
                          {req.generatedLicenseKey && (
                            <button
                              type="button"
                              onClick={() => handleClaimApprovedRequest(req)}
                              className="px-2 py-0.5 rounded bg-emerald-700 text-white font-bold text-[10px]"
                            >
                              সক্রিয় করুন
                            </button>
                          )}
                        </div>
                      ) : req.status === 'rejected' ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                          বাতিল
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          যাচাই চলছে (Pending)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
