import React, { useState } from 'react';
import { Sale, ShopProfile, Language } from '../types';
import { translations } from '../i18n/translations';
import {
  Printer,
  Share2,
  X,
  CheckCircle2,
  Download,
  Copy,
  Check,
  MessageCircle,
  Phone,
  Bluetooth,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  buildEscPosReceipt,
  printDirectWebBluetooth,
  printDirectAndroidBridge,
} from '../utils/escpos';

interface Props {
  sale: Sale;
  profile: ShopProfile;
  language: Language;
  onClose: () => void;
  appMode?: string;
  onOpenSubscriptionModal?: () => void;
}

export const ReceiptModal: React.FC<Props> = ({
  sale,
  profile,
  language,
  onClose,
  appMode = 'trial',
  onOpenSubscriptionModal,
}) => {
  const t = translations[language];
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [customerPhoneInput, setCustomerPhoneInput] = useState(sale.customerPhone || '');
  const [showPhoneInput, setShowPhoneInput] = useState(!sale.customerPhone);
  const [isEscPosPrinting, setIsEscPosPrinting] = useState(false);
  const [escPosToast, setEscPosToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const buildReceiptText = () => {
    const formattedDate = new Date(sale.date).toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsText = sale.items
      .map(
        (it, idx) =>
          `${idx + 1}. ${it.productName} (${it.quantity} ${it.unit}) = ৳${it.totalPrice}`
      )
      .join('\n');

    return `🧾 *${profile.shopName || 'সহজ দোকান'}*
📍 ${profile.address || 'বাজার'} | 📞 ${profile.phone}
---------------------------------
ইনভয়েস: #${sale.invoiceNo}
তারিখ: ${formattedDate}
গ্রাহক: ${sale.customerName || 'নগদ ক্রেতা'}
---------------------------------
${itemsText}
---------------------------------
মোট বিল: ৳${sale.grandTotal}
পরিশোধ: ৳${sale.paidAmount}
${sale.dueAmount > 0 ? `*বাকি টাকা: ৳${sale.dueAmount}*` : `ফেরত: ৳${sale.changeAmount}`}
---------------------------------
ধন্যবাদ! আবার আসবেন।
সহজ দোকান POS দ্বারা পরিচালিত`;
  };

  // Direct Bluetooth ESC/POS Print for small 58mm / 80mm thermal printers
  const handleDirectEscPosPrint = async () => {
    if (appMode === 'normal') {
      onOpenSubscriptionModal?.();
      return;
    }
    setIsEscPosPrinting(true);
    setEscPosToast(null);

    try {
      const escPos = buildEscPosReceipt(sale, profile, 32);
      const b64 = escPos.toBase64();

      // 1. First attempt: If running in native Android APK with direct Bluetooth RFCOMM bridge
      if (printDirectAndroidBridge(b64)) {
        setEscPosToast({
          type: 'success',
          message: 'সরাসরি ব্লুটুথ থার্মাল প্রিন্টারে পাঠানো হয়েছে!',
        });
        setTimeout(() => setEscPosToast(null), 3000);
        setIsEscPosPrinting(false);
        return;
      }

      // 2. Second attempt: If Web Bluetooth API is supported (e.g. Chrome on Android)
      if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
        try {
          const bytes = escPos.getBytes();
          const res = await printDirectWebBluetooth(bytes);
          if (res.success) {
            setEscPosToast({
              type: 'success',
              message: 'সরাসরি ব্লুটুথ প্রিন্টারে পাঠানো হয়েছে!',
            });
            setTimeout(() => setEscPosToast(null), 3500);
            setIsEscPosPrinting(false);
            return;
          }
        } catch (_) {}
      }

      // 3. Seamless standard fallback: 58mm/80mm Thermal Print Spooler (no rawbt: URL scheme navigation that breaks WebView)
      handlePrint();
      setEscPosToast({
        type: 'success',
        message: '৫৮ মিমি ব্লুটুথ থার্মাল প্রিন্টারে রসিদ পাঠানো হয়েছে!',
      });
      setTimeout(() => setEscPosToast(null), 3500);
    } catch (err: any) {
      handlePrint();
      setEscPosToast({
        type: 'success',
        message: '৫৮ মিমি থার্মাল প্রিন্ট উইন্ডো চালু হয়েছে!',
      });
      setTimeout(() => setEscPosToast(null), 3500);
    } finally {
      setIsEscPosPrinting(false);
    }
  };

  const handlePrint = () => {
    if (appMode === 'normal') {
      onOpenSubscriptionModal?.();
      return;
    }
    // 1. If running inside Android APK, trigger native Android PrintManager
    if (typeof window !== 'undefined' && (window as any).AndroidApp?.printReceipt) {
      try {
        (window as any).AndroidApp.printReceipt();
        return;
      } catch (_) {}
    }

    // 2. Standard print without opening new corrupted windows in WebView
    try {
      window.print();
    } catch (_) {}
  };

  const handleShareWhatsApp = () => {
    if (appMode === 'normal') {
      onOpenSubscriptionModal?.();
      return;
    }
    const msg = buildReceiptText();
    const targetPhone = customerPhoneInput.trim().replace(/\D/g, '');
    let waUrl = '';

    if (targetPhone.length >= 10) {
      const cleanPhone = targetPhone.slice(-11);
      const fullPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
      waUrl = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(msg)}`;
    } else {
      // Universal WhatsApp intent (user picks any contact or chat in WhatsApp)
      waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    }

    // 1. If inside Android APK, use native Android intent to launch WhatsApp app directly
    if (typeof window !== 'undefined' && (window as any).AndroidApp?.openWhatsApp) {
      try {
        (window as any).AndroidApp.openWhatsApp(waUrl);
        return;
      } catch (_) {}
    }

    // 2. Browser fallback
    try {
      window.open(waUrl, '_blank');
    } catch (_) {
      window.location.href = waUrl;
    }
  };

  const handleCopyReceipt = () => {
    const text = buildReceiptText();
    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

  const formattedDateTime = new Date(sale.date).toLocaleString(
    language === 'bn' ? 'bn-BD' : 'en-US',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 my-auto">
        {/* Modal Controls Header */}
        <div className="p-4 bg-[#0E6B6B] text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            <h3 className="font-bold text-base">{t.receiptTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Area */}
        <div id="printable-receipt" className="p-6 bg-white text-slate-900 font-sans">
          {/* Shop Header */}
          <div className="text-center pb-4 border-b border-dashed border-slate-300">
            <div className="mx-auto w-14 h-14 rounded-xl overflow-hidden mb-2 p-1 bg-white border border-slate-200 shadow-sm flex items-center justify-center">
              <img
                src={profile.logo || '/assets/icon.png'}
                alt={profile.shopName || 'Shop Logo'}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/icon.png';
                }}
              />
            </div>
            <h2 className="text-lg font-black tracking-tight uppercase">
              {profile.shopName || 'সহজ দোকান'}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {profile.address || 'সদর বাজার, বাংলাদেশ'}
            </p>
            <p className="text-xs text-slate-600">
              মোবাইল: <span className="font-mono">{profile.phone}</span>
            </p>
          </div>

          {/* Invoice Meta */}
          <div className="py-3 text-xs border-b border-dashed border-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">{t.invoiceNumber}:</span>
              <span className="font-mono font-bold">#{sale.invoiceNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t.date}:</span>
              <span>{formattedDateTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t.customer}:</span>
              <span className="font-semibold">
                {sale.customerName || t.cashCustomer}
                {sale.customerPhone ? ` (${sale.customerPhone})` : ''}
              </span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="py-3 border-b border-dashed border-slate-300">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-left pb-1 font-semibold">পণ্য / Item</th>
                  <th className="text-center pb-1 font-semibold">পরিমাণ</th>
                  <th className="text-right pb-1 font-semibold">দর</th>
                  <th className="text-right pb-1 font-semibold">মোট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item, index) => (
                  <tr key={index} className="py-1">
                    <td className="py-1 text-left font-medium max-w-[120px] truncate">
                      {item.productName}
                    </td>
                    <td className="py-1 text-center font-mono">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-1 text-right font-mono">
                      ৳{item.unitPrice}
                    </td>
                    <td className="py-1 text-right font-bold font-mono">
                      ৳{item.totalPrice}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="py-3 space-y-1 text-xs border-b border-dashed border-slate-300">
            <div className="flex justify-between text-slate-600">
              <span>{t.subtotal}:</span>
              <span className="font-mono">৳{sale.subTotal}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>{t.discount}:</span>
                <span className="font-mono">-৳{sale.discount}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
              <span>{t.grandTotal}:</span>
              <span className="font-mono text-base">৳{sale.grandTotal}</span>
            </div>
            <div className="flex justify-between text-slate-700 pt-1">
              <span>{t.paidAmount}:</span>
              <span className="font-mono font-semibold">৳{sale.paidAmount}</span>
            </div>
            {sale.dueAmount > 0 ? (
              <div className="flex justify-between text-rose-700 font-bold bg-rose-50 p-1 rounded">
                <span>{t.dueAmount} (বাকি):</span>
                <span className="font-mono">৳{sale.dueAmount}</span>
              </div>
            ) : (
              <div className="flex justify-between text-slate-600">
                <span>{t.changeAmount}:</span>
                <span className="font-mono">৳{sale.changeAmount}</span>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="pt-4 text-center text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-700">{t.thanksMessage}</p>
            <p className="text-[10px] text-slate-400 font-mono">
              {t.billPoweredBy}
            </p>
          </div>
        </div>

        {/* Action Buttons for Shopkeeper */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 space-y-2.5 no-print">
          
          {/* Optional Customer Phone Input if not attached to sale */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="pl-2 text-slate-400">
              <Phone className="w-3.5 h-3.5" />
            </div>
            <input
              type="tel"
              value={customerPhoneInput}
              onChange={(e) => setCustomerPhoneInput(e.target.value)}
              placeholder="গ্রাহকের হোয়াটসঅ্যাপ নম্বর (ঐচ্ছিক)"
              className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none font-mono"
            />
            {customerPhoneInput && (
              <button
                type="button"
                onClick={() => setCustomerPhoneInput('')}
                className="p-1 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* ESC/POS Status Notification */}
          {escPosToast && (
            <div
              className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150 ${
                escPosToast.type === 'success'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200'
                  : 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200'
              }`}
            >
              {escPosToast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Zap className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{escPosToast.message}</span>
            </div>
          )}

          {/* Primary Action: Direct Bluetooth Thermal Print (ESC/POS) */}
          <button
            type="button"
            disabled={isEscPosPrinting}
            onClick={handleDirectEscPosPrint}
            className="w-full py-3 px-3 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-emerald-700 hover:from-blue-800 hover:to-emerald-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-60"
            title="সরাসরি ব্লুটুথ থার্মাল প্রিন্টারে ক্যাশ মেমো প্রিন্ট করুন (কোনো প্রিভিউ ছাড়া)"
          >
            {isEscPosPrinting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>প্রিন্টারে পাঠানো হচ্ছে...</span>
              </>
            ) : (
              <>
                <Bluetooth className="w-4 h-4 text-cyan-200 stroke-[2.5]" />
                <span>ব্লুটুথ থার্মাল প্রিন্ট (ছোট ৫৮ মিমি / ESC/POS)</span>
                {appMode === 'normal' && (
                  <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md font-black">
                    🔒 Pro
                  </span>
                )}
              </>
            )}
          </button>
          <p className="text-[10px] text-center text-slate-500 dark:text-slate-400">
            💡 ছোট থার্মাল প্রিন্টারের জন্য মোবাইলের Bluetooth অন করে প্রিন্টারটি পেয়ার (Pair) করে রাখুন
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="py-3 px-3 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer border border-emerald-700"
              title="ক্যাশ মেমো প্রিন্ট করুন"
            >
              <Printer className="w-4 h-4" />
              <span>{language === 'bn' ? 'প্রিন্ট করুন' : 'Print Receipt'}</span>
              {appMode === 'normal' && (
                <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md font-black">
                  🔒
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-3 px-3 rounded-2xl bg-[#25D366] hover:bg-[#1fbe58] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer border border-emerald-400"
              title="হোয়াটসঅ্যাপে রসিদ পাঠান"
            >
              <MessageCircle className="w-4 h-4 fill-slate-950" />
              <span>{language === 'bn' ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}</span>
              {appMode === 'normal' && (
                <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md font-black">
                  🔒
                </span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedReceipt ? 'মেমো কপি হয়েছে!' : 'মেমো টেক্সট কপি'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-center"
            >
              {t.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
