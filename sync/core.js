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
