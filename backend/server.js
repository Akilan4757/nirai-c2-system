import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import crypto from 'crypto';
import { db } from './firebaseAdmin.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- In-Memory Database State ---
// Baseline reference location: Chennai Central (13.0827, 80.2707)

const state = {
  users: [
    { id: 'usr-c1', phone: '+919876543210', role: 'civilian', name: 'Priya Sharma' },
    { id: 'usr-p1', phone: '+919876543211', role: 'police', name: 'Insp. R. Arumugam', badgeId: 'TNP-4029' },
    { id: 'usr-p2', phone: '+919876543212', role: 'police', name: 'Sub-Insp. K. Valli', badgeId: 'TNP-4088' },
    { id: 'usr-p3', phone: '+919876543213', role: 'police', name: 'Officer M. Suresh', badgeId: 'TNP-5102' }
  ],
  officers: [
    {
      userId: 'usr-p1',
      name: 'Insp. R. Arumugam',
      badgeId: 'TNP-4029',
      onDuty: true,
      vehicle: 'Patrol Car #04',
      location: { lat: 13.0850, lng: 80.2740 },
      lastHeartbeat: new Date().toISOString()
    },
    {
      userId: 'usr-p2',
      name: 'Sub-Insp. K. Valli',
      badgeId: 'TNP-4088',
      onDuty: true,
      vehicle: 'Beat Bike #12',
      location: { lat: 13.0780, lng: 80.2680 },
      lastHeartbeat: new Date().toISOString()
    },
    {
      userId: 'usr-p3',
      name: 'Officer M. Suresh',
      badgeId: 'TNP-5102',
      onDuty: false,
      vehicle: 'Patrol Car #09',
      location: { lat: 13.0910, lng: 80.2800 },
      lastHeartbeat: new Date().toISOString()
    }
  ],
  drones: [
    {
      id: 'drone-m1',
      name: 'Mother Alpha (Station Dock 1)',
      type: 'mother',
      status: 'docked',
      batteryPct: 98,
      altitudeMeters: 0,
      speedKmh: 0,
      location: { lat: 13.0827, lng: 80.2707 },
      homeLocation: { lat: 13.0827, lng: 80.2707 },
      children: ['drone-c1', 'drone-c2']
    },
    {
      id: 'drone-c1',
      name: 'Child Recon-1',
      type: 'child',
      status: 'docked',
      batteryPct: 100,
      altitudeMeters: 0,
      speedKmh: 0,
      parentMotherId: 'drone-m1',
      location: { lat: 13.0827, lng: 80.2707 },
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    },
    {
      id: 'drone-c2',
      name: 'Child Recon-2',
      type: 'child',
      status: 'docked',
      batteryPct: 100,
      altitudeMeters: 0,
      speedKmh: 0,
      parentMotherId: 'drone-m1',
      location: { lat: 13.0827, lng: 80.2707 },
      streamUrl: null
    }
  ],
  cases: [
    {
      id: 'case-101',
      reporterUserId: 'usr-c1',
      reporterName: 'Priya Sharma',
      reporterPhone: '+919876543210',
      status: 'verifying',
      location: { lat: 13.0875, lng: 80.2790 },
      address: 'Near Central Railway Station, Gate 3, Chennai',
      severityScore: 4,
      createdAt: new Date(Date.now() - 180000).toISOString(),
      assignedOfficerUserId: 'usr-p1',
      assignedOfficerName: 'Insp. R. Arumugam',
      etaSeconds: 240,
      droneId: null,
      verificationNotes: 'Call-back initiated by Operator #4. Reporter confirmed distress.',
      mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=60'
    }
  ],
  auditLogs: [
    {
      id: 'aud-1',
      timestamp: new Date(Date.now() - 180000).toISOString(),
      action: 'SOS_TRIGGERED',
      actor: 'Priya Sharma (+919876543210)',
      target: 'case-101',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    },
    {
      id: 'aud-2',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      action: 'OFFICER_ASSIGNED',
      actor: 'Operator #4 (SPMCR)',
      target: 'case-101 (Assigned: Insp. R. Arumugam)',
      hash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'
    }
  ]
};

// --- Helper Functions ---
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function syncToFirebase(coll, id, data) {
  try {
    if (!db) return;
    db.collection(coll).doc(id).set(data, { merge: true }).catch(err => {
      // Gracefully log warning without crashing
    });
  } catch (err) {
    // Gracefully catch sync error
  }
}

function logAudit(action, actor, target) {
  const timestamp = new Date().toISOString();
  const rawString = `${timestamp}:${action}:${actor}:${target}`;
  const hashHex = crypto.createHash('sha256').update(rawString).digest('hex');

  const logEntry = {
    id: `aud-${Date.now()}`,
    timestamp,
    action,
    actor,
    target,
    hash: hashHex
  };
  state.auditLogs.unshift(logEntry);
  broadcast('AUDIT_LOG_ADDED', logEntry);
  syncToFirebase('auditLogs', logEntry.id, logEntry);
}

// --- WebSocket Gateway ---
wss.on('connection', ws => {
  ws.send(JSON.stringify({
    type: 'INITIAL_STATE',
    payload: {
      cases: state.cases,
      officers: state.officers,
      drones: state.drones,
      auditLogs: state.auditLogs
    }
  }));

  ws.on('message', msg => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (e) {
      console.error('Invalid WS message:', e);
    }
  });
});

// --- REST API Endpoints ---

// Root Index Endpoint (Fixes "Cannot GET /")
app.get('/', (req, res) => {
  res.json({
    system: 'NIRAI — Networked Intelligent Rapid-response & AI-driven Infrastructure',
    version: '1.0 MVP',
    status: 'online',
    architectureDoc: 'NIRAI_Project_Architecture.md',
    endpoints: {
      health: 'GET /health',
      auth: ['POST /v1/auth/otp/request', 'POST /v1/auth/otp/verify'],
      sos: 'POST /v1/sos',
      cases: ['GET /v1/cases', 'GET /v1/cases/:id', 'POST /v1/cases/:id/verify', 'POST /v1/cases/:id/assign', 'POST /v1/cases/:id/dispatch-drone', 'POST /v1/cases/:id/resolve'],
      officers: ['GET /v1/officers/nearby', 'POST /v1/officers/location', 'POST /v1/officers/:id/duty'],
      drones: ['GET /v1/drones/fleet', 'POST /v1/drones/:id/recall'],
      geo: 'GET /v1/geo/nearby'
    },
    wsGateway: `ws://${req.headers.host || 'localhost:4000'}`
  });
});

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', system: 'NIRAI Command & Control Backend', time: new Date().toISOString() });
});

// Auth OTP Request & Verify Mock
app.post('/v1/auth/otp/request', (req, res) => {
  const { phone } = req.body;
  res.json({ success: true, message: `OTP sent to ${phone}`, reqId: `req-${Date.now()}` });
});

app.post('/v1/auth/otp/verify', (req, res) => {
  const { phone, code, role } = req.body;
  const user = state.users.find(u => u.phone === phone) || {
    id: `usr-${Date.now()}`,
    phone,
    role: role || 'civilian',
    name: role === 'police' ? 'Officer (New)' : 'Civilian User'
  };
  res.json({
    success: true,
    token: `jwt-token-mock-${user.id}`,
    user
  });
});

// Raise SOS (Civilian Mode trigger)
app.post('/v1/sos', (req, res) => {
  const { lat, lng, address, reporterName, reporterPhone, mediaUrl } = req.body;

  const newCase = {
    id: `case-${Date.now().toString().slice(-4)}`,
    reporterUserId: 'usr-c1',
    reporterName: reporterName || 'Anonymous Citizen',
    reporterPhone: reporterPhone || '+919000000000',
    status: 'raised',
    location: {
      lat: lat ? parseFloat(lat) : 13.085 + (Math.random() - 0.5) * 0.02,
      lng: lng ? parseFloat(lng) : 80.275 + (Math.random() - 0.5) * 0.02
    },
    address: address || 'Mount Road near Anna Flyover, Chennai',
    severityScore: 5,
    createdAt: new Date().toISOString(),
    assignedOfficerUserId: null,
    assignedOfficerName: null,
    etaSeconds: null,
    droneId: null,
    verificationNotes: 'Pending operator verification call.',
    mediaUrl: mediaUrl || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=60'
  };

  state.cases.unshift(newCase);
  logAudit('SOS_TRIGGERED', newCase.reporterName, newCase.id);
  broadcast('CASE_CREATED', newCase);

  res.status(201).json({ success: true, case: newCase });
});

// Get Active Cases
app.get('/v1/cases', (req, res) => {
  res.json({ success: true, cases: state.cases });
});

// Verify Case
app.post('/v1/cases/:id/verify', (req, res) => {
  const { id } = req.params;
  const { isFalseAlarm, notes } = req.body;
  const caseItem = state.cases.find(c => c.id === id);

  if (!caseItem) return res.status(404).json({ error: 'Case not found' });

  if (isFalseAlarm) {
    caseItem.status = 'false_alarm';
    logAudit('CASE_VERIFIED_FALSE_ALARM', 'Operator', id);
  } else {
    caseItem.status = 'verifying';
    caseItem.verificationNotes = notes || 'Verified emergency by control room operator call-back.';
    logAudit('CASE_VERIFIED_VALID', 'Operator', id);
  }

  broadcast('CASE_UPDATED', caseItem);
  res.json({ success: true, case: caseItem });
});

// Get Officers & Rank Nearby
app.get('/v1/officers/nearby', (req, res) => {
  const { lat, lng } = req.query;
  const targetLat = lat ? parseFloat(lat) : 13.0827;
  const targetLng = lng ? parseFloat(lng) : 80.2707;

  const rankedOfficers = state.officers
    .filter(o => o.onDuty)
    .map(officer => {
      const distKm = calculateDistanceKm(targetLat, targetLng, officer.location.lat, officer.location.lng);
      // Rough speed estimate 30 km/h in city traffic -> ~2 mins per km
      const etaSeconds = Math.round(distKm * 120);
      return {
        ...officer,
        distanceKm: parseFloat(distKm.toFixed(2)),
        etaSeconds
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  res.json({ success: true, officers: rankedOfficers });
});

// Assign Police Officer to Case
app.post('/v1/cases/:id/assign', (req, res) => {
  const { id } = req.params;
  const { officerUserId } = req.body;
  const caseItem = state.cases.find(c => c.id === id);
  const officer = state.officers.find(o => o.userId === officerUserId);

  if (!caseItem || !officer) return res.status(404).json({ error: 'Case or Officer not found' });

  const dist = calculateDistanceKm(caseItem.location.lat, caseItem.location.lng, officer.location.lat, officer.location.lng);
  caseItem.status = 'unit_assigned';
  caseItem.assignedOfficerUserId = officer.userId;
  caseItem.assignedOfficerName = officer.name;
  caseItem.etaSeconds = Math.round(dist * 120);

  logAudit('OFFICER_ASSIGNED', `Operator assigned ${officer.name}`, id);
  broadcast('CASE_UPDATED', caseItem);

  res.json({ success: true, case: caseItem });
});

// Operator Confirmed Drone Dispatch (Human-in-the-loop)
app.post('/v1/cases/:id/dispatch-drone', (req, res) => {
  const { id } = req.params;
  const { motherDroneId, operatorId, airspaceConfirmed } = req.body;

  const caseItem = state.cases.find(c => c.id === id);
  const mother = state.drones.find(d => d.id === (motherDroneId || 'drone-m1'));
  const child1 = state.drones.find(d => d.id === 'drone-c1');

  if (!caseItem || !mother) return res.status(404).json({ error: 'Case or Drone not found' });

  if (!airspaceConfirmed) {
    return res.status(400).json({ error: 'Airspace status check must be explicitly verified before launch.' });
  }

  // Update states
  caseItem.status = 'airborne';
  caseItem.droneId = mother.id;

  mother.status = 'airborne';
  mother.altitudeMeters = 85;
  mother.speedKmh = 42;

  child1.status = 'airborne';
  child1.altitudeMeters = 30;
  child1.speedKmh = 28;

  logAudit('DRONE_DISPATCH_CONFIRMED', `Operator ${operatorId || '#1'} confirmed dispatch`, `${mother.name} -> ${caseItem.id}`);
  broadcast('CASE_UPDATED', caseItem);
  broadcast('DRONES_UPDATED', state.drones);

  // Trigger simulated flight path telemetry loop
  startSimulatedDroneFlight(caseItem, mother, child1);

  res.json({ success: true, case: caseItem, mother, child1 });
});

// Resolve Case
app.post('/v1/cases/:id/resolve', (req, res) => {
  const { id } = req.params;
  const caseItem = state.cases.find(c => c.id === id);
  if (!caseItem) return res.status(404).json({ error: 'Case not found' });
  if (caseItem.status === 'resolved' || caseItem.status === 'false_alarm') {
    return res.status(400).json({ error: 'Case already closed' });
  }

  caseItem.status = 'resolved';

  // Cancel flight simulation for this case
  if (flightIntervals.has(id)) {
    clearInterval(flightIntervals.get(id));
    flightIntervals.delete(id);
  }

  // Return only drones assigned to this case to dock
  const assignedDroneId = caseItem.droneId;
  state.drones.forEach(d => {
    if (d.id === assignedDroneId || d.parentMotherId === assignedDroneId ||
        (assignedDroneId && d.type === 'child' && state.drones.find(m => m.id === assignedDroneId)?.children?.includes(d.id))) {
      d.status = 'docked';
      d.altitudeMeters = 0;
      d.speedKmh = 0;
      if (d.homeLocation) d.location = { ...d.homeLocation };
    }
  });

  logAudit('CASE_RESOLVED', 'Operator', id);
  broadcast('CASE_UPDATED', caseItem);
  broadcast('DRONES_UPDATED', state.drones);

  res.json({ success: true, case: caseItem });
});

// Update Officer Duty / Heartbeat
app.post('/v1/officers/location', (req, res) => {
  const { userId, lat, lng, onDuty } = req.body;
  let officer = state.officers.find(o => o.userId === userId);
  if (!officer) {
    officer = {
      userId,
      name: 'Field Officer',
      badgeId: 'TNP-NEW',
      onDuty: true,
      vehicle: 'Patrol Unit',
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      lastHeartbeat: new Date().toISOString()
    };
    state.officers.push(officer);
  } else {
    officer.location = { lat: parseFloat(lat), lng: parseFloat(lng) };
    if (onDuty !== undefined) officer.onDuty = onDuty;
    officer.lastHeartbeat = new Date().toISOString();
  }

  broadcast('OFFICER_LOCATION_UPDATED', officer);
  res.json({ success: true, officer });
});

// Get Single Case Details
app.get('/v1/cases/:id', (req, res) => {
  const caseItem = state.cases.find(c => c.id === req.params.id);
  if (!caseItem) return res.status(404).json({ success: false, error: 'Case not found' });
  const assignedOfficer = state.officers.find(o => o.userId === caseItem.assignedOfficerUserId);
  const drone = state.drones.find(d => d.id === caseItem.droneId);
  res.json({
    success: true,
    case: caseItem,
    assignedOfficer: assignedOfficer || null,
    drone: drone || null
  });
});

// Toggle Officer Duty Status
app.post('/v1/officers/:id/duty', (req, res) => {
  const { onDuty } = req.body;
  let officer = state.officers.find(o => o.userId === req.params.id || o.badgeId === req.params.id);
  if (!officer) return res.status(404).json({ success: false, error: 'Officer not found' });

  officer.onDuty = onDuty !== undefined ? Boolean(onDuty) : !officer.onDuty;
  officer.lastHeartbeat = new Date().toISOString();

  broadcast('OFFICER_LOCATION_UPDATED', officer);
  res.json({ success: true, officer });
});

// Get Drone Fleet
app.get('/v1/drones/fleet', (req, res) => {
  res.json({ success: true, drones: state.drones });
});

// Mobile Drone Node Telemetry Endpoint (Simulated Hardware via Smartphone)
app.post('/v1/drones/telemetry', (req, res) => {
  const { droneId, lat, lng, altitudeMeters, batteryPct, status } = req.body;
  const targetId = droneId || 'drone-c1';
  let drone = state.drones.find(d => d.id === targetId);

  if (!drone) {
    drone = {
      id: targetId,
      name: `Mobile Drone Node (${targetId})`,
      type: 'child',
      status: status || 'airborne',
      batteryPct: batteryPct || 95,
      altitudeMeters: altitudeMeters || 35,
      speedKmh: 32,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    };
    state.drones.push(drone);
  } else {
    drone.location = { lat: parseFloat(lat), lng: parseFloat(lng) };
    if (altitudeMeters !== undefined) drone.altitudeMeters = parseInt(altitudeMeters);
    if (batteryPct !== undefined) drone.batteryPct = parseInt(batteryPct);
    if (status) drone.status = status;
  }

  broadcast('DRONES_UPDATED', state.drones);
  syncToFirebase('drones', drone.id, drone);

  res.json({ success: true, drone });
});

// Erase All Data & Hardware Reset Endpoint
app.post('/v1/cases/clear-all', (req, res) => {
  state.cases = [];
  state.auditLogs = [];
  state.drones.forEach(d => {
    d.status = 'docked';
    d.altitudeMeters = 0;
    d.speedKmh = 0;
    d.location = { lat: 13.0827, lng: 80.2707 };
  });
  broadcast('INITIAL_STATE', {
    cases: state.cases,
    officers: state.officers,
    drones: state.drones,
    auditLogs: state.auditLogs
  });
  logAudit('ERASE_ALL_DATA', 'operator-c2', 'ALL_SYSTEMS');
  res.json({ success: true, message: 'All active records erased and hardware nodes reset.' });
});

// Recall Specific Drone
app.post('/v1/drones/:id/recall', (req, res) => {
  const drone = state.drones.find(d => d.id === req.params.id);
  if (!drone) return res.status(404).json({ success: false, error: 'Drone not found' });

  drone.status = 'docked';
  drone.altitudeMeters = 0;
  drone.speedKmh = 0;
  if (drone.homeLocation) drone.location = { ...drone.homeLocation };

  logAudit('DRONE_RECALLED', 'Operator', drone.id);
  broadcast('DRONES_UPDATED', state.drones);

  res.json({ success: true, drone });
});

// Proximity Geo Radius Query (§15)
app.get('/v1/geo/nearby', (req, res) => {
  const { lat, lng, radius, role } = req.query;
  const centerLat = lat ? parseFloat(lat) : 13.0827;
  const centerLng = lng ? parseFloat(lng) : 80.2707;
  const maxRadiusKm = radius ? parseFloat(radius) / 1000 : 0.5; // default 500m

  const nearbyOfficers = state.officers
    .filter(o => !role || role === 'police' ? o.onDuty : false)
    .map(o => ({
      ...o,
      distanceKm: parseFloat(calculateDistanceKm(centerLat, centerLng, o.location.lat, o.location.lng).toFixed(3))
    }))
    .filter(o => o.distanceKm <= maxRadiusKm);

  const nearbyUsers = state.users
    .filter(u => !role || u.role === role)
    .map(u => ({
      id: u.id,
      role: u.role,
      optInProximity: true,
      distanceMeters: Math.round(Math.random() * 300)
    }));

  res.json({
    success: true,
    center: { lat: centerLat, lng: centerLng },
    radiusMeters: maxRadiusKm * 1000,
    nearbyOfficers,
    nearbyOptedInUsersCount: nearbyUsers.length
  });
});

// --- Simulated Drone Telemetry Service ---
const flightIntervals = new Map();
function startSimulatedDroneFlight(targetCase, mother, child) {
  // Cancel any existing flight sim for this case
  if (flightIntervals.has(targetCase.id)) {
    clearInterval(flightIntervals.get(targetCase.id));
  }

  let step = 0;
  const maxSteps = 20;
  const startLat = mother.homeLocation.lat;
  const startLng = mother.homeLocation.lng;
  const destLat = targetCase.location.lat;
  const destLng = targetCase.location.lng;

  const interval = setInterval(() => {
    step++;
    const progress = Math.min(step / maxSteps, 1);

    // Interpolate coordinates
    mother.location.lat = startLat + (destLat - startLat) * progress;
    mother.location.lng = startLng + (destLng - startLng) * progress;
    mother.batteryPct = Math.max(10, 98 - Math.round(progress * 15));

    child.location.lat = mother.location.lat + (Math.random() - 0.5) * 0.001;
    child.location.lng = mother.location.lng + (Math.random() - 0.5) * 0.001;
    child.batteryPct = Math.max(10, 100 - Math.round(progress * 18));

    if (progress >= 0.8 && targetCase.status === 'airborne') {
      targetCase.status = 'on_scene';
      broadcast('CASE_UPDATED', targetCase);
      logAudit('DRONE_ARRIVED_ON_SCENE', child.name, targetCase.id);
    }

    broadcast('DRONE_TELEMETRY_STREAM', {
      mother: { id: mother.id, location: mother.location, batteryPct: mother.batteryPct, speedKmh: 42, altitude: 85 },
      child: { id: child.id, location: child.location, batteryPct: child.batteryPct, speedKmh: 28, altitude: 25 }
    });

    if (step >= maxSteps) {
      clearInterval(interval);
      flightIntervals.delete(targetCase.id);
    }
  }, 1500);

  flightIntervals.set(targetCase.id, interval);
}

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[NIRAI Backend] Running on http://0.0.0.0:${PORT}`);
  console.log(`[NIRAI WebSocket] Gateway active on ws://0.0.0.0:${PORT}`);
});
