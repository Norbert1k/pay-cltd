# pay.cltd.co.uk — Technical Specification & Design Document

## City Construction Ltd — Subcontractor Timesheet & Payment Portal

**Version:** 1.0  
**Date:** 14 April 2026  
**Prepared for:** Norbert, City Construction Ltd

---

## 1. Executive Summary

pay.cltd.co.uk is a self-service web portal replacing the current manual email-based timesheet process at City Construction Ltd. Subcontractors and site workers will submit weekly timesheets online, with their personal and payment details saved securely. The admin team gains a real-time dashboard to view, track, process and download professional PDF timesheets.

---

## 2. Current Workflow Analysis

### 2.1 Current Timesheet (from uploaded Excel template)

Workers currently fill in an Excel/Word timesheet containing:

- **Personal details:** Full name, UTR number, National Insurance number, account number, sort code, phone, email
- **Approving manager** name
- **Project address** (construction site)
- **Week ending date** (Sunday)
- **Daily breakdown:** Day of week, start time, end time, work type (daywork/pricework), daily amount, deductions, net amount
- **Weekly total** amount
- Sent to: accounts@cltd.co.uk

### 2.2 Current Wage Sheet (from uploaded Excel)

The internal wage tracking spreadsheet contains:

- **Columns:** Trade, Active/Not status, Name, NI, UTR, Sort Code, Account Number
- **Weekly columns:** Each week ending date with the payment amount for that worker
- **Key data points:** ~25+ workers tracked, spanning 2023-2026, weekly amounts ranging £120-£2,100
- **Two sheets:** "Invoices to Pay" and "Wages"

### 2.3 Pain Points Being Solved

- Workers email timesheets in inconsistent formats
- Accounts team manually re-enters data into the wage sheet
- No way to verify if a worker has already submitted for a given week
- No standardised PDF output
- No real-time visibility of submissions
- Payment method not tracked systematically

---

## 3. Technical Architecture

### 3.1 Recommended Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React 18 + Vite | Same stack as BuildCore CRM — shared knowledge, fast builds |
| Styling | Custom CSS (City Construction brand) | Consistent with CRM, mobile-first |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) | Already used for CRM, proven, includes auth out of the box |
| Hosting | Vercel | Already used for CRM, auto-deploy from GitHub |
| PDF Generation | jsPDF or React-PDF | Client-side PDF generation from standardised template |
| Domain | pay.cltd.co.uk | CNAME to Vercel, same DNS setup as crm.cltd.co.uk |

### 3.2 Why This Stack

- You already know it from BuildCore CRM
- Supabase Auth handles registration, login, password reset out of the box
- Supabase RLS (Row Level Security) ensures workers can only see their own data
- Same deployment pipeline — push to GitHub, Vercel auto-deploys
- Separate Supabase project from CRM (different data, different users)

### 3.3 Project Structure

```
pay.cltd.co.uk/
├── src/
│   ├── pages/
│   │   ├── Login.jsx              # Login / register
│   │   ├── Register.jsx           # Registration with personal details
│   │   ├── Dashboard.jsx          # Worker home — submit timesheet
│   │   ├── SubmitTimesheet.jsx    # Weekly timesheet form
│   │   ├── MyTimesheets.jsx       # History of all submissions
│   │   ├── MyProfile.jsx          # Edit personal/payment details
│   │   ├── AdminDashboard.jsx     # Admin overview
│   │   ├── AdminTimesheets.jsx    # All submitted timesheets
│   │   ├── AdminCalendar.jsx      # Calendar view of submissions
│   │   ├── AdminWorkers.jsx       # Manage workers (active/inactive)
│   │   └── AdminWorkerDetail.jsx  # Individual worker history
│   ├── components/
│   │   ├── TimesheetForm.jsx      # The main form component
│   │   ├── TimesheetPDF.jsx       # PDF generation template
│   │   ├── WeekPicker.jsx         # Week selection component
│   │   ├── DayRow.jsx             # Single day input row
│   │   ├── Sidebar.jsx            # Navigation
│   │   └── ui.jsx                 # Shared UI components
│   ├── lib/
│   │   ├── supabase.js            # Supabase client
│   │   ├── auth.jsx               # Auth context
│   │   └── utils.js               # Helpers
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase/
│   └── migrations/
│       └── 001_schema.sql
├── public/
│   └── logo.png
├── package.json
├── vercel.json
└── vite.config.js
```

---

## 4. Database Schema

### 4.1 Tables

**profiles** — extends Supabase auth.users

```sql
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
```

**sites** — construction sites / projects

```sql
create table public.sites (
  id uuid default uuid_generate_v4() primary key,
  site_name text not null,
  site_address text,
  city text,
  postcode text,
  status text default 'active' check (status in ('active', 'completed', 'inactive')),
  created_at timestamptz default now()
);
```

**timesheets** — weekly submissions

```sql
create table public.timesheets (
  id uuid default uuid_generate_v4() primary key,
  worker_id uuid references public.profiles(id) not null,
  site_id uuid references public.sites(id) not null,
  week_ending date not null,
  approving_manager text,
  payment_method text not null check (payment_method in ('card', 'other')),
  total_amount numeric(10,2) not null,
  status text default 'submitted' check (status in ('submitted', 'reviewed', 'paid', 'queried')),
  admin_notes text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  unique(worker_id, week_ending)
);
```

**timesheet_days** — individual day entries within a timesheet

```sql
create table public.timesheet_days (
  id uuid default uuid_generate_v4() primary key,
  timesheet_id uuid references public.timesheets(id) on delete cascade not null,
  day_of_week text not null check (day_of_week in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  start_time text,
  end_time text,
  work_type text check (work_type in ('daywork', 'pricework', null)),
  gross_amount numeric(10,2) default 0,
  deductions numeric(10,2) default 0,
  net_amount numeric(10,2) default 0,
  notes text
);
```

### 4.2 Row Level Security

```sql
-- Workers can only see their own profile and timesheets
-- Admins can see everything
-- Workers cannot modify timesheets after submission (status != 'submitted')
```

### 4.3 Indexes

```sql
create index idx_timesheets_worker on timesheets(worker_id);
create index idx_timesheets_week on timesheets(week_ending);
create index idx_timesheets_status on timesheets(status);
create index idx_timesheet_days_timesheet on timesheet_days(timesheet_id);
```

---

## 5. User Flows

### 5.1 Worker Registration Flow

```
1. Go to pay.cltd.co.uk
2. Click "Create Account"
3. Enter email + password
4. Email verification (Supabase handles this)
5. First login → "Complete Your Profile" screen
6. Fill in: Full name, phone, address, NI, UTR, sort code, account number, trade
7. Save → redirected to Dashboard
```

### 5.2 Weekly Timesheet Submission Flow

```
1. Worker logs in → sees Dashboard
2. Dashboard shows: current week status, recent submissions, quick "Submit Timesheet" button
3. Click "Submit Timesheet"
4. Select week ending date (defaults to coming Sunday)
5. Select site from dropdown (active sites only)
6. For each day worked:
   - Toggle day on/off
   - Enter start time, end time
   - Select work type (daywork / pricework)
   - Enter gross amount, deductions (net auto-calculates)
7. Total auto-calculates at bottom
8. Choose payment method:
   - "Pay by Card" — only enabled if payment_info_complete = true
   - "Pay by Other" — always available
9. Submit → confirmation screen
10. Timesheet appears in "My Timesheets" with status "Submitted"
```

### 5.3 Admin Review Flow

```
1. Admin logs in → Admin Dashboard
2. See: total submissions this week, pending reviews, payment method breakdown
3. Click into "All Timesheets" → filterable table
4. Click any timesheet → full detail view
5. Can mark as: Reviewed, Paid, Queried
6. Can add admin notes
7. Can download as PDF
8. Calendar view shows all submissions by week with colour-coded payment method
```

---

## 6. Page-by-Page Design Specification

### 6.1 Login / Register Page

- Clean, centred card on branded background
- City Construction logo at top
- Two tabs: "Log In" / "Create Account"
- Login: email + password + "Forgot password?" link
- Register: email + password + confirm password
- Mobile: full-width card, large touch targets

### 6.2 Worker Dashboard

- Welcome message with worker's first name
- **This Week** card: shows if timesheet submitted for current week (green tick or amber "Not submitted" with button)
- **Quick Submit** button — large, primary green, centre of page
- **Recent Submissions** — last 4 timesheets with status pills (Submitted/Reviewed/Paid/Queried)
- **Profile Completeness** bar — if payment details missing, show amber banner "Complete your payment details to enable Pay by Card"

### 6.3 Submit Timesheet Page

- **Step 1 — Header:** Week picker (defaults to this Sunday), Site selector dropdown, Approving manager name
- **Step 2 — Daily Breakdown:** 7 day rows (Mon-Sun), each row toggleable:
  - Day name | Start time | End time | Work type dropdown | Gross £ | Deductions £ | Net £ (auto-calc)
  - Inactive days greyed out, tap to activate
  - On mobile: each day is a collapsible card instead of a table row
- **Step 3 — Summary:** Total gross, total deductions, total net (large, bold)
- **Step 4 — Payment Method:** Two large selectable cards:
  - "Pay by Card" — green, with bank details preview, only clickable if payment_info_complete
  - "Pay by Other" — grey/blue, always available
  - If card not available, show small note "Complete your profile to enable card payment"
- **Submit button** — large, full-width on mobile
- **Duplicate prevention:** If timesheet already submitted for this week, show it instead with "Already submitted" status

### 6.4 My Timesheets (History)

- Filterable list of all submitted timesheets
- Each row: Week ending date, Site name, Total amount, Payment method pill, Status pill
- Click to expand or view detail
- Filter by: month, status, site
- Mobile: card-based layout instead of table

### 6.5 My Profile

- Editable form with all personal and payment details
- Sections: Personal Information, Contact Details, Payment Details
- "Payment Details Complete" indicator (green tick or amber warning)
- Save button at bottom
- Change password link

### 6.6 Admin Dashboard

- **Stats row:** Total workers (active), Timesheets this week, Pending review, Total value this week
- **Submissions by Payment Method** — visual breakdown (card vs other)
- **Recent Submissions** — latest 10 with worker name, site, amount, payment method, status
- **Workers Needing Attention** — incomplete profiles, inactive workers

### 6.7 Admin — All Timesheets

- Full table: Worker name, Week ending, Site, Days worked, Total, Payment method, Status, Actions
- Filters: week, site, payment method, status
- Bulk actions: mark multiple as Reviewed/Paid
- Click any row → full timesheet detail
- Download PDF button on each row
- Payment method colour coding:
  - **Card** — green background/pill
  - **Other** — blue/purple background/pill

### 6.8 Admin — Calendar View

- Month calendar grid
- Each day shows small indicators for submissions on that week
- Colour-coded by payment method
- Click a week → shows all timesheets for that week ending
- Useful for seeing coverage and gaps at a glance

### 6.9 Admin — Workers

- List of all registered workers
- Columns: Name, Trade, NI, Status (Active/Inactive), Payment Info (Complete/Incomplete), Last Submission
- Toggle active/inactive status
- Click → Worker Detail page showing their full submission history
- Export to CSV

### 6.10 Admin — Worker Detail

- Worker's full profile information
- Submission history (all timesheets)
- Total paid to date
- Toggle active/inactive
- Download all timesheets as ZIP

---

## 7. PDF Template Specification

Every downloaded timesheet generates an identical, professional PDF matching the current paper format:

### Layout

```
┌─────────────────────────────────────────┐
│  [LOGO]  CITY CONSTRUCTION GROUP        │
│          SUBCONTRACTOR TIMESHEET        │
├─────────────────────────────────────────┤
│  Employee Name:    Neringa Zemaitiene   │
│  UTR:              7941733131           │
│  National Insurance: ST512636A          │
│  Account Number:   60045094             │
│  Sort Code:        04-00-75             │
│  Approving Manager: Jevgenij Sio        │
│  Phone:            07375895133          │
│  Email:            neringazem2@gmail.com│
├─────────────────────────────────────────┤
│  Project:  Hopton Rd                    │
│  Week Ending: 12/04/2026               │
│  Payment Method: PAY BY CARD           │
├─────────────────────────────────────────┤
│  Day    │ Start │ End  │ Type  │ Amount │
│  Mon    │ 08:00 │17:00 │Daywork│ £250   │
│  Tue    │ 08:00 │17:00 │Daywork│ £250   │
│  Wed    │ 08:00 │17:00 │Daywork│ £250   │
│  Thu    │ 08:00 │17:00 │Daywork│ £250   │
│  Fri    │  —    │  —   │  —    │  —     │
│  Sat    │  —    │  —   │  —    │  —     │
│  Sun    │  —    │  —   │  —    │  —     │
├─────────────────────────────────────────┤
│  TOTAL:                        £1,000   │
├─────────────────────────────────────────┤
│  Submitted: 12 Apr 2026 at 14:32       │
│  Status: Submitted                      │
│  Ref: TS-2026-0412-001                 │
├─────────────────────────────────────────┤
│  City Construction Ltd · pay.cltd.co.uk │
└─────────────────────────────────────────┘
```

---

## 8. Mobile-First Design Approach

### 8.1 Breakpoints

| Breakpoint | Target |
|-----------|--------|
| < 400px | Small phones (SE, older Android) |
| < 768px | Phones (primary use case) |
| 768-1024px | Tablets / iPad |
| > 1024px | Desktop |

### 8.2 Key Mobile Decisions

- **Timesheet form:** Daily breakdown becomes collapsible cards on mobile (not a table)
- **Navigation:** Bottom tab bar on mobile (Dashboard, Submit, History, Profile), sidebar on desktop
- **Touch targets:** Minimum 44px for all interactive elements
- **Font size:** 16px minimum on inputs (prevents iOS zoom)
- **Payment method selector:** Full-width stacked cards, not side-by-side
- **Tables → Cards:** All admin tables become card lists on mobile

### 8.3 Offline Considerations

- Workers on construction sites may have poor signal
- Form should save draft to localStorage as they type
- Show confirmation when submitted successfully
- If offline, queue submission and sync when back online (future enhancement)

---

## 9. Security Requirements

| Requirement | Implementation |
|------------|---------------|
| Authentication | Supabase Auth (email + password) |
| Password policy | Minimum 8 characters |
| Session management | Supabase handles JWT tokens |
| Data encryption | Supabase encrypts at rest and in transit |
| RLS | Workers see only their own data |
| Admin access | Role-based (role = 'admin' in profiles) |
| Sensitive fields | NI, UTR, bank details — encrypted column or masked in UI except to owner/admin |
| HTTPS | Enforced by Vercel |
| Rate limiting | Supabase built-in rate limiting on auth endpoints |

---

## 10. Integration Points

### 10.1 With BuildCore CRM (Future)

- Sites in pay.cltd.co.uk could sync with Projects in CRM
- Workers could map to Subcontractors in CRM
- Payment totals could feed into CRM financial tracking
- This is a Phase 2 enhancement — keep the databases separate for now

### 10.2 Email Notifications

- Worker submits timesheet → admin gets email notification
- Admin marks as "Queried" → worker gets email with admin notes
- Admin marks as "Paid" → worker gets confirmation email
- Use Resend (same as CRM) via Supabase Edge Function

---

## 11. Development Phases

### Phase 1 — Core (4-6 weeks)

- Worker registration, login, profile
- Timesheet submission form with daily breakdown
- Payment method selection (card / other)
- Worker timesheet history
- Admin dashboard with stats
- Admin timesheet list with filters
- PDF download (standardised template)
- Worker active/inactive management
- Mobile-responsive throughout

### Phase 2 — Enhancements (2-3 weeks)

- Calendar view for admin
- Email notifications (submit, queried, paid)
- Bulk status update (mark multiple as paid)
- CSV export of timesheets and wage data
- Admin notes and query workflow
- Duplicate week prevention with warning

### Phase 3 — Advanced (Future)

- CRM integration (sync sites, workers)
- Offline submission queue
- Worker self-service password reset
- Two-factor authentication
- Automatic wage sheet generation matching current Excel format
- API for external accounting software integration

---

## 12. Hosting & Deployment

| Item | Detail |
|------|--------|
| Domain | pay.cltd.co.uk |
| DNS | GoDaddy — CNAME to Vercel |
| Hosting | Vercel (free tier likely sufficient) |
| Database | Supabase (new project, separate from CRM) |
| Repository | GitHub — Norbert1k/pay-cltd |
| CI/CD | Push to main → Vercel auto-deploys |
| SSL | Automatic via Vercel |

---

## 13. Design System

Consistent with City Construction Group branding:

| Token | Value |
|-------|-------|
| Primary green | #448a40 |
| Font | Fahkwang (headings) + system sans-serif (body) |
| Logo | CCG_Logo_4.png |
| Border radius | 8px (inputs), 12px (cards) |
| Dark mode | Yes (optional, user preference) |

Payment method colour coding:

| Method | Colour | Usage |
|--------|--------|-------|
| Pay by Card | Green (#448a40) | Pill, row highlight, calendar indicator |
| Pay by Other | Purple (#534AB7) | Pill, row highlight, calendar indicator |

Status colour coding:

| Status | Colour |
|--------|--------|
| Submitted | Blue (#378ADD) |
| Reviewed | Amber (#BA7517) |
| Paid | Green (#448a40) |
| Queried | Red (#A32D2D) |

---

## 14. Acceptance Criteria

The application is complete when:

1. A worker can register, log in, and complete their profile
2. A worker can submit a weekly timesheet selecting site, days, hours, amounts, and payment method
3. The system prevents duplicate submissions for the same week
4. Workers can view their full submission history
5. Admins see all submissions in a searchable, filterable dashboard
6. Admins can change timesheet status (submitted → reviewed → paid / queried)
7. Any timesheet can be downloaded as a professional, standardised PDF
8. Workers can be set to active/inactive by admins
9. Payment method is clearly visible with colour coding throughout
10. The entire application works smoothly on mobile phones
11. All data is secured with row-level security

---

## 15. Next Steps

1. **Review this spec** — confirm all requirements are captured
2. **Create Supabase project** — new project at database.new
3. **Create GitHub repo** — Norbert1k/pay-cltd
4. **Set up domain** — CNAME pay.cltd.co.uk to Vercel
5. **Begin Phase 1 build** — start with auth, profile, and timesheet form

Ready to start building when you give the go-ahead.
