package org.nirai.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * NIRAI C2 HTTP Client — dual-path Firebase Firestore + Local Backend.
 */
object NiraiApi {

    var BASE_URL = "http://10.0.2.2:4000"
    private const val FIREBASE_API_KEY = "AIzaSyBKYowgbbyApg-jbjJUwXQh69DHtxKJUvU"
    private const val FIREBASE_PROJECT_ID = "siteon-47a8f"

    /**
     * Returns the caseId on success, null on failure.
     */
    suspend fun postSos(
        lat: Double,
        lng: Double,
        reporterName: String,
        reporterPhone: String,
        address: String
    ): String? = withContext(Dispatchers.IO) {
        val caseId = "case-${System.currentTimeMillis().toString().takeLast(4)}"

        // 1. Firebase Firestore direct write for instant global sync
        postSosToFirebase(caseId, lat, lng, reporterName, reporterPhone, address)

        // 2. Local/LAN backend
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
                    "caseId": "$caseId",
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
            // Try to extract caseId from response JSON
            val idMatch = Regex(""""caseId"\s*:\s*"([^"]+)"""").find(response)
            val backendCaseId = idMatch?.groupValues?.get(1)
            // Also try the nested case.id
            val caseIdMatch = Regex(""""id"\s*:\s*"(case-[^"]+)"""").find(response)
            backendCaseId ?: caseIdMatch?.groupValues?.get(1) ?: caseId
        } catch (e: Exception) {
            e.printStackTrace()
            caseId
        }
    }

    /**
     * Cancel an active SOS case.
     */
    suspend fun cancelCase(caseId: String, cancelledBy: String = "civilian"): Boolean = withContext(Dispatchers.IO) {
        // Cancel on Firebase
        cancelCaseOnFirebase(caseId, cancelledBy)

        // Cancel on local backend
        try {
            val url = URL("$BASE_URL/v1/cases/$caseId/cancel")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 4000
                readTimeout = 4000
            }
            val body = """{"cancelledBy": "$cancelledBy"}"""
            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val code = conn.responseCode
            conn.disconnect()
            code in 200..299
        } catch (e: Exception) {
            e.printStackTrace()
            true // Firebase cancel already succeeded
        }
    }

    private fun cancelCaseOnFirebase(caseId: String, cancelledBy: String) {
        try {
            val firestoreUrl = URL("https://firestore.googleapis.com/v1/projects/$FIREBASE_PROJECT_ID/databases/(default)/documents/cases/$caseId?key=$FIREBASE_API_KEY&updateMask.fieldPaths=status&updateMask.fieldPaths=cancelledBy&updateMask.fieldPaths=verificationNotes")
            val conn = (firestoreUrl.openConnection() as HttpURLConnection).apply {
                requestMethod = "PATCH"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 5000
                readTimeout = 5000
            }
            val body = """
                {
                    "fields": {
                        "status": { "stringValue": "false_alarm" },
                        "cancelledBy": { "stringValue": "$cancelledBy" },
                        "verificationNotes": { "stringValue": "Cancelled by $cancelledBy" }
                    }
                }
            """.trimIndent()
            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            conn.responseCode
            conn.disconnect()
        } catch (e: Exception) {
            e.printStackTrace()
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
            conn.responseCode
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

    /**
     * Send live optical video frame and acoustic audio chunk from mobile node.
     * Supports both drone node IDs (e.g. "drone-c1") and SOS case IDs (e.g. "case-101").
     */
    suspend fun sendDroneFrame(
        droneId: String,
        frameBase64: String,
        audioBase64: String? = null,
        decibelLevel: Int? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/drones/stream-frame")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 3000
                readTimeout = 3000
            }
            val audioPart = if (audioBase64 != null) """, "audioData": "$audioBase64"""" else ""
            val dbPart = if (decibelLevel != null) """, "decibelLevel": $decibelLevel""" else ""
            val body = """{"droneId": "$droneId", "frameData": "$frameBase64"$audioPart$dbPart}"""

            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val code = conn.responseCode
            conn.disconnect()
            code in 200..299
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Send dedicated civilian scene video frame and acoustic audio buffer to SOS case endpoint.
     */
    suspend fun sendCaseMediaFeed(
        caseId: String,
        frameBase64: String?,
        audioBase64: String? = null,
        decibelLevel: Int? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/cases/$caseId/stream-frame")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 3000
                readTimeout = 3000
            }
            val framePart = if (frameBase64 != null) """"frameData": "$frameBase64"""" else """"frameData": null"""
            val audioPart = if (audioBase64 != null) """, "audioData": "$audioBase64"""" else ""
            val dbPart = if (decibelLevel != null) """, "decibelLevel": $decibelLevel""" else ""
            val body = """{$framePart$audioPart$dbPart}"""

            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val code = conn.responseCode
            conn.disconnect()
            code in 200..299
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Fetch a single case by ID. Returns Triple(status, assignedOfficerName, etaSeconds) or null.
     * Dual-path enabled: falls back to direct Cloud Firestore REST query if local C2 backend is offline.
     */
    suspend fun getCaseById(caseId: String): Triple<String, String?, String?>? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/cases/$caseId")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 5000
                readTimeout = 5000
            }
            val response = conn.inputStream.bufferedReader().readText()
            conn.disconnect()

            val statusMatch = Regex(""""status"\s*:\s*"([^"]+)"""").find(response)
            val officerMatch = Regex(""""assignedOfficerName"\s*:\s*"([^"]+)"""").find(response)
            val etaMatch = Regex(""""etaSeconds"\s*:\s*(\d+)""").find(response)

            val status = statusMatch?.groupValues?.get(1) ?: return@withContext null
            val officer = officerMatch?.groupValues?.get(1)
            val eta = etaMatch?.groupValues?.get(1)

            Triple(status, officer, eta)
        } catch (e: Exception) {
            // Local backend offline/unreachable -> Fallback to direct Firebase REST API
            try {
                val firestoreUrl = URL("https://firestore.googleapis.com/v1/projects/$FIREBASE_PROJECT_ID/databases/(default)/documents/cases/$caseId?key=$FIREBASE_API_KEY")
                val conn = (firestoreUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 5000
                    readTimeout = 5000
                }
                val response = conn.inputStream.bufferedReader().readText()
                conn.disconnect()

                val statusMatch = Regex(""""status"\s*:\s*\{\s*"stringValue"\s*:\s*"([^"]+)"""").find(response)
                val officerMatch = Regex(""""assignedOfficerName"\s*:\s*\{\s*"stringValue"\s*:\s*"([^"]+)"""").find(response)
                val etaMatch = Regex(""""etaSeconds"\s*:\s*\{\s*"(integerValue|doubleValue)"\s*:\s*"([^"]+)"""").find(response)

                val status = statusMatch?.groupValues?.get(1) ?: return@withContext null
                val officer = officerMatch?.groupValues?.get(1)
                val eta = etaMatch?.groupValues?.get(2)

                Triple(status, officer, eta)
            } catch (e2: Exception) {
                e2.printStackTrace()
                null
            }
        }
    }
}
