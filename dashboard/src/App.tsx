import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Header } from './components/Header';
import { LiveMap } from './components/LiveMap';
import { AlertQueue } from './components/AlertQueue';
import { PoliceTracker } from './components/PoliceTracker';
import { DroneControlPanel } from './components/DroneControlPanel';
import { AuditLogModal } from './components/AuditLogModal';
import { SimulatorControls } from './components/SimulatorControls';
import { ConnectedDevicesPanel } from './components/ConnectedDevicesPanel';
import { DashboardAuthScreen, UserSession } from './components/DashboardAuthScreen';
import { SuperAdminModal } from './components/SuperAdminModal';
import { Case, Officer, Drone, AuditLog } from './types';
import { AlertCircle, Navigation, MapPin, Crosshair } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:4000`;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 Day

export function App() {
  const [userSession, setUserSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('nirai_c2_session');
      if (saved) {
        const parsed: UserSession = JSON.parse(saved);
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          localStorage.removeItem('nirai_c2_session');
          return null;
        }
        return parsed;
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  // Real-time GPS state — starts null, NO hardcoded default
  const [operatorLocation, setOperatorLocation] = useState<{ lat: number; lng: number; accuracy?: number; timestamp?: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'locked' | 'denied' | 'unsupported' | 'manual_pick'>('acquiring');

  // Manual location picker state (fallback when GPS denied)
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [cases, setCases] = useState<Case[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [dispatchModalCaseId, setDispatchModalCaseId] = useState<string | null>(null);

  // Ref to hold the latest session for the GPS callback without stale closure
  const sessionRef = useRef(userSession);
  useEffect(() => { sessionRef.current = userSession; }, [userSession]);

  const operatorLocationRef = useRef(operatorLocation);
  useEffect(() => { operatorLocationRef.current = operatorLocation; }, [operatorLocation]);

  // GPS acquisition — uses refs to avoid stale closure on userSession
  const acquireLiveGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unsupported');
      return;
    }
    setGpsStatus('acquiring');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: pos.timestamp
        };
        setOperatorLocation(loc);
        setGpsStatus('locked');
        setShowLocationPicker(false);

        // Persist fresh coords into session via ref
        const sess = sessionRef.current;
        if (sess) {
          const updated = { ...sess, location: loc };
          setUserSession(updated);
          try { localStorage.setItem('nirai_c2_session', JSON.stringify(updated)); } catch (e) {}
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
          // Only show picker if we still have no location at all
          if (!operatorLocationRef.current) {
            setShowLocationPicker(true);
          }
        } else {
          setGpsStatus('acquiring');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []); // no deps — uses refs internally

  // Continuous GPS watcher + session TTL checker
  useEffect(() => {
    const sessionTimer = setInterval(() => {
      const sess = sessionRef.current;
      if (sess?.expiresAt && Date.now() > sess.expiresAt) {
        setUserSession(null);
        setOperatorLocation(null);
        try { localStorage.removeItem('nirai_c2_session'); } catch (e) {}
      }
    }, 30000);

    // Fire initial GPS request
    acquireLiveGps();

    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: pos.timestamp
          };
          setOperatorLocation(loc);
          setGpsStatus('locked');
          setShowLocationPicker(false);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGpsStatus('denied');
            if (!operatorLocationRef.current) {
              setShowLocationPicker(true);
            }
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }

    return () => {
      clearInterval(sessionTimer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [acquireLiveGps]);

  // Handler for when user manually picks location on the map
  const handleManualLocationPick = (lat: number, lng: number) => {
    const loc = { lat, lng, accuracy: 0, timestamp: Date.now() };
    setOperatorLocation(loc);
    setGpsStatus('manual_pick');
    setShowLocationPicker(false);

    const sess = sessionRef.current;
    if (sess) {
      const updated = { ...sess, location: loc };
      setUserSession(updated);
      try { localStorage.setItem('nirai_c2_session', JSON.stringify(updated)); } catch (e) {}
    }
  };

  // Firestore + WS listeners
  useEffect(() => {
    let unsubscribeCases: () => void = () => {};
    let unsubscribeAudit: () => void = () => {};

    try {
      const casesQuery = query(collection(db, 'cases'));
      unsubscribeCases = onSnapshot(casesQuery, (snapshot) => {
        if (!snapshot.empty) {
          const fbCases: Case[] = snapshot.docs.map(d => {
            const data = d.data();
            return {
              id: data.id || d.id,
              reporterUserId: data.reporterUserId || 'usr-mobile',
              reporterName: data.reporterName || 'Civilian User',
              reporterPhone: data.reporterPhone || '+919876543210',
              status: data.status || 'raised',
              location: data.location, // NO hardcoded fallback — use real data only
              address: data.address || 'Emergency SOS Location',
              severityScore: data.severityScore || 5,
              createdAt: data.createdAt || new Date().toISOString(),
              assignedOfficerUserId: data.assignedOfficerUserId || null,
              assignedOfficerName: data.assignedOfficerName || null,
              etaSeconds: data.etaSeconds || null,
              droneId: data.droneId || null,
              verificationNotes: data.verificationNotes || 'Pending operator verification call.',
              mediaUrl: data.mediaUrl || undefined
            } as Case;
          }).filter(c => c.location && typeof c.location.lat === 'number' && typeof c.location.lng === 'number');
          setCases(prev => {
            const fbMap = new Map<string, Case>();
            fbCases.forEach(c => fbMap.set(c.id, c));
            prev.forEach(c => { if (!fbMap.has(c.id)) fbMap.set(c.id, c); });
            const result = Array.from(fbMap.values());
            if (result.length > 0) setSelectedCaseId(p => p || result[0].id);
            return result;
          });
        }
      }, (err) => console.warn('Firebase Cases Sync Warning:', err.message));

      const auditQuery = query(collection(db, 'auditLogs'));
      unsubscribeAudit = onSnapshot(auditQuery, (snapshot) => {
        if (!snapshot.empty) {
          const fbLogs: AuditLog[] = snapshot.docs.map(d => d.data() as AuditLog);
          setAuditLogs(prev => {
            const m = new Map<string, AuditLog>();
            prev.forEach(l => m.set(l.id, l));
            fbLogs.forEach(l => m.set(l.id, l));
            return Array.from(m.values());
          });
        }
      }, (err) => console.warn('Firebase Audit Sync Warning:', err.message));
    } catch (e) {
      console.warn('Firebase listener initialization:', e);
    }

    fetch(`${API_BASE}/v1/drones/fleet`).then(r => r.json()).then(d => { if (d.success) setDrones(d.drones); }).catch(console.error);
    fetch(`${API_BASE}/v1/officers/nearby`).then(r => r.json()).then(d => { if (d.success) setOfficers(d.officers); }).catch(console.error);

    let ws: WebSocket | null = null;
    let reconnectDelay = 1000;
    const MAX_RECONNECT_DELAY = 16000;
    let shouldReconnect = true;

    function connectWs() {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => { setIsConnected(true); reconnectDelay = 1000; };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'INITIAL_STATE') {
            setCases(msg.payload.cases);
            setOfficers(msg.payload.officers);
            setDrones(msg.payload.drones);
            setAuditLogs(msg.payload.auditLogs);
            if (msg.payload.cases.length > 0) setSelectedCaseId(p => p || msg.payload.cases[0].id);
          } else if (msg.type === 'CASE_CREATED') {
            setCases(prev => prev.some(c => c.id === msg.payload.id) ? prev.map(c => c.id === msg.payload.id ? msg.payload : c) : [msg.payload, ...prev]);
            setSelectedCaseId(msg.payload.id);
          } else if (msg.type === 'CASE_UPDATED') {
            setCases(prev => prev.map(c => c.id === msg.payload.id ? msg.payload : c));
          } else if (msg.type === 'OFFICER_LOCATION_UPDATED') {
            setOfficers(prev => prev.map(o => o.userId === msg.payload.userId ? msg.payload : o));
          } else if (msg.type === 'DRONES_UPDATED') {
            setDrones(msg.payload);
          } else if (msg.type === 'DRONE_FRAME_UPDATED') {
            setDrones(prev => prev.map(d => d.id === msg.payload.droneId ? { ...d, streamUrl: msg.payload.streamUrl } : d));
          } else if (msg.type === 'DRONE_TELEMETRY_STREAM') {
            setDrones(prev => prev.map(d => {
              if (d.id === msg.payload.mother.id) return { ...d, location: msg.payload.mother.location, batteryPct: msg.payload.mother.batteryPct, speedKmh: msg.payload.mother.speedKmh, altitudeMeters: msg.payload.mother.altitude };
              if (d.id === msg.payload.child.id) return { ...d, location: msg.payload.child.location, batteryPct: msg.payload.child.batteryPct, speedKmh: msg.payload.child.speedKmh, altitudeMeters: msg.payload.child.altitude };
              return d;
            }));
          } else if (msg.type === 'AUDIT_LOG_ADDED') {
            setAuditLogs(prev => [msg.payload, ...prev]);
          }
        } catch (err) { console.error('WS Parse Error:', err); }
      };
      ws.onclose = () => { setIsConnected(false); if (shouldReconnect) { setTimeout(() => { reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY); connectWs(); }, reconnectDelay); } };
      ws.onerror = () => { ws?.close(); };
    }
    connectWs();

    return () => { shouldReconnect = false; ws?.close(); unsubscribeCases(); unsubscribeAudit(); };
  }, []);

  const selectedCase = cases.find(c => c.id === selectedCaseId) || null;

  const handleVerifyCase = (caseId: string, isFalseAlarm: boolean) => {
    fetch(`${API_BASE}/v1/cases/${caseId}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isFalseAlarm, notes: 'Verified by operator via call-back.' }) });
  };
  const handleAssignOfficer = (caseId: string, officerUserId: string) => {
    fetch(`${API_BASE}/v1/cases/${caseId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ officerUserId }) });
  };
  const handleConfirmDispatch = (caseId: string, motherDroneId: string, airspaceConfirmed: boolean) => {
    fetch(`${API_BASE}/v1/cases/${caseId}/dispatch-drone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motherDroneId, operatorId: 'Op-#4', airspaceConfirmed }) });
    setDispatchModalCaseId(null);
  };
  const handleResolveCase = async (caseId: string) => {
    setCases(prev => prev.filter(c => c.id !== caseId));
    try { await updateDoc(doc(db, 'cases', caseId), { status: 'resolved' }); } catch (err) { try { await deleteDoc(doc(db, 'cases', caseId)); } catch (e) {} }
    fetch(`${API_BASE}/v1/cases/${caseId}/resolve`, { method: 'POST' }).catch(() => {});
  };
  const handleTriggerSOS = (reporterName: string, address: string, lat: number, lng: number) => {
    fetch(`${API_BASE}/v1/sos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reporterName, address, lat, lng }) }).catch(() => {});
  };
  const handleSimulateOfficerMove = () => {
    if (!operatorLocation) return; // No officer sim without a real base location
    const lat = operatorLocation.lat + (Math.random() - 0.5) * 0.01;
    const lng = operatorLocation.lng + (Math.random() - 0.5) * 0.01;
    fetch(`${API_BASE}/v1/officers/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'usr-p1', lat, lng, onDuty: true }) }).catch(() => {});
  };
  const handleClearAllRecords = async () => {
    if (window.confirm('Are you sure you want to ERASE ALL active cases, audit logs, and hardware telemetry from both Cloud Firestore and local server?')) {
      setCases([]); setAuditLogs([]); setSelectedCaseId(null);
      setDrones(prev => prev.map(d => ({ ...d, status: 'docked', altitudeMeters: 0, speedKmh: 0 })));
      try {
        const cs = await getDocs(collection(db, 'cases')); cs.forEach(d => deleteDoc(doc(db, 'cases', d.id)));
        const as2 = await getDocs(collection(db, 'auditLogs')); as2.forEach(d => deleteDoc(doc(db, 'auditLogs', d.id)));
        const ds = await getDocs(collection(db, 'drones')); ds.forEach(d => deleteDoc(doc(db, 'drones', d.id)));
      } catch (err) { console.warn('Firestore purge warning:', err); }
      fetch(`${API_BASE}/v1/cases/clear-all`, { method: 'POST' }).catch(() => {});
      fetch(`${API_BASE}/v1/drones/ground-all`, { method: 'POST' }).catch(() => {});
    }
  };
  const handleCancelCase = async (caseId: string) => {
    if (window.confirm(`Cancel case ${caseId}? This will mark it as false alarm and recall any dispatched units.`)) {
      setCases(prev => prev.filter(c => c.id !== caseId));
      try { await deleteDoc(doc(db, 'cases', caseId)); } catch (err) { try { await setDoc(doc(db, 'cases', caseId), { status: 'false_alarm', cancelledBy: 'operator-c2' }, { merge: true }); } catch (e) {} }
      fetch(`${API_BASE}/v1/cases/${caseId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancelledBy: 'operator-c2' }) }).catch(() => {});
    }
  };

  if (!userSession) {
    return (
      <DashboardAuthScreen
        onLoginSuccess={(session) => {
          setUserSession(session);
          if (session.location) {
            setOperatorLocation(session.location);
            setGpsStatus('locked');
          }
          try { localStorage.setItem('nirai_c2_session', JSON.stringify(session)); } catch (e) {}
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#000000] text-[#f5f5f7]">
      <Header
        cases={cases}
        isConnected={isConnected}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onClearAllRecords={handleClearAllRecords}
        onOpenSuperAdminModal={() => setIsSuperAdminModalOpen(true)}
        session={userSession}
        operatorLocation={operatorLocation}
        gpsStatus={gpsStatus}
        onForceRequestGps={acquireLiveGps}
        onLogout={() => {
          setUserSession(null);
          setOperatorLocation(null);
          try { localStorage.removeItem('nirai_c2_session'); } catch (e) {}
        }}
      />

      {/* GPS denied/unsupported banner — prompt user to pick location manually */}
      {(gpsStatus === 'denied' || gpsStatus === 'unsupported') && !operatorLocation && (
        <div className="bg-[#ff453a]/15 border-b border-[#ff453a]/25 px-6 py-2 flex items-center justify-between text-xs text-[#f5f5f7]">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-[#ff453a]" />
            <span>GPS access was denied. Enable browser location or select your station position on the map.</span>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={acquireLiveGps} className="apple-btn-secondary text-[11px] py-1 px-3 font-medium">Retry GPS</button>
            <button onClick={() => setShowLocationPicker(true)} className="apple-btn-primary text-[11px] py-1 px-3 font-medium">Pick On Map</button>
          </div>
        </div>
      )}

      {/* Manual Location Picker Modal */}
      {showLocationPicker && (
        <LocationPickerModal
          onConfirm={handleManualLocationPick}
          onCancel={() => setShowLocationPicker(false)}
          onRetryGps={acquireLiveGps}
        />
      )}

      <div className="px-6 pt-2 pb-1">
        <ConnectedDevicesPanel
          cases={cases}
          officers={officers}
          drones={drones}
          isConnected={isConnected}
          onClearAll={handleClearAllRecords}
          operatorLocation={operatorLocation}
          gpsStatus={gpsStatus}
        />
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        <div className="lg:col-span-2 h-full overflow-hidden">
          <AlertQueue cases={cases} selectedCaseId={selectedCaseId} onSelectCase={(id) => setSelectedCaseId(id)} onVerifyCase={handleVerifyCase} onOpenDispatchModal={(id) => setDispatchModalCaseId(id)} onCancelCase={handleCancelCase} />
        </div>
        <div className="lg:col-span-8 flex flex-col h-full overflow-hidden">
          <div className="flex-1 relative">
            <LiveMap
              cases={cases}
              officers={officers}
              drones={drones}
              selectedCaseId={selectedCaseId}
              onSelectCase={(id) => setSelectedCaseId(id)}
              operatorLocation={operatorLocation}
              gpsStatus={gpsStatus}
              onForceRequestGps={acquireLiveGps}
            />
          </div>
          <DroneControlPanel drones={drones} selectedCase={selectedCase} dispatchModalCaseId={dispatchModalCaseId} onCloseDispatchModal={() => setDispatchModalCaseId(null)} onConfirmDispatch={handleConfirmDispatch} onResolveCase={handleResolveCase} />
        </div>
        <div className="lg:col-span-2 h-full overflow-hidden">
          <PoliceTracker officers={officers} selectedCase={selectedCase} onAssignOfficer={handleAssignOfficer} />
        </div>
      </div>

      <AuditLogModal isOpen={isAuditModalOpen} onClose={() => setIsAuditModalOpen(false)} logs={auditLogs} />
      <SimulatorControls isOpen={isSimulatorOpen} onClose={() => setIsSimulatorOpen(false)} onTriggerSOS={handleTriggerSOS} onSimulateOfficerMove={handleSimulateOfficerMove} />

      {userSession?.isSuperAdmin && (
        <SuperAdminModal
          isOpen={isSuperAdminModalOpen}
          onClose={() => setIsSuperAdminModalOpen(false)}
          session={userSession}
          drones={drones}
          officers={officers}
          cases={cases}
          selectedZone={selectedZone}
          onSelectZone={(zone) => setSelectedZone(zone)}
          onRecallAllDrones={() => {
            fetch(`${API_BASE}/v1/drones/ground-all`, { method: 'POST' }).catch(() => {});
            setDrones(prev => prev.map(d => ({ ...d, status: 'docked', altitudeMeters: 0, speedKmh: 0 })));
            alert('MASTER OVERRIDE ENGAGED: Grounding signal transmitted to all airborne drones.');
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Manual Location Picker Modal — full-screen map with click-to-pick
// Shown only when GPS is denied/unavailable and no location is set
// ============================================================
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const pickerIcon = L.divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#0f172a;border:3px solid #22d3ee;box-shadow:0 0 20px #06b6d4;color:#22d3ee;font-weight:bold;font-size:12px;">📍</div>`,
  className: 'picker-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function LocationPickerModal({ onConfirm, onCancel, onRetryGps }: { onConfirm: (lat: number, lng: number) => void; onCancel: () => void; onRetryGps: () => void }) {
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xl flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-3xl apple-glass rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-[#2997ff]" />
            <h2 className="apple-headline font-semibold text-sm text-white">Select Station Location</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onRetryGps}
              className="apple-btn-secondary text-[11px] py-1 px-3 flex items-center space-x-1"
            >
              <Navigation className="w-3 h-3 text-[#2997ff]" />
              <span>Retry GPS</span>
            </button>
            <button onClick={onCancel} className="text-white/60 hover:text-white text-base px-2">✕</button>
          </div>
        </div>

        <div className="px-5 py-2.5 bg-black/40 border-b border-white/[0.06]">
          <p className="text-xs text-white/80">
            Click on the map to set your C2 station location for dispatch distance calculations.
          </p>
        </div>

        <div style={{ height: 420 }}>
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPick={(lat, lng) => setPicked({ lat, lng })} />
            {picked && <Marker position={[picked.lat, picked.lng]} icon={pickerIcon} />}
          </MapContainer>
        </div>

        <div className="px-5 py-3 border-t border-white/[0.08] bg-black/40 flex items-center justify-between">
          {picked ? (
            <div className="text-xs text-[#30d158] apple-tabular">
              <span className="text-[#86868b] mr-1">Selected:</span>
              {picked.lat.toFixed(6)}°N, {picked.lng.toFixed(6)}°E
            </div>
          ) : (
            <div className="text-xs text-[#ff9f0a]">
              Click anywhere on the map to set position...
            </div>
          )}
          <button
            disabled={!picked}
            onClick={() => { if (picked) onConfirm(picked.lat, picked.lng); }}
            className="apple-btn-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs py-2 px-5 flex items-center space-x-1.5"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Confirm Location</span>
          </button>
        </div>
      </div>
    </div>
  );
}
