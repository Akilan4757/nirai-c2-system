import React from 'react';
import { ShieldCheck, MapPin, Navigation, UserCheck } from 'lucide-react';
import { Officer, Case } from '../types';

interface PoliceTrackerProps {
  officers: Officer[];
  selectedCase: Case | null;
  onAssignOfficer: (caseId: string, officerUserId: string) => void;
}

export const PoliceTracker: React.FC<PoliceTrackerProps> = ({
  officers,
  selectedCase,
  onAssignOfficer,
}) => {
  const activeOfficers = officers.filter(o => o.onDuty);

  return (
    <div className="bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <h2 className="font-display font-semibold text-sm tracking-wide text-slate-100">FIELD POLICE UNITS</h2>
        </div>
        <span className="bg-blue-500/20 text-blue-300 font-mono text-xs px-2 py-0.5 rounded font-bold border border-blue-500/30">
          {activeOfficers.length} ON DUTY
        </span>
      </div>

      {/* Selected Case Reference Header */}
      {selectedCase ? (
        <div className="bg-cyan-950/40 border-b border-cyan-800/40 px-4 py-2 text-xs font-mono text-cyan-300 flex items-center justify-between">
          <span>Target: {selectedCase.id}</span>
          <span className="text-[10px] text-cyan-400/80">Select nearest unit to assign</span>
        </div>
      ) : (
        <div className="bg-slate-950/40 border-b border-slate-800 px-4 py-2 text-xs font-mono text-slate-400">
          Select an incident to view proximity ranking
        </div>
      )}

      {/* Officer List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeOfficers.map((officer) => {
          const isAssignedToCurrent = selectedCase?.assignedOfficerUserId === officer.userId;

          return (
            <div
              key={officer.userId}
              className={`p-3 rounded-xl border transition-all ${
                isAssignedToCurrent
                  ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-950/50'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-blue-400">{officer.badgeId}</span>
                  <h3 className="text-xs font-semibold text-white">{officer.name}</h3>
                </div>
                <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                  {officer.vehicle}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <div className="flex items-center space-x-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span>Lat: {officer.location.lat.toFixed(4)}, Lng: {officer.location.lng.toFixed(4)}</span>
                </div>
              </div>

              {selectedCase && (() => {
                const R = 6371;
                const dLat = (selectedCase.location.lat - officer.location.lat) * (Math.PI / 180);
                const dLng = (selectedCase.location.lng - officer.location.lng) * (Math.PI / 180);
                const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(officer.location.lat * Math.PI / 180) *
                  Math.cos(selectedCase.location.lat * Math.PI / 180) *
                  Math.sin(dLng / 2) ** 2;
                const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const etaMin = Math.max(1, Math.round(distKm * 2)); // ~30 km/h city traffic

                return (
                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-[11px] font-mono text-slate-300 space-x-3">
                    <span><span className="text-slate-400">Dist: </span><span className="font-bold text-cyan-300">{distKm.toFixed(2)} km</span></span>
                    <span><span className="text-slate-400">ETA: </span><span className="font-bold text-amber-300">{etaMin} min</span></span>
                  </div>

                  {isAssignedToCurrent ? (
                    <span className="text-[11px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded flex items-center space-x-1">
                      <UserCheck className="w-3 h-3" />
                      <span>ASSIGNED</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => onAssignOfficer(selectedCase.id, officer.userId)}
                      className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-[11px] px-2.5 py-1 rounded flex items-center space-x-1 font-mono transition-all"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>ASSIGN UNIT</span>
                    </button>
                  )}
                </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};
