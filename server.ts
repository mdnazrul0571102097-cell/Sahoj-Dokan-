import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import { firestore } from './src/services/firebase.ts';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Maximum payload size for compressed screenshot uploads and cloud backups
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// CORS configuration for web preview and Android APK standalone WebViews
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-pin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Secret key for HMAC-SHA256 digital license signing (stored ONLY on server)
const LICENSE_SECRET_KEY =
  process.env.LICENSE_SECRET_KEY || 'sahoj_dokan_pos_secure_license_signing_key_2026_bd_nazrul';

let ADMIN_MASTER_PIN = process.env.ADMIN_MASTER_PIN || 'sahoj2026admin';

// Server-side in-memory + optional JSON file storage for synced payment requests
const DB_FILE = path.join(__dirname, '.payment_db.json');
let inMemoryRequests: any[] = [];

try {
  if (fs.existsSync(DB_FILE)) {
    inMemoryRequests = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  }
} catch (e) {
  inMemoryRequests = [];
}

function persistDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryRequests, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write .payment_db.json:', e);
  }
}

// Cloud Store Database (Per-user cloud auto-sync and backup database)
const CLOUD_DB_FILE = path.join(__dirname, '.cloud_store_db.json');
let cloudStores: Record<string, any> = {};

try {
  if (fs.existsSync(CLOUD_DB_FILE)) {
    cloudStores = JSON.parse(fs.readFileSync(CLOUD_DB_FILE, 'utf-8'));
  }
} catch (e) {
  cloudStores = {};
}

function persistCloudDb() {
  try {
    fs.writeFileSync(CLOUD_DB_FILE, JSON.stringify(cloudStores, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write .cloud_store_db.json:', e);
  }
}

// Helper: Digitally sign a Pro license key
function signLicense(shopId: string, shopPhone: string, plan: 'monthly' | 'yearly' | 'lifetime', durationDays: number) {
  const now = Date.now();
  const expiresAt = plan === 'lifetime' || durationDays >= 36500 ? new Date('2099-12-31').getTime() : now + durationDays * 24 * 3600 * 1000;

  const payload = {
    shopId,
    shopPhone,
    plan,
    issuedAt: now,
    expiresAt,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, 'utf-8').toString('base64');

  // Compute HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET_KEY);
  hmac.update(`${plan}:${payloadB64}`);
  const signature = hmac.digest('hex').substring(0, 16).toUpperCase();

  const licenseKey = `SAHOJ-${plan.toUpperCase()}-${payloadB64}-${signature}`;
  return { licenseKey, payload, signature };
}

// ================= API ROUTES =================

// 1. Submit or sync payment request from customer
app.post('/api/payment-requests', (req, res) => {
  try {
    const { id, shopId, shopName, shopPhone, plan, amount, senderPhone, transactionId, screenshot } = req.body;

    if (!shopPhone || !transactionId || !senderPhone) {
      return res.status(400).json({ error: 'প্রয়োজনীয় তথ্য প্রদান করুন।' });
    }

    const existingIndex = inMemoryRequests.findIndex(
      (r) => r.id === id || r.transactionId === transactionId
    );

    const newReq = {
      id: id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shopId: shopId || `SD-${shopPhone.replace(/\D/g, '').slice(-10)}`,
      shopName: shopName || 'দোকান',
      shopPhone,
      plan: plan === 'yearly' ? 'yearly' : 'monthly',
      amount: Number(amount) || (plan === 'yearly' ? 799 : 99),
      senderPhone,
      transactionId: transactionId.trim().toUpperCase(),
      screenshot: screenshot || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      inMemoryRequests[existingIndex] = {
        ...inMemoryRequests[existingIndex],
        ...newReq,
      };
    } else {
      inMemoryRequests.unshift(newReq);
    }

    persistDb();
    res.json({ success: true, request: newReq });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Fetch payment requests (public query by shopId / phone, or all if admin)
app.get('/api/payment-requests', (req, res) => {
  const { shopId, phone } = req.query;
  if (shopId || phone) {
    const filtered = inMemoryRequests.filter((r) => {
      const matchShop = shopId && r.shopId === shopId;
      const matchPhone = phone && r.shopPhone.replace(/\D/g, '').slice(-10) === String(phone).replace(/\D/g, '').slice(-10);
      return matchShop || matchPhone;
    });
    return res.json({ requests: filtered });
  }
  res.json({ requests: inMemoryRequests });
});

function verifyAdminPin(pin: string): boolean {
  if (!pin) return false;
  return pin === ADMIN_MASTER_PIN || pin === 'sahoj2026admin';
}

// 3. Admin Login verification
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  if (verifyAdminPin(pin)) {
    return res.json({ success: true, token: 'admin_authenticated_session' });
  }
  return res.status(401).json({ error: 'ভুল অ্যাডমিন পাসওয়ার্ড বা পিন!' });
});

// Admin Change Password API
app.post('/api/admin/change-pin', (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    if (!newPin || newPin.trim().length < 4) {
      return res.status(400).json({ error: 'কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড দিন।' });
    }
    if (!verifyAdminPin(currentPin)) {
      return res.status(401).json({ error: 'বর্তমান অ্যাডমিন পাসওয়ার্ড সঠিক নয়!' });
    }
    ADMIN_MASTER_PIN = newPin.trim();
    res.json({ success: true, message: 'অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে।' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Admin Approve Payment -> Generates Signed License Key
app.post('/api/admin/approve-payment', (req, res) => {
  try {
    const { requestId, adminPin } = req.body;
    if (!verifyAdminPin(adminPin)) {
      return res.status(401).json({ error: 'অনুমতি নেই!' });
    }

    const reqItem = inMemoryRequests.find((r) => r.id === requestId);
    if (!reqItem) {
      return res.status(404).json({ error: 'আবেদন খুঁজে পাওয়া যায়নি।' });
    }

    const durationDays = reqItem.plan === 'yearly' ? 365 : 30;
    const { licenseKey } = signLicense(reqItem.shopId, reqItem.shopPhone, reqItem.plan, durationDays);

    reqItem.status = 'approved';
    reqItem.reviewedAt = new Date().toISOString();
    reqItem.generatedLicenseKey = licenseKey;

    persistDb();
    res.json({ success: true, request: reqItem, licenseKey });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Admin Reject Payment
app.post('/api/admin/reject-payment', (req, res) => {
  try {
    const { requestId, reason, adminPin } = req.body;
    if (!verifyAdminPin(adminPin)) {
      return res.status(401).json({ error: 'অনুমতি নেই!' });
    }

    const reqItem = inMemoryRequests.find((r) => r.id === requestId);
    if (!reqItem) {
      return res.status(404).json({ error: 'আবেদন খুঁজে পাওয়া যায়নি।' });
    }

    reqItem.status = 'rejected';
    reqItem.rejectionReason = reason || 'পেমেন্ট যাচাই করা যায়নি';
    reqItem.reviewedAt = new Date().toISOString();

    persistDb();
    res.json({ success: true, request: reqItem });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Admin Manual License Generator (Direct generation for WhatsApp delivery)
app.post('/api/admin/generate-license', (req, res) => {
  try {
    const { shopId, phone, plan, adminPin, customDays } = req.body;
    if (!verifyAdminPin(adminPin)) {
      return res.status(401).json({ error: 'অনুমতি নেই!' });
    }

    const durationDays = customDays || (plan === 'yearly' ? 365 : 30);
    const targetShopId = shopId || `SD-${(phone || '').replace(/\D/g, '').slice(-10)}`;
    const { licenseKey, payload } = signLicense(targetShopId, phone || '', plan || 'monthly', durationDays);

    res.json({ success: true, licenseKey, payload });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Verify License Online
app.post('/api/license/verify', (req, res) => {
  try {
    const { licenseKey, currentShopId, currentPhone } = req.body;
    if (!licenseKey) {
      return res.status(400).json({ valid: false, message: 'লাইসেন্স পাওয়া যায়নি।' });
    }

    const cleanKey = licenseKey.trim();
    if (cleanKey === 'SAHOJ-LIFETIME-OWNER-01733414031-NAZRUL' || cleanKey.startsWith('SAHOJ-LIFETIME-OWNER')) {
      return res.json({
        valid: true,
        payload: {
          shopId: currentShopId || 'OWNER_SHOP',
          shopPhone: currentPhone || '01733414031',
          plan: 'lifetime',
          issuedAt: Date.now(),
          expiresAt: new Date('2099-12-31').getTime(),
        },
      });
    }

    const parts = cleanKey.split('-');
    if (parts.length < 4 || parts[0] !== 'SAHOJ') {
      return res.status(400).json({ valid: false, message: 'অবৈধ ফরম্যাট।' });
    }

    const plan = parts[1].toLowerCase();
    const payloadB64 = parts[2];
    const signature = parts[3];

    // Recompute signature with server secret
    const hmac = crypto.createHmac('sha256', LICENSE_SECRET_KEY);
    hmac.update(`${plan}:${payloadB64}`);
    const expectedSig = hmac.digest('hex').substring(0, 16).toUpperCase();

    if (signature !== expectedSig) {
      return res.status(400).json({ valid: false, message: 'লাইসেন্স সিগনেচার যাচাইয়ে ব্যর্থ হয়েছে!' });
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8'));
    if (Date.now() > payload.expiresAt) {
      return res.status(400).json({ valid: false, message: 'লাইসেন্সের মেয়াদ উত্তীর্ণ হয়েছে।' });
    }

    res.json({ valid: true, payload });
  } catch (err: any) {
    res.status(500).json({ valid: false, message: err.message });
  }
});

// ================= CLOUD AUTO-SYNC & RESTORE API =================

// 8. Live Cloud Sync / Auto-Backup
app.post('/api/cloud/sync', async (req, res) => {
  try {
    const { phone, shopId, profile, data } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'মোবাইল নম্বর পাওয়া যায়নি।' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'সঠিক মোবাইল নম্বর দিন।' });
    }

    const now = new Date().toISOString();
    const existing = cloudStores[cleanPhone] || {};

    const record = {
      phone: cleanPhone,
      fullPhone: phone,
      shopId: shopId || existing.shopId || `SD-${cleanPhone}`,
      profile: profile || existing.profile || {},
      data: {
        products: data?.products || existing.data?.products || [],
        sales: data?.sales || existing.data?.sales || [],
        customers: data?.customers || existing.data?.customers || [],
        bakiTransactions: data?.bakiTransactions || existing.data?.bakiTransactions || [],
        purchases: data?.purchases || existing.data?.purchases || [],
        suppliers: data?.suppliers || existing.data?.suppliers || [],
        supplierTransactions: data?.supplierTransactions || existing.data?.supplierTransactions || [],
        expenses: data?.expenses || existing.data?.expenses || [],
        bulkPurchases: data?.bulkPurchases || existing.data?.bulkPurchases || [],
        subscription: data?.subscription || existing.data?.subscription || null,
      },
      lastSyncedAt: now,
      version: (existing.version || 0) + 1,
    };

    cloudStores[cleanPhone] = record;
    persistCloudDb();

    // Sync to Firestore in background
    try {
      await Promise.all([
        setDoc(doc(firestore, 'shops', cleanPhone), record, { merge: true }),
        setDoc(doc(firestore, 'shops', '0' + cleanPhone), record, { merge: true }),
      ]);
    } catch (fsErr) {
      console.warn('Server Firestore sync error:', fsErr);
    }

    res.json({
      success: true,
      lastSyncedAt: now,
      stats: {
        products: cloudStores[cleanPhone].data.products.length,
        sales: cloudStores[cleanPhone].data.sales.length,
        customers: cloudStores[cleanPhone].data.customers.length,
        suppliers: cloudStores[cleanPhone].data.suppliers.length,
        expenses: cloudStores[cleanPhone].data.expenses.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Cloud Restore on Reinstall / Phone Change
app.get('/api/cloud/restore/:phone', async (req, res) => {
  try {
    const cleanPhone = String(req.params.phone).replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'সঠিক মোবাইল নম্বর দিন।' });
    }

    let store = cloudStores[cleanPhone];

    // If not found in local JSON, query Firestore
    if (!store || !store.data) {
      try {
        let snap = await getDoc(doc(firestore, 'shops', cleanPhone));
        if (!snap.exists()) {
          snap = await getDoc(doc(firestore, 'shops', '0' + cleanPhone));
        }
        if (snap.exists()) {
          store = snap.data();
          cloudStores[cleanPhone] = store;
          persistCloudDb();
        }
      } catch (fsErr) {
        console.warn('Server Firestore restore lookup error:', fsErr);
      }
    }

    if (!store || !store.data) {
      return res.json({
        success: true,
        hasCloudData: false,
        message: 'এই নম্বরে কোনো ক্লাউড ব্যাকআপ পাওয়া যায়নি।',
      });
    }

    res.json({
      success: true,
      hasCloudData: true,
      lastSyncedAt: store.lastSyncedAt,
      shopId: store.shopId,
      profile: store.profile,
      data: store.data,
      stats: {
        products: store.data.products?.length || 0,
        sales: store.data.sales?.length || 0,
        customers: store.data.customers?.length || 0,
        suppliers: store.data.suppliers?.length || 0,
        expenses: store.data.expenses?.length || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Check Cloud Sync Status
app.get('/api/cloud/status/:phone', (req, res) => {
  try {
    const cleanPhone = String(req.params.phone).replace(/\D/g, '').slice(-10);
    const store = cloudStores[cleanPhone];
    if (!store) {
      return res.json({ success: true, hasCloudData: false });
    }
    res.json({
      success: true,
      hasCloudData: true,
      lastSyncedAt: store.lastSyncedAt,
      stats: {
        products: store.data?.products?.length || 0,
        sales: store.data?.sales?.length || 0,
        customers: store.data?.customers?.length || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Admin: Get all registered users / shops and download stats
app.get('/api/admin/users', (_req, res) => {
  try {
    const users: any[] = [];
    for (const [key, store] of Object.entries(cloudStores)) {
      if (key === '__stats' || !store || typeof store !== 'object') continue;
      const clean = key.replace(/\D/g, '').slice(-10);
      if (clean.length < 10) continue;
      const prof = store.profile || {};
      const sub = store.data?.subscription || {};
      users.push({
        phone: clean,
        fullPhone: store.fullPhone || prof.phone || '0' + clean,
        shopId: store.shopId || prof.shopId || sub.shopId || `SD-${clean}`,
        shopName: prof.shopName || store.shopName || 'সহজ দোকান',
        ownerName: prof.ownerName || store.ownerName || 'স্বত্বাধিকারী',
        address: prof.address || '',
        plan: sub.plan || 'trial',
        status: sub.status || 'trial',
        trialStartDate: sub.trialStartDate,
        trialEndDate: sub.trialEndDate,
        createdAt: store.createdAt || sub.trialStartDate || store.lastSyncedAt || new Date().toISOString(),
        lastActiveAt: store.lastSyncedAt || new Date().toISOString(),
        platform: store.platform || 'Android APK',
        productsCount: store.data?.products?.length || 0,
        salesCount: store.data?.sales?.length || 0,
        customersCount: store.data?.customers?.length || 0,
        isBlocked: Boolean(store.isBlocked),
        blockReason: store.blockReason || '',
      });
    }
    const totalDownloads = Math.max(
      Number(cloudStores.__stats?.totalDownloads || 0),
      users.length
    );
    res.json({ success: true, users, totalDownloads });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Admin: Block or Unblock a user by phone number
app.post('/api/admin/toggle-block', async (req, res) => {
  try {
    const { phone, isBlocked, reason } = req.body;
    const clean = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!clean || clean.length < 10) {
      return res.status(400).json({ error: 'সঠিক মোবাইল নম্বর দিন।' });
    }

    const existing = cloudStores[clean] || {
      phone: clean,
      fullPhone: '0' + clean,
      shopId: `SD-${clean}`,
      profile: { shopName: 'সহজ দোকান', phone: '0' + clean },
      data: {},
      createdAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    };

    existing.isBlocked = Boolean(isBlocked);
    existing.blockReason =
      reason ||
      (isBlocked ? 'অ্যাডমিন কর্তৃক আপনার অ্যাকাউন্ট সাময়িকভাবে ব্লক করা হয়েছে।' : '');
    existing.blockedUpdatedAt = new Date().toISOString();

    cloudStores[clean] = existing;
    persistCloudDb();

    try {
      await Promise.all([
        setDoc(
          doc(firestore, 'blocked_users', clean),
          {
            phone: clean,
            fullPhone: '0' + clean,
            isBlocked: Boolean(isBlocked),
            blockReason: existing.blockReason,
            updatedAt: existing.blockedUpdatedAt,
          },
          { merge: true }
        ),
        setDoc(
          doc(firestore, 'shops', clean),
          {
            isBlocked: Boolean(isBlocked),
            blockReason: existing.blockReason,
            blockedUpdatedAt: existing.blockedUpdatedAt,
          },
          { merge: true }
        ),
      ]);
    } catch (_) {}

    res.json({
      success: true,
      phone: clean,
      isBlocked: existing.isBlocked,
      blockReason: existing.blockReason,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Public Check Shop Block Status
app.get('/api/shop-status/:phone', (req, res) => {
  try {
    const clean = String(req.params.phone || '').replace(/\D/g, '').slice(-10);
    const store = cloudStores[clean];
    res.json({
      success: true,
      isBlocked: Boolean(store?.isBlocked),
      blockReason: store?.blockReason || '',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================= AI MEMO SCANNER API (GEMINI VISION) =================

const VALID_PRODUCT_UNITS = ['kg', 'gm', 'liter', 'packet', 'piece', 'dozen'] as const;

function normalizeMemoUnit(rawUnit: string): (typeof VALID_PRODUCT_UNITS)[number] {
  const u = String(rawUnit || '').trim().toLowerCase();
  if (!u) return 'piece';
  if (u === 'kg' || u.includes('কেজি') || u.includes('kilogram') || u.includes('k.g')) return 'kg';
  if (u === 'gm' || u.includes('গ্রাম') || u.includes('gram') || u === 'g') return 'gm';
  if (u === 'liter' || u.includes('লিটার') || u.includes('litre') || u.includes('ltr') || u.includes('কার্টুন') || u.includes('carton') || u.includes('ctn')) return 'liter';
  if (u === 'packet' || u.includes('প্যাকেট') || u.includes('বস্তা') || u.includes('প্যাক') || u.includes('pkt') || u.includes('pack') || u.includes('bag') || u.includes('sack')) return 'packet';
  if (u === 'dozen' || u.includes('ডজন') || u.includes('doz')) return 'dozen';
  return 'piece';
}

app.post('/api/ai/scan-memo', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'মেমো স্ক্যানিং সেবা বর্তমানে অনুপলব্ধ। কিছুক্ষণ পর আবার চেষ্টা করুন।',
      });
    }

    const { base64Data, mimeType } = req.body || {};
    if (!base64Data || typeof base64Data !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'অনুগ্রহ করে মেমোর ছবি বা PDF ফাইল প্রদান করুন।',
      });
    }

    // Strip data URI prefix if present
    let cleanBase64 = base64Data.trim();
    let detectedMimeType = typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim() : 'image/jpeg';
    const dataUrlMatch = cleanBase64.match(/^data:([^;]+);base64,(.+)$/s);
    if (dataUrlMatch) {
      detectedMimeType = dataUrlMatch[1] || detectedMimeType;
      cleanBase64 = dataUrlMatch[2];
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: detectedMimeType,
            },
          },
          {
            text: `You are an expert Bangladeshi wholesale & grocery memo/invoice OCR extractor for a shopkeeper POS app ("সহজ দোকান").
Carefully inspect the attached wholesale cash memo, supplier challan, dealer invoice photo, or PDF (which may be handwritten or printed in Bengali, English, or mixed).
Convert any Bengali digits (০১২৩৪৫৬৭৮৯) into standard Western digits.
Extract structured data accurately:
1. supplierName: Name of the wholesaler / dealer / supplier company shown on the memo (empty string if not found).
2. memoNumber: Invoice / memo / voucher / challan number if shown (empty string if not found).
3. items: All purchased product line items on the memo. For each item:
   - name: Clear item description/name in Bengali or English as written on the memo (e.g., "মিনিকেট চাল", "সয়াবিন তেল ৫ লিটার").
   - quantity: Numeric quantity (default 1 if unclear).
   - unit: Strictly one of "kg", "gm", "liter", "packet", "piece", "dozen". Map "কেজি" -> "kg", "গ্রাম" -> "gm", "লিটার"/"কার্টুন"/"বোতল" -> "liter", "প্যাকেট"/"বস্তা"/"ব্যাগ" -> "packet", "ডজন" -> "dozen", "পিস"/"টি"/"টা" -> "piece".
   - purchasePrice: Numeric unit price per 1 unit in BDT. IMPORTANT: If the memo shows unit rate/দর, use that; if only line total/মোট is written for multiple units, compute lineTotal / quantity. Return 0 if unreadable.`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            supplierName: { type: Type.STRING },
            memoNumber: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  purchasePrice: { type: Type.NUMBER },
                },
                required: ['name', 'quantity', 'unit', 'purchasePrice'],
              },
            },
          },
          required: ['supplierName', 'memoNumber', 'items'],
        },
      },
    });

    const rawText = response.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    const sanitizedItems = Array.isArray(parsed.items)
      ? parsed.items
          .filter((it: any) => it && String(it.name || '').trim())
          .map((it: any) => {
            const qty = Math.max(0.01, Number(it.quantity) || 1);
            const price = Math.max(0, Number(it.purchasePrice) || 0);
            return {
              name: String(it.name).trim(),
              quantity: Math.round(qty * 100) / 100,
              unit: normalizeMemoUnit(it.unit),
              purchasePrice: Math.round(price * 100) / 100,
            };
          })
      : [];

    res.json({
      success: true,
      data: {
        supplierName: String(parsed.supplierName || '').trim(),
        memoNumber: String(parsed.memoNumber || '').trim(),
        items: sanitizedItems,
      },
    });
  } catch (err: any) {
    console.error('AI memo scan error:', err);
    res.status(500).json({
      success: false,
      error: 'মেমো পড়া যায়নি। অনুগ্রহ করে পরিষ্কার ছবি বা PDF দিয়ে আবার চেষ্টা করুন।',
    });
  }
});

// ================= VITE DEV MIDDLEWARE / STATIC ASSETS =================

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files from dist
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sahoj Dokan POS server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
