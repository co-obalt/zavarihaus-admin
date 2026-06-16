import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Inbox,
  AlertCircle,
  Check,
  X,
  Phone,
  Mail,
  MessageCircle,
  Users,
  DoorOpen,
} from 'lucide-react';
import { Booking, BookingStatus, HotelState } from '../types';

interface WebsiteBookingsViewProps {
  state: HotelState;
  sessionToken: string | null;
  onUpdateBookingStatus: (bookingId: string, status: BookingStatus, adminNote?: string) => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:      { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'Pending Review' },
  confirmed:    { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: 'Confirmed' },
  rejected:     { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Rejected' },
  cancelled:    { bg: 'bg-slate-100 border-slate-300', text: 'text-slate-500', label: 'Cancelled' },
  'checked-in': { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Checked In' },
  'checked-out':{ bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500', label: 'Checked Out' },
  completed:    { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-400', label: 'Completed' },
};

const formatDate = (iso: string) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
};

const formatDateTime = (iso: string) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('en-PK', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const computeNights = (checkIn: string, checkOut: string) => {
  try {
    return Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)));
  } catch {
    return 1;
  }
};

export default function WebsiteBookingsView({ state, sessionToken, onUpdateBookingStatus }: WebsiteBookingsViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  // Get all website booking requests (identified by source markers)
  const websiteBookings = state.bookings
    .filter((booking) => {
      const isWebsite =
        booking.guestCnic === 'PUBLIC-REQUEST' ||
        (booking.notes || '').includes('Public website') ||
        (booking.notes || '').includes('ZH_BOOKING_META');
      if (!isWebsite) return false;
      if (filterStatus === 'all') return true;
      return booking.status === filterStatus;
    })
    .sort((a, b) => {
      // Pending first, then by date desc
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return (b.checkInDate || '').localeCompare(a.checkInDate || '');
    });

  const pendingCount = state.bookings.filter(
    (b) => b.status === 'pending' && (b.guestCnic === 'PUBLIC-REQUEST' || (b.notes || '').includes('Public website'))
  ).length;

  const getRoomLabel = (roomId: string) => {
    const room = state.rooms.find((r) => r.id === roomId);
    return room ? `Unit ${room.id} — ${room.name || room.type}` : `Unit ${roomId}`;
  };

  const handleConfirm = (id: string) => {
    onUpdateBookingStatus(id, 'confirmed', adminNotes[id] || '');
  };

  const handleReject = (id: string) => {
    const reason = adminNotes[id] || 'Booking request could not be accommodated.';
    onUpdateBookingStatus(id, 'rejected', reason);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-amber-600" />
            Website Booking Requests
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white leading-none">
                {pendingCount} pending
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-1">Booking requests submitted through the public website</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-600 font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All Requests</option>
          </select>
        </div>
      </div>

      {/* Empty */}
      {websiteBookings.length === 0 && (
        <div className="text-center py-16">
          <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-semibold">No website booking requests found</p>
          <p className="text-xs text-slate-300 mt-1">
            {filterStatus === 'all' ? 'Booking requests from the website will appear here' : `No ${filterStatus} requests right now`}
          </p>
        </div>
      )}

      {/* Booking cards */}
      {websiteBookings.length > 0 && (
        <div className="space-y-3">
          {websiteBookings.map((booking) => {
            const isExpanded = expandedId === booking.id;
            const style = STATUS_STYLES[booking.status] || STATUS_STYLES.pending;
            const nights = computeNights(booking.checkInDate, booking.checkOutDate);

            return (
              <div
                key={booking.id}
                className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all ${
                  booking.status === 'pending' ? 'border-l-4 border-l-amber-400' : ''
                }`}
              >
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer hover:bg-slate-50/60 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    booking.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <User className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 truncate">
                        {booking.guestFirstName} {booking.guestLastName}
                      </span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded-md ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {getRoomLabel(booking.roomId)} · {formatDate(booking.checkInDate)} → {formatDate(booking.checkOutDate)} ({nights} night{nights > 1 ? 's' : ''})
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-slate-700 hidden sm:block">
                      PKR {Number(booking.totalPrice || 0).toLocaleString()}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-4 bg-slate-50/30 space-y-4">
                    {/* Detail grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <span className="text-slate-400 block mb-1">Guest</span>
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {booking.guestFirstName} {booking.guestLastName}
                        </span>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <span className="text-slate-400 block mb-1">Room</span>
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <DoorOpen className="w-3 h-3" />
                          {getRoomLabel(booking.roomId)}
                        </span>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <span className="text-slate-400 block mb-1">Guests</span>
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {booking.guestCount || 1}
                        </span>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <span className="text-slate-400 block mb-1">Total</span>
                        <span className="font-bold text-slate-700">
                          PKR {Number(booking.totalPrice || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                      {booking.guestEmail && (
                        <a href={`mailto:${booking.guestEmail}`} className="flex items-center gap-1.5 hover:text-amber-600 transition-colors">
                          <Mail className="w-3.5 h-3.5" />
                          {booking.guestEmail}
                        </a>
                      )}
                      {booking.guestPhone && (
                        <a href={`tel:${booking.guestPhone}`} className="flex items-center gap-1.5 hover:text-amber-600 transition-colors">
                          <Phone className="w-3.5 h-3.5" />
                          {booking.guestPhone}
                        </a>
                      )}
                      {booking.guestPhone && (
                        <a
                          href={`https://wa.me/${booking.guestPhone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 hover:text-green-600 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      )}
                    </div>

                    {/* Special request */}
                    {booking.specialRequest && (
                      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Special Request</span>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{booking.specialRequest}</p>
                      </div>
                    )}

                    {/* Admin actions for pending */}
                    {booking.status === 'pending' && (
                      <div className="space-y-3 pt-1">
                        <textarea
                          value={adminNotes[booking.id] || ''}
                          onChange={(e) => setAdminNotes((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                          placeholder="Add an admin note (optional)..."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white resize-none h-[60px] focus:outline-none focus:ring-2 focus:ring-amber-300"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleConfirm(booking.id)}
                            className="flex items-center gap-1.5 text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-xl px-4 py-2 hover:bg-emerald-100 cursor-pointer transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Confirm Booking
                          </button>
                          <button
                            onClick={() => handleReject(booking.id)}
                            className="flex items-center gap-1.5 text-xs font-bold border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-2 hover:bg-red-100 cursor-pointer transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Admin note display for non-pending */}
                    {booking.status !== 'pending' && booking.adminNote && (
                      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Admin Note</span>
                        <p className="text-sm text-slate-600">{booking.adminNote}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
