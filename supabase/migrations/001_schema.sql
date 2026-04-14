-- ============================================================
-- pay.cltd.co.uk — Database Schema
-- Run this in your Supabase SQL Editor
-- Project: wxzmpbftzeasivveohly
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES — extends auth.users
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  email text not null,
  phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  postcode text,
  national_insurance text,
  utr_number text,
  sort_code text,
  account_number text,
  account_name text,
  trade text,
  role text default 'worker' check (role in ('worker', 'admin')),
  status text default 'active' check (status in ('active', 'inactive')),
  payment_info_complete boolean generated always as (
    sort_code is not null and account_number is not null
    and national_insurance is not null and utr_number is not null
  ) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- SITES — construction sites / projects
-- ============================================================
create table public.sites (
  id uuid default uuid_generate_v4() primary key,
  site_name text not null,
  site_address text,
  city text,
  postcode text,
  status text default 'active' check (status in ('active', 'completed', 'inactive')),
  created_at timestamptz default now()
);

-- ============================================================
-- TIMESHEETS — weekly submissions
-- ============================================================
create table public.timesheets (
  id uuid default uuid_generate_v4() primary key,
  worker_id uuid references public.profiles(id) not null,
  site_id uuid references public.sites(id) not null,
  week_ending date not null,
  approving_manager text,
  payment_method text not null check (payment_method in ('card', 'other')),
  total_amount numeric(10,2) not null default 0,
  status text default 'submitted' check (status in ('submitted', 'reviewed', 'paid', 'queried')),
  admin_notes text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  unique(worker_id, week_ending)
);

-- ============================================================
-- TIMESHEET_DAYS — individual day entries
-- ============================================================
create table public.timesheet_days (
  id uuid default uuid_generate_v4() primary key,
  timesheet_id uuid references public.timesheets(id) on delete cascade not null,
  day_of_week text not null check (day_of_week in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  start_time text,
  end_time text,
  work_type text check (work_type in ('daywork', 'pricework')),
  gross_amount numeric(10,2) default 0,
  deductions numeric(10,2) default 0,
  net_amount numeric(10,2) default 0,
  notes text
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_timesheets_worker on timesheets(worker_id);
create index idx_timesheets_week on timesheets(week_ending);
create index idx_timesheets_status on timesheets(status);
create index idx_timesheet_days_timesheet on timesheet_days(timesheet_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.timesheets enable row level security;
alter table public.timesheet_days enable row level security;

-- PROFILES policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update all profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- SITES policies (everyone can read active sites)
create policy "Anyone can view sites"
  on public.sites for select
  using (true);

create policy "Admins can manage sites"
  on public.sites for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- TIMESHEETS policies
create policy "Workers can view own timesheets"
  on public.timesheets for select
  using (auth.uid() = worker_id);

create policy "Workers can insert own timesheets"
  on public.timesheets for insert
  with check (auth.uid() = worker_id);

create policy "Admins can view all timesheets"
  on public.timesheets for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update all timesheets"
  on public.timesheets for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- TIMESHEET_DAYS policies
create policy "Workers can view own timesheet days"
  on public.timesheet_days for select
  using (
    exists (
      select 1 from public.timesheets
      where timesheets.id = timesheet_days.timesheet_id
      and timesheets.worker_id = auth.uid()
    )
  );

create policy "Workers can insert own timesheet days"
  on public.timesheet_days for insert
  with check (
    exists (
      select 1 from public.timesheets
      where timesheets.id = timesheet_days.timesheet_id
      and timesheets.worker_id = auth.uid()
    )
  );

create policy "Admins can view all timesheet days"
  on public.timesheet_days for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TRIGGER: update updated_at on profile changes
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ============================================================
-- SEED: Add some initial sites
-- ============================================================
insert into public.sites (site_name, site_address, city, postcode) values
  ('Hopton Rd', 'Hopton Road', 'London', 'SE1'),
  ('Kings Cross', 'Kings Cross Development', 'London', 'N1C'),
  ('Battersea Power Station', 'Battersea Power Station', 'London', 'SW11'),
  ('Canary Wharf Tower', 'One Canada Square', 'London', 'E14');
