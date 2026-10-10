# Nội dung dán vào Chrome Web Store Developer Dashboard

## Name (giới hạn 45 ký tự)

```
Blackboard HCMIU Deadlines
```

## Short description (giới hạn 132 ký tự)

```
Export upcoming Blackboard HCMIU deadlines to .ics and sync them into your own Google Calendar in one click.
```

## Detailed description — English (ngôn ngữ chính)

```
Blackboard HCMIU Deadlines puts your upcoming assignments where you will actually see them.

WHAT IT DOES
- One click exports every upcoming deadline from the Blackboard HCMIU calendar as a standard .ics file (RFC 5545) that imports into any calendar app.
- One click syncs the same deadlines into a Google Calendar named "Blackboard Deadlines" that belongs to you. Running it again updates existing events instead of duplicating them.
- Deadlines appear as 30-minute blocks that end exactly at the due time; all-day deadlines become full-day events. Times are correct for Vietnam (Asia/Ho_Chi_Minh).

HOW YOUR DATA FLOWS
- There is no server of ours: deadlines travel from your browser to Google only (Apps Script relay and Calendar API), under your own Google sign-in, into your own calendar.
- The extension runs only on blackboard.hcmiu.edu.vn/webapps/calendar/ and requests no extra permissions, no background access, no API keys.
- The first sync shows a one-time Google consent screen for a personal script. The "unverified" warning is expected: choose Advanced, then Allow if you trust the open source code, or skip sync and use the .ics export instead.

INSTALL
Click "Add to Chrome", open the Blackboard HCMIU calendar page, and two floating buttons appear at the bottom right: "Xuất deadline (.ics)" and "Đồng bộ Google Calendar".

OPEN SOURCE AND DISCLAIMER
MIT licensed. Read the source before installing: github.com/Aqvanax/blackboard-hcmiu-deadlines
Not affiliated with Blackboard or HCMIU. Privacy policy: aqvanax.github.io/blackboard-hcmiu-deadlines/privacy.html
```

## Detailed description — Tiếng Việt (thêm ngôn ngữ Vietnamese)

```
Blackboard HCMIU Deadlines đưa deadline sắp tới của bạn vào chỗ thật sự nhìn thấy.

TÍNH NĂNG
- Một bấm xuất toàn bộ deadline sắp tới từ lịch Blackboard HCMIU ra file .ics chuẩn (RFC 5545), nhập được vào mọi ứng dụng lịch.
- Một bấm đồng bộ cùng dữ liệu vào lịch "Blackboard Deadlines" trên Google Calendar của chính bạn. Bấm lại là cập nhật sự kiện cũ, không nhân đôi.
- Deadline hiện là khối 30 phút kết thúc đúng thời điểm nộp; deadline cả ngày thành sự kiện tròn ngày. Giờ đúng múi giờ Việt Nam.

DỮ LIỆU ĐI ĐÂU
- Không có máy chủ của dự án: dữ liệu chỉ đi từ trình duyệt tới Google (relay Apps Script và Calendar API) bằng tài khoản Google của bạn, ghi vào lịch của bạn.
- Extension chỉ chạy trên blackboard.hcmiu.edu.vn/webapps/calendar/, không xin quyền truy cập trang khác, không chạy nền.
- Lần đồng bộ đầu hiện màn đồng ý Google cho script cá nhân; cảnh báo "unverified" là bình thường: chọn Advanced rồi Allow nếu bạn tin mã nguồn mở, hoặc bỏ đồng bộ, dùng xuất .ics.

CÀI ĐẶT
Bấm "Add to Chrome", mở trang lịch Blackboard HCMIU, hai nút nổi hiện ở góc dưới bên phải.

NGUỒN MỞ VÀ TUYÊN TỪ CHỐI
Giấy phép MIT. Đọc mã nguồn trước khi cài: github.com/Aqvanax/blackboard-hcmiu-deadlines
Không liên kết với Blackboard hay HCMIU. Chính sách bảo mật: aqvanax.github.io/blackboard-hcmiu-deadlines/privacy.html
```

## Category và ngôn ngữ store

- Category: **Productivity** (hoặc Tools).
- Store languages: English (chính) + Vietnamese.

## Graphics

- Icon: lấy từ manifest (`extension/icons/icon128.png`).
- Promo tile 440x280: `store/promo-440x280.png`.
- Screenshot bắt buộc: 1 ảnh tối thiểu, 1280x800 hoặc 640x400, chụp trang
  Calendar Blackboard có 2 nút nổi, che dữ liệu cá nhân.

## Privacy tab

- Privacy policy URL:
  `https://aqvanax.github.io/blackboard-hcmiu-deadlines/privacy.html`
- Single purpose (mục đích duy nhất):
  `Adds two buttons to the Blackboard HCMIU calendar page to export upcoming deadlines as .ics and to sync them into the user's own Google Calendar.`
- Form dữ liệu, trả lời trung thực:
  - Collect or transmit user data to the developer? **No** (không có máy chủ,
    không analytics, không cookie).
  - Dữ liệu xử lý trên thiết bị: nội dung trang Blackboard (tên deadline, thời
    gian) mà người dùng đang mở.
  - Truyền cho bên thứ ba: chỉ tới Google (Apps Script relay + Calendar API)
    khi người dùng bấm đồng ý, để ghi vào chính lịch của họ, không dùng cho mục
    đích khác.
  - Host permission justification: nội dung script chỉ khớp
    `blackboard.hcmiu.edu.vn/webapps/calendar/*`, đúng trang cần đọc deadline.
