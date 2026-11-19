import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  durationMs: number;
}

type ToastListener = (toast: ToastItem) => void;

const listeners = new Set<ToastListener>();
let nextToastId = 1;

export function showToast(
  message: string,
  type: ToastType = 'info',
  durationMs: number = 2800
): void {
  const item: ToastItem = {
    id: nextToastId++,
    message,
    type,
    durationMs,
  };
  listeners.forEach((listener) => listener(item));
}

const STYLE_MAP: Record<
  ToastType,
  {
    container: string;
    iconWrap: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-950',
    iconWrap: 'bg-emerald-100 text-[#2E7D32]',
    Icon: CheckCircle2,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-950',
    iconWrap: 'bg-amber-100 text-amber-700',
    Icon: AlertTriangle,
  },
  error: {
    container: 'bg-rose-50 border-rose-200 text-rose-950',
    iconWrap: 'bg-rose-100 text-[#D32F2F]',
    Icon: AlertCircle,
  },
  info: {
    container: 'bg-teal-50 border-teal-200 text-[#0F172A]',
    iconWrap: 'bg-[#E0F2F1] text-[#0E6B6B]',
    Icon: Info,
  },
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismissToast = (id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const handleNewToast: ToastListener = (toast) => {
      setToasts((prev) => [...prev.slice(-2), toast]);
      const timer = window.setTimeout(() => {
        timersRef.current.delete(toast.id);
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.durationMs);
      timersRef.current.set(toast.id, timer);
    };

    listeners.add(handleNewToast);
    return () => {
      listeners.delete(handleNewToast);
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-24px)] max-w-md pointer-events-none flex flex-col gap-2"
    >
      {toasts.map((toast) => {
        const cfg = STYLE_MAP[toast.type];
        const IconComp = cfg.Icon;
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl border shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200 ${cfg.container}`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cfg.iconWrap}`}
            >
              <IconComp className="w-3.5 h-3.5" />
            </span>
            <p className="flex-1 text-xs sm:text-[13px] font-bold leading-snug whitespace-pre-line pt-0.5">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-full opacity-60 hover:opacity-100 transition shrink-0 cursor-pointer"
              aria-label="বন্ধ করুন"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
