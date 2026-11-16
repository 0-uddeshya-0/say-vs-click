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
  function progress(txt, frac) { $("#progress").textContent = txt || ""; $("#bar").hidden = frac === undefined; if (frac !== undefined) $("#barfill").style.width = Math.round(100 * frac) + "%"; }

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
  const ABOUT = '<details class="about"><summary>About this study</summary>' +
    '<p><b>Who runs it?</b> ' + esc(CONFIG.RESEARCHER) + ', as part of a master’s thesis in the programme Artificial Intelligence and Data Analytics at Hochschule Neu-Ulm (HNU), Germany.</p>' +
    '<p><b>What is it about?</b> AI assistants now answer many everyday questions. The thesis looks at how people decide whether such an answer can be relied on. More detail follows at the end, because knowing it in advance could change how people take part.</p>' +
    '<p><b>What happens with the results?</b> They are analysed in anonymous form for the thesis and may appear in a scientific publication. No individual person can be identified.</p>' +
    '<p><b>Questions, or interested in the findings?</b> Write to <a href="mailto:' + esc(CONFIG.EMAIL) + '">' + esc(CONFIG.EMAIL) + '</a>.</p></details>';
  function screenConsent() {
    log("screen", { name: "consent" }); progress("");
    h('<div class="card hero"><div class="tag">Master’s thesis study · about 15 minutes</div><h1>Can you tell when an AI answer is right?</h1>' +
      '<p class="lead">You will see 16 short factual questions, each with an answer from an AI assistant. You decide whether to accept or reject the answer. A few quick multiple-choice questions follow.</p></div>' +
      '<div class="cols3"><div class="card mini c1"><b>Anonymous</b><span>No name, no e-mail address, no tracking cookies.</span></div>' +
      '<div class="card mini c2"><b>Voluntary</b><span>Unpaid. You can stop at any time by closing the page.</span></div>' +
      '<div class="card mini c3"><b>On a computer</b><span>Please use a laptop or desktop, and take part only once.</span></div></div>' +
      '<div class="card"><h2 style="margin-top:0">Your data</h2><p>The study records your decisions and how you use the page, for example what you click and for how long. The data are used for research only and are published only in anonymous form.</p>' + ABOUT +
      '<label class="check"><input type="checkbox" id="c1"><span>I am at least 18 years old, I have read the information above and I agree to take part.</span></label>' +
      '<button class="btn primary big" id="go" disabled>Start the study</button></div>');
    $("#c1").addEventListener("change", e => $("#go").disabled = !e.target.checked);
    $("#go").addEventListener("click", () => { log("consent_given"); h('<div class="card"><p>Loading…</p></div>');
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
    progress(practice ? "Practice question" : "Question " + t.index + " of " + TRIALS.length, practice ? 0 : (t.index - 1) / TRIALS.length);
    log("trial_start", { trace: t.trace, supported: t.supported, practice: practice });
    h((practice ? '<p class="muted">Practice question. It does not count.</p>' : '') +
      '<div class="card q"><div class="label">Question</div><div class="question">' + esc(it.question) + '</div></div>' +
      '<div class="card"><div class="label">Answer of the AI assistant</div><div class="answer">' + esc(it.answer[v]) + '</div>' +
      '<div style="margin-top:16px"><div class="label">Sources</div></div><div class="sources" aria-label="Cited sources">' + it.sources.map((s, k) => '<button class="chip" data-k="' + k + '"><b>[' + (k + 1) + ']</b>' + esc(s.title) + '</button>').join("") + '</div></div>' +
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

  // ------------------------------------------------------------ questionnaire (closed questions, three short pages)
  let Q = null;
  const FORM = [
    { title: "Your decisions", fields: [
      { name: "trust_trace", type: "scale", q: "How trustworthy were the answers that came <u>with</u> the assistant’s reasoning?", lo: "Not at all", hi: "Completely" },
      { name: "trust_notrace", type: "scale", q: "How trustworthy were the answers that came <u>without</u> the assistant’s reasoning?", lo: "Not at all", hi: "Completely" },
      { name: "self_checked", type: "count", q: "On how many of the 16 questions did you open at least one source?", hint: "Your best estimate is fine." } ] },
    { title: "Sources and reasoning", fields: [
      { name: "why_open", type: "multi", q: "When you opened a source, what were your reasons?", hint: "Select all that apply.", exclusive: ["none"], opts: [
        ["unsure", "I was unsure whether the answer was correct"], ["surprised", "The answer surprised me or went against what I knew"], ["trace_doubt", "The assistant’s reasoning did not convince me"],
        ["trace_pointer", "The reasoning showed me what was worth checking"], ["no_trace", "No reasoning was shown, so I wanted to see evidence"], ["be_sure", "I wanted to be sure before deciding"], ["curious", "I was simply curious"], ["none", "I did not open any source"]] },
      { name: "why_closed", type: "multi", q: "When you left the sources closed, what were your reasons?", hint: "Select all that apply.", exclusive: ["always"], opts: [
        ["knew", "I already knew the answer"], ["plausible", "The answer sounded plausible"], ["trace_convinced", "The assistant’s reasoning convinced me"], ["trace_instead", "I checked the reasoning and felt no need for the sources"],
        ["effort", "Opening and reading sources takes too much time"], ["trust_ai", "I generally trust AI assistants on questions like these"], ["unnoticed", "I did not notice the sources"], ["always", "I opened a source on every question"]] },
      { name: "trace_read", type: "single", q: "When the assistant showed its reasoning, how often did you read it?", opts: [["never", "Never"], ["few", "On a few questions"], ["most", "On most questions"], ["all", "On every question"]] },
      { name: "trace_effect", type: "single", q: "Overall, how did seeing the reasoning affect your decisions?", opts: [["accept", "It made me more willing to accept answers"], ["critical", "It made me more critical of answers"], ["none", "It made no difference"], ["mixed", "It differed from question to question"]] } ] },
    { title: "About you", fields: [
      { name: "ai_use", type: "single", q: "How often do you use AI assistants such as ChatGPT?", opts: [["never", "Never"], ["lt_monthly", "Less than once a month"], ["monthly", "A few times a month"], ["weekly", "A few times a week"], ["daily", "Daily"]] },
      { name: "habit_check", type: "single", q: "When an AI assistant cites sources, how often do you open them?", opts: [["never", "Never"], ["rarely", "Rarely"], ["sometimes", "Sometimes"], ["often", "Often"], ["always", "Always"]] },
      { name: "age", type: "single", q: "Your age", opts: [["18-24", "18–24"], ["25-34", "25–34"], ["35-44", "35–44"], ["45-54", "45–54"], ["55-64", "55–64"], ["65+", "65 or older"], ["na", "Prefer not to say"]] },
      { name: "gender", type: "single", q: "Your gender", opts: [["female", "Female"], ["male", "Male"], ["other", "Non-binary or other"], ["na", "Prefer not to say"]] },
      { name: "education", type: "single", q: "Highest completed education", opts: [["secondary", "Secondary school"], ["vocational", "Vocational training"], ["bachelor", "Bachelor’s degree"], ["master", "Master’s degree"], ["doctorate", "Doctorate"], ["other", "Other"], ["na", "Prefer not to say"]] },
      { name: "english", type: "single", q: "How well do you read English?", opts: [["basic", "Basic"], ["intermediate", "Intermediate"], ["advanced", "Advanced"], ["native", "Native speaker"]] },
      { name: "lookup", type: "single", q: "Did you look anything up outside this page during the study?", hint: "An honest answer helps and has no consequences.", opts: [["no", "No"], ["once", "Yes, once or twice"], ["several", "Yes, several times"]] },
      { name: "comment", type: "text", q: "Anything else you would like to mention?", hint: "Optional." } ] } ];
  const A = {};
  function fieldHtml(f, n) {
    const head = '<div class="qn">' + n + '</div><div class="qb"><div class="qt">' + f.q + '</div>' + (f.hint ? '<div class="muted">' + f.hint + '</div>' : "");
    const on = v => f.type === "multi" ? (A[f.name] || []).indexOf(v) >= 0 : String(A[f.name]) === String(v);
    let body = "";
    if (f.type === "scale") body = '<div class="scale"><span class="muted">' + f.lo + '</span>' + [1, 2, 3, 4, 5].map(v => '<button type="button" class="opt num' + (on(v) ? " on" : "") + '" data-f="' + f.name + '" data-v="' + v + '">' + v + '</button>').join("") + '<span class="muted">' + f.hi + '</span></div>';
    else if (f.type === "count") body = '<div class="opts tight">' + Array.from({ length: 17 }, (x, v) => '<button type="button" class="opt num' + (on(v) ? " on" : "") + '" data-f="' + f.name + '" data-v="' + v + '">' + v + '</button>').join("") + '</div>';
    else if (f.type === "text") body = '<textarea data-t="' + f.name + '" maxlength="600">' + esc(A[f.name] || "") + '</textarea>';
    else body = '<div class="opts' + (f.type === "multi" ? " col" : "") + '">' + f.opts.map(o => '<button type="button" class="opt' + (f.type === "multi" ? " box" : "") + (on(o[0]) ? " on" : "") + '" data-f="' + f.name + '" data-v="' + o[0] + '" aria-pressed="' + on(o[0]) + '">' + o[1] + '</button>').join("") + '</div>';
    return '<div class="qrow" id="q_' + f.name + '">' + head + body + '</div></div>';
  }
  function screenQuestionnaire(page) {
    page = page || 0; inTrials = false; const P = FORM[page]; let n0 = 1; for (let k = 0; k < page; k++) n0 += FORM[k].fields.length;
    progress("Final questions · part " + (page + 1) + " of " + FORM.length, (page + 1) / (FORM.length + 1)); if (page === 0) log("screen", { name: "questionnaire" });
    h('<div class="card"><div class="tag">Almost done</div><h1>' + P.title + '</h1>' + P.fields.map((f, k) => fieldHtml(f, n0 + k)).join("") +
      '<div class="err" id="err"></div><div class="row">' + (page ? '<button class="btn" id="back">Back</button>' : "") + '<button class="btn primary" id="next">' + (page + 1 < FORM.length ? "Continue" : "Finish") + '</button></div></div>');
    const byName = {}; P.fields.forEach(f => byName[f.name] = f);
    app.querySelectorAll(".opt").forEach(b => b.addEventListener("click", () => {
      const f = byName[b.dataset.f], v = (f.type === "scale" || f.type === "count") ? +b.dataset.v : b.dataset.v;
      if (f.type === "multi") { let cur = A[f.name] || []; const ex = f.exclusive || [];
        if (cur.indexOf(v) >= 0) cur = cur.filter(x => x !== v); else cur = ex.indexOf(v) >= 0 ? [v] : cur.filter(x => ex.indexOf(x) < 0).concat([v]);
        A[f.name] = cur; } else A[f.name] = v;
      log("q_answer", { field: f.name, value: A[f.name] });
      app.querySelectorAll('.opt[data-f="' + f.name + '"]').forEach(x => { const sel = f.type === "multi" ? A[f.name].indexOf(x.dataset.v) >= 0 : String(A[f.name]) === x.dataset.v; x.classList.toggle("on", sel); x.setAttribute("aria-pressed", sel); });
      $("#q_" + f.name).classList.remove("missing"); }));
    app.querySelectorAll("textarea[data-t]").forEach(t => t.addEventListener("input", () => A[t.dataset.t] = t.value));
    if ($("#back")) $("#back").addEventListener("click", () => screenQuestionnaire(page - 1));
    $("#next").addEventListener("click", () => {
      const miss = P.fields.filter(f => f.type !== "text" && (A[f.name] === undefined || (f.type === "multi" && !A[f.name].length)));
      app.querySelectorAll(".qrow").forEach(r => r.classList.remove("missing")); miss.forEach(f => $("#q_" + f.name).classList.add("missing"));
      if (miss.length) { $("#err").textContent = "Please answer the highlighted question" + (miss.length > 1 ? "s" : "") + "."; $("#q_" + miss[0].name).scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      if (page + 1 < FORM.length) return screenQuestionnaire(page + 1);
      const o = {}; FORM.forEach(pg => pg.fields.forEach(f => { const v = A[f.name]; o[f.name] = f.type === "multi" ? v.join("|") : (v === undefined ? "" : (typeof v === "string" ? v.trim() : v)); }));
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
      '<p>Your result: <span class="score">' + n + ' of ' + trialRows.length + '</span> answers judged correctly.</p>' +
      '<h2>What this study is about</h2><p>The assistant in this study was simulated. Its answers, its reasoning and the source summaries were prepared in advance, and <b>4 of the 16 answers were deliberately wrong</b>, although the cited sources contained the correct information. The study examines whether people open the cited sources more or less often when an AI assistant shows its reasoning, and whether this changes how often wrong answers are noticed. This was not mentioned at the start because knowing it would have changed how people use the sources.</p>' +
      '<p>If you would like your data removed, send the code below to ' + esc(CONFIG.EMAIL) + ' within 14 days.</p><p><b>Your code:</b> <code>' + esc(S.session_id.slice(0, 8)) + '</code></p>' +
      '<p>Interested in the results? Write to <a href="mailto:' + esc(CONFIG.EMAIL) + '">' + esc(CONFIG.EMAIL) + '</a> for a summary once the thesis is finished.</p>' +
      '<p>Please do not tell others who might take part what the study is about.</p></div>' +
      '<div class="card"><h2>The correct answers</h2><table class="res"><tr><th>#</th><th>Question</th><th>Correct answer</th><th>The assistant was</th><th>Your decision was</th></tr>' + rows + '</table></div>' +
      '<div class="card" id="dl" hidden><p>The data could not be sent automatically. Please download the file and send it to ' + esc(CONFIG.EMAIL) + '.</p><button class="btn" id="dlb">Download my responses</button></div>');
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
