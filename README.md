# Antigravity Custom v0.5.0 (Rust & Tauri Edition)

Bộ công cụ tùy biến giao diện Native cao cấp và Trình khởi chạy hiệu năng cao viết bằng **Rust + Tauri v2** dành riêng cho **Antigravity App (Windows)**. 

Thay thế hoàn toàn bộ launcher Electron cồng kềnh trước đây bằng kiến trúc nhị phân Rust siêu nhẹ (chỉ **25.5 MB**, khởi động tức thì, tiêu thụ RAM chỉ **~30 MB**), kết hợp màn hình khởi động **White Gundam**, hiệu ứng hạt năng lượng **Plavsky Particle**, và bảng giám sát hạn ngạch AI thời gian thực (**Live Quota Telemetry** cho Gemini & Codex).

---

## ⚡ So sánh Hiệu năng (v0.5.0 Rust vs v0.4.x Electron)

| Tiêu chí | Bản Electron cũ (v0.4.2) | Bản Rust + Tauri mới (v0.5.0) | Cải thiện |
| :--- | :--- | :--- | :--- |
| **Kích thước file chạy** | 128 MB | **25.5 MB** | **Giảm 80% dung lượng** |
| **Bộ nhớ RAM tiêu thụ** | ~180 MB - 220 MB | **~28 MB - 35 MB** | **Tiết kiệm 85% RAM** |
| **Tốc độ khởi động** | ~2.5 - 4.0 giây | **< 0.3 giây (Tức thì)** | **Nhanh hơn gấp 10 lần** |
| **Thư viện phụ thuộc (npm)** | 457 MB (`node_modules`) | **0 MB (Zero Dependency)** | **Sạch hoàn toàn ổ đĩa** |
| **Độ an toàn bộ nhớ** | Phụ thuộc V8 Garbage Collector | **Rust Memory Safety (Không leak RAM)** | **Bảo mật tuyệt đối** |

---

## 🌟 Tính năng nổi bật

### 1. Trình khởi chạy Rust Siêu nhẹ & Bảo mật (`Antigravity Custom.exe`)
- Xây dựng trên nền tảng **Rust Core (`crates/agc-core`)** và **Tauri v2 (`src-tauri`)**.
- **Bảo mật chuẩn Scrypt-v1**: Mã hóa mật khẩu cục bộ ($N=32768, r=8, p=1, \text{keylen}=64$), chống tấn công brute-force phần cứng và Rainbow table.
- **Tự động phát hiện cài đặt**: Tự động nhận diện đường dẫn cài đặt Antigravity chính thức của Google trong `%LOCALAPPDATA%\Programs\Antigravity\`.
- Quản lý chủ đề, đổi mật khẩu, xem trước Splash và mở ứng dụng chỉ với một click.

### 2. Màn khởi động White Gundam Sci-Fi & Plavsky Particle
- **Nền Live Wallpaper White Gundam**: Khớp tỷ lệ 1:1 giữa màn khởi động và không gian làm việc.
- **Lò phản ứng Cyberpunk HUD**: Lõi xoay hạt năng lượng Plavsky trong suốt, hiệu ứng vòng tua đa lớp, viền kính cyan phát sáng (`#22d3ee`).
- **Hiệu ứng chuyển cảnh Warp Transition**: Chuyển tiếp mượt mà từ màn khởi động vào thẳng giao diện làm việc Antigravity mà không gây chớp giật màn hình.

### 3. AI Engine Quota Telemetry (Thời gian thực)
- Đọc trực tiếp hạn ngạch AI từ file nhị phân session nội bộ của Antigravity và Codex:
  - **✦ Antigravity (Gemini)**: Hạn mức 5 giờ và hạn mức Tuần.
  - **◈ Codex (ChatGPT / Claude)**: Hạn mức 5 giờ và hạn mức Tuần.
- **In-App Quota HUD**: Widget gắn trên thanh tiêu đề bên trong Antigravity, tự động cập nhật liên tục để bạn luôn chủ động nắm bắt dung lượng quota còn lại khi lập trình.

### 4. Tích hợp Native An toàn (Không can thiệp file `.exe`)
- Tích hợp trực tiếp vào tệp `app.asar` của Antigravity App (phiên bản **2.35.1** và **2.34.0**).
- **Tự động sao lưu 1:1**: Luôn tạo bản backup an toàn `app.asar.original` trước khi cài đặt. Bạn có thể khôi phục nguyên bản Google bất kỳ lúc nào chỉ bằng một cú nhấp chuột.
- Tuyệt đối không can thiệp mã nhị phân `Antigravity.exe` hay tài khoản Google.

---

## 💻 Yêu cầu hệ thống

- **Hệ điều hành**: Windows 10 / Windows 11 (64-bit).
- **Ứng dụng mục tiêu**: **Antigravity App v2.35.1** hoặc **v2.34.0** chính thức từ Google.
- **WebView2 Runtime**: Đã tích hợp sẵn trên Windows 10/11.

---

## 🚀 Hướng dẫn Cài đặt & Sử dụng

### Dành cho người dùng thông thường *(Đơn giản nhất)*

1. Đóng hoàn toàn Antigravity App (nếu đang mở).
2. Chạy ứng dụng Launcher tại:
   ```
   release/Antigravity Custom.exe
   ```
3. Tạo mật khẩu khởi động riêng của bạn (tối thiểu 8 ký tự).
4. Trong giao diện, bấm **Cài tích hợp native** (hoặc bấm **Mở Antigravity**).
5. Từ giờ, bạn có thể mở trực tiếp **Antigravity App** từ Desktop hoặc thanh Start Menu — màn khởi động White Gundam và Quota HUD sẽ tự động hiển thị trong ứng dụng!

---

### Dành cho Lập trình viên *(Build từ mã nguồn)*

Dự án không cần cài đặt `node_modules` (Zero npm dependencies):

```powershell
# 1. Kiểm tra mã nguồn JS & Rust
npm run check
npm test
npm run test:rust

# 2. Khởi chạy Launcher trực tiếp từ Rust (chế độ Dev)
npm start
# hoặc:
cargo run --manifest-path src-tauri/Cargo.toml

# 3. Biên dịch bản Release nhị phân mới (.exe chỉ ~25 MB)
npm run package
# hoặc:
cargo build --manifest-path src-tauri/Cargo.toml --release

# 4. Cài đặt / Gỡ cài đặt tích hợp native vào Antigravity
node scripts/native-install.cjs install
node scripts/native-install.cjs uninstall
```

---

## 📂 Cấu trúc Thư mục Dự án

```
antigravity-custom/
├── crates/
│   └── agc-core/          # Thư viện lõi Rust (Quota binary parser, Scrypt security, Config)
├── src-tauri/             # Mã nguồn ứng dụng Tauri v2 (Window IPC, WebView2 integration)
├── src/
│   ├── renderer/          # Giao diện Web (HTML5, CSS3, Scene 3D canvas, Audio)
│   ├── native/            # Module tích hợp Splash Native (overlay.cjs, splash.html/mjs)
│   ├── integration/       # Runtime script tiêm vào Antigravity App
│   └── core/              # Logic Node.js phụ trợ cho bộ cài installer native
├── scripts/
│   ├── native-install.cjs # Script cài đặt / sao lưu / gỡ bỏ patch app.asar
│   └── check.cjs          # Script kiểm tra cú pháp nhanh
├── test/                  # Bộ unit test tự động (node:test)
├── release/
│   └── Antigravity Custom.exe # Bản chạy độc lập chính thức (Rust 25.5 MB)
└── package.json           # Cấu hình lệnh phát triển
```

---

## 🔄 Khôi phục Giao diện Gốc của Google

Nếu bạn muốn gỡ bỏ hoàn toàn tùy biến và quay về màn khởi động gốc:
- **Qua giao diện**: Mở `Antigravity Custom.exe` → Vào **Bảo mật & Mật khẩu** → Bấm **Khôi phục splash gốc**.
- **Qua dòng lệnh PowerShell**:
  ```powershell
  node scripts/native-install.cjs uninstall
  ```

---

## 🔒 Bản quyền & Cam kết Bảo mật

- Phát hành theo giấy phép mã nguồn mở **MIT**.
- **Loopback-only & Local**: Mọi cấu hình, hạn ngạch và mật khẩu đều lưu trữ và xử lý 100% cục bộ tại máy cá nhân, tuyệt đối không gửi bất kỳ dữ liệu nào ra mạng ngoài.
- Dự án tùy biến độc lập của cộng đồng, không có liên kết chính thức với Google LLC.
