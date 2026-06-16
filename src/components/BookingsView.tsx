import React, { useEffect, useRef, useState } from 'react';
import { toBlob, toJpeg } from 'html-to-image';
import { 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  LogOut, 
  X, 
  UserPlus, 
  Tag, 
  Users,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Lock,
  Unlock,
  Clock,
  ArrowRight,
  Copy,
  Download
} from 'lucide-react';
import { HotelState, Booking, Room, Guest, BookingStatus, RoomOperationalStatus, BookingSource, PaymentMethod, ProofAttachment, UserRole } from '../types';
import { createEntityId, getBookingSourceLabel, getBookingStatusLabel, getLocalDateInputValue, getPaymentMethodLabel, getRoomOperationalStatus, getRoomStatusLabel, validateBookingDates } from '../lib/hotelState';
import { canCancelBookings, canViewGuestContact, canViewSensitiveGuestIdentity, maskIdentityValue, maskPhoneValue } from '../lib/access';
import ProofUploadField from './ProofUploadField';
import PhoneInput, { isValidPhoneValue } from './PhoneInput';

interface BookingsViewProps {
  state: HotelState;
  currentUserRole: UserRole;
  onAddBooking: (booking: Omit<Booking, 'id'> & { id?: string }) => void;
  onUpdateBookingStatus: (bookingId: string, status: BookingStatus, adminNote?: string) => void;
  onAddGuest: (guest: Omit<Guest, 'id'>) => string; // Returns auto generated Guest ID
  onTriggerAutoCheckout?: () => void;
  prefilledBooking?: { roomId: string; checkInDate: string } | null;
  onClearPrefilledBooking?: () => void;
  requestInbox?: boolean;
}

export default function BookingsView({ 
  state, 
  currentUserRole,
  onAddBooking, 
  onUpdateBookingStatus, 
  onAddGuest, 
  onTriggerAutoCheckout,
  prefilledBooking,
  onClearPrefilledBooking,
  requestInbox = false
}: BookingsViewProps) {
  const { rooms, bookings, guests } = state;
  const todayStr = getLocalDateInputValue();
  const canViewContact = canViewGuestContact(currentUserRole);
  const canViewIdentity = canViewSensitiveGuestIdentity(currentUserRole);
  const canCancelBookingRecords = canCancelBookings(currentUserRole);

  const [activeTab, setActiveTab] = useState<'list' | 'new' | 'occupancy'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'1week' | 'all'>('all');

  useEffect(() => {
    if (!requestInbox) return;
    setActiveTab('list');
    setStatusFilter('pending');
    setTimeFilter('all');
  }, [requestInbox]);

  // Detail Inspector Modal State
  const [selectedDetailedBooking, setSelectedDetailedBooking] = useState<Booking | null>(null);
  const receiptCardRef = useRef<HTMLDivElement | null>(null);
  const [receiptAction, setReceiptAction] = useState<'copy' | 'download' | null>(null);
  const [receiptMessage, setReceiptMessage] = useState<string | null>(null);

  // Success Feedback HUD State
  const [successBookingInfo, setSuccessBookingInfo] = useState<{
    id: string;
    roomId: string;
    guestName: string;
    dates: string;
    price: number;
  } | null>(null);

  // New Reservation Form State (Guest + Stay combo)
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [docType, setDocType] = useState<'cnic' | 'passport'>('cnic');
  const [guestCnic, setGuestCnic] = useState(''); // Stores the final selected document number
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [notes, setNotes] = useState('');
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [bookingSource, setBookingSource] = useState<BookingSource>('direct');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [externalReference, setExternalReference] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [guestCount, setGuestCount] = useState<number>(1);
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [reviewNotes, setReviewNotes] = useState('');
  const [damageNotes, setDamageNotes] = useState('');
  const [complaintNotes, setComplaintNotes] = useState('');
  const [guestIdentityProofs, setGuestIdentityProofs] = useState<ProofAttachment[]>([]);
  const [stayProofs, setStayProofs] = useState<ProofAttachment[]>([]);

  // Return existing guest select support in case they are returning
  const [isReturningGuest, setIsReturningGuest] = useState(false);

  const renderReceiptRow = (label: string, value: React.ReactNode, mono = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 7 }}>
      <span style={{ width: 108, color: '#6b7280', fontSize: 12, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontFamily: mono ? '"Courier New", Courier, monospace' : undefined, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );

  const renderReceiptCanvas = async () => {
    if (!receiptCardRef.current) {
      throw new Error('Receipt card not found.');
    }
  };

  const handleCopyReceiptImage = async () => {
    if (!selectedDetailedBooking) return;

    try {
      setReceiptAction('copy');
      setReceiptMessage(null);

      await renderReceiptCanvas();
      const blob = await toBlob(receiptCardRef.current!, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      if (!blob) {
        throw new Error('Receipt image could not be created.');
      }

      if (!navigator.clipboard || !(window as any).ClipboardItem) {
        throw new Error('Copy image is not supported in this browser.');
      }

      await navigator.clipboard.write([
        new (window as any).ClipboardItem({
          'image/png': blob,
        }),
      ]);

      setReceiptMessage('Receipt image copied.');
    } catch (error) {
      console.error('Copy receipt image failed:', error);
      setReceiptMessage(error instanceof Error ? error.message : 'Copy failed.');
    } finally {
      setReceiptAction(null);
    }
  };

  const handleDownloadReceiptImage = async () => {
    if (!selectedDetailedBooking) return;

    try {
      setReceiptAction('download');
      setReceiptMessage(null);

      await renderReceiptCanvas();
      const dataUrl = await toJpeg(receiptCardRef.current!, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        quality: 1.0,
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Zavarihaus-reservation-${selectedDetailedBooking.id}.jpg`;
      link.click();

      setReceiptMessage('Receipt JPG downloaded.');
    } catch (error) {
      console.error('Download receipt image failed:', error);
      setReceiptMessage('Download failed.');
    } finally {
      setReceiptAction(null);
    }
  };
  const [selectedGuestId, setSelectedGuestId] = useState('');

  const handleCancelBooking = (booking: Booking) => {
    const confirmed = window.confirm(
      `Cancel booking ${booking.id} for ${booking.guestFirstName} ${booking.guestLastName}?`
    );

    if (!confirmed) {
      return;
    }

    onUpdateBookingStatus(booking.id, 'cancelled');
    setSelectedDetailedBooking((current) => (current?.id === booking.id ? null : current));
  };

  const handleRejectBooking = (booking: Booking) => {
    const reason = window.prompt(`Reject booking ${booking.id}? Optional reason for admin notes:`, booking.adminNote || '');
    if (reason === null) {
      return;
    }

    onUpdateBookingStatus(booking.id, 'rejected', reason.trim());
    setSelectedDetailedBooking((current) =>
      current?.id === booking.id ? { ...current, status: 'rejected', adminNote: reason.trim() } : current
    );
  };

  // Daily Occupancy specific state
  const [occupancyDate, setOccupancyDate] = useState(() => {
    return getLocalDateInputValue();
  });

  // Hotfix-safe date generator
  const getISODateStr = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Live Gantt matrix starting timeline anchor (Default: May 21st, 2026 centring May 23rd)
  const [timelineAnchor, setTimelineAnchor] = useState<Date>(() => {
    const initialAnchor = new Date();
    initialAnchor.setHours(0, 0, 0, 0);
    initialAnchor.setDate(initialAnchor.getDate() - 2);
    return initialAnchor;
  });

  // Calculate 10 days of timeline
  const timelineDays = Array.from({ length: 10 }).map((_, idx) => {
    const d = new Date(timelineAnchor);
    d.setDate(timelineAnchor.getDate() + idx);
    return d;
  });

  // Calculate price dynamically
  useEffect(() => {
    if (selectedRoomId && checkInDate && checkOutDate) {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (room) {
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const timeDiff = end.getTime() - start.getTime();
        const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
        if (nights > 0) {
          setTotalPrice(nights * room.pricePerNight);
        } else {
          setTotalPrice(0);
        }
      }
    } else {
      setTotalPrice(0);
    }
  }, [selectedRoomId, checkInDate, checkOutDate, rooms]);

  // Handle autofill when selecting a returning guest
  useEffect(() => {
    if (isReturningGuest && selectedGuestId) {
      const match = guests.find(g => g.id === selectedGuestId);
      if (match) {
        setGuestFirstName(match.firstName);
        setGuestLastName(match.lastName);
        setGuestPhone(match.phone);
        setGuestEmail(match.email || '');
        setDocType(match.documentType || 'cnic');
        setGuestCnic(match.cnic);
        setGuestIdentityProofs(match.identityProofs || []);
      }
    } else if (!isReturningGuest) {
      setSelectedGuestId('');
      setGuestFirstName('');
      setGuestLastName('');
      setGuestPhone('');
      setGuestEmail('');
      setGuestCnic('');
      setGuestIdentityProofs([]);
    }
  }, [isReturningGuest, selectedGuestId, guests]);

  // Trigger auto checkout sweep when bookings tab is explicitly loaded
  useEffect(() => {
    if (activeTab === 'list' && onTriggerAutoCheckout) {
      onTriggerAutoCheckout();
    }
  }, [activeTab, onTriggerAutoCheckout]);

  // Handle incoming quick reservation prefill states
  useEffect(() => {
    if (prefilledBooking) {
      setSelectedRoomId(prefilledBooking.roomId);
      setCheckInDate(prefilledBooking.checkInDate);
      
      const d = new Date(prefilledBooking.checkInDate);
      d.setDate(d.getDate() + 1);
      const computedCheckout = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setCheckOutDate(computedCheckout);
      
      setActiveTab('new');
      setSuccessBookingInfo(null);
      
      if (onClearPrefilledBooking) {
        onClearPrefilledBooking();
      }
    }
  }, [prefilledBooking, onClearPrefilledBooking]);

  // Strict double booking validator
  const checkOverlapConflict = (roomId: string, startStr: string, endStr: string, excludeBookingId?: string): boolean => {
    if (!startStr || !endStr) return false;
    const reqStart = new Date(startStr);
    const reqEnd = new Date(endStr);
    if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime()) || reqStart >= reqEnd) return false;

    return bookings.some(booking => {
      if (booking.id === excludeBookingId) return false;
      if (booking.roomId !== roomId) return false;
      if (
        booking.status === 'cancelled' ||
        booking.status === 'checked-out' ||
        booking.status === 'completed' ||
        booking.status === 'rejected' ||
        booking.status === 'pending'
      ) return false;

      const actStart = new Date(booking.checkInDate);
      const actEnd = new Date(booking.checkOutDate);

      // Overlap logic: startA < endB && endA > startB
      return reqStart < actEnd && reqEnd > actStart;
    });
  };

  const handleDocTypeChange = (newType: 'cnic' | 'passport') => {
    setDocType(newType);
    setGuestCnic('');
  };

  const handleDocNumberChange = (val: string) => {
    if (docType === 'cnic') {
      const digits = val.replace(/\D/g, '').slice(0, 13);
      let formatted = '';
      if (digits.length > 0) {
        formatted += digits.slice(0, 5);
      }
      if (digits.length > 5) {
        formatted += '-' + digits.slice(5, 12);
      }
      if (digits.length > 12) {
        formatted += '-' + digits.slice(12, 13);
      }
      setGuestCnic(formatted);
    } else {
      const clean = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase();
      setGuestCnic(clean);
    }
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRoomId || !checkInDate || !checkOutDate) {
      alert('Please specify an incoming unit and proper dates.');
      return;
    }

    const dateValidationMessage = validateBookingDates(checkInDate, checkOutDate, todayStr);
    if (dateValidationMessage) {
      alert(dateValidationMessage);
      return;
    }

    if (!guestFirstName || !guestLastName || !guestPhone || !guestCnic) {
      alert('Please provide the Guest\'s contact details and identification document.');
      return;
    }

    if (!isReturningGuest && !isValidPhoneValue(guestPhone)) {
      alert('Please enter a valid phone number for the selected country.');
      return;
    }

    if (guestCount < 1) {
      alert('Guest count must be at least 1.');
      return;
    }

    const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
    if (!selectedRoom) {
      alert('Selected unit could not be found.');
      return;
    }

    const selectedRoomStatus = getRoomOperationalStatus(selectedRoom, bookings, checkInDate);
    if (selectedRoomStatus !== 'ready') {
      alert(`Unit ${selectedRoomId} is currently ${getRoomStatusLabel(selectedRoomStatus).toLowerCase()} for the selected check-in date. Please choose another unit or date.`);
      return;
    }

    // Document Validation
    if (docType === 'cnic') {
      const cleanDigits = guestCnic.replace(/\D/g, '');
      if (cleanDigits.length !== 13) {
        alert(`Pakistani CNIC must contain exactly 13 digits. You entered ${cleanDigits.length} digits: [${guestCnic}]. Please enter a complete 13-digit CNIC.`);
        return;
      }
    } else {
      const cleanPassport = guestCnic.trim();
      const passportRegex = /^[A-Z0-9]{6,12}$/;
      if (!passportRegex.test(cleanPassport)) {
        alert('Passport ID must contain 6 to 12 alphanumeric characters. Please enter a valid passport number.');
        return;
      }
    }

    // Validate that there is no date overlap before saving
    const conflict = checkOverlapConflict(selectedRoomId, checkInDate, checkOutDate);
    if (conflict) {
      alert(`Conflict detected. Unit ${selectedRoomId} is already on hold or occupied during this date window. Please choose another date or unit.`);
      return;
    }

    // Pre-calculate custom unique booking ID to show immediately
    const nextBookingId = createEntityId('B');

    let finalGuestId = selectedGuestId;

    if (!isReturningGuest) {
      const match = guests.find(g => (g.cnic || '').trim() === (guestCnic || '').trim());
      if (match) {
        finalGuestId = match.id;
      } else {
        finalGuestId = onAddGuest({
          firstName: guestFirstName,
          lastName: guestLastName,
          phone: guestPhone,
          email: guestEmail || undefined,
          cnic: guestCnic,
          documentType: docType,
          documentNumber: guestCnic,
          notes: notes || 'Registered inline via reservation engine',
          createdAt: todayStr,
          identityProofs: guestIdentityProofs,
        });
      }
    }

    // Create Booking
    onAddBooking({
      id: nextBookingId,
      roomId: selectedRoomId,
      guestId: finalGuestId,
      guestFirstName,
      guestLastName,
      guestPhone,
      guestEmail: guestEmail || undefined,
      guestCnic,
      checkInDate,
      checkOutDate,
      totalPrice,
      status: 'confirmed',
      bookingSource,
      advanceReceived: totalPrice,
      paymentMethod,
      paymentStatus: 'paid',
      externalReference: externalReference || undefined,
      specialRequest: specialRequest || undefined,
      guestCount,
      checkInTime,
      checkOutTime,
      checkedInAt: undefined,
      checkedOutAt: undefined,
      notes: notes || undefined,
      documentType: docType,
      documentNumber: guestCnic,
      reviewNotes: reviewNotes || undefined,
      damageNotes: damageNotes || undefined,
      complaintNotes: complaintNotes || undefined,
      proofs: stayProofs,
    });

    // Populate Success Notification HUD
    setSuccessBookingInfo({
      id: nextBookingId,
      roomId: selectedRoomId,
      guestName: `${guestFirstName} ${guestLastName}`,
      dates: `${checkInDate} to ${checkOutDate}`,
      price: totalPrice
    });

    // Automatically transition to All-Time ledger to guarantee the user sees their booking instantly
    setTimeFilter('all');
    setStatusFilter('all');
    setSearchQuery('');

    // Reset Form fields
    setGuestFirstName('');
    setGuestLastName('');
    setGuestPhone('');
    setGuestEmail('');
    setGuestCnic('');
    setSelectedRoomId('');
    setCheckInDate('');
    setCheckOutDate('');
    setSelectedGuestId('');
    setIsReturningGuest(false);
    setNotes('');
    setBookingSource('direct');
    setPaymentMethod('cash');
    setExternalReference('');
    setSpecialRequest('');
    setGuestCount(1);
    setCheckInTime('14:00');
    setCheckOutTime('12:00');
    setReviewNotes('');
    setDamageNotes('');
    setComplaintNotes('');
    setGuestIdentityProofs([]);
    setStayProofs([]);
    setActiveTab('list');
  };

  // Check overlap of dates with 1-week window of current date
  const isWithinBookingWeek = (checkInStr: string, checkOutStr: string): boolean => {
    const today = new Date(todayStr);
    today.setHours(0, 0, 0, 0);
    
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
    const oneWeekAhead = new Date(today);
    oneWeekAhead.setDate(oneWeekAhead.getDate() + 6);
    
    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);

    return (checkIn <= oneWeekAhead && checkIn >= oneWeekAgo) || 
           (checkOut <= oneWeekAhead && checkOut >= oneWeekAgo) ||
           (checkIn <= oneWeekAgo && checkOut >= oneWeekAhead);
  };

  // Searching bookings logic to feed the compact table list
  const filteredBookings = bookings.filter(b => {
    if (requestInbox && b.status !== 'pending') {
      return false;
    }

    const isArchived = b.status === 'checked-out' || b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected';
    const isArchivedFilter = statusFilter === 'checked-out' || statusFilter === 'completed' || statusFilter === 'cancelled' || statusFilter === 'rejected';

    if (isArchived && !isArchivedFilter) return false;
    if (!isArchived && isArchivedFilter) return false;

    const fullName = `${b.guestFirstName} ${b.guestLastName}`.toLowerCase();
    const guestObj = guests.find(g => g.id === b.guestId);
    const guestSearchName = guestObj ? `${guestObj.firstName} ${guestObj.lastName}`.toLowerCase() : '';

    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || 
                           guestSearchName.includes(searchQuery.toLowerCase()) ||
                           (b.guestCnic || '').includes(searchQuery) ||
                           (b.externalReference || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           b.roomId.includes(searchQuery) ||
                           b.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesTime = timeFilter === 'all' || isWithinBookingWeek(b.checkInDate, b.checkOutDate);

    return matchesSearch && matchesStatus && matchesTime;
  });

  const selectedRoomForBooking = rooms.find((room) => room.id === selectedRoomId);
  const selectedUnitStatusForBooking = selectedRoomForBooking && checkInDate
    ? getRoomOperationalStatus(selectedRoomForBooking, bookings, checkInDate)
    : null;
  const bookingSafetyChecks = [
    {
      label: 'Housekeeping ready',
      passed: selectedRoomForBooking ? selectedRoomForBooking.housekeepingStatus === 'ready' : false,
    },
    {
      label: 'Manager ready status',
      passed: selectedUnitStatusForBooking === 'ready',
    },
    {
      label: 'No maintenance issue',
      passed: selectedRoomForBooking ? selectedRoomForBooking.status !== 'maintenance' : false,
    },
    {
      label: 'No existing hold',
      passed: selectedRoomId && checkInDate && checkOutDate ? !checkOverlapConflict(selectedRoomId, checkInDate, checkOutDate) : false,
    },
    {
      label: 'Booking amount set',
      passed: totalPrice > 0,
    },
  ];

  const todayRoomStates = rooms.map((room) => {
    const operationalStatus = getRoomOperationalStatus(room, bookings, todayStr);
    const activeStay = bookings.find((booking) => {
      if (booking.roomId !== room.id) return false;
      if (booking.status === 'cancelled' || booking.status === 'checked-out' || booking.status === 'completed' || booking.status === 'rejected' || booking.status === 'pending') return false;
      return todayStr >= booking.checkInDate && todayStr < booking.checkOutDate;
    });

    return {
      room,
      operationalStatus,
      activeStay,
    };
  });

  const todayRoomStatusCounts = todayRoomStates.reduce<Record<RoomOperationalStatus, number>>(
    (acc, entry) => {
      acc[entry.operationalStatus] += 1;
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

  // Action hook to register from visual timeline directly
  const handleTimelineCellClick = (roomId: string, dateStr: string) => {
    setSelectedRoomId(roomId);
    setCheckInDate(dateStr);

    // Calculate a default 1-night checkout date
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    setCheckOutDate(getISODateStr(d));

    // Redirect to reservation form natively
    setActiveTab('new');
    setSuccessBookingInfo(null);
  };

  // Render Room Availability Heatmap Calendar for Selected Room
  const renderInteractiveBlockoutCalendar = () => {
    if (!selectedRoomId) {
      return (
        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center text-xs text-slate-400 font-sans">
          <CalendarDays className="w-8 h-8 mx-auto text-slate-300 stroke-1 block mb-2" />
          <span>Select a room unit above to load its real-time monthly occupancy calendar blockouts.</span>
        </div>
      );
    }

    const roomObj = rooms.find(r => r.id === selectedRoomId);
    if (!roomObj) return null;

    // Use current form check-in date or fallback to operations center date
    const baseDate = checkInDate ? new Date(checkInDate) : new Date(todayStr);
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth(); // 0-indexed

    const monthNames = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];

    // First day of target month
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 is Sunday, 6 is Saturday
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    // Padding cells
    const dayCells: (number | null)[] = [];
    for (let sw = 0; sw < startDayOfWeek; sw++) {
      dayCells.push(null);
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      dayCells.push(d);
    }

    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4" id="form-blockout-heatmap">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            <strong className="text-slate-800 font-sans">Verification Hub: {monthNames[month]} {year}</strong>
          </div>
          <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold font-mono">Unit {selectedRoomId}</span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 font-mono">
          {dayCells.map((dayNum, cellIdx) => {
            if (dayNum === null) {
              return <div key={`pad-${cellIdx}`} className="h-9" />;
            }

            const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

            const activeBookingOnDate = bookings.find((booking) => {
              if (booking.roomId !== selectedRoomId) return false;
              if (
                booking.status === 'cancelled' ||
                booking.status === 'checked-out' ||
                booking.status === 'completed' ||
                booking.status === 'rejected' ||
                booking.status === 'pending'
              ) return false;
              return dayStr >= booking.checkInDate && dayStr < booking.checkOutDate;
            });
            const roomStatusOnDate = getRoomOperationalStatus(roomObj, bookings, dayStr);
            const isPastDate = dayStr < todayStr;
            const isUnavailableStatus =
              roomStatusOnDate === 'maintenance' ||
              roomStatusOnDate === 'blocked' ||
              roomStatusOnDate === 'dirty' ||
              roomStatusOnDate === 'hold' ||
              roomStatusOnDate === 'occupied';

            // Highlight form selection
            const isCheckIn = checkInDate === dayStr;
            const isCheckOut = checkOutDate === dayStr;
            const isSelectedRange = checkInDate && checkOutDate && dayStr >= checkInDate && dayStr < checkOutDate;

            let cellClass = 'h-9 flex flex-col items-center justify-center text-xs font-bold rounded-xl transition-all relative cursor-pointer ';
            let tooltipText = `Ready: Unit ${selectedRoomId} | ${dayStr}`;

            if (roomStatusOnDate === 'maintenance') {
              cellClass += 'bg-amber-50 text-amber-600 border border-amber-200 cursor-not-allowed';
              tooltipText = `Maintenance active for Unit ${selectedRoomId}`;
            } else if (roomStatusOnDate === 'blocked') {
              cellClass += 'bg-slate-100 text-slate-600 border border-slate-300 cursor-not-allowed';
              tooltipText = `Unit ${selectedRoomId} is blocked`;
            } else if (roomStatusOnDate === 'dirty') {
              cellClass += 'bg-rose-50 text-rose-600 border border-rose-200 cursor-not-allowed';
              tooltipText = `Cleaning pending for Unit ${selectedRoomId}`;
            } else if (roomStatusOnDate === 'occupied' || roomStatusOnDate === 'hold') {
              cellClass += roomStatusOnDate === 'occupied'
                ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 cursor-not-allowed'
                : 'bg-sky-50 text-sky-600 border border-sky-200 cursor-not-allowed';
              tooltipText = `${getRoomStatusLabel(roomStatusOnDate)}: ${activeBookingOnDate?.guestFirstName || 'Guest'} ${activeBookingOnDate?.guestLastName || ''}`.trim();
            } else if (isCheckIn || isCheckOut) {
              cellClass += 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10 font-black scale-105 z-10 border border-indigo-600';
            } else if (isSelectedRange) {
              cellClass += 'bg-indigo-50 text-indigo-800 border border-indigo-100 font-bold';
            } else if (isPastDate) {
              cellClass += 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed';
              tooltipText = `Past date: ${dayStr}`;
            } else {
              cellClass += 'bg-slate-50/50 hover:bg-slate-100/90 text-slate-700 border border-slate-200';
            }

            return (
              <div 
                key={`daycell-${dayNum}`}
                className={cellClass}
                title={tooltipText}
                onClick={() => {
                  if (isPastDate || isUnavailableStatus) return;
                  if (!checkInDate || (checkInDate && checkOutDate)) {
                    setCheckInDate(dayStr);
                    setCheckOutDate('');
                  } else {
                    if (dayStr > checkInDate) {
                      setCheckOutDate(dayStr);
                    } else {
                      setCheckInDate(dayStr);
                    }
                  }
                }}
              >
                <span className="text-[11px]">{dayNum}</span>
                {(roomStatusOnDate === 'occupied' || roomStatusOnDate === 'hold') && (
                  <Lock className={`w-2.5 h-2.5 absolute bottom-1 ${roomStatusOnDate === 'occupied' ? 'text-indigo-500' : 'text-sky-500'}`} />
                )}
                {roomStatusOnDate === 'maintenance' && <span className="text-[7px] text-amber-600 font-extrabold absolute bottom-0.5">MAINT</span>}
                {roomStatusOnDate === 'dirty' && <span className="text-[7px] text-rose-600 font-extrabold absolute bottom-0.5">DIRTY</span>}
                {roomStatusOnDate === 'blocked' && <span className="text-[7px] text-slate-600 font-extrabold absolute bottom-0.5">BLOCK</span>}
                {isCheckIn && !isCheckOut && <span className="text-[7.5px] text-indigo-400 absolute bottom-0.5 font-bold">START</span>}
              </div>
            );
          })}
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[10px] space-y-1 text-slate-500 font-sans">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center"><span className="w-2.5 h-2.5 bg-emerald-50 border border-emerald-200 rounded mr-1"></span> Ready</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 bg-sky-50 border border-sky-200 rounded mr-1"></span> Hold</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 bg-indigo-50 border border-indigo-200 rounded mr-1"></span> Occupied</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 bg-rose-50 border border-rose-200 rounded mr-1"></span> Dirty</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 bg-amber-50 border border-amber-200 rounded mr-1"></span> Maintenance</span>
          </div>
          <p className="pt-1 text-slate-400 border-t border-slate-200/50">
            * Quick Selection: Click first date to set check-in, click second date to lock check-out. Only ready dates can be selected.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in" id="bookings-feature-view">
      {requestInbox && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500">Website Leads</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Booking Requests Inbox</h2>
              <p className="mt-1 text-sm text-slate-600">
                New website requests appear here first. Confirm to move them into active bookings, or reject with an admin note.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-sm font-bold text-rose-700">
              {filteredBookings.length} pending
            </span>
          </div>
        </div>
      )}
      
      {/* Visual Navigation Controller */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm" id="bookings-navi-header">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-sans text-slate-800 tracking-tight">Active Stays & Check-In Desk</h2>
            <p className="text-xs text-slate-400 mt-1">Live hotel occupancy matrix, blockout planner, and verified guest registration console.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl" id="bookings-tab-toggle-block">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'list' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Live Unit Desk
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'new' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Stay Hold</span>
          </button>
          <button
            onClick={() => setActiveTab('occupancy')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'occupancy' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Examine Single Date</span>
          </button>
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6 animate-fade-in" id="bookings-listing-view">
          
          {/* Success Banner Overlay when a booking is newly registered */}
          {successBookingInfo && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm text-emerald-900 animate-slide-in flex items-start justify-between relative" id="booking-success-hud">
              <div className="flex space-x-3.5">
                <div className="p-2.5 bg-emerald-500 text-white rounded-xl mt-1 shrink-0 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-sans font-black text-sm text-emerald-950">Unit Booking Registered Successfully!</h4>
                  <p className="text-xs text-emerald-700/90 mt-1">Booking saved successfully.</p>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-3 border-t border-emerald-200/50 text-[11px] font-sans">
                    <div>
                      <span className="text-emerald-800 font-bold uppercase tracking-wider block">Receipt Code</span>
                      <strong className="text-sm font-mono text-emerald-950">{successBookingInfo.id}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-800 font-bold uppercase tracking-wider block">Assigned Unit</span>
                      <strong className="text-sm text-emerald-950">Unit {successBookingInfo.roomId}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-800 font-bold uppercase tracking-wider block">Guest</span>
                      <strong className="text-sm text-emerald-950">{successBookingInfo.guestName}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-800 font-bold uppercase tracking-wider block">Stay Schedule</span>
                      <strong className="text-sm text-emerald-950 font-mono">{successBookingInfo.dates}</strong>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSuccessBookingInfo(null)}
                className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. PRIMARY COCKPIT: LIVE ROOM BOARD (BENTO GRID STYLE)   */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="hotel-visual-planner-cockpit">
            
            {/* Header controls for the desk */}
            <div className="bg-slate-50/70 p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider block w-max">
                  Daily Status
                </span>
                <h3 className="font-bold text-slate-900 text-lg tracking-tight">Unit Board</h3>
                <p className="text-xs text-slate-400">Unit status for {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <span className="flex items-center text-slate-500 font-medium">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full mr-1.5" />
                  Ready ({todayRoomStatusCounts.ready})
                </span>
                <span className="flex items-center text-slate-500 font-medium">
                  <span className="w-2.5 h-2.5 bg-sky-500 rounded-full mr-1.5" />
                  Hold ({todayRoomStatusCounts.hold})
                </span>
                <span className="flex items-center text-slate-500 font-medium">
                  <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full mr-1.5" />
                  Occupied ({todayRoomStatusCounts.occupied})
                </span>
                <span className="flex items-center text-slate-500 font-medium">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full mr-1.5" />
                  Maintenance ({todayRoomStatusCounts.maintenance})
                </span>
              </div>
            </div>

            {/* Live Room Board Bento Grid */}
              <div className="p-6 bg-slate-50/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" id="live-room-board-grid">
                {todayRoomStates.map(({ room, activeStay, operationalStatus }) => {
                  const isStayStatus = operationalStatus === 'occupied' || operationalStatus === 'hold';
                  const badgeClass =
                    operationalStatus === 'occupied'
                      ? 'bg-indigo-50 text-indigo-700'
                      : operationalStatus === 'hold'
                      ? 'bg-sky-50 text-sky-700'
                      : operationalStatus === 'maintenance'
                      ? 'bg-amber-50 text-amber-700'
                      : operationalStatus === 'dirty'
                      ? 'bg-rose-50 text-rose-700'
                      : operationalStatus === 'blocked'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-emerald-50 text-emerald-700';
                  const cardClass =
                    operationalStatus === 'occupied'
                      ? 'border-indigo-100 bg-indigo-50/10'
                      : operationalStatus === 'hold'
                      ? 'border-sky-100 bg-sky-50/10'
                      : operationalStatus === 'maintenance'
                      ? 'border-amber-100 bg-amber-50/10'
                      : operationalStatus === 'dirty'
                      ? 'border-rose-100 bg-rose-50/10'
                      : operationalStatus === 'blocked'
                      ? 'border-slate-300 bg-slate-100/80'
                      : 'border-slate-200 hover:border-indigo-500';

                  return (
                    <div 
                      key={`room-desk-${room.id}`}
                      className={`bg-white rounded-xl border p-5 transition-all flex flex-col justify-between hover:shadow-md h-[180px] ${cardClass}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-black text-slate-800">Unit {room.id}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
                            {getRoomStatusLabel(operationalStatus)}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-700 truncate max-w-[170px]" title={room.name}>
                          {room.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                          {room.type}
                        </span>
                      </div>

                      {/* Card Content & Action based on Status */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        {isStayStatus && activeStay ? (
                           <div className="w-full flex flex-col justify-between h-full space-y-2">
                            <div className="text-[10px] text-slate-500 font-medium">
                              <span className="text-slate-400">Guest:</span> <strong className="text-slate-800 font-semibold block truncate max-w-[150px]">{activeStay.guestFirstName} {activeStay.guestLastName}</strong>
                              <span className="text-slate-400 text-[9px]">
                                {operationalStatus === 'occupied' ? 'Out Date' : 'Check-In'}: {operationalStatus === 'occupied' ? activeStay.checkOutDate : activeStay.checkInDate}
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedDetailedBooking(activeStay)}
                              className="w-full text-center text-xs font-bold bg-slate-50 hover:bg-indigo-50 text-indigo-600 py-1 px-2.5 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors cursor-pointer"
                            >
                              Inspect Stay
                            </button>
                          </div>
                        ) : operationalStatus === 'maintenance' ? (
                          <div className="w-full space-y-2">
                            <p className="text-[10px] text-amber-600 font-semibold">Unit under active maintenance.</p>
                            <span className="text-[10px] text-slate-400 block">Status: Maintenance</span>
                          </div>
                        ) : operationalStatus === 'dirty' ? (
                          <div className="w-full space-y-2">
                            <p className="text-[10px] text-rose-600 font-semibold">Cleaning is still pending for this room.</p>
                            <span className="text-[10px] text-slate-400 block">Status: Dirty</span>
                          </div>
                        ) : operationalStatus === 'blocked' ? (
                          <div className="w-full space-y-2">
                            <p className="text-[10px] text-slate-600 font-semibold">This room is manually blocked.</p>
                            <span className="text-[10px] text-slate-400 block">Status: Blocked</span>
                          </div>
                        ) : (
                          <div className="w-full flex items-center justify-between">
                            <div>
                              <span className="text-[11px] font-mono font-black text-slate-900 block">
                                Rs. {room.pricePerNight.toLocaleString()}
                              </span>
                              <span className="text-[8px] text-slate-400 font-bold uppercase block">Per Night</span>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedRoomId(room.id);
                                setCheckInDate(todayStr);
                                const d = new Date(todayStr);
                                d.setDate(d.getDate() + 1);
                                setCheckOutDate(getISODateStr(d));
                                setActiveTab('new');
                                setSuccessBookingInfo(null);
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-all cursor-pointer shadow-sm"
                            >
                              Book Now
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* General instructions to read */}
            <div className="bg-slate-50 border-t border-slate-100 p-4 font-sans text-[11px] text-slate-500 flex items-center space-x-3">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>
                Double-booking is blocked automatically.
              </span>
            </div>

          </div>

          {/* ========================================================= */}
          {/* 2. RECENT SEARCH & OPERATIONAL ROWS (Below Timeline)       */}
          {/* ========================================================= */}
          <div className="space-y-4" id="hotel-list-ledger-hub">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm" id="quick-stays-filters">
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest block select-none">Calendar Scope</span>
                <div className="inline-flex bg-slate-100 p-1 rounded-xl text-[11px]" id="timeFilterSelector">
                  <button
                    onClick={() => setTimeFilter('1week')}
                    className={`px-4 py-2 font-bold rounded-lg transition-all cursor-pointer ${
                      timeFilter === '1week'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-505 hover:text-slate-900'
                    }`}
                  >
                    Recent (1-Week Window)
                  </button>
                  <button
                    onClick={() => setTimeFilter('all')}
                    className={`px-4 py-2 font-bold rounded-lg transition-all cursor-pointer ${
                      timeFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-505 hover:text-slate-900'
                    }`}
                  >
                    All-Time Master Ledger
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5" id="bookingsStatusFiltersGroup">
                {[
                  { id: 'all', label: 'All Active' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'confirmed', label: 'Confirmed' },
                  { id: 'checked-in', label: 'Occupied' }
                ].map(statusBtn => {
                  const countOfStatus = bookings.filter(b => {
                    const isPast = b.status === 'checked-out' || b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected';
                    if (isPast) return false;
                    
                    const matchesStatus = statusBtn.id === 'all' || b.status === statusBtn.id;
                    const matchesTime = timeFilter === 'all' || isWithinBookingWeek(b.checkInDate, b.checkOutDate);
                    return matchesStatus && matchesTime;
                  }).length;

                  return (
                    <button
                      key={statusBtn.id}
                      onClick={() => setStatusFilter(statusBtn.id)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                        statusFilter === statusBtn.id
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm font-bold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <span>{statusBtn.label}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                        statusFilter === statusBtn.id ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-550'
                      }`}>
                        {countOfStatus}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200" id="bookings-search-bar">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search ledger by guest name, national CNIC, passport sequence, unit number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg outline-none transition-colors focus:bg-white"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 p-2 rounded-lg outline-none cursor-pointer text-slate-600 focus:border-indigo-500 font-semibold"
                >
                  <option value="all">All Booking States</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Occupied</option>
                  <option value="completed">Completed</option>
                  <option value="checked-out">Checked Out</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* MAPPED LISTING ROWS (Sleek Professional Rows block instead of cards) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {filteredBookings.length === 0 ? (
                <div className="p-16 text-center text-slate-400">
                  <Calendar className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
                  <p className="mt-4 text-sm font-bold text-slate-700">No bookings match this filter right now.</p>
                  <p className="text-xs text-slate-400 mt-1">Try changing the status filter or clearing the search.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200 text-[10.5px] font-black text-slate-450 uppercase tracking-widest">
                        <th className="py-3 px-4">Guest Name</th>
                        <th className="py-3 px-4">Phone</th>
                        <th className="py-3 px-4">Room / Unit</th>
                        <th className="py-3 px-4">Check-in / Check-out</th>
                        <th className="py-3 px-4">Guests / Total</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs text-slate-755 font-medium">
                      {filteredBookings.map((booking) => {
                        const roomObj = rooms.find(r => r.id === booking.roomId);
                        const isCheckedIn = booking.status === 'checked-in';
                        const bookingStatusLabel = getBookingStatusLabel(booking.status);
                        
                        return (
                          <tr key={booking.id} className="hover:bg-slate-50/50 transition-all font-sans">
                            <td className="py-3 px-4">
                              <div className="font-extrabold text-slate-800 tracking-tight text-xs">
                                {booking.guestFirstName} {booking.guestLastName}
                              </div>
                              <div className="mt-1 text-[10px] text-slate-450 font-mono">
                                #{booking.id}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-mono text-[11px] font-bold text-slate-700">
                                {canViewContact ? booking.guestPhone : maskPhoneValue(booking.guestPhone)}
                              </div>
                              {booking.guestEmail && <div className="mt-1 text-[10px] text-slate-500">{booking.guestEmail}</div>}
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-1.5">
                                <span className="bg-indigo-50 font-mono text-indigo-700 font-extrabold px-2.5 py-0.5 rounded text-[10.5px]">
                                  Unit {booking.roomId}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold uppercase">({roomObj?.type})</span>
                              </div>
                            </td>

                            <td className="py-3 px-4 font-mono font-bold text-slate-600 text-[11px]">
                              <div>
                                {booking.checkInDate} <span className="text-slate-400 font-normal font-sans">to</span> {booking.checkOutDate}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="text-[10px] text-slate-500">{booking.guestCount} guest{booking.guestCount > 1 ? 's' : ''}</div>
                              <div className="font-mono text-xs font-extrabold text-slate-900">
                                Rs. {booking.totalPrice.toLocaleString()}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                booking.status === 'pending'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : booking.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : isCheckedIn 
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                  : booking.status === 'confirmed'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {bookingStatusLabel}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button 
                                  onClick={() => setSelectedDetailedBooking(booking)}
                                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold py-1.5 px-3 rounded-lg cursor-pointer transition-colors"
                                >
                                  View Details
                                </button>

                                {booking.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => onUpdateBookingStatus(booking.id, 'confirmed')}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer shadow-sm"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => handleRejectBooking(booking)}
                                      className="bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-bold py-1.5 px-3 rounded-lg cursor-pointer transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}

                                {booking.status === 'confirmed' && (
                                  <>
                                    <button
                                      onClick={() => onUpdateBookingStatus(booking.id, 'checked-in')}
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg transition-all flex items-center space-x-1 cursor-pointer shadow-sm"
                                    >
                                      Check-In
                                    </button>
                                    {canCancelBookingRecords && (
                                      <button
                                        onClick={() => handleCancelBooking(booking)}
                                        className="bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 text-[11px] font-bold py-1.5 px-2.5 rounded-lg cursor-pointer transition-colors"
                                        title="Cancel Booking"
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </>
                                )}

                                {booking.status === 'checked-in' && (
                                  <button
                                      onClick={() => onUpdateBookingStatus(booking.id, 'completed')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-1.5 px-3.5 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>Check-Out</span>
                                  </button>
                                )}
                              </div>
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
        </div>
      )}

      {activeTab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="new-unified-booking-flow">
          
          {/* Reservation core input fields */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:col-span-7" id="guest-reservation-details-card">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-500" />
                <span>New Stay Bookings</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Please provide guest details and select dates to submit a reservation.</p>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-6">
              
              {/* Returning Guest Helper Checkbox */}
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/40 flex items-center justify-between" id="returning-guest-helper">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-indigo-900 block font-sans">Is this a returning customer?</span>
                  <span className="text-[11px] text-indigo-700">Autofill credentials if guest profile is registered in library.</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="returningCheckbox"
                    checked={isReturningGuest}
                    onChange={(e) => setIsReturningGuest(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="returningCheckbox" className="text-xs font-bold text-slate-600 cursor-pointer select-none">Yes, autofill</label>
                </div>
              </div>

              {/* Select Returning Guest Directory Row */}
              {isReturningGuest && (
                <div className="space-y-1.5 animate-fade-in" id="returning-guest-select">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-widest block font-sans">Choose From Guest Directory</label>
                  <select
                    value={selectedGuestId}
                    onChange={(e) => setSelectedGuestId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-xs font-bold focus:border-indigo-500 cursor-pointer text-slate-700"
                  >
                    <option value="">-- Choose profile to populate --</option>
                    {guests.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.firstName} {g.lastName} ({g.documentType === 'passport' ? 'Passport' : 'CNIC'}: {canViewIdentity ? g.cnic : maskIdentityValue(g.cnic)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Inline Guest Details Section */}
              <div className="space-y-4 pt-1 text-xs" id="inline-guest-inputs">
                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1 flex items-center space-x-1">
                  <span>Guest Bio-Data Credentials</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">First Name <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ibrahim"
                      value={guestFirstName}
                      disabled={isReturningGuest}
                      onChange={(e) => setGuestFirstName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 disabled:opacity-75 focus:bg-white text-xs font-semibold text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Last Name <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Khan"
                      value={guestLastName}
                      disabled={isReturningGuest}
                      onChange={(e) => setGuestLastName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 disabled:opacity-75 focus:bg-white text-xs font-semibold text-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Phone Number *</label>
                    <PhoneInput
                      required
                      value={guestPhone}
                      disabled={isReturningGuest}
                      onChange={setGuestPhone}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Email Address (Optional)</label>
                    <input
                      type="email"
                      placeholder="e.g. guest@hotmail.com"
                      value={guestEmail}
                      disabled={isReturningGuest}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 disabled:opacity-75 focus:bg-white text-xs font-semibold text-slate-700"
                    />
                  </div>
                          <div className="space-y-3" id="docTypeSelection">
                  <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">Identity Verification Document *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isReturningGuest}
                      onClick={() => handleDocTypeChange('cnic')}
                      className={`py-2 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer ${
                        docType === 'cnic'
                          ? 'bg-indigo-55/40 border-indigo-200 text-indigo-700 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 disabled:opacity-50'
                      }`}
                    >
                      Pakistani CNIC (13 Digits)
                    </button>
                    <button
                      type="button"
                      disabled={isReturningGuest}
                      onClick={() => handleDocTypeChange('passport')}
                      className={`py-2 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer ${
                        docType === 'passport'
                          ? 'bg-indigo-55/40 border-indigo-200 text-indigo-700 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 disabled:opacity-50'
                      }`}
                    >
                      International Passport
                    </button>
                  </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">
                      {docType === 'cnic' ? 'National CNIC Number *' : 'Passport Identification Code *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={docType === 'cnic' ? 'e.g. 35201-1234567-1' : 'e.g. AB1234567'}
                      value={guestCnic}
                      disabled={isReturningGuest}
                      onChange={(e) => handleDocNumberChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-mono text-xs font-bold outline-none focus:border-indigo-500 disabled:opacity-75 focus:bg-white text-slate-700"
                    />
                    <p className="text-[10px] text-slate-400 font-sans">
                      {docType === 'cnic' 
                        ? 'Standard formatted CNIC; verified 13 digits separated by hyphens.' 
                        : 'Biographical uppercase passport key sequence.'}
                    </p>
                  </div>
                </div>

                <div className="pt-1">
                  <ProofUploadField
                    label="Guest CNIC / Passport Proof"
                    category="guest-identity-proof"
                    value={guestIdentityProofs}
                    onChange={setGuestIdentityProofs}
                    disabled={isReturningGuest}
                    helperText={
                      isReturningGuest
                        ? `Using saved guest proof files (${guestIdentityProofs.length}).`
                        : 'Attach guest CNIC/passport image or scan before check-in.'
                    }
                  />
                </div>
              </div>

              {/* Room Allocation and Reservation Schedule */}
              <div className="space-y-4 pt-4 border-t border-slate-100" id="occupancy-date-inputs">
                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1">
                  Allocation & Stay Calendar
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Check-In Date *</label>
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold font-mono outline-none focus:border-indigo-500 text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Check-Out Date *</label>
                    <input
                      type="date"
                      required
                      min={checkInDate || todayStr}
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold font-mono outline-none focus:border-indigo-500 text-slate-700"
                    />
                  </div>
                </div>

                {/* Room Selector with conflict checking */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Select Target Unit *</label>
                  <select
                    required
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer text-slate-700"
                  >
                    <option value="">-- Click to select unit --</option>
                    {rooms.map(room => {
                      const isOccupiedConflict = checkOverlapConflict(room.id, checkInDate, checkOutDate);
                      const roomStatusForSelection = getRoomOperationalStatus(room, bookings, checkInDate || todayStr);
                      const isRoomUnavailable = roomStatusForSelection !== 'ready';
                      return (
                        <option 
                          key={room.id}
                          value={room.id}
                          disabled={isOccupiedConflict || isRoomUnavailable}
                          className={isOccupiedConflict ? 'text-rose-500 italic bg-red-50' : ''}
                        >
                          Unit {room.id} - {room.name} ({room.type}) | Rs. {room.pricePerNight.toLocaleString()}/night {
                            isOccupiedConflict
                              ? '[ HOLD FOR SELECTED DATES ]'
                              : isRoomUnavailable
                              ? `[ ${getRoomStatusLabel(roomStatusForSelection).toUpperCase()} ]`
                              : '[ READY ]'
                          }
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Bill Preview Area */}
              {selectedRoomId && checkInDate && checkOutDate && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between" id="pkr-billing-summary">
                  <div className="flex items-center space-x-3">
                    <span className="p-2.5 bg-emerald-100 text-emerald-800 rounded-lg">
                      <Tag className="w-5 h-5" />
                    </span>
                    <div>
                      <h5 className="font-extrabold text-xs text-slate-800 uppercase tracking-widest">PKR Rent Calculations</h5>
                      <p className="text-[11px] text-slate-500 font-sans">Verified safe stay fare projection in PKR.</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-mono font-black text-emerald-800 block leading-none">
                      Rs. {totalPrice.toLocaleString()}
                    </span>
                    <p className="text-[9.5px] text-slate-500 mt-1 font-semibold">Including tax</p>
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-slate-100" id="booking-commercial-details">
                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1">
                  Booking & Payment Details
                </h4>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Booking Source</label>
                    <select
                      value={bookingSource}
                      onChange={(e) => {
                        const nextSource = e.target.value as BookingSource;
                        setBookingSource(nextSource);
                        if ((nextSource === 'airbnb' || nextSource === 'booking.com') && paymentMethod !== 'ota') {
                          setPaymentMethod('ota');
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 text-slate-700"
                    >
                      <option value="airbnb">Airbnb</option>
                      <option value="booking.com">Booking.com</option>
                      <option value="direct">Direct</option>
                      <option value="walk-in">Walk-in</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">External Booking Reference</label>
                    <input
                      type="text"
                      value={externalReference}
                      onChange={(e) => setExternalReference(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 text-slate-700"
                      placeholder="OTA or internal ref"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Guest Count</label>
                    <input
                      type="number"
                      min="1"
                      value={guestCount}
                      onChange={(e) => setGuestCount(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Check-In Time</label>
                    <input
                      type="time"
                      value={checkInTime}
                      onChange={(e) => setCheckInTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Check-Out Time</label>
                    <input
                      type="time"
                      value={checkOutTime}
                      onChange={(e) => setCheckOutTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 text-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 text-slate-700"
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="easypaisa">Easypaisa</option>
                      <option value="jazzcash">JazzCash</option>
                      <option value="card">Card</option>
                      <option value="ota">OTA</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Payment</label>
                    <div className="w-full rounded-xl border border-slate-200 bg-slate-100 p-3 text-xs font-bold text-slate-700">
                      Paid in full
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Special Request</label>
                  <textarea
                    placeholder="Extra towels, late arrival, baby cot, quiet room..."
                    value={specialRequest}
                    onChange={(e) => setSpecialRequest(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs outline-none h-20 focus:border-indigo-500 text-slate-700"
                  />
                </div>

                <ProofUploadField
                  label="Stay Proof Uploads"
                  category="booking-proof"
                  value={stayProofs}
                  onChange={setStayProofs}
                  helperText="Attach security deposit acknowledgement, room handover photos, damage photos, or other stay proof."
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Review Notes</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="h-20 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-indigo-500 text-slate-700"
                      placeholder="Guest review or feedback"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Damage Notes</label>
                    <textarea
                      value={damageNotes}
                      onChange={(e) => setDamageNotes(e.target.value)}
                      className="h-20 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-indigo-500 text-slate-700"
                      placeholder="Damage or deposit note"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Complaint Notes</label>
                    <textarea
                      value={complaintNotes}
                      onChange={(e) => setComplaintNotes(e.target.value)}
                      className="h-20 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-indigo-500 text-slate-700"
                      placeholder="Complaint or service issue"
                    />
                  </div>
                </div>
              </div>

              {/* Special notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Special Receptionist Notes (Optional)</label>
                <textarea
                  placeholder="E.g. Wants extra linen, corporate approval, likes evening chamomile tea..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs outline-none h-20 focus:border-indigo-500 text-slate-700"
                />
              </div>

              {/* Submit Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer"
                >
                  Cancel & Return
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-2.5 px-6 rounded-xl flex items-center space-x-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Register Stay Hold</span>
                </button>
              </div>

            </form>
          </div>

          {/* RIGHT SIDEBAR PANEL: Availability Heatmap Blockouts */}
          <div className="lg:col-span-5 space-y-6" id="reservation-heatmap-panel">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span>Unit Availability Calendar</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                View ready, hold, and occupied days on the calendar grid before creating a booking.
              </p>
            </div>

            {selectedRoomForBooking && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Booking Safety Check</h4>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Same-day bookings only confirm when the unit is ready and payment has been collected.
                  </p>
                </div>
                <div className="space-y-2">
                  {bookingSafetyChecks.map((check) => (
                    <div key={check.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-medium text-slate-600">{check.label}</span>
                      <span className={`font-bold ${check.passed ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {check.passed ? 'OK' : 'Check Required'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {renderInteractiveBlockoutCalendar()}
          </div>

        </div>
      )}

      {activeTab === 'occupancy' && (
        /* ROOM BOOKING STATUS GRID / CALENDAR OF OCCUPANCY */
        <div className="space-y-6" id="occupancy-matrix-module">
          
          {/* Calendar Picker bar */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
            <div>
              <h3 className="font-bold text-slate-800 text-base uppercase tracking-tight">Daily Occupancy Inspector</h3>
              <p className="text-xs text-slate-400">Select any date to view unit status across all units.</p>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-600">Select Date:</label>
              <input
                type="date"
                value={occupancyDate}
                onChange={(e) => setOccupancyDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Graphical visual schedule showing room slots */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="font-black text-slate-700 uppercase tracking-widest font-mono">Live Matrix: {occupancyDate}</span>
              <div className="flex flex-wrap items-center gap-3 text-[10.5px] font-bold text-slate-500">
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 bg-emerald-50 border border-emerald-200 rounded"></span>
                  <span>Ready</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 bg-sky-500 rounded"></span>
                  <span>Hold</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 bg-indigo-600 rounded"></span>
                  <span>Occupied</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 bg-rose-500 rounded"></span>
                  <span>Dirty</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 bg-amber-500 rounded"></span>
                  <span>Maintenance</span>
                </span>
              </div>
            </div>

            {/* Grid listings of statuses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="rooms-occupancy-checkpoints">
              {rooms.map(room => {
                const activeBookingOnDate = bookings.find(b => {
                  if (b.roomId !== room.id) return false;
                  if (
                    b.status === 'cancelled' ||
                    b.status === 'checked-out' ||
                    b.status === 'completed' ||
                    b.status === 'rejected' ||
                    b.status === 'pending'
                  ) return false;
                  return occupancyDate >= b.checkInDate && occupancyDate < b.checkOutDate;
                });
                const displayStatus = getRoomOperationalStatus(room, bookings, occupancyDate);
                const cardClass =
                  displayStatus === 'occupied'
                    ? 'bg-indigo-50/40 border-indigo-100 text-indigo-900 shadow-sm'
                    : displayStatus === 'hold'
                    ? 'bg-sky-50/40 border-sky-100 text-sky-900 shadow-sm'
                    : displayStatus === 'maintenance'
                    ? 'bg-amber-50/40 border-amber-100 text-amber-900'
                    : displayStatus === 'dirty'
                    ? 'bg-rose-50/40 border-rose-100 text-rose-900'
                    : displayStatus === 'blocked'
                    ? 'bg-slate-100 border-slate-300 text-slate-700'
                    : 'bg-slate-50/30 border-slate-200 text-slate-700';
                const dotClass =
                  displayStatus === 'occupied'
                    ? 'bg-indigo-600'
                    : displayStatus === 'hold'
                    ? 'bg-sky-500'
                    : displayStatus === 'maintenance'
                    ? 'bg-amber-500'
                    : displayStatus === 'dirty'
                    ? 'bg-rose-500'
                    : displayStatus === 'blocked'
                    ? 'bg-slate-500'
                    : 'bg-emerald-500';

                return (
                  <div key={room.id} className={`p-4 rounded-xl border transition-all ${cardClass}`}>
                    
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-black bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200">
                          Unit {room.id}
                        </span>
                        <h5 className="font-extrabold text-sm mt-2">{room.name}</h5>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase">{room.type}</p>
                      </div>

                      <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col space-y-1.5 text-xs font-sans">
                      {(displayStatus === 'occupied' || displayStatus === 'hold') && activeBookingOnDate ? (
                        <>
                          <div className={`font-extrabold truncate ${displayStatus === 'occupied' ? 'text-indigo-700' : 'text-sky-700'}`}>
                            Occupant: {activeBookingOnDate.guestFirstName} {activeBookingOnDate.guestLastName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            Status: {getBookingStatusLabel(activeBookingOnDate.status)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            Period: {activeBookingOnDate.checkInDate} to {activeBookingOnDate.checkOutDate}
                          </div>
                        </>
                      ) : displayStatus === 'maintenance' ? (
                        <span className="italic text-amber-600 font-bold">Maintenance in progress</span>
                      ) : displayStatus === 'dirty' ? (
                        <span className="italic text-rose-600 font-bold">Cleaning pending</span>
                      ) : displayStatus === 'blocked' ? (
                        <span className="italic text-slate-600 font-bold">Manually blocked</span>
                      ) : (
                        <span className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded self-start border border-emerald-100 uppercase tracking-wider text-[9px]">
                          ready room
                        </span>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-500 leading-relaxed font-sans flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <p>
                Use the date picker to confirm that a unit is ready before creating a booking.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. VERIFIED PROPERTY STAYS INSPECTOR OVERLAY MODAL          */}
      {/* ========================================================= */}
      {selectedDetailedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm animate-fade-in" id="timeline-inspector-dialog">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.16)] animate-slide-in" id="timeline-detail-card">
            <button
              onClick={() => setSelectedDetailedBooking(null)}
              className="absolute right-5 top-5 z-20 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-7">
              <div ref={receiptCardRef} className="w-[350px] p-5 bg-white border border-gray-200 font-sans" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 5 }}>ZavariHaus</div>
                  <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Reservation Receipt</div>
                </div>
                <div style={{ borderTop: '1px solid #ddd', margin: '12px 0' }}></div>
                <div style={{ marginBottom: 12 }}>
                  {renderReceiptRow('Reservation ID:', selectedDetailedBooking.id, true)}
                  {renderReceiptRow('Status:', getBookingStatusLabel(selectedDetailedBooking.status))}
                  {renderReceiptRow('Guest:', `${selectedDetailedBooking.guestFirstName} ${selectedDetailedBooking.guestLastName}`)}
                  {renderReceiptRow('Phone:', canViewContact ? selectedDetailedBooking.guestPhone : maskPhoneValue(selectedDetailedBooking.guestPhone), true)}
                  {renderReceiptRow('Document:', `${selectedDetailedBooking.documentType === 'passport' ? 'Passport' : 'CNIC'}: ${canViewIdentity ? selectedDetailedBooking.guestCnic : maskIdentityValue(selectedDetailedBooking.guestCnic)}`)}
                  {renderReceiptRow('Email:', canViewContact ? selectedDetailedBooking.guestEmail || '-' : 'Restricted')}
                  {renderReceiptRow('Unit:', `Unit ${selectedDetailedBooking.roomId}`)}
                  {renderReceiptRow('Check-in:', selectedDetailedBooking.checkInDate, true)}
                  {renderReceiptRow('Check-out:', selectedDetailedBooking.checkOutDate, true)}
                  {renderReceiptRow('Nights:', String(Math.max(1, Math.ceil((new Date(selectedDetailedBooking.checkOutDate).getTime() - new Date(selectedDetailedBooking.checkInDate).getTime()) / (1000 * 3600 * 24)))), true)}
                </div>
                <div style={{ borderTop: '1px solid #ddd', margin: '12px 0' }}></div>
                <div style={{ marginBottom: 12 }}>
                  {renderReceiptRow('Unit Charges:', `Rs. ${selectedDetailedBooking.totalPrice.toLocaleString()}`, true)}
                  {renderReceiptRow('Collected:', `Rs. ${(selectedDetailedBooking.paymentStatus === 'paid' ? selectedDetailedBooking.totalPrice : Math.min(Math.max(0, selectedDetailedBooking.advanceReceived || 0), selectedDetailedBooking.totalPrice)).toLocaleString()}`, true)}
                  {renderReceiptRow('Balance Due:', `Rs. ${Math.max(0, selectedDetailedBooking.totalPrice - (selectedDetailedBooking.paymentStatus === 'paid' ? selectedDetailedBooking.totalPrice : Math.min(Math.max(0, selectedDetailedBooking.advanceReceived || 0), selectedDetailedBooking.totalPrice))).toLocaleString()}`, true)}
                  {renderReceiptRow('Payment Method:', getPaymentMethodLabel(selectedDetailedBooking.paymentMethod))}
                  {renderReceiptRow('Payment Status:', selectedDetailedBooking.paymentStatus === 'paid' ? 'Paid in full' : selectedDetailedBooking.paymentStatus === 'partial' ? 'Partially paid' : selectedDetailedBooking.paymentStatus === 'refunded' ? 'Refunded' : 'Unpaid')}
                </div>
                <div style={{ borderTop: '1px solid #ddd', margin: '12px 0', paddingTop: 12, textAlign: 'center', fontSize: 11, color: '#666' }}>
                  <div>Issued on {new Date().toLocaleDateString('en-GB')}</div>
                  <div style={{ marginTop: 4 }}>Thank you for choosing ZavariHaus!</div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleCopyReceiptImage}
                      disabled={receiptAction !== null}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Copy className="h-4 w-4" />
                      <span>{receiptAction === 'copy' ? 'Copying...' : 'Copy Image'}</span>
                    </button>
                    <button
                      onClick={handleDownloadReceiptImage}
                      disabled={receiptAction !== null}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      <span>{receiptAction === 'download' ? 'Preparing...' : 'Download JPG'}</span>
                    </button>
                  </div>
                  {receiptMessage && <p className="text-xs text-slate-500">{receiptMessage}</p>}
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    onClick={() => setSelectedDetailedBooking(null)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                  {selectedDetailedBooking.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          onUpdateBookingStatus(selectedDetailedBooking.id, 'confirmed');
                          setSelectedDetailedBooking(null);
                        }}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleRejectBooking(selectedDetailedBooking)}
                        className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {selectedDetailedBooking.status === 'confirmed' && (
                    <>
                      <button
                        onClick={() => {
                          onUpdateBookingStatus(selectedDetailedBooking.id, 'checked-in');
                          setSelectedDetailedBooking(null);
                        }}
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        Check-In
                      </button>
                      {canCancelBookingRecords && (
                        <button
                          onClick={() => {
                            handleCancelBooking(selectedDetailedBooking);
                          }}
                          className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          Cancel Booking
                        </button>
                      )}
                    </>
                  )}

                  {selectedDetailedBooking.status === 'checked-in' && (
                    <button
                      onClick={() => {
                        onUpdateBookingStatus(selectedDetailedBooking.id, 'completed');
                        setSelectedDetailedBooking(null);
                      }}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Check-Out</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedDetailedBooking(null)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
