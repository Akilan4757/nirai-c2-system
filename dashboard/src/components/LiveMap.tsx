import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, Polygon, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Case, Officer, Drone } from '../types';
import { theme } from '../theme';

interface LiveMapProps {
  cases: Case[];
  officers: Officer[];
  drones: Drone[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
}

// Utility to check Red Zone collision
export const checkRedZoneCollision = (lat: number, lng: number): boolean => {
  // Red zone covers longitude 80.275 to 80.300 and latitude 13.085 to 13.105
  return lat >= 13.085 && lat <= 13.105 && lng >= 80.275 && lng <= 80.300;
};

// Custom Leaflet Icons using theme tokens
const createSvgIcon = (bgColor: string, borderColor: string, symbol: string, isPulsing: boolean = false) => {
  const pulseHtml = isPulsing 
    ? `<div style="position:absolute; inset:-6px; border-radius:9999px; background-color:${borderColor}; opacity:0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` 
    : '';
  const svg = `
    <div style="position:relative; display:flex; align-items:center; justify-content:center; width:38px; height:38px; border-radius:9999px; background-color:${bgColor}; border:3px solid ${borderColor}; box-shadow: 0 0 12px ${borderColor}; color:white; font-weight:bold; font-family:${theme.typography.fontMono}; font-size:10px; text-shadow:0 1px 2px rgba(0,0,0,0.8);">
      ${pulseHtml}
      <span style="position:relative; z-index:10;">${symbol}</span>
    </div>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-map-icon',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
};

// Distinct Map Markers using theme colors
const caseIconUnassigned = createSvgIcon(theme.colors.background.surface, theme.colors.status.critical, 'SOS', true);
const caseIconAssigned = createSvgIcon(theme.colors.background.surface, theme.colors.status.warning, 'SOS');
const caseIconAirborne = createSvgIcon(theme.colors.background.surface, theme.colors.telemetry.droneCyan, 'AIR');
const officerIcon = createSvgIcon(theme.colors.background.surface, theme.colors.status.info, 'POL');
const motherDroneIcon = createSvgIcon(theme.colors.background.surface, theme.colors.telemetry.motherPurple, 'MD');
const childDroneIcon = createSvgIcon(theme.colors.background.surface, theme.colors.status.nominal, 'CD');

// Resize handle icon (small cyan dot)
const resizeHandleIcon = L.divIcon({
  html: `<div style="width: 14px; height: 14px; background-color: ${theme.colors.telemetry.droneCyan}; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.5);"></div>`,
  className: 'resize-handle-icon',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Custom component to manage map centering and viewport resets
const MapRecenter = ({ caseItem }: { caseItem: Case | null }) => {
  const map = useMap();
  useEffect(() => {
    if (caseItem) {
      map.flyTo([caseItem.location.lat, caseItem.location.lng], 15, { animate: true, duration: 1.2 });
    }
  }, [caseItem, map]);
  return null;
};

// Helper to generate a multi-segment mock route
const generateMockRoute = (start: [number, number], end: [number, number]): [number, number][] => {
  const mid1: [number, number] = [start[0], start[1] + (end[1] - start[1]) * 0.4];
  const mid2: [number, number] = [end[0] - (end[0] - start[0]) * 0.3, mid1[1]];
  const points: [number, number][] = [start, mid1, mid2, end];
  
  // Interpolate more coordinates for smooth polyline animation
  const interpolated: [number, number][] = [];
  const segments = points.length - 1;
  const stepsPerSegment = 5;

  for (let s = 0; s < segments; s++) {
    const sStart = points[s];
    const sEnd = points[s + 1];
    for (let i = 0; i < stepsPerSegment; i++) {
      const t = i / stepsPerSegment;
      interpolated.push([
        sStart[0] + (sEnd[0] - sStart[0]) * t,
        sStart[1] + (sEnd[1] - sStart[1]) * t
      ]);
    }
  }
  interpolated.push(end);
  return interpolated;
};

export const LiveMap: React.FC<LiveMapProps> = ({
  cases,
  officers,
  drones,
  selectedCaseId,
  onSelectCase,
}) => {
  const defaultCenter: [number, number] = [13.0827, 80.2707]; // Fallback: Chennai Central
  const [deviceCenter, setDeviceCenter] = useState<[number, number]>(defaultCenter);
  const [hudCollapsed, setHudCollapsed] = useState(false);

  // Request device geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDeviceCenter([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          console.warn('Geolocation denied — using default center');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
  const selectedCase = activeCases.find(c => c.id === selectedCaseId) || (activeCases.length > 0 ? activeCases[0] : null);
  const activeDrones = drones.filter(d => d.status === 'airborne');
  const hasActiveCases = activeCases.length > 0;

  // Overlay visibility toggles
  const [showRedZone, setShowRedZone] = useState(true);
  const [showYellowZone, setShowYellowZone] = useState(true);
  const [showGreenZone, setShowGreenZone] = useState(true);

  // Dynamic state for active geofence sizes
  const [geofenceRadii, setGeofenceRadii] = useState<Record<string, number>>({});
  
  // Animated Polyline paths map: key = droneId
  const [animatedPaths, setAnimatedPaths] = useState<Record<string, [number, number][]>>({});
  const animationIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // Debounced server broadcast helper
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const triggerDebouncedQuery = (caseId: string, radius: number) => {
    if (debounceTimers.current[caseId]) {
      clearTimeout(debounceTimers.current[caseId]);
    }
    debounceTimers.current[caseId] = setTimeout(() => {
      console.log(`Server Broadcast: Proximity query recalculated for case ${caseId} at radius ${Math.round(radius)}m`);
    }, 800);
  };

  // Polyline drawing animation logic
  useEffect(() => {
    if (!selectedCase) return;

    activeDrones.forEach(d => {
      const targetRoute = generateMockRoute(
        [d.location.lat, d.location.lng],
        [selectedCase.location.lat, selectedCase.location.lng]
      );
      
      let stepIndex = 0;
      if (animationIntervals.current[d.id]) {
        clearInterval(animationIntervals.current[d.id]);
      }

      const interval = setInterval(() => {
        if (stepIndex <= targetRoute.length) {
          setAnimatedPaths(prev => ({
            ...prev,
            [d.id]: targetRoute.slice(0, stepIndex + 1)
          }));
          stepIndex++;
        } else {
          clearInterval(interval);
        }
      }, 50);

      animationIntervals.current[d.id] = interval;
    });

    return () => {
      Object.values(animationIntervals.current).forEach(clearInterval);
    };
  }, [selectedCaseId, drones]);

  // Airspace Zone definitions
  const airspaceZones = {
    red: {
      bounds: [[13.085, 80.275], [13.105, 80.275], [13.105, 80.300], [13.085, 80.300]] as [number, number][],
      name: 'Chennai Port Air Command (Z-RED-04)',
      authority: 'AAI & Indian Navy (INS Adyar)',
      ceiling: '0m AGL (Strict No-Fly Zone)'
    },
    yellow: {
      bounds: [[13.060, 80.220], [13.080, 80.220], [13.080, 80.255], [13.060, 80.255]] as [number, number][],
      name: 'AAI Controlled Airspace (Z-YEL-12)',
      authority: 'Chennai ATC (MADRAS RADIO)',
      ceiling: '60m AGL'
    },
    green: {
      bounds: [[13.045, 80.260], [13.060, 80.260], [13.060, 80.285], [13.045, 80.285]] as [number, number][],
      name: 'Chennai Central Recreational airspace (Z-GRN-09)',
      authority: 'DGCA Digital Sky Autopilot Portal',
      ceiling: '120m AGL'
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-950">
      <MapContainer
        center={selectedCase ? [selectedCase.location.lat, selectedCase.location.lng] : deviceCenter}
        zoom={selectedCase ? 15 : 13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRecenter caseItem={selectedCase} />

        {/* DGCA Airspace Overlays */}
        {showRedZone && (
          <Polygon
            positions={airspaceZones.red.bounds}
            pathOptions={{ color: theme.colors.status.critical, fillColor: theme.colors.status.critical, fillOpacity: 0.15, weight: 1.5 }}
          >
            <Tooltip sticky>
              <div className="p-1 font-mono text-[11px] text-slate-100 bg-slate-900 border border-slate-700 rounded shadow-md">
                <span className="font-bold text-rose-400 block">{airspaceZones.red.name}</span>
                <span>Auth: {airspaceZones.red.authority}</span>
                <span className="block font-bold mt-1 text-red-500">Ceiling: {airspaceZones.red.ceiling}</span>
              </div>
            </Tooltip>
          </Polygon>
        )}

        {showYellowZone && (
          <Polygon
            positions={airspaceZones.yellow.bounds}
            pathOptions={{ color: theme.colors.status.warning, fillColor: theme.colors.status.warning, fillOpacity: 0.12, weight: 1.5 }}
          >
            <Tooltip sticky>
              <div className="p-1 font-mono text-[11px] text-slate-100 bg-slate-900 border border-slate-700 rounded shadow-md">
                <span className="font-bold text-amber-400 block">{airspaceZones.yellow.name}</span>
                <span>Auth: {airspaceZones.yellow.authority}</span>
                <span className="block font-bold mt-1 text-amber-500">Ceiling: {airspaceZones.yellow.ceiling}</span>
              </div>
            </Tooltip>
          </Polygon>
        )}

        {showGreenZone && (
          <Polygon
            positions={airspaceZones.green.bounds}
            pathOptions={{ color: theme.colors.status.nominal, fillColor: theme.colors.status.nominal, fillOpacity: 0.08, weight: 1.5 }}
          >
            <Tooltip sticky>
              <div className="p-1 font-mono text-[11px] text-slate-100 bg-slate-900 border border-slate-700 rounded shadow-md">
                <span className="font-bold text-emerald-400 block">{airspaceZones.green.name}</span>
                <span>Auth: {airspaceZones.green.authority}</span>
                <span className="block font-bold mt-1 text-emerald-500">Ceiling: {airspaceZones.green.ceiling}</span>
              </div>
            </Tooltip>
          </Polygon>
        )}

        {/* SOS Cases */}
        {activeCases.map((c) => {
          let icon = caseIconUnassigned;
          if (c.status === 'airborne' || c.status === 'on_scene') icon = caseIconAirborne;
          else if (c.status === 'unit_assigned' || c.status === 'verifying') icon = caseIconAssigned;

          const currentRadius = geofenceRadii[c.id] || 300;
          const insideRedZone = checkRedZoneCollision(c.location.lat, c.location.lng);

          // Draggable edge handle: Positioned east of circle center
          const lngOffset = currentRadius / (111320 * Math.cos(c.location.lat * Math.PI / 180));
          const handlePosition: [number, number] = [c.location.lat, c.location.lng + lngOffset];

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
                  <div className="p-2 font-sans w-64 bg-slate-900 text-slate-100 rounded border border-slate-700">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-2">
                      <span className="font-mono text-xs font-bold text-rose-400">{c.id}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded uppercase font-mono">{c.status}</span>
                    </div>
                    <p className="text-xs font-semibold text-white">{c.reporterName}</p>
                    <p className="text-[11px] text-slate-300 mb-2">{c.address}</p>
                    
                    {insideRedZone && (
                      <div className="mb-2 bg-red-950/70 border border-red-500/40 text-red-300 font-mono text-[10px] px-2 py-1 rounded flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                        <span>Blocked: Restricted Airspace</span>
                      </div>
                    )}

                    <button
                      onClick={() => onSelectCase(c.id)}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono py-1 rounded transition-all"
                    >
                      Inspect Case Details
                    </button>
                  </div>
                </Popup>
              </Marker>

              {/* Draggable Geofence Circle */}
              <Circle
                center={[c.location.lat, c.location.lng]}
                radius={currentRadius}
                pathOptions={{
                  color: insideRedZone 
                    ? theme.colors.status.critical 
                    : (c.id === selectedCaseId ? theme.colors.telemetry.droneCyan : theme.colors.status.critical),
                  fillColor: insideRedZone 
                    ? theme.colors.status.critical 
                    : (c.id === selectedCaseId ? theme.colors.telemetry.droneCyan : theme.colors.status.critical),
                  fillOpacity: 0.12,
                  dashArray: insideRedZone ? '2, 4' : '4, 8'
                }}
              >
                <Tooltip permanent direction="top" opacity={0.8} className="custom-radius-tooltip">
                  <span className="font-mono font-bold text-[9px] bg-slate-950/90 text-cyan-300 border border-slate-700 px-1.5 py-0.5 rounded">
                    {Math.round(currentRadius)}m Proximity Geofence
                  </span>
                </Tooltip>
              </Circle>

              {/* Draggable Handle on Geofence Edge (Only for selected case) */}
              {c.id === selectedCaseId && (
                <Marker
                  position={handlePosition}
                  icon={resizeHandleIcon}
                  draggable={true}
                  eventHandlers={{
                    drag: (e) => {
                      const markerLatLng = e.target.getLatLng();
                      const distance = L.latLng(c.location.lat, c.location.lng).distanceTo(markerLatLng);
                      // Constrain radius between 100m and 1200m
                      const constrained = Math.max(100, Math.min(1200, distance));
                      setGeofenceRadii(prev => ({
                        ...prev,
                        [c.id]: constrained
                      }));
                    },
                    dragend: () => {
                      triggerDebouncedQuery(c.id, currentRadius);
                    }
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Police Officers — only show when active cases exist */}
        {hasActiveCases && officers.map((o) => (
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

        {/* Drones — only show when active cases exist */}
        {hasActiveCases && drones.map((d) => {
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

        {/* Animated Trajectory lines from Mother Drone to Active Case */}
        {selectedCase && activeDrones.map(d => {
          const pathCoords = animatedPaths[d.id] || [[d.location.lat, d.location.lng]];
          return (
            <Polyline
              key={`poly-${d.id}`}
              positions={pathCoords}
              pathOptions={{ 
                color: theme.colors.telemetry.droneCyan, 
                weight: 3, 
                dashArray: '3, 4'
              }}
            />
          );
        })}
      </MapContainer>

      {/* Control Room Map HUD Overlay — Collapsible */}
      <div className={`absolute top-3 left-3 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl z-[1000] text-xs font-mono shadow-2xl transition-all ${hudCollapsed ? 'w-auto' : 'w-56'}`}>
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer select-none hover:bg-slate-800/50 rounded-t-xl"
          onClick={() => setHudCollapsed(!hudCollapsed)}
        >
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">MAP CONTROLS</span>
          <span className="text-slate-500 text-[10px]">{hudCollapsed ? '▶' : '▼'}</span>
        </div>

        {!hudCollapsed && (
          <div className="px-3 pb-3 space-y-3">
            {/* Color codes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-rose-400 shadow-[0_0_6px_#ef4444]" />
                  <span className="text-rose-300 font-bold text-[11px]">SOS Incident</span>
                </div>
                {selectedCase && checkRedZoneCollision(selectedCase.location.lat, selectedCase.location.lng) && (
                  <span className="text-[8px] bg-red-950 text-red-400 px-1 border border-red-800 rounded font-bold animate-pulse">COLLISION</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-blue-400 shadow-[0_0_6px_#3b82f6]" />
                <span className="text-blue-300 font-bold text-[11px]">Police Unit</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-600 border border-purple-400 shadow-[0_0_6px_#a855f7]" />
                <span className="text-purple-300 font-bold text-[11px]">Mother Drone</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-emerald-400 shadow-[0_0_6px_#10b981]" />
                <span className="text-emerald-300 font-bold text-[11px]">Child Drone</span>
              </div>
            </div>

            {/* Airspace Overlay Toggles */}
            <div className="border-t border-slate-800 pt-2.5 space-y-1.5">
              <span className="text-slate-400 text-[9px] uppercase font-bold block">DGCA Airspaces</span>
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer hover:text-white">
                <input type="checkbox" checked={showRedZone} onChange={() => setShowRedZone(!showRedZone)} className="rounded bg-slate-950 border-slate-800 text-rose-500 focus:ring-0 w-3 h-3" />
                <span className="text-rose-400 font-semibold text-[10px]">Red Zone</span>
              </label>
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer hover:text-white">
                <input type="checkbox" checked={showYellowZone} onChange={() => setShowYellowZone(!showYellowZone)} className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0 w-3 h-3" />
                <span className="text-amber-400 font-semibold text-[10px]">Yellow Zone</span>
              </label>
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer hover:text-white">
                <input type="checkbox" checked={showGreenZone} onChange={() => setShowGreenZone(!showGreenZone)} className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0 w-3 h-3" />
                <span className="text-emerald-400 font-semibold text-[10px]">Green Zone</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
