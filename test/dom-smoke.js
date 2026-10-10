// Smoke test tầng DOM/fetch của userscript bằng stub trong Node, không mạng.
// Chạy: node test/dom-smoke.js, test/test.js gọi file này như process con.
'use strict';

const assert = require('node:assert/strict');

/* Stub DOM tối giản */

const registry = {};

function makeEl(tag) {
  const el = {
    tagName: tag,
    style: { cssText: '' },
    children: [],
    listeners: {},
    textContent: '',
    className: '',
    disabled: false,
    attributes: {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    setAttribute(key, value) {
      this.attributes[key] = value;
    },
    click() {
      (this.listeners.click || []).forEach((fn) => fn());
    },
    remove() {}
  };
  Object.defineProperty(el, 'id', {
    get() {
      return el._id || '';
    },
    set(value) {
      el._id = value;
      registry[value] = el;
    }
  });
  return el;
}

const messageListeners = [];
let openedWindow = null;

global.document = {
  body: makeEl('body'),
  createElement: makeEl,
  getElementById: (id) => registry[id] || null,
  addEventListener: () => {}
};
global.window = {
  addEventListener: (type, fn) => {
    if (type === 'message') messageListeners.push(fn);
  },
  open: () => openedWindow
};

/* Blob thật của Node; chỉ chặn createObjectURL để bắt file tải về. */
let downloadedBlob = null;
URL.createObjectURL = (blob) => {
  downloadedBlob = blob;
  return 'blob:fake';
};
URL.revokeObjectURL = () => {};

/* fetch giả: trả về 1 deadline sắp tới. */
const SAMPLE = {
  title: 'Lab 02 Homework',
  startDate: new Date(Date.now() + 2 * 86400000).toISOString(),
  endDate: new Date(Date.now() + 2 * 86400000).toISOString(),
  allDay: false,
  calendarId: 'IT138IU_1_2026-270101',
  calendarName: 'Môn mẫu (dữ liệu giả)',
  itemSourceId: '_149008_1',
  eventType: 'Assignment',
  location: null
};
const fetchCalls = [];
global.fetch = async (url, options) => {
  fetchCalls.push({ url, options });
  return { ok: true, json: async () => [SAMPLE] };
};

/* Nạp userscript với stub */

require('../blackboard-deadlines.user.js');

/* Đọc origin trang sync từ chính file build để không hardcode. */
const fs = require('node:fs');
const SYNC_ORIGIN = new URL(
  /SYNC_PAGE_URL:\s*'([^']+)'/.exec(
    fs.readFileSync(require.resolve('../blackboard-deadlines.user.js'), 'utf8')
  )[1]
).origin;

const ROOT = 'bbhcmiu-deadlines-root';

/* 1. Nút nổi được chèn, đúng nhãn. */
assert.ok(registry[ROOT], 'thiếu root');
assert.equal(registry[ROOT + '-export'].textContent, 'Xuất deadline (.ics)');
assert.equal(registry[ROOT + '-sync'].textContent, 'Đồng bộ Google Calendar');

/* 2. Bấm xuất → fetch endpoint → file .ics → thông báo. */
(async () => {
  await registry[ROOT + '-export'].listeners.click[0]();

  assert.equal(fetchCalls.length, 1, 'phải gọi fetch 1 lần');
  const call = fetchCalls[0];
  assert.ok(
    call.url.startsWith(
      '/webapps/calendar/calendarData/selectedCalendarEvents?start='
    ),
    'sai endpoint: ' + call.url
    );
  assert.ok(call.url.includes('&end='), 'thiếu end');
  assert.ok(call.url.endsWith('&course_id=&mode=personal'), 'thiếu mode=personal');
  assert.ok(Number.isInteger(Number(call.url.match(/start=(\d+)/)[1])), 'start phải là số nguyên ms');
  assert.equal(call.options.credentials, 'same-origin');

  assert.ok(downloadedBlob, 'chưa tải file');
  const ics = await downloadedBlob.text();
  assert.ok(ics.includes('BEGIN:VCALENDAR\r\n'), 'ICS sai CRLF');
  assert.ok(ics.includes('UID:_149008_1@blackboard.hcmiu.edu.vn'));
  assert.ok(ics.includes('SUMMARY:[IT138IU] Lab 02 Homework (deadline)'));

  const toast = registry[ROOT + '-toast'];
  assert.match(toast.textContent, /^Đã tải blackboard-deadlines-\d{4}-\d{2}-\d{2}\.ics \(1 deadline\)\.$/);
  assert.equal(registry[ROOT + '-export'].disabled, false, 'nút phải bật lại sau khi xuất');

  /* 3. Bấm đồng bộ → mở trang → "ready" → nhận mảng sự kiện. */
  const posted = [];
  openedWindow = {
    closed: false,
    postMessage(message, origin) {
      posted.push({ message, origin });
    }
  };
  registry[ROOT + '-sync'].click();

  messageListeners.forEach((fn) =>
    fn({
      origin: SYNC_ORIGIN,
      source: openedWindow,
      data: { type: 'bbhcmiu-ready' }
    })
  );
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(posted.length, 1, 'phải postMessage về trang sync 1 lần');
  assert.equal(posted[0].origin, SYNC_ORIGIN, 'targetOrigin phải đúng trang sync');
  assert.equal(posted[0].message.type, 'bbhcmiu-events');
  assert.equal(posted[0].message.events.length, 1);
  assert.equal(posted[0].message.events[0].itemSourceId, '_149008_1');
  assert.equal(fetchCalls.length, 2, 'chuỗi ready cũng phải lấy dữ liệu Blackboard');

  /* 4. Sai origin / sai cửa sổ gửi → bỏ qua. */
  messageListeners.forEach((fn) =>
    fn({
      origin: 'https://evil.example',
      source: openedWindow,
      data: { type: 'bbhcmiu-ready' }
    })
  );
  messageListeners.forEach((fn) =>
    fn({
      origin: SYNC_ORIGIN,
      source: {}, // không phải cửa sổ sync mình mở
      data: { type: 'bbhcmiu-ready' }
    })
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(posted.length, 1, 'thông điệp sai nguồn phải bị bỏ qua');
  assert.equal(fetchCalls.length, 2, 'không được fetch thêm khi sai nguồn');

  console.log('DOM smoke: OK');
  process.exit(0);
})().catch((err) => {
  console.error('DOM smoke FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
