package org.nirai.app.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.nirai.app.network.NiraiApi

@Composable
fun DroneHomeScreen() {
    var droneStatus by remember { mutableStateOf("AIRBORNE_RECON") }
    var altitudeMeters by remember { mutableStateOf(35) }
    var batteryPct by remember { mutableStateOf(92) }
    var speedKmh by remember { mutableStateOf(34) }
    var currentLat by remember { mutableStateOf(13.0875) }
    var currentLng by remember { mutableStateOf(80.2790) }
    var telemetryLog by remember { mutableStateOf("C2 Stream Active | 30fps HUD") }

    val coroutineScope = rememberCoroutineScope()

    // Autonomous Periodic Telemetry Sync to NIRAI C2 Dashboard & Firebase
    LaunchedEffect(Unit) {
        while (true) {
            delay(3000)
            // Small simulated GPS jitter for drone flight path animation
            currentLat += (Math.random() - 0.5) * 0.0003
            currentLng += (Math.random() - 0.5) * 0.0003
            if (batteryPct > 15) batteryPct -= 1

            NiraiApi.updateDroneTelemetry(
                droneId = "drone-c1",
                lat = currentLat,
                lng = currentLng,
                altitudeMeters = altitudeMeters,
                batteryPct = batteryPct,
                status = droneStatus.lowercase()
            )
            telemetryLog = "GPS Ping: ${String.format("%.4f", currentLat)}, ${String.format("%.4f", currentLng)} → C2 Live"
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(16.dp)
    ) {
        // Drone HUD Top Bar
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color(0xFF8B5CF6).copy(alpha = 0.4f), RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            color = Color(0xFF8B5CF6).copy(alpha = 0.2f),
                            shape = CircleShape,
                            modifier = Modifier.size(10.dp)
                        ) {}
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "MOBILE RECON NODE ALPHA (DRONE-C1)",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFA78BFA)
                        )
                    }
                    Text(
                        text = "DGCA NPNT APPROVED",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF10B981)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Telemetry Metrics Grid
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(text = "ALTITUDE", fontSize = 10.sp, color = Color(0xFF94A3B8))
                        Text(text = "${altitudeMeters}m", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                    Column {
                        Text(text = "SPEED", fontSize = 10.sp, color = Color(0xFF94A3B8))
                        Text(text = "${speedKmh} km/h", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color(0xFF38BDF8))
                    }
                    Column {
                        Text(text = "BATTERY", fontSize = 10.sp, color = Color(0xFF94A3B8))
                        Text(text = "${batteryPct}%", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = if (batteryPct > 20) Color(0xFF10B981) else Color(0xFFEF4444))
                    }
                    Column {
                        Text(text = "SIGNAL", fontSize = 10.sp, color = Color(0xFF94A3B8))
                        Text(text = "5G / MESH", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Target Incident Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "ASSIGNED RECON MISSION TARGET", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF43F5E))
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = "Case #101 — Emergency SOS Distress", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Text(text = "Target: Priya Sharma (Central Gate 3)", fontSize = 12.sp, color = Color(0xFF94A3B8))
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "GPS Coordinates: 13.0875 N, 80.2790 E",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF38BDF8)
                )
                Text(text = telemetryLog, fontSize = 10.sp, color = Color(0xFF10B981))
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Simulated Optical Feed HUD Window
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .border(1.dp, Color(0xFF334155), RoundedCornerShape(16.dp))
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(12.dp),
                contentAlignment = Alignment.Center
            ) {
                // HUD Reticle Overlay
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = "[ OPTICAL RECON HUD ACTIVE ]", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF06B6D4))
                    Spacer(modifier = Modifier.height(8.dp))
                    Surface(
                        color = Color.Transparent,
                        modifier = Modifier
                            .size(120.dp)
                            .border(2.dp, Color(0xFF06B6D4).copy(alpha = 0.6f), CircleShape)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(text = "TARGET LOCK\n300m MESH", fontSize = 10.sp, color = Color(0xFF10B981))
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(text = "Live Stream Broadcast → C2 Dashboard (siteon-47a8f)", fontSize = 11.sp, color = Color(0xFF94A3B8))
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Drone Command Control Buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = {
                    droneStatus = "RETURN_TO_HOME"
                    altitudeMeters = 50
                    telemetryLog = "Command Issued: Return to Home (Station Dock 1)"
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706)),
                modifier = Modifier.weight(1f)
            ) {
                Text("RTH RECALL", fontSize = 11.sp, color = Color.White)
            }

            Button(
                onClick = {
                    droneStatus = "HOVER_LOCK"
                    speedKmh = 0
                    telemetryLog = "Command Issued: Emergency Position Hold"
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                modifier = Modifier.weight(1f)
            ) {
                Text("HOVER LOCK", fontSize = 11.sp, color = Color.White)
            }
        }
    }
}
