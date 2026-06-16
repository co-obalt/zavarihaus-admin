# ZavariHaus

Hotel management dashboard for rooms, bookings, guests, expenses, investors, and scheduling.

## Room Management

Rooms are managed only from this admin panel now.

1. Add or edit a unit in `Rooms`.
2. Fill unit number, name, price, type, and status.
3. Add public media fields:
   - cover image URL
   - gallery image URLs
   - public description
   - public location text
   - public spec labels
4. Save once.

The website reads room data from Supabase, so there is no separate `rooms.json` to maintain.

## Booking System Requirements

Public website bookings are admin-controlled.

- Public website creates a `bookings` row with `status = pending`.
- Public website must not auto-confirm bookings.
- Pending bookings appear in the admin booking list.
- Admin can view details, confirm, or reject with an optional admin note.
- Confirm sets `status = confirmed`.
- Reject sets `status = rejected` and stores `admin_note`.
- Rooms are blocked only after admin confirmation, not while the request is pending.
- Public booking form collects guest name, phone / WhatsApp, email, unit ID, check-in, check-out, guests count, and special request.
- After submit, public website shows: `Your booking request has been received. Our team will review availability and contact you shortly on WhatsApp.`

If you need to update the schema on an existing Supabase project, run the non-destructive migration blocks only:
- `supabase_rooms_public_media_migration.sql`
- `supabase_booking_requests_migration.sql`

## Run Locally

Prerequisite: Node.js

1. Install dependencies: `npm install`
2. Update Supabase values in `.env`
3. Start the app: `npm run dev`
