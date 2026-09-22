# say-vs-click

A research instrument for a Master's-thesis study on **the say–do gap in source
verification**: do people actually check the sources an AI assistant cites, or do
they take the answer at face value? The app simulates a citation-backed AI
question-answering interface and logs participants' *behavioural* verification
(source opens, per-source dwell, scroll depth, focus-corrected reading time) —
not self-reported habits.

## Design

- **Between-subjects (2 × 3):** rationale presence (`shown` / `hidden`) ×
  certainty framing (`none` / `certain` / `uncertain`) → 6 cells. Uniform random
  assignment at session start; the assignment is persisted in `localStorage` so
  a reload cannot re-randomise a participant.
- **Within-subjects:** 1 practice trial (flagged `is_practice`, excluded from
  analysis) + 6 main trials in a per-participant randomised order.
- **Manipulated correctness:** for each participant exactly **2 of 6** trials
  display the *flawed* rationale variant and exactly **2 of 6** display the
  *non-entailing* source set (`sourcesUnsupported`). The two draws are
  independent, so a trial may carry both manipulations.
- Per trial: claim card → AI answer card (optional numbered reasoning steps,
  optional certainty-marker line, `[1] [2] [3]` citation chips) → freely
  open/close source panels → verdict (*supported / not supported / cannot tell*)
  → confidence 1–7 → trust 1–7 → optional one-line justification on trials 3 & 5.
- Two instructed-response **attention checks**: one between trials 3 and 4, one
  embedded in the post-questionnaire ("select '2'").
- Post-questionnaire: 6-item situational trust scale (7-pt), 5-item AI-literacy
  scale (7-pt), habitual source-checking item (5-pt), optional per-trial
  familiarity recap, demographics, funnel item, debrief.

## Repository layout

| File | Purpose |
|---|---|
| `index.html` | All screens: consent → instructions → device gate → trials → questionnaire → debrief → submit |
| `styles.css` | Study UI (chat-adjacent cards, source drawer, Likert pills) |
| `app.js` | Runtime: condition assignment, trial flow, event logging, submit/beacon |
| `stimuli.js` | `STIMULI` (practice + 6 trials, each with correct/flawed rationale and supported/unsupported source sets) + `QUESTIONNAIRE` item text |
| `config.js` | `ENDPOINT_URL`, Prolific completion URL/code, feature flags |
| `apps-script.gs` | Google Apps Script `doPost` endpoint writing to a Sheet |
| `.nojekyll` | Serve the folder as-is on GitHub Pages |

## Run locally

```bash
cd Experiment          # this folder
python3 -m http.server 8000
# open http://localhost:8000/?preview=1
```

`?preview=1` forces preview mode. Any visit without `PROLIFIC_PID` in the query
string is also treated as a preview: `meta.preview=true` and a uuid
`session_id` is generated. Prolific links carry
`?PROLIFIC_PID=…&STUDY_ID=…&SESSION_ID=…`.

To reset a local session (new assignment, empty log), clear site data /
`localStorage` for the origin, or use a private window.

## Data endpoint (Google Apps Script)

1. Create a Google Sheet, then **Extensions → Apps Script**.
2. Paste the contents of `apps-script.gs` into `Code.gs`.
   (If the script is not bound to the sheet, set `SPREADSHEET_ID`.)
3. **Deploy → New deployment → Web app** — *Execute as*: **Me**,
   *Who has access*: **Anyone**.
4. Copy the `/exec` URL into `ENDPOINT_URL` in `config.js`.

The script writes one row per submission to `sessions` (meta columns +
`events_json`) and one row per event to `events`. `doGet` returns a small JSON
status so the URL can be sanity-checked in a browser.

**Submit logic:** the app awaits the POST *before* showing the Prolific
redirect, to avoid the redirect racing the data save. Apps Script web apps do
not answer CORS preflights, so `app.js` tries `application/json`, then
`text/plain` (a CORS-simple request), then an opaque `no-cors` POST as a last
resort. If the endpoint is empty or all attempts fail, the UI offers a
**Download my session data (JSON)** button plus a manual completion code —
completion is never blocked on data save. A `sendBeacon` on `pagehide`
additionally ships the partial log if the tab closes mid-study.

## Stimuli schema (`stimuli.js`)

```js
{
  practice: { /* same shape, always shows correct rationale + supported sources */ },
  trials: [{
    id, claim, claimTrue,                 // claimTrue = real-world truth (analysis only)
    answerText,
    rationaleCorrect: [3–5 steps],
    rationaleFlawed:  [3–5 steps],        // one invalid step; flawType documents it
    flawType,
    certaintyMarkers: { certain, uncertain },
    sourcesSupported:   [{label, title, excerpt}],  // excerpts entail the answer
    sourcesUnsupported: [{label, title, excerpt}]   // topically plausible, do NOT entail
  }]
}
```

`groundTruth` is *not* authored per trial — it is derived from which source set
the assignment draws: shown `sourcesUnsupported` ⇒ `ground_truth:
"unsupported"`, otherwise `"supported"`. The effective value is logged on every
`trial_start` and `verdict` event.

## Event schema

One append-only array; every record:

```js
{ seq, session_id, prolific_pid, study_id,
  condition: { presence, certainty },
  trial_id,                       // null outside trials
  event_type,
  t_perf,                         // performance.now(), ms since page load
  t_wall,                         // ISO-8601
  visibility,                     // document.visibilityState at log time
  target, payload }
```

| `event_type` | `target` / `payload` |
|---|---|
| `session_start` | payload: condition, order, flawed/unsupported sets, UA, viewport, `resumed`, `preview` |
| `consent_given` | — |
| `instructions_viewed` | payload: `dwell_ms` |
| `device_check` | payload: `pass`, viewport, `maxTouchPoints`, `pointer_fine`, UA |
| `trial_start` | payload: `trial_index`, `is_practice`, `ground_truth`, `rationale_variant`, `rationale_shown`, `certainty_marker`, `n_sources`, `claim_true` |
| `rationale_rendered` | payload: `variant` (`correct`/`flawed`), `flaw_type` |
| `rationale_toggle` | payload: `open` (bool), `latency_ms` — participant collapsed/expanded the reasoning block |
| `citation_click` | target: source index; payload: `latency_ms` from `trial_start` |
| `source_open` | target: source index |
| `source_close` | target: source index; payload: `open_duration_ms` (raw), `focused_ms`, `reason` (`close-btn`/`overlay`/`escape`/`chip-toggle`/`switch`/`trial_end`) |
| `source_visible` | target: source index; payload: `pct` — IntersectionObserver ratio of the excerpt inside the scroll area |
| `scroll_milestone` | target: source index; payload: `pct` ∈ {25,50,75,100} — scroll depth of the drawer, first crossing per open |
| `window_blur` / `window_focus` | — |
| `visibilitychange` | payload: `state` |
| `verdict` | payload: `choice`, `correct` (vs `ground_truth`; `cannot_tell` counts as incorrect), `latency_ms`, `revision` |
| `confidence_set` / `trust_set` | payload: `value` (1–7), `latency_ms` |
| `justification_text` | payload: `text`, `len` (trials 3 & 5 only) |
| `trial_end` | payload: `nSourcesOpened`, `openOrder`, `perSource` `{opens,raw_ms,focused_ms}`, `focusCorrectedDwellMs`, `rawDwellMs`, `verdict`, `confidence`, `trust`, `ground_truth`, `rationale_variant`, `claim_true` |
| `attention_check` | target: `mid_trials`/`survey`; payload: `check_id`, `pass`, `first_choice`/`value` |
| `questionnaire_item` | target: item id (`trust_1..6`, `lit_1..5`, `habitual_check`, `fam_<trial_id>`, `age`, `gender`, `gender_self`, `funnel`); payload: `value`/`text` |
| `debrief_shown` | — |
| `session_end` | payload: `n_events`, `total_perf_ms` |
| `submit_attempt` / `submit_result` | payload: `endpoint_set`, `n_events` / `ok`, `status`, `via` (`json`/`plain`/`nocors`), `error`, `opaque` |

**Focus-corrected dwell** accumulates only while
`document.visibilityState === 'visible'` *and* `document.hasFocus()`; raw dwell
is stored alongside. Both are accumulated per-source (`perSource`) and per-trial
(`focusCorrectedDwellMs` vs `rawDwellMs`).

The final POST body is `{ meta: {…}, events: […] }` — the complete event array.

## Privacy

- No IP address is stored by this instrument; Prolific IDs are pseudonymous.
- Only the Prolific URL parameters (`PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID`)
  are captured; they go to your own Sheet, not to third parties.
- Behavioural logs contain interaction events only — no keystroke content beyond
  the optional free-text fields participants type themselves.

## Pilot / preview

`https://<owner>.github.io/say-vs-click/?preview=1` runs a flagged preview
session. With `ENDPOINT_URL` empty, the completion screen shows the download
fallback; use it to inspect a real `events` payload end-to-end.

## Design decisions (documented deviations)

- **`groundTruth` derived, not authored.** The stimuli file ships
  `sourcesSupported`/`sourcesUnsupported` variants per trial; the assignment
  draws exactly 2 trials to display the non-entailing set, and that draw defines
  `ground_truth`. This makes "which trials carry unsupported citations" a true
  per-participant randomisation rather than a fixed property of the items.
- **`Cannot tell` counts as incorrect** for `verdict.correct` (it is neither a
  correct "supported" nor a correct "not supported"); the raw `choice` is always
  logged for separate analysis.
- **One source panel at a time.** Opening a chip while another source is open
  closes the first (logged with `reason:"switch"`). Dwell accounting is
  unambiguous per source.
- **`instructions_viewed` is logged when leaving** the instructions screen, with
  `dwell_ms` — the view duration is the analytically useful quantity.
- **Sliders start visually at 4 but unset**; the next step unlocks on the first
  `input` event, and `confidence_set`/`trust_set` are logged on `change`
  (commit). Participants intending 4 can nudge the slider — logged as usual.
- **Attention check pass = first click** for the mid-trials check; a wrong first
  click shows a hint and lets the participant continue (data already logged).
- **Reload keeps the same session.** `session_id`, assignment and the event log
  persist in `localStorage`; a reload appends a second `session_start` with
  `resumed:true` and continues the sequence — the partial log is never wiped.
