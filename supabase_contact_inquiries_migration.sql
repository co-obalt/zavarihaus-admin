-- ============================================================
-- ZavariHaus — Contact Inquiries Migration
-- Non-destructive: creates contact_inquiries table if not exists.
-- Does NOT touch supabase_schema.sql or any existing tables.
-- Run this in Supabase SQL Editor.
-- ============================================================

create table if not exists contact_inquiries (
  id          text primary key,
  name        text not null default '',
  email       text not null default '',
  phone       text not null default '',
  message     text not null default '',
  status      text not null default 'new'
                check (status in ('new', 'read', 'archived')),
  created_at  timestamptz not null default timezone('utc'::text, now()),
  updated_at  timestamptz not null default timezone('utc'::text, now())
);

-- Index for sorting/filtering
create index if not exists idx_contact_inquiries_status     on contact_inquiries(status);
create index if not exists idx_contact_inquiries_created_at on contact_inquiries(created_at desc);

-- Allow the public website (anon) to INSERT inquiries and the admin (authenticated) to manage them
alter table contact_inquiries disable row level security;

grant select, insert          on contact_inquiries to anon;
grant select, insert, update  on contact_inquiries to authenticated;

-- ============================================================
-- After running this migration, redeploy both apps.
-- No other schema changes are required.
-- ============================================================
