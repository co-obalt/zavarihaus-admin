import React, { useMemo, useState } from 'react';
import { Calendar, FileText, Mail, Phone, PlusCircle, Search, ShieldCheck, Star, Users } from 'lucide-react';
import { Guest, HotelState, ProofAttachment, UserRole } from '../types';
import { getLocalDateInputValue } from '../lib/hotelState';
import {
  canManageGuestProfiles,
  canViewGuestContact,
  canViewSensitiveGuestIdentity,
  maskIdentityValue,
  maskPhoneValue,
} from '../lib/access';
import ProofUploadField from './ProofUploadField';

interface GuestsViewProps {
  state: HotelState;
  currentUserRole: UserRole;
  onAddGuest: (guest: Omit<Guest, 'id'>) => string;
}

export default function GuestsView({ state, currentUserRole, onAddGuest }: GuestsViewProps) {
  const { guests, bookings } = state;
  const canManageProfiles = canManageGuestProfiles(currentUserRole);
  const canViewContact = canViewGuestContact(currentUserRole);
  const canViewIdentity = canViewSensitiveGuestIdentity(currentUserRole);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [docType, setDocType] = useState<'cnic' | 'passport'>('cnic');
  const [cnic, setCnic] = useState('');
  const [notes, setNotes] = useState('');
  const [preferences, setPreferences] = useState('');
  const [profileStatus, setProfileStatus] = useState<Guest['profileStatus']>('standard');
  const [identityProofs, setIdentityProofs] = useState<ProofAttachment[]>([]);

  const filteredGuests = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return guests.filter((guest) => {
      if (!query) {
        return true;
      }

      return (
        `${guest.firstName} ${guest.lastName}`.toLowerCase().includes(query) ||
        guest.firstName.toLowerCase().includes(query) ||
        guest.lastName.toLowerCase().includes(query) ||
        (guest.email || '').toLowerCase().includes(query) ||
        guest.phone.includes(searchQuery) ||
        (guest.cnic || '').includes(searchQuery)
      );
    });
  }, [guests, searchQuery]);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setDocType('cnic');
    setCnic('');
    setNotes('');
    setPreferences('');
    setProfileStatus('standard');
    setIdentityProofs([]);
    setShowAddForm(false);
  };

  const handleDocTypeChange = (newType: 'cnic' | 'passport') => {
    setDocType(newType);
    setCnic('');
  };

  const handleDocNumberChange = (value: string) => {
    if (docType === 'cnic') {
      const digits = value.replace(/\D/g, '').slice(0, 13);
      let formatted = '';
      if (digits.length > 0) {
        formatted += digits.slice(0, 5);
      }
      if (digits.length > 5) {
        formatted += `-${digits.slice(5, 12)}`;
      }
      if (digits.length > 12) {
        formatted += `-${digits.slice(12, 13)}`;
      }
      setCnic(formatted);
      return;
    }

    setCnic(value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase());
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!firstName || !lastName || !phone || !cnic) {
      alert('First name, last name, phone, and identity document are required.');
      return;
    }

    if (docType === 'cnic') {
      const cleanDigits = cnic.replace(/\D/g, '');
      if (cleanDigits.length !== 13) {
        alert(`Pakistani CNIC must contain exactly 13 digits. You entered ${cleanDigits.length} digits: [${cnic}]. Please enter a complete 13-digit CNIC.`);
        return;
      }
    } else if (!/^[A-Z0-9]{6,12}$/.test(cnic.trim())) {
      alert('Passport ID must contain 6 to 12 alphanumeric characters. Please enter a valid passport number.');
      return;
    }

    onAddGuest({
      firstName,
      lastName,
      email: email || undefined,
      phone,
      cnic,
      documentType: docType,
      documentNumber: cnic,
      notes: notes || undefined,
      preferences: preferences || undefined,
      profileStatus,
      createdAt: getLocalDateInputValue(),
      identityProofs,
    });

    resetForm();
    alert('Guest profile saved successfully.');
  };

  return (
    <div className="space-y-6 animate-fade-in" id="guests-feature-view">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Guest Directory</h2>
          <p className="mt-1 text-xs text-slate-400">
            Guest profiles, preferences, VIP/blacklist status, and identity proof tracking. Sensitive ID values stay masked for non-manager roles.
          </p>
        </div>

        {canManageProfiles && (
          <button
            onClick={() => setShowAddForm((current) => !current)}
            className="flex items-center gap-2 self-start rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-700 md:self-auto"
          >
            <PlusCircle className="h-4 w-4" />
            <span>{showAddForm ? 'View Guest Directory' : 'Add Guest Profile'}</span>
          </button>
        )}
      </div>

      {showAddForm && canManageProfiles ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-100 bg-white p-6 shadow-sm" id="add-guest-form-card">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-800">New Guest Profile</h3>
            <p className="mt-1 text-xs text-slate-400">Store guest basics and attach CNIC/passport proof for check-in records.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-indigo-500"
                  placeholder="Bilal"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Last Name *</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-indigo-500"
                  placeholder="Ahmed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Phone *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-indigo-500"
                  placeholder="0300-1234567"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-indigo-500"
                  placeholder="guest@email.com"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Identity Document *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDocTypeChange('cnic')}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    docType === 'cnic'
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Pakistani CNIC
                </button>
                <button
                  type="button"
                  onClick={() => handleDocTypeChange('passport')}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    docType === 'passport'
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Passport
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">
                  {docType === 'cnic' ? 'National CNIC Number *' : 'Passport Identification Code *'}
                </label>
                <input
                  type="text"
                  required
                  value={cnic}
                  onChange={(event) => handleDocNumberChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-sm font-bold outline-none focus:border-indigo-500"
                  placeholder={docType === 'cnic' ? '35201-1234567-1' : 'AB1234567'}
                />
              </div>
            </div>

            <ProofUploadField
              label="Guest CNIC / Passport Proof"
              category="guest-identity-proof"
              value={identityProofs}
              onChange={setIdentityProofs}
              helperText="Attach guest CNIC/passport image or scan. Multiple files are allowed."
            />

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Preferences</label>
              <textarea
                value={preferences}
                onChange={(event) => setPreferences(event.target.value)}
                className="h-20 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-indigo-500"
                placeholder="Quiet unit, high floor, extra pillows, no smoking..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Profile Status</label>
                <select
                  value={profileStatus}
                  onChange={(event) => setProfileStatus(event.target.value as Guest['profileStatus'])}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="standard">Standard</option>
                  <option value="vip">VIP</option>
                  <option value="blacklist">Blacklist</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Profile Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="h-20 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-indigo-500"
                  placeholder="Security notes, booking instructions, ID remarks..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-indigo-700"
              >
                Save Guest Profile
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-4" id="guests-list-container">
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search guests by name, phone, email, or ID reference..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" id="guests-cards-grid">
            {filteredGuests.length === 0 ? (
              <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-white py-12 text-center text-slate-500">
                <Users className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-4 text-sm font-semibold">No guest profiles found.</p>
              </div>
            ) : (
              filteredGuests.map((guest) => {
                const guestBookings = bookings.filter((booking) => booking.guestId === guest.id);
                const totalStays = guestBookings.length;
                const activeStay = bookings.find((booking) => booking.guestId === guest.id && booking.status === 'checked-in');
                const recentStays = [...guestBookings]
                  .sort((left, right) => right.checkInDate.localeCompare(left.checkInDate))
                  .slice(0, 3);
                const statusBadgeClass =
                  guest.profileStatus === 'vip'
                    ? 'bg-emerald-50 text-emerald-700'
                    : guest.profileStatus === 'blacklist'
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-slate-100 text-slate-600';

                return (
                  <div key={guest.id} className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-bold text-slate-800">
                            {guest.firstName} {guest.lastName}
                          </h4>
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">ID: {guest.id}</span>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass}`}>
                            {(guest.profileStatus || 'standard').toUpperCase()}
                          </span>
                          {activeStay ? (
                            <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-800">
                              Checked In: Unit {activeStay.roomId}
                            </span>
                          ) : (
                            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
                              No Active Stay
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>{canViewContact ? guest.phone : maskPhoneValue(guest.phone)}</span>
                        </div>
                        {guest.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{canViewContact ? guest.email : 'Restricted'}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>
                            {guest.documentType === 'passport' ? 'Passport' : 'CNIC'}:{' '}
                            <strong className="font-mono text-indigo-700">
                              {canViewIdentity ? guest.cnic : maskIdentityValue(guest.cnic)}
                            </strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>{guest.identityProofs?.length || 0} proof file(s)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>{totalStays} past visit{totalStays === 1 ? '' : 's'}</span>
                        </div>
                      </div>

                      {guest.preferences && (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-800">
                          <strong className="block text-[10px] uppercase tracking-wide text-emerald-700">Preferences</strong>
                          <p className="mt-1 leading-relaxed">{guest.preferences}</p>
                        </div>
                      )}

                      {guest.notes && (
                        <div className="flex items-start gap-2 rounded-xl border border-indigo-50/70 bg-indigo-50/50 p-3 text-xs text-indigo-700">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                          <p className="leading-relaxed">{guest.notes}</p>
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                        <strong className="block text-[10px] uppercase tracking-wide text-slate-500">Stay History</strong>
                        {recentStays.length === 0 ? (
                          <p className="mt-1">No stay record yet.</p>
                        ) : (
                          <div className="mt-2 space-y-1.5">
                            {recentStays.map((stay) => (
                              <div key={stay.id} className="flex items-center justify-between gap-3">
                                <span className="font-medium text-slate-700">Unit {stay.roomId}</span>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {stay.checkInDate} to {stay.checkOutDate}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-50 pt-3 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Registered {guest.createdAt}</span>
                      </div>
                      <div className="font-semibold text-slate-700">
                        {totalStays} {totalStays === 1 ? 'Stay' : 'Stays'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
