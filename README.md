# Blackboard HCMIU Deadlines → Google Calendar

English · [Tiếng Việt](./README.vi.md)

A small script for the Blackboard Learn calendar at HCMIU. Press one button and it
collects your **upcoming deadlines** (past ones are never exported) and either:

- **Export (always available):** downloads a standard `.ics` file (RFC 5545) you
  import into Google Calendar or any calendar app, or
- **Sync (optional):** writes them straight into a Google Calendar named
  **"Blackboard Deadlines"** that belongs to you — no manual import.

Everything runs in **your browser**: no server of ours, no analytics, no data
collection, and it never asks for your Blackboard password. It reads the next
180 days (configurable) and drops anything already past its end time.

![Mock screenshot: floating buttons and success toast on the Blackboard calendar (fake data)](docs/screenshot-export.svg)

## 1. Install

Three options, all running the same built code.

- Shortest path: open <https://aqvanax.github.io/blackboard-hcmiu-deadlines/> and
  drag its bookmarklet button onto your bookmarks bar.

**Option 1 — Browser extension** (no Tampermonkey)

1. `node build.js` — generates `extension/bb.js`.
2. Chrome/Edge → `chrome://extensions` → enable **Developer mode** → **Load
   unpacked** → pick [`extension/`](./extension/).
   Firefox → `about:debugging` → **Load Temporary Add-on** → pick `manifest.json`.

To publish it so anyone can install in one click, the Chrome Web Store package is
already prepared — icons, promo tile, listing copy and a step-by-step checklist in
[`store/README.md`](./store/README.md). The manifest requests **no extra permissions**.

**Option 2 — Tampermonkey** (easiest to update)

1. Install [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey.
2. Open [`blackboard-deadlines.user.js`](./blackboard-deadlines.user.js), view the
   **Raw** file, confirm the install.

**Option 3 — Bookmarklet** (nothing to install)

1. New browser bookmark → paste the `javascript:...` line from
   [`bookmarklet/bookmarklet.js`](./bookmarklet/bookmarklet.js) into its URL field.
2. On the Blackboard calendar page, click the bookmark; the buttons appear.
   - Nothing happens? The page's CSP may block injected scripts — use option 1 or 2.

Building from source: `node build.js` — no npm dependencies.

## 2. Usage

Not sure which route fits you? **[All the ways compared](./docs/import-methods.md)**
— including the two that do not work yet and why.

### A — Export `.ics`

1. Open <https://blackboard.hcmiu.edu.vn/webapps/calendar/> and log in.
2. Click **"Xuất deadline (.ics)"** (floating, bottom-right). File
   `blackboard-deadlines-YYYY-MM-DD.ics` downloads.
   - No upcoming deadlines → *"Không có deadline nào sắp tới."*
   - Session expired → *"Phiên đăng nhập có thể đã hết hạn…"*
3. Google Calendar → **Settings ⚙ → Import & export → Import**, pick the file and
   a target calendar, press **Import**.

Times are correct for Vietnam: each event is a 30-minute block that **ends exactly
at the deadline** (Google Calendar rejects zero-length events); all-day deadlines
become full-day events. Re-importing the same file **updates** the same events
instead of duplicating them (fixed UID per Blackboard item).

### B — Direct Google Calendar sync

On the Blackboard calendar click **"Đồng bộ Google Calendar"** → the sync page lists
your upcoming deadlines → press **"Đồng bộ vào Google Calendar"**. First run asks
for a one-time Google authorization; later runs show *"Đồng bộ xong: tạo mới X,
cập nhật Y."* on the sync page and the result popup closes itself. If the page has
not caught up yet, press **"Quay lại trang đồng bộ"** on the popup — that path
always delivers. Events land in **your own** "Blackboard Deadlines" calendar,
created on first sync. Re-syncing updates instead of duplicating; nothing is ever
deleted.

This needs a one-time relay deployment by one person (the *operator*) — Apps Script
and GitHub Pages, both free. Full instructions: **[docs/sync-setup.md](./docs/sync-setup.md)**.
Everyone who cannot or does not want to use sync still has the `.ics` export in full.

![Mock screenshot: sync page with fake deadlines](docs/screenshot-sync.svg)

## 3. Why isn't this just a website?

The most common question, and the honest answer is that the Blackboard half cannot
be done from a page you merely visit:

- **Blackboard's own calendar feed is a dead end here.** Learn can hand out a
  personal "external calendar link" that Google Calendar would subscribe to and
  refresh by itself — no extension, no code. At HCMIU that link exists but serves an
  **empty `.ics`**: not a single deadline in it. That dead end is the reason this
  tool exists at all.
- **The Google half is solvable in-browser.** A static page can drive the Google
  Calendar API directly; that is what the sync page does today via an Apps Script relay.
- **The Blackboard half needs the university.** `blackboard.hcmiu.edu.vn` runs Learn
  3900 with the public REST API and three-legged OAuth live, and the calendar
  endpoints exist (`/learn/api/public/v1/calendars/items`). But every call needs an
  **Application Key that an HCMIU Blackboard administrator must register**
  (*Admin → REST API Integrations*). Without it any third-party page gets
  `401 API request is not authenticated.`
- **So the tool runs _on_ the Blackboard page instead**, reusing the session you
  already have. It never sees your password.
- **What this project will never do:** ask for your Blackboard username and
  password. That would require a server replaying your credentials — precisely what
  this design exists to avoid.

If HCMIU ever registers an application key, a single "connect both accounts" page
becomes straightforward; until then, the extension is the legitimate route.

## 4. Limitations

- The `selectedCalendarEvents` endpoint is **not a public API** — it is what the
  Blackboard web UI itself calls. If the school or Blackboard changes configuration,
  the tool may break.
- **Deadlines only** (assignments, due dates) — no class schedule, no exam timetable.
- **No background job:** open Blackboard and press the button each time.
- **Nothing is ever deleted automatically.** A deadline removed or rescheduled on
  Blackboard keeps its old copy in Google Calendar until you re-sync (which updates
  times) or delete it yourself (re-syncing never deletes vanished events).
- The `.ics` `SEQUENCE` field is set to the current minute so a later import looks
  "newer". **Not verified** that Google Calendar uses it to update same-UID entries —
  if duplicates appear, delete the old ones and import again.
- The export is a **snapshot**. If you previously imported the same deadlines another
  way, you may get duplicates — delete the old entries first.
- Sync opens a pop-up; allow pop-ups for Blackboard.
- Sync sends deadline titles and times to the Apps Script relay endpoint; the `/exec`
  URL is effectively public — use the optional token (see the setup doc) if that
  bothers you.

## 5. Privacy & security

- **Everything runs in your browser.** No author server, no data collection, no
  tracking, no cookies set by this project, nothing stored in your browser.
- The script calls only `blackboard.hcmiu.edu.vn` (same-origin `fetch` with
  `credentials: 'same-origin'`) and your sync page; only the sync page then calls
  `script.google.com`. It never uses `GM_xmlhttpRequest`.
- Sync writes into **your own** calendar using **your own** Google authorization.
- Messages **from Blackboard** to the sync page check `event.origin`, the sending
  window and the message schema, and never use a wildcard `targetOrigin`.
- The **result coming back from the popup** cannot rely on `event.origin` — the
  result card runs in Google's sandboxed iframe with an opaque origin — so it is
  authenticated by a **per-click 128-bit nonce** plus the same schema check, or
  read back from `localStorage` in your own browser. The manual fallback link
  carries that same result in the popup's own URL query.
- **Read the source before installing**, and never share your personal Blackboard
  `.ics` feed link — it contains your whole schedule.

Store-facing policy: [`privacy.html`](./privacy.html).

## 6. Disclaimer

Personal, unofficial project. Not affiliated with, endorsed by, or supported by
HCMIU or Blackboard. **No warranty** of any kind; use at your own risk. It may stop
working when the university changes its Blackboard setup.

## 7. Development & license

**MIT** — see [LICENSE](./LICENSE). Issues and pull requests welcome.

```
npm test        # node build.js && node test/test.js  — plain Node >= 18, no deps
node build.js   # regenerates the userscript, sync/core.js and extension/bb.js
```

| Path | Role |
| --- | --- |
| `src/core.js` | pure functions: filtering, time zones, escaping, line folding, ICS and Google payloads |
| `src/userscript.body.js` | thin DOM/fetch layer |
| `src/userscript.meta.js` | userscript metadata block |
| `build.js` | concatenates `src/` into the built outputs |
| `sync/` | sync page (`core.js` here is generated — edit `src/core.js`) |
| `apps-script/` | sync relay |
| `extension/` | MV3 wrapper (`bb.js` is generated) |
| `bookmarklet/` | bookmarklet loader |
| `store/` | Chrome Web Store submission package |
| `test/` | test suite, fake data only |
| `docs/` | guides (import methods, sync setup) and screenshots |
