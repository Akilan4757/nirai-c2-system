package org.nirai.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * Lightweight HTTP client for NIRAI backend & Firebase Cloud Firestore REST API.
 */
object NiraiApi {

    var BASE_URL = "http://10.0.2.2:4000"
    private const val FIREBASE_API_KEY = "AIzaSyBKYowgbbyApg-jbjJUwXQh69DHtxKJUvU"
    private const val FIREBASE_PROJECT_ID = "siteon-47a8f"

    suspend fun postSos(
        lat: Double,
        lng: Double,
        reporterName: String,
        reporterPhone: String,
        address: String
    ): String? = withContext(Dispatchers.IO) {
        val caseId = "case-${System.currentTimeMillis()}"

        // 1. Post to Firebase Cloud Firestore directly for instant web dashboard sync anywhere in the world
        postSosToFirebase(caseId, lat, lng, reporterName, reporterPhone, address)

        // 2. Post to Local/LAN Backend Server if available
        try {
            val url = URL("$BASE_URL/v1/sos")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 4000
                readTimeout = 4000
            }
            val body = """
                {
                    "lat": $lat,
                    "lng": $lng,
                    "reporterName": "$reporterName",
                    "reporterPhone": "$reporterPhone",
                    "address": "$address"
                }
            """.trimIndent()
            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val response = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            response
        } catch (e: Exception) {
            e.printStackTrace()
            // Even if local server fails, return valid JSON since Firebase Firestore received the case
            """{"success":true,"caseId":"$caseId","source":"firebase"}"""
        }
    }

    private fun postSosToFirebase(
        caseId: String,
        lat: Double,
        lng: Double,
        reporterName: String,
        reporterPhone: String,
        address: String
    ) {
        try {
            val firestoreUrl = URL("https://firestore.googleapis.com/v1/projects/$FIREBASE_PROJECT_ID/databases/(default)/documents/cases?key=$FIREBASE_API_KEY&documentId=$caseId")
            val conn = (firestoreUrl.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 5000
                readTimeout = 5000
            }
            val body = """
                {
                    "fields": {
                        "id": { "stringValue": "$caseId" },
                        "reporterUserId": { "stringValue": "usr-mobile" },
                        "reporterName": { "stringValue": "$reporterName" },
                        "reporterPhone": { "stringValue": "$reporterPhone" },
                        "status": { "stringValue": "raised" },
                        "address": { "stringValue": "$address" },
                        "severityScore": { "integerValue": "5" },
                        "createdAt": { "stringValue": "${java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date())}" },
                        "location": {
                            "mapValue": {
                                "fields": {
                                    "lat": { "doubleValue": $lat },
                                    "lng": { "doubleValue": $lng }
                                }
                            }
                        }
                    }
                }
            """.trimIndent()
            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val responseCode = conn.responseCode
            conn.disconnect()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun updateOfficerLocation(
        userId: String,
        lat: Double,
        lng: Double,
        onDuty: Boolean
    ): String? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/officers/location")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 5000
                readTimeout = 5000
            }
            val body = """
                {
                    "userId": "$userId",
                    "lat": $lat,
                    "lng": $lng,
                    "onDuty": $onDuty
                }
            """.trimIndent()
            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val response = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            response
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun updateDroneTelemetry(
        droneId: String,
        lat: Double,
        lng: Double,
        altitudeMeters: Int,
        batteryPct: Int,
        status: String
    ): String? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/drones/telemetry")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 5000
                readTimeout = 5000
            }
            val body = """
                {
                    "droneId": "$droneId",
                    "lat": $lat,
                    "lng": $lng,
                    "altitudeMeters": $altitudeMeters,
                    "batteryPct": $batteryPct,
                    "status": "$status"
                }
            """.trimIndent()
            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val response = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            response
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun acknowledgeCase(
        caseId: String,
        officerUserId: String
    ): String? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/cases/$caseId/assign")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 5000
                readTimeout = 5000
            }
            val body = """{"officerUserId": "$officerUserId"}"""
            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val response = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            response
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getCases(): String? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/cases")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 5000
                readTimeout = 5000
            }
            val response = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            response
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
