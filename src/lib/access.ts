import { AppView } from './appViews';
import { CurrentUser, MaintenanceIssue, UserRole } from '../types';

export const ROLE_LABELS: Record<UserRole, string> = {
  'owner-admin': 'Owner/Admin',
  manager: 'Manager',
  receptionist: 'Receptionist',
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance Staff',
  investor: 'Investor',
};

export const ROLE_VIEW_ACCESS: Record<UserRole, AppView[]> = {
  'owner-admin': ['dashboard', 'booking-requests', 'rooms', 'bookings', 'guests', 'expenses', 'investors', 'history', 'calendar', 'website-inquiries', 'website-bookings'],
  manager: ['dashboard', 'booking-requests', 'rooms', 'bookings', 'guests', 'expenses', 'history', 'calendar', 'website-inquiries', 'website-bookings'],
  receptionist: ['dashboard', 'booking-requests', 'bookings', 'guests', 'rooms', 'history', 'calendar'],
  housekeeping: ['rooms'],
  maintenance: ['expenses'],
  investor: ['investors'],
};

export const getRoleLabel = (role: UserRole): string => ROLE_LABELS[role];

export const getAllowedViewsForRole = (role: UserRole): AppView[] => ROLE_VIEW_ACCESS[role];

export const getDefaultViewForRole = (role: UserRole): AppView => ROLE_VIEW_ACCESS[role][0] || 'dashboard';

export const canAccessView = (role: UserRole, view: AppView): boolean => ROLE_VIEW_ACCESS[role].includes(view);

export const canViewSensitiveGuestIdentity = (role: UserRole): boolean => role === 'owner-admin' || role === 'manager';

export const canViewGuestContact = (role: UserRole): boolean =>
  role === 'owner-admin' || role === 'manager' || role === 'receptionist';

export const canViewGuestHistory = (role: UserRole): boolean =>
  role === 'owner-admin' || role === 'manager' || role === 'receptionist';

export const canEditUnits = (role: UserRole): boolean => role === 'owner-admin';

export const canAdvanceHousekeeping = (role: UserRole): boolean =>
  role === 'owner-admin' || role === 'manager' || role === 'housekeeping';

export const canVerifyHousekeeping = (role: UserRole): boolean => role === 'owner-admin' || role === 'manager';

export const canSetManagerReady = (role: UserRole): boolean => role === 'owner-admin' || role === 'manager';

export const canCreateBookings = (role: UserRole): boolean =>
  role === 'owner-admin' || role === 'manager' || role === 'receptionist';

export const canManageGuestProfiles = (role: UserRole): boolean =>
  role === 'owner-admin' || role === 'manager' || role === 'receptionist';

export const canManageExpenses = (role: UserRole): boolean => role === 'owner-admin';

export const canManageMaintenanceIssues = (role: UserRole): boolean =>
  role === 'owner-admin' || role === 'manager' || role === 'maintenance';

export const canAddInvestors = (role: UserRole): boolean => role === 'owner-admin';

export const canEditProfitLossInputs = (role: UserRole): boolean => role === 'owner-admin';

export const canViewAuditLog = (role: UserRole): boolean => role === 'owner-admin';

export const canCancelBookings = (role: UserRole): boolean => role === 'owner-admin';

export const isFinanceReadOnlyRole = (role: UserRole): boolean => role === 'investor';

export const normalizeUserRole = (value: unknown): UserRole => {
  const allowedRoles: UserRole[] = ['owner-admin', 'manager', 'receptionist', 'housekeeping', 'maintenance', 'investor'];
  return allowedRoles.includes(value as UserRole) ? (value as UserRole) : 'owner-admin';
};

export const maskIdentityValue = (value: string): string => {
  if (!value) {
    return '-';
  }

  const stripped = value.replace(/\s+/g, '');
  if (stripped.length <= 4) {
    return stripped;
  }

  return `${'*'.repeat(Math.max(0, stripped.length - 4))}${stripped.slice(-4)}`;
};

export const maskPhoneValue = (value: string): string => {
  if (!value) {
    return '-';
  }

  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) {
    return value;
  }

  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

export const canViewIssueForUser = (role: UserRole, currentUser: CurrentUser, issue: MaintenanceIssue): boolean => {
  if (role !== 'maintenance') {
    return true;
  }

  const assignedTo = (issue.assignedTo || '').trim().toLowerCase();
  if (!assignedTo) {
    return false;
  }

  const email = currentUser.email.toLowerCase();
  const localPart = email.split('@')[0];
  return assignedTo === email || assignedTo === localPart || assignedTo.includes(localPart);
};
