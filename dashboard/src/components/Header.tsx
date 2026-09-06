import React, { useState, useEffect } from 'react';
import { Shield, Activity, Terminal, Trash2, LogOut, UserCheck, Sliders, Navigation, Clock, Cpu, Search, Volume2, VolumeX, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Case } from '../types';
import { UserSession } from './DashboardAuthScreen';

interface HeaderProps {
  cases: Case[];
  isConnected: boolean;
  onOpenAuditLog: () => void;
  onOpenSimulator: () => void;
  onClearAllRecords: () => void;
  onOpenSuperAdminModal?: () => void;
  onOpenCommandPalette?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  isAudioMuted?: boolean;
  onToggleAudio?: () => void;
  session?: UserSession | null;
  onLogout?: () => void;
  operatorLocation?: { lat: number; lng: number; accuracy?: number; timestamp?: number } | null;
  gpsStatus?: 'acquiring' | 'locked' | 'denied' | 'unsupported' | 'manual_pick';
  onForceRequestGps?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cases,
  isConnected,
  onOpenAuditLog,
  onOpenSimulator,
  onClearAllRecords,
  onOpenSuperAdminModal,
  onOpenCommandPalette,
  sidebarCollapsed = false,
  onToggleSidebar,
  isAudioMuted = false,
  onToggleAudio,
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
          setSessionRemaining('Expired');
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

  return (
    <header className="apple-glass-nav h-14 px-4 flex items-center justify-between z-30 relative select-none">
      {/* Brand & System Title + Sidebar Toggle */}
      <div className="flex items-center space-x-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar ([)" : "Collapse sidebar ([)"}
            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-[#86868b] hover:text-white transition-all"
          >
            {sidebarCollapsed ? <PanelLeft className="w-4 h-4 text-[#2997ff]" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
        <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#2997ff]/20 to-[#0071e3]/30 border border-[#2997ff]/30 flex items-center justify-center shadow-[0_2px_10px_rgba(0,113,227,0.25)]">
          <Shield className="w-4 h-4 text-[#2997ff]" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="apple-headline text-[15px] font-semibold text-white tracking-tight">NIRAI C2</h1>
            <span className="bg-white/[0.08] text-white/90 text-[10px] px-2 py-0.5 rounded-full font-medium border border-white/[0.1]">
              Pro
            </span>
          </div>
          <p className="text-[11px] text-[#86868b] -mt-0.5">Command & Control</p>
        </div>
      </div>

      {/* Center Live Status Counters & Real-Time GPS Telemetry */}
      <div className="hidden lg:flex items-center space-x-2.5">
        {/* Real-time Operator GPS Indicator */}
        <button
          onClick={onForceRequestGps}
          className={`apple-pill-btn px-3 py-1.5 flex items-center space-x-2 border transition-all ${
            gpsStatus === 'locked' && operatorLocation
              ? 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]'
              : 'bg-amber-500/[0.08] border-amber-500/20 hover:bg-amber-500/[0.15]'
          }`}
          title="Click to re-verify live device GPS fix"
        >
          {gpsStatus === 'locked' ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#30d158] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#30d158]"></span>
            </span>
          ) : (
            <Navigation className="w-3 h-3 text-[#ff9f0a] animate-spin" />
          )}
          <div className="text-left flex items-center space-x-1.5">
            <span className="text-[10px] font-medium text-[#86868b]">HQ GPS:</span>
            <span className="text-[11px] font-medium text-[#f5f5f7] apple-tabular">
              {operatorLocation
                ? `${operatorLocation.lat.toFixed(4)}°, ${operatorLocation.lng.toFixed(4)}°`
                : 'Acquiring...'}
            </span>
          </div>
        </button>

        {/* Session TTL Badge */}
        <div className="apple-pill-btn bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 flex items-center space-x-1.5">
          <Clock className="w-3 h-3 text-[#2997ff]" />
          <span className="text-[10px] text-[#86868b]">Session:</span>
          <span className="text-[11px] font-medium text-[#2997ff] apple-tabular">{sessionRemaining}</span>
        </div>

        {/* Active SOS Badge */}
        <div className="apple-pill-btn bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 flex items-center space-x-1.5">
          <span className={`w-2 h-2 rounded-full ${activeCases.length > 0 ? 'bg-[#ff453a] animate-apple-pulse' : 'bg-[#30d158]'}`} />
          <span className="text-[10px] text-[#86868b]">Incidents:</span>
          <span className={`text-[11px] font-semibold apple-tabular ${activeCases.length > 0 ? 'text-[#ff453a]' : 'text-[#30d158]'}`}>
            {activeCases.length}
          </span>
        </div>

        {/* Gateway Connection Status */}
        <div className="apple-pill-btn bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 flex items-center space-x-1.5">
          <Activity className="w-3 h-3 text-[#30d158]" />
          <span className="text-[10px] text-[#86868b]">Gateway:</span>
          <span className="text-[10px] font-medium text-[#30d158]">
            {isConnected ? 'Online' : 'Standby'}
          </span>
        </div>
      </div>

      {/* Right Toolbar Controls */}
      <div className="flex items-center space-x-2">
        {/* Spotlight Command Palette Trigger */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="apple-pill-btn h-8 bg-white/[0.04] hover:bg-white/[0.08] text-[#86868b] hover:text-white border border-white/[0.08] text-[11px] px-3 inline-flex items-center space-x-2 transition-all font-medium"
            title="Open Command Palette (⌘K / Ctrl+K)"
          >
            <Search className="w-3 h-3 text-[#2997ff]" />
            <span className="hidden sm:inline">Command...</span>
            <kbd className="text-[9px] bg-black/40 px-1.5 py-0.5 rounded border border-white/10 font-mono text-white/60">⌘K</kbd>
          </button>
        )}

        {/* Audio Mute/Unmute Toggle */}
        {onToggleAudio && (
          <button
            onClick={onToggleAudio}
            className="apple-btn-secondary h-8 w-8 inline-flex items-center justify-center text-[#86868b] hover:text-white"
            title={isAudioMuted ? "Unmute Audio Cues" : "Mute Audio Cues"}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5 text-[#ff453a]" /> : <Volume2 className="w-3.5 h-3.5 text-[#30d158]" />}
          </button>
        )}

        {/* User Session Badge */}
        {session && (
          <div className="h-8 bg-white/[0.04] border border-white/[0.08] px-3 rounded-full flex items-center space-x-2">
            <UserCheck className="w-3.5 h-3.5 text-[#2997ff]" />
            <span className="text-[12px] font-medium text-white/90 max-w-[120px] truncate">{session.name}</span>
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
              session.isSuperAdmin
                ? 'bg-[#ff9f0a]/20 text-[#ff9f0a] border border-[#ff9f0a]/30'
                : 'bg-[#2997ff]/20 text-[#2997ff] border border-[#2997ff]/30'
            }`}>
              {session.role}
            </span>
          </div>
        )}

        {/* Super Admin Governance Console Button */}
        {session?.isSuperAdmin && onOpenSuperAdminModal && (
          <button
            onClick={onOpenSuperAdminModal}
            className="apple-pill-btn h-8 bg-amber-500/10 hover:bg-amber-500/20 text-[#ff9f0a] border border-amber-500/30 text-[11px] px-3 inline-flex items-center space-x-1.5 transition-all font-medium"
          >
            <Sliders className="w-3 h-3" />
            <span>Admin</span>
          </button>
        )}

        {/* Erase All Button */}
        <button
          onClick={onClearAllRecords}
          className="apple-btn-destructive h-8 text-[11px] px-3 inline-flex items-center space-x-1.5 font-medium"
        >
          <Trash2 className="w-3 h-3" />
          <span>Reset All</span>
        </button>

        {/* Simulator Button */}
        <button
          onClick={onOpenSimulator}
          className="apple-btn-secondary h-8 text-[11px] px-3 inline-flex items-center space-x-1.5 font-medium"
        >
          <Terminal className="w-3 h-3 text-[#2997ff]" />
          <span>Simulator</span>
        </button>

        {/* Audit / Evidence Log Button */}
        <button
          onClick={onOpenAuditLog}
          className="apple-btn-secondary h-8 text-[11px] px-3 inline-flex items-center space-x-1.5 font-medium"
        >
          <Cpu className="w-3 h-3 text-[#bf5af2]" />
          <span>Audit Log</span>
        </button>

        {/* Log Out Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            title="Log Out"
            className="apple-btn-secondary h-8 text-[11px] px-2.5 inline-flex items-center space-x-1 text-[#86868b] hover:text-[#ff453a]"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
