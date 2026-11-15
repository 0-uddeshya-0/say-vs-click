/* Runtime of the study: screens, trial flow, behavioural logging, submission.
 * Design logic lives in design.js, materials in items.js, settings in config.js. */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const app = $("#app"), reader = $("#reader");
  const qs = new URLSearchParams(location.search);
  const t0 = performance.now();
  const now = () => Math.round(performance.now() - t0);

  // ------------------------------------------------------------ session
  const KEY = "svc2_session";
  let S = null;
  try { S = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { S = null; }
  const WAS_DONE = !!(S && S.done) && !qs.has("reset");
  if (!S || qs.has("reset")) {
    const list = qs.has("list") ? (parseInt(qs.get("list"), 10) % 8 + 8) % 8 : null;   // null = assigned at start
    S = { session_id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
          list: list, items_version: null, seed: Math.floor(Math.random() * 2147483647), src: qs.get("src") || "", started_at: new Date().toISOString(), done: false };
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ }
  }
  // The item set comes from the data endpoint when the admin has saved one there; otherwise from items.js.
  // It is fixed at the start of a session and kept in the browser, so a reload continues with the same items.
  let ITEMSET = ITEMS, PRACT = PRACTICE, TRIALS = null; const byId = {};
  const IKEY = "svc2_items_" + S.session_id;
  const rndList = () => Math.floor(Math.random() * 8);
  function setup(items, practice, version, list) {
    ITEMSET = items; PRACT = practice || PRACTICE; S.items_version = version;
    if (S.list === null || S.list === undefined) S.list = list;
    Object.keys(byId).forEach(k => delete byId[k]); ITEMSET.forEach(i => byId[i.id] = i);
    TRIALS = buildTrials(ITEMSET, S.list, S.seed); save();
  }
  function snapshot() { try { localStorage.setItem(IKEY, JSON.stringify({ items: ITEMSET, practice: PRACT })); } catch (e) { /* ignore */ } }
  function prepare() {
    try { const snap = JSON.parse(localStorage.getItem(IKEY) || "null");
      if (snap && S.items_version && S.list !== null) { setup(snap.items, snap.practice, S.items_version, S.list); return Promise.resolve("ok"); } } catch (e) { /* fall through */ }
    const local = () => { setup(ITEMS, PRACTICE, ITEMS_VERSION, rndList()); snapshot(); return "ok"; };
    if (!CONFIG.ENDPOINT_URL) return Promise.resolve(local());
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
    return fetch(CONFIG.ENDPOINT_URL + "?action=start", { signal: ctl.signal, redirect: "follow" }).then(r => r.json()).then(j => {
      clearTimeout(timer);
      if (j && j.open === false) return "closed";
      const remoteOk = !!(j && j.items && validateItems(j.items).length === 0);
      const list = (j && typeof j.list === "number") ? j.list % 8 : rndList();
      if (remoteOk) setup(j.items, j.practice, j.items_version, list); else setup(ITEMS, PRACTICE, ITEMS_VERSION, list);
      log("start_info", { remote_items: remoteOk, list: S.list, items_version: S.items_version }); snapshot(); return "ok";
    }).catch(() => { clearTimeout(timer); log("start_info", { remote_items: false, endpoint_error: true }); return local(); });
  }

  // progress survives a reload: finished trials and events are kept in localStorage
  const PKEY = "svc2_progress_" + S.session_id;
  let P = null; try { P = JSON.parse(localStorage.getItem(PKEY) || "null"); } catch (e) { P = null; }
  const events = P ? P.events : []; const trialRows = P ? P.trialRows : []; let seq = events.length; let cur = null;
  function persist() { try { localStorage.setItem(PKEY, JSON.stringify({ events: events, trialRows: trialRows })); } catch (e) { /* storage full or blocked */ } }
  let inTrials = false;
  window.addEventListener("beforeunload", e => { if (inTrials && !S.done) { e.preventDefault(); e.returnValue = ""; } });
  function log(type, payload) {
    events.push({ seq: ++seq, t: now(), wall: new Date().toISOString(), trial: cur ? cur.index : null,
                  item: cur ? cur.item : null, type: type, visible: document.visibilityState === "visible", payload: payload || null });
  }
  document.addEventListener("visibilitychange", () => { log("visibility", { state: document.visibilityState }); if (R.open) R.tick(); });
  window.addEventListener("blur", () => log("window_blur")); window.addEventListener("focus", () => log("window_focus"));

  function meta() {
    return { session_id: S.session_id, study_version: CONFIG.STUDY_VERSION, list: S.list, items_version: S.items_version, seed: S.seed, src: S.src, started_at: S.started_at,
             preview: !CONFIG.ENDPOINT_URL, user_agent: navigator.userAgent, screen: screen.width + "x" + screen.height,
             window: innerWidth + "x" + innerHeight, language: navigator.language, tz_offset_min: new Date().getTimezoneOffset() };
  }
  function payload(final) { return JSON.stringify({ meta: Object.assign(meta(), { final: !!final, n_trials_done: trialRows.length }), trials: trialRows, questionnaire: Q, events: events }); }
  window.addEventListener("pagehide", () => {
    if (S.done || !CONFIG.ENDPOINT_URL || !trialRows.length) return;
    try { navigator.sendBeacon(CONFIG.ENDPOINT_URL, new Blob([payload(false)], { type: "text/plain" })); } catch (e) { /* ignore */ }
  });

  // ------------------------------------------------------------ helpers
  function h(html) { app.innerHTML = html; window.scrollTo(0, 0); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function progress(txt) { $("#progress").textContent = txt || ""; }

  // ------------------------------------------------------------ source reader with focused-time accounting
  const R = { open: false, idx: null, openedAt: 0, visibleMs: 0, lastTick: 0, maxScroll: 0,
    tick() { const n = now(); if (this.wasVisible) this.visibleMs += n - this.lastTick; this.lastTick = n; this.wasVisible = document.visibilityState === "visible"; },
    show(idx, src) {
      this.open = true; this.idx = idx; this.openedAt = this.lastTick = now(); this.visibleMs = 0; this.maxScroll = 0; this.wasVisible = document.visibilityState === "visible";
      $("#reader-title").textContent = "[" + (idx + 1) + "] " + src.title; $("#reader-origin").textContent = "Source: " + src.origin + ", article “" + src.title + "” (summary)";
      $("#reader-text").textContent = src.text; reader.hidden = false; $("#reader-text").scrollTop = 0; $("#reader-close").focus();
      requestAnimationFrame(() => log("source_rendered", { source: idx + 1 }));
      log("source_open", { source: idx + 1 });
    },
    close(how) {
      if (!this.open) return; this.tick(); this.open = false; reader.hidden = true;
      const rec = { source: this.idx + 1, open_ms: now() - this.openedAt, visible_ms: this.visibleMs, max_scroll: this.maxScroll, closed_by: how };
      log("source_close", rec); if (cur) cur.sourceVisits.push(rec);
    } };
  $("#reader-close").addEventListener("click", () => R.close("button"));
  reader.addEventListener("click", e => { if (e.target === reader) R.close("backdrop"); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && R.open) R.close("escape"); });
  $("#reader-text").addEventListener("scroll", e => { const el = e.target; const d = el.scrollHeight - el.clientHeight; if (d > 0) R.maxScroll = Math.max(R.maxScroll, Math.round(100 * el.scrollTop / d)); });

  // ------------------------------------------------------------ screens
  function screenGate() {
    if (innerWidth < CONFIG.MIN_WIDTH) {
      log("device_gate", { width: innerWidth });
      h('<div class="card"><h1>Please use a larger screen</h1><p>This study needs a laptop or desktop computer, because the sources open in a reading window. Please open the link again on a computer. Thank you.</p></div>');
      return;
    }
    screenConsent();
  }
  function screenConsent() {
    log("screen", { name: "consent" });
    h('<div class="card"><h1>Judging AI answers</h1>' +
      '<p>This study is part of a master’s thesis at Hochschule Neu-Ulm. It looks at how people judge answers given by an AI assistant.</p>' +
      '<h2>What you will do</h2><p>You will see 16 short factual questions, each with an answer from an AI assistant. For each one you decide whether to accept or reject the answer. A few questions about your experience follow. The study takes about 15 minutes.</p>' +
      '<h2>Your data</h2><p>The study records your decisions and how you use the page (for example what you click and for how long). It does not ask for your name, e-mail address or any other detail that identifies you, and it sets no tracking cookies. The data are used for research and may be published in anonymous form.</p>' +
      '<h2>Voluntary participation</h2><p>Taking part is voluntary and unpaid. You can stop at any time by closing the page. You must be at least 18 years old.</p>' +
      '<p class="muted">Contact: ' + esc(CONFIG.CONTACT) + '</p>' +
      '<p><label><input type="checkbox" id="c1"> I am at least 18 years old, I have read the information above and I agree to take part.</label></p>' +
      '<button class="btn primary" id="go" disabled>Start</button></div>');
    $("#c1").addEventListener("change", e => $("#go").disabled = !e.target.checked);
    $("#go").addEventListener("click", () => { log("consent_given"); h('<div class="card"><p>Loading\u2026</p></div>');
      prepare().then(r => { if (r === "closed") { h('<div class="card"><h1>The study is closed</h1><p>This study is not accepting participants at the moment. Thank you for your interest.</p></div>'); return; } screenInstructions(0); }); });
  }
  function screenInstructions(attempt) {
    log("screen", { name: "instructions", attempt: attempt });
    h('<div class="card"><h1>How it works</h1>' +
      '<p>Each page shows a question and the answer of an AI assistant. The assistant can be wrong.</p>' +
      '<p>Below the answer you find the sources the assistant cites. You may open them if you wish. On some pages the assistant also shows its reasoning.</p>' +
      '<p>Your task is to decide whether the answer is correct. Choose <b>Accept</b> if you think it is correct and <b>Reject</b> if you think it is wrong, then confirm. After confirming you cannot go back.</p>' +
      '<p>Please do not look anything up outside this page. At the end you will see how many of your decisions were right.</p>' +
      '<h2>Two quick checks</h2>' +
      '<fieldset><legend>1. What do you decide on each page?</legend><div class="opts">' +
      '<label><input type="radio" name="k1" value="a">Whether I like the answer</label><label><input type="radio" name="k1" value="b">Whether the answer is correct</label><label><input type="radio" name="k1" value="c">Whether the question is interesting</label></div></fieldset>' +
      '<fieldset><legend>2. Can the answers of the assistant be wrong?</legend><div class="opts">' +
      '<label><input type="radio" name="k2" value="a">No, never</label><label><input type="radio" name="k2" value="b">Yes, they can</label></div></fieldset>' +
      '<div class="err" id="err"></div><button class="btn primary" id="go">Continue to a practice question</button></div>');
    $("#go").addEventListener("click", () => {
      const a = ($('input[name=k1]:checked') || {}).value, b = ($('input[name=k2]:checked') || {}).value;
      const ok = a === "b" && b === "b"; log("comprehension", { k1: a || null, k2: b || null, ok: ok, attempt: attempt });
      if (ok) return runTrial(-1);
      if (attempt >= 1) { h('<div class="card"><h1>Thank you</h1><p>The two checks were not answered correctly, so the study ends here. Thank you for your interest.</p></div>'); S.done = true; save(); return; }
      screenInstructions(attempt + 1); $("#err").textContent = "At least one check was not answered correctly. Please read the text again and retry.";
    });
  }

  function runTrial(i) {
    const practice = i < 0;
    const t = practice ? { index: 0, item: "practice", trace: true, supported: true, key: PRACT.key } : TRIALS[i];
    const it = practice ? PRACT : byId[t.item];
    const v = t.supported ? "s" : "u";
    inTrials = true;
    cur = { index: t.index, item: t.item, sourceVisits: [], opens: [], startedAt: now(), firstChoiceAt: null, changes: 0 };
    progress(practice ? "Practice question" : "Question " + t.index + " of " + TRIALS.length);
    log("trial_start", { trace: t.trace, supported: t.supported, practice: practice });
    h((practice ? '<p class="muted">Practice question. It does not count.</p>' : '') +
      '<div class="card"><div class="label">Question</div><div class="question">' + esc(it.question) + '</div></div>' +
      '<div class="card"><div class="label">Answer of the AI assistant</div><div class="answer">' + esc(it.answer[v]) + '</div>' +
      '<div class="label" style="margin-top:16px">Sources</div><div class="sources" aria-label="Cited sources">' + it.sources.map((s, k) => '<button class="chip" data-k="' + k + '"><b>[' + (k + 1) + ']</b>' + esc(s.title) + '</button>').join("") + '</div></div>' +
      (t.trace ? '<div class="card trace"><div class="label">Reasoning of the AI assistant</div><ol>' + it.trace[v].map(x => '<li>' + esc(x) + '</li>').join("") + '</ol></div>' : '') +
      '<div class="card decision"><span>Your decision:</span><button class="btn choice acc" data-d="accept">Accept the answer</button><button class="btn choice rej" data-d="reject">Reject the answer</button>' +
      '<button class="btn primary" id="confirm" disabled>Confirm decision</button></div>');
    let choice = null;
    app.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => { const k = +b.dataset.k; cur.opens.push(k + 1); R.show(k, it.sources[k]); }));
    app.querySelectorAll(".choice").forEach(b => b.addEventListener("click", () => {
      if (choice && choice !== b.dataset.d) cur.changes++; choice = b.dataset.d; if (cur.firstChoiceAt === null) cur.firstChoiceAt = now();
      app.querySelectorAll(".choice").forEach(x => x.classList.toggle("sel", x === b)); $("#confirm").disabled = false; log("decision_select", { decision: choice });
    }));
    $("#confirm").addEventListener("click", () => {
      const end = now(); const visits = cur.sourceVisits; const distinct = Array.from(new Set(cur.opens));
      const answerSays = t.supported ? it.key : (it.key === "yes" ? "no" : "yes");
      const judgedCorrect = (choice === "accept") === (answerSays === it.key);
      const row = { session_id: S.session_id, list: S.list, trial_index: t.index, item: t.item, practice: practice, trace: t.trace ? 1 : 0, supported: t.supported ? 1 : 0,
        key: it.key, decision: choice, correct: judgedCorrect ? 1 : 0, opened_any: distinct.length ? 1 : 0, n_sources_distinct: distinct.length, n_source_opens: cur.opens.length,
        open_order: cur.opens.join(">"), source_open_ms: visits.reduce((a, x) => a + x.open_ms, 0), source_visible_ms: visits.reduce((a, x) => a + x.visible_ms, 0),
        max_scroll: visits.reduce((a, x) => Math.max(a, x.max_scroll), 0), decision_changes: cur.changes, first_choice_ms: cur.firstChoiceAt - cur.startedAt, trial_ms: end - cur.startedAt,
        verification_success: (!t.supported && choice === "reject" && distinct.length > 0) ? 1 : 0 };
      log("decision_confirm", { decision: choice, correct: judgedCorrect }); log("trial_end", row);
      if (!practice) { trialRows.push(row); persist(); } cur = null;
      if (practice) return screenAfterPractice();
      if (i + 1 < TRIALS.length) return runTrial(i + 1);
      screenQuestionnaire();
    });
  }
  function screenAfterPractice() {
    progress(""); log("screen", { name: "after_practice" });
    h('<div class="card"><h1>The study starts now</h1><p>That was the practice question. The 16 questions that follow work in the same way. On some of them the assistant shows its reasoning and on others it does not.</p><button class="btn primary" id="go">Start</button></div>');
    $("#go").addEventListener("click", () => runTrial(0));
  }

  // ------------------------------------------------------------ questionnaire
  let Q = null;
  function likert(name, legend) {
    const lab = ["Not at all", "Slightly", "Moderately", "Very", "Completely"];
    return '<fieldset><legend>' + legend + '</legend><div class="opts">' + lab.map((l, k) => '<label><input type="radio" name="' + name + '" value="' + (k + 1) + '">' + (k + 1) + " " + l + '</label>').join("") + '</div></fieldset>';
  }
  function select(name, legend, opts) { return '<fieldset><legend>' + legend + '</legend><select name="' + name + '"><option value="">Please choose</option>' + opts.map(o => '<option>' + o + '</option>').join("") + '</select></fieldset>'; }
  function screenQuestionnaire() {
    inTrials = false; progress("Final questions"); log("screen", { name: "questionnaire" });
    h('<div class="card"><h1>A few final questions</h1><form id="f">' +
      likert("trust_trace", "1. How trustworthy were the answers that came <u>with</u> the assistant’s reasoning?") +
      likert("trust_notrace", "2. How trustworthy were the answers that came <u>without</u> the assistant’s reasoning?") +
      '<fieldset><legend>3. On how many of the 16 questions did you open at least one source? Please give your best estimate.</legend><input type="number" name="self_checked" min="0" max="16" step="1"></fieldset>' +
      '<fieldset><legend>4. What made you open the sources, or leave them closed?</legend><textarea name="open_why"></textarea></fieldset>' +
      '<fieldset><legend>5. How did seeing the assistant’s reasoning affect your decisions?</legend><textarea name="open_trace"></textarea></fieldset>' +
      select("ai_use", "6. How often do you use AI assistants such as ChatGPT?", ["Never", "Less than once a month", "A few times a month", "A few times a week", "Daily"]) +
      select("habit_check", "7. When an AI assistant cites sources, how often do you open them?", ["Never", "Rarely", "Sometimes", "Often", "Always"]) +
      select("age", "8. Age", ["18–24", "25–34", "35–44", "45–54", "55–64", "65 or older", "Prefer not to say"]) +
      select("gender", "9. Gender", ["Female", "Male", "Non-binary or other", "Prefer not to say"]) +
      select("education", "10. Highest completed education", ["Secondary school", "Vocational training", "Bachelor’s degree", "Master’s degree", "Doctorate", "Other", "Prefer not to say"]) +
      select("english", "11. How well do you read English?", ["Basic", "Intermediate", "Advanced", "Native speaker"]) +
      select("lookup", "12. Did you look anything up outside this page during the study? An honest answer helps and has no consequences.", ["No", "Yes, once or twice", "Yes, several times"]) +
      '<div class="err" id="err"></div><button class="btn primary" type="submit">Finish</button></form></div>');
    $("#f").addEventListener("submit", e => {
      e.preventDefault(); const fd = new FormData(e.target); const o = {}; fd.forEach((v, k) => o[k] = v);
      const need = ["trust_trace", "trust_notrace", "self_checked", "ai_use", "habit_check", "age", "gender", "education", "english", "lookup"];
      const miss = need.filter(k => o[k] === undefined || o[k] === "");
      if (miss.length) { $("#err").textContent = "Please answer questions 1 to 3 and 6 to 12. Questions 4 and 5 are optional but very helpful."; return; }
      o.self_checked = Math.max(0, Math.min(16, parseInt(o.self_checked, 10) || 0)); o.trust_trace = +o.trust_trace; o.trust_notrace = +o.trust_notrace;
      o.logged_checked = trialRows.filter(r => r.opened_any).length; Q = o; log("questionnaire_submit"); screenDebrief();
    });
  }

  // ------------------------------------------------------------ debrief + submit
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function screenDebrief() {
    progress(""); log("session_end"); S.done = true; save(); try { localStorage.removeItem(PKEY); localStorage.removeItem(IKEY); } catch (e) { /* ignore */ }
    const n = trialRows.filter(r => r.correct).length;
    const rows = trialRows.slice().sort((a, b) => a.trial_index - b.trial_index).map(r => { const it = byId[r.item];
      return '<tr><td>' + r.trial_index + '</td><td>' + esc(it.question) + '</td><td>' + (it.key === "yes" ? "Yes" : "No") + '</td><td>' + (r.supported ? "correct" : "wrong") + '</td><td class="' + (r.correct ? "tagok" : "tagno") + '">' + (r.correct ? "right" : "not right") + '</td></tr>'; }).join("");
    h('<div class="card"><h1>Thank you</h1><p id="status" class="muted">Saving your responses…</p>' +
      '<p>You judged <b>' + n + ' of ' + trialRows.length + '</b> answers correctly.</p>' +
      '<h2>What this study is about</h2><p>The assistant in this study was simulated. Its answers, its reasoning and the source summaries were prepared in advance, and <b>4 of the 16 answers were deliberately wrong</b>, although the cited sources contained the correct information. The study examines whether people open the cited sources more or less often when an AI assistant shows its reasoning, and whether this changes how often wrong answers are noticed. This was not mentioned at the start because knowing it would have changed how people use the sources.</p>' +
      '<p>If you would like your data removed, send the code below to the contact address within 14 days.</p><p><b>Your code:</b> <code>' + esc(S.session_id.slice(0, 8)) + '</code></p><p class="muted">Contact: ' + esc(CONFIG.CONTACT) + '</p>' +
      '<p>Please do not tell others who might take part what the study is about.</p></div>' +
      '<div class="card"><h2>The correct answers</h2><table class="res"><tr><th>#</th><th>Question</th><th>Correct answer</th><th>The assistant was</th><th>Your decision was</th></tr>' + rows + '</table></div>' +
      '<div class="card" id="dl" hidden><p>The data could not be sent automatically. Please download the file and send it to the contact address.</p><button class="btn" id="dlb">Download my responses</button></div>');
    submit();
  }
  function offerDownload(msg) {
    $("#status").textContent = msg; $("#dl").hidden = false;
    $("#dlb").addEventListener("click", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([payload(true)], { type: "application/json" })); a.download = "responses-" + S.session_id.slice(0, 8) + ".json"; a.click(); });
  }
  function submit(tryNo) {
    tryNo = tryNo || 1;
    if (!CONFIG.ENDPOINT_URL) return offerDownload("Preview mode: no data endpoint is configured, so nothing was sent.");
    fetch(CONFIG.ENDPOINT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: payload(true), redirect: "follow" })
      .then(r => r.json()).then(j => { if (!j || !j.ok) throw new Error("endpoint"); $("#status").textContent = "Your responses have been saved. You can close this page."; })
      .catch(() => { if (tryNo < 3) return setTimeout(() => submit(tryNo + 1), 1500 * tryNo); offerDownload("Automatic saving failed."); });
  }

  function screenResume() {
    log("resume", { trials_done: trialRows.length });
    h('<div class="card"><h1>Welcome back</h1><p>You have already answered ' + trialRows.length + ' of ' + TRIALS.length + ' questions. The study continues where you left off.</p><button class="btn primary" id="go">Continue</button></div>');
    $("#go").addEventListener("click", () => trialRows.length < TRIALS.length ? runTrial(trialRows.length) : screenQuestionnaire());
  }
  if (WAS_DONE) { h('<div class="card"><h1>Thank you</h1><p>This study has already been completed in this browser. Each person can take part once.</p></div>'); return; }
  if (innerWidth >= CONFIG.MIN_WIDTH && trialRows.length > 0) { prepare().then(screenResume); return; }
  log("session_start", meta());
  screenGate();
})();
