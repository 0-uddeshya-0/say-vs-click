/**
 * Data endpoint and admin backend for the study (Google Apps Script, free).
 *
 * Participants (no key needed)
 *   GET  ?action=start   -> { open, list, items, practice, items_version }
 *                           list is handed out in rotation (0..7) so the eight lists fill evenly;
 *                           items is null until an item set has been saved from the admin page.
 *   POST (session JSON)  -> writes the sheets "sessions" (one row per participant, with totals),
 *                           "trials" (one row per question) and "events" (every logged action).
 *                           A participant who leaves early leaves a row in "sessions" (final = FALSE) and the finished
 *                           trials in "trials_partial"; both are replaced by the complete record if it arrives later.
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
  'first_choice_ms','trial_ms','verification_success','lang','lang_start','content_lang','lang_changed','restarts','n_link_clicks','n_link_menu','n_links_distinct','link_order','link_away_ms','away_ms','n_away'];
const Q_COLS = ['trust_trace','trust_notrace','self_checked','logged_checked','why_open','why_closed','trace_read','trace_effect','ai_use','habit_check','age','gender','education','english','lookup','comment'];
// totals per participant, computed in the browser from the trial rows
const SUM_COLS = ['lang','lang_start','lang_browser','n_lang_switches','n_correct','n_accept','n_trials_source_opened','n_source_opens','n_trials_link_clicked','n_link_clicks','n_link_menu','n_restarts','source_visible_ms','link_away_ms','away_ms','n_unsupported_rejected','n_verification_success','trials_ms','duration_ms','n_events'];
const SESSION_COLS = ['received_at','session_id','final','study_version','items_version','list','src','started_at','n_trials_done'].concat(SUM_COLS).concat(['window','user_agent']).concat(Q_COLS).concat(['raw_json']);
const EVENT_COLS = ['session_id','seq','t','wall','trial','item','type','visible','payload_json'];
// Columns that hold text. They are formatted as plain text before writing, so that the sheet stores "18-24", "1/2",
// a time stamp or a comment starting with "=" exactly as received and does not turn it into a date, a number or a formula.
const TEXT_COLS = ['received_at','session_id','final','study_version','items_version','src','started_at','lang','lang_start','lang_browser','window','user_agent',
  'why_open','why_closed','trace_read','trace_effect','ai_use','habit_check','age','gender','education','english','lookup','comment','raw_json',
  'item','key','decision','open_order','link_order','content_lang','wall','type','payload_json'];
const MAX_POST = 300000;     // characters; a complete record with all events is usually 60,000 to 150,000; the page trims event types of lower priority above 270,000
const ITEM_COLS = ['saved_at','version','note','n_chunks'];
const CHUNK = 40000;         // a cell holds at most 50,000 characters

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action === 'start') return out_(start_());
    return out_({ ok: true, service: 'study endpoint', api: 6 });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  try {
    if (e.postData.contents.length > MAX_POST) return out_({ ok: false, error: 'too large' });
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'submit';
    if (action === 'submit') return out_(submit_(data));
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

function submit_(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var m = data.meta || {}, q = data.questionnaire || {}, ss = ss_();
    if (!m.session_id) return { ok: false, error: 'no session id' };
    var sessions = sheet_(ss, 'sessions', SESSION_COLS), part = sheet_(ss, 'trials_partial', TRIAL_COLS);
    var isFinal = m.final === true;
    var row = findRow_(sessions, m.session_id);
    if (row && String(sessions.getRange(row, 3).getValue()).toLowerCase() === 'true') return { ok: true, duplicate: true };   // a retried or late submission is stored once
    var raw = JSON.stringify({ meta: m, questionnaire: q, trials: data.trials || [] });   // the events have their own sheet; a cell holds at most 50,000 characters
    if (raw.length > CHUNK) raw = raw.slice(0, CHUNK);
    var vals = [new Date().toISOString(), m.session_id, 'FALSE', m.study_version, m.items_version, m.list, m.src, m.started_at, m.n_trials_done]   // the final flag is set last, when everything else is stored
      .concat(SUM_COLS.map(function (k) { return m[k] === undefined || m[k] === null ? '' : m[k]; })).concat([m.window, m.user_agent])
      .concat(Q_COLS.map(function (k) { return q[k] === undefined || q[k] === null ? '' : q[k]; }))
      .concat([raw]);
    if (row) put_(sessions, row, [vals], SESSION_COLS); else { put_(sessions, sessions.getLastRow() + 1, [vals], SESSION_COLS); row = sessions.getLastRow(); }
    var trialRows = (data.trials || []).map(function (r) { return TRIAL_COLS.map(function (k) { return r[k] === undefined ? '' : r[k]; }); });
    if (isFinal) {
      var tr = sheet_(ss, 'trials', TRIAL_COLS), ev = sheet_(ss, 'events', EVENT_COLS);
      deleteRows_(tr, m.session_id, 1); deleteRows_(ev, m.session_id, 1);   // leftovers of an earlier attempt that stopped halfway
      put_(tr, tr.getLastRow() + 1, trialRows, TRIAL_COLS);
      put_(ev, ev.getLastRow() + 1, (data.events || []).map(function (e2) {
        return [m.session_id, e2.seq, e2.t, e2.wall, e2.trial === null ? '' : e2.trial, e2.item || '', e2.type, e2.visible, e2.payload ? JSON.stringify(e2.payload) : '']; }), EVENT_COLS);
      deleteRows_(part, m.session_id, 1);                // the complete record replaces the partial one
      sessions.getRange(row, 3).setNumberFormat('@').setValue('TRUE');   // the final flag is stored as the text TRUE / FALSE, whatever format the sheet has
      SpreadsheetApp.flush();
    } else {
      deleteRows_(part, m.session_id, 1);                // a partial record is rewritten on every partial submission
      put_(part, part.getLastRow() + 1, trialRows, TRIAL_COLS);
    }
    return { ok: true };
  } finally { try { lock.releaseLock(); } catch (e2) {} }
}
/** Row number (1-based) of a session in the sheet "sessions", or 0. */
function findRow_(sh, id) {
  if (sh.getLastRow() < 2) return 0;
  var ids = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
/** Deletes all rows of a session (id in column col, 1-based) from a sheet. Neighbouring rows are deleted in one call. */
function deleteRows_(sh, id, col) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var ids = sh.getRange(2, col, last - 1, 1).getValues(), end = -1;
  for (var i = ids.length - 1; i >= -1; i--) {
    var hit = i >= 0 && String(ids[i][0]) === String(id);
    if (hit && end < 0) end = i;
    if (!hit && end >= 0) { sh.deleteRows(i + 3, end - i); end = -1; }
  }
}

// ---------------------------------------------------------------- admin
function auth_(d) { var k = props_().getProperty('ADMIN_KEY'); return !!k && k.length >= 12 && d.key === k; }
function isOpen_() { return props_().getProperty('STUDY_OPEN') !== 'false'; }

function currentItems_() {
  var sh = ss_().getSheetByName('items');
  if (!sh || sh.getLastRow() < 2) return null;   // header only: no item set saved yet
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
  var itemRow = [new Date().toISOString(), version, String(data.note || ''), chunks.length].concat(chunks);
  var target = sh.getRange(sh.getLastRow() + 1, 1, 1, itemRow.length);
  target.setNumberFormat('@');                         // plain text: a chunk that starts with = + - @ or a digit is stored as it is
  target.setValues([itemRow]);
  return { ok: true, version: version };
}

function adminData_(data) {
  var name = data.sheet;
  if (['sessions', 'trials', 'trials_partial', 'events'].indexOf(name) < 0) return { ok: false, error: 'unknown sheet' };
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
/** Returns the sheet, creating it with its header. An existing sheet with a different header (older script version) is refused instead of being filled with shifted columns. */
function sheet_(ss, name, cols) {
  var sh = ss.getSheetByName(name); if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.appendRow(cols); sh.setFrozenRows(1); }
  else if (sh.getRange(1, 1, 1, cols.length).getValues()[0].join('|') !== cols.join('|')) throw new Error('The header of the sheet "' + name + '" does not match this script version. Rename or delete the sheet, then run selfTest again.');
  return sh;
}
/** Writes rows starting at row `start`. Columns named in TEXT_COLS are formatted as plain text first. */
function put_(sh, start, rows, cols) {
  if (!rows.length) return;
  var n = rows.length, i = 0, isText = cols.map(function (c) { return TEXT_COLS.indexOf(c) >= 0; });
  while (i < cols.length) {                                  // one formatting call per run of neighbouring text columns
    if (!isText[i]) { i++; continue; }
    var j = i; while (j + 1 < cols.length && isText[j + 1]) j++;
    sh.getRange(start, i + 1, n, j - i + 1).setNumberFormat('@');
    i = j + 1;
  }
  sh.getRange(start, 1, n, cols.length).setValues(rows.map(function (r) { return r.map(function (v, k) { return isText[k] ? (v === null || v === undefined ? '' : guard_(String(v))) : safe_(v); }); }));
  SpreadsheetApp.flush();
}
/** Text that begins with = + - or @ is stored with one leading space: setValues reads a leading "=" as a formula even in a plain-text cell. */
function guard_(v) { return /^[=+\-@]/.test(v) ? ' ' + v : v; }
/** In a column that is not text, a string must still never be read as a formula. */
function safe_(v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/**
 * Run once from the editor (Run > selfTest) after pasting the script. It writes a partial record, the final record and a
 * repeated final record under a test session id, reads the cells back, deletes the test rows and logs the result.
 * Every line must end in true. A line that ends in false also shows what the sheet returned, so that the cause can be read from the log.
 */
function selfTest() {
  var id = 'selftest-' + Date.now(), ss = ss_(), res = [], sh = null, row = 0;
  var show = function (v) { return JSON.stringify(v) + ' (' + typeof v + ')'; };
  var flag = function (v) { return String(v).toLowerCase(); };
  var check = function (name, ok, got) { res.push(name + ': ' + (ok === true ? 'true' : 'false  <- read back: ' + got)); };
  try {
    var q = { age: '18-24', comment: '=1+1', why_open: 'a|b', trust_trace: 4 };
    var t = { session_id: id, list: 0, trial_index: 1, item: 'x', decision: 'accept', link_order: '1', lang: 'en' };
    var meta = { session_id: id, final: false, study_version: 'selftest', list: 0, n_trials_done: 1, started_at: '2026-01-02T03:04:05.000Z', src: '1/2', n_events: 1 };
    var r1 = submit_({ meta: meta, trials: [t], events: [], questionnaire: q });
    sh = ss.getSheetByName('sessions'); row = findRow_(sh, id);
    var cells = row ? sh.getRange(row, 1, 1, SESSION_COLS.length).getValues()[0] : [];
    var cell = function (name) { return cells[SESSION_COLS.indexOf(name)]; };
    check('partial record stored with final = FALSE', r1.ok === true && row > 0 && flag(cell('final')) === 'false', JSON.stringify(r1) + ', row ' + row + ', final ' + show(cell('final')));
    check('partial trials stored', ss.getSheetByName('trials_partial').getLastRow() > 1, 'trials_partial has ' + ss.getSheetByName('trials_partial').getLastRow() + ' rows');
    meta.final = true;
    var r2 = submit_({ meta: meta, trials: [t], events: [{ seq: 1, t: 0, wall: '2026-01-02T03:04:06.000Z', trial: null, item: null, type: 'selftest', visible: true, payload: null }], questionnaire: q });
    cells = sh.getRange(row, 1, 1, SESSION_COLS.length).getValues()[0];
    check('final record stored with final = TRUE', r2.ok === true && flag(cell('final')) === 'true', JSON.stringify(r2) + ', final ' + show(cell('final')));
    check('text cell 18-24 stays text', cell('age') === '18-24', show(cell('age')) + ', number format ' + formatOf_(sh, row, SESSION_COLS.indexOf('age') + 1));
    check('text cell =1+1 stays text (stored with one leading space)', String(cell('comment')).trim() === '=1+1', show(cell('comment')));
    check('text cell 1/2 stays text', cell('src') === '1/2', show(cell('src')));
    check('time stamp stays text', cell('started_at') === '2026-01-02T03:04:05.000Z', show(cell('started_at')));
    check('numbers stay numbers', cell('trust_trace') === 4, show(cell('trust_trace')));
    var nPart = countRows_(ss.getSheetByName('trials_partial'), id), nTr = countRows_(ss.getSheetByName('trials'), id), nEv = countRows_(ss.getSheetByName('events'), id);
    check('partial trials removed, final trials and events stored', nPart === 0 && nTr === 1 && nEv === 1, 'trials_partial ' + nPart + ', trials ' + nTr + ', events ' + nEv);
    var r3 = submit_({ meta: meta, trials: [t], events: [], questionnaire: q });
    check('repeated final record is reported as duplicate', r3.ok === true && r3.duplicate === true, JSON.stringify(r3));
    var k = props_().getProperty('ADMIN_KEY');
    check('admin key set (12+ characters)', !!k && k.length >= 12, k ? 'length ' + k.length : 'not set');
  } catch (err) {
    res.push('error during the test: false  <- ' + err);
  } finally {
    try {
      if (sh) deleteRows_(sh, id, 2);
      ['trials', 'trials_partial', 'events'].forEach(function (n) { var x = ss.getSheetByName(n); if (x) deleteRows_(x, id, 1); });
      check('test rows deleted', !sh || findRow_(sh, id) === 0, 'rows left');
    } catch (err2) { res.push('clean-up: false  <- ' + err2); }
  }
  Logger.log(res.join('\n'));
  Logger.log(res.every(function (l) { return /: true$/.test(l); }) ? 'SELF TEST PASSED' : 'SELF TEST FAILED - see the lines that end in false');
}
function formatOf_(sh, row, col) { try { return sh.getRange(row, col).getNumberFormat(); } catch (e) { return 'unknown'; } }
function countRows_(sh, id) {
  if (sh.getLastRow() < 2) return 0;
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().filter(function (r) { return String(r[0]) === String(id); }).length;
}
