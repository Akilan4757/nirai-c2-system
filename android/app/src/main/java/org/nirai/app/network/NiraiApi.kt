package org.nirai.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Lightweight HTTP client for NIRAI backend.
 * Uses HttpURLConnection — no Retrofit/OkHttp dependency needed for hackathon demo.
 *
 * BASE_URL should be updated to the public server address when hosting on the internet.
 * For local dev: "http://10.0.2.2:4000" (Android emulator -> host machine)
 * For LAN: "http://<your-machine-ip>:4000"
 * For production: "https://your-domain.com"
 */
object NiraiApi {

    // Default: emulator loopback to host. Override at runtime for real devices.
    var BASE_URL = "http://10.0.2.2:4000"

    suspend fun postSos(
        lat: Double,
        lng: Double,
        reporterName: String,
        reporterPhone: String,
        address: String
    ): String? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/sos")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 5000
                readTimeout = 5000
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
            null
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
