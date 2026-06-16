import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Calendar,
  Coins,
  PlusCircle,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { ExtraRevenueEntry, HotelState, InvestorContribution, ProofAttachment, UserRole } from '../types';
import { getLocalDateInputValue } from '../lib/hotelState';
import {
  calculateInvestorShare,
  getMonthOptions,
  getMonthlyProfitLossReport,
  getProfitLossReportForRange,
  getYearOptions,
  REVENUE_LINE_LABELS,
} from '../lib/reports';
import { canAddInvestors, canEditProfitLossInputs, isFinanceReadOnlyRole } from '../lib/access';
import ProofAttachmentGallery from './ProofAttachmentGallery';
import ProofUploadField from './ProofUploadField';

interface InvestorViewProps {
  state: HotelState;
  currentUserRole: UserRole;
  onAddInvestor: (investor: Omit<InvestorContribution, 'id'>) => void;
  onAddExtraRevenue: (entry: Omit<ExtraRevenueEntry, 'id'>) => void;
}

export default function InvestorView({ state, currentUserRole, onAddInvestor, onAddExtraRevenue }: InvestorViewProps) {
  const { investors, expenses, extraRevenueEntries, bookings } = state;
  const [showInvestorForm, setShowInvestorForm] = useState(false);
  const [showExtraRevenueForm, setShowExtraRevenueForm] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<'month' | 'year' | 'custom' | 'all'>('month');
  const [reportMonth, setReportMonth] = useState(getLocalDateInputValue().slice(0, 7));
  const [reportYear, setReportYear] = useState(getLocalDateInputValue().slice(0, 4));
  const [customStartDate, setCustomStartDate] = useState(`${getLocalDateInputValue().slice(0, 7)}-01`);
  const [customEndDate, setCustomEndDate] = useState(getLocalDateInputValue());

  const [investorName, setInvestorName] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [date, setDate] = useState(getLocalDateInputValue());
  const [profitShareInput, setProfitShareInput] = useState('');
  const [notes, setNotes] = useState('');
  const [investorProofs, setInvestorProofs] = useState<ProofAttachment[]>([]);

  const [extraRevenueTitle, setExtraRevenueTitle] = useState('');
  const [extraRevenueAmount, setExtraRevenueAmount] = useState('');
  const [extraRevenueDate, setExtraRevenueDate] = useState(getLocalDateInputValue());
  const [extraRevenueNotes, setExtraRevenueNotes] = useState('');
  const [linkedBookingId, setLinkedBookingId] = useState('');
  const [extraRevenueProofs, setExtraRevenueProofs] = useState<ProofAttachment[]>([]);

  const totalInvestment = investors.reduce((sum, investor) => sum + investor.amount, 0);
  const totalExpensesPaid = expenses.filter((expense) => expense.status === 'paid').reduce((sum, expense) => sum + expense.amount, 0);
  const availableCapital = totalInvestment - totalExpensesPaid;

  const monthOptions = useMemo(() => getMonthOptions(state), [state]);
  const yearOptions = useMemo(() => getYearOptions(state), [state]);
  useEffect(() => {
    if (!monthOptions.includes(reportMonth)) {
      setReportMonth(monthOptions[0]);
    }
  }, [monthOptions, reportMonth]);
  useEffect(() => {
    if (!yearOptions.includes(reportYear)) {
      setReportYear(yearOptions[0]);
    }
  }, [reportYear, yearOptions]);

  const reportDateRange = useMemo(() => {
    if (reportPeriod === 'month') {
      return undefined;
    }

    if (reportPeriod === 'year') {
      return {
        startDate: `${reportYear}-01-01`,
        endDate: `${reportYear}-12-31`,
      };
    }

    if (reportPeriod === 'custom') {
      const startDate = customStartDate && customEndDate && customStartDate > customEndDate ? customEndDate : customStartDate;
      const endDate = customStartDate && customEndDate && customStartDate > customEndDate ? customStartDate : customEndDate;
      return {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
    }

    return {};
  }, [customEndDate, customStartDate, reportPeriod, reportYear]);

  const reportLabel = useMemo(() => {
    if (reportPeriod === 'month') {
      return reportMonth;
    }
    if (reportPeriod === 'year') {
      return reportYear;
    }
    if (reportPeriod === 'custom') {
      if (reportDateRange?.startDate && reportDateRange?.endDate) {
        return `${reportDateRange.startDate} to ${reportDateRange.endDate}`;
      }
      if (reportDateRange?.startDate) {
        return `From ${reportDateRange.startDate}`;
      }
      if (reportDateRange?.endDate) {
        return `Until ${reportDateRange.endDate}`;
      }
      return 'Custom range';
    }
    return 'All time';
  }, [reportDateRange, reportMonth, reportPeriod, reportYear]);

  const monthlyReport = useMemo(
    () =>
      reportPeriod === 'month'
        ? getMonthlyProfitLossReport(state, reportMonth)
        : getProfitLossReportForRange(state, reportDateRange || {}),
    [reportDateRange, reportMonth, reportPeriod, state]
  );

  const handleInvestorSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedAmount = amountInput.replace(/,/g, '').trim();
    const parsedAmount = Number(normalizedAmount);
    const normalizedShare = profitShareInput.replace(/,/g, '').trim();
    const parsedShare = normalizedShare === '' ? 0 : Number(normalizedShare);

    if (!investorName.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !date) {
      alert('Investor name, positive capital amount, and date are required.');
      return;
    }

    if (!Number.isFinite(parsedShare) || parsedShare < 0 || parsedShare > 100) {
      alert('Profit share percentage must stay between 0 and 100.');
      return;
    }

    onAddInvestor({
      investorName: investorName.trim(),
      amount: parsedAmount,
      date,
      equityPercentage: parsedShare,
      notes: notes.trim() || undefined,
      proofs: investorProofs,
    });

    setInvestorName('');
    setAmountInput('');
    setDate(getLocalDateInputValue());
    setProfitShareInput('');
    setNotes('');
    setInvestorProofs([]);
    setShowInvestorForm(false);
  };

  const handleExtraRevenueSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const parsedAmount = Number(extraRevenueAmount.replace(/,/g, '').trim());
    if (!extraRevenueTitle.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !extraRevenueDate) {
      alert('Extra charge title, date, and positive amount are required.');
      return;
    }

    onAddExtraRevenue({
      title: extraRevenueTitle.trim(),
      amount: parsedAmount,
      date: extraRevenueDate,
      category: 'extra-charges',
      notes: extraRevenueNotes.trim() || undefined,
      linkedBookingId: linkedBookingId || undefined,
      proofs: extraRevenueProofs,
    });

    setExtraRevenueTitle('');
    setExtraRevenueAmount('');
    setExtraRevenueDate(getLocalDateInputValue());
    setExtraRevenueNotes('');
    setLinkedBookingId('');
    setExtraRevenueProofs([]);
    setShowExtraRevenueForm(false);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="investor-feature-view">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <span className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Total Capital Received</span>
            <span className="mt-1 block text-2xl font-extrabold text-slate-900">Rs. {totalInvestment.toLocaleString()}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Expenses Paid</span>
            <span className="mt-1 block text-2xl font-extrabold text-rose-500">Rs. {totalExpensesPaid.toLocaleString()}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Available Capital</span>
            <span className={`mt-1 block text-2xl font-extrabold ${availableCapital < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              Rs. {availableCapital.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Monthly Net Profit</span>
            <span className={`mt-1 block text-2xl font-extrabold ${monthlyReport.netProfit < 0 ? 'text-rose-600' : 'text-indigo-700'}`}>
              Rs. {monthlyReport.netProfit.toLocaleString()}
            </span>
          </div>
        </div>

        {!isFinanceReadOnlyRole(currentUserRole) && (
          <div className="flex flex-wrap gap-3">
            {canAddInvestors(currentUserRole) && (
              <button
                onClick={() => setShowInvestorForm((current) => !current)}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <PlusCircle className="h-4 w-4" />
                <span>{showInvestorForm ? 'Hide Capital Form' : 'Add Investor Capital'}</span>
              </button>
            )}

            {canEditProfitLossInputs(currentUserRole) && (
              <button
                onClick={() => setShowExtraRevenueForm((current) => !current)}
                className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ReceiptText className="h-4 w-4" />
                <span>{showExtraRevenueForm ? 'Hide Extra Charge Form' : 'Add Extra Charge'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {showInvestorForm && canAddInvestors(currentUserRole) && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Briefcase className="h-5 w-5 text-indigo-500" />
              <span>Register Investor Capital</span>
            </h3>
            <p className="mt-1 text-sm text-slate-500">Set investor capital and monthly profit share percentage. Example: 30%, 40%, 50%.</p>
          </div>

          <form onSubmit={handleInvestorSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Investor Name</label>
                <input
                  type="text"
                  required
                  value={investorName}
                  onChange={(event) => setInvestorName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="Investor name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Investor Capital (PKR)</label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="500000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Transaction Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Profit Share %</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={profitShareInput}
                  onChange={(event) => setProfitShareInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="50"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-600">Notes</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                placeholder="Contract terms or reminders"
              />
            </div>

            <ProofUploadField
              label="Investor Payment Proof"
              category="investor-payment-proof"
              value={investorProofs}
              onChange={setInvestorProofs}
              helperText="Attach bank slip, transfer screenshot, cash receipt, or signed acknowledgement."
            />

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowInvestorForm(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Save Capital
              </button>
            </div>
          </form>
        </div>
      )}

      {showExtraRevenueForm && canEditProfitLossInputs(currentUserRole) && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Coins className="h-5 w-5 text-emerald-600" />
              <span>Add Extra Charge Revenue</span>
            </h3>
            <p className="mt-1 text-sm text-slate-500">Use this for extra charges outside base bookings so monthly P&L stays complete.</p>
          </div>

          <form onSubmit={handleExtraRevenueSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Charge Title</label>
                <input
                  type="text"
                  required
                  value={extraRevenueTitle}
                  onChange={(event) => setExtraRevenueTitle(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="Late checkout fee"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Amount (PKR)</label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={extraRevenueAmount}
                  onChange={(event) => setExtraRevenueAmount(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="3000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Transaction Date</label>
                <input
                  type="date"
                  required
                  value={extraRevenueDate}
                  onChange={(event) => setExtraRevenueDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Linked Booking</label>
                <select
                  value={linkedBookingId}
                  onChange={(event) => setLinkedBookingId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">No linked booking</option>
                  {bookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.id} - {booking.guestFirstName} {booking.guestLastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-600">Notes</label>
              <textarea
                value={extraRevenueNotes}
                onChange={(event) => setExtraRevenueNotes(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                placeholder="What was charged and why"
              />
            </div>

            <ProofUploadField
              label="Extra Charge Proof"
              category="extra-charge-proof"
              value={extraRevenueProofs}
              onChange={setExtraRevenueProofs}
              helperText="Attach signed acknowledgement, bill, or payment proof."
            />

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowExtraRevenueForm(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Save Extra Charge
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Profit & Loss</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Revenue, expense, net profit, and investor share summary.
                </p>
              </div>

              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,auto)] lg:items-end">
                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="min-w-0">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filter</label>
                    <select
                      value={reportPeriod}
                      onChange={(event) => setReportPeriod(event.target.value as 'month' | 'year' | 'custom' | 'all')}
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                    >
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                      <option value="custom">Custom Range</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>

                  {reportPeriod === 'month' && (
                    <div className="min-w-0">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Month</label>
                      <select
                        value={reportMonth}
                        onChange={(event) => setReportMonth(event.target.value)}
                        className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                      >
                        {monthOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {reportPeriod === 'year' && (
                    <div className="min-w-0">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Year</label>
                      <select
                        value={reportYear}
                        onChange={(event) => setReportYear(event.target.value)}
                        className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                      >
                        {yearOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {reportPeriod === 'custom' && (
                    <>
                      <div className="min-w-0">
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">From</label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(event) => setCustomStartDate(event.target.value)}
                          className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">To</label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(event) => setCustomEndDate(event.target.value)}
                          className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  <Calendar className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="min-w-0 break-words font-medium leading-5">{reportLabel}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Revenue</p>
                <p className="mt-2 break-words text-xl font-extrabold text-emerald-700 sm:text-2xl">Rs. {monthlyReport.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Expenses</p>
                <p className="mt-2 break-words text-xl font-extrabold text-rose-600 sm:text-2xl">Rs. {monthlyReport.totalExpenses.toLocaleString()}</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Net Profit</p>
                <p className={`mt-2 break-words text-xl font-extrabold sm:text-2xl ${monthlyReport.netProfit < 0 ? 'text-rose-600' : 'text-indigo-700'}`}>
                  Rs. {monthlyReport.netProfit.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Revenue</h4>
                <div className="mt-3 space-y-2">
                  {Object.entries(monthlyReport.revenueBreakdown).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <span className="min-w-0 text-slate-600">{REVENUE_LINE_LABELS[key as keyof typeof REVENUE_LINE_LABELS]}</span>
                      <strong className="break-words text-right font-mono text-slate-900">Rs. {value.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900">Expenses</h4>
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                  {monthlyReport.expenseLines.map((line) => (
                    <div key={line.label} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <span className="min-w-0 text-slate-600">{line.label}</span>
                      <strong className="break-words text-right font-mono text-slate-900">Rs. {line.amount.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Investor Capital</h3>
            <div className="mt-4 space-y-3">
              {investors.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-500">
                  No investor capital records yet.
                </div>
              ) : (
                investors.map((investor) => {
                  const fundedExpenses = expenses
                    .filter((expense) => expense.status === 'paid' && expense.paidFromInvestorFundId === investor.id)
                    .reduce((sum, expense) => sum + expense.amount, 0);
                  const currentShare = calculateInvestorShare(monthlyReport.netProfit, investor);

                  return (
                    <div key={investor.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">{investor.investorName}</h4>
                          <p className="mt-1 text-xs text-slate-500">
                            Received {investor.date} | Profit Share {investor.equityPercentage || 0}% | Proofs {investor.proofs?.length || 0}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm font-bold text-slate-900">Rs. {investor.amount.toLocaleString()}</p>
                          <p className="text-xs text-slate-500">Monthly share: Rs. {currentShare.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                          <span className="block text-slate-400">Capital Received</span>
                          <strong className="mt-1 block text-slate-900">Rs. {investor.amount.toLocaleString()}</strong>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                          <span className="block text-slate-400">Expenses Paid From This Capital</span>
                          <strong className="mt-1 block text-slate-900">Rs. {fundedExpenses.toLocaleString()}</strong>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                          <span className="block text-slate-400">Remaining Linked Capital</span>
                          <strong className="mt-1 block text-slate-900">Rs. {(investor.amount - fundedExpenses).toLocaleString()}</strong>
                        </div>
                      </div>

                      {investor.notes && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          {investor.notes}
                        </div>
                      )}

                      {(investor.proofs?.length || 0) > 0 && (
                        <div className="mt-3">
                          <ProofAttachmentGallery
                            attachments={investor.proofs || []}
                            emptyMessage="No investor payment proof attached."
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Extra Charges</h3>
            <div className="mt-4 space-y-3">
              {extraRevenueEntries.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No extra charges recorded yet.
                </div>
              ) : (
                extraRevenueEntries.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {entry.date} | Proofs {entry.proofs?.length || 0} {entry.linkedBookingId ? `| Booking ${entry.linkedBookingId}` : ''}
                        </p>
                      </div>
                      <strong className="font-mono text-sm text-emerald-700">Rs. {entry.amount.toLocaleString()}</strong>
                    </div>
                    {entry.notes && <p className="mt-2 text-xs text-slate-600">{entry.notes}</p>}
                    {(entry.proofs?.length || 0) > 0 && (
                      <div className="mt-3">
                        <ProofAttachmentGallery
                          attachments={entry.proofs || []}
                          emptyMessage="No extra charge proof attached."
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Revenue Entries</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900">{bookings.length + extraRevenueEntries.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Expense Entries</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900">{expenses.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
