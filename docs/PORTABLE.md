# Antigravity Custom — Windows x64

Giải nén toàn bộ ZIP vào một thư mục có quyền ghi. Giữ thư mục `runtime` cạnh
`Antigravity Custom.exe`; không chạy EXE trực tiếp trong ZIP.

## Dùng lần đầu

1. Máy đã cài Antigravity **App 2.35.1 hoặc 2.34.0** có checksum được hỗ trợ.
   Antigravity IDE không được hỗ trợ. Bản App khác sẽ bị từ chối để tránh patch sai.
2. Đóng Antigravity App trước khi cài hoặc cập nhật native.
3. Mở `Antigravity Custom.exe`, tạo mật khẩu mới (ít nhất 8 ký tự), hoặc nhập
   mật khẩu Custom đã có trên máy đó.
4. Chọn theme, bật âm thanh nếu muốn, rồi bấm **Mở Antigravity**. Launcher tự
   kiểm tra và cài/cập nhật tích hợp. Có thể bấm **Cài tích hợp native** trong
   phần Bảo mật & Mật khẩu.
5. Xác thực splash trong App rồi bấm **Bắt đầu**. Sau lần cài này có thể mở
   Antigravity App trực tiếp.

Không cần clone source, cài Rust, Cargo, Node.js hay npm. Node runtime đã đi kèm.
Launcher cần Microsoft Edge WebView2 Runtime; nếu máy chưa có, cài từ Microsoft:
https://developer.microsoft.com/microsoft-edge/webview2/

Launcher và native dùng chung dữ liệu Custom trên máy hiện tại, không lưu mật
khẩu vào ZIP. Mỗi bên yêu cầu xác thực phiên riêng. Người dùng mới dùng tên
hiển thị mặc định “Pilot”; nhạc mặc định tắt và có thể bật trong cài đặt.

## Cập nhật và khôi phục

Tải ZIP mới, giải nén đầy đủ sang thư mục mới, đóng App và mở launcher mới.
Dữ liệu Custom được giữ ở thư mục dữ liệu người dùng, không bị thay bằng cấu hình
của người phát hành. Nếu App vừa tự cập nhật sang bản chưa hỗ trợ, launcher sẽ
từ chối patch; hãy chờ bản Custom tương thích.

Để gỡ native: đóng App, mở launcher, xác thực, vào Bảo mật & Mật khẩu và chọn
**Khôi phục splash gốc**. Bộ cài giữ bản sao app.asar để khôi phục. Không sửa file
Antigravity.exe hoặc profile Google. Không cần chạy bằng quyền Administrator
với bản App cài mặc định trong tài khoản người dùng.

Giữ gói launcher để quản lý/gỡ về sau. Việc xóa thư mục launcher không tự gỡ native.

## Kiểm tra gói

`SHA256SUMS.txt` liệt kê hash các file trong gói. Bên cạnh ZIP phát hành có file
`.sha256` để kiểm tra tải xuống. File `.exe` hiện chưa được ký mã số.
Tùy cấu hình Windows, SmartScreen có thể yêu cầu xác nhận nguồn tải.

Chẩn đoán chỉ đọc từ PowerShell, không cài/gỡ hoặc đọc mật khẩu:

```powershell
& '.\Antigravity Custom.exe' --check-package
```

## Thành phần và bản quyền

Mã dự án theo LICENSE đi kèm. Node.js có giấy phép trong `runtime/node/LICENSE`
và được tải từ https://nodejs.org/dist/; font Rajdhani có SIL OFL trong
`runtime/src/renderer/fonts/Rajdhani-OFL.txt`.
Tài nguyên anime và âm nhạc thuộc chủ sở hữu tương ứng. Gói cộng đồng này không
do Google phát hành và không chứa Antigravity App, app.asar hay mã nguồn Google.
