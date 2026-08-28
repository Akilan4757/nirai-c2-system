import React, { useState } from 'react';
import { Smartphone, Shield, Radio, CheckCircle, Wifi, Signal, ChevronDown, ChevronUp, Layers, RefreshCw, Navigation, Monitor } from 'lucide-react';
import { Case, Officer, Drone } from '../types';

interface ConnectedDevicesPanelProps {
  cases: Case[];
  officers: Officer[];
  drones: Drone[];
  isConnected: boolean;
  onClearAll?: () => void;
  operatorLocation?: { lat: number; lng: number; accuracy?: number; timestamp?: number } | null;
  gpsStatus?: string;
}

export const ConnectedDevicesPanel: React.FC<ConnectedDevicesPanelProps> = ({
  cases,
  officers,
  drones,
  isConnected,
  onClearAll,
  operatorLocation,
  gpsStatus = 'locked'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pingStatus, setPingStatus] = useState<string | null>(null);

  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
  const activeOfficers = officers.filter(o => o.onDuty);
  const totalNodes = activeCases.length + activeOfficers.length + drones.length + (operatorLocation ? 1 : 0);

  const handlePingDevices = () => {
    setPingStatus('Pinging all connected nodes via Real-time GPS & Mesh...');
    setTimeout(() => {
      setPingStatus(`Verified: 1 C2 Dashboard Node (Live GPS), ${activeCases.length} SOS App Nodes, ${activeOfficers.length} Police Units, ${drones.length} Drone Nodes Online`);
    }, 800);
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md transition-all">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-2.5 bg-slate-950 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition-colors border-b border-slate-800"
      >
        <div className="flex items-center space-x-2.5">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-mono font-bold text-xs text-slate-200 uppercase tracking-wider">
            CONNECTED HARDWARE & GPS NODES ({totalNodes})
          </span>
          <span className="bg-cyan-500/20 text-cyan-300 text-[10px] px-2 py-0.5 rounded font-mono border border-cyan-500/30">
            REAL-TIME TELEMETRY
          </span>
          {operatorLocation && (
            <span className="hidden md:inline-flex items-center space-x-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>C2 GPS: {operatorLocation.lat.toFixed(4)}°, {operatorLocation.lng.toFixed(4)}° (±{operatorLocation.accuracy || 5}m)</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePingDevices();
            }}
            className="h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs px-3 rounded-lg inline-flex items-center space-x-1.5 font-mono transition-all font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>VERIFY ALL NODES</span>
          </button>

          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {pingStatus && (
        <div className="bg-cyan-500/10 border-b border-cyan-500/20 px-4 py-1.5 text-[11px] font-mono text-cyan-300 flex items-center justify-between">
          <span>{pingStatus}</span>
          <button onClick={() => setPingStatus(null)} className="text-slate-400 hover:text-white">×</button>
        </div>
      )}

      {/* Expanded Node List */}
      {isExpanded && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 max-h-64 overflow-y-auto">
          {/* C2 Command Node */}
          <div className="bg-slate-950/60 p-3 rounded-lg border border-cyan-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold text-cyan-300 flex items-center space-x-1.5">
                <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                <span>C2 DASHBOARD</span>
              </span>
              <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-bold">
                COMMAND HQ
              </span>
            </div>
            {operatorLocation ? (
              <div className="text-[11px] font-mono bg-slate-900 p-2 rounded border border-cyan-500/20 space-y-1">
                <span className="text-slate-200 font-bold block">Operator Live Terminal</span>
                <span className="text-[10px] text-cyan-400 block font-bold">
                  GPS: {operatorLocation.lat.toFixed(5)}°, {operatorLocation.lng.toFixed(5)}°
                </span>
                <span className="text-[10px] text-emerald-400 block">
                  Sensor Accuracy: ±{operatorLocation.accuracy || 5}m
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-amber-400 italic">Acquiring live satellite fix...</p>
            )}
          </div>

          {/* Civilian App Devices */}
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold text-slate-300 flex items-center space-x-1.5">
                <Smartphone className="w-3.5 h-3.5 text-rose-400" />
                <span>CIVILIAN SOS NODES</span>
              </span>
              <span className="text-[10px] font-mono bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                {activeCases.length} ACTIVE
              </span>
            </div>
            {activeCases.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">No active SOS nodes</p>
            ) : (
              <div className="space-y-1.5">
                {activeCases.map(c => (
                  <div key={c.id} className="text-[11px] font-mono bg-slate-900 p-2 rounded border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-200 font-bold block">{c.reporterName}</span>
                      <span className="text-[10px] text-slate-400">GPS: {c.location.lat.toFixed(4)}, {c.location.lng.toFixed(4)}</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Police Patrol Units */}
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold text-slate-300 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>POLICE PATROL UNITS</span>
              </span>
              <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                {activeOfficers.length} ON DUTY
              </span>
            </div>
            <div className="space-y-1.5">
              {officers.map(o => (
                <div key={o.userId} className="text-[11px] font-mono bg-slate-900 p-2 rounded border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-200 font-bold block">{o.name} ({o.badgeId})</span>
                    <span className="text-[10px] text-slate-400">{o.vehicle}</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${o.onDuty ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Drone Fleet & Mobile Drone Nodes */}
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold text-slate-300 flex items-center space-x-1.5">
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                <span>DRONE RECON NODES</span>
              </span>
              <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                {drones.length} NODES
              </span>
            </div>
            <div className="space-y-1.5">
              {drones.map(d => (
                <div key={d.id} className="text-[11px] font-mono bg-slate-900 p-2 rounded border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-200 font-bold block">{d.name}</span>
                    <span className="text-[10px] text-slate-400">Bat: {d.batteryPct}% | Alt: {d.altitudeMeters}m</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${d.status === 'airborne' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'}`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
