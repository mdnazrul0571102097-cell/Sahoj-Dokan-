import {
  Product,
  Customer,
  Sale,
  PurchaseRecord,
  ShopProfile,
  BakiTransaction,
  SubscriptionInfo,
  PaymentRequest,
  Supplier,
  SupplierTransaction,
  Expense,
  BulkPurchase,
  RegisteredShopUser,
  OwnerTransaction,
  OtherCashEntry,
  DailyCashReconciliation,
  MonthlyCashReconciliation,
} from '../types';
import { verifyClockIntegrity, generateShopId } from '../utils/license';

const STORAGE_KEYS = {
  PROFILE: 'sahoj_dokan_profile',
  PRODUCTS: 'sahoj_dokan_products',
  CUSTOMERS: 'sahoj_dokan_customers',
  SALES: 'sahoj_dokan_sales',
  BAKI_TXS: 'sahoj_dokan_baki_txs',
  PURCHASES: 'sahoj_dokan_purchases',
  FIRST_RUN: 'sahoj_dokan_first_run',
  SUBSCRIPTION: 'sahoj_dokan_subscription',
  PAYMENT_REQUESTS: 'sahoj_dokan_payment_requests',
  SUPPLIERS: 'sahoj_dokan_suppliers',
  SUPPLIER_TXS: 'sahoj_dokan_supplier_txs',
  EXPENSES: 'sahoj_dokan_expenses',
  BULK_PURCHASES: 'sahoj_dokan_bulk_purchases',
  OWNER_TXS: 'sahoj_dokan_owner_txs',
  OTHER_CASH_ENTRIES: 'sahoj_dokan_other_cash_entries',
  DAILY_RECONCILIATIONS: 'sahoj_dokan_daily_reconciliations',
  MONTHLY_RECONCILIATIONS: 'sahoj_dokan_monthly_reconciliations',
  INITIAL_OPENING_CASH: 'sahoj_dokan_initial_opening_cash',
  INITIAL_STORE_CAPITAL: 'sahoj_dokan_initial_store_capital',
  ADMIN_PASSWORD: 'sahoj_dokan_admin_password',
  TRIAL_START_MAP: 'sahoj_dokan_trial_start_map',
  APK_DOWNLOAD_URL: 'sahoj_dokan_apk_download_url',
  BLOCKED_USERS_MAP: 'sahoj_dokan_blocked_users_map',
  REGISTERED_USERS_LIST: 'sahoj_dokan_registered_users_list',
  APK_DOWNLOAD_COUNT: 'sahoj_dokan_apk_download_count',
  QUICK_SALE_MARGIN: 'sahoj_dokan_quick_sale_margin',
  DEMO_WIPED: 'sahoj_dokan_demo_wiped',
};

// Curated authentic Bangladeshi grocery items
export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    name: 'গোল আলু (নতুন/দেশি)',
    nameEn: 'Potato (Alu)',
    barcode: '100001',
    category: 'কাঁচা বাজার',
    costPrice: 28,
    sellPrice: 35,
    stock: 50,
    unit: 'kg',
    isLoose: true,
    image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_2',
    name: 'দেশি পেঁয়াজ',
    nameEn: 'Deshi Onion (Peyaj)',
    barcode: '100002',
    category: 'কাঁচা বাজার',
    costPrice: 75,
    sellPrice: 90,
    stock: 40,
    unit: 'kg',
    isLoose: true,
    image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_3',
    name: 'দেশি রসুন',
    nameEn: 'Garlic (Roshun)',
    barcode: '100003',
    category: 'কাঁচা বাজার',
    costPrice: 190,
    sellPrice: 230,
    stock: 15,
    unit: 'kg',
    isLoose: true,
    image: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_4',
    name: 'দেশি আদা',
    nameEn: 'Fresh Ginger (Ada)',
    barcode: '100004',
    category: 'কাঁচা বাজার',
    costPrice: 210,
    sellPrice: 250,
    stock: 12,
    unit: 'kg',
    isLoose: true,
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_5',
    name: 'দেশি মসুর ডাল (চিকন)',
    nameEn: 'Red Lentil (Moshur Dal)',
    barcode: '100005',
    category: 'মুদি আইটেম',
    costPrice: 125,
    sellPrice: 145,
    stock: 30,
    unit: 'kg',
    isLoose: true,
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_6',
    name: 'সাদা চিনি (খোলা)',
    nameEn: 'White Sugar (Chini)',
    barcode: '100006',
    category: 'মুদি আইটেম',
    costPrice: 128,
    sellPrice: 138,
    stock: 45,
    unit: 'kg',
    isLoose: true,
    image: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_7',
    name: 'রূপচাঁদা সয়াবিন তেল ১ লিটার',
    nameEn: 'Rupchanda Soybean Oil 1L',
    barcode: '8941100123456',
    category: 'মুদি আইটেম',
    costPrice: 168,
    sellPrice: 180,
    stock: 24,
    unit: 'liter',
    isLoose: false,
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_8',
    name: 'মিনিকেট চাল (৫০ কেজি বস্তা বা খোলা)',
    nameEn: 'Miniket Rice (Chal)',
    barcode: '100008',
    category: 'মুদি আইটেম',
    costPrice: 65,
    sellPrice: 74,
    stock: 80,
    unit: 'kg',
    isLoose: true,
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_9',
    name: 'লাল ডিম (১ হালি / ৪ পিস)',
    nameEn: 'Farm Brown Eggs (4 pcs)',
    barcode: '100009',
    category: 'মুদি আইটেম',
    costPrice: 42,
    sellPrice: 50,
    stock: 35,
    unit: 'piece',
    isLoose: false,
    image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_10',
    name: 'ম্যাগি মসলা নুডলস ৪ প্যাক',
    nameEn: 'Maggi 2-Min Noodles 4-Pack',
    barcode: '8901058852331',
    category: 'গ্রোসারি বা বেকারি',
    costPrice: 82,
    sellPrice: 95,
    stock: 18,
    unit: 'packet',
    isLoose: false,
    image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_11',
    name: 'রাধুনী গুঁড়া মরিচ ১০০ গ্রাম',
    nameEn: 'Radhuni Chilli Powder 100g',
    barcode: '8941100554321',
    category: 'মুদি আইটেম',
    costPrice: 56,
    sellPrice: 68,
    stock: 3, // intentionally low stock to test alert
    unit: 'packet',
    isLoose: false,
    image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_12',
    name: 'লাক্স বিউটি সাবান ১০০ গ্রাম',
    nameEn: 'Lux Beauty Soap 100g',
    barcode: '8901030383723',
    category: 'স্কিন কেয়ার ও কসমেটিক্স',
    costPrice: 48,
    sellPrice: 58,
    stock: 2, // low stock test
    unit: 'piece',
    isLoose: false,
    image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_13',
    name: 'প্রাণ ম্যাঙ্গো ফ্রুট ড্রিংক ২৫০ মি.লি.',
    nameEn: 'Pran Frooto Mango 250ml',
    barcode: '8941100223344',
    category: 'গ্রোসারি বা বেকারি',
    costPrice: 24,
    sellPrice: 30,
    stock: 30,
    unit: 'piece',
    isLoose: false,
    image: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_14',
    name: 'প্যারাসুট ২০০ml',
    nameEn: 'Parachute Coconut Oil 200ml',
    barcode: '8901088002004',
    category: 'স্কিন কেয়ার ও কসমেটিক্স',
    costPrice: 112,
    sellPrice: 130,
    stock: 20,
    unit: 'piece',
    isLoose: false,
    image: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_15',
    name: 'প্যারাসুট ২৫০ml',
    nameEn: 'Parachute Coconut Oil 250ml',
    barcode: '8901088002509',
    category: 'স্কিন কেয়ার ও কসমেটিক্স',
    costPrice: 138,
    sellPrice: 160,
    stock: 15,
    unit: 'piece',
    isLoose: false,
    image: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=400&q=80',
    minStockAlert: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust_1',
    name: 'রফিকুল ইসলাম',
    phone: '01711223344',
    address: 'বাজার সংলগ্ন, বাড়ি নং ১২',
    totalDue: 450,
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'cust_2',
    name: 'হাজী আব্দুল করিম',
    phone: '01819887766',
    address: 'মেইন রোড, স্কুল গলি',
    totalDue: 1200,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'cust_3',
    name: 'সালাম ভাই (চা দোকানি)',
    phone: '01912334455',
    address: 'বাজারের মোড়',
    totalDue: 320,
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
];

export const INITIAL_BAKI_TXS: BakiTransaction[] = [
  {
    id: 'btx_1',
    customerId: 'cust_1',
    date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    type: 'sale_due',
    amount: 650,
    note: 'চাল ও ডাল বাকি নিয়েছিলেন',
    balanceAfter: 650,
  },
  {
    id: 'btx_2',
    customerId: 'cust_1',
    date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    type: 'payment_received',
    amount: 200,
    note: 'নগদ ২০০ টাকা পরিশোধ করেছেন',
    balanceAfter: 450,
  },
  {
    id: 'btx_3',
    customerId: 'cust_2',
    date: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    type: 'sale_due',
    amount: 1500,
    note: 'তেল, মসলা ও চিনি বাকি',
    balanceAfter: 1500,
  },
  {
    id: 'btx_4',
    customerId: 'cust_2',
    date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    type: 'payment_received',
    amount: 300,
    note: 'বাকি বাবদ জমা',
    balanceAfter: 1200,
  },
  {
    id: 'btx_5',
    customerId: 'cust_3',
    date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    type: 'sale_due',
    amount: 320,
    note: 'চিনি ও দুধ',
    balanceAfter: 320,
  },
];

// Curated authentic Bangladeshi suppliers / wholesalers (মহাজন ও ডিলার)
export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'supp_1',
    name: 'মেসার্স রহিম রাইস মিল',
    contactPerson: 'হাজী আব্দুর রহিম',
    phone: '01711223344',
    address: 'বাবুবাজার চাল মোকাম, ঢাকা',
    company: 'মিনিকেট ও নাজিরশাইল চাল আড়ৎ',
    totalDue: 18500, // সাপ্লায়ারের কাছে বাকি
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'supp_2',
    name: 'মদিনা ট্রেডিং কর্পোরেশন',
    contactPerson: 'মোঃ কামরুল হাসান',
    phone: '01819556677',
    address: 'মৌলভীবাজার ভোজ্যতেল ও চিনি মোকাম, ঢাকা',
    company: 'রূপচাঁদা ও তীর অয়েল ডিলার',
    totalDue: 12400,
    createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'supp_3',
    name: 'সোনার বাংলা ডাল ভাণ্ডার',
    contactPerson: 'নুরুল ইসলাম',
    phone: '01912889900',
    address: 'শ্যামবাজার পাইকারি বাজার, ঢাকা',
    company: 'দেশি ও ক্যাঙ্গারু মসুর ডাল',
    totalDue: 0,
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
];

export const INITIAL_SUPPLIER_TXS: SupplierTransaction[] = [
  {
    id: 'stx_1',
    supplierId: 'supp_1',
    date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    type: 'purchase_due',
    amount: 28500,
    note: 'মিনিকেট চাল ১০ বস্তা ক্রয় চালান #4410',
    balanceAfter: 28500,
  },
  {
    id: 'stx_2',
    supplierId: 'supp_1',
    date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    type: 'payment_made',
    amount: 10000,
    note: 'ব্যাংক / ক্যাশ পরিশোধ',
    balanceAfter: 18500,
  },
  {
    id: 'stx_3',
    supplierId: 'supp_2',
    date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    type: 'purchase_due',
    amount: 12400,
    note: 'রূপচাঁদা তেল ও চিনি চালান #882',
    balanceAfter: 12400,
  },
];

// Curated daily shop expenses (দোকানের দৈনন্দিন খরচ)
export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp_1',
    date: new Date().toISOString(),
    category: 'transport',
    categoryName: 'পরিবহন ও ভ্যান ভাড়া',
    amount: 250,
    note: 'পাইকারি বাজার থেকে দোকানে মালামাল পরিবহন',
    paymentMethod: 'cash',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'exp_2',
    date: new Date().toISOString(),
    category: 'food',
    categoryName: 'আপ্যায়ন ও চা-নাস্তা',
    amount: 120,
    note: 'দোকানের চা-বিস্কুট ও আপ্যায়ন',
    paymentMethod: 'cash',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'exp_3',
    date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    category: 'packaging',
    categoryName: 'পলিথিন ও প্যাকিং ব্যাগ',
    amount: 380,
    note: '৫০০ গ্রাম ও ১ কেজির পলিথিন প্যাকেট',
    paymentMethod: 'cash',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
];

// Initial multi-item bulk purchases (পাইকারি চাল, ডাল, তেল একসঙ্গে কেনার চালান)
export const INITIAL_BULK_PURCHASES: BulkPurchase[] = [
  {
    id: 'bp_1',
    purchaseNo: 'PO-1001',
    date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    supplierId: 'supp_1',
    supplierName: 'মেসার্স রহিম রাইস মিল',
    supplierPhone: '01711223344',
    items: [
      {
        productId: 'prod_8',
        productName: 'মিনিকেট চাল (৫০ কেজি বস্তা)',
        category: 'মুদি আইটেম',
        quantity: 10,
        unit: 'piece',
        unitCostPrice: 3250,
        totalCost: 32500,
      },
    ],
    totalAmount: 32500,
    paidAmount: 14000,
    dueAmount: 18500,
    paymentType: 'partial',
    note: 'মোকাম মেমো #4410',
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  },
];

export const INITIAL_PROFILE: ShopProfile = {
  shopName: 'Sahoj Dokan - সহজ দোকান',
  ownerName: '',
  phone: '',
  email: '',
  address: '',
  pin: '',
  currency: '৳',
  isRegistered: false,
  language: 'bn',
  logo: '/assets/icon.png',
};

// Storage helpers
export const DB = {
  getProfile(): ShopProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (data) {
        const parsed: ShopProfile = JSON.parse(data);
        // Profile validation
        if (!parsed.phone) {
          parsed.isRegistered = false;
          parsed.pin = '';
          parsed.shopName = parsed.shopName || 'Sahoj Dokan - সহজ দোকান';
          parsed.logo = parsed.logo || '/assets/icon.png';
          return parsed;
        }
        if (!parsed.shopName || parsed.shopName === 'Sahoj Dokan POS' || parsed.shopName === 'সহজ দোকান POS' || parsed.shopName === 'বিসমিল্লাহ স্টোর') {
          parsed.shopName = 'Sahoj Dokan - সহজ দোকান';
          try {
            localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(parsed));
          } catch (_) {}
        }
        if (!parsed.logo || parsed.logo.includes('file_000000004a3c81f5869dca542232e290') || (parsed.logo.startsWith('data:') && parsed.logo.length > 150000)) {
          parsed.logo = '/assets/icon.png';
          try {
            localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(parsed));
          } catch (_) {}
        }
        if (!parsed.shopId) {
          parsed.shopId = generateShopId(parsed.phone);
          try {
            localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(parsed));
          } catch (_) {}
        }
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }

    return INITIAL_PROFILE;
  },

  saveProfile(profile: ShopProfile) {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to save profile directly, attempting fallback without giant logo', e);
      try {
        if (profile.logo && profile.logo.length > 80000) {
          const fallback = { ...profile, logo: INITIAL_PROFILE.logo };
          localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(fallback));
        }
      } catch (err) {
        console.error('Storage saveProfile error:', err);
      }
    }
    try {
      if (profile.phone && profile.phone.replace(/\D/g, '').length >= 10) {
        this.upsertRegisteredUserLocal({
          phone: profile.phone,
          fullPhone: profile.phone,
          shopId: profile.shopId,
          shopName: profile.shopName,
          ownerName: profile.ownerName,
          address: profile.address,
        });
      }
    } catch (_) {}
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  getProducts(): Product[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (data) {
        const parsed: Product[] = JSON.parse(data);
        const legacyMap: Record<string, string> = {
          catVegetables: 'কাঁচা বাজার',
          কাঁচাবাজার: 'কাঁচা বাজার',
          catSpices: 'মুদি আইটেম',
          catGrains: 'মুদি আইটেম',
          catDairy: 'মুদি আইটেম',
          catSnacks: 'গ্রোসারি বা বেকারি',
          catDrinks: 'গ্রোসারি বা বেকারি',
          catHousehold: 'স্কিন কেয়ার ও কসমেটিক্স',
        };
        // Self-heal: check if any product has an oversized base64 data string (> 80KB) or legacy category
        let needsCleanup = false;
        const cleaned = parsed.map((p) => {
          let updated = p;
          if (legacyMap[p.category]) {
            needsCleanup = true;
            updated = { ...updated, category: legacyMap[p.category] };
          }
          if (updated.image && updated.image.startsWith('data:image') && updated.image.length > 80000) {
            needsCleanup = true;
            updated = {
              ...updated,
              image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
            };
          }
          return updated;
        });
        if (needsCleanup) {
          try {
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(cleaned));
          } catch (err) {
            console.warn('Storage cleanup failed', err);
          }
        }
        return cleaned;
      }
    } catch (e) {
      console.error(e);
    }

    // If user previously wiped demo data or reset, do NOT reseed INITIAL_PRODUCTS
    if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEYS.DEMO_WIPED) === 'true') {
      return [];
    }

    // Check if persistent backup exists on Android external storage before setting defaults
    try {
      if (typeof window !== 'undefined' && (window as any).AndroidApp?.loadBackupData) {
        const raw = (window as any).AndroidApp.loadBackupData();
        if (raw && raw.length > 30) {
          const parsedBackup = JSON.parse(raw);
          const dataObj = parsedBackup.data || parsedBackup;
          if (dataObj && Array.isArray(dataObj.products) && dataObj.products.length > 0) {
            this.importAllData(dataObj);
            return dataObj.products;
          }
        }
      }
    } catch (_) {}

    // initialize defaults
    this.saveProducts(INITIAL_PRODUCTS);
    return INITIAL_PRODUCTS;
  },

  saveProducts(products: Product[]): boolean {
    // Keep in-memory copy
    (this as any)._cachedProducts = products;

    // Asynchronous IndexedDB backup for unlimited product capacity
    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        const req = window.indexedDB.open('sahoj_dokan_idb', 1);
        req.onupgradeneeded = (ev: any) => {
          const db = ev.target.result;
          if (!db.objectStoreNames.contains('store')) {
            db.createObjectStore('store');
          }
        };
        req.onsuccess = (ev: any) => {
          const db = ev.target.result;
          const tx = db.transaction('store', 'readwrite');
          tx.objectStore('store').put(products, STORAGE_KEYS.PRODUCTS);
        };
      } catch (_) {}
    }

    // Try saving directly
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    } catch (e) {
      console.warn('Storage quota warning in saveProducts, running compression cleanup:', e);
      try {
        // Fallback: replace any large data:image with clean fallback
        const sanitized = products.map((p) => {
          if (p.image && p.image.startsWith('data:') && p.image.length > 25000) {
            return {
              ...p,
              image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
            };
          }
          return p;
        });
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(sanitized));
      } catch (e2) {
        console.error('Failed to save to localStorage after sanitization:', e2);
      }
    }

    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
    return true;
  },

  getCustomers(): Customer[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (data) return JSON.parse(data);
      if (localStorage.getItem(STORAGE_KEYS.DEMO_WIPED) === 'true') return [];
    } catch (e) {
      console.error(e);
    }
    this.saveCustomers(INITIAL_CUSTOMERS);
    return INITIAL_CUSTOMERS;
  },

  saveCustomers(customers: Customer[]) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  getSales(): Sale[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SALES);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveSales(sales: Sale[]) {
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  getBakiTransactions(): BakiTransaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BAKI_TXS);
      if (data) return JSON.parse(data);
      if (localStorage.getItem(STORAGE_KEYS.DEMO_WIPED) === 'true') return [];
    } catch (e) {
      console.error(e);
    }
    this.saveBakiTransactions(INITIAL_BAKI_TXS);
    return INITIAL_BAKI_TXS;
  },

  saveBakiTransactions(txs: BakiTransaction[]) {
    localStorage.setItem(STORAGE_KEYS.BAKI_TXS, JSON.stringify(txs));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  getPurchases(): PurchaseRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PURCHASES);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  savePurchases(purchases: PurchaseRecord[]) {
    localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  // ================= SUPPLIERS (সাপ্লায়ার / মহাজন) =================
  getSuppliers(): Supplier[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
      if (data) return JSON.parse(data);
      if (localStorage.getItem(STORAGE_KEYS.DEMO_WIPED) === 'true') return [];
    } catch (e) {
      console.error(e);
    }
    this.saveSuppliers(INITIAL_SUPPLIERS);
    return INITIAL_SUPPLIERS;
  },

  saveSuppliers(suppliers: Supplier[]) {
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  getSupplierTransactions(): SupplierTransaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUPPLIER_TXS);
      if (data) return JSON.parse(data);
      if (localStorage.getItem(STORAGE_KEYS.DEMO_WIPED) === 'true') return [];
    } catch (e) {
      console.error(e);
    }
    this.saveSupplierTransactions(INITIAL_SUPPLIER_TXS);
    return INITIAL_SUPPLIER_TXS;
  },

  saveSupplierTransactions(txs: SupplierTransaction[]) {
    localStorage.setItem(STORAGE_KEYS.SUPPLIER_TXS, JSON.stringify(txs));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  // ================= DAILY SHOP EXPENSES (দোকানের দৈনন্দিন খরচ) =================
  getExpenses(): Expense[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (data) {
        const parsed: Expense[] = JSON.parse(data);
        const seedIds = new Set(['exp_1', 'exp_2', 'exp_3']);
        const cleaned = parsed.filter((e) => e && !seedIds.has(e.id));
        if (cleaned.length !== parsed.length) {
          this.saveExpenses(cleaned);
        }
        return cleaned;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveExpenses(expenses: Expense[]) {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  // ================= MULTI-ITEM BULK PURCHASES (পাইকারি চাল, ডাল, তেল কেনা) =================
  getBulkPurchases(): BulkPurchase[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BULK_PURCHASES);
      if (data) {
        const parsed: BulkPurchase[] = JSON.parse(data);
        const seedIds = new Set(['bp_1']);
        const cleaned = parsed.filter((bp) => bp && !seedIds.has(bp.id));
        if (cleaned.length !== parsed.length) {
          this.saveBulkPurchases(cleaned);
        }
        return cleaned;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveBulkPurchases(purchases: BulkPurchase[]) {
    localStorage.setItem(STORAGE_KEYS.BULK_PURCHASES, JSON.stringify(purchases));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  // ================= OWNER CAPITAL & DRAWINGS (মালিকের টাকা জমা ও উত্তোলন) =================
  getOwnerTransactions(): OwnerTransaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OWNER_TXS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveOwnerTransactions(txs: OwnerTransaction[]) {
    // Deduplicate by id
    const seen = new Set<string>();
    const deduped = txs.filter((tx) => {
      if (!tx || !tx.id || seen.has(tx.id)) return false;
      seen.add(tx.id);
      return true;
    });
    localStorage.setItem(STORAGE_KEYS.OWNER_TXS, JSON.stringify(deduped));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  // ================= OTHER CASH IN / OUT & POST-CLOSE ADJUSTMENTS =================
  getOtherCashEntries(): OtherCashEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OTHER_CASH_ENTRIES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveOtherCashEntries(entries: OtherCashEntry[]) {
    const seen = new Set<string>();
    const deduped = entries.filter((item) => {
      if (!item || !item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    localStorage.setItem(STORAGE_KEYS.OTHER_CASH_ENTRIES, JSON.stringify(deduped));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  // ================= DAILY & MONTHLY CASH RECONCILIATION (ক্যাশ মিল) =================
  getDailyReconciliations(): DailyCashReconciliation[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DAILY_RECONCILIATIONS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveDailyReconciliations(recons: DailyCashReconciliation[]) {
    const byDate = new Map<string, DailyCashReconciliation>();
    recons.forEach((r) => {
      if (r && r.date) {
        byDate.set(r.date, r);
      }
    });
    const deduped = Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
    localStorage.setItem(STORAGE_KEYS.DAILY_RECONCILIATIONS, JSON.stringify(deduped));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  getMonthlyReconciliations(): MonthlyCashReconciliation[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MONTHLY_RECONCILIATIONS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveMonthlyReconciliations(recons: MonthlyCashReconciliation[]) {
    const byMonth = new Map<string, MonthlyCashReconciliation>();
    recons.forEach((r) => {
      if (r && r.yearMonth) {
        byMonth.set(r.yearMonth, r);
      }
    });
    const deduped = Array.from(byMonth.values()).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
    localStorage.setItem(STORAGE_KEYS.MONTHLY_RECONCILIATIONS, JSON.stringify(deduped));
    if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
      (window as any).__sd_schedule_sync();
    }
  },

  getInitialOpeningCash(): number {
    try {
      const val = parseFloat(localStorage.getItem(STORAGE_KEYS.INITIAL_OPENING_CASH) || '0');
      return isNaN(val) ? 0 : Math.max(0, val);
    } catch (_) {
      return 0;
    }
  },

  saveInitialOpeningCash(amount: number) {
    try {
      localStorage.setItem(STORAGE_KEYS.INITIAL_OPENING_CASH, String(Math.max(0, Math.round(amount))));
      if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
        (window as any).__sd_schedule_sync();
      }
    } catch (_) {}
  },

  getInitialStoreCapital(): number {
    try {
      const val = parseFloat(localStorage.getItem(STORAGE_KEYS.INITIAL_STORE_CAPITAL) || '0');
      return isNaN(val) ? 0 : Math.max(0, Math.round(val));
    } catch (_) {
      return 0;
    }
  },

  saveInitialStoreCapital(amount: number) {
    try {
      localStorage.setItem(STORAGE_KEYS.INITIAL_STORE_CAPITAL, String(Math.max(0, Math.round(amount))));
      if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
        (window as any).__sd_schedule_sync();
      }
    } catch (_) {}
  },

  getQuickSaleProfitMargin(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.QUICK_SALE_MARGIN);
      if (raw === null) return 10;
      const val = parseFloat(raw);
      return isNaN(val) ? 10 : Math.max(0, Math.min(100, val));
    } catch (_) {
      return 10;
    }
  },

  saveQuickSaleProfitMargin(margin: number) {
    try {
      const clean = Math.max(0, Math.min(100, Number(margin) || 0));
      localStorage.setItem(STORAGE_KEYS.QUICK_SALE_MARGIN, String(clean));
      if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
        (window as any).__sd_schedule_sync();
      }
    } catch (_) {}
  },

  wipeAllDemoData(keepProducts: boolean = true) {
    try {
      localStorage.setItem(STORAGE_KEYS.DEMO_WIPED, 'true');
      this.saveSales([]);
      this.saveExpenses([]);
      this.savePurchases([]);
      this.saveBulkPurchases([]);
      this.saveBakiTransactions([]);
      this.saveSupplierTransactions([]);
      this.saveOwnerTransactions([]);
      this.saveOtherCashEntries([]);
      this.saveDailyReconciliations([]);
      this.saveMonthlyReconciliations([]);
      this.saveInitialOpeningCash(0);
      this.saveInitialStoreCapital(0);

      // Remove seeded demo customers & suppliers, and reset any user-created customer/supplier dues to 0
      const seedCustIds = new Set(['cust_1', 'cust_2', 'cust_3']);
      const remainingCusts = this.getCustomers()
        .filter((c) => !seedCustIds.has(c.id))
        .map((c) => ({ ...c, totalDue: 0 }));
      this.saveCustomers(remainingCusts);

      const seedSuppIds = new Set(['supp_1', 'supp_2', 'supp_3']);
      const remainingSupps = this.getSuppliers()
        .filter((s) => !seedSuppIds.has(s.id))
        .map((s) => ({ ...s, totalDue: 0, totalPayableDue: 0 }));
      this.saveSuppliers(remainingSupps);

      if (!keepProducts) {
        this.saveProducts([]);
      }

      if (typeof window !== 'undefined' && (window as any).__sd_schedule_sync) {
        (window as any).__sd_schedule_sync();
      }
    } catch (e) {
      console.error('Error wiping demo data:', e);
    }
  },

  isFirstRun(): boolean {
    return localStorage.getItem(STORAGE_KEYS.FIRST_RUN) === null;
  },

  setFirstRunCompleted() {
    localStorage.setItem(STORAGE_KEYS.FIRST_RUN, 'false');
  },

  // Subscription & Licensing
  getSubscription(): SubscriptionInfo {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION);
      const profile = this.getProfile();
      const cleanPhone = (profile.phone || '').replace(/\D/g, '').slice(-10);
      const shopId = profile.shopId || generateShopId(profile.phone);

      if (data) {
        const parsed: SubscriptionInfo = JSON.parse(data);

        // Anti-clock rollback verification
        const { isTampered, validTimestamp } = verifyClockIntegrity(parsed.lastActiveTimestamp || 0);
        parsed.lastActiveTimestamp = validTimestamp;
        if (isTampered) {
          parsed.isClockTampered = true;
        }

        // Only genuine owner or lifetime license holders
        if (parsed.isOwner || parsed.plan === 'lifetime') {
          parsed.status = 'pro';
          parsed.plan = 'lifetime';
          parsed.isOwner = true;
          parsed.proEndDate = '2099-12-31T23:59:59.000Z';
          parsed.isClockTampered = false;
          localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, JSON.stringify(parsed));
          return parsed;
        }

        // Check if active Pro has expired
        if (parsed.status === 'pro' && parsed.proEndDate) {
          const proEndMs = new Date(parsed.proEndDate).getTime();
          if (validTimestamp > proEndMs) {
            parsed.status = 'expired';
          }
        } else if (parsed.status === 'trial') {
          // Check if 60-day trial has expired
          const trialEndMs = new Date(parsed.trialEndDate).getTime();
          if (validTimestamp > trialEndMs) {
            parsed.status = 'expired';
          }
        }

        if (!parsed.shopId) {
          parsed.shopId = shopId;
        }

        localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, JSON.stringify(parsed));
        return parsed;
      }

      // Check if this phone number already had an initial trial recorded
      let recordedTrialStart = '';
      try {
        const historyStr = localStorage.getItem(STORAGE_KEYS.TRIAL_START_MAP);
        if (historyStr) {
          const map = JSON.parse(historyStr);
          if (cleanPhone && map[cleanPhone]) {
            recordedTrialStart = map[cleanPhone];
          }
        }
      } catch (_) {}

      // Check persistent Android bridge for trial date
      if (!recordedTrialStart) {
        try {
          if (typeof window !== 'undefined' && (window as any).AndroidApp?.loadBackupData) {
            const raw = (window as any).AndroidApp.loadBackupData();
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.subscription?.trialStartDate) {
                recordedTrialStart = parsed.subscription.trialStartDate;
              }
            }
          }
        } catch (_) {}
      }

      const now = new Date();
      let trialStartDate = now.toISOString();
      let trialEndDate = new Date(now.getTime() + 60 * 24 * 3600 * 1000).toISOString();

      if (recordedTrialStart) {
        // Phone number was already registered! Lock trial to original first registration
        trialStartDate = recordedTrialStart;
        trialEndDate = new Date(new Date(recordedTrialStart).getTime() + 60 * 24 * 3600 * 1000).toISOString();
      } else if (cleanPhone) {
        // Record this phone number's first-ever trial start
        try {
          const historyStr = localStorage.getItem(STORAGE_KEYS.TRIAL_START_MAP) || '{}';
          const map = JSON.parse(historyStr);
          map[cleanPhone] = trialStartDate;
          localStorage.setItem(STORAGE_KEYS.TRIAL_START_MAP, JSON.stringify(map));
        } catch (_) {}
      }

      const trialEndMs = new Date(trialEndDate).getTime();
      const status: 'trial' | 'expired' = (now.getTime() > trialEndMs) ? 'expired' : 'trial';

      const newSub: SubscriptionInfo = {
        status,
        plan: 'trial',
        trialStartDate,
        trialEndDate,
        lastActiveTimestamp: now.getTime(),
        shopId,
        isClockTampered: false,
      };

      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, JSON.stringify(newSub));
      return newSub;
    } catch (e) {
      console.error('Error reading subscription:', e);
      const now = new Date();
      return {
        status: 'trial',
        plan: 'trial',
        trialStartDate: now.toISOString(),
        trialEndDate: new Date(now.getTime() + 60 * 24 * 3600 * 1000).toISOString(),
        lastActiveTimestamp: now.getTime(),
        shopId: generateShopId(),
        isClockTampered: false,
      };
    }
  },

  getAdminPassword(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD);
      if (saved && saved.trim()) return saved.trim();
    } catch (_) {}
    return 'sahoj2026admin';
  },

  saveAdminPassword(newPassword: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, newPassword.trim());
    } catch (_) {}
  },

  getApkDownloadUrl(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.APK_DOWNLOAD_URL);
      if (saved && saved.trim()) return saved.trim();
    } catch (_) {}
    return '';
  },

  saveApkDownloadUrl(url: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.APK_DOWNLOAD_URL, url.trim());
    } catch (_) {}
  },

  getApkDownloadCountLocal(): number {
    try {
      const val = parseInt(localStorage.getItem(STORAGE_KEYS.APK_DOWNLOAD_COUNT) || '0', 10);
      return isNaN(val) ? 0 : val;
    } catch (_) {
      return 0;
    }
  },

  setApkDownloadCountLocal(count: number): void {
    try {
      localStorage.setItem(STORAGE_KEYS.APK_DOWNLOAD_COUNT, String(Math.max(0, count)));
    } catch (_) {}
  },

  incrementApkDownloadCountLocal(): number {
    const next = this.getApkDownloadCountLocal() + 1;
    this.setApkDownloadCountLocal(next);
    return next;
  },

  getBlockedUsersMap(): Record<string, { isBlocked: boolean; reason?: string; updatedAt: string }> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BLOCKED_USERS_MAP);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {};
  },

  setUserBlockedLocal(phone: string, isBlocked: boolean, reason?: string): void {
    try {
      const clean = phone.replace(/\D/g, '').slice(-10);
      if (!clean) return;
      const map = this.getBlockedUsersMap();
      map[clean] = {
        isBlocked,
        reason: reason || (isBlocked ? 'অ্যাডমিন কর্তৃক অ্যাকাউন্ট সাময়িকভাবে বন্ধ করা হয়েছে।' : ''),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.BLOCKED_USERS_MAP, JSON.stringify(map));

      // Also update in local registered users list if present
      const list = this.getRegisteredUsersLocal();
      const idx = list.findIndex((u) => u.phone === clean);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          isBlocked,
          blockReason: map[clean].reason,
          blockedAt: isBlocked ? map[clean].updatedAt : undefined,
        };
        this.saveRegisteredUsersLocal(list);
      }
    } catch (_) {}
  },

  isPhoneBlockedLocal(phone: string): { isBlocked: boolean; reason?: string } {
    try {
      const clean = (phone || '').replace(/\D/g, '').slice(-10);
      if (!clean) return { isBlocked: false };
      const map = this.getBlockedUsersMap();
      if (map[clean] && map[clean].isBlocked) {
        return { isBlocked: true, reason: map[clean].reason };
      }
    } catch (_) {}
    return { isBlocked: false };
  },

  getRegisteredUsersLocal(): RegisteredShopUser[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS_LIST);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  },

  saveRegisteredUsersLocal(users: RegisteredShopUser[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS_LIST, JSON.stringify(users));
    } catch (_) {}
  },

  upsertRegisteredUserLocal(user: Partial<RegisteredShopUser> & { phone: string }): void {
    try {
      const clean = (user.phone || '').replace(/\D/g, '').slice(-10);
      if (!clean || clean.length < 10) return;
      const list = this.getRegisteredUsersLocal();
      const existingIdx = list.findIndex((u) => u.phone === clean);
      const blockedInfo = this.isPhoneBlockedLocal(clean);
      const nowIso = new Date().toISOString();

      const merged: RegisteredShopUser = {
        phone: clean,
        fullPhone: user.fullPhone || ('0' + clean),
        shopId: user.shopId || `SD-${clean}`,
        shopName: user.shopName || list[existingIdx]?.shopName || 'সহজ দোকান',
        ownerName: user.ownerName || list[existingIdx]?.ownerName || 'স্বত্বাধিকারী',
        address: user.address ?? list[existingIdx]?.address ?? '',
        plan: user.plan || list[existingIdx]?.plan || 'trial',
        status: user.status || list[existingIdx]?.status || 'trial',
        trialStartDate: user.trialStartDate || list[existingIdx]?.trialStartDate || nowIso,
        trialEndDate: user.trialEndDate || list[existingIdx]?.trialEndDate,
        createdAt: list[existingIdx]?.createdAt || user.createdAt || nowIso,
        lastActiveAt: user.lastActiveAt || nowIso,
        platform: user.platform || list[existingIdx]?.platform || (typeof window !== 'undefined' && (window as any).AndroidApp ? 'Android APK' : 'Web / Mobile'),
        productsCount: user.productsCount ?? list[existingIdx]?.productsCount ?? 0,
        salesCount: user.salesCount ?? list[existingIdx]?.salesCount ?? 0,
        customersCount: user.customersCount ?? list[existingIdx]?.customersCount ?? 0,
        isBlocked: user.isBlocked !== undefined ? user.isBlocked : (blockedInfo.isBlocked || list[existingIdx]?.isBlocked || false),
        blockReason: user.blockReason ?? blockedInfo.reason ?? list[existingIdx]?.blockReason,
      };

      if (existingIdx >= 0) {
        list[existingIdx] = merged;
      } else {
        list.unshift(merged);
      }
      this.saveRegisteredUsersLocal(list);
    } catch (_) {}
  },

  saveSubscription(sub: SubscriptionInfo) {
    try {
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, JSON.stringify(sub));
    } catch (e) {
      console.error('Failed to save subscription:', e);
    }
  },

  activatePro(plan: 'monthly' | 'yearly' | 'lifetime', durationDays: number, licenseKey: string): SubscriptionInfo {
    const current = this.getSubscription();
    const now = new Date();

    if (plan === 'lifetime' || durationDays >= 36500 || licenseKey.includes('LIFETIME-OWNER')) {
      const updated: SubscriptionInfo = {
        ...current,
        status: 'pro',
        plan: 'lifetime',
        isOwner: true,
        proStartDate: current.proStartDate || now.toISOString(),
        proEndDate: '2099-12-31T23:59:59.000Z',
        licenseKey,
        isClockTampered: false,
        lastActiveTimestamp: now.getTime(),
      };
      this.saveSubscription(updated);
      return updated;
    }

    // If user already had active Pro, extend from current proEndDate; otherwise from now
    let baseTime = now.getTime();
    if (current.status === 'pro' && current.proEndDate) {
      const existingEnd = new Date(current.proEndDate).getTime();
      if (existingEnd > baseTime) {
        baseTime = existingEnd;
      }
    }

    const proEndDate = new Date(baseTime + durationDays * 24 * 3600 * 1000);
    const updated: SubscriptionInfo = {
      ...current,
      status: 'pro',
      plan,
      proStartDate: current.proStartDate || now.toISOString(),
      proEndDate: proEndDate.toISOString(),
      licenseKey,
      isClockTampered: false,
      lastActiveTimestamp: now.getTime(),
    };

    this.saveSubscription(updated);
    return updated;
  },

  activateOwnerLifetime(): SubscriptionInfo {
    const current = this.getSubscription();
    const now = new Date();
    const updated: SubscriptionInfo = {
      ...current,
      status: 'pro',
      plan: 'lifetime',
      isOwner: true,
      proStartDate: current.proStartDate || now.toISOString(),
      proEndDate: '2099-12-31T23:59:59.000Z',
      licenseKey: 'SAHOJ-LIFETIME-OWNER-01733414031-NAZRUL',
      isClockTampered: false,
      lastActiveTimestamp: now.getTime(),
    };
    this.saveSubscription(updated);
    return updated;
  },

  // Payment Requests (Proof of Nagad Payment)
  getPaymentRequests(): PaymentRequest[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PAYMENT_REQUESTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Error reading payment requests:', e);
    }
    return [];
  },

  savePaymentRequests(reqs: PaymentRequest[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.PAYMENT_REQUESTS, JSON.stringify(reqs));
    } catch (e) {
      console.error('Failed to save payment requests:', e);
    }
  },

  addPaymentRequest(req: PaymentRequest) {
    const existing = this.getPaymentRequests();
    // Prevent exact duplicates
    const filtered = existing.filter((r) => r.id !== req.id && r.transactionId !== req.transactionId);
    const updated = [req, ...filtered];
    this.savePaymentRequests(updated);
  },

  updatePaymentRequest(id: string, updates: Partial<PaymentRequest>) {
    const existing = this.getPaymentRequests();
    const updated = existing.map((r) => (r.id === id ? { ...r, ...updates } : r));
    this.savePaymentRequests(updated);
  },

  // Export all data for backup
  exportAllData() {
    return {
      appName: 'Sahoj Dokan POS',
      version: '3.0',
      backupDate: new Date().toISOString(),
      profile: this.getProfile(),
      products: this.getProducts(),
      customers: this.getCustomers(),
      sales: this.getSales(),
      bakiTransactions: this.getBakiTransactions(),
      purchases: this.getPurchases(),
      suppliers: this.getSuppliers(),
      supplierTransactions: this.getSupplierTransactions(),
      expenses: this.getExpenses(),
      bulkPurchases: this.getBulkPurchases(),
      ownerTransactions: this.getOwnerTransactions(),
      otherCashEntries: this.getOtherCashEntries(),
      dailyReconciliations: this.getDailyReconciliations(),
      monthlyReconciliations: this.getMonthlyReconciliations(),
      initialOpeningCash: this.getInitialOpeningCash(),
      initialStoreCapital: this.getInitialStoreCapital(),
      subscription: this.getSubscription(),
      paymentRequests: this.getPaymentRequests(),
    };
  },

  // Safe import / restore with strict schema verification
  importAllData(data: any) {
    if (!data || typeof data !== 'object') {
      throw new Error('অবৈধ ব্যাকআপ ফাইল: ফাইলের ফরম্যাট সঠিক নয়।');
    }
    const dedupeById = <T extends { id: string }>(arr: T[]): T[] => {
      const seen = new Set<string>();
      return arr.filter((item) => {
        if (!item || !item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };

    // Restore POS core data
    if (data.profile) this.saveProfile(data.profile);
    if (Array.isArray(data.products)) {
      this.saveProducts(dedupeById(data.products));
    } else if (data.products && typeof data.products === 'object') {
      this.saveProducts(dedupeById(Object.values(data.products)));
    }
    if (Array.isArray(data.customers)) this.saveCustomers(dedupeById(data.customers));
    if (Array.isArray(data.sales)) this.saveSales(dedupeById(data.sales));
    if (Array.isArray(data.bakiTransactions)) this.saveBakiTransactions(dedupeById(data.bakiTransactions));
    if (Array.isArray(data.purchases)) this.savePurchases(dedupeById(data.purchases));
    if (Array.isArray(data.suppliers)) this.saveSuppliers(dedupeById(data.suppliers));
    if (Array.isArray(data.supplierTransactions)) this.saveSupplierTransactions(dedupeById(data.supplierTransactions));
    if (Array.isArray(data.expenses)) this.saveExpenses(dedupeById(data.expenses));
    if (Array.isArray(data.bulkPurchases)) this.saveBulkPurchases(dedupeById(data.bulkPurchases));
    if (Array.isArray(data.ownerTransactions)) this.saveOwnerTransactions(dedupeById(data.ownerTransactions));
    if (Array.isArray(data.otherCashEntries)) this.saveOtherCashEntries(dedupeById(data.otherCashEntries));
    if (Array.isArray(data.dailyReconciliations)) this.saveDailyReconciliations(data.dailyReconciliations);
    if (Array.isArray(data.monthlyReconciliations)) this.saveMonthlyReconciliations(data.monthlyReconciliations);
    if (typeof data.initialOpeningCash === 'number') {
      this.saveInitialOpeningCash(data.initialOpeningCash);
    }
    if (typeof data.initialStoreCapital === 'number') {
      this.saveInitialStoreCapital(data.initialStoreCapital);
    }

    if (Array.isArray(data.paymentRequests)) {
      const currentReqs = this.getPaymentRequests();
      const mergedReqs = [...data.paymentRequests];
      for (const req of currentReqs) {
        if (!mergedReqs.some((m) => m.id === req.id || m.transactionId === req.transactionId)) {
          mergedReqs.push(req);
        }
      }
      this.savePaymentRequests(mergedReqs);
    }

    // Preserve active Pro license if user imports an older trial backup
    if (data.subscription) {
      const currentSub = this.getSubscription();
      if (currentSub.status === 'pro') {
        // Keep active Pro status
        this.saveSubscription(currentSub);
      } else {
        this.saveSubscription(data.subscription);
      }
    }

    this.setFirstRunCompleted();
  },

  // Clear all data
  clearAll() {
    localStorage.clear();
  },
};

