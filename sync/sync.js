// Trang sync Giai đoạn 2: ghi deadline vào Google Calendar ngay từ trình duyệt.
// Nhận sự kiện từ userscript qua postMessage, đăng nhập Google bằng luồng token.
(function () {
  'use strict';

  /* Cấu hình */

  // Client ID dạng Web application (Google Cloud Console).
  // Để placeholder ở đây, mỗi người tự dán trong trang này lần đầu (lưu localStorage).
  const CLIENT_ID_DEFAULT = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
  const CLIENT_ID_KEY = 'bbhcmiu-google-client-id';

  // Scope tối thiểu đã kiểm tra trong tài liệu Google,
  // chỉ tạo và ghi vào lịch do chính ứng dụng này tạo.
  const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

  /** Chỉ nhận postMessage từ trang Blackboard của trường. */
  const ALLOWED_ORIGIN = 'https://blackboard.hcmiu.edu.vn';

  const SYNC_CALENDAR_NAME = 'Blackboard Deadlines';
  const CALENDAR_ID_STORAGE_KEY = 'bbhcmiu-google-calendar-id';
  const API_BASE = 'https://www.googleapis.com/calendar/v3';

  const core = window.createBbCore();
  const messages = core.messages;

  let upcomingEvents = []; // đã validate và lọc chưa qua hạn
  let accessToken = null; // chỉ giữ trong RAM, không lưu xuống ổ đĩa
  let tokenClient = null;
  let tokenResolve = null;
  let tokenReject = null;
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

  /* Google Identity Services */

  function waitForGis() {
    return new Promise(function (resolve, reject) {
      const deadline = Date.now() + 15000;
      (function poll() {
        if (
          window.google &&
          window.google.accounts &&
          window.google.accounts.oauth2
        ) {
          resolve();
          return;
        }
        if (Date.now() > deadline) {
          reject(
            new Error('Không tải được thư viện đăng nhập Google (accounts.google.com).')
          );
          return;
        }
        setTimeout(poll, 100);
      })();
    });
  }

  function handleTokenResponse(resp) {
    const resolve = tokenResolve;
    const reject = tokenReject;
    tokenResolve = null;
    tokenReject = null;
    if (!resolve) return;
    if (resp && resp.error) {
      reject(
        new Error(
          'Google không cấp quyền: ' + (resp.error_description || resp.error)
        )
      );
    } else if (resp && resp.access_token) {
      resolve(resp.access_token);
    } else {
      reject(new Error('Không nhận được access token từ Google.'));
    }
  }

  function requestAccessToken() {
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId(),
        scope: SCOPE,
        callback: handleTokenResponse,
        /* Popup bị đóng hoặc không mở được thì không treo promise */
        error_callback: function (err) {
          const reject = tokenReject;
          tokenResolve = null;
          tokenReject = null;
          if (!reject) return;
          reject(
            new Error(
              err && err.type === 'popup_failed_to_open'
                ? 'Không mở được cửa sổ đăng nhập Google.'
                : 'Cửa sổ đăng nhập Google bị đóng trước khi hoàn tất.'
            )
          );
        }
      });
    }
    return new Promise(function (resolve, reject) {
      tokenResolve = resolve;
      tokenReject = reject;
      tokenClient.requestAccessToken({
        prompt: accessToken ? '' : 'consent'
      });
    });
  }

  /* Google Calendar API */

  async function callApi(url, method, body) {
    let res;
    try {
      res = await fetch(url, {
        method: method,
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (err) {
      return { ok: false, status: 0, body: null, networkError: true };
    }
    let parsed = null;
    try {
      parsed = JSON.parse(await res.text());
    } catch (err) {
      parsed = null;
    }
    return { ok: res.ok, status: res.status, body: parsed };
  }

  function describeError(res, fallback) {
    if (res.networkError) return 'không gọi được www.googleapis.com';
    if (res.body && res.body.error && res.body.error.message)
      return res.body.error.message;
    if (res.status) return 'HTTP ' + res.status;
    return fallback;
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      /* localStorage bị chặn thì lần sau sẽ thử tìm lại lịch */
    }
  }

  // Đọc Client ID: localStorage trước, không có thì dùng placeholder.
  function clientId() {
    const saved = storageGet(CLIENT_ID_KEY);
    if (saved && saved.indexOf('.apps.googleusercontent.com') > 0) return saved;
    return CLIENT_ID_DEFAULT;
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      /* bỏ qua */
    }
  }

  // Tìm lịch "Blackboard Deadlines" hoặc tạo mới. Scope hẹp không cho
  // calendarList.list nên ID lưu ở localStorage để dùng lại lần sau.
  async function ensureCalendar() {
    const stored = storageGet(CALENDAR_ID_STORAGE_KEY);
    if (stored) return stored;

    const list = await callApi(
      API_BASE + '/users/me/calendarList?maxResults=250&showHidden=true',
      'GET'
    );
    if (list.ok && list.body && Array.isArray(list.body.items)) {
      const found = list.body.items.find(function (item) {
        return item && item.summary === SYNC_CALENDAR_NAME;
      });
      if (found && found.id) {
        storageSet(CALENDAR_ID_STORAGE_KEY, found.id);
        return found.id;
      }
    }
    return createCalendar();
  }

  async function createCalendar() {
    const res = await callApi(API_BASE + '/calendars', 'POST', {
      summary: SYNC_CALENDAR_NAME,
      timeZone: 'Asia/Ho_Chi_Minh'
    });
    if (!res.ok || !res.body || !res.body.id) {
      throw new Error(
        'Không tạo được lịch “' + SYNC_CALENDAR_NAME + '”: ' +
          describeError(res, 'lỗi không rõ')
      );
    }
    storageSet(CALENDAR_ID_STORAGE_KEY, res.body.id);
    return res.body.id;
  }

  // Ghi 1 sự kiện với ID cố định: insert, nếu 409 thì update cùng ID.
  // Nhờ vậy chạy lại không nhân đôi.
  async function upsertEvent(calendarId, event) {
    const base =
      API_BASE +
      '/calendars/' +
      encodeURIComponent(calendarId) +
      '/events';
    let res = await callApi(base, 'POST', event);
    if (res.status === 409) {
      res = await callApi(
        base + '/' + encodeURIComponent(event.id),
        'PUT',
        event
      );
      if (res.ok) return { outcome: 'updated' };
      return { outcome: 'failed', error: describeError(res, 'update thất bại') };
    }
    if (res.ok) return { outcome: 'created' };
    if (res.status === 404) return { outcome: 'calendar-missing' };
    if (res.status === 401) return { outcome: 'unauthorized' };
    return { outcome: 'failed', error: describeError(res, 'insert thất bại') };
  }

  async function runSync() {
    $('result').textContent = 'Đang đồng bộ…';
    $('error-list').textContent = '';

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    try {
      let calendarId = await ensureCalendar();

      for (const ev of upcomingEvents) {
        const payload = core.buildGoogleEvent(ev);
        let outcome = await upsertEvent(calendarId, payload);

        if (outcome.outcome === 'calendar-missing') {
          /* Lịch bị xóa trên Google thì tạo lại và thử lại đúng 1 lần. */
          storageRemove(CALENDAR_ID_STORAGE_KEY);
          calendarId = await createCalendar();
          outcome = await upsertEvent(calendarId, payload);
        }

        if (outcome.outcome === 'created') created++;
        else if (outcome.outcome === 'updated') updated++;
        else if (outcome.outcome === 'unauthorized') {
          throw new Error('Phiên Google đã hết hạn, hãy bấm nút đăng nhập lại.');
        } else {
          failed++;
          errors.push(
            payload.summary + ': ' + (outcome.error || 'lỗi không rõ')
          );
        }
      }
    } catch (err) {
      const msg = err && err.message ? err.message : 'lỗi không rõ';
      $('result').textContent = 'Lỗi: ' + msg;
      /* Báo lại cho userscript hiển thị lỗi trên Blackboard. */
      postToOpener({
        type: 'bbhcmiu-result',
        created: created,
        updated: updated,
        failed: failed,
        error: msg
      });
      return;
    }

    showSummary(created, updated, failed, errors);
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
    if (clientId().indexOf('YOUR_CLIENT_ID') === 0) {
      const typed = window.prompt(
        'Chưa cấu hình Client ID. Dán Client ID Google của bạn (Web application, Google Cloud Console):',
        ''
      );
      if (!typed) return;
      const clean = typed.trim();
      if (clean.indexOf('.apps.googleusercontent.com') <= 0) {
        $('result').textContent = 'Client ID không đúng định dạng, chưa lưu.';
        return;
      }
      storageSet(CLIENT_ID_KEY, clean);
      $('result').textContent = 'Đã lưu Client ID cho trình duyệt này.';
      return;
    }
    syncing = true;
    $('sync-btn').disabled = true;
    try {
      await waitForGis();
      accessToken = await requestAccessToken();
      await runSync();
    } catch (err) {
      $('result').textContent =
        'Lỗi: ' + (err && err.message ? err.message : 'không rõ');
      setStatus('Đồng bộ chưa hoàn tất.', 'error');
    } finally {
      syncing = false;
      $('sync-btn').disabled = false;
    }
  });

  startHandshake();
})();
