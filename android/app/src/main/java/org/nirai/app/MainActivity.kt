package org.nirai.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import org.nirai.app.ui.screens.AuthScreen
import org.nirai.app.ui.screens.CivilianHomeScreen
import org.nirai.app.ui.screens.DroneHomeScreen
import org.nirai.app.ui.screens.PoliceHomeScreen

enum class AppRole { CIVILIAN, POLICE, DRONE }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF06B6D4),
                    secondary = Color(0xFF3B82F6),
                    background = Color(0xFF020617),
                    surface = Color(0xFF0F172A)
                )
            ) {
                var isAuthenticated by remember { mutableStateOf(true) } // default logged in for instant testing
                var currentRole by remember { mutableStateOf(AppRole.CIVILIAN) }
                var currentUserEmail by remember { mutableStateOf("civilian@nirai.app") }

                if (!isAuthenticated) {
                    AuthScreen(
                        onLoginSuccess = { role, name ->
                            currentRole = role
                            currentUserEmail = name
                            isAuthenticated = true
                        }
                    )
                } else {
                    Scaffold(
                        topBar = {
                            Surface(
                                color = Color(0xFF0F172A),
                                tonalElevation = 4.dp
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp, vertical = 8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text(
                                            text = "NIRAI SOS — ${currentRole.name}",
                                            style = MaterialTheme.typography.titleMedium,
                                            color = Color.White
                                        )
                                        Text(
                                            text = currentUserEmail,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF94A3B8)
                                        )
                                    }
                                    Row {
                                        Button(
                                            onClick = {
                                                currentRole = when (currentRole) {
                                                    AppRole.CIVILIAN -> AppRole.POLICE
                                                    AppRole.POLICE -> AppRole.DRONE
                                                    AppRole.DRONE -> AppRole.CIVILIAN
                                                }
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B))
                                        ) {
                                            Text(
                                                text = "MODE: ${currentRole.name}",
                                                color = Color(0xFF38BDF8)
                                            )
                                        }
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Button(
                                            onClick = { isAuthenticated = false },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF334155))
                                        ) {
                                            Text("AUTH", color = Color.White)
                                        }
                                    }
                                }
                            }
                        }
                    ) { innerPadding ->
                        Box(modifier = Modifier.padding(innerPadding)) {
                            when (currentRole) {
                                AppRole.CIVILIAN -> CivilianHomeScreen()
                                AppRole.POLICE -> PoliceHomeScreen()
                                AppRole.DRONE -> DroneHomeScreen()
                            }
                        }
                    }
                }
            }
        }
    }
}
