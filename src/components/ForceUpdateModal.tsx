import React, { useEffect, useState } from 'react';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { DownloadCloud, ExternalLink, ShieldAlert } from 'lucide-react';
import { firestore } from '../services/firebase';

declare const __APP_VERSION__: string | undefined;
declare const __APP_ANDROID_PACKAGE__: string | undefined;

const CURRENT_APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : '5.1.39';

const ANDROID_PACKAGE_NAME =
  typeof __APP_ANDROID_PACKAGE__ !== 'undefined' && __APP_ANDROID_PACKAGE__
    ? __APP_ANDROID_PACKAGE__
    : 'com.sahojdokan.pos';

const DEFAULT_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;
const DEFAULT_UPDATE_MESSAGE =
  'নতুন আপডেট এসেছে! সহজ দোকান অ্যাপটি ব্যবহার করতে চাইলে অনুগ্রহ করে এখনই প্লে স্টোর থেকে আপডেট দিয়ে নিন।';

interface ForceUpdateState {
  minRequiredVersion: string;
  playStoreUrl: string;
  updateMessage: string;
}

/**
 * Compares two numeric/semantic version strings (e.g. "2.1" vs "2.0", "3" vs "2", "5.1.40" vs "5.1.39").
 * Returns true ONLY if remoteVersion is strictly greater than currentVersion.
 */
function isVersionStrictlyGreater(remoteVersion: string, currentVersion: string): boolean {
  const parseParts = (ver: string): number[] =>
    String(ver || '')
      .trim()
      .replace(/^v/i, '')
      .split('.')
      .map((part) => {
        const match = part.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });

  const remoteParts = parseParts(remoteVersion);
  const currentParts = parseParts(currentVersion);
  const maxLen = Math.max(remoteParts.length, currentParts.length);

  for (let i = 0; i < maxLen; i++) {
    const r = remoteParts[i] || 0;
    const c = currentParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

export const ForceUpdateModal: React.FC = () => {
  const [forceUpdate, setForceUpdate] = useState<ForceUpdateState | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkAppVersion = async () => {
      // Offline Safety Rule: Never block or show modal if offline
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }

      if (!firestore) return;

      const versionDocRef = doc(firestore, 'app_settings', 'version_control');

      try {
        // Race Firestore server fetch against a 6-second timeout so weak/offline networks never hang
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('VERSION_CHECK_TIMEOUT')), 6000);
        });

        const snap = await Promise.race([getDocFromServer(versionDocRef), timeoutPromise]);

        if (!isMounted) return;

        if (!snap.exists()) {
          // Auto-create initial version_control document safely with detected current version & package name
          setDoc(
            versionDocRef,
            {
              min_required_version: CURRENT_APP_VERSION,
              play_store_url: DEFAULT_PLAY_STORE_URL,
              update_message: DEFAULT_UPDATE_MESSAGE,
              updated_at: new Date().toISOString(),
            },
            { merge: true }
          ).catch(() => {});
          return;
        }

        const data = snap.data() || {};
        const minRequired = String(data.min_required_version || '').trim();
        const playStoreUrl =
          String(data.play_store_url || '').trim() || DEFAULT_PLAY_STORE_URL;
        const updateMessage =
          String(data.update_message || '').trim() || DEFAULT_UPDATE_MESSAGE;

        if (minRequired && isVersionStrictlyGreater(minRequired, CURRENT_APP_VERSION)) {
          setForceUpdate({
            minRequiredVersion: minRequired,
            playStoreUrl,
            updateMessage,
          });
        }
      } catch {
        // Offline / Firestore error / timeout -> fail open and allow normal offline usage
      }
    };

    checkAppVersion();

    return () => {
      isMounted = false;
    };
  }, []);

  // Lock hardware back button, Escape key, and background scroll while Force Update is active
  useEffect(() => {
    if (!forceUpdate) {
      if (typeof window !== 'undefined') {
        (window as any).__sdForceUpdateLocked = false;
      }
      return;
    }

    (window as any).__sdForceUpdateLocked = true;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      (window as any).__sdForceUpdateLocked = false;
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [forceUpdate]);

  if (!forceUpdate) return null;

  const handleOpenPlayStore = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const url = forceUpdate.playStoreUrl || DEFAULT_PLAY_STORE_URL;
    if (typeof window !== 'undefined' && (window as any).AndroidApp?.openWhatsApp) {
      e.preventDefault();
      try {
        // AndroidApp.openWhatsApp executes Android Intent.ACTION_VIEW on any URL (Play Store / browser)
        (window as any).AndroidApp.openWhatsApp(url);
        return;
      } catch (_) {
        window.location.href = url;
      }
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="force-update-title"
      aria-describedby="force-update-message"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/92 backdrop-blur-md p-5 select-none touch-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-emerald-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Brand Banner */}
        <div className="bg-gradient-to-br from-[#0E6B6B] via-[#0B5656] to-[#083D3D] px-6 pt-7 pb-6 text-center text-white">
          <div className="mx-auto mb-3.5 w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner">
            <DownloadCloud className="w-9 h-9 text-amber-300" />
          </div>
          <h2 id="force-update-title" className="text-lg sm:text-xl font-black tracking-tight">
            নতুন আপডেট প্রয়োজন
          </h2>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 border border-white/15 text-[11px] font-bold text-emerald-100">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>
              বর্তমান: v{CURRENT_APP_VERSION} → নতুন: v{forceUpdate.minRequiredVersion}
            </span>
          </div>
        </div>

        {/* Message & Mandatory Update Button */}
        <div className="p-6 text-center space-y-5">
          <p
            id="force-update-message"
            className="text-sm font-semibold text-[#102A43] leading-relaxed"
          >
            {forceUpdate.updateMessage}
          </p>

          <a
            href={forceUpdate.playStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleOpenPlayStore}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#0E6B6B] hover:bg-[#0B5656] active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-[#0E6B6B]/30 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4 shrink-0" />
            <span>আপডেট দিন (Update Now)</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
};
