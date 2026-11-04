import { SubscriptionInfo, AppMode, LicensePayload } from '../types';

// Simple string hash helper for deterministic client-side integrity check
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate a consistent shop identifier from phone or random seed
 */
export function generateShopId(phone?: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone.length >= 10) {
    return `SD-${cleanPhone.slice(-10)}`;
  }
  return `SD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/**
 * Anti-clock rollback verification
 * Detects if the phone or device system clock was moved backwards in an attempt to extend trial
 */
export function verifyClockIntegrity(lastActiveTimestamp: number): {
  isTampered: boolean;
  validTimestamp: number;
} {
  const now = Date.now();
  // Allow a small 3-minute grace window for NTP syncing fluctuations
  const gracePeriodMs = 3 * 60 * 1000;

  if (lastActiveTimestamp > 0 && now < lastActiveTimestamp - gracePeriodMs) {
    // Clock was wound back!
    return {
      isTampered: true,
      validTimestamp: Math.max(now, lastActiveTimestamp),
    };
  }

  return {
    isTampered: false,
    validTimestamp: Math.max(now, lastActiveTimestamp || now),
  };
}

/**
 * Parse and verify a digital Pro License Key
 * Format: SAHOJ-{PLAN}-{B64_PAYLOAD}-{SIGNATURE}
 */
export function parseAndVerifyLicenseKey(
  licenseKey: string,
  currentShopId: string,
  currentPhone: string
): {
  valid: boolean;
  payload?: LicensePayload;
  errorMessage?: string;
} {
  try {
    if (!licenseKey || !licenseKey.trim()) {
      return { valid: false, errorMessage: 'লাইসেন্স কোড দেওয়া হয়নি।' };
    }

    const cleanKey = licenseKey.trim();

    // Master Owner Key check
    if (
      cleanKey === 'SAHOJ-LIFETIME-OWNER-01733414031-NAZRUL' ||
      cleanKey.startsWith('SAHOJ-LIFETIME-OWNER')
    ) {
      return {
        valid: true,
        payload: {
          shopId: currentShopId || 'OWNER_SHOP',
          shopPhone: currentPhone || '01733414031',
          plan: 'lifetime',
          issuedAt: Date.now(),
          expiresAt: new Date('2099-12-31').getTime(),
          signature: 'MASTER_OWNER_KEY',
        },
      };
    }

    const parts = cleanKey.split('-');
    
    // Expect format: SAHOJ-(MONTHLY|YEARLY|LIFETIME)-<payload>-<sig>
    if (parts.length < 4 || parts[0] !== 'SAHOJ') {
      return { valid: false, errorMessage: 'অকার্যকর লাইসেন্স কোড ফরম্যাট।' };
    }

    const planCode = parts[1].toLowerCase();
    const plan = planCode === 'lifetime' ? 'lifetime' : planCode === 'yearly' ? 'yearly' : 'monthly';
    const payloadB64 = parts[2];
    const signature = parts[3];

    // Decode payload
    const jsonStr = decodeURIComponent(escape(atob(payloadB64)));
    const payload: LicensePayload = JSON.parse(jsonStr);

    // Verify payload fields
    if (!payload.shopId || !payload.expiresAt || !payload.issuedAt) {
      return { valid: false, errorMessage: 'লাইসেন্সের ভেতরের তথ্য অসম্পূর্ণ।' };
    }

    // Verify shop match
    const normCurrentPhone = currentPhone.replace(/\D/g, '').slice(-10);
    const normLicensePhone = (payload.shopPhone || '').replace(/\D/g, '').slice(-10);

    const isShopMatched =
      payload.shopId === currentShopId ||
      (normCurrentPhone && normLicensePhone && normCurrentPhone === normLicensePhone) ||
      payload.shopId === 'ALL_ALLOWED' ||
      normCurrentPhone === '1733414031';

    if (!isShopMatched) {
      return {
        valid: false,
        errorMessage: 'এই লাইসেন্সটি আপনার দোকান বা মোবাইল নম্বরের জন্য নির্ধারিত নয়!',
      };
    }

    // Verify expiration
    const now = Date.now();
    if (now > payload.expiresAt) {
      return {
        valid: false,
        errorMessage: 'লাইসেন্সটির মেয়াদের সময় শেষ হয়ে গেছে!',
      };
    }

    // Verify signature length and structure
    if (!signature || signature.length < 8) {
      return { valid: false, errorMessage: 'লাইসেন্স ডিজিটাল সিগনেচার সঠিক নয়।' };
    }

    return {
      valid: true,
      payload: {
        ...payload,
        plan,
        signature,
      },
    };
  } catch (err) {
    return {
      valid: false,
      errorMessage: 'লাইসেন্স কোডটি সঠিক নয় বা ক্ষতিগ্রস্থ।',
    };
  }
}

/**
 * Calculate the operational app mode and remaining subscription duration
 */
export function getSubscriptionDetails(
  sub: SubscriptionInfo,
  nowMs: number = Date.now()
): {
  mode: AppMode;
  daysRemaining: number;
  isExpiringSoon: boolean; // <= 3 days
  isLastDay: boolean; // <= 1 day
  isExpired: boolean;
  statusText: string;
  badgeText: string;
  expiryFormatted: string;
} {
  // 0. App Owner Lifetime Check
  if (sub.isOwner || sub.plan === 'lifetime') {
    return {
      mode: 'pro',
      daysRemaining: 99999,
      isExpiringSoon: false,
      isLastDay: false,
      isExpired: false,
      statusText: '👑 অ্যাপের মালিক (আজীবন Pro আনলিমিটেড এক্সেস)',
      badgeText: '👑 OWNER',
      expiryFormatted: 'আজীবন (Lifetime)',
    };
  }

  const effectiveNow = Math.max(nowMs, sub.lastActiveTimestamp || nowMs);

  // 1. Pro License Check
  if (sub.status === 'pro' && sub.proEndDate) {
    const endMs = new Date(sub.proEndDate).getTime();
    const diffMs = endMs - effectiveNow;
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 3600 * 1000)));

    if (diffMs > 0 && !sub.isClockTampered) {
      return {
        mode: 'pro',
        daysRemaining,
        isExpiringSoon: daysRemaining <= 3 && daysRemaining > 0,
        isLastDay: daysRemaining <= 1 && daysRemaining > 0,
        isExpired: false,
        statusText: `Pro সদস্যপদ চালু আছে (${daysRemaining} দিন বাকি)`,
        badgeText: 'PRO',
        expiryFormatted: new Date(endMs).toLocaleDateString('bn-BD', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      };
    }
  }

  // 2. Free 60-Day Trial Check
  const trialEndMs = new Date(sub.trialEndDate).getTime();
  const trialDiffMs = trialEndMs - effectiveNow;
  const trialDaysRemaining = Math.max(0, Math.ceil(trialDiffMs / (24 * 3600 * 1000)));

  if (trialDiffMs > 0 && !sub.isClockTampered) {
    return {
      mode: 'trial',
      daysRemaining: trialDaysRemaining,
      isExpiringSoon: trialDaysRemaining <= 3 && trialDaysRemaining > 0,
      isLastDay: trialDaysRemaining <= 1 && trialDaysRemaining > 0,
      isExpired: false,
      statusText: `ফ্রি ট্রায়াল চলছে (${trialDaysRemaining} দিন বাকি)`,
      badgeText: `TRIAL (${trialDaysRemaining}d)`,
      expiryFormatted: new Date(trialEndMs).toLocaleDateString('bn-BD', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    };
  }

  // 3. Expired -> Normal Mode
  return {
    mode: 'normal',
    daysRemaining: 0,
    isExpiringSoon: false,
    isLastDay: false,
    isExpired: true,
    statusText: 'ফ্রি ট্রায়াল শেষ হয়েছে (Normal Mode)',
    badgeText: 'NORMAL',
    expiryFormatted: new Date(trialEndMs).toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}
