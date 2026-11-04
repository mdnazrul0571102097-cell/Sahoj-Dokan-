import React, { useState, useMemo } from 'react';
import {
  Sale,
  PurchaseRecord,
  ShopProfile,
  Language,
  Expense,
  BulkPurchase,
  Supplier,
  Product,
  AppMode,
  Customer,
  BakiTransaction,
  SupplierTransaction,
  OwnerTransaction,
  OtherCashEntry,
  DailyCashReconciliation,
  MonthlyCashReconciliation,
} from '../types';
import { translations } from '../i18n/translations';
import { ReceiptModal } from './ReceiptModal';
import { ExpenseManager } from './ExpenseManager';
import { BulkPurchaseManager } from './BulkPurchaseManager';
import { QuickSaleModal } from './QuickSaleModal';
import { CashReconciliationManager } from './CashReconciliationManager';
import { OwnerCapitalManager } from './OwnerCapitalManager';
import {
  TrendingUp,
  Receipt,
  ShoppingBag,
  Clock,
  Printer,
  Wallet,
  PackagePlus,
  ClipboardCheck,
  Calculator,
  Zap,
  Plus,
  Trash2,
  UserCheck,
  Undo2,
  Store,
} from 'lucide-react';

interface Props {
  sales: Sale[];
  purchases: PurchaseRecord[];
  profile: ShopProfile;
  language: Language;
  appMode?: AppMode;
  onOpenSubscriptionModal?: () => void;
  expenses?: Expense[];
  onAddExpense?: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
  bulkPurchases?: BulkPurchase[];
  suppliers?: Supplier[];
  products?: Product[];
  onAddBulkPurchase?: (
    purchase: BulkPurchase,
    updatedProducts: Product[],
    supplierDueAddition?: { supplierId: string; dueAmount: number }
  ) => void;
  onDeleteBulkPurchase?: (id: string) => void;
  onOpenSupplierKhata?: () => void;
  customers?: Customer[];
  onAddQuickSale?: (sale: Sale, updatedProducts?: Product[]) => void;
  onDeleteSale?: (saleId: string) => void;
  onAddNewCustomer?: (customer: Customer) => void;
  bakiTransactions?: BakiTransaction[];
  supplierTransactions?: SupplierTransaction[];
  ownerTransactions?: OwnerTransaction[];
  onAddOwnerTransaction?: (tx: OwnerTransaction) => void;
  onDeleteOwnerTransaction?: (id: string) => void;
  otherCashEntries?: OtherCashEntry[];
  onAddOtherCashEntry?: (entry: OtherCashEntry) => void;
  onDeleteOtherCashEntry?: (id: string) => void;
  dailyReconciliations?: DailyCashReconciliation[];
  onSaveDailyReconciliation?: (recon: DailyCashReconciliation) => void;
  onAddPostCloseAdjustment?: (dateStr: string, adjustment: OtherCashEntry) => void;
  monthlyReconciliations?: MonthlyCashReconciliation[];
  onSaveMonthlyReconciliation?: (mRecon: MonthlyCashReconciliation) => void;
  initialOpeningCash?: number;
  onSaveInitialOpeningCash?: (amount: number) => void;
}

export const ReportsView: React.FC<Props> = ({
  sales,
  purchases,
  profile,
  language,
  appMode = 'trial',
  onOpenSubscriptionModal,
  expenses = [],
  onAddExpense = () => {},
  onDeleteExpense = () => {},
  bulkPurchases = [],
  suppliers = [],
  products = [],
  onAddBulkPurchase = () => {},
  onDeleteBulkPurchase = () => {},
  onOpenSupplierKhata,
  customers = [],
  onAddQuickSale,
  onDeleteSale,
  onAddNewCustomer,
  bakiTransactions = [],
  supplierTransactions = [],
  ownerTransactions = [],
  onAddOwnerTransaction = () => {},
  onDeleteOwnerTransaction = () => {},
  otherCashEntries = [],
  onAddOtherCashEntry = () => {},
  onDeleteOtherCashEntry = () => {},
  dailyReconciliations = [],
  onSaveDailyReconciliation = () => {},
  onAddPostCloseAdjustment = () => {},
  monthlyReconciliations = [],
  onSaveMonthlyReconciliation = () => {},
  initialOpeningCash = 0,
  onSaveInitialOpeningCash = () => {},
}) => {
  const t = translations[language];

  // Active sub-tab: sales vs expenses vs bulkPurchases vs cashReconciliation vs ownerCapital vs purchases
  const [activeTab, setActiveTab] = useState<
    'sales' | 'expenses' | 'bulkPurchases' | 'cashReconciliation' | 'ownerCapital' | 'purchases'
  >('sales');

  // Helper for reliable YYYY-MM-DD local calendar date matching
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

  // Standard DD-MM-YYYY date formatter (English digits, e.g. 03-11-2026)
  const formatDateDDMMYYYY = (d?: string | Date): string => {
    const ymd = getLocalDateStr(d);
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
    const [yyyy, mm, dd] = ymd.split('-');
    return `${dd}-${mm}-${yyyy}`;
  };

  // Date filter state: default today in user's local timezone
  const todayStr = getLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'yesterday' | 'all' | 'custom'>('today');

  // Modal to view / reprint receipt
  const [reprintSale, setReprintSale] = useState<Sale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [isQuickSaleOpen, setIsQuickSaleOpen] = useState(false);
  const [quickSaleInitialMode, setQuickSaleInitialMode] = useState<'sale' | 'return'>('sale');

  // Set date based on mode
  const handleDateModeChange = (mode: 'today' | 'yesterday' | 'all' | 'custom') => {
    setDateFilterMode(mode);
    if (mode === 'today') {
      setSelectedDate(getLocalDateStr(new Date()));
    } else if (mode === 'yesterday') {
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
      setSelectedDate(getLocalDateStr(yesterday));
    }
  };

  // Compute effective filter date string strictly matching dateFilterMode
  const effectiveFilterDate = useMemo(() => {
    if (dateFilterMode === 'today') return getLocalDateStr(new Date());
    if (dateFilterMode === 'yesterday') return getLocalDateStr(new Date(Date.now() - 24 * 3600 * 1000));
    return selectedDate;
  }, [dateFilterMode, selectedDate]);

  // Filter sales based on chosen date
  const filteredSales = useMemo(() => {
    if (dateFilterMode === 'all') return sales;
    return sales.filter((s) => {
      const localD = getLocalDateStr(s.date);
      const rawD = (s.date || '').slice(0, 10);
      return localD === effectiveFilterDate || rawD === effectiveFilterDate;
    });
  }, [sales, dateFilterMode, effectiveFilterDate]);

  // Filter purchases based on chosen date
  const filteredPurchases = useMemo(() => {
    if (dateFilterMode === 'all') return purchases;
    return purchases.filter((p) => {
      const localD = getLocalDateStr(p.date);
      const rawD = (p.date || '').slice(0, 10);
      return localD === effectiveFilterDate || rawD === effectiveFilterDate;
    });
  }, [purchases, dateFilterMode, effectiveFilterDate]);

  // Filter expenses strictly based on chosen date (আজকের / নির্বাচিত তারিখের খরচ)
  const filteredExpenses = useMemo(() => {
    if (dateFilterMode === 'all') return expenses;
    return expenses.filter((e) => {
      const localD = getLocalDateStr(e.date);
      const rawD = (e.date || '').slice(0, 10);
      return localD === effectiveFilterDate || rawD === effectiveFilterDate;
    });
  }, [expenses, dateFilterMode, effectiveFilterDate]);

  // Financial calculations for selected period
  const totalSalesAmount = useMemo(() => {
    return Math.round(filteredSales.reduce((acc, s) => acc + s.grandTotal, 0));
  }, [filteredSales]);

  const totalProfitAmount = useMemo(() => {
    return Math.round(filteredSales.reduce((acc, s) => acc + (s.profit || 0), 0));
  }, [filteredSales]);

  const totalExpenseAmount = useMemo(() => {
    return Math.round(filteredExpenses.reduce((acc, e) => acc + e.amount, 0));
  }, [filteredExpenses]);

  // Net Profit (প্রকৃত নিট লাভ = বিক্রয় লাভ - নির্বাচিত/আজকের দোকান খরচ)
  const netProfit = useMemo(() => {
    return Math.round(totalProfitAmount - totalExpenseAmount);
  }, [totalProfitAmount, totalExpenseAmount]);

  // Total Investment in Sales (বিক্রির মোট ইনভেস্ট / ক্রয়মূল্য)
  const totalInvestmentAmount = useMemo(() => {
    return Math.round(
      filteredSales.reduce((acc, s) => {
        if (s.id.startsWith('return_') || s.grandTotal < 0 || (s.profit || 0) < 0) {
          return acc - Math.abs(s.totalCost || 0);
        }
        const isDirectQuickSaleNoProfit =
          s.items.length === 1 && s.items[0].productId === 'quick_sale_entry' && !(s.profit && s.profit > 0);
        if (isDirectQuickSaleNoProfit) return acc;

        const inv = s.items.reduce(
          (sum, it) => sum + (it.costPrice || (it as any).purchasePrice || 0) * it.quantity,
          0
        );
        return acc + (inv > 0 ? inv : Math.max(0, s.grandTotal - (s.profit || 0)));
      }, 0)
    );
  }, [filteredSales]);

  const totalDueGiven = useMemo(() => {
    return Math.round(filteredSales.reduce((acc, s) => acc + s.dueAmount, 0));
  }, [filteredSales]);

  const totalPurchaseCost = useMemo(() => {
    return Math.round(filteredPurchases.reduce((acc, p) => acc + p.totalCost, 0));
  }, [filteredPurchases]);

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col p-2.5 sm:p-3 max-w-7xl mx-auto pb-24 overflow-y-auto">
      {/* Top Controls & Date Selector (Light Card matching Customer Baki Khata) */}
      <div className="bg-white rounded-[24px] p-3 shadow-xs border border-[#E2E8F0] mb-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Sub tabs: Sales vs Expenses vs Bulk Purchases */}
          <div className="flex flex-wrap rounded-2xl bg-[#EDF2F7] p-1.5 gap-1 border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sales'
                  ? 'bg-[#0E6B6B] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#102A43]'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>বিক্রি ও লাভ</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('expenses')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'expenses'
                  ? 'bg-[#0E6B6B] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#102A43]'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>দোকানের খরচ খাতা ({expenses.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bulkPurchases')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'bulkPurchases'
                  ? 'bg-[#0E6B6B] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#102A43]'
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              <span>নগদ ক্রয় রসিদ ({bulkPurchases.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cashReconciliation')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'cashReconciliation'
                  ? 'bg-[#0E6B6B] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#102A43]'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>দিনশেষের ক্যাশ মিল</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ownerCapital')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ownerCapital'
                  ? 'bg-[#0E6B6B] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#102A43]'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>মালিকের নিজস্ব টাকার হিসাব ({ownerTransactions.length})</span>
            </button>
          </div>

          {/* Quick Date Filters */}
          {(activeTab === 'sales' || activeTab === 'purchases') && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 sm:pt-0">
              {[
                { id: 'today', label: t.today },
                { id: 'yesterday', label: t.yesterday },
                { id: 'all', label: t.allTime },
              ].map((dm) => (
                <button
                  key={dm.id}
                  type="button"
                  onClick={() => handleDateModeChange(dm.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                    dateFilterMode === dm.id
                      ? 'bg-[#0E6B6B] text-white border-[#0E6B6B] shadow-2xs'
                      : 'bg-[#EDF2F7] text-[#64748B] border-[#E2E8F0] hover:bg-[#E0F2F1] hover:text-[#0E6B6B]'
                  }`}
                >
                  {dm.label}
                </button>
              ))}

              <div className="relative shrink-0">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setDateFilterMode('custom');
                    setSelectedDate(e.target.value);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#EDF2F7] text-[#102A43] text-xs font-bold border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sales & Profit View */}
      {activeTab === 'sales' && (
        <>
          {/* 4 Financial Performance Metric Cards in 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3 mb-3 shrink-0">
            {/* 1. আজকের বিক্রি */}
            <div className="bg-white rounded-[24px] p-4 border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
              <div className="w-10 h-10 rounded-full bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center mb-2">
                <ShoppingBag className="w-5 h-5 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-[#64748B]">
                আজকের বিক্রি
              </span>
              <p className="text-xl sm:text-2xl font-black text-[#102A43] my-1 tracking-tight">
                ৳ {totalSalesAmount.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0E6B6B]"></span>
                <span>{filteredSales.length}টি বিক্রি</span>
              </div>
            </div>

            {/* 2. বিক্রয় লাভ (মোট লাভ) */}
            <div
              onClick={() => {
                if (appMode === 'normal' && onOpenSubscriptionModal) onOpenSubscriptionModal();
              }}
              className="bg-white rounded-[24px] p-4 border border-[#E2E8F0] shadow-xs flex flex-col justify-between cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-[#64748B]">
                  বিক্রয় লাভ (মোট)
                </span>
                {appMode === 'normal' && (
                  <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                    Pro
                  </span>
                )}
              </div>
              {appMode === 'normal' ? (
                <div className="py-1">
                  <span className="text-sm font-bold text-amber-800 flex items-center gap-1">
                    ৳••• <span className="text-[10px] font-semibold underline">আনলক</span>
                  </span>
                </div>
              ) : (
                <p className="text-xl sm:text-2xl font-black text-[#2E7D32] my-1 tracking-tight">
                  ৳ {totalProfitAmount.toLocaleString()}
                </p>
              )}
              <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]"></span>
                <span>পণ্য বিক্রি থেকে লাভ</span>
              </div>
            </div>

            {/* 3. খরচ */}
            <div
              onClick={() => setActiveTab('expenses')}
              className="bg-white rounded-[24px] p-4 border border-[#E2E8F0] shadow-xs flex flex-col justify-between cursor-pointer hover:border-[#0E6B6B]/40 transition"
            >
              <div className="w-10 h-10 rounded-full bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center mb-2">
                <Wallet className="w-5 h-5 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-[#64748B]">
                দোকান খরচ
              </span>
              <p className="text-xl sm:text-2xl font-black text-[#D32F2F] my-1 tracking-tight">
                ৳ {totalExpenseAmount.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D32F2F]"></span>
                <span>আজকের খরচ ({filteredExpenses.length}টি)</span>
              </div>
            </div>

            {/* 4. বাকি */}
            <div className="bg-white rounded-[24px] p-4 border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
              <div className="w-10 h-10 rounded-full bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center mb-2">
                <ClipboardCheck className="w-5 h-5 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-[#64748B]">
                বাকি বিক্রি
              </span>
              <p className="text-xl sm:text-2xl font-black text-[#102A43] my-1 tracking-tight">
                ৳ {totalDueGiven.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0E6B6B]"></span>
                <span>মোট বাকি</span>
              </div>
            </div>
          </div>

          {/* Dedicated Net Profit Card (দোকান খরচের পরে নিট লাভ কত?) */}
          <div className="bg-gradient-to-r from-[#E0F2F1] via-emerald-50 to-[#E8F5E9] rounded-[24px] p-4 sm:p-5 border-2 border-[#80CBC4] shadow-sm mb-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[#0E6B6B] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Calculator className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#0E6B6B] bg-white/80 px-2 py-0.5 rounded-md border border-[#80CBC4]">
                  চূড়ান্ত হিসাব
                </span>
                <h4 className="text-base sm:text-lg font-black text-[#102A43] mt-1">
                  দোকান খরচের পরে নিট লাভ
                </h4>
                <p className="text-xs sm:text-sm text-[#486581] mt-0.5">
                  বিক্রয় লাভ <span className="font-extrabold text-[#2E7D32]">৳{totalProfitAmount.toLocaleString()}</span> − দোকান খরচ <span className="font-extrabold text-[#D32F2F]">৳{totalExpenseAmount.toLocaleString()}</span>
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#80CBC4]/40 flex sm:flex-col items-center sm:items-end justify-between">
              <span className="text-xs font-bold text-[#486581] sm:hidden">প্রকৃত নিট লাভ:</span>
              <div>
                {appMode === 'normal' ? (
                  <span className="text-lg font-black text-amber-800">৳••• (Pro)</span>
                ) : (
                  <>
                    <span
                      className={`text-2xl sm:text-3xl font-black tracking-tight block ${
                        netProfit >= 0 ? 'text-[#2E7D32]' : 'text-[#D32F2F]'
                      }`}
                    >
                      {netProfit < 0 ? `-৳ ${Math.abs(netProfit).toLocaleString()}` : `৳ ${netProfit.toLocaleString()}`}
                    </span>
                    <span className="text-[11px] font-extrabold text-[#0E6B6B]">
                      {netProfit >= 0 ? '✓ পকেটের নিট লাভ' : '⚠️ লস / ঘাটতি'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Day Close Action Banner */}
          <div className="bg-gradient-to-r from-[#0E6B6B] to-[#124E4E] rounded-[24px] p-4 text-white shadow-xs mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <Store className="w-6 h-6 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-sm sm:text-base text-white">
                  এখনই দোকান বন্ধ ও সারাদিনের ক্যাশ মিলাবেন?
                </h4>
                <p className="text-xs text-white/80 mt-0.5">
                  রাত ১২:০০ টার অপেক্ষা না করে সকাল থেকে বর্তমান মুহূর্ত পর্যন্ত মোট বিক্রি, লাভ ও ড্রয়ারের ক্যাশ মিলিয়ে স্লিপ প্রিন্ট বা PDF ডাউনলোড করুন।
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('cashReconciliation')}
              className="px-4 py-2.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 shrink-0 cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>আজকের দোকান ক্লোজ ও হিসাব মিলান (Day Close)</span>
            </button>
          </div>

          {/* Quick Cashbook Sale Banner for Shopkeepers who don't scan/add products */}
          {onAddQuickSale && (
            <div className="bg-gradient-to-r from-amber-50 via-[#FFFBEB] to-amber-50 rounded-[24px] p-4 border-2 border-amber-300 shadow-xs mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
                  <Zap className="w-6 h-6 fill-current" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-sm sm:text-base text-[#102A43]">
                    পণ্য অ্যাড বা স্ক্যান ছাড়াই শুধু বিক্রির হিসাব রাখতে চান?
                  </h4>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    কখন কত টাকা বিক্রি করছেন তা ১ ক্লিকে লিখে রাখুন—সারাদিনের মোট বিক্রি অটোমেটিক যোগ হবে!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setQuickSaleInitialMode('sale');
                    setIsQuickSaleOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>দ্রুত বিক্রি</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickSaleInitialMode('return');
                    setIsQuickSaleOpen(true);
                  }}
                  className="px-3.5 py-2.5 rounded-2xl bg-rose-50 hover:bg-[#D32F2F] text-[#D32F2F] hover:text-white border border-rose-200 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 shrink-0 cursor-pointer"
                >
                  <Undo2 className="w-4 h-4 stroke-[2.5]" />
                  <span>পণ্য ফেরত</span>
                </button>
              </div>
            </div>
          )}

          {/* Spacious Sales & Invoice List Section (বিক্রির তালিকা ও ইনভয়েস) */}
          <div className="bg-white rounded-[24px] p-4 sm:p-5 shadow-xs border border-[#E2E8F0] min-h-[340px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-[#E2E8F0] gap-2">
              <div>
                <h4 className="font-extrabold text-base sm:text-lg text-[#102A43]">
                  {t.salesList} ({filteredSales.length}টি)
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">
                  কখন কত টাকা বিক্রি হয়েছে তার সময়সহ তালিকা (ক্লিক করে রসিদ প্রিন্ট করুন)
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {onAddQuickSale && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSaleInitialMode('sale');
                        setIsQuickSaleOpen(true);
                      }}
                      className="text-xs font-black px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-500/40 flex items-center gap-1 cursor-pointer transition active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>+ দ্রুত বিক্রি</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSaleInitialMode('return');
                        setIsQuickSaleOpen(true);
                      }}
                      className="text-xs font-black px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-[#D32F2F] text-[#D32F2F] hover:text-white border border-rose-200 flex items-center gap-1 cursor-pointer transition active:scale-95"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>পণ্য ফেরত</span>
                    </button>
                  </>
                )}
                <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] border border-[#B2DFDB]">
                  মোট ইনভেস্ট: ৳{totalInvestmentAmount.toLocaleString()}
                </span>
                <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#EDF2F7] text-[#102A43] border border-[#E2E8F0]">
                  তারিখ: {dateFilterMode === 'all' ? 'সর্বমোট' : formatDateDDMMYYYY(effectiveFilterDate)}
                </span>
              </div>
            </div>

            {filteredSales.length === 0 ? (
              <div className="py-14 flex flex-col items-center justify-center text-center p-6 text-[#64748B]">
                <Receipt className="w-12 h-12 text-[#9AA5B1] mb-2 stroke-1" />
                <p className="text-sm font-bold text-[#102A43]">
                  {t.noSalesToday}
                </p>
                <p className="text-xs text-[#64748B] mt-1 max-w-md">
                  বিক্রি / POS ট্যাব থেকে পণ্য বিক্রি করুন অথবা পণ্য ছাড়া সরাসরি হিসাব রাখতে নিচের বাটনে চাপুন।
                </p>
                {onAddQuickSale && (
                  <button
                    type="button"
                    onClick={() => setIsQuickSaleOpen(true)}
                    className="mt-4 px-4 py-2.5 rounded-2xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
                  >
                    <Zap className="w-4 h-4 fill-current text-amber-300" />
                    <span>+ দ্রুত বিক্রি যোগ করুন (পণ্য ছাড়া)</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSales
                  .slice()
                  .reverse()
                  .map((sale) => {
                    const isReturnRecord =
                      sale.id.startsWith('return_') ||
                      sale.grandTotal < 0 ||
                      (sale.profit || 0) < 0;

                    const saleInvestment = isReturnRecord
                      ? Math.abs(Math.round(sale.totalCost || 0))
                      : Math.round(
                          sale.items.reduce(
                            (acc, it) =>
                              acc +
                              (it.costPrice || (it as any).purchasePrice || 0) * it.quantity,
                            0
                          ) || Math.max(0, sale.grandTotal - (sale.profit || 0))
                        );

                    return (
                      <div
                        key={sale.id}
                        onClick={() => !isReturnRecord && setReprintSale(sale)}
                        className={`p-4 rounded-[22px] border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                          isReturnRecord
                            ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-50'
                            : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#0E6B6B] hover:shadow-md cursor-pointer'
                        }`}
                      >
                        {/* Left: Invoice Info & Customer */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`font-mono font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg border ${
                                isReturnRecord
                                  ? 'bg-rose-100 text-[#D32F2F] border-rose-200'
                                  : 'bg-[#E0F2F1] text-[#0E6B6B] border-[#B2DFDB]'
                              }`}
                            >
                              #{sale.invoiceNo}
                            </span>
                            <span className="text-base sm:text-lg font-black text-[#102A43]">
                              {sale.customerName || t.cashCustomer}
                            </span>
                            <span
                              className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                isReturnRecord
                                  ? 'bg-[#D32F2F] text-white'
                                  : sale.dueAmount > 0
                                  ? 'bg-[#FFEBEE] text-[#D32F2F] border border-rose-200'
                                  : 'bg-[#E8F5E9] text-[#2E7D32] border border-emerald-200'
                              }`}
                            >
                              {isReturnRecord
                                ? '↩️ পণ্য ফেরত'
                                : sale.dueAmount > 0
                                ? 'বাকি বিক্রি'
                                : 'নগদ বিক্রি'}
                            </span>
                          </div>

                          {/* Items Sold list */}
                          <p
                            className={`text-sm font-semibold mt-2.5 leading-relaxed ${
                              isReturnRecord ? 'text-[#D32F2F]' : 'text-[#102A43]'
                            }`}
                          >
                            {sale.items
                              .map((it) => `${it.productName} (${it.quantity} ${it.unit})`)
                              .join(', ')}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-[#64748B] mt-2">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-3.5 h-3.5 text-[#0E6B6B]" />
                              {new Date(sale.date).toLocaleTimeString('bn-BD', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span>•</span>
                            <span className="font-medium">
                              {isReturnRecord
                                ? 'ড্যাশবোর্ড থেকে বিক্রি ও লাভ কর্তন হয়েছে'
                                : `মোট ${sale.items.length}টি আইটেম`}
                            </span>
                          </div>
                        </div>

                        {/* Right: Investment, Total Sale, Profit & Print Button (Large & Readable) */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#E2E8F0]">
                          <div className="space-y-1 text-left sm:text-right bg-white sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-[#E2E8F0]">
                            <div className="text-xs sm:text-sm font-bold text-[#64748B]">
                              ইনভেস্ট:{' '}
                              <span className="font-extrabold text-[#102A43]">
                                {isReturnRecord ? `-৳${saleInvestment.toLocaleString()}` : `৳${saleInvestment.toLocaleString()}`}
                              </span>
                            </div>

                            {/* Total Sale (Bold & Big) */}
                            <div
                              className={`text-lg sm:text-xl font-black tracking-tight ${
                                isReturnRecord ? 'text-[#D32F2F]' : 'text-[#102A43]'
                              }`}
                            >
                              {isReturnRecord
                                ? `ফেরত: -৳${Math.abs(sale.grandTotal).toLocaleString()}`
                                : `বিক্রি: ৳${sale.grandTotal.toLocaleString()}`}
                            </div>

                            {/* Profit */}
                            <div
                              className={`text-xs sm:text-sm font-extrabold ${
                                isReturnRecord ? 'text-[#D32F2F]' : 'text-[#2E7D32]'
                              }`}
                            >
                              {isReturnRecord
                                ? `লাভ কর্তন: -৳${Math.abs(Math.round(sale.profit || 0)).toLocaleString()}`
                                : `লাভ: +৳${Math.round(sale.profit || 0).toLocaleString()}`}
                            </div>

                            {sale.dueAmount > 0 && (
                              <div className="text-xs text-[#D32F2F] font-black">
                                বাকি: ৳{sale.dueAmount.toLocaleString()}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!isReturnRecord && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReprintSale(sale);
                                }}
                                className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                                title="রসিদ দেখুন ও প্রিন্ট করুন"
                              >
                                <Printer className="w-4 h-4" />
                                <span className="hidden sm:inline">রসিদ প্রিন্ট</span>
                              </button>
                            )}

                            {onDeleteSale && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSaleToDelete(sale);
                                }}
                                className="p-2.5 rounded-xl bg-[#FFEBEE] text-[#D32F2F] hover:bg-rose-200 border border-rose-200 transition active:scale-95 cursor-pointer shrink-0"
                                title="ক্যাশ মেমো ডিলিট করুন"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <ExpenseManager
          expenses={expenses}
          profile={profile}
          language={language}
          onAddExpense={onAddExpense}
          onDeleteExpense={onDeleteExpense}
        />
      )}

      {/* Bulk Purchases Tab */}
      {activeTab === 'bulkPurchases' && (
        <BulkPurchaseManager
          bulkPurchases={bulkPurchases}
          suppliers={suppliers}
          products={products}
          profile={profile}
          language={language}
          onAddBulkPurchase={onAddBulkPurchase}
          onDeleteBulkPurchase={onDeleteBulkPurchase}
          onOpenSupplierKhata={onOpenSupplierKhata}
        />
      )}

      {/* Daily & Monthly Cash Reconciliation Tab */}
      {activeTab === 'cashReconciliation' && (
        <CashReconciliationManager
          sales={sales}
          bakiTransactions={bakiTransactions}
          purchases={purchases}
          bulkPurchases={bulkPurchases}
          supplierTransactions={supplierTransactions}
          expenses={expenses}
          ownerTransactions={ownerTransactions}
          otherCashEntries={otherCashEntries}
          dailyReconciliations={dailyReconciliations}
          monthlyReconciliations={monthlyReconciliations}
          initialOpeningCash={initialOpeningCash}
          products={products}
          customers={customers}
          suppliers={suppliers}
          profile={profile}
          onSaveInitialOpeningCash={onSaveInitialOpeningCash}
          onAddOtherCashEntry={onAddOtherCashEntry}
          onDeleteOtherCashEntry={onDeleteOtherCashEntry}
          onSaveDailyReconciliation={onSaveDailyReconciliation}
          onAddPostCloseAdjustment={onAddPostCloseAdjustment}
          onSaveMonthlyReconciliation={onSaveMonthlyReconciliation}
          onAddOwnerTransaction={onAddOwnerTransaction}
          onDeleteOwnerTransaction={onDeleteOwnerTransaction}
        />
      )}

      {/* Owner Capital & Drawings Tab */}
      {activeTab === 'ownerCapital' && (
        <OwnerCapitalManager
          ownerTransactions={ownerTransactions}
          dailyReconciliations={dailyReconciliations}
          onAddOwnerTransaction={onAddOwnerTransaction}
          onDeleteOwnerTransaction={onDeleteOwnerTransaction}
        />
      )}

      {/* Purchases Log Tab (পণ্য কেনার রেকর্ড) */}
      {activeTab === 'purchases' && (
        <div className="bg-white rounded-[24px] p-4 sm:p-5 shadow-xs border border-[#E2E8F0]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E2E8F0]">
            <h4 className="font-bold text-base text-[#102A43]">
              মাল কেনার রেকর্ড (ক্রয় ইতিহাস)
            </h4>
            <span className="text-xs sm:text-sm font-extrabold text-[#0E6B6B] bg-[#E0F2F1] px-3 py-1.5 rounded-xl border border-[#B2DFDB]">
              মোট ক্রয় খরচ: ৳{totalPurchaseCost.toLocaleString()}
            </span>
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="py-14 flex flex-col items-center justify-center text-center p-6 text-[#64748B]">
              <ShoppingBag className="w-12 h-12 text-[#9AA5B1] mb-2 stroke-1" />
              <p className="text-sm font-bold text-[#102A43]">
                কোন মাল কেনার রেকর্ড নেই
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                "পাইকারি মাল ক্রয়" ট্যাবে অথবা "পণ্য ও স্টক" ট্যাবে গিয়ে মাল কেনার হিসাব রাখুন।
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredPurchases
                .slice()
                .reverse()
                .map((pur) => (
                  <div
                    key={pur.id}
                    className="p-3.5 rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <h5 className="font-bold text-sm sm:text-base text-[#102A43]">
                        {pur.productName}
                      </h5>
                      <p className="text-[#64748B] mt-0.5">
                        সাপ্লায়ার: <span className="font-bold text-[#0E6B6B]">{pur.supplierName || 'আড়ৎ'}</span>
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {new Date(pur.date).toLocaleDateString('bn-BD', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-[#64748B] block">
                        +{pur.quantity} {pur.unit} (দর: ৳{pur.unitCostPrice})
                      </span>
                      <span className="text-base sm:text-lg font-black text-[#102A43] block mt-0.5">
                        ৳{pur.totalCost.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Modal for viewing past invoice */}
      {reprintSale && (
        <ReceiptModal
          sale={reprintSale}
          profile={profile}
          language={language}
          onClose={() => setReprintSale(null)}
        />
      )}

      {/* Quick Sale & Product Return Modal */}
      {onAddQuickSale && (
        <QuickSaleModal
          isOpen={isQuickSaleOpen}
          onClose={() => setIsQuickSaleOpen(false)}
          sales={sales}
          products={products}
          customers={customers}
          language={language}
          initialMode={quickSaleInitialMode}
          onSaveQuickSale={(sale, openReceipt, updatedProds) => {
            onAddQuickSale(sale, updatedProds);
            if (openReceipt) {
              setReprintSale(sale);
            }
          }}
          onDeleteSale={onDeleteSale}
          onAddNewCustomer={onAddNewCustomer}
        />
      )}

      {/* Delete Cash Memo Confirmation Modal */}
      {saleToDelete && onDeleteSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl border border-[#E2E8F0] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#102A43]">
                ক্যাশ মেমোটি ডিলিট করবেন?
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                মেমো <strong className="text-[#102A43]">#{saleToDelete.invoiceNo}</strong> ({saleToDelete.customerName || t.cashCustomer} - ৳{saleToDelete.grandTotal.toLocaleString()}) মুছে যাবে এবং পণ্যের স্টক ও বাকি হিসাব স্বয়ংক্রিয়ভাবে সমন্বয় হবে।
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSaleToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#EDF2F7] text-[#102A43] font-bold text-xs cursor-pointer"
              >
                না, থাকুক
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSale(saleToDelete.id);
                  setSaleToDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#D32F2F] hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                হ্যাঁ, ডিলিট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
