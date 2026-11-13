import React, { useState } from 'react';
import { ArrowLeft, Delete, Equal } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculatorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [expression, setExpression] = useState<string>('');
  const [displayValue, setDisplayValue] = useState<string>('0');
  const [justEvaluated, setJustEvaluated] = useState<boolean>(false);

  if (!isOpen) return null;

  const operators = ['+', '-', '*', '/'];

  const evaluateExpression = (expr: string): string => {
    try {
      const sanitized = expr.replace(/[^0-9+\-*/.%()]/g, '');
      if (!sanitized) return '0';
      // Handle percentage expressions cleanly (e.g. 500+10% or 20%)
      const normalized = sanitized.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
      // Trim trailing operators
      const cleanExpr = normalized.replace(/[+\-*/.]+$/, '');
      if (!cleanExpr) return '0';
      // Safe arithmetic evaluation via Function after strict whitelist
      const result = Function(`"use strict"; return (${cleanExpr});`)();
      if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) {
        return 'ভুল হিসাব';
      }
      const rounded = Math.round(result * 1000000) / 1000000;
      return String(rounded);
    } catch {
      return 'ভুল হিসাব';
    }
  };

  const handleDigit = (digit: string) => {
    if (justEvaluated) {
      setExpression(digit === '.' ? '0.' : digit);
      setDisplayValue(digit === '.' ? '0.' : digit);
      setJustEvaluated(false);
      return;
    }

    if (digit === '.') {
      const parts = expression.split(/[+\-*/]/);
      const currentNum = parts[parts.length - 1] || '';
      if (currentNum.includes('.')) return;
      const nextExpr =
        expression === '' || operators.includes(expression.slice(-1))
          ? `${expression}0.`
          : `${expression}.`;
      setExpression(nextExpr);
      setDisplayValue(nextExpr);
      return;
    }

    if (expression === '0' && digit !== '.') {
      setExpression(digit);
      setDisplayValue(digit);
      return;
    }

    const nextExpr = `${expression}${digit}`;
    setExpression(nextExpr);
    setDisplayValue(nextExpr);
  };

  const handleOperator = (op: string) => {
    setJustEvaluated(false);
    if (!expression && displayValue && displayValue !== '0' && displayValue !== 'ভুল হিসাব') {
      const next = `${displayValue}${op}`;
      setExpression(next);
      setDisplayValue(next);
      return;
    }
    if (!expression) {
      if (op === '-') {
        setExpression('-');
        setDisplayValue('-');
      }
      return;
    }
    const lastChar = expression.slice(-1);
    if (operators.includes(lastChar)) {
      const next = `${expression.slice(0, -1)}${op}`;
      setExpression(next);
      setDisplayValue(next);
      return;
    }
    const next = `${expression}${op}`;
    setExpression(next);
    setDisplayValue(next);
  };

  const handlePercent = () => {
    if (!expression) return;
    const lastChar = expression.slice(-1);
    if (operators.includes(lastChar) || lastChar === '%') return;
    const next = `${expression}%`;
    setExpression(next);
    setDisplayValue(next);
  };

  const handleClear = () => {
    setExpression('');
    setDisplayValue('0');
    setJustEvaluated(false);
  };

  const handleBackspace = () => {
    if (justEvaluated) {
      handleClear();
      return;
    }
    if (!expression || expression.length <= 1) {
      setExpression('');
      setDisplayValue('0');
      return;
    }
    const next = expression.slice(0, -1);
    setExpression(next);
    setDisplayValue(next);
  };

  const handleEquals = () => {
    if (!expression) return;
    const res = evaluateExpression(expression);
    setDisplayValue(res);
    setExpression(res === 'ভুল হিসাব' ? '' : res);
    setJustEvaluated(true);
  };

  const formatForDisplay = (val: string) =>
    val.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');

  const livePreview =
    !justEvaluated && expression && /[+\-*/%]/.test(expression)
      ? evaluateExpression(expression)
      : '';

  return (
    <div className="fixed inset-0 z-50 bg-[#EDF2F7] flex flex-col">
      {/* Top Bar with prominent "← হিসাব / মেনু" back button */}
      <div className="bg-white border-b border-[#E2E8F0] px-3 py-2.5 flex items-center justify-between shadow-2xs shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] font-extrabold text-xs sm:text-sm transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>হিসাব / মেনু</span>
        </button>
        <h2 className="text-sm sm:text-base font-black text-[#102A43]">
          দোকান ক্যালকুলেটর
        </h2>
        <div className="w-20" />
      </div>

      {/* Calculator Body */}
      <div className="flex-1 flex flex-col justify-between max-w-md w-full mx-auto p-3 sm:p-4">
        {/* Display Panel */}
        <div className="bg-[#036368] text-white rounded-[24px] p-5 shadow-md flex flex-col justify-end min-h-[148px] mb-3 border border-[#024d51]">
          <div className="text-right text-sm font-semibold text-teal-100/80 min-h-[22px] break-all tabular-nums">
            {expression ? formatForDisplay(expression) : 'হিসাব লিখুন'}
          </div>
          <div className="text-right text-4xl sm:text-5xl font-black tracking-tight text-white mt-2 break-all tabular-nums">
            {formatForDisplay(displayValue)}
          </div>
          {livePreview && livePreview !== 'ভুল হিসাব' && livePreview !== displayValue && (
            <div className="text-right text-base font-bold text-amber-300 mt-1 tabular-nums">
              = {livePreview}
            </div>
          )}
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-4 gap-2.5 sm:gap-3 flex-1 max-h-[430px]">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-2xl bg-rose-100 hover:bg-rose-200 text-[#D32F2F] font-black text-xl flex items-center justify-center shadow-2xs active:scale-95 transition cursor-pointer min-h-[60px]"
          >
            C
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="rounded-2xl bg-white hover:bg-slate-100 text-[#102A43] border border-[#E2E8F0] font-bold text-xl flex items-center justify-center shadow-2xs active:scale-95 transition cursor-pointer min-h-[60px]"
            title="মুছুন"
          >
            <Delete className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={handlePercent}
            className="rounded-2xl bg-[#E0F2F1] hover:bg-[#B2DFDB] text-[#0E6B6B] font-black text-2xl flex items-center justify-center shadow-2xs active:scale-95 transition cursor-pointer min-h-[60px]"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handleOperator('/')}
            className="rounded-2xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-black text-2xl flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer min-h-[60px]"
          >
            ÷
          </button>

          {['7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="rounded-2xl bg-white hover:bg-slate-50 text-[#102A43] border border-[#E2E8F0] font-black text-2xl flex items-center justify-center shadow-2xs active:scale-95 transition cursor-pointer tabular-nums min-h-[60px]"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('*')}
            className="rounded-2xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-black text-2xl flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer min-h-[60px]"
          >
            ×
          </button>

          {['4', '5', '6'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="rounded-2xl bg-white hover:bg-slate-50 text-[#102A43] border border-[#E2E8F0] font-black text-2xl flex items-center justify-center shadow-2xs active:scale-95 transition cursor-pointer tabular-nums min-h-[60px]"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('-')}
            className="rounded-2xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-black text-2xl flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer min-h-[60px]"
          >
            −
          </button>

          {['1', '2', '3'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="rounded-2xl bg-white hover:bg-slate-50 text-[#102A43] border border-[#E2E8F0] font-black text-2xl flex items-center justify-center shadow-2xs active:scale-95 transition cursor-pointer tabular-nums min-h-[60px]"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('+')}
            className="rounded-2xl bg-[#0E6B6B] hover:bg-[#094747] text-white font-black text-2xl flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer min-h-[60px]"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => handleDigit('00')}
            className="rounded-2xl bg-white hover:bg-slate-50 text-[#102A43] border border-[#E2E8F0] font-black text-xl flex items-center justify-center shadow-2xs active:scale-95 transition cursor-pointer tabular-nums min-h-[60px]"
          >
            00
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="rounded-2xl bg-white hover:bg-slate-50 text-[#102A43] border border-[#E2E8F0] font-black text-2xl flex items-center justify-center shadow-2xs active:scale-95 transition cursor-pointer tabular-nums min-h-[60px]"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleDigit('.')}
            className="rounded-2xl bg-white hover:bg-slate-50 text-[#102A43] border border-[#E2E8F0] font-black text-2xl flex items-center justify-center shadow-2xs active:scale-95 transition cursor-pointer min-h-[60px]"
          >
            .
          </button>
          <button
            type="button"
            onClick={handleEquals}
            className="rounded-2xl bg-[#2E7D32] hover:bg-emerald-800 text-white font-black text-2xl flex items-center justify-center shadow-md active:scale-95 transition cursor-pointer min-h-[60px]"
          >
            <Equal className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
