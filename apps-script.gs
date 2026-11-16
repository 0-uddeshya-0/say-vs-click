/**
 * Data endpoint and admin backend for the study (Google Apps Script, free).
 *
 * Participants (no key needed)
 *   GET  ?action=start   -> { open, list, items, practice, items_version }
 *                           list is handed out in rotation (0..7) so the eight lists fill evenly;
 *                           items is null until an item set has been saved from the admin page.
 *   POST (session JSON)  -> writes the sheets "sessions", "trials" and "events"
 *
 * Admin (POST with { action, key, ... }; key = script property ADMIN_KEY)
 *   admin_ping, admin_get_items, admin_save_items, admin_data, admin_set_open
 *
 * Setup: README.md, section "Data endpoint". The admin key is NOT stored in this file, because the
 * repository is public. Set it under Project Settings > Script Properties > ADMIN_KEY (12+ characters).
 */
const SPREADSHEET_ID = '';   // leave '' when the script is bound to the sheet

const TRIAL_COLS = ['session_id','list','trial_index','item','trace','supported','key','decision','correct','opened_any',
  'n_sources_distinct','n_source_opens','open_order','source_open_ms','source_visible_ms','max_scroll','decision_changes',
  'first_choice_ms','trial_ms','verification_success'];
const Q_COLS = ['trust_trace','trust_notrace','self_checked','logged_checked','why_open','why_closed','trace_read','trace_effect','ai_use','habit_check','age','gender','education','english','lookup','comment'];
const SESSION_COLS = ['received_at','session_id','final','study_version','items_version','list','src','started_at','n_trials_done','window','user_agent'].concat(Q_COLS).concat(['raw_json']);
const EVENT_COLS = ['session_id','seq','t','wall','trial','item','type','visible','payload_json'];
const ITEM_COLS = ['saved_at','version','note','n_chunks'];
const CHUNK = 40000;         // a cell holds at most 50,000 characters

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action === 'start') return out_(start_());
    return out_({ ok: true, service: 'study endpoint', api: 3 });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'submit';
    if (action === 'submit') return out_(submit_(data, e.postData.contents));
    if (!auth_(data)) return out_({ ok: false, error: 'auth' });
    if (action === 'admin_ping') return out_({ ok: true, open: isOpen_() });
    if (action === 'admin_get_items') return out_(adminGetItems_());
    if (action === 'admin_save_items') return out_(adminSaveItems_(data));
    if (action === 'admin_data') return out_(adminData_(data));
    if (action === 'admin_set_open') { props_().setProperty('STUDY_OPEN', data.open ? 'true' : 'false'); return out_({ ok: true, open: isOpen_() }); }
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

// ---------------------------------------------------------------- participants
function start_() {
  if (!isOpen_()) return { ok: true, open: false };
  var p = props_(), n = 0, lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { n = parseInt(p.getProperty('N_STARTED') || '0', 10); p.setProperty('N_STARTED', String(n + 1)); }
  finally { lock.releaseLock(); }
  var cur = currentItems_();
  return { ok: true, open: true, list: n % 8, items: cur ? cur.items : null, practice: cur ? cur.practice : null, items_version: cur ? cur.version : null };
}

function submit_(data, raw) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var m = data.meta || {}, q = data.questionnaire || {}, ss = ss_();
    var sessions = sheet_(ss, 'sessions', SESSION_COLS);
    var isFinal = m.final === true;
    var seenFinal = false;
    if (isFinal && sessions.getLastRow() > 1) {            // a retried submission must not be stored twice
      var prev = sessions.getRange(2, 2, sessions.getLastRow() - 1, 2).getValues();
      for (var i = 0; i < prev.length; i++) if (prev[i][0] === m.session_id && String(prev[i][1]).toLowerCase() === 'true') { seenFinal = true; break; }
    }
    if (seenFinal) return { ok: true, duplicate: true };
    sessions.appendRow([new Date().toISOString(), m.session_id, isFinal, m.study_version, m.items_version, m.list, m.src, m.started_at, m.n_trials_done, m.window, m.user_agent]
      .concat(Q_COLS.map(function (k) { return q[k] === undefined || q[k] === null ? '' : q[k]; }))
      .concat([raw.length <= CHUNK ? raw : raw.slice(0, CHUNK)]).map(safe_));
    if (isFinal) {
      write_(sheet_(ss, 'trials', TRIAL_COLS), (data.trials || []).map(function (r) { return TRIAL_COLS.map(function (k) { return r[k] === undefined ? '' : r[k]; }); }));
      write_(sheet_(ss, 'events', EVENT_COLS), (data.events || []).map(function (ev) {
        return [m.session_id, ev.seq, ev.t, ev.wall, ev.trial === null ? '' : ev.trial, ev.item || '', ev.type, ev.visible, ev.payload ? JSON.stringify(ev.payload) : '']; }));
    }
    return { ok: true };
  } finally { try { lock.releaseLock(); } catch (e2) {} }
}

// ---------------------------------------------------------------- admin
function auth_(d) { var k = props_().getProperty('ADMIN_KEY'); return !!k && k.length >= 12 && d.key === k; }
function isOpen_() { return props_().getProperty('STUDY_OPEN') !== 'false'; }

function currentItems_() {
  var sh = ss_().getSheetByName('items');
  if (!sh || sh.getLastRow() < 2) return null;
  var row = sh.getRange(sh.getLastRow(), 1, 1, sh.getLastColumn()).getValues()[0];
  var n = parseInt(row[3], 10), json = '';
  for (var i = 0; i < n; i++) json += row[4 + i];
  var obj = JSON.parse(json);
  return { version: row[1], saved_at: row[0], note: row[2], items: obj.items, practice: obj.practice };
}

function adminGetItems_() {
  var cur = currentItems_(), history = [], sh = ss_().getSheetByName('items');
  if (sh && sh.getLastRow() > 1) history = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().map(function (r) { return { saved_at: r[0], version: r[1], note: r[2] }; });
  return { ok: true, current: cur, history: history };
}

function adminSaveItems_(data) {
  if (!data.items || data.items.length !== 16) return { ok: false, error: 'an item set needs 16 items' };
  var json = JSON.stringify({ items: data.items, practice: data.practice || null });
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, json, Utilities.Charset.UTF_8);
  var hex = digest.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 8);
  var version = 'r-' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd-HHmm') + '-' + hex;
  var chunks = [];
  for (var i = 0; i < json.length; i += CHUNK) chunks.push(json.slice(i, i + CHUNK));
  var sh = ss_().getSheetByName('items') || ss_().insertSheet('items');
  if (sh.getLastRow() === 0) { sh.appendRow(ITEM_COLS.concat(['json_1', 'json_2', 'json_3', 'json_4'])); sh.setFrozenRows(1); }
  sh.appendRow([new Date().toISOString(), version, String(data.note || ''), chunks.length].concat(chunks));
  return { ok: true, version: version };
}

function adminData_(data) {
  var name = data.sheet;
  if (['sessions', 'trials', 'events'].indexOf(name) < 0) return { ok: false, error: 'unknown sheet' };
  var sh = ss_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 1) return { ok: true, header: [], rows: [] };
  var values = sh.getDataRange().getValues(), header = values.shift();
  if (name === 'sessions') { var cut = header.indexOf('raw_json'); if (cut >= 0) { header = header.slice(0, cut); values = values.map(function (r) { return r.slice(0, cut); }); } }
  if (name === 'events' && data.session_id) values = values.filter(function (r) { return r[0] === data.session_id; });
  return { ok: true, header: header, rows: values, n_started: parseInt(props_().getProperty('N_STARTED') || '0', 10), open: isOpen_() };
}

// ---------------------------------------------------------------- helpers
function props_() { return PropertiesService.getScriptProperties(); }
function ss_() { return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(ss, name, cols) { var sh = ss.getSheetByName(name); if (!sh) sh = ss.insertSheet(name); if (sh.getLastRow() === 0) { sh.appendRow(cols); sh.setFrozenRows(1); } return sh; }
/** Text typed by participants must never be read as a formula by the sheet. */
function safe_(v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v; }
function write_(sh, rows) { if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows.map(function (r) { return r.map(safe_); })); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Run once from the editor (Run > selfTest) after pasting the script: writes and reads one test row. */
function selfTest() {
  var r = submit_({ meta: { session_id: 'selftest-' + Date.now(), final: true, study_version: 'selftest', list: 0, n_trials_done: 0 }, trials: [], events: [], questionnaire: {} }, '{}');
  Logger.log('submit: ' + JSON.stringify(r) + ' | admin key set: ' + (!!props_().getProperty('ADMIN_KEY')) + ' | start: ' + JSON.stringify(start_()).slice(0, 80));
}
