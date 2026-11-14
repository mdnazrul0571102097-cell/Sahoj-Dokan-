import React, { useState, useMemo } from 'react';
import { Supplier, SupplierTransaction, ShopProfile, Language, AppMode, BulkPurchase, BulkPurchaseItem, Product } from '../types';
import { translations } from '../i18n/translations';
import { playSuccessChime } from '../utils/audio';
import { DB } from '../storage/db';
import { MemoScannerCard } from './MemoScannerCard';
import { ScannedMemoResult } from '../utils/memoScanner';
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
  RotateCcw,
  Receipt,
  ChevronDown,
  ChevronUp,
  UserPlus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const WALK_IN_CASH_SUPPLIER = 'সাধারণ মহাজন (নগদ)';

interface Props {
  suppliers: Supplier[];
  supplierTransactions: SupplierTransaction[];
  products?: Product[];
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
    newBalance: number,
    extra?: {
      damageDeduction?: number;
      stockValue?: number;
      cashPaid?: number;
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
  bulkPurchases?: BulkPurchase[];
  onAddBulkPurchase?: (
    purchase: BulkPurchase,
    updatedProducts: Product[],
    supplierDueAddition?: { supplierId: string; dueAmount: number; note?: string }
  ) => void;
  onDeleteBulkPurchase?: (id: string) => void;
}

export const SupplierKhataView: React.FC<Props> = ({
  suppliers,
  supplierTransactions,
  products = [],
  profile,
  language,
  appMode = 'trial',
  onOpenSubscriptionModal,
  onAddSupplier,
  onPaySupplier,
  onAddSupplierDue,
  onSupplierReturn,
  onUpdateSupplier = () => {},
  onUpdateSupplierTransaction,
  onDeleteSupplier = () => {},
  bulkPurchases = [],
  onAddBulkPurchase,
  onDeleteBulkPurchase,
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
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingTx, setEditingTx] = useState<SupplierTransaction | null>(null);
  const [editTxAmount, setEditTxAmount] = useState<number | ''>('');
  const [editTxNote, setEditTxNote] = useState('');

  // Return state
  const [returnAmount, setReturnAmount] = useState<number | ''>('');
  const [returnNote, setReturnNote] = useState('');

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

  // Form states: Unified Supplier Purchase (New, Existing & Walk-in Cash Supplier + Cash/Due/Damage)
  const [dueSupplierNameInput, setDueSupplierNameInput] = useState('');
  const [dueNewSupplierPhone, setDueNewSupplierPhone] = useState('');
  const [dueAmount, setDueAmount] = useState<number | ''>('');
  const [dueNote, setDueNote] = useState('');
  const [dueDamageDeduction, setDueDamageDeduction] = useState<string>('');
  const [dueCashPaid, setDueCashPaid] = useState<string>('');
  const [dueItems, setDueItems] = useState<BulkPurchaseItem[]>([]);
  const [dueFormError, setDueFormError] = useState('');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);

  // Unified list filter tabs & receipt expand/delete states
  const [purchaseFilterTab, setPurchaseFilterTab] = useState<'all' | 'cash' | 'due'>('all');
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const [confirmDeletePurchaseId, setConfirmDeletePurchaseId] = useState<string | null>(null);
  const [saveFeedbackMsg, setSaveFeedbackMsg] = useState('');

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

  // Submit Edit Supplier (Direct & Silent balance sync)
  const handleEditSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !name.trim()) return;

    const target = suppliers.find((s) => s.id === editId);
    if (!target) return;

    const editedDue = Math.max(0, Math.round((Number(initialDue) || 0) * 100) / 100);

    const updatedSupp: Supplier = {
      ...target,
      name: name.trim(),
      company: company.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim() || '---',
      address: address.trim(),
      totalDue: editedDue,
      totalPayableDue: editedDue,
    };

    onUpdateSupplier(updatedSupp);
    if (activeSupplier?.id === updatedSupp.id) {
      setActiveSupplier(updatedSupp);
    }
    setShowEditSupplierModal(false);
  };

  // Open individual ledger entry editor
  const openEditTxModal = (tx: SupplierTransaction) => {
    setEditingTx(tx);
    setEditTxAmount(tx.amount);
    setEditTxNote(tx.note || '');
  };

  // Save edited ledger entry and recalculate supplier balance silently
  const handleEditTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const target = suppliers.find((s) => s.id === editingTx.supplierId) || currentActiveSupplier || selectedSupplier;
    if (!target) return;

    const newAmount = Math.max(0, Math.round((Number(editTxAmount) || 0) * 100) / 100);
    const oldAmount = Number(editingTx.amount) || 0;

    // Determine balance delta: purchase_due increases balance, payment/return reduces balance
    const isDueIncrease = editingTx.type === 'purchase_due';
    const delta = isDueIncrease ? newAmount - oldAmount : oldAmount - newAmount;

    const currentDue = target.totalDue ?? target.totalPayableDue ?? 0;
    const nextSupplierBalance = Math.max(0, Math.round((currentDue + delta) * 100) / 100);

    const editedTime = new Date(editingTx.date).getTime();

    const nextAllTxs = supplierTransactions.map((tx) => {
      if (tx.id === editingTx.id) {
        return {
          ...tx,
          amount: newAmount,
          note: editTxNote.trim() || tx.note,
          balanceAfter: Math.max(0, Math.round(((Number(tx.balanceAfter) || 0) + delta) * 100) / 100),
          ...(tx.stockValue !== undefined && isDueIncrease ? { stockValue: newAmount } : {}),
        };
      }
      if (tx.supplierId === target.id && new Date(tx.date).getTime() > editedTime) {
        return {
          ...tx,
          balanceAfter: Math.max(0, Math.round(((Number(tx.balanceAfter) || 0) + delta) * 100) / 100),
        };
      }
      return tx;
    });

    if (onUpdateSupplierTransaction) {
      onUpdateSupplierTransaction(target.id, nextSupplierBalance, nextAllTxs);
    } else {
      DB.saveSupplierTransactions(nextAllTxs);
      const updatedSupp: Supplier = {
        ...target,
        totalDue: nextSupplierBalance,
        totalPayableDue: nextSupplierBalance,
      };
      onUpdateSupplier(updatedSupp);
    }

    setEditingTx(null);
    setEditTxAmount('');
    setEditTxNote('');
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

  const openAddDueModal = (supp?: Supplier | null) => {
    const targetSupp = supp || null;
    if (targetSupp) {
      setActiveSupplier(targetSupp);
      setSelectedSupplierId(targetSupp.id);
      setDueSupplierNameInput(targetSupp.name);
    } else {
      setActiveSupplier(null);
      setSelectedSupplierId(null);
      setDueSupplierNameInput(WALK_IN_CASH_SUPPLIER);
    }
    setDueNewSupplierPhone('');
    setDueAmount('');
    setDueNote('');
    setDueDamageDeduction('');
    setDueCashPaid('');
    setDueItems([]);
    setDueFormError('');
    setShowSupplierSuggestions(false);
    setShowAddDueModal(true);
  };

  const isWalkInCashSupplier = dueSupplierNameInput.trim() === WALK_IN_CASH_SUPPLIER;

  // Match supplier typed/scanned by name
  const matchedDueSupplier = useMemo(() => {
    const trimmed = dueSupplierNameInput.trim().toLowerCase();
    if (!trimmed || trimmed === WALK_IN_CASH_SUPPLIER.toLowerCase()) return null;
    return suppliers.find((s) => s.name.trim().toLowerCase() === trimmed) || null;
  }, [dueSupplierNameInput, suppliers]);

  const dueItemsGrossTotal = useMemo(() => {
    return Math.round(dueItems.reduce((sum, it) => sum + (it.totalCost || 0), 0));
  }, [dueItems]);

  const dueGrossTotal = useMemo(() => {
    if (dueItems.length > 0) return dueItemsGrossTotal;
    return Math.max(0, Math.round(Number(dueAmount) || 0));
  }, [dueItems.length, dueItemsGrossTotal, dueAmount]);

  const dueDamageAmount = useMemo(() => {
    return Math.max(0, Math.round(Number(dueDamageDeduction) || 0));
  }, [dueDamageDeduction]);

  const dueNetAmount = useMemo(() => {
    return Math.max(0, dueGrossTotal - dueDamageAmount);
  }, [dueGrossTotal, dueDamageAmount]);

  const dueCashPaidAmount = useMemo(() => {
    return Math.max(0, Math.round(Number(dueCashPaid) || 0));
  }, [dueCashPaid]);

  const effectiveDueCashPaid = useMemo(() => {
    return Math.min(dueNetAmount, dueCashPaidAmount);
  }, [dueNetAmount, dueCashPaidAmount]);

  const dueRemainingDueAmount = useMemo(() => {
    return Math.max(0, dueNetAmount - effectiveDueCashPaid);
  }, [dueNetAmount, effectiveDueCashPaid]);

  const handleDueItemChange = (index: number, field: keyof BulkPurchaseItem, val: any) => {
    const updated = [...dueItems];
    const current = { ...updated[index], [field]: val };

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
    setDueItems(updated);
  };

  const handleAddDueItemRow = () => {
    setDueItems([
      ...dueItems,
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

  const handleRemoveDueItemRow = (index: number) => {
    const next = dueItems.filter((_, idx) => idx !== index);
    setDueItems(next);
  };

  const handleDueMemoExtracted = (result: ScannedMemoResult) => {
    if (result.supplierName) {
      setDueSupplierNameInput(result.supplierName);
      const exactMatch = suppliers.find(
        (s) => s.name.trim().toLowerCase() === result.supplierName.trim().toLowerCase()
      );
      if (exactMatch) {
        setActiveSupplier(exactMatch);
        setSelectedSupplierId(exactMatch.id);
      }
    }
    if (result.memoNumber) {
      setDueNote(`মেমো #${result.memoNumber}`);
    }
    if (result.items && result.items.length > 0) {
      const mappedItems: BulkPurchaseItem[] = result.items.map((scanned) => {
        const cleanScanned = scanned.name.trim().toLowerCase();
        const exactMatch = products.find(
          (p) => p.name.trim().toLowerCase() === cleanScanned
        );
        const qty = Math.max(0.01, Number(scanned.quantity) || 1);
        const rate = Math.max(0, Number(scanned.purchasePrice) || 0);
        return {
          productId: exactMatch ? exactMatch.id : '',
          productName: scanned.name,
          category: exactMatch ? exactMatch.category : 'মুদি আইটেম',
          quantity: qty,
          unit: scanned.unit,
          unitCostPrice: rate,
          totalCost: Math.round(qty * rate),
        };
      });
      setDueItems(mappedItems);
      const sum = Math.round(mappedItems.reduce((acc, it) => acc + (it.totalCost || 0), 0));
      setDueAmount(sum > 0 ? sum : '');
    }
  };

  // Submit Unified Supplier Purchase (Walk-in Cash / New / Existing Supplier + Stock + Cash + Remaining Due)
  const handleAddDueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDueFormError('');
    if (dueGrossTotal <= 0) return;

    const typedSupplierName = dueSupplierNameInput.trim();
    if (!typedSupplierName) {
      setDueFormError('অনুগ্রহ করে মহাজনের নাম লিখুন বা তালিকা থেকে সিলেক্ট করুন।');
      return;
    }

    const isWalkIn = typedSupplierName === WALK_IN_CASH_SUPPLIER;
    const cashPaid = effectiveDueCashPaid;
    const remainingDue = dueRemainingDueAmount;

    if (isWalkIn && remainingDue > 0) {
      setDueFormError(
        'বাকি হিসাব রাখতে হলে অনুগ্রহ করে নির্দিষ্ট মহাজনের নাম লিখুন বা তালিকা থেকে সিলেক্ট করুন।'
      );
      return;
    }

    let target = matchedDueSupplier;
    if (!isWalkIn && !target) {
      // Auto-create supplier record with 0 initial balance; remainingDue added via handleAddBulkPurchase -> handleAddSupplierDue
      const newSupp: Supplier = {
        id: `supp_${Date.now()}`,
        name: typedSupplierName,
        company: '',
        contactPerson: '',
        phone: dueNewSupplierPhone.trim() || '---',
        address: '',
        totalDue: 0,
        totalPayableDue: 0,
        createdAt: new Date().toISOString(),
      };
      onAddSupplier(newSupp);
      target = newSupp;
      setSelectedSupplierId(newSupp.id);
      setActiveSupplier(newSupp);
    }

    const validItems = dueItems.filter((it) => it.productName.trim());
    const itemSummary =
      validItems.length > 0
        ? validItems
            .map((it) => `${it.productName} (${it.quantity} ${it.unit})`)
            .slice(0, 3)
            .join(', ')
        : '';

    const baseNote =
      dueNote.trim() ||
      itemSummary ||
      (remainingDue === 0
        ? 'নগদ মাল ক্রয়'
        : cashPaid > 0
        ? 'মাল ক্রয় (নগদ ও বাকি)'
        : 'নতুন মাল ক্রয় বাবদ বাকি');

    const noteParts: string[] = [baseNote];
    if (dueDamageAmount > 0) {
      noteParts.push(
        `মোট মাল: ৳${dueGrossTotal.toLocaleString()}, ড্যামেজ বাদ: -৳${dueDamageAmount.toLocaleString()}, নিট: ৳${dueNetAmount.toLocaleString()}`
      );
    }
    if (cashPaid > 0 && remainingDue > 0) {
      noteParts.push(
        `নগদ জমা: ৳${cashPaid.toLocaleString()}, অবশিষ্ট বাকি: ৳${remainingDue.toLocaleString()}`
      );
    }
    const finalNote = noteParts.join(' | ');

    // Update inventory products when itemized products match catalog items
    let updatedProducts: Product[] | undefined = undefined;
    if (validItems.length > 0 && products.length > 0) {
      const nextProducts = [...products];
      let anyMatched = false;
      validItems.forEach((item) => {
        const matchIndex = nextProducts.findIndex(
          (p) =>
            (item.productId && p.id === item.productId) ||
            p.name.trim().toLowerCase() === item.productName.trim().toLowerCase()
        );
        if (matchIndex >= 0) {
          anyMatched = true;
          const prod = nextProducts[matchIndex];
          nextProducts[matchIndex] = {
            ...prod,
            stock: Math.round(((prod.stock || 0) + (Number(item.quantity) || 0)) * 100) / 100,
            costPrice: item.unitCostPrice > 0 ? item.unitCostPrice : prod.costPrice,
            updatedAt: new Date().toISOString(),
          };
        }
      });
      if (anyMatched) {
        updatedProducts = nextProducts;
      }
    }

    const purchaseNo = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    const newPurchase: BulkPurchase = {
      id: `bp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      purchaseNo,
      date: nowIso,
      supplierId: target ? target.id : undefined,
      supplierName: target ? target.name : WALK_IN_CASH_SUPPLIER,
      supplierPhone: target && target.phone !== '---' ? target.phone : undefined,
      items: validItems,
      grossTotalAmount: dueGrossTotal,
      damageDeduction: dueDamageAmount,
      totalAmount: dueNetAmount,
      paidAmount: cashPaid,
      dueAmount: remainingDue,
      paymentType: remainingDue === 0 ? 'cash' : cashPaid > 0 ? 'partial' : 'due',
      note: finalNote,
      createdAt: nowIso,
    };

    if (onAddBulkPurchase) {
      onAddBulkPurchase(
        newPurchase,
        updatedProducts || products,
        remainingDue > 0 && target
          ? {
              supplierId: target.id,
              dueAmount: remainingDue,
              note: `রসিদ #${purchaseNo} (${finalNote})`,
            }
          : undefined
      );
    } else if (target) {
      const currentDue = target.totalDue ?? target.totalPayableDue ?? 0;
      const newBalance = Math.max(0, currentDue + remainingDue);
      onAddSupplierDue(target.id, dueNetAmount, finalNote, newBalance, {
        damageDeduction: dueDamageAmount,
        stockValue: dueNetAmount,
        cashPaid,
        updatedProducts,
      });
    }

    setSaveFeedbackMsg(
      remainingDue === 0
        ? `নগদ ক্রয় রসিদ #${purchaseNo} সেভ হয়েছে (৳${dueNetAmount.toLocaleString()})`
        : `ক্রয় রসিদ #${purchaseNo} সেভ হয়েছে (নগদ: ৳${cashPaid.toLocaleString()}, বাকি: ৳${remainingDue.toLocaleString()})`
    );
    setTimeout(() => setSaveFeedbackMsg(''), 4000);

    setDueSupplierNameInput('');
    setDueNewSupplierPhone('');
    setDueAmount('');
    setDueNote('');
    setDueDamageDeduction('');
    setDueCashPaid('');
    setDueItems([]);
    setDueFormError('');
    setShowAddDueModal(false);
    playSuccessChime();
  };

  // Submit Purchase Return (মাল ফেরত / ড্যামেজ বাবদ বাকি কর্তন)
  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = currentActiveSupplier || selectedSupplier;
    if (!target) return;
    const amount = Number(returnAmount);
    if (!amount || amount <= 0) return;

    const currentDue = target.totalDue ?? target.totalPayableDue ?? 0;
    const newBalance = Math.max(0, currentDue - amount);
    const note = returnNote.trim() || 'মাল ফেরত বাবদ বাকি কর্তন';

    if (onSupplierReturn) {
      onSupplierReturn(target.id, amount, note, newBalance);
    } else {
      const tx: SupplierTransaction = {
        id: `stx_${Date.now()}_ret`,
        supplierId: target.id,
        date: new Date().toISOString(),
        type: 'purchase_return',
        amount,
        note,
        balanceAfter: newBalance,
      };
      const allTxs = DB.getSupplierTransactions();
      DB.saveSupplierTransactions([tx, ...allTxs]);
      const allSupps = DB.getSuppliers();
      const nextSupps = allSupps.map((s: Supplier) =>
        s.id === target.id
          ? { ...s, totalDue: newBalance, totalPayableDue: newBalance }
          : s
      );
      DB.saveSuppliers(nextSupps);
      onUpdateSupplier({ ...target, totalDue: newBalance, totalPayableDue: newBalance });
    }

    setReturnAmount('');
    setReturnNote('');
    setShowReturnModal(false);
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

  const formatDateDDMMYYYY = (d?: string | Date): string => {
    const ymd = getLocalDateStr(d);
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
    const [yyyy, mm, dd] = ymd.split('-');
    return `${dd}-${mm}-${yyyy}`;
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

  const totalCashPurchasesAll = useMemo(() => {
    return Math.round(
      bulkPurchases.reduce((sum, bp) => {
        const paid =
          bp.paidAmount !== undefined
            ? Number(bp.paidAmount) || 0
            : Math.max(0, (Number(bp.totalAmount) || 0) - (Number(bp.dueAmount) || 0));
        const ret = Number(bp.returnedAmount) || 0;
        return sum + Math.max(0, paid - ret);
      }, 0)
    );
  }, [bulkPurchases]);

  const totalCashPurchasesToday = useMemo(() => {
    const todayStr = getLocalDateStr(new Date());
    return Math.round(
      bulkPurchases
        .filter(
          (bp) =>
            getLocalDateStr(bp.date) === todayStr ||
            (bp.date || '').slice(0, 10) === todayStr
        )
        .reduce((sum, bp) => {
          const paid =
            bp.paidAmount !== undefined
              ? Number(bp.paidAmount) || 0
              : Math.max(0, (Number(bp.totalAmount) || 0) - (Number(bp.dueAmount) || 0));
          const ret = Number(bp.returnedAmount) || 0;
          return sum + Math.max(0, paid - ret);
        }, 0)
    );
  }, [bulkPurchases]);

  // Search-filtered & sorted purchase receipts
  const searchMatchedPurchases = useMemo(() => {
    const sorted = [...bulkPurchases].sort((a, b) => {
      const ta = new Date(a.createdAt || a.date).getTime() || 0;
      const tb = new Date(b.createdAt || b.date).getTime() || 0;
      return tb - ta;
    });
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((bp) => {
      const pNo = (bp.purchaseNo || '').toLowerCase();
      const sup = (bp.supplierName || WALK_IN_CASH_SUPPLIER).toLowerCase();
      const note = (bp.note || '').toLowerCase();
      const prodMatch = (bp.items || []).some((it) =>
        (it.productName || '').toLowerCase().includes(q)
      );
      const ymd = getLocalDateStr(bp.date);
      const ddmm = formatDateDDMMYYYY(bp.date);
      return (
        pNo.includes(q) ||
        sup.includes(q) ||
        note.includes(q) ||
        prodMatch ||
        ymd.includes(q) ||
        ddmm.includes(q)
      );
    });
  }, [bulkPurchases, searchQuery]);

  const cashPurchasesList = useMemo(
    () => searchMatchedPurchases.filter((bp) => (Number(bp.dueAmount) || 0) === 0),
    [searchMatchedPurchases]
  );

  const creditPurchasesList = useMemo(
    () => searchMatchedPurchases.filter((bp) => (Number(bp.dueAmount) || 0) > 0),
    [searchMatchedPurchases]
  );

  const visiblePurchases = useMemo(() => {
    if (purchaseFilterTab === 'cash') return cashPurchasesList;
    if (purchaseFilterTab === 'due') return creditPurchasesList;
    return searchMatchedPurchases;
  }, [purchaseFilterTab, cashPurchasesList, creditPurchasesList, searchMatchedPurchases]);

  const visibleSuppliers = useMemo(() => {
    if (purchaseFilterTab === 'cash') return [];
    if (purchaseFilterTab === 'due') {
      return filteredSuppliers.filter((s) => (s.totalDue ?? s.totalPayableDue ?? 0) > 0);
    }
    return filteredSuppliers;
  }, [purchaseFilterTab, filteredSuppliers]);

  const handleOpenAddSupplierModal = () => {
    setName('');
    setCompany('');
    setContactPerson('');
    setPhone('');
    setAddress('');
    setInitialDue('');
    setShowAddSupplierModal(true);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Main Summary Card */}
      <div className="bg-white rounded-[24px] p-3.5 sm:p-4 shadow-sm border border-[#E2E8F0] mb-2.5 shrink-0">
        {/* Pill Toggle: সর্বমোট vs আজ */}
        <div className="flex justify-center mb-2.5">
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
          {/* Left: মহাজনের মোট পাওনা (দেনা) / আজকের বাকি ক্রয় */}
          <div className="text-center pr-2">
            <p className="text-[11px] sm:text-xs font-semibold text-[#64748B] mb-0.5">
              {summaryTimeMode === 'all'
                ? 'মহাজনের মোট পাওনা (দেনা)'
                : 'আজকের বাকি ক্রয়'}
            </p>
            <div className="flex items-center justify-center gap-1">
              <p className="text-lg sm:text-2xl font-extrabold text-[#D32F2F] tracking-tight tabular-nums">
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

          {/* Right: মোট নগদ ক্রয় / আজকের নগদ ক্রয় */}
          <div className="text-center pl-2">
            <p className="text-[11px] sm:text-xs font-semibold text-[#64748B] mb-0.5">
              {summaryTimeMode === 'all' ? 'মোট নগদ ক্রয়' : 'আজকের নগদ ক্রয়'}
            </p>
            <p className="text-lg sm:text-2xl font-extrabold text-[#2E7D32] tracking-tight tabular-nums">
              ৳{' '}
              {summaryTimeMode === 'all'
                ? totalCashPurchasesAll.toLocaleString()
                : totalCashPurchasesToday.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Single Full-Width Primary Button */}
        <div>
          <button
            type="button"
            onClick={() => openAddDueModal(null)}
            className="w-full py-2.5 px-3 rounded-2xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <span>+ নতুন মাল ক্রয় (নগদ / বাকি)</span>
          </button>
        </div>
      </div>

      {/* Save Feedback Toast */}
      {saveFeedbackMsg && (
        <div className="mb-2 px-3 py-2 rounded-2xl bg-[#E8F5E9] border border-emerald-200 text-[#2E7D32] text-xs font-bold flex items-center gap-2 shrink-0">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{saveFeedbackMsg}</span>
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#9AA5B1]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="সাপ্লায়ার, পণ্য, রসিদ নং বা তারিখ খুঁজুন..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl bg-white border border-[#E2E8F0] text-xs sm:text-sm text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B] shadow-xs"
          />
        </div>
      </div>

      {/* 3 Filter Tabs: সব ক্রয় | নগদ ক্রয় | বাকি ক্রয় */}
      <div className="grid grid-cols-3 gap-1.5 mb-2.5 shrink-0 bg-white p-1 rounded-2xl border border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => setPurchaseFilterTab('all')}
          className={`py-2 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            purchaseFilterTab === 'all'
              ? 'bg-[#0E6B6B] text-white shadow-xs'
              : 'text-[#64748B] hover:bg-[#F8FAFC]'
          }`}
        >
          সব ক্রয় ({searchMatchedPurchases.length})
        </button>
        <button
          type="button"
          onClick={() => setPurchaseFilterTab('cash')}
          className={`py-2 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            purchaseFilterTab === 'cash'
              ? 'bg-[#2E7D32] text-white shadow-xs'
              : 'text-[#64748B] hover:bg-[#F8FAFC]'
          }`}
        >
          নগদ ক্রয় ({cashPurchasesList.length})
        </button>
        <button
          type="button"
          onClick={() => setPurchaseFilterTab('due')}
          className={`py-2 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            purchaseFilterTab === 'due'
              ? 'bg-[#D32F2F] text-white shadow-xs'
              : 'text-[#64748B] hover:bg-[#F8FAFC]'
          }`}
        >
          বাকি ক্রয় ({creditPurchasesList.length})
        </button>
      </div>

      {/* Unified Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 pb-16">
        {/* Cash-only Tab Summary Strip */}
        {purchaseFilterTab === 'cash' && (
          <div className="px-3.5 py-2.5 rounded-2xl bg-[#E8F5E9] border border-emerald-200 flex items-center justify-between text-xs">
            <span className="font-bold text-[#2E7D32]">
              মোট নগদ ক্রয় রসিদ: {cashPurchasesList.length} টি
            </span>
            <span className="font-mono font-black text-sm text-[#2E7D32]">
              ৳{Math.round(cashPurchasesList.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0)).toLocaleString()}
            </span>
          </div>
        )}

        {/* Section 1: Suppliers List (Compact so Purchase Vouchers list stays prominent) */}
        {purchaseFilterTab !== 'cash' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-extrabold text-[#475569] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#0E6B6B]" />
                <span>
                  {purchaseFilterTab === 'due'
                    ? `পাওনাদার সাপ্লায়ার (${visibleSuppliers.length})`
                    : `সাপ্লায়ার ও মহাজন (${visibleSuppliers.length})`}
                </span>
              </h3>
              {purchaseFilterTab === 'due' && (
                <span className="text-[11px] font-bold text-[#D32F2F] tabular-nums">
                  মোট বাকি: ৳{totalPayableDue.toLocaleString()}
                </span>
              )}
            </div>

            {visibleSuppliers.length === 0 ? (
              <div className="bg-white rounded-xl px-3 py-2 border border-[#E2E8F0] shadow-2xs flex items-center justify-center gap-1.5 text-[#64748B]">
                <Building2 className="w-4 h-4 text-[#9AA5B1] shrink-0" />
                <p className="text-[11px] font-semibold">
                  {purchaseFilterTab === 'due'
                    ? 'কোনো বাকি থাকা সাপ্লায়ার নেই'
                    : 'কোনো সাপ্লায়ার যোগ করা হয়নি'}
                </p>
              </div>
            ) : (
              visibleSuppliers.map((supp) => {
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
                    className="bg-white rounded-2xl p-2.5 sm:p-3 border border-[#E2E8F0] hover:border-[#0E6B6B] shadow-xs transition-all cursor-pointer"
                  >
                    {/* Top row: Avatar, Name, Company, Due */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-[#E0F2F1] text-[#0E6B6B] font-bold text-base flex items-center justify-center shrink-0">
                          {supp.name.slice(0, 1)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-sm sm:text-base text-[#102A43] truncate">
                              {supp.name}
                            </h4>
                            {supp.company && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#E3F2FD] text-[#1976D2] font-bold truncate max-w-[140px]">
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
                        {/* + নতুন ক্রয় বাটন */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddDueModal(supp);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-[#FFEBEE] hover:bg-rose-200 text-[#D32F2F] border border-rose-200 text-xs font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer"
                          title="এই মহাজন থেকে নতুন মাল ক্রয় ও হিসাব যোগ করুন"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>+ নতুন ক্রয়</span>
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
        )}

        {/* Section 2: Purchase Vouchers / Receipts List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold text-[#475569] flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-[#0E6B6B]" />
              <span>
                {purchaseFilterTab === 'cash'
                  ? `নগদ ক্রয় রসিদ (${visiblePurchases.length})`
                  : purchaseFilterTab === 'due'
                  ? `বাকি ক্রয় রসিদ (${visiblePurchases.length})`
                  : `ক্রয় রসিদ ও ভাউচার (${visiblePurchases.length})`}
              </span>
            </h3>
          </div>

          {visiblePurchases.length === 0 ? (
            <div className="bg-white rounded-[20px] p-6 text-center border border-[#E2E8F0] shadow-xs">
              <Receipt className="w-9 h-9 text-[#9AA5B1] mx-auto mb-1.5 stroke-1" />
              <p className="text-xs font-semibold text-[#64748B]">
                {purchaseFilterTab === 'cash'
                  ? 'কোনো নগদ ক্রয়ের রসিদ পাওয়া যায়নি'
                  : purchaseFilterTab === 'due'
                  ? 'কোনো বাকি ক্রয়ের রসিদ পাওয়া যায়নি'
                  : 'এখনও কোনো মাল ক্রয়ের রসিদ নেই'}
              </p>
            </div>
          ) : (
            visiblePurchases.map((bp) => {
              const dueAmt = Math.max(0, Number(bp.dueAmount) || 0);
              const paidAmt = Math.max(
                0,
                bp.paidAmount !== undefined
                  ? Number(bp.paidAmount) || 0
                  : (Number(bp.totalAmount) || 0) - dueAmt
              );
              const dmgAmt = Math.max(0, Number(bp.damageDeduction) || 0);
              const netAmt = Math.max(0, Number(bp.totalAmount) || 0);
              const isExpanded = expandedPurchaseId === bp.id;
              const isCashOnly = dueAmt === 0;
              const isPartial = dueAmt > 0 && paidAmt > 0;

              return (
                <div
                  key={bp.id}
                  className="bg-white rounded-[20px] p-3.5 border border-[#E2E8F0] shadow-xs space-y-2"
                >
                  {/* Row 1: Receipt # + Date + Status Badge | Net Bill */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black font-mono text-[#0E6B6B]">
                          #{bp.purchaseNo}
                        </span>
                        <span className="text-[11px] font-semibold text-[#64748B]">
                          • {formatDateDDMMYYYY(bp.date)}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            isCashOnly
                              ? 'bg-[#E8F5E9] text-[#2E7D32]'
                              : isPartial
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-[#FFEBEE] text-[#D32F2F]'
                          }`}
                        >
                          {isCashOnly ? 'নগদ ক্রয়' : isPartial ? 'নগদ + বাকি' : 'বাকি ক্রয়'}
                        </span>
                      </div>

                      <p className="font-bold text-sm text-[#102A43] mt-1 truncate">
                        {bp.supplierName || WALK_IN_CASH_SUPPLIER}
                      </p>
                      {bp.note && (
                        <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                          {bp.note}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-semibold text-[#64748B] block">
                        নিট বিল
                      </span>
                      <span className="text-base font-black font-mono text-[#102A43] tabular-nums">
                        ৳{netAmt.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Payment & Damage Breakdown + Actions */}
                  <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
                      {dmgAmt > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                          ড্যামেজ বাদ: -৳{dmgAmt.toLocaleString()}
                        </span>
                      )}
                      {paidAmt > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-[#E8F5E9] text-[#2E7D32]">
                          নগদ: ৳{paidAmt.toLocaleString()}
                        </span>
                      )}
                      {dueAmt > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-[#FFEBEE] text-[#D32F2F]">
                          বাকি: ৳{dueAmt.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {bp.items && bp.items.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedPurchaseId(isExpanded ? null : bp.id)
                          }
                          className="px-2 py-1 rounded-lg bg-[#F8FAFC] hover:bg-[#EDF2F7] text-[#0E6B6B] border border-[#E2E8F0] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>পণ্য ({bp.items.length})</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}

                      {onDeleteBulkPurchase && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirmDeletePurchaseId === bp.id) {
                              onDeleteBulkPurchase(bp.id);
                              setConfirmDeletePurchaseId(null);
                            } else {
                              setConfirmDeletePurchaseId(bp.id);
                              setTimeout(() => {
                                setConfirmDeletePurchaseId((prev) =>
                                  prev === bp.id ? null : prev
                                );
                              }, 5000);
                            }
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                            confirmDeletePurchaseId === bp.id
                              ? 'bg-[#D32F2F] text-white'
                              : 'bg-[#FFEBEE] hover:bg-rose-200 text-[#D32F2F]'
                          }`}
                          title="রসিদ ডিলিট করতে দুবার চাপুন"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>
                            {confirmDeletePurchaseId === bp.id ? 'নিশ্চিত?' : ''}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Itemized List */}
                  {isExpanded && bp.items && bp.items.length > 0 && (
                    <div className="mt-1.5 pt-2 border-t border-dashed border-[#E2E8F0] space-y-1">
                      {bp.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] text-[#475569]"
                        >
                          <span className="font-semibold truncate pr-2">
                            {idx + 1}. {it.productName} ({it.quantity} {it.unit} × ৳{it.unitCostPrice})
                          </span>
                          <span className="font-mono font-bold text-[#102A43] shrink-0">
                            ৳{(it.totalCost || 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
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

              {/* Action Buttons: Add Due, Pay Money & Return Goods */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedSupplier || currentActiveSupplier;
                    if (target) {
                      openAddDueModal(target);
                    }
                  }}
                  className="py-2.5 px-2 rounded-2xl bg-[#D32F2F] hover:bg-red-700 text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer text-center"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  <span>+ নতুন ক্রয়</span>
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
                  className="py-2.5 px-2 rounded-2xl bg-[#2E7D32] hover:bg-green-800 text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer text-center"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>টাকা পরিশোধ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = selectedSupplier || currentActiveSupplier;
                    if (target) {
                      setActiveSupplier(target);
                      setReturnAmount('');
                      setReturnNote('');
                      setShowReturnModal(true);
                    }
                  }}
                  className="py-2.5 px-2 rounded-2xl bg-[#D97706] hover:bg-amber-700 text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer text-center"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>↩️ মাল ফেরত</span>
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
                      const isReturn = tx.type === 'purchase_return';
                      const isPayment = tx.type === 'payment_made' || tx.type === 'payment_given';

                      return (
                        <div
                          key={tx.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                            isReturn
                              ? 'border-amber-200 bg-amber-50/50'
                              : 'border-[#E2E8F0] bg-[#F8FAFC]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`p-2 rounded-xl shrink-0 ${
                                isReturn
                                  ? 'bg-amber-100 text-amber-800'
                                  : isPayment
                                  ? 'bg-[#E8F5E9] text-[#2E7D32]'
                                  : 'bg-[#FFEBEE] text-[#D32F2F]'
                              }`}
                            >
                              {isReturn ? (
                                <RotateCcw className="w-3.5 h-3.5" />
                              ) : isPayment ? (
                                <TrendingDown className="w-3.5 h-3.5" />
                              ) : (
                                <TrendingUp className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-[#102A43]">
                                {isReturn
                                  ? 'মাল ফেরত / ড্যামেজ বাবদ কর্তন'
                                  : isPayment
                                  ? 'টাকা পরিশোধ / জমা'
                                  : 'মাল ক্রয় বাকি'}
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

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p
                                className={`font-mono font-black ${
                                  isReturn
                                    ? 'text-amber-700'
                                    : isPayment
                                    ? 'text-[#2E7D32]'
                                    : 'text-[#D32F2F]'
                                }`}
                              >
                                {isReturn ? '-' : isPayment ? '-' : '+'}৳{tx.amount.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-[#64748B] font-mono">
                                অবশিষ্ট: ৳{tx.balanceAfter.toLocaleString()}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openEditTxModal(tx)}
                              className="p-1.5 rounded-lg bg-white hover:bg-[#E0F2F1] text-[#0E6B6B] border border-[#E2E8F0] transition active:scale-95 cursor-pointer"
                              title="লেনদেন এডিট করুন"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
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
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  মোট বাকি / দেনার পরিমাণ (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={initialDue}
                  onChange={(e) => setInitialDue(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full p-2.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#102A43] text-sm font-black font-mono focus:outline-none focus:ring-2 focus:ring-[#0E6B6B] focus:bg-white"
                />
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

      {/* Unified Supplier Purchase Modal (New & Existing Supplier + Cash, Due & Damage) */}
      {showAddDueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2.5 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-md my-auto rounded-[28px] bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 bg-[#0E6B6B] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">মহাজন থেকে মাল ক্রয় ও হিসাব</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDueModal(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDueSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
              {/* Compact AI Memo Scanner Card (OCR preserved 100%) */}
              <MemoScannerCard onMemoExtracted={handleDueMemoExtracted} compact />

              {/* Single Smart Supplier Input (Suggests Walk-in Cash + Saved Suppliers OR creates new supplier directly) */}
              <div className="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 relative">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-extrabold text-[#102A43]">
                    সাপ্লায়ার / মহাজন *
                  </label>
                  {matchedDueSupplier ? (
                    <span className="text-xs font-black font-mono text-[#D32F2F]">
                      বর্তমান পাওনা: ৳{(matchedDueSupplier.totalDue ?? matchedDueSupplier.totalPayableDue ?? 0).toLocaleString()}
                    </span>
                  ) : isWalkInCashSupplier ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#E8F5E9] text-[#2E7D32]">
                      নগদ ক্রয় (অ্যাকাউন্ট ছাড়াই)
                    </span>
                  ) : dueSupplierNameInput.trim() ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-[#2E7D32]">
                      নতুন সাপ্লায়ার তৈরি হবে
                    </span>
                  ) : null}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    list="supplier-due-suggestions"
                    value={dueSupplierNameInput}
                    onFocus={() => setShowSupplierSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 160)}
                    onChange={(e) => {
                      setDueFormError('');
                      setShowSupplierSuggestions(true);
                      setDueSupplierNameInput(e.target.value);
                      const exact = suppliers.find(
                        (s) => s.name.trim().toLowerCase() === e.target.value.trim().toLowerCase()
                      );
                      if (exact) {
                        setActiveSupplier(exact);
                        setSelectedSupplierId(exact.id);
                      } else {
                        setActiveSupplier(null);
                      }
                    }}
                    placeholder="সাধারণ মহাজন (নগদ) বা সাপ্লায়ারের নাম লিখুন..."
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs sm:text-sm font-bold text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                  />
                  {dueSupplierNameInput.length > 0 && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setDueFormError('');
                        setDueSupplierNameInput('');
                        setActiveSupplier(null);
                        setShowSupplierSuggestions(true);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 text-[#64748B] cursor-pointer"
                      title="নাম মুছুন / অন্য সাপ্লায়ার বাছুন"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Interactive Smart Suggestions List on Tap/Type */}
                  {showSupplierSuggestions && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-44 overflow-y-auto rounded-xl bg-white border border-[#CBD5E1] shadow-lg divide-y divide-[#F1F5F9]">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setDueFormError('');
                          setActiveSupplier(null);
                          setSelectedSupplierId(null);
                          setDueSupplierNameInput(WALK_IN_CASH_SUPPLIER);
                          setDueNewSupplierPhone('');
                          setShowSupplierSuggestions(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-[#E8F5E9] cursor-pointer ${
                          isWalkInCashSupplier ? 'bg-[#E8F5E9]/70 text-[#2E7D32]' : 'text-[#102A43]'
                        }`}
                      >
                        <span>{WALK_IN_CASH_SUPPLIER}</span>
                        <span className="text-[10px] font-extrabold text-[#2E7D32]">নগদ ক্রয়</span>
                      </button>

                      {suppliers
                        .filter((s) => {
                          const q = dueSupplierNameInput.trim().toLowerCase();
                          if (!q || q === WALK_IN_CASH_SUPPLIER.toLowerCase()) return true;
                          return (
                            s.name.toLowerCase().includes(q) ||
                            (s.company && s.company.toLowerCase().includes(q))
                          );
                        })
                        .map((s) => {
                          const sDue = s.totalDue ?? s.totalPayableDue ?? 0;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setDueFormError('');
                                setActiveSupplier(s);
                                setSelectedSupplierId(s.id);
                                setDueSupplierNameInput(s.name);
                                setDueNewSupplierPhone('');
                                setShowSupplierSuggestions(false);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-[#E0F2F1] text-[#102A43] cursor-pointer"
                            >
                              <span className="truncate pr-2">{s.name}</span>
                              <span className={`text-[10px] font-mono font-extrabold shrink-0 ${sDue > 0 ? 'text-[#D32F2F]' : 'text-[#2E7D32]'}`}>
                                {sDue > 0 ? `বাকি: ৳${sDue.toLocaleString()}` : 'বাকি: ৳০'}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                <datalist id="supplier-due-suggestions">
                  <option value={WALK_IN_CASH_SUPPLIER}>নগদ ক্রয়</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.company || s.address || 'সাপ্লায়ার'}
                    </option>
                  ))}
                </datalist>

                {!isWalkInCashSupplier && !matchedDueSupplier && dueSupplierNameInput.trim().length > 0 && (
                  <input
                    type="tel"
                    value={dueNewSupplierPhone}
                    onChange={(e) => setDueNewSupplierPhone(e.target.value)}
                    placeholder="নতুন সাপ্লায়ারের মোবাইল নম্বর (ঐচ্ছিক)"
                    className="w-full px-3 py-1.5 rounded-xl border border-emerald-200 bg-white text-xs font-mono text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                  />
                )}
              </div>

              {/* 1. মোট নতুন মাল (৳) - Either Itemized List (OCR/Manual) or Single Amount */}
              {dueItems.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-extrabold text-[#102A43]">
                      ক্রয়কৃত পণ্যসমূহ ({dueItems.length}টি)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddDueItemRow}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#B2DFDB] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>আরও পণ্য</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {dueItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-[#F1F5F8] border border-[#CBD5E1] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#102A43]">
                            আইটেম #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDueItemRow(idx)}
                            className="text-[#D32F2F] hover:text-red-700 p-0.5 cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <input
                          type="text"
                          required
                          list={`due-prod-suggestions-${idx}`}
                          value={item.productName}
                          onChange={(e) => handleDueItemChange(idx, 'productName', e.target.value)}
                          placeholder="পণ্যের নাম"
                          className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs font-semibold text-[#102A43] focus:ring-2 focus:ring-[#0E6B6B] focus:outline-none"
                        />
                        <datalist id={`due-prod-suggestions-${idx}`}>
                          {products.map((p) => (
                            <option key={p.id} value={p.name} />
                          ))}
                        </datalist>

                        <div className="grid grid-cols-12 gap-1.5">
                          <div className="col-span-4">
                            <input
                              type="number"
                              required
                              min="0.1"
                              step="any"
                              value={item.quantity || ''}
                              onChange={(e) => handleDueItemChange(idx, 'quantity', e.target.value)}
                              placeholder="পরিমাণ"
                              className="w-full px-2 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs font-bold text-center text-[#102A43] focus:outline-none"
                            />
                          </div>
                          <div className="col-span-4">
                            <select
                              value={item.unit}
                              onChange={(e) => handleDueItemChange(idx, 'unit', e.target.value)}
                              className="w-full px-1.5 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs font-semibold text-[#102A43] focus:outline-none"
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
                              onChange={(e) => handleDueItemChange(idx, 'unitCostPrice', e.target.value)}
                              placeholder="৳ দর"
                              className="w-full px-2 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs font-bold text-center text-[#102A43] focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="text-right text-xs font-extrabold text-[#0E6B6B]">
                          মোট টাকা: ৳{(item.totalCost || 0).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-3 py-2 rounded-xl bg-[#E0F2F1] border border-[#B2DFDB] flex items-center justify-between text-xs font-extrabold text-[#0E6B6B]">
                    <span>মোট নতুন মাল (৳):</span>
                    <span className="font-mono text-sm">৳{dueGrossTotal.toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#102A43]">
                      *মোট নতুন মাল (৳)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddDueItemRow}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#B2DFDB] cursor-pointer"
                    >
                      + পণ্যের তালিকা লিখুন
                    </button>
                  </div>
                  <input
                    type="number"
                    required
                    min="1"
                    value={dueAmount}
                    onChange={(e) => setDueAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="যেমন: 1000"
                    className="w-full p-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] text-base font-black font-mono text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B] focus:bg-white"
                  />
                </div>
              )}

              {/* 2. ড্যামেজ মাল ফেরত বাদ (৳) (ঐচ্ছিক) */}
              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  ড্যামেজ মাল ফেরত বাদ (৳) (ঐচ্ছিক)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={dueDamageDeduction}
                  onChange={(e) => setDueDamageDeduction(e.target.value)}
                  placeholder="যেমন: 100"
                  className="w-full p-2.5 rounded-xl border border-amber-400 bg-amber-50/40 text-xs sm:text-sm font-bold text-[#102A43] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              {/* 3. নগদ পরিশোধ / জমা (৳) */}
              <div>
                <div className="flex items-center justify-between gap-1.5 mb-1 flex-wrap">
                  <label className="block text-xs font-bold text-[#102A43]">
                    নগদ পরিশোধ / জমা (৳)
                  </label>
                  <div className="flex items-center gap-1">
                    {dueNetAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDueFormError('');
                          setDueCashPaid(String(dueNetAmount));
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#E8F5E9] text-[#2E7D32] hover:bg-emerald-200 cursor-pointer"
                      >
                        পুরো নগদ (৳{dueNetAmount.toLocaleString()})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDueFormError('');
                        setDueCashPaid('0');
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FFEBEE] text-[#D32F2F] hover:bg-rose-200 cursor-pointer"
                    >
                      সব বাকি (৳০)
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={dueCashPaid}
                  onChange={(e) => {
                    setDueFormError('');
                    setDueCashPaid(e.target.value);
                  }}
                  placeholder="0"
                  className="w-full p-2.5 rounded-xl border border-emerald-300 bg-emerald-50/30 text-xs sm:text-sm font-black font-mono text-[#2E7D32] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:bg-white"
                />
                {dueCashPaidAmount > dueNetAmount && dueNetAmount > 0 && (
                  <p className="text-[10px] font-bold text-amber-700 mt-1">
                    সর্বোচ্চ নিট বিল ৳{dueNetAmount.toLocaleString()} পর্যন্ত নগদ পরিশোধ ধরা হবে।
                  </p>
                )}
              </div>

              {/* 4. অবশিষ্ট বাকি (৳) - Auto-calculated Read-only Summary Box */}
              <div
                className={`p-3 rounded-2xl border space-y-1.5 text-xs ${
                  dueRemainingDueAmount === 0 && dueGrossTotal > 0
                    ? 'bg-[#E8F5E9] border-emerald-200'
                    : 'bg-[#FFEBEE] border-rose-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-[#102A43]">
                    অবশিষ্ট বাকি (৳):
                  </span>
                  <span
                    className={`font-mono font-black text-base ${
                      dueRemainingDueAmount === 0 ? 'text-[#2E7D32]' : 'text-[#D32F2F]'
                    }`}
                  >
                    ৳{dueRemainingDueAmount.toLocaleString()}
                  </span>
                </div>

                {dueGrossTotal > 0 && (
                  <div
                    className={`pt-1.5 border-t space-y-1 ${
                      dueRemainingDueAmount === 0 ? 'border-emerald-200' : 'border-rose-200'
                    }`}
                  >
                    <div className="flex justify-between items-center text-slate-700 font-semibold">
                      <span>মোট নতুন মাল:</span>
                      <span className="font-mono font-bold">৳{dueGrossTotal.toLocaleString()}</span>
                    </div>
                    {dueDamageAmount > 0 && (
                      <div className="flex justify-between items-center text-amber-800 font-semibold">
                        <span>ড্যামেজ মাল ফেরত বাদ:</span>
                        <span className="font-mono font-bold">-৳{dueDamageAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[#0E6B6B] font-bold">
                      <span>মূল পুঁজিতে যোগ (নিট মাল):</span>
                      <span className="font-mono">+৳{dueNetAmount.toLocaleString()}</span>
                    </div>
                    {effectiveDueCashPaid > 0 && (
                      <div className="flex justify-between items-center text-[#2E7D32] font-bold">
                        <span>ক্যাশ বাক্স থেকে নগদ প্রদান:</span>
                        <span className="font-mono">-৳{effectiveDueCashPaid.toLocaleString()}</span>
                      </div>
                    )}
                    {!isWalkInCashSupplier && (matchedDueSupplier || dueRemainingDueAmount > 0) && (
                      <div className="flex justify-between items-center pt-1 border-t border-rose-200/70">
                        <span className="font-bold text-[#D32F2F]">
                          হিসাব শেষে মহাজনের মোট পাওনা:
                        </span>
                        <span className="font-mono font-black text-sm text-[#D32F2F]">
                          ৳{Math.max(
                            0,
                            (matchedDueSupplier?.totalDue ?? matchedDueSupplier?.totalPayableDue ?? 0) +
                              dueRemainingDueAmount
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {dueFormError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-[#D32F2F] text-xs font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{dueFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  রসিদ বা ভাউচার বিবরণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={dueNote}
                  onChange={(e) => setDueNote(e.target.value)}
                  placeholder="যেমন: মিনিকেট চাল ৫ বস্তা চালান নং #551"
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]"
                />
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDueModal(false)}
                  className="flex-1 py-3 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-[#102A43] text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
                >
                  ক্রয় ও হিসাব সেভ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Goods (Purchase Return / Damage) Modal */}
      {showReturnModal && (currentActiveSupplier || selectedSupplier) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-md my-auto rounded-3xl bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 bg-[#D97706] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-base">মাল ফেরত / ড্যামেজ কর্তন</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="p-5 space-y-4">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#102A43]">
                    {(currentActiveSupplier || selectedSupplier)?.name}
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    {(currentActiveSupplier || selectedSupplier)?.company || 'সাপ্লায়ার'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#64748B] block">বর্তমান মোট বাকি:</span>
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
                  ফেরত দেওয়া মালের টাকার অঙ্ক (৳) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={Math.max(1, (currentActiveSupplier || selectedSupplier)?.totalDue ?? (currentActiveSupplier || selectedSupplier)?.totalPayableDue ?? 0)}
                  value={returnAmount}
                  onChange={(e) => setReturnAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="যেমন: 3500"
                  className="w-full p-3 rounded-2xl border border-amber-300 bg-[#F8FAFC] text-base font-black font-mono text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  কারণ / নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="যেমন: নষ্ট পণ্য মহাজনকে ফেরত বা ড্যামেজ কর্তন"
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                />
              </div>

              {/* Automatic Calculation Preview */}
              {Number(returnAmount) > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex justify-between items-center text-xs">
                  <span className="font-semibold text-amber-900">
                    কর্তনের পর অবশিষ্ট দেনা থাকবে:
                  </span>
                  <span className="font-mono font-black text-sm text-[#0E6B6B]">
                    ৳{Math.max(
                      0,
                      ((currentActiveSupplier || selectedSupplier)?.totalDue ?? 0) - Number(returnAmount)
                    ).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="text-[11px] text-[#64748B] leading-tight space-y-0.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <p>• মহাজনের মোট বাকি দেনা থেকে এই টাকা সরাসরি বাদ (মাইনাস) যাবে।</p>
                <p>• ক্যাশ ড্রয়ার বা ক্যাশের টাকা অপরিবর্তিত থাকবে।</p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="flex-1 py-3 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-[#102A43] text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#D97706] hover:bg-amber-700 text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
                >
                  বাকি থেকে কর্তন করুন
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

      {/* Edit Individual Supplier Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 bg-[#0E6B6B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-200" />
                <h3 className="font-bold text-sm sm:text-base">
                  {editingTx.type === 'purchase_return'
                    ? 'মাল ফেরত এন্ট্রি এডিট'
                    : editingTx.type === 'payment_made' || editingTx.type === 'payment_given'
                    ? 'টাকা পরিশোধ এন্ট্রি এডিট'
                    : 'বাকি ক্রয় এন্ট্রি এডিট'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="p-1 rounded-full hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditTxSubmit} className="p-4 sm:p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  টাকার পরিমাণ (৳) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  autoFocus
                  value={editTxAmount}
                  onChange={(e) => setEditTxAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full p-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] text-base font-black font-mono text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  নোট / বিবরণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={editTxNote}
                  onChange={(e) => setEditTxNote(e.target.value)}
                  placeholder="বিবরণ লিখুন..."
                  className="w-full p-2.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B] focus:bg-white"
                />
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-[#102A43] text-xs font-bold cursor-pointer"
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
    </div>
  );
};
