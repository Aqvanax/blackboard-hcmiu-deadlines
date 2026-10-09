// Test phần lõi thuần, chạy bằng Node không cần thư viện ngoài: npm test
// Toàn bộ dữ liệu trong file này là dữ liệu giả, không có dữ liệu thật.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const core = require('../src/core.js');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

/* Dữ liệu giả */

const NOW = Date.parse('2026-10-10T00:00:00.000Z'); // "hôm nay" giả

const SAMPLE = {
  title: 'Lab 02 Homework',
  startDate: '2026-10-12T16:59:00.000Z',
  endDate: '2026-10-12T16:59:00.000Z',
  allDay: false,
  calendarId: 'IT138IU_1_2026-270101',
  calendarName: 'Data Science and Data Visualization_S1_2026-27_G01_Lab01',
  itemSourceId: '_149008_1',
  eventType: 'Assignment',
  location: null
};

const PAST = {
  title: 'Deadline đã qua',
  startDate: '2026-10-01T10:00:00.000Z',
  endDate: '2026-10-09T10:00:00.000Z',
  allDay: false,
  calendarId: 'IT138IU_1_2026-270101',
  calendarName: 'Môn mẫu',
  itemSourceId: '_111111_1',
  eventType: 'Assignment',
  location: null
};

/* Gỡ gập dòng để kiểm tra nội dung logic. */
function unfold(ics) {
  const lines = ics.split('\r\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const out = [];
  for (const l of lines) {
    if (l.startsWith(' ')) out[out.length - 1] += l.slice(1);
    else out.push(l);
  }
  return out;
}

/* Harness */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (err) {
    failed++;
    console.log('  \u2717 ' + name);
    console.log('      ' + String(err && err.message).split('\n').join('\n      '));
  }
}

console.log('Giai đoạn 1: sinh VEVENT / .ics');

test('VEEVENT đúng theo mẫu: UID, DTSTART, DTEND, SUMMARY, Hạn nộp 23:59', () => {
  const ics = core.buildIcs([SAMPLE], NOW);
  const lines = unfold(ics);
  assert.ok(lines.includes('UID:_149008_1@blackboard.hcmiu.edu.vn'), 'thiếu UID');
  assert.ok(lines.includes('DTSTART:20261012T162900Z'), 'thiếu DTSTART -30 phút');
  assert.ok(lines.includes('DTEND:20261012T165900Z'), 'thiếu DTEND');
  assert.ok(
    lines.includes('SUMMARY:[IT138IU] Lab 02 Homework (deadline)'),
    'thiếu SUMMARY'
  );
  const desc = lines.find((l) => l.startsWith('DESCRIPTION:'));
  assert.ok(desc, 'thiếu DESCRIPTION');
  assert.ok(desc.includes('Hạn nộp: 23:59'), 'DESCRIPTION thiếu Hạn nộp: 23:59');
  assert.ok(
    desc.includes('Môn: Data Science and Data Visualization_S1_2026-27_G01_Lab01'),
    'DESCRIPTION thiếu Môn'
  );
  assert.ok(desc.includes('Blackboard item: _149008_1'), 'DESCRIPTION thiếu item');
});

test('DTSTAMP/LAST-MODIFIED UTC, SEQUENCE là phút hiện tại', () => {
  const lines = unfold(core.buildIcs([SAMPLE], NOW));
  const dtstamp = lines.find((l) => l.startsWith('DTSTAMP:'));
  assert.match(dtstamp, /^DTSTAMP:\d{8}T\d{6}Z$/);
  assert.ok(lines.some((l) => /^LAST-MODIFIED:\d{8}T\d{6}Z$/.test(l)));
  const seq = Number(lines.find((l) => l.startsWith('SEQUENCE:')).split(':')[1]);
  const expected = Math.floor(Date.now() / 60000);
  assert.ok(Math.abs(seq - expected) <= 1, 'SEQUENCE không phải phút hiện tại');
});

test('UID ổn định giữa các lần sinh (import lại chỉ cập nhật)', () => {
  const a = unfold(core.buildIcs([SAMPLE], NOW)).find((l) => l.startsWith('UID:'));
  const b = unfold(core.buildIcs([SAMPLE], NOW + 5000)).find((l) =>
    l.startsWith('UID:')
  );
  assert.equal(a, b);
});

test('Sự kiện đã qua hạn bị loại (không xuất, không đồng bộ)', () => {
  const kept = core.filterUpcoming([SAMPLE, PAST], NOW);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].itemSourceId, '_149008_1');
  const ics = core.buildIcs([SAMPLE, PAST], NOW);
  assert.ok(!unfold(ics).some((l) => l.includes('Deadline đã qua')));
  assert.ok(!ics.includes('DTEND:20261009'));
  // sự kiện trùng thời điểm "bây giờ" vẫn được giữ
  assert.equal(core.filterUpcoming([SAMPLE], Date.parse(SAMPLE.endDate)).length, 1);
});

test('allDay: VALUE=DATE, DTEND là ngày kế tiếp, không trừ 30 phút', () => {
  const ev = Object.assign({}, SAMPLE, {
    title: 'Nộp hồ sơ',
    startDate: '2026-10-11T17:00:00.000Z', // 00:00 ngày 12/10 giờ VN
    endDate: '2026-10-11T17:00:00.000Z',
    allDay: true
  });
  const lines = unfold(core.buildIcs([ev], NOW));
  assert.ok(lines.includes('DTSTART;VALUE=DATE:20261012'), 'DTSTART date sai');
  assert.ok(lines.includes('DTEND;VALUE=DATE:20261013'), 'DTEND date sai');
  assert.ok(!lines.some((l) => /^DTSTART:/.test(l)), 'không được có DTSTART thường');
  const desc = lines.find((l) => l.startsWith('DESCRIPTION:'));
  assert.ok(desc.includes('Hạn nộp: 12/10/2026'), 'allDay thiếu ngày Hạn nộp');
});

test('Escape: dấu phẩy, chấm phẩy, backslash, xuống dòng, tiếng Việt', () => {
  assert.equal(
    core.escapeIcsText('a\\b;c,d\ne\r\nf'),
    'a\\\\b\\;c\\,d\\ne\\nf'
  );
  const ev = Object.assign({}, SAMPLE, {
    title: 'Bài tập; Ngữ pháp, "dấu phẩy"\nDòng hai'
  });
  const lines = unfold(core.buildIcs([ev], NOW));
  assert.ok(
    lines.includes(
      'SUMMARY:[IT138IU] Bài tập\\; Ngữ pháp\\, "dấu phẩy"\\nDòng hai (deadline)'
    ),
    'SUMMARY chưa escape đúng'
  );
  const desc = lines.find((l) => l.startsWith('DESCRIPTION:'));
  assert.ok(desc.includes('Hạn nộp: 23:59'), 'DESCRIPTION bị sai sau escape');
  const summary = lines.find((l) => l.startsWith('SUMMARY:'));
  assert.ok(summary.includes('Bài tập'), 'tiếng Việt bị mất chữ trong SUMMARY');
});

test('Gập dòng: mọi dòng <= 75 octet, gộp lại bằng đúng bản gốc', () => {
  const longName =
    'Phân tích dữ liệu lớn, học máy và trí tuệ nhân tạo '.repeat(6) + 'kết';
  const ev = Object.assign({}, SAMPLE, { calendarName: longName });
  const ics = core.buildIcs([ev], NOW);
  const physical = ics.split('\r\n');
  assert.equal(physical[physical.length - 1], '');
  physical.pop();
  for (const l of physical) {
    const octets = Buffer.byteLength(l, 'utf8');
    assert.ok(octets <= 75, 'dòng ' + octets + ' octet > 75: ' + l.slice(0, 40));
  }
  // gộp lại được và dòng gốc phải > 75 octet (fold được thử thách)
  const logical = unfold(ics);
  assert.ok(
    logical.some((l) => Buffer.byteLength(l, 'utf8') > 75),
    'test này phải có dòng dài > 75 octet'
  );
  const foldedAgain = [];
  for (const l of logical) core.foldIcsLine(l).forEach((p) => foldedAgain.push(p));
  assert.deepEqual(foldedAgain, physical);
});

test('Gập dòng không cắt giữa ký tự nhiều byte (tiếng Việt 2-3 octet)', () => {
  const line = 'DESCRIPTION:' + 'ă'.repeat(60); // 2 octet/ký tự
  const segs = core.foldIcsLine(line);
  assert.ok(segs.length > 1, 'dòng phải được gập');
  assert.ok(!segs[0].startsWith(' '), 'dòng đầu không có khoảng trắng đầu');
  for (let i = 1; i < segs.length; i++) {
    assert.ok(segs[i].startsWith(' '), 'dòng kế phải bắt đầu bằng khoảng trắng');
    assert.ok(
      Buffer.byteLength(segs[i], 'utf8') <= 75,
      'dòng kế vượt 75 octet'
    );
  }
  assert.ok(Buffer.byteLength(segs[0], 'utf8') <= 75, 'dòng đầu vượt 75 octet');
  const rebuilt =
    segs[0] + segs.slice(1).map((s) => s.slice(1)).join('');
  assert.equal(rebuilt, line, 'gấp/gỡ không khớp, ký tự bị cắt giữa?');
});

test('Danh sách rỗng: filter trả [], .ics vẫn đúng cấu trúc', () => {
  assert.deepEqual(core.filterUpcoming([], NOW), []);
  assert.deepEqual(core.filterUpcoming(null, NOW), []);
  assert.deepEqual(core.filterUpcoming(undefined, NOW), []);
  const ics = core.buildIcs([], NOW);
  const lines = unfold(ics);
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.equal(lines[lines.length - 1], 'END:VCALENDAR');
  assert.ok(!ics.includes('BEGIN:VEVENT'));
  assert.deepEqual(core.filterUpcoming([PAST], NOW), []);
});

test('Mọi dòng kết thúc bằng CRLF, không còn \\n hay \\r lẻ', () => {
  const ics = core.buildIcs([SAMPLE, PAST], NOW);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  const stripped = ics.replace(/\r\n/g, '');
  assert.ok(!stripped.includes('\n'), 'có \\n không phải CRLF');
  assert.ok(!stripped.includes('\r'), 'có \\r lẻ');
  assert.equal(ics.split('\r\n')[0], 'BEGIN:VCALENDAR');
});

test('Header .ics đúng theo yêu cầu', () => {
  const lines = unfold(core.buildIcs([SAMPLE], NOW));
  assert.deepEqual(lines.slice(0, 6), [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//blackboard-hcmiu-ics//VN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Blackboard Deadlines'
  ]);
  assert.ok(!icsHasVTIMEZONE(core.buildIcs([SAMPLE], NOW)), 'không cần VTIMEZONE');
});

test('Thông báo tiếng Việt đúng theo yêu cầu', () => {
  assert.equal(
    core.messages.sessionExpired,
    'Phiên đăng nhập có thể đã hết hạn, hãy tải lại trang Blackboard và đăng nhập lại.'
  );
  assert.equal(core.messages.noUpcoming, 'Không có deadline nào sắp tới.');
});

console.log('Giờ Việt Nam (không phụ thuộc múi giờ máy)');

test('Hạn nộp 16:59Z hiển thị 23:59 giờ Việt Nam', () => {
  assert.equal(core.vietnamTimeHHMM('2026-10-12T16:59:00.000Z'), '23:59');
  assert.equal(core.vietnamTimeHHMM('2026-10-12T17:00:00.000Z'), '00:00');
});

test('startOfDayVietnam: 17:30Z 11/10 = 00:00 ngày 12/10 giờ VN', () => {
  const instant = Date.parse('2026-10-11T17:30:00.000Z');
  assert.equal(
    core.startOfDayVietnam(instant),
    Date.parse('2026-10-12T00:00:00+07:00')
  );
  assert.equal(core.vietnamDateISO(instant), '2026-10-12');
  assert.equal(core.vietnamDateDDMMYYYY(instant), '12/10/2026');
});

test('utcCompact đúng định dạng YYYYMMDDTHHMMSSZ', () => {
  assert.equal(core.utcCompact('2026-10-12T16:59:00.000Z'), '20261012T165900Z');
  assert.equal(core.utcCompact(Date.parse('2026-01-01T00:00:00Z')), '20260101T000000Z');
});

console.log('Giai đoạn 2: nội dung Google Calendar');

test('ID Google Calendar: bbhcmiu149008v1, a-v/0-9, ổn định', () => {
  assert.equal(core.googleEventId('_149008_1'), 'bbhcmiu149008v1');
  const id = core.googleEventId('_149008_1');
  assert.match(id, /^[0-9a-v]{5,1024}$/, 'ID phải gồm a-v và 0-9, dài 5..1024');
  assert.equal(core.googleEventId('_149008_1'), id, 'ID phải ổn định giữa các lần chạy');
  // ký tự lạ vẫn cho ID hợp lệ
  const weird = core.googleEventId('_A-1_x!');
  assert.match(weird, /^[0-9a-v]{5,1024}$/);
  assert.notEqual(weird, id);
});

test('Resource Google: summary, description, start/end (UTC Z)', () => {
  const g = core.buildGoogleEvent(SAMPLE);
  assert.equal(g.id, 'bbhcmiu149008v1');
  assert.equal(g.summary, '[IT138IU] Lab 02 Homework (deadline)');
  assert.equal(g.start.dateTime, '2026-10-12T16:29:00Z');
  assert.equal(g.end.dateTime, '2026-10-12T16:59:00Z');
  assert.ok(g.description.includes('Hạn nộp: 23:59'));
  assert.ok(g.description.includes('Blackboard item: _149008_1'));
  assert.ok(g.description.includes('\n'), 'Google nhận xuống dòng thật');
  assert.ok(!g.description.includes('\\n'), 'không escape \\n cho Google');
  assert.equal(g.location, undefined, 'location null thì không gửi');
});

test('Resource Google allDay: date-only, DTEND ngày kế tiếp', () => {
  const ev = Object.assign({}, SAMPLE, {
    allDay: true,
    endDate: '2026-10-11T17:00:00.000Z'
  });
  const g = core.buildGoogleEvent(ev);
  assert.deepEqual(g.start, { date: '2026-10-12' });
  assert.deepEqual(g.end, { date: '2026-10-13' });
});

test('Schema validation: thiếu trường sai kiểu bị loại', () => {
  assert.ok(core.isValidEvent(SAMPLE));
  assert.ok(!core.isValidEvent(null));
  assert.ok(!core.isValidEvent({}));
  assert.ok(!core.isValidEvent(Object.assign({}, SAMPLE, { itemSourceId: '' })));
  assert.ok(!core.isValidEvent(Object.assign({}, SAMPLE, { allDay: 'yes' })));
  assert.ok(!core.isValidEvent(Object.assign({}, SAMPLE, { endDate: 'xxx' })));
  assert.ok(!core.isValidEvent(Object.assign({}, SAMPLE, { title: '  ' })));
});

console.log('Trang sync (Giai đoạn 2)');

test('File sync không lỗi cú pháp, index.html trỏ đúng script', () => {
  for (const f of [
    'sync/sync.js',
    'sync/core.js',
    'src/userscript.body.js',
    'apps-script/Code.gs',
    'extension/bb.js'
  ]) {
    new vm.Script(read(f), { filename: f }); // ném lỗi nếu cú pháp sai
  }
  const html = read('sync/index.html');
  assert.ok(html.includes('<script src="./core.js">'), 'index.html phải nạp core.js');
  assert.ok(html.includes('<script src="./sync.js" defer>'), 'index.html phải nạp sync.js');
  assert.ok(!html.includes('accounts.google.com'), 'không còn nạp Google Identity Services');
  assert.ok(!html.includes('client_secret'), 'không có client secret');
});

test('Trang sync: kiểm tra origin hai chiều, schema, không dùng "*"', () => {
  const src = read('sync/sync.js');
  assert.ok(src.includes('event.origin !== ALLOWED_ORIGIN'), 'phải kiểm tra origin');
  assert.ok(src.includes('event.source !== window.opener'), 'phải kiểm tra nguồn gửi');
  assert.ok(
    src.includes("const ALLOWED_ORIGIN = 'https://blackboard.hcmiu.edu.vn'"),
    'origin mong đợi phải là Blackboard'
  );
  assert.ok(src.includes('Array.isArray(data.events)'), 'validate mảng sự kiện');
  assert.ok(src.includes('core.isValidEvent'), 'validate schema từng sự kiện');
  assert.ok(src.includes("type: 'bbhcmiu-ready'"), 'gửi ready cho opener');
  assert.ok(src.includes("data.type !== 'bbhcmiu-events'"), 'nhận events');
  assert.ok(src.includes("type: 'bbhcmiu-result'"), 'gửi kết quả về');
  assert.ok(
    !/postMessage\([^)]*['"]\*['"]/.test(src),
    'không được dùng targetOrigin "*"'
  );
  const built = read('blackboard-deadlines.user.js');
  assert.ok(
    built.includes('event.origin !== BB_SYNC_ORIGIN'),
    'userscript phải kiểm tra origin của trang sync'
  );
});

test('Giai đoạn 2: relay Apps Script, không Client ID, upsert insert→409→patch', () => {
  const src = read('sync/sync.js');
  assert.ok(
    src.includes('https://script.google.com/macros/s/'),
    'trỏ tới Apps Script web app'
  );
  assert.ok(!src.includes('googleusercontent.com'), 'không còn Client ID OAuth');
  assert.ok(src.includes("type: 'bbhcmiu-sync'"), 'gửi đúng loại thông điệp');
  assert.ok(src.includes('core.buildGoogleEvent'), 'dựng resource bằng core');
  const gs = read('apps-script/Code.gs');
  assert.ok(gs.includes('Calendar.Events.insert'), 'Apps Script insert sự kiện');
  assert.ok(gs.includes('Calendar.Events.patch'), '409 thì patch cùng ID');
  assert.ok(gs.includes('getCalendarsByName'), 'tìm hoặc tạo lịch Blackboard Deadlines');
  assert.ok(
    gs.includes("CALENDAR_NAME = 'Blackboard Deadlines'"),
    'tên lịch đúng'
  );
});

console.log('File build & an ninh');

test('Smoke tầng DOM (stub Node): nút → fetch → .ics, postMessage 2 chiều', () => {
  const { execFileSync } = require('node:child_process');
  const out = execFileSync(
    process.execPath,
    [path.join(__dirname, 'dom-smoke.js')],
    { encoding: 'utf8' }
  );
  assert.match(out, /DOM smoke: OK/);
});

test('blackboard-deadlines.user.js build đúng và export được core', () => {
  const built = require('../blackboard-deadlines.user.js');
  assert.equal(typeof built.buildIcs, 'function');
  assert.equal(typeof built.googleEventId, 'function');
  assert.equal(built.googleEventId('_149008_1'), 'bbhcmiu149008v1');
  // chạy lại 1 test lõi trên file đã build
  const lines = unfold(built.buildIcs([SAMPLE], NOW));
  assert.ok(lines.includes('DTEND:20261012T165900Z'));
});

test('Metadata userscript: @match, @run-at, @grant none, không GM_xmlhttpRequest', () => {
  const src = read('blackboard-deadlines.user.js');
  assert.match(src, /@match\s+https:\/\/blackboard\.hcmiu\.edu\.vn\/webapps\/calendar\/\*/);
  assert.match(src, /@run-at\s+document-idle/);
  assert.match(src, /@grant\s+none/);
  assert.ok(!src.includes('GM_xmlhttpRequest'), 'không được dùng GM_xmlhttpRequest');
  assert.ok(src.includes("credentials: 'same-origin'"), 'phải fetch same-origin');
  assert.ok(src.includes('Xuất deadline (.ics)'));
  assert.ok(src.includes('Đồng bộ Google Calendar'));
  assert.ok(src.includes(core.messages.sessionExpired));
  assert.ok(src.includes(core.messages.noUpcoming));
  assert.ok(src.includes("type === 'bbhcmiu-ready'"), 'phải kiểm tra thông điệp ready');
  assert.ok(
    !/postMessage\(\s*\{[\s\S]*?\}\s*,\s*['"]\*['"]\s*\)/.test(src),
    'không được dùng targetOrigin "*"'
  );
});

test('sync/core.js là bản sao đồng bộ của src/core.js', () => {
  assert.equal(read('sync/core.js'), read('src/core.js'));
});

test('Extension MV3: content script trang calendar, không xin quyền thừa', () => {
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.ok(
    !manifest.permissions || manifest.permissions.length === 0,
    'không xin quyền thừa'
  );
  const cs = manifest.content_scripts[0];
  assert.ok(
    cs.matches.includes('https://blackboard.hcmiu.edu.vn/webapps/calendar/*'),
    'match đúng trang calendar'
  );
  assert.equal(cs.run_at, 'document_idle');
  assert.equal(
    read('extension/bb.js'),
    read('blackboard-deadlines.user.js'),
    'bb.js phải là file built'
  );
});

test('Chỉ gọi các domain được phép', () => {
  const allowed = new Set([
    'blackboard.hcmiu.edu.vn',
    'accounts.google.com',
    'www.googleapis.com',
    'your-username.github.io', // trang sync (placeholder, đổi theo repo của bạn)
    'localhost', // trang sync local khi test
    'script.google.com' // Apps Script relay (Giai đoạn 2)
  ]);
  const files = [
    'src/core.js',
    'src/userscript.body.js',
    'src/userscript.meta.js',
    'sync/sync.js',
    'sync/index.html',
    'apps-script/Code.gs',
    'bookmarklet/bookmarklet.js',
    'extension/manifest.json',
    'blackboard-deadlines.user.js'
  ].filter((f) => {
    const exists = fs.existsSync(path.join(root, f));
    if (!exists) console.log('      (bỏ qua, chưa có ' + f + ')');
    return exists;
  });
  for (const f of files) {
    const text = read(f);
    const urls = text.match(/https?:\/\/[^\s'"`)<>\\]+/g) || [];
    for (const u of urls) {
      let host;
      try {
        host = new URL(u).hostname.toLowerCase();
      } catch (e) {
        continue;
      }
      assert.ok(
        allowed.has(host),
        f + ' chứa URL ngoài danh sách cho phép: ' + u
      );
    }
  }
});

test('Không có token/secret/mật khẩu nào trong repo', () => {
  const patterns = [
    { name: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { name: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
    { name: 'client_secret', re: /client_secret\s*[:=]\s*["'][^"']{8,}/i },
    { name: 'GitHub token', re: /gh[pousr]_[A-Za-z0-9]{30,}/ },
    { name: 'Bearer token', re: /Bearer\s+[A-Za-z0-9._-]{25,}/ }
  ];
  const skipDirs = new Set(['.git', 'node_modules']);
  const exts = new Set(['.js', '.md', '.html', '.json', '.svg', '.gs', '']);
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skipDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (exts.has(path.extname(entry.name))) out.push(full);
    }
    return out;
  };
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const p of patterns) {
      assert.ok(
        !p.re.test(text),
        path.relative(root, file) + ' chứa ' + p.name
      );
    }
  }
});

function icsHasVTIMEZONE(ics) {
  return ics.includes('VTIMEZONE');
}

/* Tổng kết */

console.log('');
console.log('Kết quả: ' + passed + ' qua, ' + failed + ' lỗi');
if (failed > 0) process.exit(1);
