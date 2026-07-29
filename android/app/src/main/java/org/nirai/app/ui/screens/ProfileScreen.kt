package org.nirai.app.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.nirai.app.AppRole

data class EmergencyContact(
    var name: String,
    var phone: String,
    var relation: String
)

@Composable
fun ProfileScreen(
    currentRole: AppRole,
    userEmail: String,
    onSwitchRole: (AppRole) -> Unit,
    onLogout: () -> Unit
) {
    var contacts by remember {
        mutableStateOf(
            mutableListOf(
                EmergencyContact("Mother", "+91 98765 43210", "Family"),
                EmergencyContact("112 ERSS Control", "112", "Emergency")
            )
        )
    }
    var isEditingContacts by remember { mutableStateOf(false) }
    var editName by remember { mutableStateOf("") }
    var editPhone by remember { mutableStateOf("") }
    var editRelation by remember { mutableStateOf("") }
    var editIndex by remember { mutableStateOf(-1) }

    val roleName = when (currentRole) {
        AppRole.CIVILIAN -> "Civilian User"
        AppRole.POLICE -> "Police Officer"
        AppRole.DRONE -> "Drone Operator"
    }

    val roleColor = when (currentRole) {
        AppRole.CIVILIAN -> Color(0xFF06B6D4)
        AppRole.POLICE -> Color(0xFF3B82F6)
        AppRole.DRONE -> Color(0xFF8B5CF6)
    }

    val roleIcon = when (currentRole) {
        AppRole.CIVILIAN -> Icons.Default.Person
        AppRole.POLICE -> Icons.Default.Shield
        AppRole.DRONE -> Icons.Default.FlightTakeoff
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Profile Avatar Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Avatar circle with role icon
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    listOf(roleColor.copy(alpha = 0.4f), roleColor.copy(alpha = 0.1f))
                                )
                            )
                            .border(2.dp, roleColor.copy(alpha = 0.6f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = roleIcon,
                            contentDescription = null,
                            tint = roleColor,
                            modifier = Modifier.size(36.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = roleName,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = userEmail,
                        fontSize = 13.sp,
                        color = Color(0xFF94A3B8)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Surface(
                        color = roleColor.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = currentRole.name,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = roleColor,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }

        // Role Switch Section
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.SwapHoriz, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("SWITCH ROLE", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF94A3B8))
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF1E293B), RoundedCornerShape(12.dp))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        val roles = listOf(
                            AppRole.CIVILIAN to "CIVILIAN",
                            AppRole.POLICE to "POLICE",
                            AppRole.DRONE to "DRONE"
                        )
                        roles.forEach { (role, label) ->
                            val isSelected = currentRole == role
                            val bgColor by animateColorAsState(
                                if (isSelected) roleColor else Color.Transparent,
                                label = "roleBg"
                            )
                            Surface(
                                color = bgColor,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { onSwitchRole(role) }
                            ) {
                                Box(
                                    modifier = Modifier.padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = label,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isSelected) Color.Black else Color(0xFF94A3B8)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Emergency Contacts Section (Civilian only)
        if (currentRole == AppRole.CIVILIAN) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.ContactPhone, contentDescription = null, tint = Color(0xFFF59E0B), modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("EMERGENCY CONTACTS", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF94A3B8))
                            }
                            Surface(
                                color = Color(0xFF1E293B),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.clickable { isEditingContacts = !isEditingContacts }
                            ) {
                                Text(
                                    text = if (isEditingContacts) "DONE" else "EDIT",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF06B6D4),
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        contacts.forEachIndexed { index, contact ->
                            Surface(
                                color = Color(0xFF1E293B),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(contact.name, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.White)
                                        Text(contact.phone, fontSize = 12.sp, color = Color(0xFF94A3B8))
                                        Text(contact.relation, fontSize = 10.sp, color = Color(0xFF06B6D4))
                                    }
                                    if (isEditingContacts) {
                                        Row {
                                            IconButton(onClick = {
                                                editIndex = index
                                                editName = contact.name
                                                editPhone = contact.phone
                                                editRelation = contact.relation
                                            }, modifier = Modifier.size(32.dp)) {
                                                Icon(Icons.Default.Edit, contentDescription = "Edit", tint = Color(0xFF06B6D4), modifier = Modifier.size(16.dp))
                                            }
                                            IconButton(onClick = {
                                                contacts = contacts.toMutableList().also { it.removeAt(index) }
                                            }, modifier = Modifier.size(32.dp)) {
                                                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Edit / Add contact form
                        if (isEditingContacts) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Surface(
                                color = Color(0xFF334155),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        text = if (editIndex >= 0) "EDIT CONTACT" else "ADD NEW CONTACT",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF94A3B8)
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    OutlinedTextField(
                                        value = editName,
                                        onValueChange = { editName = it },
                                        label = { Text("Name") },
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = Color(0xFF06B6D4),
                                            unfocusedBorderColor = Color(0xFF475569),
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedLabelColor = Color(0xFF06B6D4),
                                            unfocusedLabelColor = Color(0xFF94A3B8)
                                        ),
                                        modifier = Modifier.fillMaxWidth(),
                                        singleLine = true
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    OutlinedTextField(
                                        value = editPhone,
                                        onValueChange = { editPhone = it },
                                        label = { Text("Phone") },
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = Color(0xFF06B6D4),
                                            unfocusedBorderColor = Color(0xFF475569),
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedLabelColor = Color(0xFF06B6D4),
                                            unfocusedLabelColor = Color(0xFF94A3B8)
                                        ),
                                        modifier = Modifier.fillMaxWidth(),
                                        singleLine = true
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    OutlinedTextField(
                                        value = editRelation,
                                        onValueChange = { editRelation = it },
                                        label = { Text("Relation") },
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = Color(0xFF06B6D4),
                                            unfocusedBorderColor = Color(0xFF475569),
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedLabelColor = Color(0xFF06B6D4),
                                            unfocusedLabelColor = Color(0xFF94A3B8)
                                        ),
                                        modifier = Modifier.fillMaxWidth(),
                                        singleLine = true
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Button(
                                        onClick = {
                                            if (editName.isNotBlank() && editPhone.isNotBlank()) {
                                                if (editIndex >= 0 && editIndex < contacts.size) {
                                                    contacts = contacts.toMutableList().also {
                                                        it[editIndex] = EmergencyContact(editName, editPhone, editRelation)
                                                    }
                                                } else {
                                                    contacts = contacts.toMutableList().also {
                                                        it.add(EmergencyContact(editName, editPhone, editRelation))
                                                    }
                                                }
                                                editIndex = -1
                                                editName = ""
                                                editPhone = ""
                                                editRelation = ""
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF06B6D4)),
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            text = if (editIndex >= 0) "UPDATE CONTACT" else "ADD CONTACT",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.Black
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Logout Button
        item {
            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = onLogout,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444).copy(alpha = 0.15f)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp),
                border = ButtonDefaults.outlinedButtonBorder.copy(
                    brush = Brush.linearGradient(listOf(Color(0xFFEF4444).copy(alpha = 0.4f), Color(0xFFEF4444).copy(alpha = 0.2f)))
                )
            ) {
                Icon(Icons.Default.Logout, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("SIGN OUT", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "NIRAI SOS v2.0 — Networked Intelligent Rapid-response",
                fontSize = 10.sp,
                color = Color(0xFF475569),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
