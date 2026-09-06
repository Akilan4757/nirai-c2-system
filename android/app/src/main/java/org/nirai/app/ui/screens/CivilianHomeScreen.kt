package org.nirai.app.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.ActivityCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.nirai.app.network.NiraiApi
import org.nirai.app.ui.components.CameraStreamView
import org.nirai.app.ui.theme.NiraiTheme
import org.nirai.app.ui.theme.TabularTypography
import org.nirai.app.utils.SmsFallbackManager

@Composable
fun CivilianHomeScreen() {
    val context = LocalContext.current
    val hapticFeedback = LocalHapticFeedback.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // Offline / Connectivity State
    var isOffline by remember { mutableStateOf(false) }

    // Stepper & Gesture State
    var isPressing by remember { mutableStateOf(false) }
    var gestureProgress by remember { mutableStateOf(0f) }
    var isSosTriggered by remember { mutableStateOf(false) }
    var sosStatus by remember { mutableStateOf("") }
    var activeCaseId by remember { mutableStateOf<String?>(null) }
    var isCancelling by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    // Real GPS
    var currentLat by remember { mutableStateOf(13.0827) }
    var currentLng by remember { mutableStateOf(80.2707) }
    var currentAddress by remember { mutableStateOf("Chennai, Tamil Nadu") }
    var hasGpsFix by remember { mutableStateOf(false) }
    var gpsPermissionGranted by remember { mutableStateOf(false) }

    // Lifecycle monitoring to pause heavy graphics when backgrounded
    var isAppActive by remember { mutableStateOf(true) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            isAppActive = event == Lifecycle.Event.ON_RESUME || event == Lifecycle.Event.ON_START
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    // Connectivity state checking loop
    LaunchedEffect(context) {
        while (true) {
            try {
                val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                val activeNetwork = cm?.activeNetwork
                val caps = cm?.getNetworkCapabilities(activeNetwork)
                isOffline = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) != true
            } catch (_: Exception) {}
            delay(3000)
        }
    }

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

    // Pulsing animation for outer radial rings (only active when not pressing)
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    // GPS Location listener
    DisposableEffect(gpsPermissionGranted) {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val locationListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                currentLat = location.latitude
                currentLng = location.longitude
                hasGpsFix = true
                coroutineScope.launch(kotlinx.coroutines.Dispatchers.IO) {
                    try {
                        val geocoder = android.location.Geocoder(context, java.util.Locale.getDefault())
                        @Suppress("DEPRECATION")
                        val addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)
                        val resolved = addresses?.firstOrNull()?.let { addr ->
                            buildString {
                                addr.getAddressLine(0)?.let { append(it) }
                            }
                        } ?: "${String.format("%.4f", location.latitude)}, ${String.format("%.4f", location.longitude)}"
                        currentAddress = resolved
                    } catch (e: Exception) {
                        currentAddress = "${String.format("%.4f", location.latitude)}, ${String.format("%.4f", location.longitude)}"
                    }
                }
            }
            @Deprecated("Deprecated") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }

        try {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                
                if (locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true) {
                    locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000, 5f, locationListener)
                }
                if (locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true) {
                    locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2000, 5f, locationListener)
                }
                val lastKnown = try {
                    locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                        ?: locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                } catch (_: Exception) { null }

                lastKnown?.let {
                    currentLat = it.latitude
                    currentLng = it.longitude
                    hasGpsFix = true
                    currentAddress = "${String.format("%.4f", it.latitude)}, ${String.format("%.4f", it.longitude)}"
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        onDispose {
            try {
                locationManager?.removeUpdates(locationListener)
            } catch (_: Exception) {}
        }
    }

    // Hold-to-SOS resistant progress logic (haptic ticks at 25/50/75/100%)
    LaunchedEffect(isPressing) {
        if (isPressing) {
            val duration = 2500L // 2.5 seconds hold
            val steps = 50
            val delayTime = duration / steps
            var tick25 = false
            var tick50 = false
            var tick75 = false
            var tick100 = false

            for (step in 1..steps) {
                if (!isPressing) break
                delay(delayTime)
                gestureProgress = step.toFloat() / steps

                val progressPercentage = gestureProgress * 100
                if (progressPercentage >= 25f && !tick25) {
                    tick25 = true
                    hapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)
                }
                if (progressPercentage >= 50f && !tick50) {
                    tick50 = true
                    hapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)
                }
                if (progressPercentage >= 75f && !tick75) {
                    tick75 = true
                    hapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)
                }
                if (progressPercentage >= 100f && !tick100) {
                    tick100 = true
                    hapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)
                }
            }

            if (gestureProgress >= 1f) {
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
            } else {
                gestureProgress = 0f
            }
        } else {
            gestureProgress = 0f
        }
    }

    // Status polling loop for active SOS
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
                            SmsFallbackManager.resetFallbackStatus()
                            "Case Resolved — You are safe."
                        }
                        "false_alarm" -> {
                            isSosTriggered = false
                            activeCaseId = null
                            SmsFallbackManager.resetFallbackStatus()
                            "Case Cancelled"
                        }
                        else -> "Status: $status"
                    }
                }
            } catch (_: Exception) { /* retry next cycle */ }
        }
    }

    // Render using dynamic theme context
    NiraiTheme(isOfflineMode = isOffline) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Offline HUD banner status card
            if (isOffline) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.5.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(12.dp))
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.SignalCellularConnectedNoInternet0Bar,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "OFFLINE FALLBACK MODE ACTIVE",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = if (SmsFallbackManager.isSmsSentAndConfirmed) 
                                    "SMS Dispatch Confirmed" 
                                else 
                                    "SMS fallback channel ready for emergency transmission",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                            )
                        }
                    }
                }
            }

            // Apple-style GPS Location Card
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(20.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (hasGpsFix) Icons.Default.MyLocation else Icons.Default.LocationSearching,
                            contentDescription = null,
                            tint = if (hasGpsFix) Color(0xFF30D158) else MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (hasGpsFix) "GPS Position Locked" else "Locating Satellites...",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (hasGpsFix) Color(0xFF30D158) else MaterialTheme.colorScheme.primary,
                            letterSpacing = (-0.2).sp
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = currentAddress,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White,
                        maxLines = 2
                    )
                    if (hasGpsFix) {
                        Text(
                            text = "Lat: ${String.format("%.4f", currentLat)}° • Lng: ${String.format("%.4f", currentLng)}°",
                            style = TabularTypography.telemetrySmall,
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.9f),
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                }
            }

            // iOS Live Activity / Dynamic Island Active Case Banner
            AnimatedVisibility(visible = activeCaseId != null && isSosTriggered) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1C1E)),
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0x33FF453A), RoundedCornerShape(24.dp))
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Active Emergency Operation", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFFF9F0A))
                            Text(
                                text = activeCaseId ?: "",
                                style = TabularTypography.telemetryMedium,
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
                                            SmsFallbackManager.resetFallbackStatus()
                                            Toast.makeText(context, "SOS Cancelled", Toast.LENGTH_SHORT).show()
                                        }
                                        isCancelling = false
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0x33FF453A), contentColor = Color(0xFFFF453A)),
                            shape = RoundedCornerShape(percent = 50),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = if (isCancelling) "..." else "Cancel",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Central Hold-to-Trigger Area (Apple Tactile Hold)
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.size(240.dp)
            ) {
                // Ambient Breathing Aura
                if (!isSosTriggered && !isPressing) {
                    Surface(
                        color = Color(0xFFFF453A).copy(alpha = 0.08f),
                        shape = CircleShape,
                        modifier = Modifier
                            .size(230.dp)
                            .scale(pulseScale)
                    ) {}
                }

                if (isSosTriggered) {
                    Surface(
                        color = Color(0xFF0071E3).copy(alpha = 0.12f),
                        shape = CircleShape,
                        modifier = Modifier
                            .fillMaxSize()
                            .scale(pulseScale)
                    ) {}
                }

                // Apple radial progress ring during held press
                if (isPressing && gestureProgress > 0f) {
                    val radialColor = Color(0xFFFF453A)
                    Canvas(modifier = Modifier.size(210.dp)) {
                        drawCircle(
                            color = Color(0xFF2C2C2E),
                            radius = size.width / 2f,
                            style = Stroke(width = 5.dp.toPx())
                        )
                        drawArc(
                            color = radialColor,
                            startAngle = -90f,
                            sweepAngle = 360f * gestureProgress,
                            useCenter = false,
                            style = Stroke(width = 7.dp.toPx())
                        )
                    }
                }

                // Core Apple SOS Button
                Surface(
                    color = when {
                        isSosTriggered -> Color(0xFF0071E3)
                        isPressing -> Color(0xFFFF3B30)
                        else -> Color(0xFFFF453A)
                    },
                    shape = CircleShape,
                    shadowElevation = 14.dp,
                    modifier = Modifier
                        .size(185.dp)
                        .pointerInput(isSosTriggered) {
                            if (!isSosTriggered) {
                                detectTapGestures(
                                    onPress = {
                                        isPressing = true
                                        try {
                                            awaitRelease()
                                        } finally {
                                            isPressing = false
                                        }
                                    }
                                )
                            }
                        }
                ) {
                    Column(
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(12.dp)
                    ) {
                        if (isPressing) {
                            Text(
                                text = "${(gestureProgress * 100).toInt()}%",
                                style = TabularTypography.telemetryLarge,
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Hold to Broadcast",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White.copy(alpha = 0.9f),
                                letterSpacing = (-0.2).sp
                            )
                        } else if (isSosTriggered) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(34.dp)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Help Dispatched",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White
                            )
                            Text(
                                text = "Stay calm, stay in line of sight",
                                fontSize = 9.sp,
                                color = Color.White.copy(alpha = 0.8f),
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(horizontal = 10.dp)
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(38.dp)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "SOS",
                                fontSize = 42.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.White,
                                letterSpacing = 1.sp
                            )
                            Text(
                                text = "HOLD 3s TO TRIGGER",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White.copy(alpha = 0.85f),
                                letterSpacing = 0.5.sp
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Proximity radar sweep and Dispatch Stepper
            if (isSosTriggered) {
                // Stepper layout
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f), RoundedCornerShape(16.dp))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Notifications,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "MISSION DISPATCH LOG",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                                letterSpacing = 0.5.sp
                            )
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                        
                        DispatchStepper(status = sosStatus)

                        Spacer(modifier = Modifier.height(16.dp))

                        CameraStreamView(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(170.dp),
                            nodeLabel = "EYES ON SCENE FEED",
                            streamId = activeCaseId ?: "sos-civilian"
                        )
                    }
                }
            } else {
                // Show Proximity Radar search view when idle
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f), RoundedCornerShape(16.dp))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(
                                imageVector = Icons.Default.Radar,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "CIVILIAN & POLICE PROXIMITY SCAN",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                                letterSpacing = 0.5.sp
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))

                        ProximityRadar(isAppActive = isAppActive)
                    }
                }
            }
        }
    }
}

// 5-state Vertical Dispatch Stepper with morph animations
@Composable
fun DispatchStepper(status: String) {
    val isAlertSent = true
    val isOperatorVerified = status.contains("Verified") || status.contains("assigned") || status.contains("Dispatched") || status.contains("scene") || status.contains("Responded")
    val isDroneAirborne = status.contains("Dispatched") || status.contains("scene")
    val isOfficerAssigned = status.contains("assigned") || status.contains("en route") || status.contains("scene")
    val isEyesOnScene = status.contains("scene") || status.contains("Help on scene")

    val steps = listOf(
        Pair("Alert Sent & Geo-Tagged", isAlertSent),
        Pair("Operator Verified Incident", isOperatorVerified),
        Pair("Drone Airborne (First Eyes)", isDroneAirborne),
        Pair("Officer Assigned & Responding", isOfficerAssigned),
        Pair("First Eyes / Officers on Scene", isEyesOnScene)
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        steps.forEachIndexed { idx, step ->
            val isCompleted = step.second
            // The step is active if it is the current step (the furthest completed step)
            val isActive = idx == steps.indexOfLast { it.second }

            Row(
                verticalAlignment = Alignment.Top,
                modifier = Modifier.fillMaxWidth()
            ) {
                // Stepper Column containing node and connector line
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.width(28.dp)
                ) {
                    val scale by animateFloatAsState(
                        targetValue = if (isCompleted) 1f else 0.85f,
                        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
                        label = "nodeScale"
                    )

                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .scale(scale)
                            .clip(CircleShape)
                            .background(
                                if (isCompleted) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f) 
                                else Color(0xFF1E293B)
                            )
                            .border(
                                width = 1.5.dp,
                                color = if (isCompleted) MaterialTheme.colorScheme.primary else Color(0xFF475569),
                                shape = CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isCompleted) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(13.dp)
                            )
                        } else {
                            Text(
                                text = "${idx + 1}",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF64748B)
                            )
                        }
                    }

                    if (idx < steps.size - 1) {
                        Box(
                            modifier = Modifier
                                .width(2.dp)
                                .height(22.dp)
                                .background(
                                    if (steps[idx + 1].second) MaterialTheme.colorScheme.primary 
                                    else Color(0xFF334155)
                                )
                        )
                    }
                }

                Spacer(modifier = Modifier.width(14.dp))

                Column(modifier = Modifier.padding(top = 2.dp)) {
                    Text(
                        text = step.first,
                        color = if (isCompleted) Color.White else Color(0xFF64748B),
                        fontSize = 13.sp,
                        fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                }
            }
        }
    }
}

// Proximity Radar Sweep rendering engine (lifecycle pause aware)
@Composable
fun ProximityRadar(
    isAppActive: Boolean,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "radarRotation")
    val rotationAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = if (isAppActive) 360f else 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(4000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "rotationAngle"
    )

    // Safe civilian, police, and drone stations represented in relative coordinates
    val nodes = remember {
        listOf(
            Triple(45f, 0.65f, Color(0xFF3B82F6)), // Responding Police (Blue)
            Triple(165f, 0.45f, Color(0xFF10B981)), // Safe Civilian (Green)
            Triple(280f, 0.78f, Color(0xFFA855F7))  // Drone Station (Purple)
        )
    }

    val radarColor = MaterialTheme.colorScheme.primary

    Box(
        modifier = modifier
            .size(170.dp)
            .clip(CircleShape)
            .background(Color(0xFF070B16))
            .border(1.5.dp, radarColor.copy(alpha = 0.3f), CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val center = size.width / 2f
            val radius = size.width / 2f

            // Inner concentric grid rings
            drawCircle(
                color = Color(0xFF1E293B),
                radius = radius * 0.33f,
                style = Stroke(1f)
            )
            drawCircle(
                color = Color(0xFF1E293B),
                radius = radius * 0.66f,
                style = Stroke(1f)
            )

            // Dynamic sweeping line
            val angleRad = Math.toRadians(rotationAngle.toDouble())
            val endX = center + radius * Math.cos(angleRad).toFloat()
            val endY = center + radius * Math.sin(angleRad).toFloat()

            drawLine(
                color = radarColor.copy(alpha = 0.8f),
                start = Offset(center, center),
                end = Offset(endX, endY),
                strokeWidth = 2f
            )

            // Draw sweeps and compute light fades when line sweeps past nodes
            nodes.forEach { (nodeAngle, distanceFraction, color) ->
                val diffAngle = (rotationAngle - nodeAngle + 360f) % 360f
                
                // Active glow duration: 90 degrees of trail sweep
                val alpha = if (diffAngle < 90f) {
                    1f - (diffAngle / 90f)
                } else {
                    0.05f
                }

                val nodeRad = Math.toRadians(nodeAngle.toDouble())
                val nodeX = center + (radius * distanceFraction) * Math.cos(nodeRad).toFloat()
                val nodeY = center + (radius * distanceFraction) * Math.sin(nodeRad).toFloat()

                // Glow ring
                if (alpha > 0.4f) {
                    drawCircle(
                        color = color,
                        radius = 12f * alpha,
                        center = Offset(nodeX, nodeY),
                        style = Stroke(1.5f),
                        alpha = alpha
                    )
                }

                // Core Node Marker
                drawCircle(
                    color = color,
                    radius = 4.5f,
                    center = Offset(nodeX, nodeY),
                    alpha = alpha.coerceAtLeast(0.12f)
                )
            }
        }

        Text(
            text = "SCANNING RANGE: 300M",
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            color = radarColor.copy(alpha = 0.6f),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 12.dp)
        )
    }
}
