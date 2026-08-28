import React, { useState, useEffect } from 'react';
import { Shield, Activity, AlertTriangle, Cpu, Terminal, Trash2, LogOut, UserCheck, Sliders, Navigation, Clock } from 'lucide-react';
import { Case } from '../types';
import { UserSession } from './DashboardAuthScreen';

interface HeaderProps {
  cases: Case[];
  isConnected: boolean;
  onOpenAuditLog: () => void;
  onOpenSimulator: () => void;
  onClearAllRecords: () => void;
  onOpenSuperAdminModal?: () => void;
  session?: UserSession | null;
  onLogout?: () => void;
  operatorLocation?: { lat: number; lng: number; accuracy?: number; timestamp?: number } | null;
  gpsStatus?: 'acquiring' | 'locked' | 'denied' | 'unsupported';
  onForceRequestGps?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cases,
  isConnected,
  onOpenAuditLog,
  onOpenSimulator,
  onClearAllRecords,
  onOpenSuperAdminModal,
  session,
  onLogout,
  operatorLocation,
  gpsStatus = 'acquiring',
  onForceRequestGps
}) => {
  const [time, setTime] = useState<string>(new Date().toLocaleTimeString());
  const [sessionRemaining, setSessionRemaining] = useState<string>('24h 00m');

  useEffect(() => {
    const updateTimers = () => {
      setTime(new Date().toLocaleTimeString());

      if (session?.expiresAt) {
        const diff = session.expiresAt - Date.now();
        if (diff <= 0) {
          setSessionRemaining('EXPIRED');
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setSessionRemaining(`${hours}h ${mins.toString().padStart(2, '0')}m`);
        }
      }
    };

    updateTimers();
    const timer = setInterval(updateTimers, 1000);
    return () => clearInterval(timer);
  }, [session]);

  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
  const criticalCases = cases.filter(c => c.severityScore >= 4 && c.status !== 'resolved');

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between shadow-2xl z-30 relative select-none">
      {/* Brand & System Title */}
      <div className="flex items-center space-x-3.5">
        <div className="bg-cyan-500/10 p-2 rounded-xl border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
          <Shield className="w-6 h-6 text-cyan-400 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-display font-bold text-lg tracking-wider text-white">NIRAI C2</h1>
            <span className="bg-cyan-500/20 text-cyan-300 text-[10px] px-2 py-0.5 rounded font-mono font-bold border border-cyan-500/40">
              v2.0 PRO
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">Emergency Command & Control Hub</p>
        </div>
      </div>

      {/* Center Live Status Counters & Real-Time GPS Telemetry */}
      <div className="hidden lg:flex items-center space-x-3.5">
        {/* Real-time Operator GPS Indicator */}
        <div
          onClick={onForceRequestGps}
          className={`px-3 py-1.5 rounded-xl border flex items-center space-x-2.5 font-mono cursor-pointer transition-all ${
            gpsStatus === 'locked' && operatorLocation
              ? 'bg-slate-950 border-emerald-500/40 hover:border-emerald-400 shadow-md shadow-emerald-950/20'
              : 'bg-slate-950 border-amber-500/40 hover:border-amber-400 animate-pulse'
          }`}
          title="Click to re-verify live device GPS fix"
        >
          {gpsStatus === 'locked' ? (
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
          ) : (
            <Navigation className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          )}
          <div className="text-left">
            <div className="flex items-center space-x-1.5">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block leading-tight">
                C2 STATION LIVE GPS
              </span>
              <span className={`text-[8px] px-1 rounded font-bold uppercase ${
                gpsStatus === 'locked' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {gpsStatus === 'locked' ? 'FIXED' : 'ACQUIRING'}
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-100 block leading-tight">
              {operatorLocation
                ? `${operatorLocation.lat.toFixed(4)}°N, ${operatorLocation.lng.toFixed(4)}°E (±${operatorLocation.accuracy || 5}m)`
                : 'Acquiring Real-time GPS...'}
            </span>
          </div>
        </div>

        {/* 24-Hour Session TTL Badge */}
        <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center space-x-2 font-mono">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <div className="text-left">
            <span className="text-[9px] text-slate-400 block font-semibold leading-tight uppercase">SESSION (1 DAY)</span>
            <span className="text-xs font-bold text-cyan-300 leading-tight">{sessionRemaining}</span>
          </div>
        </div>

        <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center space-x-2.5 font-mono">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <div className="text-left">
            <span className="text-[9px] text-slate-400 block font-semibold leading-tight uppercase">ACTIVE SOS</span>
            <span className="text-xs font-bold text-rose-300 leading-tight">{activeCases.length}</span>
          </div>
        </div>

        <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center space-x-2 font-mono">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <div className="text-left">
            <span className="text-[9px] text-slate-400 block font-semibold leading-tight uppercase">GATEWAY</span>
            <span className="text-[10px] font-bold uppercase text-emerald-300 whitespace-nowrap">
              {isConnected ? 'ONLINE (WS+SYNC)' : 'ONLINE (FIREBASE)'}
            </span>
          </div>
        </div>
      </div>

      {/* Right Toolbar Controls */}
      <div className="flex items-center space-x-2.5">
        {/* User Session Badge */}
        {session && (
          <div className="h-9 bg-slate-950 px-3 rounded-xl border border-slate-800 flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-cyan-400" />
            <div className="text-left font-mono flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-200 max-w-[130px] truncate">{session.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${
                session.isSuperAdmin
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              }`}>
                {session.role}
              </span>
            </div>
          </div>
        )}

        {/* Super Admin Governance Console Button */}
        {session?.isSuperAdmin && onOpenSuperAdminModal && (
          <button
            onClick={onOpenSuperAdminModal}
            className="h-9 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 text-xs px-3.5 rounded-xl inline-flex items-center space-x-1.5 transition-all font-mono font-bold shadow-md shadow-amber-950/40 whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>ADMIN CONSOLE</span>
          </button>
        )}

        <button
          onClick={onClearAllRecords}
          className="h-9 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/50 text-xs px-3.5 rounded-xl inline-flex items-center space-x-1.5 transition-all font-mono font-bold shadow-md shadow-rose-950/40 whitespace-nowrap"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>ERASE ALL</span>
        </button>

        <button
          onClick={onOpenSimulator}
          className="h-9 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs px-3.5 rounded-xl inline-flex items-center space-x-1.5 transition-all font-mono font-semibold whitespace-nowrap"
        >
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span>SIMULATOR</span>
        </button>

        <button
          onClick={onOpenAuditLog}
          className="h-9 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs px-3.5 rounded-xl inline-flex items-center space-x-1.5 transition-all font-mono font-semibold whitespace-nowrap"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>EVIDENCE LOG</span>
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            title="Terminate C2 Session & Log Out"
            className="h-9 bg-slate-800 hover:bg-rose-600/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs px-3 rounded-xl inline-flex items-center space-x-1 transition-all font-mono font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EXIT</span>
          </button>
        )}
      </div>
    </header>
  );
};
