-- -------------------------------------------------------------
-- ZavariHaus Serviced Apartments
-- Full Supabase reset + recreate script
-- WARNING: This script removes old app data before recreating tables.
-- Run this in the Supabase SQL Editor only when you want a clean reset.
-- -------------------------------------------------------------

create extension if not exists pgcrypto;

drop table if exists expenses cascade;
drop table if exists bookings cascade;
drop table if exists guests cascade;
drop table if exists rooms cascade;
drop table if exists investors cascade;
drop table if exists admins cascade;

-- -------------------------------------------------------------
-- 1. ADMINS / APP LOGIN USERS
-- role values used by the app:
-- owner-admin, manager, receptionist, housekeeping, maintenance, investor
-- -------------------------------------------------------------
create table admins (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    password text not null,
    role text not null default 'owner-admin',
    created_at timestamptz not null default timezone('utc'::text, now())
);

alter table admins disable row level security;

insert into admins (email, password, role)
values
    ('admin@zavarihaus.com', 'admin1234', 'owner-admin'),
    ('manager@zavarihaus.com', 'manager1234', 'manager'),
    ('reception@zavarihaus.com', 'reception1234', 'receptionist')
on conflict (email) do update
set
    password = excluded.password,
    role = excluded.role;

-- -------------------------------------------------------------
-- 2. UNITS TABLE
-- Table name remains "rooms" because the app backend uses that name,
-- but the UI shows these as Units.
-- status stores encoded access + housekeeping values:
-- active:ready, active:dirty, active:cleaned, active:inspected,
-- maintenance, blocked
-- -------------------------------------------------------------
create table rooms (
    id text primary key,
    name text not null,
    type text not null,
    price_per_night numeric not null,
    status text not null default 'active:ready',
    amenities text[] not null default '{}',
    floor integer not null
);

alter table rooms disable row level security;

-- Units are intentionally not pre-seeded here.
-- Add your real inventory from the app UI or insert your own rows manually.

-- -------------------------------------------------------------
-- 3. GUEST PROFILES
-- notes stores structured JSON metadata with app prefix, including:
-- profile notes, document type/number, preferences, profile status,
-- and guest proof attachments.
-- -------------------------------------------------------------
create table guests (
    id text primary key,
    first_name text not null,
    last_name text not null,
    email text,
    phone text not null,
    cnic text not null,
    notes text not null default '',
    created_at text not null
);

alter table guests disable row level security;

-- -------------------------------------------------------------
-- 4. BOOKINGS / STAY RECORDS
-- notes stores structured JSON metadata with app prefix, including:
-- payment details, special request, guest count, check-in/out time,
-- review notes, damage notes, complaint notes, and stay proofs.
-- -------------------------------------------------------------
create table bookings (
    id text primary key,
    room_id text not null references rooms(id) on delete cascade,
    guest_id text not null references guests(id) on delete cascade,
    guest_first_name text not null,
    guest_last_name text not null,
    guest_phone text not null,
    guest_email text,
    guest_cnic text not null,
    check_in_date text not null,
    check_out_date text not null,
    total_price numeric not null,
    status text not null default 'confirmed',
    notes text not null default ''
);

alter table bookings disable row level security;

-- -------------------------------------------------------------
-- 5. INVESTOR CAPITAL
-- notes stores proof attachments and extra investor notes.
-- equity_percentage is used by the app as Profit Share %.
-- -------------------------------------------------------------
create table investors (
    id text primary key,
    investor_name text not null,
    amount numeric not null,
    date text not null,
    equity_percentage numeric not null default 0,
    notes text not null default ''
);

alter table investors disable row level security;

-- -------------------------------------------------------------
-- 6. OPERATIONS TABLE
-- Real expenses are stored here.
-- The app also stores structured records in this table for:
-- maintenance issues,
-- extra revenue entries,
-- audit logs.
-- description is intentionally TEXT for proof-rich structured payloads.
-- -------------------------------------------------------------
create table expenses (
    id text primary key,
    title text not null,
    category text not null,
    amount numeric not null,
    date text not null,
    room_id text references rooms(id) on delete set null,
    status text not null default 'pending',
    description text not null default '',
    paid_from_investor_fund_id text references investors(id) on delete set null
);

alter table expenses disable row level security;

-- -------------------------------------------------------------
-- Indexes
-- -------------------------------------------------------------
create index if not exists idx_bookings_dates on bookings(check_in_date, check_out_date);
create index if not exists idx_bookings_room on bookings(room_id);
create index if not exists idx_bookings_guest on bookings(guest_id);
create index if not exists idx_expenses_room on expenses(room_id);
create index if not exists idx_expenses_date on expenses(date);
create index if not exists idx_guests_cnic on guests(cnic);
create index if not exists idx_guests_name on guests(first_name, last_name);
create index if not exists idx_investors_date on investors(date);

-- -------------------------------------------------------------
-- Notes
-- 1. This script already removes old data by dropping tables first.
-- 2. Proof uploads are stored by the app inside TEXT metadata fields.
-- 3. After running this script, restart the app and log in again.
-- -------------------------------------------------------------

-- -------------------------------------------------------------
-- NON-DESTRUCTIVE MIGRATION NOTES
-- Do not add production changes inside the reset section above unless
-- you intentionally want to rebuild the full database.
--
-- For an existing Supabase project with real data, add new features
-- using create table if not exists / alter table / create index if not exists
-- commands below this divider, or in a separate migration file.
--
-- To add the public website booking request queue safely:
-- 1. Open Supabase SQL Editor.
-- 2. Select only the SQL block below this note.
-- 3. Run only that selected block.
-- -------------------------------------------------------------

create table if not exists booking_requests (
    id text primary key,
    room_id text not null references rooms(id) on delete cascade,
    guest_name text not null,
    email text,
    phone text not null,
    check_in_date text not null,
    check_out_date text not null,
    guest_count integer not null default 1,
    special_requests text not null default '',
    status text not null default 'new',
    created_at timestamptz not null default timezone('utc'::text, now()),
    reviewed_at timestamptz,
    linked_booking_id text references bookings(id) on delete set null
);

alter table booking_requests disable row level security;

create index if not exists idx_booking_requests_dates on booking_requests(check_in_date, check_out_date);
create index if not exists idx_booking_requests_room on booking_requests(room_id);
create index if not exists idx_booking_requests_status on booking_requests(status);
