import React, { useState, useMemo, useEffect } from 'react';
import {
  Sale,
  Customer,
  Language,
  Product,
  Expense,
  BulkPurchase,
  PurchaseRecord,
  OwnerTransaction,
} from '../types';
import { playSuccessChime } from '../utils/audio';
import { calculateRunningCapital } from './RunningCapitalCard';
import { DB } from '../storage/db';
import {
  Zap,
  X,
  Clock,
  CheckCircle2,
  User,
  Printer,
  RotateCcw,
  Plus,
  ShoppingBag,
  TrendingUp,
  Landmark,
  Edit3,
  Check,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  products?: Product[];
  customers: Customer[];
  language: Language;
  initialMode?: 'sale' | 'return';
  onSaveQuickSale: (sale: Sale, openReceipt?: boolean, updatedProducts?: Product[]) => void;
  onDeleteSale?: (saleId: string) => void;
  onAddNewCustomer?: (customer: Customer) => void;
  initialStoreCapital?: number;
  onSaveInitialStoreCapital?: (amount: number) => void;
  expenses?: Expense[];
  bulkPurchases?: BulkPurchase[];
  purchases?: PurchaseRecord[];
  ownerTransactions?: OwnerTransaction[];
}

export const QuickSaleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sales,
  products = [],
  customers,
  language,
  initialMode = 'sale',
  onSaveQuickSale,
  onDeleteSale,
  onAddNewCustomer,
  initialStoreCapital = 0,
  onSaveInitialStoreCapital,
  expenses = [],
  bulkPurchases = [],
  purchases = [],
  ownerTransactions = [],
}) => {
  // Active tab inside modal: 'sale' (দ্রুত বিক্রি) | 'return' (পণ্য ফেরত)
  const [activeMode, setActiveMode] = useState<'sale' | 'return'>(initialMode);
  const [isEditingCapital, setIsEditingCapital] = useState(false);
  const [capitalInputVal, setCapitalInputVal] = useState<string>(
    initialStoreCapital > 0 ? String(initialStoreCapital) : ''
  );

  useEffect(() => {
    if (isOpen) {
      setActiveMode(initialMode);
    }
  }, [isOpen, initialMode]);

  // Quick Sale States
  const defaultMargin = DB.getQuickSaleProfitMargin();
  const [amountInput, setAmountInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [profitMode, setProfitMode] = useState<'default' | '10' | '15' | '20' | 'custom' | 'none'>('default');
  const [customProfitInput, setCustomProfitInput] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'due'>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paidAmountForDue, setPaidAmountForDue] = useState<string>('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Product Return States (পণ্য ফেরত)
  const [returnAmountInput, setReturnAmountInput] = useState<string>('');
  const [returnNoteInput, setReturnNoteInput] = useState<string>('');
  const [returnDeductionType, setReturnDeductionType] = useState<
    'sale_and_profit' | 'sale_only' | 'profit_only'
  >('sale_and_profit');
  const [returnProfitMode, setReturnProfitMode] = useState<
    '10' | '15' | '20' | 'custom' | 'none'
  >('10');
  const [returnCustomProfitInput, setReturnCustomProfitInput] = useState<string>('');
  const [selectedReturnProductId, setSelectedReturnProductId] = useState<string>('');
  const [returnQuantityInput, setReturnQuantityInput] = useState<string>('1');

  const [justSavedToast, setJustSavedToast] = useState<string>('');

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

  const todayStr = getLocalDateStr(new Date());

  const todaySales = useMemo(() => {
    return sales.filter((s) => {
      const localD = getLocalDateStr(s.date);
      const rawD = (s.date || '').slice(0, 10);
      return localD === todayStr || rawD === todayStr;
    });
  }, [sales, todayStr]);

  const todayTotalAmount = useMemo(() => {
    return Math.round(todaySales.reduce((sum, s) => sum + (s.grandTotal || 0), 0));
  }, [todaySales]);

  const todayTotalProfit = useMemo(() => {
    return Math.round(
      todaySales.reduce((sum, s) => {
        const isQuick =
          s.items && s.items.some((it) => it.productId === 'quick_sale_entry');
        if (isQuick && (s.profit === undefined || s.profit === 0) && (s.grandTotal || 0) > 0) {
          return sum + Math.round((s.grandTotal || 0) * (defaultMargin / 100));
        }
        return sum + (s.profit || 0);
      }, 0)
    );
  }, [todaySales, defaultMargin]);

  const capitalBreakdown = useMemo(
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

  if (!isOpen) return null;

  // --- Quick Sale Calculations ---
  const numericAmount = Math.max(0, Number(amountInput) || 0);

  const calculatedProfit = (() => {
    if (numericAmount <= 0) return 0;
    if (profitMode === 'default') return Math.round(numericAmount * (defaultMargin / 100));
    if (profitMode === '10') return Math.round(numericAmount * 0.1);
    if (profitMode === '15') return Math.round(numericAmount * 0.15);
    if (profitMode === '20') return Math.round(numericAmount * 0.2);
    if (profitMode === 'custom') return Math.max(0, Number(customProfitInput) || 0);
    return 0;
  })();

  const handleQuickAddAmount = (addVal: number) => {
    const current = Number(amountInput) || 0;
    setAmountInput(String(current + addVal));
  };

  // --- Product Return Calculations ---
  const returnNumericAmount = Math.max(0, Number(returnAmountInput) || 0);
  const returnQty = Math.max(0.01, Number(returnQuantityInput) || 1);

  const calculatedReturnProfit = (() => {
    if (returnNumericAmount <= 0) return 0;
    if (returnDeductionType === 'sale_only') return 0;
    if (returnDeductionType === 'profit_only') return returnNumericAmount;
    // 'sale_and_profit'
    if (returnProfitMode === '10') return Math.round(returnNumericAmount * 0.1);
    if (returnProfitMode === '15') return Math.round(returnNumericAmount * 0.15);
    if (returnProfitMode === '20') return Math.round(returnNumericAmount * 0.2);
    if (returnProfitMode === 'custom') return Math.max(0, Number(returnCustomProfitInput) || 0);
    return 0;
  })();

  const saleDeductionAmount =
    returnDeductionType === 'profit_only' ? 0 : returnNumericAmount;
  const profitDeductionAmount = calculatedReturnProfit;
  const costDeductionAmount = Math.max(0, saleDeductionAmount - profitDeductionAmount);

  const handleQuickAddReturnAmount = (addVal: number) => {
    const current = Number(returnAmountInput) || 0;
    setReturnAmountInput(String(current + addVal));
  };

  const handleSelectReturnProduct = (prodId: string) => {
    setSelectedReturnProductId(prodId);
    if (!prodId) return;
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      const qty = Math.max(1, Number(returnQuantityInput) || 1);
      const totalSell = Math.round(prod.sellPrice * qty);
      const totalProf = Math.max(0, Math.round((prod.sellPrice - prod.costPrice) * qty));
      setReturnAmountInput(String(totalSell));
      setReturnNoteInput(`${prod.name} ফেরত`);
      setReturnDeductionType('sale_and_profit');
      setReturnProfitMode('custom');
      setReturnCustomProfitInput(String(totalProf));
    }
  };

  const handleReturnQuantityChange = (qtyStr: string) => {
    setReturnQuantityInput(qtyStr);
    if (selectedReturnProductId) {
      const prod = products.find((p) => p.id === selectedReturnProductId);
      const qty = Math.max(0, Number(qtyStr) || 0);
      if (prod && qty > 0) {
        const totalSell = Math.round(prod.sellPrice * qty);
        const totalProf = Math.max(0, Math.round((prod.sellPrice - prod.costPrice) * qty));
        setReturnAmountInput(String(totalSell));
        setReturnProfitMode('custom');
        setReturnCustomProfitInput(String(totalProf));
      }
    }
  };

  const handleCreateQuickCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !onAddNewCustomer) return;
    const newCust: Customer = {
      id: `cust_${Date.now()}`,
      name: newCustName.trim(),
      phone: newCustPhone.trim() || '---',
      totalDue: 0,
      createdAt: new Date().toISOString(),
    };
    onAddNewCustomer(newCust);
    setSelectedCustomerId(newCust.id);
    setShowNewCustomerForm(false);
    setNewCustName('');
    setNewCustPhone('');
  };

  const handleSubmitSale = (openReceipt: boolean = false) => {
    if (numericAmount <= 0) {
      alert('অনুগ্রহ করে বিক্রির টাকার পরিমাণ লিখুন!');
      return;
    }

    if (paymentMode === 'due' && !selectedCustomerId) {
      alert('বাকি বিক্রির জন্য একজন কাস্টমার নির্বাচন করুন অথবা "+ নতুন গ্রাহক" যোগ করুন!');
      return;
    }

    const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
    const paidVal =
      paymentMode === 'cash'
        ? numericAmount
        : Math.min(numericAmount, Math.max(0, Number(paidAmountForDue) || 0));
    const dueVal = paymentMode === 'cash' ? 0 : Math.max(0, numericAmount - paidVal);

    const itemTitle = noteInput.trim() || 'খুচরা বিক্রি (সরাসরি হিসাব)';
    const costVal = Math.max(0, numericAmount - calculatedProfit);

    const newSale: Sale = {
      id: `sale_${Date.now()}`,
      invoiceNo: `${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toISOString(),
      items: [
        {
          productId: 'quick_sale_entry',
          productName: itemTitle,
          quantity: 1,
          unit: 'বার' as any,
          unitPrice: numericAmount,
          costPrice: costVal,
          totalPrice: numericAmount,
        },
      ],
      subTotal: numericAmount,
      discount: 0,
      grandTotal: numericAmount,
      totalCost: costVal,
      profit: calculatedProfit,
      paidAmount: paidVal,
      dueAmount: dueVal,
      changeAmount: 0,
      paymentType: dueVal > 0 ? (paidVal > 0 ? 'partial' : 'due') : 'cash',
      customerId: paymentMode === 'due' ? selectedCustomer?.id : undefined,
      customerName:
        paymentMode === 'due' && selectedCustomer
          ? selectedCustomer.name
          : language === 'bn'
          ? 'নগদ গ্রাহক'
          : 'Cash Customer',
      customerPhone: paymentMode === 'due' ? selectedCustomer?.phone : undefined,
    };

    onSaveQuickSale(newSale, openReceipt);
    playSuccessChime();

    setAmountInput('');
    setNoteInput('');
    setPaidAmountForDue('');
    setJustSavedToast(`✅ ৳${numericAmount.toLocaleString()} বিক্রি সফলভাবে জমা হয়েছে!`);
    setTimeout(() => setJustSavedToast(''), 3500);

    if (openReceipt) {
      onClose();
    }
  };

  const handleSubmitReturn = () => {
    if (returnNumericAmount <= 0) {
      alert('অনুগ্রহ করে ফেরত পণ্যের টাকার পরিমাণ লিখুন!');
      return;
    }

    const selectedProd = products.find((p) => p.id === selectedReturnProductId);
    const itemTitle =
      returnNoteInput.trim() ||
      (selectedProd ? `${selectedProd.name} ফেরত` : 'পণ্য ফেরত (হিসাব সমন্বয়)');

    const returnSale: Sale = {
      id: `return_${Date.now()}`,
      invoiceNo: `RET-${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toISOString(),
      items: [
        {
          productId: selectedProd ? selectedProd.id : 'product_return_entry',
          productName: `↩️ পণ্য ফেরত: ${itemTitle}`,
          quantity: selectedProd ? returnQty : 1,
          unit: selectedProd ? selectedProd.unit : ('বার' as any),
          unitPrice: -saleDeductionAmount,
          costPrice: -costDeductionAmount,
          totalPrice: -saleDeductionAmount,
        },
      ],
      subTotal: -saleDeductionAmount,
      discount: 0,
      grandTotal: -saleDeductionAmount,
      totalCost: -costDeductionAmount,
      profit: -profitDeductionAmount,
      paidAmount: -returnNumericAmount,
      dueAmount: 0,
      changeAmount: 0,
      paymentType: 'cash',
      customerName: 'পণ্য ফেরত (রিফান্ড)',
    };

    // If a stock product was selected, restore its stock
    let updatedProducts: Product[] | undefined = undefined;
    if (selectedProd) {
      updatedProducts = products.map((p) => {
        if (p.id === selectedProd.id) {
          return {
            ...p,
            stock: Math.round(((p.stock || 0) + returnQty) * 1000) / 1000,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
    }

    onSaveQuickSale(returnSale, false, updatedProducts);
    playSuccessChime();

    setReturnAmountInput('');
    setReturnNoteInput('');
    setSelectedReturnProductId('');
    setReturnQuantityInput('1');
    setReturnCustomProfitInput('');

    const parts: string[] = [];
    if (saleDeductionAmount > 0) parts.push(`বিক্রি থেকে ৳${saleDeductionAmount.toLocaleString()}`);
    if (profitDeductionAmount > 0) parts.push(`লাভ থেকে ৳${profitDeductionAmount.toLocaleString()}`);
    setJustSavedToast(
      `✅ পণ্য ফেরত সফল! মূল ড্যাশবোর্ডের ${parts.join(' ও ')} কেটে নেওয়া হয়েছে।`
    );
    setTimeout(() => setJustSavedToast(''), 4000);
  };

  const quickNotes = [
    'খুচরা বিক্রি',
    'মুদি মাল',
    'চা ও নাস্তা',
    'কাঁচা বাজার',
    'কসমেটিক্স',
    'অন্যান্য',
  ];

  const quickReturnNotes = [
    'পণ্য ফেরত',
    'খুচরা মাল ফেরত',
    'নষ্ট/মেয়াদোত্তীর্ণ পণ্য',
    'ভুল পণ্য পরিবর্তন',
    'কাস্টমার ফেরত দিয়েছে',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[94dvh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden">
        {/* ১. স্লিম টপ বার (Compact Header) */}
        <div
          className={`px-3 py-2 text-white flex items-center justify-between gap-2 shrink-0 transition-colors ${
            activeMode === 'return'
              ? 'bg-gradient-to-r from-[#D32F2F] to-[#9A0007]'
              : 'bg-gradient-to-r from-[#0E6B6B] to-[#094747]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-black shadow-2xs shrink-0 ${
                activeMode === 'return'
                  ? 'bg-white text-[#D32F2F]'
                  : 'bg-amber-400 text-slate-950'
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-xs sm:text-sm leading-tight truncate">
                {activeMode === 'return'
                  ? 'পণ্য ফেরত ও হিসাব সমন্বয়'
                  : 'দ্রুত বিক্রি ও পণ্য ফেরত'}
              </h3>
              <p className="text-[10px] text-white/90 truncate whitespace-nowrap leading-tight">
                {activeMode === 'return'
                  ? 'পণ্য ফেরত নিলে মূল ড্যাশবোর্ডের বিক্রি ও লাভ থেকে অটো টাকা কেটে যাবে'
                  : 'পণ্য অ্যাড বা স্ক্যান ছাড়াই সরাসরি বিক্রি ও ফেরতের হিসাব রাখুন'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* কমপ্যাক্ট ট্যাব সুইচার: দ্রুত বিক্রি vs পণ্য ফেরত (তীর চিহ্ন ছাড়া) */}
        <div className="px-2.5 py-1.5 bg-[#F8FAFC] border-b border-[#E2E8F0] grid grid-cols-2 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveMode('sale');
              setJustSavedToast('');
            }}
            className={`py-1.5 px-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 transition cursor-pointer border ${
              activeMode === 'sale'
                ? 'bg-[#0E6B6B] text-white border-[#0E6B6B] shadow-2xs'
                : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#102A43]'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>দ্রুত বিক্রি</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('return');
              setJustSavedToast('');
            }}
            className={`py-1.5 px-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 transition cursor-pointer border ${
              activeMode === 'return'
                ? 'bg-[#D32F2F] text-white border-[#D32F2F] shadow-2xs'
                : 'bg-white text-[#D32F2F] border-rose-200 hover:bg-rose-50'
            }`}
          >
            <span>পণ্য ফেরত</span>
          </button>
        </div>

        {/* ২. আজকের হিসাব ও চলমান পুঁজি বার (Virtual Goods Capital + Drawer Cash + Profit + Total Capital) */}
        <div className="px-2.5 py-1.5 bg-[#E0F2F1] border-b border-[#B2DFDB] shrink-0 space-y-1">
          <div className="flex items-center justify-between gap-1.5 text-[11px] flex-wrap">
            <div className="flex items-center gap-1 min-w-0">
              <ShoppingBag className="w-3 h-3 text-[#0E6B6B] shrink-0" />
              <span className="font-bold text-[#102A43] truncate">আজকের বিক্রি:</span>
              <span className="font-black text-[#0E6B6B] tabular-nums">
                ৳{todayTotalAmount.toLocaleString('bn-BD')}
              </span>
            </div>

            <div className="flex items-center gap-1 min-w-0">
              <TrendingUp className="w-3 h-3 text-[#2E7D32] shrink-0" />
              <span className="font-bold text-[#102A43] truncate">লাভ:</span>
              <span
                className={`font-black tabular-nums ${
                  todayTotalProfit >= 0 ? 'text-[#2E7D32]' : 'text-[#D32F2F]'
                }`}
              >
                ৳{todayTotalProfit.toLocaleString('bn-BD')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setCapitalInputVal(
                  initialStoreCapital > 0 ? String(initialStoreCapital) : ''
                );
                setIsEditingCapital(!isEditingCapital);
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/80 hover:bg-white border border-[#80CBC4] cursor-pointer transition shrink-0"
              title="শুরুর মালের পুঁজি সেট বা এডিট করতে ট্যাপ করুন"
            >
              <Landmark className="w-3 h-3 text-[#0E6B6B]" />
              <span className="font-bold text-[#102A43]">শুরুর পুঁজি:</span>
              <span className="font-black text-[#0E6B6B] tabular-nums">
                ৳{capitalBreakdown.initialCapital.toLocaleString('bn-BD')}
              </span>
              <Edit3 className="w-2.5 h-2.5 text-[#0E6B6B]" />
            </button>
          </div>

          <div className="px-2 py-1 rounded-lg bg-white/85 border border-[#B2DFDB] text-[10.5px] font-extrabold text-[#102A43] leading-snug">
            মূল মালের পুঁজি: <span className="text-[#0E6B6B]">৳{capitalBreakdown.remainingGoodsCapital.toLocaleString('bn-BD')}</span> | ক্যাশ বাক্সে নগদ: <span className="text-[#0E6B6B]">৳{capitalBreakdown.drawerCash.toLocaleString('bn-BD')}</span> | লাভ: <span className="text-[#2E7D32]">৳{capitalBreakdown.displayProfit.toLocaleString('bn-BD')}</span> | মোট পুঁজি: <span className="text-[#0E6B6B]">৳{capitalBreakdown.currentRunningCapital.toLocaleString('bn-BD')}</span>
          </div>

          {isEditingCapital && onSaveInitialStoreCapital && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = Math.max(0, Math.round(Number(capitalInputVal) || 0));
                onSaveInitialStoreCapital(val);
                playSuccessChime();
                setIsEditingCapital(false);
              }}
              className="mt-1 pt-1 border-t border-[#B2DFDB] flex items-center justify-between gap-1.5"
            >
              <span className="text-[10.5px] font-extrabold text-[#102A43] whitespace-nowrap">
                শুরুর মালের পুঁজি (৳):
              </span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={capitalInputVal}
                onChange={(e) => setCapitalInputVal(e.target.value)}
                placeholder="যেমন: 10000"
                className="flex-1 px-2 py-0.5 rounded-lg bg-white border border-[#0E6B6B] text-xs font-black text-[#102A43] focus:outline-none"
              />
              <button
                type="submit"
                className="px-2 py-0.5 rounded-lg bg-[#0E6B6B] text-white text-[10.5px] font-extrabold flex items-center gap-0.5 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>সেভ</span>
              </button>
            </form>
          )}
        </div>

        {/* Compact Body */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {justSavedToast && (
            <div className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-between shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{justSavedToast}</span>
              </div>
            </div>
          )}

          {activeMode === 'sale' ? (
            <>
              {/* ================= QUICK SALE FORM (COMPACT) ================= */}
              {/* ৩. টাকার ইনপুট ও কুইক বাটন (Amount & Quick Chips) */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#0E6B6B]/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-[#102A43] leading-none">
                    ১. কত টাকা বিক্রি করলেন? (৳) *
                  </label>
                  {amountInput && (
                    <button
                      type="button"
                      onClick={() => setAmountInput('')}
                      className="text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer leading-none"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>মুছুন</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-black text-[#0E6B6B]">
                    ৳
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    autoFocus
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmitSale(false);
                      }
                    }}
                    placeholder="০"
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border-2 border-[#0E6B6B] text-xl font-black text-[#102A43] placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]/20"
                  />
                </div>

                {/* Compact 7-Column Quick Amount Grid */}
                <div className="grid grid-cols-7 gap-1 pt-0.5">
                  {[10, 20, 50, 100, 200, 500, 1000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAddAmount(val)}
                      className="py-1 px-0.5 rounded-lg bg-white hover:bg-[#E0F2F1] text-[#0E6B6B] font-extrabold text-[10px] border border-[#B2DFDB] shadow-2xs active:scale-95 transition cursor-pointer text-center whitespace-nowrap"
                    >
                      +৳{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* ৪. বিবরণ ফিল্ড (নিচের ট্যাগ চিপস ছাড়া স্লিম ইনপুট) */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold text-[#102A43] leading-none">
                  ২. কী বিক্রি করলেন / বিবরণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="যেমন: খুচরা বিক্রি, মুদি মাল, চা-বিস্কুট..."
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#102A43] focus:outline-none focus:border-[#0E6B6B] focus:bg-white"
                />
              </div>

              {/* ৫. বিক্রির ধরন (Compact Segmented Buttons) */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold text-[#102A43] leading-none">
                  ৩. বিক্রির ধরন (নগদ নাকি বাকি?)
                </label>
                <div className="p-0.5 bg-[#F1F5F9] rounded-xl grid grid-cols-2 gap-1 border border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('cash')}
                    className={`py-1.5 px-2 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                      paymentMode === 'cash'
                        ? 'bg-[#2E7D32] text-white shadow-2xs'
                        : 'text-[#64748B] hover:text-[#102A43]'
                    }`}
                  >
                    <span>💵 নগদ বিক্রি</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('due')}
                    className={`py-1.5 px-2 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                      paymentMode === 'due'
                        ? 'bg-[#D32F2F] text-white shadow-2xs'
                        : 'text-[#64748B] hover:text-[#102A43]'
                    }`}
                  >
                    <span>📒 বাকি বিক্রি</span>
                  </button>
                </div>

                {paymentMode === 'due' && (
                  <div className="p-2 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1.5 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#102A43] flex items-center gap-1">
                        <User className="w-3 h-3 text-[#D32F2F]" />
                        <span>বাকি খাতার গ্রাহক নির্বাচন করুন *</span>
                      </span>
                      {onAddNewCustomer && (
                        <button
                          type="button"
                          onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                          className="text-[11px] font-extrabold text-[#0E6B6B] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>নতুন গ্রাহক</span>
                        </button>
                      )}
                    </div>

                    {showNewCustomerForm ? (
                      <div className="p-2 rounded-lg bg-white border border-[#E2E8F0] space-y-1.5">
                        <input
                          type="text"
                          value={newCustName}
                          onChange={(e) => setNewCustName(e.target.value)}
                          placeholder="গ্রাহকের নাম লিখুন"
                          className="w-full px-2.5 py-1 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
                        />
                        <input
                          type="tel"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          placeholder="মোবাইল নম্বর (ঐচ্ছিক)"
                          className="w-full px-2.5 py-1 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setShowNewCustomerForm(false)}
                            className="flex-1 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600"
                          >
                            বাতিল
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateQuickCustomer}
                            className="flex-1 py-1 rounded-lg bg-[#0E6B6B] text-white text-[11px] font-bold"
                          >
                            গ্রাহক সেভ করুন
                          </button>
                        </div>
                      </div>
                    ) : (
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-bold text-[#102A43]"
                      >
                        <option value="">-- গ্রাহক নির্বাচন করুন --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone}) {c.totalDue > 0 ? `[পূর্বের বাকি: ৳${c.totalDue}]` : ''}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#102A43]">নগদ জমা দিয়েছে (থাকলে):</span>
                      <input
                        type="number"
                        min="0"
                        value={paidAmountForDue}
                        onChange={(e) => setPaidAmountForDue(e.target.value)}
                        placeholder="০"
                        className="w-24 px-2 py-1 rounded-lg bg-white border border-rose-200 text-right font-bold text-xs text-[#102A43]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ৪. লাভের হিসাব (এক লাইনে সাজানো কমপ্যাক্ট চিপস) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-[#102A43] flex items-center gap-1 leading-none">
                    <TrendingUp className="w-3 h-3 text-[#2E7D32]" />
                    <span>৪. লাভের হিসাব (ঐচ্ছিক)</span>
                  </label>
                  {calculatedProfit > 0 && (
                    <span className="text-[11px] font-black text-[#2E7D32] leading-none">
                      লাভ: +৳{calculatedProfit}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { id: 'default', label: `ডিফল্ট (${defaultMargin}%)` },
                    { id: '10', label: '১০% লাভ' },
                    { id: '15', label: '১৫% লাভ' },
                    { id: '20', label: '২০% লাভ' },
                    { id: 'custom', label: 'নিজে লিখুন' },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setProfitMode(pm.id as any)}
                      className={`py-1 px-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer text-center whitespace-nowrap truncate ${
                        profitMode === pm.id
                          ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                          : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-emerald-50'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
                {profitMode === 'custom' && (
                  <div className="pt-0.5">
                    <input
                      type="number"
                      min="0"
                      value={customProfitInput}
                      onChange={(e) => setCustomProfitInput(e.target.value)}
                      placeholder="এই বিক্রিতে কত টাকা লাভ হয়েছে লিখুন (৳)"
                      className="w-full px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#102A43]"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* ================= PRODUCT RETURN FORM (COMPACT পণ্য ফেরত) ================= */}
              {/* ১. ফেরতের টাকার ইনপুট ও কুইক বাটন */}
              <div className="p-2.5 rounded-xl bg-[#FFF5F5] border border-[#D32F2F]/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-[#102A43] leading-none">
                    ১. কত টাকার পণ্য ফেরত নিলেন? (৳) *
                  </label>
                  {returnAmountInput && (
                    <button
                      type="button"
                      onClick={() => setReturnAmountInput('')}
                      className="text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer leading-none"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>মুছুন</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-black text-[#D32F2F]">
                    ৳
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    autoFocus
                    value={returnAmountInput}
                    onChange={(e) => setReturnAmountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmitReturn();
                      }
                    }}
                    placeholder="০"
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border-2 border-[#D32F2F] text-xl font-black text-[#102A43] placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#D32F2F]/20"
                  />
                </div>

                {/* Compact 7-Column Quick Return Amount Grid */}
                <div className="grid grid-cols-7 gap-1 pt-0.5">
                  {[10, 20, 50, 100, 200, 500, 1000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAddReturnAmount(val)}
                      className="py-1 px-0.5 rounded-lg bg-white hover:bg-rose-100 text-[#D32F2F] font-extrabold text-[10px] border border-rose-200 shadow-2xs active:scale-95 transition cursor-pointer text-center whitespace-nowrap"
                    >
                      +৳{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* ২. কোন হিসাব থেকে টাকা কাটবে ও লাভের হার */}
              <div className="space-y-1.5 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <label className="block text-[11px] font-extrabold text-[#102A43] leading-none">
                  ২. মূল ড্যাশবোর্ডের কোন হিসাব থেকে টাকা কাটবে?
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setReturnDeductionType('sale_and_profit')}
                    className={`py-1.5 px-1.5 rounded-lg font-extrabold text-[10.5px] border transition cursor-pointer text-center whitespace-nowrap truncate ${
                      returnDeductionType === 'sale_and_profit'
                        ? 'bg-[#D32F2F] text-white border-[#D32F2F] shadow-2xs'
                        : 'bg-white text-[#102A43] border-[#E2E8F0]'
                    }`}
                  >
                    বিক্রয় ও লাভ
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnDeductionType('sale_only')}
                    className={`py-1.5 px-1.5 rounded-lg font-extrabold text-[10.5px] border transition cursor-pointer text-center whitespace-nowrap truncate ${
                      returnDeductionType === 'sale_only'
                        ? 'bg-[#D32F2F] text-white border-[#D32F2F] shadow-2xs'
                        : 'bg-white text-[#102A43] border-[#E2E8F0]'
                    }`}
                  >
                    শুধু বিক্রয় থেকে
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnDeductionType('profit_only')}
                    className={`py-1.5 px-1.5 rounded-lg font-extrabold text-[10.5px] border transition cursor-pointer text-center whitespace-nowrap truncate ${
                      returnDeductionType === 'profit_only'
                        ? 'bg-[#D32F2F] text-white border-[#D32F2F] shadow-2xs'
                        : 'bg-white text-[#102A43] border-[#E2E8F0]'
                    }`}
                  >
                    শুধু লাভ থেকে
                  </button>
                </div>

                {returnDeductionType === 'sale_and_profit' && (
                  <div className="pt-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-[#64748B]">
                        ফেরত পণ্যে লাভের হার (লাভ থেকে কাটবে):
                      </span>
                      {profitDeductionAmount > 0 && (
                        <span className="text-[11px] font-black text-[#D32F2F]">
                          লাভ কমবে: -৳{profitDeductionAmount}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        { id: '10', label: '১০% লাভ' },
                        { id: '15', label: '১৫% লাভ' },
                        { id: '20', label: '২০% লাভ' },
                        { id: 'custom', label: 'নিজে লিখুন' },
                        { id: 'none', label: '৳০ লাভ' },
                      ].map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setReturnProfitMode(pm.id as any)}
                          className={`py-1 px-1 rounded-lg text-[10px] font-bold border transition cursor-pointer text-center whitespace-nowrap truncate ${
                            returnProfitMode === pm.id
                              ? 'bg-[#102A43] text-white border-[#102A43]'
                              : 'bg-white text-[#64748B] border-[#E2E8F0]'
                          }`}
                        >
                          {pm.label}
                        </button>
                      ))}
                    </div>
                    {returnProfitMode === 'custom' && (
                      <div className="pt-0.5">
                        <input
                          type="number"
                          min="0"
                          value={returnCustomProfitInput}
                          onChange={(e) => setReturnCustomProfitInput(e.target.value)}
                          placeholder="লাভ থেকে কত টাকা কাটবে লিখুন (৳)"
                          className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-rose-300 text-xs font-bold text-[#102A43]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {returnNumericAmount > 0 && (
                  <div className="p-1.5 rounded-lg bg-white border border-rose-200 flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-bold text-[#64748B]">বিক্রয় কমবে: </span>
                      <span className="font-black text-[#D32F2F]">
                        -৳{saleDeductionAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#64748B]">লাভ কমবে: </span>
                      <span className="font-black text-[#D32F2F]">
                        -৳{profitDeductionAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ৩. স্টকের পণ্য সিলেক্ট ও বিবরণ (ট্যাগ চিপস ছাড়া স্লিম ইনপুট) */}
              <div className="space-y-1.5">
                {products.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectedReturnProductId}
                      onChange={(e) => handleSelectReturnProduct(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#102A43]"
                    >
                      <option value="">-- স্টকের পণ্য হলে সিলেক্ট করুন (ঐচ্ছিক) --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (বিক্রয়: ৳{p.sellPrice}, লাভ: ৳
                          {Math.max(0, p.sellPrice - p.costPrice)})
                        </option>
                      ))}
                    </select>
                    {selectedReturnProductId && (
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={returnQuantityInput}
                        onChange={(e) => handleReturnQuantityChange(e.target.value)}
                        placeholder="পরিমাণ"
                        className="w-16 px-2 py-1.5 rounded-xl bg-white border border-[#0E6B6B] text-xs font-black text-center text-[#102A43]"
                        title="ফেরত পণ্যের পরিমাণ"
                      />
                    )}
                  </div>
                )}

                <input
                  type="text"
                  value={returnNoteInput}
                  onChange={(e) => setReturnNoteInput(e.target.value)}
                  placeholder="ফেরতের কারণ বা পণ্যের নাম (ঐচ্ছিক)..."
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#102A43] focus:outline-none focus:border-[#D32F2F] focus:bg-white"
                />
              </div>
            </>
          )}

          {/* আজকের বিক্রি ও ফেরত লগ (কমপ্যাক্ট ভিউ) */}
          {todaySales.length > 0 && (
            <details className="pt-1 border-t border-[#E2E8F0] group">
              <summary className="flex items-center justify-between cursor-pointer list-none py-1 text-[11px] font-extrabold text-[#102A43]">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#0E6B6B]" />
                  <span>
                    {activeMode === 'return'
                      ? `আজকের বিক্রি থেকে ১ ক্লিকে ফেরত নিন (${todaySales.length}টি) ▾`
                      : `আজকের বিক্রির তালিকা দেখুন (${todaySales.length}টি) ▾`}
                  </span>
                </span>
                <span className="text-[11px] font-black text-[#0E6B6B]">
                  নিট: ৳{todayTotalAmount.toLocaleString()}
                </span>
              </summary>
              <div className="max-h-28 overflow-y-auto space-y-1 pt-1 pr-0.5">
                {todaySales
                  .slice()
                  .reverse()
                  .slice(0, 10)
                  .map((s) => {
                    const isReturnRecord =
                      s.id.startsWith('return_') || s.grandTotal < 0 || (s.profit || 0) < 0;
                    return (
                      <div
                        key={s.id}
                        className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-[11px] ${
                          isReturnRecord
                            ? 'bg-rose-50/70 border-rose-200'
                            : 'bg-[#F8FAFC] border-[#E2E8F0]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span
                            className={`font-bold truncate block ${
                              isReturnRecord ? 'text-[#D32F2F]' : 'text-[#102A43]'
                            }`}
                          >
                            {s.items.map((i) => i.productName).join(', ')}
                          </span>
                          <span className="text-[9.5px] text-[#64748B]">
                            {new Date(s.date).toLocaleTimeString('bn-BD', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            •{' '}
                            {isReturnRecord
                              ? `লাভ কর্তন: -৳${Math.abs(Math.round(s.profit || 0))}`
                              : `লাভ: +৳${Math.round(s.profit || 0)}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`font-black text-xs ${
                              isReturnRecord ? 'text-[#D32F2F]' : 'text-[#0E6B6B]'
                            }`}
                          >
                            {isReturnRecord
                              ? `-৳${Math.abs(s.grandTotal || s.profit || 0).toLocaleString()}`
                              : `৳${s.grandTotal.toLocaleString()}`}
                          </span>
                          {activeMode === 'return' && !isReturnRecord && onDeleteSale && (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteSale(s.id);
                                playSuccessChime();
                                setJustSavedToast(
                                  `✅ ৳${s.grandTotal.toLocaleString()} টাকার বিক্রি ফেরত নেওয়া হয়েছে!`
                                );
                                setTimeout(() => setJustSavedToast(''), 4000);
                              }}
                              className="px-2 py-0.5 rounded-md bg-[#D32F2F] hover:bg-rose-800 text-white font-extrabold text-[10px] cursor-pointer transition active:scale-95"
                              title="এই বিক্রিটি পুরোপুরি ফেরত নিন"
                            >
                              ফেরত নিন
                            </button>
                          )}
                          {activeMode === 'sale' && onDeleteSale && (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteSale(s.id);
                                playSuccessChime();
                                setJustSavedToast(
                                  isReturnRecord
                                    ? '✅ পণ্য ফেরতের এন্ট্রিটি মুছে ফেলা হয়েছে!'
                                    : `✅ ৳${s.grandTotal.toLocaleString()} টাকার মেমো ডিলিট করা হয়েছে!`
                                );
                                setTimeout(() => setJustSavedToast(''), 3500);
                              }}
                              className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-[#D32F2F] text-[#D32F2F] hover:text-white border border-rose-200 font-extrabold text-[10px] cursor-pointer transition active:scale-95"
                              title="এই মেমো ডিলিট করুন"
                            >
                              মুছুন
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </details>
          )}
        </div>

        {/* ৬. ফিক্সড সাবমিট অ্যাকশন বার (Compact Fixed Bottom Bar) */}
        <div className="px-3 py-2 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center gap-2 shrink-0">
          {activeMode === 'sale' ? (
            <>
              <button
                type="button"
                disabled={numericAmount <= 0}
                onClick={() => handleSubmitSale(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  বিক্রি জমা করুন {numericAmount > 0 ? `(৳${numericAmount.toLocaleString()})` : ''}
                </span>
              </button>

              <button
                type="button"
                disabled={numericAmount <= 0}
                onClick={() => handleSubmitSale(true)}
                className="py-2.5 px-3 rounded-xl bg-white hover:bg-[#E0F2F1] disabled:opacity-50 text-[#0E6B6B] border border-[#0E6B6B] font-extrabold text-xs flex items-center justify-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
                title="বিক্রি জমা করে রসিদ প্রিন্ট করুন"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>রসিদসহ</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={returnNumericAmount <= 0}
              onClick={handleSubmitReturn}
              className="w-full py-2.5 px-3 rounded-xl bg-[#D32F2F] hover:bg-rose-800 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <span>
                পণ্য ফেরত সংরক্ষণ করুন{' '}
                {returnNumericAmount > 0 ? `(-৳${returnNumericAmount.toLocaleString()})` : ''}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
