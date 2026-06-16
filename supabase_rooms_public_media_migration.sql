-- Non-destructive migration for public room media fields.
-- Run only this block in Supabase SQL Editor on an existing database.

alter table rooms add column if not exists cover_image_url text;
alter table rooms add column if not exists gallery_image_urls text[] not null default '{}';
alter table rooms add column if not exists public_description text;
alter table rooms add column if not exists public_location text;
alter table rooms add column if not exists public_modal_location text;
alter table rooms add column if not exists public_guests_label text;
alter table rooms add column if not exists public_size_label text;
alter table rooms add column if not exists public_bed_label text;
alter table rooms add column if not exists public_bath_label text;
alter table rooms add column if not exists public_balcony_label text;

-- Room media, public labels, and amenities are managed from the admin panel.
-- Do not add hardcoded UPDATE backfills here unless the values come from real room data.

-- Safe cleanup for existing room rows:
-- 1) display room size as meters only, e.g. "48 m"
-- 2) normalize old amenity spellings so website icons resolve correctly
update rooms
set public_size_label = regexp_replace(public_size_label, '\bm\s*(2|²)\b', 'm', 'gi')
where public_size_label ~* '\bm\s*(2|²)\b';

update rooms
set type = case
  when lower(regexp_replace(coalesce(type, ''), '[^a-z0-9]+', ' ', 'gi')) like '%large balcony%'
    or lower(regexp_replace(coalesce(type, ''), '[^a-z0-9]+', ' ', 'gi')) like '%skyview%'
    then 'Skyview Suite'
  when lower(regexp_replace(coalesce(type, ''), '[^a-z0-9]+', ' ', 'gi')) like '%small balcony%'
    or lower(regexp_replace(coalesce(type, ''), '[^a-z0-9]+', ' ', 'gi')) like '%sunset%'
    or lower(regexp_replace(coalesce(type, ''), '[^a-z0-9]+', ' ', 'gi')) like '%premium suite%'
    then 'Sunset Room'
  when lower(regexp_replace(coalesce(type, ''), '[^a-z0-9]+', ' ', 'gi')) like '%family%'
    or lower(regexp_replace(coalesce(type, ''), '[^a-z0-9]+', ' ', 'gi')) like '%no balcony%'
    or lower(regexp_replace(coalesce(type, ''), '[^a-z0-9]+', ' ', 'gi')) like '%luxury villa%'
    or lower(regexp_replace(coalesce(type, ''), '[^a-z0-9]+', ' ', 'gi')) like '%luxury vila%'
    then 'Family Haven'
  when id like '5%' then 'Family Haven'
  when id like '3%' then 'Sunset Room'
  else 'Skyview Suite'
end
where type = 'Standard Room'
   or type not in (
     'Skyview Suite',
     'Sunset Room',
     'Family Haven'
   );

update rooms
set public_balcony_label = case
  when type = 'Family Haven' then 'No Balcony'
  when type = 'Sunset Room' then 'Small Balcony'
  else 'Large Balcony'
end
where public_balcony_label is null
   or public_balcony_label not in ('Large Balcony', 'Small Balcony', 'No Balcony');

update rooms as r
set amenities = normalized.next_amenities
from (
  select
    id,
    array_agg(distinct canonical_label order by canonical_label) as next_amenities
  from (
    select
      id,
      case lower(regexp_replace(trim(amenity), '[^a-z0-9]+', ' ', 'gi'))
        when 'ac' then 'Air Conditioning'
        when 'air conditioning' then 'Air Conditioning'
        when 'ceiling fan' then 'Ceiling Fan'
        when 'fan' then 'Ceiling Fan'
        when 'flat screen tv' then 'Flat-Screen TV'
        when 'tv' then 'Flat-Screen TV'
        when 'smart tv' then 'Smart TV'
        when 'wi fi' then 'High-Speed Wi-Fi'
        when 'wifi' then 'High-Speed Wi-Fi'
        when 'high speed wi fi' then 'High-Speed Wi-Fi'
        when 'room service' then 'Room Service'
        when 'comfortable bedding' then 'Comfortable Bedding'
        when 'bedding' then 'Comfortable Bedding'
        when 'refrigerator' then 'Refrigerator'
        when 'fridge' then 'Refrigerator'
        when 'oven' then 'Oven'
        when 'tea facilities' then 'Tea / Coffee Maker'
        when 'tea coffee maker' then 'Tea / Coffee Maker'
        when 'private bathroom with toiletries' then 'Private Bathroom with Toiletries'
        when 'bathroom toiletries' then 'Private Bathroom with Toiletries'
        when 'daily housekeeping' then 'Daily Housekeeping'
        when 'laundry service on request' then 'Laundry Service on Request'
        when 'desk or workspace' then 'Workspace Desk'
        when 'workspace' then 'Workspace Desk'
        when 'workspace desk' then 'Workspace Desk'
        when 'seating area' then 'Seating Area'
        when 'balcony' then 'Balcony'
        else trim(amenity)
      end as canonical_label
    from rooms
    cross join lateral unnest(coalesce(amenities, '{}'::text[])) as amenity
  ) canonicalized
  where canonical_label <> ''
  group by id
) normalized
where r.id = normalized.id;
