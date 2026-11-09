import React, { useState, useMemo } from 'react';
import {
  Sale,
  Expense,
  BulkPurchase,
  PurchaseRecord,
  OwnerTransaction,
} from '../types';
import { DB } from '../storage/db';
import { playSuccessChime } from '../utils/audio';
import {
  Landmark,
  Edit3,
  Check,
  X,
} from 'lucide-react';

interface Props {
  initialStoreCapital: number;
  onSaveInitialStoreCapital: (amount: number) => void;
  sales: Sale[];
  bulkPurchases: BulkPurchase[];
  purchases?: PurchaseRecord[];
  expenses: Expense[];
  ownerTransactions: OwnerTransaction[];
  compact?: boolean;
  onOpenOwnerCapital?: () => void;
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

export const formatBnNumber = (num: number): string => {
  try {
    return Math.round(num || 0).toLocaleString('bn-BD');
  } catch {
    return String(Math.round(num || 0));
  }
};

export function calculateRunningCapital({
  initialStoreCapital,
  sales,
  bulkPurchases,
  purchases = [],
  expenses,
  ownerTransactions,
}: {
  initialStoreCapital: number;
  sales: Sale[];
  bulkPurchases: BulkPurchase[];
  purchases?: PurchaseRecord[];
  expenses: Expense[];
  ownerTransactions: OwnerTransaction[];
}) {
  const defaultMargin = DB.getQuickSaleProfitMargin();
  const todayStr = getLocalDateStr(new Date());
  const initialCapital = Math.max(0, Math.round(Number(initialStoreCapital) || 0));

  let totalSalesAll = 0;
  let quickSalesTotal = 0;
  let totalSalesProfit = 0;
  let todaySalesProfit = 0;
  let totalCostOfGoodsSold = 0;
  let totalCashSalesCollected = 0;
  let totalSalesDue = 0;

  for (const s of sales) {
    const grand = Number(s.grandTotal) || 0;
    totalSalesAll += grand;

    const isQuick =
      Boolean(
        s.items &&
          s.items.some(
            (it) =>
              it.productId === 'quick_sale_entry' ||
              it.productId === 'product_return_entry'
          )
      ) ||
      s.id.startsWith('return_') ||
      grand < 0;

    if (isQuick) {
      quickSalesTotal += grand;
    }

    const isQuickSaleEntry = Boolean(
      s.items && s.items.some((it) => it.productId === 'quick_sale_entry')
    );

    const sProfit =
      isQuickSaleEntry && (s.profit === undefined || s.profit === 0) && grand > 0
        ? Math.round(grand * (defaultMargin / 100))
        : Math.round(Number(s.profit) || 0);

    totalSalesProfit += sProfit;

    const sDate = getLocalDateStr(s.date);
    const rawDate = (s.date || '').slice(0, 10);
    if (sDate === todayStr || rawDate === todayStr) {
      todaySalesProfit += sProfit;
    }

    // Cost of goods sold (মালের কেনা দাম যা পুঁজি থেকে কমেছে)
    const sCost =
      s.id.startsWith('return_') && grand === 0 ? 0 : Math.round(grand - sProfit);
    totalCostOfGoodsSold += sCost;

    // Due amount from this sale
    const sDue =
      s.id.startsWith('return_') || grand < 0 ? 0 : Math.max(0, Number(s.dueAmount) || 0);
    totalSalesDue += sDue;

    // Physical cash collected in drawer from this sale
    const sCash =
      s.id.startsWith('return_') || grand < 0 || (s.paidAmount || 0) < 0
        ? Number(
            s.paidAmount !== undefined && s.paidAmount !== 0
              ? s.paidAmount
              : grand !== 0
              ? grand
              : s.profit || 0
          )
        : Math.max(0, grand - sDue);
    totalCashSalesCollected += sCash;
  }

  totalSalesAll = Math.round(totalSalesAll);
  quickSalesTotal = Math.round(quickSalesTotal);
  totalSalesProfit = Math.round(totalSalesProfit);
  todaySalesProfit = Math.round(todaySalesProfit);
  totalCostOfGoodsSold = Math.round(totalCostOfGoodsSold);
  totalCashSalesCollected = Math.round(totalCashSalesCollected);
  totalSalesDue = Math.round(totalSalesDue);

  // কাস্টমারের বকেয়া আদায় ও মোট বাকি পাওনা (Customer Due & Due Collected)
  const bakiTxs = DB.getBakiTransactions();
  const customersList = DB.getCustomers();
  const customerDueCollected = Math.round(
    bakiTxs
      .filter((tx) => tx.type === 'payment_received')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
  );
  const customerDueFromCustomers = Math.round(
    customersList.reduce((sum, c) => sum + Math.max(0, Number(c.totalDue) || 0), 0)
  );
  const salesDueRemaining = Math.max(0, Math.round(totalSalesDue - customerDueCollected));
  const customerDue = Math.max(customerDueFromCustomers, salesDueRemaining);

  // ৩. মাল ক্রয় / রিস্টক (Bulk Purchases + Direct Product Restocks)
  const bulkPurchaseCost = Math.round(
    bulkPurchases.reduce((sum, bp) => sum + (Number(bp.totalAmount) || 0), 0)
  );
  const bulkCashPaid = Math.round(
    bulkPurchases.reduce(
      (sum, bp) =>
        sum +
        Math.max(
          0,
          bp.paidAmount !== undefined
            ? Number(bp.paidAmount) || 0
            : (Number(bp.totalAmount) || 0) - (Number(bp.dueAmount) || 0)
        ),
      0
    )
  );
  const singlePurchaseCost = Math.round(
    purchases.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0)
  );
  const totalPurchases = bulkPurchaseCost + singlePurchaseCost;
  const cashPurchasesPaid = bulkCashPaid + singlePurchaseCost;

  // ৪. দোকান খরচ (সকল দোকান খরচ ও আজকের খরচ)
  const totalExpenses = Math.round(
    expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  );
  const todayExpenses = Math.round(
    expenses
      .filter((e) => {
        const eDate = getLocalDateStr(e.date);
        const rawDate = (e.date || '').slice(0, 10);
        return eDate === todayStr || rawDate === todayStr;
      })
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  );

  // ৫. মালিকের উত্তোলন ও অতিরিক্ত পুঁজি জমা (শুধুমাত্র ম্যানুয়াল এন্ট্রি, কোনো অটো-উত্তোলন নয়)
  const manualOwnerTxs = (ownerTransactions || []).filter((tx) => {
    if (!tx) return false;
    const id = String(tx.id || '');
    const note = String(tx.note || '');
    if (
      id.startsWith('tx_close_') ||
      id.startsWith('tx_autoclose_') ||
      note.includes('রাতের ক্যাশ টাকা বাসায় নেওয়া') ||
      note.includes('রাত ১২টা অটো ক্লোজ')
    ) {
      return false;
    }
    return true;
  });

  const totalWithdrawals = Math.round(
    manualOwnerTxs
      .filter((tx) => tx.type === 'withdrawal')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
  );
  const totalOwnerAdded = Math.round(
    manualOwnerTxs
      .filter((tx) => tx.type === 'withdrawal_return' || tx.type === 'capital_deposit')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
  );
  const netOwnerWithdrawal = Math.max(0, totalWithdrawals - totalOwnerAdded);

  // ৬. পুঁজি ও নগদ ক্যাশ ট্র্যাকার (Stock Value + Cash in Hand + Customer Due):
  // - বর্তমান স্টক মালের ক্রয়মূল্য (Remaining Goods Capital / Stock Value) = শুরুর মালের পুঁজি - বিক্রিত মালের কেনা দাম + নতুন মাল ক্রয়
  const remainingGoodsCapital = Math.max(
    0,
    Math.round(initialCapital - totalCostOfGoodsSold + totalPurchases)
  );

  // - ক্যাশ বাক্সে নগদ টাকা (Cash in Hand) = নগদ বিক্রি আদায় + কাস্টমার বকেয়া আদায় + মালিকের জমা - দোকান খরচ - নগদ মাল কেনা - মালিকের ম্যানুয়াল উত্তোলন
  const drawerCash = Math.max(
    0,
    Math.round(
      totalCashSalesCollected +
        customerDueCollected +
        totalOwnerAdded -
        totalExpenses -
        cashPurchasesPaid -
        totalWithdrawals
    )
  );

  // - আজকের লাভ / নিট লাভ (Today's Profit)
  const todayNetProfit = Math.round(todaySalesProfit - todayExpenses);
  const totalNetProfit = Math.round(totalSalesProfit - totalExpenses);
  const displayProfit =
    todaySalesProfit !== 0 || todayExpenses !== 0 ? todayNetProfit : totalNetProfit;

  // - বর্তমান মোট পুঁজি = বর্তমান স্টক মালের ক্রয়মূল্য (Stock Value) + ক্যাশ বাক্সে নগদ টাকা (Cash in Hand) + কাস্টমারের মোট বাকি পাওনা
  const currentRunningCapital = remainingGoodsCapital + drawerCash + customerDue;

  return {
    initialCapital,
    remainingGoodsCapital,
    drawerCash,
    customerDue,
    todaySalesProfit,
    todayNetProfit,
    totalSalesProfit,
    totalNetProfit,
    displayProfit,
    totalCostOfGoodsSold,
    totalSalesAll,
    quickSalesTotal,
    totalPurchases,
    totalExpenses,
    totalWithdrawals,
    totalOwnerAdded,
    netOwnerWithdrawal,
    currentRunningCapital,
  };
}

export const RunningCapitalCard: React.FC<Props> = ({
  initialStoreCapital,
  onSaveInitialStoreCapital,
  sales,
  bulkPurchases,
  purchases = [],
  expenses,
  ownerTransactions,
}) => {
  const [isEditingCapital, setIsEditingCapital] = useState(false);
  const [capitalInput, setCapitalInput] = useState<string>(
    initialStoreCapital > 0 ? String(initialStoreCapital) : ''
  );
  const [savedToast, setSavedToast] = useState(false);

  const stats = useMemo(
    () =>
      calculateRunningCapital({
        initialStoreCapital,
        sales,
        bulkPurchases,
        purchases,
        expenses,
        ownerTransactions,
      }),
    [initialStoreCapital, sales, bulkPurchases, purchases, expenses, ownerTransactions]
  );

  const handleSaveCapital = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.max(0, Math.round(Number(capitalInput) || 0));
    onSaveInitialStoreCapital(val);
    playSuccessChime();
    setIsEditingCapital(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <div className="bg-gradient-to-br from-[#0F2942] via-[#0E4D58] to-[#0E6B6B] text-white rounded-2xl p-2.5 sm:p-3 mb-2 shadow-sm border border-[#0E6B6B]/40">
      {/* Top Row: Title + Total Running Capital + Edit Initial Goods Capital Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xs shrink-0">
            <Landmark className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs sm:text-sm font-black text-white tracking-tight leading-tight">
                দোকানের মোট পুঁজি ট্র্যাকার
              </h4>
              {savedToast && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[9px] font-black leading-none">
                  ✓ আপডেট হয়েছে
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-emerald-200/90 leading-tight mt-0.5">
              শুরুর পুঁজি: ৳{formatBnNumber(stats.initialCapital)}
            </p>
          </div>
        </div>

        {/* Action Button to Set / Edit Initial Store Capital */}
        <button
          type="button"
          onClick={() => {
            setCapitalInput(
              stats.initialCapital > 0 ? String(stats.initialCapital) : ''
            );
            setIsEditingCapital(!isEditingCapital);
          }}
          className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-[11px] font-extrabold text-white flex items-center gap-1 transition cursor-pointer shrink-0 active:scale-95"
        >
          <Edit3 className="w-3 h-3 text-amber-300" />
          <span>
            {stats.initialCapital > 0 ? 'শুরুর পুঁজি এডিট' : '+ শুরুর পুঁজি দিন'}
          </span>
        </button>
      </div>

      {/* 4-Column Clear Virtual Capital Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
        <div className="rounded-xl bg-white/10 border border-white/15 px-2.5 py-1.5">
          <span className="block text-[10px] font-bold text-emerald-100/90 leading-tight">
            মূল মালের পুঁজি
          </span>
          <span className="text-sm sm:text-base font-black text-white tabular-nums">
            ৳{formatBnNumber(stats.remainingGoodsCapital)}
          </span>
        </div>

        <div className="rounded-xl bg-white/10 border border-white/15 px-2.5 py-1.5">
          <span className="block text-[10px] font-bold text-emerald-100/90 leading-tight">
            ক্যাশ বাক্সে নগদ
          </span>
          <span className="text-sm sm:text-base font-black text-amber-300 tabular-nums">
            ৳{formatBnNumber(stats.drawerCash)}
          </span>
        </div>

        <div className="rounded-xl bg-white/10 border border-white/15 px-2.5 py-1.5">
          <span className="block text-[10px] font-bold text-emerald-100/90 leading-tight">
            লাভ (আজকের লাভ)
          </span>
          <span
            className={`text-sm sm:text-base font-black tabular-nums ${
              stats.displayProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            ৳{formatBnNumber(stats.displayProfit)}
          </span>
        </div>

        <div className="rounded-xl bg-amber-400/20 border border-amber-300/40 px-2.5 py-1.5">
          <span className="block text-[10px] font-extrabold text-amber-200 leading-tight">
            {stats.customerDue > 0 ? 'মোট পুঁজি (মাল+নগদ+বাকি)' : 'মোট পুঁজি (মাল + নগদ)'}
          </span>
          <span className="text-sm sm:text-base font-black text-white tabular-nums">
            ৳{formatBnNumber(stats.currentRunningCapital)}
          </span>
        </div>
      </div>

      {/* Inline Initial Capital Editor */}
      {isEditingCapital && (
        <form
          onSubmit={handleSaveCapital}
          className="mt-2 p-2 rounded-xl bg-slate-950/50 border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in duration-150"
        >
          <div className="min-w-0">
            <label className="block text-[11px] font-extrabold text-amber-300 leading-tight">
              দোকানের শুরুর মালের পুঁজি লিখুন (৳)
            </label>
            <p className="text-[10px] text-emerald-100/80 leading-tight mt-0.5">
              বিক্রি হলে কেনা দাম মালের পুঁজি থেকে কমবে এবং নগদ টাকা ক্যাশ বাক্সে জমা হবে (শুরুর ক্যাশ বাক্স ৳০)।
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-amber-300">
                ৳
              </span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                autoFocus
                value={capitalInput}
                onChange={(e) => setCapitalInput(e.target.value)}
                placeholder="যেমন: 10000"
                className="w-32 sm:w-36 pl-6 pr-2 py-1 rounded-lg bg-white text-[#102A43] font-black text-xs focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer transition"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>সেভ</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditingCapital(false)}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
