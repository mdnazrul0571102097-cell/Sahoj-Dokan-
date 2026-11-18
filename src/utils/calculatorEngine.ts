export type CalcOperator = '+' | '-' | '×' | '÷';

interface NumToken {
  type: 'num';
  val: number;
  isPercent: boolean;
}

interface OpToken {
  type: 'op';
  op: CalcOperator;
}

type Token = NumToken | OpToken;

export interface EvalResult {
  ok: boolean;
  value: number | null;
  formatted: string;
  hasOperator: boolean;
  error?: string;
}

const BN_TO_EN: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function normalizeDigits(input: string): string {
  return input.replace(/[০-৯]/g, (ch) => BN_TO_EN[ch] ?? ch);
}

export function formatCalcNumber(num: number): string {
  if (!Number.isFinite(num)) return '0';
  const rounded = Math.round(num * 10000) / 10000;
  if (Object.is(rounded, -0)) return '0';
  return String(rounded);
}

export function normalizeExpression(raw: string): string {
  return normalizeDigits(raw)
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/\s+/g, '');
}

/**
 * Checks whether the normalized expression contains any operator (+, -, ×, ÷) or %.
 */
export function expressionHasMath(expr: string): boolean {
  const norm = normalizeExpression(expr);
  return /[+\-×÷%]/.test(norm);
}

/**
 * Splits expression into number/percent tokens and operator tokens.
 * Safely strips any trailing incomplete operator (e.g. "500 + " -> "500").
 */
function tokenizeExpression(expr: string): Token[] {
  const norm = normalizeExpression(expr);
  if (!norm) return [];

  const tokens: Token[] = [];
  let i = 0;

  while (i < norm.length) {
    const ch = norm[i];

    if (ch === '+' || ch === '-' || ch === '×' || ch === '÷') {
      // Allow leading negative sign only if first token
      if (tokens.length === 0 && ch === '-') {
        let j = i + 1;
        while (j < norm.length && /[0-9.]/.test(norm[j])) j++;
        if (j > i + 1) {
          let isPercent = false;
          if (norm[j] === '%') {
            isPercent = true;
            j++;
          }
          const numStr = norm.slice(i, isPercent ? j - 1 : j);
          const parsed = parseFloat(numStr);
          if (!Number.isNaN(parsed)) {
            tokens.push({ type: 'num', val: parsed, isPercent });
            i = j;
            continue;
          }
        }
      }

      if (tokens.length > 0 && tokens[tokens.length - 1].type === 'op') {
        // Replace duplicate consecutive operator cleanly
        (tokens[tokens.length - 1] as OpToken).op = ch;
      } else if (tokens.length > 0) {
        tokens.push({ type: 'op', op: ch });
      }
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let j = i;
      let dotSeen = false;
      while (j < norm.length && /[0-9.]/.test(norm[j])) {
        if (norm[j] === '.') {
          if (dotSeen) break;
          dotSeen = true;
        }
        j++;
      }
      let isPercent = false;
      if (j < norm.length && norm[j] === '%') {
        isPercent = true;
        j++;
      }
      const rawNum = norm.slice(i, isPercent ? j - 1 : j);
      const parsed = rawNum === '.' ? 0 : parseFloat(rawNum);
      if (!Number.isNaN(parsed)) {
        tokens.push({ type: 'num', val: parsed, isPercent });
      }
      i = j;
      continue;
    }

    i++;
  }

  // Strip trailing operator for safe live/incomplete evaluation
  while (tokens.length > 0 && tokens[tokens.length - 1].type === 'op') {
    tokens.pop();
  }

  return tokens;
}

/**
 * Evaluates mathematical expressions with standard precedence AND shopkeeper percentage logic:
 * - "500 + 250 - 50" -> 700
 * - "120 + 250 × 2" -> 620
 * - "1000 - 10%" -> 900
 * - "1000 + 5%" -> 1050
 * - "200 × 10%" -> 20
 * - "50%" -> 0.5
 * - "100 ÷ 0" -> safe division by zero error
 */
export function evaluateExpression(expr: string): EvalResult {
  const norm = normalizeExpression(expr);
  const hasOperator = /[+\-×÷%]/.test(norm);

  if (!norm) {
    return { ok: true, value: null, formatted: '', hasOperator: false };
  }

  const tokens = tokenizeExpression(norm);
  if (tokens.length === 0) {
    return { ok: true, value: null, formatted: '', hasOperator };
  }

  // Pass 1: Resolve × and ÷ with precedence
  const pass1: Token[] = [];
  let idx = 0;
  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (tok.type === 'op' && (tok.op === '×' || tok.op === '÷')) {
      const left = pass1.pop() as NumToken | undefined;
      const right = tokens[idx + 1] as NumToken | undefined;
      if (!left || !right || right.type !== 'num') {
        idx++;
        continue;
      }

      const leftVal = left.isPercent ? left.val / 100 : left.val;
      const rightVal = right.isPercent ? right.val / 100 : right.val;

      if (tok.op === '×') {
        pass1.push({
          type: 'num',
          val: leftVal * rightVal,
          isPercent: false,
        });
      } else {
        if (rightVal === 0) {
          return {
            ok: false,
            value: 0,
            formatted: '0',
            hasOperator,
            error: '০ দিয়ে ভাগ করা যায় না',
          };
        }
        pass1.push({
          type: 'num',
          val: leftVal / rightVal,
          isPercent: false,
        });
      }
      idx += 2;
    } else {
      pass1.push(tok);
      idx++;
    }
  }

  // Pass 2: Left-to-right + and - (applying % relative to running accumulated value)
  const first = pass1[0];
  if (!first || first.type !== 'num') {
    return { ok: true, value: null, formatted: '', hasOperator };
  }

  let acc = first.isPercent ? first.val / 100 : first.val;
  let k = 1;
  while (k < pass1.length) {
    const opTok = pass1[k];
    const numTok = pass1[k + 1];
    if (opTok?.type === 'op' && numTok?.type === 'num') {
      const delta = numTok.isPercent ? (acc * numTok.val) / 100 : numTok.val;
      if (opTok.op === '+') {
        acc += delta;
      } else if (opTok.op === '-') {
        acc -= delta;
      }
    }
    k += 2;
  }

  if (!Number.isFinite(acc)) {
    return {
      ok: false,
      value: 0,
      formatted: '0',
      hasOperator,
      error: 'সঠিক সংখ্যা দিন',
    };
  }

  const formatted = formatCalcNumber(acc);
  return {
    ok: true,
    value: Number(formatted),
    formatted,
    hasOperator,
  };
}

/**
 * Formats compact expression for top display bar with readable spacing around operators.
 */
export function formatDisplayExpression(expr: string): string {
  const norm = normalizeExpression(expr);
  if (!norm) return '';
  return norm.replace(/([+\-×÷])/g, ' $1 ').trim();
}

/**
 * Returns the trailing numeric token (since the last operator) so decimal/zero guards work accurately.
 */
function getLastNumberSegment(norm: string): string {
  const match = norm.match(/[^+\-×÷]*$/);
  return match ? match[0] : '';
}

export type CalcKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '00'
  | '.'
  | '+'
  | '-'
  | '×'
  | '÷'
  | '%'
  | 'AC'
  | 'BACKSPACE'
  | '=';

export interface ApplyKeyOptions {
  allowDecimal?: boolean;
  allowNegativeResult?: boolean;
  maxValue?: number;
}

/**
 * Applies a single calculator key to the current raw expression string.
 * Enforces:
 * - No multiple decimals in the same number token (e.g. 12..5 blocked)
 * - No stacked operators (replaces previous operator cleanly)
 * - No leading redundant zeros ("00" on empty -> "0")
 * - Clean "=" evaluation & AC / Backspace handling
 */
export function applyCalculatorKey(
  currentExpr: string,
  key: CalcKey,
  options: ApplyKeyOptions = {}
): { nextExpr: string; evalResult: EvalResult; justEvaluated: boolean } {
  const { allowDecimal = true, allowNegativeResult = false, maxValue } = options;
  let norm = normalizeExpression(currentExpr);

  if (key === 'AC') {
    return {
      nextExpr: '',
      evalResult: evaluateExpression(''),
      justEvaluated: false,
    };
  }

  if (key === 'BACKSPACE') {
    norm = norm.slice(0, -1);
    return {
      nextExpr: norm,
      evalResult: evaluateExpression(norm),
      justEvaluated: false,
    };
  }

  if (key === '=') {
    const res = evaluateExpression(norm);
    if (!res.ok) {
      return { nextExpr: norm, evalResult: res, justEvaluated: false };
    }
    if (res.value === null) {
      return { nextExpr: '', evalResult: res, justEvaluated: true };
    }
    let finalVal = res.value;
    if (!allowNegativeResult && finalVal < 0) finalVal = 0;
    if (typeof maxValue === 'number' && Number.isFinite(maxValue) && finalVal > maxValue) {
      finalVal = maxValue;
    }
    if (!allowDecimal) {
      finalVal = Math.round(finalVal);
    }
    const cleanStr = formatCalcNumber(finalVal);
    return {
      nextExpr: cleanStr,
      evalResult: {
        ok: true,
        value: Number(cleanStr),
        formatted: cleanStr,
        hasOperator: false,
      },
      justEvaluated: true,
    };
  }

  // Operators
  if (key === '+' || key === '-' || key === '×' || key === '÷') {
    if (!norm) {
      return { nextExpr: '', evalResult: evaluateExpression(''), justEvaluated: false };
    }
    const lastChar = norm[norm.length - 1];
    if (lastChar === '+' || lastChar === '-' || lastChar === '×' || lastChar === '÷') {
      // Replace trailing operator instead of stacking
      const replaced = norm.slice(0, -1) + key;
      return { nextExpr: replaced, evalResult: evaluateExpression(replaced), justEvaluated: false };
    }
    if (lastChar === '.') {
      norm = norm.slice(0, -1);
      if (!norm) {
        return { nextExpr: '', evalResult: evaluateExpression(''), justEvaluated: false };
      }
    }
    const next = norm + key;
    return { nextExpr: next, evalResult: evaluateExpression(next), justEvaluated: false };
  }

  // Percentage
  if (key === '%') {
    if (!norm) {
      return { nextExpr: '', evalResult: evaluateExpression(''), justEvaluated: false };
    }
    const lastSeg = getLastNumberSegment(norm);
    if (!lastSeg || lastSeg.endsWith('%')) {
      return { nextExpr: norm, evalResult: evaluateExpression(norm), justEvaluated: false };
    }
    const lastChar = norm[norm.length - 1];
    if (lastChar === '+' || lastChar === '-' || lastChar === '×' || lastChar === '÷') {
      return { nextExpr: norm, evalResult: evaluateExpression(norm), justEvaluated: false };
    }
    const cleanNorm = lastChar === '.' ? norm.slice(0, -1) : norm;
    const next = cleanNorm + '%';
    return { nextExpr: next, evalResult: evaluateExpression(next), justEvaluated: false };
  }

  // Decimal point
  if (key === '.') {
    if (!allowDecimal) {
      return { nextExpr: norm, evalResult: evaluateExpression(norm), justEvaluated: false };
    }
    const lastSeg = getLastNumberSegment(norm);
    if (lastSeg.includes('.') || lastSeg.endsWith('%')) {
      return { nextExpr: norm, evalResult: evaluateExpression(norm), justEvaluated: false };
    }
    const next = lastSeg === '' ? norm + '0.' : norm + '.';
    return { nextExpr: next, evalResult: evaluateExpression(next), justEvaluated: false };
  }

  // Digits ('0'-'9' or '00')
  const lastSeg = getLastNumberSegment(norm);
  if (lastSeg.endsWith('%')) {
    return { nextExpr: norm, evalResult: evaluateExpression(norm), justEvaluated: false };
  }

  // Limit single token length to avoid overflow
  if (lastSeg.replace('.', '').length >= 12) {
    return { nextExpr: norm, evalResult: evaluateExpression(norm), justEvaluated: false };
  }

  let next = norm;
  if (key === '00') {
    if (lastSeg === '' || lastSeg === '0') {
      next = lastSeg === '' ? norm + '0' : norm;
    } else {
      next = norm + '00';
    }
  } else if (lastSeg === '0') {
    // Replace single leading '0' with typed digit (unless '0' again)
    next = key === '0' ? norm : norm.slice(0, -1) + key;
  } else {
    next = norm + key;
  }

  return {
    nextExpr: next,
    evalResult: evaluateExpression(next),
    justEvaluated: false,
  };
}
