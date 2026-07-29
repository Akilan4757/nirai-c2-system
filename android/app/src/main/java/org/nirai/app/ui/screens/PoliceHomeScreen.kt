package org.nirai.app.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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

data class DispatchItem(
    val id: String,
    val reporter: String,
    val location: String,
    val distance: String,
    val status: String,
    val lat: Double = 0.0,
    val lng: Double = 0.0
)

@Composable
fun PoliceHomeScreen() {
    val context = LocalContext.current
    var isOnDuty by remember { mutableStateOf(true) }
    var dispatchStatus by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    val coroutineScope = rememberCoroutineScope()

    val officerUserId = "usr-p1"

    // Real GPS for officer location
    var officerLat by remember { mutableStateOf(0.0) }
    var officerLng by remember { mutableStateOf(0.0) }
    var hasGpsFix by remember { mutableStateOf(false) }

    var dispatches by remember {
        mutableStateOf(
            listOf(
                DispatchItem("case-101", "Priya Sharma", "Near Central Railway Station, Gate 3", "1.2 km", "VERIFIED SOS"),
                DispatchItem("case-102", "Citizen Ping", "T. Nagar Ranganathan Street", "3.4 km", "PROXIMITY ALERT")
            )
        )
    }

    // GPS listener
    DisposableEffect(Unit) {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val locationListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                officerLat = location.latitude
                officerLng = location.longitude
                hasGpsFix = true
            }
            @Deprecated("Deprecated") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }

        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            locationManager?.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3000, 10f, locationListener)
            locationManager?.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 3000, 10f, locationListener)
            val lastKnown = locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            lastKnown?.let {
                officerLat = it.latitude
                officerLng = it.longitude
                hasGpsFix = true
            }
        }

        onDispose {
            locationManager?.removeUpdates(locationListener)
        }
    }

    // Periodic heartbeat to C2
    LaunchedEffect(isOnDuty, hasGpsFix) {
        while (true) {
            if (hasGpsFix) {
                NiraiApi.updateOfficerLocation(
                    userId = officerUserId,
                    lat = officerLat,
                    lng = officerLng,
                    onDuty = isOnDuty
                )
            }
            delay(5000)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(16.dp)
    ) {
        // Officer Identity Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0xFF3B82F6).copy(alpha = 0.3f), RoundedCornerShape(16.dp))
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
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(listOf(Color(0xFF3B82F6), Color(0xFF1D4ED8)))
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Shield, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text("Insp. R. Arumugam", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text("Badge: TNP-4029 | Patrol Car #04", fontSize = 11.sp, color = Color(0xFF94A3B8))
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = if (isOnDuty) "ON DUTY" else "OFF DUTY",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isOnDuty) Color(0xFF10B981) else Color(0xFFEF4444)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Switch(
                                checked = isOnDuty,
                                onCheckedChange = { isOnDuty = it },
                                modifier = Modifier.height(24.dp)
                            )
                        }
                    }
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
                        text = if (hasGpsFix) "GPS: ${String.format("%.4f", officerLat)}, ${String.format("%.4f", officerLng)}" else "Acquiring GPS...",
                        fontSize = 10.sp,
                        color = if (hasGpsFix) Color(0xFF10B981) else Color(0xFFF59E0B)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.NotificationsActive, contentDescription = null, tint = Color(0xFFF59E0B), modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text("DISPATCH & PROXIMITY QUEUE", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF64748B))
            Spacer(modifier = Modifier.weight(1f))
            Surface(
                color = Color(0xFFF59E0B).copy(alpha = 0.15f),
                shape = RoundedCornerShape(6.dp)
            ) {
                Text(
                    text = "${dispatches.size} ACTIVE",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFF59E0B),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(dispatches) { dispatch ->
                val ackStatus = dispatchStatus[dispatch.id]

                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFF334155), RoundedCornerShape(14.dp))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    color = Color(0xFFEF4444).copy(alpha = 0.2f),
                                    shape = CircleShape,
                                    modifier = Modifier.size(8.dp)
                                ) {}
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(dispatch.id, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF38BDF8))
                            }
                            Surface(
                                color = Color(0xFFF59E0B).copy(alpha = 0.15f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = dispatch.status,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFF59E0B),
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Text("Reporter: ${dispatch.reporter}", fontSize = 13.sp, color = Color.White)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(dispatch.location, fontSize = 12.sp, color = Color(0xFF94A3B8))
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.NearMe, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(dispatch.distance, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF10B981))
                            }

                            if (ackStatus != null) {
                                Surface(
                                    color = Color(0xFF10B981).copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = ackStatus,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF10B981),
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    )
                                }
                            } else {
                                Button(
                                    onClick = {
                                        coroutineScope.launch {
                                            dispatchStatus = dispatchStatus + (dispatch.id to "SENDING...")
                                            val result = NiraiApi.acknowledgeCase(
                                                caseId = dispatch.id,
                                                officerUserId = officerUserId
                                            )
                                            dispatchStatus = dispatchStatus + (dispatch.id to
                                                if (result != null) "RESPONDING ✓" else "FAILED — RETRY")
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF06B6D4)),
                                    shape = RoundedCornerShape(8.dp),
                                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                                ) {
                                    Icon(Icons.Default.Send, contentDescription = null, tint = Color.Black, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("RESPOND", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
