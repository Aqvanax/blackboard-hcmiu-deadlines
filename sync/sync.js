// Trang sync Giai đoạn 2: ghi deadline vào Google Calendar qua Apps Script relay.
// Nhận sự kiện từ userscript qua postMessage, gửi resource đã dựng tới Apps Script.
(function () {
  'use strict';

  /* Cấu hình */

  // URL Apps Script web app (Deploy => New deployment => Web app), đổi rồi reload trang.
  const RELAY_URL = 'https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec';
  // Chỉ cần điền nếu người vận hành đặt Script Property "token" trong Apps Script.
  const RELAY_TOKEN = '';

  /** Chỉ nhận postMessage từ trang Blackboard của trường. */
  const ALLOWED_ORIGIN = 'https://blackboard.hcmiu.edu.vn';

  const core = window.createBbCore();
  const messages = core.messages;

  let upcomingEvents = []; // đã validate và lọc chưa qua hạn
  let syncing = false;

  const $ = (id) => document.getElementById(id);

  /* Nhận dữ liệu từ userscript */

  function postToOpener(message) {
    if (!window.opener || window.opener.closed) return false;
    try {
      /* targetOrigin cố định, không dùng wildcard */
      window.opener.postMessage(message, ALLOWED_ORIGIN);
      return true;
    } catch (err) {
      return false;
    }
  }

  function setStatus(text, kind) {
    const node = $('status');
    node.textContent = text;
    node.className = 'status' + (kind ? ' ' + kind : '');
  }

  function startHandshake() {
    if (!window.opener) {
      setStatus(
        'Hãy mở trang này từ nút “Đồng bộ Google Calendar” trong userscript trên Blackboard.',
        'error'
      );
      return;
    }
    setStatus('Đang chờ Blackboard gửi danh sách deadline…');
    postToOpener({ type: 'bbhcmiu-ready' });
  }

  function renderEventList(list) {
    const ul = $('event-list');
    ul.textContent = '';
    for (const ev of list) {
      const li = document.createElement('li');
      const when = ev.allDay
        ? core.vietnamDateDDMMYYYY(ev.endDate)
        : core.vietnamTimeHHMM(ev.endDate) +
          ' ' +
          core.vietnamDateDDMMYYYY(ev.endDate);
      li.textContent = core.buildSummary(ev) + ': ';
      const span = document.createElement('span');
      span.className = 'time';
      span.textContent = when + ' (giờ VN)';
      li.appendChild(span);
      ul.appendChild(li);
    }
  }

  function receiveEvents(raw) {
    /* Validate schema từng phần tử, sau đó loại deadline đã qua hạn. */
    const valid = raw.filter(core.isValidEvent);
    upcomingEvents = core.filterUpcoming(valid, Date.now());
    renderEventList(upcomingEvents);

    if (upcomingEvents.length === 0) {
      setStatus(messages.noUpcoming, 'info');
      $('sync-btn').disabled = true;
      return;
    }
    setStatus(
      'Đã nhận ' + upcomingEvents.length + ' deadline chưa qua hạn.',
      'ok'
    );
    $('sync-btn').disabled = false;
  }

  window.addEventListener('message', function (event) {
    /* Chỉ tin thông điệp từ cửa sổ Blackboard đã mở trang này. */
    if (event.origin !== ALLOWED_ORIGIN) return;
    if (!window.opener || event.source !== window.opener) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'bbhcmiu-events') return;
    if (!Array.isArray(data.events)) return;
    receiveEvents(data.events);
  });

  /* Gửi sang Apps Script relay */

  async function callRelay(resources) {
    const res = await fetch(RELAY_URL, {
      method: 'POST',
      // text/plain để Apps Script trả JSON qua CORS, không cần preflight
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        type: 'bbhcmiu-sync',
        token: RELAY_TOKEN,
        events: resources
      })
    });
    return res.json();
  }

  async function runSync() {
    $('result').textContent = 'Đang đồng bộ…';
    $('error-list').textContent = '';
    const resources = upcomingEvents.map(core.buildGoogleEvent);

    let data;
    try {
      data = await callRelay(resources);
    } catch (err) {
      $('result').textContent =
        'Không gọi được Apps Script, kiểm tra RELAY_URL và trạng thái deploy.';
      setStatus('Đồng bộ chưa hoàn tất.', 'error');
      return;
    }
    if (!data || data.ok !== true) {
      const msg = data && data.error ? data.error : 'phản hồi không hợp lệ';
      $('result').textContent = 'Lỗi: ' + msg;
      postToOpener({
        type: 'bbhcmiu-result',
        created: 0,
        updated: 0,
        failed: 0,
        error: msg
      });
      return;
    }

    showSummary(data.created || 0, data.updated || 0, data.failed || 0, data.errors || []);
  }

  function showSummary(created, updated, failed, errors) {
    const text =
      'Đồng bộ xong: tạo mới ' +
      created +
      ', cập nhật ' +
      updated +
      (failed > 0 ? ', lỗi ' + failed : '') +
      '.';
    $('result').textContent = text;

    const ul = $('error-list');
    ul.textContent = '';
    errors.slice(0, 5).forEach(function (line) {
      const li = document.createElement('li');
      li.textContent = line;
      ul.appendChild(li);
    });
    if (errors.length > 5) {
      const li = document.createElement('li');
      li.textContent = '…và ' + (errors.length - 5) + ' lỗi khác.';
      ul.appendChild(li);
    }

    /* Báo lại cho userscript hiển thị kết quả trên Blackboard. */
    postToOpener({
      type: 'bbhcmiu-result',
      created: created,
      updated: updated,
      failed: failed
    });
  }

  /* Gắn giao diện */

  $('sync-btn').addEventListener('click', async function () {
    if (syncing) return;
    if (upcomingEvents.length === 0) {
      setStatus(messages.noUpcoming, 'info');
      return;
    }
    if (RELAY_URL.indexOf('YOUR_DEPLOY_ID') > 0) {
      $('result').textContent =
        'Chưa cấu hình RELAY_URL cho trang sync, xem README (mục Apps Script).';
      return;
    }
    syncing = true;
    $('sync-btn').disabled = true;
    try {
      await runSync();
    } finally {
      syncing = false;
      $('sync-btn').disabled = false;
    }
  });

  startHandshake();
})();
