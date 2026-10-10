// ==UserScript==
// @name         Blackboard HCMIU: Xuất deadline (.ics)
// @namespace    bbhcmiu-deadlines
// @version      1.0.0
// @description  Xuất deadline Blackboard (HCMIU) ra file .ics và đồng bộ Google Calendar. Chạy hoàn toàn trong trình duyệt, không có server của tác giả.
// @author       bbhcmiu-deadlines contributors
// @match        https://blackboard.hcmiu.edu.vn/webapps/calendar/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/* Tạo bởi build.js, hãy sửa src/ rồi chạy node build.js */
(function () {
'use strict';

/* src/core.js */
// createBbCore(): toàn bộ hàm thuần của dự án, không đụng DOM, fetch hay mạng.
// Node test qua đây; build.js nhúng vào userscript và copy sang sync/core.js.
function createBbCore() {
  'use strict';

  /* Hằng số */

  const VN_TZ = 'Asia/Ho_Chi_Minh';
  const VN_OFFSET = '+07:00'; // Việt Nam không có DST nên offset cố định
  const MS_PER_DAY = 86400000;
  const MS_PER_MINUTE = 60000;
  const PRODID = '-//blackboard-hcmiu-ics//VN';
  const EXPORT_CALNAME = 'Blackboard Deadlines';
  const UID_DOMAIN = 'blackboard.hcmiu.edu.vn';
  const GOOGLE_EVENT_PREFIX = 'bbhcmiu';
  const ICS_CRLF = '\r\n';
  const ICS_MAX_OCTETS = 75; // RFC 5545: mỗi dòng tối đa 75 octet

  /* Thông báo hiển thị cho người dùng (tiếng Việt). */
  const messages = {
    sessionExpired:
      'Phiên đăng nhập có thể đã hết hạn, hãy tải lại trang Blackboard và đăng nhập lại.',
    noUpcoming: 'Không có deadline nào sắp tới.'
  };

  /* Format giờ theo múi giờ Việt Nam, không phụ thuộc múi giờ máy. */
  const fmtTimeVN = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const fmtDateVN = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const fmtDateVNISO = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  /* Kiểm tra và lọc */

  /** Validate schema sự kiện Blackboard, dùng ở cả hai phía postMessage. */
  function isValidEvent(ev) {
    if (!ev || typeof ev !== 'object') return false;
    if (typeof ev.title !== 'string' || ev.title.trim() === '') return false;
    if (typeof ev.itemSourceId !== 'string' || ev.itemSourceId.trim() === '')
      return false;
    if (typeof ev.allDay !== 'boolean') return false;
    if (typeof ev.startDate !== 'string' || Number.isNaN(Date.parse(ev.startDate)))
      return false;
    if (typeof ev.endDate !== 'string' || Number.isNaN(Date.parse(ev.endDate)))
      return false;
    return true;
  }

  /** Chỉ giữ sự kiện hợp lệ và endDate chưa qua thời điểm now. */
  function filterUpcoming(events, nowMs) {
    if (!Array.isArray(events)) return [];
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    return events.filter(function (ev) {
      return isValidEvent(ev) && Date.parse(ev.endDate) >= now;
    });
  }

  /* Đổi giờ */

  function toMs(value) {
    let ms;
    if (typeof value === 'number') ms = value;
    else if (value instanceof Date) ms = value.getTime();
    else ms = Date.parse(value);
    if (Number.isNaN(ms)) throw new Error('Thời gian không hợp lệ: ' + value);
    return ms;
  }

  /** UTC compact của RFC 5545: "YYYYMMDDTHHMMSSZ". */
  function utcCompact(value) {
    return new Date(toMs(value)).toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
  }

  /** "23:59" theo giờ Việt Nam. */
  function vietnamTimeHHMM(value) {
    return fmtTimeVN.format(new Date(toMs(value)));
  }

  /** "12/10/2026" theo giờ Việt Nam. */
  function vietnamDateDDMMYYYY(value) {
    return fmtDateVN.format(new Date(toMs(value)));
  }

  /** Ngày ISO (YYYYMMDD) theo giờ Việt Nam. */
  function vietnamDateISO(value) {
    return fmtDateVNISO.format(new Date(toMs(value)));
  }

  /** 00:00 giờ Việt Nam (mili giây) của ngày chứa instant ms. */
  function startOfDayVietnam(ms) {
    return Date.parse(vietnamDateISO(ms) + 'T00:00:00' + VN_OFFSET);
  }

  /** Cộng ngày cho chuỗi ngày ISO, đi qua UTC nên an toàn. */
  function addDaysISODate(dateISO, days) {
    const base = Date.parse(dateISO + 'T00:00:00Z');
    if (Number.isNaN(base)) throw new Error('Ngày không hợp lệ: ' + dateISO);
    return new Date(base + days * MS_PER_DAY).toISOString().slice(0, 10);
  }

  /* Escape và gập dòng (RFC 5545) */

  /**
   * Escape giá trị TEXT: backslash, xuống dòng, chấm phẩy, dấu phẩy.
   * Thứ tự: \ trước, rồi \n, rồi ; và ,
   */
  function escapeIcsText(value) {
    return String(value == null ? '' : value)
      .replace(/\r\n?/g, '\n')
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  }

  /** Số byte của MỘT ký tự (lặp theo code point nên không cắt giữa chữ). */
  function charOctetLength(ch) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x7f) return 1;
    if (cp <= 0x7ff) return 2;
    if (cp <= 0xffff) return 3;
    return 4;
  }

  /**
   * Gập dòng: mỗi dòng tối đa 75 octet, dòng kế tiếp bắt đầu bằng 1 khoảng trắng.
   * Khoảng trắng cũng tính trong 75 octet, trả về mảng dòng vật lý.
   */
  function foldIcsLine(line) {
    const parts = [];
    let current = '';
    let currentOctets = 0;
    let limit = ICS_MAX_OCTETS;
    for (const ch of String(line)) {
      const n = charOctetLength(ch);
      if (currentOctets + n > limit) {
        parts.push(current);
        current = ch;
        currentOctets = n;
        limit = ICS_MAX_OCTETS - 1; // dòng tiếp theo có 1 khoảng trắng đầu
      } else {
        current += ch;
        currentOctets += n;
      }
    }
    parts.push(current);
    return parts.map(function (p, i) {
      return i === 0 ? p : ' ' + p;
    });
  }

  /* Dựng nội dung sự kiện */

  /** Lấy mã môn ở đầu calendarId, ví dụ IT138IU. */
  function courseCode(calendarId) {
    const code = String(calendarId == null ? '' : calendarId).split('_')[0];
    return code || 'Blackboard';
  }

  function buildSummary(ev) {
    return '[' + courseCode(ev.calendarId) + '] ' + ev.title + ' (deadline)';
  }

  /**
   * 3 dòng DESCRIPTION (chưa escape, xuống dòng thật):
   * Hạn nộp / Môn / Blackboard item.
   */
  function buildDescriptionLines(ev) {
    const lines = [];
    if (ev.allDay) {
      lines.push(
        'Hạn nộp: ' + vietnamDateDDMMYYYY(ev.endDate) + ' (ngày, giờ Việt Nam)'
      );
    } else {
      lines.push(
        'Hạn nộp: ' +
          vietnamTimeHHMM(ev.endDate) +
          ' (giờ Việt Nam, giờ kết thúc sự kiện)'
      );
    }
    lines.push(
      'Môn: ' +
        (typeof ev.calendarName === 'string' && ev.calendarName
          ? ev.calendarName
          : '(không rõ)')
    );
    lines.push('Blackboard item: ' + ev.itemSourceId);
    return lines;
  }

  function buildDescriptionText(ev) {
    return buildDescriptionLines(ev).join('\n');
  }

  /**
   * Dựng 1 khối VEVENT chưa gập: UID cố định, DTSTART bằng DTEND trừ 30 phút.
   * allDay thì DTSTART và DTEND chỉ có ngày, DTEND là ngày kế tiếp, không trừ 30 phút.
   */
  function buildVEventLines(ev, nowMs) {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const endMs = Date.parse(ev.endDate);
    const stamp = utcCompact(now);
    const lines = ['BEGIN:VEVENT'];
    lines.push('UID:' + ev.itemSourceId + '@' + UID_DOMAIN);
    lines.push('DTSTAMP:' + stamp);
    lines.push('LAST-MODIFIED:' + stamp);
    // SEQUENCE lấy phút hiện tại để bản import sau mới hơn, xem README.
    lines.push('SEQUENCE:' + Math.floor(Date.now() / MS_PER_MINUTE));
    if (ev.allDay) {
      const startDay = vietnamDateISO(endMs);
      lines.push('DTSTART;VALUE=DATE:' + startDay.replace(/-/g, ''));
      lines.push('DTEND;VALUE=DATE:' + addDaysISODate(startDay, 1).replace(/-/g, ''));
    } else {
      lines.push('DTSTART:' + utcCompact(endMs - 30 * MS_PER_MINUTE));
      lines.push('DTEND:' + utcCompact(endMs));
    }
    lines.push('SUMMARY:' + escapeIcsText(buildSummary(ev)));
    lines.push('DESCRIPTION:' + escapeIcsText(buildDescriptionText(ev)));
    if (ev.location != null && String(ev.location).trim() !== '') {
      lines.push('LOCATION:' + escapeIcsText(ev.location));
    }
    lines.push('END:VEVENT');
    return lines;
  }

  /* Dựng file .ics */

  function calendarHeaderLines() {
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:' + PRODID,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:' + EXPORT_CALNAME
    ];
  }

  /**
   * Dựng file .ics (RFC 5545): CRLF, gập dòng, chỉ chứa sự kiện chưa qua hạn.
   * Lọc lại theo nowMs để đồng nhất với lần lọc ngoài khi cùng truyền nowMs.
   */
  function buildIcs(events, nowMs) {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const kept = filterUpcoming(events, now);
    const logicalLines = calendarHeaderLines();
    kept.forEach(function (ev) {
      buildVEventLines(ev, now).forEach(function (l) {
        logicalLines.push(l);
      });
    });
    logicalLines.push('END:VCALENDAR');

    const physical = [];
    logicalLines.forEach(function (l) {
      foldIcsLine(l).forEach(function (p) {
        physical.push(p);
      });
    });
    return physical.join(ICS_CRLF) + ICS_CRLF;
  }

  /* Google Calendar (Giai đoạn 2) */

  /**
   * ID Google Calendar: chỉ chữ thường a tới v và số 0 đến 9, dài 5 tới 1024,
   * ổn định giữa các lần chạy. Ví dụ "_149008_1" thành "bbhcmiu149008v1".
   */
  function googleEventId(itemSourceId) {
    const raw = String(itemSourceId == null ? '' : itemSourceId);
    const parts = raw.split('_').filter(function (p) {
      return p.length > 0;
    });
    let body = parts.length > 0 ? parts.join('v') : raw;
    // Google chỉ nhận chữ a tới v và số 0 đến 9, ký tự lạ thay bằng 'v'.
    body = body.replace(/[^0-9a-v]/g, 'v');
    let id = GOOGLE_EVENT_PREFIX + body;
    if (id.length < 5) id += '0'.repeat(5 - id.length);
    if (id.length > 1024) id = id.slice(0, 1024);
    return id;
  }

  /**
   * Dựng resource cho Google Calendar API (events.insert hoặc update).
   * Giờ UTC dạng Z, allDay thì chỉ có ngày, nội dung giống Giai đoạn 1.
   */
  function buildGoogleEvent(ev) {
    const endMs = Date.parse(ev.endDate);
    const resource = {
      id: googleEventId(ev.itemSourceId),
      summary: buildSummary(ev),
      description: buildDescriptionText(ev)
    };
    if (ev.location != null && String(ev.location).trim() !== '') {
      resource.location = String(ev.location);
    }
    if (ev.allDay) {
      const startDay = vietnamDateISO(endMs);
      resource.start = { date: startDay };
      resource.end = { date: addDaysISODate(startDay, 1) };
    } else {
      const strip = function (ms) {
        return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
      };
      resource.start = { dateTime: strip(endMs - 30 * MS_PER_MINUTE) };
      resource.end = { dateTime: strip(endMs) };
    }
    return resource;
  }

  /* Export */

  return {
    VN_TZ: VN_TZ,
    PRODID: PRODID,
    EXPORT_CALNAME: EXPORT_CALNAME,
    UID_DOMAIN: UID_DOMAIN,
    messages: messages,
    isValidEvent: isValidEvent,
    filterUpcoming: filterUpcoming,
    utcCompact: utcCompact,
    vietnamTimeHHMM: vietnamTimeHHMM,
    vietnamDateDDMMYYYY: vietnamDateDDMMYYYY,
    vietnamDateISO: vietnamDateISO,
    startOfDayVietnam: startOfDayVietnam,
    addDaysISODate: addDaysISODate,
    escapeIcsText: escapeIcsText,
    foldIcsLine: foldIcsLine,
    courseCode: courseCode,
    buildSummary: buildSummary,
    buildDescriptionLines: buildDescriptionLines,
    buildDescriptionText: buildDescriptionText,
    buildVEventLines: buildVEventLines,
    calendarHeaderLines: calendarHeaderLines,
    buildIcs: buildIcs,
    googleEventId: googleEventId,
    buildGoogleEvent: buildGoogleEvent
  };
}

/* Cho Node (test): require() file này. Trình duyệt: gọi createBbCore() khi cần. */
if (typeof module === 'object' && module.exports) {
  module.exports = createBbCore();
}

/* src/userscript.body.js */
// PHẦN GIAO DIỆN / MẠNG: DOM, fetch, postMessage.
// Logic thuần nằm trong createBbCore() của src/core.js.

/* Cấu hình */

const BB_CONFIG = {
  /** Cửa sổ truy vấn dài QUERY_WINDOW_DAYS ngày. */
  QUERY_WINDOW_DAYS: 180,
  // start của truy vấn: false là thời điểm bấm nút, true là 00:00 hôm nay giờ VN.
  START_AT_TODAY_VN: false,
  // Trang sync Giai đoạn 2, sau khi đổi chạy node build.js và cài lại script.
  // Đang test local: đổi thành URL GitHub Pages khi deploy thật.
  SYNC_PAGE_URL: 'https://aqvanax.github.io/blackboard-hcmiu-deadlines/sync/'
};

/* Origin trang sync để kiểm tra postMessage, không dùng wildcard. */
const BB_SYNC_ORIGIN = new URL(BB_CONFIG.SYNC_PAGE_URL).origin;

/* Endpoint cùng domain với Blackboard. */
const BB_EVENTS_PATH =
  '/webapps/calendar/calendarData/selectedCalendarEvents';

const bbCore = createBbCore();
const MSG = bbCore.messages;

/* Hàm truy vấn và tải */

function queryStartMs() {
  return BB_CONFIG.START_AT_TODAY_VN
    ? bbCore.startOfDayVietnam(Date.now())
    : Date.now();
}

/**
 * GET selectedCalendarEvents cùng origin, trả mảng JSON thô.
 * Lỗi HTTP hoặc không phải JSON thì coi như hết phiên đăng nhập.
 */
async function fetchUpcomingEvents() {
  const startMs = queryStartMs();
  const endMs = startMs + BB_CONFIG.QUERY_WINDOW_DAYS * 86400000;
  const url =
    BB_EVENTS_PATH +
    '?start=' +
    startMs +
    '&end=' +
    endMs +
    '&course_id=&mode=personal';

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
  } catch (err) {
    throw new Error('Không tải được dữ liệu từ Blackboard, vui lòng thử lại.');
  }
  if (!res.ok) throw new Error(MSG.sessionExpired);

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error(MSG.sessionExpired);
  }
  if (!Array.isArray(data)) throw new Error(MSG.sessionExpired);
  return data;
}

/* Tải file .ics */

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 4000);
}

async function handleExportClick() {
  setBusy(true, 'Đang xuất…');
  try {
    const raw = await fetchUpcomingEvents();
    const now = Date.now();
    const events = bbCore.filterUpcoming(raw, now);
    if (events.length === 0) {
      showToast(MSG.noUpcoming, 'info');
      return;
    }
    const ics = bbCore.buildIcs(events, now);
    const filename = 'blackboard-deadlines-' + bbCore.vietnamDateISO(now) + '.ics';
    downloadTextFile(ics, filename);
    showToast('Đã tải ' + filename + ' (' + events.length + ' deadline).', 'ok');
  } catch (err) {
    showToast(
      err && err.message ? err.message : 'Có lỗi xảy ra, vui lòng thử lại.',
      'error'
    );
  } finally {
    setBusy(false, 'Xuất deadline (.ics)');
  }
}

/* Giai đoạn 2: đồng bộ Google Calendar */

let bbSyncWindow = null;
let bbReadyTimer = null;
let bbSyncReadySeen = false;

function handleSyncClick() {
  // Không dùng "noopener" vì trang sync cần window.opener để gửi "ready".
  const win = window.open(BB_CONFIG.SYNC_PAGE_URL, 'bbhcmiu-google-sync');
  if (!win) {
    showToast(
      'Trình duyệt đã chặn cửa sổ bật lên. Hãy cho phép pop-up cho Blackboard rồi thử lại.',
      'error'
    );
    return;
  }
  bbSyncWindow = win;
  bbSyncReadySeen = false;
  showToast('Đang mở trang đồng bộ Google Calendar…', 'info');
  clearTimeout(bbReadyTimer);
  bbReadyTimer = setTimeout(function () {
    if (bbSyncWindow && !bbSyncWindow.closed && !bbSyncReadySeen) {
      showToast(
        'Chưa nhận được phản hồi từ trang đồng bộ. Kiểm tra BB_CONFIG.SYNC_PAGE_URL trong userscript.',
        'error'
      );
    }
  }, 20000);
}

function handleSyncMessage(event) {
  /* Kiểm tra origin hai chiều: chỉ tin trang sync của mình. */
  if (event.origin !== BB_SYNC_ORIGIN) return;
  if (!bbSyncWindow || event.source !== bbSyncWindow) return;

  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'bbhcmiu-ready') {
    bbSyncReadySeen = true;
    clearTimeout(bbReadyTimer);
    (async function () {
      try {
        const raw = await fetchUpcomingEvents();
        const events = bbCore.filterUpcoming(raw, Date.now());
        /* Không đưa dữ liệu lên URL, chỉ postMessage với targetOrigin cố định. */
        if (bbSyncWindow && !bbSyncWindow.closed) {
          bbSyncWindow.postMessage(
            { type: 'bbhcmiu-events', events: events },
            BB_SYNC_ORIGIN
          );
        }
        if (events.length === 0) showToast(MSG.noUpcoming, 'info');
      } catch (err) {
        showToast(
          err && err.message ? err.message : 'Có lỗi xảy ra, vui lòng thử lại.',
          'error'
        );
      }
    })();
    return;
  }

  if (data.type === 'bbhcmiu-result') {
    /* Validate schema của thông điệp kết quả. */
    if (typeof data.error === 'string' && data.error) {
      showToast('Đồng bộ lỗi: ' + data.error, 'error');
      return;
    }
    const created = Number.isFinite(data.created) ? data.created : 0;
    const updated = Number.isFinite(data.updated) ? data.updated : 0;
    const failed = Number.isFinite(data.failed) ? data.failed : 0;
    const text =
      'Đồng bộ xong: tạo mới ' +
      created +
      ', cập nhật ' +
      updated +
      (failed > 0 ? ', lỗi ' + failed : '') +
      '.';
    showToast(text, failed > 0 ? 'error' : 'ok');
  }
}

/* Giao diện */

const BB_ROOT_ID = 'bbhcmiu-deadlines-root';
let bbToastTimer = null;

function el(tag, style, text) {
  const node = document.createElement(tag);
  if (style) node.style.cssText = style;
  if (text != null) node.textContent = text;
  return node;
}

function showToast(message, kind) {
  const toast = document.getElementById(BB_ROOT_ID + '-toast');
  if (!toast) return;
  const colors = {
    ok: { border: '#16a34a', bg: '#f0fdf4' },
    error: { border: '#dc2626', bg: '#fef2f2' },
    info: { border: '#2563eb', bg: '#eff6ff' }
  };
  const c = colors[kind] || colors.info;
  toast.textContent = message;
  toast.style.borderLeft = '4px solid ' + c.border;
  toast.style.background = c.bg;
  toast.style.display = 'block';
  clearTimeout(bbToastTimer);
  bbToastTimer = setTimeout(function () {
    toast.style.display = 'none';
  }, 7000);
}

function setBusy(busy, exportLabel) {
  const btnExport = document.getElementById(BB_ROOT_ID + '-export');
  const btnSync = document.getElementById(BB_ROOT_ID + '-sync');
  if (btnExport) {
    btnExport.disabled = !!busy;
    if (exportLabel) btnExport.textContent = exportLabel;
  }
  if (btnSync) btnSync.disabled = !!busy;
}

function createButton(id, label, onClick) {
  const btn = el(
    'button',
    [
      'display:block',
      'width:100%',
      'padding:10px 14px',
      'border:none',
      'border-radius:8px',
      'background:#1f2937',
      'color:#fff',
      'font:600 13px/1.3 system-ui,-apple-system,Segoe UI,sans-serif',
      'cursor:pointer',
      'box-shadow:0 4px 14px rgba(0,0,0,.25)',
      'text-align:center'
    ].join(';'),
    label
  );
  btn.id = id;
  btn.type = 'button';
  btn.addEventListener('mouseenter', function () {
    btn.style.background = '#374151';
  });
  btn.addEventListener('mouseleave', function () {
    btn.style.background = '#1f2937';
  });
  btn.addEventListener('click', onClick);
  return btn;
}

function main() {
  if (document.getElementById(BB_ROOT_ID)) return; // tránh chèn trùng

  const root = el(
    'div',
    'position:fixed;right:16px;bottom:16px;z-index:2147483647;' +
      'display:flex;flex-direction:column;align-items:flex-end;gap:8px;'
  );
  root.id = BB_ROOT_ID;

  const toast = el(
    'div',
    'display:none;max-width:340px;padding:10px 12px;border-radius:8px;' +
      'border:1px solid #e5e7eb;background:#eff6ff;color:#111827;' +
      'font:400 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.18);cursor:pointer'
  );
  toast.id = BB_ROOT_ID + '-toast';
  toast.setAttribute('role', 'status');
  toast.addEventListener('click', function () {
    toast.style.display = 'none';
  });

  root.appendChild(toast);
  root.appendChild(
    createButton(BB_ROOT_ID + '-export', 'Xuất deadline (.ics)', handleExportClick)
  );
  root.appendChild(
    createButton(
      BB_ROOT_ID + '-sync',
      'Đồng bộ Google Calendar',
      handleSyncClick
    )
  );
  document.body.appendChild(root);

  /* Chỉ tin thông điệp từ trang sync (đã kiểm tra origin và source ở trên). */
  window.addEventListener('message', handleSyncMessage);
}

if (typeof document !== 'undefined') {
  if (document.body) main();
  else document.addEventListener('DOMContentLoaded', main);
}
})();
