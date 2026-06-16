import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  PlusCircle,
} from 'lucide-react';
import { HotelState, UserRole } from '../types';
import { getBookingStatusLabel, getLocalDateInputValue, getRoomOperationalStatus, getRoomStatusLabel } from '../lib/hotelState';
import { AppView } from '../lib/appViews';
import { canViewGuestContact, canViewSensitiveGuestIdentity, maskIdentityValue, maskPhoneValue } from '../lib/access';

interface SchedulerCalendarViewProps {
  state: HotelState;
  currentUserRole: UserRole;
  setView: (view: AppView) => void;
  onSetPrefilledBooking: (booking: { roomId: string; checkInDate: string }) => void;
}

const getStayNightsCount = (checkIn: string, checkOut: string) => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 3600 * 24)));
};

export default function SchedulerCalendarView({ state, currentUserRole, setView, onSetPrefilledBooking }: SchedulerCalendarViewProps) {
  const { bookings, rooms } = state;
  const todayStr = getLocalDateInputValue();
  const todayDate = new Date(todayStr);
  const canViewContact = canViewGuestContact(currentUserRole);
  const canViewIdentity = canViewSensitiveGuestIdentity(currentUserRole);

  const [calRoomId, setCalRoomId] = useState<string>(() => rooms[0]?.id || '');
  const [calYear, setCalYear] = useState<number>(() => todayDate.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => todayDate.getMonth());
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(todayStr);

  const activeRoom = rooms.find((room) => room.id === calRoomId) || rooms[0];

  useEffect(() => {
    if (rooms.length === 0) {
      setCalRoomId('');
      return;
    }

    if (!rooms.some((room) => room.id === calRoomId)) {
      setCalRoomId(rooms[0].id);
    }
  }, [calRoomId, rooms]);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((prev) => prev - 1);
    } else {
      setCalMonth((prev) => prev - 1);
    }
    setSelectedCalDate(null);
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((prev) => prev + 1);
    } else {
      setCalMonth((prev) => prev + 1);
    }
    setSelectedCalDate(null);
  };

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const bookedDaysCount = useMemo(() => {
    if (!activeRoom) {
      return 0;
    }

    let total = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateQuery = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const roomStatus = getRoomOperationalStatus(activeRoom, bookings, dateQuery);
      if (roomStatus === 'hold' || roomStatus === 'occupied') {
        total += 1;
      }
    }

    return total;
  }, [activeRoom, bookings, calMonth, calYear, daysInMonth]);

  const utilizationRate = daysInMonth > 0 ? Math.round((bookedDaysCount / daysInMonth) * 100) : 0;

  const bookingForSelectedDate =
    selectedCalDate && activeRoom
      ? bookings.find((booking) => {
          if (booking.roomId !== activeRoom.id || booking.status === 'cancelled' || booking.status === 'checked-out') {
            return false;
          }
          return selectedCalDate >= booking.checkInDate && selectedCalDate < booking.checkOutDate;
        })
      : null;

  const selectedRoomStatus = selectedCalDate && activeRoom ? getRoomOperationalStatus(activeRoom, bookings, selectedCalDate) : null;
  const isPastSelectedDate = Boolean(selectedCalDate && selectedCalDate < todayStr);
  const canCreateBooking = Boolean(selectedCalDate && activeRoom && !isPastSelectedDate && selectedRoomStatus === 'ready');
  const selectedDateChecklist = selectedCalDate && activeRoom
    ? [
        { label: 'Ready', passed: selectedRoomStatus === 'ready' },
        { label: 'Occupied', passed: selectedRoomStatus === 'occupied' },
        { label: 'Hold', passed: selectedRoomStatus === 'hold' },
        { label: 'Dirty', passed: selectedRoomStatus === 'dirty' },
        { label: 'Maintenance', passed: selectedRoomStatus === 'maintenance' },
        { label: 'Blocked', passed: selectedRoomStatus === 'blocked' },
      ]
    : [];

  const monthName = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const cells = useMemo(() => {
    const firstDayOfMonth = new Date(calYear, calMonth, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInCurrentMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const prevMonthDaysTotal = new Date(calYear, calMonth, 0).getDate();
    const items: { num: number; currentMonth: boolean; dateString: string }[] = [];

    for (let offset = startDayOfWeek - 1; offset >= 0; offset--) {
      const prevMonth = calMonth === 0 ? 11 : calMonth - 1;
      const prevYear = calMonth === 0 ? calYear - 1 : calYear;
      const dayNum = prevMonthDaysTotal - offset;
      items.push({
        num: dayNum,
        currentMonth: false,
        dateString: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
      });
    }

    for (let day = 1; day <= daysInCurrentMonth; day++) {
      items.push({
        num: day,
        currentMonth: true,
        dateString: `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      });
    }

    const totalCells = Math.ceil(items.length / 7) * 7;
    const extraCount = totalCells - items.length;

    for (let day = 1; day <= extraCount; day++) {
      const nextMonth = calMonth === 11 ? 0 : calMonth + 1;
      const nextYear = calMonth === 11 ? calYear + 1 : calYear;
      items.push({
        num: day,
        currentMonth: false,
        dateString: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      });
    }

    return items;
  }, [calMonth, calYear]);

  return (
    <div className="space-y-6" id="scheduler-calendar-view-root">
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3.5">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Scheduler</h2>
            <p className="mt-1 text-sm text-slate-500">Check ready dates and active stays.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="block text-xs uppercase tracking-[0.18em] text-slate-400">Utilization</span>
          <span className="font-semibold text-slate-900">
            {bookedDaysCount} / {daysInMonth} days ({utilizationRate}%)
          </span>
        </div>
      </div>

      {canCreateBooking && selectedCalDate && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 md:flex-row md:items-center">
          <div>
            <h4 className="text-sm font-semibold text-emerald-900">Ready</h4>
            <p className="mt-1 text-sm text-emerald-800">
              Unit {calRoomId} is ready on {selectedCalDate}.
            </p>
          </div>

          <button
            onClick={() => {
              onSetPrefilledBooking({
                roomId: calRoomId,
                checkInDate: selectedCalDate,
              });
              setView('bookings');
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 md:w-auto"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Booking</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12" id="scheduler-grid-system">
        <div className="space-y-6 lg:col-span-8">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {rooms.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No units found in the database yet. Add a unit first to use the scheduler.
              </div>
            )}

            <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[10.5px] font-black uppercase tracking-widest text-slate-400">Unit</label>
                <div className="relative">
                  <select
                    value={calRoomId}
                    onChange={(e) => {
                      setCalRoomId(e.target.value);
                      setSelectedCalDate(null);
                    }}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 p-3 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-500"
                    id="dropdown-selection-of-suite"
                  >
                    {rooms.map((room) => (
                      <option key={`dd-room-${room.id}`} value={room.id}>
                        {room.id} - {room.name} - Rs. {room.pricePerNight.toLocaleString()}/night
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div>
                  <h5 className="font-semibold text-slate-900">{activeRoom?.name}</h5>
                  <p className="mt-1 text-xs text-slate-500">
                    {activeRoom?.type} | Floor {activeRoom?.floor} | Unit {activeRoom?.id}
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-xs text-slate-400">
                    Today: {activeRoom ? getRoomStatusLabel(getRoomOperationalStatus(activeRoom, bookings, todayStr)) : '-'}
                  </span>
                  <span className="block text-xs text-slate-400">Rate</span>
                  <span className="font-semibold text-slate-900">Rs. {activeRoom?.pricePerNight.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" id="calendar-core-body-block">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <button
                onClick={handlePrevMonth}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
              </button>

              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-800">{monthName}</h3>

              <button
                onClick={handleNextMonth}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-px border-b border-slate-100 bg-slate-50 py-3 text-center text-[10.5px] font-black uppercase tracking-wider text-slate-400">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            <div className="grid grid-cols-7 gap-2 p-4">
              {cells.map((cell, index) => {
                const isSelected = selectedCalDate === cell.dateString;
                const roomStatus = activeRoom ? getRoomOperationalStatus(activeRoom, bookings, cell.dateString) : 'ready';
                const matchedBooking = bookings.find((booking) => {
                  if (booking.roomId !== calRoomId || booking.status === 'cancelled' || booking.status === 'checked-out') {
                    return false;
                  }
                  return cell.dateString >= booking.checkInDate && cell.dateString < booking.checkOutDate;
                });
                const bookingLabel = matchedBooking ? getBookingStatusLabel(matchedBooking.status) : null;
                const isPastDate = cell.dateString < todayStr;

                let cellClassName = 'relative min-h-[64px] rounded-xl border p-2.5 transition ';
                let badge: React.ReactNode = null;

                if (!cell.currentMonth) {
                  cellClassName += 'cursor-not-allowed border-slate-100 bg-slate-50/40 text-slate-300 opacity-35';
                } else if (roomStatus === 'maintenance') {
                  cellClassName += 'cursor-pointer border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100';
                  badge = <span className="absolute bottom-1 right-1 rounded bg-amber-200 px-1 text-[7px] font-bold uppercase text-amber-900">Maintenance</span>;
                } else if (roomStatus === 'blocked') {
                  cellClassName += 'cursor-pointer border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200';
                  badge = <span className="absolute bottom-1 right-1 rounded bg-slate-300 px-1 text-[7px] font-bold uppercase text-slate-800">Blocked</span>;
                } else if (roomStatus === 'dirty') {
                  cellClassName += 'cursor-pointer border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100';
                  badge = <span className="absolute bottom-1 right-1 rounded bg-rose-200 px-1 text-[7px] font-bold uppercase text-rose-900">Dirty</span>;
                } else if (roomStatus === 'occupied' && matchedBooking) {
                  cellClassName += 'cursor-pointer border-indigo-100 bg-indigo-50 text-indigo-900 hover:bg-indigo-100';
                  badge = (
                    <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-indigo-600 px-1 text-[7px] font-bold uppercase text-white">
                      <Lock className="h-1.5 w-1.5" />
                      <span>{bookingLabel}</span>
                    </span>
                  );
                } else if (roomStatus === 'hold' && matchedBooking) {
                  cellClassName += 'cursor-pointer border-sky-100 bg-sky-50 text-sky-900 hover:bg-sky-100';
                  badge = <span className="absolute bottom-1 right-1 rounded bg-sky-500 px-1 text-[7px] font-bold uppercase text-white">{bookingLabel}</span>;
                } else if (isPastDate) {
                  cellClassName += 'cursor-pointer border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100';
                  badge = <span className="absolute bottom-1 right-1 rounded bg-slate-200 px-1 text-[7px] font-bold uppercase text-slate-700">Past</span>;
                } else {
                  cellClassName += 'cursor-pointer border-emerald-100 bg-emerald-50/20 text-emerald-800 hover:bg-emerald-100/40';
                  badge = <span className="absolute bottom-1 right-1 rounded bg-emerald-100 px-1 text-[7px] font-bold uppercase text-emerald-800">Ready</span>;
                }

                if (isSelected && cell.currentMonth) {
                  cellClassName += ' ring-2 ring-indigo-500';
                }

                return (
                  <button
                    key={`cal-tile-${index}`}
                    type="button"
                    className={cellClassName}
                    onClick={() => {
                      if (cell.currentMonth) {
                        setSelectedCalDate(cell.dateString);
                      }
                    }}
                    disabled={!cell.currentMonth}
                  >
                    <span className={`text-left text-[11px] font-bold ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                      {cell.num}
                    </span>
                    {badge}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 bg-slate-50 p-4 text-[10.5px] text-slate-500 sm:grid-cols-4">
              <span className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-3 w-3 rounded-md border border-emerald-100 bg-emerald-50" />
                <span>Ready</span>
              </span>
              <span className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-3 w-3 rounded-md border border-sky-100 bg-sky-50" />
                <span>Hold</span>
              </span>
              <span className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-3 w-3 rounded-md border border-indigo-200 bg-indigo-50" />
                <span>Occupied</span>
              </span>
              <span className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-3 w-3 rounded-md border border-rose-200 bg-rose-50" />
                <span>Dirty</span>
              </span>
              <span className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-3 w-3 rounded-md border border-amber-200 bg-amber-50" />
                <span>Maintenance</span>
              </span>
              <span className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-3 w-3 rounded-md border border-slate-300 bg-slate-100" />
                <span>Blocked</span>
              </span>
              <span className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-3 w-3 rounded-md border border-slate-200 bg-slate-100" />
                <span>Other month</span>
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4" id="scheduler-details-indicator">
          <div className="flex h-full flex-col justify-between space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" id="stay-details-sidecard">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Details</h4>
                {selectedCalDate && (
                  <span className="rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {selectedCalDate}
                  </span>
                )}
              </div>

              {selectedCalDate ? (
                selectedRoomStatus === 'maintenance' ? (
                  <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-5 text-sm text-amber-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <strong>Maintenance</strong>
                    </div>
                    <p>Unit {calRoomId} is currently under maintenance.</p>
                  </div>
                ) : selectedRoomStatus === 'blocked' ? (
                  <div className="space-y-3 rounded-2xl border border-slate-300 bg-slate-100 p-5 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-slate-500" />
                      <strong>Blocked</strong>
                    </div>
                    <p>Unit {calRoomId} is blocked and cannot be assigned right now.</p>
                  </div>
                ) : selectedRoomStatus === 'dirty' ? (
                  <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/50 p-5 text-sm text-rose-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      <strong>Dirty</strong>
                    </div>
                    <p>Unit {calRoomId} needs cleaning before it can be assigned.</p>
                  </div>
                ) : isPastSelectedDate ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <strong>Past Date</strong>
                    </div>
                    <p>New bookings cannot be created for dates earlier than {todayStr}.</p>
                  </div>
                ) : bookingForSelectedDate ? (
                  <div className="space-y-5" id="active-day-client-diagnostics">
                    <div className="space-y-2.5">
                      <span className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Guest</span>
                      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="block font-medium text-slate-400">Name</span>
                            <strong className="mt-1 block text-sm font-extrabold text-slate-800">
                              {bookingForSelectedDate.guestFirstName} {bookingForSelectedDate.guestLastName}
                            </strong>
                          </div>
                          <span className="rounded border border-indigo-150 bg-indigo-50 px-2 py-0.5 text-[9.5px] font-extrabold text-indigo-800">
                            #{bookingForSelectedDate.id}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-2.5">
                          <div>
                            <span className="block font-medium text-slate-400">Phone</span>
                            <strong className="font-mono text-slate-700">
                              {canViewContact ? bookingForSelectedDate.guestPhone : maskPhoneValue(bookingForSelectedDate.guestPhone)}
                            </strong>
                          </div>
                          <div>
                            <span className="block font-medium text-slate-400">ID</span>
                            <strong
                              className="block truncate font-mono text-[11px] text-slate-700"
                              title={canViewIdentity ? bookingForSelectedDate.guestCnic : undefined}
                            >
                              {canViewIdentity ? bookingForSelectedDate.guestCnic : maskIdentityValue(bookingForSelectedDate.guestCnic)}
                            </strong>
                          </div>
                        </div>

                        {bookingForSelectedDate.guestEmail && (
                          <div className="border-t border-slate-100 pt-2">
                            <span className="block font-medium text-slate-400">Email</span>
                            <span className="block truncate font-semibold text-indigo-600">
                              {canViewContact ? bookingForSelectedDate.guestEmail : 'Restricted'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <span className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Stay</span>
                      <div className="space-y-3.5 rounded-xl border border-indigo-900 bg-indigo-950 p-4 text-xs text-white">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-indigo-200">Stay Status</span>
                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                              bookingForSelectedDate.status === 'checked-in' ? 'bg-indigo-600' : 'bg-sky-500'
                            }`}
                          >
                            {getBookingStatusLabel(bookingForSelectedDate.status)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                            <span className="block text-[9.5px] font-bold uppercase text-indigo-300">Check-In</span>
                            <span className="mt-1 block text-xs font-black">{bookingForSelectedDate.checkInDate}</span>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                            <span className="block text-[9.5px] font-bold uppercase text-indigo-300">Check-Out</span>
                            <span className="mt-1 block text-xs font-black">{bookingForSelectedDate.checkOutDate}</span>
                          </div>
                        </div>

                        <div className="border-t border-white/10 pt-2.5 text-[11px] text-indigo-200">
                          Duration: {getStayNightsCount(bookingForSelectedDate.checkInDate, bookingForSelectedDate.checkOutDate)} nights
                        </div>

                        {bookingForSelectedDate.notes && (
                          <div className="border-t border-white/10 pt-2.5 text-[11px] italic text-indigo-200">
                            "{bookingForSelectedDate.notes}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <span className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Price</span>
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-500">
                          <span>Nightly rate</span>
                          <span className="font-mono">Rs. {activeRoom?.pricePerNight.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between font-semibold text-slate-500">
                          <span>Nights</span>
                          <span className="font-mono">x {getStayNightsCount(bookingForSelectedDate.checkInDate, bookingForSelectedDate.checkOutDate)}</span>
                        </div>
                        <div className="my-2 h-px bg-slate-200" />
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-slate-700">Total</span>
                          <span className="font-mono font-black text-indigo-600">Rs. {bookingForSelectedDate.totalPrice.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setView('bookings')}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:bg-slate-200"
                    >
                      <span>View Bookings</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 p-5 text-xs" id="scheduler-date-ready-details">
                    <div className="space-y-1">
                      <span className="block text-sm font-extrabold text-emerald-900">Ready</span>
                      <p className="font-medium text-emerald-700/90">Unit {calRoomId} is ready on {selectedCalDate}.</p>
                      {selectedCalDate === todayStr && (
                        <p className="text-[11px] text-amber-700">
                          Same-day booking will still require collected payment in the booking form before confirmation.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 rounded-xl border border-emerald-200 bg-white p-3 font-mono">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>Nightly rate</span>
                        <strong>Rs. {activeRoom?.pricePerNight.toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-[11px]">
                      <div className="font-semibold text-slate-700">Status Checklist</div>
                      {selectedDateChecklist.map((entry) => (
                        <div key={entry.label} className="flex items-center justify-between text-slate-600">
                          <span>{entry.label}</span>
                          <span className={entry.passed ? 'font-bold text-emerald-700' : 'text-slate-400'}>
                            {entry.passed ? 'Current' : '-'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        onSetPrefilledBooking({
                          roomId: calRoomId,
                          checkInDate: selectedCalDate,
                        });
                        setView('bookings');
                      }}
                      className="block w-full rounded-xl bg-emerald-600 px-4 py-3 text-center text-xs font-extrabold uppercase tracking-widest text-white transition hover:bg-emerald-700"
                    >
                      New Booking
                    </button>
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-400" id="day-diagnostics-help">
                  <Calendar className="mx-auto mb-2.5 block h-10 w-10 text-slate-300" />
                  <span>Select a date to view details.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
