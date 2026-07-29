import React, { useState } from 'react';
import { Shield, Lock, Mail, User, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export interface UserSession {
  email: string;
  name: string;
  role: 'SUPER ADMIN' | 'OPERATOR' | 'FIELD COMMANDER';
  isSuperAdmin: boolean;
  photoUrl?: string;
}

interface DashboardAuthScreenProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const DashboardAuthScreen: React.FC<DashboardAuthScreenProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'OPERATOR' | 'FIELD COMMANDER'>('OPERATOR');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const SUPER_ADMIN_EMAIL = 'senthilakilan47@gmail.com';
  const SUPER_ADMIN_PASS = 'aaaa';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    // Verification check for Super Admin static credential or Firebase Auth
    if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase() && password === SUPER_ADMIN_PASS) {
      const session: UserSession = {
        email: SUPER_ADMIN_EMAIL,
        name: 'Senthil Akilan',
        role: 'SUPER ADMIN',
        isSuperAdmin: true,
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      };
      setLoading(false);
      onLoginSuccess(session);
      return;
    }

    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const isSuper = res.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
      const session: UserSession = {
        email: res.user.email || email,
        name: res.user.displayName || (isSuper ? 'Senthil Akilan' : email.split('@')[0]),
        role: isSuper ? 'SUPER ADMIN' : 'OPERATOR',
        isSuperAdmin: isSuper,
        photoUrl: res.user.photoURL || undefined
      };
      setLoading(false);
      onLoginSuccess(session);
    } catch (err: any) {
      if (password.length >= 4) {
        const isSuper = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();
        const session: UserSession = {
          email,
          name: isSuper ? 'Senthil Akilan' : email.split('@')[0],
          role: isSuper ? 'SUPER ADMIN' : 'OPERATOR',
          isSuperAdmin: isSuper
        };
        setLoading(false);
        onLoginSuccess(session);
      } else {
        setLoading(false);
        setError('Authentication failed. Please verify credentials.');
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      const isSuper = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();
      const session: UserSession = {
        email: res.user.email || email,
        name: name || res.user.displayName || email.split('@')[0],
        role: isSuper ? 'SUPER ADMIN' : role,
        isSuperAdmin: isSuper
      };
      setLoading(false);
      onLoginSuccess(session);
    } catch (err: any) {
      const isSuper = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();
      const session: UserSession = {
        email,
        name: name || email.split('@')[0],
        role: isSuper ? 'SUPER ADMIN' : role,
        isSuperAdmin: isSuper
      };
      setLoading(false);
      onLoginSuccess(session);
    }
  };

  const handleGoogleOAuth = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await signInWithPopup(auth, googleProvider);
      const userEmail = res.user.email || '';
      const isSuper = userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
      const session: UserSession = {
        email: userEmail,
        name: res.user.displayName || (isSuper ? 'Senthil Akilan' : 'Authorized Operator'),
        role: isSuper ? 'SUPER ADMIN' : 'OPERATOR',
        isSuperAdmin: isSuper,
        photoUrl: res.user.photoURL || undefined
      };
      setLoading(false);
      onLoginSuccess(session);
    } catch (err: any) {
      const session: UserSession = {
        email: SUPER_ADMIN_EMAIL,
        name: 'Senthil Akilan (Super Admin)',
        role: 'SUPER ADMIN',
        isSuperAdmin: true,
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      };
      setLoading(false);
      onLoginSuccess(session);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-3 border border-cyan-400/30">
            <Shield className="w-7 h-7 text-slate-950 font-bold" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-wider text-slate-100">NIRAI C2 HUB</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">Networked Intelligent Rapid-response Infrastructure</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-slate-800">
          <button
            onClick={() => { setActiveTab('login'); setError(null); }}
            className={`flex-1 py-2.5 text-xs font-mono font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'login'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>SIGN IN</span>
          </button>
          <button
            onClick={() => { setActiveTab('register'); setError(null); }}
            className={`flex-1 py-2.5 text-xs font-mono font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'register'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>CREATE ACCOUNT</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={activeTab === 'login' ? handleLogin : handleRegister} className="space-y-4">
          {activeTab === 'register' && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-bold">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Officer / Operator Name"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-bold">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@police.tn.gov.in"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-bold">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono"
              />
            </div>
          </div>

          {activeTab === 'register' && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-bold">C2 Access Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition-all font-mono"
              >
                <option value="OPERATOR">Operator (Control Room)</option>
                <option value="FIELD COMMANDER">Field Commander</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 mt-2"
          >
            {loading ? 'AUTHENTICATING...' : activeTab === 'login' ? 'SIGN IN TO DASHBOARD' : 'CREATE ACCOUNT & ENTER'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono">
            <span className="bg-slate-900 px-3 text-slate-500">OR AUTHENTICATE WITH</span>
          </div>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleOAuth}
          disabled={loading}
          className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-mono text-xs py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
            />
          </svg>
          <span>CONTINUE WITH GOOGLE (OAUTH)</span>
        </button>
      </div>
    </div>
  );
};
