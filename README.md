# Blackboard HCMIU Deadlines → Google Calendar

<a id="top"></a>

[English](#english) | [Tiếng Việt](#tiếng-việt)

---

## English

### 1. What it does

A userscript (Tampermonkey/Violentmonkey) for the Blackboard Learn calendar at HCMIU.
Press a button and it collects your **upcoming deadlines** (past ones are never
exported) and either:

- **Phase 1 (required):** downloads an `.ics` file you import into Google Calendar, or
- **Phase 2 (optional):** writes them straight into a private Google Calendar named
  **"Blackboard Deadlines"** through a static page on GitHub Pages — no manual import.

Everything runs in **your browser**. There is no author server, no analytics, and no
data collection. The script only reads deadlines for the next 180 days (configurable)
and filters out anything already past its end time.

![Mock screenshot: floating buttons and success toast on the Blackboard calendar (fake data)](docs/screenshot-export.svg)

### 2. Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey).
2. Install the script: open [`blackboard-deadlines.user.js`](./blackboard-deadlines.user.js)
   in this repo, view the **Raw** file, and confirm the install in Tampermonkey.
   - Building from source (optional): `node build.js` — no npm dependencies.
3. Phase 2 additionally needs a hosted sync page and a Google Client ID — see
   [Usage B](#3-usage). Phase 1 needs none of that.

### 3. Usage

#### A — One-time `.ics` export (Phase 1)

1. Open <https://blackboard.hcmiu.edu.vn/webapps/calendar/> and log in.
2. Click **"Xuất deadline (.ics)"** (floating, bottom-right).
   File `blackboard-deadlines-YYYY-MM-DD.ics` downloads.
   - No upcoming deadlines? You'll see: *"Không có deadline nào sắp tới."*
   - Logged out? *"Phiên đăng nhập có thể đã hết hạn…"*
3. In Google Calendar: **Settings ⚙ → Import & export → Import**, pick the file,
   choose a calendar, press **Import**.
4. Times are correct for Vietnam: each event is a 30-minute block that **ends exactly
   at the deadline** (Google Calendar rejects zero-length events). All-day deadlines
   become full-day events.

Re-importing the same file later **updates** the same events instead of duplicating
them (fixed UID per Blackboard item).

#### B — Direct Google Calendar sync (Phase 2, optional)

Do this only after Phase 1 works for you. One-time setup:

1. **Host the sync page.** Publish this repo on GitHub Pages
   (*Settings → Pages → Deploy from a branch → `main` / root*). Your page will be
   `https://<your-user>.github.io/<repo>/sync/`.
2. **Create a Google Client ID.** In [Google Cloud Console](https://console.cloud.google.com/):
   create a project → enable **Google Calendar API** → *OAuth consent screen*
   (External, add your Google account as a test user) → *Credentials → Create
   Credentials → OAuth client ID → **Web application*** → add the sync URL from
   step 1 to **Authorized JavaScript origins** → copy the Client ID.
   Only a Client ID is used (token flow, no client secret — never commit one).
3. **Configure, build, install.**
   - Open the sync page and paste your Client ID the first time it asks (stored only in your browser).
   - Set `BB_CONFIG.SYNC_PAGE_URL` in [`src/userscript.body.js`](./src/userscript.body.js)
     to your sync URL, then run `node build.js` and reinstall the userscript.
4. **Use it.** On the Blackboard calendar click **"Đồng bộ Google Calendar"** →
   log in to Google → grant the permission → the page lists your upcoming deadlines
   and writes them to the **"Blackboard Deadlines"** calendar. Results
   (*created / updated / failed*) are shown on the sync page and back on Blackboard.

![Mock screenshot: sync page with fake deadlines](docs/screenshot-sync.svg)

Notes:

- **Scope:** the page asks only for
  `https://www.googleapis.com/auth/calendar.app.created` — checked against Google's
  scope list: *"Make secondary Google calendars, and see, create, change, and delete
  events on them"*. It cannot touch your existing calendars; no broader scope is used.
- Because that narrow scope cannot list calendars, the sync page remembers the id of
  the calendar it created in your browser's `localStorage` (nothing else is stored).
  If you clear site data, a second calendar with the same name may be created — delete
  the extra one in Google Calendar.
- **OAuth testing mode:** an unverified app in *Testing* allows **at most 100 test
  users** added manually; wider use requires Google's verification process. Users who
  can't use Phase 2 can still fully use Phase 1.

### 4. Limitations

- The `selectedCalendarEvents` endpoint is **not a public API**. It is what the
  Blackboard web UI itself calls; if the school or Blackboard changes its
  configuration, the tool may break.
- **Deadlines only** (assignments/due dates) — no class schedule, no exam timetable.
- **No background job:** nothing runs automatically; open Blackboard and press the
  button each time.
- Phase 1 is a **one-time snapshot**. If you previously imported the same deadlines
  another way (e.g. Blackboard's own feed), you may get duplicates — delete the old
  entries first.
- **Nothing is ever deleted automatically.** If a deadline is deleted or its time is
  changed on Blackboard, the copy in Google Calendar stays until you remove or
  re-import it. Re-importing / re-syncing updates times but does not delete events
  that vanished from Blackboard.
- The `.ics` `SEQUENCE` field is set to the current minute so a later import looks
  "newer" than an earlier one. **Not verified** that Google Calendar uses it to update
  existing entries — if duplicates appear, delete the old ones and import again.
- Phase 2 pop-up windows may be blocked by the browser — allow pop-ups for Blackboard.
- Google may require an OAuth verification review before the sync page can be used
  by people outside your test list.

### 5. Privacy & Security

- **Everything runs in your browser.** No author server, no data collection, no
  tracking, no cookies set by this project.
- The script calls only: `blackboard.hcmiu.edu.vn` (same-origin `fetch` with
  `credentials: 'same-origin'`), `accounts.google.com`, `www.googleapis.com`, and your
  sync page. It never uses `GM_xmlhttpRequest`.
- It **never reads cookies, never stores passwords, tokens or your Blackboard
  account.** The Google access token lives in memory only; the sync page stores only
  the id of the calendar it created.
- Phase 2 exchanges data with `postMessage`: **both sides verify `event.origin`**
  (and the sending window), validate the message schema, never use `targetOrigin "*"`,
  and never put event data in a URL.
- Phase 2: Google issues the token **to your own browser session**. You can revoke it
  anytime under *Google Account → Security → Third-party access*.
- **Read the source before installing**, and never share your personal Blackboard
  `.ics` feed link — it contains your schedule.

### 6. Disclaimer

Personal, unofficial project. Not affiliated with, endorsed by, or supported by
HCMIU or Blackboard. **No warranty** of any kind; use at your own risk. It may stop
working when the university changes its Blackboard setup.

### 7. Contributing & License

- **MIT** — see [LICENSE](./LICENSE). Issues and pull requests are welcome.
- Development: `node build.js` regenerates the userscript; `npm test`
  (or `node build.js && node test/test.js`) runs the Node test suite — plain Node ≥ 18,
  **no dependencies, no test framework**.
- Layout: `src/core.js` (pure functions: filtering, time zones, escaping, line
  folding, ICS/Google payloads), `src/userscript.body.js` (DOM/fetch thin layer),
  `sync/` (Phase 2 page), `test/test.js` (fake data only), `build.js` (concatenation).

[↑ Top](#top) · [Tiếng Việt](#tiếng-việt)

---

## Tiếng Việt

### 1. Tool làm gì

Userscript (Tampermonkey/Violentmonkey) cho trang Calendar của Blackboard Learn trường
HCMIU. Bấm một nút, script lấy các deadline **chưa qua hạn** (deadline đã qua không bao
giờ được xuất) rồi:

- **Giai đoạn 1 (bắt buộc):** tải file `.ics` để bạn import vào Google Calendar, hoặc
- **Giai đoạn 2 (tùy chọn):** ghi thẳng vào lịch riêng **"Blackboard Deadlines"**
  thông qua trang tĩnh trên GitHub Pages — không cần import thủ công.

Mọi thứ chạy trong **trình duyệt của bạn**. Không có server của tác giả, không có
analytics, không thu thập dữ liệu. Script chỉ đọc cửa sổ 180 ngày tới (đổi được) và
lọc mọi sự kiện đã qua hạn.

![Ảnh minh họa (giả): hai nút nổi và thông báo thành công trên trang Calendar (dữ liệu mẫu)](docs/screenshot-export.svg)

### 2. Cài đặt

1. Cài [Tampermonkey](https://www.tampermonkey.net/) (hoặc Violentmonkey).
2. Cài script: mở [`blackboard-deadlines.user.js`](./blackboard-deadlines.user.js)
   trong repo, xem file **Raw**, rồi xác nhận cài trong Tampermonkey.
   - Tự build từ nguồn (không bắt buộc): `node build.js` — không cần npm dependency.
3. Giai đoạn 2 cần thêm trang sync được hosted và Google Client ID — xem
   [Cách dùng B](#3-cách-dùng). Giai đoạn 1 không cần gì thêm.

### 3. Cách dùng

#### A — Xuất `.ics` một lần (Giai đoạn 1)

1. Mở <https://blackboard.hcmiu.edu.vn/webapps/calendar/> và đăng nhập.
2. Bấm **"Xuất deadline (.ics)"** (nút nổi góc dưới phải). File
   `blackboard-deadlines-YYYY-MM-DD.ics` sẽ được tải về.
   - Không có deadline sắp tới? Thông báo: *"Không có deadline nào sắp tới."*
   - Hết phiên đăng nhập? *"Phiên đăng nhập có thể đã hết hạn…"*
3. Trên Google Calendar: **Settings ⚙ → Import & export → Import**, chọn file, chọn
   lịch đích, bấm **Import**.
4. Giờ đúng múi giờ Việt Nam: mỗi sự kiện là khối 30 phút **kết thúc chính xác tại
   hạn nộp** (Google Calendar không nhận sự kiện độ dài 0). Deadline cả ngày thành
   sự kiện trọn ngày.

Import lại cùng file sau này sẽ **cập nhật** đúng các sự kiện cũ thay vì nhân đôi
(UID cố định theo từng mục Blackboard).

#### B — Đồng bộ thẳng vào Google Calendar (Giai đoạn 2, tùy chọn)

Chỉ làm sau khi Giai đoạn 1 đã chạy ổn với bạn. Cấu hình một lần:

1. **Đưa trang sync lên mạng.** Publish repo này bằng GitHub Pages
   (*Settings → Pages → Deploy from a branch → `main` / root*). Trang của bạn là
   `https://<user-của-bạn>.github.io/<repo>/sync/`.
2. **Tạo Client ID của Google.** Trong [Google Cloud Console](https://console.cloud.google.com/):
   tạo project → bật **Google Calendar API** → *OAuth consent screen* (External, thêm
   tài khoản Google của bạn vào danh sách test user) → *Credentials → Create
   Credentials → OAuth client ID → **Web application*** → thêm URL trang sync ở bước 1
   vào **Authorized JavaScript origins** → copy Client ID.
   Chỉ dùng Client ID (luồng token, **không** dùng client secret — tuyệt đối không
   commit secret).
3. **Cấu hình, build, cài lại.**
   - Mở trang sync và dán Client ID khi được hỏi lần đầu (chỉ lưu trong trình duyệt của bạn).
   - Đặt `BB_CONFIG.SYNC_PAGE_URL` trong [`src/userscript.body.js`](./src/userscript.body.js)
     đúng URL trang sync, chạy `node build.js` rồi cài lại userscript.
4. **Dùng.** Trên trang Calendar Blackboard bấm **"Đồng bộ Google Calendar"** → đăng
   nhập Google → đồng ý quyền → trang liệt kê deadline chưa qua hạn và ghi vào lịch
   **"Blackboard Deadlines"**. Kết quả (*tạo mới / cập nhật / lỗi*) hiện trên trang
   sync và quay lại hiện trên Blackboard.

![Ảnh minh họa (giả): trang sync với dữ liệu mẫu](docs/screenshot-sync.svg)

Ghi chú:

- **Scope:** trang chỉ xin quyền
  `https://www.googleapis.com/auth/calendar.app.created` — đã kiểm tra trong danh sách
  scope của Google: *"Make secondary Google calendars, and see, create, change, and
  delete events on them"*. Quyền này **không với tới các lịch sẵn có** của bạn; không
  dùng quyền rộng hơn.
- Vì scope hẹp không cho liệt kê lịch, trang sync ghi **id của lịch đã tạo** vào
  `localStorage` của trình duyệt (không lưu gì khác). Nếu bạn xóa dữ liệu site, một
  lịch trùng tên có thể được tạo thêm — hãy xóa lịch thừa trong Google Calendar.
- **Chế độ OAuth Testing:** app chưa xác minh ở chế độ *Testing* chỉ tối đa **100 test
  user** thêm thủ công; dùng rộng hơn cần qua quy trình xác minh OAuth của Google.
  Người chưa dùng được Giai đoạn 2 vẫn dùng được đầy đủ Giai đoạn 1.

### 4. Giới hạn

- Endpoint `selectedCalendarEvents` **không phải API công khai** — đây là endpoint mà
  chính giao diện Blackboard gọi. Blackboard hoặc trường đổi cấu hình thì tool có thể
  hỏng.
- **Chỉ có deadline** (bài tập, hạn nộp) — không có lịch học hay lịch thi.
- **Không tự chạy ngầm:** mỗi lần dùng phải mở Blackboard và bấm nút.
- Cách A là **bản chụp một lần**. Nếu trước đó bạn đã import cùng deadline theo cách
  khác (vd: feed của Blackboard) thì có thể bị trùng — xóa bản cũ trước khi import.
- **Không tự xóa sự kiện:** deadline bị xóa hoặc đổi giờ trên Blackboard sẽ *không*
  tự biến mất/cập nhật trên Google Calendar cho tới khi bạn import hoặc đồng bộ lại —
  và dù đồng bộ lại, sự kiện biến mất khỏi Blackboard cũng không bị xóa ở Google.
- `SEQUENCE` trong `.ics` lấy theo phút hiện tại để bản import sau "mới hơn" bản
  trước. **Chưa kiểm chứng** Google Calendar có dùng giá trị này để cập nhật sự kiện
  trùng UID hay không — nếu bị trùng, xóa bản cũ rồi import lại.
- Trang sync bật cửa sổ mới — trình duyệt có thể chặn pop-up; hãy cho phép pop-up
  cho Blackboard.
- Google có thể yêu cầu xác minh OAuth trước khi người ngoài danh sách test dùng
  được trang sync.

### 5. Quyền riêng tư và bảo mật

- **Mọi thứ chạy trong trình duyệt của bạn.** Không có server của tác giả, không thu
  thập dữ liệu, không analytics, dự án này không đặt cookie nào.
- Script chỉ gọi các domain: `blackboard.hcmiu.edu.vn` (fetch cùng domain với
  `credentials: 'same-origin'`), `accounts.google.com`, `www.googleapis.com` và trang
  sync của bạn. Không dùng `GM_xmlhttpRequest`.
- **Không đọc cookie, không lưu mật khẩu, không lưu token hay tài khoản Blackboard.**
  Token Google chỉ nằm trong RAM; trang sync chỉ lưu id của lịch do chính nó tạo.
- Giai đoạn 2 trao đổi dữ liệu qua `postMessage`: **cả hai phía đều kiểm tra
  `event.origin`** (và cửa sổ gửi), validate cấu trúc thông điệp, không dùng
  `targetOrigin "*"`, không đưa dữ liệu sự kiện lên URL.
- Giai đoạn 2: Google cấp token cho **phiên trình duyệt của chính bạn**; bạn có thể
  thu hồi quyền bất cứ lúc nào tại *Google Account → Security → Third-party access*.
- **Khuyến khích đọc mã nguồn trước khi cài**, và không chia sẻ link feed `.ics` cá
  nhân của Blackboard — nó chứa lịch của chính bạn.

### 6. Tuyên bố

Dự án cá nhân, **không phải sản phẩm chính thức** của trường HCMIU hay Blackboard,
không liên kết, không được bảo trợ. **Không bảo hành** bất kỳ dạng nào; dùng tự chịu
rủi ro. Tool có thể ngừng hoạt động khi trường thay đổi cấu hình Blackboard.

### 7. Đóng góp và giấy phép

- **MIT** — xem [LICENSE](./LICENSE). Issues và pull request đều hoan nghênh.
- Phát triển: `node build.js` để tạo lại userscript; `npm test`
  (hoặc `node build.js && node test/test.js`) chạy test — Node ≥ 18 thuần,
  **không thư viện ngoài, không framework test**.
- Cấu trúc: `src/core.js` (hàm thuần: lọc, múi giờ, escape, gập dòng, dựng ICS/nội
  dung Google), `src/userscript.body.js` (lớp mỏng DOM/fetch), `sync/` (trang Giai
  đoạn 2), `test/test.js` (chỉ dữ liệu giả), `build.js` (ghép file).

[↑ Top](#top) · [English](#english)
