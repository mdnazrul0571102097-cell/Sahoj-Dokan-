import React, { useState, useMemo, useRef } from 'react';
import { Product, PurchaseRecord, ProductUnit, Language } from '../types';
import { translations } from '../i18n/translations';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { CameraCaptureModal } from './CameraCaptureModal';
import { compressImage } from '../utils/image';
import { parseBanglaNumber } from '../utils/number';
import { playSuccessChime } from '../utils/audio';
import {
  Package,
  Plus,
  Search,
  Camera,
  Upload,
  AlertTriangle,
  Edit2,
  Trash2,
  Barcode,
  Layers,
  ShoppingBag,
  TrendingUp,
  X,
  Check,
  CheckCircle2,
  Loader2,
  Sparkles,
  PlusCircle,
  ArrowLeft,
  Minus,
} from 'lucide-react';

import { AppMode } from '../types';

interface Props {
  products: Product[];
  language: Language;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onRecordPurchase: (purchase: PurchaseRecord, updatedProduct: Product) => void;
  appMode?: AppMode;
  onOpenSubscriptionModal?: () => void;
  onBackToMenu?: () => void;
}

export const ProductManagement: React.FC<Props> = ({
  products,
  language,
  onSaveProduct,
  onDeleteProduct,
  onRecordPurchase,
  appMode = 'trial',
  onOpenSubscriptionModal,
  onBackToMenu,
}) => {
  const t = translations[language];

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'lowStock'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [productToRestock, setProductToRestock] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [sessionAddedCount, setSessionAddedCount] = useState(0);

  // Form states for Product
  const [formName, setFormName] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formCategory, setFormCategory] = useState('মুদি আইটেম');
  const [formCostPrice, setFormCostPrice] = useState<string | number>('');
  const [formSellPrice, setFormSellPrice] = useState<string | number>('');
  const [formStock, setFormStock] = useState<string | number>('');
  const [formUnit, setFormUnit] = useState<ProductUnit>('piece');
  const [formBarcode, setFormBarcode] = useState('');
  const [formIsLoose, setFormIsLoose] = useState(false);
  const [formImage, setFormImage] = useState('');
  const [formMinAlert, setFormMinAlert] = useState<number>(5);

  // Status & Feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Additional states for unlimited product addition & duplicate barcode handling
  const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null);
  const [modalSuccessMessage, setModalSuccessMessage] = useState<string | null>(null);
  const isSavingRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const sellPriceInputRef = useRef<HTMLInputElement | null>(null);

  // Restock form
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockCostPrice, setRestockCostPrice] = useState<number>(0);
  const [supplierName, setSupplierName] = useState('');
  const [restockNote, setRestockNote] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Preset Bangladeshi item images
  const presetPhotos = [
    { name: 'আলু', url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=400&q=80' },
    { name: 'পেঁয়াজ', url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=400&q=80' },
    { name: 'রসুন', url: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&w=400&q=80' },
    { name: 'আদা', url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80' },
    { name: 'ডাল', url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80' },
    { name: 'চিনি', url: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=400&q=80' },
    { name: 'তেল', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80' },
    { name: 'চাল', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80' },
    { name: 'ডিম', url: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=400&q=80' },
    { name: 'নুডলস', url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=400&q=80' },
    { name: 'মসলা', url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80' },
    { name: 'সাবান', url: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=400&q=80' },
    { name: 'জুস', url: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=400&q=80' },
  ];

  // Helper to generate a unique random barcode with zero collision risk
  const generateUniqueBarcode = () => {
    const existing = new Set(products.map((p) => p.barcode));
    let code = '';
    let attempts = 0;
    do {
      // 12-digit standard retail barcode (starts with 200 + 9 random digits)
      const rand = Math.floor(100000000 + Math.random() * 900000000);
      code = `200${rand}`;
      attempts++;
    } while (existing.has(code) && attempts < 100);
    return code;
  };

  // Open modal for Create
  const handleOpenCreateModal = () => {
    if (appMode === 'normal') {
      if (onOpenSubscriptionModal) {
        onOpenSubscriptionModal();
      } else {
        alert('আপনার ৬০ দিনের ফ্রি ট্রায়াল শেষ হয়েছে। নতুন প্রোডাক্ট যোগ করতে Pro সাবস্ক্রিপশন চালু করুন।');
      }
      return;
    }
    setEditingProduct(null);
    setSessionAddedCount(0);
    setFormName('');
    setFormNameEn('');
    setFormCategory('মুদি আইটেম');
    setFormCostPrice('');
    setFormSellPrice('');
    setFormStock('');
    setFormUnit('piece');
    setFormBarcode(generateUniqueBarcode());
    setFormIsLoose(false);
    setFormImage('');
    setFormMinAlert(5);
    setErrorMessage(null);
    setDuplicateProduct(null);
    setModalSuccessMessage(null);
    isSavingRef.current = false;
    setIsSaving(false);
    setIsProductModalOpen(true);
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 150);
  };

  const validCategories = [
    'মুদি আইটেম',
    'গ্রোসারি বা বেকারি',
    'কাঁচা বাজার',
    'স্কিন কেয়ার ও কসমেটিক্স',
    'ফ্যাশন আইটেম',
    'অন্যান্য',
  ];

  // Open modal for Edit
  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormNameEn(product.nameEn || '');
    setFormCategory(
      validCategories.includes(product.category) ? product.category : 'মুদি আইটেম'
    );
    setFormCostPrice(product.costPrice || '');
    setFormSellPrice(product.sellPrice || '');
    setFormStock(product.stock || '');
    setFormUnit(product.unit);
    setFormBarcode(product.barcode);
    setFormIsLoose(product.isLoose);
    setFormImage(product.image);
    setFormMinAlert(product.minStockAlert);
    setErrorMessage(null);
    setDuplicateProduct(null);
    setModalSuccessMessage(null);
    isSavingRef.current = false;
    setIsSaving(false);
    setIsProductModalOpen(true);
  };

  // Open restock modal
  const handleOpenRestock = (product: Product) => {
    setProductToRestock(product);
    setRestockQty(10);
    setRestockCostPrice(product.costPrice);
    setSupplierName('');
    setRestockNote('');
    setIsRestockModalOpen(true);
  };

  // Handle Photo upload / snapshot with automatic image compression
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsCompressingImage(true);
        const compressed = await compressImage(file, 360, 360, 0.75);
        if (compressed) {
          setFormImage(compressed);
        }
      } catch (err) {
        console.error('Image compression failed:', err);
      } finally {
        setIsCompressingImage(false);
      }
    }
    // Reset so same file or consecutive photos can be selected
    if (e.target) e.target.value = '';
  };

  // Handle adding stock to duplicate product
  const handleAddStockToDuplicate = (duplicate: Product) => {
    const additionalStock = parseBanglaNumber(formStock) || 10;
    const updated: Product = {
      ...duplicate,
      stock: Math.round((duplicate.stock + additionalStock) * 1000) / 1000,
      sellPrice: parseBanglaNumber(formSellPrice) > 0 ? parseBanglaNumber(formSellPrice) : duplicate.sellPrice,
      costPrice: parseBanglaNumber(formCostPrice) > 0 ? parseBanglaNumber(formCostPrice) : duplicate.costPrice,
      updatedAt: new Date().toISOString(),
    };
    onSaveProduct(updated);
    playSuccessChime();
    setSuccessToast(
      language === 'bn'
        ? `"${duplicate.name}" পণ্যের স্টক +${additionalStock} বৃদ্ধি করা হয়েছে!`
        : `Stock increased for "${duplicate.name}" by +${additionalStock}!`
    );
    setTimeout(() => setSuccessToast(null), 3500);
    setIsProductModalOpen(false);
    setDuplicateProduct(null);
    setErrorMessage(null);
  };

  // Handle Save product
  const handleSaveProduct = async (
    e?: React.FormEvent,
    overrideBarcode?: string,
    forceKeepOpen?: boolean
  ) => {
    if (e) e.preventDefault();
    if (isSavingRef.current) return;

    setErrorMessage(null);
    setDuplicateProduct(null);
    setModalSuccessMessage(null);

    // 1. Name validation
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setErrorMessage(language === 'bn' ? 'দয়া করে পণ্যের নাম লিখুন।' : 'Please enter product name.');
      nameInputRef.current?.focus();
      return;
    }

    // 2. Sell price validation (supports English & Bengali numerals)
    const sellPriceNum = parseBanglaNumber(formSellPrice);
    if (sellPriceNum <= 0) {
      setErrorMessage(
        language === 'bn'
          ? 'দয়া করে সঠিক বিক্রয় মূল্য দিন (যেমন: ৬০)।'
          : 'Please enter a valid selling price.'
      );
      sellPriceInputRef.current?.focus();
      return;
    }

    // 3. Cost price & stock
    const costPriceNum = parseBanglaNumber(formCostPrice);
    const stockNum = parseBanglaNumber(formStock);
    const minAlertNum = parseBanglaNumber(formMinAlert) || 5;

    // 4. Barcode determination
    let barcode = (overrideBarcode || formBarcode).trim();
    if (!barcode) {
      barcode = generateUniqueBarcode();
    }

    // Check duplicate barcode
    const duplicate = products.find(
      (p) => p.barcode === barcode && p.id !== (editingProduct?.id || '')
    );
    if (duplicate) {
      setDuplicateProduct(duplicate);
      setErrorMessage(
        language === 'bn'
          ? `এই বারকোডটি (${barcode}) ইতিমধ্যে "${duplicate.name}" পণ্যে যুক্ত আছে।`
          : `Barcode ${barcode} is already in use by "${duplicate.name}".`
      );
      return;
    }

    const shouldKeepOpen = forceKeepOpen !== undefined ? forceKeepOpen : !editingProduct;

    try {
      isSavingRef.current = true;
      setIsSaving(true);

      // Safety timeout: Ensure unlock after 4000ms if anything stalls
      const safetyTimer = setTimeout(() => {
        isSavingRef.current = false;
        setIsSaving(false);
      }, 4000);

      // Ensure formImage is lightweight
      let finalImage = formImage || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';
      if (finalImage.startsWith('data:') && finalImage.length > 70000) {
        try {
          finalImage = await compressImage(finalImage, 360, 360, 0.7);
        } catch (imgErr) {
          console.warn('Image compression warning:', imgErr);
        }
      }

      const newOrUpdatedProduct: Product = {
        id: editingProduct ? editingProduct.id : `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: trimmedName,
        nameEn: formNameEn.trim(),
        category: formCategory,
        costPrice: costPriceNum,
        sellPrice: sellPriceNum,
        stock: stockNum,
        unit: formUnit,
        barcode: barcode,
        isLoose: formIsLoose,
        image: finalImage,
        minStockAlert: minAlertNum,
        createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onSaveProduct(newOrUpdatedProduct);
      playSuccessChime();
      clearTimeout(safetyTimer);

      if (shouldKeepOpen) {
        // Continuous Unlimited Entry: clear inputs and stay ready for next item
        setFormName('');
        setFormNameEn('');
        setFormCostPrice('');
        setFormSellPrice('');
        setFormStock('');
        setFormBarcode(generateUniqueBarcode());
        setFormIsLoose(false);
        setFormImage('');
        setFormMinAlert(5);
        setErrorMessage(null);
        setDuplicateProduct(null);
        setSessionAddedCount((prev) => prev + 1);
        setModalSuccessMessage(
          language === 'bn'
            ? `"${trimmedName}" সফলভাবে সেভ হয়েছে! পরবর্তী পণ্য লিখুন।`
            : `"${trimmedName}" saved! Enter next product.`
        );
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 120);
      } else {
        // Close modal cleanly and notify
        setIsProductModalOpen(false);
        setEditingProduct(null);
        setSuccessToast(
          language === 'bn'
            ? editingProduct
              ? `"${trimmedName}" পণ্য আপডেট হয়েছে!`
              : `"${trimmedName}" পণ্য সফলভাবে যুক্ত হয়েছে!`
            : 'Product saved successfully!'
        );
        setTimeout(() => setSuccessToast(null), 3000);
      }
    } catch (err: any) {
      console.error('Error in handleSaveProduct:', err);
      setErrorMessage(
        language === 'bn'
          ? 'পণ্য সেভ করতে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
          : 'Failed to save product. Please try again.'
      );
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  // Handle Submit Restock
  const handleSubmitRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToRestock || restockQty <= 0) return;

    const newStock = Math.round((productToRestock.stock + restockQty) * 1000) / 1000;
    const updatedProduct: Product = {
      ...productToRestock,
      stock: newStock,
      costPrice: restockCostPrice > 0 ? restockCostPrice : productToRestock.costPrice,
      updatedAt: new Date().toISOString(),
    };

    const purchaseRecord: PurchaseRecord = {
      id: `purch_${Date.now()}`,
      date: new Date().toISOString(),
      supplierName: supplierName.trim() || 'পাইকারি মার্কেট',
      productId: productToRestock.id,
      productName: productToRestock.name,
      quantity: restockQty,
      unit: productToRestock.unit,
      unitCostPrice: restockCostPrice,
      totalCost: Math.round(restockQty * restockCostPrice * 100) / 100,
      note: restockNote.trim(),
    };

    onRecordPurchase(purchaseRecord, updatedProduct);
    setIsRestockModalOpen(false);
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterType === 'lowStock' && p.stock > p.minStockAlert) return false;
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      return (
        p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        p.barcode.toLowerCase().includes(q)
      );
    });
  }, [products, filterType, selectedCategory, searchQuery]);

  // Inventory stats
  const totalStockValue = useMemo(() => {
    return Math.round(products.reduce((acc, p) => acc + p.stock * p.costPrice, 0));
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stock <= p.minStockAlert).length;
  }, [products]);

  // Delete product confirmation state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  return (
    <div className="h-[calc(100vh-125px)] flex flex-col p-2 sm:p-3 max-w-7xl mx-auto overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-white rounded-2xl px-3 sm:px-4 py-2.5 mb-2.5 flex items-center justify-between gap-2 border border-[#E2E8F0] shadow-xs shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onBackToMenu ? (
            <button
              type="button"
              onClick={onBackToMenu}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] font-extrabold text-xs sm:text-sm transition active:scale-95 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span>হিসাব / মেনু</span>
            </button>
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E6B6B]">
              <ArrowLeft className="w-5 h-5" />
            </div>
          )}
          <h2 className="text-sm sm:text-lg font-bold text-[#102A43] truncate">
            পণ্য / স্টক
          </h2>
        </div>

        {/* Right action: পণ্য ক্রয় করুন */}
        <button
          type="button"
          onClick={() => {
            if (products.length > 0) handleOpenRestock(products[0]);
            else handleOpenCreateModal();
          }}
          className="flex items-center gap-1.5 text-xs font-bold bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#B2DFDB] px-3 py-1.5 rounded-xl border border-[#B2DFDB] transition cursor-pointer shrink-0 whitespace-nowrap"
        >
          <span>রিস্টক</span>
          <Package className="w-4 h-4" />
        </button>
      </div>

      {/* Main White Summary Card matching Customer Baki Khata */}
      <div className="bg-white rounded-[24px] p-3.5 sm:p-4 shadow-sm border border-[#E2E8F0] mb-3 shrink-0">
        <div className="grid grid-cols-3 divide-x divide-[#E2E8F0]">
          <div className="text-center px-1">
            <p className="text-[11px] sm:text-xs font-semibold text-[#64748B] mb-0.5">
              মোট স্টক মূল্য
            </p>
            <p className="text-base sm:text-xl font-extrabold tracking-tight text-[#2E7D32]">
              ৳ {totalStockValue.toLocaleString()}
            </p>
          </div>

          <div
            onClick={() => setFilterType('all')}
            className="text-center px-1 cursor-pointer hover:bg-slate-50 transition rounded-xl"
          >
            <p className="text-[11px] sm:text-xs font-semibold text-[#64748B] mb-0.5">
              মোট পণ্য
            </p>
            <p className="text-base sm:text-xl font-extrabold tracking-tight text-[#0E6B6B]">
              {products.length} টি
            </p>
          </div>

          <div
            onClick={() => {
              if (appMode === 'normal') {
                onOpenSubscriptionModal?.();
                return;
              }
              setFilterType(filterType === 'lowStock' ? 'all' : 'lowStock');
            }}
            className={`text-center px-1 cursor-pointer transition rounded-xl ${
              filterType === 'lowStock' ? 'bg-rose-50 ring-2 ring-rose-300' : 'hover:bg-slate-50'
            }`}
            title="লো স্টক পণ্য ফিল্টার করুন"
          >
            <p className="text-[11px] sm:text-xs font-semibold text-rose-600 mb-0.5 flex items-center justify-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              <span>লো স্টক</span>
              {appMode === 'normal' && (
                <span className="text-[9px] bg-amber-400 text-slate-950 px-1 rounded-sm font-black">
                  🔒
                </span>
              )}
            </p>
            <p className="text-base sm:text-xl font-extrabold tracking-tight text-[#D32F2F]">
              {lowStockCount} টি
            </p>
          </div>
        </div>
      </div>

      {/* Low Stock Alert Alert Bar */}
      {lowStockCount > 0 && (
        <div
          onClick={() => {
            if (appMode === 'normal') {
              onOpenSubscriptionModal?.();
              return;
            }
            setFilterType(filterType === 'lowStock' ? 'all' : 'lowStock');
          }}
          className="mb-2.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200 flex items-center justify-between gap-2 shadow-2xs shrink-0 cursor-pointer hover:border-amber-300 transition"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-amber-950 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse shrink-0" />
            <span className="truncate">
              ⚠️ সতর্কবার্তা: <strong className="text-rose-700">{lowStockCount}</strong>টি পণ্যের স্টক কম!
            </span>
          </div>
          <span className="text-[10px] sm:text-xs font-black text-rose-700 bg-white px-2 py-0.5 rounded-lg border border-rose-200 shrink-0 flex items-center gap-1">
            {appMode === 'normal' ? (
              <>
                <span>লো স্টক</span>
                <span className="text-[9px] bg-amber-400 text-slate-950 px-1 py-0.2 rounded-sm font-black">
                  🔒 Pro
                </span>
              </>
            ) : filterType === 'lowStock' ? (
              'সব পণ্য দেখান'
            ) : (
              'লো স্টক ফিল্টার'
            )}
          </span>
        </div>
      )}

      {/* Search Row & Filter Button */}
      <div className="flex items-center gap-2 mb-2.5 shrink-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#9AA5B1]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="পণ্য খুঁজুন..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E2E8F0] text-xs sm:text-sm text-[#102A43] placeholder-[#9AA5B1] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B] shadow-xs"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setFilterType(filterType === 'lowStock' ? 'all' : 'lowStock');
          }}
          className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition shadow-xs cursor-pointer ${
            filterType === 'lowStock'
              ? 'bg-rose-100 border-rose-300 text-rose-700'
              : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#EDF2F7]'
          }`}
          title="লো স্টক ফিল্টার"
        >
          <AlertTriangle className="w-4 h-4" />
        </button>
      </div>

      {/* Status count line & স্টক রিপোর্ট button */}
      <div className="flex items-center justify-between px-1 mb-2.5 shrink-0">
        <div className="text-xs font-bold text-[#64748B]">
          পণ্যের তালিকা ({filteredProducts.length})
        </div>

        <button
          type="button"
          onClick={() => {
            setSuccessToast(`মোট পণ্য: ${products.length} টি • মোট স্টক মূল্য: ৳${totalStockValue.toLocaleString()}`);
            setTimeout(() => setSuccessToast(null), 4000);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#B2DFDB] font-bold text-xs border border-[#B2DFDB] transition cursor-pointer"
        >
          <span>📄</span>
          <span>স্টক রিপোর্ট</span>
        </button>
      </div>

      {/* Product List Cards */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 pb-20">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-[24px] p-8 text-center border border-[#E2E8F0] shadow-xs">
            <Package className="w-10 h-10 text-[#9AA5B1] mx-auto mb-2 stroke-1" />
            <p className="text-xs font-semibold text-[#64748B]">
              কোন পণ্য পাওয়া যায়নি
            </p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const handleQuickStockChange = (delta: number) => {
              const nextStock = Math.max(0, Math.round((product.stock + delta) * 1000) / 1000);
              if (nextStock === product.stock) return;
              onSaveProduct({
                ...product,
                stock: nextStock,
                updatedAt: new Date().toISOString(),
              });
            };

            return (
              <div
                key={product.id}
                className="bg-white rounded-[20px] p-3 border border-[#E2E8F0] shadow-xs space-y-2.5 hover:border-[#0E6B6B] transition-all"
              >
                {/* Row 1: Photo, Name, Price & Stock Badge */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-2xl bg-[#E0F2F1] border border-[#B2DFDB] overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/assets/icon.png';
                          }}
                        />
                      ) : (
                        <span className="text-[#0E6B6B] font-bold text-lg">
                          {product.name.slice(0, 1)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm sm:text-base text-[#102A43] truncate">
                        {product.name}
                      </h4>
                      <p className="text-xs text-[#64748B] mt-0.5 tabular-nums">
                        ক্রয়: ৳{product.costPrice} • <span className="font-bold text-[#2E7D32]">বিক্রয়: ৳{product.sellPrice}</span>
                      </p>
                    </div>
                  </div>

                  <span
                    onClick={() => handleOpenRestock(product)}
                    className="bg-[#E0F2F1] text-[#0E6B6B] font-extrabold text-xs px-2.5 py-1.5 rounded-xl border border-[#B2DFDB] shrink-0 whitespace-nowrap tabular-nums cursor-pointer"
                    title="বড় সংখ্যায় রিস্টক করতে ট্যাপ করুন"
                  >
                    {product.stock} {product.unit}
                  </span>
                </div>

                {/* Row 2: Instant Quick Stock Stepper (- / +) + Restock, Edit, Delete */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F1F5F9]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickStockChange(-1)}
                      disabled={product.stock <= 0}
                      className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-40 border border-rose-200 text-[#D32F2F] flex items-center justify-center transition active:scale-95 cursor-pointer"
                      title="স্টক ১ কমান"
                    >
                      <Minus className="w-4 h-4 stroke-[2.8]" />
                    </button>
                    <span className="px-2 text-xs font-extrabold text-[#102A43] tabular-nums whitespace-nowrap">
                      দ্রুত স্টক
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuickStockChange(1)}
                      className="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#2E7D32] flex items-center justify-center transition active:scale-95 cursor-pointer"
                      title="স্টক ১ বাড়ান"
                    >
                      <Plus className="w-4 h-4 stroke-[2.8]" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenRestock(product)}
                      className="px-2.5 h-9 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] text-xs font-bold transition cursor-pointer whitespace-nowrap"
                      title="নতুন চালান রিস্টক"
                    >
                      + রিস্টক
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(product)}
                      className="w-9 h-9 rounded-xl bg-[#EDF2F7] hover:bg-slate-200 text-[#64748B] flex items-center justify-center transition cursor-pointer"
                      title="সম্পাদনা"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductToDelete(product)}
                      className="w-9 h-9 rounded-xl bg-[#FFEBEE] hover:bg-rose-200 text-[#D32F2F] flex items-center justify-center transition cursor-pointer"
                      title="পণ্য ডিলিট করুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Product Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl border border-[#E2E8F0] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#102A43]">
                পণ্যটি ডিলিট করতে চান?
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                আপনি কি নিশ্চিত যে <strong className="text-[#102A43]">"{productToDelete.name}"</strong> পণ্যটি তালিকা থেকে মুছে ফেলতে চান?
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] text-[#102A43] text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  const deletedName = productToDelete.name;
                  onDeleteProduct(productToDelete.id);
                  setProductToDelete(null);
                  setIsProductModalOpen(false);
                  setEditingProduct(null);
                  setSuccessToast(`"${deletedName}" পণ্যটি সফলভাবে ডিলিট করা হয়েছে!`);
                  setTimeout(() => setSuccessToast(null), 3000);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              >
                হ্যাঁ, ডিলিট করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button "+ নতুন পণ্য" */}
      <button
        type="button"
        onClick={handleOpenCreateModal}
        className="fixed bottom-20 right-4 sm:right-6 z-30 btn-teal-fab px-5 py-3 rounded-2xl font-bold text-sm sm:text-base flex items-center gap-2 shadow-xl cursor-pointer active:scale-95 transition"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
        <span>নতুন পণ্য</span>
      </button>

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden">
            {/* 1. Modal Header (Clean & Compact) */}
            <div className="shrink-0 px-4 py-3 bg-[#0E6B6B] text-white flex items-center justify-between shadow-sm">
              <h3 className="font-black text-base sm:text-lg text-white">
                {editingProduct ? 'পণ্য এডিট' : 'পণ্য যোগ করুন'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsProductModalOpen(false);
                  setDuplicateProduct(null);
                  setErrorMessage(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* 2. Compact Body */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
              {/* Prominent Success Notification after Save */}
              {modalSuccessMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs flex items-center justify-between gap-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold">{modalSuccessMessage}</span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                    পাতা খালি হয়েছে
                  </span>
                </div>
              )}

              {/* Product Photo Upload / Snapshot (Compact, No guide texts, No mobile camera button, No preset tags) */}
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500 bg-slate-100 dark:bg-slate-800 shrink-0 shadow-2xs flex items-center justify-center">
                  {isCompressingImage ? (
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                  ) : formImage ? (
                    <div className="relative w-full h-full">
                      <img
                        src={formImage}
                        alt="Product Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1 right-1 p-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-1 text-center">
                      <Camera className="w-5 h-5 text-slate-400 mb-0.5" />
                      <span className="text-[10px] font-bold text-slate-400">ছবি খালি</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Direct Live Camera Capture Button */}
                  <button
                    type="button"
                    onClick={() => setIsCameraModalOpen(true)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    title="সরাসরি ক্যামেরা দিয়ে ছবি তুলুন"
                  >
                    <Camera className="w-4 h-4" />
                    <span>ছবি তুলুন</span>
                  </button>

                  {/* File Upload / Gallery Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-[#0E6B6B] hover:bg-[#0B5656] active:scale-95 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    title="গ্যালারি থেকে ফটো নির্বাচন করুন"
                  >
                    <Upload className="w-4 h-4 text-emerald-200" />
                    <span>গ্যালারি</span>
                  </button>

                  {formImage && (
                    <button
                      type="button"
                      onClick={() => setFormImage('')}
                      className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-black flex items-center gap-1 transition cursor-pointer"
                      title="ছবি বাদ দিন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>মুছুন</span>
                    </button>
                  )}
                </div>

                {/* Hidden input for gallery file upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleImageFileChange}
                />
              </div>

              {/* Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {t.productName} *
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveProduct(undefined, undefined, !editingProduct ? true : false);
                      }
                    }}
                    placeholder="যেমন: দেশি পেঁয়াজ বা তেল"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    ক্যাটাগরি
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="মুদি আইটেম">মুদি আইটেম</option>
                    <option value="গ্রোসারি বা বেকারি">গ্রোসারি বা বেকারি</option>
                    <option value="কাঁচা বাজার">কাঁচা বাজার</option>
                    <option value="স্কিন কেয়ার ও কসমেটিক্স">স্কিন কেয়ার ও কসমেটিক্স</option>
                    <option value="ফ্যাশন আইটেম">ফ্যাশন আইটেম</option>
                    <option value="অন্যান্য">অন্যান্য</option>
                  </select>
                </div>
              </div>

              {/* Cost Price, Selling Price & Stock */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {t.costPrice}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveProduct(undefined, undefined, !editingProduct ? true : false);
                      }
                    }}
                    placeholder="৳ ৫০"
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {t.sellPrice} *
                  </label>
                  <input
                    ref={sellPriceInputRef}
                    type="text"
                    inputMode="decimal"
                    value={formSellPrice}
                    onChange={(e) => {
                      setFormSellPrice(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveProduct(undefined, undefined, !editingProduct ? true : false);
                      }
                    }}
                    placeholder="৳ ৬০"
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 placeholder-slate-400 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {t.stock}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="১০"
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Unit & Low Stock Alert (Compact) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {t.unit}
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => {
                      const u = e.target.value as ProductUnit;
                      setFormUnit(u);
                      if (u === 'kg' || u === 'gm') setFormIsLoose(true);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="piece">টি / পিস</option>
                    <option value="kg">কেজি</option>
                    <option value="gm">গ্রাম</option>
                    <option value="packet">প্যাকেট</option>
                    <option value="liter">লিটার</option>
                    <option value="dozen">ডজন</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                    কম স্টক সতর্কতা
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formMinAlert}
                    onChange={(e) => setFormMinAlert(parseBanglaNumber(e.target.value) || 5)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Loose Item Checkbox (Very Compact Single Line) */}
              <label className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                  খোলা পণ্য যোগ করতে টিক চিহ্ন দিন
                </span>
                <input
                  type="checkbox"
                  checked={formIsLoose}
                  onChange={(e) => setFormIsLoose(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </label>

              {/* Barcode & Colorful Buttons (High Contrast & Catchy) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {t.barcode}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-2xs flex items-center gap-1 active:scale-95 transition cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>স্ক্যান</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormBarcode(generateUniqueBarcode());
                        setDuplicateProduct(null);
                        setErrorMessage(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-2xs flex items-center gap-1 active:scale-95 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Auto Barcode</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={formBarcode}
                  onChange={(e) => {
                    setFormBarcode(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                    if (duplicateProduct) setDuplicateProduct(null);
                  }}
                  placeholder="বারকোড সংখ্যা..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 font-mono text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 3. Sticky Footer with Actions & Validation Feedback */}
            <div className="shrink-0 p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              {/* Modal Success Message (Continuous Entry mode) */}
              {modalSuccessMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="flex-1">{modalSuccessMessage}</span>
                </div>
              )}

              {/* Error Message Alert */}
              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-start gap-2 shadow-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span className="flex-1">{errorMessage}</span>
                </div>
              )}

              {/* Duplicate Barcode Helper Actions */}
              {duplicateProduct && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-2">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    বারকোডটি ইতিমধ্যে ব্যবহৃত হয়েছে। নিচের যেকোনো অপশন দিয়ে দ্রুত কাজ করুন:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveProduct(undefined, generateUniqueBarcode())}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>নতুন অটো বারকোড দিয়ে সেভ করুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddStockToDuplicate(duplicateProduct)}
                      className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>বিদ্যমান পণ্যের স্টক বাড়ান (+{parseBanglaNumber(formStock) || 10})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsProductModalOpen(false);
                    setDuplicateProduct(null);
                    setErrorMessage(null);
                  }}
                  className="px-3.5 py-2.5 rounded-2xl border border-[#E2E8F0] bg-[#EDF2F7] text-[#102A43] font-bold text-xs active:scale-95 transition cursor-pointer"
                >
                  {!editingProduct && sessionAddedCount > 0 ? (language === 'bn' ? 'সম্পন্ন / বের হন' : 'Done') : t.cancel}
                </button>

                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => setProductToDelete(editingProduct)}
                    className="px-3.5 py-2.5 rounded-2xl bg-[#FFEBEE] hover:bg-rose-200 text-[#D32F2F] border border-rose-200 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="এই পণ্যটি ডিলিট করুন"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ডিলিট</span>
                  </button>
                )}

                {!editingProduct && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveProduct(undefined, undefined, false)}
                    className="px-3 py-2.5 rounded-2xl bg-[#EDF2F7] hover:bg-slate-200 text-[#102A43] font-bold text-xs border border-[#E2E8F0] active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    title="এই পণ্যটি সেভ করে ফর্মটি বন্ধ করুন"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'সেভ ও বের হন' : 'Save & Exit'}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveProduct(undefined, undefined, !editingProduct ? true : false)}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-[#0E6B6B] hover:bg-[#0B5656] active:scale-95 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  title={!editingProduct ? 'পণ্য সেভ হবে এবং সাথে সাথে ফর্মটি নতুন পণ্য লেখার জন্য খালি হয়ে যাবে' : 'পণ্য আপডেট করুন'}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>সেভ হচ্ছে...</span>
                    </>
                  ) : editingProduct ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>{t.saveProduct}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>{language === 'bn' ? 'পণ্য সেভ করুন' : 'Save Product'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {successToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-900 text-white px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-600 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{successToast}</span>
        </div>
      )}

      {/* Restock / Stock Purchase Modal */}
      {isRestockModalOpen && productToRestock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h4 className="font-bold text-base text-slate-800 dark:text-white mb-1">
              {t.purchaseRecordTitle}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              পণ্য: <span className="font-bold text-emerald-700">{productToRestock.name}</span> (বর্তমান স্টক: {productToRestock.stock} {productToRestock.unit})
            </p>

            <form onSubmit={handleSubmitRestock} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  নতুন কেনা পরিমাণ ({productToRestock.unit}) *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  প্রতি ইউনিটের ক্রয়মূল্য (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={restockCostPrice}
                  onChange={(e) => setRestockCostPrice(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {t.supplierName}
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="যেমন: কারওয়ান বাজার আড়ৎ"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <span>মোট ক্রয় খরচ:</span>
                <span>৳{Math.round(restockQty * restockCostPrice)}</span>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800"
                >
                  স্টকে যোগ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal for Product Form */}
      {isScannerOpen && (
        <BarcodeScannerModal
          language={language}
          onScanSuccess={(code) => {
            setFormBarcode(code);
            setIsScannerOpen(false);
          }}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Live Camera Viewfinder Modal for Taking Product Photo */}
      {isCameraModalOpen && (
        <CameraCaptureModal
          language={language}
          onCapture={(dataUrl) => {
            setFormImage(dataUrl);
            setIsCameraModalOpen(false);
          }}
          onClose={() => setIsCameraModalOpen(false)}
        />
      )}
    </div>
  );
};
