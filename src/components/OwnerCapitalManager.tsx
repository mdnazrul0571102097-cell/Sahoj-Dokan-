import React, { useState, useMemo } from 'react';
import {
  OwnerTransaction,
  OwnerTransactionType,
  DailyCashReconciliation,
  Sale,
  BulkPurchase,
  PurchaseRecord,
  Expense,
} from '../types';
import { playSuccessChime } from '../utils/audio';
import { RunningCapitalCard } from './RunningCapitalCard';
import {
  UserCheck,
  ArrowUpRight,
  ArrowDownLeft,
  Landmark,
  Plus,
  Trash2,
  X,
  Link2,
  Calendar,
  Info,
} from 'lucide-react';

interface Props {
  ownerTransactions: OwnerTransaction[];
  dailyReconciliations?: DailyCashReconciliation[];
  onAddOwnerTransaction: (tx: OwnerTransaction) => void;
  onDeleteOwnerTransaction: (id: string) => void;
  initialStoreCapital?: number;
  onSaveInitialStoreCapital?: (amount: number) => void;
  sales?: Sale[];
  bulkPurchases?: BulkPurchase[];
  purchases?: PurchaseRecord[];
  expenses?: Expense[];
}

export const OwnerCapitalManager: React.FC<Props> = ({
  ownerTransactions,
  onAddOwnerTransaction,
  onDeleteOwnerTransaction,
  initialStoreCapital = 0,
  onSaveInitialStoreCapital = () => {},
  sales = [],
  bulkPurchases = [],
  purchases = [],
  expenses = [],
}) => {
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

  // Standard DD-MM-YYYY formatter (English digits, e.g. 03-11-2026)
  const formatDateDDMMYYYY = (d?: string | Date): string => {
    const ymd = getLocalDateStr(d);
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
    const [yyyy, mm, dd] = ymd.split('-');
    return `${dd}-${mm}-${yyyy}`;
  };

  const todayStr = getLocalDateStr(new Date());

  // Filter states: 'today' (আজ), 'month' (এই মাস), 'all' (সর্বমোট)
  const [filterMode, setFilterMode] = useState<'today' | 'month' | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | OwnerTransactionType>('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [txType, setTxType] = useState<OwnerTransactionType>('withdrawal');
  const [amountInput, setAmountInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(todayStr);
  const [linkedWithdrawalId, setLinkedWithdrawalId] = useState<string>('');
  const [txToDelete, setTxToDelete] = useState<OwnerTransaction | null>(null);

  // Previous withdrawal records (for linking withdrawal returns)
  const withdrawalList = useMemo(() => {
    return ownerTransactions
      .filter((t) => t.type === 'withdrawal')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ownerTransactions]);

  // Calculate how much has already been returned for each withdrawal
  const returnedByWithdrawalMap = useMemo(() => {
    const map: Record<string, number> = {};
    ownerTransactions.forEach((t) => {
      if (t.type === 'withdrawal_return' && t.linkedWithdrawalId) {
        map[t.linkedWithdrawalId] = (map[t.linkedWithdrawalId] || 0) + (t.amount || 0);
      }
    });
    return map;
  }, [ownerTransactions]);

  // Period-filtered transactions (by আজ, এই মাস, সর্বমোট)
  const periodTransactions = useMemo(() => {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return ownerTransactions.filter((tx) => {
      const dStr = getLocalDateStr(tx.date);
      const rawStr = (tx.date || '').slice(0, 10);
      if (filterMode === 'today') {
        return dStr === todayStr || rawStr === todayStr;
      }
      if (filterMode === 'month') {
        return dStr.startsWith(currentYearMonth) || rawStr.startsWith(currentYearMonth);
      }
      return true;
    });
  }, [ownerTransactions, filterMode, todayStr]);

  // Filtered list for display (including typeFilter)
  const filteredTransactions = useMemo(() => {
    return periodTransactions
      .filter((tx) => (typeFilter === 'all' ? true : tx.type === typeFilter))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [periodTransactions, typeFilter]);

  // Summary Metrics synced automatically with selected filter (আজ, এই মাস, সর্বমোট)
  const summary = useMemo(() => {
    let totalWithdrawal = 0;
    let totalReturned = 0;
    let totalNewCapital = 0;

    periodTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'withdrawal') totalWithdrawal += amt;
      else if (tx.type === 'withdrawal_return') totalReturned += amt;
      else if (tx.type === 'capital_deposit') totalNewCapital += amt;
    });

    const netWithdrawal = Math.max(0, totalWithdrawal - totalReturned);
    const netOwnerCashEffect = totalNewCapital + totalReturned - totalWithdrawal;

    return {
      totalWithdrawal: Math.round(totalWithdrawal),
      totalReturned: Math.round(totalReturned),
      totalNewCapital: Math.round(totalNewCapital),
      netWithdrawal: Math.round(netWithdrawal),
      netOwnerCashEffect: Math.round(netOwnerCashEffect),
    };
  }, [periodTransactions]);

  const handleOpenAddModal = (initialType: OwnerTransactionType) => {
    setTxType(initialType);
    setAmountInput('');
    setNoteInput('');
    setTxDate(todayStr);
    setLinkedWithdrawalId('');
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Math.round(Number(amountInput) || 0);
    if (numericAmount <= 0) return;

    let isoDate = new Date().toISOString();
    if (txDate && txDate !== todayStr) {
      try {
        const [y, m, d] = txDate.split('-').map(Number);
        const dt = new Date();
        dt.setFullYear(y, m - 1, d);
        isoDate = dt.toISOString();
      } catch {
        isoDate = new Date(txDate).toISOString();
      }
    }

    const defaultNotes: Record<OwnerTransactionType, string> = {
      withdrawal: 'মালিকের ব্যক্তিগত খরচ/নেওয়া',
      withdrawal_return: 'নেওয়া টাকা ক্যাশে ফেরত',
      capital_deposit: 'মালিকের নতুন পুঁজি জমা',
    };

    const newTx: OwnerTransaction = {
      id: `otx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: isoDate,
      type: txType,
      amount: numericAmount,
      note: noteInput.trim() || defaultNotes[txType],
      linkedWithdrawalId:
        txType === 'withdrawal_return' && linkedWithdrawalId ? linkedWithdrawalId : undefined,
      createdAt: new Date().toISOString(),
    };

    onAddOwnerTransaction(newTx);
    playSuccessChime();
    setShowAddModal(false);
  };

  const getTypeBadge = (type: OwnerTransactionType) => {
    if (type === 'withdrawal') {
      return {
        label: 'মালিকের ব্যক্তিগত খরচ/নেওয়া',
        subLabel: 'ক্যাশ বাক্সের টাকা কমেছে',
        bg: 'bg-[#FFEBEE] text-[#D32F2F] border-rose-200',
        amountColor: 'text-[#D32F2F]',
        prefix: '−',
      };
    }
    if (type === 'withdrawal_return') {
      return {
        label: 'নেওয়া টাকা ক্যাশে ফেরত',
        subLabel: 'ক্যাশ বাক্সের টাকা বেড়েছে ও বকেয়া উত্তোলন কমেছে',
        bg: 'bg-[#E0F2F1] text-[#0E6B6B] border-[#B2DFDB]',
        amountColor: 'text-[#0E6B6B]',
        prefix: '+',
      };
    }
    return {
      label: 'মালিকের নতুন পুঁজি জমা',
      subLabel: 'ক্যাশ বাক্স ও মূলধন বেড়েছে',
      bg: 'bg-[#E8F5E9] text-[#2E7D32] border-emerald-200',
      amountColor: 'text-[#2E7D32]',
      prefix: '+',
    };
  };

  return (
    <div className="flex-1 flex flex-col space-y-3">
      {/* Running Store Capital Tracker (চলমান মোট পুঁজি / মূলধন ট্র্যাকার) */}
      <RunningCapitalCard
        initialStoreCapital={initialStoreCapital}
        onSaveInitialStoreCapital={onSaveInitialStoreCapital}
        sales={sales}
        bulkPurchases={bulkPurchases}
        purchases={purchases}
        expenses={expenses}
        ownerTransactions={ownerTransactions}
      />

      {/* Info Banner: Accounting Isolation Guarantee */}
      <div className="bg-gradient-to-r from-[#E0F2F1] via-white to-[#E8F5E9] rounded-[22px] p-3.5 border border-[#80CBC4] flex items-start gap-3 shadow-2xs">
        <div className="w-9 h-9 rounded-xl bg-[#0E6B6B] text-white flex items-center justify-center shrink-0 mt-0.5">
          <UserCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-extrabold text-sm sm:text-base text-[#102A43]">
              মালিকের ব্যক্তিগত টাকা জমা, ফেরত ও উত্তোলন হিসাব
            </h3>
            <div className="inline-flex rounded-xl bg-[#EDF2F7] p-0.5 border border-[#E2E8F0]">
              {[
                { id: 'today', label: 'আজ' },
                { id: 'month', label: 'এই মাস' },
                { id: 'all', label: 'সর্বমোট' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFilterMode(m.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterMode === m.id
                      ? 'bg-[#0E6B6B] text-white shadow-2xs'
                      : 'text-[#64748B] hover:text-[#102A43]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-[#486581] mt-1 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#0E6B6B] shrink-0" />
            <span>
              স্বয়ংক্রিয়ভাবে ক্যাশ বাক্স ও মালিকের নিজস্ব টাকার হিসাবে যুক্ত হয়—সাধারণ বিক্রি, দোকানের খরচ বা লাভ-লসের সাথে মিশবে না।
            </span>
          </p>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* 1. মালিকের ব্যক্তিগত খরচ/নেওয়া */}
        <div className="bg-white rounded-[22px] p-3.5 border border-[#E2E8F0] shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#64748B]">মালিকের ব্যক্তিগত খরচ/নেওয়া</span>
            <span className="w-7 h-7 rounded-full bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#D32F2F]">
            ৳ {summary.totalWithdrawal.toLocaleString()}
          </p>
          <span className="text-[11px] text-[#64748B] block mt-0.5">
            দোকান থেকে মালিকের নেওয়া টাকা
          </span>
        </div>

        {/* 2. নেওয়া টাকা ক্যাশে ফেরত */}
        <div className="bg-white rounded-[22px] p-3.5 border border-[#E2E8F0] shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#64748B]">নেওয়া টাকা ক্যাশে ফেরত</span>
            <span className="w-7 h-7 rounded-full bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-4 h-4" />
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#0E6B6B]">
            ৳ {summary.totalReturned.toLocaleString()}
          </p>
          <span className="text-[11px] text-[#64748B] block mt-0.5">
            মালিকের ফেরত দেওয়া টাকা
          </span>
        </div>

        {/* 3. মালিকের নতুন পুঁজি জমা */}
        <div className="bg-white rounded-[22px] p-3.5 border border-[#E2E8F0] shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#64748B]">মালিকের নতুন পুঁজি জমা</span>
            <span className="w-7 h-7 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4" />
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#2E7D32]">
            ৳ {summary.totalNewCapital.toLocaleString()}
          </p>
          <span className="text-[11px] text-[#64748B] block mt-0.5">
            ব্যবসায় যুক্ত নতুন মূলধন
          </span>
        </div>

        {/* 4. বকেয়া উত্তোলন / নিট নেওয়া টাকা */}
        <div className="bg-white rounded-[22px] p-3.5 border-2 border-[#80CBC4] shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-extrabold text-[#102A43]">বকেয়া উত্তোলন (নিট নেওয়া)</span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#E0F2F1] text-[#0E6B6B]">
              নেওয়া − ফেরত
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#102A43]">
            ৳ {summary.netWithdrawal.toLocaleString()}
          </p>
          <span className="text-[11px] text-[#0E6B6B] font-bold block mt-0.5">
            মালিকের কাছে থাকা বাকি উত্তোলন
          </span>
        </div>
      </div>

      {/* 3 Quick Action Buttons for the 3 Owner Transaction Types */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => handleOpenAddModal('withdrawal')}
          className="py-3 px-4 rounded-2xl bg-[#D32F2F] hover:bg-rose-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
          <span>মালিকের ব্যক্তিগত খরচ/নেওয়া (−)</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpenAddModal('withdrawal_return')}
          className="py-3 px-4 rounded-2xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
          <span>নেওয়া টাকা ক্যাশে ফেরত (+)</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpenAddModal('capital_deposit')}
          className="py-3 px-4 rounded-2xl bg-[#2E7D32] hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>মালিকের নতুন পুঁজি জমা (+)</span>
        </button>
      </div>

      {/* Transactions History Card */}
      <div className="bg-white rounded-[24px] p-4 shadow-xs border border-[#E2E8F0] flex-1 min-h-[260px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-[#E2E8F0]">
          <div>
            <h4 className="font-extrabold text-sm sm:text-base text-[#102A43]">
              মালিকের লেনদেনের তালিকা ({filteredTransactions.length}টি)
            </h4>
            <p className="text-xs text-[#64748B]">
              তারিখ (DD-MM-YYYY), ধরন ও বিবরণসহ স্বয়ংক্রিয় হিসাব
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'সব ধরন' },
              { id: 'withdrawal', label: 'মালিকের ব্যক্তিগত খরচ/নেওয়া' },
              { id: 'withdrawal_return', label: 'নেওয়া টাকা ক্যাশে ফেরত' },
              { id: 'capital_deposit', label: 'মালিকের নতুন পুঁজি জমা' },
            ].map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTypeFilter(tf.id as any)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  typeFilter === tf.id
                    ? 'bg-[#0E6B6B] text-white border-[#0E6B6B]'
                    : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:text-[#102A43]'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-[#64748B]">
            <Landmark className="w-11 h-11 mx-auto text-[#9AA5B1] mb-2 stroke-1" />
            <p className="text-sm font-bold text-[#102A43]">
              মালিকের কোনো লেনদেন পাওয়া যায়নি
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              উপরের যেকোনো বাটনে চাপ দিয়ে মালিকের ব্যক্তিগত খরচ/নেওয়া, নেওয়া টাকা ক্যাশে ফেরত বা মালিকের নতুন পুঁজি জমা লিখুন।
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTransactions.map((tx) => {
              const badge = getTypeBadge(tx.type);
              const linkedWithdrawal = tx.linkedWithdrawalId
                ? ownerTransactions.find((w) => w.id === tx.linkedWithdrawalId)
                : undefined;

              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${badge.bg}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#0E6B6B]" />
                        {formatDateDDMMYYYY(tx.date)}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-[#102A43] mt-1.5">
                      {tx.note || badge.label}
                    </p>

                    {linkedWithdrawal && (
                      <p className="text-xs text-[#0E6B6B] font-semibold mt-1 flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>
                          সংশ্লিষ্ট উত্তোলন: ৳{linkedWithdrawal.amount.toLocaleString()} (
                          {formatDateDDMMYYYY(linkedWithdrawal.date)})
                        </span>
                      </p>
                    )}

                    {tx.type === 'withdrawal' && (returnedByWithdrawalMap[tx.id] || 0) > 0 && (
                      <p className="text-xs text-[#2E7D32] font-bold mt-1">
                        ✓ এই নেওয়া টাকা থেকে ক্যাশে ফেরত এসেছে: ৳
                        {(returnedByWithdrawalMap[tx.id] || 0).toLocaleString()} (বাকি: ৳
                        {Math.max(0, tx.amount - (returnedByWithdrawalMap[tx.id] || 0)).toLocaleString()})
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E2E8F0]">
                    <div className="text-left sm:text-right">
                      <span className={`text-lg font-black ${badge.amountColor} block`}>
                        {badge.prefix} ৳ {tx.amount.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-[#64748B] font-semibold">
                        {badge.subLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setTxToDelete(tx)}
                      className="p-2 rounded-xl bg-[#FFEBEE] text-[#D32F2F] hover:bg-rose-200 border border-rose-200 transition cursor-pointer"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Owner Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-5 py-4 bg-[#0E6B6B] text-white flex items-center justify-between">
              <h3 className="font-extrabold text-base">
                {txType === 'withdrawal'
                  ? 'মালিকের ব্যক্তিগত খরচ/নেওয়া'
                  : txType === 'withdrawal_return'
                  ? 'নেওয়া টাকা ক্যাশে ফেরত'
                  : 'মালিকের নতুন পুঁজি জমা'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Transaction Type Selector */}
              <div className="grid grid-cols-3 gap-1.5 bg-[#EDF2F7] p-1 rounded-2xl border border-[#E2E8F0]">
                {[
                  { id: 'withdrawal', label: 'ব্যক্তিগত খরচ/নেওয়া' },
                  { id: 'withdrawal_return', label: 'নেওয়া টাকা ফেরত' },
                  { id: 'capital_deposit', label: 'নতুন পুঁজি জমা' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTxType(opt.id as OwnerTransactionType)}
                    className={`py-2 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                      txType === opt.id
                        ? 'bg-[#0E6B6B] text-white shadow-2xs'
                        : 'text-[#64748B] hover:text-[#102A43]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-extrabold text-[#102A43] mb-1">
                  টাকার পরিমাণ (৳) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="যেমন: 2000"
                  className="w-full px-4 py-3 rounded-2xl bg-[#F8FAFC] border-2 border-[#0E6B6B]/40 text-lg font-black text-[#102A43] focus:outline-none focus:border-[#0E6B6B]"
                />
              </div>

              {/* Optional Link to Previous Withdrawal when returning money */}
              {txType === 'withdrawal_return' && withdrawalList.length > 0 && (
                <div>
                  <label className="block text-xs font-extrabold text-[#102A43] mb-1">
                    কোন নেওয়া টাকা ক্যাশে ফেরত দিচ্ছেন? (ঐচ্ছিক)
                  </label>
                  <select
                    value={linkedWithdrawalId}
                    onChange={(e) => setLinkedWithdrawalId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm font-bold text-[#102A43] focus:outline-none focus:border-[#0E6B6B]"
                  >
                    <option value="">-- সাধারণ ফেরত (মোট বকেয়া উত্তোলন থেকে কমবে) --</option>
                    {withdrawalList.map((w) => {
                      const alreadyRet = returnedByWithdrawalMap[w.id] || 0;
                      const remaining = Math.max(0, w.amount - alreadyRet);
                      return (
                        <option key={w.id} value={w.id}>
                          {formatDateDDMMYYYY(w.date)} — ৳
                          {w.amount.toLocaleString()} ({w.note || 'নেওয়া টাকা'}) [বাকি: ৳
                          {remaining.toLocaleString()}]
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Date Input */}
              <div>
                <label className="block text-xs font-extrabold text-[#102A43] mb-1">
                  তারিখ ({formatDateDDMMYYYY(txDate)})
                </label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm font-bold text-[#102A43]"
                />
              </div>

              {/* Note Input */}
              <div>
                <label className="block text-xs font-extrabold text-[#102A43] mb-1">
                  বিবরণ / নোট
                </label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder={
                    txType === 'withdrawal'
                      ? 'যেমন: বাসার বাজার বা ব্যক্তিগত প্রয়োজনে নেওয়া'
                      : txType === 'withdrawal_return'
                      ? 'যেমন: আগে নেওয়া টাকা ক্যাশে ফেরত'
                      : 'যেমন: দোকানের মালামাল বাড়াতে নতুন পুঁজি জমা'
                  }
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm text-[#102A43]"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-[#EDF2F7] text-[#102A43] font-bold text-xs sm:text-sm cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-extrabold text-xs sm:text-sm shadow-sm cursor-pointer"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl border border-[#E2E8F0] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#102A43]">
                লেনদেনটি মুছে ফেলবেন?
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                ৳{txToDelete.amount.toLocaleString()} ({txToDelete.note}) মুছে যাবে এবং ক্যাশ বাক্স ও মালিকের নিজস্ব টাকার হিসাব স্বয়ংক্রিয়ভাবে সমন্বয় হবে।
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#EDF2F7] text-[#102A43] font-bold text-xs cursor-pointer"
              >
                না, থাকুক
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteOwnerTransaction(txToDelete.id);
                  setTxToDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#D32F2F] hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
