package vn.familycare.child

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
class DeviceRevokedException: IllegalStateException("Credential thiết bị đã bị thu hồi; chia sẻ đã dừng.")
class DeviceHttpException(val status:Int):IllegalStateException("Backend trả lỗi $status. Không coi thao tác là thành công.")

class DeviceApi(private val baseUrl: String, private val token: String? = null) {
    init { val uri=URI(baseUrl); require(uri.scheme == "https" || (BuildConfig.DEBUG && uri.scheme == "http")) { "Backend phải dùng HTTPS (HTTP chỉ dành cho APK debug LAN)." }; require(uri.host != null && uri.userInfo == null && uri.query == null && uri.fragment == null) { "Địa chỉ backend không hợp lệ." } }
    fun request(path: String, body: JSONObject? = null): String {
        val connection = URI(baseUrl.trimEnd('/') + "/api/" + path).toURL().openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 15000; connection.readTimeout = 20000
            connection.instanceFollowRedirects = false
            connection.requestMethod = if (body == null) "GET" else "POST"
            connection.setRequestProperty("Accept", "application/json")
            token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            body?.let {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { stream -> stream.write(it.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            if (status !in 200..299) {
                if (status == 401 || status == 403) throw DeviceRevokedException()
                throw DeviceHttpException(status)
            }
            return connection.inputStream.bufferedReader().use { it.readText() }
        } finally { connection.disconnect() }
    }
}
