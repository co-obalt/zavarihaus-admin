const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const compileTsModule = (relativePath) => {
  const absolutePath = path.resolve(__dirname, '..', relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: absolutePath,
  }).outputText;

  const compiledModule = new Module.Module(absolutePath, module);
  compiledModule.filename = absolutePath;
  compiledModule.paths = Module.Module._nodeModulePaths(path.dirname(absolutePath));
  compiledModule._compile(transpiled, absolutePath);
  return compiledModule.exports;
};

const {
  createEntityId,
  getRoomOperationalStatus,
  getLocalDateInputValue,
  isBookingActiveOnDate,
  normalizeHotelState,
  validateBookingDates,
} = compileTsModule('src/lib/hotelState.ts');

const run = (name, fn) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
};

const makeRoom = (id, status = 'active') => ({
  id,
  name: `Room ${id}`,
  type: 'Skyview Suite',
  pricePerNight: 10000,
  status,
  housekeepingStatus: status === 'dirty' ? 'dirty' : 'ready',
  amenities: ['WiFi'],
  floor: 1,
});

const makeBooking = (overrides = {}) => ({
  id: overrides.id || 'B-1',
  roomId: overrides.roomId || '101',
  guestId: overrides.guestId || 'G-1',
  guestFirstName: overrides.guestFirstName || 'Ali',
  guestLastName: overrides.guestLastName || 'Khan',
  guestPhone: overrides.guestPhone || '03001234567',
  guestEmail: overrides.guestEmail,
  guestCnic: overrides.guestCnic || '35201-1234567-1',
  checkInDate: overrides.checkInDate || '2026-05-30',
  checkOutDate: overrides.checkOutDate || '2026-05-31',
  totalPrice: overrides.totalPrice || 10000,
  status: overrides.status || 'confirmed',
  bookingSource: overrides.bookingSource || 'direct',
  advanceReceived: overrides.advanceReceived ?? 0,
  paymentMethod: overrides.paymentMethod || 'cash',
  paymentStatus: overrides.paymentStatus || 'unpaid',
  guestCount: overrides.guestCount || 1,
  checkInTime: overrides.checkInTime || '14:00',
  checkOutTime: overrides.checkOutTime || '12:00',
  externalReference: overrides.externalReference || '',
  specialRequest: overrides.specialRequest || '',
  notes: overrides.notes,
  documentType: overrides.documentType,
  documentNumber: overrides.documentNumber,
});

run('getLocalDateInputValue formats YYYY-MM-DD using local date parts', () => {
  const date = new Date(2026, 4, 30, 23, 45, 10);
  assert.equal(getLocalDateInputValue(date), '2026-05-30');
});

run('createEntityId produces stable ids when a suffix is provided', () => {
  const date = new Date(2026, 4, 30, 10, 5, 6, 7);
  assert.equal(createEntityId('INV', date, 'ab12'), 'INV-20260530100506007-AB12');
});

run('validateBookingDates blocks past dates and invalid ranges', () => {
  assert.equal(
    validateBookingDates('2026-05-29', '2026-05-31', '2026-05-30'),
    'Check-in date cannot be earlier than 2026-05-30.'
  );
  assert.equal(
    validateBookingDates('2026-05-30', '2026-05-30', '2026-05-30'),
    'Check-out date must be after the check-in date.'
  );
  assert.equal(validateBookingDates('2026-05-30', '2026-05-31', '2026-05-30'), null);
});

run('isBookingActiveOnDate only marks dates inside the stay window', () => {
  const booking = makeBooking({
    checkInDate: '2026-05-30',
    checkOutDate: '2026-06-02',
    status: 'confirmed',
  });

  assert.equal(isBookingActiveOnDate(booking, '2026-05-29'), false);
  assert.equal(isBookingActiveOnDate(booking, '2026-05-30'), true);
  assert.equal(isBookingActiveOnDate(booking, '2026-06-01'), true);
  assert.equal(isBookingActiveOnDate(booking, '2026-06-02'), false);
});

run('normalizeHotelState auto-checks out stale stays and derives room statuses from bookings', () => {
  const state = {
    rooms: [
      makeRoom('101', 'active'),
      { ...makeRoom('102', 'maintenance'), housekeepingStatus: 'ready' },
      makeRoom('103', 'active'),
    ],
    guests: [],
    bookings: [
      makeBooking({
        id: 'B-LIVE',
        roomId: '101',
        checkInDate: '2026-05-30',
        checkOutDate: '2026-06-02',
        status: 'confirmed',
      }),
      makeBooking({
        id: 'B-OLD',
        roomId: '103',
        checkInDate: '2026-05-27',
        checkOutDate: '2026-05-30',
        status: 'checked-in',
      }),
    ],
    expenses: [],
    investors: [],
    maintenanceIssues: [
      {
        id: 'MI-102',
        title: 'AC issue reported',
        roomId: '102',
        priority: 'urgent',
        status: 'in-progress',
        reportedDate: '2026-05-30',
        assignedTo: 'Technician',
        notes: 'Cooling not working',
      },
    ],
  };

  const normalized = normalizeHotelState(state, '2026-05-30');
  const room101 = normalized.rooms.find((room) => room.id === '101');
  const room102 = normalized.rooms.find((room) => room.id === '102');
  const room103 = normalized.rooms.find((room) => room.id === '103');

  assert.equal(room101?.status, 'active');
  assert.equal(room101?.housekeepingStatus, 'ready');
  assert.equal(getRoomOperationalStatus(room101, normalized.bookings, '2026-05-30'), 'hold');
  assert.equal(room102?.status, 'maintenance');
  assert.equal(room103?.status, 'active');
  assert.equal(room103?.housekeepingStatus, 'dirty');
  assert.equal(getRoomOperationalStatus(room103, normalized.bookings, '2026-05-30'), 'dirty');
  assert.equal(normalized.bookings.find((booking) => booking.id === 'B-OLD')?.status, 'checked-out');
  assert.match(
    normalized.bookings.find((booking) => booking.id === 'B-OLD')?.notes || '',
    /Auto checked out on schedule/
  );
});

console.log('All hotel state checks passed.');
