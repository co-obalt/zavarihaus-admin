-- Non-destructive migration for public website booking requests.
-- Run this on an existing ZavariHaus Supabase database.
-- It does not drop or recreate existing tables.

alter table bookings add column if not exists unit_id text;
alter table bookings add column if not exists guest_name text;
alter table bookings add column if not exists guests_count integer not null default 1;
alter table bookings add column if not exists special_request text;
alter table bookings add column if not exists admin_note text;
alter table bookings add column if not exists created_at timestamptz not null default timezone('utc'::text, now());
alter table bookings add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

-- Keep new public-booking columns aligned with the existing admin schema.
update bookings
set
  unit_id = coalesce(unit_id, room_id),
  guest_name = coalesce(
    nullif(guest_name, ''),
    trim(coalesce(guest_first_name, '') || ' ' || coalesce(guest_last_name, ''))
  ),
  guests_count = greatest(coalesce(guests_count, 1), 1),
  special_request = coalesce(special_request, ''),
  admin_note = coalesce(admin_note, '')
where unit_id is null
   or guest_name is null
   or guest_name = ''
   or guests_count is null
   or special_request is null
   or admin_note is null;

-- Public website creates pending booking rows; admin reviews and changes status.
-- Status values used by the app:
-- pending, confirmed, rejected, cancelled, completed
-- Existing operational statuses checked-in / checked-out remain supported for older admin flows.

-- Replace older status constraint so public website can insert pending rows.
-- This is non-destructive: it only changes the allowed text values.
alter table bookings drop constraint if exists bookings_status_check;

alter table bookings
  add constraint bookings_status_check
  check (
    status in (
      'pending',
      'confirmed',
      'rejected',
      'cancelled',
      'completed',
      'checked-in',
      'checked-out'
    )
  );

alter table bookings disable row level security;

grant select, insert on guests to anon;
grant select, insert on bookings to anon;
grant select, insert, update on bookings to authenticated;

create index if not exists idx_bookings_unit_id on bookings(unit_id);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_bookings_public_dates on bookings(check_in_date, check_out_date);
create index if not exists idx_bookings_created_at on bookings(created_at);
