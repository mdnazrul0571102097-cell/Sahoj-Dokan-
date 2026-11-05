import React, { useState, useEffect } from 'react';
import {
  Sale,
  BulkPurchase,
  PurchaseRecord,
  Expense,
  OwnerTransaction,
} from '../types';
import { playSuccessChime } from '../utils/audio';
import {
  Landmark,
  Edit3,
  Check,
  X,
  TrendingUp,
  PackagePlus,
  Wallet,
  ArrowUpRight,
} from 'lucide-react';

const SEED_BULK_IDS = new Set(['bp_1']);
const SEED_EXPENSE_IDS = new Set(['exp_1', 'exp_2', 'exp_3']);

export interface RunningCapitalBreakdown {
  initialCapital: number;
  totalQuickSales: number;
  totalOwnerAdded: number;
  totalPurchases: number;
  totalExpenses: number;
  totalWithdrawals: number;
  currentRunningCapital: number;
}

export function calculateRunningCapital(params: {
  initialStoreCapital: number;
  sales: Sale[];
  bulkPurchases?: BulkPurchase[];
  purchases?: PurchaseRecord[];
  expenses?: Expense[];
  ownerTransactions?: OwnerTransaction[];
}): RunningCapitalBreakdown {
  const {
    initialStoreCapital = 0,
    sales = [],
    bulkPurchases = [],
    purchases = [],
    expenses = [],
    ownerTransactions = [],
  } = params;

  const initialCapital = Math.max(0, Math.round(Number(initialStoreCapital) || 0));

  // (+) প্রতিটি দ্রুত বিক্রি (এবং বিক্রি/ফেরত সমন্বয়)
  const totalQuickSales = Math.round(
    sales.reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0)
  );

  // (+) মালিকের নতুন পুঁজি জমা বা ফেরত (যদি থাকে)
  const totalOwnerAdded = Math.round(
    ownerTransactions
      .filter((tx) => tx.type === 'capital_deposit' || tx.type === 'withdrawal_return')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
  );

  // (-) নগদ ক্রয় রসিদ / পাইকারি মাল কেনা
  const realBulkTotal = bulkPurchases
    .filter((bp) => !SEED_BULK_IDS.has(bp.id))
    .reduce((sum, bp) => sum + (Number(bp.totalAmount) || 0), 0);

  const directPurchaseTotal = purchases.reduce(
    (sum, p) => sum + (Number(p.totalCost) || 0),
    0
  );

  const totalPurchases = Math.round(realBulkTotal + directPurchaseTotal);

  // (-) দোকানের খরচ
  const totalExpenses = Math.round(
    expenses
      .filter((e) => !SEED_EXPENSE_IDS.has(e.id))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  );

  // (-) মালিকের উত্তোলন
  const totalWithdrawals = Math.round(
    ownerTransactions
      .filter((tx) => tx.type === 'withdrawal')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
  );

  const currentRunningCapital = Math.round(
    initialCapital +
      totalQuickSales +
      totalOwnerAdded -
      totalPurchases -
      totalExpenses -
      totalWithdrawals
  );

  return {
    initialCapital,
    totalQuickSales,
    totalOwnerAdded,
    totalPurchases,
    totalExpenses,
    totalWithdrawals,
    currentRunningCapital,
  };
}

interface Props {
  initialStoreCapital: number;
  onSaveInitialStoreCapital: (amount: number) => void;
  sales: Sale[];
  bulkPurchases?: BulkPurchase[];
  purchases?: PurchaseRecord[];
  expenses?: Expense[];
  ownerTransactions?: OwnerTransaction[];
}

export const RunningCapitalCard: React.FC<Props> = ({
  initialStoreCapital,
  onSaveInitialStoreCapital,
  sales,
  bulkPurchases = [],
  purchases = [],
  expenses = [],
  ownerTransactions = [],
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(initialStoreCapital <= 0);
  const [inputVal, setInputVal] = useState<string>(
    initialStoreCapital > 0 ? String(initialStoreCapital) : ''
  );

  useEffect(() => {
    if (initialStoreCapital > 0) {
      setInputVal(String(initialStoreCapital));
      setIsEditing(false);
    }
  }, [initialStoreCapital]);

  const breakdown = calculateRunningCapital({
    initialStoreCapital,
    sales,
    bulkPurchases,
    purchases,
    expenses,
    ownerTransactions,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = Math.max(0, Math.round(Number(inputVal) || 0));
    onSaveInitialStoreCapital(cleanAmount);
    playSuccessChime();
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-2xs border border-[#80CBC4] mb-2 shrink-0">
      {/* Top Row: Running Capital Title, Live Balance & Set/Edit Initial Capital */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0]">
        <div className="flex items-center justify-between sm:justify-start gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#0E6B6B] text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Landmark className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="font-extrabold text-xs sm:text-sm text-[#102A43] truncate">
                  চলমান মোট পুঁজি / মূলধন ট্র্যাকার
                </h4>
              </div>
              <p className="text-[10.5px] text-[#64748B] truncate">
                শুরুর পুঁজি + দ্রুত বিক্রি − মাল কেনা − খরচ ও উত্তোলন
              </p>
            </div>
          </div>

          {/* Mobile Current Capital Readout */}
          <div className="text-right sm:hidden shrink-0">
            <span className="text-[10px] font-bold text-[#64748B] block leading-none">
              বর্তমান মোট পুঁজি
            </span>
            <span
              className={`text-base font-black tabular-nums tracking-tight ${
                breakdown.currentRunningCapital >= 0 ? 'text-[#0E6B6B]' : 'text-[#D32F2F]'
              }`}
            >
              {breakdown.currentRunningCapital < 0
                ? `-৳${Math.abs(breakdown.currentRunningCapital).toLocaleString()}`
                : `৳${breakdown.currentRunningCapital.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Right Side: Initial Capital Set/Edit or Desktop Current Capital */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          {isEditing ? (
            <form onSubmit={handleSave} className="flex items-center gap-1.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-40">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-[#0E6B6B]">
                  ৳
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="any"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="শুরুর পুঁজি (যেমন: 50000)"
                  className="w-full pl-6 pr-2 py-1 rounded-xl bg-[#F8FAFC] border-2 border-[#0E6B6B] text-xs font-black text-[#102A43] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-2.5 py-1 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-extrabold text-xs flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>সেভ</span>
              </button>
              {initialStoreCapital > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setInputVal(String(initialStoreCapital));
                    setIsEditing(false);
                  }}
                  className="p-1 rounded-xl bg-[#EDF2F7] text-[#64748B] hover:text-[#102A43] cursor-pointer shrink-0"
                  title="বাতিল"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          ) : (
            <div className="flex items-center justify-between w-full sm:w-auto gap-2">
              <div className="flex items-center gap-1.5 bg-[#F8FAFC] px-2.5 py-1 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] font-bold text-[#64748B]">শুরুর মূলধন:</span>
                <span className="text-xs font-black text-[#102A43] tabular-nums">
                  ৳{breakdown.initialCapital.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInputVal(
                      breakdown.initialCapital > 0 ? String(breakdown.initialCapital) : ''
                    );
                    setIsEditing(true);
                  }}
                  className="ml-1 px-1.5 py-0.5 rounded-md bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#0E6B6B] hover:text-white text-[10px] font-extrabold flex items-center gap-0.5 transition cursor-pointer"
                  title="শুরুর মূলধন পরিবর্তন করুন"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>এডিট</span>
                </button>
              </div>

              {/* Desktop Current Capital Readout */}
              <div className="hidden sm:block text-right pl-2 border-l border-[#E2E8F0]">
                <span className="text-[10px] font-bold text-[#64748B] block leading-none">
                  বর্তমান মোট পুঁজি
                </span>
                <span
                  className={`text-lg font-black tabular-nums tracking-tight ${
                    breakdown.currentRunningCapital >= 0 ? 'text-[#0E6B6B]' : 'text-[#D32F2F]'
                  }`}
                >
                  {breakdown.currentRunningCapital < 0
                    ? `-৳${Math.abs(breakdown.currentRunningCapital).toLocaleString()}`
                    : `৳${breakdown.currentRunningCapital.toLocaleString()}`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: 4 Compact Auto Plus/Minus Pillars */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2">
        {/* 1. + দ্রুত বিক্রি */}
        <div className="px-2 py-1.5 rounded-xl bg-[#E8F5E9]/70 border border-emerald-200/80 flex items-center justify-between gap-1">
          <span className="text-[10.5px] font-bold text-[#102A43] flex items-center gap-1 truncate">
            <TrendingUp className="w-3 h-3 text-[#2E7D32] shrink-0" />
            <span className="truncate">+ দ্রুত বিক্রি</span>
          </span>
          <span className="text-xs font-black text-[#2E7D32] tabular-nums shrink-0">
            +৳{(breakdown.totalQuickSales + breakdown.totalOwnerAdded).toLocaleString()}
          </span>
        </div>

        {/* 2. - মাল কেনা / ক্রয় রসিদ */}
        <div className="px-2 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between gap-1">
          <span className="text-[10.5px] font-bold text-[#102A43] flex items-center gap-1 truncate">
            <PackagePlus className="w-3 h-3 text-amber-700 shrink-0" />
            <span className="truncate">− মাল ক্রয়</span>
          </span>
          <span className="text-xs font-black text-amber-800 tabular-nums shrink-0">
            −৳{breakdown.totalPurchases.toLocaleString()}
          </span>
        </div>

        {/* 3. - দোকানের খরচ */}
        <div className="px-2 py-1.5 rounded-xl bg-[#FFEBEE]/60 border border-rose-200/80 flex items-center justify-between gap-1">
          <span className="text-[10.5px] font-bold text-[#102A43] flex items-center gap-1 truncate">
            <Wallet className="w-3 h-3 text-[#D32F2F] shrink-0" />
            <span className="truncate">− দোকান খরচ</span>
          </span>
          <span className="text-xs font-black text-[#D32F2F] tabular-nums shrink-0">
            −৳{breakdown.totalExpenses.toLocaleString()}
          </span>
        </div>

        {/* 4. - মালিকের উত্তোলন */}
        <div className="px-2 py-1.5 rounded-xl bg-[#FFEBEE]/60 border border-rose-200/80 flex items-center justify-between gap-1">
          <span className="text-[10.5px] font-bold text-[#102A43] flex items-center gap-1 truncate">
            <ArrowUpRight className="w-3 h-3 text-[#D32F2F] shrink-0" />
            <span className="truncate">− মালিকের উত্তোলন</span>
          </span>
          <span className="text-xs font-black text-[#D32F2F] tabular-nums shrink-0">
            −৳{breakdown.totalWithdrawals.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};
