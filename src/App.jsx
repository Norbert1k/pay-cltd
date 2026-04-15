import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import Sidebar from './components/Sidebar';
import { LoadingSpinner } from './components/ui';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SubmitTimesheet from './pages/SubmitTimesheet';
import MyTimesheets from './pages/MyTimesheets';
import MyProfile from './pages/MyProfile';
import AdminDashboard from './pages/AdminDashboard';
import AdminTimesheets from './pages/AdminTimesheets';
import AdminCalendar from './pages/AdminCalendar';
import AdminWorkers from './pages/AdminWorkers';
import AdminWorkerDetail from './pages/AdminWorkerDetail';
import AdminSites from './pages/AdminSites';
import AdminPaymentDates from './pages/AdminPaymentDates';

function ProtectedRoute() {
  const { user, profile, loading, signOut } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  // Block pending or rejected users
  if (profile && profile.approval_status === 'pending') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card__header">
            <img src="/logo-dark.png" alt="City Construction" className="auth-card__logo" />
            <h1 className="auth-card__title">Account Pending</h1>
          </div>
          <div className="alert alert--warning" style={{marginBottom: 16}}>
            <div>
              <strong>Your account is awaiting approval</strong>
              <p>An administrator will review your account shortly. You'll receive an email once you've been granted access.</p>
            </div>
          </div>
          <button className="btn btn--outline btn--full" onClick={signOut}>Log Out</button>
        </div>
      </div>
    );
  }

  if (profile && (profile.approval_status === 'rejected' || profile.status === 'inactive')) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card__header">
            <img src="/logo-dark.png" alt="City Construction" className="auth-card__logo" />
            <h1 className="auth-card__title">Access Denied</h1>
          </div>
          <div className="auth-error" style={{marginBottom: 16}}>
            Your account has been deactivated. Please contact your administrator.
          </div>
          <button className="btn btn--outline btn--full" onClick={signOut}>Log Out</button>
        </div>
      </div>
    );
  }

  return <AppLayout />;
}

function AdminRoute() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <header className="topbar">
          <button className="topbar__hamburger" onClick={() => setSidebarOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <img src="/logo-dark.png" alt="City Construction" className="topbar__logo" />
          <span className="topbar__title">PAY</span>
        </header>
        <main className="main-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginGuard />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/submit" element={<SubmitTimesheet />} />
            <Route path="/timesheets" element={<MyTimesheets />} />
            <Route path="/profile" element={<MyProfile />} />

            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/timesheets" element={<AdminTimesheets />} />
              <Route path="/admin/calendar" element={<AdminCalendar />} />
              <Route path="/admin/workers" element={<AdminWorkers />} />
              <Route path="/admin/workers/:id" element={<AdminWorkerDetail />} />
              <Route path="/admin/sites" element={<AdminSites />} />
              <Route path="/admin/payments" element={<AdminPaymentDates />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function LoginGuard() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
}
