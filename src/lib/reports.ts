import { ExpenseCategory, ExtraRevenueEntry, HotelState, InvestorContribution, RevenueLineCategory } from '../types';

export type ProfitLossDateRange = {
  startDate?: string;
  endDate?: string;
};

export const PROFIT_LOSS_EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  maintenance: 'Maintenance',
  rent: 'Rent',
  salaries: 'Salaries',
  electricity: 'Electricity',
  gas: 'Gas',
  internet: 'Internet',
  laundry: 'Laundry',
  'cleaning-supplies': 'Cleaning Supplies',
  'ota-commission': 'OTA Commission',
  traveling: 'Traveling',
  marketing: 'Marketing',
  refunds: 'Refunds',
  'guest-supplies': 'Guest Supplies',
  'room-supplies': 'Unit Supplies',
  improvements: 'Improvements',
  utilities: 'Utilities',
  staff: 'Staff',
  miscellaneous: 'Miscellaneous',
  other: 'Other',
};

export const REVENUE_LINE_LABELS: Record<RevenueLineCategory, string> = {
  airbnb: 'Airbnb Bookings',
  'booking.com': 'Booking.com Bookings',
  direct: 'Direct Bookings',
  cash: 'Cash Bookings',
  'extra-charges': 'Extra Charges',
};

const getExpenseLineLabel = (expense: HotelState['expenses'][number]): string => {
  if (expense.category !== 'other') {
    return PROFIT_LOSS_EXPENSE_LABELS[expense.category] || String(expense.category || 'Other').replace(/-/g, ' ');
  }

  return expense.customCategoryLabel?.trim() || expense.title.trim() || 'Other';
};

const getMonthRange = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  return { start, end };
};

const addDaysToDateKey = (dateKey: string, days: number): string => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getBookingRevenueCategory = (bookingSource: string): RevenueLineCategory => {
  if (bookingSource === 'airbnb') {
    return 'airbnb';
  }
  if (bookingSource === 'booking.com') {
    return 'booking.com';
  }
  if (bookingSource === 'walk-in') {
    return 'cash';
  }
  return 'direct';
};

const getOverlapNightsInMonth = (checkInDate: string, checkOutDate: string, monthKey: string) => {
  const { start, end } = getMonthRange(monthKey);
  const bookingStart = new Date(checkInDate);
  const bookingEnd = new Date(checkOutDate);
  const overlapStart = bookingStart > start ? bookingStart : start;
  const overlapEnd = bookingEnd < end ? bookingEnd : end;
  const diff = overlapEnd.getTime() - overlapStart.getTime();
  if (diff <= 0) {
    return 0;
  }
  return Math.ceil(diff / (1000 * 3600 * 24));
};

const getOverlapNightsInRange = (checkInDate: string, checkOutDate: string, range: ProfitLossDateRange) => {
  const bookingStart = new Date(`${checkInDate}T00:00:00`);
  const bookingEnd = new Date(`${checkOutDate}T00:00:00`);
  const rangeStart = range.startDate ? new Date(`${range.startDate}T00:00:00`) : bookingStart;
  const rangeEnd = range.endDate ? new Date(`${addDaysToDateKey(range.endDate, 1)}T00:00:00`) : bookingEnd;
  const overlapStart = bookingStart > rangeStart ? bookingStart : rangeStart;
  const overlapEnd = bookingEnd < rangeEnd ? bookingEnd : rangeEnd;
  const diff = overlapEnd.getTime() - overlapStart.getTime();
  if (diff <= 0) {
    return 0;
  }
  return Math.ceil(diff / (1000 * 3600 * 24));
};

const isDateInsideRange = (dateKey: string, range: ProfitLossDateRange): boolean => {
  if (range.startDate && dateKey < range.startDate) {
    return false;
  }
  if (range.endDate && dateKey > range.endDate) {
    return false;
  }
  return true;
};

export const getMonthOptions = (state: HotelState): string[] => {
  const keys = new Set<string>();

  state.bookings.forEach((booking) => {
    keys.add(booking.checkInDate.slice(0, 7));
    keys.add(booking.checkOutDate.slice(0, 7));
  });
  state.expenses.forEach((expense) => keys.add(expense.date.slice(0, 7)));
  state.investors.forEach((investor) => keys.add(investor.date.slice(0, 7)));
  state.extraRevenueEntries.forEach((entry) => keys.add(entry.date.slice(0, 7)));

  if (keys.size === 0) {
    keys.add(toDateKey(new Date()).slice(0, 7));
  }

  return [...keys].sort().reverse();
};

export const getYearOptions = (state: HotelState): string[] => {
  const years = new Set<string>();

  state.bookings.forEach((booking) => {
    years.add(booking.checkInDate.slice(0, 4));
    years.add(booking.checkOutDate.slice(0, 4));
  });
  state.expenses.forEach((expense) => years.add(expense.date.slice(0, 4)));
  state.investors.forEach((investor) => years.add(investor.date.slice(0, 4)));
  state.extraRevenueEntries.forEach((entry) => years.add(entry.date.slice(0, 4)));

  if (years.size === 0) {
    years.add(toDateKey(new Date()).slice(0, 4));
  }

  return [...years].sort().reverse();
};

export const calculateInvestorShare = (netProfit: number, investor: InvestorContribution): number =>
  Number(investor.equityPercentage || 0) > 0 ? (netProfit * Number(investor.equityPercentage || 0)) / 100 : 0;

export const getProfitLossReportForRange = (state: HotelState, range: ProfitLossDateRange) => {
  const revenueBreakdown: Record<RevenueLineCategory, number> = {
    airbnb: 0,
    'booking.com': 0,
    direct: 0,
    cash: 0,
    'extra-charges': 0,
  };

  const expenseBreakdown = Object.keys(PROFIT_LOSS_EXPENSE_LABELS).reduce<Record<ExpenseCategory, number>>((acc, key) => {
    acc[key as ExpenseCategory] = 0;
    return acc;
  }, {} as Record<ExpenseCategory, number>);
  const expenseLineTotals = new Map<string, number>();

  state.bookings
    .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'rejected' && booking.status !== 'pending')
    .forEach((booking) => {
      const totalNights = Math.max(
        1,
        Math.ceil((new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 3600 * 24))
      );
      const overlapNights = getOverlapNightsInRange(booking.checkInDate, booking.checkOutDate, range);
      if (overlapNights <= 0) {
        return;
      }
      const contribution = (booking.totalPrice / totalNights) * overlapNights;
      revenueBreakdown[getBookingRevenueCategory(booking.bookingSource)] += contribution;
    });

  state.extraRevenueEntries
    .filter((entry) => isDateInsideRange(entry.date, range))
    .forEach((entry: ExtraRevenueEntry) => {
      revenueBreakdown['extra-charges'] += entry.amount;
    });

  state.expenses
    .filter((expense) => isDateInsideRange(expense.date, range))
    .forEach((expense) => {
      expenseBreakdown[expense.category] = (expenseBreakdown[expense.category] || 0) + expense.amount;
      const expenseLineLabel = getExpenseLineLabel(expense);
      expenseLineTotals.set(expenseLineLabel, (expenseLineTotals.get(expenseLineLabel) || 0) + expense.amount);
    });

  const totalRevenue = Object.values(revenueBreakdown).reduce((sum, value) => sum + value, 0);
  const totalExpenses = Object.values(expenseBreakdown).reduce((sum, value) => sum + value, 0);
  const netProfit = totalRevenue - totalExpenses;
  const investorShares = state.investors.map((investor) => ({
    investor,
    amount: calculateInvestorShare(netProfit, investor),
  }));

  return {
    revenueBreakdown,
    expenseBreakdown,
    expenseLines: [...expenseLineTotals.entries()].map(([label, amount]) => ({ label, amount })),
    totalRevenue,
    totalExpenses,
    netProfit,
    investorShares,
  };
};

export const getMonthlyProfitLossReport = (state: HotelState, monthKey: string) => {
  const { start, end } = getMonthRange(monthKey);
  const inclusiveEnd = new Date(end);
  inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);

  return getProfitLossReportForRange(state, {
    startDate: toDateKey(start),
    endDate: toDateKey(inclusiveEnd),
  });
};
