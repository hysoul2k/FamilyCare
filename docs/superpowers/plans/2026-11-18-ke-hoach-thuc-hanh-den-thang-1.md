# Kế hoạch thực hành đồ án quản lý trẻ em đến tháng 1/2027

> **For agentic workers:** Đây là lịch thực hành cho sinh viên, chưa phải lệnh triển khai sản phẩm. Khi được yêu cầu thực hiện một hạng mục, đọc thiết kế liên quan và dùng skill `executing-plans`; không tự triển khai toàn bộ lịch.

**Goal:** Hoàn thiện bản trình diễn hai app Android liên kết qua backend, phân quyền người lớn và phân tích nội dung hội thoại tiếng Việt bằng model có đánh giá thực nghiệm.

**Architecture:** Giữ web quản lý/API/database và hai app Android hiện có. App trẻ thu telemetry được phép; backend nhận dữ liệu, lưu chính sách và phân quyền; một dịch vụ Python cục bộ dự kiến phục vụ model. Thu thập nội dung mạng xã hội là bài toán riêng, phải chứng minh endpoint và phạm vi quyền trước khi cam kết kết nối tự động.

**Tech Stack:** React/TypeScript, Vinext/Vite, Workers/D1 hoặc SQLite local, Android Kotlin/Java hiện có; Python/PyTorch/Transformers cho thử nghiệm model. ViSoBERT là ứng viên nghiên cứu, Naive Bayes hiện có là baseline. Chưa bắt buộc thêm LLM hoặc dịch vụ cloud trả phí.

**Spec:** Yêu cầu đề tài trong hội thoại; đối chiếu hiện trạng tại `../../kiem-tra-chuc-nang-2026-11-18.md`.

## Giả định và phạm vi

- Hôm nay 18/11/2026, tính tuần 5 là 16–22/11; lịch mặc định kết thúc 31/01/2027, tuần 15.
- Cần xác nhận ngày nộp/bảo vệ thật. Lấy ngày nộp thật làm mốc, đóng băng chức năng trước ít nhất bảy ngày; nếu nộp đầu tháng 1 thì phải rút phạm vi và kéo báo cáo lên tháng 12.
- Khoảng 12–15 giờ/tuần. Nếu chỉ có 6–8 giờ, giữ model phân loại và demo Android cốt lõi; bỏ LLM giải thích, thử nghiệm nhiều model và triển khai cloud khỏi mục tiêu đợt này.
- Không xây lại app, không mở rộng chức năng ngoài đề tài. iOS native không nằm trong lịch này; ghi rõ hạn chế web/PWA hiện có.
- Không coi nhập tệp là đã kết nối trực tiếp Zalo/Facebook/Instagram. Nếu giảng viên yêu cầu tự động lấy inbox cá nhân, phải chốt lại tính khả thi ngay tuần 6, không đợi đến cuối kỳ.
- Kết quả AI là dấu hiệu nội dung cần người lớn xem xét, không phải kết luận tính cách hoặc chẩn đoán trẻ.

## Review Focus

1. Usage qua 00:00, 07:00, 22:00 và ranh giới giờ phải phân bổ đúng; giao diện và quota phải khớp nhau.
2. Người chăm sóc chỉ xem/thao tác đúng trẻ và đúng ca; quyền ở trẻ A không xuất hiện như quyền ở trẻ B.
3. Dừng chia sẻ, mất mạng, thiếu quyền OS hoặc thiết bị bị thu hồi phải có trạng thái rõ, không báo thực thi thành công giả.
4. Trẻ gửi đe dọa, bị đe dọa, trích dẫn và nói đùa/phủ định phải được phân biệt trong đánh giá nội dung.
5. Hội thoại trùng/gần trùng giữa train/test hoặc dữ liệu demo phải được phát hiện và công bố; không dùng accuracy đơn lẻ làm bằng chứng.

## Lộ trình theo tuần

| Tuần | Thời gian | Thực hành chính | Sản phẩm / điều kiện hoàn thành |
|---|---|---|---|
| 5 | 18–22/11 | Chạy app hiện có; học luồng web/API/database; thử tạo tài khoản, gia đình, trẻ và ghép app trẻ trên thiết bị được phép | Sơ đồ hai app–backend; checklist chức năng có/chưa có; ảnh hoặc video ghép thiết bị. Nếu thiếu quyền Android thì ghi trạng thái, không làm giả dữ liệu |
| 6 | 23–29/11 | Phân tích yêu cầu, use case, quyền PH/GV/bảo mẫu; kiểm tra tài liệu API ba nền tảng; thống nhất dữ liệu đầu vào AI với thầy | Tài liệu yêu cầu, ERD hiện trạng và đề xuất, ma trận quyền; chốt một trong hai nguồn: dữ liệu được phép nhập hoặc tích hợp API có bằng chứng phù hợp |
| 7 | 30/11–06/12 | Sửa usage tại ranh giới thời gian, quyền UI theo trẻ và heartbeat sharingActive; xử lý lint | Kiểm thử hồi quy trước/sau; npm test, typecheck, lint đạt. Không tắt quy tắc lint hàng loạt để lấy kết quả xanh |
| 8 | 07–13/12 | Nghiệm thu hai app Android: usage, cuộc gọi, vị trí, geofence, quota, chặn app/khóa theo quyền; phân biệt GV và bảo mẫu trong vai trò/giao diện | Bảng kết quả trên thiết bị: đạt/không hỗ trợ/chưa cấp quyền. Chặn app chỉ ghi đạt khi có môi trường quản lý phù hợp |
| 9 | 14–20/12 | Chuẩn bị dữ liệu và hướng dẫn gán nhãn; chuẩn hóa người gửi/thời gian/nguồn; lập tập khó và chia dữ liệu | Dataset v1 có quyền sử dụng, nguồn và schema rõ; bảng phân bố nhãn; không trùng hội thoại giữa train/validation/test |
| 10 | 21–27/12 | Đánh giá Naive Bayes baseline; thử fine-tune ViSoBERT trên notebook; chọn model theo validation | Script train/evaluate tái chạy được; metric theo nhãn, macro-F1, confusion matrix; model và cấu hình có version. Không yêu cầu model mới phải thắng khi chưa đo |
| 11 | 28/12–03/01 | Tích hợp model được chọn vào backend; thử luồng nhập → xác nhận → phân tích → báo cáo | Bản demo tích hợp: model trả nhãn/điểm số/tham chiếu tin nhắn; timeout hoặc model lỗi thì báo rõ; kiểm tra quyền/xóa nguồn |
| 12 | 04–10/01 | Tổng hợp tín hiệu theo thời gian; cải thiện giao diện báo cáo và vai trò; viết phần thiết kế/cài đặt song song | Xem được thay đổi số lượng/tỷ lệ nội dung được gắn nhãn theo kỳ với mẫu số và coverage; có dẫn chứng, thời điểm và giới hạn dữ liệu |
| 13 | 11–17/01 | Kiểm thử hệ thống, dữ liệu khó, thu hồi quyền, offline và xóa dữ liệu; đánh giá cuối trên test đã giữ riêng | Biên bản kiểm thử, metric test cuối, phân tích lỗi và giới hạn. Chạy E2E, build web và APK; ghi đúng phiên bản kiểm tra |
| 14 | 18–24/01 | Hoàn thiện báo cáo, slide, hướng dẫn chạy; đóng băng chức năng; diễn tập với người khác | Báo cáo gần cuối, slide, video demo dự phòng, APK và model; người khác chạy lại được theo hướng dẫn |
| 15 | 25–31/01 | Dự phòng sửa lỗi quan trọng, kiểm tra lại bản bàn giao, tập trả lời phản biện | Bản nộp cuối, kiểm tra gói bàn giao và kịch bản bảo vệ. Không thêm chức năng lớn |

## Các mốc cần báo cáo giảng viên

- **29/11:** chứng minh phạm vi và nguồn tin nhắn; xin xác nhận yêu cầu tự động thu thập có thực sự khả thi với tài khoản mục tiêu.
- **13/12:** demo hai app liên kết, dữ liệu và lệnh có kiểm tra quyền.
- **27/12:** có thí nghiệm AI và số liệu đánh giá, kể cả khi model mới chưa tốt hơn baseline.
- **10/01:** có demo hoàn chỉnh từ dữ liệu đầu vào đến báo cáo cho phụ huynh.
- **24/01:** có toàn bộ hồ sơ, build và video; tuần cuối là dự phòng.

## Cách thực hành mỗi tuần

- [ ] Buổi 1, khoảng 2 giờ: đọc đúng phần lý thuyết cần dùng, xác định kết quả tuần và test/kịch bản nghiệm thu.
- [ ] Buổi 2, khoảng 3 giờ: tự thực hiện phần chính, ghi câu hỏi và lỗi gặp phải.
- [ ] Buổi 3, khoảng 3 giờ: hoàn thiện luồng và kiểm thử; sửa nguyên nhân, không chỉ sửa biểu hiện.
- [ ] Buổi 4, khoảng 3 giờ: chạy demo, lưu bằng chứng, cập nhật báo cáo và commit phần đã xác minh.
- [ ] Dự phòng 1–4 giờ: xử lý lỗi môi trường/dữ liệu, xin phản hồi thầy, hoặc bù việc chưa đạt.

Mỗi tuần phải trả lời được: mình làm được gì, vì sao chọn cách đó, bằng chứng đâu, phần nào chưa làm được. Không dùng code do công cụ tạo mà không giải thích được luồng và giới hạn.

## Hạng mục thực hành và điểm chạm mã nguồn

### A. Hai app, telemetry và quyền — tuần 5–8

**Files hiện có:** `app/page.tsx`, `app/child/page.tsx`, `lib/server/service.mjs`, `lib/server/device.mjs`, `lib/server/access.mjs`, `lib/server/telemetry.mjs`, `db/schema.ts`, `android/app/src/main/java/vn/familycare/child/Telemetry.kt`, `SyncEngine.kt`, `PolicyEnforcer.kt` cùng thư mục; `android/parent/src/main/java/vn/familycare/parent/MainActivity.kt`.

**Giao tiếp:** pairing một lần → credential thiết bị; heartbeat/capability; telemetry; policy version; command và ACK/result. Quyền hiệu lực phải gắn trẻ và ca, không chỉ hợp quyền toàn gia đình.

- [ ] Tuần 5: tự vẽ lại một lượt tạo mã ghép, một lượt gửi usage và một lượt cập nhật policy dựa trên code thật.
- [ ] Tuần 6: ghi rõ giáo viên/bảo mẫu chỉ là hai vai trò cần phân biệt, không tự thêm quản lý lớp hoặc trường.
- [ ] Tuần 7: thêm regression test cho F1–F5 trong báo cáo kiểm tra trước khi sửa; chạy test xác nhận lỗi rồi sửa tối thiểu và chạy lại.
- [ ] Tuần 8: kiểm tra cùng một thao tác ở trạng thái đủ quyền, thiếu quyền, offline, dừng chia sẻ và thu hồi; lưu kết quả thật trên thiết bị được phép.
- [ ] Xác minh: `npm test`, `npm run typecheck`, `npm run lint`, `android/test-core.ps1`; E2E chạy với backend kiểm thử riêng và dữ liệu kiểm thử riêng. Chỉ yêu cầu Android managed enrollment nếu có thiết bị thử phù hợp được phép; không reset điện thoại cá nhân để kịp tiến độ.

### B. Dữ liệu và thí nghiệm AI — tuần 9–10

**Files hiện có:** `lib/analysis.mjs`, `tests/analysis.test.mjs`, `docs/ai-engine.md`. **Dự kiến tạo:** `ml/README.md`, `ml/data-schema.md`, `ml/train.py`, `ml/evaluate.py`, `ml/tests/test_data_split.py`; dữ liệu hội thoại và checkpoint lưu ngoài Git.

**Đơn vị dữ liệu đề xuất:** `conversationId`, `messageId`, `speakerId` đã ẩn danh, `timestamp` nếu có, `text`, `source`, `label`; ghi rõ ai là trẻ mục tiêu khi đánh giá chiều gửi/nhận. Nhãn pilot: bình thường, xúc phạm/bắt nạt, đe dọa bạo lực, chưa đủ ngữ cảnh. Chốt quy tắc xử lý trường hợp nhiều nhãn trước khi train; chưa trộn schema mới với bốn nhãn Naive Bayes hiện tại mà không có ánh xạ được kiểm thử.

- [ ] Chuẩn bị pilot khoảng 100–200 ví dụ để kiểm tra quy tắc gán nhãn trước; mời người thứ hai kiểm tra một phần nếu có thể.
- [ ] Mục tiêu ban đầu khoảng 600–1.000 đoạn ngắn đã gán nhãn nếu nguồn dữ liệu/thời gian cho phép; không coi con số này bảo đảm model tốt hoặc đủ đại diện tin nhắn trẻ em.
- [ ] Chỉ dùng dữ liệu có quyền sử dụng; ưu tiên dữ liệu nghiên cứu phù hợp hoặc hội thoại của người tình nguyện trưởng thành. Dữ liệu tự viết chỉ phục vụ demo/test và được đánh dấu; không dùng để tuyên bố hiệu quả thực địa.
- [ ] Chia theo hội thoại/người tham gia khi khả thi, dự kiến 70/15/15; loại trùng/gần trùng trước chia. Nếu dữ liệu ít, công bố số lượng từng nhãn và giới hạn của test.
- [ ] Đo precision/recall/F1 theo nhãn, macro-F1 và confusion matrix; kiểm tra riêng chiều đe dọa, trích dẫn, phủ định, tiếng lóng, không dấu. Chỉ chọn ngưỡng bằng validation, không tối ưu trên test cuối.
- [ ] Đánh giá Naive Bayes theo cùng bài toán hoặc mô tả rõ ánh xạ nhãn; fine-tune ViSoBERT nếu quyền sử dụng và tài nguyên đáp ứng. Nếu thiếu GPU, thử môi trường notebook được phép hoặc giữ baseline; không cam kết chi phí dịch vụ.
- [ ] Lưu seed, cấu hình, version dữ liệu và checkpoint; lập bảng lỗi thay vì chỉ chụp một con số accuracy.

### C. Tích hợp AI và xu hướng — tuần 11–12

**Files:** `lib/server/service.mjs`, `lib/analysis.mjs`, `app/page.tsx`, `tests/real-features.test.mjs`; **dự kiến tạo:** `ml/serve.py`, `lib/server/model-client.mjs` và test hợp đồng tương ứng. Thiết kế chi tiết phải chốt sau kết quả tuần 10; chưa cài thêm framework chỉ vì lịch có tên file.

**Hợp đồng dự kiến:** request gồm `requestId` và danh sách `{messageId, speakerId, text}` theo thứ tự hội thoại; response gồm `modelVersion`, các prediction `{messageId, label, score}` và `limitations`. `score` không mặc định là xác suất trẻ gây bạo lực; dẫn chứng phải liên kết tin nhắn thật, không sinh câu trích dẫn mới.

- [ ] Chốt cách API Workers/local gọi dịch vụ Python có xác thực; trình duyệt và APK không giữ secret dịch vụ model. Không đưa PyTorch trực tiếp vào Workers.
- [ ] Giới hạn kích thước, timeout; tách phân tích model khỏi thao tác khóa/chặn. Model không tự phát lệnh xử phạt trẻ.
- [ ] Kiểm tra nhập có đồng thuận, đúng trẻ và quyền; sai response/version hoặc model không hoạt động phải báo phân tích chưa hoàn thành.
- [ ] Đếm và so sánh tín hiệu theo tuần khi timestamp/coverage đủ; không suy ra giảm nguy cơ chỉ vì không thu được dữ liệu. Khi thiếu timestamp thì không dựng xu hướng giả.
- [ ] Kiểm tra xóa nguồn và báo cáo dẫn xuất theo quy tắc đã công bố; không vô tình đưa dữ liệu riêng tư vào log hoặc repo.

### D. Nghiệm thu và bàn giao — tuần 13–15

- [ ] Chạy test cuối một lần sau khi chốt model/ngưỡng; báo cáo cả false positive và false negative, không điều chỉnh theo test rồi giữ nguyên tên “test độc lập”.
- [ ] Chạy `npm run test:e2e` với backend test; `npm run build`; Android `:app:assembleDebug :parent:assembleDebug :app:lintDebug :parent:lintDebug` với toolchain phù hợp; lưu log và phiên bản.
- [ ] Demo lần lượt: đăng nhập → chọn trẻ → ghép → quyền/chia sẻ → usage/vị trí → policy và kết quả → nhập hội thoại được phép → AI/bằng chứng → GV/bảo mẫu chỉ xem đúng phần được cấp.
- [ ] Chuẩn bị tình huống thiếu mạng, thiếu quyền và model lỗi; video dự phòng ghi rõ là bản quay, không dùng dữ liệu mẫu dưới nhãn dữ liệu thật.
- [ ] Gói bàn giao gồm mã nguồn, migration/ERD, hướng dẫn môi trường, APK, cấu hình mẫu không có secret, model/config/metric được phép chia sẻ, báo cáo, slide và video.

## Việc bắt đầu ngay trong tuần 5

1. Đọc báo cáo kiểm tra chức năng và README, tự giải thích được sơ đồ hai app/backend.
2. Chạy dự án theo README; tạo tài khoản và dữ liệu thử riêng.
3. Ghép app trẻ vào cùng backend, ghi lại trường hợp đủ/thiếu quyền và một lượt đồng bộ thực nếu có thiết bị phù hợp.
4. Lập bảng bốn cột: yêu cầu, hiện trạng, bằng chứng, việc còn thiếu.
5. Gửi thầy báo cáo tuần 5 kèm câu hỏi trọng tâm: chấp nhận phân tích dữ liệu hội thoại được phép nhập hay bắt buộc tích hợp tự động inbox cá nhân? Kết quả quyết định phạm vi từ tuần 6.

## Tự rà soát kế hoạch

- Yêu cầu hai app, phân quyền, telemetry, policy, vị trí/vùng, dữ liệu mạng xã hội, model và giao diện đều có tuần phụ trách.
- Phần chưa rõ: ngày nộp thật, số giờ/tuần, nguồn dữ liệu và yêu cầu bắt buộc của thầy đối với việc tự động lấy tin nhắn. Lịch không dùng sự im lặng để coi các điểm này đã được chấp thuận.
- Các nội dung ngoài phạm vi như iOS native, LLM giải thích và hạ tầng lớn không nằm trên đường bắt buộc.
- Không có yêu cầu triển khai sản phẩm ngay trong lần lập lịch này.
