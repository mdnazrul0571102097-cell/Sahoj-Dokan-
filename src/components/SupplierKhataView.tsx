import React, { useState, useMemo } from 'react';
import { Supplier, SupplierTransaction, ShopProfile, Language, AppMode } from '../types';
import { translations } from '../i18n/translations';
import { playSuccessChime } from '../utils/audio';
import {
  Building2,
  Search,
  Plus,
  Phone,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  MapPin,
  FileText,
  User,
  MessageCircle,
  Edit2,
  Trash2,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Lock,
  Info,
} from 'lucide-react';

interface Props {
  suppliers: Supplier[];
  supplierTransactions: SupplierTransaction[];
  profile: ShopProfile;
  language: Language;
  appMode?: AppMode;
  onOpenSubscriptionModal?: () => void;
  onAddSupplier: (supplier: Supplier) => void;
  onPaySupplier: (
    supplierId: string,
    amount: number,
    note: string,
    newBalance: number
  ) => void;
  onAddSupplierDue: (
    supplierId: string,
    amount: number,
    note: string,
    newBalance: number
  ) => void;
  onUpdateSupplier?: (supplier: Supplier) => void;
  onDeleteSupplier?: (supplierId: string) => void;
}

export const SupplierKhataView: React.FC<Props> = ({
  suppliers,
  supplierTransactions,
  profile,
  language,
  appMode = 'trial',
  onOpenSubscriptionModal,
  onAddSupplier,
  onPaySupplier,
  onAddSupplierDue,
  onUpdateSupplier = () => {},
  onDeleteSupplier = () => {},
}) => {
  const t = translations[language];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Modals
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddDueModal, setShowAddDueModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  // Target supplier for payment/due/edit
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);

  // Form states: New / Edit Supplier
  const [editId, setEditId] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [initialDue, setInitialDue] = useState<number | ''>('');

  // Form states: Pay Supplier
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank'>('cash');

  // Form states: Add Credit Purchase Due
  const [dueAmount, setDueAmount] = useState<number | ''>('');
  const [dueNote, setDueNote] = useState('');

  // Auto-sync selected supplier when suppliers array updates
  const selectedSupplier = useMemo(() => {
    if (!selectedSupplierId) return null;
    return suppliers.find((s) => s.id === selectedSupplierId) || null;
  }, [suppliers, selectedSupplierId]);

  // Keep activeSupplier fresh with suppliers list
  const currentActiveSupplier = useMemo(() => {
    if (!activeSupplier) return null;
    return suppliers.find((s) => s.id === activeSupplier.id) || activeSupplier;
  }, [suppliers, activeSupplier]);

  // Total payable calculations
  const totalPayableDue = useMemo(() => {
    return Math.round(
      suppliers.reduce((acc, s) => acc + (s.totalDue ?? s.totalPayableDue ?? 0), 0)
    );
  }, [suppliers]);

  const dueSuppliersCount = useMemo(() => {
    return suppliers.filter((s) => (s.totalDue ?? s.totalPayableDue ?? 0) > 0).length;
  }, [suppliers]);

  // Filter suppliers by search
  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.company && s.company.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q))
    );
  }, [suppliers, searchQuery]);

  // Selected supplier transactions
  const currentSupplierTxs = useMemo(() => {
    const target = selectedSupplier || currentActiveSupplier;
    if (!target) return [];
    return supplierTransactions
      .filter((tx) => tx.supplierId === target.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [supplierTransactions, selectedSupplier, currentActiveSupplier]);

  // Submit Add Supplier
  const handleAddSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const due = Number(initialDue) || 0;
    const newSupp: Supplier = {
      id: `supp_${Date.now()}`,
      name: name.trim(),
      company: company.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim() || '---',
      address: address.trim(),
      totalDue: due,
      totalPayableDue: due,
      createdAt: new Date().toISOString(),
    };

    onAddSupplier(newSupp);
    setSelectedSupplierId(newSupp.id);

    setName('');
    setCompany('');
    setContactPerson('');
    setPhone('');
    setAddress('');
    setInitialDue('');
    setShowAddSupplierModal(false);
    playSuccessChime();
  };

  // Submit Edit Supplier
  const handleEditSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !name.trim()) return;

    const target = suppliers.find((s) => s.id === editId);
    if (!target) return;

    const updatedSupp: Supplier = {
      ...target,
      name: name.trim(),
      company: company.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim() || '---',
      address: address.trim(),
      // Balance is strictly locked & read-only in Edit modal
      totalDue: target.totalDue ?? 0,
      totalPayableDue: target.totalPayableDue ?? target.totalDue ?? 0,
    };

    onUpdateSupplier(updatedSupp);
    setShowEditSupplierModal(false);
    playSuccessChime();
  };

  const openEditModal = (supp: Supplier) => {
    setEditId(supp.id);
    setName(supp.name);
    setCompany(supp.company || '');
    setContactPerson(supp.contactPerson || '');
    setPhone(supp.phone === '---' ? '' : supp.phone);
    setAddress(supp.address || '');
    setInitialDue(supp.totalDue ?? supp.totalPayableDue ?? 0);
    setShowEditSupplierModal(true);
  };

  // Submit Payment to Supplier
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = currentActiveSupplier || selectedSupplier;
    if (!target) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return;

    const currentDue = target.totalDue ?? target.totalPayableDue ?? 0;
    const newBalance = Math.max(0, currentDue - amount);
    const fullNote = paymentNote.trim()
      ? `${paymentNote.trim()} (${paymentMethod})`
      : `টাকা পরিশোধ (${paymentMethod})`;

    onPaySupplier(target.id, amount, fullNote, newBalance);

    setPaymentAmount('');
    setPaymentNote('');
    setShowPaymentModal(false);
    playSuccessChime();
  };

  // Submit Add Credit Purchase Due
  const handleAddDueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = currentActiveSupplier || selectedSupplier;
    if (!target) return;
    const amount = Number(dueAmount);
    if (!amount || amount <= 0) return;

    const currentDue = target.totalDue ?? target.totalPayableDue ?? 0;
    const newBalance = currentDue + amount;
    const note = dueNote.trim() || 'নতুন মাল ক্রয় বাবদ বাকি';

    onAddSupplierDue(target.id, amount, note, newBalance);

    setDueAmount('');
    setDueNote('');
    setShowAddDueModal(false);
    playSuccessChime();
  };

  // Delete Supplier Confirmation
  const handleDeleteSubmit = () => {
    const target = currentActiveSupplier || selectedSupplier;
    if (!target) return;
    onDeleteSupplier(target.id);
    setShowDeleteConfirmModal(false);
    setShowDetailModal(false);
    setSelectedSupplierId(null);
    setActiveSupplier(null);
  };

  // Share Supplier statement via WhatsApp (Locked in Normal Mode after 60 days)
  const handleShareWhatsApp = (supplier: Supplier) => {
    if (appMode === 'normal') {
      if (onOpenSubscriptionModal) {
        onOpenSubscriptionModal();
      } else {
        alert('🔒 ৬০ দিনের ফ্রি ট্রায়াল শেষ! সাপ্লায়ারকে হোয়াটসঅ্যাপ মেসেজ পাঠাতে Pro সাবস্ক্রিপশন চালু করুন।');
      }
      return;
    }

    const cleanPhone = (supplier.phone || '').replace(/\D/g, '').slice(-11);
    const fullPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    const dateStr = new Date().toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const due = supplier.totalDue ?? supplier.totalPayableDue ?? 0;
    const msg = `🏢 *${profile.shopName || 'সহজ দোকান'}*
📍 ${profile.address || 'বাংলাদেশ'} | 📞 ${profile.phone}
--------------------------------
সম্মানিত মহাজন/সাপ্লায়ার: *${supplier.name}*
${supplier.company ? `কোম্পানি: ${supplier.company}` : ''}
${supplier.contactPerson ? `প্রতিনিধি: ${supplier.contactPerson}` : ''}
তারিখ: ${dateStr}
--------------------------------
আপনার নিকট আমাদের বর্তমান মোট দেনা/বাকি:
👉 *৳${due.toLocaleString()}*
--------------------------------
হিসাব সংক্রান্ত প্রয়োজনে যোগাযোগ করুন: ${profile.phone}
সহজ দোকান POS দ্বারা পরিচালিত`;

    const waUrl =
      fullPhone.length >= 10
        ? `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(msg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    if (typeof window !== 'undefined' && (window as any).AndroidApp?.openWhatsApp) {
      try {
        (window as any).AndroidApp.openWhatsApp(waUrl);
        return;
      } catch (_) {}
    }
    window.open(waUrl, '_blank');
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

  const totalSupplierDueAddedToday = useMemo(() => {
    const todayStr = getLocalDateStr(new Date());
    return Math.round(
      supplierTransactions
        .filter(
          (tx) => getLocalDateStr(tx.date) === todayStr && tx.type === 'purchase_due'
        )
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );
  }, [supplierTransactions]);

  const totalSupplierPaidToday = useMemo(() => {
    const todayStr = getLocalDateStr(new Date());
    return Math.round(
      supplierTransactions
        .filter(
          (tx) => getLocalDateStr(tx.date) === todayStr && tx.type === 'payment_made'
        )
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    );
  }, [supplierTransactions]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Main Summary Card matching Customer Baki Khata */}
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

        <div className="grid grid-cols-2 divide-x divide-[#E2E8F0] mb-3">
          {/* Left: মহাজনের মোট পাওনা (দেনা) / আজকের বাকি মাল ক্রয় */}
          <div className="text-center pr-2">
            <p className="text-xs font-semibold text-[#64748B] mb-1">
              {summaryTimeMode === 'all'
                ? 'মহাজনের মোট পাওনা (দেনা)'
                : 'আজকের বাকি মাল ক্রয়'}
            </p>
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-xl sm:text-2xl font-extrabold text-[#D32F2F] tracking-tight">
                ৳{' '}
                {summaryTimeMode === 'all'
                  ? totalPayableDue.toLocaleString()
                  : totalSupplierDueAddedToday.toLocaleString()}
              </p>
              {summaryTimeMode === 'today' && (
                <span className="text-xs font-bold text-[#D32F2F]">↗</span>
              )}
            </div>
          </div>

          {/* Right: বাকি থাকা মহাজন / আজকের পরিশোধ (জমা) */}
          <div className="text-center pl-2">
            <p className="text-xs font-semibold text-[#64748B] mb-1">
              {summaryTimeMode === 'all'
                ? 'পাওনা বাকি থাকা মহাজন'
                : 'আজকের পরিশোধ (জমা)'}
            </p>
            {summaryTimeMode === 'all' ? (
              <p className="text-xl sm:text-2xl font-extrabold text-[#0E6B6B] tracking-tight">
                {dueSuppliersCount} জন
              </p>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-xl sm:text-2xl font-extrabold text-[#2E7D32] tracking-tight">
                  ৳ {totalSupplierPaidToday.toLocaleString()}
                </p>
                <span className="text-xs font-bold text-[#2E7D32]">↙</span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setName('');
            setCompany('');
            setContactPerson('');
            setPhone('');
            setAddress('');
            setInitialDue('');
            setShowAddSupplierModal(true);
          }}
          className="w-full py-2.5 px-4 rounded-2xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>নতুন সাপ্লায়ার যোগ করুন</span>
        </button>
      </div>

      {/* Search bar matching Customer Baki Khata */}
      <div className="flex items-center gap-2 mb-2.5 shrink-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#9AA5B1]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="সাপ্লায়ার, কোম্পানি, ফোন বা মোকাম খুঁজুন..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E2E8F0] text-xs sm:text-sm text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B] shadow-xs"
          />
        </div>
      </div>

      {/* Supplier Cards List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 pb-16">
        {filteredSuppliers.length === 0 ? (
          <div className="bg-white rounded-[24px] p-8 text-center border border-[#E2E8F0] shadow-xs">
            <Building2 className="w-10 h-10 text-[#9AA5B1] mx-auto mb-2 stroke-1" />
            <p className="text-xs font-semibold text-[#64748B]">
              কোনো সাপ্লায়ার পাওয়া যায়নি
            </p>
          </div>
        ) : (
          filteredSuppliers.map((supp) => {
            const due = supp.totalDue ?? supp.totalPayableDue ?? 0;
            const hasDue = due > 0;

            return (
              <div
                key={supp.id}
                onClick={() => {
                  setSelectedSupplierId(supp.id);
                  setActiveSupplier(supp);
                  setShowDetailModal(true);
                }}
                className="bg-white rounded-[20px] p-3.5 border border-[#E2E8F0] hover:border-[#0E6B6B] shadow-xs transition-all cursor-pointer"
              >
                {/* Top row: Avatar, Name, Company, Due */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Circular Avatar matching Customer Baki Khata */}
                    <div className="w-11 h-11 rounded-full bg-[#E0F2F1] text-[#0E6B6B] font-bold text-lg flex items-center justify-center shrink-0">
                      {supp.name.slice(0, 1)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm sm:text-base text-[#102A43] truncate">
                          {supp.name}
                        </h4>
                        {supp.company && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#E3F2FD] text-[#1976D2] font-bold truncate max-w-[150px]">
                            {supp.company}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-[#64748B] flex-wrap">
                        {supp.contactPerson && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-[#0E6B6B]" />
                            <span>{supp.contactPerson}</span>
                          </span>
                        )}
                        <span className="font-mono">{supp.phone}</span>
                        {supp.address && <span>• {supp.address}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-semibold text-[#64748B] block">
                      {hasDue ? 'পাওনা বাকি' : 'পরিশোধিত'}
                    </span>
                    <div
                      className={`text-base sm:text-lg font-extrabold font-mono ${
                        hasDue ? 'text-[#D32F2F]' : 'text-[#2E7D32]'
                      }`}
                    >
                      ৳{due.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Bottom row: Direct Quick Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-[#F1F5F9] flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {/* + বাকি দিন বাটন */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSupplier(supp);
                        setSelectedSupplierId(supp.id);
                        setDueAmount('');
                        setDueNote('');
                        setShowAddDueModal(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#FFEBEE] hover:bg-rose-200 text-[#D32F2F] border border-rose-200 text-xs font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer"
                      title="সাপ্লায়ার থেকে নতুন বাকি মাল ক্রয় যোগ করুন"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>+ বাকি</span>
                    </button>

                    {/* টাকা দিন / পরিশোধ বাটন */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSupplier(supp);
                        setSelectedSupplierId(supp.id);
                        setPaymentAmount(due > 0 ? due : '');
                        setPaymentNote('');
                        setShowPaymentModal(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#E8F5E9] hover:bg-emerald-200 text-[#2E7D32] border border-emerald-200 text-xs font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer"
                      title="মহাজনকে টাকা জমা / পরিশোধ করুন"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>টাকা দিন</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(supp);
                      }}
                      className="p-1.5 rounded-xl bg-[#EDF2F7] hover:bg-slate-200 text-[#64748B] transition active:scale-95 cursor-pointer"
                      title="সাপ্লায়ারের তথ্য এডিট করুন"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSupplier(supp);
                        setSelectedSupplierId(supp.id);
                        setShowDeleteConfirmModal(true);
                      }}
                      className="p-1.5 rounded-xl bg-[#FFEBEE] hover:bg-rose-200 text-[#D32F2F] transition active:scale-95 cursor-pointer"
                      title="সাপ্লায়ার ডিলিট করুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* WhatsApp Button (Locked in Normal Mode after 60 days) */}
                    {supp.phone && supp.phone !== '---' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareWhatsApp(supp);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer ${
                          appMode === 'normal'
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] border-[#B2DFDB]'
                        }`}
                        title={
                          appMode === 'normal'
                            ? 'মহাজনের হোয়াটসঅ্যাপে হিসাব পাঠাতে Pro আনলক করুন'
                            : 'মহাজনের হোয়াটসঅ্যাপে হিসাব পাঠান'
                        }
                      >
                        {appMode === 'normal' ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            <span>হোয়াটসঅ্যাপ (Pro)</span>
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">হোয়াটসঅ্যাপ</span>
                          </>
                        )}
                      </button>
                    )}

                    <span className="text-[11px] font-bold text-[#0E6B6B] flex items-center gap-0.5">
                      <span>খাতা</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Supplier Ledger & Details Modal */}
      {showDetailModal && (selectedSupplier || currentActiveSupplier) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-lg my-auto rounded-3xl bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 bg-[#0E6B6B] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/10">
                  <Building2 className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    {(selectedSupplier || currentActiveSupplier)?.name}
                  </h3>
                  <p className="text-xs text-emerald-100">
                    {(selectedSupplier || currentActiveSupplier)?.company || 'মহাজন / পাইকারি ডিলার'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
              {/* Profile Card & Info */}
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 text-xs text-[#102A43]">
                    {(selectedSupplier || currentActiveSupplier)?.contactPerson && (
                      <p className="flex items-center gap-1 font-semibold">
                        <User className="w-3.5 h-3.5 text-[#0E6B6B]" />
                        <span>প্রতিনিধি: {(selectedSupplier || currentActiveSupplier)?.contactPerson}</span>
                      </p>
                    )}
                    <p className="flex items-center gap-1 font-mono text-[#64748B]">
                      <Phone className="w-3.5 h-3.5 text-[#0E6B6B]" />
                      <span>{(selectedSupplier || currentActiveSupplier)?.phone}</span>
                    </p>
                    {(selectedSupplier || currentActiveSupplier)?.address && (
                      <p className="flex items-center gap-1 text-[#64748B]">
                        <MapPin className="w-3.5 h-3.5 text-[#0E6B6B]" />
                        <span>{(selectedSupplier || currentActiveSupplier)?.address}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedSupplier || currentActiveSupplier;
                        if (target) openEditModal(target);
                      }}
                      className="p-2 rounded-xl bg-white text-[#102A43] hover:bg-[#EDF2F7] text-xs font-bold border border-[#E2E8F0] flex items-center gap-1 cursor-pointer transition active:scale-95"
                      title="সাপ্লায়ার তথ্য এডিট"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>এডিট</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirmModal(true)}
                      className="p-2 rounded-xl bg-[#FFEBEE] text-[#D32F2F] hover:bg-rose-200 text-xs font-bold border border-rose-200 transition active:scale-95 cursor-pointer"
                      title="সাপ্লায়ার ডিলিট"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Big Due Balance Box */}
                <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-xs text-[#64748B] font-bold">
                    বর্তমান মোট দেনা / বাকি:
                  </span>
                  <span className="text-2xl font-black font-mono text-[#D32F2F]">
                    ৳{(
                      (selectedSupplier || currentActiveSupplier)?.totalDue ??
                      (selectedSupplier || currentActiveSupplier)?.totalPayableDue ??
                      0
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Add Due & Pay Money */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedSupplier || currentActiveSupplier;
                    if (target) {
                      setActiveSupplier(target);
                      setDueAmount('');
                      setDueNote('');
                      setShowAddDueModal(true);
                    }
                  }}
                  className="py-3 px-3 rounded-2xl bg-[#D32F2F] hover:bg-red-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>+ নতুন বাকি যোগ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = selectedSupplier || currentActiveSupplier;
                    if (target) {
                      setActiveSupplier(target);
                      const due = target.totalDue ?? target.totalPayableDue ?? 0;
                      setPaymentAmount(due > 0 ? due : '');
                      setPaymentNote('');
                      setShowPaymentModal(true);
                    }
                  }}
                  className="py-3 px-3 rounded-2xl bg-[#2E7D32] hover:bg-green-800 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>টাকা পরিশোধ</span>
                </button>
              </div>

              {/* WhatsApp Share Button (Locked in Normal Mode after 60 days) */}
              {(selectedSupplier || currentActiveSupplier)?.phone && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedSupplier || currentActiveSupplier;
                    if (target) handleShareWhatsApp(target);
                  }}
                  className={`w-full py-2.5 px-3 rounded-2xl border font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                    appMode === 'normal'
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] border-[#B2DFDB]'
                  }`}
                >
                  {appMode === 'normal' ? (
                    <>
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>মহাজনের হোয়াটসঅ্যাপে মেমো পাঠান (Pro লক)</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4" />
                      <span>মহাজনের হোয়াটসঅ্যাপে মেমো ও হিসাব পাঠান</span>
                    </>
                  )}
                </button>
              )}

              {/* Transactions History Table */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#102A43] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#0E6B6B]" />
                    <span>লেনদেনের পূর্ণ খতিয়ান ({currentSupplierTxs.length})</span>
                  </h4>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {currentSupplierTxs.length === 0 ? (
                    <div className="p-6 text-center text-[#64748B] bg-[#F8FAFC] rounded-2xl border border-dashed border-[#E2E8F0] text-xs">
                      এখনও কোনো লেনদেনের রেকর্ড নেই
                    </div>
                  ) : (
                    currentSupplierTxs.map((tx) => {
                      const isPayment = tx.type === 'payment_made' || tx.type === 'payment_given';

                      return (
                        <div
                          key={tx.id}
                          className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`p-2 rounded-xl shrink-0 ${
                                isPayment
                                  ? 'bg-[#E8F5E9] text-[#2E7D32]'
                                  : 'bg-[#FFEBEE] text-[#D32F2F]'
                              }`}
                            >
                              {isPayment ? (
                                <TrendingDown className="w-3.5 h-3.5" />
                              ) : (
                                <TrendingUp className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-[#102A43]">
                                {isPayment ? 'টাকা পরিশোধ / জমা' : 'মাল ক্রয় বাকি'}
                              </p>
                              <p className="text-[11px] text-[#64748B]">
                                {new Date(tx.date).toLocaleDateString('bn-BD', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                                {tx.note ? ` • ${tx.note}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p
                              className={`font-mono font-black ${
                                isPayment ? 'text-[#2E7D32]' : 'text-[#D32F2F]'
                              }`}
                            >
                              {isPayment ? '-' : '+'}৳{tx.amount.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-[#64748B] font-mono">
                              অবশিষ্ট: ৳{tx.balanceAfter.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-md my-auto rounded-3xl bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 bg-[#0E6B6B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">নতুন সাপ্লায়ার / মহাজন যোগ</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplierSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  মহাজন বা কোম্পানির নাম *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: মেসার্স রহিম রাইস মিল / প্রাণ ডিলার"
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] placeholder-[#9AA5B1] text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    ব্র্যান্ড / কোম্পানি
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="যেমন: তীর, রূপচাঁদা, স্কয়ার"
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] placeholder-[#9AA5B1] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    প্রতিনিধি / সেলসম্যান
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="নাম"
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] placeholder-[#9AA5B1] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    মোবাইল নম্বর
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] placeholder-[#9AA5B1] text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    মোকাম / ঠিকানা
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="মৌলভীবাজার, ঢাকা"
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] placeholder-[#9AA5B1] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  পূর্বের বাকি / দেনা (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  value={initialDue}
                  onChange={(e) => setInitialDue(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] placeholder-[#9AA5B1] text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-[#102A43] text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {showEditSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-md my-auto rounded-3xl bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 bg-[#0E6B6B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">সাপ্লায়ার তথ্য এডিট</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditSupplierModal(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSupplierSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  মহাজন বা কোম্পানির নাম *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    কোম্পানি / ব্র্যান্ড
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    প্রতিনিধি
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    মোবাইল নম্বর
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    মোকাম / ঠিকানা
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1 flex items-center justify-between">
                  <span>বর্তমান বাকি ব্যালেন্স (৳)</span>
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
                    value={initialDue}
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
                  onClick={() => setShowEditSupplierModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-[#102A43] text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
                >
                  আপডেট করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Modal */}
      {showPaymentModal && (currentActiveSupplier || selectedSupplier) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-md my-auto rounded-3xl bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 bg-[#2E7D32] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">মহাজনকে টাকা পরিশোধ / জমা দিন</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4">
              <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#102A43]">
                    {(currentActiveSupplier || selectedSupplier)?.name}
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    {(currentActiveSupplier || selectedSupplier)?.company || 'সাপ্লায়ার'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#64748B] block">বর্তমান পাওনা:</span>
                  <span className="text-base font-black font-mono text-[#D32F2F]">
                    ৳{(
                      (currentActiveSupplier || selectedSupplier)?.totalDue ??
                      (currentActiveSupplier || selectedSupplier)?.totalPayableDue ??
                      0
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  পরিশোধকৃত টাকার পরিমাণ (৳) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="যেমন: 5000"
                  className="w-full p-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-base font-black font-mono text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1.5">
                  পরিশোধের মাধ্যম
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: 'নগদ ক্যাশ' },
                    { id: 'bkash', label: 'বিকাশ' },
                    { id: 'nagad', label: 'নগদ' },
                    { id: 'bank', label: 'ব্যাংক' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        paymentMethod === m.id
                          ? 'border-[#2E7D32] bg-[#E8F5E9] text-[#2E7D32]'
                          : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#102A43]">
                    নোট / বিবরণ (ঐচ্ছিক)
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
                  placeholder="যেমন: রসিদ নং / ব্যাংক চেক নং বা ভুল হিসাব সংশোধন"
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] placeholder-[#9AA5B1] text-xs focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                />
              </div>

              {/* Automatic Calculation Preview */}
              {Number(paymentAmount) > 0 && (
                <div className="p-3 rounded-xl bg-[#E8F5E9] border border-emerald-200 flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#2E7D32]">
                    পরিশোধের পর অবশিষ্ট দেনা থাকবে:
                  </span>
                  <span className="font-mono font-black text-sm text-[#2E7D32]">
                    ৳{Math.max(
                      0,
                      ((currentActiveSupplier || selectedSupplier)?.totalDue ?? 0) - Number(paymentAmount)
                    ).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-3 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-[#102A43] text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#2E7D32] hover:bg-green-800 text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
                >
                  পরিশোধ নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Due (Credit Purchase) Modal */}
      {showAddDueModal && (currentActiveSupplier || selectedSupplier) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-md my-auto rounded-3xl bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 bg-[#D32F2F] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-base">মহাজন থেকে নতুন বাকি ক্রয় যোগ</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDueModal(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDueSubmit} className="p-5 space-y-4">
              <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#102A43]">
                    {(currentActiveSupplier || selectedSupplier)?.name}
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    {(currentActiveSupplier || selectedSupplier)?.company || 'সাপ্লায়ার'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#64748B] block">বর্তমান পাওনা:</span>
                  <span className="text-base font-black font-mono text-[#D32F2F]">
                    ৳{(
                      (currentActiveSupplier || selectedSupplier)?.totalDue ??
                      (currentActiveSupplier || selectedSupplier)?.totalPayableDue ??
                      0
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  নতুন বাকির পরিমাণ (৳) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={dueAmount}
                  onChange={(e) => setDueAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="যেমন: 12000"
                  className="w-full p-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-base font-black font-mono text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#D32F2F]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#102A43]">
                    চালানের বিবরণ / পণ্যের নাম *
                  </label>
                  <button
                    type="button"
                    onClick={() => setDueNote('ভুল হিসাব সংশোধন')}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FFEBEE] text-[#D32F2F] hover:bg-rose-100 cursor-pointer"
                  >
                    + ভুল হিসাব সংশোধন
                  </button>
                </div>
                <input
                  type="text"
                  value={dueNote}
                  onChange={(e) => setDueNote(e.target.value)}
                  placeholder="যেমন: মিনিকেট চাল ৫ বস্তা চালান নং #551 বা ভুল হিসাব সংশোধন"
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#D32F2F]"
                />
              </div>

              {/* Automatic Calculation Preview */}
              {Number(dueAmount) > 0 && (
                <div className="p-3 rounded-xl bg-[#FFEBEE] border border-rose-200 flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#D32F2F]">
                    যোগের পর মোট দেনা হবে:
                  </span>
                  <span className="font-mono font-black text-sm text-[#D32F2F]">
                    ৳{(
                      ((currentActiveSupplier || selectedSupplier)?.totalDue ?? 0) + Number(dueAmount)
                    ).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDueModal(false)}
                  className="flex-1 py-3 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-[#102A43] text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
                >
                  বাকি যুক্ত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Supplier Confirmation Modal */}
      {showDeleteConfirmModal && (currentActiveSupplier || selectedSupplier) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-[#E2E8F0] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#102A43]">
                সাপ্লায়ার মুছে ফেলতে চান?
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                <strong className="text-[#102A43]">{(currentActiveSupplier || selectedSupplier)?.name}</strong> এর হিসাব ও সকল লেনদেন মুছে যাবে।
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-xs font-bold text-[#102A43]"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className="flex-1 py-2.5 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
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
