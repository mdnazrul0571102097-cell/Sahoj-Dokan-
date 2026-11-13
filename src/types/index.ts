export type Language = 'bn' | 'en';

export type ProductUnit = 'kg' | 'gm' | 'liter' | 'packet' | 'piece' | 'dozen';

export interface Product {
  id: string;
  name: string;
  nameEn?: string;
  barcode: string;
  category: string;
  costPrice: number;    // ক্রয়মূল্য (৳)
  sellPrice: number;    // বিক্রয়মূল্য (৳)
  stock: number;        // বর্তমান মজুদ
  unit: ProductUnit;    // একক (কেজি, গ্রাম, প্যাকেট ইত্যাদি)
  isLoose: boolean;     // খোলা পণ্য কি না (যেমন পেঁয়াজ, আলু, ডাল)
  image: string;        // পণ্যের ছবি (URL or Data URL)
  minStockAlert: number; // স্টক কম অ্যালার্ট সীমা (default 5)
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number; // For loose items, this is kg (e.g., 0.5 for 500gm, 1.25 for 1.25kg)
  unitPrice: number;
  totalPrice: number;
  costPrice: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: ProductUnit;
  unitPrice: number;
  costPrice: number;
  totalPrice: number;
}

export interface Sale {
  id: string;
  invoiceNo: string;
  date: string;         // ISO date string
  items: SaleItem[];
  subTotal: number;
  discount: number;
  grandTotal: number;
  totalCost: number;
  profit: number;       // grandTotal - totalCost
  paidAmount: number;
  dueAmount: number;
  changeAmount: number;
  paymentType: 'cash' | 'due' | 'partial' | 'bkash' | 'nagad';
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  totalDue: number;     // বর্তমান বাকি (৳)
  createdAt: string;
}

export interface BakiTransaction {
  id: string;
  customerId: string;
  date: string;
  type: 'sale_due' | 'payment_received' | 'due_added';
  amount: number;       // টাকার পরিমাণ
  note?: string;
  saleId?: string;
  balanceAfter: number;
}

export interface PurchaseRecord {
  id: string;
  date: string;
  supplierName?: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: ProductUnit;
  unitCostPrice: number;
  totalCost: number;
  note?: string;
}

export interface ShopProfile {
  shopName: string;
  ownerName: string;
  phone: string;
  email?: string;
  address: string;
  pin: string;          // 4-digit PIN
  currency: string;     // '৳'
  isRegistered: boolean;
  language: Language;
  logo?: string;        // কাস্টম দোকানের লোগো
  shopId?: string;      // Unique identifier for licensing
  isBlocked?: boolean;  // অ্যাডমিন কর্তৃক ব্লক করা কি না
  blockReason?: string; // ব্লক করার কারণ
}

export type AppMode = 'trial' | 'pro' | 'normal';
export type SubscriptionPlan = 'trial' | 'monthly' | 'yearly' | 'lifetime';
export type SubscriptionStatus = 'trial' | 'pro' | 'expired';

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  trialStartDate: string;
  trialEndDate: string;
  proStartDate?: string;
  proEndDate?: string;
  licenseKey?: string;
  lastActiveTimestamp: number; // Anti-clock manipulation tracking
  isClockTampered?: boolean;
  shopId: string;
  isOwner?: boolean; // Set true for the App Owner (Nazrul / 01733414031)
  isBlocked?: boolean;
  blockReason?: string;
}

export interface RegisteredShopUser {
  phone: string;        // normalized 10-digit phone
  fullPhone: string;    // 11-digit phone starting with 0
  shopId: string;
  shopName: string;
  ownerName: string;
  address?: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialStartDate?: string;
  trialEndDate?: string;
  createdAt: string;
  lastActiveAt: string;
  platform?: string;    // 'Android APK' | 'Web Browser'
  productsCount?: number;
  salesCount?: number;
  customersCount?: number;
  isBlocked: boolean;
  blockReason?: string;
  blockedAt?: string;
}

export interface PaymentRequest {
  id: string;
  shopId: string;
  shopName: string;
  shopPhone: string;
  plan: 'monthly' | 'yearly' | 'lifetime';
  amount: number;
  senderPhone: string;
  transactionId: string;
  screenshot?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
  generatedLicenseKey?: string;
}

export interface LicensePayload {
  shopId: string;
  shopPhone: string;
  plan: 'monthly' | 'yearly' | 'lifetime';
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

// ================= SUPPLIER / WHOLESALER DUE (সাপ্লায়ারের বাকি) =================
export interface Supplier {
  id: string;
  name: string;          // মহাজন বা কোম্পানির নাম (যেমন: মেসার্স রহিম ট্রেডার্স / মেসার্স আলী রাইস মিল)
  contactPerson?: string;// প্রতিনিধির নাম
  phone: string;         // মোবাইল নম্বর
  address?: string;      // মোকাম বা ঠিকানা
  company?: string;      // কোম্পানি / ডিলারশিপ
  totalDue: number;      // সাপ্লায়ার আমাদের কাছে কত টাকা পায় (বাকি ৳)
  totalPayableDue?: number; // Alias for totalDue
  createdAt: string;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  date: string;
  type: 'purchase_due' | 'payment_made' | 'payment_given' | 'purchase_return'; // মাল কিনে বাকি | টাকা পরিশোধ | মাল ফেরত
  amount: number;
  note?: string;         // চালানের বিবরণ / পণ্যের নাম
  purchaseId?: string;
  balanceAfter: number;
  damageDeduction?: number; // ড্যামেজ মাল ফেরত বাদ (৳)
  stockValue?: number;      // নতুন কেনা মালের নিট স্টক মূল্য (Items Total - Damage Amount)
}

// ================= DAILY SHOP EXPENSES (দোকানের দৈনন্দিন খরচ) =================
export type ExpenseCategory =
  | 'rent'         // দোকান ভাড়া
  | 'electricity'  // বিদ্যুৎ বিল
  | 'salary'       // কর্মচারীর বেতন
  | 'transport'    // পরিবহন / গাড়িভাড়া
  | 'food'         // আপ্যায়ন ও চা-নাস্তা
  | 'packaging'    // পলিথিন / প্যাকিং ব্যাগ
  | 'maintenance'  // মেরামত ও রক্ষণাবেক্ষণ
  | 'other';       // বিবিধ খরচ

export interface Expense {
  id: string;
  date: string;          // ISO date string
  category: ExpenseCategory;
  categoryName: string;  // বাংলা নাম (যেমন: পরিবহন, বিদ্যুৎ বিল)
  amount: number;        // টাকার পরিমাণ
  note?: string;         // বিবরণ
  paymentMethod: 'cash' | 'bkash' | 'nagad' | 'bank';
  createdAt: string;
}

// ================= MULTI-ITEM BULK PURCHASE (চাল, ডাল, তেলসহ বিভিন্ন পণ্য একসঙ্গে কেনা) =================
export interface BulkPurchaseItem {
  productId?: string;
  productName: string;
  category: string;
  quantity: number;
  unit: ProductUnit;
  unitCostPrice: number; // পাইকারি কেনা দর
  totalCost: number;     // মোট খরচ (quantity * unitCostPrice)
}

export interface PurchaseReturnItem {
  id: string;
  date: string;          // ISO date
  amount: number;        // ফেরত প্রাপ্ত নগদ টাকা
  note?: string;         // কারণ বা নোট (যেমন: ড্যামেজ মাল ফেরত)
  createdAt: string;
}

export interface BulkPurchase {
  id: string;
  purchaseNo: string;    // যেমন: #PO-1001
  invoiceNo?: string;    // Alias for purchaseNo
  date: string;
  supplierId?: string;
  supplierName?: string;
  supplierPhone?: string;
  items: BulkPurchaseItem[];
  grossTotalAmount?: number; // ড্যামেজ বাদ দেওয়ার আগে মোট নতুন মালের মূল্য
  damageDeduction?: number;  // ড্যামেজ মাল ফেরত বাদ (৳)
  totalAmount: number;   // নিট ক্রয় মূল্য (Items Total - Damage Deduction)
  paidAmount: number;    // পরিশোধিত টাকা (নিট নগদ বিল)
  dueAmount: number;     // বাকি টাকা (সাপ্লায়ারের পাওনা)
  paymentType: 'cash' | 'due' | 'partial' | 'bkash' | 'nagad' | 'bank';
  note?: string;         // মেমো বা ভাউচার বিবরণ
  returnedAmount?: number; // মোট ফেরত আসা টাকার পরিমাণ (legacy)
  returns?: PurchaseReturnItem[]; // ফেরত সংক্রান্ত হিস্ট্রি (legacy)
  createdAt: string;
}

// ================= OWNER CAPITAL & DRAWINGS (মালিকের টাকা জমা ও উত্তোলন) =================
export type OwnerTransactionType =
  | 'withdrawal'         // মালিকের টাকা উত্তোলন (দোকানের নগদ টাকা কমবে)
  | 'withdrawal_return'  // মালিকের উত্তোলিত টাকা ফেরত (দোকানের নগদ টাকা বাড়বে)
  | 'capital_deposit';   // মালিকের নতুন মূলধন জমা (দোকানের নগদ টাকা বাড়বে এবং মূলধন বাড়বে)

export interface OwnerTransaction {
  id: string;
  date: string;                   // ISO date string
  type: OwnerTransactionType;
  amount: number;                 // টাকার পরিমাণ (৳)
  note?: string;                  // বিবরণ
  linkedWithdrawalId?: string;    // আগের উত্তোলনের সঙ্গে সম্পর্ক (ঐচ্ছিক)
  createdAt: string;
}

// ================= OTHER CASH IN / OUT & POST-CLOSE ADJUSTMENTS (অন্যান্য নগদ জমা/উত্তোলন ও সংশোধনী রেকর্ড) =================
export interface OtherCashEntry {
  id: string;
  date: string;                   // ISO date string or YYYY-MM-DD
  type: 'cash_in' | 'cash_out';   // অন্যান্য নগদ জমা | অন্যান্য নগদ উত্তোলন
  amount: number;
  note: string;
  isPostCloseAdjustment?: boolean;// দিনশেষের হিসাব বন্ধ হওয়ার পরে সংশোধনের রেকর্ড কি না
  reconciliationDate?: string;    // যে তারিখের ক্যাশ মিলের সংশোধনী (YYYY-MM-DD)
  createdAt: string;
}

// ================= DAILY CASH RECONCILIATION (উন্নত দিনশেষের ক্যাশ মিল) =================
export interface DailyCashReconciliation {
  id: string;                     // যেমন: recon_2026-11-03
  date: string;                   // YYYY-MM-DD
  openingCash: number;            // প্রারম্ভিক নগদ
  cashSales: number;              // নগদ বিক্রি
  customerDueCollected: number;   // কাস্টমারের বাকি আদায়
  ownerDepositAndReturn: number;  // মালিকের টাকা জমা ও ফেরত
  otherCashIn: number;            // অন্যান্য নগদ জমা
  cashPurchases: number;          // নগদ পণ্য ক্রয়
  supplierDuePaid: number;        // সাপ্লায়ারকে বাকি পরিশোধ
  shopExpenses: number;           // দোকানের খরচ
  ownerWithdrawal: number;        // মালিকের টাকা উত্তোলন
  otherCashOut: number;           // অন্যান্য নগদ উত্তোলন
  expectedClosingCash: number;    // দিনশেষে থাকার কথা যে নগদ টাকা
  actualClosingCash: number;      // বাস্তবে হাতে পাওয়া নগদ
  difference: number;             // কত টাকা কম বা বেশি (actual - expected)
  note?: string;                  // পার্থক্যের বিবরণ
  isClosed: boolean;              // দিনশেষের হিসাব বন্ধ কি না
  closedAt: string;
  adjustments?: OtherCashEntry[]; // বন্ধ হওয়ার পরের সংশোধনের আলাদা রেকর্ড
}

// ================= MONTHLY CASH RECONCILIATION (মাসিক ক্যাশ মিল ও রিপোর্ট) =================
export interface MonthlyCashReconciliation {
  id: string;                     // যেমন: mrecon_2026-11
  yearMonth: string;              // YYYY-MM
  openingCash: number;            // মাসের শুরুতে নগদ
  totalCashIn: number;            // মাসের মোট নগদ জমা
  totalCashOut: number;           // মাসের মোট নগদ উত্তোলন
  expectedClosingCash: number;    // মাসশেষে প্রত্যাশিত নগদ
  actualClosingCash?: number;     // প্রকৃত নগদ (যদি দোকানদার গণনা করে দেয়)
  difference?: number;            // মোট কম বা বেশি টাকা
  note?: string;                  // পার্থক্যের বিবরণ / মন্তব্য
  updatedAt: string;
}
