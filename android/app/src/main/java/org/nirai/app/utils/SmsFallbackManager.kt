package org.nirai.app.utils

import android.telephony.SmsManager
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

object SmsFallbackManager {
    private const val BACKEND_SMS_SHORTCODE = "000000"
    
    // Tracks if an SMS payload has been sent successfully during the current session
    var isSmsSentAndConfirmed by mutableStateOf(false)

    fun sendOfflineSosPayload(userId: String, lat: Double, lng: Double): Boolean {
        return try {
            val smsManager: SmsManager = SmsManager.getDefault()
            val payload = "NIRAI_SOS:$userId:$lat:$lng:${System.currentTimeMillis()}"
            smsManager.sendTextMessage(BACKEND_SMS_SHORTCODE, null, payload, null, null)
            isSmsSentAndConfirmed = true
            true
        } catch (e: Exception) {
            e.printStackTrace()
            isSmsSentAndConfirmed = false
            return false
        }
    }
    
    fun resetFallbackStatus() {
        isSmsSentAndConfirmed = false
    }
}
