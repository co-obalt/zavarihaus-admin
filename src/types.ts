export type RoomType = 'Skyview Suite' | 'Sunset Room' | 'Family Haven';
export type RoomStatus = 'active' | 'maintenance' | 'blocked';
export type HousekeepingStatus = 'dirty' | 'cleaning-started' | 'cleaned' | 'inspected' | 'ready';
export type RoomOperationalStatus = 'ready' | 'occupied' | 'hold' | 'dirty' | 'maintenance' | 'blocked';
export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed' | 'checked-in' | 'checked-out';
export type BookingSource = 'airbnb' | 'booking.com' | 'direct' | 'walk-in' | 'whatsapp';
export type PaymentMethod = 'cash' | 'bank' | 'easypaisa' | 'jazzcash' | 'card' | 'ota';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
export type ExpenseCategory =
  | 'maintenance'
  | 'rent'
  | 'salaries'
  | 'electricity'
  | 'gas'
  | 'internet'
  | 'laundry'
  | 'cleaning-supplies'
  | 'ota-commission'
  | 'traveling'
  | 'marketing'
  | 'refunds'
  | 'guest-supplies'
  | 'room-supplies'
  | 'improvements'
  | 'utilities'
  | 'staff'
  | 'miscellaneous'
  | 'other';
export type ExpenseStatus = 'pending' | 'paid';
export type MaintenanceIssuePriority = 'low' | 'medium' | 'urgent';
export type MaintenanceIssueStatus = 'reported' | 'assigned' | 'in-progress' | 'fixed' | 'verified' | 'closed';
export type UserRole = 'owner-admin' | 'manager' | 'receptionist' | 'housekeeping' | 'maintenance' | 'investor';
export type GuestProfileStatus = 'standard' | 'vip' | 'blacklist';
export type AuditAction = 'create' | 'update' | 'delete' | 'status-change' | 'sync';
export type AuditEntityType = 'unit' | 'booking' | 'guest' | 'expense' | 'investor' | 'maintenance-issue' | 'extra-revenue' | 'system';
export type RevenueLineCategory = 'airbnb' | 'booking.com' | 'direct' | 'cash' | 'extra-charges';

export interface ProofAttachment {
  id: string;
  category: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  uploadedAt: string;
}

export interface CurrentUser {
  email: string;
  role: UserRole;
}

export interface Room {
  id: string; // e.g. "101", "302"
  name: string;
  type: RoomType;
  pricePerNight: number;
  status: RoomStatus;
  housekeepingStatus: HousekeepingStatus;
  amenities: string[];
  floor: number;
  coverImageUrl?: string;
  galleryImageUrls?: string[];
  publicDescription?: string;
  publicLocation?: string;
  publicModalLocation?: string;
  publicGuestsLabel?: string;
  publicSizeLabel?: string;
  publicBedLabel?: string;
  publicBathLabel?: string;
  publicBalconyLabel?: string;
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  cnic: string;
  notes?: string;
  createdAt: string;
  documentType?: 'cnic' | 'passport';
  documentNumber?: string;
  preferences?: string;
  profileStatus?: GuestProfileStatus;
  identityProofs?: ProofAttachment[];
}

export interface Booking {
  id: string;
  roomId: string;
  guestId: string;
  guestFirstName: string;
  guestLastName: string;
  guestPhone: string;
  guestEmail?: string;
  guestCnic: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  status: BookingStatus;
  bookingSource: BookingSource;
  advanceReceived: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  externalReference?: string;
  specialRequest?: string;
  guestCount: number;
  adminNote?: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  notes?: string;
  documentType?: 'cnic' | 'passport';
  documentNumber?: string;
  reviewNotes?: string;
  damageNotes?: string;
  complaintNotes?: string;
  proofs?: ProofAttachment[];
}

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  roomId?: string; // Empty if it is general property expense
  status: ExpenseStatus;
  description?: string;
  customCategoryLabel?: string;
  paidFromInvestorFundId?: string; // Map specific expenses to specific investors or the general pool
  maintenanceIssueId?: string;
  vendorName?: string;
  receiptReference?: string;
  proofs?: ProofAttachment[];
}

export interface InvestorContribution {
  id: string;
  investorName: string;
  amount: number;
  date: string;
  equityPercentage?: number; // Optional terms
  notes?: string;
  proofs?: ProofAttachment[];
}

export interface MaintenanceIssue {
  id: string;
  title: string;
  roomId: string;
  priority: MaintenanceIssuePriority;
  status: MaintenanceIssueStatus;
  reportedDate: string;
  assignedTo?: string;
  notes?: string;
  beforePhotos?: ProofAttachment[];
  afterPhotos?: ProofAttachment[];
}

export interface ExtraRevenueEntry {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: RevenueLineCategory;
  notes?: string;
  linkedBookingId?: string;
  proofs?: ProofAttachment[];
}

export interface AuditLogChange {
  field: string;
  previousValue: string;
  newValue: string;
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  actorEmail: string;
  actorRole: UserRole;
  createdAt: string;
  changes: AuditLogChange[];
}

export interface HotelState {
  rooms: Room[];
  guests: Guest[];
  bookings: Booking[];
  expenses: Expense[];
  investors: InvestorContribution[];
  maintenanceIssues: MaintenanceIssue[];
  extraRevenueEntries: ExtraRevenueEntry[];
  auditLogs: AuditLogEntry[];
}
