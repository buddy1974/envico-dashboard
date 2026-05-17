import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ServiceUsers from './pages/ServiceUsers';
import Incidents from './pages/Incidents';
import Medications from './pages/Medications';
import CarePlans from './pages/CarePlans';
import Invoices from './pages/Invoices';
import Payroll from './pages/Payroll';
import Finance from './pages/Finance';
import Assistant from './pages/Assistant';
import Training from './pages/Training';
import Recruitment from './pages/Recruitment';
import Compliance from './pages/Compliance';
import StaffDocs from './pages/StaffDocs';
import Users from './pages/Users';
import CeoOffice from './pages/CeoOffice';
import CeoBriefing from './pages/CeoBriefing';
import Rota from './pages/Rota';
import DataImport from './pages/DataImport';
import CeoOnboarding from './pages/CeoOnboarding';
import Agents from './pages/Agents';
import ExecutiveOverview from './pages/ExecutiveOverview';
import Layout from './components/Layout';

function getRole() {
  try {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    if (stored.role) return stored.role;
    const token = localStorage.getItem('token');
    if (token) return JSON.parse(atob(token.split('.')[1])).role ?? null;
    return null;
  } catch { return null; }
}

// RoleGate: renders children only if user has one of the allowed roles.
// Falls back to a permission-denied screen — server also enforces this.
function RoleGate({ allowed, children }) {
  const role = getRole();
  if (!allowed.includes(role)) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#555' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
        <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1a1a2e' }}>Access Restricted</p>
        <p style={{ fontSize: '0.9rem', marginTop: '0.4rem' }}>
          You don&apos;t have permission to view this page. Contact your administrator.
        </p>
      </div>
    );
  }
  return children;
}

const ADMIN_ONLY   = ['ADMIN'];
const ADMIN_MGR    = ['ADMIN', 'MANAGER'];
const ALL_STAFF    = ['ADMIN', 'MANAGER', 'STAFF'];

function ProtectedRoutes({ onLogout }) {
  const role = getRole();
  return (
    <Layout onLogout={onLogout}>
      <Routes>
        <Route
          path="/"
          element={role === 'ADMIN' ? <ExecutiveOverview /> : <Dashboard onLogout={onLogout} />}
        />
        {/* All authenticated staff */}
        <Route path="/service-users" element={<RoleGate allowed={ALL_STAFF}><ServiceUsers /></RoleGate>} />
        <Route path="/incidents"     element={<RoleGate allowed={ALL_STAFF}><Incidents /></RoleGate>} />
        <Route path="/medications"   element={<RoleGate allowed={ALL_STAFF}><Medications /></RoleGate>} />
        <Route path="/care-plans"    element={<RoleGate allowed={ALL_STAFF}><CarePlans /></RoleGate>} />
        <Route path="/training"      element={<RoleGate allowed={ALL_STAFF}><Training /></RoleGate>} />
        <Route path="/compliance"    element={<RoleGate allowed={ALL_STAFF}><Compliance /></RoleGate>} />
        <Route path="/staff-docs"    element={<RoleGate allowed={ALL_STAFF}><StaffDocs /></RoleGate>} />
        <Route path="/assistant"     element={<RoleGate allowed={ALL_STAFF}><Assistant /></RoleGate>} />
        <Route path="/rota"          element={<RoleGate allowed={ALL_STAFF}><Rota /></RoleGate>} />
        {/* Manager + Admin */}
        <Route path="/recruitment"   element={<RoleGate allowed={ADMIN_MGR}><Recruitment /></RoleGate>} />
        <Route path="/invoices"      element={<RoleGate allowed={ADMIN_MGR}><Invoices /></RoleGate>} />
        <Route path="/payroll"       element={<RoleGate allowed={ADMIN_MGR}><Payroll /></RoleGate>} />
        <Route path="/import"        element={<RoleGate allowed={ADMIN_MGR}><DataImport /></RoleGate>} />
        {/* Admin only */}
        <Route path="/finance"         element={<RoleGate allowed={ADMIN_ONLY}><Finance /></RoleGate>} />
        <Route path="/users"           element={<RoleGate allowed={ADMIN_ONLY}><Users /></RoleGate>} />
        <Route path="/executive"       element={<RoleGate allowed={ADMIN_ONLY}><ExecutiveOverview /></RoleGate>} />
        <Route path="/ceo-office"      element={<RoleGate allowed={ADMIN_ONLY}><CeoOffice /></RoleGate>} />
        <Route path="/ceo-briefing"    element={<RoleGate allowed={ADMIN_ONLY}><CeoBriefing /></RoleGate>} />
        <Route path="/ceo-onboarding"  element={<RoleGate allowed={ADMIN_ONLY}><CeoOnboarding /></RoleGate>} />
        <Route path="/agents"          element={<RoleGate allowed={ADMIN_ONLY}><Agents /></RoleGate>} />
        {/* /dashboard bypasses the ADMIN redirect at / */}
        <Route path="/dashboard" element={<Dashboard onLogout={onLogout} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'));

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={authed ? <Navigate to="/" replace /> : <Login onLogin={() => setAuthed(true)} />}
        />
        <Route
          path="/*"
          element={authed ? <ProtectedRoutes onLogout={() => setAuthed(false)} /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
