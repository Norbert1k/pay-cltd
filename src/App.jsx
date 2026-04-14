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

function ProtectedRoute() {
  const { user, loading, debugLog } = useAuth();
  if (loading) return (
    <div style={{padding: 20}}>
      <LoadingSpinner />
      <div style={{marginTop: 20, fontFamily: 'monospace', fontSize: 12, color: '#666'}}>
        <strong>Auth Debug:</strong>
        {debugLog.map((msg, i) => <div key={i}>{msg}</div>)}
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
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
