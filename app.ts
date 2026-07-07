import express from "express";
import { createHmac, timingSafeEqual } from "crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load local environment variables if available
dotenv.config();

const app = express();

app.use(express.json({ limit: "25mb" }));

const PUBLIC_SITE_ORIGIN = process.env.PUBLIC_SITE_ORIGIN || "https://zavarihaus.vercel.app";
const PUBLIC_API_ALLOWED_ORIGINS = new Set([
  PUBLIC_SITE_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use("/api/public", (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || PUBLIC_API_ALLOWED_ORIGINS.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin || PUBLIC_SITE_ORIGIN);
  }
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// In-memory simple login rate limiter to block Brute Force attacks
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const BRUTE_FORCE_LIMIT = 5; // max 5 attempts per window
const TIME_WINDOW_MS = 60 * 1000; // 1 minute
const COOL_DOWN_MS = 2000; // 2 seconds delay feedback spacing

// In-memory local proof storage for demo and local-only fallback modes
const localProofs = new Map<string, { id: string; name: string; mimeType: string; size: number; dataUrl: string }>();

const applyLoginRateLimit = (ip: string): { allowed: boolean; waitTime: number } => {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  
  if (!record) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true, waitTime: 0 };
  }
  
  // if time window has passed, reset
  if (now - record.lastAttempt > TIME_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true, waitTime: 0 };
  }
  
  // check count
  if (record.count >= BRUTE_FORCE_LIMIT) {
    const timeLeft = Math.ceil((TIME_WINDOW_MS - (now - record.lastAttempt)) / 1000);
    return { allowed: false, waitTime: timeLeft };
  }
  
  // spacing check
  if (now - record.lastAttempt < COOL_DOWN_MS) {
    return { allowed: false, waitTime: 2 }; // force 2s delay
  }

  record.count += 1;
  record.lastAttempt = now;
  return { allowed: true, waitTime: 0 };
};

const JWT_SECRET = process.env.JWT_SECRET || `Zavarihaus_secret_ref_${Math.random().toString(36).substring(2)}`;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const ALLOWED_USER_ROLES = ["owner-admin", "manager", "receptionist", "housekeeping", "maintenance", "investor"];

const normalizeUserRole = (value: unknown) =>
  ALLOWED_USER_ROLES.includes(String(value)) ? String(value) : "owner-admin";

const canServerManageUnits = (role: string) => role === "owner-admin";
const canServerManageBookings = (role: string) =>
  role === "owner-admin" || role === "manager" || role === "receptionist";
const canServerManageGuests = (role: string) =>
  role === "owner-admin" || role === "manager" || role === "receptionist";
const canServerManageMaintenanceIssues = (role: string) =>
  role === "owner-admin" || role === "manager" || role === "maintenance";
const canServerManageExpenses = (role: string) => role === "owner-admin";
const canServerManageInvestors = (role: string) => role === "owner-admin";
const canServerSyncRoomStatus = (role: string) =>
  role === "owner-admin" || role === "manager" || role === "receptionist" || role === "housekeeping";

const signSessionToken = (payload: { sub: string; email: string; role: string }) => {
  const encodedPayload = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Date.now() + SESSION_TTL_MS
    })
  ).toString("base64url");

  const signature = createHmac("sha256", JWT_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
};

const verifySessionToken = (token: string): { sub: string; email: string; role: string; exp: number } | null => {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", JWT_SECRET).update(encodedPayload).digest();
  const receivedSignature = Buffer.from(signature, "base64url");

  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload?.sub || !payload?.email || !payload?.exp || payload.exp < Date.now()) {
      return null;
    }
    return {
      ...payload,
      role: normalizeUserRole(payload.role),
    };
  } catch {
    return null;
  }
};

// Initialize Supabase Client
const rawSupabaseUrl = process.env.SUPABASE_URL || "";
const rawSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const rawSupabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

const sanitizeSupabaseUrl = (url: string): string => {
  let cleaned = url.trim();
  while (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  if (cleaned.toLowerCase().endsWith("/rest/v1")) {
    cleaned = cleaned.slice(0, -8);
  }
  while (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
};

const looksLikeSupabaseUrl = (value: string): boolean =>
  /^https?:\/\/[a-z0-9-]+\.supabase\.co(?:\/.*)?$/i.test(value.trim());

const looksLikeSupabaseKey = (value: string): boolean =>
  /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(value.trim());

const resolveSupabaseConfig = (urlValue: string, keyValue: string) => {
  const trimmedUrl = urlValue.trim();
  const trimmedKey = keyValue.trim();
  const shouldSwap = looksLikeSupabaseKey(trimmedUrl) && looksLikeSupabaseUrl(trimmedKey);

  const resolvedUrl = shouldSwap ? trimmedKey : trimmedUrl;
  const resolvedKey = shouldSwap ? trimmedUrl : trimmedKey;

  return {
    supabaseUrl: sanitizeSupabaseUrl(resolvedUrl),
    supabaseAnonKey: resolvedKey,
    swappedEnvDetected: shouldSwap
  };
};

const hasServiceRoleKey = rawSupabaseServiceRoleKey.trim() !== "";
const serverSupabaseKey = rawSupabaseServiceRoleKey.trim() || rawSupabaseAnonKey;

const { supabaseUrl, supabaseAnonKey, swappedEnvDetected } = resolveSupabaseConfig(
  rawSupabaseUrl,
  serverSupabaseKey
);
const isSupabaseConfigured = looksLikeSupabaseUrl(supabaseUrl) && supabaseAnonKey !== "";
const isRlsError = (error: any) =>
  error?.code === "42501" || String(error?.message || "").toLowerCase().includes("row-level security");
const PUBLIC_BLOCKING_BOOKING_STATUSES = new Set(["confirmed", "checked-in"]);

const getLocalDateInputValue = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isIsoDateString = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const validateBookingPayload = (
  booking: any,
  options?: { enforceTodayRule?: boolean }
): string | null => {
  if (!booking?.id || !booking?.roomId || !booking?.guestId) {
    return "Booking id, room, and guest are required.";
  }

  if (!isIsoDateString(booking.checkInDate) || !isIsoDateString(booking.checkOutDate)) {
    return "Booking dates must use YYYY-MM-DD format.";
  }

  if (booking.checkOutDate <= booking.checkInDate) {
    return "Check-out date must be after the check-in date.";
  }

  if (!Number.isFinite(Number(booking.totalPrice)) || Number(booking.totalPrice) <= 0) {
    return "Booking total price must be greater than zero.";
  }

  if (
    options?.enforceTodayRule &&
    booking.status === "confirmed" &&
    booking.checkInDate < getLocalDateInputValue()
  ) {
    return `Check-in date cannot be earlier than ${getLocalDateInputValue()}.`;
  }

  if (
    options?.enforceTodayRule &&
    booking.status === "confirmed" &&
    booking.checkInDate === getLocalDateInputValue() &&
    Number(booking.totalPrice || 0) <= 0
  ) {
    return "Same-day bookings require a valid booking amount before confirmation.";
  }

  return null;
};

const validateInvestorPayload = (investor: any): string | null => {
  if (!investor?.id || !String(investor.investorName || "").trim()) {
    return "Investor id and name are required.";
  }

  if (!isIsoDateString(investor.date)) {
    return "Investor date must use YYYY-MM-DD format.";
  }

  if (!Number.isFinite(Number(investor.amount)) || Number(investor.amount) <= 0) {
    return "Investor amount must be greater than zero.";
  }

  const equityPercentage = investor.equityPercentage ?? 0;
  if (!Number.isFinite(Number(equityPercentage)) || Number(equityPercentage) < 0 || Number(equityPercentage) > 100) {
    return "Investor profit share percentage must stay between 0 and 100.";
  }

  return null;
};

const hasBookingDateOverlap = (
  left: Pick<any, "roomId" | "checkInDate" | "checkOutDate" | "status">,
  right: Pick<any, "roomId" | "checkInDate" | "checkOutDate" | "status">
) => {
  if (left.roomId !== right.roomId) {
    return false;
  }

  if (
    !PUBLIC_BLOCKING_BOOKING_STATUSES.has(left.status) ||
    !PUBLIC_BLOCKING_BOOKING_STATUSES.has(right.status)
  ) {
    return false;
  }

  return left.checkInDate < right.checkOutDate && left.checkOutDate > right.checkInDate;
};

const compareRoomIds = (left: string, right: string) => {
  const leftNumber = Number(String(left).match(/\d+/)?.[0] || Number.NaN);
  const rightNumber = Number(String(right).match(/\d+/)?.[0] || Number.NaN);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
};

const normalizeRoomType = (roomId: string, type: unknown): string => {
  const rawType = String(type || '').trim();
  const typeKey = rawType.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (
    rawType === 'Skyview Suite' ||
    rawType === 'Sunset Room' ||
    rawType === 'Family Haven'
  ) {
    return rawType;
  }

  if (typeKey.includes('large balcony') || typeKey.includes('skyview')) {
    return 'Skyview Suite';
  }

  if (typeKey.includes('small balcony') || typeKey.includes('sunset') || typeKey.includes('premium suite')) {
    return 'Sunset Room';
  }

  if (typeKey.includes('family') || typeKey.includes('no balcony') || typeKey.includes('luxury villa')) {
    return 'Family Haven';
  }

  const roomPrefix = String(roomId || '').trim().charAt(0);
  if (roomPrefix === '5') {
    return 'Family Haven';
  }

  if (roomPrefix === '3') {
    return 'Sunset Room';
  }

  return 'Skyview Suite';
};

const normalizeBalconyLabel = (roomId: string, value: unknown, roomType?: unknown): string => {
  const rawValue = String(value || '').trim();
  if (rawValue === 'Large Balcony' || rawValue === 'Small Balcony' || rawValue === 'No Balcony') {
    return rawValue;
  }

  const normalizedType = normalizeRoomType(roomId, roomType);
  if (normalizedType === 'Family Haven') return 'No Balcony';
  if (normalizedType === 'Sunset Room') return 'Small Balcony';
  return 'Large Balcony';
};

const mapRoomRow = (row: any) => {
  const decodedStatus = decodeRoomStorageStatus(row.status);
  return {
    id: row.id,
    name: row.name,
    type: normalizeRoomType(row.id, row.type),
    pricePerNight: Number(row.price_per_night),
    status: decodedStatus.status,
    housekeepingStatus: decodedStatus.housekeepingStatus,
    amenities: row.amenities || [],
    floor: Number(row.floor),
    coverImageUrl: row.cover_image_url || '',
    galleryImageUrls: Array.isArray(row.gallery_image_urls) ? row.gallery_image_urls : [],
    publicDescription: row.public_description || '',
    publicLocation: row.public_location || '',
    publicModalLocation: row.public_modal_location || '',
    publicGuestsLabel: row.public_guests_label || '',
    publicSizeLabel: row.public_size_label || '',
    publicBedLabel: row.public_bed_label || '',
    publicBathLabel: row.public_bath_label || '',
    publicBalconyLabel: normalizeBalconyLabel(row.id, row.public_balcony_label, row.type)
  };
};

const findPayloadBookingConflict = (bookings: any[]): string | null => {
  for (let i = 0; i < bookings.length; i += 1) {
    for (let j = i + 1; j < bookings.length; j += 1) {
      if (hasBookingDateOverlap(bookings[i], bookings[j])) {
        return `Unit ${bookings[i].roomId} already has a booking overlap between ${bookings[i].checkInDate} and ${bookings[i].checkOutDate}.`;
      }
    }
  }

  return null;
};

const GUEST_META_PREFIX = "__ZVH_GUEST_META__:";
const INVESTOR_META_PREFIX = "__ZVH_INVESTOR_META__:";
const ROOM_ACTIVE_PREFIX = "active:";
const BOOKING_META_PREFIX = "__ZVH_BOOKING_META__:";
const EXPENSE_META_PREFIX = "__ZVH_EXPENSE_META__:";
const ISSUE_META_PREFIX = "__ZVH_MAINTENANCE_ISSUE__:";
const REVENUE_META_PREFIX = "__ZVH_EXTRA_REVENUE__:";
const AUDIT_META_PREFIX = "__ZVH_AUDIT_LOG__:";
const PROOF_FILE_PREFIX = "__ZVH_PROOF_FILE__:";

const isStoredProofFileRow = (row: any) =>
  typeof row?.description === "string" && row.description.startsWith(PROOF_FILE_PREFIX);

const encodeProofFileDescription = (proof: any) =>
  `${PROOF_FILE_PREFIX}${JSON.stringify({
    mimeType: proof.mimeType,
    size: proof.size,
    dataUrl: proof.dataUrl
  })}`;

const decodeProofFileMeta = (description: unknown) => {
  const parsed = parseStructuredPayload(description, PROOF_FILE_PREFIX);
  if (!parsed) {
    return {
      mimeType: "application/octet-stream",
      size: 0,
      dataUrl: ""
    };
  }
  return {
    mimeType: parsed.mimeType || "application/octet-stream",
    size: Number(parsed.size || 0),
    dataUrl: parsed.dataUrl || ""
  };
};

const signProofsDataUrl = (proofs: any[], token: string) => {
  if (!Array.isArray(proofs)) return [];
  return proofs.map((p: any) => {
    if (p && typeof p.dataUrl === "string" && p.dataUrl.startsWith("/api/proofs/")) {
      const baseUrl = p.dataUrl.split("?")[0];
      return {
        ...p,
        dataUrl: `${baseUrl}?token=${token}`
      };
    }
    return p;
  });
};

const unsignProofsDataUrl = (proofs: any[]) => {
  if (!Array.isArray(proofs)) return [];
  return proofs.map((p: any) => {
    if (p && typeof p.dataUrl === "string" && p.dataUrl.startsWith("/api/proofs/")) {
      return {
        ...p,
        dataUrl: p.dataUrl.split("?")[0]
      };
    }
    return p;
  });
};

const parseStructuredPayload = (value: unknown, prefix: string) => {
  if (typeof value !== "string" || !value.startsWith(prefix)) {
    return null;
  }

  try {
    return JSON.parse(value.slice(prefix.length));
  } catch {
    return null;
  }
};

const encodeGuestNotes = (guest: any) =>
  `${GUEST_META_PREFIX}${JSON.stringify({
    notes: guest.notes || "",
    documentType: guest.documentType || "",
    documentNumber: guest.documentNumber || "",
    preferences: guest.preferences || "",
    profileStatus: guest.profileStatus || "standard",
    identityProofs: Array.isArray(guest.identityProofs) ? unsignProofsDataUrl(guest.identityProofs) : [],
  })}`;

const decodeGuestMeta = (notes: unknown) => {
  const parsed = parseStructuredPayload(notes, GUEST_META_PREFIX);
  if (!parsed) {
    return {
      notes: typeof notes === "string" ? notes : "",
      documentType: undefined,
      documentNumber: undefined,
      preferences: "",
      profileStatus: "standard",
      identityProofs: [],
    };
  }

  return {
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
    documentType: parsed.documentType || undefined,
    documentNumber: parsed.documentNumber || undefined,
    preferences: typeof parsed.preferences === "string" ? parsed.preferences : "",
    profileStatus: parsed.profileStatus === "vip" || parsed.profileStatus === "blacklist" ? parsed.profileStatus : "standard",
    identityProofs: Array.isArray(parsed.identityProofs) ? parsed.identityProofs : [],
  };
};

const encodeInvestorNotes = (investor: any) =>
  `${INVESTOR_META_PREFIX}${JSON.stringify({
    notes: investor.notes || "",
    proofs: Array.isArray(investor.proofs) ? unsignProofsDataUrl(investor.proofs) : [],
  })}`;

const decodeInvestorMeta = (notes: unknown) => {
  const parsed = parseStructuredPayload(notes, INVESTOR_META_PREFIX);
  if (!parsed) {
    return {
      notes: typeof notes === "string" ? notes : "",
      proofs: [],
    };
  }

  return {
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
    proofs: Array.isArray(parsed.proofs) ? parsed.proofs : [],
  };
};

const encodeRoomStorageStatus = (room: any) => {
  if (room.status === "maintenance" || room.status === "blocked") {
    return room.status;
  }

  const housekeepingStatus = room.housekeepingStatus || "ready";
  return `${ROOM_ACTIVE_PREFIX}${housekeepingStatus}`;
};

const decodeRoomStorageStatus = (status: unknown) => {
  if (typeof status === "string") {
    if (status === "maintenance" || status === "blocked") {
      return {
        status,
        housekeepingStatus: "ready",
      };
    }

    if (status.startsWith(ROOM_ACTIVE_PREFIX)) {
      const housekeepingStatus = status.slice(ROOM_ACTIVE_PREFIX.length);
      if (["dirty", "cleaning-started", "cleaned", "inspected", "ready"].includes(housekeepingStatus)) {
        return {
          status: "active",
          housekeepingStatus,
        };
      }
    }

    if (status === "dirty") {
      return {
        status: "active",
        housekeepingStatus: "dirty",
      };
    }
  }

  return {
    status: "active",
    housekeepingStatus: "ready",
  };
};

const encodeBookingNotes = (booking: any) =>
  `${BOOKING_META_PREFIX}${JSON.stringify({
    notes: booking.notes || "",
    bookingSource: booking.bookingSource || "direct",
    advanceReceived: Number(booking.totalPrice || booking.advanceReceived || 0),
    paymentMethod: booking.paymentMethod || "cash",
    paymentStatus: booking.paymentStatus === "refunded" ? "refunded" : "paid",
    externalReference: booking.externalReference || "",
    specialRequest: booking.specialRequest || "",
    guestCount: Math.max(1, Number(booking.guestCount || 1)),
    adminNote: booking.adminNote || "",
    checkInTime: booking.checkInTime || "14:00",
    checkOutTime: booking.checkOutTime || "12:00",
    checkedInAt: booking.checkedInAt || "",
    checkedOutAt: booking.checkedOutAt || "",
    documentType: booking.documentType || "",
    documentNumber: booking.documentNumber || "",
    reviewNotes: booking.reviewNotes || "",
    damageNotes: booking.damageNotes || "",
    complaintNotes: booking.complaintNotes || "",
    proofs: Array.isArray(booking.proofs) ? unsignProofsDataUrl(booking.proofs) : [],
  })}`;

const decodeBookingMeta = (notes: unknown) => {
  const parsed = parseStructuredPayload(notes, BOOKING_META_PREFIX);
  if (!parsed) {
    return {
      notes: typeof notes === "string" ? notes : "",
      bookingSource: "direct",
      advanceReceived: 0,
      paymentMethod: "cash",
      paymentStatus: "paid",
      externalReference: "",
      specialRequest: "",
      guestCount: 1,
      adminNote: "",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      checkedInAt: "",
      checkedOutAt: "",
      documentType: undefined,
      documentNumber: undefined,
      reviewNotes: "",
      damageNotes: "",
      complaintNotes: "",
      proofs: [],
    };
  }

  return {
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
    bookingSource: parsed.bookingSource || "direct",
    advanceReceived: Number(parsed.advanceReceived || 0),
    paymentMethod: parsed.paymentMethod || "cash",
    paymentStatus: parsed.paymentStatus === "refunded" ? "refunded" : "paid",
    externalReference: parsed.externalReference || "",
    specialRequest: parsed.specialRequest || "",
    guestCount: Math.max(1, Number(parsed.guestCount || 1)),
    adminNote: parsed.adminNote || "",
    checkInTime: parsed.checkInTime || "14:00",
    checkOutTime: parsed.checkOutTime || "12:00",
    checkedInAt: parsed.checkedInAt || "",
    checkedOutAt: parsed.checkedOutAt || "",
    documentType: parsed.documentType || undefined,
    documentNumber: parsed.documentNumber || undefined,
    reviewNotes: parsed.reviewNotes || "",
    damageNotes: parsed.damageNotes || "",
    complaintNotes: parsed.complaintNotes || "",
    proofs: Array.isArray(parsed.proofs) ? parsed.proofs : [],
  };
};

const encodeExpenseDescription = (expense: any) =>
  `${EXPENSE_META_PREFIX}${JSON.stringify({
    description: expense.description || "",
    customCategoryLabel: expense.customCategoryLabel || "",
    maintenanceIssueId: expense.maintenanceIssueId || "",
    vendorName: expense.vendorName || "",
    receiptReference: expense.receiptReference || "",
    proofs: Array.isArray(expense.proofs) ? unsignProofsDataUrl(expense.proofs) : [],
  })}`;

const decodeExpenseMeta = (description: unknown) => {
  const parsed = parseStructuredPayload(description, EXPENSE_META_PREFIX);
  if (!parsed) {
    return {
      description: typeof description === "string" ? description : "",
      customCategoryLabel: undefined,
      maintenanceIssueId: undefined,
      vendorName: undefined,
      receiptReference: undefined,
      proofs: [],
    };
  }

  return {
    description: parsed.description || "",
    customCategoryLabel: parsed.customCategoryLabel || undefined,
    maintenanceIssueId: parsed.maintenanceIssueId || undefined,
    vendorName: parsed.vendorName || undefined,
    receiptReference: parsed.receiptReference || undefined,
    proofs: Array.isArray(parsed.proofs) ? parsed.proofs : [],
  };
};

const isStoredMaintenanceIssueRow = (row: any) =>
  typeof row?.description === "string" && row.description.startsWith(ISSUE_META_PREFIX);

const encodeMaintenanceIssueDescription = (issue: any) =>
  `${ISSUE_META_PREFIX}${JSON.stringify({
    priority: issue.priority || "medium",
    status: issue.status || "reported",
    assignedTo: issue.assignedTo || "",
    notes: issue.notes || "",
    beforePhotos: Array.isArray(issue.beforePhotos) ? unsignProofsDataUrl(issue.beforePhotos) : [],
    afterPhotos: Array.isArray(issue.afterPhotos) ? unsignProofsDataUrl(issue.afterPhotos) : [],
  })}`;

const decodeMaintenanceIssueMeta = (description: unknown) => {
  const parsed = parseStructuredPayload(description, ISSUE_META_PREFIX);
  if (!parsed) {
    return {
      priority: "medium",
      status: "reported",
      assignedTo: "",
      notes: "",
      beforePhotos: [],
      afterPhotos: [],
    };
  }

  return {
    priority: parsed.priority || "medium",
    status: parsed.status || "reported",
    assignedTo: parsed.assignedTo || "",
    notes: parsed.notes || "",
    beforePhotos: Array.isArray(parsed.beforePhotos) ? parsed.beforePhotos : [],
    afterPhotos: Array.isArray(parsed.afterPhotos) ? parsed.afterPhotos : [],
  };
};

const isStoredExtraRevenueRow = (row: any) =>
  typeof row?.description === "string" && row.description.startsWith(REVENUE_META_PREFIX);

const encodeExtraRevenueDescription = (entry: any) =>
  `${REVENUE_META_PREFIX}${JSON.stringify({
    category: entry.category || "extra-charges",
    notes: entry.notes || "",
    linkedBookingId: entry.linkedBookingId || "",
    proofs: Array.isArray(entry.proofs) ? unsignProofsDataUrl(entry.proofs) : [],
  })}`;

const decodeExtraRevenueMeta = (description: unknown) => {
  const parsed = parseStructuredPayload(description, REVENUE_META_PREFIX);
  if (!parsed) {
    return {
      category: "extra-charges",
      notes: "",
      linkedBookingId: undefined,
      proofs: [],
    };
  }

  return {
    category: parsed.category || "extra-charges",
    notes: parsed.notes || "",
    linkedBookingId: parsed.linkedBookingId || undefined,
    proofs: Array.isArray(parsed.proofs) ? parsed.proofs : [],
  };
};

const isStoredAuditLogRow = (row: any) =>
  typeof row?.description === "string" && row.description.startsWith(AUDIT_META_PREFIX);

const encodeAuditLogDescription = (entry: any) =>
  `${AUDIT_META_PREFIX}${JSON.stringify({
    action: entry.action || "update",
    entityType: entry.entityType || "system",
    entityId: entry.entityId || "",
    entityLabel: entry.entityLabel || "",
    actorEmail: entry.actorEmail || "",
    actorRole: normalizeUserRole(entry.actorRole),
    createdAt: entry.createdAt || "",
    changes: Array.isArray(entry.changes) ? entry.changes : [],
  })}`;

const decodeAuditLogMeta = (description: unknown) => {
  const parsed = parseStructuredPayload(description, AUDIT_META_PREFIX);
  if (!parsed) {
    return {
      action: "update",
      entityType: "system",
      entityId: "",
      entityLabel: "",
      actorEmail: "",
      actorRole: "owner-admin",
      createdAt: "",
      changes: [],
    };
  }

  return {
    action: parsed.action || "update",
    entityType: parsed.entityType || "system",
    entityId: parsed.entityId || "",
    entityLabel: parsed.entityLabel || "",
    actorEmail: parsed.actorEmail || "",
    actorRole: normalizeUserRole(parsed.actorRole),
    createdAt: parsed.createdAt || "",
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
  };
};

let supabase: any = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });
    if (swappedEnvDetected) {
      console.warn("Supabase env values were swapped. Auto-corrected SUPABASE_URL and SUPABASE_ANON_KEY at runtime.");
    }
    console.log("Supabase successfully connected!");
  } catch (err) {
    console.error("Supabase failed initialization:", err);
  }
} else {
  console.log("Supabase is unconfigured. Running in local fallback memory storage.");
}

// -------------------------------------------------------------
// SECURE LOGIN API ROUTES
// -------------------------------------------------------------
app.get("/api/auth/status", (req, res) => {
  res.json({
    success: true,
    isSupabaseConfigured: isSupabaseConfigured,
    swappedEnvDetected,
    supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : null
  });
});

app.get("/api/public/rooms", async (req, res) => {
  if (!supabase) {
    return res.json({ rooms: [], isSupabaseConnected: false });
  }

  const checkInDate = typeof req.query.checkIn === "string" ? req.query.checkIn : "";
  const checkOutDate = typeof req.query.checkOut === "string" ? req.query.checkOut : "";
  const hasDates = checkInDate !== "" || checkOutDate !== "";
  if (hasDates) {
    if (!isIsoDateString(checkInDate) || !isIsoDateString(checkOutDate) || checkOutDate <= checkInDate) {
      return res.status(400).json({ error: "Valid check-in and check-out dates are required." });
    }

    if (checkInDate < getLocalDateInputValue()) {
      return res.status(400).json({ error: `Check-in date cannot be earlier than ${getLocalDateInputValue()}.` });
    }
  }

  try {
    const [roomsRes, bookingsRes] = await Promise.all([
      supabase.from("rooms").select("*"),
      hasDates
        ? supabase
            .from("bookings")
            .select("id, room_id, check_in_date, check_out_date, status")
            .lt("check_in_date", checkOutDate)
            .gt("check_out_date", checkInDate)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (roomsRes.error) throw roomsRes.error;
    if (bookingsRes.error) throw bookingsRes.error;

    const blockingBookingsByRoom = new Set(
      (bookingsRes.data || [])
        .filter((booking: any) => PUBLIC_BLOCKING_BOOKING_STATUSES.has(booking.status))
        .map((booking: any) => booking.room_id)
    );

    const rooms = (roomsRes.data || [])
      .map((row: any) => {
        const room = mapRoomRow(row);
        const isOperationallyAvailable = room.status === "active";
        const hasConflict = hasDates && blockingBookingsByRoom.has(room.id);
        const available = hasDates ? isOperationallyAvailable && !hasConflict : isOperationallyAvailable;
        return {
          id: room.id,
          name: room.name,
          type: room.type,
          pricePerNight: room.pricePerNight,
          status: room.status,
          housekeepingStatus: room.housekeepingStatus,
          floor: room.floor,
          amenities: room.amenities,
          coverImageUrl: room.coverImageUrl,
          galleryImageUrls: room.galleryImageUrls,
          publicDescription: room.publicDescription,
          publicLocation: room.publicLocation,
          publicModalLocation: room.publicModalLocation,
          publicGuestsLabel: room.publicGuestsLabel,
          publicSizeLabel: room.publicSizeLabel,
          publicBedLabel: room.publicBedLabel,
          publicBathLabel: room.publicBathLabel,
          publicBalconyLabel: room.publicBalconyLabel,
          available,
          unavailableReason: !isOperationallyAvailable
            ? "This room is not open for booking right now."
            : hasConflict
              ? "This room is already booked for the selected dates."
              : "",
        };
      })
      .sort((left: any, right: any) => compareRoomIds(left.id, right.id));

    return res.json({ rooms, isSupabaseConnected: true });
  } catch (err: any) {
    console.error("Public room availability error:", err);
    return res.status(500).json({ error: "Unable to load room availability." });
  }
});

app.post("/api/public/booking-requests", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Booking requests are temporarily unavailable." });
  }

  const payload = req.body || {};
  const roomId = String(payload.roomId || "").trim();
  const guestName = String(payload.guestName || "").trim();
  const email = String(payload.email || "").trim();
  const phone = String(payload.phone || "").trim();
  const cnic = String(payload.cnic || "").trim();
  const documentType = String(payload.documentType || "cnic").trim();
  const checkInDate = String(payload.checkInDate || "").trim();
  const checkOutDate = String(payload.checkOutDate || "").trim();
  const guestCount = Math.max(1, Number(payload.guestCount || 1));
  const specialRequests = String(payload.specialRequests || "").trim();

  if (!roomId || !guestName || !phone) {
    return res.status(400).json({ error: "Room, guest name, and phone are required." });
  }

  if (!isIsoDateString(checkInDate) || !isIsoDateString(checkOutDate) || checkOutDate <= checkInDate) {
    return res.status(400).json({ error: "Valid check-in and check-out dates are required." });
  }

  if (checkInDate < getLocalDateInputValue()) {
    return res.status(400).json({ error: `Check-in date cannot be earlier than ${getLocalDateInputValue()}.` });
  }

  try {
    const [{ data: roomRows, error: roomError }, { data: conflictingRows, error: conflictError }] = await Promise.all([
      supabase.from("rooms").select("id, status, price_per_night").eq("id", roomId).limit(1),
      supabase
        .from("bookings")
        .select("id, room_id, check_in_date, check_out_date, status")
        .eq("room_id", roomId)
        .lt("check_in_date", checkOutDate)
        .gt("check_out_date", checkInDate),
    ]);

    if (roomError) throw roomError;
    if (conflictError) throw conflictError;

    const room = roomRows?.[0];
    if (!room) {
      return res.status(404).json({ error: "Room was not found." });
    }

    const decodedStatus = decodeRoomStorageStatus(room.status);
    if (decodedStatus.status !== "active") {
      return res.status(409).json({ error: "This room is not open for booking right now." });
    }

    const hasConflict = (conflictingRows || []).some((booking: any) =>
      PUBLIC_BLOCKING_BOOKING_STATUSES.has(booking.status)
    );
    if (hasConflict) {
      return res.status(409).json({ error: "This room is already booked for the selected dates." });
    }

    const nights = Math.max(
      1,
      Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24))
    );
    const totalPrice = nights * Number(room.price_per_night || 0);
    const id = `B-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const guestId = `G-${id}`;
    const [firstName, ...lastNameParts] = guestName.split(/\s+/).filter(Boolean);
    const guestFirstName = firstName || guestName;
    const guestLastName = lastNameParts.join(" ") || "Guest";

    const { error: guestInsertError } = await supabase.from("guests").upsert({
      id: guestId,
      first_name: guestFirstName,
      last_name: guestLastName,
      email,
      phone,
      cnic: cnic || "PUBLIC-REQUEST",
      notes: encodeGuestNotes({
        notes: "Created from public website booking request.",
        documentType: documentType || "cnic",
        documentNumber: cnic || "",
        preferences: "",
        profileStatus: "standard",
        identityProofs: [],
      }),
      created_at: getLocalDateInputValue(),
    });
    if (guestInsertError) throw guestInsertError;

    const bookingPayload = {
      id,
      room_id: roomId,
      unit_id: roomId,
      guest_id: guestId,
      guest_name: guestName,
      guest_first_name: guestFirstName,
      guest_last_name: guestLastName,
      guest_phone: phone,
      guest_email: email,
      guest_cnic: cnic || "PUBLIC-REQUEST",
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      guests_count: guestCount,
      total_price: totalPrice,
      status: "pending",
      special_request: specialRequests,
      admin_note: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: encodeBookingNotes({
        notes: "Public website booking request. Awaiting admin review.",
        bookingSource: "direct",
        advanceReceived: 0,
        paymentMethod: "cash",
        paymentStatus: "unpaid",
        specialRequest: specialRequests,
        guestCount,
        adminNote: "",
        documentType: documentType || "cnic",
        documentNumber: cnic || "",
      }),
    };

    const { error } = await supabase.from("bookings").insert(bookingPayload);

    if (error) throw error;
    return res.status(201).json({ success: true, requestId: id });
  } catch (err: any) {
    console.error("Public booking request error:", err);
    return res.status(500).json({ error: "Unable to submit booking request." });
  }
});

// -------------------------------------------------------------
// CONTACT INQUIRIES — PUBLIC WEBSITE CONTACT FORM
// -------------------------------------------------------------

// GET /api/public/contact-inquiry — Admin fetches all inquiries
app.get("/api/public/contact-inquiry", async (req, res) => {
  // This route is used by the admin panel — require auth
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (!supabase) {
    return res.status(503).json({ error: "Database not configured.", inquiries: [] });
  }

  const status = typeof req.query.status === "string" ? req.query.status : null;

  try {
    let query = supabase
      .from("contact_inquiries")
      .select("id, name, email, phone, message, status, created_at")
      .order("created_at", { ascending: false });

    if (status && ["new", "read", "archived"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ inquiries: data || [] });
  } catch (err: any) {
    console.error("Contact inquiry fetch error:", err);
    return res.status(500).json({ error: "Unable to fetch inquiries.", inquiries: [] });
  }
});

// POST /api/public/contact-inquiry — Public website submits a contact inquiry
app.post("/api/public/contact-inquiry", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Contact form is temporarily unavailable." });
  }

  const payload = req.body || {};
  const name    = String(payload.name    || "").trim();
  const email   = String(payload.email   || "").trim();
  const phone   = String(payload.phone   || "").trim();
  const message = String(payload.message || "").trim();

  if (!name) {
    return res.status(400).json({ error: "Your name is required." });
  }
  if (!email && !phone) {
    return res.status(400).json({ error: "Please provide an email or phone number." });
  }
  if (!message) {
    return res.status(400).json({ error: "Your message cannot be empty." });
  }

  const id = `CI-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  try {
    const { error } = await supabase.from("contact_inquiries").insert({
      id,
      name,
      email,
      phone,
      message,
      status: "new",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    return res.status(201).json({ success: true, inquiryId: id });
  } catch (err: any) {
    console.error("Contact inquiry insert error:", err);
    return res.status(500).json({ error: "Unable to submit your message. Please try again." });
  }
});

// PATCH /api/public/contact-inquiry/:id — Admin updates inquiry status
app.patch("/api/public/contact-inquiry/:id", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (!supabase) {
    return res.status(503).json({ error: "Database not configured." });
  }

  const { id } = req.params;
  const status = String(req.body?.status || "").trim();

  if (!["new", "read", "archived"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    const { error } = await supabase
      .from("contact_inquiries")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Contact inquiry update error:", err);
    return res.status(500).json({ error: "Unable to update inquiry." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";

  // 1. Bruteforce Rate Limit Guard
  const limitCheck = applyLoginRateLimit(clientIp.toString());
  if (!limitCheck.allowed) {
    return res.status(429).json({
      success: false,
      message: `Too many login attempts. Please try again in ${limitCheck.waitTime} seconds.`,
      waitTime: limitCheck.waitTime
    });
  }

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Please enter your email and password." });
  }

  const normalizedEmail = email.trim().toLowerCase();


  // 2. Error if Supabase is unconfigured
  if (!supabase) {
    return res.status(503).json({
      success: false,
      message: "Database connection parameters (SUPABASE_URL or SUPABASE_ANON_KEY) are missing. Please configure them in setup."
    });
  }

  // 3. SECURE VERIFICATION FROM SUPABASE (Checks matches in "admins" table)
  try {
    let userRow: any = null;
    let error: any = null;

    const roleAwareLookup = await supabase
      .from("admins")
      .select("id, email, password, role")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (roleAwareLookup.error && String(roleAwareLookup.error.message || "").toLowerCase().includes("role")) {
      const fallbackLookup = await supabase
        .from("admins")
        .select("id, email, password")
        .ilike("email", normalizedEmail)
        .maybeSingle();
      userRow = fallbackLookup.data;
      error = fallbackLookup.error;
    } else {
      userRow = roleAwareLookup.data;
      error = roleAwareLookup.error;
    }

    if (error) {
      console.error("Supabase verification error matching admins table:", error);
      return res.status(401).json({
        success: false,
        message: "Database connection or authentication error. Please verify your credentials or try again later."
      });
    }

    if (!userRow) {
      const { data: adminProbe, error: adminProbeError } = await supabase
        .from("admins")
        .select("id")
        .limit(1);

      if (adminProbeError) {
        console.error("Supabase admin probe failed:", adminProbeError);
      }

      const adminRowsVisible = Array.isArray(adminProbe) && adminProbe.length > 0;
      if (!hasServiceRoleKey && !adminRowsVisible) {
        return res.status(503).json({
          success: false,
          code: "AUTH_SETUP_REQUIRED",
          message: "Login system setup is incomplete."
        });
      }

      return res.status(401).json({ success: false, message: "Wrong credentials." });
    }

    // Direct password match comparison from plain password text column (per database schema guidelines)
    if (userRow.password !== password) {
      return res.status(401).json({ success: false, message: "Wrong credentials." });
    }

    // Login successful - Clear rate limits on success
    loginAttempts.delete(clientIp.toString());

    const resolvedRole = normalizeUserRole(userRow.role);

    const secureToken = signSessionToken({
      sub: userRow.id,
      email: userRow.email,
      role: resolvedRole,
    });

    return res.json({
      success: true,
      token: secureToken,
      isDemoMode: false,
      user: {
        email: userRow.email,
        role: resolvedRole,
      },
      message: "Logged in successfully."
    });

  } catch (err: any) {
    console.error("Authentication internal failure:", err);
    return res.status(500).json({ success: false, message: "Could not connect to the database. Please verify your variables." });
  }
});

// Middleware to authorize server endpoints
const requireAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Access Denied: Missing authorization headers." });
  }

  const token = authHeader.replace("Bearer ", "");
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: "Access Denied: Revoked or expired session token bounds." });
  }
  req.session = session;
  next();
};

app.post("/api/auth/logout", (req, res) => {
  res.json({ success: true, message: "Logged out cleanly." });
});

// -------------------------------------------------------------
// GET MASTER STATE FROM SUPABASE TABLES (Rooms, Bookings, Guests, Expenses, Investors)
// -------------------------------------------------------------
app.get("/api/state", requireAuth, async (req, res) => {
  const authRequest = req as typeof req & { session: { email: string; role: string } };
  const currentUser = {
    email: authRequest.session.email,
    role: normalizeUserRole(authRequest.session.role),
  };

  const token = req.headers.authorization?.replace("Bearer ", "") || "";

  // If Supabase not Configured, return empty client data structures to load cleanly locally
  if (!supabase) {
    // Collect local proofs that correspond to requested format if needed, but since it is in-memory
    // and local client state is persistent, local client already has the dataUrls.
    return res.json({
      isSupabaseConnected: false,
      currentUser,
      rooms: [],
      guests: [],
      bookings: [],
      expenses: [],
      investors: [],
      maintenanceIssues: [],
      extraRevenueEntries: [],
      auditLogs: [],
    });
  }

  try {
    // Parallel fetching all tables
    const [roomsRes, guestsRes, bookingsRes, expensesRes, investorsRes] = await Promise.all([
      supabase.from("rooms").select("*"),
      supabase.from("guests").select("*"),
      supabase.from("bookings").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("investors").select("*")
    ]);

    if (roomsRes.error) throw roomsRes.error;
    if (guestsRes.error) throw guestsRes.error;
    if (bookingsRes.error) throw bookingsRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (investorsRes.error) throw investorsRes.error;

    // Convert SQL row snake_case objects to CamelCase fields expected by frontend UI state
    const roomsMapped = roomsRes.data
      .map(mapRoomRow)
      .sort((left: any, right: any) => compareRoomIds(left.id, right.id));

    const guestsMapped = guestsRes.data.map((g: any) => {
      const guestMeta = decodeGuestMeta(g.notes);
      return {
        id: g.id,
        firstName: g.first_name,
        lastName: g.last_name,
        email: g.email || "",
        phone: g.phone || "",
        cnic: g.cnic || "",
        notes: guestMeta.notes,
        createdAt: g.created_at,
        documentType: guestMeta.documentType,
        documentNumber: guestMeta.documentNumber,
        preferences: guestMeta.preferences,
        profileStatus: guestMeta.profileStatus,
        identityProofs: signProofsDataUrl(guestMeta.identityProofs, token),
      };
    });

    const bookingsMapped = bookingsRes.data.map((b: any) => {
      const bookingMeta = decodeBookingMeta(b.notes);
      const guestNameParts = String(b.guest_name || "").trim().split(/\s+/).filter(Boolean);
      return {
        id: b.id,
        roomId: b.room_id || b.unit_id,
        guestId: b.guest_id,
        guestFirstName: b.guest_first_name || guestNameParts[0] || "Guest",
        guestLastName: b.guest_last_name || guestNameParts.slice(1).join(" ") || "",
        guestPhone: b.guest_phone,
        guestEmail: b.guest_email || "",
        guestCnic: b.guest_cnic,
        checkInDate: b.check_in_date,
        checkOutDate: b.check_out_date,
        totalPrice: Number(b.total_price),
        status: b.status,
        notes: bookingMeta.notes,
        bookingSource: bookingMeta.bookingSource,
        advanceReceived: bookingMeta.advanceReceived,
        paymentMethod: bookingMeta.paymentMethod,
        paymentStatus: bookingMeta.paymentStatus,
        externalReference: bookingMeta.externalReference,
        specialRequest: b.special_request || bookingMeta.specialRequest,
        guestCount: Number(b.guests_count || bookingMeta.guestCount || 1),
        adminNote: b.admin_note || bookingMeta.adminNote,
        checkInTime: bookingMeta.checkInTime,
        checkOutTime: bookingMeta.checkOutTime,
        checkedInAt: bookingMeta.checkedInAt || undefined,
        checkedOutAt: bookingMeta.checkedOutAt || undefined,
        documentType: bookingMeta.documentType,
        documentNumber: bookingMeta.documentNumber,
        reviewNotes: bookingMeta.reviewNotes,
        damageNotes: bookingMeta.damageNotes,
        complaintNotes: bookingMeta.complaintNotes,
        proofs: signProofsDataUrl(bookingMeta.proofs, token),
      };
    });

    const maintenanceIssuesMapped = expensesRes.data
      .filter((row: any) => isStoredMaintenanceIssueRow(row))
      .map((row: any) => {
        const meta = decodeMaintenanceIssueMeta(row.description);
        return {
          id: row.id,
          title: row.title,
          roomId: row.room_id,
          priority: meta.priority,
          status: meta.status,
          reportedDate: row.date,
          assignedTo: meta.assignedTo,
          notes: meta.notes,
          beforePhotos: signProofsDataUrl(meta.beforePhotos, token),
          afterPhotos: signProofsDataUrl(meta.afterPhotos, token),
        };
      });

    const extraRevenueEntriesMapped = expensesRes.data
      .filter((row: any) => isStoredExtraRevenueRow(row))
      .map((row: any) => {
        const meta = decodeExtraRevenueMeta(row.description);
        return {
          id: row.id,
          title: row.title,
          amount: Number(row.amount),
          date: row.date,
          category: meta.category,
          notes: meta.notes,
          linkedBookingId: meta.linkedBookingId,
          proofs: signProofsDataUrl(meta.proofs, token),
        };
      });

    const auditLogsMapped = expensesRes.data
      .filter((row: any) => isStoredAuditLogRow(row))
      .map((row: any) => {
        const meta = decodeAuditLogMeta(row.description);
        return {
          id: row.id,
          action: meta.action,
          entityType: meta.entityType,
          entityId: meta.entityId,
          entityLabel: meta.entityLabel || row.title,
          actorEmail: meta.actorEmail,
          actorRole: meta.actorRole,
          createdAt: meta.createdAt || `${row.date}T00:00:00.000Z`,
          changes: meta.changes,
        };
      });

    const expensesMapped = expensesRes.data
      .filter((row: any) => !isStoredMaintenanceIssueRow(row) && !isStoredExtraRevenueRow(row) && !isStoredAuditLogRow(row) && !isStoredProofFileRow(row))
      .map((e: any) => {
        const expenseMeta = decodeExpenseMeta(e.description);
        return {
          id: e.id,
          title: e.title,
          category: e.category,
          amount: Number(e.amount),
          date: e.date,
          roomId: e.room_id || undefined,
          status: e.status,
          description: expenseMeta.description,
          customCategoryLabel: expenseMeta.customCategoryLabel,
          paidFromInvestorFundId: e.paid_from_investor_fund_id || undefined,
          maintenanceIssueId: expenseMeta.maintenanceIssueId,
          vendorName: expenseMeta.vendorName,
          receiptReference: expenseMeta.receiptReference,
          proofs: signProofsDataUrl(expenseMeta.proofs, token),
        };
      });

    const investorsMapped = investorsRes.data.map((i: any) => {
      const equityPercentage = Number(i.equity_percentage);
      const investorMeta = decodeInvestorMeta(i.notes);
      return {
        id: i.id,
        investorName: i.investor_name,
        amount: Number(i.amount),
        date: i.date,
        equityPercentage: Number.isFinite(equityPercentage) && equityPercentage > 0 ? equityPercentage : undefined,
        notes: investorMeta.notes,
        proofs: signProofsDataUrl(investorMeta.proofs, token),
      };
    });

    const scopedExpenses =
      currentUser.role === "owner-admin" || currentUser.role === "investor" ? expensesMapped : [];
    const scopedInvestors =
      currentUser.role === "owner-admin" || currentUser.role === "investor" ? investorsMapped : [];
    const scopedMaintenanceIssues =
      currentUser.role === "owner-admin" || currentUser.role === "manager" || currentUser.role === "maintenance"
        ? maintenanceIssuesMapped
        : [];
    const scopedExtraRevenue =
      currentUser.role === "owner-admin" || currentUser.role === "investor" ? extraRevenueEntriesMapped : [];
    const scopedAuditLogs = currentUser.role === "owner-admin" ? auditLogsMapped : [];

    return res.json({
      isSupabaseConnected: true,
      currentUser,
      rooms: roomsMapped,
      guests: guestsMapped,
      bookings: bookingsMapped,
      expenses: scopedExpenses,
      investors: scopedInvestors,
      maintenanceIssues: scopedMaintenanceIssues,
      extraRevenueEntries: scopedExtraRevenue,
      auditLogs: scopedAuditLogs,
    });

  } catch (err: any) {
    console.error("State loading error:", err);
    if (isRlsError(err)) {
      return res.status(503).json({
        code: "DB_ACCESS_BLOCKED",
        message: "Supabase RLS is blocking table access. Add SUPABASE_SERVICE_ROLE_KEY or disable RLS for app tables."
      });
    }
    return res.status(500).json({ error: "Failed to load database records." });
  }
});

// -------------------------------------------------------------
// SECURE FILE PROOF STORAGE ENDPOINTS
// -------------------------------------------------------------
app.post("/api/proofs", requireAuth, async (req, res) => {
  const p = req.body; // { id, name, mimeType, size, dataUrl }
  if (!p || !p.id || !p.dataUrl) {
    return res.status(400).json({ error: "Missing required proof attachment parameters." });
  }

  if (!supabase) {
    localProofs.set(p.id, p);
    return res.json({ success: true, localOnly: true });
  }

  try {
    const { error } = await supabase.from("expenses").upsert({
      id: p.id,
      title: p.name || "proof-file",
      category: "proof-file",
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      room_id: null,
      status: "paid",
      description: encodeProofFileDescription(p),
      paid_from_investor_fund_id: null
    });

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to upload proof to database:", err);
    res.status(500).json({ error: err.message || "Failed to store proof file in database." });
  }
});

app.get("/api/proofs/:id", async (req, res) => {
  const authHeader = req.headers.authorization;
  let token = "";
  if (authHeader) {
    token = authHeader.replace("Bearer ", "");
  } else if (typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).send("Access Denied: Missing authorization headers or query token.");
  }

  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).send("Access Denied: Revoked or expired session token bounds.");
  }

  if (!supabase) {
    const p = localProofs.get(req.params.id);
    if (!p) {
      return res.status(404).send("File not found locally.");
    }
    const match = p.dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) {
      return res.status(500).send("Invalid local file encoding.");
    }
    const mimeType = match[1];
    const base64Data = match[2];
    const fileBuffer = Buffer.from(base64Data, "base64");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", fileBuffer.length);
    return res.send(fileBuffer);
  }

  try {
    const { data, error } = await supabase
      .from("expenses")
      .select("title, description")
      .eq("id", req.params.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).send("Proof file row not found.");
      }
      throw error;
    }
    if (!data || !isStoredProofFileRow(data)) {
      return res.status(404).send("Proof file row not found.");
    }

    const meta = decodeProofFileMeta(data.description);
    if (!meta.dataUrl) {
      return res.status(404).send("Proof file content is empty.");
    }

    const match = meta.dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) {
      return res.status(500).send("Invalid stored proof file encoding.");
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const fileBuffer = Buffer.from(base64Data, "base64");

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", fileBuffer.length);
    res.send(fileBuffer);
  } catch (err: any) {
    console.error("Failed to load proof from database:", err);
    res.status(500).send(err.message || "Failed to load proof from database.");
  }
});

// -------------------------------------------------------------
// SECURE SYNCRONIZED DATABASE SAVE CHANNELS
// -------------------------------------------------------------
const upsertTable = async ({
  table,
  rows,
  mapRow
}: {
  table: string;
  rows: any[];
  mapRow: (row: any) => any;
}) => {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const payload = normalizedRows.map(mapRow);

  if (payload.length > 0) {
    const { error } = await supabase.from(table).upsert(payload);
    if (error) throw error;
  }
};

const deleteMissingRows = async ({
  table,
  idsToKeep
}: {
  table: string;
  idsToKeep: string[];
}) => {
  if (idsToKeep.length > 0) {
    const serializedIds = idsToKeep.map((id) => `"${String(id).replace(/"/g, '\\"')}"`).join(",");
    const { error } = await supabase.from(table).delete().not("id", "in", `(${serializedIds})`);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from(table).delete().not("id", "is", null);
  if (error) throw error;
};

app.post("/api/sync", requireAuth, async (req, res) => {
  if (!supabase) {
    return res.json({ success: true, localOnly: true });
  }

  const authRequest = req as typeof req & { session: { role: string } };
  const actorRole = normalizeUserRole(authRequest.session.role);
  const isAdmin = actorRole === "owner-admin";
  const incomingRooms = Array.isArray(req.body?.rooms) ? req.body.rooms : [];
  const incomingGuests = Array.isArray(req.body?.guests) ? req.body.guests : [];
  const incomingBookings = Array.isArray(req.body?.bookings) ? req.body.bookings : [];
  const incomingExpenses = Array.isArray(req.body?.expenses) ? req.body.expenses : [];
  const incomingInvestors = Array.isArray(req.body?.investors) ? req.body.investors : [];
  const incomingMaintenanceIssues = Array.isArray(req.body?.maintenanceIssues) ? req.body.maintenanceIssues : [];
  const incomingExtraRevenueEntries = Array.isArray(req.body?.extraRevenueEntries) ? req.body.extraRevenueEntries : [];
  const incomingAuditLogs = Array.isArray(req.body?.auditLogs) ? req.body.auditLogs : [];

  let rooms = isAdmin ? incomingRooms : [];
  if (!isAdmin && canServerSyncRoomStatus(actorRole)) {
    try {
      const existingRoomsRes = await supabase.from("rooms").select("*");
      if (existingRoomsRes.error) {
        throw existingRoomsRes.error;
      }
      const existingRoomsById = new Map<string, any>((existingRoomsRes.data || []).map((room: any) => [room.id, room]));
      rooms = incomingRooms
        .filter((room: any) => existingRoomsById.has(room.id))
        .map((room: any) => {
          const existingRoom = existingRoomsById.get(room.id);
          const decodedStatus = decodeRoomStorageStatus(existingRoom?.status);
          return {
            id: room.id,
            name: existingRoom?.name ?? room.name,
            type: existingRoom?.type ?? room.type,
            pricePerNight: Number(existingRoom?.price_per_night ?? room.pricePerNight ?? 0),
            amenities: existingRoom?.amenities ?? room.amenities ?? [],
            floor: Number(existingRoom?.floor ?? room.floor ?? 0),
            status: room.status || decodedStatus.status,
            housekeepingStatus: room.housekeepingStatus || decodedStatus.housekeepingStatus,
            coverImageUrl: existingRoom?.cover_image_url || '',
            galleryImageUrls: Array.isArray(existingRoom?.gallery_image_urls) ? existingRoom.gallery_image_urls : [],
            publicDescription: existingRoom?.public_description || '',
            publicLocation: existingRoom?.public_location || '',
            publicModalLocation: existingRoom?.public_modal_location || '',
            publicGuestsLabel: existingRoom?.public_guests_label || '',
            publicSizeLabel: existingRoom?.public_size_label || '',
            publicBedLabel: existingRoom?.public_bed_label || '',
            publicBathLabel: existingRoom?.public_bath_label || '',
            publicBalconyLabel: normalizeBalconyLabel(existingRoom?.id ?? room.id, existingRoom?.public_balcony_label, existingRoom?.type),
          };
        });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Unable to validate room status sync." });
    }
  }

  // Helper to restore base64 dataUrl from existing DB records if incoming payload has it empty (stripped to avoid 413 error)
  const restoreProofs = (incomingProofs: any[], existingProofs: any[]) => {
    if (!Array.isArray(incomingProofs)) return [];
    const existingMap = new Map(
      (Array.isArray(existingProofs) ? existingProofs : [])
        .filter((p: any) => p && p.id)
        .map((p: any) => [p.id, p])
    );
    return incomingProofs.map((p: any) => {
      if (!p.dataUrl) {
        const existing = existingMap.get(p.id);
        if (existing && existing.dataUrl) {
          return { ...p, dataUrl: existing.dataUrl };
        }
      }
      return p;
    });
  };

  const existingGuestsById = new Map<string, any>();
  const existingBookingsById = new Map<string, any>();
  const existingInvestorsById = new Map<string, any>();
  const existingExpensesById = new Map<string, any>();

  try {
    const [guestsRes, bookingsRes, investorsRes, expensesRes] = await Promise.all([
      supabase.from("guests").select("id, notes"),
      supabase.from("bookings").select("id, notes"),
      supabase.from("investors").select("id, notes"),
      supabase.from("expenses").select("id, description")
    ]);

    if (!guestsRes.error && guestsRes.data) {
      guestsRes.data.forEach((g: any) => {
        existingGuestsById.set(g.id, decodeGuestMeta(g.notes));
      });
    }
    if (!bookingsRes.error && bookingsRes.data) {
      bookingsRes.data.forEach((b: any) => {
        existingBookingsById.set(b.id, decodeBookingMeta(b.notes));
      });
    }
    if (!investorsRes.error && investorsRes.data) {
      investorsRes.data.forEach((i: any) => {
        existingInvestorsById.set(i.id, decodeInvestorMeta(i.notes));
      });
    }
    if (!expensesRes.error && expensesRes.data) {
      expensesRes.data.forEach((e: any) => {
        if (isStoredMaintenanceIssueRow(e)) {
          existingExpensesById.set(e.id, { type: 'maintenance', meta: decodeMaintenanceIssueMeta(e.description) });
        } else if (isStoredExtraRevenueRow(e)) {
          existingExpensesById.set(e.id, { type: 'revenue', meta: decodeExtraRevenueMeta(e.description) });
        } else if (isStoredAuditLogRow(e)) {
          // Audit logs do not have proofs
        } else if (isStoredProofFileRow(e)) {
          // Proof files do not need restoration mapping
        } else {
          existingExpensesById.set(e.id, { type: 'expense', meta: decodeExpenseMeta(e.description) });
        }
      });
    }
  } catch (err) {
    console.error("Failed to load existing records for proof dataUrl restoration:", err);
  }

  const guests = (canServerManageGuests(actorRole) ? incomingGuests : []).map((g: any) => {
    const existing = existingGuestsById.get(g.id);
    return {
      ...g,
      identityProofs: restoreProofs(g.identityProofs, existing?.identityProofs)
    };
  });

  const bookings = (canServerManageBookings(actorRole) ? incomingBookings : []).map((b: any) => {
    const existing = existingBookingsById.get(b.id);
    return {
      ...b,
      proofs: restoreProofs(b.proofs, existing?.proofs)
    };
  });

  const expenses = (canServerManageExpenses(actorRole) ? incomingExpenses : []).map((e: any) => {
    const existing = existingExpensesById.get(e.id);
    const existingProofs = existing?.type === 'expense' ? existing?.meta?.proofs : [];
    return {
      ...e,
      proofs: restoreProofs(e.proofs, existingProofs)
    };
  });

  const investors = (canServerManageInvestors(actorRole) ? incomingInvestors : []).map((i: any) => {
    const existing = existingInvestorsById.get(i.id);
    return {
      ...i,
      proofs: restoreProofs(i.proofs, existing?.proofs)
    };
  });

  const maintenanceIssues = (canServerManageMaintenanceIssues(actorRole) ? incomingMaintenanceIssues : []).map((m: any) => {
    const existing = existingExpensesById.get(m.id);
    const existingBefore = existing?.type === 'maintenance' ? existing?.meta?.beforePhotos : [];
    const existingAfter = existing?.type === 'maintenance' ? existing?.meta?.afterPhotos : [];
    return {
      ...m,
      beforePhotos: restoreProofs(m.beforePhotos, existingBefore),
      afterPhotos: restoreProofs(m.afterPhotos, existingAfter)
    };
  });

  const extraRevenueEntries = (canServerManageInvestors(actorRole) ? incomingExtraRevenueEntries : []).map((er: any) => {
    const existing = existingExpensesById.get(er.id);
    const existingProofs = existing?.type === 'revenue' ? existing?.meta?.proofs : [];
    return {
      ...er,
      proofs: restoreProofs(er.proofs, existingProofs)
    };
  });

  const auditLogs = incomingAuditLogs;

  for (const booking of bookings) {
    const bookingValidationError = validateBookingPayload(booking);
    if (bookingValidationError) {
      return res.status(400).json({ error: bookingValidationError });
    }
  }

  for (const investor of investors) {
    const investorValidationError = validateInvestorPayload(investor);
    if (investorValidationError) {
      return res.status(400).json({ error: investorValidationError });
    }
  }

  const payloadConflict = findPayloadBookingConflict(bookings);
  if (payloadConflict) {
    return res.status(400).json({ error: payloadConflict });
  }

  try {
    // Upsert parent tables before children so foreign keys always resolve.
    await upsertTable({
      table: "rooms",
      rows: rooms,
      mapRow: (r) => ({
        id: r.id,
        name: r.name,
        type: normalizeRoomType(r.id, r.type),
        price_per_night: r.pricePerNight,
        status: encodeRoomStorageStatus(r),
        amenities: r.amenities,
        floor: r.floor,
        cover_image_url: r.coverImageUrl || null,
        gallery_image_urls: Array.isArray(r.galleryImageUrls) ? r.galleryImageUrls : [],
        public_description: r.publicDescription || null,
        public_location: r.publicLocation || null,
        public_modal_location: r.publicModalLocation || null,
        public_guests_label: r.publicGuestsLabel || null,
        public_size_label: r.publicSizeLabel || null,
        public_bed_label: r.publicBedLabel || null,
        public_bath_label: r.publicBathLabel || null,
        public_balcony_label: r.publicBalconyLabel || null,
      })
    });

    await upsertTable({
      table: "guests",
      rows: guests,
      mapRow: (g) => ({
        id: g.id,
        first_name: g.firstName,
        last_name: g.lastName,
        email: g.email,
        phone: g.phone,
        cnic: g.cnic,
        notes: encodeGuestNotes(g),
        created_at: g.createdAt
      })
    });

    await upsertTable({
      table: "investors",
      rows: investors,
      mapRow: (i) => ({
        id: i.id,
        investor_name: i.investorName,
        amount: i.amount,
        date: i.date,
        equity_percentage: i.equityPercentage ?? 0,
        notes: encodeInvestorNotes(i)
      })
    });

    await upsertTable({
      table: "bookings",
      rows: bookings,
      mapRow: (b) => ({
        id: b.id,
        room_id: b.roomId,
        unit_id: b.roomId,
        guest_id: b.guestId,
        guest_name: `${b.guestFirstName || ""} ${b.guestLastName || ""}`.trim(),
        guest_first_name: b.guestFirstName,
        guest_last_name: b.guestLastName,
        guest_phone: b.guestPhone,
        guest_email: b.guestEmail,
        guest_cnic: b.guestCnic,
        check_in_date: b.checkInDate,
        check_out_date: b.checkOutDate,
        guests_count: Number(b.guestCount || 1),
        total_price: b.totalPrice,
        status: b.status,
        special_request: b.specialRequest || null,
        admin_note: b.adminNote || null,
        updated_at: new Date().toISOString(),
        notes: encodeBookingNotes(b)
      })
    });

    const expensePayload = expenses.map((expense) => ({
      id: expense.id,
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      date: expense.date,
      room_id: expense.roomId || null,
      status: expense.status,
      description: encodeExpenseDescription(expense),
      paid_from_investor_fund_id: expense.paidFromInvestorFundId || null
    }));

    const maintenanceIssuePayload = maintenanceIssues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      category: "maintenance",
      amount: 0,
      date: issue.reportedDate,
      room_id: issue.roomId,
      status: "pending",
      description: encodeMaintenanceIssueDescription(issue),
      paid_from_investor_fund_id: null
    }));

    const extraRevenuePayload = extraRevenueEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      category: "other",
      amount: entry.amount,
      date: entry.date,
      room_id: null,
      status: "paid",
      description: encodeExtraRevenueDescription(entry),
      paid_from_investor_fund_id: null
    }));

    const auditLogPayload = auditLogs.map((entry) => ({
      id: entry.id,
      title: entry.entityLabel || `${entry.entityType} ${entry.action}`,
      category: "other",
      amount: 0,
      date: String(entry.createdAt || getLocalDateInputValue()).slice(0, 10),
      room_id: null,
      status: "paid",
      description: encodeAuditLogDescription(entry),
      paid_from_investor_fund_id: null
    }));

    if (expensePayload.length > 0 || maintenanceIssuePayload.length > 0 || extraRevenuePayload.length > 0 || auditLogPayload.length > 0) {
      const { error } = await supabase
        .from("expenses")
        .upsert([...expensePayload, ...maintenanceIssuePayload, ...extraRevenuePayload, ...auditLogPayload]);
      if (error) throw error;
    }

    if (isAdmin) {
      // Collect all proof IDs referenced across guests, bookings, expenses, investors, maintenanceIssues, and extraRevenueEntries
      const referencedProofIds = [
        ...guests.flatMap((g: any) => (g.identityProofs || []).map((p: any) => p.id)),
        ...bookings.flatMap((b: any) => (b.proofs || []).map((p: any) => p.id)),
        ...expenses.flatMap((e: any) => (e.proofs || []).map((p: any) => p.id)),
        ...investors.flatMap((i: any) => (i.proofs || []).map((p: any) => p.id)),
        ...maintenanceIssues.flatMap((m: any) => [
          ...(m.beforePhotos || []),
          ...(m.afterPhotos || [])
        ].map((p: any) => p.id)),
        ...extraRevenueEntries.flatMap((er: any) => (er.proofs || []).map((p: any) => p.id)),
      ].filter(Boolean);

      // Remove rows after upserts, starting with dependent tables.
      await deleteMissingRows({
        table: "expenses",
        idsToKeep: [
          ...expenses.map((expense) => expense.id),
          ...maintenanceIssues.map((issue) => issue.id),
          ...extraRevenueEntries.map((entry) => entry.id),
          ...auditLogs.map((entry) => entry.id),
          ...referencedProofIds,
        ]
      });

      await deleteMissingRows({
        table: "bookings",
        idsToKeep: bookings.map((booking) => booking.id)
      });

      await deleteMissingRows({
        table: "guests",
        idsToKeep: guests.map((guest) => guest.id)
      });

      await deleteMissingRows({
        table: "investors",
        idsToKeep: investors.map((investor) => investor.id)
      });

      await deleteMissingRows({
        table: "rooms",
        idsToKeep: rooms.map((room) => room.id)
      });
    }

    return res.json({ success: true, message: "Database synchronized successfully!" });

  } catch (err: any) {
    console.error("Database synchronization failed:", err);
    if (isRlsError(err)) {
      return res.status(503).json({
        code: "DB_WRITE_BLOCKED",
        message: "Supabase RLS is blocking writes. Add SUPABASE_SERVICE_ROLE_KEY or disable RLS for app tables."
      });
    }
    return res.status(500).json({ error: "Supabase connection error." });
  }
});

// Single upsert endpoints to write individual items instantly inside Supabase
app.post("/api/bookings", requireAuth, async (req, res) => {
  if (!supabase) return res.json({ success: true });
  const actorRole = normalizeUserRole((req as typeof req & { session: { role: string } }).session.role);
  if (!canServerManageBookings(actorRole)) {
    return res.status(403).json({ error: "Your role cannot create or edit bookings." });
  }
  const b = req.body;
  const bookingValidationError = validateBookingPayload(b, { enforceTodayRule: true });
  if (bookingValidationError) {
    return res.status(400).json({ error: bookingValidationError });
  }
  try {
    const { data: conflictingRows, error: conflictError } = await supabase
      .from("bookings")
      .select("id, room_id, check_in_date, check_out_date, status")
      .eq("room_id", b.roomId)
      .lt("check_in_date", b.checkOutDate)
      .gt("check_out_date", b.checkInDate);

    if (conflictError) throw conflictError;

    const hasConflict = (conflictingRows || []).some(
      (row: any) =>
        row.id !== b.id &&
        PUBLIC_BLOCKING_BOOKING_STATUSES.has(row.status)
    );

    if (hasConflict) {
      return res.status(400).json({ error: `Unit ${b.roomId} is already booked for the selected dates.` });
    }

    const { error } = await supabase.from("bookings").upsert({
      id: b.id,
      room_id: b.roomId,
      unit_id: b.roomId,
      guest_id: b.guestId,
      guest_name: `${b.guestFirstName || ""} ${b.guestLastName || ""}`.trim(),
      guest_first_name: b.guestFirstName,
      guest_last_name: b.guestLastName,
      guest_phone: b.guestPhone,
      guest_email: b.guestEmail,
      guest_cnic: b.guestCnic,
      check_in_date: b.checkInDate,
      check_out_date: b.checkOutDate,
      guests_count: Number(b.guestCount || 1),
      total_price: b.totalPrice,
      status: b.status,
      special_request: b.specialRequest || null,
      admin_note: b.adminNote || null,
      updated_at: new Date().toISOString(),
      notes: encodeBookingNotes(b)
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/guests", requireAuth, async (req, res) => {
  if (!supabase) return res.json({ success: true });
  const actorRole = normalizeUserRole((req as typeof req & { session: { role: string } }).session.role);
  if (!canServerManageGuests(actorRole)) {
    return res.status(403).json({ error: "Your role cannot manage guest profiles." });
  }
  const g = req.body;
  try {
    const { error } = await supabase.from("guests").upsert({
      id: g.id,
      first_name: g.firstName,
      last_name: g.lastName,
      email: g.email,
      phone: g.phone,
      cnic: g.cnic,
      notes: encodeGuestNotes(g),
      created_at: g.createdAt
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/expenses", requireAuth, async (req, res) => {
  if (!supabase) return res.json({ success: true });
  const actorRole = normalizeUserRole((req as typeof req & { session: { role: string } }).session.role);
  if (!canServerManageExpenses(actorRole)) {
    return res.status(403).json({ error: "Only admin can approve or record expense payments." });
  }
  const e = req.body;
  try {
    const { error } = await supabase.from("expenses").upsert({
      id: e.id,
      title: e.title,
      category: e.category,
      amount: e.amount,
      date: e.date,
      room_id: e.roomId || null,
      status: e.status,
      description: encodeExpenseDescription(e),
      paid_from_investor_fund_id: e.paidFromInvestorFundId || null
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/investors", requireAuth, async (req, res) => {
  if (!supabase) return res.json({ success: true });
  const actorRole = normalizeUserRole((req as typeof req & { session: { role: string } }).session.role);
  if (!canServerManageInvestors(actorRole)) {
    return res.status(403).json({ error: "Only admin can manage investor capital." });
  }
  const i = req.body;
  const investorValidationError = validateInvestorPayload(i);
  if (investorValidationError) {
    return res.status(400).json({ error: investorValidationError });
  }
  try {
    const { error } = await supabase.from("investors").upsert({
      id: i.id,
      investor_name: i.investorName,
      amount: i.amount,
      date: i.date,
      equity_percentage: i.equityPercentage ?? 0,
      notes: encodeInvestorNotes(i)
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/rooms", requireAuth, async (req, res) => {
  if (!supabase) return res.json({ success: true });
  const actorRole = normalizeUserRole((req as typeof req & { session: { role: string } }).session.role);
  if (!canServerManageUnits(actorRole)) {
    return res.status(403).json({ error: "Only admin can add or edit units." });
  }
  const r = req.body;
  try {
    const { error } = await supabase.from("rooms").upsert({
      id: r.id,
      name: r.name,
      type: normalizeRoomType(r.id, r.type),
      price_per_night: r.pricePerNight,
      status: encodeRoomStorageStatus(r),
      amenities: r.amenities,
      floor: r.floor,
      cover_image_url: r.coverImageUrl || null,
      gallery_image_urls: Array.isArray(r.galleryImageUrls) ? r.galleryImageUrls : [],
      public_description: r.publicDescription || null,
      public_location: r.publicLocation || null,
      public_modal_location: r.publicModalLocation || null,
      public_guests_label: r.publicGuestsLabel || null,
      public_size_label: r.publicSizeLabel || null,
      public_bed_label: r.publicBedLabel || null,
      public_bath_label: r.publicBathLabel || null,
      public_balcony_label: r.publicBalconyLabel || null
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/rooms/:id", requireAuth, async (req, res) => {
  if (!supabase) return res.json({ success: true });
  const actorRole = normalizeUserRole((req as typeof req & { session: { role: string } }).session.role);
  if (!canServerManageUnits(actorRole)) {
    return res.status(403).json({ success: false, message: "Only admin can delete units." });
  }

  const roomId = req.params.id;

  try {
    const [{ count: bookingCount, error: bookingError }, { count: expenseCount, error: expenseError }] = await Promise.all([
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("room_id", roomId),
      supabase.from("expenses").select("id", { count: "exact", head: true }).eq("room_id", roomId)
    ]);

    if (bookingError) throw bookingError;
    if (expenseError) throw expenseError;

    if ((bookingCount || 0) > 0 || (expenseCount || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: "This unit cannot be deleted because it has linked bookings, expenses, or maintenance issues."
      });
    }

    const { error } = await supabase.from("rooms").delete().eq("id", roomId);
    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    console.error("Room deletion failed:", err);
    res.status(500).json({ success: false, message: "Failed to delete unit." });
  }
});

export default app;
