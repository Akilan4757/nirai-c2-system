package org.nirai.app.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.ActivityCompat
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.nirai.app.network.NiraiApi
import org.nirai.app.ui.components.CameraStreamView

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll

@Composable
fun DroneHomeScreen() {
    val context = LocalContext.current
    var droneStatus by remember { mutableStateOf("AIRBORNE_RECON") }
    var altitudeMeters by remember { mutableStateOf(35) }
    var batteryPct by remember { mutableStateOf(92) }
    var speedKmh by remember { mutableStateOf(34) }
    var telemetryLog by remember { mutableStateOf("Initializing C2 Stream...") }

    val coroutineScope = rememberCoroutineScope()

    // Real GPS for drone position
    var currentLat by remember { mutableStateOf(0.0) }
    var currentLng by remember { mutableStateOf(0.0) }
    var hasGpsFix by remember { mutableStateOf(false) }

    DisposableEffect(Unit) {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val locationListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                currentLat = location.latitude
                currentLng = location.longitude
                hasGpsFix = true
            }
            @Deprecated("Deprecated") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }

        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            locationManager?.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000, 5f, locationListener)
            locationManager?.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2000, 5f, locationListener)
            val lastKnown = locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            lastKnown?.let {
                currentLat = it.latitude
                currentLng = it.longitude
                hasGpsFix = true
            }
        }

        onDispose {
            locationManager?.removeUpdates(locationListener)
        }
    }

    // Periodic telemetry sync
    LaunchedEffect(Unit) {
        while (true) {
            delay(3000)
            if (hasGpsFix) {
                if (batteryPct > 15) batteryPct -= 1

                NiraiApi.updateDroneTelemetry(
                    droneId = "drone-c1",
                    lat = currentLat,
                    lng = currentLng,
                    altitudeMeters = altitudeMeters,
                    batteryPct = batteryPct,
                    status = droneStatus.lowercase()
                )
                telemetryLog = "GPS: ${String.format("%.4f", currentLat)}, ${String.format("%.4f", currentLng)} → C2 Live"
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // Drone HUD Top Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0xFF8B5CF6).copy(alpha = 0.4f), RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(listOf(Color(0xFF8B5CF6), Color(0xFF6D28D9)))
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.FlightTakeoff, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("RECON NODE ALPHA", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFA78BFA))
                            Text("DRONE-C1", fontSize = 10.sp, color = Color(0xFF94A3B8))
                        }
                    }
                    Surface(
                        color = Color(0xFF10B981).copy(alpha = 0.15f),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = "DGCA NPNT",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF10B981),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Telemetry Grid
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    TelemetryCell("ALTITUDE", "${altitudeMeters}m", Color.White)
                    TelemetryCell("SPEED", "${speedKmh} km/h", Color(0xFF38BDF8))
                    TelemetryCell("BATTERY", "${batteryPct}%", if (batteryPct > 20) Color(0xFF10B981) else Color(0xFFEF4444))
                    TelemetryCell("SIGNAL", "5G/MESH", Color(0xFFF59E0B))
                }

                Spacer(modifier = Modifier.height(8.dp))

                // GPS Status
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (hasGpsFix) Icons.Default.MyLocation else Icons.Default.LocationSearching,
                        contentDescription = null,
                        tint = if (hasGpsFix) Color(0xFF10B981) else Color(0xFFF59E0B),
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = telemetryLog,
                        fontSize = 10.sp,
                        color = Color(0xFF10B981)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Mission Target Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.GpsFixed, contentDescription = null, tint = Color(0xFFF43F5E), modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("ASSIGNED RECON MISSION", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF43F5E))
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text("Case #101 — Emergency SOS Distress", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Text("Target: Priya Sharma (Central Gate 3)", fontSize = 12.sp, color = Color(0xFF94A3B8))
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = if (hasGpsFix) "Drone GPS: ${String.format("%.4f", currentLat)} N, ${String.format("%.4f", currentLng)} E" else "Acquiring GPS...",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF38BDF8)
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Camera Feed
        CameraStreamView(
            modifier = Modifier
                .fillMaxWidth()
                .height(240.dp),
            nodeLabel = "RECON DRONE CAMERA (DRONE-C1)"
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Control Buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = {
                    droneStatus = "RETURN_TO_HOME"
                    altitudeMeters = 50
                    telemetryLog = "CMD: Return to Home (Station Dock 1)"
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706)),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.Home, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("RTH RECALL", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }

            Button(
                onClick = {
                    droneStatus = "HOVER_LOCK"
                    speedKmh = 0
                    telemetryLog = "CMD: Emergency Position Hold"
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.PauseCircle, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("HOVER LOCK", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

@Composable
private fun TelemetryCell(label: String, value: String, valueColor: Color) {
    Column {
        Text(text = label, fontSize = 9.sp, fontWeight = FontWeight.Medium, color = Color(0xFF94A3B8))
        Text(text = value, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = valueColor)
    }
}
