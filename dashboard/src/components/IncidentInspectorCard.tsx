import React, { useState, useEffect } from 'react';
import { AlertCircle, User, Phone, MapPin, Clock, Brain, Mic, Shield, Radio, CheckCircle, XCircle, Send, Navigation, X, ExternalLink, Flame } from 'lucide-react';
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

// Live Waveform Component
const LiveWaveform: React.FC<{ active: boolean }> = ({ active }) => {
  const [bars, setBars] = useState([8, 14, 22, 12, 28, 18, 24, 16, 20, 10, 26, 14, 18, 8]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setBars(prev => prev.map(() => Math.floor(Math.random() * 24) + 4));
    }, 120);
    return () => clearInterval(timer);
  }, [active]);

  return (
    <div className="bg-black/50 p-3 rounded-2xl border border-white/[0.08] flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Mic className={`w-3.5 h-3.5 ${active ? 'text-[#bf5af2]' : 'text-[#86868b]'}`} />
        <span className="text-[11px] font-medium text-white/80">Emergency Voice Stream</span>
      </div>
      <div className="flex items-center space-x-1 h-5">
        {bars.map((height, i) => (
          <div
            key={i}
            className="w-1 rounded-full transition-all duration-100"
            style={{
              height: active ? `${height}px` : '3px',
              backgroundColor: active 
                ? (i % 3 === 0 ? '#bf5af2' : i % 3 === 1 ? '#2997ff' : '#0071e3')
                : 'rgba(255,255,255,0.15)'
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

  // Calculate distance to all on-duty officers to rank the #1 closest
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
  const airborneDrone = drones.find(d => d.status === 'airborne');

  // Deterministic AI triage scores
  const numericId = selectedCase.id.split('-')[1] || '1';
  const isOdd = numericId.charCodeAt(numericId.length - 1) % 2 === 1;
  const stressScore = Math.min(99, Math.max(50, (selectedCase.severityScore * 10) + (isOdd ? 19 : 5)));
  const screamDetected = selectedCase.severityScore >= 5;

  return (
    <div className="w-96 apple-glass rounded-3xl shadow-2xl border border-white/[0.12] overflow-hidden flex flex-col z-[1000] animate-slideInRight select-none">
      {/* Top Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff453a] animate-apple-pulse" />
          <span className="apple-headline text-xs font-semibold text-white">Incident Command Inspector</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="apple-tabular text-[11px] bg-white/[0.08] text-[#2997ff] border border-white/[0.1] px-2 py-0.5 rounded-full font-medium">
            {selectedCase.id}
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-[#86868b] hover:text-white transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-5 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
        {/* Victim Profile Banner */}
        <div className="apple-card p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {selectedCase.reporterPhotoUrl ? (
              <img
                src={selectedCase.reporterPhotoUrl}
                alt={selectedCase.reporterName}
                className="w-11 h-11 rounded-2xl object-cover border border-white/20 shadow-md"
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2997ff]/20 to-[#0071e3]/30 border border-white/15 flex items-center justify-center">
                <User className="w-5 h-5 text-[#2997ff]" />
              </div>
            )}
            <div>
              <h3 className="apple-headline font-semibold text-sm text-white">{selectedCase.reporterName}</h3>
              <a
                href={`tel:${selectedCase.reporterPhone}`}
                className="text-[11px] text-[#2997ff] hover:underline flex items-center space-x-1 mt-0.5"
              >
                <Phone className="w-3 h-3" />
                <span className="apple-tabular">{selectedCase.reporterPhone}</span>
              </a>
            </div>
          </div>

          <div className="text-right">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase ${
              selectedCase.status === 'airborne' ? 'bg-[#bf5af2]/20 text-[#bf5af2]' :
              selectedCase.status === 'unit_assigned' ? 'bg-[#ff9f0a]/20 text-[#ff9f0a]' :
              'bg-[#ff453a]/20 text-[#ff453a]'
            }`}>
              {selectedCase.status.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-[#86868b] block mt-1 apple-tabular">{timeAgo}m ago</span>
          </div>
        </div>

        {/* Location & GPS Strip */}
        <div className="apple-card p-3.5 rounded-2xl space-y-1.5 text-xs">
          <div className="flex items-start space-x-2">
            <MapPin className="w-4 h-4 text-[#ff453a] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/90 font-medium line-clamp-2 leading-relaxed">{selectedCase.address}</p>
              <span className="text-[11px] text-[#2997ff] font-medium apple-tabular block mt-0.5">
                {selectedCase.location.lat.toFixed(5)}°N, {selectedCase.location.lng.toFixed(5)}°E
              </span>
            </div>
          </div>
        </div>

        {/* AI Threat Triage Card */}
        <div className="apple-card p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#bf5af2]">
              <Brain className="w-4 h-4" />
              <span>Apple AI Intelligence Triage</span>
            </div>
            <span className="text-[10px] bg-[#bf5af2]/15 text-[#bf5af2] border border-[#bf5af2]/25 px-2 py-0.5 rounded-full font-medium">
              Real-time ML
            </span>
          </div>

          {/* Stress Meter */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-[#86868b]">Citizen Stress / Panic Index</span>
              <span className="font-semibold text-white apple-tabular">{stressScore}%</span>
            </div>
            <div className="w-full bg-white/[0.08] h-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${stressScore}%`,
                  background: stressScore > 75 ? 'linear-gradient(90deg, #ff9f0a, #ff453a)' : 'linear-gradient(90deg, #2997ff, #bf5af2)',
                }}
              />
            </div>
          </div>

          {/* Indicators */}
          <div className="flex items-center space-x-2 pt-1">
            {screamDetected ? (
              <span className="text-[10px] bg-[#ff453a]/20 text-[#ff453a] border border-[#ff453a]/30 px-2.5 py-0.5 rounded-full font-semibold animate-apple-pulse flex items-center space-x-1">
                <Flame className="w-3 h-3" />
                <span>Acoustic Distress Confirmed</span>
              </span>
            ) : (
              <span className="text-[10px] bg-white/[0.06] text-white/70 px-2.5 py-0.5 rounded-full">
                Normal Vocal Decibels
              </span>
            )}
          </div>

          {/* Live Waveform */}
          <LiveWaveform active={selectedCase.status !== 'resolved'} />
        </div>

        {/* 1-Click Smart Dispatch Recommendations */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">
            Automated Unit Recommendations
          </span>

          {/* Nearest Police Officer */}
          <div className="apple-card p-3.5 rounded-2xl space-y-2 border border-white/[0.1]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-[#0a84ff]" />
                <div>
                  <span className="font-semibold text-white block">
                    {assignedOfficer ? assignedOfficer.name : nearest ? nearest.officer.name : 'No Officers Available'}
                  </span>
                  <span className="text-[10px] text-[#86868b]">
                    {assignedOfficer ? `Badge ${assignedOfficer.badgeId} • Assigned` : nearest ? `Rank 1 Nearest • ${nearest.officer.vehicle}` : ''}
                  </span>
                </div>
              </div>
              {nearest && !assignedOfficer && (
                <div className="text-right apple-tabular text-xs">
                  <span className="text-[#2997ff] font-semibold block">{nearest.distKm.toFixed(2)} km</span>
                  <span className="text-[#ff9f0a] text-[10px]">~{nearest.etaMin}m ETA</span>
                </div>
              )}
            </div>

            {assignedOfficer ? (
              <div className="bg-[#0a84ff]/15 border border-[#0a84ff]/30 p-2 rounded-xl flex items-center justify-between text-[11px] text-[#0a84ff]">
                <span>Officer currently dispatched</span>
                <CheckCircle className="w-3.5 h-3.5" />
              </div>
            ) : nearest ? (
              <button
                onClick={() => {
                  soundFX.playDispatchConfirm();
                  onAssignOfficer(selectedCase.id, nearest.officer.userId);
                }}
                className="w-full apple-btn-primary text-xs py-2 flex items-center justify-center space-x-1.5 font-medium"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Assign {nearest.officer.name} (ETA ~{nearest.etaMin}m)</span>
              </button>
            ) : null}
          </div>

          {/* Drone Recon Launch Recommendation */}
          <div className="apple-card p-3.5 rounded-2xl space-y-2 border border-white/[0.1]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-[#bf5af2]" />
                <div>
                  <span className="font-semibold text-white block">Autonomous Drone Recon</span>
                  <span className="text-[10px] text-[#86868b]">
                    {isBlocked ? 'Chennai Port Air Command Block' : 'Airspace Cleared via DGCA'}
                  </span>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                isBlocked ? 'bg-[#ff453a]/20 text-[#ff453a]' : 'bg-[#30d158]/15 text-[#30d158]'
              }`}>
                {isBlocked ? 'Restricted Airspace' : 'Ready for Launch'}
              </span>
            </div>

            {selectedCase.status === 'airborne' || selectedCase.status === 'on_scene' ? (
              <div className="bg-[#bf5af2]/15 border border-[#bf5af2]/30 p-2 rounded-xl flex items-center justify-between text-[11px] text-[#bf5af2]">
                <span>Recon Drone on-scene / streaming live</span>
                <Radio className="w-3.5 h-3.5 animate-pulse" />
              </div>
            ) : (
              <button
                disabled={isBlocked}
                onClick={() => {
                  soundFX.playClickTick();
                  onOpenDispatchModal(selectedCase.id);
                }}
                className={`w-full py-2 apple-pill-btn text-xs flex items-center justify-center space-x-1.5 font-medium ${
                  isBlocked
                    ? 'bg-white/[0.05] text-white/40 border border-white/[0.06] cursor-not-allowed'
                    : 'apple-btn-primary'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isBlocked ? 'Launch Blocked by Airspace' : 'Launch Mother Drone Alpha'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Resolution Toolbar */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2">
          {selectedCase.status === 'raised' && (
            <button
              onClick={() => {
                soundFX.playClickTick();
                onVerifyCase(selectedCase.id, false);
              }}
              className="apple-btn-secondary flex-1 py-2 text-xs flex items-center justify-center space-x-1"
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
              className="apple-btn-destructive flex-1 py-2 text-xs flex items-center justify-center space-x-1"
            >
              <XCircle className="w-3 h-3" />
              <span>Cancel Alert</span>
            </button>
          )}

          {(selectedCase.status === 'airborne' || selectedCase.status === 'unit_assigned' || selectedCase.status === 'on_scene') && (
            <button
              onClick={() => {
                soundFX.playResolveChime();
                onResolveCase(selectedCase.id);
              }}
              className="apple-pill-btn flex-1 bg-[#30d158] hover:bg-[#32d75b] text-black font-semibold py-2 text-xs flex items-center justify-center space-x-1 shadow-md shadow-[#30d158]/30"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Mark Safe & Resolve</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
