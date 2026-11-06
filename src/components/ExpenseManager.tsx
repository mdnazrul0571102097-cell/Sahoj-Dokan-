import React, { useState, useMemo } from 'react';
import { Expense, ExpenseCategory, ShopProfile, Language } from '../types';
import { translations } from '../i18n/translations';
import { playSuccessChime } from '../utils/audio';
import {
  Wallet,
  Plus,
  X,
  Trash2,
  DollarSign,
  Zap,
  Truck,
  Coffee,
  Package,
  Wrench,
  HelpCircle,
  Building,
} from 'lucide-react';

interface Props {
  expenses: Expense[];
  profile: ShopProfile;
  language: Language;
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
}

const EXPENSE_CATEGORIES: {
  id: ExpenseCategory;
  name: string;
  icon: any;
}[] = [
  { id: 'transport', name: 'পরিবহন ও ভাড়া', icon: Truck },
  { id: 'food', name: 'আপ্যায়ন ও চা-নাস্তা', icon: Coffee },
  { id: 'packaging', name: 'পলিথিন ও প্যাকিং ব্যাগ', icon: Package },
  { id: 'electricity', name: 'বিদ্যুৎ ও পানির বিল', icon: Zap },
  { id: 'rent', name: 'দোকান ভাড়া', icon: Building },
  { id: 'salary', name: 'কর্মচারীর বেতন', icon: DollarSign },
  { id: 'maintenance', name: 'মেরামত ও রক্ষণাবেক্ষণ', icon: Wrench },
  { id: 'other', name: 'অন্যান্য বিবিধ খরচ', icon: HelpCircle },
];

export const ExpenseManager: React.FC<Props> = ({
  expenses,
  profile,
  language,
  onAddExpense,
  onDeleteExpense,
}) => {
  const t = translations[language];

  // Helper for reliable local calendar date matching
  const getLocalDateStr = (d?: string | Date): string => {
    if (!d) return '';
    try {
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

  // Date filters
  const todayStr = getLocalDateStr(new Date());
  const [filterMode, setFilterMode] = useState<'today' | 'yesterday' | 'month' | 'all'>('today');
  const [showAddModal, setShowAddModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Form states
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>('transport');
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank'>('cash');

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const yesterdayStr = getLocalDateStr(yesterday);

    const matched = expenses
      .filter((exp) => {
        const expLocal = getLocalDateStr(exp.date);
        const expRaw = (exp.date || '').slice(0, 10);
        const createdLocal = getLocalDateStr(exp.createdAt);
        if (filterMode === 'today')
          return expLocal === todayStr || expRaw === todayStr || createdLocal === todayStr;
        if (filterMode === 'yesterday')
          return expLocal === yesterdayStr || expRaw === yesterdayStr || createdLocal === yesterdayStr;
        if (filterMode === 'month')
          return (
            (exp.date || '').startsWith(currentYearMonth) ||
            expLocal.startsWith(currentYearMonth)
          );
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (filterMode === 'today' && matched.length === 0 && expenses.length > 0) {
      return [...expenses].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }
    return matched;
  }, [expenses, filterMode, todayStr]);

  // Statistics
  const todayTotal = useMemo(() => {
    const todayMatched = expenses.filter((e) => {
      const expLocal = getLocalDateStr(e.date);
      const expRaw = (e.date || '').slice(0, 10);
      const createdLocal = getLocalDateStr(e.createdAt);
      return expLocal === todayStr || expRaw === todayStr || createdLocal === todayStr;
    });
    const listToSum =
      todayMatched.length === 0 && expenses.length > 0 ? expenses : todayMatched;
    return Math.round(listToSum.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
  }, [expenses, todayStr]);

  const monthTotal = useMemo(() => {
    const currentYearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return Math.round(
      expenses
        .filter(
          (e) =>
            (e.date || '').startsWith(currentYearMonth) ||
            getLocalDateStr(e.date).startsWith(currentYearMonth)
        )
        .reduce((sum, e) => sum + e.amount, 0)
    );
  }, [expenses]);

  const filteredTotal = useMemo(() => {
    return Math.round(filteredExpenses.reduce((sum, e) => sum + e.amount, 0));
  }, [filteredExpenses]);

  // Handle Add Expense Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return;

    const catObj = EXPENSE_CATEGORIES.find((c) => c.id === selectedCategory);

    let formattedExpenseDate = new Date().toISOString();
    if (expenseDate && expenseDate !== todayStr) {
      try {
        const [y, m, d] = expenseDate.split('-').map(Number);
        const dt = new Date();
        dt.setFullYear(y, m - 1, d);
        formattedExpenseDate = dt.toISOString();
      } catch (_) {
        formattedExpenseDate = new Date(expenseDate).toISOString();
      }
    }

    const newExpense: Expense = {
      id: `exp_${Date.now()}`,
      date: formattedExpenseDate,
      category: selectedCategory,
      categoryName: catObj ? catObj.name : 'বিবিধ খরচ',
      amount: numAmount,
      note: note.trim() || undefined,
      paymentMethod,
      createdAt: new Date().toISOString(),
    };

    onAddExpense(newExpense);
    setAmount('');
    setNote('');
    setShowAddModal(false);
    playSuccessChime();
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Main Summary Card matching Customer Baki Khata */}
      <div className="bg-white rounded-[24px] p-4 shadow-sm border border-[#E2E8F0] mb-3 shrink-0">
        <div className="grid grid-cols-2 divide-x divide-[#E2E8F0] mb-3.5">
          {/* Left: আজকের মোট দোকান খরচ */}
          <div className="text-center pr-2">
            <p className="text-xs font-semibold text-[#64748B] mb-1">
              আজকের মোট দোকান খরচ
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-[#D32F2F] tracking-tight">
              ৳ {todayTotal.toLocaleString()}
            </p>
          </div>

          {/* Right: চলতি মাসের মোট খরচ */}
          <div className="text-center pl-2">
            <p className="text-xs font-semibold text-[#64748B] mb-1">
              চলতি মাসের মোট খরচ
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-[#102A43] tracking-tight">
              ৳ {monthTotal.toLocaleString()}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="w-full py-2.5 px-4 rounded-2xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>নতুন খরচ লিখুন</span>
        </button>
      </div>

      {/* Filters and Subtotal Bar */}
      <div className="bg-white rounded-[24px] p-4 shadow-xs border border-[#E2E8F0] flex-1 flex flex-col min-h-[300px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'today', label: 'আজকের খরচ' },
              { id: 'yesterday', label: 'গতকালের খরচ' },
              { id: 'month', label: 'চলতি মাস' },
              { id: 'all', label: 'সব খরচ' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterMode(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                  filterMode === f.id
                    ? 'bg-[#0E6B6B] text-white border-[#0E6B6B] shadow-2xs'
                    : 'bg-[#EDF2F7] text-[#64748B] border-[#E2E8F0] hover:bg-[#E0F2F1] hover:text-[#0E6B6B]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="text-right text-xs font-bold text-[#64748B]">
            ফিল্টারকৃত মোট খরচ:{' '}
            <span className="font-mono text-[#D32F2F] text-sm font-black">
              ৳{filteredTotal.toLocaleString()}
            </span>{' '}
            ({filteredExpenses.length}টি এন্ট্রি)
          </div>
        </div>

        {/* Expenses List */}
        <div className="space-y-2.5">
          {filteredExpenses.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-6 text-[#64748B]">
              <Wallet className="w-12 h-12 text-[#9AA5B1] mb-2 stroke-1" />
              <p className="text-xs sm:text-sm font-bold text-[#102A43]">
                এই সময়ে কোনো খরচের হিসাব রেকর্ড নেই
              </p>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="mt-3 px-4 py-2 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                + এখনই খরচ যুক্ত করুন
              </button>
            </div>
          ) : (
            filteredExpenses.map((exp) => {
              const catObj =
                EXPENSE_CATEGORIES.find((c) => c.id === exp.category) ||
                EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
              const Icon = catObj.icon;

              return (
                <div
                  key={exp.id}
                  className="p-3.5 rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#0E6B6B] flex items-center justify-between gap-3 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-[#E0F2F1] text-[#0E6B6B] flex items-center justify-center shrink-0 border border-[#B2DFDB]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm sm:text-base text-[#102A43] truncate">
                          {exp.categoryName}
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#E3F2FD] text-[#1976D2] font-bold uppercase">
                          {exp.paymentMethod}
                        </span>
                      </div>
                      {exp.note && (
                        <p className="text-xs text-[#64748B] mt-0.5 truncate max-w-sm">
                          {exp.note}
                        </p>
                      )}
                      <span className="text-[11px] text-[#64748B] mt-0.5 block font-mono">
                        {new Date(exp.date).toLocaleDateString('bn-BD', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div className="text-sm sm:text-base font-black font-mono text-[#D32F2F]">
                        -৳{exp.amount.toLocaleString()}
                      </div>
                      <span className="text-[10px] font-semibold text-[#64748B]">খরচ হিসাব</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpenseToDelete(exp)}
                      className="p-2 rounded-xl bg-[#FFEBEE] text-[#D32F2F] hover:bg-rose-200 transition cursor-pointer"
                      title="খরচ মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Expense Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl border border-[#E2E8F0] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#102A43]">
                খরচের রেকর্ডটি মুছে ফেলবেন?
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                <strong className="text-[#102A43]">{expenseToDelete.categoryName}</strong> (৳{expenseToDelete.amount}) হিসাব থেকে মুছে যাবে।
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-[#102A43] text-xs font-bold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteExpense(expenseToDelete.id);
                  setExpenseToDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Expense */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 bg-[#0E6B6B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">দোকানের দৈনন্দিন খরচ লিখুন</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-4 space-y-3.5">
              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1.5">
                  খরচের খাত নির্বাচন করুন *
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                          isSelected
                            ? 'border-[#0E6B6B] bg-[#E0F2F1] text-[#0E6B6B] font-bold ring-2 ring-[#0E6B6B]/20'
                            : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] hover:bg-[#EDF2F7]'
                        }`}
                      >
                        <div className="p-1.5 rounded-lg bg-white text-[#0E6B6B] border border-[#E2E8F0]">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs truncate">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  খরচের পরিমাণ (৳) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[#D32F2F] font-bold text-sm">৳</span>
                  <input
                    type="number"
                    required
                    min="1"
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                    placeholder="কত টাকা খরচ হয়েছে"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm font-black text-[#102A43] font-mono focus:ring-2 focus:ring-[#0E6B6B] focus:outline-none"
                  />
                </div>
              </div>

              {/* Date & Payment Method */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    তারিখ
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#102A43] focus:ring-2 focus:ring-[#0E6B6B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    মাধ্যম
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#102A43] focus:ring-2 focus:ring-[#0E6B6B] focus:outline-none"
                  >
                    <option value="cash">নগদ ক্যাশ</option>
                    <option value="bkash">বিকাশ</option>
                    <option value="nagad">নগদ</option>
                    <option value="bank">ব্যাংক</option>
                  </select>
                </div>
              </div>

              {/* Note / Details */}
              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  বিস্তারিত বিবরণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="যেমন: মৌলভীবাজার থেকে মালামাল ভ্যান ভাড়া"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#102A43] placeholder-[#9AA5B1] focus:ring-2 focus:ring-[#0E6B6B] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-xs font-bold text-[#102A43] cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                >
                  খরচ সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
