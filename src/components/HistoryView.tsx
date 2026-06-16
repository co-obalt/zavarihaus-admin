import React, { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  History,
  Search,
  User,
  X,
} from 'lucide-react';
import { Booking, HotelState, UserRole } from '../types';
import {
  getBookingSourceLabel,
  getBookingStatusLabel,
  getPaymentMethodLabel,
} from '../lib/hotelState';
import {
  canViewGuestContact,
  canViewGuestHistory,
  canViewSensitiveGuestIdentity,
  maskIdentityValue,
  maskPhoneValue,
} from '../lib/access';

interface HistoryViewProps {
  state: HotelState;
  currentUserRole: UserRole;
  onUpdateBookingStatus?: (bookingId: string, status: Booking['status']) => void;
}

export default function HistoryView({ state, currentUserRole }: HistoryViewProps) {
  const { bookings, rooms } = state;
  const canViewContact = canViewGuestContact(currentUserRole);
  const canViewIdentity = canViewSensitiveGuestIdentity(currentUserRole);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoomId, setFilterRoomId] = useState<string>('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const auditedBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        const query = searchQuery.toLowerCase().trim();
        const fullName = `${booking.guestFirstName} ${booking.guestLastName}`.toLowerCase();
        const matchesSearch =
          !query ||
          fullName.includes(query) ||
          booking.id.toLowerCase().includes(query) ||
          booking.roomId.toLowerCase().includes(query) ||
          (booking.guestCnic || '').toLowerCase().includes(query) ||
          (booking.guestPhone || '').includes(query) ||
          (booking.guestEmail || '').toLowerCase().includes(query) ||
          (booking.externalReference || '').toLowerCase().includes(query);

        const matchesRoom = filterRoomId === 'all' || booking.roomId === filterRoomId;
        const matchesStatus = filterStatus === 'all' || booking.status === filterStatus;
        const matchesDate =
          !filterDate ||
          filterDate === booking.checkInDate ||
          filterDate === booking.checkOutDate ||
          (filterDate > booking.checkInDate && filterDate < booking.checkOutDate);

        return matchesSearch && matchesRoom && matchesStatus && matchesDate;
      }),
    [bookings, filterDate, filterRoomId, filterStatus, searchQuery]
  );

  const checkedOutCount = bookings.filter((booking) => booking.status === 'checked-out').length;
  const activeInHouseCount = bookings.filter((booking) => booking.status === 'checked-in' || booking.status === 'confirmed').length;
  const totalLedgerBookings = bookings.length;

  const getRoomName = (roomId: string) => {
    const room = rooms.find((entry) => entry.id === roomId);
    return room ? `${room.id} - ${room.name}` : `Unit ${roomId}`;
  };

  return (
    <div className="space-y-6 animate-fade-in" id="stay-history-view">
      {!canViewGuestHistory(currentUserRole) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your role cannot access full guest stay history.
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:flex-row md:items-center" id="history-header">
        <div className="flex items-center space-x-3.5">
          <div className="rounded-xl bg-slate-900 p-3 text-slate-100">
            <History className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-800">Stay Records</h2>
            <p className="mt-1 text-xs text-slate-400">
              Unit stays, dates, collected payment, and stay-specific issues like complaints or damage notes.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-900">
          Stay Records | ZavariHaus
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3" id="security-audit-kpis">
        <div className="flex items-center justify-between rounded-2xl border border-slate-150 bg-white p-5 shadow-3xs">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Completed Check-Outs</span>
            <span className="mt-1 block text-2xl font-bold text-slate-800">{checkedOutCount} Guests</span>
            <span className="mt-1.5 flex items-center text-[10px] font-medium text-emerald-600">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-500" /> Archived stays
            </span>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-150 bg-white p-5 shadow-3xs">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Bookings</span>
            <span className="mt-1 block text-2xl font-bold text-indigo-700">{activeInHouseCount} Stays</span>
            <span className="mt-1.5 flex items-center text-[10px] font-medium text-indigo-500">
              <Clock className="mr-1 h-3.5 w-3.5" /> Checked-in or hold
            </span>
          </div>
          <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-150 bg-white p-5 shadow-3xs">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Records</span>
            <span className="mt-1 block text-2xl font-bold text-slate-800">{totalLedgerBookings} Entries</span>
            <span className="mt-1.5 text-[10px] font-medium text-slate-500">Cumulative stay index</span>
          </div>
          <div className="rounded-xl bg-slate-100 p-3 font-mono text-xs font-bold text-slate-600">
            INDEX
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-3xs" id="precise-audit-filters">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
          <History className="h-4 w-4 text-slate-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Search Parameters & Filters
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Search by Guest/ID</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Name, phone, ID, ref..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-lg border border-slate-205 bg-slate-50 py-2 pl-8 pr-3 text-xs outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Filter by Unit</label>
            <select
              value={filterRoomId}
              onChange={(event) => setFilterRoomId(event.target.value)}
              className="w-full cursor-pointer rounded-lg border border-slate-205 bg-slate-50 p-2 text-xs font-semibold outline-none focus:border-indigo-500"
            >
              <option value="all">All Units</option>
              {rooms.map((room) => (
                <option key={`audit-opt-room-${room.id}`} value={room.id}>
                  Unit {room.id} ({room.name})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Stay Date</label>
            <div className="relative">
              <input
                type="date"
                value={filterDate}
                onChange={(event) => setFilterDate(event.target.value)}
                className="w-full rounded-lg border border-slate-205 bg-slate-50 p-2 text-xs outline-none focus:border-indigo-500"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="absolute right-2.5 top-2.5 text-xs font-bold text-rose-500 hover:text-rose-700"
                  title="Clear Date"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Booking Status</label>
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="w-full cursor-pointer rounded-lg border border-slate-205 bg-slate-50 p-2 text-xs font-bold outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="checked-out">Checked Out</option>
              <option value="checked-in">Checked In</option>
              <option value="confirmed">Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {(searchQuery || filterRoomId !== 'all' || filterDate || filterStatus !== 'all') && (
          <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2 px-3.5 text-xs">
            <span className="font-semibold text-slate-500">
              Currently filtering <strong className="font-bold text-slate-800">{auditedBookings.length} results</strong> out of {totalLedgerBookings} entries.
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterRoomId('all');
                setFilterDate('');
                setFilterStatus('all');
              }}
              className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3" id="audit-listings-container">
        {auditedBookings.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 py-14 text-center text-slate-400 shadow-sm">
            <History className="mx-auto block h-11 w-11 text-slate-300" />
            <h4 className="text-sm font-semibold text-slate-700">No matching stays found</h4>
            <p className="mx-auto max-w-sm text-xs text-slate-400">
              Adjust search keywords or filters to discover the booking record you need.
            </p>
          </div>
        ) : (
          auditedBookings.map((booking) => {
            const statusChipClass =
              booking.status === 'checked-out'
                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                : booking.status === 'cancelled'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : booking.status === 'checked-in'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200';
            const leftIndicatorClass =
              booking.status === 'checked-out'
                ? 'bg-indigo-500'
                : booking.status === 'cancelled'
                ? 'bg-rose-500'
                : booking.status === 'checked-in'
                ? 'bg-emerald-500'
                : 'bg-amber-500';

            return (
              <div
                key={booking.id}
                onClick={() => setSelectedBooking(booking)}
                className="group relative flex cursor-pointer flex-col items-start justify-between gap-5 overflow-hidden rounded-2xl border border-slate-202 bg-white p-5 transition-all hover:border-slate-350 hover:shadow-md md:flex-row md:items-center"
              >
                <div className={`absolute bottom-0 left-0 top-0 w-1 ${leftIndicatorClass}`} />

                <div className="flex items-start space-x-3.5 pl-1.5">
                  <div className="mt-1 rounded-xl bg-slate-50 p-2.5 text-slate-600 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                    <User className="h-4 w-4 shrink-0" />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[9px] font-semibold tracking-wider text-slate-400">#{booking.id}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${statusChipClass}`}>
                        {getBookingStatusLabel(booking.status)}
                      </span>
                      {booking.guestCnic && (
                        <span className="rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-slate-400">
                          ID: {canViewIdentity ? booking.guestCnic : maskIdentityValue(booking.guestCnic)}
                        </span>
                      )}
                    </div>

                    <h4 className="mt-1.5 text-sm font-semibold text-slate-800 transition-colors group-hover:text-indigo-600">
                      {booking.guestFirstName} {booking.guestLastName}
                    </h4>

                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="font-semibold text-slate-600">{getRoomName(booking.roomId)}</span>
                      </span>
                      <span>Phone: {canViewContact ? booking.guestPhone : maskPhoneValue(booking.guestPhone)}</span>
                      <span>{getBookingSourceLabel(booking.bookingSource)}</span>
                      <span>Paid in full</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 self-stretch border-t border-slate-100 pt-3 pl-2 md:justify-end md:border-t-0 md:pt-0">
                  <div className="text-left md:text-right">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Stay Interval</span>
                    <span className="mt-0.5 block text-xs font-mono text-slate-600">{booking.checkInDate} to {booking.checkOutDate}</span>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {booking.checkInTime || '14:00'} check-in | {booking.checkOutTime || '12:00'} check-out
                    </span>
                  </div>

                  <div className="text-left md:text-right">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bill Summary</span>
                    <strong className="mt-0.5 block text-sm font-bold text-slate-900">Rs. {booking.totalPrice.toLocaleString()}</strong>
                    <span className="mt-1 block text-[10px] text-slate-400">Collected in full</span>
                  </div>

                  <div className="hidden rounded-lg bg-slate-50 p-1.5 text-slate-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600 sm:block">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-fade-in" id="police-inspector-dialog">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl animate-slide-in" id="police-inspector-card">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 p-5 text-white">
              <div className="flex items-center space-x-3.5">
                <History className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Guest Stay Profile</h3>
                  <p className="font-mono text-[10px] text-indigo-200">BOOKING ID: {selectedBooking.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="cursor-pointer rounded-lg p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[72vh] space-y-5 overflow-y-auto p-6" id="police-inspector-body">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="flex items-center space-x-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <User className="h-3.5 w-3.5" />
                    <span>Guest Snapshot</span>
                  </h4>
                  <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                    <div>
                      <span className="block font-medium text-slate-400">Guest Full Name</span>
                      <strong className="mt-0.5 block text-sm font-semibold text-slate-800">
                        {selectedBooking.guestFirstName} {selectedBooking.guestLastName}
                      </strong>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Phone Number</span>
                      <strong className="mt-0.5 block text-slate-800">
                        {canViewContact ? selectedBooking.guestPhone : maskPhoneValue(selectedBooking.guestPhone)}
                      </strong>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Email</span>
                      <strong className="mt-0.5 block break-all text-slate-800">
                        {canViewContact ? selectedBooking.guestEmail || '-' : 'Restricted'}
                      </strong>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Document</span>
                      <strong className="mt-1 block max-w-max rounded border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-800">
                        {selectedBooking.documentType === 'passport' ? 'Passport' : 'CNIC'}:{' '}
                        {canViewIdentity ? selectedBooking.guestCnic : maskIdentityValue(selectedBooking.guestCnic)}
                      </strong>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Guest Count</span>
                      <strong className="mt-0.5 block text-slate-800">{selectedBooking.guestCount}</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="flex items-center space-x-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Stay Details</span>
                  </h4>
                  <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                    <div>
                      <span className="block font-medium text-slate-400">Unit Assigned</span>
                      <strong className="mt-0.5 block text-sm font-semibold text-slate-800">{getRoomName(selectedBooking.roomId)}</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-2">
                      <div>
                        <span className="block font-medium text-slate-400">Check-In</span>
                        <strong className="mt-0.5 block text-slate-700">{selectedBooking.checkInDate}</strong>
                      </div>
                      <div>
                        <span className="block font-medium text-slate-400">Check-Out</span>
                        <strong className="mt-0.5 block text-slate-700">{selectedBooking.checkOutDate}</strong>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block font-medium text-slate-400">Check-In Time</span>
                        <strong className="mt-0.5 block text-slate-700">{selectedBooking.checkInTime || '14:00'}</strong>
                      </div>
                      <div>
                        <span className="block font-medium text-slate-400">Check-Out Time</span>
                        <strong className="mt-0.5 block text-slate-700">{selectedBooking.checkOutTime || '12:00'}</strong>
                      </div>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Status</span>
                      <span className="mt-1 block text-xs font-semibold uppercase text-indigo-700">
                        {getBookingStatusLabel(selectedBooking.status)}
                      </span>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Booking Source</span>
                      <strong className="mt-0.5 block text-slate-800">{getBookingSourceLabel(selectedBooking.bookingSource)}</strong>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">External Reference</span>
                      <strong className="mt-0.5 block text-slate-800">{selectedBooking.externalReference || '-'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Stay Notes</span>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 text-xs font-medium italic leading-relaxed text-amber-900">
                    {selectedBooking.notes || 'No receptionist notes registered for this stay.'}
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Special Request</span>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                    {selectedBooking.specialRequest || 'No special request recorded.'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Review</span>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                    {selectedBooking.reviewNotes || 'No review recorded.'}
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Damage</span>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                    {selectedBooking.damageNotes || 'No damage recorded.'}
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Complaint</span>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                    {selectedBooking.complaintNotes || 'No complaint recorded.'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Financial Bill</span>
                <div className="space-y-2 rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Total booking amount</span>
                    <span>Rs. {selectedBooking.totalPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Collected amount</span>
                    <span>Rs. {selectedBooking.totalPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Payment method</span>
                    <span>{getPaymentMethodLabel(selectedBooking.paymentMethod)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Payment</span>
                    <span>Paid in full</span>
                  </div>
                  <div className="rounded-lg bg-white/5 px-3 py-2 text-slate-300">
                    Including tax
                  </div>
                  <div className="my-2 h-px bg-white/10" />
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-300">Total collected</span>
                    <span className="text-green-400">Rs. {selectedBooking.totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                <strong>Stay Proofs:</strong> {selectedBooking.proofs?.length || 0} file(s) attached to this stay.
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-150 bg-slate-50 p-4">
              <span className="text-[10px] text-slate-400">Showing the latest stay record details.</span>
              <button
                onClick={() => setSelectedBooking(null)}
                className="cursor-pointer rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-950"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
