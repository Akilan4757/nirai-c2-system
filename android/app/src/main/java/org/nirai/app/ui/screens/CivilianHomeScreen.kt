package org.nirai.app.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
    var activeCaseId by remember { mutableStateOf<String?>(null) }
    var isCancelling by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    // Real GPS
    var currentLat by remember { mutableStateOf(0.0) }
    var currentLng by remember { mutableStateOf(0.0) }
    var currentAddress by remember { mutableStateOf("Acquiring GPS signal...") }
    var hasGpsFix by remember { mutableStateOf(false) }
    var gpsPermissionGranted by remember { mutableStateOf(false) }

    // GPS Permission Launcher
    val gpsPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fine = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarse = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        gpsPermissionGranted = fine || coarse
        if (gpsPermissionGranted) {
            Toast.makeText(context, "GPS Permission Granted", Toast.LENGTH_SHORT).show()
        }
    }

    LaunchedEffect(Unit) {
        val hasFine = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) {
            gpsPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        } else {
            gpsPermissionGranted = true
        }
    }

    // Pulsing animation for SOS button
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    // GPS Location listener — re-registers when permission is granted
    DisposableEffect(gpsPermissionGranted) {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val locationListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                currentLat = location.latitude
                currentLng = location.longitude
                hasGpsFix = true
                try {
                    val geocoder = android.location.Geocoder(context, java.util.Locale.getDefault())
                    @Suppress("DEPRECATION")
                    val addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)
                    currentAddress = addresses?.firstOrNull()?.let { addr ->
                        buildString {
                            addr.getAddressLine(0)?.let { append(it) }
                        }
                    } ?: "${String.format("%.4f", location.latitude)}, ${String.format("%.4f", location.longitude)}"
                } catch (e: Exception) {
                    currentAddress = "${String.format("%.4f", location.latitude)}, ${String.format("%.4f", location.longitude)}"
                }
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
                currentAddress = "${String.format("%.4f", it.latitude)}, ${String.format("%.4f", it.longitude)}"
            }
        }

        onDispose {
            locationManager?.removeUpdates(locationListener)
        }
    }

    // Countdown logic
    LaunchedEffect(isCountdownActive) {
        if (isCountdownActive) {
            countdownSeconds = 5
            while (countdownSeconds > 0 && isCountdownActive) {
                delay(1000)
                if (isCountdownActive) countdownSeconds--
            }
            if (isCountdownActive && countdownSeconds <= 0) {
                isCountdownActive = false
                isSosTriggered = true
                sosStatus = "Transmitting SOS to NIRAI C2..."

                val lat = if (hasGpsFix) currentLat else 13.0827
                val lng = if (hasGpsFix) currentLng else 80.2707

                coroutineScope.launch {
                    try {
                        val caseId = NiraiApi.postSos(
                            lat = lat, lng = lng,
                            reporterName = "Civilian User",
                            reporterPhone = "+919876543210",
                            address = currentAddress
                        )
                        activeCaseId = caseId
                        sosStatus = "SOS ACTIVE — Case: ${caseId ?: "Unknown"}"
                        Toast.makeText(context, "Emergency SOS Transmitted!", Toast.LENGTH_LONG).show()
                    } catch (e: Exception) {
                        // Bug 10: SMS fallback on network failure
                        val smsSent = SmsFallbackManager.sendOfflineSosPayload(
                            userId = "usr-mobile",
                            lat = lat,
                            lng = lng
                        )
                        sosStatus = if (smsSent) "SOS via SMS (Offline Mode)" else "SOS FAILED — Retry"
                        Toast.makeText(
                            context,
                            if (smsSent) "Network unavailable — SOS sent via SMS" else "SOS failed — check connectivity",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }
        }
    }

    // Bug 9: Poll case status for live dispatch tracking
    LaunchedEffect(activeCaseId) {
        val caseId = activeCaseId ?: return@LaunchedEffect
        while (isSosTriggered && activeCaseId != null) {
            delay(5000)
            try {
                val details = NiraiApi.getCaseById(caseId)
                if (details != null) {
                    val status = details.first
                    val officerName = details.second
                    val eta = details.third
                    sosStatus = when (status) {
                        "raised" -> "SOS Received — Awaiting Verification"
                        "verifying" -> "Operator Verifying Your Call..."
                        "unit_assigned" -> "Officer ${officerName ?: ""} assigned — ETA: ${eta ?: "??"}s"
                        "airborne" -> "Drone Dispatched — Officer ${officerName ?: ""} en route"
                        "on_scene" -> "Help on scene! Stay calm."
                        "resolved" -> {
                            isSosTriggered = false
                            activeCaseId = null
                            "Case Resolved — You are safe."
                        }
                        "false_alarm" -> {
                            isSosTriggered = false
                            activeCaseId = null
                            "Case Cancelled"
                        }
                        else -> "Status: $status"
                    }
                }
            } catch (_: Exception) { /* retry next cycle */ }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // GPS Location Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (hasGpsFix) Icons.Default.MyLocation else Icons.Default.LocationSearching,
                        contentDescription = null,
                        tint = if (hasGpsFix) Color(0xFF10B981) else Color(0xFFF59E0B),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (hasGpsFix) "GPS LOCKED" else "ACQUIRING GPS...",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (hasGpsFix) Color(0xFF10B981) else Color(0xFFF59E0B)
                    )
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = currentAddress,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White,
                    maxLines = 2
                )
                if (hasGpsFix) {
                    Text(
                        text = "GPS: ${String.format("%.4f", currentLat)}, ${String.format("%.4f", currentLng)}",
                        fontSize = 11.sp,
                        color = Color(0xFF06B6D4)
                    )
                }
            }
        }

        // Active Case ID Banner
        AnimatedVisibility(visible = activeCaseId != null && isSosTriggered) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF7C2D12)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("ACTIVE CASE", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFFBBF24))
                        Text(
                            text = activeCaseId ?: "",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                    Button(
                        onClick = {
                            if (!isCancelling && activeCaseId != null) {
                                isCancelling = true
                                coroutineScope.launch {
                                    val success = NiraiApi.cancelCase(activeCaseId!!)
                                    if (success) {
                                        isSosTriggered = false
                                        sosStatus = ""
                                        activeCaseId = null
                                        countdownSeconds = 5
                                        Toast.makeText(context, "SOS Cancelled", Toast.LENGTH_SHORT).show()
                                    }
                                    isCancelling = false
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = if (isCancelling) "..." else "CANCEL",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Central SOS Button
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(220.dp)
        ) {
            // Outer pulsing ring
            if (!isSosTriggered && !isCountdownActive) {
                Surface(
                    color = Color(0xFFEF4444).copy(alpha = 0.08f),
                    shape = CircleShape,
                    modifier = Modifier
                        .size(220.dp)
                        .scale(pulseScale)
                ) {}
            }

            if (isSosTriggered) {
                Surface(
                    color = Color(0xFF06B6D4).copy(alpha = 0.12f),
                    shape = CircleShape,
                    modifier = Modifier
                        .fillMaxSize()
                        .scale(pulseScale)
                ) {}
            }

            Surface(
                color = when {
                    isSosTriggered -> Color(0xFF06B6D4)
                    isCountdownActive -> Color(0xFFF59E0B)
                    else -> Color(0xFFEF4444)
                },
                shape = CircleShape,
                shadowElevation = 20.dp,
                modifier = Modifier
                    .size(180.dp)
                    .clickable {
                        if (isCountdownActive) {
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
                            fontSize = 56.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text("TAP TO CANCEL", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.9f))
                    } else if (isSosTriggered) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color.White, modifier = Modifier.size(36.dp))
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("HELP EN ROUTE", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text(
                            text = sosStatus.take(30),
                            fontSize = 10.sp,
                            color = Color.White.copy(alpha = 0.8f),
                            textAlign = TextAlign.Center
                        )
                    } else {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = Color.White, modifier = Modifier.size(40.dp))
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("SOS", fontSize = 42.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text("PRESS TO ACTIVATE", fontSize = 10.sp, fontWeight = FontWeight.Medium, color = Color.White.copy(alpha = 0.8f))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Bottom Section
        if (isSosTriggered) {
            // Active dispatch info + camera
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Notifications, contentDescription = null, tint = Color(0xFF38BDF8), modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("LIVE DISPATCH STATUS", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF38BDF8))
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(sosStatus.ifEmpty { "Awaiting dispatch..." }, fontSize = 13.sp, color = Color.White)
                    Text(
                        text = "GPS: ${String.format("%.4f", currentLat)}, ${String.format("%.4f", currentLng)}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF10B981)
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    CameraStreamView(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp),
                        nodeLabel = "SOS EMERGENCY CAMERA",
                        streamId = activeCaseId ?: "sos-civilian"
                    )
                }
            }
        } else {
            // Emergency contacts preview
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.ContactPhone, contentDescription = null, tint = Color(0xFF64748B), modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("EMERGENCY CONTACTS", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF64748B))
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(
                            color = Color(0xFF1E293B),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("+91 98765 43210\nMother", modifier = Modifier.padding(10.dp), fontSize = 11.sp, color = Color.White)
                        }
                        Surface(
                            color = Color(0xFF1E293B),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("112 / 100\nERSS Control", modifier = Modifier.padding(10.dp), fontSize = 11.sp, color = Color.White)
                        }
                    }
                }
            }
        }
    }
}
