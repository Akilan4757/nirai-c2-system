import React, { useState, useEffect, useCallback } from 'react';
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
import { AlertCircle, Navigation, ShieldCheck } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:4000`;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 Day (24 hours)

export function App() {
  const [userSession, setUserSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('nirai_c2_session');
      if (saved) {
        const parsed: UserSession = JSON.parse(saved);
        // Check 1 day (24h) session expiration
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

  // Real-time GPS Operator State
  const [operatorLocation, setOperatorLocation] = useState<{ lat: number; lng: number; accuracy?: number; timestamp?: number } | null>(() => {
    return userSession?.location || null;
  });
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'locked' | 'denied' | 'unsupported'>('acquiring');
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  const [cases, setCases] = useState<Case[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Modals & Sector Zoning
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [dispatchModalCaseId, setDispatchModalCaseId] = useState<string | null>(null);

  // Real-time GPS continuous high-accuracy acquisition on dashboard entry and refresh
  const acquireLiveGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unsupported');
      setGpsErrorMsg('Browser does not support Geolocation.');
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
        setGpsErrorMsg(null);

        // Update stored session with fresh live coordinates
        if (userSession) {
          const updatedSession = { ...userSession, location: loc };
          setUserSession(updatedSession);
          try {
            localStorage.setItem('nirai_c2_session', JSON.stringify(updatedSession));
          } catch (e) {}
        }
      },
      (err) => {
        console.warn('Geolocation acquisition warning:', err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
          setGpsErrorMsg('Location access was denied. Real-time GPS is required for C2 terminal operations.');
        } else {
          setGpsStatus('acquiring');
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [userSession]);

  // Set up continuous GPS watcher & session 24h validity checker
  useEffect(() => {
    // Check 24-hour expiration periodically
    const sessionCheckTimer = setInterval(() => {
      if (userSession?.expiresAt && Date.now() > userSession.expiresAt) {
        setUserSession(null);
        try { localStorage.removeItem('nirai_c2_session'); } catch (e) {}
      }
    }, 30000);

    // Initial GPS acquisition
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
          setGpsErrorMsg(null);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGpsStatus('denied');
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    }

    return () => {
      clearInterval(sessionCheckTimer);
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  useEffect(() => {
    // Initial fetch
    // Firebase Realtime Firestore Listeners
    let unsubscribeCases: () => void = () => {};
    let unsubscribeAudit: () => void = () => {};

    try {
      const casesQuery = query(collection(db, 'cases'));
      unsubscribeCases = onSnapshot(casesQuery, (snapshot) => {
        if (!snapshot.empty) {
          const fbCases: Case[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: data.id || doc.id,
              reporterUserId: data.reporterUserId || 'usr-mobile',
              reporterName: data.reporterName || 'Civilian User',
              reporterPhone: data.reporterPhone || '+919876543210',
              status: data.status || 'raised',
              location: data.location || { lat: 13.0875, lng: 80.2790 },
              address: data.address || 'Emergency SOS Location',
              severityScore: data.severityScore || 5,
              createdAt: data.createdAt || new Date().toISOString(),
              assignedOfficerUserId: data.assignedOfficerUserId || null,
              assignedOfficerName: data.assignedOfficerName || null,
              etaSeconds: data.etaSeconds || null,
              droneId: data.droneId || null,
              verificationNotes: data.verificationNotes || 'Pending operator verification call.',
              mediaUrl: data.mediaUrl || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=60'
            } as Case;
          });
          setCases(prev => {
            const fbMap = new Map<string, Case>();
            fbCases.forEach(c => fbMap.set(c.id, c));
            prev.forEach(c => {
              if (!fbMap.has(c.id)) fbMap.set(c.id, c);
            });
            const result = Array.from(fbMap.values());
            if (result.length > 0) setSelectedCaseId(prev2 => prev2 || result[0].id);
            return result;
          });
        }
      }, (err) => console.warn('Firebase Cases Sync Warning:', err.message));

      const auditQuery = query(collection(db, 'auditLogs'));
      unsubscribeAudit = onSnapshot(auditQuery, (snapshot) => {
        if (!snapshot.empty) {
          const fbLogs: AuditLog[] = snapshot.docs.map(doc => doc.data() as AuditLog);
          setAuditLogs(prev => {
            const mergedMap = new Map<string, AuditLog>();
            prev.forEach(l => mergedMap.set(l.id, l));
            fbLogs.forEach(l => mergedMap.set(l.id, l));
            return Array.from(mergedMap.values());
          });
        }
      }, (err) => console.warn('Firebase Audit Sync Warning:', err.message));
    } catch (e) {
      console.warn('Firebase listener initialization:', e);
    }

    fetch(`${API_BASE}/v1/drones/fleet`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setDrones(data.drones);
      })
      .catch(console.error);

    fetch(`${API_BASE}/v1/officers/nearby`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setOfficers(data.officers);
      })
      .catch(console.error);

    // WebSocket Client with Reconnection
    let ws: WebSocket | null = null;
    let reconnectDelay = 1000;
    const MAX_RECONNECT_DELAY = 16000;
    let shouldReconnect = true;

    function connectWs() {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectDelay = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'INITIAL_STATE') {
            setCases(msg.payload.cases);
            setOfficers(msg.payload.officers);
            setDrones(msg.payload.drones);
            setAuditLogs(msg.payload.auditLogs);
            if (msg.payload.cases.length > 0) {
              setSelectedCaseId((prev) => prev || msg.payload.cases[0].id);
            }
          } else if (msg.type === 'CASE_CREATED') {
            setCases(prev => {
              if (prev.some(c => c.id === msg.payload.id)) {
                return prev.map(c => c.id === msg.payload.id ? msg.payload : c);
              }
              return [msg.payload, ...prev];
            });
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
              if (d.id === msg.payload.mother.id) {
                return { ...d, location: msg.payload.mother.location, batteryPct: msg.payload.mother.batteryPct, speedKmh: msg.payload.mother.speedKmh, altitudeMeters: msg.payload.mother.altitude };
              }
              if (d.id === msg.payload.child.id) {
                return { ...d, location: msg.payload.child.location, batteryPct: msg.payload.child.batteryPct, speedKmh: msg.payload.child.speedKmh, altitudeMeters: msg.payload.child.altitude };
              }
              return d;
            }));
          } else if (msg.type === 'AUDIT_LOG_ADDED') {
            setAuditLogs(prev => [msg.payload, ...prev]);
          }
        } catch (err) {
          console.error('WS Parse Error:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (shouldReconnect) {
          setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
            connectWs();
          }, reconnectDelay);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connectWs();

    return () => {
      shouldReconnect = false;
      ws?.close();
      unsubscribeCases();
      unsubscribeAudit();
    };
  }, []);

  const selectedCase = cases.find(c => c.id === selectedCaseId) || null;

  // Actions
  const handleVerifyCase = (caseId: string, isFalseAlarm: boolean) => {
    fetch(`${API_BASE}/v1/cases/${caseId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFalseAlarm, notes: 'Verified by operator via call-back.' })
    });
  };

  const handleAssignOfficer = (caseId: string, officerUserId: string) => {
    fetch(`${API_BASE}/v1/cases/${caseId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officerUserId })
    });
  };

  const handleConfirmDispatch = (caseId: string, motherDroneId: string, airspaceConfirmed: boolean) => {
    fetch(`${API_BASE}/v1/cases/${caseId}/dispatch-drone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motherDroneId, operatorId: 'Op-#4', airspaceConfirmed })
    });
    setDispatchModalCaseId(null);
  };

  const handleResolveCase = async (caseId: string) => {
    setCases(prev => prev.filter(c => c.id !== caseId));

    try {
      await updateDoc(doc(db, 'cases', caseId), { status: 'resolved' });
    } catch (err) {
      try {
        await deleteDoc(doc(db, 'cases', caseId));
      } catch (e) {}
    }

    fetch(`${API_BASE}/v1/cases/${caseId}/resolve`, {
      method: 'POST'
    }).catch(() => {});
  };

  const handleTriggerSOS = (reporterName: string, address: string, lat: number, lng: number) => {
    fetch(`${API_BASE}/v1/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporterName, address, lat, lng })
    }).catch(() => {});
  };

  const handleSimulateOfficerMove = () => {
    const baseLat = operatorLocation ? operatorLocation.lat : 13.085;
    const baseLng = operatorLocation ? operatorLocation.lng : 80.274;
    const lat = baseLat + (Math.random() - 0.5) * 0.01;
    const lng = baseLng + (Math.random() - 0.5) * 0.01;
    fetch(`${API_BASE}/v1/officers/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-p1', lat, lng, onDuty: true })
    }).catch(() => {});
  };

  const handleClearAllRecords = async () => {
    if (window.confirm('Are you sure you want to ERASE ALL active cases, audit logs, and hardware telemetry from both Cloud Firestore and local server?')) {
      setCases([]);
      setAuditLogs([]);
      setSelectedCaseId(null);
      setDrones(prev => prev.map(d => ({ ...d, status: 'docked', altitudeMeters: 0, speedKmh: 0 })));

      try {
        const casesSnap = await getDocs(collection(db, 'cases'));
        casesSnap.forEach(d => deleteDoc(doc(db, 'cases', d.id)));

        const auditSnap = await getDocs(collection(db, 'auditLogs'));
        auditSnap.forEach(d => deleteDoc(doc(db, 'auditLogs', d.id)));

        const dronesSnap = await getDocs(collection(db, 'drones'));
        dronesSnap.forEach(d => deleteDoc(doc(db, 'drones', d.id)));
      } catch (err) {
        console.warn('Firestore purge warning:', err);
      }

      fetch(`${API_BASE}/v1/cases/clear-all`, { method: 'POST' }).catch(() => {});
      fetch(`${API_BASE}/v1/drones/ground-all`, { method: 'POST' }).catch(() => {});
    }
  };

  const handleCancelCase = async (caseId: string) => {
    if (window.confirm(`Cancel case ${caseId}? This will mark it as false alarm and recall any dispatched units.`)) {
      setCases(prev => prev.filter(c => c.id !== caseId));

      try {
        await deleteDoc(doc(db, 'cases', caseId));
      } catch (err) {
        try {
          await setDoc(doc(db, 'cases', caseId), { status: 'false_alarm', cancelledBy: 'operator-c2' }, { merge: true });
        } catch (e) {}
      }

      fetch(`${API_BASE}/v1/cases/${caseId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelledBy: 'operator-c2' })
      }).catch(() => {});
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
          try {
            localStorage.setItem('nirai_c2_session', JSON.stringify(session));
          } catch (e) {}
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
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

      {/* GPS Warning Banner if denied */}
      {gpsStatus === 'denied' && (
        <div className="bg-rose-950/80 border-b border-rose-500/50 px-6 py-2 flex items-center justify-between text-xs font-mono text-rose-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>MANDATORY LOCATION REQUIREMENT: Real-time GPS access is denied in browser. Please enable device location for live dispatch calculations.</span>
          </div>
          <button
            onClick={acquireLiveGps}
            className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded font-bold uppercase transition-all"
          >
            GRANT GPS ACCESS
          </button>
        </div>
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

      {/* Main Grid View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Alert Queue */}
        <div className="lg:col-span-2 h-full overflow-hidden">
          <AlertQueue
            cases={cases}
            selectedCaseId={selectedCaseId}
            onSelectCase={(id) => setSelectedCaseId(id)}
            onVerifyCase={handleVerifyCase}
            onOpenDispatchModal={(id) => setDispatchModalCaseId(id)}
            onCancelCase={handleCancelCase}
          />
        </div>

        {/* Center Column: Live Map & Telemetry Bottom Bar */}
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

          <DroneControlPanel
            drones={drones}
            selectedCase={selectedCase}
            dispatchModalCaseId={dispatchModalCaseId}
            onCloseDispatchModal={() => setDispatchModalCaseId(null)}
            onConfirmDispatch={handleConfirmDispatch}
            onResolveCase={handleResolveCase}
          />
        </div>

        {/* Right Column: Police Officers Tracker */}
        <div className="lg:col-span-2 h-full overflow-hidden">
          <PoliceTracker
            officers={officers}
            selectedCase={selectedCase}
            onAssignOfficer={handleAssignOfficer}
          />
        </div>
      </div>

      {/* Modals */}
      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={auditLogs}
      />

      <SimulatorControls
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onTriggerSOS={handleTriggerSOS}
        onSimulateOfficerMove={handleSimulateOfficerMove}
      />

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
