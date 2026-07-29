import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Case, Officer, Drone } from '../types';

interface LiveMapProps {
  cases: Case[];
  officers: Officer[];
  drones: Drone[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
}

// Custom Leaflet Icons using SVG Data URLs
const createSvgIcon = (color: string, symbol: string, isPulsing: boolean = false) => {
  const pulseHtml = isPulsing ? `<div class="absolute -inset-2 rounded-full bg-${color}-500/40 animate-ping"></div>` : '';
  const svg = `
    <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border-2 border-${color} shadow-lg text-white font-bold font-mono text-xs">
      ${pulseHtml}
      <span>${symbol}</span>
    </div>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-map-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const caseIconUnassigned = createSvgIcon('rose-500', 'SOS', true);
const caseIconAssigned = createSvgIcon('amber-500', 'SOS');
const caseIconAirborne = createSvgIcon('cyan-400', 'AIR');
const officerIcon = createSvgIcon('blue-400', 'POL');
const motherDroneIcon = createSvgIcon('purple-400', 'MD');
const childDroneIcon = createSvgIcon('teal-300', 'CD');

export const LiveMap: React.FC<LiveMapProps> = ({
  cases,
  officers,
  drones,
  selectedCaseId,
  onSelectCase,
}) => {
  const defaultCenter: [number, number] = [13.0827, 80.2707]; // Chennai Central

  const selectedCase = cases.find(c => c.id === selectedCaseId);
  const activeDrones = drones.filter(d => d.status === 'airborne');

  return (
    <div className="relative w-full h-full bg-slate-950">
      <MapContainer
        center={defaultCenter}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* SOS Cases */}
        {cases.map((c) => {
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

              {/* 300m Proximity Radius Ring around SOS */}
              <Circle
                center={[c.location.lat, c.location.lng]}
                radius={300}
                pathOptions={{
                  color: c.id === selectedCaseId ? '#06b6d4' : '#ef4444',
                  fillColor: c.id === selectedCaseId ? '#06b6d4' : '#ef4444',
                  fillOpacity: 0.08,
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
              <div className="p-1">
                <span className="font-mono text-xs font-bold text-blue-400 block">{o.badgeId}</span>
                <p className="text-xs font-semibold text-white">{o.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{o.vehicle}</p>
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

      {/* Map HUD Overlay */}
      <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-3 z-[1000] text-xs font-mono space-y-1.5 shadow-xl">
        <div className="text-slate-400 text-[10px] uppercase font-semibold">MAP LEGEND</div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
          <span>Active SOS Pin</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>On-Duty Police Unit</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span>Mother Drone Dock</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-cyan-400" />
          <span>Child Recon Drone</span>
        </div>
      </div>
    </div>
  );
};
