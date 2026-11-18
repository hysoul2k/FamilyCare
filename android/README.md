# Family Care Android

Hai ứng dụng kết nối backend thật, không sinh sự kiện giả:

- `app`: `vn.familycare.child`, Family Care · Con.
- `parent`: `vn.familycare.parent`, Family Care · Phụ huynh. WebView của dashboard thật, đăng nhập bằng session cookie của backend; không có JavaScript bridge, không truy cập file/content, không bỏ kiểm tra TLS, chặn mixed content, link ngoài mở bằng trình duyệt hệ thống.

## Build

Yêu cầu JDK 17, Android SDK 35, Gradle 8.11.1 (AGP 8.9.1). Trong Android Studio chọn JDK 17 cho Gradle; Studio JBR 25 không tương thích Gradle/Kotlin DSL bản này. Không dùng Gradle 9 với cấu hình hiện tại.

```powershell
$env:JAVA_HOME='duong-dan-jdk-17'
$env:ANDROID_HOME='C:/Users/huy/AppData/Local/Android/Sdk'
./gradlew.bat :app:assembleDebug :parent:assembleDebug :app:lintDebug :parent:lintDebug
./test-core.ps1
```

APK: `app/build/outputs/apk/debug/app-debug.apk`, `parent/build/outputs/apk/debug/parent-debug.apk`. APK debug ký bằng khóa debug Android, dùng cho thử nghiệm. Bản release chưa cấu hình ký phát hành. Manifest chính cấm cleartext; chỉ source set debug cho HTTP để thử LAN. Nhập địa chỉ backend trên cả hai app. Gợi ý debug là `http://<IP-LAN>:5173`; máy Android phải cùng Wi-Fi và backend phải lắng nghe LAN. Backend cần mở `/api/device/*` cho Bearer token riêng từng thiết bị, không cần session web/Sites gateway trên đường native.

## Quy trình máy con

1. Phụ huynh đăng nhập trên app phụ huynh hoặc web, tạo hồ sơ và mã ghép.
2. Con mở app con, xem thông báo chia sẻ, nhập URL/mã, ghép. Token mã hóa AES-GCM bằng Android Keystore; backup tắt.
3. Cấp Usage Access tại cài đặt Android. Vị trí và nhật ký gọi là quyền riêng tùy chọn; từ chối không chặn ghép hoặc chia sẻ nguồn khác. Android/nhà phân phối có thể không cấp READ_CALL_LOG; app báo thiếu quyền, không giả có dữ liệu.
4. Bật chia sẻ trong UI. Có thông báo thường trực với nút dừng. Dịch vụ chỉ khởi động do người dùng, không tự bật lúc reboot. Sau đổi quyền vị trí, dừng rồi bật lại để đăng ký nguồn mới.
5. App gửi UsageEvents thành đoạn thời gian **tăng thêm**, không gửi tổng ngày như sự kiện mới. Cursor, trạng thái app foreground, outbox và ledger quota lưu cùng một commit. Event ID ổn định; gửi lại sau lỗi mạng để server dedup. Ghi outbox trước gửi, xóa sau server thành công. Lần bật chia sẻ bắt đầu từ thời điểm bật; không tự quét lịch sử trước consent. Cuộc gọi gửi số, chiều, thời lượng; không nội dung/ghi âm. GPS gửi fix thật có thời gian/sai số; geofence do server đánh giá.
6. App hiện quy tắc, usage ngày, xin phút, lịch sử xin giờ, quay số phụ huynh qua ACTION_DIAL. Gỡ ghép dừng dịch vụ, gọi POST device/unpair để thu hồi credential trên server, bỏ suspension do app đặt rồi xóa credential/dữ liệu chờ trên máy. Khi offline vẫn xóa local và nhắc phụ huynh thu hồi trên dashboard do chưa xác nhận server. Nếu OS từ chối bỏ chặn, thao tác báo lỗi và giữ dữ liệu phục hồi; cần quản trị viên xử lý. Phụ huynh thu hồi token/xóa dữ liệu trên server qua web.

## Thực thi và giới hạn

- Android cài thường: xem quy tắc và telemetry được cấp quyền; chặn app/quota/lịch **unsupported**. Không dùng Accessibility, overlay hoặc đường vòng bí mật.
- Chỉ device owner hoặc profile owner mới gọi DevicePolicyManager.setPackagesSuspended. Profile owner chỉ quản lý ứng dụng trong profile đó. Việc enrollment cần quy trình quản trị Android riêng trên máy thử nghiệm; APK không tự reset/enroll máy.
- Quy tắc xử lý blockedPackages, appLimits, dailyLimitMinutes, allowanceMinutes chỉ khi allowanceDate khớp ngày địa phương theo policy.timezone, lịch qua nửa đêm và restrictedUntil. Khi offline, ledger và policy giữ trên máy, kiểm tra mỗi 30 giây khi dịch vụ còn chạy.
- Bảo vệ app con, app home/launcher, cài đặt, giao diện hệ thống, trình gọi mặc định, SMS mặc định và essentialPackages. Quản lý tập app có launcher nhìn thấy được, không tuyên bố chặn mọi package hệ thống. API có thể từ chối package; ghi failed và không xác nhận version đã áp dụng khi lỗi.
- Lệnh ACK trước OS; chỉ applied sau thao tác thành công. SYNC_POLICY áp dụng policy mới, LOCK_SCREEN cần Device Admin cấp rõ ràng, REFRESH_LOCATION chờ fix mới tối đa 20 giây rồi báo applied sau gửi hoặc failed. Không tự mở khóa hay đổi mật mã.
- OS/OEM có thể dừng dịch vụ, hạn chế location/call, Doze hoặc đóng app. Khi dịch vụ bị dừng, không bảo đảm phát hiện hạn mức/lịch hết hạn hoặc tự bỏ suspension đúng giờ. Mở app và bật lại; gỡ ghép để bỏ chặn. Không có dịch vụ push/boot tự phục hồi hoặc lời hứa realtime.
- Đổi đồng hồ/giới hạn nguồn UsageEvents có thể ảnh hưởng độ phủ thống kê. Đa cửa sổ và app vừa bật trước lúc cấp quyền cần kiểm chứng từng OS. Quota dựa trên phút quan sát trên chính thiết bị/profile; không chia sẻ quota nhiều máy. Giới hạn outbox 15.000 sự kiện: cố gửi dữ liệu hợp lệ trước khi thu mới. Hết chỗ thì vẫn cập nhật cursor/ledger local, ghi số sự kiện/phút không gửi và lý do OUTBOX_FULL trên màn hình. Sự kiện quá 30 ngày/sai cấu trúc được loại với bộ đếm thiếu dữ liệu hiển thị. Batch bị server từ chối validation được chia nhỏ để xác định riêng sự kiện lỗi; sự kiện hợp lệ vẫn gửi, lỗi mạng/5xx/credential không tự xóa outbox. Chưa có nén/DB lớn hoặc mã hóa telemetry tại rest ngoài sandbox Android.
- Quyền nhật ký cuộc gọi, kiểm kê app và foreground specialUse cần đánh giá kênh phân phối/policy hiện hành trước phát hành. Không tuyên bố đã được Google Play chấp thuận.

## Kiểm chứng

`test-core.ps1` kiểm tra lịch qua đêm, ban ngày, essential precedence/quota, delta không âm, allowance hết hạn offline, consent tắt/mặc định, expiry/timestamp, giới hạn hàng đợi và phân biệt lỗi permanent/transient. Khi chia sẻ tắt, nút cập nhật quy tắc chỉ lấy policy/heartbeat điều khiển/lệnh; không collect, không flush, không gửi installedApps/battery và REFRESH_LOCATION trả SHARING_STOPPED. Dữ liệu đã chờ trước khi tắt chỉ gửi lại sau khi bật chia sẻ có chủ ý. Build/lint chạy trên máy phát triển; không thay thế test thiết bị. Trước triển khai thật, dùng máy được đồng thuận để thử: từ chối/thu hồi từng quyền, offline rồi gửi lại không trùng, chuyển ngày/đổi giờ, reboot, tắt thông báo, quota/lịch/essential, profile owner/device owner, OS từ chối package, thu hồi credential, GPS timeout và xóa suspension khi gỡ ghép. Chưa có bằng chứng kiểm thử vật lý trên model Android cụ thể.

Nguồn API đối chiếu: https://developer.android.com/reference/android/app/admin/DevicePolicyManager và https://developer.android.com/develop/background-work/services/fgs/service-types .

## Android dành cho người quản lý

Module `parent` dành cho phụ huynh, giáo viên và người chăm sóc; chỉ cần quyền Internet. Nhập địa chỉ HTTPS gốc của website (không nhập project URL `.supabase.co`, đường dẫn, query hoặc fragment). Bản debug cho HTTP tại localhost/loopback và IPv4 private LAN; bản phát hành chỉ cho HTTPS. Điều hướng trong WebView giới hạn cùng origin và chặn `/child`, kể cả đường dẫn mã hóa. Liên kết web ngoài do người dùng bấm mở bằng trình duyệt. Không bỏ kiểm tra TLS, không JavaScript bridge; không yêu cầu quyền quản trị thiết bị.

Có thanh tiến độ, trạng thái lỗi và nút thử lại. Chọn tệp nhập TXT/JSON dùng bộ chọn tài liệu Android; hủy hoặc tạo lại Activity giải phóng callback. Xóa phiên chờ cookie hoàn tất trước khi cho mở lại và xóa WebStorage. Xuất JSON qua blob/download chưa được hỗ trợ trong APK: dùng website bằng trình duyệt để xuất. Chưa kiểm thử tương tác trên thiết bị thật (picker, xoay màn hình, offline và đăng nhập).

Kiểm tra URL policy độc lập: compile `parent/src/main/java/vn/familycare/parent/ManagerServerPolicy.java` cùng `parent/src/test/java/vn/familycare/parent/ManagerServerPolicyTest.java` bằng `javac -encoding UTF-8 -d parent/build/policy-test`, sau đó `java -cp parent/build/policy-test vn.familycare.parent.ManagerServerPolicyTest`. Build/lint: `gradlew.bat :parent:assembleDebug :parent:lintDebug` với JDK 17 và Android SDK 35.
