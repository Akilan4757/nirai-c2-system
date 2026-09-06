import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  User, 
  Phone, 
  MapPin, 
  Clock, 
  Activity, 
  Mic, 
  Shield, 
  Radio, 
  CheckCircle, 
  XCircle, 
  Send, 
  Navigation, 
  X, 
  ShieldAlert 
} from 'lucide-react';
import { Case, Officer, Drone } from '../types';
import { checkRedZoneCollision } from './LiveMap';
import { soundFX } from '../utils/audioEffects';

interface IncidentInspectorCardProps {
  selectedCase: Case | null;
  officers: Officer[];
  drones: Drone[];
  onClose: () => void;
  onVerifyCase: (caseId: string, isFalseAlarm: boolean) => void;
  onOpenDispatchModal: (caseId: string) => void;
  onAssignOfficer: (caseId: string, officerUserId: string) => void;
  onResolveCase: (caseId: string) => void;
  onCancelCase?: (caseId: string) => void;
}

// Organic Audio Stream Meter (Subtle, non-distracting)
const CalmAudioStream: React.FC<{ active: boolean }> = ({ active }) => {
  const [levels, setLevels] = useState([6, 12, 16, 10, 18, 14, 20, 12, 14, 8]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setLevels(prev => prev.map(() => Math.floor(Math.random() * 14) + 4));
    }, 200);
    return () => clearInterval(timer);
  }, [active]);

  return (
    <div className="bg-black/30 px-3 py-2 rounded-xl border border-white/[0.06] flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Mic className={`w-3 h-3 ${active ? 'text-[#2997ff]' : 'text-[#86868b]'}`} />
        <span className="text-[10px] text-[#86868b] font-medium">Acoustic Channel</span>
      </div>
      <div className="flex items-center space-x-1 h-3.5">
        {levels.map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-full transition-all duration-200"
            style={{
              height: active ? `${h}px` : '3px',
              backgroundColor: active 
                ? (i % 2 === 0 ? 'rgba(41, 151, 255, 0.75)' : 'rgba(0, 113, 227, 0.5)')
                : 'rgba(255, 255, 255, 0.12)'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const IncidentInspectorCard: React.FC<IncidentInspectorCardProps> = ({
  selectedCase,
  officers,
  drones,
  onClose,
  onVerifyCase,
  onOpenDispatchModal,
  onAssignOfficer,
  onResolveCase,
  onCancelCase,
}) => {
  if (!selectedCase) return null;

  const activeOfficers = officers.filter(o => o.onDuty);
  const timeAgo = Math.max(1, Math.round((Date.now() - new Date(selectedCase.createdAt).getTime()) / 60000));
  const isBlocked = checkRedZoneCollision(selectedCase.location.lat, selectedCase.location.lng);

  // Proximity calculations
  const rankedOfficers = activeOfficers.map(officer => {
    const R = 6371;
    const dLat = (selectedCase.location.lat - officer.location.lat) * (Math.PI / 180);
    const dLng = (selectedCase.location.lng - officer.location.lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(officer.location.lat * Math.PI / 180) *
      Math.cos(selectedCase.location.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const etaMin = Math.max(1, Math.round(distKm * 2));
    return { officer, distKm, etaMin };
  }).sort((a, b) => a.distKm - b.distKm);

  const nearest = rankedOfficers[0];
  const assignedOfficer = officers.find(o => o.userId === selectedCase.assignedOfficerUserId);

  // Deterministic metrics
  const numericId = selectedCase.id.split('-')[1] || '1';
  const isOdd = numericId.charCodeAt(numericId.length - 1) % 2 === 1;
  const distressIndex = Math.min(96, Math.max(45, (selectedCase.severityScore * 10) + (isOdd ? 14 : 4)));
  const acousticDistressAlert = selectedCase.severityScore >= 5;

  return (
    <div className="w-80 md:w-84 liquid-glass rounded-3xl shadow-2xl border border-white/[0.12] overflow-hidden flex flex-col z-[1000] select-none animate-slideInRight">
      {/* Sleek Top Header Bar */}
      <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#ff453a] animate-apple-pulse" />
          <span className="apple-headline text-xs font-semibold text-white">Incident Triage</span>
          <span className="apple-tabular text-[10px] bg-white/[0.08] text-[#2997ff] border border-white/[0.1] px-2 py-0.5 rounded-full font-medium">
            {selectedCase.id}
          </span>
        </div>
        <button
          onClick={() => {
            soundFX.playClickTick();
            onClose();
          }}
          className="w-6 h-6 rounded-full bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-[#86868b] hover:text-white transition-all"
          title="Close Inspector (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Body */}
      <div className="p-4 space-y-3.5 max-h-[calc(100vh-170px)] overflow-y-auto">
        {/* Reporter Information */}
        <div className="apple-card p-3.5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            {selectedCase.reporterPhotoUrl ? (
              <img
                src={selectedCase.reporterPhotoUrl}
                alt={selectedCase.reporterName}
                className="w-9 h-9 rounded-xl object-cover border border-white/20"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                <User className="w-4 h-4 text-[#2997ff]" />
              </div>
            )}
            <div>
              <h3 className="apple-headline font-semibold text-xs text-white leading-tight">{selectedCase.reporterName}</h3>
              <a
                href={`tel:${selectedCase.reporterPhone}`}
                className="text-[11px] text-[#2997ff] hover:underline flex items-center space-x-1 mt-0.5"
              >
                <Phone className="w-2.5 h-2.5" />
                <span className="apple-tabular">{selectedCase.reporterPhone}</span>
              </a>
            </div>
          </div>

          <div className="text-right">
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              selectedCase.status === 'airborne' ? 'bg-[#bf5af2]/15 text-[#bf5af2] border border-[#bf5af2]/30' :
              selectedCase.status === 'unit_assigned' ? 'bg-[#ff9f0a]/15 text-[#ff9f0a] border border-[#ff9f0a]/30' :
              'bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/30'
            }`}>
              {selectedCase.status.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-[#86868b] block mt-1 apple-tabular">{timeAgo}m ago</span>
          </div>
        </div>

        {/* Location GPS */}
        <div className="apple-card p-3 rounded-xl space-y-1 text-xs">
          <div className="flex items-start space-x-2">
            <MapPin className="w-3.5 h-3.5 text-[#ff453a] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/90 text-[11px] leading-relaxed line-clamp-2">{selectedCase.address}</p>
              <span className="text-[10px] text-[#2997ff] font-medium apple-tabular block mt-0.5">
                {selectedCase.location.lat.toFixed(5)}°N, {selectedCase.location.lng.toFixed(5)}°E
              </span>
            </div>
          </div>
        </div>

        {/* Threat Evaluation (Apple Health aesthetic, calm and informative) */}
        <div className="apple-card p-3.5 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-white/90">
              <Activity className="w-3.5 h-3.5 text-[#2997ff]" />
              <span>Biometric & Audio Analysis</span>
            </div>
            {acousticDistressAlert && (
              <span className="text-[9px] bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25 px-2 py-0.5 rounded-full font-medium">
                High Distress
              </span>
            )}
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-[#86868b]">Distress Index</span>
              <span className="font-medium text-white apple-tabular">{distressIndex}%</span>
            </div>
            <div className="w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${distressIndex}%`,
                  backgroundColor: distressIndex > 75 ? '#ff453a' : '#2997ff',
                }}
              />
            </div>
          </div>

          <CalmAudioStream active={selectedCase.status !== 'resolved'} />
        </div>

        {/* Direct Dispatch Options */}
        <div className="space-y-2">
          {/* Nearest Patrol Unit */}
          <div className="apple-card p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Shield className="w-3.5 h-3.5 text-[#0a84ff]" />
                <div>
                  <span className="font-semibold text-white block text-[11px]">
                    {assignedOfficer ? assignedOfficer.name : nearest ? nearest.officer.name : 'No Units Available'}
                  </span>
                  <span className="text-[10px] text-[#86868b]">
                    {assignedOfficer ? `Badge ${assignedOfficer.badgeId} • Assigned` : nearest ? `Closest Unit • ${nearest.officer.vehicle}` : ''}
                  </span>
                </div>
              </div>
              {nearest && !assignedOfficer && (
                <div className="text-right apple-tabular text-xs">
                  <span className="text-[#2997ff] font-medium block text-[11px]">{nearest.distKm.toFixed(2)} km</span>
                  <span className="text-[#ff9f0a] text-[10px]">~{nearest.etaMin}m</span>
                </div>
              )}
            </div>

            {assignedOfficer ? (
              <div className="bg-[#0a84ff]/10 border border-[#0a84ff]/25 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] text-[#0a84ff]">
                <span>Unit Dispatched</span>
                <CheckCircle className="w-3 h-3" />
              </div>
            ) : nearest ? (
              <button
                onClick={() => {
                  soundFX.playDispatchConfirm();
                  onAssignOfficer(selectedCase.id, nearest.officer.userId);
                }}
                className="w-full apple-btn-primary text-[11px] py-1.5 flex items-center justify-center space-x-1.5 font-medium"
              >
                <Navigation className="w-3 h-3" />
                <span>Assign {nearest.officer.name} (~{nearest.etaMin}m)</span>
              </button>
            ) : null}
          </div>

          {/* Autonomous Drone Recon */}
          <div className="apple-card p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Radio className="w-3.5 h-3.5 text-[#bf5af2]" />
                <div>
                  <span className="font-semibold text-white block text-[11px]">Autonomous Drone Recon</span>
                  <span className="text-[10px] text-[#86868b]">
                    {isBlocked ? 'Restricted Airspace' : 'DGCA Airspace Cleared'}
                  </span>
                </div>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                isBlocked ? 'bg-[#ff453a]/15 text-[#ff453a]' : 'bg-[#30d158]/15 text-[#30d158]'
              }`}>
                {isBlocked ? 'Blocked' : 'Ready'}
              </span>
            </div>

            {selectedCase.status === 'airborne' || selectedCase.status === 'on_scene' ? (
              <div className="bg-[#bf5af2]/10 border border-[#bf5af2]/25 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] text-[#bf5af2]">
                <span>Drone Airborne & Streaming</span>
                <Radio className="w-3 h-3 animate-pulse" />
              </div>
            ) : (
              <button
                disabled={isBlocked}
                onClick={() => {
                  soundFX.playClickTick();
                  onOpenDispatchModal(selectedCase.id);
                }}
                className={`w-full py-1.5 apple-pill-btn text-[11px] flex items-center justify-center space-x-1.5 font-medium ${
                  isBlocked
                    ? 'bg-white/[0.05] text-white/40 border border-white/[0.06] cursor-not-allowed'
                    : 'apple-btn-primary'
                }`}
              >
                <Send className="w-3 h-3" />
                <span>{isBlocked ? 'Airspace Restriction Active' : 'Launch Mother Drone Alpha'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Bottom Bar */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2">
          {selectedCase.status === 'raised' && (
            <button
              onClick={() => {
                soundFX.playClickTick();
                onVerifyCase(selectedCase.id, false);
              }}
              className="apple-btn-secondary flex-1 py-1.5 text-[11px] flex items-center justify-center space-x-1"
            >
              <Phone className="w-3 h-3 text-[#30d158]" />
              <span>Verify Call</span>
            </button>
          )}

          {onCancelCase && selectedCase.status !== 'resolved' && (
            <button
              onClick={() => {
                soundFX.playClickTick();
                onCancelCase(selectedCase.id);
              }}
              className="apple-btn-destructive flex-1 py-1.5 text-[11px] flex items-center justify-center space-x-1"
            >
              <XCircle className="w-3 h-3" />
              <span>Cancel</span>
            </button>
          )}

          {(selectedCase.status === 'airborne' || selectedCase.status === 'unit_assigned' || selectedCase.status === 'on_scene') && (
            <button
              onClick={() => {
                soundFX.playResolveChime();
                onResolveCase(selectedCase.id);
              }}
              className="apple-pill-btn flex-1 bg-[#30d158] hover:bg-[#32d75b] text-black font-medium py-1.5 text-[11px] flex items-center justify-center space-x-1"
            >
              <CheckCircle className="w-3 h-3" />
              <span>Resolve</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
