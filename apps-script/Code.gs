// Relay Apps Script cho trang sync Giai đoạn 2, triển khai 1 lần bởi người vận hành.
// Deploy => New deployment => Web app, Execute as: User accessing, Who has access: Anyone.
// Mỗi người ủy quyền 1 lần, deadline ghi vào lịch "Blackboard Deadlines" của CHÍNH NGƯỜI ĐÓ.

var CALENDAR_NAME = 'Blackboard Deadlines';
var TIME_ZONE = 'Asia/Ho_Chi_Minh';
var CODE_VERSION = 'v11-walk';
// Trang nhận kết quả, cố định ở đây không tin syncUrl gửi từ client.
var SYNC_DONE_URL = 'https://aqvanax.github.io/blackboard-hcmiu-deadlines/sync/done.html';

function doGet(e) {
  // Kênh JSONP: trang sync đọc kết quả bằng thẻ script, không cần CORS và
  // không phụ thuộc popup có render được HTML hay không. Mime JAVASCRIPT có
  // thật trong enum, được tài liệu Google dùng sẵn cho JSONP.
  if (e && e.parameter && e.parameter.action === 'result') {
    var raw = PropertiesService.getScriptProperties().getProperty('bbResult') || '';
    var match = false;
    try {
      match = raw !== '' && JSON.parse(raw).nonce === String(e.parameter.nonce || '');
    } catch (err) {}
    var cb = String(e.parameter.callback || '');
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb)) cb = 'bbhcmiuPoll';
    return ContentService.createTextOutput(cb + '(' + (match ? raw : 'null') + ');').setMimeType(
      ContentService.MimeType.JAVASCRIPT
    );
  }
  return html_(
    'Đã sẵn sàng',
    'Ủy quyền thành công. Quay lại trang đồng bộ và bấm “Đồng bộ vào Google Calendar”.'
  );
}

function doPost(e) {
  var payload = null;
  try {
    payload = JSON.parse((e.parameter && e.parameter.payload) || '');
    if (!payload || payload.type !== 'bbhcmiu-sync' || !Array.isArray(payload.events)) {
      payload = null;
    }
  } catch (err) {
    payload = null;
  }
  if (!payload) return html_('Lỗi', 'Sai cấu trúc yêu cầu.');

  // Nếu người vận hành đặt Script Property "token" thì yêu cầu phải đúng.
  var token = PropertiesService.getScriptProperties().getProperty('token');
  if (token && payload.token !== token) {
    return html_('Lỗi', 'Sai hoặc thiếu token.');
  }

  var result;
  try {
    result = syncEvents_(payload.events);
  } catch (err) {
    result = { ok: false, error: errText_(err) };
  }
  var data = {
    type: 'bbhcmiu-result',
    nonce: String(payload.nonce || ''),
    created: result.created || 0,
    updated: result.updated || 0,
    failed: result.failed || 0,
    errors: (result.errors || []).slice(0, 8),
    error: result.ok ? '' : String(result.error || ''),
    version: CODE_VERSION
  };
  var bridge =
    SYNC_DONE_URL +
    '?bbhcmiuResult=' +
    encodeURIComponent(JSON.stringify(data));
  // Lưu kết quả vào Script Property (1 khóa cố định) để trang sync đọc lại
  // bằng JSONP khi popup không tự điều hướng được, không bao giờ timeout oan.
  PropertiesService.getScriptProperties().setProperty('bbResult', JSON.stringify(data));
  // Thẻ HtmlService render thật trong popup và bắn kết quả về trang sync,
  // vì ContentService không bao giờ trả được text/html (enum không có HTML).
  return HtmlService.createHtmlOutput(card_(data, bridge));
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Thẻ kết quả trong popup: hiện thống kê thật, bắn postMessage về trang sync
// qua opener (Google không gửi COOP nên opener sống), kèm link dự phòng.
function card_(data, bridge) {
  var stat =
    'Đã đồng bộ xong: tạo mới ' +
    data.created +
    ', cập nhật ' +
    data.updated +
    (data.failed ? ', lỗi ' + data.failed : '') +
    '.';
  var detail = data.error || (data.errors || []).join(' | ');
  /* Chèn JSON vào thẻ script, vô hiệu chuỗi đóng nháy kép trong dữ liệu. */
  var json = JSON.stringify(data).replace(/<\//g, '<\\/');
  return (
    '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">' +
    '<title>Đồng bộ Google Calendar</title><style>' +
    'body{font:15px/1.5 system-ui,sans-serif;margin:24px;color:#111827}' +
    '.ok{font-weight:600}.muted{color:#6b7280;font-size:13px}' +
    'a{color:#2563eb}</style></head><body>' +
    '<p class="ok">' +
    stat +
    '</p>' +
    (detail ? '<p>' + escapeHtml_(detail) + '</p>' : '') +
    '<p class="muted" id="st">Đang gửi kết quả về trang đồng bộ…</p>' +
    '<p class="muted">Mã relay: ' +
    escapeHtml_(String(data.version || '')) +
    '</p>' +
    '<p><a href="' +
    escapeHtml_(bridge) +
    '" target="_top">Quay lại trang đồng bộ</a></p>' +
    '<p><a href="' +
    escapeHtml_(bridge) +
    '" target="_blank">Mở trang đồng bộ ở tab mới</a></p>' +
    /* Đi dọc tới window.top rồi mới hỏi opener, phòng iframe lồng tầng khiến
       parent.opener là null; top.location chỉ ăn khi có bấm tay nên giữ link. */
    '<script>(function(){var d=' +
    json +
    ';var st=document.getElementById("st");var sent=false;var w=window;' +
    'try{while(w.parent&&w.parent!==w){w=w.parent;}}catch(e){}' +
    'try{if(w.opener){w.opener.postMessage(d,"*");sent=true;}}catch(e){}' +
    'if(st){st.textContent=sent?"Đã gửi kết quả về trang đồng bộ."' +
    ':"Không gửi trực tiếp được, hãy bấm link bên dưới.";}' +
    'try{window.top.location.href=' +
    JSON.stringify(bridge) +
    ';}catch(e){}' +
    '})();</' +
    'script></body></html>'
  );
}

// Đồng bộ theo tài khoản của người ĐANG GỌI (Execute as: User accessing).
function syncEvents_(events) {
  var calendarId = ensureCalendar_();
  var created = 0;
  var updated = 0;
  var failed = 0;
  var errors = [];

  events.forEach(function (ev) {
    var r = upsertOne_(calendarId, ev);
    if (r === 'calendar-missing') {
      // lịch bị xóa trên Google thì tạo lại và thử lại đúng 1 lần
      PropertiesService.getScriptProperties().deleteProperty('calendarId');
      calendarId = ensureCalendar_();
      r = upsertOne_(calendarId, ev);
    }
    if (r === 'created') created++;
    else if (r === 'updated') updated++;
    else {
      failed++;
      errors.push((ev.summary || ev.id) + ': ' + r);
      console.error(
        'bbhcmiu[' + CODE_VERSION + ']: ' + (ev.summary || ev.id) + ': ' + r
      );
    }
  });

  return { ok: true, created: created, updated: updated, failed: failed, errors: errors };
}

// Insert, nếu 409 thì patch cùng ID, chạy lại không nhân đôi.
// Gọi REST Calendar API bằng UrlFetchApp để kiểm soát request và đọc
// được body lỗi chi tiết thay vì "Bad Request" chung chung.
function upsertOne_(calendarId, ev) {
  var url =
    'https://www.googleapis.com/calendar/v3/calendars/' +
    encodeURIComponent(calendarId) +
    '/events';
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify(ev),
    muteHttpExceptions: true
  };
  var resp = UrlFetchApp.fetch(url, options);
  var code = resp.getResponseCode();
  if (code >= 200 && code < 300) return 'created';
  if (code === 409) {
    options.method = 'patch';
    resp = UrlFetchApp.fetch(url + '/' + encodeURIComponent(ev.id), options);
    code = resp.getResponseCode();
    if (code >= 200 && code < 300) return 'updated';
  }
  if (code === 404) return 'calendar-missing';
  return httpErrText_(resp, code);
}

// Đọc message lỗi thật từ body JSON của Calendar API.
function httpErrText_(resp, code) {
  var body = '';
  try {
    var parsed = JSON.parse(resp.getContentText());
    if (parsed && parsed.error && parsed.error.message) {
      body = parsed.error.message;
    }
  } catch (e) {}
  return 'HTTP ' + code + (body ? ': ' + body : '');
}

// Tìm lịch bằng CalendarApp, không có thì tạo mới.
function ensureCalendar_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('calendarId');
  if (id) return id;
  var cal =
    CalendarApp.getCalendarsByName(CALENDAR_NAME)[0] ||
    CalendarApp.createCalendar(CALENDAR_NAME, { timeZone: TIME_ZONE });
  props.setProperty('calendarId', cal.getId());
  return cal.getId();
}

function errText_(err) {
  try {
    if (err && err.details && err.details.error && err.details.error.message) {
      return err.details.error.message;
    }
  } catch (e) {}
  return String(err && err.message ? err.message : err);
}

function html_(title, body) {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">' +
      '<title>Blackboard Deadlines</title><style>' +
      'body{font:15px/1.5 system-ui,-apple-system,sans-serif;background:#f3f4f6;' +
      'color:#111827;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}' +
      'div{background:#fff;border:1px solid #e5e7eb;border-radius:12px;' +
      'padding:24px 28px;max-width:420px;box-shadow:0 8px 24px rgba(0,0,0,.08)}' +
      'h1{font-size:17px;margin:0 0 8px}</style></head><body><div>' +
      '<h1>' +
      title +
      '</h1><p>' +
      body +
      '</p></div></body></html>'
  );
}
