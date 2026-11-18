package vn.familycare.child
import android.Manifest
import android.app.*
import android.app.admin.DevicePolicyManager
import android.content.*
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.widget.*
import org.json.JSONObject
import java.util.concurrent.Executors

class MainActivity:Activity() {
 private lateinit var store:SecureStore
 private lateinit var status:TextView
 private val worker=Executors.newSingleThreadExecutor()
 private fun description():String {
  val p=JSONObject(store.get("policy") ?: "{}");val t=Telemetry(this,store)
  return "${store.get("status") ?: "Chưa đồng bộ"}\nChia sẻ dữ liệu: ${t.sharing()}\n${t.coverage()}\nUsage: ${t.usageAllowed()}; vị trí: ${t.permission(Manifest.permission.ACCESS_FINE_LOCATION)}; gọi: ${t.permission(Manifest.permission.READ_CALL_LOG)}\nChặn app: ${if(PolicyEnforcer(this,store).supported()) "máy/profile quản lý" else "không hỗ trợ máy cài thường"}\nQuy tắc v${p.optInt("version")}: ${p.optInt("dailyLimitMinutes")} phút/ngày; thêm ${p.optInt("allowanceMinutes")} phút ngày ${p.optString("allowanceDate")}\nDùng hôm nay (phút): ${t.totals(p)}\nCấm: ${p.optJSONArray("blockedPackages")}\nHạn mức app: ${p.optJSONObject("appLimits")}\nLịch: ${p.optJSONArray("schedules")}"
 }
 private fun async(action:()->String){status.text="Đang kết nối…";worker.execute{val result=try{action()}catch(e:Exception){e.message ?: "Thao tác thất bại"};runOnUiThread{status.text=result;Toast.makeText(this,result,Toast.LENGTH_LONG).show()}}}
 override fun onCreate(savedInstanceState:Bundle?){
  super.onCreate(savedInstanceState);store=SecureStore(this)
  val layout=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(32,40,32,32)}
  fun text(v:String,size:Float=15f)=TextView(this).apply{text=v;textSize=size;setPadding(0,12,0,12);layout.addView(this)}
  fun input(h:String,v:String="")=EditText(this).apply{hint=h;setText(v);layout.addView(this)}
  fun button(label:String,action:()->Unit){layout.addView(Button(this).apply{text=label;setOnClickListener{action()}})}
  text("Family Care · Con",26f)
  text("Khi bật chia sẻ, ứng dụng gửi thời gian dùng và danh sách app; vị trí, số/chiều/thời lượng gọi chỉ khi cấp riêng từng quyền. Không đọc tin nhắn hay ghi âm. Có thông báo thường trực và nút dừng. Máy cài thường không thể chặn app. Chỉ máy/profile được quản lý mới thực thi hạn mức/lịch.")
  val server=input("Máy chủ HTTPS (debug hỗ trợ HTTP LAN)",store.get("server") ?: "")
  val code=input("Mã ghép một lần từ phụ huynh")
  status=text(description())
  button("Ghép thiết bị"){val url=server.text.toString().trim();val pairing=code.text.toString().trim();async{check(store.token()==null){"Máy đã ghép; hãy gỡ ghép trước."};val r=JSONObject(DeviceApi(url).request("device/enroll",JSONObject().put("code",pairing).put("name",Build.MODEL)));store.saveToken(r.getString("token"));store.put("server",url);store.put("deviceId",r.getString("deviceId"));r.optJSONObject("policy")?.let{store.put("policy",it.toString())};"Đã ghép. Bật chia sẻ khi sẵn sàng."}}
  button("Cấp quyền thời gian dùng app"){startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))}
  button("Cấp quyền vị trí (tùy chọn)"){requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION),31)}
  button("Chia sẻ nhật ký gọi (tùy chọn)"){AlertDialog.Builder(this).setTitle("Chia sẻ cuộc gọi").setMessage("Gửi số, chiều, thời lượng và thời gian gọi cho gia đình đã ghép. Không ghi âm. Thu hồi trong Cài đặt bất kỳ lúc nào.").setNegativeButton("Hủy",null).setPositiveButton("Cấp quyền"){_,_->requestPermissions(arrayOf(Manifest.permission.READ_CALL_LOG),32)}.show()}
  button("Bật chia sẻ và đồng bộ nền"){if(store.token()==null)Toast.makeText(this,"Hãy ghép trước",Toast.LENGTH_LONG).show() else if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS),33) else startSharing()}
  button("Dừng chia sẻ"){store.put("sharing","false");stopService(Intent(this,SyncService::class.java));status.text="Đã dừng chia sẻ. Các quy tắc quản lý đã áp dụng còn hiệu lực; gỡ ghép để xóa."}
  button("Cập nhật quy tắc / đồng bộ khi đang chia sẻ"){async{SyncEngine(this).sync()+"\n"+description()}}
  button("Cho phép lệnh khóa màn hình"){startActivity(Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN,ComponentName(this,CareAdminReceiver::class.java)).putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,"Cho phép gia đình gửi lệnh khóa; không thay mã mở khóa."))}
  val minutes=input("Phút muốn xin thêm","15");minutes.inputType=android.text.InputType.TYPE_CLASS_NUMBER
  val reason=input("Lý do xin thêm giờ")
  button("Xin thêm giờ"){val m=minutes.text.toString().toIntOrNull();val r=reason.text.toString();async{check(m!=null && m in 1..180){"Số phút từ 1 đến 180"};api().request("device/time-requests",JSONObject().put("minutes",m).put("reason",r));"Đã gửi; chờ phụ huynh duyệt."}}
  button("Lịch sử yêu cầu"){async{api().request("device/time-requests")}}
  val phone=input("Số phụ huynh",store.get("parentPhone") ?: "");phone.inputType=android.text.InputType.TYPE_CLASS_PHONE
  button("Gọi phụ huynh / trợ giúp"){val number=phone.text.toString();store.put("parentPhone",number);startActivity(Intent(Intent.ACTION_DIAL,Uri.fromParts("tel",number,null)))}
  button("Gỡ ghép và xóa dữ liệu trên máy"){AlertDialog.Builder(this).setTitle("Gỡ ghép?").setMessage("Dừng thu, bỏ chặn do ứng dụng đặt và xóa token/sự kiện còn chờ. Phụ huynh quản lý dữ liệu đã gửi trên web.").setNegativeButton("Hủy",null).setPositiveButton("Gỡ ghép"){_,_->async{unpair()}}.show()}
  text("Gọi khẩn cấp qua ứng dụng Điện thoại hệ thống. Android có thể dừng dịch vụ khi tiết kiệm pin, reboot hoặc người dùng dừng; mở app để bật lại. Chu kỳ kiểm tra 30 giây; không bảo đảm chặn tức thì.")
  setContentView(ScrollView(this).apply{addView(layout)})
 }
 private fun api()=DeviceApi(store.get("server") ?: error("Hãy ghép trước"),store.token() ?: error("Hãy ghép trước"))
 private fun unpair():String {
  stopService(Intent(this,SyncService::class.java))
  return synchronized(SyncEngine.guard){
   val confirmed=try{api().request("device/unpair",JSONObject());true}catch(_:DeviceRevokedException){true}catch(_:Exception){false}
   PolicyEnforcer(this,store).clear();store.clear()
   "Đã gỡ ghép, bỏ chặn và xóa dữ liệu trên máy. "+if(confirmed) "Máy chủ đã thu hồi credential." else "Chưa xác nhận thu hồi trên máy chủ do mất mạng; nhờ phụ huynh thu hồi trên dashboard."
  }
 }
 private fun startSharing(){Telemetry(this,store).resetCollection();store.put("sharing","true");startForegroundService(Intent(this,SyncService::class.java));status.text="Đã yêu cầu bật chia sẻ; xem thông báo thường trực."}
 override fun onRequestPermissionsResult(requestCode:Int,permissions:Array<out String>,grantResults:IntArray){super.onRequestPermissionsResult(requestCode,permissions,grantResults);if(requestCode==33 && grantResults.isNotEmpty() && grantResults[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)startSharing()}
 override fun onDestroy(){worker.shutdown();super.onDestroy()}
}
