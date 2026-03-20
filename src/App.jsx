import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ServiceUsers from './pages/ServiceUsers';
import Incidents from './pages/Incidents';
import Medications from './pages/Medications';
import CarePlans from './pages/CarePlans';
import Layout from './components/Layout';

function ProtectedRoutes({ onLogout }) {
  return (
    <Layout onLogout={onLogout}>
      <Routes>
        <Route path="/" element={<Dashboard onLogout={onLogout} />} />
        <Route path="/service-users" element={<ServiceUsers />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/medications" element={<Medications />} />
        <Route path="/care-plans" element={<CarePlans />} />
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
