package vn.familycare.child
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId

class PolicyEnforcer(private val context:Context,private val store:SecureStore) {
 private val manager=context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
 private val admin=ComponentName(context,CareAdminReceiver::class.java)
 fun supported()=manager.isDeviceOwnerApp(context.packageName)||manager.isProfileOwnerApp(context.packageName)
 private fun strings(a:JSONArray?)=(0 until (a?.length() ?: 0)).map{a!!.getString(it)}.toSet()
 fun installed():List<Pair<String,String>> = context.packageManager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),0).map{it.activityInfo.packageName to it.loadLabel(context.packageManager).toString()}.distinctBy{it.first}
 private fun protectedPackages(policy:JSONObject):Set<String> {
  val set=strings(policy.optJSONArray("essentialPackages")).toMutableSet();set.add(context.packageName);set.add("com.android.settings");set.add("com.android.systemui")
  android.provider.Telephony.Sms.getDefaultSmsPackage(context)?.let{set.add(it)}
  (context.getSystemService(Context.TELECOM_SERVICE) as android.telecom.TelecomManager).defaultDialerPackage?.let{set.add(it)}
  for(intent in listOf(Intent(Intent.ACTION_DIAL,android.net.Uri.parse("tel:112")),Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME),Intent(android.provider.Settings.ACTION_SETTINGS))) {
   context.packageManager.queryIntentActivities(intent,0).forEach{set.add(it.activityInfo.packageName)}
  };return set
 }
 fun apply(policy:JSONObject) {
  check(supported()){ "MANAGED_DEVICE_REQUIRED" }
  check(Telemetry(context,store).usageAllowed()){ "USAGE_PERMISSION_REQUIRED" }
  val totals=Telemetry(context,store).totals(policy);val essential=protectedPackages(policy)
  val total=totals.keys().asSequence().filter{!essential.contains(it)}.sumOf{totals.optDouble(it)}
  val now=Instant.now().atZone(ZoneId.of(policy.optString("timezone","Asia/Ho_Chi_Minh")));val schedules=policy.optJSONArray("schedules") ?: JSONArray()
  var allowed:Set<String>?=null
  for(i in 0 until schedules.length()) {
   val schedule=schedules.getJSONObject(i);val start=schedule.getString("start");val end=schedule.getString("end");val minute=now.hour*60+now.minute
   val overnight=start>end; val weekday=if(overnight && minute < end.substringBefore(':').toInt()*60+end.substringAfter(':').toInt()) now.minusDays(1).dayOfWeek.value%7 else now.dayOfWeek.value%7
   val days=schedule.optJSONArray("days") ?: JSONArray();val matches=(0 until days.length()).any{days.getInt(it)==weekday}
   if(matches && PolicyRules.inWindow(minute,start,end)){val next=strings(schedule.optJSONArray("allowedPackages"));allowed=allowed?.intersect(next) ?: next}
  }
  val limit=PolicyRules.dailyLimit(policy.optDouble("dailyLimitMinutes",120.0),policy.optDouble("allowanceMinutes",0.0),policy.optString("allowanceDate"),now.toLocalDate().toString())
  val restricted=policy.optLong("restrictedUntil",0)>System.currentTimeMillis()
  val apps=installed().map{it.first}.toSet();val blocked=PolicyRules.blocked(apps,essential,strings(policy.optJSONArray("blockedPackages")),restricted || total>=limit,allowed).toMutableSet()
  val limits=policy.optJSONObject("appLimits") ?: JSONObject();limits.keys().forEach{pkg->if(totals.optDouble(pkg,0.0)>=limits.optDouble(pkg,Double.MAX_VALUE) && !essential.contains(pkg)) blocked.add(pkg)}
  val previous=strings(JSONArray(store.get("suspended") ?: "[]")); val release=previous-blocked
  if(release.isNotEmpty()) check(manager.setPackagesSuspended(admin,release.toTypedArray(),false).isEmpty()){ "UNSUSPEND_REJECTED" }
  // Persist intent before OS call, so revoke can recover after process death.
  store.put("suspended",JSONArray((previous+blocked).toList()).toString())
  val failed=if(blocked.isEmpty()) emptyArray<String>() else manager.setPackagesSuspended(admin,blocked.toTypedArray(),true)
  check(failed.isEmpty()){ "PACKAGE_REJECTED:${failed.joinToString(",").take(120)}" }
  store.put("suspended",JSONArray(blocked.toList()).toString());store.put("appliedVersion",policy.optInt("version").toString())
 }
 fun clear() {
  val previous=strings(JSONArray(store.get("suspended") ?: "[]"))
  if(previous.isNotEmpty()){check(supported()){ "MANAGEMENT_REMOVED_CONTACT_ADMIN" };check(manager.setPackagesSuspended(admin,previous.toTypedArray(),false).isEmpty()){ "UNSUSPEND_REJECTED" }}
  store.put("suspended","[]");store.put("appliedVersion","0")
 }
 fun lock(){check(manager.isAdminActive(admin)){ "LOCK_PERMISSION_REQUIRED" };manager.lockNow()}
}
