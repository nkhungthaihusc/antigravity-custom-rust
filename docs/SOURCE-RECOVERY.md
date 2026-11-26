# Khôi phục source ngày 2026-11-26

Source được dựng lại từ commit `a2289df` trên GitHub và gói portable v0.5.0
đã phát hành. ZIP gốc được xác minh bằng SHA-256:

```text
512532617c0df59046077d0d9758f711db71d4a215d697a09a73b10eb1e71533
```

## Nguồn khôi phục

- `src/native`, `src/core`, `src/renderer`, `src/integration/runtime.js`,
  `assets/audio` và `scripts/native-install.cjs` được lấy trực tiếp từ runtime
  trong ZIP. Các file này có thể đối chiếu hash với bản đã phát hành.
- `docs/PORTABLE.md` lấy từ `HUONG-DAN.md` trong ZIP.
- Thay đổi Rust cho đường dẫn runtime portable, chẩn đoán `--check-package`,
  tên mặc định Pilot, script đóng gói/xác minh và regression tests được dựng lại
  từ các bản vá trong lịch sử chat, trên nền source GitHub.
- README được cập nhật lại theo hành vi portable và âm thanh hiện tại.

Không khẳng định các file dựng lại từ lịch sử giống từng byte với file đã xóa.
Log cũ, cache build và các file tạm không có trong GitHub/ZIP không được khôi phục.
Mật khẩu, profile Google và cấu hình cá nhân hiện tại không được đưa vào source.

## Các thay đổi đã phục hồi

- Launcher release dùng Node và script trong `runtime` cạnh EXE, không dùng
  đường dẫn máy build hoặc Node trên PATH; xóa biến Node kế thừa khi gọi bộ cài.
- Đóng gói Node 24.22.3 x64 có checksum cố định, license, native payload,
  media, hướng dẫn và SHA-256. Gói phát hành không chứa profile hay backup Google.
- Sửa splash Ready to Focus: kiểm tra readiness có timeout, polling để bù tín
  hiệu bị bỏ lỡ, lối vào App sau 15 giây nhưng vẫn yêu cầu xác thực.
- Gundam/Focus phát câu chiến đấu 2,3 giây khi vào App, nhỏ dần từ giây 1,3;
  nhạc nền tiếp tục song song cho tới lúc bàn giao giao diện App.
- Default tên người dùng là Pilot. Âm thanh và ending vẫn mặc định tắt như ZIP
  v0.5.0; bật/tắt trên máy người dùng là dữ liệu riêng, không phải thay đổi source.

## Kiểm chứng lại

Build release, kiểm tra cú pháp JavaScript, 33 test Node, 10 test core Rust và
1 test launcher Rust đã đạt. Fixture Edge đã kiểm tra nhạc chạy song song,
entry cue, ending, reduced motion, readiness không có quota và mất sự kiện ready.
Đây là fixture; không suy ra mọi luồng App thật từ các kết quả này.

Theo yêu cầu người dùng, Custom đã được gỡ khỏi App thật 2.35.1; archive khôi phục
khớp checksum gốc và executable không thay đổi. Cấu hình Custom riêng được giữ
ngoài repo. Không cài lại Custom trong quá trình phục hồi source.

Log và bản ZIP đã phát hành được lưu trong `work/` và `release/`, bị Git bỏ qua.
Các thay đổi source cần được người dùng review, commit rồi push lên GitHub.
