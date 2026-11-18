# Phạm vi ứng dụng quản lý: web, Android APK, iPhone web app

Bạn phụ trách ứng dụng quản lý và AI; bạn cùng nhóm phụ trách ứng dụng trẻ. Backend/Supabase và hợp đồng API là phần liên kết chung. Không cần tách database theo nền tảng hoặc đưa khóa server vào APK/PWA.

## Các bản quản lý

| Nền tảng | Hiện thực | Cách mở |
|---|---|---|
| Web | Dashboard responsive tại `/` | Trình duyệt máy tính/điện thoại |
| Android | `android/parent`, WebView cùng dashboard | APK quản lý, nhập địa chỉ backend |
| iPhone/iPad | Web app ở màn hình chính, manifest standalone và cấu hình Apple web app | Safari → Chia sẻ → Thêm vào Màn hình chính |

iOS theo lựa chọn người dùng chỉ là web app/PWA, không có dự án Swift, IPA hoặc TestFlight trong đợt này. Trang `/install` có hướng dẫn cho cả ba cách sử dụng. Icon app và trang khởi động đều trỏ vào bảng quản lý; trang đăng nhập/cài đặt quản lý không dẫn nhầm sang web trẻ.

Web và các app dùng cùng tài khoản Family Care, cùng backend và dữ liệu Supabase. Safari/PWA/Android WebView có kho cookie riêng nên có thể phải đăng nhập riêng. Phiên chưa hết hạn được trình duyệt/WebView giữ theo chính sách của nền tảng.

Trạng thái mạng cần rõ: đây là ứng dụng online, chưa hỗ trợ tác vụ quản lý offline. Không thêm service worker cache dữ liệu gia đình riêng tư. Thông báo hiện là polling khi đang mở app; chưa có Web Push/FCM cho app đóng. Một icon trên màn hình chính không làm web có quyền đọc cuộc gọi hoặc kiểm soát các app khác của người quản lý.

## Thử iPhone

1. Dùng Safari mở URL HTTPS của backend quản lý.
2. Nhấn Chia sẻ, chọn Thêm vào Màn hình chính; bật Mở dưới dạng ứng dụng web nếu có tùy chọn này.
3. Nhấn Thêm, mở icon Family Care, đăng nhập và chọn trẻ.
4. Kiểm tra quota, vị trí, báo cáo AI, thao tác duyệt và đăng xuất; số liệu thực tế phụ thuộc dữ liệu app trẻ đã gửi.

Khi thử LAN, dùng IP máy tính, không dùng localhost của máy tính trên iPhone. HTTP LAN phục vụ xem giao diện; dùng HTTPS để thử cài web app và các API cần secure context ổn định. Supabase online không có nghĩa web/backend đã được triển khai online.

## Android quản lý

Chỉ build module `parent`, không sửa module trẻ `app`. Bản APK tại `/downloads/family-care-parent-debug.apk` đã được cập nhật từ build manager. Có chọn tệp TXT/JSON, xóa phiên local, tiến trình tải và thử lại. Không có JavaScript bridge, TLS bypass hay yêu cầu quyền đọc điện thoại của người quản lý.

Bản APK hiện chưa lưu được JSON xuất qua blob URL; màn hình native hướng dẫn dùng website trong trình duyệt cho chức năng xuất. Việc nhập tệp và các thao tác quản lý vẫn cần kiểm thử trên điện thoại thật. APK debug không phải bản ký phát hành/Google Play.

## Phía app trẻ được bàn giao

- Android: `android/app/`.
- Web trẻ tham khảo: `app/child/`.
- API thiết bị: `docs/device-api.md`.
- Cơ chế mới xin gỡ: `docs/removal-contract.md`.

App trẻ hiện tại chưa thực thi chống gỡ hoặc lệnh ALLOW_REMOVAL. Không đánh dấu thiết bị đang được bảo vệ nếu chưa có xác nhận capability/trạng thái từ client. Phần quản lý/API đã sẵn sàng nhận yêu cầu và duyệt; bạn cùng nhóm phải tích hợp native theo giới hạn OS.
