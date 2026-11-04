import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Customer, Language, Product } from '../types';
import { playSuccessChime } from '../utils/audio';
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
  Undo2,
  Package,
  AlertCircle,
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
}) => {
  // Active tab inside modal: 'sale' (দ্রুত বিক্রি) | 'return' (পণ্য ফেরত)
  const [activeMode, setActiveMode] = useState<'sale' | 'return'>(initialMode);

  useEffect(() => {
    if (isOpen) {
      setActiveMode(initialMode);
    }
  }, [isOpen, initialMode]);

  // Quick Sale States
  const [amountInput, setAmountInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [profitMode, setProfitMode] = useState<'none' | '10' | '15' | '20' | 'custom'>('none');
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
    return Math.round(todaySales.reduce((sum, s) => sum + (s.profit || 0), 0));
  }, [todaySales]);

  if (!isOpen) return null;

  // --- Quick Sale Calculations ---
  const numericAmount = Math.max(0, Number(amountInput) || 0);

  const calculatedProfit = (() => {
    if (numericAmount <= 0) return 0;
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
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden">
        {/* Header */}
        <div
          className={`px-4 py-3.5 text-white flex items-center justify-between shrink-0 transition-colors ${
            activeMode === 'return'
              ? 'bg-gradient-to-r from-[#D32F2F] to-[#9A0007]'
              : 'bg-gradient-to-r from-[#0E6B6B] to-[#094747]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black shadow-xs shrink-0 ${
                activeMode === 'return'
                  ? 'bg-white text-[#D32F2F]'
                  : 'bg-amber-400 text-slate-950'
              }`}
            >
              {activeMode === 'return' ? (
                <Undo2 className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <Zap className="w-5 h-5 fill-current" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                {activeMode === 'return'
                  ? 'পণ্য ফেরত ও হিসাব সমন্বয়'
                  : 'দ্রুত বিক্রি ও পণ্য ফেরত'}
              </h3>
              <p className="text-[11px] text-white/90">
                {activeMode === 'return'
                  ? 'পণ্য ফেরত নিলে মূল ড্যাশবোর্ডের বিক্রি ও লাভ থেকে অটো টাকা কেটে যাবে'
                  : 'পণ্য অ্যাড বা স্ক্যান ছাড়াই সরাসরি বিক্রি ও ফেরতের হিসাব রাখুন'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher: দ্রুত বিক্রি vs পণ্য ফেরত */}
        <div className="p-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveMode('sale');
              setJustSavedToast('');
            }}
            className={`py-2.5 px-3 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer border ${
              activeMode === 'sale'
                ? 'bg-[#0E6B6B] text-white border-[#0E6B6B] shadow-sm'
                : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#102A43]'
            }`}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>দ্রুত বিক্রি</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('return');
              setJustSavedToast('');
            }}
            className={`py-2.5 px-3 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer border ${
              activeMode === 'return'
                ? 'bg-[#D32F2F] text-white border-[#D32F2F] shadow-sm'
                : 'bg-white text-[#D32F2F] border-rose-200 hover:bg-rose-50'
            }`}
          >
            <Undo2 className="w-4 h-4 stroke-[2.5]" />
            <span>পণ্য ফেরত</span>
          </button>
        </div>

        {/* Live Today Summary Banner (বিক্রি ও লাভ) */}
        <div className="px-4 py-2 bg-[#E0F2F1] border-b border-[#B2DFDB] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-[#0E6B6B]" />
            <span className="text-xs font-bold text-[#102A43]">আজকের বিক্রি:</span>
            <span className="text-sm sm:text-base font-black text-[#0E6B6B]">
              ৳{todayTotalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#2E7D32]" />
            <span className="text-xs font-bold text-[#102A43]">আজকের লাভ:</span>
            <span
              className={`text-sm sm:text-base font-black ${
                todayTotalProfit >= 0 ? 'text-[#2E7D32]' : 'text-[#D32F2F]'
              }`}
            >
              ৳{todayTotalProfit.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {justSavedToast && (
            <div className="p-3 rounded-2xl bg-emerald-600 text-white text-xs sm:text-sm font-extrabold flex items-center justify-between shadow-md animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{justSavedToast}</span>
              </div>
            </div>
          )}

          {activeMode === 'sale' ? (
            <>
              {/* ================= QUICK SALE FORM ================= */}
              {/* 1. Sale Amount Input + Fast Keypad Chips */}
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border-2 border-[#0E6B6B]/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-extrabold text-[#102A43]">
                    ১. কত টাকা বিক্রি করলেন? (৳) *
                  </label>
                  {amountInput && (
                    <button
                      type="button"
                      onClick={() => setAmountInput('')}
                      className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>মুছুন</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-[#0E6B6B]">
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
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border-2 border-[#0E6B6B] text-2xl sm:text-3xl font-black text-[#102A43] placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#0E6B6B]/20"
                  />
                </div>

                {/* Quick Amount Add Buttons */}
                <div>
                  <p className="text-[11px] font-bold text-[#64748B] mb-1.5">
                    বাটনে ট্যাপ করে দ্রুত টাকা যোগ করুন:
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {[10, 20, 50, 100, 200, 500, 1000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleQuickAddAmount(val)}
                        className="py-2 px-1.5 rounded-xl bg-white hover:bg-[#E0F2F1] text-[#0E6B6B] font-extrabold text-xs border border-[#B2DFDB] shadow-2xs active:scale-95 transition cursor-pointer"
                      >
                        +৳{val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Optional Note / Description */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-[#102A43]">
                  ২. কী বিক্রি করলেন / বিবরণ (ঐচ্ছিক - না লিখলেও চলবে)
                </label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="যেমন: খুচরা বিক্রি, মুদি মাল, চা-বিস্কুট..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm font-semibold text-[#102A43] focus:outline-none focus:border-[#0E6B6B] focus:bg-white"
                />
                <div className="flex flex-wrap gap-1.5">
                  {quickNotes.map((qn) => (
                    <button
                      key={qn}
                      type="button"
                      onClick={() => setNoteInput(qn)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        noteInput === qn
                          ? 'bg-[#0E6B6B] text-white border-[#0E6B6B]'
                          : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-[#E0F2F1] hover:text-[#0E6B6B]'
                      }`}
                    >
                      {qn}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Cash vs Due Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-[#102A43]">
                  ৩. বিক্রির ধরন (নগদ নাকি বাকি?)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('cash')}
                    className={`py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      paymentMode === 'cash'
                        ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs'
                        : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                    }`}
                  >
                    <span>💵 নগদ বিক্রি</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('due')}
                    className={`py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      paymentMode === 'due'
                        ? 'bg-[#D32F2F] text-white border-[#D32F2F] shadow-xs'
                        : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                    }`}
                  >
                    <span>📒 বাকি বিক্রি</span>
                  </button>
                </div>

                {paymentMode === 'due' && (
                  <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2.5 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#102A43] flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-[#D32F2F]" />
                        <span>বাকি খাতার গ্রাহক নির্বাচন করুন *</span>
                      </span>
                      {onAddNewCustomer && (
                        <button
                          type="button"
                          onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                          className="text-xs font-extrabold text-[#0E6B6B] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>নতুন গ্রাহক</span>
                        </button>
                      )}
                    </div>

                    {showNewCustomerForm ? (
                      <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] space-y-2">
                        <input
                          type="text"
                          value={newCustName}
                          onChange={(e) => setNewCustName(e.target.value)}
                          placeholder="গ্রাহকের নাম লিখুন"
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
                        />
                        <input
                          type="tel"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          placeholder="মোবাইল নম্বর (ঐচ্ছিক)"
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowNewCustomerForm(false)}
                            className="flex-1 py-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-600"
                          >
                            বাতিল
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateQuickCustomer}
                            className="flex-1 py-1.5 rounded-lg bg-[#0E6B6B] text-white text-xs font-bold"
                          >
                            গ্রাহক সেভ করুন
                          </button>
                        </div>
                      </div>
                    ) : (
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs sm:text-sm font-bold text-[#102A43]"
                      >
                        <option value="">-- গ্রাহক নির্বাচন করুন --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone}) {c.totalDue > 0 ? `[পূর্বের বাকি: ৳${c.totalDue}]` : ''}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="font-bold text-[#102A43]">নগদ জমা দিয়েছে (থাকলে):</span>
                      <input
                        type="number"
                        min="0"
                        value={paidAmountForDue}
                        onChange={(e) => setPaidAmountForDue(e.target.value)}
                        placeholder="০"
                        className="w-28 px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-right font-bold text-[#102A43]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Optional Profit Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-[#102A43] flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-[#2E7D32]" />
                    <span>৪. লাভের হিসাব (ঐচ্ছিক)</span>
                  </label>
                  {calculatedProfit > 0 && (
                    <span className="text-xs font-black text-[#2E7D32]">
                      লাভ: +৳{calculatedProfit}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'none', label: 'শুধু বিক্রির হিসাব' },
                    { id: '10', label: '১০% লাভ' },
                    { id: '15', label: '১৫% লাভ' },
                    { id: '20', label: '২০% লাভ' },
                    { id: 'custom', label: 'নিজে লাভ লিখুন' },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setProfitMode(pm.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        profitMode === pm.id
                          ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                          : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
                {profitMode === 'custom' && (
                  <div className="pt-1">
                    <input
                      type="number"
                      min="0"
                      value={customProfitInput}
                      onChange={(e) => setCustomProfitInput(e.target.value)}
                      placeholder="এই বিক্রিতে কত টাকা লাভ হয়েছে লিখুন (৳)"
                      className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#102A43]"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* ================= PRODUCT RETURN FORM (পণ্য ফেরত) ================= */}
              <div className="p-3 rounded-2xl bg-rose-50/80 border border-rose-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#D32F2F] shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-[#102A43] leading-relaxed">
                  কাস্টমার পণ্য ফেরত দিলে এখানে টাকার পরিমাণ লিখুন। এটি সাথে সাথে{' '}
                  <span className="text-[#D32F2F] font-black">
                    মূল ড্যাশবোর্ডের বিক্রি ও লাভ থেকে টাকা কেটে নিবে
                  </span>{' '}
                  এবং ক্যাশ বাক্সের হিসাব মিলিয়ে দিবে।
                </p>
              </div>

              {/* 1. Return Amount Input + Quick Buttons */}
              <div className="p-3.5 rounded-2xl bg-[#FFF5F5] border-2 border-[#D32F2F]/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-extrabold text-[#102A43]">
                    ১. কত টাকার পণ্য ফেরত নিলেন? (৳) *
                  </label>
                  {returnAmountInput && (
                    <button
                      type="button"
                      onClick={() => setReturnAmountInput('')}
                      className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>মুছুন</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-[#D32F2F]">
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
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border-2 border-[#D32F2F] text-2xl sm:text-3xl font-black text-[#102A43] placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#D32F2F]/20"
                  />
                </div>

                {/* Quick Return Amount Buttons */}
                <div>
                  <p className="text-[11px] font-bold text-[#64748B] mb-1.5">
                    বাটনে ট্যাপ করে দ্রুত ফেরতের টাকা যোগ করুন:
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {[10, 20, 50, 100, 200, 500, 1000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleQuickAddReturnAmount(val)}
                        className="py-2 px-1.5 rounded-xl bg-white hover:bg-rose-100 text-[#D32F2F] font-extrabold text-xs border border-rose-200 shadow-2xs active:scale-95 transition cursor-pointer"
                      >
                        +৳{val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Where to deduct from: Sales & Profit / Sales Only / Profit Only */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <label className="block text-xs font-extrabold text-[#102A43]">
                  ২. মূল ড্যাশবোর্ডের কোন হিসাব থেকে টাকা কাটবে?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReturnDeductionType('sale_and_profit')}
                    className={`py-2 px-2.5 rounded-xl font-extrabold text-xs border transition cursor-pointer ${
                      returnDeductionType === 'sale_and_profit'
                        ? 'bg-[#D32F2F] text-white border-[#D32F2F] shadow-2xs'
                        : 'bg-white text-[#102A43] border-[#E2E8F0]'
                    }`}
                  >
                    বিক্রয় ও লাভ উভয় থেকে
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnDeductionType('sale_only')}
                    className={`py-2 px-2.5 rounded-xl font-extrabold text-xs border transition cursor-pointer ${
                      returnDeductionType === 'sale_only'
                        ? 'bg-[#D32F2F] text-white border-[#D32F2F] shadow-2xs'
                        : 'bg-white text-[#102A43] border-[#E2E8F0]'
                    }`}
                  >
                    শুধু মোট বিক্রয় থেকে
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnDeductionType('profit_only')}
                    className={`py-2 px-2.5 rounded-xl font-extrabold text-xs border transition cursor-pointer ${
                      returnDeductionType === 'profit_only'
                        ? 'bg-[#D32F2F] text-white border-[#D32F2F] shadow-2xs'
                        : 'bg-white text-[#102A43] border-[#E2E8F0]'
                    }`}
                  >
                    শুধু লাভ থেকে কাটবে
                  </button>
                </div>

                {returnDeductionType === 'sale_and_profit' && (
                  <div className="pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#64748B]">
                        ফেরত পণ্যে কতটুকু লাভ ধরা ছিল? (লাভ থেকে কাটবে):
                      </span>
                      {profitDeductionAmount > 0 && (
                        <span className="text-xs font-black text-[#D32F2F]">
                          লাভ কমবে: -৳{profitDeductionAmount}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: '10', label: '১০% লাভ কাটবে' },
                        { id: '15', label: '১৫% লাভ কাটবে' },
                        { id: '20', label: '২০% লাভ কাটবে' },
                        { id: 'custom', label: 'নিজে লাভ লিখুন' },
                        { id: 'none', label: 'লাভ কাটবে না (৳০)' },
                      ].map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setReturnProfitMode(pm.id as any)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
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
                      <div className="pt-1">
                        <input
                          type="number"
                          min="0"
                          value={returnCustomProfitInput}
                          onChange={(e) => setReturnCustomProfitInput(e.target.value)}
                          placeholder="লাভ থেকে কত টাকা কাটবে লিখুন (৳)"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-rose-300 text-xs font-bold text-[#102A43]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Live Impact Summary Preview */}
                {returnNumericAmount > 0 && (
                  <div className="mt-2 p-2.5 rounded-xl bg-white border border-rose-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#64748B] block">বিক্রয় থেকে কমবে:</span>
                      <span className="text-sm font-black text-[#D32F2F]">
                        -৳{saleDeductionAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#64748B] block">লাভ থেকে কমবে:</span>
                      <span className="text-sm font-black text-[#D32F2F]">
                        -৳{profitDeductionAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Optional Stock Product Selection + Note */}
              <div className="space-y-2">
                {products.length > 0 && (
                  <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                    <label className="text-xs font-extrabold text-[#102A43] flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#0E6B6B]" />
                      <span>৩. স্টকের পণ্য হলে সিলেক্ট করুন (ঐচ্ছিক - স্টকে পণ্য যোগ হবে)</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedReturnProductId}
                        onChange={(e) => handleSelectReturnProduct(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-bold text-[#102A43]"
                      >
                        <option value="">-- পণ্য ছাড়া সরাসরি ফেরত --</option>
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
                          className="w-20 px-2.5 py-2 rounded-xl bg-white border border-[#0E6B6B] text-xs font-black text-center text-[#102A43]"
                          title="ফেরত পণ্যের পরিমাণ"
                        />
                      )}
                    </div>
                  </div>
                )}

                <label className="block text-xs font-extrabold text-[#102A43]">
                  ফেরতের কারণ / পণ্যের নাম (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={returnNoteInput}
                  onChange={(e) => setReturnNoteInput(e.target.value)}
                  placeholder="যেমন: পণ্য ফেরত, সাবান ফেরত, নষ্ট পণ্য..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm font-semibold text-[#102A43] focus:outline-none focus:border-[#D32F2F] focus:bg-white"
                />
                <div className="flex flex-wrap gap-1.5">
                  {quickReturnNotes.map((rn) => (
                    <button
                      key={rn}
                      type="button"
                      onClick={() => setReturnNoteInput(rn)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        returnNoteInput === rn
                          ? 'bg-[#D32F2F] text-white border-[#D32F2F]'
                          : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-rose-50 hover:text-[#D32F2F]'
                      }`}
                    >
                      {rn}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 5. Today's Recent Sales & Returns Log (কখন কত বিক্রি বা ফেরত নিয়েছেন) */}
          {todaySales.length > 0 && (
            <div className="pt-2 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-[#102A43] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#0E6B6B]" />
                  <span>
                    {activeMode === 'return'
                      ? 'আজকের বিক্রি থেকে ১ ক্লিকে ফেরত নিন:'
                      : `আজ কখন কত বিক্রি করেছেন (${todaySales.length}টি):`}
                  </span>
                </span>
                <span className="text-xs font-black text-[#0E6B6B]">
                  নিট: ৳{todayTotalAmount.toLocaleString()}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
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
                        className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
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
                          <span className="text-[10px] text-[#64748B]">
                            🕒{' '}
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
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`font-black text-sm ${
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
                                  `✅ ৳${s.grandTotal.toLocaleString()} টাকার বিক্রি ফেরত নেওয়া হয়েছে এবং ড্যাশবোর্ড থেকে বিক্রি ও লাভ কেটে নেওয়া হয়েছে!`
                                );
                                setTimeout(() => setJustSavedToast(''), 4000);
                              }}
                              className="px-2 py-1 rounded-lg bg-[#D32F2F] hover:bg-rose-800 text-white font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition active:scale-95"
                              title="এই বিক্রিটি পুরোপুরি ফেরত নিন"
                            >
                              <Undo2 className="w-3 h-3" />
                              <span>ফেরত নিন</span>
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
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-[#D32F2F] text-[#D32F2F] hover:text-white border border-rose-200 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition active:scale-95"
                              title="এই মেমো ডিলিট করুন"
                            >
                              <span>মুছুন</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Buttons */}
        <div className="p-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center gap-2 shrink-0">
          {activeMode === 'sale' ? (
            <>
              <button
                type="button"
                disabled={numericAmount <= 0}
                onClick={() => handleSubmitSale(false)}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#0E6B6B] hover:bg-[#094747] disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
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
                className="py-3 px-3.5 rounded-2xl bg-white hover:bg-[#E0F2F1] disabled:opacity-50 text-[#0E6B6B] border border-[#0E6B6B] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                title="বিক্রি জমা করে রসিদ প্রিন্ট করুন"
              >
                <Printer className="w-4 h-4" />
                <span>রসিদসহ</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={returnNumericAmount <= 0}
              onClick={handleSubmitReturn}
              className="w-full py-3 px-4 rounded-2xl bg-[#D32F2F] hover:bg-rose-800 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
            >
              <Undo2 className="w-4 h-4 stroke-[2.5]" />
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
