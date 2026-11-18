# Hợp đồng liên kết app quản lý và app trẻ

Base URL là URL backend Family Care, không phải URL Supabase. Giữ `/api` một lần: ví dụ `https://backend.example/api/device/enroll`. JSON UTF-8, timestamp milliseconds UTC, phút usage có thể là số thập phân, thời lượng cuộc gọi là giây.

## Tài khoản và ghép

- Người lớn: `POST /api/auth/register` với `{name,email,password}` (password >=12 ký tự), hoặc `POST /api/auth/login` với `{email,password}`. Giữ cookie session do server trả; không dùng thông tin Supabase Auth thay thế.
- Tạo gia đình: `POST /api/families` với `{name}`; tạo trẻ: `POST /api/children` với `{name,age}`; cần session.
- Tạo mã: `POST /api/pairing` với `{childId}`; nhận `{code,expiresAt}`. Mã dùng một lần trong 10 phút.
- Ghép: `POST /api/device/enroll` với `{code,name,platform:"Android"}`; nhận `{deviceId,token,policy,serverTime}`. Web trẻ dùng platform `Web/iOS`; giá trị `iOS` không chứng minh đã có app trẻ iOS native.
- App trẻ lưu token trong kho bảo mật thiết bị; các endpoint `/api/device/*` sau ghép gửi `Authorization: Bearer <token>`. Không gửi secret Supabase.

## Dữ liệu và chính sách

| Endpoint | Nội dung |
|---|---|
| `POST /api/device/heartbeat` | `{capabilities, battery?, installedApps?, appliedPolicyVersion?, policyError?}` |
| `POST /api/device/events` | `{events:[{eventId,kind,capturedAt,payload}]}`; tối đa 100/batch |
| `GET /api/device/policy` | Policy hiện hành và serverTime |
| `GET /api/device/commands` | Các lệnh chưa hoàn tất, chưa hết hạn; records có `{id,data}` |
| `POST /api/device/commands/{id}/results` | `{status:"acknowledged"|"applied"|"failed",errorCode?}`; ACK trước applied |
| `POST /api/device/unpair` | Thu hồi credential hiện tại |
| `GET /api/bootstrap` | Người quản lý đọc family/records/events; lọc bằng `familyId`, `deviceId`, `date` nếu cần |
| `PUT /api/devices/{id}/policy` | Người quản lý gửi `{expectedVersion,policy}`; xung đột trả 409 |
| `POST /api/devices/{id}/commands` | `{type:"LOCK_SCREEN"|"REFRESH_LOCATION"}`, cần header `Idempotency-Key` UUID |

Capability keys thường dùng: `usage`, `calls`, `location`, `lock`, `app_block`. Giá trị: `supported`, `permission_required`, `enrollment_required`, `unsupported`, `temporarily_unavailable`. Chỉ báo supported khi OS và trạng thái chia sẻ thực sự cho phép. Trường `sharingActive` chưa thuộc schema heartbeat hiện tại; không dùng nó thay capability cho tới khi cập nhật API và test tương ứng.

Ví dụ event usage:

```json
{"events":[{"eventId":"unique-device-event-1","kind":"usage","capturedAt":1795000000000,"payload":{"packageId":"com.school.app","minutes":1.5,"nightMinutes":0}}]}
```

Ví dụ chỉ minh họa schema; khi thử phải dùng timestamp hiện tại và dữ liệu kiểm thử được đánh dấu. Usage phải là đoạn tăng thêm, không gửi lại tổng tích lũy bằng eventId mới. `call` payload: `{number,direction:"incoming"|"outgoing"|"missed",duration}`. `location` payload: `{lat,lng,accuracy}`.

Response sự kiện `{accepted:[eventId],inserted}`; chỉ xóa khỏi outbox các ID được xác nhận. Gửi lại cùng eventId không tạo bản ghi trùng. HTTP 401: credential hết hiệu lực; dừng gửi, cần ghép lại. HTTP 409: tải lại trạng thái và kiểm tra xung đột. HTTP 429/5xx/lỗi mạng: giữ dữ liệu, chờ và thử lại có backoff. Không báo đã áp dụng policy chỉ vì HTTP lưu cấu hình trả thành công.

Giới hạn đã biết về phân bổ usage tại ranh giới ngày/giờ vẫn được ghi trong báo cáo kiểm tra; tích hợp Supabase không tự sửa thuật toán collector Android đó.
