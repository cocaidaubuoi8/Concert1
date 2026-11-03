# 🎤 Concert Online

Game concert nhiều người chơi chạy thẳng trên trình duyệt.

## Chạy thử
```bash
npm install
npm start          # mở http://localhost:3000
```
Mở 2 tab để thấy nhiều người chơi cùng lúc. Đưa lên mạng: deploy thư mục này lên Render / Railway / Fly.io
(chạy `npm start`, tự dùng biến PORT; hệ thống phải hỗ trợ WebSocket).

## Cách chơi
- Tạo nhân vật (da, tóc, mắt, áo) → **Tham gia concert** → xuất hiện ở cổng.
- **WASD / bấm chuột**: đi lại • **bấm ghế hoặc E**: ngồi/đứng • **1–5**: quẩy • **Enter**: chat • **M**: tắt nhạc.
- Điểm ⭐: quẩy (+1/3s, +1 nếu ≥3 người cùng điệu), nhặt sao trên sàn (+5, sao vàng +15), có mặt (+1/20s), đổi chủ đề (+15).
- Cửa hàng: mũ, áo concert, kính/mặt, lightstick, cánh/áo choàng. Hồ sơ lưu trong `data/profiles.json`.

## Tùy chỉnh
- `public/shared.js`: vật phẩm + giá, danh sách chủ đề, thời lượng chủ đề, vị trí ghế.
- `public/scene.js`: hình ảnh từng chủ đề (màn LED, đèn, hiệu ứng). `public/audio.js`: nhạc từng chủ đề.
- `server.js`: luật tính điểm, sức chứa phòng (80 người/phòng, tự tạo phòng mới).

## Sân vận động & màn hình YouTube
- Mặt bằng 1920x1080: nền sân cỏ, sân khấu hình thang có giàn đèn và 2 chồng loa, màn LED lớn với khung video YouTube 16:9 ở giữa. Khán đài A (giữa dưới, 48 ghế), B và C là hình chữ nhật xoay chéo hướng về sân khấu (28 ghế mỗi bên). Tổng 104 ghế, mỗi phòng tối đa 80 người. Chỉnh ở `public/shared.js`.
- Màn hình phát YouTube qua IFrame API, **đồng bộ theo giờ server** nên mọi người xem cùng một đoạn.
- Nút 🎵 trên HUD: dán link YouTube để thêm vào hàng chờ, hoặc bấm "Bài tiếp". Hết bài hoặc video không cho nhúng thì tự chuyển bài.
- Danh sách phát mặc định nằm trong `server.js` (`DEFAULT_PLAYLIST`), sửa thành bài bạn muốn.
- Nếu máy chơi không tải được YouTube, game tự dùng màn LED vẽ sẵn và nhạc tổng hợp.
- Trình duyệt chỉ cho bật tiếng sau khi bấm chuột; nếu video chưa lên, bấm nút "Bấm để bật video & tiếng" trên màn hình.
