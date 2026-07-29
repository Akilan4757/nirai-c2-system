package org.nirai.app.utils

import android.telephony.SmsManager

object SmsFallbackManager {
    private const val BACKEND_SMS_SHORTCODE = "000000"

    fun sendOfflineSosPayload(userId: String, lat: Double, lng: Double): Boolean {
        return try {
            val smsManager: SmsManager = SmsManager.getDefault()
            val payload = "NIRAI_SOS:$userId:$lat:$lng:${System.currentTimeMillis()}"
            smsManager.sendTextMessage(BACKEND_SMS_SHORTCODE, null, payload, null, null)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
