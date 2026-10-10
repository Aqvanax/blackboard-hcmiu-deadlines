# Tất cả các cách đưa deadline Blackboard vào Google Calendar

[English](./import-methods.md) · Tiếng Việt

Có hai thứ rất dễ lẫn nhau, nên tách riêng ngay từ đầu:

- **Dữ liệu đi bằng đường nào** — xuất ra file, hay ghi thẳng vào lịch của bạn.
- **Cài script bằng cách nào** — extension, Tampermonkey, hay bookmarklet. Cả ba
  chạy cùng một mã đã build và đều dùng được cả hai đường dữ liệu; chọn cách nào
  cũng không thay đổi kết quả.

## 1. So sánh các đường

| Đường | Cần cài | Đăng nhập Google | Tự cập nhật | Chạy lại thì sao | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| **A. Tự nhập tay** | không | không | không | — | luôn dùng được |
| **B. Xuất `.ics` → Google Import** | tool này | **hoàn toàn không cần** | không (bản chụp) | cập nhật đúng sự kiện cũ (UID cố định) | **nên dùng mặc định** |
| **C. Đồng bộ trực tiếp** | tool này + relay deploy một lần | đồng ý một lần | không (bạn bấm nút) | cập nhật, không nhân đôi | **chạy được** |
| **D. Feed Blackboard → Google "From URL"** | không | không | có, ~8–24 h | — | **đã loại ở HCMIU** |
| **E. Trang web qua REST API Blackboard** | không | OAuth | có thể hẹn giờ | — | **bị chặn, phải nhờ trường** |

### A — Nhập tay

Mở Blackboard, đọc hạn nộp, tự gõ vào Google Calendar. Không cài gì, không phải tin
ai, không có gì hỏng được. Ổn với một hai deadline; nhưng giảng viên đổi ngày một cái
là bản bạn gõ sai ngay.

### B — Xuất `.ics` rồi Import vào Google Calendar

Bấm **"Xuất deadline (.ics)"** trên trang Calendar của Blackboard, rồi vào Google
Calendar **Settings ⚙ → Import & export → Import** và chọn file.

Chưa biết chọn gì thì chọn đường này. Nó **không cần bất kỳ ủy quyền Google nào** —
file nằm trên máy bạn tới khi bạn tự import — và file đúng chuẩn RFC 5545 nên dùng
được cả với Outlook, Apple Calendar hay ứng dụng lịch khác. Lần sau xuất lại rồi
import lại thì sự kiện cũ được **cập nhật** chứ không chồng thêm bản trùng, vì mỗi mục
Blackboard giữ một UID cố định.

Đánh đổi: đây là bản chụp một thời điểm. Lịch của bạn không đổi gì cho tới khi bạn
làm lại.

Các bước đầy đủ: mục 2A trong [README tiếng Việt](../README.vi.md).

### C — Đồng bộ thẳng vào lịch của chính bạn

Bấm **"Đồng bộ Google Calendar"**, rồi bấm **"Đồng bộ vào Google Calendar"** ở trang
vừa mở. Sự kiện vào lịch tên **"Blackboard Deadlines"** của chính bạn, tự tạo ở lần
chạy đầu.

Đáng dùng nếu bạn làm việc này mỗi tuần — không phải tải file, không phải qua hộp
thoại import. Cái giá là một màn hình đồng ý của Google hiện cảnh báo *"unverified
app"* (vì relay là script cá nhân nhỏ), và cần một người deploy relay đó một lần
([docs/sync-setup.vi.md](./sync-setup.vi.md)). Đồng bộ lại là cập nhật sự kiện cũ và
không bao giờ xóa gì.

### D — Feed lịch có sẵn của Blackboard — ở đây không chạy

Về lý thuyết đây là đường tốt nhất: Blackboard Learn cấp được một *link external
calendar* cá nhân, bạn dán vào Google Calendar ở **Other calendars → From URL**, rồi
Google tự đọc lại mãi mãi. Không cần extension, không cần code, tự refresh thật.

**Ở HCMIU link đó trả về file `.ics` trống trơn — không có deadline nào.** Đã kiểm
chứng. Lý do có khả năng cao: feed external của Learn chỉ chở các calendar event do
giảng viên tạo, không chở hạn nộp assignment — đúng là vì vậy mà tool này phải đọc
trang calendar. Nếu bạn thử và cũng thấy trống, đó là chuyện bình thường, không phải
bạn làm sai.

Thêm nữa: nếu sau này có link chạy được, hãy coi nó như mật khẩu — ai giữ link đó là
đọc được toàn bộ lịch của bạn.

### E — Một trang web đứng riêng qua REST API Blackboard — chưa có

Đây là thứ phần lớn mọi người hình dung: một trang web, kết nối Blackboard, kết nối
Google, xong — không cài gì, và còn có thể hẹn giờ chạy mà bạn không phải bấm.

Hạ tầng thật sự đã có. `blackboard.hcmiu.edu.vn` chạy Learn 3900, REST API công khai
đang bật, luồng OAuth ba chân đang chạy, endpoint lịch cũng tồn tại. Thiếu đúng một
thứ: **Application Key phải do quản trị viên Blackboard của HCMIU đăng ký**
(*Admin → REST API Integrations*). Chưa có người trong trường làm việc đó thì mọi
trang bên thứ ba đều nhận `401 API request is not authenticated.`

Lưu ý: D trống **không** có nghĩa là E cũng sẽ trống — feed và REST API là hai đường
dữ liệu khác nhau, và endpoint lịch của REST API có kiểu item cho hạn nộp gradebook.
Điều này chưa chứng minh được tới khi có key.

## 2. Nên cài bằng cách nào?

Đường B và C đều cần script có mặt trên trang Blackboard. Ba cách đưa nó vào, cùng
một mã nguồn:

| Cách cài | Công cài | Cập nhật | Lưu ý |
| --- | --- | --- | --- |
| **Extension** (MV3) | load unpacked một lần, hoặc một nhấp chuột khi đã lên Chrome Web Store | reload / store tự cập nhật | đây là hướng đang chuẩn bị cho mọi người |
| **Tampermonkey** | cài Tampermonkey rồi cài script | dễ cập nhật nhất | phải tin thêm một extension nữa |
| **Bookmarklet** | dán một bookmark | phải dán lại bằng tay | CSP của trang có thể chặn; khi đó dùng hai cách trên |

## 3. Những thứ hiện chưa có

- **Không có đồng bộ nền.** Mọi đường trên trừ D đều cần bạn mở Blackboard và bấm
  nút. Không có gì chạy theo hẹn giờ. D là đường duy nhất tự refresh nhưng ở đây nó
  trống; E thì làm được, nhưng đang bị chặn.
- **Không có lịch học hay lịch thi** — chỉ deadline (bài tập, hạn nộp).
- **Không xóa gì.** Deadline biến mất khỏi Blackboard thì bản copy vẫn nằm trong lịch
  của bạn tới khi bạn tự xóa. Đồng bộ lại sửa được giờ nhưng không xóa.

## 4. Trả lời ngắn

Dùng **B** (xuất `.ics`), trừ khi bạn đồng bộ hàng tuần thì cấu hình **C** một lần.
**D** đã chết ở HCMIU, **E** phải chờ trường đồng ý, còn **A** luôn ở đó nếu bạn
không muốn cài gì cả.
