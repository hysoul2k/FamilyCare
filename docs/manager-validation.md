# Xác minh bản quản lý — 18/11/2026

Phạm vi cuối: web quản lý, APK quản lý Android, iPhone web app thêm vào màn hình chính. App trẻ native được bàn giao cho thành viên khác; không có project iOS native của app quản lý.

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | 42/42 đạt; có SQLite và PostgreSQL trong bộ nhớ |
| `npm run typecheck` | Đạt |
| Lint các file mới / layout / manifest | Đạt; không tuyên bố whole-project lint cũ đã sạch |
| `npm run build` | Đạt, có route `/install` |
| `npm run test:e2e` | 3/3 đạt trong 1,6 phút |
| E2E cài quản lý | Manifest standalone mở root quản lý, icon tải được, meta Apple/viewport, mobile không tràn ngang |
| E2E duyệt gỡ | Dữ liệu mock riêng; xác nhận chủ duyệt và UI vẫn chờ thiết bị, không giả định đã gỡ |
| E2E liên kết thật | Tạo tài khoản thử → trẻ PWA ghép → xin giờ/duyệt → SOS → nhập/phân tích → dọn dữ liệu, chạy qua backend đang dùng Supabase |
| Java ManagerServerPolicy | Tất cả assertions đạt |
| Android `:parent:assembleDebug :parent:lintDebug` | BUILD SUCCESSFUL; lint 0 lỗi, 11 cảnh báo theo báo cáo build |

APK quản lý được sao chép từ output build vào `public/downloads/family-care-parent-debug.apk`. SHA256:

```text
302012D182998458527CED00EBD561F03E7BEB3D5891B02F255C45BBBC22BF1B
```

Cảnh báo Android còn gồm target SDK, API inset deprecated, chuỗi UI tiếng Việt hardcoded và cấu hình WebView/backup; chưa phải bản ký phát hành. Chưa kiểm thử picker/login/lifecycle trên điện thoại vật lý trong đợt này. Xuất JSON trong APK hiện hướng dẫn dùng trình duyệt.

Giao diện iPhone được kiểm tra bằng browser viewport mobile và hợp đồng cài đặt, chưa phải nghiệm thu Safari trên iPhone thật. PWA cần được thử với URL HTTPS thực tế; không có tác vụ nền/offline hay Web Push mới.

Luồng chống gỡ chỉ mới hoàn thiện phía quản lý và API. Các kiểm thử xác minh request/decision/command/credential, không chứng minh OS đã chặn uninstall. Native child cần thực thi Android management hoặc Apple child authorization phù hợp và gửi trạng thái thật.

Review độc lập không tìm thấy P1/P2 trong luồng quyền/phê duyệt.
