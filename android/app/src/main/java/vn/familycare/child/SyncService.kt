package vn.familycare.child
import android.Manifest
import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.*
import android.os.*
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** Started explicitly while UI visible; notification remains visible for entire sharing session. */
class SyncService:Service(),LocationListener {
 private val worker=Executors.newSingleThreadScheduledExecutor()
 private lateinit var store:SecureStore
 private var locations:LocationManager?=null
 override fun onCreate(){
  super.onCreate();store=SecureStore(this)
  val nm=getSystemService(NOTIFICATION_SERVICE) as NotificationManager
  nm.createNotificationChannel(NotificationChannel("sharing","Chia sáº» Family Care",NotificationManager.IMPORTANCE_LOW))
  val open=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_IMMUTABLE)
  val stop=PendingIntent.getService(this,1,Intent(this,SyncService::class.java).setAction("STOP"),PendingIntent.FLAG_IMMUTABLE)
  val notification=Notification.Builder(this,"sharing").setSmallIcon(android.R.drawable.ic_menu_info_details).setContentTitle("Family Care Ä‘ang chia sáº»").setContentText("Usage, cuá»™c gá»i/vá»‹ trÃ­ chá»‰ khi Ä‘Ã£ cáº¥p quyá»n. Cháº¡m Ä‘á»ƒ xem.").setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null,"Dá»«ng chia sáº»",stop).build()).build()
  val hasLocation=checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==android.content.pm.PackageManager.PERMISSION_GRANTED
  if(Build.VERSION.SDK_INT>=34)startForeground(1,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE or if(hasLocation)ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0) else startForeground(1,notification)
  if(hasLocation){locations=getSystemService(LOCATION_SERVICE) as LocationManager;try{for(provider in listOf(LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER)){if(locations!!.isProviderEnabled(provider))locations!!.requestLocationUpdates(provider,60000,25f,this)}}catch(_:SecurityException){}}
  worker.scheduleWithFixedDelay({try{if(store.token()!=null && store.get("sharing")=="true")SyncEngine(this).sync()}catch(e:DeviceRevokedException){try{PolicyEnforcer(this,store).clear()}catch(_:Exception){};store.put("sharing","false");store.put("status",e.message ?: "ÄÃ£ thu há»“i");stopSelf()}catch(e:Exception){store.put("status","Äá»“ng bá»™ chÆ°a thÃ nh cÃ´ng: ${e.message}")}},0,30,TimeUnit.SECONDS)
 }
 override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int {if(intent?.action=="STOP"){store.put("sharing","false");stopSelf()};return START_NOT_STICKY}
 override fun onLocationChanged(location:Location){if(store.get("sharing")!="true" || store.token()==null)return;if(System.currentTimeMillis()-location.time in 0..120000 && location.hasAccuracy())try{Telemetry(this,store).location(location.latitude,location.longitude,location.accuracy,location.time)}catch(_:Exception){}}
 override fun onProviderEnabled(provider:String){};override fun onProviderDisabled(provider:String){}
 override fun onStatusChanged(provider:String?,status:Int,extras:Bundle?){}
 override fun onBind(intent:Intent?)=null
 override fun onDestroy(){locations?.removeUpdates(this);worker.shutdownNow();super.onDestroy()}
}

