// Relay Apps Script cho trang sync Giai đoạn 2, triển khai 1 lần bởi người vận hành.
// Deploy => New deployment => Web app, Execute as: Me, Who has access: Anyone (xem README).

var CALENDAR_NAME = 'Blackboard Deadlines';
var TIME_ZONE = 'Asia/Ho_Chi_Minh';

function doGet() {
  return json_({ ok: true, app: 'bbhcmiu-sync' });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (!body || body.type !== 'bbhcmiu-sync' || !Array.isArray(body.events)) {
      return json_({ ok: false, error: 'sai cấu trúc yêu cầu' });
    }
    // Nếu người vận hành đặt Script Property "token" thì yêu cầu phải đúng.
    var token = PropertiesService.getScriptProperties().getProperty('token');
    if (token && body.token !== token) {
      return json_({ ok: false, error: 'sai hoặc thiếu token' });
    }

    var calendarId = ensureCalendar_();
    var created = 0;
    var updated = 0;
    var failed = 0;
    var errors = [];

    body.events.forEach(function (ev) {
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

    return json_({
      ok: true,
      created: created,
      updated: updated,
      failed: failed,
      errors: errors
    });
  } catch (err) {
    return json_({ ok: false, error: errText_(err) });
  }
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

// Tìm lịch bằng CalendarApp (chạy tốt với Execute as: Me), không có thì tạo mới.
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
