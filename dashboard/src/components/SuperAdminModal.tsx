import React, { useState } from 'react';
import { Shield, Cpu, Users, MapPin, AlertOctagon, Radio, Lock, RefreshCw, X, Check, Slash } from 'lucide-react';
import { Drone, Officer, Case } from '../types';
import { UserSession } from './DashboardAuthScreen';

interface SuperAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession;
  drones: Drone[];
  officers: Officer[];
  cases: Case[];
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  onRecallAllDrones: () => void;
}

export const SuperAdminModal: React.FC<SuperAdminModalProps> = ({
  isOpen,
  onClose,
  session,
  drones,
  officers,
  cases,
  selectedZone,
  onSelectZone,
  onRecallAllDrones
}) => {
  const [activeTab, setActiveTab] = useState<'devices' | 'users' | 'zones' | 'overrides'>('devices');
  const [revokedNodeIds, setRevokedNodeIds] = useState<Set<string>>(new Set());

  // Mock list of dashboard users
  const [dashboardUsers, setDashboardUsers] = useState([
    { id: 'usr-admin', name: 'Senthil Akilan', email: 'senthilakilan47@gmail.com', role: 'SUPER ADMIN', zone: 'ALL SECTORS', status: 'ACTIVE' },
    { id: 'usr-op1', name: 'Insp. R. Arumugam', email: 'arumugam@police.tn.gov.in', role: 'OPERATOR', zone: 'Zone 1 — Central', status: 'ACTIVE' },
    { id: 'usr-op2', name: 'Sub-Insp. K. Valli', email: 'valli@police.tn.gov.in', role: 'FIELD COMMANDER', zone: 'Zone 2 — T. Nagar', status: 'ACTIVE' },
    { id: 'usr-op3', name: 'Drone Pilot Alpha', email: 'pilot.alpha@nirai.app', role: 'DRONE OPERATOR', zone: 'Zone 1 — Central', status: 'ACTIVE' }
  ]);

  if (!isOpen) return null;

  const toggleNodeRevocation = (id: string) => {
    setRevokedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleUserStatus = (id: string) => {
    setDashboardUsers(prev => prev.map(u => {
      if (u.id === id) {
        const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[9999] p-4 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold font-display tracking-wider text-slate-100">SUPER ADMIN GOVERNANCE CONSOLE</h2>
                <span className="bg-amber-500/20 text-amber-300 font-mono text-[10px] px-2 py-0.5 rounded font-bold border border-amber-500/40 uppercase">
                  ROOT PRIVILEGES
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">Principal: {session.name} ({session.email})</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Console Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-6 space-x-4">
          <button
            onClick={() => setActiveTab('devices')}
            className={`py-3 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'devices'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>CONNECTED HARDWARE NODES ({drones.length + officers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'users'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>OPERATOR PERMISSIONS ({dashboardUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('zones')}
            className={`py-3 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'zones'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>CITY SECTOR & ZONING</span>
          </button>

          <button
            onClick={() => setActiveTab('overrides')}
            className={`py-3 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'overrides'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>MASTER OVERRIDES</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: Connected Devices & Access Revocation */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 uppercase font-bold">ACTIVE HARDWARE & MOBILE NODE REGISTRY</span>
                <span className="text-xs font-mono text-emerald-400">{drones.length + officers.length} REGISTERED NODES</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Drones */}
                {drones.map(d => {
                  const isRevoked = revokedNodeIds.has(d.id);
                  return (
                    <div key={d.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Radio className={`w-3.5 h-3.5 ${isRevoked ? 'text-rose-500' : 'text-purple-400'}`} />
                          <span className="text-xs font-bold text-slate-200">{d.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                          ID: {d.id} | TYPE: {d.type.toUpperCase()} | BATT: {d.batteryPct}%
                        </span>
                      </div>
                      <button
                        onClick={() => toggleNodeRevocation(d.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                          isRevoked
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                        }`}
                      >
                        {isRevoked ? 'RESTORE ACCESS' : 'REVOKE NODE'}
                      </button>
                    </div>
                  );
                })}

                {/* Officers */}
                {officers.map(o => {
                  const isRevoked = revokedNodeIds.has(o.userId);
                  return (
                    <div key={o.userId} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Shield className={`w-3.5 h-3.5 ${isRevoked ? 'text-rose-500' : 'text-blue-400'}`} />
                          <span className="text-xs font-bold text-slate-200">{o.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                          BADGE: {o.badgeId} | VEHICLE: {o.vehicle}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleNodeRevocation(o.userId)}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                          isRevoked
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                        }`}
                      >
                        {isRevoked ? 'RESTORE ACCESS' : 'REVOKE ACCESS'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: User Role & Access Management */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <span className="text-xs font-mono text-slate-400 uppercase font-bold block">DASHBOARD OPERATORS & COMMAND ROSTER</span>

              <div className="space-y-2.5">
                {dashboardUsers.map(u => (
                  <div key={u.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-100">{u.name}</span>
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                          u.role === 'SUPER ADMIN'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        }`}>
                          {u.role}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400 block mt-1">{u.email} • {u.zone}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {u.role !== 'SUPER ADMIN' && (
                        <button
                          onClick={() => toggleUserStatus(u.id)}
                          className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition-all ${
                            u.status === 'ACTIVE'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'SUSPEND OPERATOR' : 'ACTIVATE'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: City Sector & Zoning Access */}
          {activeTab === 'zones' && (
            <div className="space-y-4">
              <span className="text-xs font-mono text-slate-400 uppercase font-bold block">CITY-WIDE GEOGRAPHIC SECTOR FILTERING</span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { name: 'ALL SECTORS (GLOBAL)', desc: 'View all Chennai metropolitan units & incidents', id: 'ALL' },
                  { name: 'ZONE 1 — CHENNAI CENTRAL', desc: 'Central Railway, Mount Road, Harbour', id: 'ZONE_1' },
                  { name: 'ZONE 2 — T. NAGAR / SOUTH', desc: 'Ranganathan St, Guindy, Velachery', id: 'ZONE_2' },
                  { name: 'ZONE 3 — ANNA NAGAR / NORTH', desc: 'Tower Park, Koyambedu, Red Hills', id: 'ZONE_3' }
                ].map(zone => {
                  const isSelected = selectedZone === zone.id;
                  return (
                    <div
                      key={zone.id}
                      onClick={() => onSelectZone(zone.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-950/30'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold font-mono text-amber-300">{zone.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400">{zone.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Master Emergency Overrides */}
          {activeTab === 'overrides' && (
            <div className="space-y-4">
              <span className="text-xs font-mono text-rose-400 uppercase font-bold block">SUPER ADMIN MASTER SYSTEM OVERRIDES</span>

              <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-rose-300 font-mono">EMERGENCY FLEET GROUNDING OVERRIDE</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Force recall all airborne reconnaissance drones back to dock immediately.</p>
                </div>
                <button
                  onClick={onRecallAllDrones}
                  className="bg-rose-600 hover:bg-rose-500 text-slate-950 font-bold px-3 py-1.5 rounded text-xs font-mono transition-all shadow-md shadow-rose-950"
                >
                  GROUND ALL DRONES
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
