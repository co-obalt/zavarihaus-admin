import React, { useMemo, useState } from 'react';
import { Bath, BedDouble, Building2, Clock, Coffee, ConciergeBell, Fan, Lock, Pencil, PlusCircle, Refrigerator, Search, ShieldCheck, Shirt, Sliders, Sofa, Sparkles, Sun, Trash2, Tv, Wifi, Wind, Volume2 } from 'lucide-react';
import { HotelState, HousekeepingStatus, Room, RoomStatus, RoomType, UserRole } from '../types';
import { getHousekeepingStatusLabel, getLocalDateInputValue, getRoomOperationalStatus, getRoomStatusLabel } from '../lib/hotelState';
import { canAdvanceHousekeeping, canEditUnits, canSetManagerReady, canVerifyHousekeeping } from '../lib/access';

interface RoomsViewProps {
  state: HotelState;
  currentUserRole: UserRole;
  onAddRoom: (room: Room) => void;
  onUpdateRoom: (room: Room) => void;
  onUpdateRoomHousekeeping: (roomId: string, housekeepingStatus: HousekeepingStatus) => void;
  onDeleteRoom: (roomId: string) => Promise<boolean>;
}

const AMENITY_OPTIONS = [
  { label: 'Air Conditioning', icon: Wind },
  { label: 'Ceiling Fan', icon: Fan },
  { label: 'Flat-Screen TV', icon: Tv },
  { label: 'Smart TV', icon: Tv },
  { label: 'High-Speed Wi-Fi', icon: Wifi },
  { label: 'USB Charging', icon: ShieldCheck },
  { label: 'Electronic Safe', icon: Lock },
  { label: 'Sound System', icon: Volume2 },
  { label: 'Vanity Mirror', icon: Sparkles },
  { label: 'Bathtubs', icon: Bath },
  { label: 'Shower', icon: Bath },
  { label: 'Seating Area', icon: Sofa },
  { label: 'Alarm Clock', icon: Clock },
  { label: 'Wardrobe', icon: ShieldCheck },
  { label: 'Room Service', icon: Sun },
  { label: 'Comfortable Bedding', icon: BedDouble },
  { label: 'Refrigerator', icon: Refrigerator },
  { label: 'Oven', icon: Sun },
  { label: 'Tea / Coffee Maker', icon: Coffee },
  { label: 'Private Bathroom with Toiletries', icon: Bath },
  { label: 'Daily Housekeeping', icon: ConciergeBell },
  { label: 'Laundry Service on Request', icon: Shirt },
  { label: 'Mini Bar', icon: Sun },
  { label: 'Balcony', icon: Sun },
  { label: 'Blackout Curtains', icon: Sliders },
  { label: 'Workspace Desk', icon: Sliders },
  { label: 'Heating', icon: Sun },
  { label: 'Extra Pillows', icon: Sparkles },
  { label: 'Towels', icon: Bath },
  { label: 'Hair Dryer', icon: Wind },
  { label: 'Iron', icon: Lock },
  { label: 'Tea / Coffee Maker', icon: Sun },
  { label: 'Lounge Chair', icon: Sofa },
];

const AMENITY_ALIASES: Record<string, string> = {
  'ac': 'Air Conditioning',
  'air conditioning': 'Air Conditioning',
  'ceiling fan': 'Ceiling Fan',
  'fan': 'Ceiling Fan',
  'flat screen tv': 'Flat-Screen TV',
  'tv': 'Flat-Screen TV',
  'smart tv': 'Smart TV',
  'wi fi': 'High-Speed Wi-Fi',
  'wifi': 'High-Speed Wi-Fi',
  'high speed wi fi': 'High-Speed Wi-Fi',
  'room service': 'Room Service',
  'comfortable bedding': 'Comfortable Bedding',
  'bedding': 'Comfortable Bedding',
  'refrigerator': 'Refrigerator',
  'fridge': 'Refrigerator',
  'oven': 'Oven',
  'tea facilities': 'Tea / Coffee Maker',
  'tea coffee maker': 'Tea / Coffee Maker',
  'private bathroom with toiletries': 'Private Bathroom with Toiletries',
  'bathroom toiletries': 'Private Bathroom with Toiletries',
  'daily housekeeping': 'Daily Housekeeping',
  'laundry service on request': 'Laundry Service on Request',
  'desk or workspace': 'Workspace Desk',
  'workspace': 'Workspace Desk',
  'workspace desk': 'Workspace Desk',
  'seating area': 'Seating Area',
  'balcony': 'Balcony',
};

const BED_OPTIONS = ['Single Bed', 'Queen Bed', 'King Bed', '2 King Beds', '3 King Beds'];
const BATH_OPTIONS = [1, 2, 3];
const ROOM_SIZE_OPTIONS = [28, 32, 38, 45, 48, 52, 60, 75, 90, 120, 180, 240, 310];
const ROOM_TYPE_OPTIONS: RoomType[] = ['Skyview Suite', 'Sunset Room', 'Family Haven'];
const BALCONY_OPTIONS = ['Large Balcony', 'Small Balcony', 'No Balcony'];

const parseCountLabel = (value: string, fallback: number) => {
  const parsed = Number(String(value).match(/\d+/)?.[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeAmenityKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const canonicalizeAmenity = (value: string) => {
  const trimmed = value.trim();
  const key = normalizeAmenityKey(trimmed);
  return AMENITY_ALIASES[key] || AMENITY_OPTIONS.find((option) => normalizeAmenityKey(option.label) === key)?.label || trimmed;
};

const normalizeRoomType = (roomId: string, type: string): RoomType => {
  if (ROOM_TYPE_OPTIONS.includes(type as RoomType)) {
    return type as RoomType;
  }

  const typeKey = normalizeAmenityKey(type || '');
  if (typeKey.includes('large balcony') || typeKey.includes('skyview')) {
    return 'Skyview Suite';
  }

  if (typeKey.includes('small balcony') || typeKey.includes('sunset') || typeKey.includes('premium suite')) {
    return 'Sunset Room';
  }

  if (typeKey.includes('family') || typeKey.includes('no balcony') || typeKey.includes('luxury villa')) {
    return 'Family Haven';
  }

  const idNumber = Number(String(roomId).match(/\d+/)?.[0] || Number.NaN);
  if (!Number.isFinite(idNumber)) {
    return 'Skyview Suite';
  }

  if (String(roomId).startsWith('5')) {
    return 'Family Haven';
  }

  if (String(roomId).startsWith('3')) {
    return 'Sunset Room';
  }

  return 'Skyview Suite';
};
const HOUSEKEEPING_NEXT_STEP: Partial<Record<HousekeepingStatus, { label: string; next: HousekeepingStatus }>> = {
  dirty: { label: 'Start Cleaning', next: 'cleaning-started' },
  'cleaning-started': { label: 'Mark Cleaned', next: 'cleaned' },
  cleaned: { label: 'Mark Inspected', next: 'inspected' },
  inspected: { label: 'Manager Set Ready', next: 'ready' },
};

export default function RoomsView({
  state,
  currentUserRole,
  onAddRoom,
  onUpdateRoom,
  onUpdateRoomHousekeeping,
  onDeleteRoom,
}: RoomsViewProps) {
  const { rooms, bookings, expenses, maintenanceIssues } = state;
  const todayStr = getLocalDateInputValue();
  const canEditUnitsForRole = canEditUnits(currentUserRole);
  const canAdvanceForRole = canAdvanceHousekeeping(currentUserRole);

  const [showForm, setShowForm] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('Skyview Suite');
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('active');
  const [housekeepingStatus, setHousekeepingStatus] = useState<HousekeepingStatus>('ready');
  const [pricePerNight, setPricePerNight] = useState<number>(0);
  const [floor, setFloor] = useState<number>(1);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [showOtherAmenities, setShowOtherAmenities] = useState(false);
  const [otherAmenitiesText, setOtherAmenitiesText] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [galleryImageUrlsInput, setGalleryImageUrlsInput] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [publicLocation, setPublicLocation] = useState('');
  const [publicModalLocation, setPublicModalLocation] = useState('');
  const [publicGuestCount, setPublicGuestCount] = useState(2);
  const [publicSizeSqm, setPublicSizeSqm] = useState(48);
  const [publicBedLabel, setPublicBedLabel] = useState('King Bed');
  const [publicBathCount, setPublicBathCount] = useState(1);
  const [publicBalconyLabel, setPublicBalconyLabel] = useState('Large Balcony');

  const housekeepingCounts = useMemo(
    () =>
      rooms.reduce<Record<HousekeepingStatus, number>>(
        (acc, room) => {
          acc[room.housekeepingStatus] += 1;
          return acc;
        },
        {
          dirty: 0,
          'cleaning-started': 0,
          cleaned: 0,
          inspected: 0,
          ready: 0,
        }
      ),
    [rooms]
  );

  const resetForm = () => {
    setEditingRoomId(null);
    setRoomId('');
    setRoomName('');
    setRoomType('Skyview Suite');
    setRoomStatus('active');
    setHousekeepingStatus('ready');
    setPricePerNight(0);
    setFloor(1);
    setSelectedAmenities([]);
    setShowOtherAmenities(false);
    setOtherAmenitiesText('');
    setCoverImageUrl('');
    setGalleryImageUrlsInput('');
    setPublicDescription('');
    setPublicLocation('');
    setPublicModalLocation('');
    setPublicGuestCount(2);
    setPublicSizeSqm(48);
    setPublicBedLabel('King Bed');
    setPublicBathCount(1);
    setPublicBalconyLabel('Large Balcony');
    setShowForm(false);
  };

  const handleEditClick = (room: Room) => {
    setEditingRoomId(room.id);
    setRoomId(room.id);
    setRoomName(room.name);
    setRoomType(normalizeRoomType(room.id, room.type));
    setRoomStatus(room.status);
    setHousekeepingStatus(room.housekeepingStatus);
    setPricePerNight(room.pricePerNight);
    setFloor(room.floor);
    const canonicalAmenities = room.amenities.map(canonicalizeAmenity);
    const knownAmenities = Array.from(new Set(canonicalAmenities.filter((amenity) => AMENITY_OPTIONS.some((option) => option.label === amenity))));
    const customAmenities = canonicalAmenities.filter((amenity) => !AMENITY_OPTIONS.some((option) => option.label === amenity));
    setSelectedAmenities(knownAmenities);
    setShowOtherAmenities(customAmenities.length > 0);
    setOtherAmenitiesText(customAmenities.join(', '));
    setCoverImageUrl(room.coverImageUrl || '');
    setGalleryImageUrlsInput((room.galleryImageUrls || []).join(', '));
    setPublicDescription(room.publicDescription || '');
    setPublicLocation(room.publicLocation || '');
    setPublicModalLocation(room.publicModalLocation || '');
    setPublicGuestCount(parseCountLabel(room.publicGuestsLabel || '', 2));
    setPublicSizeSqm(parseCountLabel(room.publicSizeLabel || '', 48));
    setPublicBedLabel(room.publicBedLabel || 'King Bed');
    setPublicBathCount(parseCountLabel(room.publicBathLabel || '', 1));
    setPublicBalconyLabel(room.publicBalconyLabel || 'Large Balcony');
    setShowForm(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!roomId || !roomName || pricePerNight <= 0) {
      alert('Please enter unit ID, unit name, and price.');
      return;
    }

    if (!editingRoomId && rooms.some((room) => room.id.toLowerCase() === roomId.toLowerCase())) {
      alert(`Unit ${roomId} already exists.`);
      return;
    }

    const otherAmenities = showOtherAmenities
      ? otherAmenitiesText.split(',').map(canonicalizeAmenity).filter(Boolean)
      : [];
    const amenities = Array.from(new Set([...selectedAmenities, ...otherAmenities].filter(Boolean)));

    const nextRoom: Room = {
      id: editingRoomId || roomId,
      name: roomName,
      type: roomType,
      pricePerNight,
      floor,
      amenities,
      status: roomStatus,
      housekeepingStatus,
      coverImageUrl: coverImageUrl.trim() || undefined,
      galleryImageUrls: galleryImageUrlsInput
        ? galleryImageUrlsInput.split(',').map((item) => item.trim()).filter(Boolean)
        : [],
      publicDescription: publicDescription.trim() || undefined,
      publicLocation: publicLocation.trim() || undefined,
      publicModalLocation: publicModalLocation.trim() || undefined,
      publicGuestsLabel: `${publicGuestCount} Guests`,
      publicSizeLabel: `${publicSizeSqm} m`,
      publicBedLabel: publicBedLabel.trim() || undefined,
      publicBathLabel: `${publicBathCount} Bath${publicBathCount > 1 ? 's' : ''}`,
      publicBalconyLabel,
    };

    if (editingRoomId) {
      onUpdateRoom(nextRoom);
    } else {
      onAddRoom(nextRoom);
    }

    resetForm();
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        room.id.toLowerCase().includes(query) ||
        room.name.toLowerCase().includes(query) ||
        room.amenities.some((amenity) => amenity.toLowerCase().includes(query));

      const matchesCategory = categoryFilter === 'all' || room.type === categoryFilter;
      const operationalStatus = getRoomOperationalStatus(room, bookings, todayStr);
      const matchesStatus = statusFilter === 'all' || operationalStatus === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [rooms, bookings, todayStr, searchQuery, categoryFilter, statusFilter]);

  return (
    <div className="space-y-6" id="rooms-directory-view">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Units</h2>
          <p className="mt-1 text-sm text-slate-500">Track unit access, housekeeping progress, and guest readiness separately.</p>
        </div>

        {canEditUnitsForRole && (
          <button
            onClick={() => {
              if (showForm && !editingRoomId) {
                resetForm();
                return;
              }

              setShowForm(true);
              setEditingRoomId(null);
              setRoomId('');
              setRoomName('');
              setRoomType('Skyview Suite');
              setRoomStatus('active');
              setHousekeepingStatus('ready');
              setPricePerNight(0);
              setFloor(1);
              setSelectedAmenities([]);
              setShowOtherAmenities(false);
              setOtherAmenitiesText('');
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <PlusCircle className="h-4 w-4" />
            <span>{showForm && !editingRoomId ? 'Close' : 'Add Unit'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {(['dirty', 'cleaning-started', 'cleaned', 'inspected', 'ready'] as HousekeepingStatus[]).map((status) => (
          <div key={status} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{getHousekeepingStatusLabel(status)}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{housekeepingCounts[status]}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed left-1/2 top-6 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" id="add-room-form-card">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-slate-900">{editingRoomId ? 'Edit Unit' : 'Add Unit'}</h3>
            <p className="mt-1 text-sm text-slate-500">Maintenance normally comes from a reported issue. Housekeeping moves step-by-step until a manager marks the unit ready.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="mb-1 block text-sm text-slate-600">Unit ID</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                  disabled={Boolean(editingRoomId)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100"
                  placeholder="101"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-slate-600">Unit Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="Unit 201"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Type</label>
                <select
                  value={roomType}
                  onChange={(event) => setRoomType(event.target.value as RoomType)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                >
                  {ROOM_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-600">Access Control</label>
                <select
                  value={roomStatus}
                  onChange={(event) => setRoomStatus(event.target.value as RoomStatus)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                >
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-600">Housekeeping</label>
                <select
                  value={housekeepingStatus}
                  onChange={(event) => setHousekeepingStatus(event.target.value as HousekeepingStatus)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                >
                  <option value="dirty">Dirty</option>
                  <option value="cleaning-started">Cleaning Started</option>
                  <option value="cleaned">Cleaned</option>
                  <option value="inspected">Inspected</option>
                  <option value="ready">Ready</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-600">Floor</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={floor}
                  onChange={(event) => setFloor(parseInt(event.target.value, 10) || 1)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-600">Price Per Night</label>
              <input
                type="number"
                min="1000"
                step="500"
                value={pricePerNight || ''}
                onChange={(event) => setPricePerNight(parseInt(event.target.value, 10) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                placeholder="15000"
                required
              />
            </div>

              <div className="sm:col-span-4">
                <label className="mb-2 block text-sm text-slate-600">Amenities</label>
                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {AMENITY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const checked = selectedAmenities.includes(option.label);
                    return (
                      <label key={option.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setSelectedAmenities((prev) =>
                              event.target.checked
                                ? [...prev, option.label]
                                : prev.filter((item) => item !== option.label)
                            );
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <Icon className="h-4 w-4 text-slate-500" />
                        <span className="flex-1">{option.label}</span>
                      </label>
                    );
                  })}

                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={showOtherAmenities}
                      onChange={(event) => setShowOtherAmenities(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    />
                    <Sliders className="h-4 w-4 text-slate-500" />
                    <span className="flex-1">Other</span>
                  </label>
                </div>

                {showOtherAmenities && (
                  <textarea
                    value={otherAmenitiesText}
                    onChange={(event) => setOtherAmenitiesText(event.target.value)}
                    className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    placeholder="Other amenities, comma separated"
                    rows={3}
                  />
                )}
              </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Public Cover Image URL</label>
                <input
                  type="url"
                  value={coverImageUrl}
                  onChange={(event) => setCoverImageUrl(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-600">Public Gallery Image URLs</label>
                <textarea
                  value={galleryImageUrlsInput}
                  onChange={(event) => setGalleryImageUrlsInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="https://img1..., https://img2..., https://img3..."
                  rows={3}
                />
                <p className="mt-1 text-xs text-slate-500">Comma-separated URLs used by the website gallery.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-600">Public Description</label>
                <textarea
                  value={publicDescription}
                  onChange={(event) => setPublicDescription(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="Room description shown on the website"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Public Location</label>
                  <input
                    type="text"
                    value={publicLocation}
                    onChange={(event) => setPublicLocation(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    placeholder="Bahria Town, Lahore"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Public Modal Location</label>
                  <input
                    type="text"
                    value={publicModalLocation}
                    onChange={(event) => setPublicModalLocation(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    placeholder="Exact public-facing location text"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Guests</label>
                  <select
                    value={publicGuestCount}
                    onChange={(event) => setPublicGuestCount(parseInt(event.target.value, 10) || 2)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                      <option key={count} value={count}>{count} Guests</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Size</label>
                  <input
                    type="number"
                    value={publicSizeSqm}
                    onChange={(event) => setPublicSizeSqm(parseInt(event.target.value, 10) || 48)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    placeholder="48 m"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Public Bed Label</label>
                  <input
                    type="text"
                    value={publicBedLabel}
                    onChange={(event) => setPublicBedLabel(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    placeholder="King Bed"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Baths</label>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    value={publicBathCount}
                    onChange={(event) => setPublicBathCount(parseInt(event.target.value, 10) || 1)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    placeholder="1 Bath"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Balcony</label>
                  <select
                    value={publicBalconyLabel}
                    onChange={(event) => setPublicBalconyLabel(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  >
                    {BALCONY_OPTIONS.map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {editingRoomId ? 'Save Changes' : 'Add Unit'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row" id="room-filters">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search units"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-700"
            >
              <option value="all">All Types</option>
              {ROOM_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-700"
            >
              <option value="all">All Operational Status</option>
              <option value="ready">Ready</option>
              <option value="occupied">Occupied</option>
              <option value="hold">Hold</option>
              <option value="dirty">Dirty</option>
              <option value="maintenance">Maintenance</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" id="rooms-grid">
          {filteredRooms.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500">
              <Building2 className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm">No units found.</p>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const roomBookingCount = bookings.filter((booking) => booking.roomId === room.id).length;
              const roomExpenseCount = expenses.filter((expense) => expense.roomId === room.id).length;
              const roomIssueCount = maintenanceIssues.filter((issue) => issue.roomId === room.id).length;
              const canDelete = roomBookingCount === 0 && roomExpenseCount === 0 && roomIssueCount === 0;
              const operationalStatus = getRoomOperationalStatus(room, bookings, todayStr);
              const operationalStatusLabel = getRoomStatusLabel(operationalStatus);
              const nextHousekeepingAction = room.status === 'active' && operationalStatus !== 'occupied' && operationalStatus !== 'hold'
                ? HOUSEKEEPING_NEXT_STEP[room.housekeepingStatus]
                : undefined;
              const needsVerification = nextHousekeepingAction?.next === 'inspected' || nextHousekeepingAction?.next === 'ready';
              const canRunNextAction = Boolean(
                nextHousekeepingAction &&
                  (needsVerification
                    ? canVerifyHousekeeping(currentUserRole) && (nextHousekeepingAction.next !== 'ready' || canSetManagerReady(currentUserRole))
                    : canAdvanceForRole)
              );

              return (
                <div key={room.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{room.type}</p>
                      <h4 className="mt-1 text-base font-semibold text-slate-900">{room.name}</h4>
                      <p className="mt-1 text-sm text-slate-500">Unit {room.id} | Floor {room.floor}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        operationalStatus === 'ready'
                          ? 'bg-emerald-50 text-emerald-700'
                          : operationalStatus === 'occupied'
                          ? 'bg-indigo-50 text-indigo-700'
                          : operationalStatus === 'hold'
                          ? 'bg-sky-50 text-sky-700'
                          : operationalStatus === 'dirty'
                          ? 'bg-rose-50 text-rose-700'
                          : operationalStatus === 'blocked'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {operationalStatusLabel}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Housekeeping</span>
                      <span className="font-medium text-slate-900">{getHousekeepingStatusLabel(room.housekeepingStatus)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Access Control</span>
                      <span className="font-medium text-slate-900">{getRoomStatusLabel(room.status)}</span>
                    </div>
                    {nextHousekeepingAction && canRunNextAction ? (
                      <button
                        onClick={() => onUpdateRoomHousekeeping(room.id, nextHousekeepingAction.next)}
                        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        {nextHousekeepingAction.label}
                      </button>
                    ) : nextHousekeepingAction && room.housekeepingStatus === 'cleaned' ? (
                      <p className="text-xs text-slate-600">Waiting for manager inspection before this unit can move forward.</p>
                    ) : nextHousekeepingAction && room.housekeepingStatus === 'inspected' ? (
                      <p className="text-xs text-slate-600">Manager approval is required before this unit becomes ready.</p>
                    ) : room.status === 'maintenance' ? (
                      <p className="text-xs text-amber-700">Maintenance issue is controlling access for this unit.</p>
                    ) : room.status === 'blocked' ? (
                      <p className="text-xs text-slate-600">Unit is manually blocked.</p>
                    ) : operationalStatus === 'occupied' || operationalStatus === 'hold' ? (
                      <p className="text-xs text-slate-600">Housekeeping actions resume after the active stay ends.</p>
                    ) : (
                      <p className="text-xs text-emerald-700">Manager verification complete. Unit is guest-ready.</p>
                    )}
                  </div>

                  <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-xs text-slate-400">Price per night</p>
                      <p className="text-base font-semibold text-slate-900">Rs. {room.pricePerNight.toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-slate-400">{maintenanceIssues.filter((issue) => issue.roomId === room.id && issue.status !== 'closed').length} active issue(s)</p>
                  </div>

                  {canEditUnitsForRole && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleEditClick(room)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <Pencil className="h-4 w-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => void onDeleteRoom(room.id)}
                        disabled={!canDelete}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 py-2.5 text-sm text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
                        title={canDelete ? 'Delete unit' : 'Remove linked bookings, expenses, or issues first'}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
