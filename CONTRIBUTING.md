# Phát triển cùng nhau

## Phân công hiện tại

- Chủ dự án: app quản lý web/Android/iPhone PWA, backend/Supabase, dữ liệu và AI/báo cáo.
- Bạn cùng nhóm: app trẻ Android/iOS, quyền OS, thu dữ liệu và thực thi chính sách/lệnh; tham khảo mã trẻ hiện có.
- Cùng thống nhất hợp đồng ở `docs/device-api.md` và `docs/removal-contract.md`. Chỉ làm app trẻ thì dùng URL backend và token thiết bị; không cần secret Supabase.
- iOS quản lý theo yêu cầu hiện tại là Safari web app thêm vào màn hình chính, không cần project Swift/TestFlight. Xem `docs/manager-platforms.md`.

## Cài trên máy mới

Node >=22.16, khuyến nghị Node 24 như CI. Chạy `npm ci`. Chọn một cách:

- Local độc lập: `npm run setup:local`, `npm run dev`; dữ liệu chỉ ở máy này.
- Supabase chung: theo `docs/supabase-setup.md`, không tự tạo project khác nếu đang kiểm thử liên kết chung.
- Chỉ làm APK: dùng URL backend thử nghiệm nhóm cung cấp, xem `docs/device-api.md` và `android/README.md`; không cần khóa server.

## Quy trình sửa chức năng

1. Tạo nhánh theo đầu việc, ví dụ `feat/parent-location` hoặc `fix/device-sync`.
2. Thống nhất request/response nếu thay API; giữ client cũ hoạt động hoặc nâng version rõ ràng.
3. Thay đổi dữ liệu Supabase phải có migration mới trong `supabase/migrations/`; D1 migration nằm riêng ở `drizzle/`.
4. Chạy `npm test`, `npm run typecheck`, lint các file thay đổi, và `npm run build` nếu sửa runtime/giao diện. Android chạy thêm build/lint và test phù hợp.
5. Push nhánh, mở pull request; người khác review trước merge. Không tự chạy test xóa dữ liệu trên gia đình người dùng.

`npm test` có PostgreSQL trong bộ nhớ, không cần Supabase secret hoặc network. CI không có quyền ghi database chung. Kiểm thử online dùng tài khoản và trẻ thử nghiệm riêng, xóa đúng dữ liệu do lượt test tạo.

## Cấu hình và bí mật

`.env.local` dành cho biến trình duyệt công khai; `.dev.vars` dành cho backend local. Chỉ hai file `.example` được chia sẻ trong repo. Secret Supabase và FC_DATA_KEY không xuất hiện trong code, ảnh chụp màn hình hoặc issue. Không reset khóa mã hóa để khắc phục lỗi kết nối.

Database có thể chứa dữ liệu mới hơn code đang chạy; migration phải tương thích hoặc triển khai theo thứ tự đã thống nhất. Không xóa/reset database chung để làm test xanh.
