import { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'));

  return authed
    ? <Dashboard onLogout={() => setAuthed(false)} />
    : <Login onLogin={() => setAuthed(true)} />;
}
