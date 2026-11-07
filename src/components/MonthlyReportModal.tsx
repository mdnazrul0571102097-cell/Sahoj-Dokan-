import React, { useRef, useState } from 'react';
import { ShopProfile } from '../types';
import {
  X,
  Printer,
  Download,
  Calendar,
  Building2,
  Phone,
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
  Wallet,
  Users,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { exportElementToPdf } from '../utils/pdfGenerator';

export interface MonthlyReportData {
  selectedMonth: string; // YYYY-MM
  openingCash: number;
  cashSales: number;
  dueSales: number;
  totalSales: number;
  totalProfit: number;
  totalExpenses: number;
  netProfit: number;
  customerDueCollected: number;
  ownerNewCapital: number;
  ownerWithdrawalReturn: number;
  otherCashIn: number;
  cashPurchases: number;
  shopExpenses: number;
  supplierDuePaid: number;
  ownerWithdrawal: number;
  otherCashOut: number;
  totalCashIn: number;
  totalCashOut: number;
  displayClosingCash: number;
  rawClosingCash: number;
  stockValue?: number;
  totalCustomerDue?: number;
  totalSupplierDue?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: ShopProfile;
  reportData: MonthlyReportData;
  appMode?: string;
  onOpenSubscriptionModal?: () => void;
}

export const MonthlyReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  profile,
  reportData,
  appMode = 'trial',
  onOpenSubscriptionModal,
}) => {
  if (!isOpen) return null;

  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const [yyyy, mm] = reportData.selectedMonth.split('-');
  const monthNamesBn = [
    'জানুয়ারি',
    'ফেব্রুয়ারি',
    'মার্চ',
    'এপ্রিল',
    'মে',
    'জুন',
    'জুলাই',
    'আগস্ট',
    'সেপ্টেম্বর',
    'অক্টোবর',
    'নভেম্বর',
    'ডিসেম্বর',
  ];
  const monthName = monthNamesBn[parseInt(mm, 10) - 1] || mm;
  const formattedMonthStr = `${monthName} ${yyyy} (${mm}-${yyyy})`;

  const handleDownloadPdf = async () => {
    if (appMode === 'normal') {
      onOpenSubscriptionModal?.();
      return;
    }
    if (!reportRef.current) return;
    setIsExporting(true);
    setToastMessage(null);

    try {
      const filename = `SahojDokan-MonthlyReport-${mm}-${yyyy}`;
      const success = await exportElementToPdf(reportRef.current, filename, 'portrait');
      if (success) {
        setToastMessage({
          type: 'success',
          message: `${formattedMonthStr} মাসের আর্থিক রিপোর্ট PDF ডাউনলোড সফল হয়েছে!`,
        });
      } else {
        setToastMessage({
          type: 'error',
          message: 'PDF ডাউনলোড ব্যর্থ হয়েছে। প্রিন্ট অপশনটি ব্যবহার করুন।',
        });
      }
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        message: 'PDF তৈরিতে সমস্যা: ' + err.message,
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handlePrint = () => {
    if (appMode === 'normal') {
      onOpenSubscriptionModal?.();
      return;
    }
    if (typeof window !== 'undefined' && (window as any).AndroidApp?.printReceipt) {
      try {
        (window as any).AndroidApp.printReceipt();
        return;
      } catch (_) {}
    }
    try {
      window.print();
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#0E6B6B] to-[#124E4E] p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">
                মাসিক আর্থিক রিপোর্ট (১ পাতা PDF)
              </h3>
              <p className="text-xs text-white/80 mt-0.5">
                নির্বাচিত মাস: <span className="font-bold text-amber-200">{formattedMonthStr}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Action Header Banner with Direct Download Button */}
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-[#64748B]">
            <Calendar className="w-4 h-4 text-[#0E6B6B]" />
            <span>মাসিক ক্যাশ হিসাব ও বিক্রয় রিপোর্ট</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#EDF2F7] text-[#102A43] border border-[#CBD5E1] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#64748B]" />
              <span>প্রিন্ট</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span>{isExporting ? 'PDF তৈরি হচ্ছে...' : '📥 মাসিক রিপোর্ট ডাউনলোড (PDF)'}</span>
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 ${
              toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            <span>{toastMessage.message}</span>
          </div>
        )}

        {/* Printable 1-Page Clean Report Card */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div
            ref={reportRef}
            className="bg-white p-5 sm:p-7 rounded-2xl border-2 border-[#CBD5E1] shadow-2xs space-y-4 print:border-none print:p-0 text-[#102A43]"
            style={{ minHeight: '600px' }}
          >
            {/* Top Shop Banner */}
            <div className="border-b-2 border-[#0E6B6B] pb-3 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-[#0E6B6B] tracking-tight">
                {profile.shopName || 'Sahoj Dokan'}
              </h2>
              <p className="text-xs text-[#486581] mt-0.5">
                {profile.address ? `${profile.address} • ` : ''}মোবাইল: {profile.phone}
              </p>
              <div className="mt-2 inline-block bg-[#E0F2F1] text-[#0E6B6B] text-xs font-black px-4 py-1 rounded-full border border-[#80CBC4]">
                মাসিক পূর্ণাঙ্গ আর্থিক বিবরণী (Monthly Financial Statement)
              </div>
              <p className="text-xs font-bold text-[#102A43] mt-1.5">
                হিসাবের মাস: <span className="text-[#0E6B6B] font-extrabold">{formattedMonthStr}</span>
              </p>
            </div>

            {/* Section 1: বিক্রয় ও মুনাফা বিবরণী (Sales & Profit) */}
            <div className="space-y-2">
              <h4 className="text-xs sm:text-sm font-black text-[#0E6B6B] uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
                <TrendingUp className="w-4 h-4" />
                <span>১. মাসিক বিক্রি ও লাভের হিসাব</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] block font-bold">মোট বিক্রি</span>
                  <span className="text-base font-black text-[#102A43] block mt-0.5">
                    ৳ {reportData.totalSales.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                  <span className="text-[11px] text-[#2E7D32] block font-bold">নগদ বিক্রি</span>
                  <span className="text-base font-black text-[#2E7D32] block mt-0.5">
                    ৳ {reportData.cashSales.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200">
                  <span className="text-[11px] text-amber-800 block font-bold">বাকি বিক্রি</span>
                  <span className="text-base font-black text-amber-900 block mt-0.5">
                    ৳ {reportData.dueSales.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#E0F2F1] border border-[#80CBC4]">
                  <span className="text-[11px] text-[#0E6B6B] block font-bold">মোট বিক্রয় লাভ</span>
                  <span className="text-base font-black text-[#0E6B6B] block mt-0.5">
                    ৳ {reportData.totalProfit.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Net Profit Summary Row */}
              <div className="p-2.5 rounded-xl bg-[#EDF2F7] border border-[#E2E8F0] flex items-center justify-between text-xs font-bold">
                <span className="text-[#486581]">
                  বিক্রয় লাভ (৳{reportData.totalProfit.toLocaleString()}) − দোকানের খরচ (৳
                  {reportData.shopExpenses.toLocaleString()})
                </span>
                <span className="text-sm font-black text-[#2E7D32]">
                  দোকান খরচের পর নিট লাভ: ৳ {reportData.netProfit.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Section 2: ক্যাশবাক্সের মাসিক প্রবাহ (Cashbook Summary) */}
            <div className="space-y-2">
              <h4 className="text-xs sm:text-sm font-black text-[#0E6B6B] uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
                <Wallet className="w-4 h-4" />
                <span>২. ক্যাশবাক্সের মাসিক হিসাব (ক্যাশ প্রবাহ)</span>
              </h4>

              {/* Opening & Closing Highlights */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-xs font-bold text-[#64748B] block">
                    মাসের শুরুর ব্যালেন্স (সকালের ক্যাশ)
                  </span>
                  <span className="text-lg font-black text-[#102A43] mt-0.5 block">
                    ৳ {reportData.openingCash.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#E0F2F1] border-2 border-[#0E6B6B]">
                  <span className="text-xs font-black text-[#0E6B6B] block">
                    মাসের শেষ ক্যাশ ব্যালেন্স (থাকার কথা)
                  </span>
                  <span className="text-lg font-black text-[#0E6B6B] mt-0.5 block">
                    ৳ {reportData.displayClosingCash.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Cash In vs Cash Out Breakdown Tables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Total Cash In */}
                <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-200 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center font-black text-[#2E7D32] pb-1 border-b border-emerald-200">
                    <span className="flex items-center gap-1">
                      <ArrowDownLeft className="w-3.5 h-3.5" /> মোট নগদ জমা
                    </span>
                    <span>+ ৳ {reportData.totalCashIn.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">+ নগদ বিক্রি</span>
                    <span className="font-bold">৳ {reportData.cashSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">+ কাস্টমারের বকেয়া আদায়</span>
                    <span className="font-bold">৳ {reportData.customerDueCollected.toLocaleString()}</span>
                  </div>
                  {(reportData.ownerNewCapital > 0 || reportData.ownerWithdrawalReturn > 0) && (
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">+ মালিকের পুঁজি জমা / ফেরত</span>
                      <span className="font-bold">
                        ৳ {(reportData.ownerNewCapital + reportData.ownerWithdrawalReturn).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {reportData.otherCashIn > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">+ অন্যান্য জমা</span>
                      <span className="font-bold">৳ {reportData.otherCashIn.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Total Cash Out */}
                <div className="p-3 rounded-xl bg-rose-50/40 border border-rose-200 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center font-black text-[#D32F2F] pb-1 border-b border-rose-200">
                    <span className="flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5" /> মোট নগদ খরচ ও পরিশোধ
                    </span>
                    <span>− ৳ {reportData.totalCashOut.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">− নগদ পণ্য ক্রয়</span>
                    <span className="font-bold">৳ {reportData.cashPurchases.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">− মহাজন/সাপ্লায়ারকে পরিশোধ</span>
                    <span className="font-bold">৳ {reportData.supplierDuePaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">− দোকানের যাবতীয় খরচ</span>
                    <span className="font-bold">৳ {reportData.shopExpenses.toLocaleString()}</span>
                  </div>
                  {reportData.ownerWithdrawal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">− মালিকের ব্যক্তিগত উত্তোলন</span>
                      <span className="font-bold">৳ {reportData.ownerWithdrawal.toLocaleString()}</span>
                    </div>
                  )}
                  {reportData.otherCashOut > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">− অন্যান্য খরচ</span>
                      <span className="font-bold">৳ {reportData.otherCashOut.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: সার্বিক আর্থিক সারসংক্ষেপ (Shop Assets & Liabilities) */}
            {(reportData.stockValue !== undefined ||
              reportData.totalCustomerDue !== undefined ||
              reportData.totalSupplierDue !== undefined) && (
              <div className="pt-2 border-t border-[#E2E8F0]">
                <h4 className="text-xs font-black text-[#486581] uppercase tracking-wider mb-2">
                  ৩. দোকানের বর্তমান আর্থিক স্থিতি
                </h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-center">
                    <span className="text-[10px] text-[#64748B] block font-bold">স্টকের বর্তমান মূল্য</span>
                    <span className="text-xs sm:text-sm font-black text-[#102A43]">
                      ৳ {(reportData.stockValue || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-center">
                    <span className="text-[10px] text-[#64748B] block font-bold">কাস্টমার বকেয়া</span>
                    <span className="text-xs sm:text-sm font-black text-amber-800">
                      ৳ {(reportData.totalCustomerDue || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-center">
                    <span className="text-[10px] text-[#64748B] block font-bold">মহাজন পাওনা</span>
                    <span className="text-xs sm:text-sm font-black text-[#D32F2F]">
                      ৳ {(reportData.totalSupplierDue || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Report Footer */}
            <div className="pt-3 border-t border-[#CBD5E1] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#64748B] gap-1">
              <span>সহজ দোকান POS (Sahoj Dokan) দ্বারা প্রস্তুতকৃত</span>
              <span>তারিখ: {new Date().toLocaleDateString('bn-BD')}</span>
              <span className="font-bold text-[#0E6B6B]">১ পাতার সম্পূর্ণ আর্থিক বিবরণী</span>
            </div>
          </div>
        </div>

        {/* Bottom Button Bar */}
        <div className="p-4 bg-white border-t border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#EDF2F7] hover:bg-[#E2E8F0] text-[#102A43] font-bold text-xs cursor-pointer"
          >
            বন্ধ করুন
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="px-6 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>{isExporting ? 'PDF ডাউনলোড হচ্ছে...' : '📥 মাসিক রিপোর্ট ডাউনলোড (PDF)'}</span>
            {appMode === 'normal' && (
              <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md font-black">
                🔒 Pro
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
