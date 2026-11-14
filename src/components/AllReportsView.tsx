import React, { useMemo, useState } from 'react';
import {
  Sale,
  Product,
  Customer,
  Supplier,
  Expense,
  BulkPurchase,
  PurchaseRecord,
  BakiTransaction,
  SupplierTransaction,
  OwnerTransaction,
  OtherCashEntry,
  DailyCashReconciliation,
  ShopProfile,
  AppMode,
} from '../types';
import { MonthlyReportModal, MonthlyReportData } from './MonthlyReportModal';
import { DB } from '../storage/db';
import {
  ArrowLeft,
  TrendingUp,
  Package,
  AlertTriangle,
  Users,
  Building2,
  Calendar,
  FileText,
  History,
  Download,
} from 'lucide-react';

interface Props {
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  expenses: Expense[];
  bulkPurchases: BulkPurchase[];
  purchases: PurchaseRecord[];
  bakiTransactions: BakiTransaction[];
  supplierTransactions: SupplierTransaction[];
  ownerTransactions: OwnerTransaction[];
  otherCashEntries: OtherCashEntry[];
  dailyReconciliations: DailyCashReconciliation[];
  initialOpeningCash: number;
  profile: ShopProfile;
  appMode?: AppMode;
  onOpenSubscriptionModal?: () => void;
  onBackToMenu: () => void;
}

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

const formatDateDDMMYYYY = (d?: string | Date): string => {
  const ymd = getLocalDateStr(d);
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
  const [yyyy, mm, dd] = ymd.split('-');
  return `${dd}-${mm}-${yyyy}`;
};

export const AllReportsView: React.FC<Props> = ({
  sales,
  products,
  customers,
  suppliers,
  expenses,
  bulkPurchases,
  purchases,
  bakiTransactions,
  supplierTransactions,
  ownerTransactions,
  otherCashEntries,
  dailyReconciliations,
  initialOpeningCash,
  profile,
  appMode = 'trial',
  onOpenSubscriptionModal,
  onBackToMenu,
}) => {
  const todayStr = getLocalDateStr(new Date());
  const currentYearMonth = todayStr.slice(0, 7);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState<boolean>(false);

  const defaultMargin = DB.getQuickSaleProfitMargin();

  const matchesDate = (rawDate: string | undefined, targetDate: string): boolean => {
    if (!rawDate) return false;
    return getLocalDateStr(rawDate) === targetDate || rawDate.slice(0, 10) === targetDate;
  };

  const matchesMonth = (rawDate: string | undefined, ym: string): boolean => {
    if (!rawDate) return false;
    return getLocalDateStr(rawDate).startsWith(ym) || rawDate.slice(0, 7) === ym;
  };

  const computeSaleProfit = (s: Sale): number => {
    if (s.id.startsWith('return_') || (s.grandTotal || 0) < 0) return Number(s.profit) || 0;
    const isQuick = Boolean(s.items && s.items.some((it) => it.productId === 'quick_sale_entry'));
    if (isQuick) {
      if (
        s.profit !== undefined &&
        (s.profit > 0 || (s.totalCost !== undefined && s.totalCost > 0))
      ) {
        return Math.round(s.profit);
      }
      return Math.round((Number(s.grandTotal) || 0) * (defaultMargin / 100));
    }
    if (s.profit !== undefined && s.profit !== 0) return Math.round(s.profit);
    return Math.round(
      (s.items || []).reduce((sum, it) => {
        const buyPrice = Number(it.costPrice || (it as any).purchasePrice || 0);
        const sellPrice = Number(it.unitPrice || 0);
        return sum + (sellPrice - buyPrice) * (Number(it.quantity) || 0);
      }, 0) - (Number(s.discount) || 0)
    );
  };

  // 1. Daily & Monthly Sales / Profit Reports
  const reportStats = useMemo(() => {
    const todaySalesList = sales.filter((s) => matchesDate(s.date, todayStr));
    const todaySales = Math.round(
      todaySalesList.reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0)
    );
    const todayProfit = Math.round(
      todaySalesList.reduce((sum, s) => sum + computeSaleProfit(s), 0)
    );
    const todayExpense = Math.round(
      expenses
        .filter((e) => matchesDate(e.date, todayStr))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    );

    const monthSalesList = sales.filter((s) => matchesMonth(s.date, selectedMonth));
    const monthSales = Math.round(
      monthSalesList.reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0)
    );
    const monthProfit = Math.round(
      monthSalesList.reduce((sum, s) => sum + computeSaleProfit(s), 0)
    );
    const monthExpense = Math.round(
      expenses
        .filter((e) => matchesMonth(e.date, selectedMonth))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    );

    return {
      todaySales,
      todayProfit,
      todayExpense,
      todayNetProfit: todayProfit - todayExpense,
      monthSales,
      monthProfit,
      monthExpense,
      monthNetProfit: monthProfit - monthExpense,
    };
  }, [sales, expenses, todayStr, selectedMonth, defaultMargin]);

  // 2. Stock Reports
  const stockStats = useMemo(() => {
    const totalStockValue = Math.round(
      products.reduce((sum, p) => sum + (p.stock || 0) * (p.costPrice || 0), 0)
    );
    const lowStockProducts = products.filter((p) => p.stock <= (p.minStockAlert ?? 5));
    return {
      totalProducts: products.length,
      totalStockValue,
      lowStockProducts,
    };
  }, [products]);

  // 3. Due Reports (Customer & Supplier)
  const dueStats = useMemo(() => {
    const totalCustomerDue = Math.round(
      customers.reduce((sum, c) => sum + Math.max(0, Number(c.totalDue) || 0), 0)
    );
    const todayCollectedDue = Math.round(
      bakiTransactions
        .filter((tx) => tx.type === 'payment_received' && matchesDate(tx.date, todayStr))
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
    );
    const totalSupplierDue = Math.round(
      suppliers.reduce(
        (sum, s) => sum + Math.max(0, Number(s.totalDue ?? s.totalPayableDue ?? 0)),
        0
      )
    );
    return {
      totalCustomerDue,
      todayCollectedDue,
      totalSupplierDue,
    };
  }, [customers, suppliers, bakiTransactions, todayStr]);

  // 4. Day-Close History & Monthly Report Data
  const computeDayFlows = (dateStr: string) => {
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
    const customerDueCollected = Math.round(
      bakiTransactions
        .filter((tx) => tx.type === 'payment_received' && matchesDate(tx.date, dateStr))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );
    const ownerNewCapital = Math.round(
      ownerTransactions
        .filter((tx) => tx.type === 'capital_deposit' && matchesDate(tx.date, dateStr))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );
    const ownerWithdrawalReturn = Math.round(
      ownerTransactions
        .filter((tx) => tx.type === 'withdrawal_return' && matchesDate(tx.date, dateStr))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );
    const otherCashIn = Math.round(
      otherCashEntries
        .filter(
          (e) => e.type === 'cash_in' && !e.isPostCloseAdjustment && matchesDate(e.date, dateStr)
        )
        .reduce((sum, e) => sum + (e.amount || 0), 0)
    );
    const rawBulkCashPaid = bulkPurchases
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
    let dayReturnedCash = 0;
    bulkPurchases.forEach((bp) => {
      if (bp.returns && bp.returns.length > 0) {
        bp.returns.forEach((r) => {
          if (matchesDate(r.date, dateStr)) dayReturnedCash += Number(r.amount) || 0;
        });
      } else if (matchesDate(bp.date, dateStr) && bp.returnedAmount) {
        dayReturnedCash += Number(bp.returnedAmount) || 0;
      }
    });
    const directPurchasePaid = purchases
      .filter((p) => matchesDate(p.date, dateStr))
      .reduce((sum, p) => sum + (p.totalCost || 0), 0);
    const cashPurchases = Math.round(rawBulkCashPaid + directPurchasePaid);
    const shopExpenses = Math.round(
      expenses
        .filter((exp) => matchesDate(exp.date, dateStr))
        .reduce((sum, exp) => sum + (exp.amount || 0), 0)
    );
    const supplierDuePaid = Math.round(
      supplierTransactions
        .filter(
          (stx) =>
            (stx.type === 'payment_made' || stx.type === 'payment_given') &&
            matchesDate(stx.date, dateStr)
        )
        .reduce((sum, stx) => sum + (stx.amount || 0), 0)
    );
    const ownerWithdrawal = Math.round(
      ownerTransactions
        .filter((tx) => tx.type === 'withdrawal' && matchesDate(tx.date, dateStr))
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );
    const otherCashOut = Math.round(
      otherCashEntries
        .filter(
          (e) => e.type === 'cash_out' && !e.isPostCloseAdjustment && matchesDate(e.date, dateStr)
        )
        .reduce((sum, e) => sum + (e.amount || 0), 0)
    );

    const totalCashIn =
      cashSales +
      customerDueCollected +
      dayReturnedCash +
      ownerNewCapital +
      ownerWithdrawalReturn +
      otherCashIn;
    const totalCashOut =
      cashPurchases + shopExpenses + supplierDuePaid + ownerWithdrawal + otherCashOut;

    return { totalCashIn, totalCashOut };
  };

  const dayCloseHistory = useMemo(() => {
    const dateSet = new Set<string>();
    const addDate = (raw?: string) => {
      const d = getLocalDateStr(raw);
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) dateSet.add(d);
    };
    sales.forEach((s) => addDate(s.date));
    bakiTransactions.forEach((tx) => addDate(tx.date));
    ownerTransactions.forEach((tx) => addDate(tx.date));
    bulkPurchases.forEach((bp) => {
      addDate(bp.date);
      if (bp.returns) bp.returns.forEach((r) => addDate(r.date));
    });
    purchases.forEach((p) => addDate(p.date));
    supplierTransactions.forEach((stx) => addDate(stx.date));
    expenses.forEach((exp) => addDate(exp.date));
    otherCashEntries.forEach((oce) => addDate(oce.date));
    dailyReconciliations.forEach((r) => addDate(r.date));
    dateSet.add(todayStr);

    const sortedDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));
    let runningBalance = Math.max(0, Math.round(initialOpeningCash || 0));

    return sortedDates
      .map((d) => {
        const openingCash = runningBalance;
        const flow = computeDayFlows(d);
        const rawClosing = openingCash + flow.totalCashIn - flow.totalCashOut;
        const closingCash = Math.max(0, rawClosing);
        runningBalance = closingCash;
        const manualClose = dailyReconciliations.find((r) => r.date === d && r.isClosed);
        return {
          date: d,
          openingCash,
          totalCashIn: flow.totalCashIn,
          totalCashOut: flow.totalCashOut,
          closingCash: manualClose?.actualClosingCash ?? closingCash,
          isManualClosed: Boolean(manualClose),
          isVisible: d < todayStr || Boolean(manualClose),
        };
      })
      .filter((r) => r.isVisible)
      .reverse()
      .slice(0, 15);
  }, [
    sales,
    bakiTransactions,
    ownerTransactions,
    bulkPurchases,
    purchases,
    supplierTransactions,
    expenses,
    otherCashEntries,
    dailyReconciliations,
    initialOpeningCash,
    todayStr,
  ]);

  const monthlyModalData: MonthlyReportData = useMemo(() => {
    const monthCashSales = Math.round(
      sales
        .filter((s) => matchesMonth(s.date, selectedMonth))
        .reduce((sum, s) => {
          if (s.id?.startsWith('return_') || (s.grandTotal || 0) < 0 || (s.paidAmount || 0) < 0) {
            return sum + (s.paidAmount || s.grandTotal || 0);
          }
          return sum + Math.max(0, (s.grandTotal || 0) - (s.dueAmount || 0));
        }, 0)
    );
    const monthDueSales = Math.round(
      sales
        .filter((s) => matchesMonth(s.date, selectedMonth))
        .reduce((sum, s) => sum + (Number(s.dueAmount) || 0), 0)
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
    const rawBulkPaid = bulkPurchases
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
    const directPurPaid = purchases
      .filter((p) => matchesMonth(p.date, selectedMonth))
      .reduce((sum, p) => sum + (p.totalCost || 0), 0);
    const cashPurchases = Math.round(rawBulkPaid + directPurPaid);
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
      monthCashSales + customerDueCollected + ownerNewCapital + ownerWithdrawalReturn + otherCashIn;
    const totalCashOut =
      cashPurchases + reportStats.monthExpense + supplierDuePaid + ownerWithdrawal + otherCashOut;
    const openingCash = Math.max(0, Math.round(initialOpeningCash || 0));
    const rawClosing = openingCash + totalCashIn - totalCashOut;

    return {
      selectedMonth,
      openingCash,
      cashSales: monthCashSales,
      dueSales: monthDueSales,
      totalSales: reportStats.monthSales,
      totalProfit: reportStats.monthProfit,
      totalExpenses: reportStats.monthExpense,
      netProfit: reportStats.monthNetProfit,
      customerDueCollected,
      ownerNewCapital,
      ownerWithdrawalReturn,
      otherCashIn,
      cashPurchases,
      shopExpenses: reportStats.monthExpense,
      supplierDuePaid,
      ownerWithdrawal,
      otherCashOut,
      totalCashIn,
      totalCashOut,
      displayClosingCash: Math.max(0, rawClosing),
      rawClosingCash: rawClosing,
      stockValue: stockStats.totalStockValue,
      totalCustomerDue: dueStats.totalCustomerDue,
      totalSupplierDue: dueStats.totalSupplierDue,
    };
  }, [
    sales,
    bakiTransactions,
    ownerTransactions,
    otherCashEntries,
    bulkPurchases,
    purchases,
    supplierTransactions,
    selectedMonth,
    initialOpeningCash,
    reportStats,
    stockStats,
    dueStats,
  ]);

  return (
    <div className="min-h-[calc(100vh-110px)] flex flex-col p-2.5 sm:p-3 max-w-4xl mx-auto pb-20 overflow-y-auto space-y-3">
      {/* Top Back Bar */}
      <div className="bg-white rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2 border border-[#E2E8F0] shadow-2xs shrink-0">
        <button
          type="button"
          onClick={onBackToMenu}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] font-extrabold text-xs sm:text-sm transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>হিসাব / মেনু</span>
        </button>
        <h2 className="text-sm sm:text-base font-black text-[#102A43]">
          সকল রিপোর্ট
        </h2>
        <button
          type="button"
          onClick={() => setIsMonthlyModalOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>মাসিক PDF</span>
        </button>
      </div>

      {/* 1. Daily & Monthly Sales / Profit Report */}
      <div className="bg-white rounded-[22px] p-4 border border-[#E2E8F0] shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 stroke-[2.4]" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-[#102A43]">
              দৈনিক ও মাসিক বিক্রি ও লাভ রিপোর্ট
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#0E6B6B]" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#102A43] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[11px] font-bold text-[#64748B] block">আজকের বিক্রি</span>
            <p className="text-lg font-black text-[#102A43] tabular-nums mt-0.5">
              ৳ {reportStats.todaySales.toLocaleString()}
            </p>
            <span className="text-[11px] font-bold text-[#2E7D32] block mt-1 tabular-nums">
              নিট লাভ: ৳ {reportStats.todayNetProfit.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#F0FDF4] border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 block">
              মাসিক বিক্রি ({selectedMonth})
            </span>
            <p className="text-lg font-black text-[#0E6B6B] tabular-nums mt-0.5">
              ৳ {reportStats.monthSales.toLocaleString()}
            </p>
            <span className="text-[11px] font-bold text-[#2E7D32] block mt-1 tabular-nums">
              মাসিক নিট লাভ: ৳ {reportStats.monthNetProfit.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Stock Report */}
      <div className="bg-white rounded-[22px] p-4 border border-[#E2E8F0] shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1982D8] flex items-center justify-center">
            <Package className="w-4 h-4 stroke-[2.4]" />
          </div>
          <h3 className="text-sm sm:text-base font-black text-[#102A43]">
            স্টক রিপোর্ট
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center">
            <span className="text-[11px] font-bold text-[#64748B] block">মোট পণ্য</span>
            <p className="text-base font-black text-[#0E6B6B] tabular-nums mt-0.5">
              {stockStats.totalProducts} টি
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center">
            <span className="text-[11px] font-bold text-[#64748B] block">মোট স্টক মূল্য</span>
            <p className="text-base font-black text-[#2E7D32] tabular-nums mt-0.5">
              ৳{stockStats.totalStockValue.toLocaleString()}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
            <span className="text-[11px] font-bold text-[#D32F2F] block">লো স্টক</span>
            <p className="text-base font-black text-[#D32F2F] tabular-nums mt-0.5">
              {stockStats.lowStockProducts.length} টি
            </p>
          </div>
        </div>

        {stockStats.lowStockProducts.length > 0 && (
          <div className="pt-1 space-y-1.5">
            <p className="text-xs font-extrabold text-[#D32F2F] flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>কম স্টকের পণ্য তালিকা:</span>
            </p>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {stockStats.lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-rose-50/70 border border-rose-100 text-xs"
                >
                  <span className="font-bold text-[#102A43] truncate">{p.name}</span>
                  <span className="font-black text-[#D32F2F] shrink-0 tabular-nums">
                    {p.stock} {p.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Due Report (Customer & Supplier) */}
      <div className="bg-white rounded-[22px] p-4 border border-[#E2E8F0] shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#6A1B9A] flex items-center justify-center">
            <FileText className="w-4 h-4 stroke-[2.4]" />
          </div>
          <h3 className="text-sm sm:text-base font-black text-[#102A43]">
            বাকি রিপোর্ট (কাস্টমার ও সাপ্লাইয়ার)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-[#FFEBEE]/60 border border-rose-200 flex items-center justify-between sm:block">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#D32F2F]">
              <Users className="w-3.5 h-3.5" />
              <span>কাস্টমারের কাছে পাবো</span>
            </div>
            <p className="text-base sm:text-lg font-black text-[#D32F2F] tabular-nums sm:mt-1">
              ৳ {dueStats.totalCustomerDue.toLocaleString()}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#E8F5E9]/70 border border-emerald-200 flex items-center justify-between sm:block">
            <span className="text-xs font-bold text-[#2E7D32] block">আজ বকেয়া আদায়</span>
            <p className="text-base sm:text-lg font-black text-[#2E7D32] tabular-nums sm:mt-1">
              ৳ {dueStats.todayCollectedDue.toLocaleString()}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between sm:block">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <Building2 className="w-3.5 h-3.5" />
              <span>সাপ্লাইয়ার পাবে</span>
            </div>
            <p className="text-base sm:text-lg font-black text-amber-900 tabular-nums sm:mt-1">
              ৳ {dueStats.totalSupplierDue.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Day-Close History */}
      <div className="bg-white rounded-[22px] p-4 border border-[#E2E8F0] shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center">
            <History className="w-4 h-4 stroke-[2.4]" />
          </div>
          <h3 className="text-sm sm:text-base font-black text-[#102A43]">
            দিনশেষ ও ক্লোজিং হিস্ট্রি (Day-Close History)
          </h3>
        </div>

        {dayCloseHistory.length === 0 ? (
          <p className="text-xs text-[#64748B] text-center py-6">
            এখনো কোনো পূর্ববর্তী দিনের ক্লোজিং হিস্ট্রি তৈরি হয়নি।
          </p>
        ) : (
          <div className="space-y-2">
            {dayCloseHistory.map((row) => (
              <div
                key={row.date}
                className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-[#102A43]">
                      {formatDateDDMMYYYY(row.date)}
                    </span>
                    {row.isManualClosed && (
                      <span className="px-1.5 py-0.5 rounded bg-[#E0F2F1] text-[#0E6B6B] text-[10px] font-bold">
                        ক্লোজড
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5 tabular-nums">
                    জমা: +৳{row.totalCashIn.toLocaleString()} • খরচ: -৳{row.totalCashOut.toLocaleString()}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-[#64748B] block">দিনশেষ ক্যাশ</span>
                  <span className="text-sm font-black text-[#0E6B6B] tabular-nums">
                    ৳ {row.closingCash.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly PDF Report Modal */}
      <MonthlyReportModal
        isOpen={isMonthlyModalOpen}
        onClose={() => setIsMonthlyModalOpen(false)}
        profile={profile}
        reportData={monthlyModalData}
        appMode={appMode}
        onOpenSubscriptionModal={onOpenSubscriptionModal}
      />
    </div>
  );
};
