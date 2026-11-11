import React, { useState, useMemo } from 'react';
import {
  BulkPurchase,
  BulkPurchaseItem,
  Supplier,
  Product,
  ShopProfile,
  Language,
} from '../types';
import { translations } from '../i18n/translations';
import { playSuccessChime } from '../utils/audio';
import { DB } from '../storage/db';
import {
  PackagePlus,
  Plus,
  Trash2,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
} from 'lucide-react';

interface Props {
  bulkPurchases: BulkPurchase[];
  suppliers: Supplier[];
  products: Product[];
  profile: ShopProfile;
  language: Language;
  onAddBulkPurchase: (
    purchase: BulkPurchase,
    updatedProducts: Product[],
    supplierDueAddition?: { supplierId: string; dueAmount: number }
  ) => void;
  onUpdateBulkPurchase?: (
    purchase: BulkPurchase,
    updatedProducts?: Product[]
  ) => void;
  onDeleteBulkPurchase?: (id: string) => void;
  onOpenSupplierKhata?: () => void;
}

export const BulkPurchaseManager: React.FC<Props> = ({
  bulkPurchases,
  suppliers,
  products,
  profile,
  language,
  onAddBulkPurchase,
  onUpdateBulkPurchase,
  onDeleteBulkPurchase = () => {},
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

  const formatDateDDMMYYYY = (d?: string | Date): string => {
    const ymd = getLocalDateStr(d);
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
    const [yyyy, mm, dd] = ymd.split('-');
    return `${dd}-${mm}-${yyyy}`;
  };

  const todayStr = getLocalDateStr(new Date());
  const yesterdayStr = getLocalDateStr(new Date(Date.now() - 24 * 3600 * 1000));

  // Date filters: 'today', 'yesterday', 'all', 'custom'
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'yesterday' | 'all' | 'custom'>('today');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<BulkPurchase | null>(null);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState<BulkPurchase | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form States
  const [supplierNameInput, setSupplierNameInput] = useState<string>('');
  const [purchaseNote, setPurchaseNote] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayStr);

  // Cart of items in this bulk purchase
  const [items, setItems] = useState<BulkPurchaseItem[]>([
    {
      productId: '',
      productName: '',
      category: 'মুদি আইটেম',
      quantity: 1,
      unit: 'kg',
      unitCostPrice: 0,
      totalCost: 0,
    },
  ]);

  // Handle item change
  const handleItemChange = (index: number, field: keyof BulkPurchaseItem, val: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: val };

    // If product is picked from catalog
    if (field === 'productId') {
      const match = products.find((p) => p.id === val);
      if (match) {
        current.productName = match.name;
        current.category = match.category;
        current.unit = match.unit;
        current.unitCostPrice = match.costPrice;
        current.totalCost = Math.round(match.costPrice * (current.quantity || 1));
      }
    }

    if (field === 'quantity' || field === 'unitCostPrice') {
      const q = field === 'quantity' ? Number(val) || 0 : current.quantity || 0;
      const rate = field === 'unitCostPrice' ? Number(val) || 0 : current.unitCostPrice || 0;
      current.totalCost = Math.round(q * rate);
    }

    updated[index] = current;
    setItems(updated);
  };

  const handleAddItemRow = () => {
    setItems([
      ...items,
      {
        productId: '',
        productName: '',
        category: 'মুদি আইটেম',
        quantity: 1,
        unit: 'kg',
        unitCostPrice: 0,
        totalCost: 0,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Grand Total of purchase
  const purchaseGrandTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.totalCost || 0), 0);
  }, [items]);

  // Effective filter date string
  const effectiveFilterDate = useMemo(() => {
    if (dateFilterMode === 'today') return todayStr;
    if (dateFilterMode === 'yesterday') return yesterdayStr;
    if (dateFilterMode === 'custom') return selectedDate;
    return '';
  }, [dateFilterMode, todayStr, yesterdayStr, selectedDate]);

  // Overall statistics
  const totalAllPurchases = useMemo(() => {
    return Math.round(bulkPurchases.reduce((sum, p) => sum + p.totalAmount, 0));
  }, [bulkPurchases]);

  const todayPurchasesTotal = useMemo(() => {
    return Math.round(
      bulkPurchases
        .filter((p) => {
          const pLocal = getLocalDateStr(p.date);
          const pRaw = (p.date || '').slice(0, 10);
          const createdLocal = getLocalDateStr(p.createdAt);
          return pLocal === todayStr || pRaw === todayStr || createdLocal === todayStr;
        })
        .reduce((sum, p) => sum + p.totalAmount, 0)
    );
  }, [bulkPurchases, todayStr]);

  // Filter purchases by date and search query
  const filteredPurchases = useMemo(() => {
    let list = bulkPurchases;

    // Date filter
    if (dateFilterMode !== 'all') {
      list = list.filter((p) => {
        const pLocal = getLocalDateStr(p.date);
        const pRaw = (p.date || '').slice(0, 10);
        const createdLocal = getLocalDateStr(p.createdAt);
        return (
          pLocal === effectiveFilterDate ||
          pRaw === effectiveFilterDate ||
          createdLocal === effectiveFilterDate
        );
      });
    }

    // Search query: supplier name, product names, and date string (e.g. 10 Nov, 10/11, 10-11-2026)
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    const bnMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const enMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    return list.filter((p) => {
      const pNo = p.purchaseNo.toLowerCase();
      const supMatch = p.supplierName && p.supplierName.toLowerCase().includes(q);
      const noteMatch = p.note && p.note.toLowerCase().includes(q);
      const prodMatch = p.items.some((it) => it.productName.toLowerCase().includes(q));

      // Date match checks
      const ymd = getLocalDateStr(p.date);
      const ddmm = formatDateDDMMYYYY(p.date); // e.g. 10-11-2026
      const slash = ddmm.replace(/-/g, '/'); // 10/11/2026
      const slashShort = ddmm.slice(0, 5).replace(/-/g, '/'); // 10/11

      let monthNameEn = '';
      let monthNameBn = '';
      try {
        const dObj = new Date(p.date);
        const mIdx = dObj.getMonth();
        monthNameEn = `${dObj.getDate()} ${enMonths[mIdx]}`.toLowerCase();
        monthNameBn = `${dObj.getDate()} ${bnMonths[mIdx]}`.toLowerCase();
      } catch (_) {}

      const dateMatch =
        ymd.includes(q) ||
        ddmm.includes(q) ||
        slash.includes(q) ||
        slashShort.includes(q) ||
        monthNameEn.includes(q) ||
        monthNameBn.includes(q);

      return pNo.includes(q) || supMatch || noteMatch || prodMatch || dateMatch;
    });
  }, [bulkPurchases, dateFilterMode, effectiveFilterDate, searchQuery]);

  const filteredPurchasesTotal = useMemo(() => {
    return Math.round(filteredPurchases.reduce((sum, p) => sum + p.totalAmount, 0));
  }, [filteredPurchases]);

  // Open Add modal
  const handleOpenAddModal = () => {
    setEditingPurchase(null);
    setSupplierNameInput('');
    setPurchaseNote('');
    setPurchaseDate(todayStr);
    setItems([
      {
        productId: '',
        productName: '',
        category: 'মুদি আইটেম',
        quantity: 1,
        unit: 'kg',
        unitCostPrice: 0,
        totalCost: 0,
      },
    ]);
    setShowNewPurchaseModal(true);
  };

  // Open Edit modal
  const handleOpenEditModal = (purchase: BulkPurchase) => {
    setEditingPurchase(purchase);
    setSupplierNameInput(purchase.supplierName || '');
    setPurchaseNote(purchase.note || '');
    setPurchaseDate(getLocalDateStr(purchase.date) || todayStr);
    setItems(
      purchase.items.map((it) => ({
        ...it,
      }))
    );
    setShowNewPurchaseModal(true);
  };

  // Submit New or Updated Bulk Purchase
  const handleSubmitPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || purchaseGrandTotal <= 0) {
      return;
    }

    const trimmedSupplierName = supplierNameInput.trim();
    const matchedSupplier = suppliers.find(
      (s) => s.name.trim().toLowerCase() === trimmedSupplierName.toLowerCase()
    );

    let formattedPurchaseDate = new Date().toISOString();
    if (purchaseDate && purchaseDate !== todayStr) {
      try {
        const [y, m, d] = purchaseDate.split('-').map(Number);
        const dt = new Date();
        dt.setFullYear(y, m - 1, d);
        formattedPurchaseDate = dt.toISOString();
      } catch {
        formattedPurchaseDate = new Date(purchaseDate).toISOString();
      }
    }

    // Prepare updated inventory products
    const updatedProducts = [...products];

    if (editingPurchase) {
      // Revert old purchase items quantities from products
      editingPurchase.items.forEach((oldItem) => {
        const mIdx = updatedProducts.findIndex(
          (p) =>
            (oldItem.productId && p.id === oldItem.productId) ||
            p.name.trim().toLowerCase() === oldItem.productName.trim().toLowerCase()
        );
        if (mIdx >= 0) {
          updatedProducts[mIdx] = {
            ...updatedProducts[mIdx],
            stock: Math.max(0, updatedProducts[mIdx].stock - oldItem.quantity),
          };
        }
      });

      // Apply new purchase items quantities to products
      items.forEach((newItem) => {
        if (!newItem.productName.trim() || newItem.totalCost <= 0) return;
        const mIdx = updatedProducts.findIndex(
          (p) =>
            (newItem.productId && p.id === newItem.productId) ||
            p.name.trim().toLowerCase() === newItem.productName.trim().toLowerCase()
        );
        if (mIdx >= 0) {
          const prod = updatedProducts[mIdx];
          updatedProducts[mIdx] = {
            ...prod,
            stock: prod.stock + newItem.quantity,
            costPrice: newItem.unitCostPrice > 0 ? newItem.unitCostPrice : prod.costPrice,
            updatedAt: new Date().toISOString(),
          };
        }
      });

      const updatedPurchase: BulkPurchase = {
        ...editingPurchase,
        date: formattedPurchaseDate,
        supplierId: matchedSupplier ? matchedSupplier.id : editingPurchase.supplierId,
        supplierName: trimmedSupplierName || 'নগদ ক্রয় রসিদ',
        supplierPhone: matchedSupplier ? matchedSupplier.phone : editingPurchase.supplierPhone,
        items: items.filter((it) => it.productName.trim() && it.totalCost > 0),
        totalAmount: purchaseGrandTotal,
        paidAmount: purchaseGrandTotal,
        dueAmount: 0,
        paymentType: 'cash',
        note: purchaseNote.trim() || undefined,
      };

      if (onUpdateBulkPurchase) {
        onUpdateBulkPurchase(updatedPurchase, updatedProducts);
      } else {
        const allList = DB.getBulkPurchases();
        const nextList = allList.map((p: BulkPurchase) =>
          p.id === editingPurchase.id ? updatedPurchase : p
        );
        DB.saveBulkPurchases(nextList);
        DB.saveProducts(updatedProducts);
        onAddBulkPurchase(updatedPurchase, updatedProducts, undefined);
      }

      setShowNewPurchaseModal(false);
      setEditingPurchase(null);
      playSuccessChime();
      return;
    }

    const newPurchase: BulkPurchase = {
      id: `bp_${Date.now()}`,
      purchaseNo: `PO-${1000 + bulkPurchases.length + 1}`,
      date: formattedPurchaseDate,
      supplierId: matchedSupplier ? matchedSupplier.id : undefined,
      supplierName: trimmedSupplierName || 'নগদ ক্রয় রসিদ',
      supplierPhone: matchedSupplier ? matchedSupplier.phone : undefined,
      items: items.filter((it) => it.productName.trim() && it.totalCost > 0),
      totalAmount: purchaseGrandTotal,
      paidAmount: purchaseGrandTotal,
      dueAmount: 0,
      paymentType: 'cash',
      note: purchaseNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    // Auto-update products stock & cost price in inventory
    newPurchase.items.forEach((item) => {
      const matchIndex = updatedProducts.findIndex(
        (p) =>
          (item.productId && p.id === item.productId) ||
          p.name.trim().toLowerCase() === item.productName.trim().toLowerCase()
      );

      if (matchIndex >= 0) {
        const prod = updatedProducts[matchIndex];
        updatedProducts[matchIndex] = {
          ...prod,
          stock: prod.stock + item.quantity,
          costPrice: item.unitCostPrice > 0 ? item.unitCostPrice : prod.costPrice,
          updatedAt: new Date().toISOString(),
        };
      }
    });

    onAddBulkPurchase(newPurchase, updatedProducts, undefined);

    setShowNewPurchaseModal(false);
    setPurchaseNote('');
    setSupplierNameInput('');
    setItems([
      {
        productId: '',
        productName: '',
        category: 'মুদি আইটেম',
        quantity: 1,
        unit: 'kg',
        unitCostPrice: 0,
        totalCost: 0,
      },
    ]);
    playSuccessChime();
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Main Summary Card */}
      <div className="bg-white rounded-[24px] p-4 shadow-sm border border-[#E2E8F0] mb-3 shrink-0">
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {/* Today's purchases button */}
          <button
            type="button"
            onClick={() => {
              setDateFilterMode('today');
              setSelectedDate(todayStr);
            }}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
              dateFilterMode === 'today'
                ? 'bg-[#0E6B6B] text-white border-[#0E6B6B] shadow-md ring-2 ring-[#0E6B6B]/30'
                : 'bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[11px] font-bold ${dateFilterMode === 'today' ? 'text-teal-100' : 'text-[#15803D]'}`}>
                📦 আজকে মাল আনছি
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  dateFilterMode === 'today' ? 'bg-white/20 text-white' : 'bg-[#DCFCE7] text-[#166534]'
                }`}
              >
                আজ
              </span>
            </div>
            <p className={`text-lg sm:text-2xl font-black tracking-tight ${dateFilterMode === 'today' ? 'text-white' : 'text-[#166534]'}`}>
              ৳ {todayPurchasesTotal.toLocaleString()}
            </p>
            <p className={`text-[10px] font-medium mt-0.5 ${dateFilterMode === 'today' ? 'text-teal-100' : 'text-[#64748B]'}`}>
              {bulkPurchases.filter(p => getLocalDateStr(p.date) === todayStr).length} টি রসিদ
            </p>
          </button>

          {/* All purchases button */}
          <button
            type="button"
            onClick={() => setDateFilterMode('all')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
              dateFilterMode === 'all'
                ? 'bg-[#0E6B6B] text-white border-[#0E6B6B] shadow-md ring-2 ring-[#0E6B6B]/30'
                : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#1E293B] border-[#E2E8F0]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[11px] font-bold ${dateFilterMode === 'all' ? 'text-teal-100' : 'text-[#475569]'}`}>
                📋 সর্বমোট নগদ ক্রয়
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  dateFilterMode === 'all' ? 'bg-white/20 text-white' : 'bg-[#E2E8F0] text-[#475569]'
                }`}
              >
                মোট
              </span>
            </div>
            <p className={`text-lg sm:text-2xl font-black tracking-tight ${dateFilterMode === 'all' ? 'text-white' : 'text-[#1E293B]'}`}>
              ৳ {totalAllPurchases.toLocaleString()}
            </p>
            <p className={`text-[10px] font-medium mt-0.5 ${dateFilterMode === 'all' ? 'text-teal-100' : 'text-[#64748B]'}`}>
              {bulkPurchases.length} টি রসিদ
            </p>
          </button>
        </div>

        {/* Action Button: নতুন নগদ ক্রয় রসিদ লিখুন */}
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="w-full py-2.5 px-4 rounded-2xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <PackagePlus className="w-4 h-4 stroke-[2.5]" />
          <span>নতুন নগদ ক্রয় রসিদ লিখুন</span>
        </button>
      </div>

      {/* Main Content Card */}
      <div className="flex-1 flex flex-col bg-white rounded-[24px] p-4 shadow-xs border border-[#E2E8F0] min-h-[300px]">
        {/* Date Filter Bar: আজ, গতকাল, সব এবং তারিখ পিক করার ড্রপডাউন/ক্যালেন্ডার */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-wrap">
            <button
              type="button"
              onClick={() => {
                setDateFilterMode('today');
                setSelectedDate(todayStr);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                dateFilterMode === 'today'
                  ? 'bg-[#0E6B6B] text-white border-[#0E6B6B] shadow-2xs'
                  : 'bg-[#EDF2F7] text-[#64748B] border-[#E2E8F0] hover:bg-[#E0F2F1] hover:text-[#0E6B6B]'
              }`}
            >
              আজ
            </button>
            <button
              type="button"
              onClick={() => {
                setDateFilterMode('yesterday');
                setSelectedDate(yesterdayStr);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                dateFilterMode === 'yesterday'
                  ? 'bg-[#0E6B6B] text-white border-[#0E6B6B] shadow-2xs'
                  : 'bg-[#EDF2F7] text-[#64748B] border-[#E2E8F0] hover:bg-[#E0F2F1] hover:text-[#0E6B6B]'
              }`}
            >
              গতকাল
            </button>
            <button
              type="button"
              onClick={() => setDateFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                dateFilterMode === 'all'
                  ? 'bg-[#0E6B6B] text-white border-[#0E6B6B] shadow-2xs'
                  : 'bg-[#EDF2F7] text-[#64748B] border-[#E2E8F0] hover:bg-[#E0F2F1] hover:text-[#0E6B6B]'
              }`}
            >
              সব
            </button>
            <div className="flex items-center gap-1 bg-[#EDF2F7] px-2 py-0.5 rounded-xl border border-[#E2E8F0]">
              <Calendar className="w-3.5 h-3.5 text-[#0E6B6B]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setDateFilterMode('custom');
                  setSelectedDate(e.target.value);
                }}
                className="bg-transparent text-[#102A43] text-xs font-bold focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="text-right text-xs font-bold text-[#64748B]">
            মোট ক্রয় বিল:{' '}
            <span className="font-mono text-[#0E6B6B] text-sm font-black">
              ৳{filteredPurchasesTotal.toLocaleString()}
            </span>{' '}
            ({filteredPurchases.length}টি রসিদ)
          </div>
        </div>

        {/* Search Bar matching supplier, products, and date format (e.g. 10 Nov, 10/11) */}
        <div className="relative mb-3 shrink-0">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#9AA5B1]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="মহাজনের নাম, পণ্যের নাম বা তারিখ (যেমন: 10 Nov বা 10/11) দিয়ে খুঁজুন..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B] shadow-2xs"
          />
        </div>

        {/* Purchases Invoices List */}
        <div className="space-y-2.5">
          {filteredPurchases.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-6 text-[#64748B]">
              <PackagePlus className="w-12 h-12 text-[#9AA5B1] mb-2 stroke-1" />
              <p className="text-xs sm:text-sm font-bold text-[#102A43]">
                কোনো নগদ ক্রয় রসিদ রেকর্ড নেই
              </p>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="mt-3 px-4 py-2 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                + নগদ ক্রয় রসিদ লিখুন
              </button>
            </div>
          ) : (
            filteredPurchases.map((purchase) => {
              const isExpanded = expandedPurchaseId === purchase.id;

              return (
                <div
                  key={purchase.id}
                  className="rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#0E6B6B] overflow-hidden transition shadow-2xs"
                >
                  <div
                    onClick={() => setExpandedPurchaseId(isExpanded ? null : purchase.id)}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg bg-[#E0F2F1] text-[#0E6B6B] border border-[#B2DFDB]">
                          #{purchase.purchaseNo}
                        </span>
                        <h4 className="font-bold text-sm sm:text-base text-[#102A43] truncate">
                          {purchase.supplierName}
                        </h4>
                        <span className="text-xs text-[#64748B]">
                          ({purchase.items.length}টি পণ্য)
                        </span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-1 flex items-center gap-2">
                        <span>
                          {formatDateDDMMYYYY(purchase.date)}
                        </span>
                        {purchase.note && <span>• {purchase.note}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-sm sm:text-base font-black font-mono text-[#102A43] block">
                          ৳{purchase.totalAmount.toLocaleString()}
                        </span>
                        <span className="text-xs text-[#2E7D32] font-bold block">
                          নগদ পরিশোধিত
                        </span>
                      </div>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(purchase);
                        }}
                        className="p-2 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#B2DFDB] border border-[#B2DFDB] transition cursor-pointer"
                        title="রসিদ এডিট করুন"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPurchaseToDelete(purchase);
                        }}
                        className="p-2 rounded-xl bg-[#FFEBEE] text-[#D32F2F] hover:bg-rose-200 border border-rose-200 transition cursor-pointer"
                        title="রসিদ ডিলিট করুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="p-1.5 rounded-xl bg-[#EDF2F7] text-[#0E6B6B]">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expandable itemized table */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-[#E2E8F0] bg-white">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="text-[#64748B] border-b border-[#E2E8F0]">
                            <th className="py-2">পণ্যের বিবরণ</th>
                            <th className="py-2 text-center">পরিমাণ</th>
                            <th className="py-2 text-right">পাইকারি দর</th>
                            <th className="py-2 text-right">মোট টাকা</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {purchase.items.map((it, idx) => (
                            <tr key={idx}>
                              <td className="py-2 font-semibold text-[#102A43]">
                                {it.productName}
                              </td>
                              <td className="py-2 text-center font-mono text-[#64748B]">
                                {it.quantity} {it.unit}
                              </td>
                              <td className="py-2 text-right font-mono text-[#64748B]">
                                ৳{it.unitCostPrice}
                              </td>
                              <td className="py-2 text-right font-bold font-mono text-[#102A43]">
                                ৳{it.totalCost.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#E2E8F0] font-bold text-[#102A43]">
                            <td colSpan={3} className="pt-2 text-right">সর্বমোট নগদ বিল:</td>
                            <td className="pt-2 text-right font-mono text-sm text-[#2E7D32]">
                              ৳{purchase.totalAmount.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: New / Edit Multi-Item Bulk Purchase */}
      {showNewPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2.5 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-md my-auto rounded-[28px] bg-white shadow-2xl border border-[#CBD5E1] overflow-hidden flex flex-col max-h-[95vh]">
            {/* Top Dark Green Header */}
            <div className="px-5 py-4 bg-[#0D5238] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <PackagePlus className="w-6 h-6 text-[#68B996]" />
                <h3 className="font-extrabold text-lg sm:text-xl tracking-tight">
                  {editingPurchase ? `রসিদ এডিট করুন (#${editingPurchase.purchaseNo})` : 'নগদ ক্রয় রসিদ'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNewPurchaseModal(false);
                  setEditingPurchase(null);
                }}
                className="p-1 rounded-full hover:bg-white/15 text-white/90 hover:text-white transition cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitPurchase}
              className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5"
            >
              {/* Row 1: Supplier & Purchase Date side-by-side */}
              <div className="grid grid-cols-12 gap-2.5">
                <div className="col-span-7">
                  <label className="block text-xs sm:text-sm font-extrabold text-[#111827] mb-1.5 truncate">
                    সাপ্লায়ার / মহাজন
                  </label>
                  <input
                    type="text"
                    list="supplier-manual-suggestions"
                    value={supplierNameInput}
                    onChange={(e) => setSupplierNameInput(e.target.value)}
                    placeholder="মহাজন বা পাইকারি দোকানের নাম..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-[#8A949E] bg-[#F1F5F8] text-xs sm:text-sm font-medium text-[#111827] placeholder-[#1F2937] focus:ring-2 focus:ring-[#0D5238] focus:bg-white focus:outline-none"
                  />
                  {suppliers.length > 0 && (
                    <datalist id="supplier-manual-suggestions">
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.company || s.address || 'সাপ্লায়ার'}
                        </option>
                      ))}
                    </datalist>
                  )}
                </div>

                <div className="col-span-5">
                  <label className="block text-xs sm:text-sm font-extrabold text-[#111827] mb-1.5 truncate">
                    ক্রয়ের তারিখ
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-2.5 py-2.5 rounded-2xl border border-[#8A949E] bg-[#F1F5F8] text-xs sm:text-sm font-medium text-[#111827] focus:ring-2 focus:ring-[#0D5238] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Section: ক্রয়কৃত পণ্যসমূহ */}
              <div className="space-y-2.5">
                <label className="block text-sm sm:text-base font-extrabold text-[#111827]">
                  ক্রয়কৃত পণ্যসমূহ ({items.length}টি)
                </label>

                <div className="space-y-2.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-[22px] bg-[#F1F5F8] border border-[#CBD5E1] space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-[#111827]">
                          আইটেম #{idx + 1}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-[#D32F2F] hover:text-red-700 text-xs p-1 cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Product Name Input */}
                      <div>
                        <input
                          type="text"
                          required
                          list={`prod-suggestions-${idx}`}
                          value={item.productName}
                          onChange={(e) =>
                            handleItemChange(idx, 'productName', e.target.value)
                          }
                          placeholder="পণ্যের নাম (যেমন: মিনিকেট চাল ৫০ কেজি)"
                          className="w-full px-3.5 py-2.5 rounded-2xl border border-[#8A949E] bg-white text-xs sm:text-sm font-medium text-[#111827] placeholder-[#1F2937] focus:ring-2 focus:ring-[#0D5238] focus:outline-none"
                        />
                        <datalist id={`prod-suggestions-${idx}`}>
                          {products.map((p) => (
                            <option key={p.id} value={p.name} />
                          ))}
                        </datalist>
                      </div>

                      {/* Quantity, Unit, and Unit Cost Price */}
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-4">
                          <input
                            type="number"
                            required
                            min="0.1"
                            step="any"
                            value={item.quantity || ''}
                            onChange={(e) =>
                              handleItemChange(idx, 'quantity', e.target.value)
                            }
                            placeholder="পরিমাণ"
                            className="w-full px-2.5 py-2.5 rounded-2xl border border-[#8A949E] bg-white text-xs sm:text-sm font-medium text-center text-[#111827] focus:ring-2 focus:ring-[#0D5238] focus:outline-none"
                          />
                        </div>

                        <div className="col-span-4">
                          <select
                            value={item.unit}
                            onChange={(e) =>
                              handleItemChange(idx, 'unit', e.target.value)
                            }
                            className="w-full px-2.5 py-2.5 rounded-2xl border border-[#8A949E] bg-white text-xs sm:text-sm font-medium text-[#111827] focus:ring-2 focus:ring-[#0D5238] focus:outline-none"
                          >
                            <option value="kg">কেজি</option>
                            <option value="packet">প্যাকেট/বস্তা</option>
                            <option value="liter">লিটার/কার্টুন</option>
                            <option value="piece">পিস</option>
                            <option value="dozen">ডজন</option>
                            <option value="gm">গ্রাম</option>
                          </select>
                        </div>

                        <div className="col-span-4">
                          <input
                            type="number"
                            required
                            min="0"
                            step="any"
                            value={item.unitCostPrice || ''}
                            onChange={(e) =>
                              handleItemChange(idx, 'unitCostPrice', e.target.value)
                            }
                            placeholder="৳ দর"
                            className="w-full px-2.5 py-2.5 rounded-2xl border border-[#8A949E] bg-white text-xs sm:text-sm font-medium text-center text-[#111827] placeholder-[#1F2937] focus:ring-2 focus:ring-[#0D5238] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="text-right text-xs sm:text-sm font-extrabold text-[#0D5238] pt-0.5">
                        মোট টাকা: ৳
                        {(item.totalCost || 0).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="w-full py-2.5 px-4 rounded-2xl border border-[#8A949E] bg-white hover:bg-[#F8FAFC] text-[#0D5238] text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>আরও পণ্য যোগ করুন</span>
                </button>
              </div>

              {/* Voucher / Receipt Note */}
              <div>
                <label className="block text-xs sm:text-sm font-extrabold text-[#111827] mb-1.5">
                  রসিদ বা ভাউচার বিবরণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={purchaseNote}
                  onChange={(e) => setPurchaseNote(e.target.value)}
                  placeholder="যেমন: পাইকারি বাজার রসিদ #5088"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#8A949E] bg-white text-xs sm:text-sm font-medium text-[#111827] placeholder-[#1F2937] focus:ring-2 focus:ring-[#0D5238] focus:outline-none"
                />
              </div>

              {/* Mint Green Total Cash Bill Box */}
              <div className="px-4 py-3 rounded-[20px] bg-[#DCFCE7]">
                <div className="text-sm sm:text-base font-extrabold text-[#111827]">
                  সর্বমোট নগদ বিল: ৳ {purchaseGrandTotal.toLocaleString()}
                </div>
                <div className="text-xs sm:text-sm font-medium text-[#1F2937] mt-0.5">
                  (ক্যাশ ড্রয়ার থেকে বিয়োগ হবে)
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div className="pt-1 flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPurchaseModal(false);
                    setEditingPurchase(null);
                  }}
                  className="px-6 py-3 rounded-2xl bg-[#D1D5DB] hover:bg-[#9CA3AF] text-xs sm:text-sm font-extrabold text-[#1F2937] transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-2xl bg-[#0D5238] hover:bg-[#093B28] text-white text-xs sm:text-sm font-extrabold text-center shadow-xs transition active:scale-95 cursor-pointer"
                >
                  {editingPurchase ? 'আপডেট সংরক্ষণ করুন' : 'সংরক্ষণ ও স্টক আপডেট'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Cash Purchase Receipt Confirmation Modal */}
      {purchaseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl border border-[#E2E8F0] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#102A43]">
                নগদ ক্রয় রসিদটি ডিলিট করবেন?
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                রসিদ <strong className="text-[#102A43]">#{purchaseToDelete.purchaseNo}</strong> ({purchaseToDelete.supplierName} - ৳{purchaseToDelete.totalAmount.toLocaleString()}) তালিকা থেকে মুছে যাবে।
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setPurchaseToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#EDF2F7] text-[#102A43] font-bold text-xs cursor-pointer"
              >
                না, থাকুক
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteBulkPurchase(purchaseToDelete.id);
                  setPurchaseToDelete(null);
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
