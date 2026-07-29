import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { Header } from './components/Header';
import { LiveMap } from './components/LiveMap';
import { AlertQueue } from './components/AlertQueue';
import { PoliceTracker } from './components/PoliceTracker';
import { DroneControlPanel } from './components/DroneControlPanel';
import { AuditLogModal } from './components/AuditLogModal';
import { SimulatorControls } from './components/SimulatorControls';
import { ConnectedDevicesPanel } from './components/ConnectedDevicesPanel';
import { Case, Officer, Drone, AuditLog } from './types';

const API_BASE = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:4000`;

export function App() {
  const [cases, setCases] = useState<Case[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Modals
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [dispatchModalCaseId, setDispatchModalCaseId] = useState<string | null>(null);

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
            const mergedMap = new Map<string, Case>();
            prev.forEach(c => mergedMap.set(c.id, c));
            fbCases.forEach(c => mergedMap.set(c.id, c));
            const result = Array.from(mergedMap.values());
            if (result.length > 0) setSelectedCaseId(prev => prev || result[0].id);
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
        reconnectDelay = 1000; // Reset backoff on successful connect
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
            setCases(prev => [msg.payload, ...prev]);
            setSelectedCaseId(msg.payload.id);
          } else if (msg.type === 'CASE_UPDATED') {
            setCases(prev => prev.map(c => c.id === msg.payload.id ? msg.payload : c));
          } else if (msg.type === 'OFFICER_LOCATION_UPDATED') {
            setOfficers(prev => prev.map(o => o.userId === msg.payload.userId ? msg.payload : o));
          } else if (msg.type === 'DRONES_UPDATED') {
            setDrones(msg.payload);
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

  const handleResolveCase = (caseId: string) => {
    fetch(`${API_BASE}/v1/cases/${caseId}/resolve`, {
      method: 'POST'
    });
  };

  const handleTriggerSOS = (reporterName: string, address: string, lat: number, lng: number) => {
    fetch(`${API_BASE}/v1/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporterName, address, lat, lng })
    });
  };

  const handleSimulateOfficerMove = () => {
    const lat = 13.085 + (Math.random() - 0.5) * 0.01;
    const lng = 80.274 + (Math.random() - 0.5) * 0.01;
    fetch(`${API_BASE}/v1/officers/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-p1', lat, lng, onDuty: true })
    });
  };

  const handleClearAllRecords = async () => {
    if (window.confirm('Are you sure you want to ERASE ALL active cases, audit logs, and hardware telemetry from both Cloud Firestore and local server?')) {
      setCases([]);
      setAuditLogs([]);
      setSelectedCaseId(null);

      try {
        const casesSnap = await getDocs(collection(db, 'cases'));
        casesSnap.forEach(d => deleteDoc(doc(db, 'cases', d.id)));

        const auditSnap = await getDocs(collection(db, 'auditLogs'));
        auditSnap.forEach(d => deleteDoc(doc(db, 'auditLogs', d.id)));
      } catch (err) {
        console.warn('Firestore purge warning:', err);
      }

      fetch(`${API_BASE}/v1/cases/clear-all`, { method: 'POST' }).catch(() => {});
    }
  };

  const handleCancelCase = (caseId: string) => {
    if (window.confirm(`Cancel case ${caseId}? This will mark it as false alarm and recall any dispatched units.`)) {
      fetch(`${API_BASE}/v1/cases/${caseId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelledBy: 'operator-c2' })
      }).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
      <Header
        cases={cases}
        isConnected={isConnected}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onClearAllRecords={handleClearAllRecords}
      />

      <div className="px-6 pt-2 pb-1">
        <ConnectedDevicesPanel
          cases={cases}
          officers={officers}
          drones={drones}
          isConnected={isConnected}
          onClearAll={handleClearAllRecords}
        />
      </div>

      {/* Main Grid View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Alert Queue */}
        <div className="lg:col-span-3 h-full overflow-hidden">
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
        <div className="lg:col-span-6 flex flex-col h-full overflow-hidden">
          <div className="flex-1 relative">
            <LiveMap
              cases={cases}
              officers={officers}
              drones={drones}
              selectedCaseId={selectedCaseId}
              onSelectCase={(id) => setSelectedCaseId(id)}
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
        <div className="lg:col-span-3 h-full overflow-hidden">
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
    </div>
  );
}
