import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, Shield, Smartphone, Cloud, RefreshCw, CloudDownload, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { ShopProfile, Language } from '../types';
import { CloudSync, CloudSyncStatus } from '../services/cloudSync';

interface Props {
  profile: ShopProfile;
  language: Language;
  onBack: () => void;
  onDataRestored: () => void;
}

export const DataBackupView: React.FC<Props> = ({
  profile,
  language,
  onBack,
  onDataRestored,
}) => {
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>(() => CloudSync.getStatus());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Restore Modal State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePhone, setRestorePhone] = useState(
    profile.phone || (typeof localStorage !== 'undefined' ? localStorage.getItem('sd_registered_phone') || '' : '')
  );
  const [isChecking, setIsChecking] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [cloudBackupInfo, setCloudBackupInfo] = useState<{
    hasCloudData: boolean;
    lastSyncedAt?: string;
    profile?: any;
    stats?: { products: number; sales: number; customers: number };
    error?: string;
  } | null>(null);

  useEffect(() => {
    const unsub = CloudSync.subscribe((status) => {
      setCloudStatus(status);
    });
    return () => unsub();
  }, []);

  // Format Bangla date & time
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'এখনও কোনো ব্যাকআপ নেওয়া হয়নি';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('bn-BD', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }) + ', ' + d.toLocaleTimeString('bn-BD', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (_) {
      return dateStr;
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncToast(null);
    try {
      const res = await CloudSync.syncNow();
      if (res.success) {
        setSyncToast({
          type: 'success',
          message: 'আপনার সমস্ত হিসাব ক্লাউড সার্ভারে সফলভাবে সংরক্ষিত হয়েছে!',
        });
      } else {
        setSyncToast({
          type: 'error',
          message: res.error || 'সিঙ্ক করা সম্ভব হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।',
        });
      }
    } catch (err: any) {
      setSyncToast({
        type: 'error',
        message: err.message || 'ক্লাউড সিঙ্ক করতে সমস্যা হয়েছে।',
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncToast(null), 3500);
    }
  };

  const handleCheckCloud = async () => {
    if (!restorePhone.trim()) {
      alert('অনুগ্রহ করে মোবাইল নম্বর লিখুন');
      return;
    }
    setIsChecking(true);
    setCloudBackupInfo(null);
    try {
      const info = await CloudSync.checkCloudBackup(restorePhone);
      setCloudBackupInfo(info);
    } catch (err: any) {
      setCloudBackupInfo({
        hasCloudData: false,
        error: err.message || 'ক্লাউড সার্ভারের সাথে সংযোগ করা যায়নি।',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restorePhone.trim()) return;
    setIsRestoring(true);
    try {
      const res = await CloudSync.restoreFromCloud(restorePhone, profile.pin);
      if (res.success) {
        alert('✅ ' + res.message);
        setShowRestoreModal(false);
        setCloudBackupInfo(null);
        onDataRestored();
      } else {
        alert('❌ ' + res.message);
      }
    } catch (err: any) {
      alert('রিস্টোর করতে সমস্যা: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-116px)] bg-[#eef3f6] dark:bg-slate-950 flex flex-col justify-between">
      {/* Top App Bar with Back Arrow */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10 shadow-xs">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6 text-slate-800 dark:text-white" />
        </button>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          ডাটা ব্যাকআপ
        </h1>
      </div>

      {/* Main Body - Matches user's uploaded reference screenshot */}
      <div className="flex-1 max-w-md w-full mx-auto p-5 sm:p-6 flex flex-col justify-center space-y-6">
        
        {/* Toast Feedback */}
        {syncToast && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
              syncToast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-200'
            }`}
          >
            {syncToast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{syncToast.message}</span>
          </div>
        )}

        {/* Central Circular Success Badge */}
        <div className="flex flex-col items-center text-center pt-2">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#d7f0db] dark:bg-emerald-950/50 flex items-center justify-center mb-5 shadow-inner">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#2da34e] text-white flex items-center justify-center shadow-md">
              <Check className="w-9 h-9 stroke-[3]" />
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-[#2da34e] tracking-tight">
            ডাটা আপ-টু-ডেট আছে!
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-xs leading-relaxed">
            আপনার সমস্ত হিসাব ক্লাউড সার্ভারে ১০০% নিরাপদ ও সুরক্ষিত রয়েছে।
          </p>

          {/* Thin Divider */}
          <div className="w-full max-w-xs h-[1px] bg-slate-300/80 dark:bg-slate-700 my-5" />

          {/* Last Backup Timestamp */}
          <div className="space-y-1">
            <span className="block text-xs font-bold text-slate-600 dark:text-slate-400">
              সর্বশেষ ব্যাকআপ সম্পন্ন হয়েছে:
            </span>
            <span className="block text-base sm:text-lg font-black text-[#13663b] dark:text-emerald-400">
              {formatDateTime(cloudStatus.lastSyncedAt)}
            </span>
          </div>
        </div>

        {/* Feature Highlights (Shield & Device restore) */}
        <div className="space-y-4 pt-3 max-w-xs mx-auto w-full">
          {/* Feature 1: ১০০% নিরাপদ ও সুরক্ষিত */}
          <div className="flex items-start gap-3.5">
            <div className="p-1 text-[#1a73e8] shrink-0 mt-0.5">
              <Shield className="w-6 h-6 fill-[#1a73e8]/15" />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                ১০০% নিরাপদ ও সুরক্ষিত
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                আপনার সকল হিসাব শুধু আপনার লগইন প্যানেলেই সংরক্ষিত থাকবে।
              </p>
            </div>
          </div>

          {/* Feature 2: ডাটা হারানো রোধ */}
          <div className="flex items-start gap-3.5">
            <div className="p-1 text-[#1a73e8] shrink-0 mt-0.5">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                ডাটা হারানো রোধ
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                ফোন পাল্টালেও লগইন করে হিসাব ফিরে পাবেন।
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 max-w-xs mx-auto w-full">
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncNow}
            className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'এখনই ব্যাকআপ'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRestorePhone(profile.phone || '');
              setShowRestoreModal(true);
              if (profile.phone) {
                setIsChecking(true);
                CloudSync.checkCloudBackup(profile.phone)
                  .then(setCloudBackupInfo)
                  .finally(() => setIsChecking(false));
              }
            }}
            className="py-2.5 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CloudDownload className="w-3.5 h-3.5" />
            <span>ক্লাউড রিস্টোর</span>
          </button>
        </div>
      </div>

      {/* Bottom Status Card (As shown in screenshot) */}
      <div className="p-4 sm:p-5 max-w-md w-full mx-auto">
        <div className="w-full py-3.5 px-4 rounded-2xl bg-[#e3eaee] dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs border border-slate-300/50 dark:border-slate-700">
          <Cloud className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          <span>সমস্ত ডাটা আপ-টু-ডেট আছে</span>
        </div>
      </div>

      {/* Cloud Restore Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-md my-auto rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-800 via-indigo-800 to-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10 text-cyan-300">
                  <CloudDownload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">ক্লাউড থেকে ডেটা রিস্টোর</h3>
                  <p className="text-xs text-blue-200">সার্ভার থেকে আপনার পূর্বের তথ্য পুনরুদ্ধার করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRestoreModal(false);
                  setCloudBackupInfo(null);
                }}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  দোকানের রেজিস্টার্ড মোবাইল নম্বর
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={restorePhone}
                    onChange={(e) => setRestorePhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="flex-1 p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={isChecking}
                    onClick={handleCheckCloud}
                    className="px-4 py-3 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shrink-0 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isChecking ? 'খোঁজা হচ্ছে...' : 'চেক করুন'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  যে মোবাইল নম্বর দিয়ে ইতিপূর্বে হিসাব সংরক্ষণ করেছিলেন
                </p>
              </div>

              {/* Status / Cloud Data Found */}
              {isChecking && (
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-center text-xs text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2 font-semibold">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>ক্লাউড সার্ভারে ব্যাকআপ খোঁজা হচ্ছে...</span>
                </div>
              )}

              {cloudBackupInfo && !isChecking && (
                <div>
                  {cloudBackupInfo.hasCloudData ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>ক্লাউড ব্যাকআপ পাওয়া গেছে!</span>
                      </div>

                      {cloudBackupInfo.profile && (
                        <div className="text-xs text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/70 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <p className="font-bold text-slate-900 dark:text-white">
                            🏪 {cloudBackupInfo.profile.shopName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            মালিক: {cloudBackupInfo.profile.ownerName}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700">
                          <span className="block text-[10px] text-slate-500">পণ্য</span>
                          <span className="text-sm font-black text-emerald-600">
                            {cloudBackupInfo.stats?.products ?? 0} টি
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700">
                          <span className="block text-[10px] text-slate-500">বিক্রির রশিদ</span>
                          <span className="text-sm font-black text-blue-600">
                            {cloudBackupInfo.stats?.sales ?? 0} টি
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700">
                          <span className="block text-[10px] text-slate-500">বাকির খাতা</span>
                          <span className="text-sm font-black text-purple-600">
                            {cloudBackupInfo.stats?.customers ?? 0} জন
                          </span>
                        </div>
                      </div>

                      {cloudBackupInfo.lastSyncedAt && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                          সর্বশেষ ক্লাউড সেভ: {formatDateTime(cloudBackupInfo.lastSyncedAt)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{cloudBackupInfo.error || 'এই মোবাইল নম্বরের কোনো ক্লাউড ব্যাকআপ পাওয়া যায়নি।'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreModal(false);
                  setCloudBackupInfo(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
              >
                বাতিল
              </button>

              <button
                type="button"
                disabled={!cloudBackupInfo?.hasCloudData || isRestoring}
                onClick={handleExecuteRestore}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>রিস্টোর হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CloudDownload className="w-3.5 h-3.5" />
                    <span>হ্যাঁ, সম্পূর্ণ ডেটা রিস্টোর করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
