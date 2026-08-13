import React, { useState } from 'react';
import { Cpu, BatteryCharging, Radio, CheckSquare, AlertOctagon, Video, ShieldAlert, Play, Battery, Orbit, HardDrive } from 'lucide-react';
import { Drone, Case } from '../types';
import { theme } from '../theme';
import { checkRedZoneCollision } from './LiveMap';

interface DroneControlPanelProps {
  drones: Drone[];
  selectedCase: Case | null;
  dispatchModalCaseId: string | null;
  onCloseDispatchModal: () => void;
  onConfirmDispatch: (caseId: string, motherDroneId: string, airspaceConfirmed: boolean) => void;
  onResolveCase: (caseId: string) => void;
}

export const DroneControlPanel: React.FC<DroneControlPanelProps> = ({
  drones,
  selectedCase,
  dispatchModalCaseId,
  onCloseDispatchModal,
  onConfirmDispatch,
  onResolveCase,
}) => {
  const [airspaceChecked, setAirspaceChecked] = useState(false);
  const [selectedMotherId, setSelectedMotherId] = useState('drone-m1');

  const motherDrones = drones.filter(d => d.type === 'mother');
  const childDrones = drones.filter(d => d.type === 'child');
  const activeChild = childDrones.find(d => d.status === 'airborne' || d.streamUrl);

  const isBlockedByGeofence = selectedCase 
    ? checkRedZoneCollision(selectedCase.location.lat, selectedCase.location.lng) 
    : false;

  return (
    <div className="bg-slate-900 border-t border-slate-800 p-4 h-72 flex flex-col justify-between" style={{ fontFamily: theme.typography.fontSans }}>
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <h2 className="font-display font-semibold text-xs tracking-wider text-slate-100 uppercase">DRONE FLEET TELEMETRY & BAY DOCK</h2>
        </div>
        {selectedCase && (selectedCase.status === 'airborne' || selectedCase.status === 'on_scene') && (
          <button
            onClick={() => onResolveCase(selectedCase.id)}
            className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-1.5 rounded-lg font-mono transition-all flex items-center space-x-1.5"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>MARK CASE RESOLVED & RECALL FLEET</span>
          </button>
        )}
      </div>

      {/* Fleet Cards + Live Stream Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-2 flex-1 overflow-hidden">
        {/* Mother Drone Telemetry */}
        {motherDrones.map(m => (
          <div key={m.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400">{m.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                m.status === 'airborne' ? 'bg-cyan-950/70 text-cyan-400 border-cyan-500/30' : 'bg-slate-800 text-slate-400 border-slate-700/50'
              }`}>
                {m.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs my-2">
              <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 block">BATTERY</span>
                <span className="font-bold text-emerald-400 tabular-nums">{m.batteryPct}%</span>
              </div>
              <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 block">ALTITUDE</span>
                <span className="font-bold text-cyan-300 tabular-nums">{m.altitudeMeters}m</span>
              </div>
              <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 block">SPEED</span>
                <span className="font-bold text-amber-300 tabular-nums">{m.speedKmh}k/h</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Bays: {childDrones.filter(c => c.status === 'docked' || c.status === 'charging').length}/{childDrones.length} Docked</span>
              <Radio className="w-3 h-3 text-purple-400 animate-pulse" />
            </div>
          </div>
        ))}

        {/* Child Recon Drone Bay Grid */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between font-mono">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-teal-400">MOTHER-DRONE BAY SLOTS</span>
            <span className="text-[9px] text-slate-400">CRADLE CHARGER ACTIVE</span>
          </div>
          
          {/* 2x2 Bay Slot Grid */}
          <div className="grid grid-cols-2 gap-2 flex-1">
            {childDrones.map((c, idx) => {
              // Determine status roles
              let slotColor = 'border-slate-800 text-slate-400';
              let IconComp = HardDrive;
              let label = 'DOCKED';

              if (c.status === 'airborne') {
                slotColor = 'border-fuchsia-800/40 bg-fuchsia-950/20 text-fuchsia-400';
                IconComp = Orbit;
                label = 'RECON';
              } else if (c.batteryPct < 98) {
                slotColor = 'border-amber-800/40 bg-amber-950/15 text-amber-400';
                IconComp = BatteryCharging;
                label = 'CHARGING';
              } else {
                slotColor = 'border-emerald-800/40 bg-emerald-950/15 text-emerald-400';
                IconComp = Battery;
                label = 'DOCKED';
              }

              return (
                <div key={c.id} className={`border rounded-lg p-1.5 flex flex-col justify-between ${slotColor} transition-all`}>
                  <div className="flex items-center justify-between text-[9px] font-bold">
                    <span>BAY {idx + 1}</span>
                    <IconComp className="w-3 h-3 animate-pulse" />
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-[8px] font-bold tracking-wider">{label}</span>
                    <span className="text-xs font-bold tabular-nums">{c.batteryPct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Stream View */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative flex flex-col justify-between p-2">
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center space-x-1.5">
              <Video className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              <span className="text-xs font-mono font-bold text-slate-200">LIVE OPTICAL FEED</span>
            </div>
            <span className="text-[9px] font-mono bg-rose-950/80 text-rose-300 border border-rose-850 px-1.5 py-0.5 rounded">
              {activeChild?.status === 'airborne' ? 'STREAMING 1080P' : 'FEED STANDBY'}
            </span>
          </div>

          {activeChild?.streamUrl || activeChild?.status === 'airborne' ? (
            <div className="relative w-full h-24 bg-slate-900 rounded overflow-hidden mt-1 flex items-center justify-center border border-slate-800">
              {activeChild?.streamUrl?.startsWith('data:image') ? (
                <img
                  src={activeChild.streamUrl}
                  alt="Live Drone Camera Stream"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={activeChild?.streamUrl || undefined}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-85"
                />
              )}
              <div className="absolute top-1.5 left-1.5 text-[8px] font-mono bg-black/75 px-1.5 py-0.5 rounded text-cyan-300 border border-cyan-500/20 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1"></span>
                RECON-1 // LAT: {activeChild?.location.lat.toFixed(4)} LNG: {activeChild?.location.lng.toFixed(4)}
              </div>
            </div>
          ) : (
            <div className="w-full h-24 bg-slate-900/50 rounded flex flex-col items-center justify-center text-slate-600 font-mono text-xs border border-slate-800/80 mt-1">
              <ShieldAlert className="w-6 h-6 mb-1 opacity-50 text-slate-500" />
              <span className="text-[10px]">WAITING FOR LAUNCH TRIGGER</span>
            </div>
          )}
        </div>
      </div>

      {/* Human-in-the-Loop "Confirm Dispatch" Modal */}
      {dispatchModalCaseId && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
              <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <AlertOctagon className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-white uppercase tracking-wider">HUMAN AUTHORIZATION REQUIREMENT</h3>
                <p className="text-[10px] text-slate-400 font-mono">Mother-Child Drone Launch Security Gate</p>
              </div>
            </div>

            {/* Geofence collision warning block */}
            {isBlockedByGeofence && (
              <div className="bg-rose-950/30 border border-rose-500/30 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  <span>LAUNCH BLOCKED: RESTRICTED AIRSPACE</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  The target incident coordinate lies inside the **Chennai Port Air Command (Z-RED-04)** no-fly boundary. Dispatch is legally locked by DGCA regulation.
                </p>
              </div>
            )}

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Case:</span>
                <span className="font-bold text-rose-400">{dispatchModalCaseId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Selected Mother Drone:</span>
                <span className="font-bold text-purple-300">Mother Alpha (Station Dock 1)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pre-flight Diagnostics:</span>
                <span className={isBlockedByGeofence ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {isBlockedByGeofence ? 'GEOPATH BLOCK DETECTED' : 'ALL SYSTEMS NOMINAL'}
                </span>
              </div>
            </div>

            {/* Digital Sky Airspace Verification Box */}
            <div className={`border p-3 rounded-xl flex items-start space-x-3 transition-colors ${
              isBlockedByGeofence 
                ? 'bg-slate-950 border-slate-800 opacity-60' 
                : 'bg-indigo-950/40 border-indigo-500/30'
            }`}>
              <input
                type="checkbox"
                id="airspaceCheck"
                disabled={isBlockedByGeofence}
                checked={airspaceChecked}
                onChange={(e) => setAirspaceChecked(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 disabled:cursor-not-allowed"
              />
              <label htmlFor="airspaceCheck" className="text-xs text-slate-300 font-sans cursor-pointer leading-relaxed">
                <span className="font-semibold text-indigo-300 font-mono block">DGCA Digital Sky Airspace Verification</span>
                I confirm that the incident location lies outside designated Red No-Fly Zones and wind/weather safety parameters permit emergency deployment.
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={onCloseDispatchModal}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition-all"
              >
                CANCEL
              </button>
              <button
                disabled={!airspaceChecked || isBlockedByGeofence}
                onClick={() => {
                  onConfirmDispatch(dispatchModalCaseId, selectedMotherId, airspaceChecked);
                  setAirspaceChecked(false);
                }}
                className={`px-5 py-2 text-xs font-mono font-bold rounded-lg flex items-center space-x-2 transition-all ${
                  airspaceChecked && !isBlockedByGeofence
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/30 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>CONFIRM DISPATCH & LAUNCH</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
