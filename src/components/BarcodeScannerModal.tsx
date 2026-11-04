import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Language } from '../types';
import { translations } from '../i18n/translations';
import { playBarcodeBeep } from '../utils/audio';
import { Camera, X, AlertCircle, Search, RefreshCw } from 'lucide-react';

interface Props {
  language: Language;
  onScanSuccess: (barcode: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<Props> = ({
  language,
  onScanSuccess,
  onClose,
}) => {
  const t = translations[language];
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const qrRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const isMountedRef = useRef(true);
  const readerElementId = 'barcode-scanner-view';

  useEffect(() => {
    isMountedRef.current = true;

    const startScanner = async () => {
      // 1. Check mediaDevices availability safely
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMountedRef.current) {
          setIsInitializing(false);
          setCameraError(
            language === 'bn'
              ? 'এই ডিভাইসে ক্যামেরা সাপোর্ট পাওয়া যায়নি। নিচের বক্সে বারকোড নম্বর লিখুন।'
              : 'Camera is not supported on this device. Please type the barcode below.'
          );
        }
        return;
      }

      // 2. Pre-check permission safely
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        // Stop test stream tracks immediately before handing over to Html5Qrcode
        stream.getTracks().forEach((track) => track.stop());
      } catch (err: any) {
        console.warn('Camera pre-check permission warning:', err);
        if (isMountedRef.current) {
          setIsInitializing(false);
          setCameraError(
            language === 'bn'
              ? 'ক্যামেরা ব্যবহারের অনুমতি দেওয়া হয়নি বা ক্যামেরা ব্যস্ত রয়েছে। নিচে ম্যানুয়ালি বারকোড লিখুন।'
              : 'Camera permission denied or camera is in use. Please enter barcode below.'
          );
        }
        return;
      }

      // Check if unmounted during permission prompt
      if (!isMountedRef.current) return;

      // 3. Initialize Html5Qrcode safely
      try {
        const scannerElement = document.getElementById(readerElementId);
        if (!scannerElement) {
          throw new Error('Scanner container element not found in DOM');
        }

        const scanner = new Html5Qrcode(readerElementId);
        qrRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 280, height: 160 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMountedRef.current) {
              playBarcodeBeep();
              onScanSuccess(decodedText.trim());
              safeStopScanner();
            }
          },
          () => {
            // on frame
          }
        );

        if (isMountedRef.current) {
          isScanningRef.current = true;
          setIsInitializing(false);
        } else {
          safeStopScanner();
        }
      } catch (err: any) {
        console.warn('Camera scanner initialization error:', err);
        if (isMountedRef.current) {
          setIsInitializing(false);
          setCameraError(
            language === 'bn'
              ? 'ক্যামেরা চালু করা যায়নি। অনুগ্রহ করে নিচের বক্সে বারকোড সংখ্যা লিখুন।'
              : 'Could not start camera scanner. Please enter barcode below.'
          );
        }
      }
    };

    const safeStopScanner = () => {
      if (qrRef.current && isScanningRef.current) {
        isScanningRef.current = false;
        qrRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              qrRef.current?.clear();
            } catch (e) {}
          });
      }
    };

    // Delay slightly to ensure modal is mounted and styled
    const timer = setTimeout(startScanner, 250);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      safeStopScanner();
    };
  }, [language, onScanSuccess]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playBarcodeBeep();
      onScanSuccess(manualCode.trim());
    }
  };

  const handleRetryCamera = () => {
    setCameraError(null);
    setIsInitializing(true);
    // Trigger remount / restart
    window.location.hash = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-700 flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                {language === 'bn' ? 'বারকোড স্ক্যানার' : 'Barcode Scanner'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {language === 'bn'
                  ? 'প্যাকেটের বারকোড ক্যামেরার সামনে ধরুন'
                  : 'Point camera at product barcode'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewfinder Container */}
        <div className="relative bg-black flex items-center justify-center min-h-[280px] overflow-hidden">
          {/* Scanner element */}
          <div
            id={readerElementId}
            className={`w-full min-h-[280px] ${cameraError ? 'hidden' : 'block'}`}
          />

          {/* Loading spinner during init */}
          {isInitializing && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-emerald-400 gap-2">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <p className="text-xs text-slate-300">
                {language === 'bn' ? 'ক্যামেরা চালু হচ্ছে...' : 'Starting camera...'}
              </p>
            </div>
          )}

          {/* Aiming Reticle Over Scanner */}
          {!cameraError && !isInitializing && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-36 border-2 border-dashed border-emerald-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl"></div>
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr"></div>
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl"></div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br"></div>
                <div className="w-full h-0.5 bg-red-500/80 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-sm"></div>
              </div>
            </div>
          )}

          {/* Safe Error Fallback Screen */}
          {cameraError && (
            <div className="p-6 text-center text-slate-300 flex flex-col items-center justify-center py-10">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 mb-3">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="text-xs max-w-xs text-slate-300 mb-3 font-medium">
                {cameraError}
              </p>
              <button
                type="button"
                onClick={handleRetryCamera}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 border border-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'পুনরায় চেষ্টা করুন' : 'Retry Camera'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Manual Barcode Input Fallback */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                autoFocus
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={
                  language === 'bn'
                    ? 'বারকোড নম্বর লিখুন (যেমন: 100001)...'
                    : 'Enter barcode number...'
                }
                className="w-full pl-3 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'খুঁজুন' : 'Submit'}</span>
            </button>
          </form>

          {/* Quick preset test barcodes */}
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-slate-400 items-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">
              {language === 'bn' ? 'দ্রুত কোড:' : 'Quick Test:'}
            </span>
            {['100001', '8941100123456', '8901058852331', '100002', '100003'].map(
              (code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    playBarcodeBeep();
                    onScanSuccess(code);
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-mono text-[11px]"
                >
                  {code}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
