import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, MapPin, User, CheckCircle, Send, PhoneCall, XCircle, Brain, Mic, Shield } from 'lucide-react';
import { Case } from '../types';
import { theme } from '../theme';
import { checkRedZoneCollision } from './LiveMap';

interface AlertQueueProps {
  cases: Case[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onVerifyCase: (caseId: string, isFalseAlarm: boolean) => void;
  onOpenDispatchModal: (caseId: string) => void;
  onCancelCase?: (caseId: string) => void;
}

// Lightweight SVG Decibel Waveform Meter
const DecibelMeter: React.FC<{ active: boolean }> = ({ active }) => {
  const [levels, setLevels] = useState([12, 18, 8, 22, 28, 14, 20, 16, 24, 12]);
  
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setLevels(prev => prev.map(() => Math.floor(Math.random() * 22) + 5));
    }, 150);
    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="flex items-center space-x-1.5 bg-slate-950/80 px-2 py-1.5 rounded-lg border border-slate-800">
      <Mic className="w-3 h-3 text-slate-400" />
      <span className="text-[9px] font-mono text-slate-400">AUDIO SIGNAL</span>
      <svg className="w-16 h-4" viewBox="0 0 40 10">
        {levels.map((level, i) => (
          <line
            key={i}
            x1={i * 4 + 2}
            y1={5 - level / 6}
            x2={i * 4 + 2}
            y2={5 + level / 6}
            stroke={active ? theme.colors.telemetry.aiAccent : theme.colors.text.muted}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
};

export const AlertQueue: React.FC<AlertQueueProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  onVerifyCase,
  onOpenDispatchModal,
  onCancelCase,
}) => {
  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');

  // Compute deterministic AI triage values from the case metadata to keep data clean
  const getAiTelemetry = (c: Case) => {
    const numericId = c.id.split('-')[1] || '1';
    const isOdd = numericId.charCodeAt(numericId.length - 1) % 2 === 1;
    const stressScore = Math.min(99, Math.max(50, (c.severityScore * 10) + (isOdd ? 19 : 5)));
    const screamDetected = c.severityScore >= 5;
    const faceLock = c.status === 'airborne' || c.status === 'on_scene' 
      ? 'TARGET_LOCKED' 
      : (isOdd ? 'IDENTIFIED' : 'SCANNING');
    return { stressScore, screamDetected, faceLock };
  };

  return (
    <div className="bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
      <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />
          <h2 className="font-display font-semibold text-xs tracking-wider text-slate-100 uppercase">INCIDENT DISPATCH QUEUE</h2>
        </div>
        <span className="bg-rose-500/10 text-rose-400 font-mono text-xs px-2.5 py-0.5 rounded font-bold border border-rose-500/20">
          {activeCases.length} OPEN
        </span>
      </div>

      {/* Case List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeCases.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-mono text-xs">
            NO OPEN INCIDENT ALERTS
          </div>
        ) : (
          activeCases.map((c) => {
            const isSelected = c.id === selectedCaseId;
            const timeAgo = Math.max(1, Math.round((Date.now() - new Date(c.createdAt).getTime()) / 60000));
            const { stressScore, screamDetected, faceLock } = getAiTelemetry(c);
            const insideRedZone = checkRedZoneCollision(c.location.lat, c.location.lng);

            return (
              <div
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                style={{ fontFamily: theme.typography.fontSans }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/80 border-cyan-500 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/40'
                    : 'bg-slate-950/60 hover:bg-slate-850/40 border-slate-800'
                }`}
              >
                {/* Header line */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs text-rose-400">{c.id}</span>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-md font-bold uppercase border ${
                      c.status === 'airborne' ? 'bg-cyan-950/70 text-cyan-400 border-cyan-500/30' :
                      c.status === 'unit_assigned' ? 'bg-amber-950/70 text-amber-400 border-amber-500/30' :
                      'bg-rose-950/70 text-rose-400 border-rose-500/30'
                    }`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400 font-mono text-[10px]">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{timeAgo}m ago</span>
                  </div>
                </div>

                {/* Reporter & Location */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center text-slate-200 font-medium">
                    {c.reporterPhotoUrl ? (
                      <img
                        src={c.reporterPhotoUrl}
                        alt={c.reporterName}
                        className="w-6 h-6 rounded-full mr-2 object-cover border border-slate-600"
                      />
                    ) : (
                      <User className="w-3.5 h-3.5 text-slate-400 mr-1.5 flex-shrink-0" />
                    )}
                    <span>{c.reporterName}</span>
                    <span className="text-slate-500 text-[10px] ml-1 font-mono">({c.reporterPhone})</span>
                  </div>
                  <div className="flex items-start text-slate-300 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 mr-1.5 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="line-clamp-2">{c.address}</span>
                      <div className="text-[10px] font-mono text-cyan-400 mt-0.5">
                        GPS: {c.location.lat.toFixed(5)}, {c.location.lng.toFixed(5)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Telemetry Badges (Fuchsia visual identity) */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5 items-center">
                  <div className="flex items-center space-x-1 text-[9px] font-mono bg-fuchsia-950/40 text-fuchsia-300 border border-fuchsia-800/30 px-1.5 py-0.5 rounded">
                    <Brain className="w-2.5 h-2.5" />
                    <span>AI TRIAGE</span>
                  </div>
                  <span className="text-[9px] font-mono bg-fuchsia-950/40 text-fuchsia-300 border border-fuchsia-800/30 px-1.5 py-0.5 rounded">
                    STRESS: {stressScore}%
                  </span>
                  {screamDetected && (
                    <span className="text-[9px] font-mono bg-fuchsia-950/40 text-fuchsia-300 border border-fuchsia-800/30 px-1.5 py-0.5 rounded animate-pulse">
                      SCREAM
                    </span>
                  )}
                  <span className="text-[9px] font-mono bg-fuchsia-950/40 text-fuchsia-300 border border-fuchsia-800/30 px-1.5 py-0.5 rounded">
                    {faceLock}
                  </span>
                </div>

                {/* Live Waveform Meter */}
                <div className="mt-2">
                  <DecibelMeter active={c.status === 'raised' || c.status === 'verifying' || c.status === 'unit_assigned'} />
                </div>

                {/* Verification & Assignment details */}
                {c.assignedOfficerName && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-cyan-300">
                    <span>UNIT: {c.assignedOfficerName}</span>
                    <span>ETA: {c.etaSeconds ? `${Math.round(c.etaSeconds / 60)}m` : 'Calculating'}</span>
                  </div>
                )}

                {/* Action Toolbar */}
                <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-slate-850">
                  {c.status === 'raised' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onVerifyCase(c.id, false);
                      }}
                      className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[10px] px-2.5 py-1 rounded font-mono transition-all flex items-center space-x-1"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>VERIFY CALL</span>
                    </button>
                  )}

                  {onCancelCase && c.status !== 'resolved' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelCase(c.id);
                      }}
                      className="bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-400 text-[10px] px-2.5 py-1 rounded font-mono transition-all flex items-center space-x-1"
                    >
                      <XCircle className="w-3 h-3" />
                      <span>CANCEL</span>
                    </button>
                  )}

                  {c.status !== 'airborne' && c.status !== 'on_scene' && (
                    <div className="flex items-center space-x-2">
                      {insideRedZone && (
                        <div className="text-[9px] bg-red-950/70 border border-red-500/40 text-red-300 px-1.5 py-0.5 rounded font-mono font-bold flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                          <span>Blocked: Airspace</span>
                        </div>
                      )}
                      <button
                        disabled={insideRedZone}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDispatchModal(c.id);
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded font-mono transition-all flex items-center space-x-1 ${
                          insideRedZone
                            ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            : 'bg-cyan-600/15 hover:bg-cyan-600/25 border border-cyan-500/30 text-cyan-300'
                        }`}
                      >
                        <Send className="w-3 h-3" />
                        <span>DISPATCH DRONE</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
