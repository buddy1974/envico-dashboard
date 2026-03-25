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

function ProtectedRoutes({ onLogout }) {
  const role = getRole();
  return (
    <Layout onLogout={onLogout}>
      <Routes>
        <Route
          path="/"
          element={role === 'ADMIN' ? <Navigate to="/ceo-onboarding" replace /> : <Dashboard onLogout={onLogout} />}
        />
        <Route path="/service-users" element={<ServiceUsers />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/medications" element={<Medications />} />
        <Route path="/care-plans" element={<CarePlans />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/training" element={<Training />} />
        <Route path="/recruitment" element={<Recruitment />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/staff-docs" element={<StaffDocs />} />
        <Route path="/users" element={<Users />} />
        <Route path="/ceo-office" element={<CeoOffice />} />
        <Route path="/ceo-briefing" element={<CeoBriefing />} />
        <Route path="/rota" element={<Rota />} />
        <Route path="/import" element={<DataImport />} />
        <Route path="/ceo-onboarding" element={<CeoOnboarding />} />
        <Route path="/agents" element={<Agents />} />
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
