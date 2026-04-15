-- ============================================================
-- Migration 003: Multi-stage approval, roles, user management
-- Run in Supabase SQL Editor
-- ============================================================

-- Update status constraint to support 3-stage approval
ALTER TABLE public.timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check;
ALTER TABLE public.timesheets ADD CONSTRAINT timesheets_status_check
  CHECK (status IN ('submitted', 'approved_accounts', 'approved_director', 'paid', 'queried'));

-- Update any old 'approved' to 'approved_accounts'
UPDATE public.timesheets SET status = 'approved_accounts' WHERE status = 'approved';

-- Update role constraint to support accountant and director
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('worker', 'admin', 'accountant', 'director'));

-- Add approval_status for new user workflow
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- For existing users, set them as approved
UPDATE public.profiles SET approval_status = 'approved' WHERE approval_status IS NULL;

-- Add who approved/rejected
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Add invited_by for invite tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.profiles(id);
