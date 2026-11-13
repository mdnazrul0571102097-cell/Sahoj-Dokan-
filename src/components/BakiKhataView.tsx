import React, { useState, useMemo, useEffect } from 'react';
import { Customer, BakiTransaction, ShopProfile, Language, Supplier, SupplierTransaction, Product, AppMode } from '../types';
import { translations } from '../i18n/translations';
import { playSuccessChime } from '../utils/audio';
import { SupplierKhataView } from './SupplierKhataView';
import {
  BookOpen,
  Search,
  Plus,
  UserPlus,
  Phone,
  ArrowDownLeft,
  ArrowUpRight,
  Share2,
  Calendar,
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  Lock,
  MessageCircle,
  Trash2,
  Edit2,
  Info,
  ArrowLeft,
} from 'lucide-react';

interface Props {
  customers: Customer[];
  bakiTransactions: BakiTransaction[];
  suppliers?: Supplier[];
  supplierTransactions?: SupplierTransaction[];
  products?: Product[];
  profile: ShopProfile;
  language: Language;
  appMode?: AppMode;
  onOpenSubscriptionModal?: () => void;
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  onReceivePayment: (
    customerId: string,
    amount: number,
    note: string,
    newBalance: number
  ) => void;
  onAddDue: (
    customerId: string,
    amount: number,
    note: string,
    newBalance: number
  ) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onAddSupplier?: (supplier: Supplier) => void;
  onPaySupplier?: (
    supplierId: string,
    amount: number,
    note: string,
    newBalance: number
  ) => void;
  onAddSupplierDue?: (
    supplierId: string,
    amount: number,
    note: string,
    newBalance: number,
    extra?: {
      damageDeduction?: number;
      stockValue?: number;
      updatedProducts?: Product[];
    }
  ) => void;
  onSupplierReturn?: (
    supplierId: string,
    amount: number,
    note: string,
    newBalance: number
  ) => void;
  onUpdateSupplier?: (supplier: Supplier) => void;
  onUpdateSupplierTransaction?: (
    supplierId: string,
    nextSupplierBalance: number,
    nextAllTxs: SupplierTransaction[]
  ) => void;
  onDeleteSupplier?: (supplierId: string) => void;
  initialSubTab?: 'customers' | 'suppliers';
  singleSectionMode?: boolean;
  onBackToMenu?: () => void;
}

export const BakiKhataView: React.FC<Props> = ({
  customers,
  bakiTransactions,
  suppliers = [],
  supplierTransactions = [],
  products = [],
  profile,
  language,
  appMode = 'trial',
  onOpenSubscriptionModal,
  onAddCustomer,
  onUpdateCustomer = () => {},
  onReceivePayment,
  onAddDue,
  onDeleteCustomer = () => {},
  onAddSupplier = () => {},
  onPaySupplier = () => {},
  onAddSupplierDue = () => {},
  onSupplierReturn,
  onUpdateSupplier = () => {},
  onUpdateSupplierTransaction,
  onDeleteSupplier = () => {},
  initialSubTab = 'customers',
  singleSectionMode = false,
  onBackToMenu,
}) => {
  const t = translations[language];

  // Active sub-tab: 'customers' (ক্রেতার বাকি) vs 'suppliers' (সাপ্লায়ারের বাকি)
  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'suppliers'>(initialSubTab);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [confirmDeleteCustomerId, setConfirmDeleteCustomerId] = useState<string | null>(null);

  // Modals
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [customerForPayment, setCustomerForPayment] = useState<Customer | null>(null);

  // New Due Modal
  const [showAddDueModal, setShowAddDueModal] = useState(false);
  const [customerForAddDue, setCustomerForAddDue] = useState<Customer | null>(null);
  const [newDueAmount, setNewDueAmount] = useState<number | ''>('');
  const [newDueNote, setNewDueNote] = useState('');

  // Register sub-view back handler for Android hardware back button
  useEffect(() => {
    (window as any).__sdSubViewBack = () => {
      if (customerToEdit) {
        setCustomerToEdit(null);
        return true;
      }
      if (showAddCustomerModal) {
        setShowAddCustomerModal(false);
        return true;
      }
      if (showPaymentModal) {
        setShowPaymentModal(false);
        return true;
      }
      if (showAddDueModal) {
        setShowAddDueModal(false);
        return true;
      }
      if (selectedCustomer) {
        setConfirmDeleteCustomerId(null);
        setSelectedCustomer(null);
        return true;
      }
      if (!singleSectionMode && activeSubTab !== 'customers') {
        setActiveSubTab('customers');
        return true;
      }
      return false;
    };
    return () => {
      (window as any).__sdSubViewBack = null;
    };
  }, [customerToEdit, showAddCustomerModal, showPaymentModal, showAddDueModal, selectedCustomer, activeSubTab, singleSectionMode]);

  // Forms
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [initialDue, setInitialDue] = useState<number | ''>('');

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState('');

  // Calculations
  const totalOutstandingDue = useMemo(() => {
    return Math.round(customers.reduce((acc, c) => acc + (c.totalDue || 0), 0));
  }, [customers]);

  const dueCustomersCount = useMemo(() => {
    return customers.filter((c) => c.totalDue > 0).length;
  }, [customers]);

  // Filter customers by search query
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  // Add new customer submit
  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCust: Customer = {
      id: `cust_${Date.now()}`,
      name: name.trim(),
      phone: phone.trim() || '---',
      address: address.trim(),
      totalDue: Number(initialDue) || 0,
      createdAt: new Date().toISOString(),
    };

    onAddCustomer(newCust);
    setName('');
    setPhone('');
    setAddress('');
    setInitialDue('');
    setShowAddCustomerModal(false);
  };

  // Open Edit Customer Modal
  const handleOpenEditCustomer = (cust: Customer) => {
    setCustomerToEdit(cust);
    setEditCustomerName(cust.name);
    setEditCustomerPhone(cust.phone === '---' ? '' : cust.phone);
    setEditCustomerAddress(cust.address || '');
  };

  // Submit Edit Customer
  const handleEditCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerToEdit || !editCustomerName.trim()) return;

    const updatedCust: Customer = {
      ...customerToEdit,
      name: editCustomerName.trim(),
      phone: editCustomerPhone.trim() || '---',
      address: editCustomerAddress.trim(),
      // Balance is strictly locked & immutable in Edit modal
      totalDue: customerToEdit.totalDue,
    };

    onUpdateCustomer(updatedCust);
    if (selectedCustomer?.id === customerToEdit.id) {
      setSelectedCustomer(updatedCust);
    }
    setCustomerToEdit(null);
    playSuccessChime();
  };

  // Payment received submit
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForPayment || !paymentAmount || paymentAmount <= 0) return;

    const amt = Number(paymentAmount);
    const newBalance = Math.max(0, (customerForPayment.totalDue || 0) - amt);

    onReceivePayment(
      customerForPayment.id,
      amt,
      paymentNote.trim() || 'নগদ জমা পরিশোধ',
      newBalance
    );

    if (selectedCustomer && selectedCustomer.id === customerForPayment.id) {
      setSelectedCustomer({
        ...selectedCustomer,
        totalDue: newBalance,
      });
    }

    playSuccessChime();
    setPaymentAmount('');
    setPaymentNote('');
    setShowPaymentModal(false);
    setCustomerForPayment(null);
  };

  // Add new due submit
  const handleAddDueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForAddDue || !newDueAmount || Number(newDueAmount) <= 0) return;

    const amt = Number(newDueAmount);
    const newBalance = Math.round(((customerForAddDue.totalDue || 0) + amt) * 100) / 100;

    onAddDue(
      customerForAddDue.id,
      amt,
      newDueNote.trim() || (language === 'bn' ? 'সরাসরি বাকি যোগ' : 'Direct Due Added'),
      newBalance
    );

    if (selectedCustomer && selectedCustomer.id === customerForAddDue.id) {
      setSelectedCustomer({
        ...selectedCustomer,
        totalDue: newBalance,
      });
    }

    playSuccessChime();
    setNewDueAmount('');
    setNewDueNote('');
    setShowAddDueModal(false);
    setCustomerForAddDue(null);
  };

  // WhatsApp Reminder message (Locked in Normal Mode after 60 days)
  const handleSendReminder = (customer: Customer) => {
    if (appMode === 'normal') {
      if (onOpenSubscriptionModal) {
        onOpenSubscriptionModal();
      } else {
        alert('🔒 ৬০ দিনের ফ্রি ট্রায়াল শেষ! কাস্টমারকে হোয়াটসঅ্যাপ মেসেজ পাঠাতে Pro সাবস্ক্রিপশন চালু করুন।');
      }
      return;
    }

    const msg = `আসসালামু আলাইকুম ${customer.name} ভাই,
*${profile.shopName}* থেকে জানানো যাচ্ছে যে আপনার বর্তমান বাকি হিসাব ৳${customer.totalDue} টাকা।
সুবিধামতো সময়ে বাকি পরিশোধ করার জন্য অনুরোধ করা হলো।
ধন্যবাদ! 
- ${profile.shopName} (ফোন: ${profile.phone})`;

    const cleanPhone = (customer.phone || '').replace(/\D/g, '').slice(-11);
    const fullPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    const url =
      fullPhone.length >= 10
        ? `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(msg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    if (typeof window !== 'undefined' && (window as any).AndroidApp?.openWhatsApp) {
      try {
        (window as any).AndroidApp.openWhatsApp(url);
        return;
      } catch (_) {}
    }
    window.open(url, '_blank');
  };

  // Filter mode for Summary card: 'all' (সর্বমোট) vs 'today' (আজ)
  const [summaryTimeMode, setSummaryTimeMode] = useState<'all' | 'today'>('all');

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

  const totalCollectedToday = useMemo(() => {
    const todayStr = getLocalDateStr(new Date());
    return Math.round(
      bakiTransactions
        .filter(
          (tx) =>
            getLocalDateStr(tx.date) === todayStr && tx.type === 'payment_received'
        )
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );
  }, [bakiTransactions]);

  const totalDueAddedToday = useMemo(() => {
    const todayStr = getLocalDateStr(new Date());
    return Math.round(
      bakiTransactions
        .filter(
          (tx) =>
            getLocalDateStr(tx.date) === todayStr &&
            (tx.type === 'due_added' || tx.type === 'sale_due')
        )
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );
  }, [bakiTransactions]);

  const totalCollectedAll = useMemo(() => {
    return Math.round(
      bakiTransactions
        .filter((tx) => tx.type === 'payment_received')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );
  }, [bakiTransactions]);

  return (
    <div className="h-[calc(100vh-125px)] flex flex-col p-2 sm:p-3 max-w-7xl mx-auto overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-white rounded-2xl px-3 sm:px-4 py-2.5 mb-2.5 flex items-center justify-between gap-2 border border-[#E2E8F0] shadow-xs shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onBackToMenu ? (
            <button
              type="button"
              onClick={() => {
                if (selectedCustomer) {
                  setSelectedCustomer(null);
                  return;
                }
                onBackToMenu();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] font-extrabold text-xs sm:text-sm transition active:scale-95 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span>হিসাব / মেনু</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (selectedCustomer) setSelectedCustomer(null);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E6B6B] hover:bg-[#E0F2F1] transition shrink-0"
              title="পেছনে যান"
            >
              <ArrowDownLeft className="w-5 h-5 -rotate-45" />
            </button>
          )}
          <h2 className="text-sm sm:text-lg font-bold text-[#102A43] truncate">
            {activeSubTab === 'suppliers' ? 'সাপ্লাইয়ার বাকি' : 'কাস্টমার বাকি'}
          </h2>
        </div>

        {/* Dedicated Customer & Supplier Baki Buttons (only shown when not in singleSectionMode) */}
        {!singleSectionMode && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('customers')}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                activeSubTab === 'customers'
                  ? 'bg-[#0E6B6B] text-white border-[#0E6B6B] shadow-xs'
                  : 'bg-[#E0F2F1] text-[#0E6B6B] border-[#B2DFDB] hover:bg-[#B2DFDB]'
              }`}
            >
              👥 কাস্টমার ({customers.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('suppliers')}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                activeSubTab === 'suppliers'
                  ? 'bg-[#0E6B6B] text-white border-[#0E6B6B] shadow-xs'
                  : 'bg-[#E0F2F1] text-[#0E6B6B] border-[#B2DFDB] hover:bg-[#B2DFDB]'
              }`}
            >
              🏢 সাপ্লায়ার ({suppliers.length})
            </button>
          </div>
        )}
      </div>

      {activeSubTab === 'suppliers' ? (
        <SupplierKhataView
          suppliers={suppliers}
          supplierTransactions={supplierTransactions}
          products={products}
          profile={profile}
          language={language}
          appMode={appMode}
          onOpenSubscriptionModal={onOpenSubscriptionModal}
          onAddSupplier={onAddSupplier}
          onPaySupplier={onPaySupplier}
          onAddSupplierDue={onAddSupplierDue}
          onSupplierReturn={onSupplierReturn}
          onUpdateSupplier={onUpdateSupplier}
          onUpdateSupplierTransaction={onUpdateSupplierTransaction}
          onDeleteSupplier={onDeleteSupplier}
        />
      ) : (
        <>
          {/* Main Summary Card matching Screenshot 1 */}
          <div className="bg-white rounded-[24px] p-4 shadow-sm border border-[#E2E8F0] mb-3 shrink-0">
            {/* Pill Toggle: সর্বমোট vs আজ */}
            <div className="flex justify-center mb-3">
              <div className="inline-flex rounded-full bg-[#EDF2F7] p-1 border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setSummaryTimeMode('all')}
                  className={`px-5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    summaryTimeMode === 'all'
                      ? 'bg-[#0E6B6B] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#102A43]'
                  }`}
                >
                  সর্বমোট
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryTimeMode('today')}
                  className={`px-5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    summaryTimeMode === 'today'
                      ? 'bg-[#0E6B6B] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#102A43]'
                  }`}
                >
                  আজ
                </button>
              </div>
            </div>

            {/* 2 Financial Columns: পাবো (বাকি) vs জমা */}
            <div className="grid grid-cols-2 divide-x divide-[#E2E8F0] pt-1">
              {/* Left Column: পাবো (বাকি) */}
              <div className="text-center px-2">
                <p className="text-xs font-semibold text-[#64748B] mb-1">
                  {summaryTimeMode === 'all' ? 'সর্বমোট পাবো (বাকি)' : 'আজকের পাবো (বাকি)'}
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-[#D32F2F] tracking-tight">
                    ৳ {summaryTimeMode === 'all' ? totalOutstandingDue.toLocaleString() : totalDueAddedToday.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-[#D32F2F]">↗</span>
                </div>
              </div>

              {/* Right Column: জমা */}
              <div className="text-center px-2">
                <p className="text-xs font-semibold text-[#64748B] mb-1">
                  {summaryTimeMode === 'all' ? 'সর্বমোট জমা' : 'আজকের জমা'}
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-[#2E7D32] tracking-tight">
                    ৳ {summaryTimeMode === 'all' ? totalCollectedAll.toLocaleString() : totalCollectedToday.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-[#2E7D32]">↙</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search Row & Filter Button matching Screenshot 1 */}
          <div className="flex items-center gap-2 mb-2.5 shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#9AA5B1]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="খুঁজুন..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E2E8F0] text-xs sm:text-sm text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B] shadow-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="w-10 h-10 rounded-2xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#64748B] shadow-xs hover:bg-[#EDF2F7] transition"
              title="ফিল্টার"
            >
              <div className="space-y-1">
                <div className="w-4 h-0.5 bg-[#64748B] rounded-full"></div>
                <div className="w-3 h-0.5 bg-[#64748B] rounded-full mx-auto"></div>
                <div className="w-2 h-0.5 bg-[#64748B] rounded-full mx-auto"></div>
              </div>
            </button>
          </div>

          {/* Status count line & বাকি রিপোর্ট button */}
          <div className="flex items-center justify-between px-1 mb-2.5 shrink-0">
            <div className="text-xs font-bold text-[#64748B] flex items-center gap-1.5">
              <span>কাস্টমার: {customers.length}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#0E6B6B]"></span>
              <span>সাপ্লায়ার: {suppliers.length}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                alert(`মোট বাকি রিপোর্ট:\nগ্রাহক সংখ্যা: ${customers.length} জন\nমোট বকেয়া: ৳${totalOutstandingDue}`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#B2DFDB] font-bold text-xs border border-[#B2DFDB] transition"
            >
              <span>📄</span>
              <span>বাকি রিপোর্ট</span>
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col md:flex-row gap-3 overflow-hidden">
            {/* Customer Directory List */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 pb-16">
                {filteredCustomers.length === 0 ? (
                  <div className="bg-white rounded-[24px] p-8 text-center border border-[#E2E8F0] shadow-xs">
                    <BookOpen className="w-10 h-10 text-[#9AA5B1] mx-auto mb-2 stroke-1" />
                    <p className="text-xs font-semibold text-[#64748B]">
                      কোন ক্রেতা পাওয়া যায়নি
                    </p>
                  </div>
                ) : (
                  filteredCustomers.map((cust: Customer) => {
                    const hasDue = cust.totalDue > 0;
                    return (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setConfirmDeleteCustomerId(null);
                          setSelectedCustomer(cust);
                        }}
                        className={`bg-white rounded-[20px] p-3.5 border transition-all cursor-pointer space-y-2.5 shadow-xs hover:border-[#0E6B6B] ${
                          selectedCustomer?.id === cust.id
                            ? 'border-[#0E6B6B] ring-2 ring-[#0E6B6B]/20'
                            : 'border-[#E2E8F0]'
                        }`}
                      >
                        {/* Row 1: Avatar + Name/Phone + Total Due */}
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#E0F2F1] text-[#0E6B6B] font-black text-base sm:text-lg flex items-center justify-center shrink-0">
                              {cust.name.slice(0, 1)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-sm sm:text-base text-[#102A43] truncate">
                                {cust.name}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#64748B] font-mono truncate">
                                <span>{cust.phone || '---'}</span>
                                {cust.address && (
                                  <span className="font-sans font-normal truncate">• {cust.address}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[11px] text-[#64748B] block font-medium leading-tight">
                              মোট বাকি
                            </span>
                            <span
                              className={`text-sm sm:text-base font-black font-mono tracking-tight leading-tight block tabular-nums ${
                                hasDue ? 'text-[#D32F2F]' : 'text-[#2E7D32]'
                              }`}
                            >
                              ৳ {cust.totalDue.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: Quick Action Buttons (+ বাকি, ৳ জমা, Edit, WhatsApp) */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F1F5F9]">
                          <div className="flex items-center gap-1.5 flex-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomerForAddDue(cust);
                                setNewDueAmount('');
                                setNewDueNote('');
                                setShowAddDueModal(true);
                              }}
                              className="flex-1 py-2 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[#D32F2F] text-xs font-extrabold transition active:scale-95 cursor-pointer whitespace-nowrap"
                            >
                              + বাকি
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomerForPayment(cust);
                                setPaymentAmount(cust.totalDue || '');
                                setPaymentNote('');
                                setShowPaymentModal(true);
                              }}
                              className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#2E7D32] text-xs font-extrabold transition active:scale-95 cursor-pointer whitespace-nowrap"
                            >
                              ৳ জমা
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditCustomer(cust);
                              }}
                              className="p-2 rounded-xl border border-[#B2DFDB] bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] transition active:scale-95 cursor-pointer"
                              title="কাস্টমার তথ্য এডিট করুন"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendReminder(cust);
                              }}
                              className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer ${
                                appMode === 'normal'
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] border-[#B2DFDB]'
                              }`}
                              title={
                                appMode === 'normal'
                                  ? 'হোয়াটসঅ্যাপ মেসেজ পাঠাতে Pro আনলক করুন'
                                  : 'কাস্টমারের হোয়াটসঅ্যাপে তাগাদা মেসেজ পাঠান'
                              }
                            >
                              {appMode === 'normal' ? (
                                <>
                                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                                  <span className="text-[10px]">Pro</span>
                                </>
                              ) : (
                                <MessageCircle className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

        {/* Customer Detail Ledger Modal / Drawer when a customer is selected (No empty dark box blocking the list!) */}
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full sm:max-w-md max-h-[88vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl p-4 shadow-2xl border border-[#E2E8F0] overflow-hidden">
              {/* Customer Header */}
              <div className="pb-3 border-b border-[#E2E8F0] shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-[#102A43]">
                      {selectedCustomer.name}
                    </h3>
                    <p className="text-xs text-[#64748B]">{selectedCustomer.phone}</p>
                    {selectedCustomer.address && (
                      <p className="text-xs text-[#64748B] mt-0.5">{selectedCustomer.address}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-1">
                      <span className="text-[10px] text-[#64748B] uppercase font-bold">মোট বাকি</span>
                      <p className="text-xl font-black text-[#D32F2F]">
                        ৳{selectedCustomer.totalDue}
                      </p>
                    </div>
                    {/* Edit Customer Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditCustomer(selectedCustomer)}
                      className="h-8 px-2.5 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#B2DFDB] border border-[#B2DFDB] flex items-center justify-center gap-1 font-bold text-xs transition active:scale-95 cursor-pointer"
                      title="কাস্টমার তথ্য এডিট করুন"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>এডিট</span>
                    </button>

                    {/* Delete Customer Button: Click twice to confirm delete */}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirmDeleteCustomerId === selectedCustomer.id) {
                          onDeleteCustomer(selectedCustomer.id);
                          setConfirmDeleteCustomerId(null);
                          setSelectedCustomer(null);
                        } else {
                          setConfirmDeleteCustomerId(selectedCustomer.id);
                          setTimeout(() => {
                            setConfirmDeleteCustomerId((prev) => (prev === selectedCustomer.id ? null : prev));
                          }, 6000);
                        }
                      }}
                      className={`h-8 px-2.5 rounded-xl flex items-center justify-center gap-1 font-bold text-xs transition active:scale-95 cursor-pointer ${
                        confirmDeleteCustomerId === selectedCustomer.id
                          ? 'bg-[#D32F2F] text-white shadow-md ring-2 ring-rose-400 animate-pulse'
                          : 'bg-rose-50 text-[#D32F2F] hover:bg-rose-100 border border-rose-200 shadow-2xs'
                      }`}
                      title="কাস্টমার খাতা ডিলিট করতে দুবার চাপুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {confirmDeleteCustomerId === selectedCustomer.id
                          ? 'আবার চাপুন (নিশ্চিত)'
                          : 'ডিলিট'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteCustomerId(null);
                        setSelectedCustomer(null);
                      }}
                      className="w-8 h-8 rounded-full bg-[#EDF2F7] text-[#102A43] hover:bg-slate-200 flex items-center justify-center font-bold text-sm"
                      title="বন্ধ করুন"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setCustomerForAddDue(selectedCustomer);
                      setNewDueAmount('');
                      setNewDueNote('');
                      setShowAddDueModal(true);
                    }}
                    className="py-2.5 px-2 rounded-xl bg-[#D32F2F] hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{t.addNewDue}</span>
                  </button>

                  <button
                    onClick={() => {
                      setCustomerForPayment(selectedCustomer);
                      setPaymentAmount(selectedCustomer.totalDue || '');
                      setShowPaymentModal(true);
                    }}
                    className="py-2.5 px-2 rounded-xl bg-[#2E7D32] hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition active:scale-95"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>{t.receivePayment}</span>
                  </button>

                  <button
                    onClick={() => handleSendReminder(selectedCustomer)}
                    disabled={
                      appMode !== 'normal' &&
                      (selectedCustomer.totalDue <= 0 ||
                        !selectedCustomer.phone ||
                        selectedCustomer.phone === '---')
                    }
                    className={`py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition active:scale-95 ${
                      appMode === 'normal'
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                        : 'bg-[#0E6B6B] hover:bg-[#094747] disabled:opacity-40 text-white'
                    }`}
                    title={
                      appMode === 'normal'
                        ? 'হোয়াটসঅ্যাপ তাগাদা পাঠাতে Pro সাবস্ক্রিপশন নিন'
                        : 'তাগাদা পাঠান'
                    }
                  >
                    {appMode === 'normal' ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>তাগাদা (Pro)</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>তাগাদা</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Transactions List */}
              <div className="flex-1 overflow-y-auto py-3 space-y-2">
                <p className="text-xs font-bold text-[#102A43]">
                  লেনদেনের ইতিহাস (বাকি ও জমা)
                </p>

                {bakiTransactions
                  .filter((tx) => tx.customerId === selectedCustomer.id)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((tx) => (
                    <div
                      key={tx.id}
                      className="p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-bold flex items-center gap-1 ${
                            tx.type === 'payment_received'
                              ? 'text-[#2E7D32]'
                              : tx.type === 'due_added'
                              ? 'text-[#D32F2F]'
                              : 'text-amber-600'
                          }`}
                        >
                          {tx.type === 'payment_received' ? (
                            <>
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>{t.paymentCash}</span>
                            </>
                          ) : tx.type === 'due_added' ? (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>{t.dueAdded}</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>{t.saleOnCredit}</span>
                            </>
                          )}
                        </span>
                        <span className="font-extrabold text-sm text-[#102A43]">
                          {tx.type === 'payment_received' ? '-' : '+'}৳{tx.amount}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1">
                        <span>{tx.note || '---'}</span>
                        <span>
                          {new Date(tx.date).toLocaleDateString('bn-BD', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button "নতুন গ্রাহক" matching Screenshot 1 */}
      {activeSubTab === 'customers' && (
        <button
          type="button"
          onClick={() => setShowAddCustomerModal(true)}
          className="fixed bottom-20 right-4 sm:right-6 z-30 btn-teal-fab px-5 py-3 rounded-2xl font-bold text-sm sm:text-base flex items-center gap-2 shadow-xl cursor-pointer active:scale-95 transition"
        >
          <UserPlus className="w-5 h-5 stroke-[2.5]" />
          <span>+ নতুন গ্রাহক</span>
        </button>
      )}
    </>
  )}

      {/* Add New Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-base text-slate-800 dark:text-white mb-3">
              {t.addNewCustomer}
            </h4>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                  {t.customerName} *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: রফিক ভাই"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                  {t.customerPhone}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="০১৭১xxxxxxx"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                  ঠিকানা (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="যেমন: বাজার রোড"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                  পূর্বের কোন বাকি থাকলে (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  value={initialDue}
                  onChange={(e) => setInitialDue(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="৳ ০"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20"
                >
                  {t.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Due Modal */}
      {showAddDueModal && customerForAddDue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-base text-slate-800 dark:text-white mb-1">
              {t.addNewDue}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              গ্রাহক: <span className="font-bold text-slate-800 dark:text-white">{customerForAddDue.name}</span> (বর্তমান দেনা: <span className="font-bold text-rose-600">৳{customerForAddDue.totalDue}</span>)
            </p>

            <form onSubmit={handleAddDueSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                  {t.dueAmountToAdd} *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-base font-bold text-rose-600">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    autoFocus
                    value={newDueAmount}
                    onChange={(e) => setNewDueAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="০"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                    {t.dueNote}
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewDueNote('ভুল হিসাব সংশোধন')}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-[#D32F2F] hover:bg-rose-100 cursor-pointer"
                  >
                    + ভুল হিসাব সংশোধন
                  </button>
                </div>
                <input
                  type="text"
                  value={newDueNote}
                  onChange={(e) => setNewDueNote(e.target.value)}
                  placeholder="যেমন: ৩ কেজি তেল ও চাল বাকি বা ভুল হিসাব সংশোধন"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-sm"
                />
              </div>

              {Number(newDueAmount) > 0 && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex justify-between text-xs font-bold text-rose-900 dark:text-rose-200">
                  <span>যোগের পর নতুন মোট বাকি:</span>
                  <span>৳{((customerForAddDue.totalDue || 0) + Number(newDueAmount)).toLocaleString()}</span>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDueModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20"
                >
                  বাকি যুক্ত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Payment Modal */}
      {showPaymentModal && customerForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-base text-slate-800 dark:text-white mb-1">
              {t.receivePayment}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              গ্রাহক: <span className="font-bold text-emerald-700 dark:text-emerald-400">{customerForPayment.name}</span> (মোট বাকি: ৳{customerForPayment.totalDue})
            </p>

            <form onSubmit={handlePaymentSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                  {t.paymentAmount} *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-base font-bold text-emerald-600">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={customerForPayment.totalDue}
                    required
                    autoFocus
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={`${customerForPayment.totalDue}`}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                    {t.paymentNote}
                  </label>
                  <button
                    type="button"
                    onClick={() => setPaymentNote('ভুল হিসাব সংশোধন')}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#B2DFDB] cursor-pointer"
                  >
                    + ভুল হিসাব সংশোধন
                  </button>
                </div>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="যেমন: নগদ পরিশোধ / বিকাশ বা ভুল হিসাব সংশোধন"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white text-xs font-bold shadow-md shadow-[#0E6B6B]/20"
                >
                  জমা সম্পন্ন করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {customerToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 bg-[#0E6B6B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">কাস্টমার তথ্য এডিট</h3>
              </div>
              <button
                type="button"
                onClick={() => setCustomerToEdit(null)}
                className="p-1 rounded-full hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditCustomerSubmit} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  কাস্টমারের নাম *
                </label>
                <input
                  type="text"
                  required
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  মোবাইল নম্বর
                </label>
                <input
                  type="tel"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  placeholder="০১৭১xxxxxxx"
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  ঠিকানা বা নোট
                </label>
                <input
                  type="text"
                  value={editCustomerAddress}
                  onChange={(e) => setEditCustomerAddress(e.target.value)}
                  placeholder="যেমন: বাজার রোড"
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                />
              </div>

              {/* Read-Only Locked Due Balance */}
              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1 flex items-center justify-between">
                  <span>বকেয়া টাকা / চলমান ব্যালেন্স (৳)</span>
                  <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold">
                    <Lock className="w-3 h-3 text-amber-700" />
                    লক করা (রিড-অনলি)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    disabled
                    readOnly
                    value={customerToEdit.totalDue}
                    className="w-full p-2.5 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9] text-[#64748B] text-sm font-black font-mono cursor-not-allowed select-none"
                  />
                </div>
                <p className="text-[11px] text-[#64748B] mt-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-[#0E6B6B] shrink-0" />
                  <span>হিসেবে কোনো ভুল থাকলে খাতা থেকে "ভুল হিসাব সংশোধন" লেনদেন যোগ করে ব্যালেন্স ঠিক করুন।</span>
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustomerToEdit(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-[#102A43] text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  আপডেট করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
