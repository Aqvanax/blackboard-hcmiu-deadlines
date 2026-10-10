# Sync setup (operator, one time)

English · [Tiếng Việt](./sync-setup.vi.md)

Direct Google Calendar sync needs one person — the *operator* — to deploy a relay
once. Everyone else then just presses the button. Apps Script and GitHub Pages are
both free. If you only want the `.ics` export, you can skip this whole page.

## 1. Deploy the relay

1. Open <https://script.new>, signed in with the Google account that should own the
   script, paste [`../apps-script/Code.gs`](../apps-script/Code.gs) and **Save**.
   No extra service needs enabling: the script calls the Calendar API directly
   through `UrlFetchApp` with its own OAuth token.
2. *Deploy → New deployment → **Web app***:
   - **Execute as: User accessing the app**
   - **Who has access: Anyone**
   - **Deploy** → copy the URL ending in `/exec`.

`Execute as: User accessing the app` is the important one: it makes the relay run as
whoever clicks, so each person writes into their own calendar. There is no Client ID,
no 100-test-user cap and no OAuth verification to wait for — only the one-time
in-popup consent each person gives themselves.

## 2. Host the sync page

Publish the repo with GitHub Pages: *Settings → Pages → Deploy from a branch →
`master` / root* (this repo's default branch is `master`, not `main`). That gives you
`https://<your-user>.github.io/<repo>/sync/`.

## 3. Configure, build, reinstall

1. Set `RELAY_URL` in [`../sync/sync.js`](../sync/sync.js) to the `/exec` URL from step 1.
2. Set `BB_CONFIG.SYNC_PAGE_URL` in
   [`../src/userscript.body.js`](../src/userscript.body.js) to your sync page URL.
3. `node build.js`, then reinstall or reload whichever install option you use.

This repo already ships working values for the author's deployment; you only need
these steps when forking to your own relay and Pages site.

## 4. First run

On the Blackboard calendar press **"Đồng bộ Google Calendar"**, then
**"Đồng bộ vào Google Calendar"** on the page that opens. A popup appears:

- **First time:** Google asks each person to authorize the script once. The screen
  *"This app isn't verified" → Advanced → Go to (unsafe)* is normal for a small
  personal script — the operator can submit it for verification later. Press Allow,
  close the popup, press sync again.
- **Afterwards:** the popup shows *"Đồng bộ xong: tạo mới X, cập nhật Y."* and closes
  itself.

## Notes

- The sync page submits events through a **popup form POST** — a real navigation, so
  the browser carries your Google session; a cross-origin `fetch` would be blocked.
- **Re-running is safe:** every event keeps a fixed ID, so syncing again updates
  rather than duplicates (insert → 409 → patch, inside the script). Nothing is ever
  deleted automatically.
- **The script requests full Calendar access**
  (`https://www.googleapis.com/auth/calendar`) because Apps Script's Calendar service
  has no narrower scope. It only creates and updates the "Blackboard Deadlines"
  calendar, but Google's consent wording is broader — that is Google's screen, not ours.
- **Optional abuse guard:** set a Script Property `token` in Apps Script
  (*Project Settings → Script properties*) and put the same value into `RELAY_TOKEN`
  in [`../sync/sync.js`](../sync/sync.js).
- Per-event failures are logged with `console.error` — read them in Apps Script under
  **Executions**.
