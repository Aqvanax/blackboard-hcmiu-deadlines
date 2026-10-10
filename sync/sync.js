// Trang sync Giai đoạn 2: ghi deadline vào Google Calendar của CHÍNH NGƯỜI DÙNG.
// Nhận sự kiện từ userscript qua postMessage, mở popup form POST sang Apps Script
// (điều hướng thật nên mang được cookie Google, thứ fetch CORS không làm được).
(function () {
  'use strict';

  /* Cấu hình */

  // URL Apps Script web app (Deploy => New deployment => Web app,
  // Execute as: User accessing, Who has access: Anyone), đổi rồi reload trang.
  const RELAY_URL =
    'https://script.google.com/macros/s/AKfycbwV1nncEnQ_b2sUD-ba0px4KK3WcC3E63JcCQXfTgnLaqx4_bh_SktdSuhhoZcYqbA5/exec';
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
  let relayPollTimer = null;
  let relayJsonpTimer = null;
  let relayJsonpTries = 0;
  let jsonpScript = null;

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

  /* Nhận kết quả: qua localStorage khi popup mất opener vì COOP, qua
     postMessage khi còn. Xác thực hoàn toàn bằng nonce sinh trong runSync. */

  function stopWaitingResult() {
    clearTimeout(relayTimer);
    clearInterval(relayPollTimer);
    clearInterval(relayJsonpTimer);
    if (jsonpScript) {
      try {
        jsonpScript.remove();
      } catch (err) {}
      jsonpScript = null;
    }
  }

  function acceptResult(data) {
    if (!data || data.type !== 'bbhcmiu-result') return false;
    if (!relayNonce || data.nonce !== relayNonce) return false;
    relayNonce = null;
    stopWaitingResult();
    /* Popup có thể còn đứng ở trang text/plain: đóng nốt nếu handle còn sống.
       Đóng sau khi có kết quả để không phá màn hình ủy quyền lần đầu. */
    try {
      if (relayPopup && !relayPopup.closed) relayPopup.close();
    } catch (err) {}
    showSummary(data.created || 0, data.updated || 0, data.failed || 0, data.errors || []);
    return true;
  }

  /* JSONP: nạp script từ relay, mime JAVASCRIPT nên chạy được cả khi hop
     không render (text/plain) và khi COOP cắt mọi kênh còn lại. */
  function jsonpPoll() {
    if (!relayNonce) return;
    if (jsonpScript) {
      try {
        jsonpScript.remove();
      } catch (err) {}
      jsonpScript = null;
    }
    if (relayJsonpTries++ >= 20) return;
    const s = document.createElement('script');
    s.src =
      RELAY_URL +
      '?action=result&callback=bbhcmiuPoll&nonce=' +
      relayNonce +
      '&_=' +
      Date.now();
    s.async = true;
    s.onerror = function () {
      /* relay chưa chạy xong hoặc thiếu cookie: bỏ qua, vòng sau thử tiếp. */
    };
    document.body.appendChild(s);
    jsonpScript = s;
  }

  window.bbhcmiuPoll = function (data) {
    acceptResult(data);
  };

  window.addEventListener('message', function (event) {
    if (event.origin !== RELAY_ORIGIN && event.origin !== location.origin) return;
    acceptResult(event.data);
  });

  window.addEventListener('storage', function (event) {
    if (event.key !== 'bbhcmiuResult' || !event.newValue) return;
    let data = null;
    try {
      data = JSON.parse(event.newValue);
    } catch (err) {
      return;
    }
    /* Không xoá khi nonce lệch, cửa sổ sync khác có thể đang chờ kết quả này. */
    if (acceptResult(data)) {
      try {
        localStorage.removeItem('bbhcmiuResult');
      } catch (err) {}
    }
  });

  /* COOP có thể chặn cả event giữa 2 cửa sổ, nên vừa nghe vừa đọc tay cho chắc. */
  function startWaitingResult() {
    stopWaitingResult();
    /* Key cũ là rác của lần đồng bộ trước, xoá khỏi đầu để khỏi đọc nhầm. */
    try {
      localStorage.removeItem('bbhcmiuResult');
    } catch (err) {}
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
    relayPollTimer = setInterval(function () {
      let raw = null;
      try {
        raw = localStorage.getItem('bbhcmiuResult');
      } catch (err) {
        return;
      }
      if (!raw) return;
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        return;
      }
      /* Đọc tay cũng bỏ qua nonce lệch, chỉ xoá khi thực sự tiêu thụ. */
      if (acceptResult(data)) {
        try {
          localStorage.removeItem('bbhcmiuResult');
        } catch (err) {}
      }
    }, 700);
    /* Kênh thứ hai: JSONP hỏi thẳng relay, không qua popup. */
    relayJsonpTries = 0;
    jsonpPoll();
    relayJsonpTimer = setInterval(jsonpPoll, 1500);
  }

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
      syncUrl: new URL('done.html', location.href).href,
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
    startWaitingResult();
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

  /* Cầu nối: Apps Script điều hướng popup về done.html cùng nguồn, kết quả
     nằm trong query. Popup đi accounts.google.com nên opener có thể đã bị COOP
     cắt, done.html chuyển kết quả sang đây qua localStorage. */
  startHandshake();
})();
