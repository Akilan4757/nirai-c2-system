package org.nirai.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.nirai.app.network.NiraiApi

data class DispatchItem(
    val id: String,
    val reporter: String,
    val location: String,
    val distance: String,
    val status: String
)

@Composable
fun PoliceHomeScreen() {
    var isOnDuty by remember { mutableStateOf(true) }
    var dispatchStatus by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    val coroutineScope = rememberCoroutineScope()

    // Simulated officer identity — in production, from auth token
    val officerUserId = "usr-p1"
    val officerLat = 13.0850
    val officerLng = 80.2740

    val mockDispatches = remember {
        listOf(
            DispatchItem("case-101", "Priya Sharma", "Near Central Railway Station, Gate 3", "1.2 km", "VERIFIED SOS"),
            DispatchItem("case-102", "Citizen Ping", "T. Nagar Ranganathan Street", "3.4 km", "PROXIMITY ALERT")
        )
    }

    // Send initial location heartbeat on duty toggle
    LaunchedEffect(isOnDuty) {
        NiraiApi.updateOfficerLocation(
            userId = officerUserId,
            lat = officerLat,
            lng = officerLng,
            onDuty = isOnDuty
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(16.dp)
    ) {
        // Police Duty Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(text = "Insp. R. Arumugam", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    Text(text = "Badge: TNP-4029 | Patrol Car #04", fontSize = 12.sp, color = Color(0xFF94A3B8))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (isOnDuty) "ON DUTY" else "OFF DUTY",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isOnDuty) Color(0xFF10B981) else Color(0xFFEF4444)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Switch(
                        checked = isOnDuty,
                        onCheckedChange = { isOnDuty = it }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "DISPATCH & PROXIMITY QUEUE",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF64748B)
        )

        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(mockDispatches) { dispatch ->
                val ackStatus = dispatchStatus[dispatch.id]

                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = dispatch.id, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF38BDF8))
                            Text(text = dispatch.status, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(text = "Reporter: ${dispatch.reporter}", fontSize = 13.sp, color = Color.White)
                        Text(text = dispatch.location, fontSize = 12.sp, color = Color(0xFF94A3B8))
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = "Distance: ${dispatch.distance}", fontSize = 12.sp, color = Color(0xFF10B981))

                            if (ackStatus != null) {
                                Text(
                                    text = ackStatus,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF10B981)
                                )
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
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF06B6D4))
                                ) {
                                    Text(text = "ACKNOWLEDGE & RESPOND", fontSize = 11.sp, color = Color.Black)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
