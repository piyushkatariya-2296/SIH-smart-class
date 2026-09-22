import React, { useState, useEffect } from 'react';
import { Shield, GraduationCap, Award, CheckCircle, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('teacher1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backendStatus, setBackendStatus] = useState({
    status: 'checking',
    database: '',
    ai_mode: ''
  });

  // Check backend connection on mount
  useEffect(() => {
    fetch('/api/status')
      .then(res => {
        if (!res.ok) throw new Error('Unreachable');
        return res.json();
      })
      .then(data => {
        setBackendStatus({
          status: 'online',
          database: data.database,
          ai_mode: data.ai_mode
        });
      })
      .catch(err => {
        setBackendStatus({
          status: 'offline',
          database: 'Offline',
          ai_mode: 'Offline'
        });
      });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onLoginSuccess(data);
    } catch (err) {
      setError(err.message || 'Server connection failed');
    } finally {
      setLoading(false);
    }
  };

  const selectPredefinedUser = (name) => {
    setUsername(name);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0f19] px-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl animate-blob"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl animate-blob animation-delay-2000"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-3 shadow-inner">
            <GraduationCap className="h-10 w-10 text-indigo-400" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
            SmartClass
          </h1>
          <p className="text-slate-400 mt-2 font-medium">AI Lecture-to-Notes & Remedial Platform</p>
        </div>

        {/* Login Panel */}
        <div className="glass-panel p-8 rounded-3xl shadow-2xl relative">
          <h2 className="text-xl font-bold text-white mb-6 text-center">Sign In to Your Workspace</h2>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                placeholder="Enter username (e.g. teacher1)"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-xl text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Predefined Accounts */}
          <div className="mt-8 border-t border-slate-800 pt-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 text-center">
              Demo Accounts
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => selectPredefinedUser('teacher1')}
                className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  username === 'teacher1'
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Teacher</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => selectPredefinedUser('student1')}
                className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  username === 'student1'
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>Student</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => selectPredefinedUser('admin1')}
                className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  username === 'admin1'
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Admin</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* System Health Indicators */}
        <div className="mt-6 flex justify-between px-3 text-[11px] font-medium text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                backendStatus.status === 'online' ? 'bg-emerald-400' : backendStatus.status === 'checking' ? 'bg-amber-400' : 'bg-rose-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                backendStatus.status === 'online' ? 'bg-emerald-500' : backendStatus.status === 'checking' ? 'bg-amber-500' : 'bg-rose-500'
              }`}></span>
            </span>
            <span>Server: <strong className="text-slate-300">{backendStatus.status}</strong></span>
          </div>

          {backendStatus.status === 'online' && (
            <>
              <div>DB: <strong className="text-indigo-400">{backendStatus.database}</strong></div>
              <div>AI: <strong className="text-violet-400">{backendStatus.ai_mode}</strong></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
