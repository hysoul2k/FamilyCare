# Trạng thái triển khai dữ liệu thật — 06/11/2026

Không còn chế độ minh họa trong web. Không tạo sẵn tài khoản, hồ sơ hoặc sự kiện. Tất cả fixture nằm trong test và tài khoản kiểm thử local đã được dọn sau kiểm tra.

| Bước | Đã triển khai và kiểm tra | Điều kiện/giới hạn còn lại |
|---|---|---|
| 1. Tài khoản/database | SQLite local, migration lặp an toàn, scrypt/session, rate limit, đăng ký/đăng xuất, isolation gia đình | Chưa có email khôi phục tài khoản hoặc MFA cho local; không tuyên bố identity ngoài đã được xác minh |
| 2. Gia đình/thiết bị | Tạo trẻ, mã một lần 10 phút, credential hash/Keystore, heartbeat/capability, danh sách ứng dụng, revoke/unpair | Nhiều client phải dùng cùng URL; local và cloud là hai DB riêng |
| 3. App phụ huynh và app trẻ | Hai APK debug đã build/lint; parent web/dashboard responsive; child web cho iOS/PWA | Android release signing và nghiệm thu trên máy vật lý chưa thực hiện |
| 4. Usage/quota/app | Collector UsageEvents tăng thêm, outbox/dedup, thống kê ngày/giờ/package; policy, app thiết yếu, quota từng app, lịch, hạn chế có thời hạn | Chặn/quota/lịch chỉ thực thi khi OS cho phép device/profile owner. Máy Android cài thường báo unsupported. Không tự reset/enrollment |
| 5. Lệnh và xin giờ | Queue/ACK/kết quả tách biệt; optimistic locking; xin 5/15/30 phút, duyệt một lần; allowance chỉ đúng ngày | Polling khi app/dịch vụ chạy; chưa FCM/APNs, không bảo đảm khi OS dừng dịch vụ |
| 6. Cuộc gọi/vị trí/vùng | Collector có permission, ingest mã hóa, point có timestamp/accuracy, geofence hai điểm cách ≥30 giây, cảnh báo/SOS/read/resolve | Android call/GPS thực tế còn cần quyền trên từng model; iOS web chỉ gửi vị trí foreground trên HTTPS và không có quyền call/block/usage app khác |
| 7. Người chăm sóc | Lời mời token gắn email, recipient nhận lời, owner duyệt, quyền theo trẻ/ca/hạn; revoke hiệu lực request tiếp theo | Chia sẻ link thủ công; chưa SMTP hoặc xác minh email qua email. Owner phải xác nhận đúng người trước duyệt |
| 8. Phân tích và train | Import TXT/JSON có đồng ý, preview/confirm, rule/statistics có evidence, phản hồi; Naive Bayes train bằng dữ liệu người dùng và đánh giá holdout; nội dung/model mã hóa | Chưa có model đã train khi chưa nhận dữ liệu thực được phép. Không LLM bên ngoài hoặc đọc inbox tự động Zalo/Facebook/Instagram; không chẩn đoán/phạt tự động |
| 9. Privacy/vận hành | Audit, AES-GCM riêng tư, export/xóa DB, chặn ghi muộn sau revoke/delete, sweep expiry, backup local hằng ngày khi server chạy | Snapshot còn giữ dữ liệu cũ tối đa thời hạn backup; cần hoàn thiện tombstone/restore nghiệm thu trước pilot; chưa kết luận tuân thủ pháp lý theo thị trường |
| 10. Xác minh | Unit/SQL/API tests; Playwright parent→child→approval→SOS→import→report→delete; APK build/lint; emulator install/launch + real telemetry | Chưa có thử nghiệm physical device, owner/profile enrollment, OEM/Doze/reboot, tải lớn hoặc restore drill |

## Bằng chứng

- `npm test`: 32 kiểm thử domain, giao dịch SQLite, lifecycle, quyền, geofence, mã hóa, parser và training/evaluation.
- `npm run test:e2e`: 1 hành trình nhiều bước qua hai browser context, tự tạo rồi xóa tài khoản/dữ liệu test.
- `npm run typecheck` và build Sites: chạy thành công trên Node 26.
- Android `test-core.ps1`: 16 assertions sau sửa consent/outbox. Cả hai `assembleDebug` và `lintDebug` thành công, không lỗi lint; còn cảnh báo tương thích/UI được ghi trong `android/VALIDATION.md`.
- Emulator API36: cài/mở hai APK; child enrollment thật tới backend, heartbeat có 26 ứng dụng, nhận 3 đoạn usage thật của `com.android.settings`. Không dùng dữ liệu mô phỏng trong pipeline này. Dữ liệu và tài khoản kiểm thử đã xóa.
- Hai lỗi Android P1 từ review đã sửa: dừng chia sẻ không thu/upload khi chỉ xem quy tắc; queue đầy/expired không khóa đồng bộ vĩnh viễn và có cảnh báo mất coverage.
- Backend review đã sửa schema policy, auth bucket, export expiry, state geofence nguyên tử, command childId và bỏ giới hạn telemetry toàn gia đình gây thiếu thống kê.

## Các quyết định thay đổi so với bản đề xuất

1. Dùng tài khoản ứng dụng thật cho local thay identity giả lập của starter. Site vẫn giữ cổng riêng tư của Sites khi online.
2. Giữ SQLite/D1 và schema `records` cho dữ liệu nghiệp vụ, tables riêng cho identity/session/credentials/events; chưa chuyển sang PostgreSQL khi chưa có nhu cầu đo được.
3. Android native dùng Activity/service, không bắt buộc Compose để có bản APK kiểm thử được ngay.
4. Android polling/foreground service thay push khi chưa có cấu hình vendor; thông báo trong web/app phụ huynh cần client đang hoạt động.
5. iOS theo yêu cầu dùng web/PWA, công bố giới hạn OS. Muốn native parental-control phải làm app iOS riêng và đáp ứng entitlement, dù cài Ad Hoc.
6. Phân tích cục bộ có train thực bằng nhãn người dùng; không lấy rule engine hay classifier nhỏ làm bằng chứng đã có LLM được fine-tune.

## Chưa xác minh do môi trường/chính sách

Kiểm thử tự động điều hướng/đăng nhập trong WebView APK phụ huynh đã bị automatic approval review từ chối với lý do duy nhất “blocked by policy”. Không thử đường vòng. App phụ huynh đã cài/mở trong emulator; luồng dashboard được kiểm qua browser, nhưng luồng đăng nhập trong APK phụ huynh chưa được xác nhận end-to-end.

Không đánh dấu toàn bộ hệ thống sẵn sàng production hoặc mọi task thiết kế đã hoàn tất. Bước nghiệm thu tiếp theo là cài APK trên máy được phép, cấp quyền cần thiết và kiểm tra các giới hạn nêu trên.
