import React, { useState } from 'react';
import { Product, Language } from '../types';
import { translations } from '../i18n/translations';
import { Scale, Banknote, X, Check, Plus, Minus } from 'lucide-react';

interface Props {
  product: Product;
  language: Language;
  onConfirm: (product: Product, quantityInKg: number, calculatedPrice: number) => void;
  onClose: () => void;
}

export const LooseItemModal: React.FC<Props> = ({
  product,
  language,
  onConfirm,
  onClose,
}) => {
  const t = translations[language];
  const [mode, setMode] = useState<'weight' | 'taka'>('weight');
  const [weightKg, setWeightKg] = useState<number>(1);
  const [takaAmount, setTakaAmount] = useState<number>(product.sellPrice);

  const calculateFromWeight = (kg: number) => {
    setWeightKg(kg);
    setTakaAmount(Math.round(kg * product.sellPrice * 100) / 100);
  };

  const calculateFromTaka = (taka: number) => {
    setTakaAmount(taka);
    if (product.sellPrice > 0) {
      const kg = Math.round((taka / product.sellPrice) * 1000) / 1000;
      setWeightKg(kg);
    }
  };

  const handleQuickWeight = (kg: number) => {
    calculateFromWeight(kg);
  };

  const handleQuickTaka = (amount: number) => {
    calculateFromTaka(amount);
  };

  const handleConfirm = () => {
    if (weightKg <= 0) return;
    const finalPrice = Math.round(weightKg * product.sellPrice * 100) / 100;
    onConfirm(product, weightKg, finalPrice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        {/* Product Summary Header */}
        <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={product.image}
              alt={product.name}
              className="w-14 h-14 rounded-2xl object-cover bg-white/20 border-2 border-white/30 shadow-md"
            />
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">
                {product.name}
              </h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                {language === 'bn' ? 'দর:' : 'Rate:'} ৳{product.sellPrice} / {language === 'bn' ? 'কেজি' : 'KG'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Calculation Mode Toggle */}
        <div className="p-4 space-y-4">
          <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setMode('weight')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                mode === 'weight'
                  ? 'bg-white shadow text-emerald-800 dark:bg-slate-900 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>{t.weightOption}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('taka')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                mode === 'taka'
                  ? 'bg-white shadow text-emerald-800 dark:bg-slate-900 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>{t.amountOption}</span>
            </button>
          </div>

          {/* By Weight UI */}
          {mode === 'weight' && (
            <div className="space-y-3">
              {/* Preset buttons */}
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { label: language === 'bn' ? '২৫০ গ্রাম' : '250g', val: 0.25 },
                  { label: language === 'bn' ? '৫০০ গ্রাম' : '500g', val: 0.5 },
                  { label: language === 'bn' ? '১ কেজি' : '1 KG', val: 1 },
                  { label: language === 'bn' ? '২ কেজি' : '2 KG', val: 2 },
                  { label: language === 'bn' ? '৫ কেজি' : '5 KG', val: 5 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => handleQuickWeight(item.val)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold text-center border transition ${
                      Math.abs(weightKg - item.val) < 0.001
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Weight Input Field */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t.enterWeight}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => calculateFromWeight(Math.max(0.1, Math.round((weightKg - 0.25) * 100) / 100))}
                    className="p-3 rounded-xl bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.05"
                      min="0.01"
                      value={weightKg || ''}
                      onChange={(e) => calculateFromWeight(parseFloat(e.target.value) || 0)}
                      className="w-full text-center text-2xl font-bold py-2 bg-transparent border-b-2 border-emerald-500 text-slate-900 dark:text-white focus:outline-none"
                    />
                    <span className="absolute right-2 top-3 text-xs font-semibold text-slate-400">
                      {language === 'bn' ? 'কেজি' : 'KG'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => calculateFromWeight(Math.round((weightKg + 0.25) * 100) / 100)}
                    className="p-3 rounded-xl bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* By Taka UI */}
          {mode === 'taka' && (
            <div className="space-y-3">
              {/* Preset Taka buttons */}
              <div className="grid grid-cols-5 gap-1.5">
                {[20, 50, 100, 200, 500].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleQuickTaka(amount)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold text-center border transition ${
                      takaAmount === amount
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    ৳{amount}
                  </button>
                ))}
              </div>

              {/* Taka Input Field */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t.enterAmount}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xl font-bold text-emerald-600">
                    ৳
                  </span>
                  <input
                    type="number"
                    step="5"
                    min="1"
                    value={takaAmount || ''}
                    onChange={(e) => calculateFromTaka(parseFloat(e.target.value) || 0)}
                    className="w-full text-center text-2xl font-bold py-2 bg-transparent border-b-2 border-emerald-500 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Calculation Result Summary Box */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/60 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                {t.calculatedWeight}:
              </p>
              <p className="text-base font-extrabold text-emerald-950 dark:text-emerald-100">
                {weightKg >= 1
                  ? `${weightKg.toFixed(2)} ${language === 'bn' ? 'কেজি' : 'KG'}`
                  : `${Math.round(weightKg * 1000)} ${language === 'bn' ? 'গ্রাম' : 'gm'}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                {t.calculatedPrice}:
              </p>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                ৳{Math.round(weightKg * product.sellPrice)}
              </p>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold rounded-2xl shadow-lg shadow-emerald-700/25 transition flex items-center justify-center gap-2 text-base"
          >
            <Check className="w-5 h-5 stroke-[3]" />
            <span>
              {t.addToCartBtn} (৳{Math.round(weightKg * product.sellPrice)})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
