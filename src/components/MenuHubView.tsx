import React, { useMemo } from 'react';
import {
  Sale,
  BakiTransaction,
  PurchaseRecord,
  BulkPurchase,
  SupplierTransaction,
  Expense,
  OwnerTransaction,
  OtherCashEntry,
  DailyCashReconciliation,
} from '../types';
import {
  Calendar,
  Package,
  ShoppingCart,
  TrendingUp,
  Wallet,
  UserCheck,
  Users,
  Building2,
  Landmark,
  BarChart3,
  Calculator,
} from 'lucide-react';

export type MenuTileTarget =
  | 'products'
  | 'bulkPurchases'
  | 'salesProfit'
  | 'expenses'
  | 'ownerCapital'
  | 'customersDue'
  | 'suppliersDue'
  | 'cashBox'
  | 'allReports'
  | 'calculator';

interface Props {
  sales: Sale[];
  bakiTransactions: BakiTransaction[];
  purchases: PurchaseRecord[];
  bulkPurchases: BulkPurchase[];
  supplierTransactions: SupplierTransaction[];
  expenses: Expense[];
  ownerTransactions: OwnerTransaction[];
  otherCashEntries: OtherCashEntry[];
  dailyReconciliations: DailyCashReconciliation[];
  initialOpeningCash: number;
  onSelectTile: (target: MenuTileTarget) => void;
}

const getLocalDateStr = (d?: string | Date): string => {
  if (!d) return '';
  try {
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(dt.getTime())) return typeof d === 'string' ? d.slice(0, 10) : '';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return typeof d === 'string' ? d.slice(0, 10) : '';
  }
};

const toBanglaDigits = (value: string | number): string => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(value).replace(/\d/g, (d) => digits[Number(d)]);
};

const formatBanglaDate = (date: Date): string => {
  const monthsBn = [
    'জানুয়ারি',
    'ফেব্রুয়ারি',
    'মার্চ',
    'এপ্রিল',
    'মে',
    'জুন',
    'জুলাই',
    'আগস্ট',
    'সেপ্টেম্বর',
    'অক্টোবর',
    'নভেম্বর',
    'ডিসেম্বর',
  ];
  const day = toBanglaDigits(date.getDate());
  const month = monthsBn[date.getMonth()] || '';
  const year = toBanglaDigits(date.getFullYear());
  return `${day} ${month}, ${year}`;
};

export const MenuHubView: React.FC<Props> = ({
  sales,
  bakiTransactions,
  purchases,
  bulkPurchases,
  supplierTransactions,
  expenses,
  ownerTransactions,
  otherCashEntries,
  dailyReconciliations,
  initialOpeningCash,
  onSelectTile,
}) => {
  const today = new Date();
  const todayStr = getLocalDateStr(today);
  const bengaliDateStr = formatBanglaDate(today);

  const matchesDate = (rawDate: string | undefined, targetDate: string): boolean => {
    if (!rawDate) return false;
    return getLocalDateStr(rawDate) === targetDate || rawDate.slice(0, 10) === targetDate;
  };

  // Compute Today's Total Sales & Live Cash Box Balance (identical carry-forward formula to CashReconciliationManager)
  const { todaySalesTotal, rawCashBalance } = useMemo(() => {
    const todaySalesList = sales.filter((s) => matchesDate(s.date, todayStr));
    const todaySalesAmt = Math.round(
      todaySalesList.reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0)
    );

    const computeDayFlows = (dateStr: string) => {
      const cashSales = Math.round(
        sales
          .filter((s) => matchesDate(s.date, dateStr))
          .reduce((sum, s) => {
            if (s.id?.startsWith('return_') || (s.grandTotal || 0) < 0 || (s.paidAmount || 0) < 0) {
              const refundCash =
                s.paidAmount !== undefined && s.paidAmount !== 0
                  ? s.paidAmount
                  : (s.grandTotal || 0) !== 0
                  ? s.grandTotal
                  : s.profit || 0;
              return sum + refundCash;
            }
            return sum + Math.max(0, (s.grandTotal || 0) - (s.dueAmount || 0));
          }, 0)
      );

      const customerDueCollected = Math.round(
        bakiTransactions
          .filter((tx) => tx.type === 'payment_received' && matchesDate(tx.date, dateStr))
          .reduce((sum, tx) => sum + (tx.amount || 0), 0)
      );

      const ownerNewCapital = Math.round(
        ownerTransactions
          .filter((tx) => tx.type === 'capital_deposit' && matchesDate(tx.date, dateStr))
          .reduce((sum, tx) => sum + (tx.amount || 0), 0)
      );

      const ownerWithdrawalReturn = Math.round(
        ownerTransactions
          .filter((tx) => tx.type === 'withdrawal_return' && matchesDate(tx.date, dateStr))
          .reduce((sum, tx) => sum + (tx.amount || 0), 0)
      );

      const otherCashIn = Math.round(
        otherCashEntries
          .filter(
            (e) => e.type === 'cash_in' && !e.isPostCloseAdjustment && matchesDate(e.date, dateStr)
          )
          .reduce((sum, e) => sum + (e.amount || 0), 0)
      );

      const rawBulkCashPaid = bulkPurchases
        .filter((bp) => matchesDate(bp.date, dateStr))
        .reduce(
          (sum, bp) =>
            sum +
            Math.max(
              0,
              bp.paidAmount !== undefined
                ? bp.paidAmount
                : (bp.totalAmount || 0) - (bp.dueAmount || 0)
            ),
          0
        );

      let dayReturnedCash = 0;
      bulkPurchases.forEach((bp) => {
        if (bp.returns && bp.returns.length > 0) {
          bp.returns.forEach((ret) => {
            if (matchesDate(ret.date, dateStr)) {
              dayReturnedCash += Number(ret.amount) || 0;
            }
          });
        } else if (matchesDate(bp.date, dateStr) && bp.returnedAmount) {
          dayReturnedCash += Number(bp.returnedAmount) || 0;
        }
      });

      const directPurchasePaid = purchases
        .filter((p) => matchesDate(p.date, dateStr))
        .reduce((sum, p) => sum + (p.totalCost || 0), 0);

      const cashPurchases = Math.round(rawBulkCashPaid + directPurchasePaid);

      const shopExpenses = Math.round(
        expenses
          .filter((exp) => matchesDate(exp.date, dateStr))
          .reduce((sum, exp) => sum + (exp.amount || 0), 0)
      );

      const supplierDuePaid = Math.round(
        supplierTransactions
          .filter(
            (stx) =>
              (stx.type === 'payment_made' || stx.type === 'payment_given') &&
              matchesDate(stx.date, dateStr)
          )
          .reduce((sum, stx) => sum + (stx.amount || 0), 0)
      );

      const ownerWithdrawal = Math.round(
        ownerTransactions
          .filter((tx) => tx.type === 'withdrawal' && matchesDate(tx.date, dateStr))
          .reduce((sum, tx) => sum + (tx.amount || 0), 0)
      );

      const otherCashOut = Math.round(
        otherCashEntries
          .filter(
            (e) => e.type === 'cash_out' && !e.isPostCloseAdjustment && matchesDate(e.date, dateStr)
          )
          .reduce((sum, e) => sum + (e.amount || 0), 0)
      );

      const totalCashIn =
        cashSales +
        customerDueCollected +
        dayReturnedCash +
        ownerNewCapital +
        ownerWithdrawalReturn +
        otherCashIn;
      const totalCashOut =
        cashPurchases + shopExpenses + supplierDuePaid + ownerWithdrawal + otherCashOut;

      return { totalCashIn, totalCashOut };
    };

    const dateSet = new Set<string>();
    const addDate = (raw?: string) => {
      const d = getLocalDateStr(raw);
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) dateSet.add(d);
    };
    sales.forEach((s) => addDate(s.date));
    bakiTransactions.forEach((tx) => addDate(tx.date));
    ownerTransactions.forEach((tx) => addDate(tx.date));
    bulkPurchases.forEach((bp) => {
      addDate(bp.date);
      if (bp.returns) bp.returns.forEach((r) => addDate(r.date));
    });
    purchases.forEach((p) => addDate(p.date));
    supplierTransactions.forEach((stx) => addDate(stx.date));
    expenses.forEach((exp) => addDate(exp.date));
    otherCashEntries.forEach((oce) => addDate(oce.date));
    dateSet.add(todayStr);

    const allDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));
    let runningBalance = Math.max(0, Math.round(initialOpeningCash || 0));
    for (const d of allDates) {
      if (d >= todayStr) break;
      const flow = computeDayFlows(d);
      runningBalance = Math.max(0, runningBalance + flow.totalCashIn - flow.totalCashOut);
    }

    const savedToday = dailyReconciliations.find((r) => r.date === todayStr);
    if (
      savedToday &&
      typeof savedToday.openingCash === 'number' &&
      savedToday.openingCash > 0 &&
      runningBalance === 0
    ) {
      runningBalance = Math.max(0, Math.round(savedToday.openingCash));
    }

    const todayFlow = computeDayFlows(todayStr);
    const rawClosing = Math.round(runningBalance + todayFlow.totalCashIn - todayFlow.totalCashOut);

    return {
      todaySalesTotal: todaySalesAmt,
      rawCashBalance: rawClosing,
    };
  }, [
    sales,
    bakiTransactions,
    purchases,
    bulkPurchases,
    supplierTransactions,
    expenses,
    ownerTransactions,
    otherCashEntries,
    dailyReconciliations,
    initialOpeningCash,
    todayStr,
  ]);

  const isDeficit = rawCashBalance < 0;
  const displayCashBalance = Math.max(0, rawCashBalance);

  const tiles: {
    id: MenuTileTarget;
    label: string;
    bgClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    // Row 1: পণ্য / স্টক | বিক্রি ও লাভ | নগদ ক্রয়
    {
      id: 'products',
      label: 'পণ্য / স্টক',
      bgClass: 'bg-[#1982D8] hover:bg-[#1472C0]',
      icon: Package,
    },
    {
      id: 'salesProfit',
      label: 'বিক্রি ও লাভ',
      bgClass: 'bg-[#E5980B] hover:bg-[#CE8808]',
      icon: TrendingUp,
    },
    {
      id: 'bulkPurchases',
      label: 'নগদ ক্রয়',
      bgClass: 'bg-[#EA7400] hover:bg-[#D56900]',
      icon: ShoppingCart,
    },
    // Row 2: সাপ্লাইয়ার বাকি | দোকান খরচ | মালিক খরচ/জমা
    {
      id: 'suppliersDue',
      label: 'সাপ্লাইয়ার বাকি',
      bgClass: 'bg-[#AD1457] hover:bg-[#931049]',
      icon: Building2,
    },
    {
      id: 'expenses',
      label: 'দোকান খরচ',
      bgClass: 'bg-[#C83721] hover:bg-[#B22E1A]',
      icon: Wallet,
    },
    {
      id: 'ownerCapital',
      label: 'মালিক খরচ/জমা',
      bgClass: 'bg-[#E21765] hover:bg-[#C91359]',
      icon: UserCheck,
    },
    // Row 3: কাস্টমার বাকি | ক্যাশ বক্স | সকল রিপোর্ট
    {
      id: 'customersDue',
      label: 'কাস্টমার বাকি',
      bgClass: 'bg-[#6A1B9A] hover:bg-[#581682]',
      icon: Users,
    },
    {
      id: 'cashBox',
      label: 'ক্যাশ বক্স',
      bgClass: 'bg-[#2E7D32] hover:bg-[#256928]',
      icon: Landmark,
    },
    {
      id: 'allReports',
      label: 'সকল রিপোর্ট',
      bgClass: 'bg-[#0097A7] hover:bg-[#008290]',
      icon: BarChart3,
    },
    // Row 4: ক্যালকুলেটর (left single-column, middle & right empty)
    {
      id: 'calculator',
      label: 'ক্যালকুলেটর',
      bgClass: 'bg-[#3949AB] hover:bg-[#2F3E94]',
      icon: Calculator,
    },
  ];

  return (
    <div className="flex flex-col px-2.5 pt-2 pb-16 max-w-md mx-auto">
      {/* Compact Top Dark Teal Summary Card (~20% tighter vertical footprint) */}
      <div className="bg-[#036368] text-white rounded-[20px] px-3.5 py-2.5 shadow-md mb-2.5 border border-[#024F53]">
        {/* Date Row */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/15">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-teal-100 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold tracking-tight text-white">
              {bengaliDateStr}
            </span>
          </div>
        </div>

        {/* 2 Summary Columns: আজকের বিক্রি | ক্যাশ বাক্সে নগদ */}
        <div className="grid grid-cols-2 divide-x divide-white/20 pt-2">
          <div className="pr-2.5">
            <p className="text-[11px] font-semibold text-teal-100/90 leading-tight mb-0.5">
              আজকের বিক্রি
            </p>
            <p className="text-lg sm:text-xl font-black text-white tracking-tight tabular-nums leading-tight">
              ৳ {todaySalesTotal.toLocaleString('en-US')}
            </p>
          </div>

          <div className="pl-2.5">
            <p className="text-[11px] font-semibold text-teal-100/90 leading-tight mb-0.5">
              ক্যাশ বাক্সে নগদ
            </p>
            <p className="text-lg sm:text-xl font-black text-white tracking-tight tabular-nums leading-tight">
              ৳ {isDeficit ? '০' : displayCashBalance.toLocaleString('en-US')}
            </p>
            {isDeficit && (
              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-rose-950/70 text-rose-300 text-[10px] font-extrabold tabular-nums">
                (ঘাটতি: -৳{Math.abs(rawCashBalance).toLocaleString('en-US')})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Section Title */}
      <h2 className="text-xs font-extrabold text-[#475569] px-1 mb-1.5">
        হিসাব / মেনু
      </h2>

      {/* Compact 3-Column Grid (3 + 3 + 3 + 1) */}
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => onSelectTile(tile.id)}
              className={`${tile.bgClass} rounded-[18px] px-1.5 py-2.5 min-h-[78px] flex flex-col items-center justify-center gap-1.5 text-white shadow-sm transition-transform duration-150 active:scale-[0.97] cursor-pointer`}
            >
              <Icon className="w-7 h-7 text-white stroke-[2.2] shrink-0" />
              <span className="text-[11.5px] sm:text-xs font-extrabold text-white tracking-tight text-center leading-tight">
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
