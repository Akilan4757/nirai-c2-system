import React, { useState, useEffect } from 'react';
import { Shield, Activity, Radio, AlertTriangle, Cpu, Terminal, Trash2 } from 'lucide-react';
import { Case } from '../types';

interface HeaderProps {
  cases: Case[];
  isConnected: boolean;
  onOpenAuditLog: () => void;
  onOpenSimulator: () => void;
  onClearAllRecords: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cases,
  isConnected,
  onOpenAuditLog,
  onOpenSimulator,
  onClearAllRecords
}) => {
  const [time, setTime] = useState<string>(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
  const criticalCases = cases.filter(c => c.severityScore >= 4 && c.status !== 'resolved');

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-2xl z-30 relative">
      {/* Brand & System Mode */}
      <div className="flex items-center space-x-4">
        <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/30 flex items-center justify-center">
          <Shield className="w-6 h-6 text-cyan-400 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-display font-bold text-xl tracking-wider text-white">NIRAI C2</h1>
            <span className="bg-cyan-500/20 text-cyan-300 text-xs px-2 py-0.5 rounded font-mono border border-cyan-500/40">
              v1.0 MVP
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">Tamil Nadu Police Command & Control Hub</p>
        </div>
      </div>

      {/* Center Live Counters */}
      <div className="hidden md:flex items-center space-x-6">
        <div className="bg-slate-950/80 px-4 py-1.5 rounded-lg border border-slate-800 flex items-center space-x-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <div>
            <span className="text-xs text-slate-400 block font-mono">ACTIVE ALERTS</span>
            <span className="text-sm font-bold text-slate-100 font-mono">{activeCases.length}</span>
          </div>
        </div>

        <div className="bg-slate-950/80 px-4 py-1.5 rounded-lg border border-slate-800 flex items-center space-x-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <div>
            <span className="text-xs text-slate-400 block font-mono">HIGH PRIORITY</span>
            <span className="text-sm font-bold text-amber-400 font-mono">{criticalCases.length}</span>
          </div>
        </div>

        <div className="bg-slate-950/80 px-4 py-1.5 rounded-lg border border-slate-800 flex items-center space-x-3">
          <Activity className="w-4 h-4 text-cyan-400" />
          <div>
            <span className="text-xs text-slate-400 block font-mono">GATEWAY STATUS</span>
            <div className="flex items-center space-x-1">
              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded font-mono ${isConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                {isConnected ? 'LIVE WS' : 'WS CONNECTING'}
              </span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                FIREBASE ONLINE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Controls & Clock */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onClearAllRecords}
          className="bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/60 text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all font-mono shadow-lg shadow-rose-900/30 font-bold"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>ERASE ALL DATA</span>
        </button>

        <button
          onClick={onOpenSimulator}
          className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all font-mono"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>SIMULATOR</span>
        </button>

        <button
          onClick={onOpenAuditLog}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all font-mono"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>EVIDENCE LOG</span>
        </button>

        <div className="hidden lg:block text-right border-l border-slate-800 pl-4 font-mono">
          <span className="text-xs text-slate-400 block">IST TIME</span>
          <span className="text-sm font-bold text-cyan-300 tracking-wider">{time}</span>
        </div>
      </div>
    </header>
  );
};
