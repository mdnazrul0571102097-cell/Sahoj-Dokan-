/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Product,
  CartItem,
  Sale,
  Customer,
  BakiTransaction,
  PurchaseRecord,
  ShopProfile,
  Language,
  SubscriptionInfo,
  AppMode,
  Supplier,
  SupplierTransaction,
  Expense,
  BulkPurchase,
  OwnerTransaction,
  OtherCashEntry,
  DailyCashReconciliation,
  MonthlyCashReconciliation,
} from './types';
import { DB } from './storage/db';
import { getSubscriptionDetails } from './utils/license';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { PosView } from './components/PosView';
import { ProductManagement } from './components/ProductManagement';
import { BakiKhataView } from './components/BakiKhataView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { AuthModal } from './components/AuthModal';
import { LanguageSelectorModal } from './components/LanguageSelectorModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { TrialBanner } from './components/TrialBanner';
import { MenuHubView, MenuTileTarget } from './components/MenuHubView';
import { AllReportsView } from './components/AllReportsView';
import { CalculatorModal } from './components/CalculatorModal';
import { CloudSync } from './services/cloudSync';

export default function App() {
  // Database states
  const [profile, setProfile] = useState<ShopProfile>(() => DB.getProfile());
  const [products, setProducts] = useState<Product[]>(() => DB.getProducts());
  const [customers, setCustomers] = useState<Customer[]>(() => DB.getCustomers());
  const [sales, setSales] = useState<Sale[]>(() => DB.getSales());
  const [bakiTransactions, setBakiTransactions] = useState<BakiTransaction[]>(() =>
    DB.getBakiTransactions()
  );
  const [purchases, setPurchases] = useState<PurchaseRecord[]>(() => DB.getPurchases());
  const [subscription, setSubscription] = useState<SubscriptionInfo>(() => DB.getSubscription());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => DB.getSuppliers());
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>(() =>
    DB.getSupplierTransactions()
  );
  const [expenses, setExpenses] = useState<Expense[]>(() => DB.getExpenses());
  const [bulkPurchases, setBulkPurchases] = useState<BulkPurchase[]>(() => DB.getBulkPurchases());
  const [ownerTransactions, setOwnerTransactions] = useState<OwnerTransaction[]>(() =>
    DB.getOwnerTransactions()
  );
  const [otherCashEntries, setOtherCashEntries] = useState<OtherCashEntry[]>(() =>
    DB.getOtherCashEntries()
  );
  const [dailyReconciliations, setDailyReconciliations] = useState<DailyCashReconciliation[]>(() =>
    DB.getDailyReconciliations()
  );
  const [monthlyReconciliations, setMonthlyReconciliations] = useState<MonthlyCashReconciliation[]>(
    () => DB.getMonthlyReconciliations()
  );
  const [initialOpeningCash, setInitialOpeningCash] = useState<number>(() =>
    DB.getInitialOpeningCash()
  );
  const [initialStoreCapital, setInitialStoreCapital] = useState<number>(() =>
    DB.getInitialStoreCapital()
  );

  // App UI states
  const [activeTab, setActiveTab] = useState<NavTab>('pos');
  const [activeMenuPage, setActiveMenuPage] = useState<Exclude<MenuTileTarget, 'calculator'> | null>(null);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    // If not registered yet, open auth directly; if registered, require 4-digit PIN unlock
    return true;
  });
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState<boolean>(false);
  const [preferredPlan, setPreferredPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState<boolean>(false);

  const subDetails = getSubscriptionDetails(subscription);
  const appMode: AppMode = subDetails.mode;

  // Theme state: 'light' | 'dark' (defaulting to serene light mode #F8FAFC)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('sahoj_dokan_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {}
    return 'light';
  });

  // Back navigation & double-tap-to-exit state
  const [exitToastVisible, setExitToastVisible] = useState<boolean>(false);
  const lastBackPressRef = useRef<number>(0);
  const lastBackEventHandledRef = useRef<number>(0);
  const exitToastTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // Cleanup any legacy auto-withdrawal entries on mount
    const cleanedOwnerTxs = DB.getOwnerTransactions();
    setOwnerTransactions(cleanedOwnerTxs);
  }, []);

  // Global Android Back Button & Browser PopState Navigation Handler
  useEffect(() => {
    const closeTopmostDomModal = (): boolean => {
      try {
        // Find all full-screen modal overlays currently mounted in the DOM
        const overlays = Array.from(
          document.querySelectorAll<HTMLElement>('div.fixed.inset-0')
        ).filter((el) => {
          // Do not close Auth PIN Lock screen or Remote Admin Block screen
          if (el.dataset.nonDismissible === 'true') return false;
          if (el.textContent?.includes('পিন দিয়ে আনলক করুন') || el.textContent?.includes('অ্যাকাউন্ট সাময়িকভাবে ব্লক')) {
            return false;
          }
          return el.offsetParent !== null || getComputedStyle(el).display !== 'none';
        });

        if (overlays.length === 0) return false;
        const topModal = overlays[overlays.length - 1];

        // Look for an explicit close button inside the topmost modal
        const buttons = Array.from(topModal.querySelectorAll<HTMLButtonElement>('button'));
        // 1. Button with X icon (lucide-x) or explicit close attribute
        const xBtn = buttons.find(
          (btn) =>
            btn.dataset.modalClose === 'true' ||
            btn.querySelector('svg.lucide-x') !== null ||
            btn.textContent?.trim() === '✕'
        );
        if (xBtn) {
          xBtn.click();
          return true;
        }

        // 2. Cancel / Close text button
        const cancelBtn = buttons.find((btn) => {
          const txt = (btn.textContent || '').trim();
          return (
            txt === 'বাতিল' ||
            txt === 'বন্ধ করুন' ||
            txt === 'পরে করব' ||
            txt === 'না, থাকুক' ||
            txt === 'ফিরে যান' ||
            txt === 'Close' ||
            txt === 'Cancel'
          );
        });
        if (cancelBtn) {
          cancelBtn.click();
          return true;
        }
      } catch (_) {}
      return false;
    };

    const handleBackAction = (): string => {
      const now = Date.now();
      // Prevent duplicate execution if both popstate and Android native callback fire simultaneously
      if (now - lastBackEventHandledRef.current < 180) {
        return 'DEBOUNCED';
      }
      lastBackEventHandledRef.current = now;

      // 1. Check top-level App modals first
      if (isAdminPanelOpen) {
        setIsAdminPanelOpen(false);
        return 'MODAL_CLOSED';
      }
      if (isSubscriptionModalOpen) {
        setIsSubscriptionModalOpen(false);
        return 'MODAL_CLOSED';
      }
      if (showLanguageModal) {
        setShowLanguageModal(false);
        return 'MODAL_CLOSED';
      }
      if (isCalculatorOpen) {
        setIsCalculatorOpen(false);
        return 'MODAL_CLOSED';
      }

      // 2. Check any open child modal in the DOM (e.g. Add Product, Quick Sale, Day Close, Receipt, Camera, etc.)
      if (!isLocked && closeTopmostDomModal()) {
        return 'MODAL_CLOSED';
      }

      // 3. Check registered sub-view back handler (e.g. inside BakiKhataView customer details)
      if (!isLocked && typeof (window as any).__sdSubViewBack === 'function') {
        const handledBySubView = (window as any).__sdSubViewBack();
        if (handledBySubView) {
          return 'SUBVIEW_BACK';
        }
      }

      // 4. If user is inside any tile sub-screen of Menu Hub, go back to Menu Hub grid
      if (!isLocked && activeTab === 'menu' && activeMenuPage !== null) {
        setActiveMenuPage(null);
        return 'MENU_HUB_BACK';
      }

      // 5. If user is on any tab other than Home ('pos'), navigate back to Home ('pos')
      if (!isLocked && activeTab !== 'pos') {
        setActiveTab('pos');
        setActiveMenuPage(null);
        return 'TAB_BACK';
      }

      // 6. On Home screen ('pos') with no modals open: require double-tap within 2 seconds to exit
      if (now - lastBackPressRef.current < 2200) {
        setExitToastVisible(false);
        if ((window as any).AndroidApp?.exitApp) {
          (window as any).AndroidApp.exitApp();
        }
        return 'EXIT_APP';
      }

      lastBackPressRef.current = now;
      setExitToastVisible(true);
      if (exitToastTimeoutRef.current) clearTimeout(exitToastTimeoutRef.current);
      exitToastTimeoutRef.current = setTimeout(() => {
        setExitToastVisible(false);
      }, 2200);
      return 'SHOW_EXIT_TOAST';
    };

    (window as any).__handleAndroidBack = handleBackAction;

    // Also keep browser history guard for WebView / mobile browser back gestures
    try {
      if (!window.history.state || !window.history.state.sahojBackGuard) {
        window.history.pushState({ sahojBackGuard: true }, '');
      }
    } catch (_) {}

    const onPopState = () => {
      const res = handleBackAction();
      if (res !== 'EXIT_APP') {
        try {
          window.history.pushState({ sahojBackGuard: true }, '');
        } catch (_) {}
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [activeTab, activeMenuPage, isCalculatorOpen, isLocked, isAdminPanelOpen, isSubscriptionModalOpen, showLanguageModal]);

  useEffect(() => {
    try {
      localStorage.setItem('sahoj_dokan_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (_) {}
  }, [theme]);

  // Periodic clock & subscription integrity check
  useEffect(() => {
    const interval = setInterval(() => {
      const refreshed = DB.getSubscription();
      setSubscription(refreshed);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Ensure permanent trial synchronization & real-time block status check with Firebase Firestore
  const [blockStatus, setBlockStatus] = useState<{ isBlocked: boolean; reason?: string }>(() =>
    DB.isPhoneBlockedLocal(profile.phone)
  );
  const [isCheckingBlock, setIsCheckingBlock] = useState(false);

  useEffect(() => {
    if (profile.phone) {
      CloudSync.ensurePermanentTrial(profile.phone)
        .then((syncedSub) => {
          if (syncedSub) {
            setSubscription(syncedSub);
          }
        })
        .catch((err) => {
          console.warn('Permanent trial check error:', err);
        });

      const unsub = CloudSync.subscribeToBlockStatus(profile.phone, (status) => {
        setBlockStatus(status);
      });
      return () => unsub();
    }
  }, [profile.phone, isAdminPanelOpen]);

  const language = profile.language || 'bn';

  // Handle Language selection
  const handleLanguageChange = (lang: Language) => {
    const updated = { ...profile, language: lang };
    setProfile(updated);
    DB.saveProfile(updated);
    DB.setFirstRunCompleted();
    setShowLanguageModal(false);
  };

  // Handle Save Profile
  const handleSaveProfile = (updatedProfile: ShopProfile) => {
    setProfile(updatedProfile);
    DB.saveProfile(updatedProfile);
  };

  // Handle Unlock
  const handleUnlock = () => {
    setIsLocked(false);
  };

  // Handle Lock
  const handleLock = () => {
    setIsLocked(true);
  };

  // Handle Complete Sale from POS
  const handleCompleteSale = (sale: Sale, updatedProducts: Product[]) => {
    // Save sale
    setSales((prevSales) => {
      const nextSales = [sale, ...prevSales];
      DB.saveSales(nextSales);
      return nextSales;
    });

    // Update products inventory
    setProducts(updatedProducts);
    DB.saveProducts(updatedProducts);

    // If sale had due amount, record in Baki Ledger
    if (sale.dueAmount > 0 && sale.customerId) {
      let updatedCustTotalDue = sale.dueAmount;
      setCustomers((prevCusts) => {
        const nextCustomers = prevCusts.map((c) => {
          if (c.id === sale.customerId) {
            updatedCustTotalDue = Math.round(((c.totalDue || 0) + sale.dueAmount) * 100) / 100;
            return {
              ...c,
              totalDue: updatedCustTotalDue,
            };
          }
          return c;
        });
        DB.saveCustomers(nextCustomers);
        return nextCustomers;
      });

      const newTx: BakiTransaction = {
        id: `btx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        customerId: sale.customerId,
        date: sale.date || new Date().toISOString(),
        type: 'sale_due',
        amount: sale.dueAmount,
        note: `ইনভয়েস #${sale.invoiceNo} থেকে বাকি`,
        saleId: sale.id,
        balanceAfter: updatedCustTotalDue,
      };

      setBakiTransactions((prevTxs) => {
        const nextTxs = [newTx, ...prevTxs];
        DB.saveBakiTransactions(nextTxs);
        return nextTxs;
      });
    }
  };

  // Handle Update / Edit Sale Invoice (Adjusts product stock and customer due)
  const handleUpdateSale = (updatedSale: Sale) => {
    const oldSale = sales.find((s) => s.id === updatedSale.id);
    if (!oldSale) return;

    // 1. Update sales list
    setSales((prevSales) => {
      const nextSales = prevSales.map((s) => (s.id === updatedSale.id ? updatedSale : s));
      DB.saveSales(nextSales);
      return nextSales;
    });

    // 2. Adjust product stock based on difference between oldSale.items and updatedSale.items
    const isReturnRecord = updatedSale.id.startsWith('return_') || updatedSale.grandTotal < 0;
    if (!isReturnRecord) {
      setProducts((prevProducts) => {
        let changed = false;
        const nextProducts = prevProducts.map((p) => {
          const oldQty = (oldSale.items || [])
            .filter((it) => it.productId === p.id)
            .reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
          const newQty = (updatedSale.items || [])
            .filter((it) => it.productId === p.id)
            .reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
          const diff = oldQty - newQty; // positive if quantity decreased (restore stock), negative if increased (deduct stock)
          if (diff !== 0) {
            changed = true;
            return {
              ...p,
              stock: Math.max(0, Math.round(((p.stock || 0) + diff) * 1000) / 1000),
              updatedAt: new Date().toISOString(),
            };
          }
          return p;
        });
        if (changed) {
          DB.saveProducts(nextProducts);
          return nextProducts;
        }
        return prevProducts;
      });
    }

    // 3. Adjust customer due if dueAmount changed
    const oldDue = Number(oldSale.dueAmount) || 0;
    const newDue = Number(updatedSale.dueAmount) || 0;
    const dueDelta = newDue - oldDue;
    if (dueDelta !== 0 && updatedSale.customerId) {
      setCustomers((prevCusts) => {
        const nextCustomers = prevCusts.map((c) => {
          if (c.id === updatedSale.customerId) {
            const nextTotalDue = Math.max(
              0,
              Math.round(((c.totalDue || 0) + dueDelta) * 100) / 100
            );
            return {
              ...c,
              totalDue: nextTotalDue,
            };
          }
          return c;
        });
        DB.saveCustomers(nextCustomers);
        return nextCustomers;
      });

      setBakiTransactions((prevTxs) => {
        const nextTxs = prevTxs.map((tx) => {
          if (tx.saleId === updatedSale.id || (tx.customerId === updatedSale.customerId && tx.type === 'sale_due' && tx.note?.includes(updatedSale.invoiceNo))) {
            return {
              ...tx,
              amount: newDue,
              balanceAfter: Math.max(0, (tx.balanceAfter || 0) + dueDelta),
            };
          }
          return tx;
        });
        DB.saveBakiTransactions(nextTxs);
        return nextTxs;
      });
    }
  };

  // Handle Delete Sale / Cash Memo (Restores product stock and reverses customer due if any)
  const handleDeleteSale = (saleId: string) => {
    const targetSale = sales.find((s) => s.id === saleId);
    if (!targetSale) return;

    // 1. Remove from sales list
    setSales((prevSales) => {
      const nextSales = prevSales.filter((s) => s.id !== saleId);
      DB.saveSales(nextSales);
      return nextSales;
    });

    // 2. Restore stock for inventory products sold in this memo (or reverse stock if deleting a return record)
    const isReturnRecord = targetSale.id.startsWith('return_') || targetSale.grandTotal < 0;
    if (targetSale.items && targetSale.items.length > 0) {
      setProducts((prevProducts) => {
        let changed = false;
        const nextProducts = prevProducts.map((p) => {
          const soldItems = targetSale.items.filter((it) => it.productId === p.id);
          if (soldItems.length > 0) {
            changed = true;
            const qtyDelta = soldItems.reduce(
              (sum, it) => sum + (Number(it.quantity) || 0),
              0
            );
            const nextStock = isReturnRecord
              ? Math.max(0, Math.round(((p.stock || 0) - qtyDelta) * 100) / 100)
              : Math.round(((p.stock || 0) + qtyDelta) * 100) / 100;
            return {
              ...p,
              stock: nextStock,
            };
          }
          return p;
        });
        if (changed) {
          DB.saveProducts(nextProducts);
          return nextProducts;
        }
        return prevProducts;
      });
    }

    // 3. If the sale had a due amount, reverse it from Baki Khata
    if (targetSale.dueAmount > 0 && targetSale.customerId) {
      setCustomers((prevCusts) => {
        const nextCustomers = prevCusts.map((c) => {
          if (c.id === targetSale.customerId) {
            const newDue = Math.max(
              0,
              Math.round(((c.totalDue || 0) - targetSale.dueAmount) * 100) / 100
            );
            return {
              ...c,
              totalDue: newDue,
            };
          }
          return c;
        });
        DB.saveCustomers(nextCustomers);
        return nextCustomers;
      });

      setBakiTransactions((prevTxs) => {
        const nextTxs = prevTxs.filter(
          (tx) =>
            tx.saleId !== targetSale.id &&
            !(
              tx.customerId === targetSale.customerId &&
              tx.type === 'sale_due' &&
              tx.note?.includes(targetSale.invoiceNo)
            )
        );
        DB.saveBakiTransactions(nextTxs);
        return nextTxs;
      });
    }

    // 4. If that date's Daily Cash Reconciliation was already closed, record a separate adjustment entry
    const saleDateStr = getLocalDateStr(targetSale.date);
    const closedRecon = dailyReconciliations.find((r) => r.date === saleDateStr && r.isClosed);
    const cashPortion = Math.max(0, (targetSale.grandTotal || 0) - (targetSale.dueAmount || 0));
    if (closedRecon && cashPortion > 0) {
      handleAddPostCloseAdjustment(saleDateStr, {
        id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: saleDateStr,
        type: 'cash_out',
        amount: cashPortion,
        note: `বন্ধ হিসাবের পর ক্যাশ মেমো #${targetSale.invoiceNo} ডিলিট করায় নগদ সমন্বয়`,
        isPostCloseAdjustment: true,
        reconciliationDate: saleDateStr,
        createdAt: new Date().toISOString(),
      });
    }
  };

  // Handle Add Customer
  const handleAddNewCustomer = (customer: Customer) => {
    setCustomers((prev) => {
      const next = [customer, ...prev];
      DB.saveCustomers(next);
      return next;
    });

    if (customer.totalDue > 0) {
      const initTx: BakiTransaction = {
        id: `btx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        customerId: customer.id,
        date: new Date().toISOString(),
        type: 'due_added',
        amount: customer.totalDue,
        note: 'পূর্বের জের / প্রারম্ভিক বাকি',
        balanceAfter: customer.totalDue,
      };
      setBakiTransactions((prevTxs) => {
        const nextTxs = [initTx, ...prevTxs];
        DB.saveBakiTransactions(nextTxs);
        return nextTxs;
      });
    }
  };

  // Handle Payment Received in Baki Khata
  const handleReceivePayment = (
    customerId: string,
    amount: number,
    note: string,
    newBalance: number
  ) => {
    setCustomers((prev) => {
      const nextCustomers = prev.map((c) => {
        if (c.id === customerId) {
          return { ...c, totalDue: newBalance };
        }
        return c;
      });
      DB.saveCustomers(nextCustomers);
      return nextCustomers;
    });

    const newTx: BakiTransaction = {
      id: `btx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      customerId,
      date: new Date().toISOString(),
      type: 'payment_received',
      amount,
      note,
      balanceAfter: newBalance,
    };
    setBakiTransactions((prevTxs) => {
      const nextTxs = [newTx, ...prevTxs];
      DB.saveBakiTransactions(nextTxs);
      return nextTxs;
    });
  };

  // Handle Add New Due in Baki Khata
  const handleAddNewDue = (
    customerId: string,
    amount: number,
    note: string,
    newBalance: number
  ) => {
    setCustomers((prev) => {
      const nextCustomers = prev.map((c) => {
        if (c.id === customerId) {
          return { ...c, totalDue: newBalance };
        }
        return c;
      });
      DB.saveCustomers(nextCustomers);
      return nextCustomers;
    });

    const newTx: BakiTransaction = {
      id: `btx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      customerId,
      date: new Date().toISOString(),
      type: 'due_added',
      amount,
      note,
      balanceAfter: newBalance,
    };
    setBakiTransactions((prevTxs) => {
      const nextTxs = [newTx, ...prevTxs];
      DB.saveBakiTransactions(nextTxs);
      return nextTxs;
    });
  };

  const handleDeleteCustomer = (customerId: string) => {
    const nextCustomers = customers.filter((c) => c.id !== customerId);
    setCustomers(nextCustomers);
    DB.saveCustomers(nextCustomers);

    const nextTxs = bakiTransactions.filter((tx) => tx.customerId !== customerId);
    setBakiTransactions(nextTxs);
    DB.saveBakiTransactions(nextTxs);
  };

  const handleUpdateCustomer = (updatedCustomer: Customer) => {
    setCustomers((prev) => {
      const nextCustomers = prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c));
      DB.saveCustomers(nextCustomers);
      return nextCustomers;
    });
  };

  // Handle Save Product (Create or Update)
  const handleSaveProduct = (product: Product) => {
    try {
      setProducts((prev) => {
        const existingIndex = prev.findIndex((p) => p.id === product.id);
        let next: Product[];
        if (existingIndex > -1) {
          next = [...prev];
          next[existingIndex] = product;
        } else {
          next = [product, ...prev];
        }
        DB.saveProducts(next);
        return next;
      });
    } catch (err) {
      console.error('App handleSaveProduct error:', err);
    }
  };

  // Handle Delete Product
  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== productId);
      DB.saveProducts(next);
      return next;
    });
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Handle Record Purchase / Restock
  const handleRecordPurchase = (purchase: PurchaseRecord, updatedProduct: Product) => {
    const nextPurchases = [purchase, ...purchases];
    setPurchases(nextPurchases);
    DB.savePurchases(nextPurchases);

    handleSaveProduct(updatedProduct);
  };

  // Handle Suppliers
  const handleAddSupplier = (supplier: Supplier) => {
    setSuppliers((prev) => {
      const next = [supplier, ...prev];
      DB.saveSuppliers(next);
      return next;
    });

    const initialDueAmt = supplier.totalDue ?? supplier.totalPayableDue ?? 0;
    if (initialDueAmt > 0) {
      const initTx: SupplierTransaction = {
        id: `stx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        supplierId: supplier.id,
        date: new Date().toISOString(),
        type: 'purchase_due',
        amount: initialDueAmt,
        note: 'নতুন সাপ্লায়ার / প্রারম্ভিক বাকি মাল',
        balanceAfter: initialDueAmt,
      };
      setSupplierTransactions((prev) => {
        const nextTxs = [initTx, ...prev];
        DB.saveSupplierTransactions(nextTxs);
        return nextTxs;
      });
    }
  };

  const handlePaySupplier = (
    supplierId: string,
    amount: number,
    note?: string,
    newBalance?: number
  ) => {
    let computedNewDue = newBalance ?? 0;
    setSuppliers((prev) => {
      const target = prev.find((s) => s.id === supplierId);
      if (!target) return prev;
      const currentDue = target.totalDue ?? target.totalPayableDue ?? 0;
      computedNewDue =
        typeof newBalance === 'number'
          ? newBalance
          : Math.max(0, Math.round((currentDue - amount) * 100) / 100);
      const nextSuppliers = prev.map((s) =>
        s.id === supplierId
          ? { ...s, totalDue: computedNewDue, totalPayableDue: computedNewDue }
          : s
      );
      DB.saveSuppliers(nextSuppliers);
      return nextSuppliers;
    });

    const newTx: SupplierTransaction = {
      id: `stx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      supplierId,
      date: new Date().toISOString(),
      type: 'payment_made',
      amount,
      note: note || 'মহাজনকে টাকা পরিশোধ / জমা',
      balanceAfter: computedNewDue,
    };
    setSupplierTransactions((prev) => {
      const nextTxs = [newTx, ...prev];
      DB.saveSupplierTransactions(nextTxs);
      return nextTxs;
    });
  };

  const handleAddSupplierDue = (
    supplierId: string,
    amount: number,
    note?: string,
    newBalance?: number,
    extra?: {
      damageDeduction?: number;
      stockValue?: number;
      updatedProducts?: Product[];
    }
  ) => {
    let computedNewDue = newBalance ?? amount;
    setSuppliers((prev) => {
      const target = prev.find((s) => s.id === supplierId);
      if (!target) return prev;
      const currentDue = target.totalDue ?? target.totalPayableDue ?? 0;
      computedNewDue =
        typeof newBalance === 'number'
          ? newBalance
          : Math.round((currentDue + amount) * 100) / 100;
      const nextSuppliers = prev.map((s) =>
        s.id === supplierId
          ? { ...s, totalDue: computedNewDue, totalPayableDue: computedNewDue }
          : s
      );
      DB.saveSuppliers(nextSuppliers);
      return nextSuppliers;
    });

    if (extra?.updatedProducts) {
      setProducts(extra.updatedProducts);
      DB.saveProducts(extra.updatedProducts);
    }

    const newTx: SupplierTransaction = {
      id: `stx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      supplierId,
      date: new Date().toISOString(),
      type: 'purchase_due',
      amount,
      note: note || 'নতুন বাকি যোগ',
      balanceAfter: computedNewDue,
      ...(extra?.damageDeduction !== undefined ? { damageDeduction: extra.damageDeduction } : {}),
      ...(extra?.stockValue !== undefined ? { stockValue: extra.stockValue } : {}),
    };
    setSupplierTransactions((prev) => {
      const nextTxs = [newTx, ...prev];
      DB.saveSupplierTransactions(nextTxs);
      return nextTxs;
    });
  };

  const handleSupplierReturn = (
    supplierId: string,
    amount: number,
    note?: string,
    newBalance?: number
  ) => {
    let computedNewDue = newBalance ?? 0;
    setSuppliers((prev) => {
      const target = prev.find((s) => s.id === supplierId);
      if (!target) return prev;
      const currentDue = target.totalDue ?? target.totalPayableDue ?? 0;
      computedNewDue =
        typeof newBalance === 'number'
          ? newBalance
          : Math.max(0, Math.round((currentDue - amount) * 100) / 100);
      const nextSuppliers = prev.map((s) =>
        s.id === supplierId
          ? { ...s, totalDue: computedNewDue, totalPayableDue: computedNewDue }
          : s
      );
      DB.saveSuppliers(nextSuppliers);
      return nextSuppliers;
    });

    const newTx: SupplierTransaction = {
      id: `stx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      supplierId,
      date: new Date().toISOString(),
      type: 'purchase_return',
      amount,
      note: note || 'মাল ফেরত বাবদ বাকি কর্তন',
      balanceAfter: computedNewDue,
    };
    setSupplierTransactions((prev) => {
      const nextTxs = [newTx, ...prev];
      DB.saveSupplierTransactions(nextTxs);
      return nextTxs;
    });
  };

  const handleUpdateSupplier = (updatedSupplier: Supplier) => {
    setSuppliers((prev) => {
      const nextSuppliers = prev.map((s) =>
        s.id === updatedSupplier.id ? updatedSupplier : s
      );
      DB.saveSuppliers(nextSuppliers);
      return nextSuppliers;
    });
  };

  const handleUpdateSupplierTransaction = (
    supplierId: string,
    nextSupplierBalance: number,
    nextAllTxs: SupplierTransaction[]
  ) => {
    setSuppliers((prev) => {
      const nextSuppliers = prev.map((s) =>
        s.id === supplierId
          ? { ...s, totalDue: nextSupplierBalance, totalPayableDue: nextSupplierBalance }
          : s
      );
      DB.saveSuppliers(nextSuppliers);
      return nextSuppliers;
    });
    setSupplierTransactions(nextAllTxs);
    DB.saveSupplierTransactions(nextAllTxs);
  };

  const handleDeleteSupplier = (supplierId: string) => {
    setSuppliers((prev) => {
      const nextSuppliers = prev.filter((s) => s.id !== supplierId);
      DB.saveSuppliers(nextSuppliers);
      return nextSuppliers;
    });
    setSupplierTransactions((prev) => {
      const nextTxs = prev.filter((tx) => tx.supplierId !== supplierId);
      DB.saveSupplierTransactions(nextTxs);
      return nextTxs;
    });
  };

  // Helper to get local YYYY-MM-DD
  const getLocalDateStr = (d?: string | Date): string => {
    if (!d) return '';
    try {
      const dt = typeof d === 'string' ? new Date(d) : d;
      if (isNaN(dt.getTime())) return typeof d === 'string' ? d.slice(0, 10) : '';
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
        dt.getDate()
      ).padStart(2, '0')}`;
    } catch {
      return typeof d === 'string' ? d.slice(0, 10) : '';
    }
  };

  // Record a post-close adjustment if an action affects a date whose Daily Cash Reconciliation is already closed
  const handleAddPostCloseAdjustment = (dateStr: string, adjustment: OtherCashEntry) => {
    setDailyReconciliations((prev) => {
      const next = prev.map((r) => {
        if (r.date === dateStr) {
          return {
            ...r,
            adjustments: [...(r.adjustments || []), adjustment],
          };
        }
        return r;
      });
      DB.saveDailyReconciliations(next);
      return next;
    });
  };

  // Handle Expenses
  const handleAddExpense = (expense: Expense) => {
    const next = [expense, ...expenses];
    setExpenses(next);
    DB.saveExpenses(next);
  };

  const handleDeleteExpense = (id: string) => {
    const targetExp = expenses.find((e) => e.id === id);
    if (targetExp) {
      const dStr = getLocalDateStr(targetExp.date);
      const closedRecon = dailyReconciliations.find((r) => r.date === dStr && r.isClosed);
      if (closedRecon) {
        handleAddPostCloseAdjustment(dStr, {
          id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          date: dStr,
          type: 'cash_in',
          amount: targetExp.amount,
          note: `বন্ধ হিসাবের পর খরচ মুছে ফেলায় সমন্বয় (${targetExp.categoryName})`,
          isPostCloseAdjustment: true,
          reconciliationDate: dStr,
          createdAt: new Date().toISOString(),
        });
      }
    }
    const next = expenses.filter((e) => e.id !== id);
    setExpenses(next);
    DB.saveExpenses(next);
  };

  const handleUpdateExpense = (updatedExpense: Expense) => {
    setExpenses((prev) => {
      const next = prev.map((e) => (e.id === updatedExpense.id ? updatedExpense : e));
      DB.saveExpenses(next);
      return next;
    });
  };

  // Handle Wholesale Bulk Purchases / Cash Purchase Receipts
  const handleAddBulkPurchase = (
    purchase: BulkPurchase,
    updatedProducts: Product[],
    supplierDueAddition?: { supplierId: string; dueAmount: number }
  ) => {
    setBulkPurchases((prev) => {
      const nextBulk = [purchase, ...prev];
      DB.saveBulkPurchases(nextBulk);
      return nextBulk;
    });

    // Update inventory products
    setProducts(updatedProducts);
    DB.saveProducts(updatedProducts);

    // If due to supplier, add to supplier ledger
    if (supplierDueAddition && supplierDueAddition.dueAmount > 0) {
      handleAddSupplierDue(
        supplierDueAddition.supplierId,
        supplierDueAddition.dueAmount,
        `ক্রয় রসিদ #${purchase.purchaseNo} থেকে বাকি`
      );
    }
  };

  const handleUpdateBulkPurchase = (
    updatedPurchase: BulkPurchase,
    updatedProducts?: Product[]
  ) => {
    setBulkPurchases((prev) => {
      const nextBulk = prev.map((p) => (p.id === updatedPurchase.id ? updatedPurchase : p));
      DB.saveBulkPurchases(nextBulk);
      return nextBulk;
    });
    if (updatedProducts) {
      setProducts(updatedProducts);
      DB.saveProducts(updatedProducts);
    }
  };

  const handleDeleteBulkPurchase = (id: string) => {
    const targetPurchase = bulkPurchases.find((p) => p.id === id);
    if (targetPurchase) {
      // Restore stock that was added by this bulk purchase
      if (targetPurchase.items && targetPurchase.items.length > 0) {
        setProducts((prevProducts) => {
          let changed = false;
          const nextProducts = prevProducts.map((prod) => {
            const matchedItems = targetPurchase.items.filter(
              (it) =>
                (it.productId && it.productId === prod.id) ||
                it.productName.trim().toLowerCase() === prod.name.trim().toLowerCase()
            );
            if (matchedItems.length > 0) {
              changed = true;
              const qtyToDeduct = matchedItems.reduce(
                (sum, it) => sum + (Number(it.quantity) || 0),
                0
              );
              return {
                ...prod,
                stock: Math.max(0, Math.round(((prod.stock || 0) - qtyToDeduct) * 100) / 100),
              };
            }
            return prod;
          });
          if (changed) {
            DB.saveProducts(nextProducts);
            return nextProducts;
          }
          return prevProducts;
        });
      }

      // If closed day, record post-close adjustment
      const dStr = getLocalDateStr(targetPurchase.date);
      const closedRecon = dailyReconciliations.find((r) => r.date === dStr && r.isClosed);
      const cashPaid = Math.max(
        0,
        targetPurchase.paidAmount !== undefined
          ? targetPurchase.paidAmount
          : targetPurchase.totalAmount - (targetPurchase.dueAmount || 0)
      );
      if (closedRecon && cashPaid > 0) {
        handleAddPostCloseAdjustment(dStr, {
          id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          date: dStr,
          type: 'cash_in',
          amount: cashPaid,
          note: `বন্ধ হিসাবের পর ক্রয় রসিদ #${targetPurchase.purchaseNo} মুছে ফেলায় সমন্বয়`,
          isPostCloseAdjustment: true,
          reconciliationDate: dStr,
          createdAt: new Date().toISOString(),
        });
      }
    }

    setBulkPurchases((prev) => {
      const nextBulk = prev.filter((p) => p.id !== id);
      DB.saveBulkPurchases(nextBulk);
      return nextBulk;
    });
  };

  // Handle Owner Capital & Drawings (মালিকের টাকা জমা ও উত্তোলন)
  const handleAddOwnerTransaction = (tx: OwnerTransaction) => {
    setOwnerTransactions((prev) => {
      const exists = prev.some((t) => t.id === tx.id);
      const next = exists ? prev.map((t) => (t.id === tx.id ? tx : t)) : [tx, ...prev];
      DB.saveOwnerTransactions(next);
      return next;
    });
  };

  const handleDeleteOwnerTransaction = (id: string) => {
    const targetTx = ownerTransactions.find((t) => t.id === id);
    if (targetTx) {
      const dStr = getLocalDateStr(targetTx.date);
      const closedRecon = dailyReconciliations.find((r) => r.date === dStr && r.isClosed);
      if (closedRecon) {
        handleAddPostCloseAdjustment(dStr, {
          id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          date: dStr,
          type: targetTx.type === 'withdrawal' ? 'cash_in' : 'cash_out',
          amount: targetTx.amount,
          note: `বন্ধ হিসাবের পর মালিকের লেনদেন (${targetTx.note || targetTx.type}) মুছে ফেলায় সমন্বয়`,
          isPostCloseAdjustment: true,
          reconciliationDate: dStr,
          createdAt: new Date().toISOString(),
        });
      }
    }
    setOwnerTransactions((prev) => {
      const next = prev.filter((t) => t.id !== id);
      DB.saveOwnerTransactions(next);
      return next;
    });
  };

  // Handle Other Cash Entries & Reconciliations
  const handleAddOtherCashEntry = (entry: OtherCashEntry) => {
    setOtherCashEntries((prev) => {
      const next = [entry, ...prev];
      DB.saveOtherCashEntries(next);
      return next;
    });
  };

  const handleDeleteOtherCashEntry = (id: string) => {
    setOtherCashEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      DB.saveOtherCashEntries(next);
      return next;
    });
  };

  const handleSaveDailyReconciliation = (recon: DailyCashReconciliation) => {
    setDailyReconciliations((prev) => {
      const filtered = prev.filter((r) => r.date !== recon.date);
      const next = [recon, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
      DB.saveDailyReconciliations(next);
      return next;
    });
  };

  const handleSaveMonthlyReconciliation = (mRecon: MonthlyCashReconciliation) => {
    setMonthlyReconciliations((prev) => {
      const filtered = prev.filter((m) => m.yearMonth !== mRecon.yearMonth);
      const next = [mRecon, ...filtered].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
      DB.saveMonthlyReconciliations(next);
      return next;
    });
  };

  const handleSaveInitialOpeningCash = (amount: number) => {
    const clean = Math.max(0, Math.round(amount));
    setInitialOpeningCash(clean);
    DB.saveInitialOpeningCash(clean);
  };

  const handleSaveInitialStoreCapital = (amount: number) => {
    const clean = Math.max(0, Math.round(amount));
    setInitialStoreCapital(clean);
    DB.saveInitialStoreCapital(clean);
  };

  // Handle Data Restored from Backup file
  const handleDataRestored = () => {
    setProfile(DB.getProfile());
    setProducts(DB.getProducts());
    setCustomers(DB.getCustomers());
    setSales(DB.getSales());
    setBakiTransactions(DB.getBakiTransactions());
    setPurchases(DB.getPurchases());
    setSubscription(DB.getSubscription());
    setSuppliers(DB.getSuppliers());
    setSupplierTransactions(DB.getSupplierTransactions());
    setExpenses(DB.getExpenses());
    setBulkPurchases(DB.getBulkPurchases());
    setOwnerTransactions(DB.getOwnerTransactions());
    setOtherCashEntries(DB.getOtherCashEntries());
    setDailyReconciliations(DB.getDailyReconciliations());
    setMonthlyReconciliations(DB.getMonthlyReconciliations());
    setInitialOpeningCash(DB.getInitialOpeningCash());
    setInitialStoreCapital(DB.getInitialStoreCapital());
    setCart([]);
  };

  // Open Subscription Modal
  const handleOpenSubscriptionModal = (plan?: 'monthly' | 'yearly') => {
    if (plan) setPreferredPlan(plan);
    setIsSubscriptionModalOpen(true);
  };

  // Low stock count for badge
  const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;

  return (
    <div className="min-h-screen bg-[#EDF2F7] text-[#102A43] flex flex-col font-sans select-none pb-13 sm:pb-14">
      {/* Top Header */}
      <Header
        profile={profile}
        language={language}
        onLanguageChange={handleLanguageChange}
        onLock={handleLock}
        onOpenLanguageModal={() => setShowLanguageModal(true)}
        subscription={subscription}
        onOpenSubscriptionModal={() => handleOpenSubscriptionModal()}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
      />

      {/* 60-Day Trial / Normal Mode Expiration Warning Banner */}
      <TrialBanner
        subscription={subscription}
        language={language}
        onOpenSubscriptionModal={handleOpenSubscriptionModal}
      />

      {/* Main Active Tab Screen */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'pos' && (
          <PosView
            products={products}
            customers={customers}
            profile={profile}
            language={language}
            onCompleteSale={handleCompleteSale}
            onDeleteSale={handleDeleteSale}
            onAddNewCustomer={handleAddNewCustomer}
            cart={cart}
            setCart={setCart}
            sales={sales}
            appMode={appMode}
            onOpenSubscriptionModal={() => handleOpenSubscriptionModal()}
            initialStoreCapital={initialStoreCapital}
            onSaveInitialStoreCapital={handleSaveInitialStoreCapital}
            expenses={expenses}
            bulkPurchases={bulkPurchases}
            purchases={purchases}
            ownerTransactions={ownerTransactions}
          />
        )}

        {activeTab === 'menu' && activeMenuPage === null && (
          <MenuHubView
            sales={sales}
            bakiTransactions={bakiTransactions}
            purchases={purchases}
            bulkPurchases={bulkPurchases}
            supplierTransactions={supplierTransactions}
            expenses={expenses}
            ownerTransactions={ownerTransactions}
            otherCashEntries={otherCashEntries}
            dailyReconciliations={dailyReconciliations}
            initialOpeningCash={initialOpeningCash}
            onSelectTile={(target) => {
              if (target === 'calculator') {
                setIsCalculatorOpen(true);
              } else {
                setActiveMenuPage(target);
              }
            }}
          />
        )}

        {activeTab === 'menu' && activeMenuPage === 'products' && (
          <ProductManagement
            products={products}
            language={language}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onRecordPurchase={handleRecordPurchase}
            appMode={appMode}
            onOpenSubscriptionModal={() => handleOpenSubscriptionModal()}
            onBackToMenu={() => setActiveMenuPage(null)}
          />
        )}

        {activeTab === 'menu' && (activeMenuPage === 'customersDue' || activeMenuPage === 'suppliersDue') && (
          <BakiKhataView
            customers={customers}
            bakiTransactions={bakiTransactions}
            suppliers={suppliers}
            supplierTransactions={supplierTransactions}
            products={products}
            profile={profile}
            language={language}
            appMode={appMode}
            onOpenSubscriptionModal={() => handleOpenSubscriptionModal()}
            onAddCustomer={handleAddNewCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onReceivePayment={handleReceivePayment}
            onAddDue={handleAddNewDue}
            onDeleteCustomer={handleDeleteCustomer}
            onAddSupplier={handleAddSupplier}
            onPaySupplier={handlePaySupplier}
            onAddSupplierDue={handleAddSupplierDue}
            onSupplierReturn={handleSupplierReturn}
            onUpdateSupplier={handleUpdateSupplier}
            onUpdateSupplierTransaction={handleUpdateSupplierTransaction}
            onDeleteSupplier={handleDeleteSupplier}
            initialSubTab={activeMenuPage === 'suppliersDue' ? 'suppliers' : 'customers'}
            singleSectionMode={true}
            onBackToMenu={() => setActiveMenuPage(null)}
          />
        )}

        {activeTab === 'menu' &&
          (activeMenuPage === 'salesProfit' ||
            activeMenuPage === 'expenses' ||
            activeMenuPage === 'bulkPurchases' ||
            activeMenuPage === 'cashBox' ||
            activeMenuPage === 'ownerCapital') && (
            <ReportsView
              sales={sales}
              purchases={purchases}
              profile={profile}
              language={language}
              appMode={appMode}
              onOpenSubscriptionModal={() => handleOpenSubscriptionModal()}
              expenses={expenses}
              onAddExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
              bulkPurchases={bulkPurchases}
              suppliers={suppliers}
              products={products}
              onAddBulkPurchase={handleAddBulkPurchase}
              onUpdateBulkPurchase={handleUpdateBulkPurchase}
              onDeleteBulkPurchase={handleDeleteBulkPurchase}
              onOpenSupplierKhata={() => setActiveMenuPage('suppliersDue')}
              customers={customers}
              onAddQuickSale={(sale, updatedProds) => handleCompleteSale(sale, updatedProds || products)}
              onUpdateSale={handleUpdateSale}
              onDeleteSale={handleDeleteSale}
              onAddNewCustomer={handleAddNewCustomer}
              bakiTransactions={bakiTransactions}
              supplierTransactions={supplierTransactions}
              ownerTransactions={ownerTransactions}
              onAddOwnerTransaction={handleAddOwnerTransaction}
              onDeleteOwnerTransaction={handleDeleteOwnerTransaction}
              otherCashEntries={otherCashEntries}
              onAddOtherCashEntry={handleAddOtherCashEntry}
              onDeleteOtherCashEntry={handleDeleteOtherCashEntry}
              dailyReconciliations={dailyReconciliations}
              onSaveDailyReconciliation={handleSaveDailyReconciliation}
              onAddPostCloseAdjustment={handleAddPostCloseAdjustment}
              monthlyReconciliations={monthlyReconciliations}
              onSaveMonthlyReconciliation={handleSaveMonthlyReconciliation}
              initialOpeningCash={initialOpeningCash}
              onSaveInitialOpeningCash={handleSaveInitialOpeningCash}
              initialStoreCapital={initialStoreCapital}
              onSaveInitialStoreCapital={handleSaveInitialStoreCapital}
              initialSubTab={
                activeMenuPage === 'expenses'
                  ? 'expenses'
                  : activeMenuPage === 'bulkPurchases'
                  ? 'bulkPurchases'
                  : activeMenuPage === 'cashBox'
                  ? 'cashReconciliation'
                  : activeMenuPage === 'ownerCapital'
                  ? 'ownerCapital'
                  : 'sales'
              }
              onBackToMenu={() => setActiveMenuPage(null)}
            />
          )}

        {activeTab === 'menu' && activeMenuPage === 'allReports' && (
          <AllReportsView
            sales={sales}
            products={products}
            customers={customers}
            suppliers={suppliers}
            expenses={expenses}
            bulkPurchases={bulkPurchases}
            purchases={purchases}
            bakiTransactions={bakiTransactions}
            supplierTransactions={supplierTransactions}
            ownerTransactions={ownerTransactions}
            otherCashEntries={otherCashEntries}
            dailyReconciliations={dailyReconciliations}
            initialOpeningCash={initialOpeningCash}
            profile={profile}
            appMode={appMode}
            onOpenSubscriptionModal={() => handleOpenSubscriptionModal()}
            onBackToMenu={() => setActiveMenuPage(null)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            profile={profile}
            language={language}
            onSaveProfile={handleSaveProfile}
            onLanguageChange={handleLanguageChange}
            onDataRestored={handleDataRestored}
            subscription={subscription}
            onOpenSubscriptionModal={() => handleOpenSubscriptionModal()}
            onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          />
        )}
      </main>

      {/* Calculator Pop-up / Full-Screen Modal */}
      <CalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
      />

      {/* Bottom Navigation (Strictly 3 Tabs) */}
      <Navigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setActiveMenuPage(null);
        }}
        language={language}
        cartItemCount={cart.length}
      />

      {/* Pro Subscription & Payment Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        subscription={subscription}
        profile={profile}
        language={language}
        initialPlan={preferredPlan}
        onSubscriptionUpdated={(newSub) => {
          setSubscription(newSub);
        }}
      />

      {/* Secure Admin Control Panel Modal */}
      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        currentProfile={profile}
        currentSubscription={subscription}
        language={language}
        onSubscriptionUpdated={(newSub) => {
          setSubscription(newSub);
        }}
      />

      {/* First-time Language Choice Modal */}
      {showLanguageModal && (
        <LanguageSelectorModal
          currentLanguage={language}
          onSelectLanguage={handleLanguageChange}
          isInitialSetup={true}
          onClose={() => {
            setShowLanguageModal(false);
            DB.setFirstRunCompleted();
          }}
        />
      )}

      {/* 4-digit PIN Authentication / Registration Modal */}
      {isLocked && !showLanguageModal && (
        <AuthModal
          profile={profile}
          language={language}
          onLanguageChange={handleLanguageChange}
          onSaveProfile={handleSaveProfile}
          onUnlock={handleUnlock}
          isRegistered={profile.isRegistered}
          onDataRestored={handleDataRestored}
        />
      )}

      {/* Remote Admin Block Lock Screen */}
      {blockStatus.isBlocked && !isAdminPanelOpen && (
        <div className="fixed inset-0 z-50 bg-[#102A43]/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border-2 border-[#D32F2F] text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-[#D32F2F] mx-auto flex items-center justify-center text-3xl font-black shadow-inner">
              🚫
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-black text-[#D32F2F]">
                অ্যাকাউন্ট সাময়িকভাবে ব্লক করা হয়েছে
              </h2>
              <p className="text-xs font-bold text-[#102A43]">
                দোকান: {profile.shopName || 'সহজ দোকান'} ({profile.phone})
              </p>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#D32F2F]">
                {blockStatus.reason ||
                  'অ্যাডমিন কর্তৃক আপনার অ্যাপ ব্যবহারের অনুমতি সাময়িকভাবে বন্ধ রাখা হয়েছে।'}
              </div>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              আপনার অ্যাকাউন্টটি পুনরায় চালু (আনব্লক) করতে নিচের বাটনে চাপ দিয়ে সরাসরি অ্যাডমিনের সাথে যোগাযোগ করুন।
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const msg = `আসসালামু আলাইকুম অ্যাডমিন, আমার সহজ দোকান অ্যাপটি (${profile.shopName}, নম্বর: ${profile.phone}) ব্লক দেখাচ্ছে। দয়া করে আনব্লক করে দিন।`;
                  const url = `https://api.whatsapp.com/send?phone=8801733414031&text=${encodeURIComponent(msg)}`;
                  if (typeof window !== 'undefined' && (window as any).AndroidApp?.openWhatsApp) {
                    (window as any).AndroidApp.openWhatsApp(url);
                  } else {
                    window.open(url, '_blank');
                  }
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[#2E7D32] hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-95 cursor-pointer"
              >
                💬 হোয়াটসঅ্যাপে অ্যাডমিনের সাথে যোগাযোগ করুন (01733414031)
              </button>

              <button
                type="button"
                disabled={isCheckingBlock}
                onClick={async () => {
                  setIsCheckingBlock(true);
                  try {
                    const st = await CloudSync.checkUserBlockStatus(profile.phone);
                    setBlockStatus(st);
                  } finally {
                    setIsCheckingBlock(false);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#E0F2F1] text-[#0E6B6B] hover:bg-[#0E6B6B] hover:text-white font-bold text-xs transition active:scale-95 cursor-pointer"
              >
                {isCheckingBlock ? 'চেক করা হচ্ছে...' : '🔄 আনব্লক হয়েছে কি না পুনরায় চেক করুন'}
              </button>

              <button
                type="button"
                onClick={() => setIsAdminPanelOpen(true)}
                className="text-[11px] font-bold text-slate-400 hover:text-[#0E6B6B] underline pt-1"
              >
                অ্যাডমিন প্যানেল লগইন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Double-Tap Back to Exit Toast Notification */}
      {exitToastVisible && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[100] pointer-events-none px-4 py-2 rounded-full bg-[#102A43]/95 text-white text-xs font-extrabold shadow-lg border border-white/15 whitespace-nowrap">
          অ্যাপ থেকে বের হতে পুনরায় ব্যাক বাটন চাপুন
        </div>
      )}
    </div>
  );
}
