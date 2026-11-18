# Family Care — dữ liệu thật

## Database online dùng chung: Supabase

Dự án đã có adapter Supabase PostgreSQL qua HTTPS, giữ nguyên API của hai app. Xem [hướng dẫn Supabase](docs/supabase-setup.md), [hợp đồng API thiết bị](docs/device-api.md) và [cách cộng tác qua GitHub](CONTRIBUTING.md).

`npm run supabase:prepare` chuẩn bị cấu hình local mà không ghi đè secret hiện có; `npm run supabase:check` xác minh kết nối/migration trước khi đặt `FC_DATABASE_PROVIDER=supabase`. Cần áp dụng migration và đặt server secret riêng tư; URL và publishable key không đủ quyền ghi dữ liệu nghiệp vụ qua backend. Chưa tự triển khai online hoặc chuyển dữ liệu local lên cloud.

Hướng dẫn SQLite/D1 bên dưới vẫn là chế độ phát triển local. Chọn Supabase không tự đồng bộ dữ liệu local cũ. Các kết quả kiểm thử lịch sử không thay thế kiểm tra project Supabase thật.

Hệ thống gồm web phụ huynh, APK phụ huynh, APK Android cho trẻ và web/PWA cho trẻ dùng iPhone. Các client cùng truy cập một backend để chia sẻ tài khoản, hồ sơ, chính sách và dữ liệu. Không có tài khoản mặc định, sự kiện mẫu hoặc chế độ minh họa.

## Mở bản local

```sh
npm ci
npm run setup:local
npm run dev
```

Node >=22.16 (đã kiểm bằng Node 26). Địa chỉ trên máy: http://127.0.0.1:5173 . Thiết bị cùng Wi-Fi dùng IP LAN mà server in ra, dạng `http://<IP-LAN>:5173`. IP có thể đổi khi đổi mạng. Không nhập localhost của máy tính vào điện thoại. APK yêu cầu nhập URL, không điền sẵn IP của máy phát triển.

Database là SQLite do D1 local quản lý tại `.wrangler/state/v3/d1/`. Chạy `setup:local` để áp dụng migration và tạo khóa mã hóa `.dev.vars`; không sửa migration đã áp dụng. Khóa không được đưa lên Git. Đăng ký tài khoản riêng trên giao diện, tạo gia đình và hồ sơ trẻ; các màn hình trống cho đến khi bạn nhập hoặc thiết bị gửi dữ liệu.

## Cài ứng dụng

- Phụ huynh Android: tải `/downloads/family-care-parent-debug.apk`, nhập URL backend, đăng nhập cùng tài khoản web.
- Trẻ Android: tải `/downloads/family-care-child-debug.apk`, nhập cùng URL, ghép bằng mã một lần do phụ huynh tạo. Cấp từng quyền cần dùng, rồi chủ động bật chia sẻ. Luôn có thông báo khi dịch vụ chia sẻ chạy.
- Trẻ iPhone: mở `/child` bằng Safari, ghép mã, chọn Chia sẻ → Thêm vào Màn hình chính. Web chỉ xem quy tắc, xin phút, gửi SOS và chia sẻ một vị trí khi đang mở/cấp quyền. Định vị cần HTTPS; HTTP LAN không đáp ứng yêu cầu này của Safari.
- Phụ huynh iPhone: dùng web và thêm vào màn hình chính. Không cần App Store/TestFlight cho phần web/PWA.

Hai APK hiện là bản debug phục vụ thử nghiệm, không phải bản ký phát hành. APK chỉ cho HTTP trong build debug để thử LAN; release yêu cầu HTTPS. Không cấu hình bypass token toàn Site trong APK. Nếu dùng Sites riêng tư, lớp xác thực Sites có thể chặn client native; bản LAN không có cổng này. Cần gateway native phù hợp trước triển khai Android qua Site riêng tư.

## Những luồng đã triển khai

1. Tài khoản thật: mật khẩu scrypt, session HttpOnly, giới hạn đăng nhập, đăng xuất và thu hồi phiên. Identity giả lập của starter không cấp quyền backend.
2. Gia đình/trẻ, mã ghép 10 phút dùng một lần, credential riêng từng máy, heartbeat, danh sách app, capability và thu hồi/gỡ ghép.
3. Policy có version: quota, hạn mức từng app, lịch học/ngủ, app thiết yếu, app cấm, hạn chế có thời hạn. Tách trạng thái mong muốn, ACK và kết quả thực thi.
4. Thu usage theo đoạn tăng thêm, cuộc gọi metadata và vị trí trên Android khi được cấp quyền; outbox bền vững, retry/dedup và thông báo thiếu dữ liệu.
5. Trẻ xin thêm giờ; phụ huynh duyệt một lần, bonus chỉ có hiệu lực đúng ngày theo múi giờ policy.
6. Vị trí, vùng an toàn và cảnh báo: hai điểm đủ tin cậy, cách nhau ít nhất 30 giây; không cảnh báo chắc chắn từ GPS cũ hoặc sai số lớn. SOS, đã đọc/đã xử lý.
7. Mời phụ huynh cộng tác/giáo viên/bảo mẫu theo trẻ, quyền và ca; người nhận đúng tài khoản nhận lời và chủ gia đình duyệt. Chia sẻ liên kết thủ công, không giả gửi email.
8. Nhập TXT/JSON có xác nhận quyền, xem trước rồi xác nhận; phân tích có dẫn chứng; phản hồi báo cáo và xóa nguồn/báo cáo dẫn xuất.
9. Bộ phân loại Naive Bayes cục bộ có thể huấn luyện bằng dữ liệu thực đã gán nhãn và được phép dùng; tập kiểm thử phải riêng. Không có model được huấn luyện sẵn bằng dữ liệu giả và không tự đọc hộp thư Zalo/Facebook/Instagram. Đây không phải mô hình ngôn ngữ hoặc chẩn đoán tâm lý.
10. Xuất JSON, xóa gia đình, audit, mã hóa AES-GCM cho tọa độ/cuộc gọi/nội dung nhập/model riêng tư; sweep retention khi chạy local và scheduled handler cho môi trường có cron.

## Giới hạn hệ điều hành cần biết

- Android cài thông thường có thể cung cấp dữ liệu theo quyền; chặn app/quota/lịch cần device owner hoặc profile owner. APK không tự enrollment, reset máy hoặc vượt quyền OS. Profile owner chỉ quản lý profile đó.
- Khóa màn hình cần Device Admin được cấp rõ ràng; không đổi mật mã hay bảo đảm trẻ không mở lại.
- iOS web không đọc cuộc gọi, thời gian app khác, chặn app hoặc khóa điện thoại. Muốn các quyền parental-control native phải làm iOS riêng và đáp ứng entitlement Apple; cài IPA ngoài store không tự cấp quyền.
- Khi chia sẻ bị dừng, app Android không thu/upload telemetry khi chỉ xem quy tắc. OEM có thể dừng dịch vụ nền; không có bảo đảm thời gian thực khi app/OS dừng dịch vụ. Dashboard giữ thời điểm đồng bộ và capability thực tế.
- Chưa cấu hình push FCM/APNs hay SMTP; thông báo phụ huynh cập nhật qua polling khi app/web mở. Chưa nghiệm thu trên điện thoại vật lý hoặc managed enrollment thực tế.

## Lưu giữ và sao lưu local

`npm run dev` chạy sweep mỗi phút và backup SQLite mỗi ngày vào `.sites-runtime/backups/`, giữ tối đa 30 ngày. Chỉ hoạt động khi tiến trình local còn chạy. Sự kiện thô 30 ngày, tệp nhập tối đa 24 giờ, báo cáo 90 ngày, audit 180 ngày; API kiểm quyền và thời hạn trước đọc.

Giữ bản sao khóa `.dev.vars` riêng tư khi sao lưu; mất khóa sẽ không giải mã được dữ liệu. Snapshot cũ có thể chứa dữ liệu đã xóa cho đến khi hết hạn. Không tự phục hồi snapshot vào production: cần kiểm tra và áp lại các yêu cầu xóa/thu hồi phát sinh sau snapshot. Quy trình khôi phục có tombstone bền vững và nghiệm thu phục hồi vẫn là điều kiện trước pilot thực tế.

## Kiểm thử

```sh
npm test
npm run typecheck
npx playwright install chromium
# Server local cần đang chạy:
npm run test:e2e
# Build web:
npm run build
```

Playwright tạo tài khoản kiểm thử riêng rồi xóa gia đình và tài khoản trong cleanup; không chạy vào tài khoản production. Các fixture chỉ nằm trong test, không được đưa vào runtime. Nguồn Android có Gradle wrapper, `test-core.ps1` và build/lint riêng: xem [hướng dẫn Android](android/README.md) và [bằng chứng kiểm tra](android/VALIDATION.md).

## Hồ sơ bàn giao

- [Trạng thái từng bước](docs/implementation-status.md).
- [Tiến độ, quyết định và giới hạn](docs/progress.md).
- [Cơ chế phân tích/huấn luyện cục bộ](docs/ai-engine.md).
- Thiết kế đầy đủ và kế hoạch gốc nằm trong thư mục `../docs` của workspace.

Cloud và local dùng database độc lập. Dùng cùng URL backend trên web/app nếu muốn xem cùng tài khoản và dữ liệu. Không có đồng bộ ngầm giữa SQLite local và Site online.
