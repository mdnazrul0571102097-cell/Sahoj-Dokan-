import React, { useState, useMemo } from 'react';
import {
  Product,
  CartItem,
  Sale,
  Customer,
  ShopProfile,
  Language,
  AppMode,
  Expense,
  BulkPurchase,
  PurchaseRecord,
  OwnerTransaction,
} from '../types';
import { translations } from '../i18n/translations';
import { playBarcodeBeep, playSuccessChime } from '../utils/audio';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { LooseItemModal } from './LooseItemModal';
import { ReceiptModal } from './ReceiptModal';
import { QuickSaleModal } from './QuickSaleModal';
import {
  Search,
  Camera,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  User,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Check,
  ChevronRight,
  ArrowLeft,
  Undo2,
  Calendar,
  SlidersHorizontal,
  CheckSquare,
  X,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';

interface Props {
  products: Product[];
  customers: Customer[];
  profile: ShopProfile;
  language: Language;
  onCompleteSale: (sale: Sale, updatedProducts: Product[]) => void;
  onAddNewCustomer: (customer: Customer) => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  sales?: Sale[];
  appMode?: AppMode;
  onOpenSubscriptionModal?: () => void;
  onDeleteSale?: (saleId: string) => void;
  initialStoreCapital?: number;
  onSaveInitialStoreCapital?: (amount: number) => void;
  expenses?: Expense[];
  bulkPurchases?: BulkPurchase[];
  purchases?: PurchaseRecord[];
  ownerTransactions?: OwnerTransaction[];
}

export const PosView: React.FC<Props> = ({
  products,
  customers,
  profile,
  language,
  onCompleteSale,
  onAddNewCustomer,
  cart,
  setCart,
  sales = [],
  appMode = 'trial',
  onOpenSubscriptionModal,
  onDeleteSale,
  initialStoreCapital = 0,
  onSaveInitialStoreCapital,
  expenses = [],
  bulkPurchases = [],
  purchases = [],
  ownerTransactions = [],
}) => {
  const t = translations[language];

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQuickSaleOpen, setIsQuickSaleOpen] = useState(false);
  const [quickSaleInitialMode, setQuickSaleInitialMode] = useState<'sale' | 'return'>('sale');

  // Loose item modal state
  const [looseProductToMeasure, setLooseProductToMeasure] = useState<Product | null>(null);

  // Cart / Payment state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('cash');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);

  // Completed sale receipt state
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Categories list matching the 6 official shop categories
  const categories = [
    { id: 'all', label: 'সকল পণ্য' },
    { id: 'মুদি আইটেম', label: 'মুদি আইটেম' },
    { id: 'গ্রোসারি বা বেকারি', label: 'গ্রোসারি বা বেকারি' },
    { id: 'কাঁচা বাজার', label: 'কাঁচা বাজার' },
    { id: 'স্কিন কেয়ার ও কসমেটিক্স', label: 'স্কিন কেয়ার ও কসমেটিক্স' },
    { id: 'ফ্যাশন আইটেম', label: 'ফ্যাশন আইটেম' },
    { id: 'অন্যান্য', label: 'অন্যান্য' },
  ];

  // Filter products by category and search query
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat =
        selectedCategory === 'all' || p.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesCat;

      const matchesName =
        p.name.toLowerCase().includes(query) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(query));
      const matchesBarcode = p.barcode.toLowerCase().includes(query);

      return matchesCat && (matchesName || matchesBarcode);
    });
  }, [products, selectedCategory, searchQuery]);

  // Handle Barcode Scan Match
  const handleBarcodeScanned = (scannedCode: string) => {
    setIsScannerOpen(false);
    const matched = products.find(
      (p) => p.barcode.toLowerCase() === scannedCode.toLowerCase()
    );

    if (matched) {
      if (matched.isLoose) {
        setLooseProductToMeasure(matched);
      } else {
        handleAddToCart(matched, 1, matched.sellPrice);
      }
    } else {
      alert(
        language === 'bn'
          ? `বারকোড '${scannedCode}' দিয়ে কোনো পণ্য পাওয়া যায়নি!`
          : `No product found for barcode '${scannedCode}'`
      );
    }
  };

  // Add Item to Cart
  const handleAddToCart = (product: Product, quantity: number, calculatedPrice: number) => {
    if (product.stock <= 0) {
      alert(t.insufficientStock);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const nextCart = [...prev];
        const currentItem = nextCart[existingIndex];
        const newQty = Math.round((currentItem.quantity + quantity) * 1000) / 1000;
        const newTotal = Math.round(newQty * product.sellPrice * 100) / 100;
        nextCart[existingIndex] = {
          ...currentItem,
          quantity: newQty,
          totalPrice: newTotal,
        };
        return nextCart;
      } else {
        return [
          ...prev,
          {
            product,
            quantity,
            unitPrice: product.sellPrice,
            totalPrice: calculatedPrice,
            costPrice: product.costPrice,
          },
        ];
      }
    });

    playBarcodeBeep();
  };

  // Handle tapping on a product card
  const handleProductCardClick = (product: Product) => {
    if (product.isLoose) {
      if (appMode === 'normal') {
        if (onOpenSubscriptionModal) {
          onOpenSubscriptionModal();
        } else {
          alert('খোলা পণ্য ও ওজন অনুযায়ী বিক্রি করার সুবিধাটি Pro প্যাকেজের অন্তর্ভুক্ত।');
        }
        return;
      }
      setLooseProductToMeasure(product);
    } else {
      handleAddToCart(product, 1, product.sellPrice);
    }
  };

  // Update item quantity in cart
  const updateCartItemQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeCartItem(index);
      return;
    }

    setCart((prev) => {
      const nextCart = [...prev];
      const item = nextCart[index];
      const newTotal = Math.round(newQty * item.unitPrice * 100) / 100;
      nextCart[index] = {
        ...item,
        quantity: Math.round(newQty * 1000) / 1000,
        totalPrice: newTotal,
      };
      return nextCart;
    });
  };

  // Remove item from cart
  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subTotal = useMemo(() => {
    return Math.round(cart.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;
  }, [cart]);

  const totalCost = useMemo(() => {
    return (
      Math.round(
        cart.reduce((sum, item) => sum + item.costPrice * item.quantity, 0) * 100
      ) / 100
    );
  }, [cart]);

  const grandTotal = Math.max(0, subTotal - (Number(discount) || 0));

  // Determine paid amount
  const paidAmount = paidAmountInput !== '' ? Number(paidAmountInput) : grandTotal;
  const changeAmount = Math.max(0, paidAmount - grandTotal);
  const dueAmount = Math.max(0, grandTotal - paidAmount);

  // Quick preset paid buttons
  const quickPaidPresets = [
    { label: language === 'bn' ? 'ঠিক ঠিক' : 'Exact', val: grandTotal },
    { label: '৳৫০', val: 50 },
    { label: '৳১০০', val: 100 },
    { label: '৳২০০', val: 200 },
    { label: '৳৫০০', val: 500 },
    { label: '৳১০০০', val: 1000 },
  ];

  // Complete Sale
  const handleFinalizeSale = () => {
    if (cart.length === 0) return;

    if (appMode === 'normal') {
      if (onOpenSubscriptionModal) {
        onOpenSubscriptionModal();
      } else {
        alert('আপনার ৬০ দিনের ফ্রি ট্রায়াল শেষ হয়েছে। বিক্রি সম্পন্ন করতে ও রসিদ প্রিন্ট করতে Pro চালু করুন।');
      }
      return;
    }

    if (dueAmount > 0 && selectedCustomerId === 'cash') {
      alert(
        language === 'bn'
          ? 'বাকি বিক্রির জন্য অনুগ্রহ করে বাকি খাতা থেকে কাস্টমার নির্বাচন করুন!'
          : 'Please select a customer from Baki Khata for credit sales!'
      );
      return;
    }

    const selectedCust = customers.find((c) => c.id === selectedCustomerId);

    const saleItems = cart.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unit: item.product.unit,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
      totalPrice: item.totalPrice,
    }));

    const newSale: Sale = {
      id: `sale_${Date.now()}`,
      invoiceNo: `${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toISOString(),
      items: saleItems,
      subTotal,
      discount: Number(discount) || 0,
      grandTotal,
      totalCost,
      profit: grandTotal - totalCost,
      paidAmount,
      dueAmount,
      changeAmount,
      paymentType:
        dueAmount > 0 ? (paidAmount > 0 ? 'partial' : 'due') : 'cash',
      customerId: selectedCust?.id,
      customerName: selectedCust ? selectedCust.name : t.cashCustomer,
      customerPhone: selectedCust?.phone,
    };

    // Decrement stock immediately
    const updatedProducts = products.map((prod) => {
      const cartItem = cart.find((ci) => ci.product.id === prod.id);
      if (cartItem) {
        return {
          ...prod,
          stock: Math.max(0, Math.round((prod.stock - cartItem.quantity) * 1000) / 1000),
          updatedAt: new Date().toISOString(),
        };
      }
      return prod;
    });

    onCompleteSale(newSale, updatedProducts);
    playSuccessChime();
    setCompletedSale(newSale);
    setCart([]);
    setPaidAmountInput('');
    setDiscount(0);
    setIsCartOpenMobile(false);
  };

  // Add customer inline from POS
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    const newCustomer: Customer = {
      id: `cust_${Date.now()}`,
      name: newCustName.trim(),
      phone: newCustPhone.trim() || '---',
      totalDue: 0,
      createdAt: new Date().toISOString(),
    };

    onAddNewCustomer(newCustomer);
    setSelectedCustomerId(newCustomer.id);
    setShowAddCustomerModal(false);
    setNewCustName('');
    setNewCustPhone('');
  };

  // Clean number formatter: strips unnecessary trailing zeros after decimal (e.g. 33.50 -> 33.5)
  const formatCleanNumber = (val: number | string): string | number => {
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(num)) return val;
    return Number(num.toFixed(3));
  };

  return (
    <div className="h-[calc(100dvh-96px)] sm:h-[calc(100dvh-104px)] flex flex-col px-2 py-1.5 sm:p-2.5 max-w-7xl mx-auto overflow-hidden relative">
      {/* 1. Top Search & Compact Action Bar */}
      <div className="flex items-center gap-1.5 mb-1.5 shrink-0">
        {/* দ্রুত বিক্রি Button (ছোট ও পরিপাটি) */}
        <button
          type="button"
          onClick={() => {
            setQuickSaleInitialMode('sale');
            setIsQuickSaleOpen(true);
          }}
          className="px-2.5 py-1.5 sm:py-2 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-bold text-[11px] sm:text-xs leading-tight shadow-2xs transition active:scale-95 shrink-0 cursor-pointer whitespace-nowrap"
          title="পণ্য অ্যাড বা স্ক্যান ছাড়াই সরাসরি বিক্রির হিসাব রাখুন"
        >
          দ্রুত বিক্রি
        </button>

        {/* মাঝখানে একটু বড় ও স্পষ্ট সার্চ বার */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="পণ্য বা বারকোড খুঁজুন..."
            className="w-full pl-8 pr-7 py-1.5 sm:py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0E6B6B]/25 focus:border-[#0E6B6B] shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#0F172A]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Camera Barcode Scanner Button (ছোট ও পরিপাটি) */}
        <button
          type="button"
          onClick={() => {
            if (appMode === 'normal') {
              if (onOpenSubscriptionModal) {
                onOpenSubscriptionModal();
              } else {
                alert('বারকোড স্ক্যানার দিয়ে দ্রুত বিক্রির সুবিধাটি Pro প্যাকেজের অন্তর্ভুক্ত।');
              }
              return;
            }
            setIsScannerOpen(true);
          }}
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 sm:py-2 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-bold text-[11px] sm:text-xs shadow-2xs transition active:scale-95 shrink-0 cursor-pointer"
          title="বারকোড স্ক্যান করুন"
        >
          <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">স্ক্যান</span>
        </button>

        {/* Return Product Button (হোম স্ক্রিনে পণ্য ফেরত বাটন - তীর চিহ্ন ছাড়া পরিপাটি বাটন) */}
        <button
          type="button"
          onClick={() => {
            setQuickSaleInitialMode('return');
            setIsQuickSaleOpen(true);
          }}
          className="px-2.5 py-1.5 sm:py-2 rounded-xl bg-rose-50 border border-rose-200 text-[#D32F2F] hover:bg-[#D32F2F] hover:text-white font-bold text-[11px] sm:text-xs leading-tight shadow-2xs shrink-0 cursor-pointer transition active:scale-95 whitespace-nowrap"
          title="পণ্য ফেরত ও হিসাব সমন্বয়"
        >
          পণ্য ফেরত
        </button>
      </div>

      {/* 2. Product Cards Grid (Compact 2-Column Mobile Grid) */}
      <div className="flex-1 overflow-y-auto pr-0.5 pb-1">
        {filteredProducts.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center p-5 bg-white rounded-2xl border border-[#E2E8F0]">
            <Search className="w-10 h-10 text-[#9AA5B1] mb-2 stroke-1" />
            <p className="text-sm font-bold text-[#0F172A]">কোনো পণ্য পাওয়া যায়নি</p>
            <p className="text-xs text-[#64748B] mt-1">
              'হিসাব / মেনু' থেকে 'পণ্য / স্টক'-এ নতুন পণ্য যোগ করুন
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-2.5">
            {filteredProducts.map((product) => {
              const cartItem = cart.find((ci) => ci.product.id === product.id);
              const isLowStock = product.stock <= (product.minStockAlert || 5);
              const isOutOfStock = product.stock <= 0;
              const displayUnit = product.isLoose ? 'কেজি' : product.unit;
              const cleanStock = formatCleanNumber(product.stock);
              const cleanPrice = formatCleanNumber(product.sellPrice);

              return (
                <div
                  key={product.id}
                  onClick={() => handleProductCardClick(product)}
                  className={`group relative text-left rounded-2xl overflow-hidden border border-[#E2E8F0] transition-all duration-150 flex flex-col justify-between bg-white hover:shadow-md hover:border-[#0E6B6B]/45 active:scale-[0.98] cursor-pointer shadow-2xs ${
                    cartItem ? 'ring-2 ring-[#0E6B6B] border-[#0E6B6B] bg-[#F0FDF9]/30' : ''
                  }`}
                >
                  {/* Product Photo (~20% Reduced Height for High Density) & Stock Badges */}
                  <div className="relative h-24 sm:h-28 w-full bg-[#F8FAFC] overflow-hidden shrink-0">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';
                      }}
                    />

                    {/* Stock Alert Badge */}
                    <div className="absolute top-1.5 left-1.5">
                      {isOutOfStock ? (
                        <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-slate-900/90 text-white shadow-2xs">
                          স্টক শেষ
                        </span>
                      ) : isLowStock ? (
                        <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-extrabold bg-rose-600 text-white shadow-2xs flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>{cleanStock} {displayUnit}</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-[#0E6B6B]/90 text-white backdrop-blur-xs shadow-2xs">
                          {cleanStock} {displayUnit}
                        </span>
                      )}
                    </div>

                    {/* Loose / Weight indicator badge */}
                    {product.isLoose && (
                      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-400/95 text-slate-950 shadow-2xs">
                        খোলা / কেজি
                      </div>
                    )}
                  </div>

                  {/* Compact Product Details & Action */}
                  <div className="px-2.5 py-1.5 sm:p-2.5 flex-1 flex flex-col justify-between">
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-[13px] text-[#0F172A] line-clamp-1 leading-snug">
                        {product.name}
                      </h4>
                      {product.barcode ? (
                        <p className="text-[9.5px] text-[#64748B] font-mono leading-tight mt-0.5 truncate">
                          #{product.barcode}
                        </p>
                      ) : (
                        <p className="text-[9.5px] text-[#94A3B8] leading-tight mt-0.5 truncate">
                          {product.category}
                        </p>
                      )}
                    </div>

                    <div className="mt-1.5 pt-1.5 border-t border-[#F1F5F9] flex items-center justify-between gap-1">
                      <div className="min-w-0 truncate">
                        <span className="text-sm sm:text-base font-black text-[#0E6B6B] tracking-tight tabular-nums">
                          ৳{cleanPrice}
                        </span>
                        <span className="text-[10px] font-semibold text-[#64748B] ml-0.5">
                          /{displayUnit}
                        </span>
                      </div>

                      {/* Compact Modern Add (+) Button or In-Cart Quantity Pill */}
                      {cartItem ? (
                        <div className="px-2 py-0.5 rounded-lg bg-[#0E6B6B] text-white text-[10px] font-bold flex items-center gap-0.5 shadow-2xs shrink-0 tabular-nums">
                          <span>{formatCleanNumber(cartItem.quantity)} {displayUnit}</span>
                        </div>
                      ) : (
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#0E6B6B] hover:bg-[#094747] text-white flex items-center justify-center transition-all shadow-2xs active:scale-90 shrink-0">
                          <Plus className="w-3.5 h-3.5 stroke-[2.75]" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Compact Persistent Bottom Cart Summary Bar */}
      <div className="pt-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setIsCartOpenMobile(true)}
          className="w-full py-2 px-3.5 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-bold text-xs sm:text-sm flex items-center justify-between shadow-md active:scale-[0.99] transition cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4" />
            <span>
              {cart.length} টি পণ্য
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-sm sm:text-base font-extrabold tracking-tight tabular-nums">
              ৳{formatCleanNumber(grandTotal)}
            </span>
            <span className="bg-white/20 px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1">
              <span>{cart.length > 0 ? 'বিক্রি সম্পন্ন করুন →' : 'কার্ট দেখুন'}</span>
            </span>
          </div>
        </button>
      </div>

      {/* Cart & Checkout Drawer Modal */}
      {isCartOpenMobile && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-[#0E6B6B] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                <h3 className="font-bold text-base">বিক্রয় রশিদ ও চেকআউট</h3>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold">
                  {cart.length}টি
                </span>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-emerald-100 hover:text-white flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10"
                    title="কার্ট খালি করুন"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>খালি করুন</span>
                  </button>
                )}
                <button
                  onClick={() => setIsCartOpenMobile(false)}
                  className="p-1 rounded-full hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Customer Selector */}
            <div className="p-3 bg-[#F8FAFC] border-b border-[#E2E8F0] shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#0F172A] flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#0E6B6B]" />
                  <span>গ্রাহক নির্বাচন</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="text-xs font-bold text-[#0E6B6B] hover:underline"
                >
                  + নতুন গ্রাহক
                </button>
              </div>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
              >
                <option value="cash">নগদ গ্রাহক</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) {c.totalDue > 0 ? `[বাকি: ৳${c.totalDue}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-[#64748B]">
                  <ShoppingCart className="w-12 h-12 text-[#9AA5B1] mx-auto mb-2 stroke-1" />
                  <p className="text-sm font-bold text-[#0F172A]">কার্টে কোনো পণ্য নেই</p>
                  <p className="text-xs text-[#64748B] mt-1">পণ্য যোগ করতে গ্রিড থেকে পণ্যে ক্লিক করুন।</p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div
                    key={`${item.product.id}_${index}`}
                    className="p-2.5 rounded-xl border border-[#E2E8F0] bg-white flex items-center justify-between shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-xs text-[#0F172A] truncate">
                        {item.product.name}
                      </h5>
                      <p className="text-[11px] text-[#64748B]">
                        ৳{formatCleanNumber(item.unitPrice)} × {formatCleanNumber(item.quantity)} {item.product.isLoose ? 'কেজি' : item.product.unit} = ৳{formatCleanNumber(item.totalPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() =>
                          updateCartItemQuantity(
                            index,
                            item.product.isLoose
                              ? Math.round((item.quantity - 0.25) * 100) / 100
                              : item.quantity - 1
                          )
                        }
                        className="w-6 h-6 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-xs font-bold text-[#64748B]"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold text-xs text-[#0F172A]">
                        {formatCleanNumber(item.quantity)}
                      </span>
                      <button
                        onClick={() =>
                          updateCartItemQuantity(
                            index,
                            item.product.isLoose
                              ? Math.round((item.quantity + 0.25) * 100) / 100
                              : item.quantity + 1
                          )
                        }
                        className="w-6 h-6 rounded-lg bg-[#E0F2F1] border border-[#B2DFDB] flex items-center justify-center text-xs font-bold text-[#0E6B6B]"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeCartItem(index)}
                        className="w-6 h-6 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill Summary */}
            <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] space-y-2 shrink-0">
              <div className="flex justify-between text-xs text-[#64748B]">
                <span>সাবটোটাল</span>
                <span className="font-bold text-[#0F172A]">৳{subTotal}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-[#64748B]">
                <span>ছাড় (ডিসকাউন্ট)</span>
                <div className="flex items-center gap-1">
                  <span>৳</span>
                  <input
                    type="number"
                    min="0"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="০"
                    className="w-16 py-0.5 px-1.5 rounded-lg border border-[#E2E8F0] bg-white text-right text-xs font-bold text-[#0F172A]"
                  />
                </div>
              </div>
              <div className="flex justify-between text-base font-extrabold text-[#0F172A] pt-1 border-t border-[#E2E8F0]">
                <span>সর্বমোট প্রদেয়</span>
                <span className="text-[#0E6B6B] text-lg">৳{grandTotal}</span>
              </div>

              {/* Paid input */}
              <div className="p-2 bg-white rounded-xl border border-[#E2E8F0] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-[#0F172A]">কাস্টমার জমা দিয়েছে</label>
                  <div className="flex items-center gap-1">
                    <span>৳</span>
                    <input
                      type="number"
                      min="0"
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      placeholder={`${grandTotal}`}
                      className="w-24 py-1 px-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-right text-sm font-bold text-[#0F172A]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {quickPaidPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPaidAmountInput(String(preset.val))}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] hover:bg-[#E0F2F1]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="pt-1 text-xs font-bold">
                  {dueAmount > 0 ? (
                    <div className="flex justify-between text-[#D32F2F] bg-rose-50 p-1.5 rounded-lg">
                      <span>বাকি থাকবে:</span>
                      <span>৳{dueAmount}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-[#2E7D32] bg-emerald-50 p-1.5 rounded-lg">
                      <span>কাস্টমার ফেরত পাবে:</span>
                      <span>৳{changeAmount}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                disabled={cart.length === 0}
                onClick={handleFinalizeSale}
                className="w-full py-3 rounded-2xl bg-[#0E6B6B] hover:bg-[#094747] disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition active:scale-98"
              >
                <Receipt className="w-4 h-4" />
                <span>বিক্রি সম্পন্ন করুন ও রসিদ দিন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScannerModal
          language={language}
          onScanSuccess={handleBarcodeScanned}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Loose Item Weight/Price Modal */}
      {looseProductToMeasure && (
        <LooseItemModal
          product={looseProductToMeasure}
          language={language}
          onConfirm={(prod, qty, price) => {
            handleAddToCart(prod, qty, price);
            setLooseProductToMeasure(null);
          }}
          onClose={() => setLooseProductToMeasure(null)}
        />
      )}

      {/* Printable Receipt Modal */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          profile={profile}
          language={language}
          onClose={() => setCompletedSale(null)}
          appMode={appMode}
          onOpenSubscriptionModal={onOpenSubscriptionModal}
        />
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0]">
            <h3 className="font-bold text-base text-[#0F172A] mb-3">
              নতুন গ্রাহক যোগ করুন
            </h3>
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  গ্রাহকের নাম
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="যেমন: রহিম সাহেব"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  মোবাইল নম্বর
                </label>
                <input
                  type="tel"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="017xxxxxxxx"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#0E6B6B]"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 text-[#64748B] text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#0E6B6B] text-white text-xs font-bold hover:bg-[#094747]"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Sale & Product Return Modal */}
      <QuickSaleModal
        isOpen={isQuickSaleOpen}
        onClose={() => setIsQuickSaleOpen(false)}
        sales={sales}
        products={products}
        customers={customers}
        language={language}
        initialMode={quickSaleInitialMode}
        onSaveQuickSale={(sale, openReceipt, updatedProds) => {
          onCompleteSale(sale, updatedProds || products);
          if (openReceipt) {
            setCompletedSale(sale);
          }
        }}
        onDeleteSale={onDeleteSale}
        onAddNewCustomer={onAddNewCustomer}
        initialStoreCapital={initialStoreCapital}
        onSaveInitialStoreCapital={onSaveInitialStoreCapital}
        expenses={expenses}
        bulkPurchases={bulkPurchases}
        purchases={purchases}
        ownerTransactions={ownerTransactions}
      />
    </div>
  );
};
