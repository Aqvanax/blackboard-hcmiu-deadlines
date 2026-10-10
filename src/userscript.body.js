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
