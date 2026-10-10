# Hồ sơ submit Chrome Web Store

Gói upload đã đóng sẵn (cần `zip`): sau khi `node build.js`:

```bash
./store/make-zip.sh        # tạo store/blackboard-deadlines-extension.zip
```

Asset tĩnh đã có trong repo: icon `extension/icons/icon128.png`,
promo tile `store/promo-440x280.png`, privacy policy `privacy.html`.

## Việc phải làm tay (script không thay được)

1. Đăng ký tài khoản nhà phát triển một lần, phí 5 USD:
   <https://chrome.google.com/webstore/dev/console> (cần thẻ Visa/Master,
   xác minh danh tính hồ sơ Google).
2. **New item** → tải lên `store/blackboard-deadlines-extension.zip`.
3. Dán nội dung listing từ [listing.md](./listing.md): Name, Short description,
   Detailed description (EN chính, thêm ngôn ngữ Vietnamese bằng bản dịch).
4. Graphics:
   - Icon: dashboard tự lấy 128x128 từ manifest.
   - Promo tile: tải `store/promo-440x280.png`.
   - Screenshot (bắt buộc tối thiểu 1 ảnh, 1280x800 hoặc 640x400): mở
     <https://blackboard.hcmiu.edu.vn/webapps/calendar/> sau khi cài extension,
     thấy 2 nút nổi, chụp lại; che tên môn và mọi dữ liệu cá nhân.
5. Tab **Privacy**: dán Privacy policy URL
   `https://aqvanax.github.io/blackboard-hcmiu-deadlines/privacy.html`
   và trả lời form dữ liệu theo mục "Privacy tab" trong [listing.md](./listing.md).
6. Tab **Distribution**: công khai (Public), quốc gia All hoặc chỉ VN.
7. **Submit for review**.

## Sau khi duyệt

- Dashboard hiển thị link store, ai cũng cài bằng một nhấp chuột.
- Cập nhật: sửa code → `node build.js` → tăng `version` trong
  `extension/manifest.json` → `./store/make-zip.sh` → upload zip mới →
  Submit for review. Review bản cập nhật thường nhanh hơn bản đầu.
- Thời gian duyệt thường 1 đến 3 ngày làm việc.

## Ghi ý

- Màn cảnh báo "unverified" khi ủy quyền Apps Script là của Google cho script
  cá nhân, độc lập với quy trình duyệt extension, giữ nguyên.
- Extension không chứa mã chạy từ xa, mọi thứ nằm trong zip, hợp quy định CWS.
