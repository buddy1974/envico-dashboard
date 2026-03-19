import { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  localStorage.removeItem('token');
  const [authed, setAuthed] = useState(false);

  return authed
    ? <Dashboard onLogout={() => setAuthed(false)} />
    : <Login onLogin={() => setAuthed(true)} />;
}
