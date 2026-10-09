// Trang sync Giai đoạn 2: ghi deadline vào Google Calendar của CHÍNH NGƯỜI DÙNG.
// Nhận sự kiện từ userscript qua postMessage, mở popup form POST sang Apps Script
// (điều hướng thật nên mang được cookie Google, thứ fetch CORS không làm được).
(function () {
  'use strict';

  /* Cấu hình */

  // URL Apps Script web app (Deploy => New deployment => Web app,
  // Execute as: User accessing, Who has access: Anyone), đổi rồi reload trang.
  const RELAY_URL = 'https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec';
  // Chỉ cần điền nếu người vận hành đặt Script Property "token" trong Apps Script.
  const RELAY_TOKEN = '';

  /** Chỉ nhận postMessage từ trang Blackboard của trường. */
  const ALLOWED_ORIGIN = 'https://blackboard.hcmiu.edu.vn';

  const RELAY_ORIGIN = new URL(RELAY_URL).origin;

  const core = window.createBbCore();
  const messages = core.messages;

  let upcomingEvents = []; // đã validate và lọc chưa qua hạn
  let syncing = false;
  let relayPopup = null;
  let relayNonce = null;
  let relayTimer = null;

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

  /* Nhận kết quả từ popup Apps Script */

  window.addEventListener('message', function (event) {
    if (event.origin !== RELAY_ORIGIN) return;
    if (!relayPopup || event.source !== relayPopup) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'bbhcmiu-result') return;
    if (!relayNonce || data.nonce !== relayNonce) return;
    relayNonce = null;
    clearTimeout(relayTimer);
    showSummary(data.created || 0, data.updated || 0, data.failed || 0, data.errors || []);
  });

  /* Gửi sang Apps Script relay qua popup form POST */

  function randomNonce() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function openRelay(resources) {
    relayNonce = randomNonce();
    const payload = JSON.stringify({
      type: 'bbhcmiu-sync',
      nonce: relayNonce,
      token: RELAY_TOKEN,
      origin: location.origin,
      events: resources
    });
    relayPopup = window.open('', 'bbhcmiu-relay', 'width=560,height=680');
    if (!relayPopup) return false;
    relayPopup.document.write(
      '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">' +
        '<title>Đồng bộ Google Calendar</title></head><body>' +
        '<form method="POST" action="' +
        RELAY_URL +
        '"><input type="hidden" name="payload" value="' +
        payload.replace(/"/g, '&quot;') +
        '"></form>' +
        '<script>document.forms[0].submit();</' +
        'script></body></html>'
    );
    relayPopup.document.close();
    return true;
  }

  async function runSync() {
    const resources = upcomingEvents.map(core.buildGoogleEvent);
    $('error-list').textContent = '';

    if (!openRelay(resources)) {
      $('result').textContent =
        'Trình duyệt chặn cửa sổ bật lên, hãy cho phép popup cho trang này rồi thử lại.';
      return;
    }
    $('result').textContent =
      'Đang mở cửa sổ đồng bộ… Lần đầu Google sẽ hỏi bạn ủy quyền 1 lần.';
    clearTimeout(relayTimer);
    relayTimer = setTimeout(function () {
      if (!relayNonce) return;
      $('result').textContent =
        'Chưa nhận được kết quả. Nếu cửa sổ mở ra yêu cầu đăng nhập hoặc Allow, hoàn tất rồi bấm Đồng bộ lại. ';
      const link = document.createElement('a');
      link.href = RELAY_URL;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Mở trang ủy quyền';
      $('result').appendChild(link);
    }, 12000);
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
