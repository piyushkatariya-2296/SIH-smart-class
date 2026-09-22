import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [user, setUser] = useState(null);

  // Load user from localStorage on mount (for persistent state)
  useEffect(() => {
    const savedUser = localStorage.getItem('smartclass_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user credentials:', e);
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('smartclass_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('smartclass_user');
  };

  // Route based on authenticated user role
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  switch (user.role) {
    case 'teacher':
      return <TeacherDashboard user={user} onLogout={handleLogout} />;
    case 'student':
      return <StudentDashboard user={user} onLogout={handleLogout} />;
    case 'admin':
      return <AdminDashboard user={user} onLogout={handleLogout} />;
    default:
      return <Login onLoginSuccess={handleLoginSuccess} />;
  }
}
