-- TAPS: Tour Advance Prep System
-- Run this in your Supabase SQL editor to initialize the schema.

-- ─────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  name        text,
  avatar_url  text,
  google_id   text unique,
  role        text not null default 'VIEWER'
                check (role in ('ADMIN', 'PM', 'TM', 'VIEWER')),
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- TOURS
-- ─────────────────────────────────────────
create table if not exists tours (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,              -- e.g. "World Tour 2025"
  artist          text not null,
  season          text,                       -- e.g. "Spring 2025"
  akb_locked      boolean not null default false,
  akb_locked_by   uuid references users(id),
  akb_locked_at   timestamptz,
  created_by      uuid references users(id),
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- PRODUCTION RIDERS (raw uploaded files)
-- ─────────────────────────────────────────
create table if not exists production_riders (
  id              uuid primary key default gen_random_uuid(),
  tour_id         uuid not null references tours(id) on delete cascade,
  file_name       text not null,
  file_url        text not null,              -- Supabase Storage path
  file_type       text not null,              -- 'pdf' | 'docx' | 'txt'
  raw_text        text,                       -- extracted plain text
  processed       boolean not null default false,
  uploaded_by     uuid references users(id),
  uploaded_at     timestamptz default now()
);

-- ─────────────────────────────────────────
-- AKB ENTRIES (parsed from production rider, locked as tour truth)
-- ─────────────────────────────────────────
-- Categories mirror real production departments
create type akb_category as enum (
  'POWER',
  'RIGGING',
  'STAGING',
  'AUDIO',
  'LIGHTING',
  'VIDEO',
  'BACKLINE',
  'CATERING',
  'HOSPITALITY',
  'CONTACTS',
  'LOGISTICS',
  'PYRO',
  'EFFECTS',
  'GENERAL'
);

create type confidence_level as enum ('HIGH', 'MEDIUM', 'LOW');

create table if not exists akb_entries (
  id              uuid primary key default gen_random_uuid(),
  tour_id         uuid not null references tours(id) on delete cascade,
  rider_id        uuid references production_riders(id),
  category        akb_category not null,
  key             text not null,              -- e.g. "Main PA System"
  value           text not null,             -- e.g. "L-Acoustics K2, minimum 24 per side"
  unit            text,                      -- e.g. "per side", "amps", "feet"
  source_text     text,                      -- verbatim quote from rider
  confidence      confidence_level not null default 'HIGH',
  notes           text,
  created_at      timestamptz default now(),
  -- AKB entries are unique per tour per key
  unique (tour_id, category, key)
);

-- ─────────────────────────────────────────
-- VENUES
-- ─────────────────────────────────────────
create table if not exists venues (
  id              uuid primary key default gen_random_uuid(),
  tour_id         uuid not null references tours(id) on delete cascade,
  venue_name      text not null,
  city            text not null,
  state_province  text,
  country         text not null default 'US',
  address         text,
  capacity        integer,
  load_in_date    date,
  show_date       date not null,
  advance_call_date date,
  created_by      uuid references users(id),
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- VENUE CONTACTS
-- ─────────────────────────────────────────
create table if not exists venue_contacts (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references venues(id) on delete cascade,
  role            text not null,             -- e.g. "Production Manager", "Head Rigger"
  name            text,
  email           text,
  phone           text,
  source          text check (source in ('AKB', 'TECH_PACKET', 'MANUAL'))
);

-- ─────────────────────────────────────────
-- TECH PACKETS (uploaded per venue)
-- ─────────────────────────────────────────
create table if not exists tech_packets (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references venues(id) on delete cascade,
  file_name       text not null,
  file_url        text not null,
  file_type       text not null,
  raw_text        text,
  processed       boolean not null default false,
  processing_error text,
  uploaded_by     uuid references users(id),
  uploaded_at     timestamptz default now()
);

-- ─────────────────────────────────────────
-- VENUE SPECS (extracted from tech packets)
-- ─────────────────────────────────────────
create table if not exists venue_specs (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references venues(id) on delete cascade,
  packet_id       uuid not null references tech_packets(id) on delete cascade,
  category        akb_category not null,
  key             text not null,
  value           text not null,
  unit            text,
  source_text     text,
  confidence      confidence_level not null default 'HIGH',
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- GAP REPORTS (comparison: AKB vs venue specs)
-- ─────────────────────────────────────────
create type gap_status as enum (
  'MATCH',        -- venue meets the AKB requirement exactly
  'EXCEEDS',      -- venue exceeds (may still need discussion)
  'SHORTFALL',    -- venue falls short of AKB requirement
  'MISSING',      -- AKB requires it, venue packet says nothing
  'UNCLEAR',      -- venue spec exists but ambiguous/incomplete
  'CONFLICT'      -- direct contradiction between AKB and venue spec
);

create type gap_severity as enum (
  'HIGH',         -- show-stopper, must resolve before advance call
  'MEDIUM',       -- needs discussion on advance call
  'LOW'           -- informational, flag but not urgent
);

create table if not exists gap_reports (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references venues(id) on delete cascade,
  packet_id       uuid references tech_packets(id),
  category        akb_category not null,
  status          gap_status not null,
  severity        gap_severity not null,
  akb_entry_id    uuid references akb_entries(id),
  venue_spec_id   uuid references venue_specs(id),
  akb_key         text,                      -- cached for display
  akb_value       text,
  venue_value     text,
  description     text not null,             -- human-readable gap explanation
  suggested_action text,                     -- what to do about it
  resolved        boolean not null default false,
  resolved_by     uuid references users(id),
  resolved_notes  text,
  resolved_at     timestamptz,
  generated_at    timestamptz default now()
);

-- ─────────────────────────────────────────
-- NOTIFICATIONS LOG
-- ─────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  tour_id     uuid references tours(id),
  venue_id    uuid references venues(id),
  gap_id      uuid references gap_reports(id),
  type        text not null,                 -- 'gap_alert' | 'akb_locked' | 'packet_processed'
  recipient   text not null,                 -- email address
  sent_at     timestamptz default now(),
  success     boolean not null default true
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY (Supabase RLS)
-- ─────────────────────────────────────────
-- Enable RLS on all tables
alter table users enable row level security;
alter table tours enable row level security;
alter table production_riders enable row level security;
alter table akb_entries enable row level security;
alter table venues enable row level security;
alter table venue_contacts enable row level security;
alter table tech_packets enable row level security;
alter table venue_specs enable row level security;
alter table gap_reports enable row level security;
alter table notifications enable row level security;

-- Policy: authenticated users can read everything in their tours
-- (In production, scope this to tour membership; start open for dev)
create policy "Authenticated users can read all"
  on tours for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read all"
  on akb_entries for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read all"
  on venues for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read all"
  on venue_specs for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read all"
  on gap_reports for select
  using (auth.role() = 'authenticated');

-- Service role bypasses RLS (used server-side)
-- Your SUPABASE_SERVICE_ROLE_KEY handles this automatically.

-- ─────────────────────────────────────────
-- STORAGE BUCKETS (create in Supabase dashboard or via CLI)
-- ─────────────────────────────────────────
-- bucket: production-riders   (private)
-- bucket: tech-packets        (private)
