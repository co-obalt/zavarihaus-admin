import {
  Booking,
  BookingSource,
  HotelState,
  HousekeepingStatus,
  MaintenanceIssue,
  MaintenanceIssueStatus,
  PaymentMethod,
  PaymentStatus,
  Room,
  RoomOperationalStatus,
  RoomStatus,
} from '../types';

const AUTO_CHECKOUT_NOTE = 'Auto checked out on schedule';
const LEGACY_READY_STATUSES = new Set(['available', 'booked', 'ready']);
const TERMINAL_BOOKING_STATUSES = new Set(['cancelled', 'checked-out', 'completed', 'rejected']);
const VALID_HOUSEKEEPING_STATUSES = new Set<HousekeepingStatus>(['dirty', 'cleaning-started', 'cleaned', 'inspected', 'ready']);
const VALID_ROOM_STATUSES = new Set<RoomStatus>(['active', 'maintenance', 'blocked']);
const VALID_BOOKING_SOURCES = new Set<BookingSource>(['airbnb', 'booking.com', 'direct', 'walk-in', 'whatsapp']);
const VALID_PAYMENT_METHODS = new Set<PaymentMethod>(['cash', 'bank', 'easypaisa', 'jazzcash', 'card', 'ota']);
const VALID_PAYMENT_STATUSES = new Set<PaymentStatus>(['unpaid', 'partial', 'paid', 'refunded']);
const VALID_MAINTENANCE_STATUSES = new Set<MaintenanceIssueStatus>(['reported', 'assigned', 'in-progress', 'fixed', 'verified', 'closed']);
const serializeValue = (value: unknown) => JSON.stringify(value || []);

export const getLocalDateInputValue = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const createEntityId = (
  prefix: string,
  date: Date = new Date(),
  randomFragment?: string
): string => {
  const stamp = [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
    String(date.getMilliseconds()).padStart(3, '0'),
  ].join('');
  const suffix = (randomFragment ?? Math.random().toString(36).slice(2, 8)).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
};

const addAutoCheckoutNote = (notes?: string): string => {
  const trimmedNotes = (notes || '').trim();
  if (trimmedNotes.includes(AUTO_CHECKOUT_NOTE)) {
    return trimmedNotes;
  }

  return trimmedNotes ? `${trimmedNotes} (${AUTO_CHECKOUT_NOTE})` : AUTO_CHECKOUT_NOTE;
};

const shouldAutoCheckoutBooking = (booking: Booking, todayStr: string): boolean =>
  (booking.status === 'checked-in' || booking.status === 'confirmed') && booking.checkOutDate <= todayStr;

const isValidTimeString = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const compareRoomIds = (left: string, right: string): number => {
  const leftNumber = Number(String(left).match(/\d+/)?.[0] || Number.NaN);
  const rightNumber = Number(String(right).match(/\d+/)?.[0] || Number.NaN);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
};

export const getBookingStatusLabel = (status: Booking['status']): string => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'confirmed':
      return 'Confirmed';
    case 'rejected':
      return 'Rejected';
    case 'checked-in':
      return 'Occupied';
    case 'checked-out':
    case 'completed':
      return 'Checked Out';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};

export const getRoomStatusLabel = (status: RoomOperationalStatus | RoomStatus): string => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'ready':
      return 'Ready';
    case 'occupied':
      return 'Occupied';
    case 'hold':
      return 'Hold';
    case 'dirty':
      return 'Dirty';
    case 'maintenance':
      return 'Maintenance';
    case 'blocked':
      return 'Blocked';
    default:
      return status;
  }
};

export const getHousekeepingStatusLabel = (status: HousekeepingStatus): string => {
  switch (status) {
    case 'dirty':
      return 'Dirty';
    case 'cleaning-started':
      return 'Cleaning Started';
    case 'cleaned':
      return 'Cleaned';
    case 'inspected':
      return 'Inspected';
    case 'ready':
      return 'Ready';
    default:
      return status;
  }
};

export const getBookingSourceLabel = (source: BookingSource): string => {
  switch (source) {
    case 'booking.com':
      return 'Booking.com';
    case 'walk-in':
      return 'Walk-in';
    default:
      return source.charAt(0).toUpperCase() + source.slice(1);
  }
};

export const getPaymentMethodLabel = (method: PaymentMethod): string => {
  switch (method) {
    case 'easypaisa':
      return 'Easypaisa';
    case 'jazzcash':
      return 'JazzCash';
    case 'ota':
      return 'OTA';
    default:
      return method.charAt(0).toUpperCase() + method.slice(1);
  }
};

export const getPaymentStatusLabel = (status: PaymentStatus): string => {
  switch (status) {
    case 'unpaid':
      return 'Unpaid';
    case 'partial':
      return 'Partial';
    case 'paid':
      return 'Paid';
    case 'refunded':
      return 'Refunded';
    default:
      return status;
  }
};

export const getMaintenanceIssueStatusLabel = (status: MaintenanceIssueStatus): string => {
  switch (status) {
    case 'reported':
      return 'Reported';
    case 'assigned':
      return 'Assigned';
    case 'in-progress':
      return 'In Progress';
    case 'fixed':
      return 'Fixed';
    case 'verified':
      return 'Verified';
    case 'closed':
      return 'Closed';
    default:
      return status;
  }
};

export const normalizeRoomStatus = (status: Room['status'] | string | undefined): RoomStatus => {
  if (status && VALID_ROOM_STATUSES.has(status as RoomStatus)) {
    return status as RoomStatus;
  }

  if (status === 'maintenance' || status === 'blocked') {
    return status;
  }

  return 'active';
};

export const normalizeHousekeepingStatus = (
  housekeepingStatus: Room['housekeepingStatus'] | string | undefined,
  legacyStatus?: string
): HousekeepingStatus => {
  if (housekeepingStatus && VALID_HOUSEKEEPING_STATUSES.has(housekeepingStatus as HousekeepingStatus)) {
    return housekeepingStatus as HousekeepingStatus;
  }

  if (legacyStatus === 'dirty') {
    return 'dirty';
  }

  if (legacyStatus && LEGACY_READY_STATUSES.has(legacyStatus)) {
    return 'ready';
  }

  return 'ready';
};

export const getRemainingBalance = (booking: Pick<Booking, 'totalPrice' | 'advanceReceived'>): number =>
  Math.max(Number(booking.totalPrice || 0) - Number(booking.advanceReceived || 0), 0);

export const derivePaymentStatus = (
  totalPrice: number,
  advanceReceived: number,
  fallbackStatus: PaymentStatus = 'unpaid'
): PaymentStatus => {
  const normalizedTotal = Number.isFinite(Number(totalPrice)) ? Math.max(Number(totalPrice), 0) : 0;
  const normalizedAdvance = Number.isFinite(Number(advanceReceived)) ? Math.max(Number(advanceReceived), 0) : 0;

  if (fallbackStatus === 'refunded') {
    return 'refunded';
  }

  if (normalizedTotal > 0 && normalizedAdvance >= normalizedTotal) {
    return 'paid';
  }

  if (normalizedAdvance > 0) {
    return 'partial';
  }

  return 'unpaid';
};

export const bookingsOverlap = (
  left: Pick<Booking, 'status' | 'checkInDate' | 'checkOutDate' | 'roomId'>,
  right: Pick<Booking, 'status' | 'checkInDate' | 'checkOutDate' | 'roomId'>
): boolean => {
  if (left.roomId !== right.roomId) {
    return false;
  }

  if (
    TERMINAL_BOOKING_STATUSES.has(left.status) ||
    TERMINAL_BOOKING_STATUSES.has(right.status) ||
    left.status === 'pending' ||
    right.status === 'pending'
  ) {
    return false;
  }

  return left.checkInDate < right.checkOutDate && left.checkOutDate > right.checkInDate;
};

export const normalizeBooking = (booking: Booking): Booking => {
  const totalPrice = Number.isFinite(Number(booking.totalPrice)) ? Number(booking.totalPrice) : 0;
  const bookingSource = VALID_BOOKING_SOURCES.has(booking.bookingSource as BookingSource) ? booking.bookingSource : 'direct';
  const paymentMethod = VALID_PAYMENT_METHODS.has(booking.paymentMethod as PaymentMethod)
    ? booking.paymentMethod
    : bookingSource === 'airbnb' || bookingSource === 'booking.com'
    ? 'ota'
    : 'cash';
  const fallbackStatus = VALID_PAYMENT_STATUSES.has(booking.paymentStatus as PaymentStatus)
    ? (booking.paymentStatus as PaymentStatus)
    : 'paid';
  const isPendingRequest = booking.status === 'pending' || booking.status === 'rejected';
  const paymentStatus = isPendingRequest ? 'unpaid' : fallbackStatus === 'refunded' ? 'refunded' : 'paid';
  const advanceReceived = isPendingRequest || paymentStatus === 'refunded' ? 0 : totalPrice;

  return {
    ...booking,
    totalPrice,
    bookingSource,
    advanceReceived,
    paymentMethod,
    paymentStatus,
    guestCount: Math.max(1, Math.round(Number(booking.guestCount || 1))),
    adminNote: booking.adminNote || '',
    checkInTime: isValidTimeString(booking.checkInTime) ? booking.checkInTime : '14:00',
    checkOutTime: isValidTimeString(booking.checkOutTime) ? booking.checkOutTime : '12:00',
    checkedInAt: typeof booking.checkedInAt === 'string' ? booking.checkedInAt : undefined,
    checkedOutAt: typeof booking.checkedOutAt === 'string' ? booking.checkedOutAt : undefined,
    specialRequest: booking.specialRequest || '',
    externalReference: booking.externalReference || '',
    notes: booking.notes || '',
    reviewNotes: booking.reviewNotes || '',
    damageNotes: booking.damageNotes || '',
    complaintNotes: booking.complaintNotes || '',
    proofs: booking.proofs || [],
  };
};

const areBookingsEqual = (left: Booking, right: Booking): boolean =>
  left.id === right.id &&
  left.roomId === right.roomId &&
  left.guestId === right.guestId &&
  left.guestFirstName === right.guestFirstName &&
  left.guestLastName === right.guestLastName &&
  left.guestPhone === right.guestPhone &&
  left.guestEmail === right.guestEmail &&
  left.guestCnic === right.guestCnic &&
  left.checkInDate === right.checkInDate &&
  left.checkOutDate === right.checkOutDate &&
  left.totalPrice === right.totalPrice &&
  left.status === right.status &&
  left.bookingSource === right.bookingSource &&
  left.advanceReceived === right.advanceReceived &&
  left.paymentMethod === right.paymentMethod &&
  left.paymentStatus === right.paymentStatus &&
  left.externalReference === right.externalReference &&
  left.specialRequest === right.specialRequest &&
  left.guestCount === right.guestCount &&
  left.adminNote === right.adminNote &&
  left.checkInTime === right.checkInTime &&
  left.checkOutTime === right.checkOutTime &&
  left.checkedInAt === right.checkedInAt &&
  left.checkedOutAt === right.checkedOutAt &&
  left.notes === right.notes &&
  left.reviewNotes === right.reviewNotes &&
  left.damageNotes === right.damageNotes &&
  left.complaintNotes === right.complaintNotes &&
  left.documentType === right.documentType &&
  left.documentNumber === right.documentNumber &&
  serializeValue(left.proofs) === serializeValue(right.proofs);

export const normalizeMaintenanceIssue = (issue: MaintenanceIssue): MaintenanceIssue => ({
  ...issue,
  priority: issue.priority === 'low' || issue.priority === 'medium' || issue.priority === 'urgent' ? issue.priority : 'medium',
  status: VALID_MAINTENANCE_STATUSES.has(issue.status as MaintenanceIssueStatus) ? issue.status : 'reported',
  assignedTo: issue.assignedTo || '',
  notes: issue.notes || '',
  beforePhotos: issue.beforePhotos || [],
  afterPhotos: issue.afterPhotos || [],
});

const areMaintenanceIssuesEqual = (left: MaintenanceIssue, right: MaintenanceIssue): boolean =>
  left.id === right.id &&
  left.title === right.title &&
  left.roomId === right.roomId &&
  left.priority === right.priority &&
  left.status === right.status &&
  left.reportedDate === right.reportedDate &&
  left.assignedTo === right.assignedTo &&
  left.notes === right.notes &&
  serializeValue(left.beforePhotos) === serializeValue(right.beforePhotos) &&
  serializeValue(left.afterPhotos) === serializeValue(right.afterPhotos);

export const isMaintenanceIssueOpen = (issue: Pick<MaintenanceIssue, 'status'>): boolean => issue.status !== 'closed';

export const isBookingActiveOnDate = (
  booking: Pick<Booking, 'status' | 'checkInDate' | 'checkOutDate'>,
  dateStr: string
): boolean =>
  !TERMINAL_BOOKING_STATUSES.has(booking.status) &&
  booking.checkInDate <= dateStr &&
  dateStr < booking.checkOutDate;

export const getActiveBookingForRoomOnDate = (
  bookings: Booking[],
  roomId: string,
  dateStr: string = getLocalDateInputValue()
): Booking | undefined =>
  bookings.find(
    (booking) => booking.roomId === roomId && isBookingActiveOnDate(booking, dateStr)
  );

export const getRoomOperationalStatus = (
  room: Room,
  bookings: Booking[],
  dateStr: string = getLocalDateInputValue()
): RoomOperationalStatus => {
  const normalizedRoomStatus = normalizeRoomStatus(room.status);
  if (normalizedRoomStatus === 'maintenance' || normalizedRoomStatus === 'blocked') {
    return normalizedRoomStatus;
  }

  const activeBooking = getActiveBookingForRoomOnDate(bookings, room.id, dateStr);
  if (activeBooking?.status === 'checked-in') {
    return 'occupied';
  }

  if (activeBooking?.status === 'confirmed') {
    return 'hold';
  }

  const housekeepingStatus = normalizeHousekeepingStatus(room.housekeepingStatus, String(room.status || ''));
  return housekeepingStatus === 'ready' ? 'ready' : 'dirty';
};

export const isRoomReadyForBooking = (
  room: Room,
  bookings: Booking[],
  dateStr: string = getLocalDateInputValue()
): boolean => getRoomOperationalStatus(room, bookings, dateStr) === 'ready';

export const validateBookingDates = (
  checkInDate: string,
  checkOutDate: string,
  todayStr: string = getLocalDateInputValue()
): string | null => {
  if (!checkInDate || !checkOutDate) {
    return 'Please specify an incoming room and proper dates.';
  }

  if (checkInDate < todayStr) {
    return `Check-in date cannot be earlier than ${todayStr}.`;
  }

  if (checkOutDate <= checkInDate) {
    return 'Check-out date must be after the check-in date.';
  }

  return null;
};

export const normalizeHotelState = (
  state: HotelState,
  todayStr: string = getLocalDateInputValue()
): HotelState => {
  const roomsNeedingDirtyReset = new Set<string>();
  let bookingsChanged = false;
  const normalizedBookings = (state.bookings || []).map((booking) => {
    const normalizedBooking = normalizeBooking(booking);
    if (!shouldAutoCheckoutBooking(normalizedBooking, todayStr)) {
      if (!areBookingsEqual(normalizedBooking, booking)) {
        bookingsChanged = true;
      }
      return normalizedBooking;
    }

    bookingsChanged = true;
    roomsNeedingDirtyReset.add(normalizedBooking.roomId);
    return {
      ...normalizedBooking,
      status: 'checked-out' as const,
      notes: addAutoCheckoutNote(normalizedBooking.notes),
    };
  });

  let maintenanceIssuesChanged = false;
  const normalizedMaintenanceIssues = (state.maintenanceIssues || []).map((issue) => {
    const normalizedIssue = normalizeMaintenanceIssue(issue);
    if (!areMaintenanceIssuesEqual(normalizedIssue, issue)) {
      maintenanceIssuesChanged = true;
    }
    return normalizedIssue;
  });

  const roomsWithOpenMaintenanceIssues = new Set(
    normalizedMaintenanceIssues.filter(isMaintenanceIssueOpen).map((issue) => issue.roomId)
  );

  let roomsChanged = false;
  const mappedRooms = (state.rooms || []).map((room) => {
    const normalizedStatus = normalizeRoomStatus(room.status);
    const normalizedHousekeepingStatus = normalizeHousekeepingStatus(room.housekeepingStatus, String(room.status || ''));

    let nextStatus: RoomStatus = normalizedStatus;
    let nextHousekeepingStatus = normalizedHousekeepingStatus;

    if (normalizedStatus !== 'blocked') {
      nextStatus = roomsWithOpenMaintenanceIssues.has(room.id) ? 'maintenance' : 'active';
    }

    if (roomsNeedingDirtyReset.has(room.id) && nextStatus === 'active') {
      nextHousekeepingStatus = 'dirty';
    }

    const didChange =
      nextStatus !== room.status ||
      nextHousekeepingStatus !== room.housekeepingStatus;

    if (!didChange) {
      return room;
    }

    roomsChanged = true;
    return {
      ...room,
      status: nextStatus,
      housekeepingStatus: nextHousekeepingStatus,
    };
  });
  const normalizedRooms = [...mappedRooms].sort((left, right) => compareRoomIds(left.id, right.id));

  if (normalizedRooms.some((room, index) => room.id !== mappedRooms[index]?.id)) {
    roomsChanged = true;
  }

  if (
    !bookingsChanged &&
    !roomsChanged &&
    !maintenanceIssuesChanged &&
    state.maintenanceIssues &&
    state.extraRevenueEntries &&
    state.auditLogs
  ) {
    return state;
  }

  return {
    ...state,
    bookings: normalizedBookings,
    rooms: normalizedRooms,
    maintenanceIssues: normalizedMaintenanceIssues,
    extraRevenueEntries: state.extraRevenueEntries || [],
    auditLogs: state.auditLogs || [],
  };
};
