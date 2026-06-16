import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Coins,
  CreditCard,
  PlusCircle,
  Search,
  TrendingDown,
  Wrench,
} from 'lucide-react';
import {
  CurrentUser,
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  HotelState,
  MaintenanceIssue,
  MaintenanceIssuePriority,
  MaintenanceIssueStatus,
  ProofAttachment,
} from '../types';
import { getLocalDateInputValue, getMaintenanceIssueStatusLabel } from '../lib/hotelState';
import { canManageExpenses, canManageMaintenanceIssues, canViewIssueForUser } from '../lib/access';
import ProofAttachmentGallery from './ProofAttachmentGallery';
import ProofUploadField from './ProofUploadField';

const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
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

const DIRECT_PAYMENT_VALUE = '__DIRECT_PAYMENT__';

const formatExpenseCategoryLabel = (expense: Expense): string => {
  if (expense.category === 'other') {
    return expense.customCategoryLabel?.trim() || 'Other';
  }

  return EXPENSE_CATEGORY_LABELS[expense.category] || String(expense.category || 'Other').replace(/-/g, ' ');
};

interface ExpensesViewProps {
  state: HotelState;
  currentUser: CurrentUser;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onUpdateExpenseStatus: (expenseId: string, status: ExpenseStatus, investorFundId?: string, paymentProofs?: ProofAttachment[]) => void;
  onAddMaintenanceIssue: (issue: Omit<MaintenanceIssue, 'id'>) => void;
  onUpdateMaintenanceIssue: (issueId: string, updates: Partial<MaintenanceIssue>) => void;
}

const ISSUE_NEXT_ACTION: Record<
  Exclude<MaintenanceIssueStatus, 'closed'>,
  { label: string; nextStatus: MaintenanceIssueStatus }
> = {
  reported: { label: 'Assign', nextStatus: 'assigned' },
  assigned: { label: 'Start Work', nextStatus: 'in-progress' },
  'in-progress': { label: 'Mark Fixed', nextStatus: 'fixed' },
  fixed: { label: 'Verify', nextStatus: 'verified' },
  verified: { label: 'Close', nextStatus: 'closed' },
};

const PRIORITY_STYLES: Record<MaintenanceIssuePriority, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-sky-50 text-sky-700',
  urgent: 'bg-rose-50 text-rose-700',
};

const getInvestorFundUsage = (expenses: Expense[], investorId: string, excludedExpenseId?: string): number =>
  expenses
    .filter((expense) => expense.id !== excludedExpenseId && expense.status === 'paid' && expense.paidFromInvestorFundId === investorId)
    .reduce((sum, expense) => sum + expense.amount, 0);

const getInvestorFundRemaining = (expenses: Expense[], investor: HotelState['investors'][number], excludedExpenseId?: string): number =>
  investor.amount - getInvestorFundUsage(expenses, investor.id, excludedExpenseId);

export default function ExpensesView({
  state,
  currentUser,
  onAddExpense,
  onUpdateExpenseStatus,
  onAddMaintenanceIssue,
  onUpdateMaintenanceIssue,
}: ExpensesViewProps) {
  const { expenses, investors, maintenanceIssues, rooms } = state;
  const canEditExpenses = canManageExpenses(currentUser.role);
  const canEditIssues = canManageMaintenanceIssues(currentUser.role);

  const [activeTab, setActiveTab] = useState<'issues' | 'expenses'>(canEditExpenses ? 'issues' : 'issues');
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [issueStatusFilter, setIssueStatusFilter] = useState<string>('all');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<string>('all');

  const [issueTitle, setIssueTitle] = useState('');
  const [issueRoomId, setIssueRoomId] = useState('');
  const [issuePriority, setIssuePriority] = useState<MaintenanceIssuePriority>('medium');
  const [issueAssignedTo, setIssueAssignedTo] = useState('');
  const [issueReportedDate, setIssueReportedDate] = useState(getLocalDateInputValue());
  const [issueNotes, setIssueNotes] = useState('');
  const [issueBeforePhotos, setIssueBeforePhotos] = useState<ProofAttachment[]>([]);
  const [issueAfterPhotos, setIssueAfterPhotos] = useState<ProofAttachment[]>([]);

  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('maintenance');
  const [expenseCustomCategoryLabel, setExpenseCustomCategoryLabel] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState(getLocalDateInputValue());
  const [expenseRoomId, setExpenseRoomId] = useState('');
  const [expenseStatus, setExpenseStatus] = useState<ExpenseStatus>('pending');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseIssueId, setExpenseIssueId] = useState('');
  const [expenseVendorName, setExpenseVendorName] = useState('');
  const [expenseReceiptReference, setExpenseReceiptReference] = useState('');
  const [expenseInvestorFundId, setExpenseInvestorFundId] = useState('');
  const [expenseProofs, setExpenseProofs] = useState<ProofAttachment[]>([]);

  const [linkingExpenseId, setLinkingExpenseId] = useState<string | null>(null);
  const [payingInvestorId, setPayingInvestorId] = useState('');
  const [paymentProofs, setPaymentProofs] = useState<ProofAttachment[]>([]);

  const visibleIssues = maintenanceIssues.filter((issue) => canViewIssueForUser(currentUser.role, currentUser, issue));
  const openIssuesCount = visibleIssues.filter((issue) => issue.status !== 'closed').length;
  const totalPaid = expenses.filter((expense) => expense.status === 'paid').reduce((sum, expense) => sum + expense.amount, 0);
  const totalPending = expenses.filter((expense) => expense.status === 'pending').reduce((sum, expense) => sum + expense.amount, 0);
  const availableExpenseInvestors = investors.filter((investor) => {
    const remaining = getInvestorFundRemaining(expenses, investor);
    return remaining > 0 && (expenseStatus !== 'paid' || expenseAmount <= 0 || remaining >= expenseAmount);
  });

  const filteredIssues = useMemo(
    () =>
      visibleIssues.filter((issue) => {
        const query = searchQuery.toLowerCase();
        const room = rooms.find((entry) => entry.id === issue.roomId);
        const matchesSearch =
          issue.title.toLowerCase().includes(query) ||
          issue.roomId.toLowerCase().includes(query) ||
          (issue.assignedTo || '').toLowerCase().includes(query) ||
          (issue.notes || '').toLowerCase().includes(query) ||
          (room?.name || '').toLowerCase().includes(query);

        const matchesStatus = issueStatusFilter === 'all' || issue.status === issueStatusFilter;
        return matchesSearch && matchesStatus;
      }),
    [issueStatusFilter, rooms, searchQuery, visibleIssues]
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        const query = searchQuery.toLowerCase();
        const issue = maintenanceIssues.find((entry) => entry.id === expense.maintenanceIssueId);
        const matchesSearch =
          expense.title.toLowerCase().includes(query) ||
          (expense.customCategoryLabel || '').toLowerCase().includes(query) ||
          (expense.description || '').toLowerCase().includes(query) ||
          (expense.vendorName || '').toLowerCase().includes(query) ||
          (expense.receiptReference || '').toLowerCase().includes(query) ||
          (issue?.title || '').toLowerCase().includes(query) ||
          (expense.roomId || '').toLowerCase().includes(query);

        const matchesStatus = expenseStatusFilter === 'all' || expense.status === expenseStatusFilter;
        return matchesSearch && matchesStatus;
      }),
    [expenseStatusFilter, expenses, maintenanceIssues, searchQuery]
  );

  const resetIssueForm = () => {
    setIssueTitle('');
    setIssueRoomId('');
    setIssuePriority('medium');
    setIssueAssignedTo('');
    setIssueReportedDate(getLocalDateInputValue());
    setIssueNotes('');
    setIssueBeforePhotos([]);
    setIssueAfterPhotos([]);
    setShowIssueForm(false);
  };

  const resetExpenseForm = () => {
    setExpenseTitle('');
    setExpenseCategory('maintenance');
    setExpenseCustomCategoryLabel('');
    setExpenseAmount(0);
    setExpenseDate(getLocalDateInputValue());
    setExpenseRoomId('');
    setExpenseStatus('pending');
    setExpenseDescription('');
    setExpenseIssueId('');
    setExpenseVendorName('');
    setExpenseReceiptReference('');
    setExpenseInvestorFundId('');
    setExpenseProofs([]);
    setShowExpenseForm(false);
  };

  const handleIssueSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!issueTitle.trim() || !issueRoomId || !issueReportedDate) {
      alert('Issue title, room, and report date are required.');
      return;
    }

    onAddMaintenanceIssue({
      title: issueTitle.trim(),
      roomId: issueRoomId,
      priority: issuePriority,
      status: issueAssignedTo.trim() ? 'assigned' : 'reported',
      reportedDate: issueReportedDate,
      assignedTo: issueAssignedTo.trim() || undefined,
      notes: issueNotes.trim() || undefined,
      beforePhotos: issueBeforePhotos,
      afterPhotos: issueAfterPhotos,
    });

    resetIssueForm();
  };

  const handleExpenseSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!expenseTitle.trim() || !expenseDate || expenseAmount <= 0) {
      alert('Expense title, date, and a positive amount are required.');
      return;
    }

    if (expenseCategory === 'other' && !expenseCustomCategoryLabel.trim()) {
      alert('Please enter the Other expense reason/category.');
      return;
    }

    if (expenseStatus === 'paid' && expenseProofs.length === 0) {
      alert('Please attach payment proof before saving a paid expense.');
      return;
    }

    if (expenseStatus === 'paid' && expenseInvestorFundId) {
      const selectedInvestor = investors.find((investor) => investor.id === expenseInvestorFundId);
      const remaining = selectedInvestor ? getInvestorFundRemaining(expenses, selectedInvestor) : 0;
      if (!selectedInvestor || remaining < expenseAmount) {
        alert(`Selected investor capital does not have enough remaining balance for Rs. ${expenseAmount.toLocaleString()}.`);
        return;
      }
    }

    onAddExpense({
      title: expenseTitle.trim(),
      category: expenseCategory,
      customCategoryLabel: expenseCategory === 'other' ? expenseCustomCategoryLabel.trim() : undefined,
      amount: expenseAmount,
      date: expenseDate,
      roomId: expenseRoomId || undefined,
      status: expenseStatus,
      description: expenseDescription.trim() || undefined,
      paidFromInvestorFundId: expenseStatus === 'paid' ? expenseInvestorFundId || undefined : undefined,
      maintenanceIssueId: expenseIssueId || undefined,
      vendorName: expenseVendorName.trim() || undefined,
      receiptReference: expenseReceiptReference.trim() || undefined,
      proofs: expenseProofs,
    });

    resetExpenseForm();
  };

  const handleProcessPayment = (expenseId: string) => {
    if (!payingInvestorId) {
      alert('Please select an investor capital source to cover this expense.');
      return;
    }

    const selectedExpense = expenses.find((expense) => expense.id === expenseId);
    const isDirectPayment = payingInvestorId === DIRECT_PAYMENT_VALUE;
    const selectedInvestor = isDirectPayment ? undefined : investors.find((investor) => investor.id === payingInvestorId);
    if (!selectedExpense || (!isDirectPayment && !selectedInvestor)) {
      alert('Please select a valid expense and payment source.');
      return;
    }

    if (selectedInvestor) {
      const remaining = getInvestorFundRemaining(expenses, selectedInvestor, expenseId);
      if (remaining < selectedExpense.amount) {
        alert(`This investor capital entry has only Rs. ${remaining.toLocaleString()} remaining.`);
        return;
      }
    }

    if (paymentProofs.length === 0) {
      alert('Please attach payment proof before marking this expense paid.');
      return;
    }

    onUpdateExpenseStatus(expenseId, 'paid', isDirectPayment ? undefined : payingInvestorId, paymentProofs);
    setLinkingExpenseId(null);
    setPayingInvestorId('');
    setPaymentProofs([]);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="expenses-and-room-issues-feature">
      <div className={`grid grid-cols-1 gap-4 ${canEditExpenses ? 'md:grid-cols-3' : 'md:grid-cols-2'}`} id="operations-summary-row">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Open Maintenance Issues</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 font-sans">{openIssuesCount}</span>
            <p className="text-[10px] text-slate-400 mt-1">Track and resolve reported issues.</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Wrench className="w-6 h-6" />
          </div>
        </div>

        {canEditExpenses && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Expenses Paid</span>
              <span className="text-2xl font-extrabold text-slate-900 mt-1 font-sans">Rs. {totalPaid.toLocaleString()}</span>
              <p className="text-[10px] text-slate-400 mt-1">Recorded after work is completed</p>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        )}

        {canEditExpenses && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Pending Liabilities</span>
              <span className="text-2xl font-extrabold text-rose-500 mt-1 font-sans">Rs. {totalPending.toLocaleString()}</span>
              <p className="text-[10px] text-slate-400 mt-1">Bills awaiting settlement</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Operations Flow</h2>
            <p className="mt-1 text-sm text-slate-500">Separate issue tracking from money movement so staff log the right thing first.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('issues')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'issues' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Maintenance Issues
            </button>
            {canEditExpenses && (
              <button
                onClick={() => setActiveTab('expenses')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'expenses' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Expenses
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row" id="operations-filters">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder={activeTab === 'issues' ? 'Search issues by room, title, assignee...' : 'Search expenses, vendor, issue link...'}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>

          {activeTab === 'issues' ? (
            <select
              value={issueStatusFilter}
              onChange={(event) => setIssueStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
            >
              <option value="all">All Issue Statuses</option>
              <option value="reported">Reported</option>
              <option value="assigned">Assigned</option>
              <option value="in-progress">In Progress</option>
              <option value="fixed">Fixed</option>
              <option value="verified">Verified</option>
              <option value="closed">Closed</option>
            </select>
          ) : (
            <select
              value={expenseStatusFilter}
              onChange={(event) => setExpenseStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
            >
              <option value="all">All Expense Statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          )}
        </div>

        {activeTab === 'issues' ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              {canEditIssues && (
                <button
                  onClick={() => setShowIssueForm((current) => !current)}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{showIssueForm ? 'Hide Issue Form' : 'Report Maintenance Issue'}</span>
                </button>
              )}
            </div>

            {showIssueForm && canEditIssues && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <h3 className="text-base font-semibold text-slate-900">Report Maintenance Issue</h3>
                  <p className="mt-1 text-sm text-slate-500">Log the issue first. Cost and investor source can be recorded later in the expense step.</p>
                </div>

                <form onSubmit={handleIssueSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Issue Title</label>
                      <input
                        type="text"
                        required
                        value={issueTitle}
                        onChange={(event) => setIssueTitle(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                        placeholder="AC issue reported"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Unit</label>
                      <select
                        required
                        value={issueRoomId}
                        onChange={(event) => setIssueRoomId(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      >
                        <option value="">Select unit</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            Unit {room.id} - {room.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Priority</label>
                      <select
                        value={issuePriority}
                        onChange={(event) => setIssuePriority(event.target.value as MaintenanceIssuePriority)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Assigned To</label>
                      <input
                        type="text"
                        value={issueAssignedTo}
                        onChange={(event) => setIssueAssignedTo(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                        placeholder="Technician name"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Reported Date</label>
                      <input
                        type="date"
                        value={issueReportedDate}
                        onChange={(event) => setIssueReportedDate(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-slate-600">Issue Notes</label>
                    <textarea
                      value={issueNotes}
                      onChange={(event) => setIssueNotes(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      rows={3}
                      placeholder="Priority urgent, remote not responding, assign electrician..."
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <ProofUploadField
                      label="Before Photos"
                      category="maintenance-before-photo"
                      value={issueBeforePhotos}
                      onChange={setIssueBeforePhotos}
                      helperText="Attach issue report photos before work starts."
                    />
                    <ProofUploadField
                      label="After Photos"
                      category="maintenance-after-photo"
                      value={issueAfterPhotos}
                      onChange={setIssueAfterPhotos}
                      helperText="Attach repair completion or verification photos."
                    />
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={resetIssueForm}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Save Issue
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-3">
              {filteredIssues.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500">
                  <AlertTriangle className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm">No maintenance issues found.</p>
                </div>
              ) : (
                filteredIssues.map((issue) => {
                  const nextAction = issue.status !== 'closed' ? ISSUE_NEXT_ACTION[issue.status] : null;
                  const linkedRoom = rooms.find((room) => room.id === issue.roomId);
                  const relatedExpenses = expenses.filter((expense) => expense.maintenanceIssueId === issue.id);
                  const relatedExpenseTotal = relatedExpenses.reduce((sum, expense) => sum + expense.amount, 0);

                  return (
                    <div key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{issue.id}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[issue.priority]}`}>{issue.priority}</span>
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{getMaintenanceIssueStatusLabel(issue.status)}</span>
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-slate-900">{issue.title}</h4>
                            <p className="mt-1 text-sm text-slate-500">
                              Unit {issue.roomId} - {linkedRoom?.name || 'Unknown unit'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            <span>Reported: {issue.reportedDate}</span>
                            <span>Assigned: {issue.assignedTo || 'Pending assignment'}</span>
                            {canEditExpenses && <span>Linked Expenses: Rs. {relatedExpenseTotal.toLocaleString()}</span>}
                            <span>Before proof: {issue.beforePhotos?.length || 0}</span>
                            <span>After proof: {issue.afterPhotos?.length || 0}</span>
                          </div>
                          {issue.notes && <p className="text-sm text-slate-600">{issue.notes}</p>}
                        </div>

                        <div className="flex flex-col gap-2 md:items-end">
                          {nextAction && canEditIssues ? (
                            <button
                              onClick={() => onUpdateMaintenanceIssue(issue.id, { status: nextAction.nextStatus })}
                              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                            >
                              {nextAction.label}
                            </button>
                          ) : (
                            <span className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                              Closed
                            </span>
                          )}
                          {canEditExpenses && (
                            <button
                              onClick={() => {
                                setActiveTab('expenses');
                                setShowExpenseForm(true);
                                setExpenseIssueId(issue.id);
                                setExpenseRoomId(issue.roomId);
                                setExpenseCategory('maintenance');
                              }}
                              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                            >
                              Add Expense
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              {canEditExpenses && (
                <button
                  onClick={() => setShowExpenseForm((current) => !current)}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{showExpenseForm ? 'Hide Expense Form' : 'Record Expense'}</span>
                </button>
              )}
            </div>

            {showExpenseForm && canEditExpenses && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <h3 className="text-base font-semibold text-slate-900">Record Expense</h3>
                  <p className="mt-1 text-sm text-slate-500">Use this after the issue is created. Link the expense back to the issue if it belongs to maintenance work.</p>
                </div>

                <form onSubmit={handleExpenseSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Expense Title</label>
                      <input
                        type="text"
                        required
                        value={expenseTitle}
                        onChange={(event) => setExpenseTitle(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                        placeholder="AC repair cost"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Expense Category</label>
                      <select
                        value={expenseCategory}
                        onChange={(event) => {
                          const nextCategory = event.target.value as ExpenseCategory;
                          setExpenseCategory(nextCategory);
                          if (nextCategory !== 'other') {
                            setExpenseCustomCategoryLabel('');
                          }
                        }}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      >
                        <option value="maintenance">Maintenance</option>
                        <option value="rent">Rent</option>
                        <option value="salaries">Salaries</option>
                        <option value="electricity">Electricity</option>
                        <option value="gas">Gas</option>
                        <option value="internet">Internet</option>
                        <option value="laundry">Laundry</option>
                        <option value="cleaning-supplies">Cleaning Supplies</option>
                        <option value="ota-commission">OTA Commission</option>
                        <option value="traveling">Traveling</option>
                        <option value="refunds">Refunds</option>
                        <option value="guest-supplies">Guest Supplies</option>
                        <option value="miscellaneous">Miscellaneous</option>
                        <option value="room-supplies">Room Supplies</option>
                        <option value="improvements">Improvements</option>
                        <option value="utilities">Utilities</option>
                        <option value="staff">Staff</option>
                        <option value="marketing">Marketing</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {expenseCategory === 'other' && (
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Other Reason / Category</label>
                      <input
                        type="text"
                        required
                        value={expenseCustomCategoryLabel}
                        onChange={(event) => setExpenseCustomCategoryLabel(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                        placeholder="Investor settlement, owner payment, rent adjustment..."
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Amount (PKR)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={expenseAmount || ''}
                        onChange={(event) => setExpenseAmount(parseInt(event.target.value, 10) || 0)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                        placeholder="8000"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Transaction Date</label>
                      <input
                        type="date"
                        required
                        value={expenseDate}
                        onChange={(event) => setExpenseDate(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                      <label className="mb-1 block text-sm text-slate-600">Unit Link</label>
                      <select
                        value={expenseRoomId}
                        onChange={(event) => setExpenseRoomId(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      >
                        <option value="">General property expense</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            Unit {room.id} - {room.name}
                          </option>
                        ))}
                      </select>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <label className="mb-1 block text-sm text-slate-600">Expense Status</label>
                      <select
                        value={expenseStatus}
                        onChange={(event) => setExpenseStatus(event.target.value as ExpenseStatus)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm text-slate-600">Investor Capital Source</label>
                      <select
                        value={expenseInvestorFundId}
                        onChange={(event) => setExpenseInvestorFundId(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      >
                        <option value="">General reserve / not assigned</option>
                        {availableExpenseInvestors.map((investor) => {
                          const remaining = getInvestorFundRemaining(expenses, investor);
                          return (
                          <option key={investor.id} value={investor.id}>
                            {investor.investorName} - Remaining Rs. {remaining.toLocaleString()}
                          </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Vendor / Paid To</label>
                      <input
                        type="text"
                        value={expenseVendorName}
                        onChange={(event) => setExpenseVendorName(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                        placeholder="Vendor or technician"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Receipt / Attachment Note</label>
                      <input
                        type="text"
                        value={expenseReceiptReference}
                        onChange={(event) => setExpenseReceiptReference(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                        placeholder="Receipt #, file note, or proof ref"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-slate-600">Description</label>
                    <textarea
                      value={expenseDescription}
                      onChange={(event) => setExpenseDescription(event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      placeholder="Vendor notes, work summary, or settlement details"
                    />
                  </div>

                  <ProofUploadField
                    label="Expense Bill / Vendor Receipt"
                    category="expense-bill"
                    value={expenseProofs}
                    onChange={setExpenseProofs}
                    helperText="Attach vendor receipt, bill image, owner rent receipt, or settlement proof."
                  />

                  <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={resetExpenseForm}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Save Expense
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {filteredExpenses.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <CreditCard className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm">No expenses found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        <th className="px-6 py-4">Expense</th>
                        <th className="px-6 py-4">Vendor</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {filteredExpenses.map((expense) => {
                        const matchingInvestor = investors.find((investor) => investor.id === expense.paidFromInvestorFundId);

                        return (
                          <tr key={expense.id}>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-800">{expense.title}</div>
                              <div className="mt-1 text-xs text-slate-400">{expense.date}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Category: {formatExpenseCategoryLabel(expense)}
                              </div>
                              {expense.description && <p className="mt-1 text-xs text-slate-500">{expense.description}</p>}
                              {expense.receiptReference && (
                                <div className="mt-1 text-xs text-slate-500">Receipt: {expense.receiptReference}</div>
                              )}
                              <div className="mt-1 text-xs text-slate-500">Proof files: {expense.proofs?.length || 0}</div>
                              {(expense.proofs?.length || 0) > 0 && (
                                <div className="mt-3">
                                  <ProofAttachmentGallery
                                    attachments={expense.proofs || []}
                                    emptyMessage="No expense proof attached."
                                  />
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-600">
                              {expense.vendorName || 'Not specified'}
                            </td>
                            <td className="px-6 py-4 font-mono font-semibold text-slate-900">
                              Rs. {expense.amount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              {expense.status === 'paid' ? (
                                <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  <CheckCircle className="mr-1 h-3.5 w-3.5" /> Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                  <Clock className="mr-1 h-3.5 w-3.5" /> Pending
                                </span>
                              )}
                              <div className="mt-1 text-xs text-slate-500">
                                {matchingInvestor ? `Funded by ${matchingInvestor.investorName}` : expense.status === 'paid' ? 'Direct / Owner / Business paid' : 'Funding not assigned'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {expense.status === 'pending' && canEditExpenses ? (
                                linkingExpenseId === expense.id ? (
                                  <div className="inline-flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                    <select
                                      value={payingInvestorId}
                                      onChange={(event) => setPayingInvestorId(event.target.value)}
                                      className="rounded-lg border border-slate-300 px-2 py-2 text-xs"
                                    >
                                      <option value="">Select payment source</option>
                                      <option value={DIRECT_PAYMENT_VALUE}>No Investor / Direct Paid / Owner Paid</option>
                                      {investors
                                        .filter((investor) => getInvestorFundRemaining(expenses, investor, expense.id) >= expense.amount)
                                        .map((investor) => (
                                        <option key={investor.id} value={investor.id}>
                                          {investor.investorName} - Remaining Rs. {getInvestorFundRemaining(expenses, investor, expense.id).toLocaleString()}
                                        </option>
                                      ))}
                                    </select>
                                    <ProofUploadField
                                      label="Payment Proof"
                                      category="expense-payment-proof"
                                      value={paymentProofs}
                                      onChange={setPaymentProofs}
                                      helperText="Attach bank slip, transfer screenshot, cash receipt, or settlement proof before confirming paid."
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={() => {
                                          setLinkingExpenseId(null);
                                          setPayingInvestorId('');
                                          setPaymentProofs([]);
                                        }}
                                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleProcessPayment(expense.id)}
                                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                                      >
                                        Confirm Paid
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setLinkingExpenseId(expense.id);
                                      setPayingInvestorId('');
                                      setPaymentProofs([]);
                                    }}
                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                                  >
                                    Assign Payment
                                  </button>
                                )
                              ) : (
                                <span className="text-xs text-slate-400">Settled</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
