# Antigravity Custom

Launcher **Rust + Tauri v2** và bộ tùy biến dành cho **Antigravity App trên Windows**.
Một launcher quản lý cả theme **Gundam** và **Sword Art Online I/II**, splash,
âm thanh khởi động, xác thực cục bộ và bảng Custom trong Settings của App.

Phiên bản hiện tại: **0.5.0**. Dự án cộng đồng độc lập, không liên kết với Google.

## Tính năng

- Thư viện theme chung: Gundam/Focus và năm biến thể SAO — Aincrad, ALfheim,
  Phantom Bullet, Calibur, Mother’s Rosario. Giữ các preset đã tùy chỉnh từ profile cũ.
- Splash, nền video/ảnh, font và âm thanh được lưu cục bộ.
- Mật khẩu dùng chung giữa launcher và phần tích hợp native; phiên mở khóa độc lập.
- HUD quota và mục **Custom** trong Settings sau khi xác thực.
- Cài/cập nhật native có kiểm tra phiên bản, checksum, sao lưu và khôi phục app.asar.
- Chế độ giảm chuyển động và xem trước splash trong launcher.

### Âm thanh và luồng phiên

| Theme | Nhạc nền splash | Bấm Bắt đầu | Kết thúc phiên |
| --- | --- | --- | --- |
| Gundam / Graphite / Paper | GUNDAM BUILD FIGHTERS — Yuki Hayashi | Câu thiết lập GP Base, 3,10 giây | Màn kết thúc và âm cũ khi bật shutdown |
| SAO | Swordland — Yuki Kajiura | Xác minh mật khẩu; Link Start phát sau xác thực thành công | Màn kết thúc không âm thanh |

Nhạc dừng khi vào giao diện chính của App. Cue làm hạ nhạc nền trong lúc phát.
Gundam dùng đúng bản nhạc nền gần 5 phút; đoạn GP Base được cắt riêng, không phát
nguyên startup track 46 giây. Cả ba biến thể Gundam/Focus hỗ trợ màn kết thúc,
kể cả khi đóng ngay tại splash trước đăng nhập.

Splash SAO có nội dung căn giữa, chữ và nút đặt trực tiếp trên nền Kirito.
Khung **Áp dụng SAO + Swordland** chỉ hiện khi chọn theme SAO và không ghi đè
cấu hình splash, âm lượng, nhạc hay cue của Gundam.

## Yêu cầu

### Để dùng bản đã build trong checkout này

- Windows x64 và Microsoft Edge WebView2 Runtime.
- Antigravity **App 2.35.1 hoặc 2.34.0** có checksum nằm trong danh sách hỗ trợ.
- Node.js để launcher gọi bộ cài, cập nhật, kiểm tra và gỡ tích hợp native.
- Giữ source và scripts của checkout tại vị trí đã build launcher.

**Bản hiện tại chưa phải gói cài portable hoàn toàn.** Giao diện được nhúng trong
EXE, nhưng các thao tác quản lý native vẫn gọi scripts từ đường dẫn checkout
được ghi khi build. Nếu chuyển project sang vị trí khác, cần build lại launcher.

Dự án nhắm tới **Antigravity App**; không dùng VSIX để tích hợp vào Antigravity IDE.

### Để phát triển

Cần Rust/Cargo, toolchain MSVC cùng C++ Build Tools/Windows SDK, Node.js và npm.
Các dependency Rust được Cargo quản lý. Mã Node hiện tại dùng thư viện chuẩn,
không yêu cầu npm install để chạy các script kiểm tra.

## Bắt đầu sử dụng

1. Đóng Antigravity App trước khi cài hoặc cập nhật tích hợp.
2. Mở **release/Antigravity Custom.exe**.
3. Đăng nhập bằng mật khẩu hiện có, hoặc tạo mật khẩu lần đầu từ 8 ký tự.
4. Chọn theme trong **Chủ đề & Màu sắc** và dùng **Xem splash** để kiểm tra.
5. Bấm **Mở Antigravity**. Launcher kiểm tra native và cài/cập nhật nếu cần.
   Có thể quản lý tích hợp trong **Bảo mật & Mật khẩu**.
6. Hoàn tất splash trong App, sau đó vào **Settings → Custom** để chỉnh tiếp.

Sau khi đã cài native, mở Antigravity App trực tiếp cũng dùng splash tùy biến.
Launcher và App dùng chung mật khẩu, nhưng mỗi bên cần tự xác thực phiên của mình.
Nếu cần cập nhật mà App đang chạy, bộ cài yêu cầu đóng App; không tự tắt tiến trình.

Nhạc riêng được lưu theo nhóm theme. Import media và chia sẻ preset hiện được
triển khai trong **Custom bên trong App**; các adapter tương ứng của launcher
Tauri còn là placeholder.

## Build và kiểm tra

Chạy tại thư mục gốc project:

```powershell
# Kiểm tra cú pháp và test Node
npm run check
npm test

# Test lõi Rust
npm run test:rust

# Chạy launcher ở chế độ phát triển
npm start

# Build launcher / CLI
npm run build
npm run build:cli

# Đưa launcher release vào thư mục phân phối
New-Item -ItemType Directory -Force release | Out-Null
npm run package
```

Các cache target được tạo lại ở lần build đầu sau khi dọn project.

### Kiểm tra media đã cài

```powershell
npm run audit:media
```

Lệnh này cần native đã được cài. Nó đối chiếu hash audio giữa source/runtime,
kiểm tra file import còn tồn tại và xem cấu hình có tham chiếu Download không.

### Kiểm tra giao diện bằng fixture

Cần Python, Playwright Python và Edge:

```powershell
python -m pip install playwright
python test/ui-preview.py
```

Fixture kiểm tra chọn theme, preview audio riêng qua IPC/Blob Tauri giả lập,
nhạc bundled, GP Base, dừng nhạc khi vào App, ending, xác thực và reduced motion.
Ảnh kết quả nằm trong work/. Đây là fixture, không thay thế kiểm tra App thực.

## Cài, cập nhật và khôi phục native

Đóng Antigravity App rồi chạy:

```powershell
# Xem trạng thái và nhu cầu cập nhật
node scripts/native-install.cjs status

# Cài hoặc cập nhật
npm run native:install

# Khôi phục splash gốc
npm run native:uninstall
```

Cũng có thể chọn **Khôi phục splash gốc** trong launcher sau khi đăng nhập.
Bộ cài từ chối phiên bản/checksum chưa biết và không khôi phục archive cũ lên
một bản App đã thay đổi. Bản sao lưu gốc nằm trong resources/agc-custom-backup
của cài đặt App; runtime cộng đồng nằm trong resources/agc-custom.

## Dữ liệu và mật khẩu

Nếu có native, launcher đọc thư mục dữ liệu từ manifest agc-custom/install.json.
Khi chưa cài, đường dẫn mặc định là:

```text
%APPDATA%\antigravity-custom
```

- Mật khẩu được băm bằng scrypt và xử lý trong main process.
- Rust và Node đọc cùng security.json, hỗ trợ định dạng cũ của hai bên và dùng
  khóa liên tiến trình khi cập nhật credential.
- Đổi mật khẩu ở một bên được bên kia nhận khi xác thực tiếp theo.
- Lưu cấu hình, mở App và quản lý native từ launcher/Settings yêu cầu xác thực.
- Preset xuất không kèm mật khẩu, tên cá nhân, đường dẫn máy hay media riêng.
- Media import được sao chép vào kho assets bằng ID; không phụ thuộc file gốc
  trong Download. Có thể xóa bản Download sau khi import. Giữ bản nguồn nếu muốn
  cắt lại một đoạn khác về sau.

### Chuyển mật khẩu từ launcher Rust cũ

Chỉ dùng khi cần nhập lại mật khẩu từ bản Rust cũ từng lưu ở LocalAppData.
Đóng cả hai ứng dụng, cập nhật native rồi chạy một lần:

```powershell
node scripts/sync-password.cjs
```

Lệnh sao lưu credential native hiện có trước khi nhập bản cũ, giữ nguyên cấu hình
và media. Không chạy lại sau các lần đổi mật khẩu tiếp theo nếu muốn tiếp tục dùng
mật khẩu mới trong profile chung.

## Kiến trúc và giới hạn

- **Launcher:** Rust/Tauri, giao diện HTML/CSS/JS và WebView2.
- **Native:** module Electron chạy trong App, thêm splash và Settings bằng
  WebContentsView trong cùng cửa sổ; bật sandbox/contextIsolation và IPC allowlist.
- **Tích hợp giao diện:** chỉ nhận trang App trên loopback. Native dùng debugger
  nội bộ; nhánh CDP thử nghiệm không tự mở cổng debug khi khởi chạy thông thường.
- **CSP và media:** renderer có CSP; preview nhạc riêng đi qua main có xác thực,
  kiểm tra ID, loại file, dung lượng và đường dẫn trước khi tạo Blob cục bộ.
- **Quota:** việc đọc dữ liệu cục bộ và HUD phụ thuộc phiên bản App/schema dữ liệu.
- Không sửa Antigravity.exe hay file profile Google. App.asar chỉ được patch ở
  phiên bản đã nhận diện, với bản sao lưu phục vụ khôi phục.

## Tình trạng tương thích

| Phạm vi | Đã kiểm tra |
| --- | --- |
| Google App 2.35.1 thực | Splash, xác thực, HUD, Settings → Custom; đóng Focus Graphite tại splash hiện ending rồi tự đóng khoảng 4 giây |
| Google App 2.34.0 | Có trong whitelist; lịch sử các bài thử riêng được ghi trong VALIDATION.md |
| Fixture Node/Rust/Edge | Config, credential dùng chung, IPC audio, theme, cue, ending và bảo mật; không suy ra tương thích App thực chỉ từ fixture |

Các hành vi âm thanh đã được kiểm tra ở mức chọn nguồn/phát media trong fixture;
chưa đo đầu ra loa hay Windows mixer. Xem chi tiết trong
[VALIDATION.md](docs/VALIDATION.md) và [SAO-THEME.md](docs/SAO-THEME.md).

## Cấu trúc project

```text
crates/agc-core/       Lõi Rust: config, credential, profile, quota, preview audio
src-tauri/            Launcher Tauri và các lệnh main-process
src/renderer/         Giao diện, theme, font, ảnh/video và audio bundled
src/native/           Splash, Settings, preload và bộ cài native
src/core/             Helper Node: config, media, credential, shutdown
src/integration/      Runtime giao diện và nhánh CDP thử nghiệm
scripts/              Build/check, cài/gỡ, audit media, sửa dữ liệu legacy
test/                 Test Node/Rust-peer và fixture giao diện Python
docs/                 Thiết kế, kiến trúc và kết quả kiểm chứng
release/              Launcher hiện tại và một bản dự phòng trong archive/
work/                 File tạm, ảnh kiểm tra và backup phát triển cần giữ
```

release/ và work/ không đưa vào Git. Cache build có thể tạo lại; không xóa source,
media bundled hay các backup khôi phục native. Test tạm tự dọn sau khi chạy.

Tài liệu thêm: [Kiến trúc](docs/ARCHITECTURE.md),
[Thiết kế SAO](docs/SAO-THEME.md), [Tài nguyên Plavsky](docs/PLAVSKY-ASSETS.md).

## Giấy phép

Mã nguồn dự án dùng [MIT](LICENSE). Font Rajdhani đi kèm
[giấy phép SIL OFL](src/renderer/fonts/Rajdhani-OFL.txt).
Tài nguyên anime/âm nhạc thuộc các chủ sở hữu tương ứng; không phải nội dung
nguyên gốc do dự án sáng tác.
