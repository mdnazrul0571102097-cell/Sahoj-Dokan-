import React, { useState, useRef } from 'react';
import { ShopProfile, DailyCashReconciliation } from '../types';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Bluetooth,
  Store,
  FileSpreadsheet,
} from 'lucide-react';
import {
  buildEscPosDayCloseReceipt,
  printDirectAndroidBridge,
  printDirectWebBluetooth,
} from '../utils/escpos';
import { exportElementToPdf } from '../utils/pdfGenerator';

export interface DayCloseData {
  dateStr: string; // YYYY-MM-DD
  openingCash: number;
  cashSales: number;
  dueSales: number;
  totalSales: number;
  totalProfit: number;
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
  totalSalesCount?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: ShopProfile;
  dayData: DayCloseData;
  onSaveDailyReconciliation?: (recon: DailyCashReconciliation) => void;
  onAddOwnerTransaction?: (tx: any) => void;
  appMode?: string;
  onOpenSubscriptionModal?: () => void;
}

export const DayCloseModal: React.FC<Props> = ({
  isOpen,
  onClose,
  profile,
  dayData,
  onSaveDailyReconciliation,
  onAddOwnerTransaction,
  appMode = 'trial',
  onOpenSubscriptionModal,
}) => {
  if (!isOpen) return null;

  const [currentTime] = useState(() => {
    return new Date().toLocaleTimeString('bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  });

  const [drawerInput, setDrawerInput] = useState<string>('');
  const [closingNote, setClosingNote] = useState<string>('');
  const [isEscPosPrinting, setIsEscPosPrinting] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const printableSlipRef = useRef<HTMLDivElement>(null);

  // Format DD-MM-YYYY
  const [yyyy, mm, dd] = dayData.dateStr.split('-');
  const formattedDate = `${dd}-${mm}-${yyyy}`;

  // Drawer Cash Calculation
  const drawerCash = drawerInput.trim() === '' ? null : Number(drawerInput);
  const hasDrawerCount = drawerCash !== null && !isNaN(drawerCash);
  const difference = hasDrawerCount ? Math.round(drawerCash - dayData.displayClosingCash) : 0;

  // 1. Direct Thermal Bluetooth Print
  const handleThermalBluetoothPrint = async () => {
    if (appMode === 'normal') {
      onOpenSubscriptionModal?.();
      return;
    }
    setIsEscPosPrinting(true);
    setToastMessage(null);

    try {
      const escPos = buildEscPosDayCloseReceipt(
        {
          shopName: profile.shopName || 'Sahoj Dokan',
          phone: profile.phone || '',
          address: profile.address || '',
          dateStr: formattedDate,
          timeStr: currentTime,
          openingCash: dayData.openingCash,
          cashSales: dayData.cashSales,
          dueSales: dayData.dueSales,
          totalSales: dayData.totalSales,
          totalProfit: dayData.totalProfit,
          customerDueCollected: dayData.customerDueCollected,
          ownerDeposit: dayData.ownerNewCapital + dayData.ownerWithdrawalReturn,
          cashPurchases: dayData.cashPurchases,
          shopExpenses: dayData.shopExpenses,
          supplierDuePaid: dayData.supplierDuePaid,
          ownerWithdrawal: dayData.ownerWithdrawal,
          expectedCash: dayData.displayClosingCash,
          actualCash: hasDrawerCount ? drawerCash : undefined,
          difference: hasDrawerCount ? difference : undefined,
          note: closingNote.trim() || undefined,
        },
        32
      );

      // Check native Android Bridge
      const b64 = escPos.toBase64();
      if (printDirectAndroidBridge(b64)) {
        setToastMessage({
          type: 'success',
          message: 'সরাসরি ব্লুটুথ থার্মাল প্রিন্টারে পাঠানো হয়েছে!',
        });
        setTimeout(() => setToastMessage(null), 3000);
        setIsEscPosPrinting(false);
        return;
      }

      // Check Web Bluetooth
      if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
        const res = await printDirectWebBluetooth(escPos.getBytes());
        setToastMessage({
          type: res.success ? 'success' : 'error',
          message: res.message,
        });
        setTimeout(() => setToastMessage(null), 3500);
        setIsEscPosPrinting(false);
        return;
      }

      // Fallback standard print
      window.print();
      setIsEscPosPrinting(false);
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        message: 'প্রিন্ট ব্যর্থ হয়েছে: ' + (err.message || 'ত্রুটি'),
      });
      setTimeout(() => setToastMessage(null), 3500);
      setIsEscPosPrinting(false);
    }
  };

  // 2. Download Clean PDF
  const handleDownloadPdf = async () => {
    if (appMode === 'normal') {
      onOpenSubscriptionModal?.();
      return;
    }
    if (!printableSlipRef.current) return;
    setIsGeneratingPdf(true);
    setToastMessage(null);

    try {
      const fileName = `SahojDokan-DayClose-${formattedDate}`;
      const success = await exportElementToPdf(printableSlipRef.current, fileName, 'portrait');
      if (success) {
        setToastMessage({
          type: 'success',
          message: 'ক্লোজিং স্লিপ PDF ফাইল ডাউনলোড সফল হয়েছে!',
        });
      } else {
        setToastMessage({
          type: 'error',
          message: 'PDF তৈরি করা যায়নি। প্রিন্ট অপশনটি ব্যবহার করুন।',
        });
      }
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        message: 'PDF ডাউনলোডে সমস্যা: ' + err.message,
      });
    } finally {
      setIsGeneratingPdf(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // 3. Save Day Close Reconciliation & Automatically Log Cash Home Takeout
  const handleSaveAndConfirm = () => {
    const takeHomeAmount = hasDrawerCount && drawerCash !== null && drawerCash > 0
      ? drawerCash
      : dayData.displayClosingCash;

    if (takeHomeAmount > 0 && onAddOwnerTransaction) {
      const withdrawalTx = {
        id: `tx_close_${dayData.dateStr}_${Date.now()}`,
        type: 'withdrawal' as const,
        amount: takeHomeAmount,
        note: 'দোকান ক্লোজ: রাতের ক্যাশ টাকা বাসায় নেওয়া',
        date: dayData.dateStr,
        createdAt: new Date().toISOString(),
      };
      onAddOwnerTransaction(withdrawalTx);
    }

    if (onSaveDailyReconciliation) {
      const recon: DailyCashReconciliation = {
        id: `recon_${dayData.dateStr}`,
        date: dayData.dateStr,
        openingCash: dayData.openingCash,
        cashSales: dayData.cashSales,
        customerDueCollected: dayData.customerDueCollected,
        ownerDepositAndReturn: dayData.ownerNewCapital + dayData.ownerWithdrawalReturn,
        otherCashIn: dayData.otherCashIn,
        cashPurchases: dayData.cashPurchases,
        supplierDuePaid: dayData.supplierDuePaid,
        shopExpenses: dayData.shopExpenses,
        ownerWithdrawal: dayData.ownerWithdrawal + (takeHomeAmount > 0 ? takeHomeAmount : 0),
        otherCashOut: dayData.otherCashOut,
        expectedClosingCash: dayData.displayClosingCash,
        actualClosingCash: hasDrawerCount ? drawerCash : dayData.displayClosingCash,
        difference: hasDrawerCount ? difference : 0,
        note: closingNote.trim() || 'দোকান ক্লোজ: রাতের টাকা বাসায় নেওয়া (ক্যাশ শূন্য)',
        isClosed: true,
        closedAt: new Date().toISOString(),
      };
      onSaveDailyReconciliation(recon);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0E6B6B] to-[#124E4E] p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Store className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  আজকের দোকান ক্লোজ ও হিসাব মিলান
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {currentTime}
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">
                {profile.shopName} • তারিখ: {formattedDate}
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

        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`px-4 py-2.5 text-xs font-bold text-center flex items-center justify-center gap-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span>{toastMessage.message}</span>
          </div>
        )}

        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Hero Cash Expected Card */}
          <div className="rounded-3xl bg-gradient-to-br from-[#E0F2F1] via-emerald-50 to-[#E8F5E9] p-4 border-2 border-[#0E6B6B] shadow-xs text-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-[#0E6B6B] text-white mb-2">
              <Wallet className="w-3.5 h-3.5" /> ক্যাশ বাক্সে থাকার কথা (লাইভ ব্যালেন্স)
            </span>
            <p className="text-3xl sm:text-4xl font-black text-[#0E6B6B] tracking-tight">
              ৳ {dayData.displayClosingCash.toLocaleString()}
            </p>
            <p className="text-xs text-[#486581] mt-1.5 font-medium">
              রাত ১২:০০ টার অপেক্ষা না করে সকাল থেকে ঠিক এই মুহূর্ত ({currentTime}) পর্যন্ত নগদ হিসাব
            </p>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-center">
              <span className="text-[11px] font-bold text-[#64748B] block">মোট বিক্রি</span>
              <span className="text-sm sm:text-base font-black text-[#102A43]">
                ৳ {dayData.totalSales.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#2E7D32] block">
                নগদ: ৳{dayData.cashSales.toLocaleString()}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-center">
              <span className="text-[11px] font-bold text-[#64748B] block">বিক্রয় লাভ</span>
              <span className="text-sm sm:text-base font-black text-[#2E7D32]">
                ৳ {dayData.totalProfit.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#64748B] block">পণ্য লাভ</span>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-center">
              <span className="text-[11px] font-bold text-[#64748B] block">মোট নগদ জমা</span>
              <span className="text-sm sm:text-base font-black text-[#2E7D32]">
                + ৳ {dayData.totalCashIn.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#64748B] block">ক্যাশ ইন</span>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-center">
              <span className="text-[11px] font-bold text-[#64748B] block">মোট খরচ/পরিশোধ</span>
              <span className="text-sm sm:text-base font-black text-[#D32F2F]">
                − ৳ {dayData.totalCashOut.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#64748B] block">ক্যাশ আউট</span>
            </div>
          </div>

          {/* Drawer Cash Verification (ক্যাশ ড্রয়ার গুনে মেলানো) */}
          <div className="p-4 rounded-3xl bg-[#F0FDF4] border-2 border-[#80CBC4] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-black text-[#102A43] flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-[#0E6B6B]" />
                <span>ড্রয়ার গুনে পাওয়া আসল ক্যাশ (টাকা)</span>
              </label>
              <span className="text-[11px] font-bold text-[#0E6B6B] bg-white px-2 py-0.5 rounded-md border border-[#80CBC4]">
                ঐচ্ছিক / মিলিয়ে দেখুন
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-black text-[#64748B]">
                ৳
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={drawerInput}
                onChange={(e) => setDrawerInput(e.target.value)}
                placeholder="যেমন: ১৫০০০ (হাতের নগদ কত টাকা গুনলেন)"
                className="w-full pl-9 pr-4 py-3 rounded-2xl bg-white border-2 border-[#80CBC4] text-[#102A43] font-black text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
              />
            </div>

            {/* Live Comparison Status */}
            {hasDrawerCount && (
              <div
                className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs sm:text-sm font-bold ${
                  difference === 0
                    ? 'bg-emerald-100 text-[#2E7D32] border-emerald-300'
                    : difference > 0
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-rose-100 text-[#D32F2F] border-rose-300'
                }`}
              >
                {difference === 0 ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-[#2E7D32]" />
                    <span>✓ ক্যাশ বাক্সের হিসাব একদম নির্ভুল! (হাতে গোনা ও থাকার কথা সম্পূর্ণ মিলে গেছে)</span>
                  </>
                ) : difference > 0 ? (
                  <>
                    <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700" />
                    <span>
                      ক্যাশ বাক্সে থাকার কথার চেয়ে <strong>৳ {difference.toLocaleString()} বেশি</strong> পাওয়া গেছে।
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 shrink-0 text-[#D32F2F]" />
                    <span>
                      ক্যাশ বাক্সে থাকার কথার চেয়ে <strong>৳ {Math.abs(difference).toLocaleString()} ঘাটতি/কম</strong> আছে।
                    </span>
                  </>
                )}
              </div>
            )}

            <div>
              <input
                type="text"
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                placeholder="ক্লোজিং মন্তব্য বা নোট (যেমন: ড্রয়ারে ছোট নোট রাখা হয়েছে)"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
              />
            </div>
          </div>

          {/* Detailed Statement Table (For Screen and PDF Rendering) */}
          <div
            ref={printableSlipRef}
            className="p-4 sm:p-5 rounded-3xl bg-white border border-[#E2E8F0] space-y-3 print:border-none print:p-0"
          >
            {/* Header for PDF Export */}
            <div className="text-center pb-2 border-b border-[#E2E8F0]">
              <h4 className="text-base sm:text-lg font-black text-[#102A43]">
                {profile.shopName || 'Sahoj Dokan'}
              </h4>
              <p className="text-xs text-[#64748B]">
                {profile.address ? `${profile.address} • ` : ''}মোবাইল: {profile.phone}
              </p>
              <div className="mt-1 inline-block bg-[#E0F2F1] text-[#0E6B6B] text-xs font-black px-3 py-0.5 rounded-full border border-[#B2DFDB]">
                দৈনিক দোকান ক্লোজিং স্লিপ (Day Close Slip)
              </div>
              <p className="text-[11px] text-[#64748B] mt-1">
                তারিখ: <strong>{formattedDate}</strong> • সময়: <strong>{currentTime}</strong>
              </p>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs sm:text-sm">
              <div className="flex justify-between py-1 border-b border-dashed border-[#E2E8F0]">
                <span className="text-[#64748B]">সকালের ক্যাশ (Opening Balance)</span>
                <span className="font-bold text-[#102A43]">৳ {dayData.openingCash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-dashed border-[#E2E8F0]">
                <span className="text-[#2E7D32]">+ আজকের নগদ বিক্রি</span>
                <span className="font-bold text-[#2E7D32]">+ ৳ {dayData.cashSales.toLocaleString()}</span>
              </div>
              {dayData.customerDueCollected > 0 && (
                <div className="flex justify-between py-1 border-b border-dashed border-[#E2E8F0]">
                  <span className="text-[#2E7D32]">+ কাস্টমারের বকেয়া আদায়</span>
                  <span className="font-bold text-[#2E7D32]">+ ৳ {dayData.customerDueCollected.toLocaleString()}</span>
                </div>
              )}
              {dayData.ownerNewCapital + dayData.ownerWithdrawalReturn > 0 && (
                <div className="flex justify-between py-1 border-b border-dashed border-[#E2E8F0]">
                  <span className="text-[#2E7D32]">+ মালিকের পুঁজি জমা / ফেরত</span>
                  <span className="font-bold text-[#2E7D32]">
                    + ৳ {(dayData.ownerNewCapital + dayData.ownerWithdrawalReturn).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-dashed border-[#E2E8F0]">
                <span className="text-[#D32F2F]">− নগদ পণ্য কেনা</span>
                <span className="font-bold text-[#D32F2F]">− ৳ {dayData.cashPurchases.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-dashed border-[#E2E8F0]">
                <span className="text-[#D32F2F]">− দোকানের খরচ</span>
                <span className="font-bold text-[#D32F2F]">− ৳ {dayData.shopExpenses.toLocaleString()}</span>
              </div>
              {dayData.supplierDuePaid > 0 && (
                <div className="flex justify-between py-1 border-b border-dashed border-[#E2E8F0]">
                  <span className="text-[#D32F2F]">− মহাজন/সাপ্লায়ারকে পরিশোধ</span>
                  <span className="font-bold text-[#D32F2F]">− ৳ {dayData.supplierDuePaid.toLocaleString()}</span>
                </div>
              )}
              {dayData.ownerWithdrawal > 0 && (
                <div className="flex justify-between py-1 border-b border-dashed border-[#E2E8F0]">
                  <span className="text-[#D32F2F]">− মালিকের ব্যক্তিগত খরচ</span>
                  <span className="font-bold text-[#D32F2F]">− ৳ {dayData.ownerWithdrawal.toLocaleString()}</span>
                </div>
              )}

              <div className="pt-2 flex justify-between items-center text-sm sm:text-base font-black border-t-2 border-[#102A43]">
                <span className="text-[#102A43]">ক্যাশ বাক্সে থাকার কথা</span>
                <span className="text-[#0E6B6B]">৳ {dayData.displayClosingCash.toLocaleString()}</span>
              </div>

              {hasDrawerCount && (
                <>
                  <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-[#64748B]">
                    <span>ড্রয়ারে গোনা আসল ক্যাশ</span>
                    <span className="text-[#102A43]">৳ {drawerCash.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm font-black">
                    <span>হিসাবের ফলাফল</span>
                    <span
                      className={
                        difference === 0
                          ? 'text-[#2E7D32]'
                          : difference > 0
                          ? 'text-amber-800'
                          : 'text-[#D32F2F]'
                      }
                    >
                      {difference === 0
                        ? 'হিসাব মিলেছে (✓ মিল আছে)'
                        : difference > 0
                        ? `+৳ ${difference.toLocaleString()} বেশি`
                        : `−৳ ${Math.abs(difference).toLocaleString()} ঘাটতি`}
                    </span>
                  </div>
                </>
              )}

              {closingNote.trim() && (
                <div className="pt-2 text-xs text-[#64748B] italic border-t border-dashed border-[#E2E8F0]">
                  নোট: {closingNote}
                </div>
              )}

              <div className="text-center pt-3 text-[11px] text-[#64748B] border-t border-[#E2E8F0]">
                সহজ দোকান POS দ্বারা পরিচালিত • হিসাব নির্ভুল ও নিরাপদ
              </div>
            </div>
          </div>

          {/* Auto Reset Notice */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-[#0E6B6B] space-y-1">
            <span className="font-black flex items-center gap-1.5 text-sm text-[#102A43]">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D32]" />
              দোকান ক্লোজ ও রাতের ক্যাশ নিয়ম:
            </span>
            <p className="text-[#486581] font-medium leading-relaxed">
              ক্লোজিং সম্পন্ন করলে ক্যাশ বাক্সে থাকা অবশিষ্ট সমস্ত টাকা (<strong>৳ {dayData.displayClosingCash.toLocaleString()}</strong>) স্বয়ংক্রিয়ভাবে &quot;মালিকের টাকা বাসায় নেওয়া&quot; হিসেবে হিসাবভুক্ত হয়ে ক্যাশ ড্রয়ার <strong>৳০</strong> হয়ে যাবে। পরের দিন সকালে ক্যাশ ড্রয়ার একদম ফ্রেশ (৳০) থেকে শুরু হবে।
            </p>
          </div>

          {/* Two Specific Required Buttons: Thermal Bluetooth Print & PDF Download */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Button 1: Thermal Bluetooth Print */}
              <button
                type="button"
                onClick={handleThermalBluetoothPrint}
                disabled={isEscPosPrinting}
                className="py-3 px-4 rounded-2xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Bluetooth className="w-4 h-4 text-emerald-300" />
                <Printer className="w-4 h-4" />
                <span>দৈনিক ক্লোজিং স্লিপ প্রিন্ট</span>
                {appMode === 'normal' && (
                  <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md font-black">
                    🔒 Pro
                  </span>
                )}
              </button>

              {/* Button 2: PDF Download */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="py-3 px-4 rounded-2xl bg-[#102A43] hover:bg-[#0A1A2A] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-amber-300" />
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'PDF তৈরি হচ্ছে...' : 'PDF ডাউনলোড'}</span>
                {appMode === 'normal' && (
                  <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md font-black">
                    🔒 Pro
                  </span>
                )}
              </button>
            </div>

            {/* Confirm & Close Button */}
            <button
              type="button"
              onClick={handleSaveAndConfirm}
              className="w-full py-3.5 rounded-2xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              <span>টাকা বাসায় নিয়ে দোকান ক্লোজিং সম্পন্ন করুন (৳০ রিসেট)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
