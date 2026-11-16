# say-vs-click

Study instrument for a master's thesis at Hochschule Neu-Ulm: does a displayed reasoning trace change
whether people open the sources an AI assistant cites?

Participants judge 16 citation-backed AI answers (accept or reject). 8 answers come with a reasoning
trace and 8 without (within participants, random order); 4 of the 16 answers are contradicted by their
own sources. Opening sources is optional and every interaction is logged. Hosting and data storage are free.

| File | Purpose |
|---|---|
| `index.html`, `app.js`, `styles.css` | The study: consent, instructions, practice, 16 trials, questionnaire, debriefing |
| `admin.html`, `admin.js`, `admin.css` | Admin page: progress, responses and event logs, editor for questions and sources, open/close the study |
| `items.js` | Bundled item set (16 items and a practice item). Used until an item set is saved from the admin page |
| `design.js`, `test_design.js` | List rotation, trial order, item validation. `node test_design.js` checks the balance |
| `config.js` | Data endpoint URL, researcher name, contact e-mail, logo switch |
| `assets/hnu-logo.png` | University logo from the HNU thesis template (shown when `SHOW_LOGO` is true) |
| `apps-script.gs` | Data endpoint and admin backend (Google Apps Script bound to a Google Sheet) |
| `analysis.R` | Models for H1 to H3, carryover check, say-versus-click comparison |

## How the parts fit together

- **GitHub Pages** serves the pages. It can only serve files; it cannot store answers.
- **A Google Sheet with a script** therefore stores the data. The script receives each finished session,
  hands out the eight lists in rotation, keeps the live item set and answers the admin page.
- **The admin key** protects the admin functions. It lives only in the script's properties, never in
  this repository, because the repository is public.

Without an endpoint the study runs in preview mode (data offered as a download) and the admin page
works locally on the bundled items.

## Data endpoint: one-time setup (about five minutes)

1. Go to <https://sheets.new> while signed in to Google. Name the sheet, for example "say-vs-click data".
   *Why:* this sheet becomes the database; only your Google account can open it.
2. In the sheet: **Extensions > Apps Script**. Delete the sample code, paste all of `apps-script.gs`, save.
3. Left bar: **Project Settings > Script Properties > Add script property**. Property `ADMIN_KEY`,
   value a passphrase of at least 12 characters. *Why:* the admin page signs in with it.
4. Back in the editor choose the function `selfTest` and press **Run**. Google asks for permission
   once (Advanced > Go to project > Allow). *Why:* the script needs your consent to write to your sheet.
   The log must show `submit: {"ok":true}` and `admin key set: true`.
5. **Deploy > New deployment > Web app.** Execute as: **Me**. Who has access: **Anyone**. Deploy and copy
   the web-app URL that ends in `/exec`. *Why "Anyone":* participants are not signed in to Google; the
   script accepts only the requests it knows, and admin requests need the key.
6. Put the URL into `ENDPOINT_URL` in `config.js`, commit and push.
7. Open the study once and finish it. The last page must say "Your responses have been saved", and the
   session must appear in the admin page under *Responses*. Delete the test rows from the sheet afterwards.

After changing `apps-script.gs` later: Deploy > Manage deployments > Edit > Version: New version.
The URL stays the same.

## Hosting

The repository is served by GitHub Pages from the `main` branch (Settings > Pages).
Study: `https://0-uddeshya-0.github.io/say-vs-click/` · Admin: `…/say-vs-click/admin.html`

Add `?src=hnu`, `?src=surveycircle`, `?src=linkedin` and so on to the link posted in each place.
The value is stored with the session, and the admin overview counts completions per channel.
`?list=3&reset=1` forces list 3 and a fresh session (for testing).

## Showing the study to the supervisor

1. **Participant view:** open `https://0-uddeshya-0.github.io/say-vs-click/?reset=1&src=demo` and go through
   consent, the practice question and two or three questions. Open a source on one of them. `?reset=1`
   starts a fresh session every time, and `src=demo` marks the session so it can be removed from the data.
2. **What is recorded:** open `admin.html`, sign in, go to *Responses* and click the demo session. The trial
   table and the event log show the source that was just opened, with its timings.
3. **Materials:** in *Questions and sources*, pick an item and press *Preview this item* to show the supported
   and the unsupported version next to each other, with the trace and the three sources.
4. **Design safeguards:** change a correct answer from yes to no in the editor and show that saving is blocked.
   Reload the page to discard the change.
5. **Progress view:** the *Overview* shows the target, the eight lists and the questionnaire answers.

Before the endpoint is connected, steps 1, 3 and 4 work as they are; step 2 works with the response file
that the study offers as a download at the end (*Open response file(s)* in the admin page).

## Admin page

- **Overview:** started, completed and partial sessions, completions per list and channel, open/close switch.
  Outcomes by condition are hidden behind a button, because looking at them to decide when to stop
  collecting would bias the tests.
- **Responses:** every session; click one for its 16 trials and the full event log. CSV downloads.
- **Questions and sources:** edit question, both answers, both traces and the three sources of each item;
  preview; save. Saving stores a new version at the endpoint, and new participants receive it at once.
  The editor refuses a set that would unbalance the design (16 items, four groups, two yes and two no each,
  answers beginning with Yes or No). Every session records the item-set version it used.

## What is logged

Per trial (`trials`): item, trace shown, supported or not, decision, correct, whether any source was opened,
number and order of sources, time sources were open and visible, scroll depth, decision changes, time to
first choice, trial time, verification success. The final questionnaire is closed throughout (scales and
multiple choice on three short pages; one optional comment field). Per event (`events`): every source open and close, decision
click, screen change, tab switch and window blur with a millisecond timestamp. Sessions that leave early
are stored in `sessions` with `final = FALSE`. A reload resumes at the next question; a browser that has
finished is not admitted a second time. No names, e-mail addresses or IP addresses are stored.

## Logo

The header shows the HNU logo taken unchanged from the university's thesis template. Its use on a public
study page should be cleared with the supervisor; `SHOW_LOGO: false` in `config.js` removes it.

## Known limits

- A static site cannot hide its files. A participant who opens the browser's developer tools can read
  the item set, including the correct answers. The questionnaire asks whether anything was looked up.
- The endpoint is tested against a local stand-in with the same protocol, not against Google itself;
  step 7 above is the real test.

## Before collecting data

Second reader checks every item (admin page, *Preview this item*). Pilot with 5 to 8 people. Ethics and
data protection cleared with the supervisor. Item set frozen; commit hash and item-set version noted in the thesis.
