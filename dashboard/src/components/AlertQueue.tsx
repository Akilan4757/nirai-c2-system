import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, MapPin, User, Send, PhoneCall, XCircle, Brain, Mic } from 'lucide-react';
import { Case } from '../types';
import { checkRedZoneCollision } from './LiveMap';

import { soundFX } from '../utils/audioEffects';
import { Search, Filter, Layers } from 'lucide-react';

interface AlertQueueProps {
  cases: Case[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onVerifyCase: (caseId: string, isFalseAlarm: boolean) => void;
  onOpenDispatchModal: (caseId: string) => void;
  onCancelCase?: (caseId: string) => void;
}

// Apple Siri/Music-style Organic Waveform Meter
const DecibelMeter: React.FC<{ active: boolean }> = ({ active }) => {
  const [levels, setLevels] = useState([10, 16, 8, 20, 26, 12, 18, 14, 22, 10]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setLevels(prev => prev.map(() => Math.floor(Math.random() * 20) + 6));
    }, 140);
    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="flex items-center space-x-2 bg-black/40 px-2.5 py-1.5 rounded-full border border-white/[0.06]">
      <Mic className={`w-3 h-3 ${active ? 'text-[#bf5af2]' : 'text-[#86868b]'}`} />
      <span className="text-[10px] text-[#86868b] font-medium">Audio Level</span>
      <div className="flex items-center space-x-1 h-3">
        {levels.map((level, i) => (
          <div
            key={i}
            className="w-1 rounded-full transition-all duration-150"
            style={{
              height: active ? `${Math.min(12, level / 2)}px` : '3px',
              backgroundColor: active ? (i % 2 === 0 ? '#bf5af2' : '#2997ff') : 'rgba(255, 255, 255, 0.15)',
            }}
          />
        ))}
      </div>
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
  const [searchFilter, setSearchFilter] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'critical' | 'verifying' | 'dispatched'>('all');

  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');

  const filteredCases = activeCases.filter(c => {
    const matchesSearch = searchFilter === '' || 
      c.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.reporterName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.address.toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;

    if (statusTab === 'critical') return c.severityScore >= 5;
    if (statusTab === 'verifying') return c.status === 'raised' || c.status === 'verifying';
    if (statusTab === 'dispatched') return c.status === 'airborne' || c.status === 'unit_assigned' || c.status === 'on_scene';
    return true;
  });

  const getAiTelemetry = (c: Case) => {
    const numericId = c.id.split('-')[1] || '1';
    const isOdd = numericId.charCodeAt(numericId.length - 1) % 2 === 1;
    const stressScore = Math.min(99, Math.max(50, (c.severityScore * 10) + (isOdd ? 19 : 5)));
    const screamDetected = c.severityScore >= 5;
    const faceLock = c.status === 'airborne' || c.status === 'on_scene' 
      ? 'Locked' 
      : (isOdd ? 'Verified' : 'Scanning');
    return { stressScore, screamDetected, faceLock };
  };

  return (
    <div className="apple-glass border-r border-white/[0.08] flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#ff453a] animate-apple-pulse" />
          <h2 className="apple-headline text-xs font-semibold text-white">
            Incident Dispatch
          </h2>
        </div>
        <span className="bg-[#ff453a]/15 text-[#ff453a] text-[11px] px-2.5 py-0.5 rounded-full font-medium apple-tabular">
          {activeCases.length} Open
        </span>
      </div>

      {/* Quick Search & Status Filter Tabs */}
      <div className="p-3 border-b border-white/[0.06] space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter incidents or citizen..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#86868b] focus:outline-none focus:border-[#2997ff]/60 transition-colors"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            onClick={() => setStatusTab('all')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              statusTab === 'all'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'bg-white/[0.05] text-[#86868b] hover:text-white'
            }`}
          >
            All ({activeCases.length})
          </button>
          <button
            onClick={() => setStatusTab('critical')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              statusTab === 'critical'
                ? 'bg-[#ff453a] text-white font-semibold shadow-sm'
                : 'bg-white/[0.05] text-[#86868b] hover:text-white'
            }`}
          >
            Critical ({activeCases.filter(c => c.severityScore >= 5).length})
          </button>
          <button
            onClick={() => setStatusTab('verifying')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              statusTab === 'verifying'
                ? 'bg-[#ff9f0a] text-black font-semibold shadow-sm'
                : 'bg-white/[0.05] text-[#86868b] hover:text-white'
            }`}
          >
            Verify
          </button>
          <button
            onClick={() => setStatusTab('dispatched')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              statusTab === 'dispatched'
                ? 'bg-[#2997ff] text-white font-semibold shadow-sm'
                : 'bg-white/[0.05] text-[#86868b] hover:text-white'
            }`}
          >
            Dispatched
          </button>
        </div>
      </div>

      {/* Case List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredCases.length === 0 ? (
          <div className="text-center py-16 text-[#86868b] text-xs">
            {searchFilter ? 'No matching incidents found' : 'No Active Incident Alerts'}
          </div>
        ) : (
          filteredCases.map((c) => {
            const isSelected = c.id === selectedCaseId;
            const timeAgo = Math.max(1, Math.round((Date.now() - new Date(c.createdAt).getTime()) / 60000));
            const { stressScore, screamDetected, faceLock } = getAiTelemetry(c);
            const insideRedZone = checkRedZoneCollision(c.location.lat, c.location.lng);

            return (
              <div
                key={c.id}
                onClick={() => {
                  soundFX.playClickTick();
                  onSelectCase(c.id);
                }}
                className={`p-3.5 rounded-[16px] border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#232326] border-[#2997ff]/60 shadow-apple-card ring-1 ring-[#2997ff]/40'
                    : 'apple-card apple-card-hover'
                }`}
              >
                {/* Header line */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-xs text-[#ff453a] apple-tabular">{c.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'airborne' ? 'bg-[#bf5af2]/20 text-[#bf5af2]' :
                      c.status === 'unit_assigned' ? 'bg-[#ff9f0a]/20 text-[#ff9f0a]' :
                      'bg-[#ff453a]/15 text-[#ff453a]'
                    }`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 text-[#86868b] text-[11px]">
                    <Clock className="w-3 h-3 text-[#86868b]" />
                    <span className="apple-tabular">{timeAgo}m ago</span>
                  </div>
                </div>

                {/* Reporter & Location */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center text-white/90 font-medium">
                    {c.reporterPhotoUrl ? (
                      <img
                        src={c.reporterPhotoUrl}
                        alt={c.reporterName}
                        className="w-5 h-5 rounded-full mr-2 object-cover border border-white/20"
                      />
                    ) : (
                      <User className="w-3.5 h-3.5 text-[#86868b] mr-1.5 flex-shrink-0" />
                    )}
                    <span>{c.reporterName}</span>
                    <span className="text-[#86868b] text-[10px] ml-1 apple-tabular">({c.reporterPhone})</span>
                  </div>
                  <div className="flex items-start text-[#f5f5f7] text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-[#ff453a] mr-1.5 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="line-clamp-2 text-white/80">{c.address}</span>
                      <div className="text-[10px] text-[#2997ff] mt-0.5 apple-tabular">
                        GPS: {c.location.lat.toFixed(5)}, {c.location.lng.toFixed(5)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Telemetry Badges (Apple Intelligence Purple) */}
                <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex flex-wrap gap-1.5 items-center">
                  <div className="flex items-center space-x-1 text-[10px] bg-[#bf5af2]/15 text-[#bf5af2] border border-[#bf5af2]/25 px-2 py-0.5 rounded-full font-medium">
                    <Brain className="w-2.5 h-2.5" />
                    <span>AI Triage</span>
                  </div>
                  <span className="text-[10px] bg-white/[0.06] text-white/80 border border-white/[0.08] px-2 py-0.5 rounded-full apple-tabular">
                    Stress: {stressScore}%
                  </span>
                  {screamDetected && (
                    <span className="text-[10px] bg-[#ff453a]/20 text-[#ff453a] border border-[#ff453a]/30 px-2 py-0.5 rounded-full font-medium animate-apple-pulse">
                      Scream
                    </span>
                  )}
                  <span className="text-[10px] bg-white/[0.06] text-white/80 border border-white/[0.08] px-2 py-0.5 rounded-full">
                    {faceLock}
                  </span>
                </div>

                {/* Live Waveform Meter */}
                <div className="mt-2">
                  <DecibelMeter active={c.status === 'raised' || c.status === 'verifying' || c.status === 'unit_assigned'} />
                </div>

                {/* Unit Assigned ETA */}
                {c.assignedOfficerName && (
                  <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#2997ff]">
                    <span>Unit: {c.assignedOfficerName}</span>
                    <span className="apple-tabular">ETA: {c.etaSeconds ? `${Math.round(c.etaSeconds / 60)}m` : 'Calculating'}</span>
                  </div>
                )}

                {/* Action Toolbar */}
                <div className="mt-3 flex items-center justify-end gap-1.5 pt-2 border-t border-white/[0.06]">
                  {c.status === 'raised' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onVerifyCase(c.id, false);
                      }}
                      className="apple-btn-secondary text-[11px] py-1 px-2.5 inline-flex items-center space-x-1"
                    >
                      <PhoneCall className="w-3 h-3 text-[#30d158]" />
                      <span>Verify</span>
                    </button>
                  )}

                  {onCancelCase && c.status !== 'resolved' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelCase(c.id);
                      }}
                      className="apple-btn-destructive text-[11px] py-1 px-2.5 inline-flex items-center space-x-1"
                    >
                      <XCircle className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                  )}

                  {c.status !== 'airborne' && c.status !== 'on_scene' && (
                    <div className="flex items-center space-x-1.5">
                      {insideRedZone && (
                        <div className="text-[10px] bg-[#ff453a]/20 text-[#ff453a] border border-[#ff453a]/30 px-2 py-0.5 rounded-full font-medium">
                          Restricted Zone
                        </div>
                      )}
                      <button
                        disabled={insideRedZone}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDispatchModal(c.id);
                        }}
                        className={`text-[11px] py-1 px-3 apple-pill-btn inline-flex items-center space-x-1 ${
                          insideRedZone
                            ? 'bg-white/[0.05] text-white/40 cursor-not-allowed border border-white/[0.06]'
                            : 'apple-btn-primary'
                        }`}
                      >
                        <Send className="w-3 h-3" />
                        <span>Dispatch Drone</span>
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
