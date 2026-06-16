import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Calendar,
  Coins,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { HotelState, RoomOperationalStatus, UserRole } from '../types';
import {
  getBookingSourceLabel,
  getBookingStatusLabel,
  getLocalDateInputValue,
  getMaintenanceIssueStatusLabel,
  getRoomOperationalStatus,
} from '../lib/hotelState';
import { getMonthlyProfitLossReport } from '../lib/reports';

interface DashboardViewProps {
  state: HotelState;
  setView: (view: string) => void;
  currentUserRole: UserRole;
}

const ISSUE_PRIORITY_ORDER = {
  urgent: 0,
  medium: 1,
  low: 2,
};

export default function DashboardView({ state, setView, currentUserRole }: DashboardViewProps) {
  const { rooms, bookings, expenses, maintenanceIssues } = state;

  const todayStr = getLocalDateInputValue();
  const reportMonth = todayStr.slice(0, 7);
  const reportMonthLabel = new Date(`${reportMonth}-01T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const totalRooms = rooms.length;
  const roomStatusCounts = rooms.reduce<Record<RoomOperationalStatus, number>>(
    (acc, room) => {
      const operationalStatus = getRoomOperationalStatus(room, bookings, todayStr);
      acc[operationalStatus] += 1;
      return acc;
    },
    {
      ready: 0,
      occupied: 0,
      hold: 0,
      dirty: 0,
      maintenance: 0,
      blocked: 0,
    }
  );

  const occupiedRoomsCount = roomStatusCounts.occupied;
  const holdRoomsCount = roomStatusCounts.hold;
  const readyRoomsCount = roomStatusCounts.ready;
  const dirtyRoomsCount = roomStatusCounts.dirty;
  const maintenanceRoomsCount = roomStatusCounts.maintenance;
  const blockedRoomsCount = roomStatusCounts.blocked;
  const roomsInUseCount = occupiedRoomsCount + holdRoomsCount;
  const occupancyRate = totalRooms > 0 ? Math.round((roomsInUseCount / totalRooms) * 100) : 0;
  const todayArrivals = bookings.filter((booking) => booking.status !== 'cancelled' && booking.checkInDate === todayStr);
  const todayDepartures = bookings.filter((booking) => booking.status !== 'cancelled' && booking.checkOutDate === todayStr);
  const todayCheckIns = bookings.filter((booking) => booking.checkedInAt?.slice(0, 10) === todayStr);
  const todayCheckOuts = bookings.filter((booking) => booking.checkedOutAt?.slice(0, 10) === todayStr);
  const monthlyReport = getMonthlyProfitLossReport(state, reportMonth);
  const monthlyRevenue = monthlyReport.totalRevenue;
  const monthlyExpenses = monthlyReport.totalExpenses;
  const netProfit = monthlyReport.netProfit;
  const monthlyFlowMax = Math.max(monthlyRevenue, monthlyExpenses, Math.abs(netProfit), 1);
  const monthlyExpenseLines = monthlyReport.expenseLines
    .filter((line) => line.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 4);

  const openIssues = [...maintenanceIssues]
    .filter((issue) => issue.status !== 'closed')
    .sort((left, right) => {
      const priorityDelta = ISSUE_PRIORITY_ORDER[left.priority] - ISSUE_PRIORITY_ORDER[right.priority];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return left.reportedDate < right.reportedDate ? -1 : left.reportedDate > right.reportedDate ? 1 : 0;
    });

  const activeCheckIns = bookings.filter((booking) => booking.status === 'checked-in');
  const confirmedHolds = bookings.filter((booking) => booking.status === 'confirmed');

  const roomStateData = [
    { name: 'Ready', value: readyRoomsCount, color: '#10B981' },
    { name: 'Occupied', value: occupiedRoomsCount, color: '#4F46E5' },
    { name: 'Hold', value: holdRoomsCount, color: '#0EA5E9' },
    { name: 'Dirty', value: dirtyRoomsCount, color: '#F43F5E' },
    { name: 'Maintenance', value: maintenanceRoomsCount, color: '#F59E0B' },
    { name: 'Blocked', value: blockedRoomsCount, color: '#64748B' },
  ];

  const complaintBookings = bookings.filter(
    (booking) =>
      Boolean((booking.complaintNotes || '').trim()) &&
      booking.status !== 'cancelled' &&
      booking.status !== 'checked-out'
  );
  const guestRequests = bookings.filter(
    (booking) =>
      Boolean((booking.specialRequest || '').trim()) &&
      booking.status !== 'cancelled' &&
      booking.status !== 'checked-out'
  );
  const pendingTasksCount = dirtyRoomsCount + openIssues.length + complaintBookings.length;

  if (currentUserRole === 'manager') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Today Check-Ins', value: todayCheckIns.length, tone: 'text-indigo-700 bg-indigo-50' },
            { label: 'Today Check-Outs', value: todayCheckOuts.length, tone: 'text-sky-700 bg-sky-50' },
            { label: 'Ready Units', value: readyRoomsCount, tone: 'text-emerald-700 bg-emerald-50' },
            { label: 'Dirty Units', value: dirtyRoomsCount, tone: 'text-rose-700 bg-rose-50' },
            { label: 'Maintenance Units', value: maintenanceRoomsCount, tone: 'text-amber-700 bg-amber-50' },
            { label: 'Active Guests', value: activeCheckIns.length, tone: 'text-slate-700 bg-slate-100' },
            { label: 'Pending Tasks', value: pendingTasksCount, tone: 'text-violet-700 bg-violet-50' },
            { label: 'Guest Complaints', value: complaintBookings.length, tone: 'text-fuchsia-700 bg-fuchsia-50' },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{card.label}</p>
              <div className="mt-3 flex items-center justify-between">
                <h3 className="text-3xl font-extrabold text-slate-900">{card.value}</h3>
                <span className={`rounded-xl px-3 py-2 text-xs font-bold ${card.tone}`}>{card.label.split(' ')[0]}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Operations Desk</h4>
                <p className="mt-1 text-xs text-slate-400">Daily check-ins, check-outs, cleaning, and maintenance focus.</p>
              </div>
              <button
                onClick={() => setView('bookings')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Open Bookings
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Today Arrivals</p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">{todayArrivals.length}</p>
                <p className="mt-1 text-xs text-slate-500">Reception desk arrivals due today.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Cleaning Queue</p>
                <p className="mt-2 text-2xl font-extrabold text-rose-600">{dirtyRoomsCount}</p>
                <p className="mt-1 text-xs text-slate-500">Units waiting for housekeeping progress.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Open Issues</p>
                <p className="mt-2 text-2xl font-extrabold text-amber-600">{openIssues.length}</p>
                <p className="mt-1 text-xs text-slate-500">Maintenance tickets needing action.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h4 className="text-sm font-bold text-slate-800">Ready vs Dirty</h4>
            <p className="mt-1 text-[11px] text-slate-400">Operational unit split for today.</p>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Ready', value: readyRoomsCount, color: 'bg-emerald-500' },
                { label: 'Dirty', value: dirtyRoomsCount, color: 'bg-rose-500' },
                { label: 'Maintenance', value: maintenanceRoomsCount, color: 'bg-amber-500' },
                { label: 'Occupied', value: occupiedRoomsCount, color: 'bg-indigo-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    {item.label}
                  </span>
                  <strong className="text-slate-900">{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">Maintenance Queue</h4>
              <button onClick={() => setView('expenses')} className="text-xs font-semibold text-indigo-600 hover:underline">
                Open Maintenance
              </button>
            </div>
            <div className="space-y-3">
              {openIssues.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">No open maintenance issues.</div>
              ) : (
                openIssues.slice(0, 5).map((issue) => (
                  <div key={issue.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{issue.title}</p>
                        <p className="mt-1 text-xs text-slate-500">Unit {issue.roomId} | {getMaintenanceIssueStatusLabel(issue.status)}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        {issue.priority}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">Guest Complaints</h4>
              <button onClick={() => setView('history')} className="text-xs font-semibold text-indigo-600 hover:underline">
                Open Reports
              </button>
            </div>
            <div className="space-y-3">
              {complaintBookings.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">No active guest complaints right now.</div>
              ) : (
                complaintBookings.slice(0, 5).map((booking) => (
                  <div key={booking.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{booking.guestFirstName} {booking.guestLastName}</p>
                    <p className="mt-1 text-xs text-slate-500">Unit {booking.roomId} | {getBookingStatusLabel(booking.status)}</p>
                    <p className="mt-2 text-xs text-slate-600">{booking.complaintNotes}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentUserRole === 'receptionist') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
            { label: 'Today Arrivals', value: todayArrivals.length, tone: 'text-indigo-700 bg-indigo-50' },
            { label: 'Today Departures', value: todayDepartures.length, tone: 'text-sky-700 bg-sky-50' },
            { label: 'Available Ready Units', value: readyRoomsCount, tone: 'text-emerald-700 bg-emerald-50' },
            { label: 'In-House Guests', value: activeCheckIns.length, tone: 'text-slate-700 bg-slate-100' },
            { label: 'Confirmed Holds', value: confirmedHolds.length, tone: 'text-amber-700 bg-amber-50' },
            { label: 'Guest Requests', value: guestRequests.length, tone: 'text-fuchsia-700 bg-fuchsia-50' },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{card.label}</p>
              <div className="mt-3 flex items-center justify-between">
                <h3 className="text-3xl font-extrabold text-slate-900">{card.value}</h3>
                <span className={`rounded-xl px-3 py-2 text-xs font-bold ${card.tone}`}>{card.label.split(' ')[0]}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">Today Front Desk</h4>
              <button onClick={() => setView('bookings')} className="text-xs font-semibold text-indigo-600 hover:underline">
                Open Booking Desk
              </button>
            </div>
            <div className="space-y-3">
              {todayArrivals.slice(0, 5).map((booking) => (
                <div key={booking.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{booking.guestFirstName} {booking.guestLastName}</p>
                  <p className="mt-1 text-xs text-slate-500">Arrival | Unit {booking.roomId} | {booking.checkInDate}</p>
                </div>
              ))}
              {todayArrivals.length === 0 && (
                <div className="rounded-xl bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">No arrivals scheduled for today.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">Guest Requests</h4>
              <button onClick={() => setView('history')} className="text-xs font-semibold text-indigo-600 hover:underline">
                Basic Stay History
              </button>
            </div>
            <div className="space-y-3">
              {guestRequests.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">No active guest requests.</div>
              ) : (
                guestRequests.slice(0, 5).map((booking) => (
                  <div key={booking.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{booking.guestFirstName} {booking.guestLastName}</p>
                    <p className="mt-1 text-xs text-slate-500">Unit {booking.roomId} | {getBookingStatusLabel(booking.status)}</p>
                    <p className="mt-2 text-xs text-slate-600">{booking.specialRequest}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="dashboard-view-container">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" id="metric-cards-grid">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Occupancy</p>
              <h3 className="mt-2 text-3xl font-extrabold text-slate-800">{occupancyRate}%</h3>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <Building2 className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-indigo-600">{occupiedRoomsCount} Occupied</span>
            <span>|</span>
            <span className="font-semibold text-sky-600">{holdRoomsCount} Hold</span>
            <span>|</span>
            <span className="font-semibold text-slate-700">{totalRooms} total units</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Today Check-Ins</p>
              <h3 className="mt-3 text-2xl font-extrabold text-slate-800">{todayCheckIns.length}</h3>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Completed today</span>
            <button
              onClick={() => setView('bookings')}
              className="flex items-center font-bold text-indigo-600 hover:underline"
            >
              Bookings <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Today Check-Outs</p>
              <h3 className="mt-3 text-2xl font-extrabold text-slate-800">{todayCheckOuts.length}</h3>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Completed today</span>
            <button
              onClick={() => setView('history')}
              className="flex items-center font-bold text-indigo-600 hover:underline"
            >
              Stay Records <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Units Ready / Dirty / Maintenance</p>
              <h3 className="mt-3 text-2xl font-extrabold text-slate-800">
                {readyRoomsCount} / {dirtyRoomsCount} / {maintenanceRoomsCount}
              </h3>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-emerald-600">Ready {readyRoomsCount}</span>
            <span>|</span>
            <span className="font-semibold text-rose-600">Dirty {dirtyRoomsCount}</span>
            <span>|</span>
            <span className="font-semibold text-amber-600">Maintenance {maintenanceRoomsCount}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Monthly Revenue</p>
              <h3 className="mt-3 break-words text-xl font-extrabold text-slate-800 sm:text-2xl">Rs. {monthlyRevenue.toLocaleString()}</h3>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>{reportMonthLabel}</span>
            <button
              onClick={() => setView('investors')}
              className="flex items-center font-bold text-indigo-600 hover:underline"
            >
              Finance <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Monthly Expenses</p>
              <h3 className="mt-3 break-words text-xl font-extrabold text-slate-800 sm:text-2xl">Rs. {monthlyExpenses.toLocaleString()}</h3>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
              <TrendingDown className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>{reportMonthLabel}</span>
            <button
              onClick={() => setView('expenses')}
              className="flex items-center font-bold text-indigo-600 hover:underline"
            >
              Maintenance <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Net Profit</p>
              <h3 className={`mt-3 break-words text-xl font-extrabold sm:text-2xl ${netProfit < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                Rs. {netProfit.toLocaleString()}
              </h3>
            </div>
            <div className={`rounded-xl p-3 ${netProfit < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Coins className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Revenue minus expenses</span>
            <button
              onClick={() => setView('investors')}
              className="flex items-center font-bold text-indigo-600 hover:underline"
            >
              Monthly P&L <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Open Issues</p>
              <h3 className="mt-3 text-2xl font-extrabold text-slate-800">{openIssues.length}</h3>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Maintenance and operations attention</span>
            <button
              onClick={() => setView('expenses')}
              className="flex items-center font-bold text-indigo-600 hover:underline"
            >
              Open Desk <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3" id="charts-row">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6 lg:col-span-2" id="financial-overview-chart">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h4 className="text-sm font-bold tracking-wide text-slate-800">Monthly Profit & Loss</h4>
              <p className="mt-1 text-xs text-slate-400">{reportMonthLabel} revenue, expenses, and net profit.</p>
            </div>
            <span className="w-max rounded border border-slate-100 bg-slate-50 px-2 py-0.5 font-mono text-[10px] uppercase text-slate-400">
              PKR
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 sm:p-4 md:grid-cols-4">
            <div className="min-w-0">
              <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-400">Revenue</span>
              <strong className="mt-1 block break-words text-sm text-slate-900 sm:text-base">Rs. {monthlyRevenue.toLocaleString()}</strong>
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-400">Expenses</span>
              <strong className="mt-1 block break-words text-sm text-slate-900 sm:text-base">Rs. {monthlyExpenses.toLocaleString()}</strong>
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-400">Net Profit</span>
              <strong className={`mt-1 block break-words text-sm sm:text-base ${netProfit < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                Rs. {netProfit.toLocaleString()}
              </strong>
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-400">Open Issues</span>
              <strong className="mt-1 block text-sm text-slate-900 sm:text-base">{openIssues.length}</strong>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]" id="financial-flow-panel">
            <div className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              {[
                {
                  label: 'Money In',
                  helper: 'Bookings and extra charges',
                  amount: monthlyRevenue,
                  width: (monthlyRevenue / monthlyFlowMax) * 100,
                  bar: 'bg-emerald-500',
                  text: 'text-emerald-700',
                },
                {
                  label: 'Money Out',
                  helper: 'Paid and pending expenses',
                  amount: monthlyExpenses,
                  width: (monthlyExpenses / monthlyFlowMax) * 100,
                  bar: 'bg-rose-500',
                  text: 'text-rose-700',
                },
                {
                  label: netProfit < 0 ? 'Net Loss' : 'Net Profit',
                  helper: 'Revenue minus expenses',
                  amount: Math.abs(netProfit),
                  width: (Math.abs(netProfit) / monthlyFlowMax) * 100,
                  bar: netProfit < 0 ? 'bg-slate-800' : 'bg-indigo-600',
                  text: netProfit < 0 ? 'text-slate-900' : 'text-indigo-700',
                  prefix: netProfit < 0 ? '- ' : '',
                },
              ].map((line) => (
                <div key={line.label} className="space-y-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{line.label}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{line.helper}</p>
                    </div>
                    <strong className={`break-words font-mono text-sm sm:text-right ${line.text}`}>
                      Rs. {line.prefix || ''}{line.amount.toLocaleString()}
                    </strong>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${line.bar}`}
                      style={{ width: `${Math.max(3, line.width)}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className={`rounded-2xl border px-3 py-3 sm:px-4 ${netProfit < 0 ? 'border-rose-100 bg-rose-50' : 'border-emerald-100 bg-emerald-50'}`}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className={`text-xs font-bold uppercase tracking-widest ${netProfit < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {netProfit < 0 ? 'Loss Alert' : 'Healthy Month'}
                  </span>
                  <span className={`break-words font-mono text-base font-extrabold sm:text-lg ${netProfit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    Rs. {netProfit.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Expense Drivers</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Largest cost lines this month.</p>
                </div>
                <button
                  onClick={() => setView('investors')}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Details
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {monthlyExpenseLines.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                    No expense lines recorded for {reportMonthLabel}.
                  </div>
                ) : (
                  monthlyExpenseLines.map((line) => (
                    <div key={line.label} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <span className="truncate font-semibold text-slate-600">{line.label}</span>
                        <strong className="break-words text-right font-mono text-slate-900">Rs. {line.amount.toLocaleString()}</strong>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-700"
                          style={{ width: `${Math.max(5, (line.amount / monthlyFlowMax) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6" id="room-occupancy-pie-chart">
          <div>
            <h4 className="text-sm font-bold tracking-wide text-slate-800">Unit Readiness</h4>
            <p className="mt-1 text-[11px] text-slate-400">Operational split of {totalRooms} units today.</p>
          </div>
          <div className="relative my-2 flex h-44 items-center justify-center" id="pie-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roomStateData.filter((entry) => entry.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {roomStateData.filter((entry) => entry.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} units`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">In Use</span>
              <span className="font-sans text-2xl font-extrabold text-slate-800">{roomsInUseCount}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center text-xs">
            {roomStateData.map((entry) => (
              <div key={entry.name} className="rounded-lg bg-slate-50 p-1.5">
                <span className="block font-extrabold" style={{ color: entry.color }}>{entry.value}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" id="dashboard-tables-row">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm" id="urgent-maintenance-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Wrench className="h-5 w-5 text-amber-500" />
              <h4 className="text-sm font-bold text-slate-800">Maintenance Issues</h4>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-800">
              {openIssues.length} Open
            </span>
          </div>

          <div className="space-y-3 pr-1" id="maintenance-logs-list">
            {openIssues.length === 0 ? (
              <div className="rounded-xl bg-slate-50 py-12 text-center text-slate-400">
                <p className="text-xs">No active maintenance issues reported.</p>
                <button
                  onClick={() => setView('expenses')}
                  className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Open operations desk
                </button>
              </div>
            ) : (
              openIssues.slice(0, 5).map((issue) => {
                const linkedRoom = rooms.find((room) => room.id === issue.roomId);
                const linkedExpenseTotal = expenses
                  .filter((expense) => expense.maintenanceIssueId === issue.id)
                  .reduce((sum, expense) => sum + expense.amount, 0);

                return (
                  <div key={issue.id} className="flex items-start justify-between rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-800">
                          Unit {issue.roomId}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                          {issue.priority}
                        </span>
                      </div>
                      <h5 className="text-sm font-bold text-slate-800">{issue.title}</h5>
                      <p className="text-xs text-slate-500">
                        {linkedRoom?.name || 'Unknown room'} - {getMaintenanceIssueStatusLabel(issue.status)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Assigned to: {issue.assignedTo || 'Pending assignment'} | Logged expense: Rs. {linkedExpenseTotal.toLocaleString()}
                      </p>
                      {issue.notes && <p className="text-xs text-slate-600">{issue.notes}</p>}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="flex items-center text-xs font-bold text-amber-600">
                        <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Needs attention
                      </span>
                      <button
                        onClick={() => setView('expenses')}
                        className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        Open Issue
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm" id="active-stays-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-800">Active Check-ins</h4>
            </div>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
              {activeCheckIns.length} In-house
            </span>
          </div>

          <div className="space-y-3 pr-1" id="active-guests-list">
            {activeCheckIns.length === 0 ? (
              <div className="rounded-xl bg-slate-50 py-12 text-center text-slate-400">
                <p className="text-xs">No active in-house guests currently checked-in.</p>
                <button
                  onClick={() => setView('bookings')}
                  className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Open bookings desk
                </button>
              </div>
            ) : (
              activeCheckIns.map((booking) => {
                const room = rooms.find((entry) => entry.id === booking.roomId);

                return (
                  <div key={booking.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5 transition-colors hover:bg-slate-100/70">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                      <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-xs font-bold text-indigo-800">
                          Unit {booking.roomId}
                        </span>
                        <h5 className="text-sm font-bold text-slate-800">
                          {booking.guestFirstName} {booking.guestLastName}
                        </h5>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{booking.checkInDate} to {booking.checkOutDate}</span>
                        <span>|</span>
                        <span>{getBookingSourceLabel(booking.bookingSource)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="rounded bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-700">
                        Rs. {booking.totalPrice.toLocaleString()}
                      </span>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {room?.type || 'Unit'} - {getBookingStatusLabel(booking.status)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-800">Launch Snapshot</h4>
            <p className="mt-1 text-xs text-slate-400">Simple daily and monthly booking view for the launch team.</p>
          </div>
          <button
            onClick={() => setView('bookings')}
            className="w-max rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Open Bookings
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Monthly Revenue</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">Rs. {monthlyRevenue.toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-500">{reportMonthLabel} revenue from bookings and extra charges.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Today Check-Ins</p>
            <p className="mt-2 text-2xl font-extrabold text-indigo-700">{todayCheckIns.length}</p>
            <p className="mt-1 text-xs text-slate-500">Completed check-ins on {todayStr}.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Today Check-Outs</p>
            <p className="mt-2 text-2xl font-extrabold text-amber-600">{todayCheckOuts.length}</p>
            <p className="mt-1 text-xs text-slate-500">Completed check-outs on {todayStr}.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
