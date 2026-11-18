package vn.familycare.parent

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.*

/** Dashboard session stays inside WebView; no JavaScript bridge or TLS exceptions. */
class MainActivity : Activity() {
 private var web: WebView? = null
 private var origin = ""
 private var fileCallback: ValueCallback<Array<Uri>>? = null
 private var pickerPending = false
 private var sessionClearing = false
 private val prefs by lazy { getSharedPreferences("parent", MODE_PRIVATE) }
 override fun onCreate(state: Bundle?) { super.onCreate(state); pickerPending = state?.getBoolean("pickerPending") ?: false; setup() }
 private fun cancelPicker() { fileCallback?.onReceiveValue(null); fileCallback = null }
 private fun closeWeb() { cancelPicker(); web?.stopLoading(); web?.destroy(); web = null }
 private fun setup() {
  closeWeb()
  val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32,60,32,32) }
  layout.addView(TextView(this).apply { text = "Family Care · Người quản lý"; textSize = 25f })
  layout.addView(TextView(this).apply { text = "Dành cho phụ huynh, giáo viên và người chăm sóc. Dùng địa chỉ gốc của website Family Care; không dùng địa chỉ API Supabase. Bản phát hành yêu cầu HTTPS." })
  val server = EditText(this).apply { hint = "https://dia-chi-website"; setSingleLine(); setText(prefs.getString("server", "")) }
  layout.addView(server)
  val open = Button(this).apply { text = "Mở bảng quản lý"; isEnabled = !sessionClearing; setOnClickListener {
   try { origin = ManagerServerPolicy.validateServer(server.text.toString(), BuildConfig.DEBUG); prefs.edit().putString("server",origin).apply(); dashboard() }
   catch (_: IllegalArgumentException) { server.error = "Cần địa chỉ HTTPS gốc của website. Debug chỉ cho HTTP mạng nội bộ/localhost." }
  } }
  layout.addView(open)
  val clear = Button(this).apply { text = "Xóa phiên đăng nhập trên app"; isEnabled = !sessionClearing }
  clear.setOnClickListener {
   sessionClearing = true; open.isEnabled = false; clear.isEnabled = false
   WebStorage.getInstance().deleteAllData()
   CookieManager.getInstance().removeAllCookies {
    CookieManager.getInstance().flush(); sessionClearing = false
    if (!isFinishing && !isDestroyed) { open.isEnabled = true; clear.isEnabled = true; Toast.makeText(this,"Đã xóa phiên trên máy",Toast.LENGTH_LONG).show() }
   }
  }
  layout.addView(clear)
  layout.addView(TextView(this).apply { text = "Hỗ trợ chọn tệp TXT/JSON để nhập dữ liệu. Xuất JSON: hãy dùng website trong trình duyệt; bản APK chưa lưu được tệp tải xuống." })
  setContentView(layout)
 }
 private fun dashboard() {
  val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
  layout.setOnApplyWindowInsetsListener { v, i -> v.setPadding(0,i.systemWindowInsetTop,0,i.systemWindowInsetBottom); i }
  layout.addView(Button(this).apply { text = "Máy chủ / phiên đăng nhập"; setOnClickListener { setup() } })
  val progress = ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal)
  layout.addView(progress)
  val error = TextView(this).apply { visibility = View.GONE; text = "Không tải được trang. Kiểm tra kết nối và địa chỉ máy chủ." }
  layout.addView(error)
  val retry = Button(this).apply { text = "Thử lại"; visibility = View.GONE }
  layout.addView(retry)
  val view = WebView(this); web = view
  with(view.settings) { javaScriptEnabled = true; domStorageEnabled = true; allowFileAccess = false; allowContentAccess = false; mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW; setSupportMultipleWindows(false); javaScriptCanOpenWindowsAutomatically = false }
  CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(view,false)
  fun failed() { error.visibility = View.VISIBLE; retry.visibility = View.VISIBLE; progress.visibility = View.GONE }
  retry.setOnClickListener { error.visibility = View.GONE; retry.visibility = View.GONE; view.visibility = View.VISIBLE; view.loadUrl(origin) }
  view.webViewClient = object : WebViewClient() {
   override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
    if (!r.isForMainFrame) return false
    if (ManagerServerPolicy.isManagerNavigation(origin,r.url.toString())) return false
    // Same-host blocked routes never leave the app, including encoded child routes.
    if (r.url.host.equals(Uri.parse(origin).host,true)) { Toast.makeText(this@MainActivity,"Trang này không thuộc ứng dụng quản lý",Toast.LENGTH_SHORT).show(); return true }
    if (r.hasGesture() && r.url.scheme in listOf("https","http","tel","mailto")) try { startActivity(Intent(Intent.ACTION_VIEW,r.url).addCategory(Intent.CATEGORY_BROWSABLE)) } catch (_: Exception) {}
    return true
   }
   override fun onPageStarted(v: WebView,url: String,icon: android.graphics.Bitmap?) {
    if (!ManagerServerPolicy.isManagerNavigation(origin,url)) { v.stopLoading(); v.visibility = View.INVISIBLE; failed(); return }
    progress.visibility = View.VISIBLE; error.visibility = View.GONE; retry.visibility = View.GONE
   }
   override fun onPageFinished(v: WebView,url: String) { progress.visibility = View.GONE; CookieManager.getInstance().flush() }
   override fun onReceivedError(v: WebView,r: WebResourceRequest,e: WebResourceError) { if(r.isForMainFrame) failed() }
   override fun onReceivedHttpError(v: WebView,r: WebResourceRequest,e: WebResourceResponse) { if(r.isForMainFrame && e.statusCode >= 400) failed() }
   override fun onReceivedSslError(v: WebView,h: SslErrorHandler,e: android.net.http.SslError) { h.cancel(); failed() }
  }
  view.webChromeClient = object : WebChromeClient() {
   override fun onProgressChanged(v: WebView,value: Int) { progress.progress = value }
   override fun onPermissionRequest(request: PermissionRequest) { request.deny() }
   override fun onShowFileChooser(v: WebView,callback: ValueCallback<Array<Uri>>,params: FileChooserParams): Boolean {
    cancelPicker()
    if(pickerPending) { callback.onReceiveValue(null); return true }
    if(!ManagerServerPolicy.isManagerNavigation(origin,v.url ?: "")) { callback.onReceiveValue(null); return true }
    fileCallback = callback; pickerPending = true
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "*/*"; putExtra(Intent.EXTRA_MIME_TYPES,arrayOf("text/plain","application/json")); putExtra(Intent.EXTRA_ALLOW_MULTIPLE,false) }
    try { startActivityForResult(intent,FILE_REQUEST) } catch (_: Exception) { pickerPending = false; cancelPicker() }
    return true
   }
  }
  view.setDownloadListener { _,_,_,_,_ -> Toast.makeText(this,"Để xuất JSON, mở website trong trình duyệt.",Toast.LENGTH_LONG).show() }
  layout.addView(view,LinearLayout.LayoutParams(-1,0,1f)); setContentView(layout); view.loadUrl(origin)
 }
 @Deprecated("Deprecated in Java") override fun onActivityResult(requestCode: Int,resultCode: Int,data: Intent?) {
  super.onActivityResult(requestCode,resultCode,data)
  if(requestCode == FILE_REQUEST) { pickerPending = false; val uri = data?.data; val result = if(resultCode == RESULT_OK && uri?.scheme == "content") arrayOf(uri) else null; fileCallback?.onReceiveValue(result); fileCallback = null }
 }
 override fun onSaveInstanceState(state: Bundle) { state.putBoolean("pickerPending",pickerPending); super.onSaveInstanceState(state) }
 @Deprecated("Deprecated in Java") override fun onBackPressed() { if(web?.canGoBack() == true) web?.goBack() else setup() }
 override fun onDestroy() { closeWeb(); super.onDestroy() }
 companion object { private const val FILE_REQUEST = 701 }
}
