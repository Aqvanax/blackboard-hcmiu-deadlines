# Every way to get Blackboard deadlines into Google Calendar

English · [Tiếng Việt](./import-methods.vi.md)

Two things are easy to confuse, so they are kept apart here:

- **How the data crosses** — export a file, or write straight into your calendar.
- **How you install** — extension, Tampermonkey, or bookmarklet. All three run the
  same built code and support both data routes; picking one does not change what
  you get.

## 1. The routes, compared

| Route | Install | Google sign-in | Refreshes itself | Re-running it | Status |
| --- | --- | --- | --- | --- | --- |
| **A. Type it in by hand** | nothing | none | no | — | always works |
| **B. `.ics` export → Google Import** | this tool | **none at all** | no (snapshot) | updates the same events (fixed UID) | **recommended default** |
| **C. Direct sync** | this tool + relay deployed once | one-time consent | no (you press the button) | updates, never duplicates | **works** |
| **D. Blackboard feed → Google "From URL"** | nothing | none | yes, ~8–24 h | — | **ruled out at HCMIU** |
| **E. Blackboard REST API page** | nothing | OAuth | could be scheduled | — | **blocked, needs the university** |

### A — By hand

Open Blackboard, read the due dates, type them into Google Calendar. No install, no
trust decisions, nothing to break. Fine for one or two deadlines; it goes stale the
moment a lecturer moves a date.

### B — `.ics` export, then Google Calendar Import

Press **"Xuất deadline (.ics)"** on the Blackboard calendar page, then in Google
Calendar go **Settings ⚙ → Import & export → Import** and pick the file.

The one to pick if you are unsure. It touches **no Google authorization whatsoever**
— the file never leaves your machine until you import it yourself — and the file is
standard RFC 5545, so it also works in Outlook, Apple Calendar or anything else.
Re-exporting later and importing again updates the same events instead of piling up
duplicates, because every Blackboard item keeps a fixed UID.

Trade-off: it is a snapshot. Nothing changes in your calendar until you repeat it.

Full steps: §2A in the [English README](../README.md).

### C — Direct sync into your own calendar

Press **"Đồng bộ Google Calendar"**, then **"Đồng bộ vào Google Calendar"** on the
page that opens. Events land in a calendar named **"Blackboard Deadlines"** that
belongs to you, created on the first run.

Worth it if you do this every week — no file handling, no import dialog. Costs you a
one-time Google consent screen, which shows an *"unverified app"* warning because the
relay is a small personal script; and it needs one person to deploy that relay once
([docs/sync-setup.md](./sync-setup.md)). Re-syncing updates existing events and never
deletes anything.

### D — Blackboard's own calendar feed — does not work here

In theory the best route by far: Blackboard Learn can give you a personal *external
calendar link*, you paste it into Google Calendar under **Other calendars → From
URL**, and Google then re-reads it forever on its own. No extension, no code, real
automatic refresh.

**At HCMIU that link serves an empty `.ics` — not a single deadline in it.** Verified.
The likely reason is that Learn's external feed only carries calendar events a
lecturer created, not assignment due dates, which is exactly why this tool reads the
calendar page instead. If you try it and it is empty for you too, that is expected,
not a mistake on your side.

Also: treat such a link as a password if you ever get a working one — anyone holding
it can read your whole schedule.

### E — A standalone web page via the Blackboard REST API — not available yet

This is what people usually picture: one web page, connect Blackboard, connect
Google, done — no install, and it could even run on a schedule without you pressing
anything.

The infrastructure is genuinely there. `blackboard.hcmiu.edu.vn` runs Learn 3900 with
the public REST API enabled and the three-legged OAuth flow live, and the calendar
endpoints exist. What is missing is an **Application Key that an HCMIU Blackboard
administrator has to register** (*Admin → REST API Integrations*). Until someone at
the university does that, any third-party page gets
`401 API request is not authenticated.`

Note that D being empty does **not** mean E would be: the feed and the REST API are
different data paths, and the REST calendar endpoint does expose gradebook due-date
items. That stays unproven until a key exists.

## 2. Which install should I use?

Routes B and C both need the script on the Blackboard page. Three ways to put it
there, same code:

| Install | Install effort | Updating it | Caveat |
| --- | --- | --- | --- |
| **Extension** (MV3) | load unpacked once, or one click once it is on the Chrome Web Store | reload / store auto-update | the route being prepared for everyone |
| **Tampermonkey** | install Tampermonkey, then the script | easiest to update | one more extension to trust |
| **Bookmarklet** | paste one bookmark | re-paste by hand | the page's CSP may block it; then use the other two |

## 3. What does not exist today

- **No background sync.** Every route above except D needs you to open Blackboard and
  press a button. Nothing runs on a timer. D was the only route that refreshed by
  itself and it is empty here; E could, but is blocked.
- **No class schedule or exam timetable** — deadlines only (assignments, due dates).
- **No deletion.** If a deadline disappears from Blackboard, its copy stays in your
  calendar until you remove it. Re-syncing corrects times but never deletes.

## 4. Short answer

Use **B** (`.ics` export) unless you sync weekly; then set up **C** once. **D** is
dead at HCMIU, **E** needs the university to say yes, and **A** is always there if you
would rather not install anything.
