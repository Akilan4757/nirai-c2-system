import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Case, Officer, Drone } from '../types';

interface LiveMapProps {
  cases: Case[];
  officers: Officer[];
  drones: Drone[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
}

// Custom Leaflet Icons with explicit Inline CSS Hex Colors for maximum contrast
const createSvgIcon = (bgColor: string, borderColor: string, symbol: string, isPulsing: boolean = false) => {
  const pulseHtml = isPulsing ? `<div style="position:absolute; inset:-6px; border-radius:9999px; background-color:${borderColor}; opacity:0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : '';
  const svg = `
    <div style="position:relative; display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:9999px; background-color:${bgColor}; border:3px solid ${borderColor}; box-shadow: 0 0 12px ${borderColor}; color:white; font-weight:bold; font-family:monospace; font-size:11px; text-shadow:0 1px 2px rgba(0,0,0,0.8);">
      ${pulseHtml}
      <span style="position:relative; z-index:10;">${symbol}</span>
    </div>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-map-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

// Distinct Vivid Map Markers
const caseIconUnassigned = createSvgIcon('#881337', '#ef4444', 'SOS', true);
const caseIconAssigned = createSvgIcon('#78350f', '#f59e0b', 'SOS');
const caseIconAirborne = createSvgIcon('#083344', '#06b6d4', 'AIR');
const officerIcon = createSvgIcon('#1e3a8a', '#3b82f6', 'POL');
const motherDroneIcon = createSvgIcon('#581c87', '#a855f7', 'MD');
const childDroneIcon = createSvgIcon('#064e3b', '#10b981', 'CD');

const MapRecenter = ({ caseItem }: { caseItem: Case | null }) => {
  const map = useMap();
  useEffect(() => {
    if (caseItem) {
      map.flyTo([caseItem.location.lat, caseItem.location.lng], 15, { animate: true, duration: 1.2 });
    }
  }, [caseItem, map]);
  return null;
};

export const LiveMap: React.FC<LiveMapProps> = ({
  cases,
  officers,
  drones,
  selectedCaseId,
  onSelectCase,
}) => {
  const defaultCenter: [number, number] = [13.0827, 80.2707]; // Chennai Central

  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
  const selectedCase = activeCases.find(c => c.id === selectedCaseId) || (activeCases.length > 0 ? activeCases[0] : null);
  const activeDrones = drones.filter(d => d.status === 'airborne');

  return (
    <div className="relative w-full h-full bg-slate-950">
      <MapContainer
        center={selectedCase ? [selectedCase.location.lat, selectedCase.location.lng] : defaultCenter}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRecenter caseItem={selectedCase} />

        {/* SOS Cases */}
        {activeCases.map((c) => {
          let icon = caseIconUnassigned;
          if (c.status === 'airborne' || c.status === 'on_scene') icon = caseIconAirborne;
          else if (c.status === 'unit_assigned' || c.status === 'verifying') icon = caseIconAssigned;

          return (
            <React.Fragment key={c.id}>
              <Marker
                position={[c.location.lat, c.location.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectCase(c.id),
                }}
              >
                <Popup>
                  <div className="p-1 font-sans">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-2">
                      <span className="font-mono text-xs font-bold text-rose-400">{c.id}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded uppercase font-mono">{c.status}</span>
                    </div>
                    <p className="text-xs font-semibold text-white">{c.reporterName}</p>
                    <p className="text-[11px] text-slate-300 mb-2">{c.address}</p>
                    <button
                      onClick={() => onSelectCase(c.id)}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono py-1 rounded transition-all"
                    >
                      Inspect Case Details
                    </button>
                  </div>
                </Popup>
              </Marker>

              {/* Proximity Radius Ring */}
              <Circle
                center={[c.location.lat, c.location.lng]}
                radius={300}
                pathOptions={{
                  color: c.id === selectedCaseId ? '#06b6d4' : '#ef4444',
                  fillColor: c.id === selectedCaseId ? '#06b6d4' : '#ef4444',
                  fillOpacity: 0.12,
                  dashArray: '4, 8'
                }}
              />
            </React.Fragment>
          );
        })}

        {/* Police Officers */}
        {officers.map((o) => (
          <Marker
            key={o.userId}
            position={[o.location.lat, o.location.lng]}
            icon={officerIcon}
          >
            <Popup>
              <div className="p-1 font-mono">
                <span className="text-xs font-bold text-blue-400 block">{o.badgeId} • {o.name}</span>
                <p className="text-[10px] text-slate-300">{o.vehicle}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Drones */}
        {drones.map((d) => {
          const icon = d.type === 'mother' ? motherDroneIcon : childDroneIcon;
          return (
            <Marker
              key={d.id}
              position={[d.location.lat, d.location.lng]}
              icon={icon}
            >
              <Popup>
                <div className="p-1 font-mono text-xs">
                  <span className="font-bold text-cyan-300 block">{d.name}</span>
                  <span className="text-slate-300 text-[10px]">Alt: {d.altitudeMeters}m | Batt: {d.batteryPct}%</span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Trajectory lines from Mother Drone to Active Case */}
        {selectedCase && activeDrones.map(d => (
          <Polyline
            key={`poly-${d.id}`}
            positions={[
              [d.location.lat, d.location.lng],
              [selectedCase.location.lat, selectedCase.location.lng]
            ]}
            pathOptions={{ color: '#38bdf8', weight: 2, dashArray: '6, 6' }}
          />
        ))}
      </MapContainer>

      {/* Distinct Color Map HUD Legend */}
      <div className="absolute top-4 left-4 bg-slate-900/95 backdrop-blur border border-slate-800 rounded-lg p-3 z-[1000] text-xs font-mono space-y-2 shadow-2xl">
        <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">MAP LEGEND (VIVID CODES)</div>
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-full bg-rose-600 border border-rose-400 shadow-[0_0_8px_#ef4444] animate-pulse" />
          <span className="text-rose-300 font-bold">🔴 Active SOS Pin</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-blue-400 shadow-[0_0_8px_#3b82f6]" />
          <span className="text-blue-300 font-bold">🔵 Police Unit</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-full bg-purple-600 border border-purple-400 shadow-[0_0_8px_#a855f7]" />
          <span className="text-purple-300 font-bold">🟣 Mother Drone Station</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 border border-emerald-400 shadow-[0_0_8px_#10b981]" />
          <span className="text-emerald-300 font-bold">🟢 Child Recon Drone</span>
        </div>
      </div>
    </div>
  );
};
