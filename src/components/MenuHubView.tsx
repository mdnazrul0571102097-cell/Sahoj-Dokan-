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
    {
      id: 'products',
      label: 'পণ্য / স্টক',
      bgClass: 'bg-[#1982D8] hover:bg-[#1472C0]',
      icon: Package,
    },
    {
      id: 'bulkPurchases',
      label: 'নগদ ক্রয়',
      bgClass: 'bg-[#EA7400] hover:bg-[#D56900]',
      icon: ShoppingCart,
    },
    {
      id: 'salesProfit',
      label: 'বিক্রি ও লাভ',
      bgClass: 'bg-[#E5980B] hover:bg-[#CE8808]',
      icon: TrendingUp,
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
    {
      id: 'customersDue',
      label: 'কাস্টমার বাকি',
      bgClass: 'bg-[#6A1B9A] hover:bg-[#581682]',
      icon: Users,
    },
    {
      id: 'suppliersDue',
      label: 'সাপ্লাইয়ার বাকি',
      bgClass: 'bg-[#AD1457] hover:bg-[#931049]',
      icon: Building2,
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
    {
      id: 'calculator',
      label: 'ক্যালকুলেটর',
      bgClass: 'bg-[#3949AB] hover:bg-[#2F3E94]',
      icon: Calculator,
    },
  ];

  return (
    <div className="min-h-[calc(100vh-110px)] flex flex-col p-3 max-w-md mx-auto pb-20 overflow-y-auto">
      {/* Top Dark Teal Summary Card */}
      <div className="bg-[#036368] text-white rounded-[24px] p-4 sm:p-5 shadow-md mb-4 border border-[#024F53]">
        {/* Date Row */}
        <div className="flex items-center justify-between pb-3 border-b border-white/15">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-100 shrink-0" />
            <span className="text-sm sm:text-base font-extrabold tracking-tight text-white">
              {bengaliDateStr}
            </span>
          </div>
        </div>

        {/* 2 Summary Columns: আজকের বিক্রি | ক্যাশ বাক্সে নগদ */}
        <div className="grid grid-cols-2 divide-x divide-white/20 pt-3.5">
          <div className="pr-3">
            <p className="text-xs font-semibold text-teal-100/90 mb-1">
              আজকের বিক্রি
            </p>
            <p className="text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums">
              ৳ {todaySalesTotal.toLocaleString('en-US')}
            </p>
          </div>

          <div className="pl-3">
            <p className="text-xs font-semibold text-teal-100/90 mb-1">
              ক্যাশ বাক্সে নগদ
            </p>
            <p className="text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums">
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
      <h2 className="text-sm font-extrabold text-[#475569] px-1 mb-2.5">
        হিসাব / মেনু
      </h2>

      {/* 10 Vibrant Solid-Colored Rounded Square Tiles (2-Column Grid) */}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => onSelectTile(tile.id)}
              className={`${tile.bgClass} rounded-[20px] p-4 min-h-[112px] flex flex-col items-center justify-center gap-2.5 text-white shadow-sm transition-transform duration-150 active:scale-[0.97] cursor-pointer`}
            >
              <Icon className="w-9 h-9 text-white stroke-[2.2]" />
              <span className="text-sm sm:text-[15px] font-extrabold text-white tracking-tight text-center leading-snug">
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
