# Xin phép phụ huynh để gỡ ứng dụng trẻ

## Phạm vi và điều kiện OS

Phía quản lý đã có API và giao diện duyệt, không đồng nghĩa app trẻ hiện có đã chống gỡ. App trẻ do bạn cùng nhóm phát triển phải thực thi bằng API hệ điều hành và báo kết quả thật.

- Android: `DevicePolicyManager.setUninstallBlocked` cần device/profile owner hoặc quyền/delegation phù hợp. Cài APK thông thường hay chỉ cấp Device Admin để khóa màn hình không tự cấp quyền này. Profile owner chỉ quản lý profile tương ứng.
- iOS: Family Controls ở chế độ trẻ được phụ huynh cùng Family Sharing cấp quyền có thể bảo vệ app parental-control khỏi bị trẻ xóa. Không đánh đồng với individual authorization hoặc web app thêm vào màn hình chính. Native client cần entitlement và luồng guardian authorization phù hợp.
- Không tự reset/enroll máy, không ẩn app, không lạm dụng Accessibility. Backend approval không thay thế guardian authentication hoặc giới hạn của OS. Không bảo đảm chống mọi thao tác khôi phục máy hoặc tài khoản quản trị hệ điều hành.

Nguồn: [Android DevicePolicyManager](https://developer.android.com/reference/android/app/admin/DevicePolicyManager#setUninstallBlocked(android.content.ComponentName,%20java.lang.String,%20boolean)), [Apple Family Controls](https://developer.apple.com/documentation/familycontrols).

## Heartbeat: khả năng và trạng thái khác nhau

App trẻ gửi vào `/api/device/heartbeat`:

```json
{"capabilities":{"uninstall_protection":"supported"},"uninstallProtection":"enabled"}
```

`capabilities.uninstall_protection` dùng các giá trị capability hiện có: supported, permission_required, enrollment_required, unsupported, temporarily_unavailable. `uninstallProtection` là enabled, disabled, unsupported, permission_required hoặc unknown. Chỉ gửi enabled sau khi OS xác nhận đúng trạng thái; không đủ quyền thì không khai supported/enabled. App cũ không gửi trường này hiển thị chưa xác nhận.

## Gửi yêu cầu

`POST /api/device/removal-requests`, Bearer token của thiết bị:

```json
{"clientRequestId":"UUID-v4-do-client-tao","reason":"Con đổi điện thoại cùng phụ huynh"}
```

Gửi UUID hợp lệ. Response HTTP201 gồm `{id,childId,deviceId,reason,status:"pending",expiresAt}`. Yêu cầu chờ tối đa 24 giờ. Retry cùng UUID trả lại cùng yêu cầu; một thiết bị chỉ có một yêu cầu pending/approved còn hạn. Yêu cầu khác đang chờ trả409.

`GET /api/device/removal-requests` trả các record riêng của thiết bị (cấu trúc `{id,data,createdAt,...}`), tối đa 20. App trẻ không được xem yêu cầu thiết bị khác.

## Chủ gia đình quyết định

`POST /api/removal-requests/{id}/decision`, session của **chủ gia đình**:

```json
{"decision":"approved"}
```

Hoặc `rejected`. Giáo viên/bảo mẫu/phụ huynh cộng tác không được duyệt qua endpoint này. Approval cần thiết bị còn hoạt động, capability supported và trạng thái enabled. Nếu thiếu thì HTTP409; không giả lập chặn gỡ cho thiết bị không hỗ trợ.

Approval tạo lệnh sau trong cùng giao dịch với quyết định:

```json
{"type":"ALLOW_REMOVAL","requestId":"id-yeu-cau","deviceId":"id-thiet-bi","childId":"id-tre","status":"queued","expiresAt":1795000000000}
```

Timestamp ví dụ chỉ minh họa; lệnh thật có hạn 10 phút. Retry quyết định đã xử lý trả409, không tạo lệnh thứ hai. App quản lý hiển thị **đã duyệt, chờ thiết bị xác nhận**. Thu hồi kết nối thông thường khác với quyền gỡ app của OS.

## Thiết bị thực thi và xác nhận

1. Đọc lệnh qua `GET /api/device/commands`; xác minh chưa hết hạn và thuộc credential hiện tại.
2. Gửi `POST /api/device/commands/{id}/results` với `{status:"acknowledged"}`.
3. Thực hiện luồng tắt bảo vệ/giải phóng quản lý được OS cho phép, có guardian authentication nếu cần; dọn suspension do chính app đã tạo theo đúng luồng được cấp phép.
4. Chỉ khi OS xác nhận thành công mới gửi `{status:"applied"}`. Response có `{status:"applied",credentialRevoked:true}`: backend đánh dấu request released, thu hồi credential và hiển thị thiết bị báo đã tắt bảo vệ.
5. Sau response đó, app dừng đồng bộ và xóa credential local. Backend đã thu hồi nên request tiếp theo trả401. Backend không tự uninstall app; người dùng thực hiện gỡ theo cơ chế OS.
6. OS từ chối thì gửi `{status:"failed",errorCode:"OS_DENIED"}`; credential được giữ, trạng thái chưa được coi đã giải phóng.

Chỉ thiết bị khớp lệnh được báo kết quả; applied trước ACK bị từ chối. Lệnh hết hạn không được giải phóng credential. Không tự tắt chống gỡ chỉ vì user logout, dừng chia sẻ, không có mạng hoặc một yêu cầu chưa được duyệt. Dừng thu thập dữ liệu phải được xử lý riêng, không dùng chống gỡ để lén thu dữ liệu khi chia sẻ đã dừng.

Nếu OS đã tắt bảo vệ nhưng chưa gửi được kết quả vì mất mạng, client cần lưu kết quả và giải thích trạng thái chờ, thử báo lại trong thời hạn. Sau khi lệnh hết hạn, không tự giả lập applied; cần quy trình phụ huynh xác minh/cấp lại hoặc xử lý thủ công. Luồng khôi phục và xử lý thiết bị offline cần được nghiệm thu trước sử dụng thực tế.

## Kiểm thử trước bàn giao

Test app quản lý/API đã có: quyền owner, thiết bị thiếu hỗ trợ, retry, reject, hết hạn yêu cầu, command fail, sai thiết bị, ACK/applied và thu hồi credential; chạy với SQLite và PostgreSQL thử riêng. Chưa có chứng cứ chống uninstall thực tế trên Android managed hoặc iOS child authorization trong task phía quản lý này.
