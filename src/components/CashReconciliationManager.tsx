import React, { useState, useMemo, useEffect } from 'react';
import {
  Sale,
  BakiTransaction,
  PurchaseRecord,
  BulkPurchase,
  SupplierTransaction,
  Expense,
  OwnerTransaction,
  OtherCashEntry,
  DailyCashReconciliation,
  MonthlyCashReconciliation,
  Product,
  Customer,
  Supplier,
  ShopProfile,
} from '../types';
import { DayCloseModal } from './DayCloseModal';
import { MonthlyReportModal } from './MonthlyReportModal';
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Wallet,
  Layers,
  Users,
  Building2,
  Landmark,
  Store,
  Download,
} from 'lucide-react';

interface Props {
  sales: Sale[];
  bakiTransactions: BakiTransaction[];
  purchases: PurchaseRecord[];
  bulkPurchases: BulkPurchase[];
  supplierTransactions: SupplierTransaction[];
  expenses: Expense[];
  ownerTransactions: OwnerTransaction[];
  otherCashEntries: OtherCashEntry[];
  dailyReconciliations: DailyCashReconciliation[];
  monthlyReconciliations: MonthlyCashReconciliation[];
  initialOpeningCash: number;
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  profile?: ShopProfile;
  onSaveInitialOpeningCash: (amount: number) => void;
  onAddOtherCashEntry: (entry: OtherCashEntry) => void;
  onDeleteOtherCashEntry: (id: string) => void;
  onSaveDailyReconciliation: (recon: DailyCashReconciliation) => void;
  onAddPostCloseAdjustment: (dateStr: string, adjustment: OtherCashEntry) => void;
  onSaveMonthlyReconciliation: (mRecon: MonthlyCashReconciliation) => void;
  onAddOwnerTransaction?: (tx: OwnerTransaction) => void;
  onDeleteOwnerTransaction?: (id: string) => void;
}

export const CashReconciliationManager: React.FC<Props> = ({
  sales,
  bakiTransactions,
  purchases,
  bulkPurchases,
  supplierTransactions,
  expenses,
  ownerTransactions,
  otherCashEntries,
  initialOpeningCash,
  products,
  customers,
  suppliers,
  profile = {
    shopName: 'সহজ দোকান',
    ownerName: '',
    phone: '',
    address: '',
    pin: '',
    currency: '৳',
    isRegistered: false,
    language: 'bn',
  },
  onSaveDailyReconciliation,
  onAddOwnerTransaction = () => {},
  onDeleteOwnerTransaction = () => {},
}) => {
  const [isDayCloseOpen, setIsDayCloseOpen] = useState(false);
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);
  const getLocalDateStr = (d?: string | Date): string => {
    if (!d) return '';
    try {
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const dt = typeof d === 'string' ? new Date(d) : d;
      if (isNaN(dt.getTime())) return typeof d === 'string' ? d.slice(0, 10) : '';
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return typeof d === 'string' ? d.slice(0, 10) : '';
    }
  };

  // Standard DD-MM-YYYY formatter (English digits, e.g., 03-11-2026)
  const formatDateDDMMYYYY = (d?: string | Date): string => {
    const ymd = getLocalDateStr(d);
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
    const [yyyy, mm, dd] = ymd.split('-');
    return `${dd}-${mm}-${yyyy}`;
  };

  // Format YYYY-MM to MM-YYYY
  const formatMonthMMYYYY = (ym: string): string => {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym;
    const [yyyy, mm] = ym.split('-');
    return `${mm}-${yyyy}`;
  };

  const [todayStr, setTodayStr] = useState<string>(() => getLocalDateStr(new Date()));
  const currentYearMonth = todayStr.slice(0, 7);

  // View Mode: 'daily' (দিনশেষের ক্যাশ মিল) vs 'monthly' (মাসিক ক্যাশ রিপোর্ট)
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateStr(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    getLocalDateStr(new Date()).slice(0, 7)
  );

  // Automatic midnight (12:00 AM) rollover watcher:
  // When clock crosses 00:00, automatically advance todayStr and selectedDate so yesterday's
  // closing cash becomes the new day's "সকালের ক্যাশ (Opening Balance)" without any button press.
  useEffect(() => {
    const timer = setInterval(() => {
      const nowDateStr = getLocalDateStr(new Date());
      if (nowDateStr !== todayStr) {
        setSelectedDate((prevSelected) => (prevSelected === todayStr ? nowDateStr : prevSelected));
        setSelectedMonth(nowDateStr.slice(0, 7));
        setTodayStr(nowDateStr);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [todayStr]);

  const matchesDate = (rawDate: string | undefined, targetDate: string): boolean => {
    if (!rawDate) return false;
    return getLocalDateStr(rawDate) === targetDate || rawDate.slice(0, 10) === targetDate;
  };

  const matchesMonth = (rawDate: string | undefined, targetYearMonth: string): boolean => {
    if (!rawDate) return false;
    return (
      getLocalDateStr(rawDate).startsWith(targetYearMonth) ||
      rawDate.slice(0, 7) === targetYearMonth
    );
  };

  // Compute automated daily cash flows for any YYYY-MM-DD date
  const computeDayFlows = (dateStr: string) => {
    // 1. + নগদ বিক্রি (Cash portion of sales, minus any product return cash refunds)
    const cashSales = Math.round(
      sales
        .filter((s) => matchesDate(s.date, dateStr))
        .reduce((sum, s) => {
          if (s.id?.startsWith('return_') || (s.grandTotal || 0) < 0 || (s.paidAmount || 0) < 0) {
            const refundCash =
              s.paidAmount !== undefined && s.paidAmount !== 0
                ? s.paidAmount
                : (s.grandTotal || 0) !== 0
                ? s.grandTotal
                : s.profit || 0;
            return sum + refundCash;
          }
          return sum + Math.max(0, (s.grandTotal || 0) - (s.dueAmount || 0));
        }, 0)
    );

    // 2. + কাস্টমারের বকেয়া আদায় (Customer due collection)
    const customerDueCollected = Math.round(
      bakiTransactions
        .filter((tx) => tx.type === 'payment_received' && matchesDate(tx.date, dateStr))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );

    // 3. + মালিকের নতুন পুঁজি জমা (Owner new capital deposit)
    const ownerNewCapital = Math.round(
      ownerTransactions
        .filter((tx) => tx.type === 'capital_deposit' && matchesDate(tx.date, dateStr))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );

    // 4. + নেওয়া টাকা ক্যাশে ফেরত (Owner withdrawal returned to cash)
    const ownerWithdrawalReturn = Math.round(
      ownerTransactions
        .filter((tx) => tx.type === 'withdrawal_return' && matchesDate(tx.date, dateStr))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );

    // Legacy other cash-in (if any existed previously)
    const otherCashIn = Math.round(
      otherCashEntries
        .filter(
          (e) => e.type === 'cash_in' && !e.isPostCloseAdjustment && matchesDate(e.date, dateStr)
        )
        .reduce((sum, e) => sum + (e.amount || 0), 0)
    );

    // 5. − নগদ পণ্য কেনা (Cash product purchases: bulk cash paid + direct restock purchases)
    const bulkCashPaid = bulkPurchases
      .filter((bp) => matchesDate(bp.date, dateStr))
      .reduce(
        (sum, bp) =>
          sum +
          Math.max(
            0,
            bp.paidAmount !== undefined
              ? bp.paidAmount
              : (bp.totalAmount || 0) - (bp.dueAmount || 0)
          ),
        0
      );

    const directPurchasePaid = purchases
      .filter((p) => matchesDate(p.date, dateStr))
      .reduce((sum, p) => sum + (p.totalCost || 0), 0);

    const cashPurchases = Math.round(bulkCashPaid + directPurchasePaid);

    // 6. − দোকানের যাবতীয় খরচ (Shop operating expenses)
    const shopExpenses = Math.round(
      expenses
        .filter((exp) => matchesDate(exp.date, dateStr))
        .reduce((sum, exp) => sum + (exp.amount || 0), 0)
    );

    // 7. − মহাজন/সাপ্লায়ারকে দেওয়া টাকা (Supplier due paid)
    const supplierDuePaid = Math.round(
      supplierTransactions
        .filter(
          (stx) =>
            (stx.type === 'payment_made' || stx.type === 'payment_given') &&
            matchesDate(stx.date, dateStr)
        )
        .reduce((sum, stx) => sum + (stx.amount || 0), 0)
    );

    // 8. − মালিকের ব্যক্তিগত খরচ/নেওয়া (Owner withdrawal)
    const ownerWithdrawal = Math.round(
      ownerTransactions
        .filter((tx) => tx.type === 'withdrawal' && matchesDate(tx.date, dateStr))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );

    // Legacy other cash-out (if any existed previously)
    const otherCashOut = Math.round(
      otherCashEntries
        .filter(
          (e) => e.type === 'cash_out' && !e.isPostCloseAdjustment && matchesDate(e.date, dateStr)
        )
        .reduce((sum, e) => sum + (e.amount || 0), 0)
    );

    const daySalesList = sales.filter((s) => matchesDate(s.date, dateStr));
    const totalSales = Math.round(daySalesList.reduce((sum, s) => sum + (s.grandTotal || 0), 0));
    const dueSales = Math.round(daySalesList.reduce((sum, s) => sum + (s.dueAmount || 0), 0));
    const totalProfit = Math.round(daySalesList.reduce((sum, s) => sum + (s.profit || 0), 0));
    const totalSalesCount = daySalesList.length;

    const totalCashIn =
      cashSales + customerDueCollected + ownerNewCapital + ownerWithdrawalReturn + otherCashIn;
    const totalCashOut =
      cashPurchases + shopExpenses + supplierDuePaid + ownerWithdrawal + otherCashOut;

    return {
      cashSales,
      dueSales,
      totalSales,
      totalProfit,
      totalSalesCount,
      customerDueCollected,
      ownerNewCapital,
      ownerWithdrawalReturn,
      otherCashIn,
      cashPurchases,
      shopExpenses,
      supplierDuePaid,
      ownerWithdrawal,
      otherCashOut,
      totalCashIn,
      totalCashOut,
      netFlow: totalCashIn - totalCashOut,
    };
  };

  // All unique dates across all records for automatic day-by-day opening balance chaining
  const allRecordedDates = useMemo(() => {
    const dateSet = new Set<string>();
    const addDate = (raw?: string) => {
      const d = getLocalDateStr(raw);
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) dateSet.add(d);
    };

    sales.forEach((s) => addDate(s.date));
    bakiTransactions.forEach((tx) => addDate(tx.date));
    ownerTransactions.forEach((tx) => addDate(tx.date));
    bulkPurchases.forEach((bp) => addDate(bp.date));
    purchases.forEach((p) => addDate(p.date));
    supplierTransactions.forEach((stx) => addDate(stx.date));
    expenses.forEach((exp) => addDate(exp.date));
    otherCashEntries.forEach((oce) => addDate(oce.date));
    dateSet.add(todayStr);

    return Array.from(dateSet).sort((a, b) => a.localeCompare(b));
  }, [
    sales,
    bakiTransactions,
    ownerTransactions,
    bulkPurchases,
    purchases,
    supplierTransactions,
    expenses,
    otherCashEntries,
    todayStr,
  ]);

  // Compute automatic "সকালের ক্যাশ (Opening Balance)" for any targetDate by chaining
  // every prior day's closing cash automatically after 12:00 AM midnight.
  const computeAutoOpeningCashForDate = (targetDate: string): number => {
    let runningBalance = Math.max(0, Math.round(initialOpeningCash || 0));
    const priorDates = allRecordedDates.filter((d) => d < targetDate);

    for (const d of priorDates) {
      const dayFlow = computeDayFlows(d);
      // Each day's closing cash rolls over to the next morning's opening cash (clamped >= 0)
      runningBalance = Math.max(0, runningBalance + dayFlow.totalCashIn - dayFlow.totalCashOut);
    }

    return Math.round(runningBalance);
  };

  // Live automated data for selectedDate
  const activeDayData = useMemo(() => {
    const openingCash = computeAutoOpeningCashForDate(selectedDate);
    const live = computeDayFlows(selectedDate);

    // Formula:
    // ক্যাশ বাক্সে থাকার কথা = সকালের ক্যাশ + (নগদ বিক্রি + কাস্টমারের বকেয়া আদায় + মালিকের নতুন পুঁজি জমা + নেওয়া টাকা ক্যাশে ফেরত)
    //                        - (নগদ পণ্য কেনা + দোকানের যাবতীয় খরচ + মহাজন/সাপ্লায়ারকে দেওয়া টাকা + মালিকের ব্যক্তিগত খরচ/নেওয়া)
    const rawClosingCash = openingCash + live.totalCashIn - live.totalCashOut;
    const isDeficitWarning = rawClosingCash < 0;
    const deficitAmount = isDeficitWarning ? Math.abs(rawClosingCash) : 0;
    // Never show a negative cash balance
    const displayClosingCash = Math.max(0, rawClosingCash);

    return {
      openingCash,
      ...live,
      rawClosingCash,
      displayClosingCash,
      isDeficitWarning,
      deficitAmount,
    };
  }, [
    selectedDate,
    allRecordedDates,
    initialOpeningCash,
    sales,
    bakiTransactions,
    ownerTransactions,
    bulkPurchases,
    purchases,
    supplierTransactions,
    expenses,
    otherCashEntries,
  ]);

  // Automated recent daily history (last 15 active dates)
  const automatedDailyHistory = useMemo(() => {
    let runningBalance = Math.max(0, Math.round(initialOpeningCash || 0));
    const rows = allRecordedDates.map((d) => {
      const opening = runningBalance;
      const flow = computeDayFlows(d);
      const rawClosing = opening + flow.totalCashIn - flow.totalCashOut;
      const closing = Math.max(0, rawClosing);
      runningBalance = closing;
      return {
        date: d,
        openingCash: opening,
        totalCashIn: flow.totalCashIn,
        totalCashOut: flow.totalCashOut,
        closingCash: closing,
        isDeficit: rawClosing < 0,
        deficitAmount: rawClosing < 0 ? Math.abs(rawClosing) : 0,
      };
    });
    return rows.reverse().slice(0, 15);
  }, [
    allRecordedDates,
    initialOpeningCash,
    sales,
    bakiTransactions,
    ownerTransactions,
    bulkPurchases,
    purchases,
    supplierTransactions,
    expenses,
    otherCashEntries,
  ]);

  // Automated Monthly Cash Report
  const monthlyReport = useMemo(() => {
    const monthStartStr = `${selectedMonth}-01`;
    const openingCash = computeAutoOpeningCashForDate(monthStartStr);

    const cashSales = Math.round(
      sales
        .filter((s) => matchesMonth(s.date, selectedMonth))
        .reduce((sum, s) => {
          if (s.id?.startsWith('return_') || (s.grandTotal || 0) < 0 || (s.paidAmount || 0) < 0) {
            const refundCash =
              s.paidAmount !== undefined && s.paidAmount !== 0
                ? s.paidAmount
                : (s.grandTotal || 0) !== 0
                ? s.grandTotal
                : s.profit || 0;
            return sum + refundCash;
          }
          return sum + Math.max(0, (s.grandTotal || 0) - (s.dueAmount || 0));
        }, 0)
    );

    const customerDueCollected = Math.round(
      bakiTransactions
        .filter((tx) => tx.type === 'payment_received' && matchesMonth(tx.date, selectedMonth))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );

    const ownerNewCapital = Math.round(
      ownerTransactions
        .filter((tx) => tx.type === 'capital_deposit' && matchesMonth(tx.date, selectedMonth))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );

    const ownerWithdrawalReturn = Math.round(
      ownerTransactions
        .filter((tx) => tx.type === 'withdrawal_return' && matchesMonth(tx.date, selectedMonth))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );

    const otherCashIn = Math.round(
      otherCashEntries
        .filter((e) => e.type === 'cash_in' && matchesMonth(e.date, selectedMonth))
        .reduce((sum, e) => sum + (e.amount || 0), 0)
    );

    const bulkCashPaid = bulkPurchases
      .filter((bp) => matchesMonth(bp.date, selectedMonth))
      .reduce(
        (sum, bp) =>
          sum +
          Math.max(
            0,
            bp.paidAmount !== undefined
              ? bp.paidAmount
              : (bp.totalAmount || 0) - (bp.dueAmount || 0)
          ),
        0
      );

    const directPurchasePaid = purchases
      .filter((p) => matchesMonth(p.date, selectedMonth))
      .reduce((sum, p) => sum + (p.totalCost || 0), 0);

    const cashPurchases = Math.round(bulkCashPaid + directPurchasePaid);

    const shopExpenses = Math.round(
      expenses
        .filter((exp) => matchesMonth(exp.date, selectedMonth))
        .reduce((sum, exp) => sum + (exp.amount || 0), 0)
    );

    const supplierDuePaid = Math.round(
      supplierTransactions
        .filter(
          (stx) =>
            (stx.type === 'payment_made' || stx.type === 'payment_given') &&
            matchesMonth(stx.date, selectedMonth)
        )
        .reduce((sum, stx) => sum + (stx.amount || 0), 0)
    );

    const ownerWithdrawal = Math.round(
      ownerTransactions
        .filter((tx) => tx.type === 'withdrawal' && matchesMonth(tx.date, selectedMonth))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );

    const otherCashOut = Math.round(
      otherCashEntries
        .filter((e) => e.type === 'cash_out' && matchesMonth(e.date, selectedMonth))
        .reduce((sum, e) => sum + (e.amount || 0), 0)
    );

    const totalCashIn =
      cashSales + customerDueCollected + ownerNewCapital + ownerWithdrawalReturn + otherCashIn;
    const totalCashOut =
      cashPurchases + shopExpenses + supplierDuePaid + ownerWithdrawal + otherCashOut;

    const monthSalesList = sales.filter((s) => matchesMonth(s.date, selectedMonth));
    const totalSales = Math.round(monthSalesList.reduce((sum, s) => sum + (s.grandTotal || 0), 0));
    const dueSales = Math.round(monthSalesList.reduce((sum, s) => sum + (s.dueAmount || 0), 0));
    const totalProfit = Math.round(monthSalesList.reduce((sum, s) => sum + (s.profit || 0), 0));
    const netProfit = Math.round(totalProfit - shopExpenses);

    const rawClosingCash = openingCash + totalCashIn - totalCashOut;
    const isDeficitWarning = rawClosingCash < 0;
    const deficitAmount = isDeficitWarning ? Math.abs(rawClosingCash) : 0;
    const displayClosingCash = Math.max(0, rawClosingCash);

    return {
      openingCash,
      cashSales,
      dueSales,
      totalSales,
      totalProfit,
      netProfit,
      customerDueCollected,
      ownerNewCapital,
      ownerWithdrawalReturn,
      otherCashIn,
      cashPurchases,
      shopExpenses,
      supplierDuePaid,
      ownerWithdrawal,
      otherCashOut,
      totalCashIn,
      totalCashOut,
      rawClosingCash,
      displayClosingCash,
      isDeficitWarning,
      deficitAmount,
    };
  }, [
    selectedMonth,
    allRecordedDates,
    initialOpeningCash,
    sales,
    bakiTransactions,
    ownerTransactions,
    otherCashEntries,
    bulkPurchases,
    purchases,
    supplierTransactions,
    expenses,
  ]);

  // Overall Shop Financial Snapshot
  const shopFinancialOverview = useMemo(() => {
    const totalStockValue = Math.round(
      products.reduce((sum, p) => sum + (p.stock || 0) * (p.costPrice || 0), 0)
    );
    const totalCustomerDue = Math.round(
      customers.reduce((sum, c) => sum + (c.totalDue || 0), 0)
    );
    const totalSupplierDue = Math.round(
      suppliers.reduce((sum, s) => sum + (s.totalDue ?? s.totalPayableDue ?? 0), 0)
    );
    const netOwnerCapitalAdded = Math.round(
      ownerTransactions.reduce((sum, tx) => {
        if (tx.type === 'capital_deposit' || tx.type === 'withdrawal_return') {
          return sum + (tx.amount || 0);
        }
        return sum - (tx.amount || 0);
      }, 0)
    );
    return {
      totalStockValue,
      totalCustomerDue,
      totalSupplierDue,
      netOwnerCapitalAdded,
    };
  }, [products, customers, suppliers, ownerTransactions]);

  return (
    <div className="flex-1 flex flex-col space-y-3">
      {/* Top View Toggle & Date Selector */}
      <div className="bg-white rounded-[22px] p-3 border border-[#E2E8F0] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="inline-flex rounded-2xl bg-[#EDF2F7] p-1 border border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'daily'
                ? 'bg-[#0E6B6B] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#102A43]'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>স্বয়ংক্রিয় ক্যাশ মিল (দৈনিক)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'monthly'
                ? 'bg-[#0E6B6B] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#102A43]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>মাসিক ক্যাশ হিসাব</span>
          </button>
        </div>

        {/* Date / Month Selector */}
        {viewMode === 'daily' ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                selectedDate === todayStr
                  ? 'bg-[#0E6B6B] text-white border-[#0E6B6B]'
                  : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
              }`}
            >
              আজ ({formatDateDDMMYYYY(todayStr)})
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedDate(getLocalDateStr(new Date(Date.now() - 24 * 3600 * 1000)))
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                selectedDate === getLocalDateStr(new Date(Date.now() - 24 * 3600 * 1000))
                  ? 'bg-[#0E6B6B] text-white border-[#0E6B6B]'
                  : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
              }`}
            >
              গতকাল
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#EDF2F7] text-[#102A43] text-xs font-bold border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#64748B]">মাস নির্বাচন:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#EDF2F7] text-[#102A43] text-xs font-bold border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
            />
          </div>
        )}
      </div>

      {/* Top 5 Live Overview Cards with Simple Shopkeeper Bengali Labels */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="bg-white rounded-2xl p-3 border-2 border-[#0E6B6B] shadow-2xs">
          <span className="text-[11px] font-extrabold text-[#0E6B6B] flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5 text-[#0E6B6B]" /> ক্যাশ বাক্সে থাকার কথা
          </span>
          <p className="text-base sm:text-lg font-black text-[#0E6B6B] mt-0.5">
            ৳ {activeDayData.displayClosingCash.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-2xs">
          <span className="text-[11px] font-bold text-[#64748B] flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-700" /> স্টকের বর্তমান মূল্য
          </span>
          <p className="text-sm sm:text-base font-black text-[#102A43] mt-0.5">
            ৳ {shopFinancialOverview.totalStockValue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-2xs">
          <span className="text-[11px] font-bold text-[#64748B] flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-amber-700" /> কাস্টমারের কাছে পাওনা
          </span>
          <p className="text-sm sm:text-base font-black text-[#102A43] mt-0.5">
            ৳ {shopFinancialOverview.totalCustomerDue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-2xs">
          <span className="text-[11px] font-bold text-[#64748B] flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-[#D32F2F]" /> সাপ্লায়ারের পাওনা
          </span>
          <p className="text-sm sm:text-base font-black text-[#D32F2F] mt-0.5">
            ৳ {shopFinancialOverview.totalSupplierDue.toLocaleString()}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-2xs">
          <span className="text-[11px] font-bold text-[#64748B] flex items-center gap-1">
            <Landmark className="w-3.5 h-3.5 text-[#2E7D32]" /> মালিকের নিজস্ব টাকার হিসাব
          </span>
          <p className="text-sm sm:text-base font-black text-[#2E7D32] mt-0.5">
            {shopFinancialOverview.netOwnerCapitalAdded >= 0 ? '+' : '−'}৳{' '}
            {Math.abs(shopFinancialOverview.netOwnerCapitalAdded).toLocaleString()}
          </p>
        </div>
      </div>

      {/* ================= VIEW 1: FULLY AUTOMATED DAILY CASH RECONCILIATION ================= */}
      {viewMode === 'daily' && (
        <>
          <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#E2E8F0] shadow-xs space-y-4">
            {/* Header & Live Automated Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-base sm:text-lg text-[#102A43]">
                    দিনের ক্যাশ হিসাব ({formatDateDDMMYYYY(selectedDate)})
                  </h3>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#2E7D32] border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> ১০০% স্বয়ংক্রিয় লাইভ হিসাব
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  কোনো বাটন চাপতে হবে না—প্রতিটি লেনদেনের সাথে সাথে ক্যাশ বাক্সের টাকা নিজে থেকেই হিসাব হয় এবং রাত ১২:০০ টার পর পরের দিনের সকালের ক্যাশ হিসেবে সেট হয়ে যায়।
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setIsDayCloseOpen(true)}
                  className="px-4 py-2 rounded-2xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                >
                  <Store className="w-4 h-4 text-emerald-300" />
                  <span>আজকের দোকান ক্লোজ ও হিসাব মিলান (Day Close)</span>
                </button>
                <span className="text-xs font-bold px-3 py-2 rounded-xl bg-[#EDF2F7] text-[#102A43] border border-[#E2E8F0]">
                  তারিখ: {formatDateDDMMYYYY(selectedDate)}
                </span>
              </div>
            </div>

            {/* Live Hero Card: ক্যাশ বাক্সে থাকার কথা */}
            <div className="rounded-3xl bg-gradient-to-r from-[#E0F2F1] via-emerald-50 to-[#E8F5E9] p-4 sm:p-5 border-2 border-[#0E6B6B] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-0.5 rounded-full bg-[#0E6B6B] text-white">
                  <Wallet className="w-3.5 h-3.5" /> লাইভ ক্যাশ বাক্স ব্যালেন্স
                </span>
                <h4 className="text-lg sm:text-xl font-black text-[#102A43] pt-0.5">
                  ক্যাশ বাক্সে থাকার কথা
                </h4>
                <p className="text-xs text-[#486581] font-medium">
                  সকালের ক্যাশ (৳{activeDayData.openingCash.toLocaleString()}) + আজকের মোট জমা টাকা (৳
                  {activeDayData.totalCashIn.toLocaleString()}) − আজকের মোট খরচ ও পরিশোধ (৳
                  {activeDayData.totalCashOut.toLocaleString()})
                </p>
              </div>

              <div className="text-left sm:text-right bg-white px-5 py-3.5 rounded-2xl border-2 border-[#80CBC4] shadow-2xs shrink-0">
                <span className="text-xs font-extrabold text-[#64748B] block">
                  ক্যাশ বাক্সে থাকার কথা ({formatDateDDMMYYYY(selectedDate)})
                </span>
                <p className="text-2xl sm:text-3xl font-black text-[#0E6B6B] tracking-tight mt-0.5">
                  ৳ {activeDayData.displayClosingCash.toLocaleString()}
                </p>
                <span className="text-[11px] font-bold text-[#2E7D32] block mt-0.5">
                  ✓ পরের দিনের সকালের ক্যাশ হিসেবে স্বয়ংক্রিয়ভাবে যুক্ত হবে
                </span>
              </div>
            </div>

            {/* Non-Negative Safety Warning Banner if Expenses > Cash Available */}
            {activeDayData.isDeficitWarning && (
              <div className="p-4 rounded-2xl bg-[#FFEBEE] border-2 border-[#D32F2F] flex items-start gap-3 text-[#D32F2F] shadow-2xs">
                <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="text-xs sm:text-sm font-black">
                    সতর্কবার্তা: আজকের মোট খরচ ও পরিশোধের পরিমাণ জমার চেয়ে ৳{' '}
                    {activeDayData.deficitAmount.toLocaleString()} বেশি হয়েছে!
                  </h5>
                  <p className="text-xs font-semibold text-[#102A43]">
                    ক্যাশ বাক্সের ব্যালেন্স কখনোই মাইনাস (নেগেটিভ) হতে পারে না, তাই ক্যাশ বাক্সে থাকার কথা{' '}
                    <strong>৳ ০</strong> দেখানো হচ্ছে। আপনি যদি নিজের পকেট থেকে এই বাড়তি টাকা দিয়ে থাকেন, তবে নিচে{' '}
                    <strong>&quot;মালিকের নতুন পুঁজি জমা&quot;</strong> হিসেবে লিখে রাখুন।
                  </p>
                </div>
              </div>
            )}

            {/* Step 1: সকালের ক্যাশ (Opening Balance) */}
            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs sm:text-sm font-extrabold text-[#102A43] block">
                  সকালের ক্যাশ (দিনের শুরুতে ক্যাশ বাক্সে থাকা টাকা)
                </span>
                <span className="text-[11px] text-[#64748B]">
                  আগের দিনের ক্লোজিং ক্যাশ থেকে রাত ১২:০০ টার পর স্বয়ংক্রিয়ভাবে সেট হয়েছে
                </span>
              </div>
              <span className="text-lg sm:text-xl font-black text-[#102A43]">
                ৳ {activeDayData.openingCash.toLocaleString()}
              </span>
            </div>

            {/* Step 2: আজকের মোট জমা টাকা (+) and আজকের মোট খরচ ও পরিশোধ (−) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Cash In (+) Column: আজকের মোট জমা টাকা */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                  <span className="text-xs sm:text-sm font-black text-[#2E7D32] flex items-center gap-1.5">
                    <ArrowDownLeft className="w-4 h-4" /> আজকের মোট জমা টাকা
                  </span>
                  <span className="text-xs sm:text-sm font-black text-[#2E7D32]">
                    + ৳ {activeDayData.totalCashIn.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#486581] font-semibold">+ নগদ বিক্রি</span>
                    <span className="font-extrabold text-[#102A43]">
                      ৳ {activeDayData.cashSales.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#486581] font-semibold">+ কাস্টমারের বকেয়া আদায়</span>
                    <span className="font-extrabold text-[#102A43]">
                      ৳ {activeDayData.customerDueCollected.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#486581] font-semibold">+ মালিকের নতুন পুঁজি জমা</span>
                    <span className="font-extrabold text-[#102A43]">
                      ৳ {activeDayData.ownerNewCapital.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#486581] font-semibold">+ নেওয়া টাকা ক্যাশে ফেরত</span>
                    <span className="font-extrabold text-[#102A43]">
                      ৳ {activeDayData.ownerWithdrawalReturn.toLocaleString()}
                    </span>
                  </div>
                  {activeDayData.otherCashIn > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#486581] font-semibold">+ অন্যান্য জমা</span>
                      <span className="font-extrabold text-[#102A43]">
                        ৳ {activeDayData.otherCashIn.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cash Out (−) Column: আজকের মোট খরচ ও পরিশোধ */}
              <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-rose-200">
                  <span className="text-xs sm:text-sm font-black text-[#D32F2F] flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4" /> আজকের মোট খরচ ও পরিশোধ
                  </span>
                  <span className="text-xs sm:text-sm font-black text-[#D32F2F]">
                    − ৳ {activeDayData.totalCashOut.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#486581] font-semibold">− নগদ পণ্য কেনা</span>
                    <span className="font-extrabold text-[#102A43]">
                      ৳ {activeDayData.cashPurchases.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#486581] font-semibold">− দোকানের যাবতীয় খরচ</span>
                    <span className="font-extrabold text-[#102A43]">
                      ৳ {activeDayData.shopExpenses.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#486581] font-semibold">
                      − মহাজন/সাপ্লায়ারকে দেওয়া টাকা
                    </span>
                    <span className="font-extrabold text-[#102A43]">
                      ৳ {activeDayData.supplierDuePaid.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#486581] font-semibold">
                      − মালিকের ব্যক্তিগত খরচ/নেওয়া
                    </span>
                    <span className="font-extrabold text-[#102A43]">
                      ৳ {activeDayData.ownerWithdrawal.toLocaleString()}
                    </span>
                  </div>
                  {activeDayData.otherCashOut > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#486581] font-semibold">− অন্যান্য খরচ</span>
                      <span className="font-extrabold text-[#102A43]">
                        ৳ {activeDayData.otherCashOut.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Automated Daily Cash Rollover History */}
          <div className="bg-white rounded-[24px] p-4 border border-[#E2E8F0] shadow-xs">
            <h4 className="font-extrabold text-sm sm:text-base text-[#102A43] mb-3">
              প্রতিদিনের স্বয়ংক্রিয় ক্যাশ হিসাব তালিকা ({automatedDailyHistory.length} দিন)
            </h4>
            <div className="space-y-2">
              {automatedDailyHistory.map((row) => (
                <div
                  key={row.date}
                  onClick={() => setSelectedDate(row.date)}
                  className={`p-3 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer text-xs ${
                    selectedDate === row.date
                      ? 'bg-[#E0F2F1]/60 border-[#0E6B6B]'
                      : 'bg-[#F8FAFC] hover:bg-white border-[#E2E8F0]'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-[#102A43] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#0E6B6B]" />
                      {formatDateDDMMYYYY(row.date)}
                    </span>
                    <span className="text-[#64748B]">
                      সকালের ক্যাশ: <strong className="text-[#102A43]">৳{row.openingCash.toLocaleString()}</strong>
                    </span>
                    <span className="text-[#2E7D32] font-bold">
                      + জমা: ৳{row.totalCashIn.toLocaleString()}
                    </span>
                    <span className="text-[#D32F2F] font-bold">
                      − খরচ ও পরিশোধ: ৳{row.totalCashOut.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-black text-[#0E6B6B]">
                    <span>ক্যাশ বাক্সে থাকার কথা: ৳{row.closingCash.toLocaleString()}</span>
                    {row.isDeficit && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFEBEE] text-[#D32F2F] border border-rose-200">
                        খরচ ৳{row.deficitAmount.toLocaleString()} বেশি
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ================= VIEW 2: AUTOMATED MONTHLY CASH REPORT ================= */}
      {viewMode === 'monthly' && (
        <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="font-black text-base sm:text-lg text-[#102A43]">
                মাসিক স্বয়ংক্রিয় ক্যাশ রিপোর্ট ({formatMonthMMYYYY(selectedMonth)})
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                মাসের সকালের ক্যাশ, মোট জমা টাকা, মোট খরচ ও পরিশোধ এবং ক্যাশ বাক্সে থাকার কথার স্বয়ংক্রিয় হিসাব
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
              <button
                type="button"
                onClick={() => setIsMonthlyReportOpen(true)}
                className="px-4 py-2 rounded-2xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4 text-amber-300" />
                <span>📥 মাসিক রিপোর্ট ডাউনলোড (PDF)</span>
              </button>
              <span className="text-xs font-extrabold px-3 py-2 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] border border-[#B2DFDB]">
                মাস: {formatMonthMMYYYY(selectedMonth)}
              </span>
            </div>
          </div>

          {monthlyReport.isDeficitWarning && (
            <div className="p-4 rounded-2xl bg-[#FFEBEE] border-2 border-[#D32F2F] flex items-start gap-3 text-[#D32F2F]">
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="text-xs sm:text-sm font-black">
                  সতর্কবার্তা: এই মাসে মোট খরচ ও পরিশোধের পরিমাণ মোট জমার চেয়ে ৳{' '}
                  {monthlyReport.deficitAmount.toLocaleString()} বেশি হয়েছে!
                </h5>
                <p className="text-xs font-semibold text-[#102A43]">
                  ক্যাশ ব্যালেন্স কখনো নেগেটিভ হতে পারে না, তাই ক্যাশ বাক্সে থাকার কথা ৳ ০ দেখানো হচ্ছে।
                </p>
              </div>
            </div>
          )}

          {/* 4 Monthly Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-xs font-bold text-[#64748B]">মাসের শুরুতে সকালের ক্যাশ</span>
              <p className="text-lg sm:text-xl font-black text-[#102A43] mt-1">
                ৳ {monthlyReport.openingCash.toLocaleString()}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200">
              <span className="text-xs font-bold text-[#2E7D32]">মাসের মোট জমা টাকা (+)</span>
              <p className="text-lg sm:text-xl font-black text-[#2E7D32] mt-1">
                + ৳ {monthlyReport.totalCashIn.toLocaleString()}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200">
              <span className="text-xs font-bold text-[#D32F2F]">মাসের মোট খরচ ও পরিশোধ (−)</span>
              <p className="text-lg sm:text-xl font-black text-[#D32F2F] mt-1">
                − ৳ {monthlyReport.totalCashOut.toLocaleString()}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#E0F2F1] border-2 border-[#0E6B6B]">
              <span className="text-xs font-extrabold text-[#0E6B6B]">ক্যাশ বাক্সে থাকার কথা</span>
              <p className="text-lg sm:text-xl font-black text-[#0E6B6B] mt-1">
                ৳ {monthlyReport.displayClosingCash.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Detailed Monthly Cash In & Cash Out Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs sm:text-sm">
              <h5 className="font-extrabold text-[#2E7D32] border-b border-[#E2E8F0] pb-1.5">
                আজকের / মাসের মোট জমা টাকার বিস্তারিত
              </h5>
              <div className="flex justify-between">
                <span className="text-[#64748B]">+ নগদ বিক্রি:</span>
                <span className="font-bold">৳ {monthlyReport.cashSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">+ কাস্টমারের বকেয়া আদায়:</span>
                <span className="font-bold">
                  ৳ {monthlyReport.customerDueCollected.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">+ মালিকের নতুন পুঁজি জমা:</span>
                <span className="font-bold">
                  ৳ {monthlyReport.ownerNewCapital.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">+ নেওয়া টাকা ক্যাশে ফেরত:</span>
                <span className="font-bold">
                  ৳ {monthlyReport.ownerWithdrawalReturn.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs sm:text-sm">
              <h5 className="font-extrabold text-[#D32F2F] border-b border-[#E2E8F0] pb-1.5">
                মাসের মোট খরচ ও পরিশোধের বিস্তারিত
              </h5>
              <div className="flex justify-between">
                <span className="text-[#64748B]">− নগদ পণ্য কেনা:</span>
                <span className="font-bold">৳ {monthlyReport.cashPurchases.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">− দোকানের যাবতীয় খরচ:</span>
                <span className="font-bold">৳ {monthlyReport.shopExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">− মহাজন/সাপ্লায়ারকে দেওয়া টাকা:</span>
                <span className="font-bold">
                  ৳ {monthlyReport.supplierDuePaid.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">− মালিকের ব্যক্তিগত খরচ/নেওয়া:</span>
                <span className="font-bold">
                  ৳ {monthlyReport.ownerWithdrawal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button: Download Monthly PDF */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsMonthlyReportOpen(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Download className="w-5 h-5 text-amber-300" />
              <span>📥 মাসিক রিপোর্ট ডাউনলোড (PDF)</span>
            </button>
          </div>
        </div>
      )}

      {/* Day Close Modal */}
      {isDayCloseOpen && (
        <DayCloseModal
          isOpen={isDayCloseOpen}
          onClose={() => setIsDayCloseOpen(false)}
          profile={profile}
          dayData={{
            dateStr: selectedDate,
            openingCash: activeDayData.openingCash,
            cashSales: activeDayData.cashSales,
            dueSales: activeDayData.dueSales || 0,
            totalSales: activeDayData.totalSales || activeDayData.cashSales,
            totalProfit: activeDayData.totalProfit || 0,
            customerDueCollected: activeDayData.customerDueCollected,
            ownerNewCapital: activeDayData.ownerNewCapital,
            ownerWithdrawalReturn: activeDayData.ownerWithdrawalReturn,
            otherCashIn: activeDayData.otherCashIn,
            cashPurchases: activeDayData.cashPurchases,
            shopExpenses: activeDayData.shopExpenses,
            supplierDuePaid: activeDayData.supplierDuePaid,
            ownerWithdrawal: activeDayData.ownerWithdrawal,
            otherCashOut: activeDayData.otherCashOut,
            totalCashIn: activeDayData.totalCashIn,
            totalCashOut: activeDayData.totalCashOut,
            displayClosingCash: activeDayData.displayClosingCash,
            rawClosingCash: activeDayData.rawClosingCash,
            totalSalesCount: activeDayData.totalSalesCount || 0,
          }}
          onSaveDailyReconciliation={onSaveDailyReconciliation}
        />
      )}

      {/* Monthly Report Modal */}
      {isMonthlyReportOpen && (
        <MonthlyReportModal
          isOpen={isMonthlyReportOpen}
          onClose={() => setIsMonthlyReportOpen(false)}
          profile={profile}
          reportData={{
            selectedMonth,
            openingCash: monthlyReport.openingCash,
            cashSales: monthlyReport.cashSales,
            dueSales: monthlyReport.dueSales || 0,
            totalSales: monthlyReport.totalSales || monthlyReport.cashSales,
            totalProfit: monthlyReport.totalProfit || 0,
            totalExpenses: monthlyReport.shopExpenses,
            netProfit: monthlyReport.netProfit || 0,
            customerDueCollected: monthlyReport.customerDueCollected,
            ownerNewCapital: monthlyReport.ownerNewCapital,
            ownerWithdrawalReturn: monthlyReport.ownerWithdrawalReturn,
            otherCashIn: monthlyReport.otherCashIn,
            cashPurchases: monthlyReport.cashPurchases,
            shopExpenses: monthlyReport.shopExpenses,
            supplierDuePaid: monthlyReport.supplierDuePaid,
            ownerWithdrawal: monthlyReport.ownerWithdrawal,
            otherCashOut: monthlyReport.otherCashOut,
            totalCashIn: monthlyReport.totalCashIn,
            totalCashOut: monthlyReport.totalCashOut,
            displayClosingCash: monthlyReport.displayClosingCash,
            rawClosingCash: monthlyReport.rawClosingCash,
            stockValue: shopFinancialOverview.totalStockValue,
            totalCustomerDue: shopFinancialOverview.totalCustomerDue,
            totalSupplierDue: shopFinancialOverview.totalSupplierDue,
          }}
        />
      )}
    </div>
  );
};
