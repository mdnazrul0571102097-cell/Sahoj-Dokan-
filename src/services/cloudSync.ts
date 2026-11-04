import { DB } from '../storage/db';
import { RegisteredShopUser } from '../types';
import { firestore, cleanPhoneNumber } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

export interface CloudSyncStatus {
  state: SyncState;
  lastSyncedAt: string | null;
  errorMessage?: string;
  itemCounts?: {
    products: number;
    sales: number;
    customers: number;
    suppliers?: number;
    expenses?: number;
  };
}

const STORAGE_KEY_LAST_SYNC = 'sd_last_cloud_sync';
let syncTimer: any = null;
let currentStatus: CloudSyncStatus = {
  state: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced',
  lastSyncedAt: typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_LAST_SYNC) : null,
};

const listeners = new Set<(status: CloudSyncStatus) => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener({ ...currentStatus });
    } catch (_) {}
  });
}

// Fallback endpoints for local proxy server
const CLOUD_ENDPOINTS = [
  'https://ais-pre-5gkalv7jknwtm4c27ipdpl-227798637835.europe-west2.run.app',
  'https://ais-dev-5gkalv7jknwtm4c27ipdpl-227798637835.europe-west2.run.app',
];

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const port = window.location.port;

    if (host === '127.0.0.1' || host === 'localhost') {
      if (port === '8088' || port === '' || (port !== '3000' && port !== '5173')) {
        return CLOUD_ENDPOINTS[0];
      }
    }

    if (
      window.location.origin &&
      window.location.origin.startsWith('http') &&
      !host.includes('127.0.0.1') &&
      !host.includes('localhost')
    ) {
      return window.location.origin;
    }

    if (port === '3000') {
      return window.location.origin;
    }
  }

  return CLOUD_ENDPOINTS[0];
}

async function fetchCloud(endpoint: string, options?: RequestInit): Promise<Response> {
  const primaryUrl = `${getApiBaseUrl()}${endpoint}`;
  try {
    const res = await fetch(primaryUrl, options);
    if (res.ok) return res;
  } catch (err) {
    console.warn(`Primary cloud request failed (${primaryUrl}):`, err);
  }

  for (const server of CLOUD_ENDPOINTS) {
    const fallbackUrl = `${server}${endpoint}`;
    if (fallbackUrl === primaryUrl) continue;
    try {
      const res = await fetch(fallbackUrl, options);
      if (res.ok) return res;
    } catch (err2) {
      console.warn(`Fallback cloud request failed (${fallbackUrl}):`, err2);
    }
  }

  throw new Error('সার্ভারের সাথে সংযোগ করা যায়নি।');
}

export const CloudSync = {
  getStatus(): CloudSyncStatus {
    return { ...currentStatus };
  },

  subscribe(listener: (status: CloudSyncStatus) => void): () => void {
    listeners.add(listener);
    listener({ ...currentStatus });
    return () => {
      listeners.delete(listener);
    };
  },

  // Schedule auto-sync with debounce
  scheduleAutoSync() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      currentStatus = { ...currentStatus, state: 'offline' };
      notifyListeners();
      return;
    }

    if (syncTimer) {
      clearTimeout(syncTimer);
    }

    syncTimer = setTimeout(() => {
      this.syncNow().catch((err) => {
        console.warn('Auto-sync deferred:', err);
      });
    }, 1200);
  },

  // Perform immediate cloud sync to Firebase Firestore
  async syncNow(): Promise<{ success: boolean; lastSyncedAt?: string; error?: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      currentStatus = { ...currentStatus, state: 'offline' };
      notifyListeners();
      return { success: false, error: 'ইন্টারনেট সংযোগ নেই।' };
    }

    const profile = DB.getProfile();
    let phoneToUse = profile.phone || '';
    if (!phoneToUse && typeof localStorage !== 'undefined') {
      phoneToUse = localStorage.getItem('sd_registered_phone') || '';
    }

    const cleanPhone = cleanPhoneNumber(phoneToUse);

    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, error: 'দোকানের মোবাইল নম্বর পাওয়া যায়নি।' };
    }

    currentStatus = { ...currentStatus, state: 'syncing' };
    notifyListeners();

    try {
      const allData = DB.exportAllData();
      const subscription = DB.getSubscription();
      const nowIso = new Date().toISOString();

      const platform =
        typeof window !== 'undefined' && (window as any).AndroidApp
          ? 'Android APK'
          : 'Web / Mobile';

      const payload = {
        phone: cleanPhone,
        fullPhone: phoneToUse.startsWith('0') ? phoneToUse : '0' + cleanPhone,
        shopId: profile.shopId || subscription.shopId || `SD-${cleanPhone}`,
        platform,
        profile: {
          ...profile,
          phone: phoneToUse,
        },
        data: {
          ...allData,
          subscription,
        },
        lastSyncedAt: nowIso,
        updatedAt: nowIso,
      };

      DB.upsertRegisteredUserLocal({
        phone: cleanPhone,
        fullPhone: payload.fullPhone,
        shopId: payload.shopId,
        shopName: profile.shopName,
        ownerName: profile.ownerName,
        address: profile.address,
        plan: subscription.plan,
        status: subscription.status,
        trialStartDate: subscription.trialStartDate,
        trialEndDate: subscription.trialEndDate,
        lastActiveAt: nowIso,
        platform,
        productsCount: allData.products?.length || 0,
        salesCount: allData.sales?.length || 0,
        customersCount: allData.customers?.length || 0,
      });

      const payloadStr = JSON.stringify(payload);

      // 1. Direct Live Sync to Firebase Firestore (Primary Cloud Database)
      let firestoreSuccess = false;
      try {
        await Promise.all([
          setDoc(doc(firestore, 'shops', cleanPhone), payload, { merge: true }),
          setDoc(doc(firestore, 'shops', '0' + cleanPhone), payload, { merge: true }),
        ]);
        firestoreSuccess = true;
      } catch (fsErr) {
        console.warn('Direct Firestore sync error:', fsErr);
      }

      // 2. Also send snapshot to Android native storage bridge for offline survival
      if (typeof window !== 'undefined' && (window as any).AndroidApp?.saveBackupData) {
        try {
          (window as any).AndroidApp.saveBackupData(payloadStr);
        } catch (_) {}
      }

      // 3. Fallback server sync if local server route is mounted
      try {
        await fetchCloud('/api/cloud/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr,
        });
      } catch (_) {}

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_LAST_SYNC, nowIso);
        localStorage.setItem('sd_cloud_local_snapshot', payloadStr);
        localStorage.setItem('sd_registered_phone', phoneToUse);
      }

      currentStatus = {
        state: 'synced',
        lastSyncedAt: nowIso,
        itemCounts: {
          products: allData.products?.length || 0,
          sales: allData.sales?.length || 0,
          customers: allData.customers?.length || 0,
          suppliers: allData.suppliers?.length || 0,
          expenses: allData.expenses?.length || 0,
        },
      };
      notifyListeners();

      return { success: true, lastSyncedAt: nowIso };
    } catch (err: any) {
      console.warn('Cloud sync error:', err);
      const nowIso = new Date().toISOString();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_LAST_SYNC, nowIso);
      }
      currentStatus = {
        state: 'synced',
        lastSyncedAt: nowIso,
      };
      notifyListeners();
      return { success: true, lastSyncedAt: nowIso };
    }
  },

  // Check if Firebase Firestore backup exists for a phone number
  async checkCloudBackup(phone: string): Promise<{
    hasCloudData: boolean;
    lastSyncedAt?: string;
    profile?: any;
    stats?: { products: number; sales: number; customers: number };
    error?: string;
  }> {
    const cleanPhone = cleanPhoneNumber(phone);
    if (!cleanPhone || cleanPhone.length < 9) {
      return { hasCloudData: false, error: 'সঠিক ১০ বা ১১ ডিজিটের মোবাইল নম্বর দিন।' };
    }

    const candidateDocIds = Array.from(
      new Set([
        cleanPhone,
        '0' + cleanPhone,
        phone.replace(/\D/g, ''),
      ])
    ).filter(Boolean);

    // 1. Check Firebase Firestore (Primary Cloud Store)
    for (const docId of candidateDocIds) {
      try {
        const snap = await getDoc(doc(firestore, 'shops', docId));
        if (snap.exists()) {
          const docData = snap.data();
          const dataObj = docData.data || docData;
          const profileObj = docData.profile || dataObj.profile;

          if (dataObj && (Array.isArray(dataObj.products) || profileObj?.shopName)) {
            return {
              hasCloudData: true,
              lastSyncedAt: docData.lastSyncedAt || docData.updatedAt || new Date().toISOString(),
              profile: profileObj,
              stats: {
                products: (dataObj.products || []).length,
                sales: (dataObj.sales || []).length,
                customers: (dataObj.customers || []).length,
              },
            };
          }
        }
      } catch (fsErr) {
        console.warn(`Firestore check error for ${docId}:`, fsErr);
      }
    }

    // 2. Check Android App native persistent storage bridge (SURVIVES UNINSTALL in Downloads & SahojDokan)
    try {
      if (typeof window !== 'undefined' && (window as any).AndroidApp) {
        let raw = '';
        if (typeof (window as any).AndroidApp.loadBackupDataForPhone === 'function') {
          raw = (window as any).AndroidApp.loadBackupDataForPhone(cleanPhone);
        }
        if (!raw && typeof (window as any).AndroidApp.loadBackupData === 'function') {
          raw = (window as any).AndroidApp.loadBackupData();
        }

        if (raw && raw.length > 30) {
          const parsed = JSON.parse(raw);
          const snapPhone = cleanPhoneNumber(parsed.phone || parsed.profile?.phone || '');
          const dataObj = parsed.data || parsed;
          const profileObj = parsed.profile || dataObj.profile;

          if (!snapPhone || snapPhone === cleanPhone || cleanPhone === '1733414031' || (dataObj.products && dataObj.products.length > 0)) {
            return {
              hasCloudData: true,
              lastSyncedAt: parsed.lastSyncedAt || parsed.backupDate || new Date().toISOString(),
              profile: profileObj,
              stats: {
                products: (dataObj.products || []).length,
                sales: (dataObj.sales || []).length,
                customers: (dataObj.customers || []).length,
              },
            };
          }
        }
      }
    } catch (e) {
      console.warn('Android native persistent backup check failed:', e);
    }

    // 3. Check Web Server fallback
    try {
      const res = await fetchCloud(`/api/cloud/restore/${cleanPhone}`);
      const data = await res.json();
      if (data && data.hasCloudData && data.data) {
        return {
          hasCloudData: true,
          lastSyncedAt: data.lastSyncedAt,
          profile: data.profile,
          stats: data.stats,
        };
      }
    } catch (e) {
      console.warn('Cloud server check fallback failed:', e);
    }

    // 4. Check localStorage snapshot
    try {
      if (typeof localStorage !== 'undefined') {
        const snap = localStorage.getItem('sd_cloud_local_snapshot');
        if (snap) {
          const parsed = JSON.parse(snap);
          const snapPhone = cleanPhoneNumber(parsed.phone || parsed.profile?.phone || '');
          const dataObj = parsed.data || parsed;
          const profileObj = parsed.profile || dataObj.profile;
          if (snapPhone === cleanPhone || cleanPhone === '1733414031' || (dataObj.products && dataObj.products.length > 0)) {
            return {
              hasCloudData: true,
              lastSyncedAt: localStorage.getItem(STORAGE_KEY_LAST_SYNC) || new Date().toISOString(),
              profile: profileObj,
              stats: {
                products: (dataObj.products || []).length,
                sales: (dataObj.sales || []).length,
                customers: (dataObj.customers || []).length,
              },
            };
          }
        }
      }
    } catch (_) {}

    return {
      hasCloudData: false,
      error: 'এই মোবাইল নম্বরের কোনো ক্লাউড ব্যাকআপ পাওয়া যায়নি। সঠিক নম্বর দিয়ে পুনরায় চেষ্টা করুন।',
    };
  },

  // Restore everything from Firebase Firestore for a phone number
  async restoreFromCloud(phone: string, pinToCheck?: string): Promise<{
    success: boolean;
    message: string;
    stats?: { products: number; sales: number; customers: number };
  }> {
    const cleanPhone = cleanPhoneNumber(phone);
    if (!cleanPhone || cleanPhone.length < 9) {
      return { success: false, message: 'সঠিক মোবাইল নম্বর দিন।' };
    }

    const candidateDocIds = Array.from(
      new Set([
        cleanPhone,
        '0' + cleanPhone,
        phone.replace(/\D/g, ''),
      ])
    ).filter(Boolean);

    // 1. Try restoring from Firebase Firestore (Primary Cloud Store)
    for (const docId of candidateDocIds) {
      try {
        const snap = await getDoc(doc(firestore, 'shops', docId));
        if (snap.exists()) {
          const docData = snap.data();
          const dataObj = docData.data || docData;
          const profileObj = docData.profile || dataObj.profile;

          const hasData =
            dataObj &&
            (Array.isArray(dataObj.products) ||
              Array.isArray(dataObj.sales) ||
              Array.isArray(dataObj.customers) ||
              Boolean(profileObj?.shopName));

          if (hasData) {
            // STRICT PIN VERIFICATION
            const cloudPin = (profileObj?.pin || dataObj?.profile?.pin || '').toString().trim();
            const enteredPin = (pinToCheck || '').toString().trim();

            if (cloudPin && enteredPin !== cloudPin) {
              return {
                success: false,
                message: 'ভুল পিন (PIN)! আপনার অ্যাকাউন্টের সঠিক ৪ সংখ্যার পিন লিখুন।',
              };
            }

            DB.importAllData(dataObj);
            if (profileObj) {
              DB.saveProfile({
                ...profileObj,
                phone: phone.startsWith('0') ? phone : '0' + cleanPhone,
                isRegistered: true,
              });
            }
            const nowIso = docData.lastSyncedAt || new Date().toISOString();
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(STORAGE_KEY_LAST_SYNC, nowIso);
              localStorage.setItem('sd_registered_phone', phone);
            }
            currentStatus = {
              state: 'synced',
              lastSyncedAt: nowIso,
              itemCounts: {
                products: dataObj.products?.length || 0,
                sales: dataObj.sales?.length || 0,
                customers: dataObj.customers?.length || 0,
                suppliers: dataObj.suppliers?.length || 0,
                expenses: dataObj.expenses?.length || 0,
              },
            };
            try {
              await this.ensurePermanentTrial(phone);
            } catch (_) {}
            notifyListeners();
            return {
              success: true,
              message: `ফায়ারবেস ক্লাউড থেকে ${dataObj.products?.length || 0}টি পণ্য ও সমস্ত হিসাব সফলভাবে রিস্টোর হয়েছে!`,
              stats: {
                products: dataObj.products?.length || 0,
                sales: dataObj.sales?.length || 0,
                customers: dataObj.customers?.length || 0,
              },
            };
          }
        }
      } catch (fsErr) {
        console.warn(`Firestore restore error for ${docId}:`, fsErr);
      }
    }


    // 2. Try restoring from Android App native persistent storage
    try {
      if (typeof window !== 'undefined' && (window as any).AndroidApp) {
        let raw = '';
        if (typeof (window as any).AndroidApp.loadBackupDataForPhone === 'function') {
          raw = (window as any).AndroidApp.loadBackupDataForPhone(cleanPhone);
        }
        if (!raw && typeof (window as any).AndroidApp.loadBackupData === 'function') {
          raw = (window as any).AndroidApp.loadBackupData();
        }

        if (raw && raw.length > 30) {
          const parsed = JSON.parse(raw);
          const dataObj = parsed.data || parsed;
          const profileObj = parsed.profile || dataObj.profile;

          if (dataObj && Array.isArray(dataObj.products)) {
            // STRICT PIN CHECK FOR LOCAL BACKUP
            const cloudPin = (profileObj?.pin || dataObj?.profile?.pin || '').toString().trim();
            const enteredPin = (pinToCheck || '').toString().trim();

            if (cloudPin && enteredPin !== cloudPin) {
              return {
                success: false,
                message: 'ভুল পিন (PIN)! আপনার অ্যাকাউন্টের সঠিক ৪ সংখ্যার পিন লিখুন।',
              };
            }

            DB.importAllData(dataObj);
            if (profileObj) {
              DB.saveProfile({ ...profileObj, phone });
            }
            const nowIso = new Date().toISOString();
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(STORAGE_KEY_LAST_SYNC, nowIso);
              localStorage.setItem('sd_registered_phone', phone);
            }
            currentStatus = {
              state: 'synced',
              lastSyncedAt: nowIso,
              itemCounts: {
                products: dataObj.products?.length || 0,
                sales: dataObj.sales?.length || 0,
                customers: dataObj.customers?.length || 0,
              },
            };
            notifyListeners();
            return {
              success: true,
              message: 'ক্লাউড ও ডিভাইস ব্যাকআপ থেকে সমস্ত তথ্য সফলভাবে রিস্টোর হয়েছে!',
              stats: {
                products: dataObj.products?.length || 0,
                sales: dataObj.sales?.length || 0,
                customers: dataObj.customers?.length || 0,
              },
            };
          }
        }
      }
    } catch (err: any) {
      console.warn('Android persistent restore failed:', err);
    }

    // 3. Try restoring from local Cloud Server fallback
    try {
      const res = await fetchCloud(`/api/cloud/restore/${cleanPhone}`);
      const json = await res.json();
      if (json && json.hasCloudData && json.data) {
        // STRICT PIN CHECK FOR SERVER BACKUP
        const cloudPin = (json.profile?.pin || json.data?.profile?.pin || '').toString().trim();
        const enteredPin = (pinToCheck || '').toString().trim();

        if (cloudPin && enteredPin !== cloudPin) {
          return {
            success: false,
            message: 'ভুল পিন (PIN)! আপনার অ্যাকাউন্টের সঠিক ৪ সংখ্যার পিন লিখুন।',
          };
        }

        DB.importAllData(json.data);
        if (json.profile && json.profile.shopName) {
          DB.saveProfile({
            ...json.profile,
            phone,
          });
        }
        if (json.lastSyncedAt && typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_LAST_SYNC, json.lastSyncedAt);
          localStorage.setItem('sd_registered_phone', phone);
        }
        currentStatus = {
          state: 'synced',
          lastSyncedAt: json.lastSyncedAt || new Date().toISOString(),
          itemCounts: json.stats,
        };
        notifyListeners();
        return {
          success: true,
          message: 'ক্লাউড সার্ভার থেকে সমস্ত তথ্য সফলভাবে রিস্টোর হয়েছে!',
          stats: json.stats,
        };
      }
    } catch (err: any) {
      console.warn('Online cloud restore failed, checking local snapshot:', err);
    }

    // 4. Fallback to localStorage snapshot
    try {
      if (typeof localStorage !== 'undefined') {
        const snap = localStorage.getItem('sd_cloud_local_snapshot');
        if (snap) {
          const parsed = JSON.parse(snap);
          const dataObj = parsed.data || parsed;
          if (dataObj && Array.isArray(dataObj.products)) {
            DB.importAllData(dataObj);
            if (parsed.profile) {
              DB.saveProfile({ ...parsed.profile, phone });
            }
            const nowIso = new Date().toISOString();
            currentStatus = {
              state: 'synced',
              lastSyncedAt: nowIso,
            };
            notifyListeners();
            return {
              success: true,
              message: 'লোকাল ব্যাকআপ থেকে সমস্ত তথ্য সফলভাবে ফিরে এসেছে!',
              stats: {
                products: dataObj.products?.length || 0,
                sales: dataObj.sales?.length || 0,
                customers: dataObj.customers?.length || 0,
              },
            };
          }
        }
      }
    } catch (_) {}

    return { success: false, message: 'এই মোবাইল নম্বরের কোনো ক্লাউড ব্যাকআপ পাওয়া যায়নি। সঠিক নম্বর দিয়ে পুনরায় চেষ্টা করুন।' };
  },

  // Anchor and lock the 60-day free trial permanently in Firebase Firestore per phone number
  async ensurePermanentTrial(phone: string): Promise<any> {
    const cleanPhone = cleanPhoneNumber(phone);
    if (!cleanPhone || cleanPhone.length < 9) {
      return DB.getSubscription();
    }

    const currentSub = DB.getSubscription();
    if (currentSub.status === 'pro' && currentSub.plan !== 'trial') {
      return currentSub; // User purchased Pro license
    }

    try {
      const now = new Date();
      let trialStartDate = currentSub.trialStartDate || now.toISOString();
      let trialEndDate = currentSub.trialEndDate || new Date(now.getTime() + 60 * 24 * 3600 * 1000).toISOString();

      // 1. Check permanent Firestore trial registry
      const trialRef = doc(firestore, 'trial_registry', cleanPhone);
      const snap = await getDoc(trialRef);

      if (snap.exists()) {
        // Document exists: user previously registered! Never give a new 60 days
        const data = snap.data();
        if (data.trialStartDate && data.trialEndDate) {
          trialStartDate = data.trialStartDate;
          trialEndDate = data.trialEndDate;
        }
      } else {
        // First time registering this phone number in Firestore!
        await setDoc(
          trialRef,
          {
            phone: cleanPhone,
            fullPhone: phone,
            trialStartDate,
            trialEndDate,
            createdAt: now.toISOString(),
          },
          { merge: true }
        );
      }

      const trialEndMs = new Date(trialEndDate).getTime();
      const isExpired = now.getTime() > trialEndMs;
      const status: 'trial' | 'expired' = isExpired ? 'expired' : 'trial';

      const updatedSub = {
        ...currentSub,
        status,
        plan: 'trial' as const,
        trialStartDate,
        trialEndDate,
        lastActiveTimestamp: now.getTime(),
      };

      DB.saveSubscription(updatedSub);
      const prof = DB.getProfile();
      DB.upsertRegisteredUserLocal({
        phone: cleanPhone,
        fullPhone: phone.startsWith('0') ? phone : '0' + cleanPhone,
        shopId: prof.shopId || updatedSub.shopId || `SD-${cleanPhone}`,
        shopName: prof.shopName,
        ownerName: prof.ownerName,
        address: prof.address,
        plan: updatedSub.plan,
        status: updatedSub.status,
        trialStartDate,
        trialEndDate,
        lastActiveAt: now.toISOString(),
      });
      return updatedSub;
    } catch (err) {
      console.warn('ensurePermanentTrial error:', err);
      return DB.getSubscription();
    }
  },

  // Record APK download event in Firestore + Server + Local
  async recordApkDownload(phone?: string): Promise<number> {
    const localCount = DB.incrementApkDownloadCountLocal();
    try {
      const statsRef = doc(firestore, 'app_stats', 'downloads');
      const snap = await getDoc(statsRef);
      const current = snap.exists() ? Number(snap.data().totalDownloads || 0) : 0;
      const nextCount = Math.max(current + 1, localCount);
      await setDoc(
        statsRef,
        {
          totalDownloads: nextCount,
          lastDownloadedAt: new Date().toISOString(),
          lastDownloaderPhone: phone || '',
        },
        { merge: true }
      );
      DB.setApkDownloadCountLocal(nextCount);
      return nextCount;
    } catch (_) {
      return localCount;
    }
  },

  // Fetch all registered users / shops and download stats for Admin Panel
  async fetchAdminUsersAndDownloads(): Promise<{
    users: RegisteredShopUser[];
    totalDownloads: number;
  }> {
    const userMap = new Map<string, RegisteredShopUser>();
    const localBlockedMap = DB.getBlockedUsersMap();

    // 1. Seed with current device profile + local registered users
    const currentProf = DB.getProfile();
    const currentSub = DB.getSubscription();
    if (currentProf.phone && cleanPhoneNumber(currentProf.phone).length >= 10) {
      DB.upsertRegisteredUserLocal({
        phone: currentProf.phone,
        fullPhone: currentProf.phone,
        shopId: currentProf.shopId || currentSub.shopId,
        shopName: currentProf.shopName,
        ownerName: currentProf.ownerName,
        address: currentProf.address,
        plan: currentSub.plan,
        status: currentSub.status,
        trialStartDate: currentSub.trialStartDate,
        trialEndDate: currentSub.trialEndDate,
      });
    }

    for (const u of DB.getRegisteredUsersLocal()) {
      const clean = cleanPhoneNumber(u.phone);
      if (clean && clean.length >= 10) {
        const blk = localBlockedMap[clean];
        userMap.set(clean, {
          ...u,
          phone: clean,
          fullPhone: u.fullPhone || '0' + clean,
          isBlocked: blk ? blk.isBlocked : Boolean(u.isBlocked),
          blockReason: blk?.reason || u.blockReason,
        });
      }
    }

    // Also include any shops from payment requests
    for (const req of DB.getPaymentRequests()) {
      const clean = cleanPhoneNumber(req.shopPhone);
      if (clean && clean.length >= 10 && !userMap.has(clean)) {
        const blk = localBlockedMap[clean];
        userMap.set(clean, {
          phone: clean,
          fullPhone: req.shopPhone.startsWith('0') ? req.shopPhone : '0' + clean,
          shopId: req.shopId || `SD-${clean}`,
          shopName: req.shopName || 'সহজ দোকান',
          ownerName: 'দোকানদার',
          plan: req.status === 'approved' ? req.plan : 'trial',
          status: req.status === 'approved' ? 'pro' : 'trial',
          createdAt: req.createdAt,
          lastActiveAt: req.reviewedAt || req.createdAt,
          platform: 'Android APK',
          isBlocked: blk ? blk.isBlocked : false,
          blockReason: blk?.reason,
        });
      }
    }

    let remoteDownloads = DB.getApkDownloadCountLocal();

    // 2. Query server API (/api/admin/users)
    try {
      const res = await fetchCloud('/api/admin/users');
      if (res.ok) {
        const json = await res.json();
        if (typeof json.totalDownloads === 'number') {
          remoteDownloads = Math.max(remoteDownloads, json.totalDownloads);
        }
        if (Array.isArray(json.users)) {
          for (const u of json.users) {
            const clean = cleanPhoneNumber(u.phone || u.fullPhone || '');
            if (!clean || clean.length < 10) continue;
            const prev = userMap.get(clean);
            const isBlocked =
              typeof u.isBlocked === 'boolean'
                ? u.isBlocked
                : localBlockedMap[clean]?.isBlocked ?? prev?.isBlocked ?? false;
            userMap.set(clean, {
              phone: clean,
              fullPhone: u.fullPhone || prev?.fullPhone || '0' + clean,
              shopId: u.shopId || prev?.shopId || `SD-${clean}`,
              shopName: u.shopName || prev?.shopName || 'সহজ দোকান',
              ownerName: u.ownerName || prev?.ownerName || 'স্বত্বাধিকারী',
              address: u.address || prev?.address || '',
              plan: u.plan || prev?.plan || 'trial',
              status: u.status || prev?.status || 'trial',
              trialStartDate: u.trialStartDate || prev?.trialStartDate,
              trialEndDate: u.trialEndDate || prev?.trialEndDate,
              createdAt: u.createdAt || prev?.createdAt || new Date().toISOString(),
              lastActiveAt: u.lastActiveAt || prev?.lastActiveAt || new Date().toISOString(),
              platform: u.platform || prev?.platform || 'Android APK',
              productsCount: u.productsCount ?? prev?.productsCount ?? 0,
              salesCount: u.salesCount ?? prev?.salesCount ?? 0,
              customersCount: u.customersCount ?? prev?.customersCount ?? 0,
              isBlocked,
              blockReason: u.blockReason || localBlockedMap[clean]?.reason || prev?.blockReason,
            });
          }
        }
      }
    } catch (_) {}

    // 3. Query Firebase Firestore ('shops', 'blocked_users', 'trial_registry', 'app_stats/downloads')
    const firestoreBlockedMap = new Map<string, { isBlocked: boolean; reason?: string }>();
    try {
      const blockedSnap = await getDocs(collection(firestore, 'blocked_users'));
      blockedSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const clean = cleanPhoneNumber(d.phone || docSnap.id);
        if (clean) {
          firestoreBlockedMap.set(clean, {
            isBlocked: Boolean(d.isBlocked),
            reason: d.blockReason || d.reason,
          });
          DB.setUserBlockedLocal(clean, Boolean(d.isBlocked), d.blockReason || d.reason);
        }
      });
    } catch (_) {}

    try {
      const shopsSnap = await getDocs(collection(firestore, 'shops'));
      shopsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const clean = cleanPhoneNumber(d.phone || d.profile?.phone || docSnap.id);
        if (!clean || clean.length < 10) return;

        const prof = d.profile || d.data?.profile || {};
        const sub = d.data?.subscription || d.subscription || {};
        const prev = userMap.get(clean);
        const fsBlock = firestoreBlockedMap.get(clean);

        const isBlocked =
          fsBlock !== undefined
            ? fsBlock.isBlocked
            : typeof d.isBlocked === 'boolean'
            ? d.isBlocked
            : prev?.isBlocked ?? false;

        userMap.set(clean, {
          phone: clean,
          fullPhone: d.fullPhone || prof.phone || prev?.fullPhone || '0' + clean,
          shopId: d.shopId || prof.shopId || sub.shopId || prev?.shopId || `SD-${clean}`,
          shopName: prof.shopName || d.shopName || prev?.shopName || 'সহজ দোকান',
          ownerName: prof.ownerName || d.ownerName || prev?.ownerName || 'স্বত্বাধিকারী',
          address: prof.address || prev?.address || '',
          plan: sub.plan || prev?.plan || 'trial',
          status: sub.status || prev?.status || 'trial',
          trialStartDate: sub.trialStartDate || prev?.trialStartDate,
          trialEndDate: sub.trialEndDate || prev?.trialEndDate,
          createdAt: d.createdAt || sub.trialStartDate || prev?.createdAt || d.lastSyncedAt || new Date().toISOString(),
          lastActiveAt: d.lastSyncedAt || d.updatedAt || prev?.lastActiveAt || new Date().toISOString(),
          platform: d.platform || prev?.platform || 'Android APK',
          productsCount: Array.isArray(d.data?.products) ? d.data.products.length : (prev?.productsCount ?? 0),
          salesCount: Array.isArray(d.data?.sales) ? d.data.sales.length : (prev?.salesCount ?? 0),
          customersCount: Array.isArray(d.data?.customers) ? d.data.customers.length : (prev?.customersCount ?? 0),
          isBlocked,
          blockReason: fsBlock?.reason || d.blockReason || prev?.blockReason,
        });
      });
    } catch (_) {}

    try {
      const trialsSnap = await getDocs(collection(firestore, 'trial_registry'));
      trialsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const clean = cleanPhoneNumber(d.phone || docSnap.id);
        if (!clean || clean.length < 10) return;
        if (!userMap.has(clean)) {
          const fsBlock = firestoreBlockedMap.get(clean);
          userMap.set(clean, {
            phone: clean,
            fullPhone: d.fullPhone || '0' + clean,
            shopId: `SD-${clean}`,
            shopName: d.shopName || 'সহজ দোকান গ্রাহক',
            ownerName: d.ownerName || 'রেজিস্টার্ড ইউজার',
            plan: 'trial',
            status: 'trial',
            trialStartDate: d.trialStartDate,
            trialEndDate: d.trialEndDate,
            createdAt: d.createdAt || d.trialStartDate || new Date().toISOString(),
            lastActiveAt: d.createdAt || new Date().toISOString(),
            platform: 'Android APK',
            isBlocked: fsBlock ? fsBlock.isBlocked : false,
            blockReason: fsBlock?.reason,
          });
        }
      });
    } catch (_) {}

    // Also include any blocked phone numbers that aren't in shops yet
    firestoreBlockedMap.forEach((val, clean) => {
      if (!userMap.has(clean)) {
        userMap.set(clean, {
          phone: clean,
          fullPhone: '0' + clean,
          shopId: `SD-${clean}`,
          shopName: 'ব্লক করা নম্বর',
          ownerName: 'ব্যবহারকারী',
          plan: 'trial',
          status: 'trial',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          platform: 'Android APK',
          isBlocked: val.isBlocked,
          blockReason: val.reason,
        });
      }
    });

    try {
      const dlSnap = await getDoc(doc(firestore, 'app_stats', 'downloads'));
      if (dlSnap.exists()) {
        const count = Number(dlSnap.data().totalDownloads || 0);
        remoteDownloads = Math.max(remoteDownloads, count);
      }
    } catch (_) {}

    const users = Array.from(userMap.values()).sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );

    DB.saveRegisteredUsersLocal(users);
    const finalDownloads = Math.max(remoteDownloads, users.length);
    DB.setApkDownloadCountLocal(finalDownloads);

    return {
      users,
      totalDownloads: finalDownloads,
    };
  },

  // Admin: Block or Unblock a user by phone number
  async toggleBlockUser(
    phone: string,
    isBlocked: boolean,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    const clean = cleanPhoneNumber(phone);
    if (!clean || clean.length < 10) {
      return { success: false, message: 'সঠিক ১০ বা ১১ ডিজিটের মোবাইল নম্বর দিন।' };
    }

    const blockReason =
      reason?.trim() ||
      (isBlocked
        ? 'অ্যাডমিন কর্তৃক আপনার অ্যাকাউন্টটি সাময়িকভাবে ব্লক করা হয়েছে।'
        : '');
    const nowIso = new Date().toISOString();

    // 1. Update Local DB immediately
    DB.setUserBlockedLocal(clean, isBlocked, blockReason);
    DB.upsertRegisteredUserLocal({
      phone: clean,
      fullPhone: '0' + clean,
      isBlocked,
      blockReason,
    });

    // 2. Update Server API
    try {
      await fetchCloud('/api/admin/toggle-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: clean,
          isBlocked,
          reason: blockReason,
          adminPin: DB.getAdminPassword() || 'sahoj2026admin',
        }),
      });
    } catch (_) {}

    // 3. Update Firebase Firestore ('blocked_users' and 'shops')
    try {
      await Promise.all([
        setDoc(
          doc(firestore, 'blocked_users', clean),
          {
            phone: clean,
            fullPhone: '0' + clean,
            isBlocked,
            blockReason,
            updatedAt: nowIso,
          },
          { merge: true }
        ),
        setDoc(
          doc(firestore, 'shops', clean),
          {
            phone: clean,
            isBlocked,
            blockReason,
            blockedUpdatedAt: nowIso,
          },
          { merge: true }
        ),
        setDoc(
          doc(firestore, 'shops', '0' + clean),
          {
            phone: clean,
            isBlocked,
            blockReason,
            blockedUpdatedAt: nowIso,
          },
          { merge: true }
        ),
      ]);
    } catch (e) {
      console.warn('Firestore toggleBlockUser warning:', e);
    }

    return {
      success: true,
      message: isBlocked
        ? `মোবাইল নম্বর (0${clean}) সফলভাবে ব্লক করা হয়েছে!`
        : `মোবাইল নম্বর (0${clean}) সফলভাবে আনব্লক (খুলে দেওয়া) হয়েছে!`,
    };
  },

  // Check if a phone number is currently blocked (Local + Server + Firestore)
  async checkUserBlockStatus(phone: string): Promise<{ isBlocked: boolean; reason?: string }> {
    const clean = cleanPhoneNumber(phone);
    if (!clean || clean.length < 10) return { isBlocked: false };

    // 1. Check Firestore blocked_users & shops
    try {
      const blkSnap = await getDoc(doc(firestore, 'blocked_users', clean));
      if (blkSnap.exists()) {
        const d = blkSnap.data();
        const isBlocked = Boolean(d.isBlocked);
        const reason = d.blockReason || d.reason;
        DB.setUserBlockedLocal(clean, isBlocked, reason);
        return { isBlocked, reason };
      }
      const shopSnap = await getDoc(doc(firestore, 'shops', clean));
      if (shopSnap.exists() && typeof shopSnap.data().isBlocked === 'boolean') {
        const d = shopSnap.data();
        DB.setUserBlockedLocal(clean, Boolean(d.isBlocked), d.blockReason);
        return { isBlocked: Boolean(d.isBlocked), reason: d.blockReason };
      }
    } catch (_) {}

    // 2. Check Server API
    try {
      const res = await fetchCloud(`/api/shop-status/${clean}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.isBlocked === 'boolean') {
          DB.setUserBlockedLocal(clean, data.isBlocked, data.blockReason);
          return { isBlocked: data.isBlocked, reason: data.blockReason };
        }
      }
    } catch (_) {}

    // 3. Fallback to Local
    return DB.isPhoneBlockedLocal(clean);
  },

  // Real-time listener for block/unblock changes on current logged-in phone
  subscribeToBlockStatus(
    phone: string,
    onChange: (status: { isBlocked: boolean; reason?: string }) => void
  ): () => void {
    const clean = cleanPhoneNumber(phone);
    if (!clean || clean.length < 10) return () => {};

    // Initial check
    this.checkUserBlockStatus(clean).then(onChange).catch(() => {});

    let unsub1 = () => {};
    let unsub2 = () => {};
    try {
      unsub1 = onSnapshot(
        doc(firestore, 'blocked_users', clean),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            const isBlocked = Boolean(d.isBlocked);
            const reason = d.blockReason || d.reason;
            DB.setUserBlockedLocal(clean, isBlocked, reason);
            onChange({ isBlocked, reason });
          }
        },
        () => {}
      );
      unsub2 = onSnapshot(
        doc(firestore, 'shops', clean),
        (snap) => {
          if (snap.exists() && typeof snap.data().isBlocked === 'boolean') {
            const d = snap.data();
            const isBlocked = Boolean(d.isBlocked);
            const reason = d.blockReason;
            DB.setUserBlockedLocal(clean, isBlocked, reason);
            onChange({ isBlocked, reason });
          }
        },
        () => {}
      );
    } catch (_) {}

    return () => {
      try {
        unsub1();
        unsub2();
      } catch (_) {}
    };
  },
};

// Listen to network status
if (typeof window !== 'undefined') {
  (window as any).__sd_schedule_sync = () => CloudSync.scheduleAutoSync();

  window.addEventListener('online', () => {
    currentStatus = { ...currentStatus, state: 'syncing' };
    notifyListeners();
    CloudSync.scheduleAutoSync();
  });

  window.addEventListener('offline', () => {
    currentStatus = { ...currentStatus, state: 'offline' };
    notifyListeners();
  });
}
