# Kế hoạch hai thành viên từ tuần 5 đến tháng 1/2027

**Mục tiêu:** Hoàn thiện hai app Android dùng chung backend, phân quyền người quản lý và phân tích hội thoại có đánh giá thực nghiệm.

**Phạm vi:** Bỏ tuần 1–4 khỏi lịch báo cáo. Tuần 5 ghi nhận hiện trạng đã có, không khẳng định tất cả được xây mới trong tuần 5. Tuần 6 trở đi hoàn thiện, tích hợp và nghiệm thu. Mặc định kết thúc 31/01/2027; chỉnh lùi mốc khi có ngày nộp chính thức.

**Căn cứ:** `../../kiem-tra-chuc-nang-2026-11-18.md` và kế hoạch thực hành ngày 18/11/2026 cùng thư mục. Không triển khai sản phẩm trong lần lập kế hoạch này.

## 1. Phân công cố định

| Thành phần | A — Bạn | B — Bạn cùng nhóm |
|---|---|---|
| App | App quản lý: dashboard web và APK WebView hiện có | App trẻ Android native |
| Backend | Tài khoản, gia đình/trẻ, phân quyền, API đọc dữ liệu, cấu hình policy, báo cáo | Ghép thiết bị, credential, heartbeat, nhận sự kiện, API thiết bị nhận policy/lệnh và báo kết quả |
| AI | Tiếp nhận dữ liệu được phép, tích hợp kết quả, giao diện báo cáo | Chuẩn bị thí nghiệm, train/evaluate model, dịch vụ suy luận |
| Database | Phụ trách tổng hợp schema/migration | Đề xuất trường thiết bị/sự kiện/model và kiểm thử tương thích |
| Tài liệu | Tổng hợp báo cáo, kiến trúc, chức năng quản lý | Thiết kế Android, thu thập dữ liệu, phương pháp và đánh giá AI |
| Phần chung | Hai người chốt hợp đồng API, quyền, dữ liệu và kịch bản tích hợp; cùng kiểm tra lỗi chéo | Hai người cùng chịu trách nhiệm demo toàn hệ thống |

Phân công AI cho B nhằm cân bằng với phần quản trị/backend của A; mỗi người vẫn phải giải thích được luồng toàn hệ thống. Tuần 9–10 B tập trung AI nên không thêm chức năng Android lớn vào giai đoạn đó.

## 2. Tuần 5: các phần đã có

### A — App quản lý và backend quản trị

- Đăng ký/đăng nhập/đăng xuất, gia đình, hồ sơ trẻ, chọn thiết bị.
- Tạo mã ghép một lần, theo dõi trạng thái đồng bộ và khả năng thiết bị.
- Giao diện tổng quan, app, thời gian sử dụng, cuộc gọi, bản đồ/vùng an toàn, thông báo, báo cáo và dữ liệu.
- Cấu hình app cấm, hạn mức ngày/app, lịch và hạn chế có thời hạn; tạo yêu cầu khóa/lấy vị trí.
- Mời người chăm sóc, quyền theo trẻ/ca và thu hồi; giáo viên/bảo mẫu hiện cùng vai trò caregiver.
- Nhập TXT/JSON có xác nhận quyền, xem trước/xác nhận, phân tích và xuất/xóa dữ liệu.
- Có APK phụ huynh dùng WebView mở dashboard; chưa phải một giao diện native riêng hoàn toàn.

### B — App trẻ và backend thiết bị

- App Android native có nhập URL backend, ghép mã và credential riêng cho thiết bị.
- Kiểm tra quyền usage, cuộc gọi, vị trí, quản trị; bật/dừng chia sẻ minh bạch.
- Collector usage/call/location, hàng đợi gửi lại, chống trùng; heartbeat, danh sách app và capability.
- Nhận policy có version; nhận lệnh và gửi ACK/kết quả; chặn app cần device/profile owner, khóa cần Device Admin.
- Có web/PWA trẻ với chức năng hạn chế; không coi tương đương Android native.

### Chung

- Backend và SQLite/D1, migrations, session và phân quyền; mã hóa payload riêng tư và audit.
- Phân tích quy tắc và code train/evaluate Naive Bayes; chưa có bằng chứng model huấn luyện trên dữ liệu thực phù hợp bài toán.
- Kiểm tra ngày 18/11: 32/32 test đạt; typecheck đạt; 16 assertions lõi Android đạt. Lint còn 54 lỗi/4 cảnh báo; E2E, build và máy vật lý chưa chạy lại trong lần kiểm tra này.
- Có lỗi usage ở 00:00, ranh giới giờ/giờ đêm, quyền UI theo trẻ và heartbeat bỏ sharingActive cần xử lý.
- Chưa có tích hợp tự động đọc inbox Zalo/Facebook/Instagram. Không ghi đã hoàn thành phần này.

**Đầu ra tuần 5:** bảng hiện trạng, sơ đồ hai app/backend, phân công và danh sách tồn tại. Chỉ bổ sung ảnh/video ghép và đồng bộ nếu chính nhóm đã thực hiện được; không đổi bằng chứng đọc mã thành nghiệm thu máy thật.

## 3. Lịch chung và nhiệm vụ từng người

| Tuần | Ngày | A — App quản lý | B — App trẻ và AI | Kết quả ghép chung |
|---|---|---|---|---|
| 5 | 16–22/11 | Ghi nhận các màn hình, API và chức năng quản trị đang có; đọc luồng tạo mã | Ghi nhận APK trẻ, collector và policy đang có; đọc luồng nhận mã | Hiện trạng, phân công, sơ đồ và danh sách lỗi; chưa cam kết mọi chức năng đã nghiệm thu |
| 6 | 23–29/11 | Use case, ERD, ma trận quyền; chốt dữ liệu hiển thị | Hợp đồng API thiết bị, dữ liệu telemetry; khảo sát đầu vào AI và quyền API nền tảng | Cùng backend test; ghép thiết bị và một heartbeat thành công; chốt với thầy cách lấy hội thoại |
| 7 | 30/11–06/12 | Sửa quyền UI theo trẻ, truy vấn/tổng hợp usage; lint phần A | Sửa collector qua mốc ngày/giờ, sharingActive, client hợp đồng và lint phần B | Usage hai app khớp; trạng thái chia sẻ rõ; kiểm thử hồi quy F1–F5, lint/typecheck/test đạt |
| 8 | 07–13/12 | Hoàn thiện màn hình quota/app/lệnh, vị trí/vùng, vai trò GV/bảo mẫu | Kiểm tra quyền, policy/ACK/result, collector trên thiết bị được phép | Demo xem dữ liệu và điều khiển; ghi đạt/thiếu quyền/không hỗ trợ theo thiết bị |
| 9 | 14–20/12 | Luồng nhập/xem trước/xác nhận dữ liệu và thiết kế báo cáo AI; viết tài liệu quản trị | Dataset pilot, hướng dẫn nhãn, chuẩn hóa và chia dữ liệu theo hội thoại | Cùng gán nhãn/kiểm tra một phần; dataset v1 hợp lệ, không trùng train/test |
| 10 | 21–27/12 | Thử UI báo cáo với fixture chỉ trong môi trường test; chốt hợp đồng model | Đo baseline, thử fine-tune ViSoBERT, so sánh validation, phân tích lỗi | Bảng metric, version model/dữ liệu; chọn model theo số liệu và tài nguyên |
| 11 | 28/12–03/01 | Kết nối API phân tích và báo cáo; xử lý quyền, lỗi, xóa nguồn | Dịch vụ suy luận, kiểm tra request/response và timeout; giữ Android ổn định | Nhập nội dung được phép → AI thật → báo cáo đúng nguồn và dẫn chứng |
| 12 | 04–10/01 | Thống kê tín hiệu theo kỳ, coverage và UX theo vai trò | Kiểm thử câu phủ định/trích dẫn, chiều gửi/nhận; kiểm tra Android offline/retry | Demo toàn luồng; không suy ra xu hướng khi thiếu thời gian/dữ liệu |
| 13 | 11–17/01 | E2E, cách ly dữ liệu/quyền, build web và APK quản lý | Test cuối model, build/lint APK trẻ, kiểm tra quyền/mất mạng/thu hồi | Biên bản nghiệm thu, metric cuối và danh sách giới hạn thực tế |
| 14 | 18–24/01 | Tổng hợp báo cáo, ERD/kiến trúc, slide và hướng dẫn backend | Hoàn thiện chương Android/AI, bảng thí nghiệm và hướng dẫn model/APK | Đóng băng chức năng, diễn tập, quay demo dự phòng và kiểm tra người khác chạy lại |
| 15 | 25–31/01 | Sửa lỗi quan trọng, kiểm tra bản nộp và luyện trình bày phần A | Sửa lỗi quan trọng, kiểm tra model/APK và luyện trình bày phần B | Nộp bộ hồ sơ, mã nguồn, APK, model được phép chia sẻ, video và kết quả kiểm thử |

## 4. Quy tắc để hai app liên kết

- Cùng URL backend và cùng database trong mỗi lượt tích hợp. Backend riêng từng máy chỉ dùng phát triển độc lập, dữ liệu không tự đồng bộ.
- A và B dùng cùng Git repo, nhánh riêng; ai sửa phần chung phải trao đổi và review chéo. Không giữ secret hoặc dữ liệu hội thoại cá nhân trong Git.
- A điều phối thay đổi `lib/server/service.mjs` và `app/page.tsx`; B điều phối `lib/server/device.mjs` và Android child. Nếu B bổ sung API model trong file service thì A review/tích hợp để tránh ghi đè.
- Mỗi endpoint có request/response, auth, mã lỗi và ví dụ test; thay đổi trường phải báo trước. Dùng credential thiết bị cho app trẻ, session tài khoản cho app quản lý.
- Tuần 6 khóa hợp đồng ban đầu: `POST /api/pairing`, `POST /api/device/enroll`, `POST /api/device/heartbeat`, `POST /api/device/events`, `GET /api/bootstrap`, policy và commands/results đang có.
- Mỗi tuần ghép bản ít nhất một lần: tạo trẻ → ghép → heartbeat → gửi dữ liệu → đọc dashboard; khi có policy thì thêm nhận và báo kết quả. Không đợi cuối tháng 12 mới tích hợp.
- Thiết bị thiếu quyền hoặc mất mạng phải báo đúng trạng thái; backend không coi queued/ACK là lệnh đã thực thi.

## 5. Tiêu chí AI và giới hạn phạm vi

- Hướng mục tiêu là nhận diện dấu hiệu nội dung bắt nạt/đe dọa, không kết luận trẻ có tính cách bạo lực.
- Nhãn và ánh xạ với baseline hiện có phải chốt trước train; nhận biết người gửi/nhận và giữ ngữ cảnh.
- Dữ liệu có nguồn và quyền sử dụng; test độc lập theo hội thoại, loại trùng/gần trùng. Dữ liệu tự viết chỉ dùng demo/test và công bố rõ.
- Báo cáo precision/recall/F1 theo nhãn, macro-F1 và confusion matrix; không hứa đạt một độ chính xác khi chưa đo.
- ViSoBERT là ứng viên thử nghiệm, kiểm tra điều kiện sử dụng và tài nguyên trước chạy. Nếu không đạt thì báo kết quả thật, không dùng fixture làm đầu ra model thật.
- Tuần 6 phải làm rõ yêu cầu thu tin nhắn: API có scope/endpoint phù hợp hay nội dung được phép cung cấp. Nhập tệp không được mô tả là tự động đọc inbox cá nhân.

## 6. Đoạn tổng quan dùng cho báo cáo tuần 5

Trong tuần 5, nhóm rà soát phiên bản hiện có của hệ thống quản lý trẻ em và phân chia công việc cho hai thành viên. Thành viên A phụ trách ứng dụng quản lý dành cho phụ huynh, giáo viên, bảo mẫu cùng các chức năng tài khoản, hồ sơ và phân quyền. Thành viên B phụ trách ứng dụng Android trên điện thoại trẻ, cơ chế thu thập dữ liệu được cấp phép, đồng bộ và tiếp nhận chính sách. Hai ứng dụng sử dụng chung backend và cơ sở dữ liệu, liên kết thông qua mã ghép thiết bị dùng một lần.

Phiên bản hiện tại đã có mã nguồn cho các luồng tài khoản, hồ sơ trẻ, ghép thiết bị, hiển thị dữ liệu sử dụng, cuộc gọi, vị trí, vùng an toàn và cấu hình giới hạn. Hệ thống cũng có luồng nhập nội dung TXT/JSON và cơ chế phân tích ban đầu. Nhóm ghi nhận các phần cần tiếp tục kiểm thử, xử lý lỗi và hoàn thiện; chưa kết luận tất cả chức năng đã hoạt động đầy đủ trên thiết bị thật. Việc tự động thu thập tin nhắn cá nhân từ Zalo, Facebook và Instagram chưa được triển khai; phần model cần được thử nghiệm và đánh giá trên dữ liệu phù hợp được phép sử dụng.

Đổi A/B thành họ tên và MSSV thật khi đưa vào báo cáo. Không ghi các phần tồn tại trước đó là thành tích xây mới trong tuần nếu không đúng lịch sử thực hiện.
