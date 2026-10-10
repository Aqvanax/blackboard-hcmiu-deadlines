# Blackboard HCMIU Deadlines → Google Calendar

[English](./README.md) · Tiếng Việt

Script nhỏ cho trang Calendar của Blackboard Learn trường HCMIU. Bấm một nút, script
lấy các deadline **chưa qua hạn** (deadline đã qua không bao giờ được xuất) rồi:

- **Xuất file (luôn dùng được):** tải file `.ics` chuẩn (RFC 5545) để nhập vào Google
  Calendar hay bất kỳ ứng dụng lịch nào, hoặc
- **Đồng bộ (tùy chọn):** ghi thẳng vào lịch **"Blackboard Deadlines"** của chính
  bạn trên Google Calendar — không phải nhập tay.

Mọi thứ chạy trong **trình duyệt của bạn**: không có server của tác giả, không
analytics, không thu thập dữ liệu, và không bao giờ hỏi mật khẩu Blackboard của bạn.
Script chỉ đọc cửa sổ 180 ngày tới (đổi được) và lọc bỏ mọi sự kiện đã qua hạn.

![Ảnh minh họa (giả): hai nút nổi và thông báo thành công trên trang Calendar (dữ liệu mẫu)](docs/screenshot-export.svg)

## 1. Cài đặt

Ba cách, cùng một mã nguồn đã build.

- Cách nhanh nhất: mở <https://aqvanax.github.io/blackboard-hcmiu-deadlines/> rồi
  kéo nút bookmarklet trên đó vào thanh dấu trang.

**Cách 1 — Extension trình duyệt** (không cần Tampermonkey)

1. `node build.js` — sinh ra `extension/bb.js`.
2. Chrome/Edge → `chrome://extensions` → bật **Developer mode** → **Load unpacked**
   → chọn [`extension/`](./extension/).
   Firefox → `about:debugging` → **Load Temporary Add-on** → chọn `manifest.json`.

Muốn đưa lên store để ai cũng cài bằng một nhấp chuột: hồ sơ Chrome Web Store đã
chuẩn bị sẵn — icon, promo tile, nội dung listing và checklist từng bước trong
[`store/README.md`](./store/README.md). Manifest **không xin quyền thừa**.

**Cách 2 — Tampermonkey** (dễ cập nhật nhất)

1. Cài [Tampermonkey](https://www.tampermonkey.net/) hoặc Violentmonkey.
2. Mở [`blackboard-deadlines.user.js`](./blackboard-deadlines.user.js), xem file
   **Raw**, rồi xác nhận cài.

**Cách 3 — Bookmarklet** (không cài gì)

1. Tạo bookmark mới → dán dòng `javascript:...` từ
   [`bookmarklet/bookmarklet.js`](./bookmarklet/bookmarklet.js) vào trường URL.
2. Ở trang Calendar Blackboard, bấm bookmark đó là nút hiện ra.
   - Không có gì xảy ra? CSP của trang có thể chặn inject script — dùng cách 1 hoặc 2.

Tự build từ nguồn: `node build.js` — không cần npm dependency.

## 2. Cách dùng

Chưa biết chọn đường nào? **[So sánh tất cả các cách](./docs/import-methods.vi.md)**
— gồm cả hai đường hiện chưa chạy được và lý do.

### A — Xuất `.ics`

1. Mở <https://blackboard.hcmiu.edu.vn/webapps/calendar/> và đăng nhập.
2. Bấm **"Xuất deadline (.ics)"** (nút nổi góc dưới phải). File
   `blackboard-deadlines-YYYY-MM-DD.ics` sẽ được tải về.
   - Không có deadline sắp tới → *"Không có deadline nào sắp tới."*
   - Hết phiên đăng nhập → *"Phiên đăng nhập có thể đã hết hạn…"*
3. Google Calendar → **Settings ⚙ → Import & export → Import**, chọn file và lịch
   đích, bấm **Import**.

Giờ đúng múi giờ Việt Nam: mỗi sự kiện là khối 30 phút **kết thúc chính xác tại hạn
nộp** (Google Calendar không nhận sự kiện độ dài 0); deadline cả ngày thành sự kiện
trọn ngày. Import lại cùng file sẽ **cập nhật** đúng sự kiện cũ thay vì nhân đôi
(UID cố định theo từng mục Blackboard).

### B — Đồng bộ thẳng vào Google Calendar

Trên trang Calendar Blackboard bấm **"Đồng bộ Google Calendar"** → trang sync liệt kê
deadline chưa qua hạn → bấm **"Đồng bộ vào Google Calendar"**. Lần đầu Google xin ủy
quyền một lần; các lần sau trang sync hiện *"Đồng bộ xong: tạo mới X, cập nhật Y."*
và popup kết quả tự đóng. Nếu trang chưa cập nhật kịp thì bấm **"Quay lại trang
đồng bộ"** trên popup, đường này luôn chạy. Sự kiện nằm trong lịch **"Blackboard
Deadlines" của chính bạn**, tự tạo ở lần đồng bộ đầu. Đồng bộ lại là cập nhật chứ
không nhân đôi; không có gì bị tự xóa.

Phần này cần một người (gọi là *người vận hành*) deploy relay một lần — Apps Script
và GitHub Pages đều miễn phí. Hướng dẫn đầy đủ:
**[docs/sync-setup.vi.md](./docs/sync-setup.vi.md)**. Ai không dùng đồng bộ vẫn dùng
được đầy đủ phần xuất `.ics`.

![Ảnh minh họa (giả): trang sync với dữ liệu mẫu](docs/screenshot-sync.svg)

## 3. Sao không làm thành một trang web luôn?

Câu hỏi hay gặp nhất, và câu trả lời thật là: **nửa Blackboard không làm được** từ
một trang web mà bạn chỉ cần ghé vào:

- **Feed lịch có sẵn của Blackboard là đường cụt ở đây.** Learn cấp được link
  "external calendar" cá nhân mà Google Calendar subscribe vào là tự refresh lấy —
  không cần extension, không cần code. Ở HCMIU link đó có thật nhưng trả về file
  `.ics` **trống trơn**, không có deadline nào. Chính đường cụt này là lý do tool
  này tồn tại.
- **Nửa Google thì giải được ngay trong trình duyệt.** Một trang tĩnh gọi được Google
  Calendar API trực tiếp; trang sync hiện tại làm đúng việc đó qua relay Apps Script.
- **Nửa Blackboard phải nhờ trường.** `blackboard.hcmiu.edu.vn` chạy Learn 3900, REST
  API công khai và luồng OAuth ba chân đều đang bật, endpoint lịch cũng có
  (`/learn/api/public/v1/calendars/items`). Nhưng mọi lệnh gọi đều cần một
  **Application Key do quản trị viên Blackboard của HCMIU đăng ký**
  (*Admin → REST API Integrations*). Chưa có nó thì mọi trang bên thứ ba đều nhận
  `401 API request is not authenticated.`
- **Vì vậy tool chạy _trên_ chính trang Blackboard**, dùng lại phiên đăng nhập bạn đã
  có. Nó không bao giờ thấy mật khẩu của bạn.
- **Việc dự án này sẽ không bao giờ làm:** hỏi tên đăng nhập và mật khẩu Blackboard
  của bạn. Làm vậy cần một server phát lại thông tin đăng nhập của bạn — đúng cái thứ
  mà thiết kế này tồn tại để tránh.

Nếu HCMIU đăng ký application key, làm một trang "kết nối hai tài khoản" sẽ rất đơn
giản; tới lúc đó, extension là con đường hợp lệ.

## 4. Giới hạn

- Endpoint `selectedCalendarEvents` **không phải API công khai** — đây là endpoint mà
  chính giao diện Blackboard gọi. Trường hoặc Blackboard đổi cấu hình thì tool có thể
  hỏng.
- **Chỉ có deadline** (bài tập, hạn nộp) — không có lịch học hay lịch thi.
- **Không tự chạy ngầm:** mỗi lần dùng phải mở Blackboard và bấm nút.
- **Không tự xóa sự kiện:** deadline bị xóa hoặc đổi giờ trên Blackboard vẫn giữ bản
  cũ trên Google Calendar cho tới khi bạn đồng bộ lại (đồng bộ lại cập nhật giờ) hoặc
  tự xóa — đồng bộ lại không xóa sự kiện đã biến mất.
- `SEQUENCE` trong `.ics` lấy theo phút hiện tại để bản import sau "mới hơn" bản
  trước. **Chưa kiểm chứng** Google Calendar có dùng giá trị này để cập nhật sự kiện
  trùng UID hay không — nếu bị trùng, xóa bản cũ rồi import lại.
- Phần xuất file là **bản chụp một lần**. Nếu trước đó bạn đã import cùng deadline
  theo cách khác thì có thể bị trùng — xóa bản cũ trước.
- Đồng bộ bật cửa sổ pop-up; hãy cho phép pop-up cho Blackboard.
- Đồng bộ gửi tiêu đề và giờ hạn nộp tới Apps Script relay; URL `/exec` mặc nhiên
  công khai — dùng token tùy chọn (xem tài liệu setup) nếu bạn thấy ngại.

## 5. Quyền riêng tư và bảo mật

- **Mọi thứ chạy trong trình duyệt của bạn.** Không có server của tác giả, không thu
  thập dữ liệu, không analytics, dự án không đặt cookie nào, không lưu gì trong
  trình duyệt.
- Script chỉ gọi `blackboard.hcmiu.edu.vn` (fetch cùng origin với
  `credentials: 'same-origin'`) và trang sync của bạn; chỉ trang sync gọi tiếp
  `script.google.com`. Không dùng `GM_xmlhttpRequest`.
- Đồng bộ ghi vào **lịch của chính bạn** bằng **ủy quyền Google của chính bạn**.
- Thông điệp **từ Blackboard** vào trang sync kiểm tra `event.origin`, cửa sổ gửi và
  cấu trúc thông điệp, không dùng `targetOrigin` kiểu wildcard.
- **Kết quả trả về từ popup** không kiểm tra được `event.origin` vì thẻ kết quả chạy
  trong iframe sandbox của Google với origin mờ (opaque), nên xác thực hoàn toàn bằng
  **nonce128-bit mỗi lần bấm** cộng kiểm tra cấu trúc, hoặc đọc lại từ `localStorage`
  trong trình duyệt của chính bạn. Link dự phòng bằng tay mang cùng kết quả trong
  chính URL của popup.
- **Khuyến khích đọc mã nguồn trước khi cài**, và không chia sẻ link feed `.ics` cá
  nhân của Blackboard — nó chứa toàn bộ lịch của bạn.

Bản chính sách cho store: [`privacy.html`](./privacy.html).

## 6. Tuyên bố

Dự án cá nhân, **không phải sản phẩm chính thức** của HCMIU hay Blackboard, không
liên kết, không được bảo trợ. **Không bảo hành** bất kỳ dạng nào; dùng tự chịu rủi ro.
Tool có thể ngừng hoạt động khi trường thay đổi cấu hình Blackboard.

## 7. Phát triển và giấy phép

**MIT** — xem [LICENSE](./LICENSE). Issues và pull request đều hoan nghênh.

```
npm test        # node build.js && node test/test.js — Node >= 18 thuần, không thư viện
node build.js   # tạo lại userscript, sync/core.js và extension/bb.js
```

| Đường dẫn | Vai trò |
| --- | --- |
| `src/core.js` | hàm thuần: lọc, múi giờ, escape, gập dòng, dựng ICS và nội dung Google |
| `src/userscript.body.js` | lớp mỏng DOM/fetch |
| `src/userscript.meta.js` | khối metadata userscript |
| `build.js` | ghép `src/` thành các file build |
| `sync/` | trang sync (`core.js` ở đây do build sinh ra — hãy sửa `src/core.js`) |
| `apps-script/` | relay đồng bộ |
| `extension/` | bọc MV3 (`bb.js` do build sinh ra) |
| `bookmarklet/` | loader bookmarklet |
| `store/` | hồ sơ submit Chrome Web Store |
| `test/` | bộ test, chỉ dữ liệu giả |
| `docs/` | hướng dẫn (cách import, cấu hình sync) và ảnh minh họa |
