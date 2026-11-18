import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, ChevronDown, Delete, Calculator } from 'lucide-react';
import {
  applyCalculatorKey,
  CalcKey,
  evaluateExpression,
  EvalResult,
  expressionHasMath,
  formatCalcNumber,
  formatDisplayExpression,
  normalizeDigits,
  normalizeExpression,
} from '../utils/calculatorEngine';

interface ActiveFieldState {
  id: string;
  label: string;
  expression: string;
  evalResult: EvalResult;
  allowDecimal: boolean;
  maxValue?: number;
  inputEl: HTMLInputElement | null;
  onEmitValue: (numericStr: string) => void;
}

interface RegisterFieldArgs {
  id: string;
  label: string;
  currentValueStr: string;
  allowDecimal: boolean;
  maxValue?: number;
  inputEl: HTMLInputElement | null;
  onEmitValue: (numericStr: string) => void;
}

interface CalculatorKeypadContextValue {
  isOpen: boolean;
  activeId: string | null;
  activeExpression: string;
  activeEvalResult: EvalResult;
  openField: (args: RegisterFieldArgs) => void;
  syncExternalValue: (id: string, valueStr: string) => void;
  updateActiveProps: (id: string, args: Partial<RegisterFieldArgs>) => void;
  pressKey: (key: CalcKey) => void;
  commitAndClose: () => void;
  dismissKeypad: () => void;
}

const EMPTY_EVAL: EvalResult = {
  ok: true,
  value: null,
  formatted: '',
  hasOperator: false,
};

const CalculatorKeypadContext = createContext<CalculatorKeypadContextValue | null>(null);

export function useCalculatorKeypad(): CalculatorKeypadContextValue | null {
  return useContext(CalculatorKeypadContext);
}

export const CalculatorKeypadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeField, setActiveField] = useState<ActiveFieldState | null>(null);
  const activeFieldRef = useRef<ActiveFieldState | null>(null);
  activeFieldRef.current = activeField;

  const isOpen = activeField !== null;

  // Compute safe clamped numeric string for parent React state
  const toSafeParentNumericStr = useCallback(
    (res: EvalResult, allowDecimal: boolean, maxValue?: number): string => {
      if (!res.ok || res.value === null) return '';
      let v = res.value;
      if (v < 0) v = 0;
      if (typeof maxValue === 'number' && Number.isFinite(maxValue) && v > maxValue) {
        v = maxValue;
      }
      if (!allowDecimal) {
        v = Math.round(v);
      }
      return formatCalcNumber(v);
    },
    []
  );

  // Sync body class for modal/container bottom padding so inputs are never hidden behind keypad
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('calc-keypad-open');
    } else {
      document.body.classList.remove('calc-keypad-open');
    }
    return () => {
      document.body.classList.remove('calc-keypad-open');
    };
  }, [isOpen]);

  // Expose imperative close helper for Android Back Button handler in App.tsx
  const dismissKeypad = useCallback(() => {
    const cur = activeFieldRef.current;
    if (!cur) return;
    if (cur.inputEl && document.activeElement === cur.inputEl) {
      cur.inputEl.blur();
    }
    activeFieldRef.current = null;
    setActiveField(null);
  }, []);

  const commitAndClose = useCallback(() => {
    const cur = activeFieldRef.current;
    if (!cur) return;

    const evaluated = evaluateExpression(cur.expression);
    if (evaluated.ok && evaluated.value !== null) {
      const safeStr = toSafeParentNumericStr(evaluated, cur.allowDecimal, cur.maxValue);
      cur.onEmitValue(safeStr);
    } else if (!evaluated.ok) {
      cur.onEmitValue('0');
    }

    if (cur.inputEl && document.activeElement === cur.inputEl) {
      cur.inputEl.blur();
    }
    activeFieldRef.current = null;
    setActiveField(null);
  }, [toSafeParentNumericStr]);

  useEffect(() => {
    (window as any).__sdDismissCalculatorKeypad = () => {
      if (activeFieldRef.current) {
        commitAndClose();
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__sdDismissCalculatorKeypad;
    };
  }, [commitAndClose]);

  const openField = useCallback((args: RegisterFieldArgs) => {
    if (activeFieldRef.current?.id === args.id) return;
    const cleanInit = normalizeExpression(args.currentValueStr || '');
    const evalRes = evaluateExpression(cleanInit);
    const nextState: ActiveFieldState = {
      id: args.id,
      label: args.label,
      expression: cleanInit,
      evalResult: evalRes,
      allowDecimal: args.allowDecimal,
      maxValue: args.maxValue,
      inputEl: args.inputEl,
      onEmitValue: args.onEmitValue,
    };
    activeFieldRef.current = nextState;
    setActiveField(nextState);

    // Ensure focused input stays smoothly scrolled above the bottom sheet
    if (args.inputEl) {
      setTimeout(() => {
        try {
          args.inputEl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch (_) {}
      }, 90);
    }
  }, []);

  const updateActiveProps = useCallback((id: string, args: Partial<RegisterFieldArgs>) => {
    const cur = activeFieldRef.current;
    if (!cur || cur.id !== id) return;

    const nextLabel = args.label !== undefined ? args.label : cur.label;
    const nextAllowDecimal = args.allowDecimal !== undefined ? args.allowDecimal : cur.allowDecimal;
    const nextMaxValue = args.maxValue !== undefined ? args.maxValue : cur.maxValue;
    const nextInputEl = args.inputEl !== undefined ? args.inputEl : cur.inputEl;
    const nextOnEmitValue = args.onEmitValue !== undefined ? args.onEmitValue : cur.onEmitValue;

    const uiChanged = nextLabel !== cur.label || nextAllowDecimal !== cur.allowDecimal;
    const refChanged =
      uiChanged ||
      nextMaxValue !== cur.maxValue ||
      nextInputEl !== cur.inputEl ||
      nextOnEmitValue !== cur.onEmitValue;

    if (!refChanged) return;

    const updated: ActiveFieldState = {
      ...cur,
      label: nextLabel,
      allowDecimal: nextAllowDecimal,
      maxValue: nextMaxValue,
      inputEl: nextInputEl,
      onEmitValue: nextOnEmitValue,
    };
    activeFieldRef.current = updated;
    if (uiChanged) {
      setActiveField(updated);
    }
  }, []);

  const syncExternalValue = useCallback((id: string, valueStr: string) => {
    const cur = activeFieldRef.current;
    if (!cur || cur.id !== id) return;
    const normIncoming = normalizeExpression(valueStr);
    const curSafe = cur.evalResult.ok && cur.evalResult.value !== null ? cur.evalResult.formatted : '';
    // If parent value cleared to empty or changed externally (e.g. "+৳100" preset button)
    if (normIncoming === '' && cur.expression !== '') {
      const nextState: ActiveFieldState = {
        ...cur,
        expression: '',
        evalResult: EMPTY_EVAL,
      };
      activeFieldRef.current = nextState;
      setActiveField(nextState);
      return;
    }
    if (cur.expression === '' && normIncoming === '0') {
      return;
    }
    if (normIncoming !== curSafe && !expressionHasMath(cur.expression)) {
      const nextState: ActiveFieldState = {
        ...cur,
        expression: normIncoming,
        evalResult: evaluateExpression(normIncoming),
      };
      activeFieldRef.current = nextState;
      setActiveField(nextState);
    }
  }, []);

  const pressKey = useCallback(
    (key: CalcKey) => {
      const cur = activeFieldRef.current;
      if (!cur) return;

      const { nextExpr, evalResult } = applyCalculatorKey(cur.expression, key, {
        allowDecimal: cur.allowDecimal,
        allowNegativeResult: false,
        maxValue: cur.maxValue,
      });

      const nextState: ActiveFieldState = {
        ...cur,
        expression: nextExpr,
        evalResult,
      };
      activeFieldRef.current = nextState;
      setActiveField(nextState);

      if (nextExpr === '') {
        cur.onEmitValue('');
      } else if (evalResult.ok && evalResult.value !== null) {
        const safeStr = toSafeParentNumericStr(evalResult, cur.allowDecimal, cur.maxValue);
        cur.onEmitValue(safeStr);
      } else if (!evalResult.ok) {
        cur.onEmitValue('0');
      }
    },
    [toSafeParentNumericStr]
  );

  // Global listeners:
  // 1) Immediately hide keypad when user switches focus to ANY text/name/phone/PIN/date input or select
  // 2) Dismiss cleanly when parent form submits or when user taps non-interactive blank backdrop
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore focus inside the keypad itself
      if (target.closest('[data-calc-keypad="true"]')) return;

      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if ((target as HTMLElement).dataset.calcInput !== 'true') {
          // Immediately hide so native Bengali/English/Phone/PIN/Date keyboard opens cleanly
          const cur = activeFieldRef.current;
          if (cur) {
            const evaluated = evaluateExpression(cur.expression);
            if (evaluated.ok && evaluated.value !== null) {
              const safeStr = toSafeParentNumericStr(evaluated, cur.allowDecimal, cur.maxValue);
              cur.onEmitValue(safeStr);
            }
          }
          activeFieldRef.current = null;
          setActiveField(null);
        }
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-calc-keypad="true"]')) return;
      if (target.closest('[data-calc-input="true"]')) return;
      // Do not close prematurely on button/label/interactive taps so layout doesn't jump mid-click
      if (target.closest('button, a, label, input, select, textarea, summary')) return;
      commitAndClose();
    };

    const handleFormSubmit = () => {
      commitAndClose();
    };

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('submit', handleFormSubmit, true);

    // Watch if active input got unmounted (e.g. modal closed via Cancel or Save button click)
    const pollUnmount = window.setInterval(() => {
      const cur = activeFieldRef.current;
      if (cur && cur.inputEl && !cur.inputEl.isConnected) {
        activeFieldRef.current = null;
        setActiveField(null);
      }
    }, 250);

    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('submit', handleFormSubmit, true);
      window.clearInterval(pollUnmount);
    };
  }, [isOpen, commitAndClose, toSafeParentNumericStr]);

  const activeId = activeField?.id ?? null;
  const activeExpression = activeField?.expression ?? '';
  const activeEvalResult = activeField?.evalResult ?? EMPTY_EVAL;

  const contextValue = useMemo<CalculatorKeypadContextValue>(
    () => ({
      isOpen,
      activeId,
      activeExpression,
      activeEvalResult,
      openField,
      syncExternalValue,
      updateActiveProps,
      pressKey,
      commitAndClose,
      dismissKeypad,
    }),
    [
      isOpen,
      activeId,
      activeExpression,
      activeEvalResult,
      openField,
      syncExternalValue,
      updateActiveProps,
      pressKey,
      commitAndClose,
      dismissKeypad,
    ]
  );

  const displayExpr = activeField ? formatDisplayExpression(activeField.expression) : '';
  const hasMath = activeField ? expressionHasMath(activeField.expression) : false;
  const evalRes = activeField?.evalResult ?? EMPTY_EVAL;

  return (
    <CalculatorKeypadContext.Provider value={contextValue}>
      {children}

      {isOpen && activeField && (
        <div
          data-calc-keypad="true"
          onMouseDown={(e) => e.preventDefault()}
          className="no-print fixed inset-x-0 bottom-0 z-[120] pointer-events-none flex justify-center"
        >
          <div
            data-calc-keypad="true"
            onMouseDown={(e) => e.preventDefault()}
            className="pointer-events-auto w-full max-w-md md:max-w-lg bg-white border-t-2 border-x border-[#0E6B6B]/25 rounded-t-3xl md:mb-2 md:rounded-3xl shadow-[0_-12px_36px_rgba(16,42,67,0.18)] overflow-hidden animate-in slide-in-from-bottom-4 duration-150 pb-[max(8px,env(safe-area-inset-bottom))]"
          >
            {/* Compact Top Bar: Field label + Live math expression + Live Result + Done/Hide */}
            <div className="px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-[#0E6B6B] shrink-0" />
                  <span className="text-[11px] font-extrabold text-[#64748B] truncate">
                    {activeField.label || 'হিসাব ক্যালকুলেটর'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5 min-w-0">
                  <span className="text-sm font-black text-[#102A43] tabular-nums truncate">
                    {displayExpr || '০'}
                  </span>
                  {!evalRes.ok && evalRes.error && (
                    <span className="text-[11px] font-extrabold text-[#D32F2F] shrink-0">
                      ({evalRes.error})
                    </span>
                  )}
                  {evalRes.ok && hasMath && evalRes.value !== null && (
                    <span className="text-xs font-black text-[#0E6B6B] bg-[#E0F2F1] px-2 py-0.5 rounded-lg border border-[#B2DFDB] tabular-nums shrink-0">
                      = ৳{evalRes.formatted}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={commitAndClose}
                  className="h-9 px-3 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] text-white text-xs font-black flex items-center gap-1 shadow-xs active:scale-95 transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Done</span>
                </button>
                <button
                  type="button"
                  onClick={commitAndClose}
                  aria-label="ক্যালকুলেটর নামান"
                  title="ক্যালকুলেটর বন্ধ করুন"
                  className="w-9 h-9 rounded-xl bg-[#EDF2F7] hover:bg-[#E2E8F0] text-[#102A43] flex items-center justify-center active:scale-95 transition cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Clean 4x5 Touch Keypad Grid */}
            <div className="p-2 bg-[#F1F5F9] grid grid-cols-4 gap-1.5 select-none">
              {/* Row 1: AC | % | ÷ | × */}
              <button
                type="button"
                onClick={() => pressKey('AC')}
                className="h-11 sm:h-12 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[#D32F2F] font-black text-sm tracking-wide flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
              >
                AC
              </button>
              <button
                type="button"
                onClick={() => pressKey('%')}
                className="h-11 sm:h-12 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB]/70 border border-[#B2DFDB] text-[#0E6B6B] font-black text-base flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
              >
                %
              </button>
              <button
                type="button"
                onClick={() => pressKey('÷')}
                className="h-11 sm:h-12 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB]/70 border border-[#B2DFDB] text-[#0E6B6B] font-black text-xl flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
              >
                ÷
              </button>
              <button
                type="button"
                onClick={() => pressKey('×')}
                className="h-11 sm:h-12 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB]/70 border border-[#B2DFDB] text-[#0E6B6B] font-black text-xl flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
              >
                ×
              </button>

              {/* Row 2: 7 | 8 | 9 | - */}
              {(['7', '8', '9'] as CalcKey[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => pressKey(d)}
                  className="h-11 sm:h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#102A43] font-black text-lg tabular-nums flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => pressKey('-')}
                className="h-11 sm:h-12 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB]/70 border border-[#B2DFDB] text-[#0E6B6B] font-black text-2xl flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
              >
                −
              </button>

              {/* Row 3: 4 | 5 | 6 | + */}
              {(['4', '5', '6'] as CalcKey[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => pressKey(d)}
                  className="h-11 sm:h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#102A43] font-black text-lg tabular-nums flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => pressKey('+')}
                className="h-11 sm:h-12 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB]/70 border border-[#B2DFDB] text-[#0E6B6B] font-black text-2xl flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
              >
                +
              </button>

              {/* Row 4: 1 | 2 | 3 | = */}
              {(['1', '2', '3'] as CalcKey[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => pressKey(d)}
                  className="h-11 sm:h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#102A43] font-black text-lg tabular-nums flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => pressKey('=')}
                className="h-11 sm:h-12 rounded-xl bg-[#0E6B6B] hover:bg-[#094747] border border-[#0E6B6B] text-white font-black text-xl flex items-center justify-center active:scale-95 transition cursor-pointer shadow-sm"
              >
                =
              </button>

              {/* Row 5: ⌫ | 0 | 00 | . */}
              <button
                type="button"
                onClick={() => pressKey('BACKSPACE')}
                aria-label="মুছুন"
                className="h-11 sm:h-12 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-black flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
              >
                <Delete className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => pressKey('0')}
                className="h-11 sm:h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#102A43] font-black text-lg tabular-nums flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => pressKey('00')}
                className="h-11 sm:h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#102A43] font-black text-base tabular-nums flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xs"
              >
                00
              </button>
              <button
                type="button"
                onClick={() => pressKey('.')}
                disabled={!activeField.allowDecimal}
                className={`h-11 sm:h-12 rounded-xl border font-black text-2xl flex items-center justify-center transition shadow-2xs ${
                  activeField.allowDecimal
                    ? 'bg-white hover:bg-slate-50 border-[#E2E8F0] text-[#102A43] active:scale-95 cursor-pointer'
                    : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                }`}
              >
                .
              </button>
            </div>
          </div>
        </div>
      )}
    </CalculatorKeypadContext.Provider>
  );
};

export interface CalculatorInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  value: string | number | undefined;
  onValueChange: (val: string) => void;
  calcLabel?: string;
  allowDecimal?: boolean;
  maxValue?: number;
}

/**
 * Drop-in numeric/amount input wired to Sahoj Dokan's In-Built Calculator Keypad.
 * - Uses inputMode="none" to suppress Android/iOS soft keyboards on mobile
 * - Supports full physical keyboard typing on desktop
 * - Auto-commits evaluated numeric values to parent React state so accounting formulas stay 100% intact
 */
export const CalculatorInput = React.forwardRef<HTMLInputElement, CalculatorInputProps>(
  (
    {
      value,
      onValueChange,
      calcLabel = 'টাকা / সংখ্যা',
      allowDecimal = true,
      maxValue,
      onFocus,
      onClick,
      onKeyDown,
      className = '',
      disabled,
      readOnly,
      ...rest
    },
    forwardedRef
  ) => {
    const fieldId = useId();
    const internalRef = useRef<HTMLInputElement | null>(null);
    const ctx = useCalculatorKeypad();

    const propStr =
      value === undefined || value === null || (typeof value === 'number' && Number.isNaN(value))
        ? ''
        : String(value);
    const isActive = Boolean(ctx && ctx.isOpen && ctx.activeId === fieldId);

    // Keep latest callback/prop refs so keypad presses never read stale closures
    const emitRef = useRef(onValueChange);
    emitRef.current = onValueChange;

    const stableEmit = useCallback((numStr: string) => {
      emitRef.current(numStr);
    }, []);

    const updateActivePropsFn = ctx?.updateActiveProps;
    const syncExternalValueFn = ctx?.syncExternalValue;

    // Keep active field props updated
    useEffect(() => {
      if (isActive && updateActivePropsFn) {
        updateActivePropsFn(fieldId, {
          label: calcLabel,
          allowDecimal,
          maxValue,
          inputEl: internalRef.current,
          onEmitValue: stableEmit,
        });
      }
    }, [isActive, updateActivePropsFn, fieldId, calcLabel, allowDecimal, maxValue, stableEmit]);

    // Sync external value changes (e.g. "+৳100" quick chips, "Clear" button, "সব বাকি")
    useEffect(() => {
      if (isActive && syncExternalValueFn) {
        syncExternalValueFn(fieldId, propStr);
      }
    }, [isActive, syncExternalValueFn, fieldId, propStr]);

    const activateKeypad = () => {
      if (!ctx || disabled || readOnly) return;
      ctx.openField({
        id: fieldId,
        label: calcLabel,
        currentValueStr: propStr,
        allowDecimal,
        maxValue,
        inputEl: internalRef.current,
        onEmitValue: stableEmit,
      });
    };

    const setRefs = (el: HTMLInputElement | null) => {
      internalRef.current = el;
      if (typeof forwardedRef === 'function') {
        forwardedRef(el);
      } else if (forwardedRef) {
        forwardedRef.current = el;
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled || readOnly || !ctx) {
        onKeyDown?.(e);
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key;
        if (k >= '0' && k <= '9') {
          e.preventDefault();
          ctx.pressKey(k as CalcKey);
          return;
        }
        if (k === '.' && allowDecimal) {
          e.preventDefault();
          ctx.pressKey('.');
          return;
        }
        if (k === '+' || k === '-') {
          e.preventDefault();
          ctx.pressKey(k as CalcKey);
          return;
        }
        if (k === '*') {
          e.preventDefault();
          ctx.pressKey('×');
          return;
        }
        if (k === '/') {
          e.preventDefault();
          ctx.pressKey('÷');
          return;
        }
        if (k === '%') {
          e.preventDefault();
          ctx.pressKey('%');
          return;
        }
        if (k === 'Backspace') {
          e.preventDefault();
          ctx.pressKey('BACKSPACE');
          return;
        }
        if (k === 'Escape') {
          e.preventDefault();
          ctx.commitAndClose();
          return;
        }
        if (k === 'Enter') {
          if (expressionHasMath(ctx.activeExpression)) {
            e.preventDefault();
            ctx.pressKey('=');
            return;
          }
          // Already evaluated simple number -> let parent form Enter handler run
          ctx.commitAndClose();
          onKeyDown?.(e);
          return;
        }
      }

      onKeyDown?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Fallback for clipboard paste or non-keydown input events
      const raw = normalizeDigits(e.target.value).replace(/[^0-9.]/g, '');
      const parts = raw.split('.');
      const sanitized = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : raw;
      onValueChange(sanitized);
    };

    const displayValue = isActive
      ? formatDisplayExpression(ctx!.activeExpression)
      : propStr;

    return (
      <input
        {...rest}
        ref={setRefs}
        type="text"
        inputMode="none"
        autoComplete="off"
        data-calc-input="true"
        disabled={disabled}
        readOnly={readOnly}
        value={displayValue}
        onFocus={(e) => {
          activateKeypad();
          onFocus?.(e);
        }}
        onClick={(e) => {
          if (!isActive) activateKeypad();
          onClick?.(e);
        }}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        className={`${className} ${
          isActive ? 'ring-2 ring-[#0E6B6B]/40 border-[#0E6B6B]' : ''
        }`.trim()}
      />
    );
  }
);

CalculatorInput.displayName = 'CalculatorInput';
