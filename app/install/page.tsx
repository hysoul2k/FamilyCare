import Link from 'next/link';

export default function InstallManager(){return <main className="child-app">
 <Link href="/" className="brand">Family Care</Link>
 <h1>Ứng dụng dành cho người quản lý</h1>
 <p>Phụ huynh, giáo viên và bảo mẫu sử dụng cùng hệ thống; dữ liệu và thao tác hiển thị theo quyền được cấp.</p>
 <section className="card"><h2>Web</h2><p>Mở bằng trình duyệt trên máy tính hoặc điện thoại. Đăng nhập cùng tài khoản gia đình.</p><Link className="button primary" href="/">Mở bảng quản lý</Link></section>
 <section className="card"><h2>Android</h2><p>Cài bản APK quản lý, nhập địa chỉ website Family Care rồi đăng nhập. Bản debug phục vụ kiểm thử.</p><a className="button primary" href="/downloads/family-care-parent-debug.apk" download>Tải APK quản lý Android</a></section>
 <section className="card"><h2>iPhone và iPad</h2><p>Cài web app quản lý vào màn hình chính bằng Safari. Không cần App Store hoặc TestFlight.</p><ol><li>Mở địa chỉ HTTPS của website Family Care bằng Safari.</li><li>Nhấn nút Chia sẻ, chọn “Thêm vào Màn hình chính”.</li><li>Nếu Safari hiển thị tùy chọn “Mở dưới dạng ứng dụng web”, hãy bật tùy chọn đó, rồi nhấn “Thêm”.</li><li>Mở biểu tượng Family Care trên màn hình chính và đăng nhập tài khoản quản lý.</li></ol><p className="muted">Dùng cùng tài khoản để xem dữ liệu trên web, APK và iPhone. Safari và web app có thể yêu cầu đăng nhập riêng. Bản LAN HTTP dùng xem thử; khi dùng chính thức hãy mở URL HTTPS.</p></section>
 <section className="card"><h2>Kết nối và thông báo</h2><p>App quản lý cần mạng để tải dữ liệu mới và gửi lệnh. Thông báo hiện cập nhật khi bảng quản lý đang mở; chưa có thông báo đẩy khi đóng app.</p></section>
 <section className="card"><h2>Liên kết với điện thoại trẻ</h2><p>Trong bảng quản lý, tạo hồ sơ trẻ và mã ghép. Ứng dụng trẻ nhập mã để liên kết với đúng hồ sơ; người quản lý không cần cấp quyền đọc cuộc gọi hoặc vị trí của chính mình.</p></section>
 </main>;}
