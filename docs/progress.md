# Tiến độ triển khai — kế hoạch 2026-11-05-family-care

Thiết kế: ../../docs/thiet-ke-he-thong-family-care.md

- Đã tạo checkout mới family-care trên nhánh feat/family-care; thư mục tài liệu gốc được giữ nguyên.
- Kiểm tra môi trường: Node 26 có sẵn; Java/Android SDK/adb không có. Kiểm chứng OS trên thiết bị thật chưa thể hoàn thành trong môi trường này.
- Quyết định: dùng xác thực Sites có sẵn thay nhà cung cấp identity mới; không thêm mật khẩu ứng dụng. Chi phí thay đổi: tích hợp Android vào Site riêng tư còn cần cơ chế service access được hỗ trợ, chưa bật trên máy thật.
- Quyết định: triển khai nội tuyến; bộ mô phỏng kiểm giao thức không được gọi là bằng chứng Android thật.
- Pre-flight: policyVersion dùng xuyên API/thiết bị; family_id suy ra từ identity; desired policy tách command; permission dùng action/resource.
- Task 1: tài liệu nền tảng đã đối chiếu, thiếu kiểm chứng Android thật.
- Task 2–10: đang triển khai; chưa đánh dấu hoàn thành.

## Kết quả bản phát triển

- Backend/frontend và mã Android tối thiểu được triển khai; không đánh dấu toàn bộ Task 1–10 hoàn thành. Bảng phạm vi chính xác nằm trong implementation-status.md.
- Đã chạy npm test: 12/12 PASS; npm run test:e2e: 2/2 PASS; npm run typecheck PASS; Sites build-site.mjs PASS.
- Review độc lập phát hiện 5 lỗi: heartbeat ghi đè policy, ghi muộn sau xóa, CAS command không kiểm kết quả, policy/command không nguyên tử, mã ghép bị consume trước tạo máy. Đã sửa và thêm kiểm thử transaction/lifecycle RED→GREEN, suite xanh.
- Phát hiện thêm numeric JSON 1000.0 khác JSON.stringify(1000) làm CAS sai: dùng policy.version và cập nhật JSON field nguyên tử. Regression test RED→GREEN.
- Xác thực Sites là quyết định thay identity provider mới; records JSON là schema MVP; Activity native thay Compose ở source Android tối thiểu. Chi phí và giới hạn đã ghi tại implementation-status.md.
- Không có pilot/kiểm OS thật, không có APK, không có collector/enforcement quota thật, không có model ngôn ngữ; các phần này được hiển thị chưa khả dụng.

## 06/11/2026 — Chuyển sang dữ liệu thật

- Yêu cầu mới: bỏ minh họa, phụ huynh dùng app/web; trẻ Android APK hoặc iOS web; database do người triển khai chọn.
- Chọn SQLite/D1 local có migration và khóa mã hóa riêng; không seed account hoặc telemetry. Bỏ lib/demo.ts và đường localStorage household.
- Hoàn thành luồng tài khoản, gia đình, ghép, capability, policy, quota/lịch/essential, time requests, geofence/SOS, caregivers theo ca, import/confirm/report/train và privacy APIs; tính năng OS được giới hạn theo capability thật.
- Android Studio/SDK có sẵn nhưng không nằm PATH; đã tìm JDK17 phù hợp và build/lint hai APK. Nhận định trước đó thiếu toàn bộ SDK được sửa lại.
- Native smoke có 26 installed apps và 3 usage segments thật từ emulator. Đã dọn test household/account; không giữ dữ liệu demo trong DB.
- Review độc lập và sửa lỗi consent, poison/full outbox, optimistic concurrency, geofence race, retention boundary và thống kê bị cắt theo family-wide limit.
- Quyết định: local có tài khoản ứng dụng thật, cloud vẫn giữ cổng Sites; native LAN dùng credential thiết bị riêng. Rủi ro tích hợp native qua Site riêng tư còn phải giải quyết gateway.
- Quyết định: không dùng dữ liệu tự tạo để train model. Bộ Naive Bayes chỉ train khi người dùng cấp samples/testSamples thật; rule-based reports ghi đúng bản chất.
- Giới hạn và quyết định đầy đủ tại implementation-status.md; bằng chứng Android tại android/VALIDATION.md.
