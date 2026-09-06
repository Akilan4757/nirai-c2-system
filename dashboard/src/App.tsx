import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Header } from './components/Header';
import { LiveMap } from './components/LiveMap';
import { AlertQueue } from './components/AlertQueue';
import { PoliceTracker } from './components/PoliceTracker';
import { DroneControlPanel } from './components/DroneControlPanel';
import { IncidentInspectorCard } from './components/IncidentInspectorCard';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { AuditLogModal } from './components/AuditLogModal';
import { SimulatorControls } from './components/SimulatorControls';
import { ConnectedDevicesPanel } from './components/ConnectedDevicesPanel';
import { DashboardAuthScreen, UserSession } from './components/DashboardAuthScreen';
import { SuperAdminModal } from './components/SuperAdminModal';
import { Case, Officer, Drone, AuditLog } from './types';
import { soundFX } from './utils/audioEffects';
import { 
  AlertCircle, 
  Navigation, 
  MapPin, 
  Crosshair, 
  PanelLeft, 
  ShieldCheck, 
  Minimize2, 
  Maximize2, 
  Layers,
  X
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:4000`;

// Picture-in-Picture Drone Optical HUD Window (Liquid Glass)
const FloatingDronePiP: React.FC<{
  drone: Drone;
  onClose?: () => void;
}> = ({ drone, onClose }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="liquid-glass rounded-2xl overflow-hidden shadow-2xl border border-white/[0.14] transition-all select-none animate-slideInRight">
      <div className="px-3 py-1.5 bg-black/40 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff453a] animate-apple-pulse"></span>
          <span className="text-[11px] font-semibold text-white tracking-tight">Recon Feed</span>
          <span className="text-[10px] text-[#2997ff] apple-tabular">{drone.name}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-5 h-5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-[#86868b] hover:text-white text-xs transition-colors"
            title={isMinimized ? "Expand PiP" : "Minimize PiP"}
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-5 h-5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-[#86868b] hover:text-white text-xs transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {!isMinimized && (
        <div className="relative w-64 h-36 bg-black">
          {drone.streamUrl?.startsWith('data:image') ? (
            <img src={drone.streamUrl} alt="Drone Feed" className="w-full h-full object-cover" />
          ) : (
            <video src={drone.streamUrl || undefined} autoPlay loop muted playsInline className="w-full h-full object-cover" />
          )}
          <div className="absolute top-2 left-2 text-[9px] bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full text-[#30d158] border border-white/10 apple-tabular flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#30d158]"></span>
            <span>1080p • {drone.batteryPct}% BAT</span>
          </div>
          <div className="absolute bottom-2 right-2 text-[9px] bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full text-white/90 border border-white/10 apple-tabular">
            {drone.location.lat.toFixed(4)}°, {drone.location.lng.toFixed(4)}°
          </div>
        </div>
      )}
    </div>
  );
};

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

  // Real-time GPS state
  const [operatorLocation, setOperatorLocation] = useState<{ lat: number; lng: number; accuracy?: number; timestamp?: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'locked' | 'denied' | 'unsupported' | 'manual_pick'>('acquiring');
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Core Data States
  const [cases, setCases] = useState<Case[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Spatial Dashboard Controls
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [showPoliceUnitsDrawer, setShowPoliceUnitsDrawer] = useState(false);
  const [showConnectedNodes, setShowConnectedNodes] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(soundFX.getMuted());
  const [showPiPVideo, setShowPiPVideo] = useState(true);

  // Modals
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [dispatchModalCaseId, setDispatchModalCaseId] = useState<string | null>(null);

  // Refs
  const sessionRef = useRef(userSession);
  useEffect(() => { sessionRef.current = userSession; }, [userSession]);

  const operatorLocationRef = useRef(operatorLocation);
  useEffect(() => { operatorLocationRef.current = operatorLocation; }, [operatorLocation]);

  const knownCaseIdsRef = useRef<Set<string>>(new Set());

  // GPS acquisition
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
          if (!operatorLocationRef.current) {
            setShowLocationPicker(true);
          }
        } else {
          setGpsStatus('acquiring');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

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

  // Handler for manual location pick
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

  // Firestore + WebSocket listeners
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
              location: data.location,
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

          // Sensory chime on newly arrived SOS
          fbCases.forEach(c => {
            if (!knownCaseIdsRef.current.has(c.id) && c.status === 'raised') {
              soundFX.playSosChime();
            }
            knownCaseIdsRef.current.add(c.id);
          });

          setCases(prev => {
            const fbMap = new Map<string, Case>();
            fbCases.forEach(c => fbMap.set(c.id, c));
            prev.forEach(c => { if (!fbMap.has(c.id)) fbMap.set(c.id, c); });
            return Array.from(fbMap.values());
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
          } else if (msg.type === 'CASE_CREATED') {
            soundFX.playSosChime();
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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Command + K or Ctrl + K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        soundFX.playClickTick();
        return;
      }

      // [ -> Toggle Left Drawer
      if (e.key === '[') {
        e.preventDefault();
        setIsLeftSidebarOpen(prev => !prev);
        soundFX.playClickTick();
        return;
      }

      // Esc -> Deselect incident or close open modal
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
        else if (isAuditModalOpen) setIsAuditModalOpen(false);
        else if (isSimulatorOpen) setIsSimulatorOpen(false);
        else if (isSuperAdminModalOpen) setIsSuperAdminModalOpen(false);
        else if (showPoliceUnitsDrawer) setShowPoliceUnitsDrawer(false);
        else if (dispatchModalCaseId) setDispatchModalCaseId(null);
        else if (selectedCaseId) setSelectedCaseId(null);
        return;
      }

      // J -> Next incident
      if (e.key.toLowerCase() === 'j') {
        const active = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
        if (active.length > 0) {
          const idx = active.findIndex(c => c.id === selectedCaseId);
          const nextIdx = (idx + 1) % active.length;
          setSelectedCaseId(active[nextIdx].id);
          soundFX.playClickTick();
        }
        return;
      }

      // K -> Previous incident
      if (e.key.toLowerCase() === 'k') {
        const active = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
        if (active.length > 0) {
          const idx = active.findIndex(c => c.id === selectedCaseId);
          const prevIdx = (idx - 1 + active.length) % active.length;
          setSelectedCaseId(active[prevIdx].id);
          soundFX.playClickTick();
        }
        return;
      }

      // D -> Dispatch drone
      if (e.key.toLowerCase() === 'd' && selectedCaseId) {
        setDispatchModalCaseId(selectedCaseId);
        soundFX.playClickTick();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cases, selectedCaseId, isCommandPaletteOpen, isAuditModalOpen, isSimulatorOpen, isSuperAdminModalOpen, showPoliceUnitsDrawer, dispatchModalCaseId]);

  const selectedCase = cases.find(c => c.id === selectedCaseId) || null;
  const activeAirborneDrone = drones.find(d => (d.status === 'airborne' || d.streamUrl) && d.type === 'child');

  const handleVerifyCase = (caseId: string, isFalseAlarm: boolean) => {
    soundFX.playClickTick();
    fetch(`${API_BASE}/v1/cases/${caseId}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isFalseAlarm, notes: 'Verified by operator call.' }) });
  };
  const handleAssignOfficer = (caseId: string, officerUserId: string) => {
    soundFX.playDispatchConfirm();
    fetch(`${API_BASE}/v1/cases/${caseId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ officerUserId }) });
  };
  const handleConfirmDispatch = (caseId: string, motherDroneId: string, airspaceConfirmed: boolean) => {
    soundFX.playDispatchConfirm();
    fetch(`${API_BASE}/v1/cases/${caseId}/dispatch-drone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motherDroneId, operatorId: 'Op-#4', airspaceConfirmed }) });
    setDispatchModalCaseId(null);
  };
  const handleResolveCase = async (caseId: string) => {
    soundFX.playResolveChime();
    setCases(prev => prev.filter(c => c.id !== caseId));
    try { await updateDoc(doc(db, 'cases', caseId), { status: 'resolved' }); } catch (err) { try { await deleteDoc(doc(db, 'cases', caseId)); } catch (e) {} }
    fetch(`${API_BASE}/v1/cases/${caseId}/resolve`, { method: 'POST' }).catch(() => {});
  };
  const handleTriggerSOS = (reporterName: string, address: string, lat: number, lng: number) => {
    soundFX.playSosChime();
    fetch(`${API_BASE}/v1/sos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reporterName, address, lat, lng }) }).catch(() => {});
  };
  const handleSimulateOfficerMove = () => {
    if (!operatorLocation) return;
    const lat = operatorLocation.lat + (Math.random() - 0.5) * 0.01;
    const lng = operatorLocation.lng + (Math.random() - 0.5) * 0.01;
    fetch(`${API_BASE}/v1/officers/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'usr-p1', lat, lng, onDuty: true }) }).catch(() => {});
  };
  const handleClearAllRecords = async () => {
    if (window.confirm('Erase all active cases, audit logs, and hardware telemetry from both Cloud Firestore and server?')) {
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
    if (window.confirm(`Cancel case ${caseId}? This will mark it as false alarm and recall dispatched units.`)) {
      setCases(prev => prev.filter(c => c.id !== caseId));
      try { await deleteDoc(doc(db, 'cases', caseId)); } catch (err) { try { await setDoc(doc(db, 'cases', caseId), { status: 'false_alarm', cancelledBy: 'operator-c2' }, { merge: true }); } catch (e) {} }
      fetch(`${API_BASE}/v1/cases/${caseId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancelledBy: 'operator-c2' }) }).catch(() => {});
    }
  };

  const handleToggleAudio = () => {
    const isMuted = soundFX.toggleMute();
    setIsAudioMuted(isMuted);
    if (!isMuted) soundFX.playClickTick();
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#000000] text-[#f5f5f7] select-none">
      {/* Liquid Glass Navigation Bar */}
      <Header
        cases={cases}
        isConnected={isConnected}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onClearAllRecords={handleClearAllRecords}
        onOpenSuperAdminModal={() => setIsSuperAdminModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        sidebarCollapsed={!isLeftSidebarOpen}
        onToggleSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        isAudioMuted={isAudioMuted}
        onToggleAudio={handleToggleAudio}
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

      {/* GPS denied alert banner */}
      {(gpsStatus === 'denied' || gpsStatus === 'unsupported') && !operatorLocation && (
        <div className="bg-[#ff453a]/15 border-b border-[#ff453a]/25 px-6 py-2 flex items-center justify-between text-xs text-[#f5f5f7] z-30">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-[#ff453a]" />
            <span>GPS access denied. Enable device location or pick station location on map.</span>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={acquireLiveGps} className="apple-btn-secondary text-[11px] py-1 px-3 font-medium">Retry GPS</button>
            <button onClick={() => setShowLocationPicker(true)} className="apple-btn-primary text-[11px] py-1 px-3 font-medium">Pick On Map</button>
          </div>
        </div>
      )}

      {/* Full-Bleed Spatial Map Canvas */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        {/* Layer 0: Map Canvas */}
        <div className="absolute inset-0 z-0">
          <LiveMap
            cases={cases}
            officers={officers}
            drones={drones}
            selectedCaseId={selectedCaseId}
            onSelectCase={(id) => {
              setSelectedCaseId(id);
              setShowPoliceUnitsDrawer(false);
            }}
            operatorLocation={operatorLocation}
            gpsStatus={gpsStatus}
            onForceRequestGps={acquireLiveGps}
          />
        </div>

        {/* Floating Left Drawer: Incident Queue (320px, Liquid Glass) */}
        <aside
          className={`absolute top-3 left-3 bottom-3 z-20 w-80 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ease-out ${
            isLeftSidebarOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-[115%] opacity-0 pointer-events-none'
          }`}
        >
          <AlertQueue
            cases={cases}
            selectedCaseId={selectedCaseId}
            onSelectCase={(id) => {
              setSelectedCaseId(id);
              setShowPoliceUnitsDrawer(false);
            }}
            onVerifyCase={handleVerifyCase}
            onOpenDispatchModal={(id) => setDispatchModalCaseId(id)}
            onCancelCase={handleCancelCase}
          />
        </aside>

        {/* Floating Left Drawer Open Pill (When Drawer is Collapsed) */}
        {!isLeftSidebarOpen && (
          <button
            onClick={() => {
              soundFX.playClickTick();
              setIsLeftSidebarOpen(true);
            }}
            className="absolute top-3 left-3 z-20 liquid-glass-pill rounded-full px-3.5 py-2 shadow-xl flex items-center space-x-2 hover:border-[#2997ff]/60 transition-all cursor-pointer group"
            title="Open Incident Queue ([)"
          >
            <PanelLeft className="w-4 h-4 text-[#2997ff] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-white">Incidents</span>
            <span className="text-[10px] bg-[#ff453a]/20 text-[#ff453a] px-2 py-0.5 rounded-full font-semibold apple-tabular">
              {cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm').length}
            </span>
          </button>
        )}

        {/* Top Floating Action Pill: Mesh Nodes & Patrol Units */}
        <div className="absolute top-3 right-3 z-20 flex items-center space-x-2">
          {/* Patrol Units Toggle Pill */}
          <button
            onClick={() => {
              soundFX.playClickTick();
              setShowPoliceUnitsDrawer(!showPoliceUnitsDrawer);
            }}
            className={`liquid-glass-pill rounded-full px-3.5 py-1.5 shadow-xl flex items-center space-x-2 text-xs font-medium transition-all ${
              showPoliceUnitsDrawer ? 'bg-[#0a84ff]/20 border-[#0a84ff]/50 text-white' : 'text-white/80 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#0a84ff]" />
            <span>Patrol Units</span>
            <span className="bg-white/[0.08] text-white/90 text-[10px] px-1.5 py-0.2 rounded-full font-medium apple-tabular">
              {officers.filter(o => o.onDuty).length}
            </span>
          </button>

          {/* Connected Mesh Nodes Pill */}
          <button
            onClick={() => setShowConnectedNodes(!showConnectedNodes)}
            className="liquid-glass-pill rounded-full px-3 py-1.5 shadow-xl flex items-center space-x-1.5 text-xs font-medium text-white/80 hover:text-white transition-all"
            title="Mesh Nodes"
          >
            <Layers className="w-3.5 h-3.5 text-[#2997ff]" />
            <span className="hidden sm:inline">Mesh</span>
          </button>
        </div>

        {/* Expandable Connected Nodes Modal */}
        {showConnectedNodes && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4 animate-scaleUp">
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
        )}

        {/* Floating Right Drawer: Patrol Units Tracker (Only when explicitly opened) */}
        {showPoliceUnitsDrawer && (
          <aside className="absolute top-12 right-3 bottom-3 z-20 w-80 md:w-84 rounded-3xl overflow-hidden shadow-2xl animate-slideInRight">
            <div className="relative h-full">
              <PoliceTracker
                officers={officers}
                selectedCase={selectedCase}
                onAssignOfficer={handleAssignOfficer}
              />
              <button
                onClick={() => setShowPoliceUnitsDrawer(false)}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/[0.08] hover:bg-white/[0.16] flex items-center justify-center text-[#86868b] hover:text-white transition-all z-30"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </aside>
        )}

        {/* Floating Right Inspector: Incident Inspector Card (Only when an incident is selected) */}
        {selectedCase && !showPoliceUnitsDrawer && (
          <aside className="absolute top-12 right-3 bottom-3 z-20 pointer-events-auto">
            <IncidentInspectorCard
              selectedCase={selectedCase}
              officers={officers}
              drones={drones}
              onClose={() => setSelectedCaseId(null)}
              onVerifyCase={handleVerifyCase}
              onOpenDispatchModal={(id) => setDispatchModalCaseId(id)}
              onAssignOfficer={handleAssignOfficer}
              onResolveCase={handleResolveCase}
              onCancelCase={handleCancelCase}
            />
          </aside>
        )}

        {/* Floating PiP Live Recon Video Feed */}
        {showPiPVideo && activeAirborneDrone && (
          <div className="absolute bottom-20 right-4 z-30">
            <FloatingDronePiP
              drone={activeAirborneDrone}
              onClose={() => setShowPiPVideo(false)}
            />
          </div>
        )}

        {/* Floating Bottom Center: Autonomous Drone Fleet Dock */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-full max-w-4xl px-4 pointer-events-auto">
          <DroneControlPanel
            drones={drones}
            selectedCase={selectedCase}
            dispatchModalCaseId={dispatchModalCaseId}
            onCloseDispatchModal={() => setDispatchModalCaseId(null)}
            onConfirmDispatch={handleConfirmDispatch}
            onResolveCase={handleResolveCase}
          />
        </div>
      </main>

      {/* Command Palette (⌘K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        cases={cases}
        officers={officers}
        drones={drones}
        onSelectCase={(id) => setSelectedCaseId(id)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
        onOpenSuperAdminModal={userSession?.isSuperAdmin ? () => setIsSuperAdminModalOpen(true) : undefined}
        onClearAllRecords={handleClearAllRecords}
        onToggleAudio={handleToggleAudio}
        isMuted={isAudioMuted}
      />

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <LocationPickerModal
          onConfirm={handleManualLocationPick}
          onCancel={() => setShowLocationPicker(false)}
          onRetryGps={acquireLiveGps}
        />
      )}

      {/* Tactical Modals */}
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
// Manual Location Picker Modal (SVG Map Pin, No Emojis)
// ============================================================
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const pickerIcon = L.divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#0071e3;border:2px solid #ffffff;box-shadow:0 0 16px rgba(0,113,227,0.7);color:#ffffff;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: 'picker-icon',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
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
      <div className="w-full max-w-3xl liquid-glass rounded-3xl overflow-hidden shadow-2xl">
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
            <button onClick={onCancel} className="text-[#86868b] hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
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
