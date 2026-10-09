// Relay Apps Script cho trang sync Giai đoạn 2, triển khai 1 lần bởi người vận hành.
// Deploy => New deployment => Web app, Execute as: User accessing, Who has access: Anyone.
// Mỗi người ủy quyền 1 lần, deadline ghi vào lịch "Blackboard Deadlines" của CHÍNH NGƯỜI ĐÓ.

var CALENDAR_NAME = 'Blackboard Deadlines';
var TIME_ZONE = 'Asia/Ho_Chi_Minh';

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
    }
  });

  return { ok: true, created: created, updated: updated, failed: failed, errors: errors };
}

// Insert, nếu 409 thì patch cùng ID, chạy lại không nhân đôi.
function upsertOne_(calendarId, ev) {
  try {
    Calendar.Events.insert(calendarId, ev);
    return 'created';
  } catch (err) {
    var code = status_(err);
    if (code === 409) {
      try {
        Calendar.Events.patch(calendarId, ev.id, ev);
        return 'updated';
      } catch (err2) {
        return errText_(err2);
      }
    }
    if (code === 404) return 'calendar-missing';
    return errText_(err);
  }
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

function status_(err) {
  try {
    return err.details.code;
  } catch (e) {
    return 0;
  }
}

function errText_(err) {
  try {
    if (err && err.details && err.details.error && err.details.error.message) {
      return err.details.error.message;
    }
  } catch (e) {}
  return String(err && err.message ? err.message : err);
}

// Trang kết quả: hiện thống kê rồi tự postMessage về trang sync và tự đóng.
function htmlResult_(result, payload) {
  var text = result.ok
    ? 'Đồng bộ xong: tạo mới ' +
      (result.created || 0) +
      ', cập nhật ' +
      (result.updated || 0) +
      ((result.failed || 0) > 0 ? ', lỗi ' + result.failed : '') +
      '.'
    : 'Lỗi: ' + result.error;
  var msg =
    '{"type":"bbhcmiu-result","nonce":' +
    JSON.stringify(String(payload.nonce || '')) +
    ',"created":' +
    (result.created || 0) +
    ',"updated":' +
    (result.updated || 0) +
    ',"failed":' +
    (result.failed || 0) +
    ',"errors":' +
    JSON.stringify((result.errors || []).slice(0, 5)) +
    (result.error ? ',"error":' + JSON.stringify(String(result.error)) : '') +
    '}';
  var script =
    '<script>try{window.opener.postMessage(' +
    msg +
    ',' +
    JSON.stringify(String(payload.origin || '')) +
    ');}catch(e){};setTimeout(function(){window.close();},1200);</' + 'script>';
  return html_('Kết quả', text + script);
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
