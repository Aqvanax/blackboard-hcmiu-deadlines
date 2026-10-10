// Relay Apps Script cho trang sync Giai đoạn 2, triển khai 1 lần bởi người vận hành.
// Deploy => New deployment => Web app, Execute as: User accessing, Who has access: Anyone.
// Mỗi người ủy quyền 1 lần, deadline ghi vào lịch "Blackboard Deadlines" của CHÍNH NGƯỜI ĐÓ.

var CALENDAR_NAME = 'Blackboard Deadlines';
var TIME_ZONE = 'Asia/Ho_Chi_Minh';
var CODE_VERSION = 'v5-REST';

function doGet() {
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
  return htmlResult_(result, payload);
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

// Trang kết quả: hiện thống kê và danh sách lỗi, rồi điều hướng popup về trang
// sync (cùng nguồn) để postMessage kết quả về Blackboard rồi popup tự đóng.
function htmlResult_(result, payload) {
  var data = {
    type: 'bbhcmiu-result',
    nonce: String(payload.nonce || ''),
    created: result.created || 0,
    updated: result.updated || 0,
    failed: result.failed || 0,
    errors: (result.errors || []).slice(0, 8),
    error: result.ok ? '' : String(result.error || '')
  };
  var text = result.ok
    ? 'Đồng bộ xong: tạo mới ' +
      data.created +
      ', cập nhật ' +
      data.updated +
      (data.failed > 0 ? ', lỗi ' + data.failed : '') +
      '.'
    : 'Lỗi: ' + data.error;
  text += ' (mã relay: ' + CODE_VERSION + ')';
  var list = '';
  data.errors.forEach(function (line) {
    list += '<br>' + escapeHtml_(line);
  });
  // HtmlService luôn chạy trong iframe nên window.opener null: điều hướng
  // popup về trang sync (cùng nguồn) thì postMessage và tự đóng mới chạy được.
  var base = String(payload.syncUrl || '');
  var bridge =
    base +
    (base.indexOf('?') > 0 ? '&' : '?') +
    'bbhcmiuResult=' +
    encodeURIComponent(JSON.stringify(data));
  var script =
    '<script>setTimeout(function(){try{window.top.location.href=' +
    JSON.stringify(bridge) +
    ';}catch(e){window.location.href=' +
    JSON.stringify(bridge) +
    ';}},300);</' + 'script>';
  return html_(
    'Kết quả',
    text + (list ? '<p style="font-size:13px">' + list + '</p>' : '') + script
  );
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
