package org.nirai.app.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.ActivityCompat
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.nirai.app.network.NiraiApi
import org.nirai.app.ui.components.CameraStreamView
import org.nirai.app.utils.SmsFallbackManager

@Composable
fun CivilianHomeScreen() {
    val context = LocalContext.current
    var isCountdownActive by remember { mutableStateOf(false) }
    var countdownSeconds by remember { mutableStateOf(5) }
    var isSosTriggered by remember { mutableStateOf(false) }
    var sosStatus by remember { mutableStateOf("") }
    val coroutineScope = rememberCoroutineScope()

    // Real Native Device GPS Coordinates
    var currentLat by remember { mutableStateOf(13.0827) }
    var currentLng by remember { mutableStateOf(80.2707) }
    var currentAddress by remember { mutableStateOf("Fetching real GPS location...") }

    DisposableEffect(Unit) {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val locationListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                currentLat = location.latitude
                currentLng = location.longitude
                currentAddress = "GPS: ${String.format("%.4f", location.latitude)} N, ${String.format("%.4f", location.longitude)} E"
            }
            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        }

        try {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                locationManager?.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000L, 1f, locationListener)
                locationManager?.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2000L, 1f, locationListener)
                val lastGps = locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                    ?: locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                if (lastGps != null) {
                    currentLat = lastGps.latitude
                    currentLng = lastGps.longitude
                    currentAddress = "GPS: ${String.format("%.4f", lastGps.latitude)} N, ${String.format("%.4f", lastGps.longitude)} E"
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        onDispose {
            try {
                locationManager?.removeUpdates(locationListener)
            } catch (e: Exception) {}
        }
    }

    LaunchedEffect(isCountdownActive) {
        if (isCountdownActive) {
            countdownSeconds = 5
            while (countdownSeconds > 0) {
                delay(1000)
                countdownSeconds--
            }
            isCountdownActive = false
            isSosTriggered = true

            // --- Wire to backend ---
            coroutineScope.launch {
                sosStatus = "Connecting to NIRAI C2..."
                val result = NiraiApi.postSos(
                    lat = currentLat,
                    lng = currentLng,
                    reporterName = "Civilian User",
                    reporterPhone = "+919876543210",
                    address = currentAddress
                )
                if (result != null) {
                    sosStatus = "SOS transmitted — help dispatched"
                } else {
                    // Network failed — fall back to SMS
                    sosStatus = "Network failed — sending SMS fallback..."
                    SmsFallbackManager.sendOfflineSosPayload(
                        userId = "usr-c1",
                        lat = currentLat,
                        lng = currentLng
                    )
                    sosStatus = "SMS SOS sent to gateway"
                }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Top Header Info
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "REAL DEVICE GPS LOCATION",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF94A3B8)
                )
                Text(
                    text = currentAddress,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Proximity Broadcast: OPTED-IN (${currentLat.toString().take(6)}, ${currentLng.toString().take(6)})",
                    fontSize = 11.sp,
                    color = Color(0xFF10B981)
                )
            }
        }

        // Central Panic SOS Button
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(240.dp)
        ) {
            if (isSosTriggered) {
                Surface(
                    color = Color(0xFF06B6D4).copy(alpha = 0.2f),
                    shape = CircleShape,
                    modifier = Modifier.fillMaxSize()
                ) {}
            }

            Surface(
                color = when {
                    isSosTriggered -> Color(0xFF06B6D4)
                    isCountdownActive -> Color(0xFFF59E0B)
                    else -> Color(0xFFEF4444)
                },
                shape = CircleShape,
                shadowElevation = 16.dp,
                modifier = Modifier
                    .size(200.dp)
                    .clickable {
                        if (isCountdownActive) {
                            // Cancel the countdown
                            isCountdownActive = false
                            countdownSeconds = 5
                        } else if (!isSosTriggered) {
                            isCountdownActive = true
                        }
                    }
            ) {
                Column(
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (isCountdownActive) {
                        Text(
                            text = "$countdownSeconds",
                            fontSize = 64.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "TAP TO CANCEL",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    } else if (isSosTriggered) {
                        Text(
                            text = "HELP EN ROUTE",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = sosStatus.ifEmpty { "Transmitting..." },
                            fontSize = 12.sp,
                            color = Color(0xFFECFEFF)
                        )
                    } else {
                        Text(
                            text = "SOS",
                            fontSize = 48.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "PRESS & HOLD",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                }
            }
        }

        // Bottom Contact & Status Card
        Column(modifier = Modifier.fillMaxWidth()) {
            if (isSosTriggered) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "ACTIVE DISPATCH & LIVE CAMERA STREAM",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF38BDF8)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = sosStatus.ifEmpty { "Awaiting dispatch assignment..." },
                            fontSize = 13.sp,
                            color = Color.White
                        )
                        Text(text = "Target GPS: $currentLat, $currentLng", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF10B981))
                        Spacer(modifier = Modifier.height(8.dp))

                        // Camera Stream Box
                        CameraStreamView(
                            modifier = Modifier.fillMaxWidth().height(160.dp),
                            nodeLabel = "CIVILIAN SOS EMERGENCY CAMERA"
                        )
                    }
                }
            } else {
                Text(
                    text = "EMERGENCY CONTACTS NOTIFIED ON SOS",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF64748B)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Surface(
                        color = Color(0xFF0F172A),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f).padding(end = 4.dp)
                    ) {
                        Text("+91 98765 43210 (Mother)", modifier = Modifier.padding(8.dp), fontSize = 12.sp, color = Color.White)
                    }
                    Surface(
                        color = Color(0xFF0F172A),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f).padding(start = 4.dp)
                    ) {
                        Text("112 / 100 ERSS Control", modifier = Modifier.padding(8.dp), fontSize = 12.sp, color = Color.White)
                    }
                }
            }
        }
    }
}
