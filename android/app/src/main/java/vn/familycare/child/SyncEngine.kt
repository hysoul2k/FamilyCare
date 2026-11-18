package vn.familycare.child
import android.content.Context
import android.os.BatteryManager
import org.json.JSONArray
import org.json.JSONObject

class SyncEngine(private val context:Context) {
 companion object { val guard=Any() }
 private val store=SecureStore(context)
 private fun refreshLocation(telemetry:Telemetry) {
  check(telemetry.sharing()){ "SHARING_STOPPED" }
  check(telemetry.permission(android.Manifest.permission.ACCESS_FINE_LOCATION)){ "LOCATION_PERMISSION_REQUIRED" }
  val manager=context.getSystemService(Context.LOCATION_SERVICE) as android.location.LocationManager
  val provider=if(manager.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)) android.location.LocationManager.GPS_PROVIDER else android.location.LocationManager.NETWORK_PROVIDER
  check(manager.isProviderEnabled(provider)){ "LOCATION_DISABLED" }
  val latch=java.util.concurrent.CountDownLatch(1);var fix:android.location.Location?=null
  val listener=object:android.location.LocationListener {
   override fun onLocationChanged(location:android.location.Location){fix=location;latch.countDown()}
   override fun onProviderEnabled(provider:String){};override fun onProviderDisabled(provider:String){}
   override fun onStatusChanged(provider:String?,status:Int,extras:android.os.Bundle?){}
  }
  try{manager.requestSingleUpdate(provider,listener,android.os.Looper.getMainLooper());check(latch.await(20,java.util.concurrent.TimeUnit.SECONDS)){ "LOCATION_TIMEOUT" }}finally{manager.removeUpdates(listener)}
  val location=fix ?: error("LOCATION_UNAVAILABLE");check(location.hasAccuracy() && System.currentTimeMillis()-location.time in 0..120000){ "LOCATION_STALE" }
  check(telemetry.sharing()){ "SHARING_STOPPED" };telemetry.location(location.latitude,location.longitude,location.accuracy,location.time)
 }
 fun sync():String = synchronized(guard) {
  try {
  val token=store.token() ?: error("Hãy ghép thiết bị trước.")
  val api=DeviceApi(store.get("server") ?: error("Thiếu địa chỉ máy chủ"),token)
  val enforcer=PolicyEnforcer(context,store);val telemetry=Telemetry(context,store)
  var policy=JSONObject(store.get("policy") ?: "{}")
  // Policy control is available while stopped; telemetry always requires current explicit consent.
  var policyError:String?=null
  try{enforcer.apply(policy)}catch(e:Exception){policyError=e.message}
  var drainFailed=false
  if(telemetry.sharing()) {
   try{telemetry.flush(api)}catch(e:DeviceRevokedException){throw e}catch(_:Exception){drainFailed=true}
   telemetry.collect(policy)
   if(!drainFailed)telemetry.flush(api)
  }
  val next=JSONObject(api.request("device/policy"))
  check(next.optInt("version")>=policy.optInt("version")){ "STALE_POLICY" }
  policy=next;store.put("policy",policy.toString())
  try{enforcer.apply(policy);policyError=null}catch(e:Exception){policyError=e.message}
  val cap=JSONObject().put("app_block",if(enforcer.supported()) "supported" else "unsupported")
   .put("usage",if(!telemetry.sharing()) "temporarily_unavailable" else if(telemetry.usageAllowed()) "supported" else "permission_required")
   .put("calls",if(!telemetry.sharing()) "temporarily_unavailable" else if(telemetry.permission(android.Manifest.permission.READ_CALL_LOG)) "supported" else "permission_required")
   .put("location",if(!telemetry.sharing()) "temporarily_unavailable" else if(telemetry.permission(android.Manifest.permission.ACCESS_FINE_LOCATION)) "supported" else "permission_required")
   .put("lock",if((context.getSystemService(Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager).isAdminActive(android.content.ComponentName(context,CareAdminReceiver::class.java))) "supported" else "permission_required")
  val heartbeat=JSONObject().put("capabilities",cap).put("sharingActive",telemetry.sharing())
  if(telemetry.sharing()) {
   val apps=JSONArray();enforcer.installed().forEach{apps.put(JSONObject().put("packageId",it.first).put("name",it.second))}
   if(telemetry.sharing())heartbeat.put("installedApps",apps).put("battery",(context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager).getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY))
  }
  val applied=store.get("appliedVersion")?.toIntOrNull() ?: 0
  if(applied>0 && policyError==null)heartbeat.put("appliedPolicyVersion",applied)
  if(policyError!=null)heartbeat.put("policyError",policyError)
  if(!telemetry.sharing()){heartbeat.remove("installedApps");heartbeat.remove("battery")};api.request("device/heartbeat",heartbeat)
  val commands=JSONArray(api.request("device/commands"))
  for(i in 0 until commands.length()) {
   val record=commands.getJSONObject(i);val command=record.optJSONObject("data") ?: record;val id=record.getString("id")
   if(command.optLong("expiresAt",Long.MAX_VALUE)<=System.currentTimeMillis())continue
   if(command.optString("status")!="acknowledged")api.request("device/commands/$id/results",JSONObject().put("status","acknowledged"))
   var failure:String?=null
   try{when(command.getString("type")){"LOCK_SCREEN"->enforcer.lock();"REFRESH_LOCATION"->{refreshLocation(telemetry);telemetry.flush(api)};"APPLY_POLICY","UPDATE_POLICY","SYNC_POLICY"->enforcer.apply(policy);else->error("COMMAND_UNSUPPORTED")}}catch(e:Exception){failure=e.message ?: "OS_REJECTED"}
   val result=JSONObject().put("status",if(failure==null) "applied" else "failed");if(failure!=null)result.put("errorCode",failure.take(180));api.request("device/commands/$id/results",result)
  }
  val result="Đồng bộ ${java.text.DateFormat.getTimeInstance().format(java.util.Date())}. Quy tắc v${policy.optInt("version")}; ${policy.optInt("dailyLimitMinutes")} phút/ngày. "+(policyError?.let{"Chưa thực thi: $it"} ?: "Đã áp dụng trong phạm vi quản lý.")+if(!telemetry.sharing()) " Chỉ cập nhật quy tắc; chia sẻ dữ liệu đang dừng." else " ${telemetry.coverage()}"+(if(drainFailed) " Hàng đợi chưa gửi được; giữ lại để thử sau." else "")
  store.put("status",result);result
  } catch(e:DeviceRevokedException) {
   try{PolicyEnforcer(context,store).clear()}catch(_:Exception){}
   store.removeToken();store.put("sharing","false");throw e
  }
 }
}
