# Dùng Supabase làm database online chung

Project của bạn: `https://ybrqqcxpzkogurvhbzlx.supabase.co`.

Bạn chỉ tạo một project Supabase. PostgreSQL là database bên trong Supabase, không cần đăng ký hay vận hành máy chủ PostgreSQL thứ hai. GitHub lưu code; Supabase lưu dữ liệu; backend hiện có làm việc với Supabase qua HTTPS.

## Những gì đã chuẩn bị trong code

- Adapter Supabase dùng cho toàn bộ API phụ huynh và thiết bị; không đổi URL API của app.
- Migration PostgreSQL: `supabase/migrations/202611180001_family_care.sql`.
- Schema riêng `family_care` có accounts, sessions, families, records, pairings, credentials, events, rate_limits, service_state.
- Giao dịch nguyên tử qua RPC nội bộ, chống trùng event, CAS policy và chặn event từ thiết bị đã thu hồi.
- RPC `public.fc_execute` chỉ backend dùng secret/service-role key được gọi. Không cấp quyền này cho `anon` hoặc `authenticated`; không gọi RPC từ APK/web client.
- RLS và quyền truy cập bảng hạn chế. Quyền theo người dùng/trẻ/ca vẫn do API hiện có kiểm tra. Tài khoản ứng dụng chưa chuyển thành Supabase Auth; tài khoản tạo trong Auth Dashboard không tự đăng nhập được vào app hiện tại.
- Client Supabase công khai ở `utils/supabase` để sẵn cho tích hợp tương lai. Không thêm middleware Supabase Auth khi ứng dụng vẫn dùng cookie `fc_session`; không thay dashboard bằng ví dụ todos.
- D1 local vẫn dùng được để phát triển khi chưa cấu hình xong. Chọn Supabase mà thiếu cấu hình thì API báo lỗi, không tự ghi sang D1.

## 1. Tạo bảng trên Supabase

1. Mở đúng project trong [Supabase Dashboard](https://supabase.com/dashboard/project/ybrqqcxpzkogurvhbzlx).
2. Mở SQL Editor, tạo query mới.
3. Sao chép toàn bộ nội dung `supabase/migrations/202611180001_family_care.sql` và Run với vai trò database owner mặc định. Script không tạo hồ sơ hoặc tin nhắn mẫu.
4. Trong Table Editor chọn schema `family_care` để xem bảng. Không thêm schema này vào danh sách schema công khai của Data API.

Migration có thể chạy lại để đồng bộ function/policy; không xóa bảng hay dữ liệu đang có. Nếu project đã có schema `family_care` của ứng dụng khác, không chạy chồng: kiểm tra cấu trúc trước. Các migration mới sau này phải thêm file riêng và review qua Git.

## 2. Cấu hình backend trên máy

Đã điền URL và publishable key bạn cung cấp trong `.env.local` nếu file chưa tồn tại. File này bị Git bỏ qua.

Chạy:

```sh
npm ci
npm run supabase:prepare
```

Lệnh prepare bổ sung biến thiếu vào `.dev.vars`, không đổi khóa mã hóa hoặc giá trị đang có. Mở `.dev.vars` trên máy, điền:

```dotenv
SUPABASE_URL=https://ybrqqcxpzkogurvhbzlx.supabase.co
SUPABASE_SECRET_KEY=<secret key phía server lấy từ API Keys của project>
```

Dùng secret key `sb_secret_...`, hoặc legacy `service_role` key qua biến `SUPABASE_SERVICE_ROLE_KEY`. Không dùng publishable key cho backend RPC. Không gửi khóa này qua chat, GitHub hoặc chép vào APK. Nếu key từng bị công khai thì thu hồi/đổi key ở Supabase.

Giữ nguyên `FC_DATA_KEY` đã có. Backend khác dùng cùng database phải có cùng khóa này để giải mã dữ liệu. File mẫu có hướng dẫn tạo khóa mới nếu dựng môi trường hoàn toàn mới; không đổi khóa khi database đã có dữ liệu mã hóa.

Kiểm tra trước khi chuyển provider:

```sh
npm run supabase:check
```

Chỉ khi lệnh in `Supabase connection and Family Care migration verified` mới đổi:

```dotenv
FC_DATABASE_PROVIDER=supabase
```

Dừng và chạy lại server:

```sh
npm run dev
```

Mở `/api/health`: phải trả HTTP 200 với `database: "Supabase/PostgreSQL"`. Health đã thực sự truy vấn bảng, không chỉ đọc nhãn cấu hình. Không coi việc thấy URL/publishable key là đã kết nối database thành công.

## 3. Kiểm thử hai app

1. Tạo tài khoản thử trên web quản lý, tạo gia đình và trẻ thử nghiệm.
2. Tạo mã ghép một lần; app trẻ nhập cùng URL BACKEND, không nhập URL Supabase vào ô backend Android.
3. Ghép thành công, gửi heartbeat, kiểm tra thiết bị trên web.
4. Cấp từng quyền cần dùng, bật chia sẻ; kiểm tra dữ liệu và trạng thái policy/command.
5. Thu hồi thiết bị và xác nhận thiết bị không còn gửi/đọc dữ liệu qua credential cũ.

App trẻ không biết secret Supabase. Thiết bị dùng token riêng được API cấp khi ghép; app quản lý dùng session đăng nhập. Không cấp tài khoản phụ huynh cho app trẻ.

## 4. Dùng online ở hai địa điểm

Supabase là database online, không tự host dashboard và toàn bộ backend hiện có. Cần triển khai web/backend lên một địa chỉ HTTPS mà các thiết bị đều truy cập được.

Môi trường hosting phải có các runtime secret sau (không đưa vào `.openai/hosting.json`):

```text
FC_DATABASE_PROVIDER=supabase
SUPABASE_URL=https://ybrqqcxpzkogurvhbzlx.supabase.co
SUPABASE_SECRET_KEY=<server secret>
FC_DATA_KEY=<same encryption key>
```

Sau khi đặt secret cần deploy/redeploy và kiểm tra health trên URL online. Giữ tài khoản đăng nhập của ứng dụng; nếu dùng Sites riêng tư, cổng đăng nhập Sites có thể chặn APK. Phải cấu hình gateway hỗ trợ client native trước khi coi APK kết nối online thành công, không nhúng token bypass toàn Site vào APK. Bản LAN không có cổng này.

Mỗi phút, `npm run dev` sẽ dọn dữ liệu hết hạn trên provider được chọn. Worker có handler scheduled; môi trường online cần cấu hình lịch chạy để việc dọn dữ liệu không phụ thuộc có người mở web. Backup SQLite local không phải backup Supabase. Xác định phương án sao lưu/khôi phục của project trước dùng dữ liệu thực.

## 5. Chia sẻ code qua GitHub

Repo nhóm: [hysoul2k/FamilyCare](https://github.com/hysoul2k/FamilyCare). Xem `CONTRIBUTING.md`. Bản tích hợp được chuẩn bị trên nhánh `feat/supabase-shared-data`; kiểm tra nhánh trên GitHub trước khi clone, không mặc định main đã có toàn bộ code.

```sh
git clone --branch feat/supabase-shared-data https://github.com/hysoul2k/FamilyCare.git
cd FamilyCare
npm ci
```

- Commit code, `package-lock.json`, file migration, `.env.example`, `.dev.vars.example` và tài liệu.
- Không commit `.env.local`, `.dev.vars`, `.wrangler`, database hoặc dữ liệu hội thoại thực.
- Bạn cùng nhóm lấy code về, `npm ci`, nhận cấu hình qua kênh riêng nếu thực sự phụ trách backend. Người chỉ phát triển app dùng URL backend và tài khoản/token thử, không cần secret database.
- Người truy cập Dashboard dùng lời mời thành viên project/tổ chức phù hợp; không dùng chung mật khẩu tài khoản chủ.
- Mỗi thay đổi database thêm một migration mới, không chỉnh trực tiếp database rồi quên đưa cấu trúc vào repo.
- GitHub Actions đã có test, typecheck và lint những file tích hợp mới; whole-project lint còn lỗi cũ như báo cáo kiểm tra, chưa tuyên bố đã sạch.

## 6. Dữ liệu local hiện tại

Chuyển provider KHÔNG tự sao chép SQLite/D1 lên Supabase. File local được giữ nguyên. Supabase mới sẽ bắt đầu không có tài khoản/hồ sơ cho tới khi đăng ký trên backend dùng Supabase.

Nếu cần giữ dữ liệu thật từ local: sao lưu SQLite và `FC_DATA_KEY` riêng tư, lên kế hoạch chuyển tài khoản → gia đình → records → credentials/pairings → events, kiểm tra số lượng và khả năng giải mã trước khi đổi provider. Không upload file database vào GitHub. Task này chưa thực hiện nhập dữ liệu người dùng vào cloud khi chưa có quyền kết nối.

## 7. Bằng chứng kiểm tra

Các test mới thực thi migration và query trên PostgreSQL PGlite trong bộ nhớ, đi qua cùng HTTP-adapter/RPC contract; không dùng database Supabase thật. Chúng xác minh rollback batch, parameter binding, deny RPC/table cho anon/authenticated, ghép mã một lần, CAS, telemetry/dedup, lệnh, xin giờ, mời/thu hồi, mã hóa và xóa.

Vẫn cần kiểm tra thực tế trên gateway Supabase bằng `supabase:check` và hai app sau khi có server secret và migration. Không coi PGlite là bằng chứng project cloud đã cấu hình xong.

Tham khảo: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Database functions](https://supabase.com/docs/guides/database/functions), [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).
