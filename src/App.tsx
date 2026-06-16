import React, { useState, useEffect, useRef } from 'react';
import {
  Building2, 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Wrench, 
  BadgeDollarSign, 
  Menu,
  X,
  History,
  Calendar,
  LogOut,
  CloudLightning,
  ChevronDown,
  Bell,
  Globe,
  MessageCircle,
} from 'lucide-react';
import { Room, Guest, Booking, Expense, InvestorContribution, HotelState, BookingStatus, ExpenseStatus, HousekeepingStatus, MaintenanceIssue, CurrentUser, ExtraRevenueEntry, UserRole, ProofAttachment } from './types';
import { INITIAL_STATE } from './data';
import DashboardView from './components/DashboardView';
import BookingsView from './components/BookingsView';
import GuestsView from './components/GuestsView';
import ExpensesView from './components/ExpensesView';
import InvestorView from './components/InvestorView';
import RoomsView from './components/RoomsView';
import HistoryView from './components/HistoryView';
import SchedulerCalendarView from './components/SchedulerCalendarView';
import LoginView from './components/LoginView';
import WebsiteInquiriesView from './components/WebsiteInquiriesView';
import WebsiteBookingsView from './components/WebsiteBookingsView';
import { createEntityId, normalizeHotelState } from './lib/hotelState';
import { AppView } from './lib/appViews';
import { createAuditLogEntry } from './lib/audit';
import {
  canAccessView,
  canAddInvestors,
  canAdvanceHousekeeping,
  canCreateBookings,
  canEditProfitLossInputs,
  canEditUnits,
  canManageGuestProfiles,
  canManageExpenses,
  canManageMaintenanceIssues,
  canSetManagerReady,
  canVerifyHousekeeping,
  getDefaultViewForRole,
  getRoleLabel,
} from './lib/access';

const STORAGE_KEY = 'hotel_manager_state';
const USER_ROLE_STORAGE_KEY = 'vha_auth_role';
const USER_EMAIL_STORAGE_KEY = 'vha_auth_email';

type NavItem = {
  view: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
};

type NavSection = {
  key: string;
  label: string;
  items: NavItem[];
};

export default function App() {
  // Authentication & Server Configuration States
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('vha_auth_token'));
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => localStorage.getItem('vha_is_demo') === 'true');
  const [currentUser, setCurrentUser] = useState<CurrentUser>(() => ({
    email: localStorage.getItem(USER_EMAIL_STORAGE_KEY) || 'owner@zavarihaus.com',
    role: (localStorage.getItem(USER_ROLE_STORAGE_KEY) as UserRole) || 'owner-admin',
  }));
  const [loadingState, setLoadingState] = useState(true);
  const [, setDbConnected] = useState(false);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [allowServerSync, setAllowServerSync] = useState(false);

  const [state, setState] = useState<HotelState>(() => normalizeHotelState(INITIAL_STATE));
  const stateRef = useRef<HotelState>(normalizeHotelState(INITIAL_STATE));

  const [activeView, setActiveView] = useState<AppView>(() => getDefaultViewForRole(((localStorage.getItem(USER_ROLE_STORAGE_KEY) as UserRole) || 'owner-admin')));
  const [prefilledBooking, setPrefilledBooking] = useState<{ roomId: string; checkInDate: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    main: true,
    operations: false,
    finance: false,
    website: false,
  });

  const parseApiError = async (res: Response) => {
    try {
      const data = await res.json();
      return data?.message || data?.error || 'Request failed.';
    } catch {
      try {
        return await res.text();
      } catch {
        return 'Request failed.';
      }
    }
  };

  const persistStateSnapshot = async (nextState: HotelState) => {
    if (!sessionToken || isDemoMode || !allowServerSync) {
      return;
    }

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(nextState)
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (!res.ok) {
        const message = await parseApiError(res);
        setDbConnected(false);
        setSyncErrorMessage(message);
        throw new Error(message);
      }

      setDbConnected(true);
      setSyncErrorMessage(null);
    } catch (error) {
      setDbConnected(false);
      console.error('Immediate state save failed:', error);
    }
  };

  const persistEntitySnapshot = async (endpoint: string, payload: unknown) => {
    if (!sessionToken || isDemoMode || !allowServerSync) {
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (!res.ok) {
        const message = await parseApiError(res);
        setSyncErrorMessage(message);
        throw new Error(message);
      }

      setSyncErrorMessage(null);
    } catch (error) {
      console.error(`Immediate entity save failed for ${endpoint}:`, error);
    }
  };

  const commitState = (
    updater: (prev: HotelState) => HotelState,
    options?: { persist?: boolean }
  ) => {
    const currentState = stateRef.current;
    const nextState = normalizeHotelState(updater(currentState));
    if (nextState === currentState) {
      return currentState;
    }

    stateRef.current = nextState;
    setState(nextState);

    if (options?.persist !== false) {
      void persistStateSnapshot(nextState);
    }

    return nextState;
  };

  const appendAuditEntry = (prev: HotelState, entry: ReturnType<typeof createAuditLogEntry>): HotelState => ({
    ...prev,
    auditLogs: [entry, ...(prev.auditLogs || [])].slice(0, 250),
  });

  // Method: Logout handler
  const handleLogout = () => {
    if (sessionToken && !isDemoMode) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      }).catch(err => console.error("Revocation failure on logout:", err));
    }
    setSessionToken(null);
    setIsDemoMode(false);
    setCurrentUser({ email: 'owner@zavarihaus.com', role: 'owner-admin' });
    localStorage.removeItem('vha_auth_token');
    localStorage.removeItem('vha_is_demo');
    localStorage.removeItem(USER_ROLE_STORAGE_KEY);
    localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
  };

  // 1. STATE HYDRATION EFFECT: Fetch initial state from database
  useEffect(() => {
    if (!sessionToken) {
      setLoadingState(false);
      setAllowServerSync(false);
      return;
    }

    setLoadingState(true);
    setAllowServerSync(false);
    fetch('/api/state', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    })
    .then(async res => {
      if (res.status === 401) {
        handleLogout();
        throw new Error("Session expired. Revoked token detected.");
      }

      if (!res.ok) {
        const message = await parseApiError(res);
        setSyncErrorMessage(message);
        throw new Error(message);
      }

      return res.json();
    })
    .then(data => {
      if (data) {
        setSyncErrorMessage(null);
        setDbConnected(data.isSupabaseConnected || false);
        setAllowServerSync(true);
        if (data.currentUser) {
          setCurrentUser(data.currentUser);
          localStorage.setItem(USER_ROLE_STORAGE_KEY, data.currentUser.role);
          localStorage.setItem(USER_EMAIL_STORAGE_KEY, data.currentUser.email);
        }
        const hydratedState = normalizeHotelState({
          rooms: data.rooms || INITIAL_STATE.rooms,
          guests: data.guests || [],
          bookings: data.bookings || [],
          expenses: data.expenses || [],
          investors: data.investors || [],
          maintenanceIssues: data.maintenanceIssues || [],
          extraRevenueEntries: data.extraRevenueEntries || [],
          auditLogs: data.auditLogs || [],
        });
        // Hydrate React state with secure real database rows
        stateRef.current = hydratedState;
        setState(hydratedState);
      }
    })
    .catch(err => {
      console.error("Database master fetch failure:", err);
      setDbConnected(false);
      setAllowServerSync(false);
      // Fallback to local storage if network issues or local demo mode
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const fallbackState = normalizeHotelState(JSON.parse(saved));
          stateRef.current = fallbackState;
          setState(fallbackState);
        } catch (e) {
          const fallbackState = normalizeHotelState(INITIAL_STATE);
          stateRef.current = fallbackState;
          setState(fallbackState);
        }
      }
    })
    .finally(() => setLoadingState(false));
  }, [sessionToken]);

  // Keep the latest resolved state mirrored for durable local fallback.
  useEffect(() => {
    stateRef.current = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem(USER_ROLE_STORAGE_KEY, currentUser.role);
    localStorage.setItem(USER_EMAIL_STORAGE_KEY, currentUser.email);
    if (!canAccessView(currentUser.role, activeView)) {
      setActiveView(getDefaultViewForRole(currentUser.role));
    }
  }, [activeView, currentUser]);

  // 2. BACKGROUND DEBOUNCED DATABASE SYNC EFFECT
  useEffect(() => {
    if (!sessionToken) return;

    if (isDemoMode || !allowServerSync) return; // Skip posting until successful server hydration

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(state),
        signal: controller.signal
      })
      .then(async res => {
        if (res.status === 401) {
          handleLogout();
          return;
        }

        if (!res.ok) {
          const message = await parseApiError(res);
          setDbConnected(false);
          setSyncErrorMessage(message);
          throw new Error(message || 'State sync failed.');
        }

        setDbConnected(true);
        setSyncErrorMessage(null);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setDbConnected(false);
          console.error("State background sync failure:", err);
        }
      });
    }, 1500); // Debounce delay 1.5 seconds

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [state, sessionToken, isDemoMode, allowServerSync]);

  // Method: Automatic check-out sweep based on checkout date
  const triggerAutoCheckout = () => {
    commitState((prev) => prev);
  };

  // Re-normalize once initial loading finishes so stale bookings cannot survive a fresh session.
  useEffect(() => {
    if (!loadingState && sessionToken) {
      triggerAutoCheckout();
    }
  }, [loadingState, sessionToken]);

  // Method: Add a Room listing
  const handleAddRoom = (newRoom: Room) => {
    if (!canEditUnits(currentUser.role)) {
      alert('Your role cannot create units.');
      return;
    }

    commitState(prev => {
      const nextState = {
        ...prev,
        rooms: [...prev.rooms, newRoom]
      };
      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'create',
          entityType: 'unit',
          entityId: newRoom.id,
          entityLabel: `Unit ${newRoom.id}`,
          after: newRoom as unknown as Record<string, unknown>,
        })
      );
    });

    void persistEntitySnapshot('/api/rooms', newRoom);
  };

  const handleUpdateRoom = (updatedRoom: Room) => {
    if (!canEditUnits(currentUser.role)) {
      alert('Your role cannot edit units.');
      return;
    }

    commitState(prev => {
      const previousRoom = prev.rooms.find((room) => room.id === updatedRoom.id);
      const nextState = {
        ...prev,
        rooms: prev.rooms.map(room => room.id === updatedRoom.id ? updatedRoom : room)
      };
      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'update',
          entityType: 'unit',
          entityId: updatedRoom.id,
          entityLabel: `Unit ${updatedRoom.id}`,
          before: (previousRoom || null) as unknown as Record<string, unknown> | null,
          after: updatedRoom as unknown as Record<string, unknown>,
        })
      );
    });

    void persistEntitySnapshot('/api/rooms', updatedRoom);
  };

  const handleDeleteRoom = async (roomId: string) => {
    const hasLinkedBookings = state.bookings.some(booking => booking.roomId === roomId);
    const hasLinkedExpenses = state.expenses.some(expense => expense.roomId === roomId);
    const hasLinkedIssues = state.maintenanceIssues.some(issue => issue.roomId === roomId);

    if (hasLinkedBookings || hasLinkedExpenses || hasLinkedIssues) {
      alert('This unit cannot be deleted because it already has linked bookings, expenses, or maintenance issues.');
      return false;
    }

    const confirmed = window.confirm(`Delete unit ${roomId}?`);
    if (!confirmed) {
      return false;
    }

    if (!isDemoMode && sessionToken) {
      try {
        const response = await fetch(`/api/rooms/${roomId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });

        if (!response.ok) {
          const message = await parseApiError(response);
          throw new Error(message || 'Unit delete request failed.');
        }
      } catch (error) {
        console.error('Room deletion failed:', error);
        alert(error instanceof Error ? error.message : 'Unit delete failed. Please try again.');
        return false;
      }
    }

    commitState(prev => {
      const previousRoom = prev.rooms.find((room) => room.id === roomId);
      const nextState = {
        ...prev,
        rooms: prev.rooms.filter(room => room.id !== roomId)
      };
      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'delete',
          entityType: 'unit',
          entityId: roomId,
          entityLabel: previousRoom?.name ? `Unit ${roomId} - ${previousRoom.name}` : `Unit ${roomId}`,
          before: (previousRoom || { id: roomId }) as Record<string, unknown>,
          after: null,
        })
      );
    });

    return true;
  };

  // Method: Add a booking
  const handleAddBooking = (newBookingData: Omit<Booking, 'id'> & { id?: string }) => {
    if (!canCreateBookings(currentUser.role)) {
      alert('Your role cannot create bookings.');
      return;
    }

    const newId = newBookingData.id || createEntityId('B');
    const newBooking: Booking = {
      id: newId,
      roomId: newBookingData.roomId,
      guestId: newBookingData.guestId,
      guestFirstName: newBookingData.guestFirstName,
      guestLastName: newBookingData.guestLastName,
      guestPhone: newBookingData.guestPhone,
      guestEmail: newBookingData.guestEmail,
      guestCnic: newBookingData.guestCnic,
      checkInDate: newBookingData.checkInDate,
      checkOutDate: newBookingData.checkOutDate,
      totalPrice: newBookingData.totalPrice,
      status: newBookingData.status,
      bookingSource: newBookingData.bookingSource,
      advanceReceived: newBookingData.totalPrice,
      paymentMethod: newBookingData.paymentMethod,
      paymentStatus: newBookingData.paymentStatus === 'refunded' ? 'refunded' : 'paid',
      externalReference: newBookingData.externalReference,
      specialRequest: newBookingData.specialRequest,
      guestCount: newBookingData.guestCount,
      checkInTime: newBookingData.checkInTime,
      checkOutTime: newBookingData.checkOutTime,
      checkedInAt: newBookingData.checkedInAt,
      checkedOutAt: newBookingData.checkedOutAt,
      notes: newBookingData.notes,
      documentType: newBookingData.documentType,
      documentNumber: newBookingData.documentNumber,
      reviewNotes: newBookingData.reviewNotes,
      damageNotes: newBookingData.damageNotes,
      complaintNotes: newBookingData.complaintNotes,
      proofs: newBookingData.proofs || [],
    };

    commitState(prev => {
      const nextState = {
        ...prev,
        bookings: [newBooking, ...prev.bookings]
      };
      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'create',
          entityType: 'booking',
          entityId: newBooking.id,
          entityLabel: `${newBooking.guestFirstName} ${newBooking.guestLastName}`,
          after: newBooking as unknown as Record<string, unknown>,
        })
      );
    });

    void persistEntitySnapshot('/api/bookings', newBooking);
  };

  // Method: Check In, Check Out or Cancel
  const handleUpdateBookingStatus = (bookingId: string, status: BookingStatus, adminNote?: string) => {
    if (!canCreateBookings(currentUser.role)) {
      alert('Your role cannot update bookings.');
      return;
    }

    const statusChangedAt = new Date().toISOString();
    const nextState = commitState(prev => {
      const targetBooking = prev.bookings.find((booking) => booking.id === bookingId);

      const nextState = {
        ...prev,
        bookings: prev.bookings.map(b => 
          b.id === bookingId
            ? {
                ...b,
                status,
                checkedInAt: status === 'checked-in' ? statusChangedAt : b.checkedInAt,
                checkedOutAt: status === 'checked-out' || status === 'completed' ? statusChangedAt : b.checkedOutAt,
                adminNote: adminNote ?? b.adminNote,
              }
            : b
        ),
        rooms: prev.rooms.map((room) => {
          if (!targetBooking || room.id !== targetBooking.roomId) {
            return room;
          }

          if ((status === 'checked-out' || status === 'completed') && room.status !== 'maintenance' && room.status !== 'blocked') {
            return { ...room, status: 'active' as const, housekeepingStatus: 'dirty' as const };
          }

          return room;
        })
      };

      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'status-change',
          entityType: 'booking',
          entityId: bookingId,
          entityLabel: targetBooking ? `${targetBooking.guestFirstName} ${targetBooking.guestLastName}` : bookingId,
          before: targetBooking ? { status: targetBooking.status } : null,
          after: { status },
        })
      );
    });

    const updatedBooking = nextState.bookings.find((booking) => booking.id === bookingId);
    if (updatedBooking) {
      void persistEntitySnapshot('/api/bookings', updatedBooking);
    }
  };

  // Method: Register Guest
  const handleAddGuest = (newGuestData: Omit<Guest, 'id'>): string => {
    if (!canManageGuestProfiles(currentUser.role)) {
      alert('Your role cannot add guest profiles.');
      return '';
    }

    const newId = createEntityId('G');
    const newGuest: Guest = {
      ...newGuestData,
      id: newId
    };

    commitState(prev => {
      const nextState = {
        ...prev,
        guests: [newGuest, ...prev.guests]
      };
      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'create',
          entityType: 'guest',
          entityId: newGuest.id,
          entityLabel: `${newGuest.firstName} ${newGuest.lastName}`,
          after: {
            firstName: newGuest.firstName,
            lastName: newGuest.lastName,
            phone: newGuest.phone,
            documentType: newGuest.documentType,
          },
        })
      );
    });

    void persistEntitySnapshot('/api/guests', newGuest);

    return newId;
  };

  // Method: Log Expense
  const handleAddExpense = (newExpenseData: Omit<Expense, 'id'>) => {
    if (!canManageExpenses(currentUser.role)) {
      alert('Your role cannot record expenses.');
      return;
    }

    const newId = createEntityId('E');
    const newExpense: Expense = {
      ...newExpenseData,
      id: newId
    };

    commitState(prev => {
      const nextState = {
        ...prev,
        expenses: [newExpense, ...prev.expenses]
      };
      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'create',
          entityType: 'expense',
          entityId: newExpense.id,
          entityLabel: newExpense.title,
          after: {
            title: newExpense.title,
            amount: newExpense.amount,
            category: newExpense.category,
            status: newExpense.status,
          },
        })
      );
    });

    void persistEntitySnapshot('/api/expenses', newExpense);
  };

  // Method: Match or resolve invoice payment
  const handleUpdateExpenseStatus = (
    expenseId: string,
    status: ExpenseStatus,
    investorFundId?: string,
    paymentProofs: ProofAttachment[] = []
  ) => {
    if (!canManageExpenses(currentUser.role)) {
      alert('Your role cannot update expenses.');
      return;
    }

    let updatedExpenseSnapshot: Expense | undefined;
    commitState(prev => {
      const previousExpense = prev.expenses.find((expense) => expense.id === expenseId);
      const updatedExpenses = prev.expenses.map(exp => {
        if (exp.id !== expenseId) {
          return exp;
        }

        const existingProofs = Array.isArray(exp.proofs) ? exp.proofs : [];
        updatedExpenseSnapshot = {
          ...exp,
          status,
          paidFromInvestorFundId: investorFundId,
          proofs: [...existingProofs, ...paymentProofs],
        };
        return updatedExpenseSnapshot;
      });
      const nextState = {
        ...prev,
        expenses: updatedExpenses
      };
      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'status-change',
          entityType: 'expense',
          entityId: expenseId,
          entityLabel: previousExpense?.title || expenseId,
          before: previousExpense ? { status: previousExpense.status, paidFromInvestorFundId: previousExpense.paidFromInvestorFundId } : null,
          after: { status, paidFromInvestorFundId: investorFundId || '-', paymentProofs: paymentProofs.length },
        })
      );
    });

    if (updatedExpenseSnapshot) {
      void persistEntitySnapshot('/api/expenses', updatedExpenseSnapshot);
    }
  };

  const handleUpdateRoomHousekeeping = (roomId: string, housekeepingStatus: HousekeepingStatus) => {
    if (!canAdvanceHousekeeping(currentUser.role)) {
      alert('Your role cannot change housekeeping status.');
      return;
    }

    if (housekeepingStatus === 'inspected' && !canVerifyHousekeeping(currentUser.role)) {
      alert('Manager verification is required before marking a unit as inspected.');
      return;
    }

    if (housekeepingStatus === 'ready' && !canSetManagerReady(currentUser.role)) {
      alert('Only manager or owner can mark a unit as ready.');
      return;
    }

    commitState(prev => ({
      ...appendAuditEntry(
        {
          ...prev,
          rooms: prev.rooms.map(room =>
            room.id === roomId
              ? {
                  ...room,
                  housekeepingStatus,
                  status: room.status === 'blocked' || room.status === 'maintenance' ? room.status : 'active',
                }
              : room
          )
        },
        createAuditLogEntry({
          actor: currentUser,
          action: 'status-change',
          entityType: 'unit',
          entityId: roomId,
          entityLabel: `Unit ${roomId}`,
          before: { housekeepingStatus: prev.rooms.find((room) => room.id === roomId)?.housekeepingStatus || '-' },
          after: { housekeepingStatus },
        })
      ),
    }));
  };

  const handleAddMaintenanceIssue = (issueData: Omit<MaintenanceIssue, 'id'>) => {
    if (!canManageMaintenanceIssues(currentUser.role)) {
      alert('Your role cannot create maintenance issues.');
      return;
    }

    const newIssue: MaintenanceIssue = {
      ...issueData,
      id: createEntityId('MI'),
    };

    commitState(prev => {
      const nextState = {
        ...prev,
        maintenanceIssues: [newIssue, ...prev.maintenanceIssues],
        rooms: prev.rooms.map(room =>
          room.id === issueData.roomId && room.status !== 'blocked'
            ? { ...room, status: 'maintenance' as const }
            : room
        )
      };
      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'create',
          entityType: 'maintenance-issue',
          entityId: newIssue.id,
          entityLabel: newIssue.title,
          after: {
            title: newIssue.title,
            roomId: newIssue.roomId,
            priority: newIssue.priority,
            status: newIssue.status,
            assignedTo: newIssue.assignedTo || '-',
          },
        })
      );
    });
  };

  const handleUpdateMaintenanceIssue = (issueId: string, updates: Partial<MaintenanceIssue>) => {
    if (!canManageMaintenanceIssues(currentUser.role)) {
      alert('Your role cannot update maintenance issues.');
      return;
    }

    commitState(prev => {
      const previousIssue = prev.maintenanceIssues.find((issue) => issue.id === issueId);
      const nextState = {
        ...prev,
        maintenanceIssues: prev.maintenanceIssues.map(issue =>
          issue.id === issueId ? { ...issue, ...updates } : issue
        )
      };
      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'update',
          entityType: 'maintenance-issue',
          entityId: issueId,
          entityLabel: previousIssue?.title || issueId,
          before: (previousIssue || null) as unknown as Record<string, unknown> | null,
          after: { ...(previousIssue || {}), ...updates } as Record<string, unknown>,
        })
      );
    });
  };

  // Method: Log Investor Cash Injection
  const handleAddInvestor = (newInvestorData: Omit<InvestorContribution, 'id'>) => {
    if (!canAddInvestors(currentUser.role)) {
      alert('Your role cannot add investor capital.');
      return;
    }

    const newId = createEntityId('INV');
    const newInvestor: InvestorContribution = {
      ...newInvestorData,
      equityPercentage: newInvestorData.equityPercentage ?? 0,
      id: newId
    };

    commitState(prev => {
      const nextState = {
        ...prev,
        investors: [newInvestor, ...prev.investors]
      };
      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'create',
          entityType: 'investor',
          entityId: newInvestor.id,
          entityLabel: newInvestor.investorName,
          after: {
            investorName: newInvestor.investorName,
            amount: newInvestor.amount,
            equityPercentage: newInvestor.equityPercentage || 0,
          },
        })
      );
    });
  };

  const handleAddExtraRevenue = (newEntryData: Omit<ExtraRevenueEntry, 'id'>) => {
    if (!canEditProfitLossInputs(currentUser.role)) {
      alert('Your role cannot add extra revenue entries.');
      return;
    }

    const newEntry: ExtraRevenueEntry = {
      ...newEntryData,
      id: createEntityId('REV'),
    };

    commitState(prev => {
      const nextState = {
        ...prev,
        extraRevenueEntries: [newEntry, ...(prev.extraRevenueEntries || [])],
      };
      return appendAuditEntry(
        nextState,
        createAuditLogEntry({
          actor: currentUser,
          action: 'create',
          entityType: 'extra-revenue',
          entityId: newEntry.id,
          entityLabel: newEntry.title,
          after: {
            title: newEntry.title,
            amount: newEntry.amount,
            date: newEntry.date,
          },
        })
      );
    });
  };

  const pendingBookingRequestsCount = state.bookings.filter((booking) => booking.status === 'pending').length;

  const navigationSections: NavSection[] = [
    {
      key: 'main',
      label: 'Main',
      items: [{ view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      key: 'operations',
      label: 'Hotel Operations',
      items: [
        { view: 'booking-requests', label: 'Booking Requests', icon: Bell, badgeCount: pendingBookingRequestsCount },
        { view: 'rooms', label: 'Rooms / Units', icon: Building2 },
        { view: 'bookings', label: 'Bookings', icon: CalendarDays },
        { view: 'guests', label: 'Guests', icon: Users },
        { view: 'calendar', label: 'Housekeeping', icon: Calendar },
        { view: 'history', label: 'Stay History', icon: History },
      ],
    },
    {
      key: 'finance',
      label: 'Finance & Maintenance',
      items: [
        { view: 'expenses', label: 'Expenses & Maintenance', icon: Wrench },
        { view: 'investors', label: 'Finance / Investors', icon: BadgeDollarSign },
      ],
    },
    {
      key: 'website',
      label: 'Website Management',
      items: [
        { view: 'website-bookings', label: 'Website Bookings', icon: Globe, badgeCount: state.bookings.filter((b) => b.status === 'pending' && (b.guestCnic === 'PUBLIC-REQUEST' || (b.notes || '').includes('Public website'))).length },
        { view: 'website-inquiries', label: 'Contact Inquiries', icon: MessageCircle },
      ],
    },
  ];

  const availableSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessView(currentUser.role, item.view)),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    const sectionKey =
      activeView === 'dashboard'
        ? 'main'
        : ['booking-requests', 'rooms', 'bookings', 'guests', 'calendar', 'history'].includes(activeView)
          ? 'operations'
          : ['website-inquiries', 'website-bookings'].includes(activeView)
            ? 'website'
            : 'finance';

    setOpenSections((prev) => (prev[sectionKey] ? prev : { ...prev, [sectionKey]: true }));
  }, [activeView]);

  const flatAvailableViews = availableSections.flatMap((section) => section.items);
  const currentViewLabel = flatAvailableViews.find((item) => item.view === activeView)?.label
    || (activeView === 'investors' ? 'Finance / Investors' : activeView === 'expenses' ? 'Expenses & Maintenance' : 'Dashboard');

  // Auth gate check
  if (!sessionToken) {
    return (
      <LoginView 
        onLoginSuccess={(token, demo, user) => {
          setSessionToken(token);
          setIsDemoMode(demo);
          setCurrentUser(user);
          setActiveView(getDefaultViewForRole(user.role));
          localStorage.setItem('vha_auth_token', token);
          localStorage.setItem('vha_is_demo', String(demo));
          localStorage.setItem(USER_ROLE_STORAGE_KEY, user.role);
          localStorage.setItem(USER_EMAIL_STORAGE_KEY, user.email);
        }} 
      />
    );
  }

  // Session loader check
  if (loadingState) {
    return (
      <div className="min-h-screen bg-[#f6f7fb] flex flex-col items-center justify-center space-y-5" id="Zavarihaus-booting-loader">
        <div className="p-4 bg-white border border-slate-200 text-slate-700 rounded-3xl shadow-sm">
          <CloudLightning className="w-8 h-8 shrink-0" />
        </div>
        <div className="text-center space-y-1.5">
          <h3 className="font-['Georgia'] text-xl italic tracking-tight text-slate-900">ZavariHaus</h3>
          <p className="text-[10.5px] text-slate-500 uppercase tracking-[0.28em]">Loading stay records</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f6f7fb] flex" id="applet-viewport-root">
      
      {/* Sidebar Navigation */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 bg-white text-slate-700 flex flex-col justify-between transform transition-all duration-200 border-r border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:translate-x-0 lg:static lg:h-full ${
          sidebarCollapsed ? 'w-16' : 'w-72 lg:w-60'
        } ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        id="applet-sidebar"
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand header */}
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <div className={sidebarCollapsed ? 'hidden' : ''}>
              <h1 className="font-['Georgia'] text-[1.45rem] italic tracking-tight text-slate-900 leading-none">ZavariHaus</h1>
              <p className="mt-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-[0.28em]">Hotel Management</p>
            </div>
            <button
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="w-4 h-4" />
            </button>
            {/* Close btn for mobile view */}
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items list */}
          <nav className="flex-1 px-2 py-2.5 space-y-2.5">
            {availableSections.map((section) => (
              <div key={section.key} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setOpenSections((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                  title={section.label}
                >
                  {!sidebarCollapsed && <span>{section.label}</span>}
                  {!sidebarCollapsed && <ChevronDown className={`w-4 h-4 transition-transform ${openSections[section.key] ? 'rotate-180' : ''}`} />}
                  {sidebarCollapsed && <ChevronDown className={`w-4 h-4 transition-transform ${openSections[section.key] ? 'rotate-180' : ''}`} />}
                </button>
                {openSections[section.key] && (
                  <div className="space-y-1.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.view;
                      return (
                        <button
                          key={item.view}
                          onClick={() => { setActiveView(item.view); setSidebarOpen(false); }}
                          aria-current={isActive ? 'page' : undefined}
                          title={item.label}
                          className={`group relative w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${
                            isActive
                              ? 'bg-slate-900 text-white border-slate-900 shadow-[0_10px_25px_rgba(15,23,42,0.14)]'
                              : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-900 hover:border-slate-200'
                          }`}
                        >
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                            isActive ? 'bg-white/10' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-900'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          {!sidebarCollapsed && <span className="min-w-0 flex-1 text-left truncate">{item.label}</span>}
                          {Boolean(item.badgeCount) && (
                            <span className={`${sidebarCollapsed ? 'absolute right-1 top-1' : ''} rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white`}>
                              {item.badgeCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer with Logout Button */}
        <div className="p-3 border-t border-slate-200 bg-white">
          {/* Logout trigger */}
          <button
            onClick={handleLogout}
            className="w-full bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-2 border border-slate-200 hover:border-rose-200 text-xs uppercase tracking-wider"
            id="sidebar-logout-button"
          >
            <LogOut className="w-4 h-4 text-slate-500 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>

        </div>
      </aside>

      {/* Main Container Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden" id="applet-main-canvas-wrapper">
        
        {/* Top Header Controls bar */}
        <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200 h-14 flex items-center justify-between px-4 shrink-0 z-30 shadow-[0_8px_24px_rgba(15,23,42,0.04)] animate-fade-in" id="main-canvas-header">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded bg-slate-100 lg:hidden text-slate-600 hover:bg-slate-200 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wide">
              {currentViewLabel}
            </h2>
            {pendingBookingRequestsCount > 0 && (
              <button
                onClick={() => setActiveView('booking-requests')}
                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                {pendingBookingRequestsCount} pending request{pendingBookingRequestsCount > 1 ? 's' : ''}
              </button>
            )}
          </div>

          <div className="hidden items-center space-x-2 text-xs font-sans sm:flex">
            <span className="font-semibold text-slate-600">{getRoleLabel(currentUser.role)}</span>
            <span className="text-slate-400">{currentUser.email}</span>
          </div>
        </header>

        {/* Scrollable Canvas area */}
        <main className="flex-1 overflow-y-auto p-3 md:p-4 xl:p-5 max-w-[1180px] mx-auto w-full" id="main-scroll-canvas">
          {syncErrorMessage && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {syncErrorMessage}
            </div>
          )}

          {activeView === 'dashboard' && (
            <DashboardView 
              state={state} 
              setView={(v) => setActiveView(v as any)}
              currentUserRole={currentUser.role}
            />
          )}

          {activeView === 'rooms' && (
            <RoomsView 
              state={state}
              currentUserRole={currentUser.role}
              onAddRoom={handleAddRoom}
              onUpdateRoom={handleUpdateRoom}
              onUpdateRoomHousekeeping={handleUpdateRoomHousekeeping}
              onDeleteRoom={handleDeleteRoom}
            />
          )}

          {activeView === 'booking-requests' && (
            <BookingsView 
              state={state}
              currentUserRole={currentUser.role}
              onAddBooking={handleAddBooking}
              onUpdateBookingStatus={handleUpdateBookingStatus}
              onAddGuest={handleAddGuest}
              onTriggerAutoCheckout={triggerAutoCheckout}
              prefilledBooking={prefilledBooking}
              onClearPrefilledBooking={() => setPrefilledBooking(null)}
              requestInbox
            />
          )}

          {activeView === 'bookings' && (
            <BookingsView 
              state={state}
              currentUserRole={currentUser.role}
              onAddBooking={handleAddBooking}
              onUpdateBookingStatus={handleUpdateBookingStatus}
              onAddGuest={handleAddGuest}
              onTriggerAutoCheckout={triggerAutoCheckout}
              prefilledBooking={prefilledBooking}
              onClearPrefilledBooking={() => setPrefilledBooking(null)}
            />
          )}

          {activeView === 'guests' && (
            <GuestsView 
              state={state}
              currentUserRole={currentUser.role}
              onAddGuest={handleAddGuest}
            />
          )}

          {activeView === 'expenses' && (
            <ExpensesView 
              state={state}
              currentUser={currentUser}
              onAddExpense={handleAddExpense}
              onUpdateExpenseStatus={handleUpdateExpenseStatus}
              onAddMaintenanceIssue={handleAddMaintenanceIssue}
              onUpdateMaintenanceIssue={handleUpdateMaintenanceIssue}
            />
          )}

          {activeView === 'investors' && (
            <InvestorView 
              state={state}
              currentUserRole={currentUser.role}
              onAddInvestor={handleAddInvestor}
              onAddExtraRevenue={handleAddExtraRevenue}
            />
          )}

          {activeView === 'history' && (
            <HistoryView 
              state={state}
              currentUserRole={currentUser.role}
              onUpdateBookingStatus={handleUpdateBookingStatus}
            />
          )}

          {activeView === 'calendar' && (
            <SchedulerCalendarView 
              state={state}
              currentUserRole={currentUser.role}
              setView={(v) => setActiveView(v as any)}
              onSetPrefilledBooking={(bk) => setPrefilledBooking(bk)}
            />
          )}

          {activeView === 'website-inquiries' && (
            <WebsiteInquiriesView
              sessionToken={sessionToken}
            />
          )}

          {activeView === 'website-bookings' && (
            <WebsiteBookingsView
              state={state}
              sessionToken={sessionToken}
              onUpdateBookingStatus={handleUpdateBookingStatus}
            />
          )}
        </main>

      </div>

    </div>
  );
}
