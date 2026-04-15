-- ============================================================
-- Migration 002: CIS verification, trades, payment dates, alerts
-- Run in Supabase SQL Editor
-- ============================================================

-- Add CIS verified rate to profiles (set by admin/accounts)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cis_rate numeric(5,2) DEFAULT 20;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cis_verified boolean DEFAULT false;

-- Add cis_rate to timesheets if not already there
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS cis_rate numeric(5,2) DEFAULT NULL;

-- Update status check constraint: rename 'reviewed' to 'approved'
ALTER TABLE public.timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check;
ALTER TABLE public.timesheets ADD CONSTRAINT timesheets_status_check 
  CHECK (status IN ('submitted', 'approved', 'paid', 'queried'));

-- Update any existing 'reviewed' statuses to 'approved'
UPDATE public.timesheets SET status = 'approved' WHERE status = 'reviewed';

-- ============================================================
-- ALERTS — notifications for workers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid default uuid_generate_v4() primary key,
  worker_id uuid references public.profiles(id) not null,
  timesheet_id uuid references public.timesheets(id) on delete cascade,
  type text not null check (type in ('query', 'status_change', 'payment_reminder', 'general')),
  title text not null,
  message text not null,
  read boolean default false,
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_worker ON alerts(worker_id);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(worker_id, read);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view alerts"
  ON public.alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert alerts"
  ON public.alerts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update alerts"
  ON public.alerts FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- PAYMENT_DATES — admin-managed payment schedule
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_dates (
  id uuid default uuid_generate_v4() primary key,
  payment_date date not null,
  cutoff_date date not null,
  label text,
  created_at timestamptz default now()
);

ALTER TABLE public.payment_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payment dates"
  ON public.payment_dates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage payment dates"
  ON public.payment_dates FOR ALL TO authenticated USING (true);

-- Seed initial payment dates (this Friday + fortnightly)
INSERT INTO public.payment_dates (payment_date, cutoff_date, label) VALUES
  ('2026-04-17', '2026-04-14', 'Friday 17 April'),
  ('2026-05-01', '2026-04-28', 'Friday 1 May'),
  ('2026-05-15', '2026-05-12', 'Friday 15 May'),
  ('2026-05-29', '2026-05-26', 'Friday 29 May');
