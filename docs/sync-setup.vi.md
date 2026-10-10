# Cấu hình đồng bộ (người vận hành, làm một lần)

[English](./sync-setup.md) · Tiếng Việt

Đồng bộ thẳng vào Google Calendar cần một người — gọi là *người vận hành* — deploy
relay một lần. Mọi người còn lại chỉ bấm nút. Apps Script và GitHub Pages đều miễn
phí. Nếu bạn chỉ cần xuất `.ics` thì bỏ qua toàn bộ trang này.

## 1. Deploy relay

1. Mở <https://script.new> (đăng nhập bằng tài khoản Google sẽ giữ script), dán
   [`../apps-script/Code.gs`](../apps-script/Code.gs) rồi **Save**. Không cần bật
   thêm service nào: script gọi thẳng Calendar API qua `UrlFetchApp` bằng token OAuth
   của chính nó.
2. *Deploy → New deployment → **Web app***:
   - **Execute as: User accessing the app**
   - **Who has access: Anyone**
   - **Deploy** → copy URL kết thúc bằng `/exec`.

`Execute as: User accessing the app` là mục quan trọng nhất: nó làm relay chạy dưới
danh nghĩa người đang bấm, nên mỗi người ghi vào lịch của chính mình. Không cần
Client ID, không có giới hạn 100 test user, không phải chờ xác minh OAuth — chỉ có
màn hình đồng ý một lần mà mỗi người tự bấm trong popup.

## 2. Đưa trang sync lên mạng

Publish repo bằng GitHub Pages: *Settings → Pages → Deploy from a branch →
`master` / root* (nhánh mặc định của repo này là `master`, không phải `main`). Kết quả
là `https://<user-của-bạn>.github.io/<repo>/sync/`.

## 3. Cấu hình, build, cài lại

1. Đặt `RELAY_URL` trong [`../sync/sync.js`](../sync/sync.js) thành URL `/exec` ở bước 1.
2. Đặt `BB_CONFIG.SYNC_PAGE_URL` trong
   [`../src/userscript.body.js`](../src/userscript.body.js) đúng URL trang sync của bạn.
3. `node build.js`, rồi cài lại hoặc nạp lại cách cài bạn đang dùng.

Repo này đã có sẵn giá trị chạy được cho deployment của tác giả; bạn chỉ cần các bước
trên khi fork sang relay và Pages của riêng mình.

## 4. Lần chạy đầu

Trên trang Calendar Blackboard bấm **"Đồng bộ Google Calendar"**, rồi bấm
**"Đồng bộ vào Google Calendar"** ở trang vừa mở. Một popup xuất hiện:

- **Lần đầu:** Google xin mỗi người ủy quyền script một lần. Màn hình *"This app
  isn't verified" → Advanced → Go to (unsafe)* là bình thường với script cá nhân nhỏ
  — người vận hành có thể gửi xác minh sau. Bấm Allow, đóng popup, bấm Đồng bộ lần nữa.
- **Các lần sau:** popup hiện *"Đồng bộ xong: tạo mới X, cập nhật Y."* rồi tự đóng.

## Ghi chú

- Trang sync gửi sự kiện qua **popup form POST** — điều hướng thật nên trình duyệt
  mang theo phiên Google của bạn; `fetch` cross-origin sẽ bị chặn.
- **Đồng bộ lại an toàn:** mỗi sự kiện có ID cố định nên chạy lại là cập nhật chứ
  không nhân đôi (insert → 409 → patch, nằm trong script). Không có gì bị tự xóa.
- **Script xin quyền toàn bộ lịch** (`https://www.googleapis.com/auth/calendar`) vì
  dịch vụ Calendar của Apps Script không có scope hẹp hơn. Thực tế nó chỉ tạo và cập
  nhật lịch "Blackboard Deadlines", nhưng lời mời đồng ý của Google rộng hơn — đó là
  màn hình của Google, không phải của mình.
- **Chống spam tùy chọn:** đặt Script Property `token` trong Apps Script
  (*Project Settings → Script properties*) và điền cùng giá trị vào `RELAY_TOKEN`
  trong [`../sync/sync.js`](../sync/sync.js).
- Lỗi từng sự kiện được ghi bằng `console.error` — xem trong Apps Script ở mục
  **Executions**.
