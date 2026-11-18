package vn.familycare.child

import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Process
import android.provider.CallLog
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.util.UUID

/** Cursor, outbox and local quota ledger are committed together before sending. */
class Telemetry(private val context: Context, private val store: SecureStore) {
 companion object { val guard=Any() }
 fun usageAllowed(): Boolean = (context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager).checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,Process.myUid(),context.packageName)==AppOpsManager.MODE_ALLOWED
 fun permission(name:String)=context.checkSelfPermission(name)==PackageManager.PERMISSION_GRANTED
 fun sharing()=TelemetryRules.mayShare(store.get("sharing"))
 fun coverage():String=synchronized(guard){val s=state();"Mất ${s.optLong("droppedCount",0)} sự kiện; thiếu ${s.optDouble("droppedUsageMinutes",0.0)} phút dữ liệu gửi; lý do gần nhất: ${s.optString("dropReason","không")}."}
 private fun dropped(s:JSONObject,reason:String,event:JSONObject?=null){
  s.put("droppedCount",s.optLong("droppedCount",0)+1).put("dropReason",reason).put("dropAt",System.currentTimeMillis())
  val minutes=if(event?.optString("kind")=="usage")event.optJSONObject("payload")?.optDouble("minutes",0.0) ?: 0.0 else 0.0
  if(minutes.isFinite() && minutes>0)s.put("droppedUsageMinutes",s.optDouble("droppedUsageMinutes",0.0)+minutes)
 }
 fun resetCollection()=synchronized(guard){val s=state();val now=System.currentTimeMillis();s.put("usageCursor",now).put("callCursor",now).put("active","");store.put("telemetry",s.toString())}
 private fun state()=JSONObject(store.get("telemetry") ?: "{}")
 private fun queue(s:JSONObject):JSONArray=s.optJSONArray("queue") ?: JSONArray().also { s.put("queue",it) }
 private fun append(s:JSONObject,kind:String,time:Long,payload:JSONObject,id:String=UUID.randomUUID().toString()) {
  val event=JSONObject().put("eventId",id).put("kind",kind).put("capturedAt",time).put("payload",payload)
  val q=queue(s);if(!TelemetryRules.hasRoom(q.length())){dropped(s,"OUTBOX_FULL",event);return};q.put(event)
 }
 fun location(lat:Double,lng:Double,accuracy:Float,time:Long) = synchronized(guard) {
  if(!sharing())return@synchronized
  val s=state();append(s,"location",time,JSONObject().put("lat",lat).put("lng",lng).put("accuracy",accuracy));store.put("telemetry",s.toString())
 }
 fun collect(policy:JSONObject) = synchronized(guard) {
  if(!sharing())return@synchronized
  val s=state();val now=System.currentTimeMillis(); val zone=try { ZoneId.of(policy.optString("timezone","Asia/Ho_Chi_Minh")) } catch(_:Exception){ZoneId.of("Asia/Ho_Chi_Minh")}
  if(usageAllowed()) {
   var cursor=s.optLong("usageCursor",now);if(cursor>now) cursor=now
   var active=s.optString("active","");var segment=cursor
   fun record(until:Long) {
    if(active.isNotEmpty() && active!=context.packageName && until>segment) {
     var start=segment
     while(start<until) {
      val local=Instant.ofEpochMilli(start).atZone(zone);val end=minOf(until,local.toLocalDate().plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli())
      val minutes=PolicyRules.delta(start,end)/60000.0
      val payload=JSONObject().put("packageId",active).put("minutes",minutes)
      if(local.hour>=22 || local.hour<7) payload.put("nightMinutes",minutes)
      val eventId=java.security.MessageDigest.getInstance("SHA-256").digest("usage:$active:$start:$end".toByteArray()).joinToString(""){"%02x".format(it)}
      append(s,"usage",end,payload,eventId)
      val ledger=s.optJSONObject("ledger") ?: JSONObject().also{s.put("ledger",it)}
      val day=local.toLocalDate().toString();val totals=ledger.optJSONObject(day) ?: JSONObject().also{ledger.put(day,it)}
      totals.put(active,PolicyRules.addMinutes(totals.optDouble(active),minutes));start=end
     }
    };segment=until
   }
   val events=(context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager).queryEvents(cursor,now)
   val e=UsageEvents.Event()
   while(events.hasNextEvent()) {
    events.getNextEvent(e);if(e.timeStamp<cursor)continue
    when(e.eventType) {
     UsageEvents.Event.ACTIVITY_RESUMED -> {record(e.timeStamp);active=e.packageName ?: ""}
     UsageEvents.Event.ACTIVITY_PAUSED -> if(e.packageName==active){record(e.timeStamp);active=""}
     UsageEvents.Event.SCREEN_NON_INTERACTIVE, UsageEvents.Event.DEVICE_SHUTDOWN -> {record(e.timeStamp);active=""}
    }
   }
   record(now);s.put("active",active).put("usageCursor",now)
  } else { s.put("active","").put("usageCursor",now) }
  if(permission(Manifest.permission.READ_CALL_LOG)) {
   val since=s.optLong("callCursor",now);var last=since
   context.contentResolver.query(CallLog.Calls.CONTENT_URI,arrayOf(CallLog.Calls._ID,CallLog.Calls.NUMBER,CallLog.Calls.TYPE,CallLog.Calls.DURATION,CallLog.Calls.DATE),"${CallLog.Calls.DATE} > ?",arrayOf(since.toString()),"${CallLog.Calls.DATE} ASC")?.use { c ->
    while(c.moveToNext()) {
     val time=c.getLong(4);val type=c.getInt(2); val direction=when(type){CallLog.Calls.INCOMING_TYPE->"incoming";CallLog.Calls.OUTGOING_TYPE->"outgoing";else->"missed"}
     append(s,"call",time,JSONObject().put("number",(c.getString(1) ?: "unknown").take(30)).put("direction",direction).put("duration",c.getLong(3).coerceIn(0,86400)),"call:${c.getLong(0)}:$time");last=maxOf(last,time)
    }
   };s.put("callCursor",last)
  } else s.put("callCursor",now)
  store.put("telemetry",s.toString())
 }
 fun totals(policy:JSONObject):JSONObject=synchronized(guard) {
  val zone=try{ZoneId.of(policy.optString("timezone","Asia/Ho_Chi_Minh"))}catch(_:Exception){ZoneId.of("Asia/Ho_Chi_Minh")}
  state().optJSONObject("ledger")?.optJSONObject(Instant.now().atZone(zone).toLocalDate().toString()) ?: JSONObject()
 }
 private fun problem(event:JSONObject,now:Long):String? {
  TelemetryRules.eventProblem(event.optLong("capturedAt",Long.MIN_VALUE),now)?.let{return it}
  return try {
   check(event.getString("eventId").length in 1..100)
   val p=event.getJSONObject("payload")
   fun number(name:String):Double {val value=p.getDouble(name);check(value.isFinite());return value}
   when(event.getString("kind")) {
    "usage"->{check(p.getString("packageId").length<=200);val minutes=number("minutes");check(minutes in 0.0..1440.0);if(p.has("nightMinutes"))check(number("nightMinutes") in 0.0..minutes)}
    "call"->{check(p.getString("number").length<=30);check(p.getString("direction") in listOf("incoming","outgoing","missed"));check(number("duration") in 0.0..86400.0)}
    "location"->{check(number("lat") in -90.0..90.0);check(number("lng") in -180.0..180.0);check(number("accuracy")>=0)}
    else->error("kind")
   };null
  }catch(_:Exception){"INVALID_EVENT"}
 }
 private fun prune()=synchronized(guard) {
  val s=state();val q=queue(s);val valid=JSONArray();val now=System.currentTimeMillis()
  for(i in 0 until q.length()) {
   val event=q.optJSONObject(i);val reason=if(event==null)"INVALID_EVENT" else problem(event,now)
   if(reason==null)valid.put(event) else dropped(s,reason,event)
  }
  s.put("queue",valid);store.put("telemetry",s.toString())
 }
 private fun remove(ids:Set<String>,reason:String?=null)=synchronized(guard) {
  val s=state();val q=queue(s);val remaining=JSONArray()
  for(i in 0 until q.length()) {val event=q.getJSONObject(i);if(ids.contains(event.getString("eventId"))){if(reason!=null)dropped(s,reason,event)}else remaining.put(event)}
  s.put("queue",remaining);store.put("telemetry",s.toString())
 }
 private fun sendBatch(api:DeviceApi,batch:JSONArray) {
  if(!sharing() || batch.length()==0)return
  try {
   // Only explicit accepted IDs may leave the outbox; partial receipts retain the rest.
   val receipt=JSONObject(api.request("device/events",JSONObject().put("events",batch)))
   val accepted=receipt.getJSONArray("accepted");val ids=(0 until accepted.length()).map{accepted.getString(it)}.toSet()
   remove(ids)
  }catch(e:DeviceHttpException){
   if(!TelemetryRules.permanentRejection(e.status))throw e
   if(batch.length()==1){remove(setOf(batch.getJSONObject(0).getString("eventId")),"SERVER_VALIDATION_${e.status}");return}
   // Isolate poison entries; successful siblings are still delivered. At most 39 requests for a batch of 20.
   val middle=batch.length()/2;val left=JSONArray();val right=JSONArray()
   for(i in 0 until batch.length())if(i<middle)left.put(batch.getJSONObject(i))else right.put(batch.getJSONObject(i))
   sendBatch(api,left);sendBatch(api,right)
  }
 }
 fun flush(api:DeviceApi) {
  if(!sharing())return
  prune()
  // Bounded work per sync; a full queue can always make progress before collection.
  repeat(5){
   if(!sharing())return
   val batch=synchronized(guard){val q=queue(state());JSONArray().also{b->for(i in 0 until minOf(q.length(),20))b.put(q.getJSONObject(i))}}
   if(batch.length()==0)return
   sendBatch(api,batch)
  }
 }
}