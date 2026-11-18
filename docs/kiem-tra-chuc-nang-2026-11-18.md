# Kiểm tra chức năng Family Care theo yêu cầu đề tài

Ngày kiểm tra: 18/11/2026. Phạm vi: mã nguồn web/API/Android, schema/migration, kiểm thử tự động và tài liệu API nền tảng. Đây là báo cáo kiểm tra và đề xuất; chưa sửa mã sản phẩm hay thay đổi dữ liệu gia đình đang có.

## 1. Kết luận

App đã triển khai phần lớn luồng quản lý trẻ, thiết bị và phân quyền ở cấp mã nguồn. Tuy nhiên, chưa thể kết luận đáp ứng đầy đủ đề tài hoặc sẵn sàng vận hành thực tế. Các khoảng trống chính là thu thập mạng xã hội tự động, phân tích xu hướng còn hẹp, hai đối tượng giáo viên/bảo mẫu chưa được phân biệt, lỗi thống kê ở ranh giới thời gian và kiểm tra lint chưa đạt.

Không dùng tỷ lệ hoàn thành phần trăm vì chưa có tiêu chí nghiệm thu và trọng số cho từng yêu cầu.

## 2. Đối chiếu chức năng

| Yêu cầu | Hiện trạng trong mã | Giới hạn / phần cần hoàn thiện |
|---|---|---|
| Trẻ em | Hồ sơ trẻ, ghép thiết bị; Android native và web `/child` | Trẻ dùng credential thiết bị, chưa phải vai trò tài khoản đăng nhập riêng |
| Phụ huynh | Chủ gia đình và phụ huynh cộng tác; quản lý theo quyền được cấp | Quyền chủ gia đình rộng hơn phụ huynh cộng tác |
| Giáo viên | Mời người chăm sóc theo trẻ, ca và thời hạn | Chưa có loại vai trò giáo viên riêng |
| Bảo mẫu | Cùng cơ chế người chăm sóc | Chưa phân biệt với giáo viên trên dữ liệu và giao diện |
| Lịch sử cuộc gọi | Android đọc số, hướng gọi, thời lượng, thời điểm; API và màn hình xem | Cần quyền READ_CALL_LOG; không ghi âm, không đồng nghĩa lấy cuộc gọi Zalo/Messenger; chưa nghiệm thu lại trên máy thật |
| Cấm/giới hạn ứng dụng | Danh sách app, app cấm, quota theo app; Android gọi setPackagesSuspended | Thực thi cần device/profile owner; profile owner chỉ tác động phạm vi profile |
| Thời gian sử dụng | UsageEvents, tổng theo app/ngày/giờ; quota ngày | Đã tái hiện lỗi dồn phút sang ngày sau tại 00:00; ranh giới giờ và giờ đêm cần sửa |
| Dữ liệu cơ bản | Gia đình, tên/tuổi trẻ, thiết bị, app, sự kiện; xuất/xóa dữ liệu | Chưa có luồng sửa/xóa từng hồ sơ trẻ. Yêu cầu “dữ liệu cơ bản được sử dụng” chưa xác định là hồ sơ hay dung lượng mạng; chưa thấy bộ đo byte Wi-Fi/di động |
| Block điện thoại | Lệnh khóa màn hình và hạn chế app có thời hạn | Khóa cần Device Admin; khóa màn hình không bảo đảm trẻ không mở lại; web iOS không thực thi được |
| Vị trí | Android foreground service thu GPS/network; web trẻ gửi vị trí khi đang mở; xem bản đồ | Cần quyền; web cần HTTPS; không cam kết cập nhật khi OS dừng dịch vụ |
| Vùng an toàn | Tạo/xóa vùng tròn, kiểm tra sai số/độ mới, xác nhận chuyển vùng qua hai điểm | Chưa thấy sửa vùng trực tiếp; chưa nghiệm thu GPS/geofence thực địa trong lần kiểm tra này |
| Thu thập Zalo/Facebook/Instagram | Nhập TXT/JSON, chọn nguồn, xác nhận quyền, xem trước và xác nhận nội dung | Chưa có OAuth/webhook/collector riêng cho ba nền tảng; nhãn nguồn không chứng minh dữ liệu do nền tảng xác thực |
| Tổng hợp dữ liệu | Lưu sự kiện và dữ liệu nhập; gom usage phục vụ thống kê/báo cáo | Nhập JSON theo schema nội bộ, không phải bộ đọc đầy đủ mọi gói dữ liệu xuất chính thức |
| Phân tích hành vi | Quy tắc từ khóa và thống kê sử dụng đêm; báo cáo có tham chiếu bằng chứng | Chỉ phản ánh tín hiệu hẹp, chưa đủ để kết luận tổng quát về hành vi |
| Phân tích xu hướng | Có số liệu ngày/giờ/app và báo cáo usage bảy ngày | Chưa thấy phân tích tăng/giảm theo kỳ, xu hướng từng mạng xã hội hoặc mô hình chuỗi thời gian |
| Phân tích bằng Model | Train/evaluate Naive Bayes cục bộ từ dữ liệu có nhãn, tách tập kiểm tra; phân loại bốn nhãn | Không có bằng chứng model thực đã được huấn luyện/đánh giá cho dữ liệu người dùng hiện tại; báo cáo mặc định vẫn dùng quy tắc |
| Cho phép và phân quyền | Mã ghép một lần, bật/dừng chia sẻ, quyền OS, grant theo trẻ/ca, thu hồi, audit | Trạng thái sharingActive do Android gửi chưa được schema heartbeat lưu; cần kiểm tra đồng thuận xuyên suốt, không suy ra chỉ từ checkbox nhập tệp |

## 3. Phát hiện cần xử lý

### F1 — Sai ngày thống kê usage: ưu tiên cao, đã tái hiện

- `android/app/src/main/java/vn/familycare/child/Telemetry.kt`, hàm `collect`: chia đoạn tại nửa đêm nhưng phát sự kiện usage với thời gian `end`.
- `lib/server/telemetry.mjs`, hàm `viewTelemetry`: xếp ngày bằng `captured_at >= start AND captured_at < end`.
- Tái hiện bằng SQLite trong bộ nhớ, áp dụng migration thật và gọi hàm view thật: một phút từ 23:59 ngày 17/11 đến 00:00 ngày 18/11/2026, múi giờ Việt Nam, cho kết quả ngày 17 = 0 phút, ngày 18 = 1 phút. Mong đợi lần lượt 1 và 0.
- Ảnh hưởng: dashboard và báo cáo không khớp sổ quota ngày trên Android.
- Hướng sửa đề xuất: lưu khoảng `startedAt`/`endedAt`, phân bổ phần giao với ngày/giờ truy vấn; xử lý rõ dữ liệu usage cũ chỉ có thời điểm kết thúc.

### F2 — Chia giờ và phút ban đêm chưa chính xác: xác định từ mã, chưa kiểm thử thiết bị

- Collector chỉ cắt đoạn tại nửa đêm. `nightMinutes` được gán toàn bộ theo giờ bắt đầu đoạn (`local.hour`); biểu đồ web xếp toàn bộ theo giờ của `capturedAt`.
- Ví dụ theo logic hiện tại: đoạn 21:59–22:01 không ghi phút đêm, trong khi có một phút sau 22:00. Đoạn 06:59–07:01 tính cả hai phút là ban đêm thay vì một phút.
- Hướng sửa: chia hoặc tính phần giao ở các ranh giới giờ, ngày, 07:00 và 22:00; kiểm tra lại cả tổng ngày, biểu đồ và báo cáo đêm.

### F3 — Lint không đạt: đã chạy xác minh

- `npm run lint`: 54 lỗi, 4 cảnh báo; mã thoát 1.
- Phân bố lỗi: `app/page.tsx` 36; `app/child/page.tsx` 12; `db/schema.ts` 2; `tests/e2e/real-family.spec.ts` 4.
- Có lỗi kiểu `any`, quy tắc hooks/state/ref/purity và `prefer-const`; không nên coi toàn bộ chỉ là vấn đề định dạng.
- Kiểm tra TypeScript đạt không thay thế việc xử lý các lỗi này.

### F4 — Quyền giao diện chưa theo đúng trẻ đang chọn: xác định từ mã

- API bootstrap trả `permissions` là hợp các grant trong gia đình; `app/page.tsx` kiểm tra `can(p)` trên danh sách hợp này.
- Người có quyền với trẻ A có thể thấy nút thao tác khi đang chọn trẻ B mà không được cấp cùng quyền. API vẫn kiểm tra quyền theo trẻ và từ chối, nên chưa có bằng chứng vượt quyền máy chủ.
- Hướng sửa: trả hoặc tính quyền hiệu lực theo `childId`; ẩn menu và nút theo đúng trẻ/ca hiện tại. Hiện thanh điều hướng cũng hiển thị chung cho mọi vai trò.

### F5 — Mất trạng thái đồng thuận trong heartbeat: xác định từ hợp đồng dữ liệu

- `SyncEngine.kt` gửi `sharingActive`, nhưng Zod schema tại `lib/server/device.mjs` không khai báo trường này; trường bị loại khi parse.
- Backend không lưu được cờ chia sẻ trực tiếp từ payload đó. Capability giúp nhận biết một phần nhưng không thay thế trạng thái đồng thuận rõ ràng.
- Hướng sửa: bổ sung boolean được kiểm tra kiểu, thời điểm cập nhật; giao diện phân biệt đang chia sẻ, đã dừng, chưa đồng bộ. Không coi heartbeat cũ là trạng thái hiện tại chắc chắn.

## 4. Tính khả thi của dữ liệu mạng xã hội

Đã đối chiếu tài liệu trực tuyến ngày 18/11/2026; một số trang Meta trả lỗi khi mở trực tiếp, vì vậy kết luận dựa thêm vào nội dung tài liệu chính thức được chỉ mục và collection do Meta cung cấp.

| Nền tảng | Phạm vi API tìm thấy | Kết luận cho đề tài |
|---|---|---|
| Zalo | Social API có OAuth và thông tin người dùng theo quyền; API OA phục vụ tương tác của Official Account | Chưa tìm thấy API chính thức phù hợp để đọc toàn bộ hội thoại cá nhân của trẻ; không lấy quyền OA làm quyền đọc tài khoản cá nhân |
| Facebook/Messenger | Messenger Platform sử dụng Page token và quyền phục vụ tương tác Page | Không có cơ sở để cam kết thu toàn bộ inbox cá nhân của trẻ bằng luồng này |
| Instagram | API với Instagram Login phục vụ professional accounts: Business/Creator, theo scope | Không đáp ứng mặc định bài toán đọc tài khoản cá nhân bất kỳ của trẻ |

Hướng khả thi cho phạm vi hiện tại: giữ nhập dữ liệu mà người dùng có quyền cung cấp, ghi nguồn/đồng thuận, kiểm tra schema và chất lượng dữ liệu trước phân tích. Nếu nhận gói xuất chính thức thì cần parser riêng được kiểm thử với định dạng đó; không mặc định TXT/JSON hiện tại đọc được toàn bộ bản xuất. Thu thời lượng dùng app bằng Android là một nguồn khác với lấy nội dung bên trong mạng xã hội.

Nguồn:

- [Zalo Social API — Tổng quan](https://stc-developers.zdn.vn/docs/v2/social-api/tai-lieu/tong-quan).
- [Zalo — Danh mục API](https://developers.zalo.me/docs).
- [Meta Messenger — Quick Start](https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start%23getting_started).
- [Meta — Instagram API with Instagram Login](https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login).
- [Android DevicePolicyManager](https://developer.android.com/reference/android/app/admin/DevicePolicyManager): giới hạn thực thi chặn app/khóa theo quyền hệ điều hành.

Đây là đánh giá khả thi kỹ thuật, chưa phải kết luận pháp lý hoặc xét duyệt quyền API cho một ứng dụng cụ thể.

## 5. Kiến trúc hiện tại và đề xuất

Kiến trúc hiện có phù hợp để tiếp tục hoàn thiện, chưa có bằng chứng cần tách microservice:

```text
Web phụ huynh / GV / bảo mẫu ─┐
APK phụ huynh (WebView) ──────┼─ HTTPS API ─ xác thực + quyền theo trẻ/ca
Android trẻ (native) ────────┤                 │
Web/PWA trẻ ────────────────┘                 ├─ SQLite local / D1
                                              ├─ nhận telemetry + geofence
                                              └─ thống kê / nhập tệp / model cục bộ
```

Web dùng React và cấu trúc Next App Router; runtime dự án là Vinext/Vite và Cloudflare Workers. Android trẻ thu dữ liệu và thực thi policy theo quyền OS; API quản lý policy có version, hàng lệnh và kết quả. Không đánh đồng đã lưu policy, đã nhận lệnh và đã áp dụng trên máy.

So sánh phương án: tiếp tục kiến trúc hiện tại ít thay đổi và tận dụng luồng đã có; xây lại backend hoặc tách dịch vụ model riêng làm tăng phạm vi mà chưa giải quyết các lỗi hiện tại. Đề xuất giữ kiến trúc và sửa tính đúng đắn dữ liệu/phân quyền trước.

## 6. Cơ sở dữ liệu

Schema thực có chín bảng: `accounts`, `sessions`, `families`, `records`, `pairings`, `credentials`, `events`, `rate_limits`, `service_state`.

- `records(kind, data JSON)` chứa trẻ, thiết bị/policy, vùng, lời mời, lệnh, báo cáo, nội dung nhập, model và audit. Không mô tả các loại record này thành bảng vật lý đã có.
- Có unique event theo thiết bị, chỉ mục truy vấn và trigger chống ghi sau thu hồi/xóa gia đình; nhiều quan hệ nghiệp vụ nằm trong JSON và được API kiểm tra thay vì khóa ngoại.
- Nội dung nhập, model riêng tư và payload tọa độ/cuộc gọi được mã hóa ở tầng ứng dụng. Điều này không có nghĩa mọi dữ liệu hoặc metadata trong DB đều mã hóa.

Thiết kế logic đề xuất trong đúng phạm vi:

| Nhóm dữ liệu | Thuộc tính/quan hệ cần quản lý |
|---|---|
| Tài khoản và quyền | account; role owner/parent/teacher/nanny; grant gắn family, child, permission, ca và hạn |
| Trẻ và thiết bị | child thuộc family; device thuộc child; credential/consent/capability gắn device |
| Chính sách và lệnh | policy version theo device; quota/app/lịch; command theo device với expiry/ACK/result |
| Sự kiện | usage có khoảng thời gian/package; call metadata; location có timestamp/accuracy; dedup theo device/eventId |
| Vùng an toàn | zone theo child; trạng thái xác nhận chuyển vùng; alert liên quan |
| Dữ liệu và phân tích | import có source/consent/expiry; report tham chiếu nguồn; model có version và metric đánh giá |

Có thể giữ JSON trong giai đoạn này, nhưng cần schema theo từng `kind` và ràng buộc quan hệ rõ ràng. Chỉ tách bảng vật lý khi triển khai migration có kiểm chứng, không thay DB chỉ để phù hợp sơ đồ.

## 7. Giao diện theo đối tượng

Hiện có dashboard người lớn dùng chung với mười mục và giao diện trẻ riêng. Chưa có dashboard giáo viên/bảo mẫu tách biệt. Đề xuất điều chỉnh quyền hiển thị trên cấu trúc hiện tại:

| Đối tượng | Giao diện phù hợp trong phạm vi |
|---|---|
| Phụ huynh | Chọn trẻ/thiết bị → trạng thái chia sẻ và lần đồng bộ → app/quota/cuộc gọi/vị trí/vùng → báo cáo; nút quản lý theo quyền |
| Giáo viên | Trẻ được giao trong ca → vị trí/usage/cảnh báo nếu được cấp; hiển thị thời hạn truy cập |
| Bảo mẫu | Trẻ đang chăm sóc → vị trí/vùng/cảnh báo trong ca theo grant; không mặc định được đọc cuộc gọi hoặc nội dung nhập |
| Trẻ | Trạng thái chia sẻ/quyền OS → quy tắc và giới hạn đang áp dụng; thể hiện rõ chức năng thiết bị hỗ trợ |

Phác thảo bố cục người lớn:

```text
[Vai trò / gia đình] [Trẻ] [Thiết bị] [Ngày]
[Chia sẻ] [Đồng bộ lần cuối] [Quyền thiết bị] [Policy mong muốn/đã áp dụng]
[Các mục đúng quyền của trẻ đang chọn]
[Dữ liệu và biểu đồ] [Thao tác được cấp quyền]
```

Giữ chức năng xin giờ, SOS và huấn luyện nhãn là các phần đã tồn tại; chúng không được nêu riêng trong ghi chú yêu cầu nên không dùng để bù cho chức năng còn thiếu. Không đề xuất mở rộng thêm chức năng ngoài đề tài.

## 8. Bằng chứng và giới hạn kiểm tra lần này

| Kiểm tra | Kết quả ngày 18/11/2026 |
|---|---|
| `npm test` | 32/32 đạt. Lần sandbox đầu bị spawn EPERM; lần chạy được cho phép ngoài sandbox đạt |
| `npm run typecheck` | Đạt, mã thoát 0 |
| `android/test-core.ps1` | 16 assertions đạt |
| `npm run lint` | Không đạt: 54 lỗi, 4 cảnh báo |
| Tái hiện F1 | SQLite trong bộ nhớ + migration + viewTelemetry thật; xác nhận tính sai ngày |
| Web end-to-end | Chưa chạy lại; server 127.0.0.1:5173 không hoạt động khi kiểm tra |
| Build web / APK, điện thoại vật lý | Chưa chạy lại trong lần này |

Các kết quả E2E/emulator/build ghi trong tài liệu ngày 05–06/11 là bằng chứng lịch sử, không phải kiểm chứng mới. Chưa dùng dữ liệu cá nhân thật để thử thu thập cuộc gọi, vị trí hay mạng xã hội.

Thứ tự hoàn thiện đề xuất: sửa F1/F2 và kiểm thử ranh giới thời gian; sửa F4/F5 và kiểm thử quyền theo trẻ/ca; xử lý lint; phân biệt giáo viên/bảo mẫu và chốt nghĩa dữ liệu cơ bản; nghiệm thu Android với từng quyền trên thiết bị được phép; đánh giá model bằng tập dữ liệu thực có quyền sử dụng. Chỉ triển khai kết nối nền tảng sau khi chứng minh được endpoint, scope và dữ liệu phù hợp.
