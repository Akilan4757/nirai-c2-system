import React from 'react';
import { AlertCircle, Clock, MapPin, User, CheckCircle, Send, PhoneCall, XCircle } from 'lucide-react';
import { Case } from '../types';

interface AlertQueueProps {
  cases: Case[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onVerifyCase: (caseId: string, isFalseAlarm: boolean) => void;
  onOpenDispatchModal: (caseId: string) => void;
  onCancelCase?: (caseId: string) => void;
}

export const AlertQueue: React.FC<AlertQueueProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  onVerifyCase,
  onOpenDispatchModal,
  onCancelCase,
}) => {
  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');

  return (
    <div className="bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <h2 className="font-display font-semibold text-sm tracking-wide text-slate-100">INCIDENT DISPATCH QUEUE</h2>
        </div>
        <span className="bg-rose-500/20 text-rose-300 font-mono text-xs px-2 py-0.5 rounded font-bold border border-rose-500/30">
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

            return (
              <div
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/90 border-cyan-500 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500/50'
                    : 'bg-slate-950/60 hover:bg-slate-800/40 border-slate-800'
                }`}
              >
                {/* Header line */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs text-rose-400">{c.id}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                      c.status === 'airborne' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                      c.status === 'unit_assigned' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400 font-mono text-[11px]">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{timeAgo}m ago</span>
                  </div>
                </div>

                {/* Reporter & Location */}
                <div className="space-y-1 text-xs">
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
                    <span className="text-slate-500 text-[11px] ml-1">({c.reporterPhone})</span>
                  </div>
                  <div className="flex items-start text-slate-300 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 mr-1.5 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="line-clamp-2">{c.address}</span>
                      <div className="text-[10px] font-mono text-cyan-400 font-bold mt-0.5">
                        GPS: {c.location.lat.toFixed(5)}, {c.location.lng.toFixed(5)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verification & Assignment details */}
                {c.assignedOfficerName && (
                  <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-cyan-300">
                    <span>UNIT: {c.assignedOfficerName}</span>
                    <span>ETA: {c.etaSeconds ? `${Math.round(c.etaSeconds / 60)}m` : 'Calculating'}</span>
                  </div>
                )}

                {/* Action Toolbar */}
                <div className="mt-3 flex items-center justify-end space-x-2 pt-2 border-t border-slate-800/80">
                  {c.status === 'raised' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onVerifyCase(c.id, false);
                      }}
                      className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[11px] px-2.5 py-1 rounded flex items-center space-x-1 font-mono transition-all"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>VERIFY CALL</span>
                    </button>
                  )}

                  {/* Cancel Case Button */}
                  {onCancelCase && c.status !== 'resolved' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelCase(c.id);
                      }}
                      className="bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-[11px] px-2.5 py-1 rounded flex items-center space-x-1 font-mono transition-all"
                    >
                      <XCircle className="w-3 h-3" />
                      <span>CANCEL</span>
                    </button>
                  )}

                  {c.status !== 'airborne' && c.status !== 'on_scene' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDispatchModal(c.id);
                      }}
                      className="bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-[11px] px-2.5 py-1 rounded flex items-center space-x-1 font-mono transition-all"
                    >
                      <Send className="w-3 h-3" />
                      <span>DISPATCH DRONE</span>
                    </button>
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
