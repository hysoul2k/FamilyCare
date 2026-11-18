package vn.familycare.parent
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.*
import android.widget.*
import java.net.URI

/** Uses the real dashboard's own authenticated session. No native JavaScript bridges. */
class MainActivity:Activity() {
 private var web:WebView?=null
 private var origin:URI?=null
 override fun onCreate(state:Bundle?){super.onCreate(state);setup()}
 private fun setup(){
  web?.destroy();web=null
  val prefs=getSharedPreferences("parent",MODE_PRIVATE)
  val layout=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(32,60,32,32)}
  layout.addView(TextView(this).apply{text="Family Care · Phụ huynh";textSize=25f})
  layout.addView(TextView(this).apply{text="Ứng dụng kết nối bảng điều khiển thật. Đăng nhập bằng tài khoản gia đình; phiên đăng nhập lưu riêng trong ứng dụng. Bản phát hành yêu cầu HTTPS."})
  val server=EditText(this).apply{hint="Địa chỉ HTTPS máy chủ";setSingleLine();setText(prefs.getString("server",""));layout.addView(this)}
  layout.addView(Button(this).apply{text="Mở quản lý gia đình";setOnClickListener{
   try{val uri=URI(server.text.toString().trim());require(uri.scheme=="https" || (BuildConfig.DEBUG && uri.scheme=="http"));require(uri.host!=null && uri.userInfo==null && uri.query==null && uri.fragment==null);origin=uri;prefs.edit().putString("server",uri.toString()).apply();dashboard(uri)}catch(_:Exception){server.error="Địa chỉ không hợp lệ; yêu cầu HTTPS (debug cho phép HTTP LAN)."}
  }})
  layout.addView(Button(this).apply{text="Xóa phiên đăng nhập trên app";setOnClickListener{CookieManager.getInstance().removeAllCookies(null);CookieManager.getInstance().flush();WebStorage.getInstance().deleteAllData();Toast.makeText(this@MainActivity,"Đã xóa phiên trên máy",Toast.LENGTH_LONG).show()}})
  setContentView(layout)
 }
 private fun sameOrigin(uri:Uri):Boolean {val o=origin ?: return false;val port=if(uri.port<0)if(uri.scheme=="https")443 else 80 else uri.port;val op=if(o.port<0)if(o.scheme=="https")443 else 80 else o.port;return uri.scheme==o.scheme && uri.host.equals(o.host,true) && port==op}
 private fun dashboard(uri:URI){
  val layout=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
  layout.setOnApplyWindowInsetsListener{v,insets->v.setPadding(0,insets.systemWindowInsetTop,0,insets.systemWindowInsetBottom);insets}
  layout.addView(Button(this).apply{text="Máy chủ / phiên đăng nhập";setOnClickListener{setup()}})
  val view=WebView(this);web=view
  with(view.settings){javaScriptEnabled=true;domStorageEnabled=true;allowFileAccess=false;allowContentAccess=false;mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW;setSupportMultipleWindows(false);javaScriptCanOpenWindowsAutomatically=false;databaseEnabled=false}
  CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(view,false)
  view.webViewClient=object:WebViewClient(){
   override fun shouldOverrideUrlLoading(v:WebView,r:WebResourceRequest):Boolean {if(sameOrigin(r.url))return false;if(r.isForMainFrame && r.url.scheme in listOf("https","http","tel","mailto"))try{startActivity(Intent(Intent.ACTION_VIEW,r.url))}catch(_:Exception){};return true}
   override fun onReceivedSslError(v:WebView,h:android.webkit.SslErrorHandler,e:android.net.http.SslError){h.cancel()}
   override fun onPageFinished(v:WebView,url:String){CookieManager.getInstance().flush()}
  }
  view.webChromeClient=object:WebChromeClient(){override fun onPermissionRequest(request:PermissionRequest){request.deny()}}
  layout.addView(view,LinearLayout.LayoutParams(-1,0,1f));setContentView(layout);view.loadUrl(uri.toString().trimEnd('/')+"/")
 }
 @Deprecated("Deprecated in Java") override fun onBackPressed(){if(web?.canGoBack()==true)web?.goBack() else setup()}
 override fun onDestroy(){web?.destroy();super.onDestroy()}
}
