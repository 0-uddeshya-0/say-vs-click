/* Admin page: monitor responses, read the logs, edit questions and sources.
 * With a data endpoint (config.js) it signs in with the admin key and works on the live study.
 * Without one it works locally on the bundled items and on downloaded response files. */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const main = $("#admin"), REMOTE = !!CONFIG.ENDPOINT_URL;
  const esc = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 + "%" : "–";
  let KEYV = sessionStorage.getItem("svc2_admin_key") || "";
  const D = { sessions: null, trials: null, nStarted: null, open: true };      // response data
  const I = { items: clone(ITEMS), practice: clone(PRACTICE), version: ITEMS_VERSION, history: [], sel: 0, dirty: false };

  function api(action, extra) {
    return fetch(CONFIG.ENDPOINT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow",
      body: JSON.stringify(Object.assign({ action: action, key: KEYV }, extra || {})) }).then(r => r.json());
  }
  function toObjects(res) { return (res.rows || []).map(r => { const o = {}; res.header.forEach((h, i) => o[h] = r[i]); return o; }); }
  function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain" })); a.download = name; a.click(); }
  function csv(rows) {
    if (!rows.length) return ""; const cols = Object.keys(rows[0]);
    const cell = v => { v = v === null || v === undefined ? "" : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [cols.join(",")].concat(rows.map(r => cols.map(c => cell(r[c])).join(","))).join("\r\n");
  }
  const truthy = v => v === true || String(v).toLowerCase() === "true" || v === 1 || v === "1";

  // ------------------------------------------------------------ sign-in
  function screenLogin(msg) {
    $("#tabs").hidden = true;
    main.innerHTML = '<div class="card" style="max-width:520px;margin:40px auto"><h1>Study admin</h1>' +
      '<p>Enter the admin key. It is the value stored as <code>ADMIN_KEY</code> in the script properties of the data endpoint, and it is never saved in the repository.</p>' +
      '<input type="password" id="k" placeholder="Admin key" autocomplete="off"><div class="err" id="err">' + esc(msg || "") + '</div><button class="btn primary" id="go">Sign in</button></div>';
    const go = () => { KEYV = $("#k").value.trim(); $("#err").textContent = "Checking…";
      api("admin_ping").then(j => { if (!j.ok) throw new Error(j.error); sessionStorage.setItem("svc2_admin_key", KEYV); D.open = j.open; start(); })
        .catch(e => { $("#err").textContent = e.message === "auth" ? "The key was not accepted." : "The endpoint could not be reached or returned an error (" + e.message + ")."; }); };
    $("#go").addEventListener("click", go); $("#k").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  }
  function start() {
    $("#tabs").hidden = false; $("#who").innerHTML = REMOTE ? 'Connected to the data endpoint · <a href="#" id="out">Sign out</a>' : "Local mode (no data endpoint configured)";
    if (REMOTE) $("#out").addEventListener("click", e => { e.preventDefault(); sessionStorage.removeItem("svc2_admin_key"); KEYV = ""; screenLogin(); });
    const first = REMOTE ? api("admin_get_items").then(j => { if (j.ok) { I.history = j.history || []; if (j.current) { I.items = j.current.items; I.practice = j.current.practice || clone(PRACTICE); I.version = j.current.version; } } }).catch(() => {}) : Promise.resolve();
    first.then(() => show("overview"));
  }
  $$("#tabs button").forEach(b => b.addEventListener("click", () => {
    if (I.dirty && b.dataset.tab !== "items" && !confirm("The item set has unsaved changes. Leave the editor? The changes stay in this page until it is reloaded.")) return;
    show(b.dataset.tab); }));
  function show(tab) { $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab)); ({ overview: tabOverview, responses: tabResponses, items: tabItems, help: tabHelp })[tab](); }

  function loadData(force) {
    if (!REMOTE) return Promise.resolve();
    if (D.sessions && !force) return Promise.resolve();
    return Promise.all([api("admin_data", { sheet: "sessions" }), api("admin_data", { sheet: "trials" })]).then(r => {
      if (!r[0].ok) throw new Error(r[0].error); D.sessions = toObjects(r[0]); D.trials = toObjects(r[1]); D.nStarted = r[0].n_started; D.open = r[0].open; });
  }
  function localFileButton() { return '<label class="btn">Open response file(s) <input type="file" id="lf" accept=".json" multiple hidden></label>'; }
  function bindLocalFile(after) {
    const el = $("#lf"); if (!el) return;
    el.addEventListener("change", () => { Promise.all(Array.from(el.files).map(f => f.text())).then(texts => {
      D.sessions = D.sessions || []; D.trials = D.trials || []; D.localEvents = D.localEvents || {};
      texts.forEach(t => { const j = JSON.parse(t), m = j.meta, q = j.questionnaire || {};
        D.sessions.push(Object.assign({ received_at: "(file)", session_id: m.session_id, final: m.final, study_version: m.study_version, items_version: m.items_version, list: m.list, src: m.src, started_at: m.started_at, n_trials_done: m.n_trials_done }, q));
        (j.trials || []).forEach(r => D.trials.push(r)); D.localEvents[m.session_id] = j.events || []; });
      after(); }); });
  }

  // ------------------------------------------------------------ overview
  function tabOverview() {
    main.innerHTML = '<div class="card"><p>Loading…</p></div>';
    loadData().then(renderOverview).catch(e => { if (e.message === "auth") return screenLogin("Please sign in again."); main.innerHTML = '<div class="card"><p class="bad">Could not load the data: ' + esc(e.message) + '</p></div>'; });
  }
  function finals() { const seen = {}; return (D.sessions || []).filter(s => truthy(s.final) && !seen[s.session_id] && (seen[s.session_id] = 1)); }
  function renderOverview() {
    const fin = finals(), finIds = {}; fin.forEach(s => finIds[s.session_id] = 1);
    const partial = {}; (D.sessions || []).forEach(s => { if (!truthy(s.final) && !finIds[s.session_id]) partial[s.session_id] = 1; });
    const T = (D.trials || []).filter(t => finIds[t.session_id]);
    const dur = {}; T.forEach(t => dur[t.session_id] = (dur[t.session_id] || 0) + Number(t.trial_ms || 0));
    const durs = Object.values(dur).sort((a, b) => a - b), med = durs.length ? Math.round(durs[Math.floor(durs.length / 2)] / 6000) / 10 : null;
    const by = k => { const o = {}; fin.forEach(s => { const v = s[k] === "" || s[k] === undefined ? "(none)" : s[k]; o[v] = (o[v] || 0) + 1; }); return o; };
    const lists = by("list"), srcs = by("src"), vers = by("items_version");
    const cond = tr => { const a = T.filter(t => Number(t.trace) === tr), u = a.filter(t => Number(t.supported) === 0);
      return '<tr><td>' + (tr ? "Trace shown" : "No trace") + '</td><td>' + a.length + '</td><td>' + pct(a.filter(t => Number(t.opened_any)).length, a.length) + '</td><td>' + pct(a.filter(t => Number(t.correct)).length, a.length) +
        '</td><td>' + u.length + '</td><td>' + pct(u.filter(t => t.decision === "reject").length, u.length) + '</td><td>' + pct(u.filter(t => Number(t.verification_success)).length, u.length) + '</td></tr>'; };
    const self = fin.filter(s => s.self_checked !== "" && s.self_checked !== undefined);
    const mean = k => self.length ? Math.round(10 * self.reduce((a, s) => a + Number(s[k]), 0) / self.length) / 10 : "–";
    main.innerHTML =
      '<div class="row">' + (REMOTE ? '<button class="btn" id="refresh">Refresh</button><span>Study is <b class="' + (D.open ? "ok" : "bad") + '">' + (D.open ? "open" : "closed") + '</b></span><button class="btn" id="toggle">' + (D.open ? "Close the study" : "Open the study") + '</button>' : localFileButton() + '<span class="muted">Local mode: open the response files that the study offers as a download in preview mode.</span>') + '</div>' +
      '<div class="grid"><div class="card"><div class="stat">' + (D.nStarted === null ? "–" : D.nStarted) + '<small>started (passed consent)</small></div></div><div class="card"><div class="stat">' + fin.length + '<small>completed</small></div></div>' +
      '<div class="card"><div class="stat">' + Object.keys(partial).length + '<small>left early (partial data stored)</small></div></div><div class="card"><div class="stat">' + (med === null ? "–" : med + " min") + '<small>median time on the 16 questions</small></div></div></div>' +
      '<div class="card"><h2 style="margin-top:0">Completed sessions per list</h2><p class="muted">The eight lists should fill evenly. The endpoint hands them out in rotation.</p><div class="row">' +
      [0, 1, 2, 3, 4, 5, 6, 7].map(l => '<span class="pill">List ' + l + ': <b>' + (lists[l] || 0) + '</b></span>').join("") + '</div>' +
      '<h2>Per recruitment channel (?src=)</h2><div class="row">' + (Object.keys(srcs).map(k => '<span class="pill">' + esc(k) + ': <b>' + srcs[k] + '</b></span>').join("") || '<span class="muted">No completed sessions yet.</span>') + '</div>' +
      '<h2>Item set versions in the data</h2><div class="row">' + (Object.keys(vers).map(k => '<span class="pill">' + esc(k) + ': <b>' + vers[k] + '</b></span>').join("") || '<span class="muted">–</span>') + '</div></div>' +
      '<div class="card"><h2 style="margin-top:0">Outcomes by condition</h2><div class="warn">Monitoring only. Deciding when to stop collecting on the basis of these figures inflates the error rate of the hypothesis tests. Fix the stopping rule (target sample or end date) before looking.</div>' +
      '<button class="btn" id="reveal">Show the figures</button><div id="outc" hidden><div class="scroll"><table class="data"><tr><th>Condition</th><th>Trials</th><th>Source opened</th><th>Decision correct</th><th>Unsupported trials</th><th>Rejected</th><th>Verification success</th></tr>' + cond(1) + cond(0) + '</table></div>' +
      '<p style="margin-top:12px">Say versus click: participants reported opening a source on <b>' + mean("self_checked") + '</b> of 16 questions on average; the log shows <b>' + mean("logged_checked") + '</b>.</p></div></div>';
    if ($("#refresh")) $("#refresh").addEventListener("click", () => { main.innerHTML = '<div class="card"><p>Loading…</p></div>'; loadData(true).then(renderOverview); });
    if ($("#toggle")) $("#toggle").addEventListener("click", () => { if (!confirm(D.open ? "Close the study? New visitors will see a closed notice. Sessions in progress can finish." : "Open the study for new participants?")) return;
      api("admin_set_open", { open: !D.open }).then(j => { D.open = j.open; renderOverview(); }); });
    $("#reveal").addEventListener("click", () => { $("#outc").hidden = false; $("#reveal").hidden = true; });
    bindLocalFile(renderOverview);
  }

  // ------------------------------------------------------------ responses
  function tabResponses() {
    main.innerHTML = '<div class="card"><p>Loading…</p></div>';
    loadData().then(renderResponses).catch(e => { main.innerHTML = '<div class="card"><p class="bad">Could not load the data: ' + esc(e.message) + '</p></div>'; });
  }
  function renderResponses() {
    const S = (D.sessions || []).slice().reverse();
    const cols = ["received_at", "session_id", "final", "list", "src", "items_version", "n_trials_done", "logged_checked", "self_checked", "trust_trace", "trust_notrace", "lookup"];
    main.innerHTML = '<div class="row">' + (REMOTE ? '<button class="btn" id="refresh">Refresh</button>' : localFileButton()) +
      '<button class="btn" id="d1">Download sessions.csv</button><button class="btn" id="d2">Download trials.csv</button>' + (REMOTE ? '<button class="btn" id="d3">Download events.csv</button>' : "") + '</div>' +
      '<div class="card"><h2 style="margin-top:0">Sessions (' + S.length + ' rows, newest first)</h2><p class="muted">Click a row to see its 16 trials and the full event log. A session with final = false left early.</p><div class="scroll"><table class="data"><tr>' + cols.map(c => '<th>' + c + '</th>').join("") + '</tr>' +
      S.map((s, i) => '<tr class="click" data-i="' + i + '">' + cols.map(c => '<td>' + (c === "session_id" ? esc(String(s[c]).slice(0, 8)) : c === "final" ? '<span class="pill ' + (truthy(s[c]) ? "ok" : "no") + '">' + (truthy(s[c]) ? "complete" : "partial") + '</span>' : esc(s[c])) + '</td>').join("") + '</tr>').join("") +
      '</table></div></div><div id="detail"></div>';
    if ($("#refresh")) $("#refresh").addEventListener("click", () => loadData(true).then(renderResponses));
    $("#d1").addEventListener("click", () => download("sessions.csv", csv(D.sessions || []), "text/csv"));
    $("#d2").addEventListener("click", () => download("trials.csv", csv(D.trials || []), "text/csv"));
    if ($("#d3")) $("#d3").addEventListener("click", () => api("admin_data", { sheet: "events" }).then(r => download("events.csv", csv(toObjects(r)), "text/csv")));
    $$("tr.click").forEach(tr => tr.addEventListener("click", () => sessionDetail(S[+tr.dataset.i])));
    bindLocalFile(renderResponses);
  }
  function sessionDetail(s) {
    const T = (D.trials || []).filter(t => t.session_id === s.session_id).sort((a, b) => a.trial_index - b.trial_index);
    const tc = ["trial_index", "item", "trace", "supported", "decision", "correct", "opened_any", "n_sources_distinct", "open_order", "source_visible_ms", "max_scroll", "decision_changes", "trial_ms", "verification_success"];
    const box = $("#detail");
    box.innerHTML = '<div class="card"><h2 style="margin-top:0">Session ' + esc(String(s.session_id).slice(0, 8)) + '</h2>' +
      '<p><b>Why sources were opened or not:</b> ' + (esc(s.open_why) || '<span class="muted">(no answer)</span>') + '<br><b>Effect of the reasoning:</b> ' + (esc(s.open_trace) || '<span class="muted">(no answer)</span>') + '</p>' +
      '<p class="muted">AI use: ' + esc(s.ai_use) + ' · habit: ' + esc(s.habit_check) + ' · age: ' + esc(s.age) + ' · gender: ' + esc(s.gender) + ' · education: ' + esc(s.education) + ' · English: ' + esc(s.english) + '</p>' +
      '<h2>Trials</h2><div class="scroll"><table class="data"><tr>' + tc.map(c => '<th>' + c + '</th>').join("") + '</tr>' + T.map(t => '<tr>' + tc.map(c => '<td>' + esc(t[c]) + '</td>').join("") + '</tr>').join("") + '</table></div>' +
      '<h2>Event log</h2><div id="ev" class="scroll"><p class="muted">Loading…</p></div></div>';
    box.scrollIntoView({ behavior: "smooth" });
    const render = ev => { $("#ev").innerHTML = ev.length ? '<table class="data"><tr><th>seq</th><th>t (ms)</th><th>trial</th><th>item</th><th>type</th><th>tab visible</th><th>details</th></tr>' +
      ev.map(e => '<tr><td>' + esc(e.seq) + '</td><td>' + esc(e.t) + '</td><td>' + esc(e.trial) + '</td><td>' + esc(e.item) + '</td><td>' + esc(e.type) + '</td><td>' + esc(e.visible) + '</td><td>' + esc(e.payload_json !== undefined ? e.payload_json : (e.payload ? JSON.stringify(e.payload) : "")) + '</td></tr>').join("") + '</table>'
      : '<p class="muted">No events stored for this session (partial sessions store trials only in the raw record).</p>'; };
    if (D.localEvents && D.localEvents[s.session_id]) return render(D.localEvents[s.session_id]);
    if (REMOTE) api("admin_data", { sheet: "events", session_id: s.session_id }).then(r => render(toObjects(r))); else render([]);
  }

  // ------------------------------------------------------------ items editor
  const words = t => (String(t || "").trim().match(/\S+/g) || []).length;
  function tabItems() {
    const problems = validateItems(I.items), it = I.items[I.sel] || I.items[0];
    const nData = finals().length;
    const list = [0, 1, 2, 3].map(g => '<div class="g">Group ' + g + '</div>' + I.items.map((x, n) => x.group === g ? '<button data-n="' + n + '" class="' + (n === I.sel ? "on" : "") + '"><b>' + esc(x.id) + '</b> <span class="pill">' + esc(x.key) + '</span><br><span class="muted">' + esc(String(x.question).slice(0, 54)) + '</span></button>' : "").join("")).join("") +
      (I.items.some(x => [0, 1, 2, 3].indexOf(x.group) < 0) ? '<div class="g bad">No valid group</div>' + I.items.map((x, n) => [0, 1, 2, 3].indexOf(x.group) < 0 ? '<button data-n="' + n + '">' + esc(x.id) + '</button>' : "").join("") : "");
    const ver = v => '<div class="' + v + '"><h2>' + (v === "s" ? "Supported version" : "Unsupported version") + '</h2><p class="muted">' + (v === "s" ? "The answer agrees with the sources and is correct." : "The answer contradicts the sources and is wrong. The trace argues for the wrong answer.") + '</p>' +
      '<label class="f">Answer of the assistant <small>(must begin with ' + (v === "s" ? it.key : (it.key === "yes" ? "no" : "yes")) + ')</small></label><textarea data-f="answer.' + v + '">' + esc(it.answer[v]) + '</textarea>' +
      '<label class="f">Reasoning trace <small>(one step per line; ' + it.trace[v].length + ' steps, ' + words(it.trace[v].join(" ")) + ' words)</small></label><textarea class="tall" data-f="trace.' + v + '">' + esc(it.trace[v].join("\n")) + '</textarea></div>';
    main.innerHTML =
      '<div class="row"><span>Item set: <b>' + esc(I.version) + '</b>' + (I.dirty ? ' <span class="pill no">unsaved changes</span>' : "") + '</span>' +
      (REMOTE ? '<button class="btn primary" id="save"' + (problems.length ? " disabled" : "") + '>Save to the live study</button>' : "") +
      '<button class="btn" id="dljs">Download items.js</button><button class="btn" id="dljson">Download JSON</button><label class="btn">Import JSON <input type="file" id="imp" accept=".json" hidden></label><button class="btn" id="preview">Preview this item</button><button class="btn" id="reset">Reset to the bundled set</button></div>' +
      (nData ? '<div class="warn"><b>' + nData + ' completed session(s) already exist.</b> Saving creates a new item-set version from now on. Sessions record the version they used, and the analysis has to treat different versions separately. Do not edit items during data collection unless an error forces it.</div>' : "") +
      '<div class="card">' + (problems.length ? '<b class="bad">The item set cannot be saved yet (' + problems.length + ' problem' + (problems.length > 1 ? "s" : "") + '):</b><ul class="problems">' + problems.slice(0, 12).map(p => '<li>' + esc(p) + '</li>').join("") + '</ul>' : '<b class="ok">The item set is valid:</b> 16 items, four groups with two yes and two no items each, all texts present.') + '</div>' +
      '<div class="split"><div class="itemlist">' + list + '</div><div class="card">' +
      '<div class="two"><div><label class="f">Id <small>(short, lower case; appears in the data)</small></label><input type="text" data-f="id" value="' + esc(it.id) + '"></div>' +
      '<div class="two"><div><label class="f">Group</label><select data-f="group">' + [0, 1, 2, 3].map(g => '<option' + (it.group === g ? " selected" : "") + '>' + g + '</option>').join("") + '</select></div>' +
      '<div><label class="f">Correct answer</label><select data-f="key"><option' + (it.key === "yes" ? " selected" : "") + '>yes</option><option' + (it.key === "no" ? " selected" : "") + '>no</option></select></div></div></div>' +
      '<label class="f">Question <small>(a yes/no question)</small></label><textarea data-f="question" style="min-height:60px">' + esc(it.question) + '</textarea>' +
      '<div class="two">' + ver("s") + ver("u") + '</div>' +
      '<h2>Sources <small class="muted">(the same three in both versions; they must contain what settles the question)</small></h2>' +
      it.sources.map((s, k) => '<div class="two"><div><label class="f">[' + (k + 1) + '] Title</label><input type="text" data-f="sources.' + k + '.title" value="' + esc(s.title) + '"></div><div><label class="f">Origin</label><input type="text" data-f="sources.' + k + '.origin" value="' + esc(s.origin) + '"></div></div>' +
        '<label class="f">Text <small>(' + words(s.text) + ' words)</small></label><textarea class="tall" data-f="sources.' + k + '.text">' + esc(s.text) + '</textarea>').join("") +
      '</div></div>';
    $$(".itemlist button").forEach(b => b.addEventListener("click", () => { I.sel = +b.dataset.n; tabItems(); }));
    $$("[data-f]").forEach(el => el.addEventListener("change", () => {
      const f = el.dataset.f.split("."), v = el.value;
      if (f[0] === "group") it.group = parseInt(v, 10); else if (f[0] === "trace") it.trace[f[1]] = v.split("\n").map(x => x.trim()).filter(Boolean);
      else if (f[0] === "answer") it.answer[f[1]] = v.trim(); else if (f[0] === "sources") it.sources[+f[1]][f[2]] = v.trim(); else it[f[0]] = v.trim();
      I.dirty = true; tabItems(); }));
    const payload = () => JSON.stringify({ items: I.items, practice: I.practice }, null, 2);
    $("#dljson").addEventListener("click", () => download("items.json", payload(), "application/json"));
    $("#dljs").addEventListener("click", () => download("items.js", "/* Item bank exported from the admin page on " + new Date().toISOString() + ". */\nconst ITEMS_VERSION = \"bundled-" + new Date().toISOString().slice(0, 10) + "\";\nconst ITEMS = " + JSON.stringify(I.items, null, 2) + ";\n\nconst PRACTICE = " + JSON.stringify(I.practice, null, 2) + ";\n\nif (typeof module !== \"undefined\") module.exports = { ITEMS, PRACTICE, ITEMS_VERSION };\n", "text/javascript"));
    $("#imp").addEventListener("change", e => e.target.files[0].text().then(t => { try { const j = JSON.parse(t); if (!Array.isArray(j.items)) throw 0; I.items = j.items; if (j.practice) I.practice = j.practice; I.sel = 0; I.dirty = true; tabItems(); } catch (x) { alert("This file is not an item set exported from this page."); } }));
    $("#reset").addEventListener("click", () => { if (confirm("Discard the changes in this page and load the item set bundled in items.js?")) { I.items = clone(ITEMS); I.practice = clone(PRACTICE); I.sel = 0; I.dirty = true; tabItems(); } });
    $("#preview").addEventListener("click", () => preview(it));
    if ($("#save")) $("#save").addEventListener("click", () => {
      const note = prompt("Short note on what changed (stored with the version):", ""); if (note === null) return;
      $("#save").disabled = true; $("#save").textContent = "Saving…";
      api("admin_save_items", { items: I.items, practice: I.practice, note: note }).then(j => { if (!j.ok) throw new Error(j.error); I.version = j.version; I.dirty = false; tabItems(); alert("Saved as " + j.version + ". New participants receive this set."); })
        .catch(e => { alert("Saving failed: " + e.message); tabItems(); }); });
  }
  function preview(it) {
    const view = (v, tr) => '<div class="card"><div class="label">' + (v === "s" ? "Supported" : "Unsupported") + (tr ? ", with trace" : ", without trace") + '</div><div class="question">' + esc(it.question) + '</div><p class="answer" style="margin-top:10px">' + esc(it.answer[v]) + '</p><div class="sources">' +
      it.sources.map((s, k) => '<span class="chip"><b>[' + (k + 1) + ']</b>' + esc(s.title) + '</span>').join("") + '</div>' + (tr ? '<div class="trace" style="margin-top:12px"><div class="label">Reasoning of the AI assistant</div><ol>' + it.trace[v].map(x => '<li>' + esc(x) + '</li>').join("") + '</ol></div>' : "") + '</div>';
    $("#pv-title").textContent = "Preview: " + it.id; $("#pv-body").innerHTML = view("s", true) + view("u", true) + view("s", false) +
      '<h2>Sources as participants read them</h2>' + it.sources.map((s, k) => '<p><b>[' + (k + 1) + '] ' + esc(s.title) + '</b> <span class="muted">(' + esc(s.origin) + ', summary)</span><br>' + esc(s.text) + '</p>').join("");
    $("#reader").hidden = false;
  }
  $("#pv-close").addEventListener("click", () => $("#reader").hidden = true);

  // ------------------------------------------------------------ help
  function tabHelp() {
    main.innerHTML = '<div class="card"><h1>Setup and help</h1>' +
      '<h2>Where things live</h2><p><b>GitHub Pages</b> serves the study pages. <b>A Google Sheet</b> with a small script stores the responses, hands out the lists in rotation and keeps the live item set. This page talks to that script.</p>' +
      '<h2>Editing questions and sources</h2><p>Open <i>Questions and sources</i>, change the texts, check the preview, and save. ' + (REMOTE ? 'Saving stores a new version at the data endpoint; new participants receive it at once. Nothing has to be pushed to GitHub.' : 'In local mode, download <code>items.js</code> and replace the file in the repository.') + ' The editor refuses a set that would unbalance the design.</p>' +
      '<h2>Before data collection</h2><p>Freeze the item set. A second reader checks every answer against the sources (use <i>Preview this item</i>). Run the study once yourself and check that the session appears under <i>Responses</i>.</p>' +
      '<h2>During data collection</h2><p>Watch completions per list and per channel on the <i>Overview</i>. Leave the items unchanged. Close the study from the <i>Overview</i> when the target is reached.</p>' +
      '<h2>After data collection</h2><p>Download <code>sessions.csv</code> and <code>trials.csv</code> under <i>Responses</i> and run <code>analysis.R</code>.</p>' +
      '<p class="muted">Endpoint: ' + (REMOTE ? esc(CONFIG.ENDPOINT_URL) : "not configured (config.js)") + ' · Study version: ' + esc(CONFIG.STUDY_VERSION) + '</p></div>';
  }

  if (REMOTE && !KEYV) screenLogin(); else if (REMOTE) api("admin_ping").then(j => j.ok ? (D.open = j.open, start()) : screenLogin()).catch(() => screenLogin("The endpoint could not be reached.")); else start();
})();
