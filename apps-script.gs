/**
 * say-vs-click — Google Apps Script data endpoint.
 *
 * Receives the session payload POSTed by app.js and stores it in a Google Sheet.
 *
 * Sheet layout (created automatically on first POST):
 *   "sessions" — one row per submission:
 *       received_at, session_id, prolific_pid, study_id, preview,
 *       presence, certainty, n_events, meta_json, events_json
 *   "events" — one row per event (normalized for analysis):
 *       session_id, seq, trial_id, event_type, t_perf, t_wall,
 *       visibility, target, payload_json
 *
 * The beacon on pagehide sends the same body, so a mid-study dropout still
 * lands as a sessions row flagged by its smaller n_events / missing session_end.
 *
 * Deployment: see README § "Data endpoint" — Extensions → Apps Script, paste
 * this file, Deploy → New deployment → Web app → Execute as: Me → Who has
 * access: Anyone → copy the /exec URL into ENDPOINT_URL in config.js.
 */

// Leave '' when the script is bound to the spreadsheet
// (Extensions → Apps Script from the sheet). Otherwise paste the sheet's ID.
const SPREADSHEET_ID = '';

const SESSIONS_SHEET = 'sessions';
const EVENTS_SHEET   = 'events';

const SESSIONS_HEADERS = [
  'received_at', 'session_id', 'prolific_pid', 'study_id', 'preview',
  'presence', 'certainty', 'n_events', 'meta_json', 'events_json'
];
const EVENTS_HEADERS = [
  'session_id', 'seq', 'trial_id', 'event_type', 't_perf', 't_wall',
  'visibility', 'target', 'payload_json'
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const body = e && e.postData && e.postData.contents ? e.postData.contents : '';
    const data = JSON.parse(body);
    const meta   = data.meta   || {};
    const events = data.events || [];
    const cond   = meta.condition || {};

    const ss = getSheet_();
    const sessions = ensureSheet_(ss, SESSIONS_SHEET, SESSIONS_HEADERS);
    const eventsSh = ensureSheet_(ss, EVENTS_SHEET, EVENTS_HEADERS);

    sessions.appendRow([
      new Date().toISOString(),
      meta.session_id || '',
      meta.prolific_pid || '',
      meta.study_id || '',
      meta.preview === true,
      cond.presence || '',
      cond.certainty || '',
      events.length,
      JSON.stringify(meta),
      JSON.stringify(events)
    ]);

    if (events.length) {
      const rows = events.map(ev => [
        ev.session_id || meta.session_id || '',
        ev.seq != null ? ev.seq : '',
        ev.trial_id != null ? ev.trial_id : '',
        ev.event_type || '',
        ev.t_perf != null ? ev.t_perf : '',
        ev.t_wall || '',
        ev.visibility || '',
        ev.target != null ? String(ev.target) : '',
        ev.payload != null ? JSON.stringify(ev.payload) : ''
      ]);
      eventsSh.getRange(eventsSh.getLastRow() + 1, 1, rows.length, EVENTS_HEADERS.length)
              .setValues(rows);
    }

    return json_({ ok: true, n_events: events.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) { /* ignore */ }
  }
}

/** Simple GET so the URL can be sanity-checked in a browser. */
function doGet() {
  return json_({ ok: true, service: 'say-vs-click endpoint', accepts: 'POST {meta, events}' });
}

function getSheet_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet bound and SPREADSHEET_ID is empty.');
  return ss;
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
