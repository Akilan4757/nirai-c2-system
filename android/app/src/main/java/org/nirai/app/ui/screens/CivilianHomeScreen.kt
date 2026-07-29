package org.nirai.app.ui.screens

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.nirai.app.network.NiraiApi
import org.nirai.app.utils.SmsFallbackManager

@Composable
fun CivilianHomeScreen() {
    var isCountdownActive by remember { mutableStateOf(false) }
    var countdownSeconds by remember { mutableStateOf(5) }
    var isSosTriggered by remember { mutableStateOf(false) }
    var sosStatus by remember { mutableStateOf("") }
    val coroutineScope = rememberCoroutineScope()

    // Simulated GPS coords — in production, use FusedLocationProviderClient
    val currentLat = 13.0604
    val currentLng = 80.2496
    val currentAddress = "Mount Road near Anna Flyover, Chennai"

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
                    text = "GPS LOCATION STATUS",
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
                    text = "Proximity Broadcast: OPTED-IN (300m Active Mesh)",
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
                            text = "ACTIVE DISPATCH TELEMETRY",
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
                        Text(text = "Estimated Arrival: Calculating...", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF10B981))
                        Text(text = "Control Room notified via WebSocket", fontSize = 12.sp, color = Color(0xFF94A3B8))
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
