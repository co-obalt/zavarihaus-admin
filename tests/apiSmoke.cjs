const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@zavarihaus.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin1234';

const today = new Date();
const toDate = (offsetDays = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const request = async (path, init = {}) => {
  const res = await fetch(`${API_BASE}${path}`, init);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
};

const ensureOk = (name, response) => {
  if (!response.res.ok) {
    throw new Error(`${name} failed (${response.res.status}): ${typeof response.body === 'string' ? response.body : JSON.stringify(response.body)}`);
  }
};

const run = async () => {
  const status = await request('/api/auth/status');
  ensureOk('auth status', status);
  if (!status.body?.isSupabaseConfigured) {
    throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running api smoke.');
  }

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  ensureOk('login', login);
  if (!login.body?.token) {
    throw new Error('No token returned from login.');
  }
  const token = login.body.token;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const stamp = Date.now();
  const roomId = `TST-R-${stamp}`;
  const guestId = `TST-G-${stamp}`;
  const bookingId = `TST-B-${stamp}`;
  const investorId = `TST-INV-${stamp}`;
  const expenseId = `TST-E-${stamp}`;
  const fakeProof = {
    id: `PF-${stamp}`,
    category: 'test-proof',
    name: 'test.png',
    mimeType: 'image/png',
    size: 120,
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    uploadedAt: toDate(),
  };

  const roomPayload = {
    id: roomId,
    name: 'API Smoke Room',
    type: 'Skyview Suite',
    pricePerNight: 5000,
    status: 'active',
    housekeepingStatus: 'ready',
    amenities: ['WiFi'],
    floor: 1,
  };
  const roomCreate = await request('/api/rooms', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(roomPayload),
  });
  ensureOk('create room', roomCreate);

  const guestPayload = {
    id: guestId,
    firstName: 'API',
    lastName: 'Guest',
    email: 'api.guest@example.com',
    phone: '03001234567',
    cnic: '12345-1234567-1',
    notes: 'Smoke guest',
    createdAt: toDate(),
    documentType: 'cnic',
    documentNumber: '12345-1234567-1',
    identityProofs: [fakeProof],
  };
  const guestCreate = await request('/api/guests', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(guestPayload),
  });
  ensureOk('create guest', guestCreate);

  const bookingPayload = {
    id: bookingId,
    roomId,
    guestId,
    guestFirstName: 'API',
    guestLastName: 'Guest',
    guestPhone: '03001234567',
    guestEmail: 'api.guest@example.com',
    guestCnic: '12345-1234567-1',
    checkInDate: toDate(1),
    checkOutDate: toDate(2),
    totalPrice: 5000,
    status: 'confirmed',
    bookingSource: 'direct',
    advanceReceived: 5000,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    guestCount: 1,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    proofs: [fakeProof],
  };
  const bookingCreate = await request('/api/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(bookingPayload),
  });
  ensureOk('create booking', bookingCreate);

  const investorPayload = {
    id: investorId,
    investorName: 'Smoke Investor',
    amount: 100000,
    date: toDate(),
    equityPercentage: 20,
    notes: 'Smoke investor',
    proofs: [fakeProof],
  };
  const investorCreate = await request('/api/investors', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(investorPayload),
  });
  ensureOk('create investor', investorCreate);

  const expensePayload = {
    id: expenseId,
    title: 'Smoke expense',
    category: 'maintenance',
    amount: 1000,
    date: toDate(),
    roomId,
    status: 'pending',
    description: 'Smoke expense entry',
    paidFromInvestorFundId: investorId,
    proofs: [fakeProof],
  };
  const expenseCreate = await request('/api/expenses', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(expensePayload),
  });
  ensureOk('create expense', expenseCreate);

  const stateRes = await request('/api/state', {
    headers: { Authorization: `Bearer ${token}` },
  });
  ensureOk('fetch state', stateRes);
  const state = stateRes.body || {};

  const hasRoom = Array.isArray(state.rooms) && state.rooms.some((item) => item.id === roomId);
  const hasBooking = Array.isArray(state.bookings) && state.bookings.some((item) => item.id === bookingId);
  const hasGuest = Array.isArray(state.guests) && state.guests.some((item) => item.id === guestId);
  const hasInvestor = Array.isArray(state.investors) && state.investors.some((item) => item.id === investorId);
  const hasExpense = Array.isArray(state.expenses) && state.expenses.some((item) => item.id === expenseId);

  if (!hasRoom || !hasGuest || !hasBooking || !hasInvestor || !hasExpense) {
    throw new Error('State verification failed for smoke entities.');
  }

  console.log('API smoke test passed.');
  console.log(JSON.stringify({ roomId, guestId, bookingId, investorId, expenseId }, null, 2));
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
