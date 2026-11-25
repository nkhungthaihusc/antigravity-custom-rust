# Theme SAO và bảo toàn Gundam

## Thiết kế và tài nguyên

SAO I/II gồm Aincrad, ALfheim, Phantom Bullet, Calibur và Mother’s Rosario.
Màu và typography là diễn giải riêng; không phải bộ font/bảng màu chính thức.
Nguồn đối chiếu: https://www.swordart-onlineusa.com/chronology/

Một launcher Rust + Tauri chứa tất cả theme. Splash SAO căn giữa, chữ/nút nổi
trên video, không có hộp nền. Font Rajdhani và giấy phép SIL OFL nằm trong
src/renderer/fonts; Segoe UI hỗ trợ nội dung tiếng Việt. Giảm chuyển động tắt
animation và dùng poster thay video SAO mặc định.

Khung Áp dụng/Nghe thử SAO chỉ hiện khi chọn SAO. Áp dụng SAO không ghi đè cấu
hình splash/wallpaper, âm lượng, soundEnabled, track hay cue Gundam.

## Âm thanh hiện tại

Tài nguyên trong src/renderer/audio được nhúng vào launcher và sao chép vào
runtime native. File nguồn ở Download không phải phụ thuộc lúc chạy.

| File | Vai trò |
| --- | --- |
| swordland.mp3 | Nhạc SAO từ bản người dùng cung cấp, khoảng 198 giây |
| sao-link-start.mp3 | Cue sau xác thực thành công, khoảng 4,8 giây |
| gundam-background.mp3 | Nhạc nền cũ GUNDAM BUILD FIGHTERS — Yuki Hayashi, 296,98 giây |
| gundam-gp-base.mp3 | Chỉ câu thiết lập GP Base, 3,10 giây, khi bấm Bắt đầu |
| gundam-session-end.mp3 | File âm kết thúc Gundam cũ, khoảng 4 giây |

Hangar, Graphite và Paper dùng đúng nhạc nền Gundam, không dùng startup track
46 giây thay nhạc nền. Nhạc riêng theo family nằm trong splash.themeAudioIds;
nhạc legacy toàn cục tiếp tục ưu tiên cho theme không phải SAO. Nhạc hạ xuống
28% mức đang đặt khi cue phát, và dừng khi vào App. Không có nhạc trong phiên.

GP Base lấy 1,20–4,30 giây của startup gốc, fade vào 20 ms/ra 50 ms. Không
phát cả cinematic track khi đã có cue Bắt đầu. SAO không nhận GP Base.

## Đóng phiên

Gundam/Graphite/Paper có ending khi rg.shutdownEnabled bật. Handler gắn ngay
tại splash, nên đóng trước đăng nhập cũng có ending. Nó dừng audio/view trước,
hiển thị ending và chờ khoảng 4 giây sau khi tải xong; có timeout dự phòng và
chống lặp close. Âm kết thúc ưu tiên cue riêng, rồi endAudioId/file kết thúc cũ,
không phụ thuộc audioMode hay startup track. SAO ending riêng luôn im lặng,
khoảng 2,4 giây hoặc 300 ms khi giảm chuyển động.

## Bảo mật và kiểm chứng

Media import được sao chép vào assets bằng UUID. IPC preview_audio yêu cầu
xác thực, không nhận đường dẫn tùy ý; main kiểm tra UUID, định dạng/chữ ký,
canonical path trong assets và giới hạn 100 MB. Renderer phát Blob cục bộ rồi
thu hồi URL; CSP chỉ thêm blob: cho media-src. Preset không xuất media riêng,
tên cá nhân, mật khẩu hay đường dẫn. Installer giữ kiểm tra phiên bản,
backup/restore app.asar và không đóng App đang chạy để cập nhật.

- npm run check và 29 test Node qua; bộ test Rust bao phủ config/auth/IPC audio.
- test/ui-preview.py kiểm tra riêng ba preset, audio riêng/bundled, GP Base,
  ducking, dừng nhạc, ending và reduced motion bằng fixture Edge.
- Test close bằng EventEmitter bao phủ trước đăng nhập, timer sau tải view,
  chống lặp và cleanup. Decoder xác nhận GP Base 136.710 / 44.100 = 3,10 giây.
- Google App 2.35.1 thực: đã thấy splash SAO, đăng nhập, HUD và Settings → Custom.
  Với Focus Graphite, đã đóng ngay tại splash, thấy ending rồi tự đóng sau
  khoảng 4 giây. Chưa đo âm thanh đầu ra loa. Lịch sử khác: docs/VALIDATION.md.

npm run audit:media kiểm tra hash source/native, media import và tham chiếu
Download. python test/ui-preview.py tạo ảnh trong work/; cần Playwright Python
và Edge. Giữ src/scripts/crates: installer hiện dùng Node và source checkout.
