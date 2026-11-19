/* Runtime of the study: screens, trial flow, behavioural logging, submission.
 * Design logic lives in design.js, materials in items.js, interface texts in i18n.js, settings in config.js. */
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
  const LANGS = (CONFIG.LANGUAGES && CONFIG.LANGUAGES.length) ? CONFIG.LANGUAGES.filter(l => I18N[l]) : ["en"];
  const BROWSER_LANG = /^de\b/i.test(navigator.language || "") ? "de" : "en";
  if (!S || qs.has("reset")) {
    const list = qs.has("list") ? (parseInt(qs.get("list"), 10) % 8 + 8) % 8 : null;   // null = assigned at start
    const want = qs.get("lang");
    const lang = LANGS.indexOf(want) >= 0 ? want : (LANGS.indexOf(BROWSER_LANG) >= 0 ? BROWSER_LANG : LANGS[0]);
    S = { session_id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
          list: list, items_version: null, seed: Math.floor(Math.random() * 2147483647), src: qs.get("src") || "", started_at: new Date().toISOString(), done: false,
          lang: lang, lang_start: lang, lang_browser: BROWSER_LANG, lang_switches: 0, starts: {}, saved: false };
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ }
  }
  if (LANGS.indexOf(S.lang) < 0) S.lang = LANGS[0];
  if (!S.starts) S.starts = {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  // ------------------------------------------------------------ language
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  /** Interface text in the current language; {name} is replaced by vars.name. */
  function T(key, vars) { let s = (I18N[S.lang] && I18N[S.lang][key]) || I18N.en[key] || key; if (vars) Object.keys(vars).forEach(k => { s = s.split("{" + k + "}").join(vars[k]); }); return s; }
  const MAIL = () => '<a href="mailto:' + esc(CONFIG.EMAIL) + '">' + esc(CONFIG.EMAIL) + '</a>';
  /** Item content in the current language. Falls back to English when an item has no German version. */
  function loc(it) {
    const d = (S.lang === "de" && it.de) ? it.de : null;
    return { question: (d && d.question) || it.question, answer: (d && d.answer) || it.answer, trace: (d && d.trace) || it.trace,
      sources: it.sources.map((s, k) => { const ds = d && d.sources && d.sources[k]; return { title: (ds && ds.title) || s.title, text: (ds && ds.text) || s.text, article: s.title, url: s.url || "" }; }) };
  }
  let SCREEN = null;
  function go(name, render) { SCREEN = { name: name, render: render }; render(false); }
  function paintChrome() {
    document.documentElement.lang = S.lang; document.title = T("doc_title"); $("#brand").textContent = T("brand"); $("#foot-text").textContent = T("footer");
    $("#reader-close").textContent = T("reader_close"); $("#lang").setAttribute("aria-label", T("lang_label"));
    document.querySelectorAll("#lang button").forEach(b => { const on = b.dataset.l === S.lang; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  }
  function setLang(l) {
    if (l === S.lang || LANGS.indexOf(l) < 0) return;
    log("language_switch", { from: S.lang, to: l, screen: SCREEN ? SCREEN.name : null });
    S.lang = l; S.lang_switches = (S.lang_switches || 0) + 1; if (cur) cur.langSwitches++; save(); paintChrome();
    const y = window.scrollY; if (SCREEN) SCREEN.render(true); if (R.open) R.paint(); window.scrollTo(0, y);
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
  function prepare(resume) {
    try { const snap = JSON.parse(localStorage.getItem(IKEY) || "null");
      if (snap && S.items_version && S.list !== null) { setup(snap.items, snap.practice, S.items_version, S.list); return Promise.resolve("ok"); } } catch (e) { /* fall through */ }
    const local = () => { setup(ITEMS, PRACTICE, ITEMS_VERSION, rndList()); snapshot(); return "ok"; };
    if (!CONFIG.ENDPOINT_URL) return Promise.resolve(local());
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
    return fetch(CONFIG.ENDPOINT_URL + "?action=start", { signal: ctl.signal, redirect: "follow" }).then(r => r.json()).then(j => {
      clearTimeout(timer);
      if (j && j.open === false && !resume) return "closed";
      const de = LANGS.indexOf("de") >= 0;
      const remoteOk = !!(j && j.items && validateItems(j.items, { requireDe: de }).length === 0 && j.practice && validatePractice(j.practice, { requireDe: de }).length === 0);
      const list = (j && typeof j.list === "number") ? j.list % 8 : rndList();
      if (remoteOk) setup(j.items, j.practice, j.items_version, list); else setup(ITEMS, PRACTICE, ITEMS_VERSION, list);
      log("start_info", { remote_items: remoteOk, list: S.list, items_version: S.items_version }); snapshot(); return "ok";
    }).catch(() => { clearTimeout(timer); log("start_info", { remote_items: false, endpoint_error: true }); return local(); });
  }

  // progress survives a reload: finished trials and events are kept in localStorage
  const PKEY = "svc2_progress_" + S.session_id;
  let P = null; try { P = JSON.parse(localStorage.getItem(PKEY) || "null"); } catch (e) { P = null; }
  const events = P ? P.events : []; const trialRows = P ? P.trialRows : []; let seq = events.length; let cur = null;
  const FKEY = "svc2_final_" + S.session_id;     // the finished record, kept until the server has confirmed it
  const A = (P && P.A) || {};
  function persist() { try { localStorage.setItem(PKEY, JSON.stringify({ events: events, trialRows: trialRows, A: A })); } catch (e) { /* storage full or blocked */ } }
  let ptimer = null; function persistSoon() { if (ptimer) return; ptimer = setTimeout(() => { ptimer = null; if (!S.done) persist(); }, 400); }
  let inTrials = false;
  window.addEventListener("beforeunload", e => { if (inTrials && !S.done) { e.preventDefault(); e.returnValue = ""; } });
  function log(type, payload) {
    events.push({ seq: ++seq, t: now(), wall: new Date().toISOString(), trial: cur ? cur.index : null,
                  item: cur ? cur.item : null, type: type, visible: document.visibilityState === "visible", payload: payload || null });
    persistSoon();
  }

  // ------------------------------------------------------------ time away from the page
  // "Away" = the tab is hidden or the window has lost focus. An absence that begins within two seconds of a click
  // on a source link is counted as time spent with the linked article; after a modified click (Ctrl/Cmd/Shift or middle button,
  // which open the article in the background) the next absence within the same trial counts. What is read there cannot be observed.
  const AWAY = { on: false, at: 0, link: null }; let linkPending = null;
  function syncAway() {
    const away = document.visibilityState !== "visible" || !document.hasFocus();
    if (away && !AWAY.on) {
      AWAY.on = true; AWAY.at = now(); AWAY.link = (linkPending && (linkPending.sticky || now() - linkPending.at < 2000)) ? linkPending.source : null; linkPending = null;
      log("away_start", { after_link: AWAY.link });
    } else if (!away && AWAY.on) {
      const ms = now() - AWAY.at; AWAY.on = false;
      if (cur) { cur.awayMs += ms; cur.awayN++; if (AWAY.link) cur.linkAwayMs += ms; }
      log("away_end", { ms: ms, after_link: AWAY.link }); if (AWAY.link) log("source_link_return", { source: AWAY.link, away_ms: ms });
      AWAY.link = null;
    }
  }
  document.addEventListener("visibilitychange", () => { log("visibility", { state: document.visibilityState }); EXP.tick(); if (R.open) R.tick(); if (document.visibilityState === "hidden" && !S.done) persist(); syncAway(); });
  window.addEventListener("blur", () => { log("window_blur"); EXP.tick(); if (R.open) R.tick(); syncAway(); }); window.addEventListener("focus", () => { log("window_focus"); EXP.tick(); if (R.open) R.tick(); syncAway(); });

  /** Per-participant totals, stored with the session so that one row describes what a person did. */
  function summary() {
    const sum = k => trialRows.reduce((a, r) => a + (r[k] || 0), 0), cnt = f => trialRows.filter(f).length;
    return { lang: S.lang, lang_start: S.lang_start, lang_browser: S.lang_browser, n_lang_switches: S.lang_switches || 0,
      n_correct: cnt(r => r.correct), n_accept: cnt(r => r.decision === "accept"), n_trials_source_opened: cnt(r => r.opened_any), n_source_opens: sum("n_source_opens"),
      n_trials_link_clicked: cnt(r => r.n_link_clicks > 0), n_link_clicks: sum("n_link_clicks"), n_link_menu: sum("n_link_menu"), n_restarts: sum("restarts"), source_visible_ms: sum("source_visible_ms"), link_away_ms: sum("link_away_ms"), away_ms: sum("away_ms"),
      n_unsupported_rejected: cnt(r => !r.supported && r.decision === "reject"), n_verification_success: sum("verification_success"), trials_ms: sum("trial_ms"),
      duration_ms: Date.now() - Date.parse(S.started_at), n_events: events.length };
  }
  function meta() {
    return Object.assign({ session_id: S.session_id, study_version: CONFIG.STUDY_VERSION, list: S.list, items_version: S.items_version, seed: S.seed, src: S.src, started_at: S.started_at,
             preview: !CONFIG.ENDPOINT_URL, user_agent: navigator.userAgent, screen: screen.width + "x" + screen.height,
             window: innerWidth + "x" + innerHeight, language: navigator.language, tz_offset_min: new Date().getTimezoneOffset() }, summary());
  }
  // the server refuses a record above 300,000 characters; the finished questions and the answers are never dropped, event types of lower priority go first
  const MAX_BODY = 270000, LOW_EVENTS = { text_select: 1, copy: 1, contextmenu: 1, viewport: 1, zoom: 1, connectivity: 1, reader_scroll: 1, source_rendered: 1, visibility: 1, window_blur: 1, window_focus: 1 };
  const CORE_EVENTS = { session_start: 1, device: 1, start_info: 1, consent_given: 1, screen: 1, comprehension: 1, trial_start: 1, trial_restart: 1, trial_end: 1, source_open: 1, source_close: 1, source_link_click: 1, source_link_contextmenu: 1, source_link_return: 1, decision_select: 1, decision_confirm: 1, away_start: 1, away_end: 1, q_answer: 1, questionnaire_submit: 1, session_end: 1, resume: 1, language_switch: 1, pagehide: 1, pageshow: 1, device_gate: 1, about_toggle: 1 };
  function payload(final, compact) {
    const build = (ev, dropped) => JSON.stringify({ meta: Object.assign(meta(), { final: !!final, n_trials_done: trialRows.length, events_dropped: dropped || 0 }), trials: trialRows, questionnaire: Q, events: ev });
    if (compact) return build([]);   // a beacon is limited to about 64 KB, and the server stores events only with a complete record
    let out = build(events);
    if (out.length > MAX_BODY) { let ev = events.filter(e => !LOW_EVENTS[e.type]); out = build(ev, events.length - ev.length);
      if (out.length > MAX_BODY) { ev = events.filter(e => CORE_EVENTS[e.type]); out = build(ev, events.length - ev.length);
        if (out.length > MAX_BODY) out = build([], events.length); } }
    return out;
  }
  window.addEventListener("pagehide", e => {
    log("pagehide", { persisted: !!e.persisted }); if (!S.done) persist();
    if (!CONFIG.ENDPOINT_URL) return;
    let body = null;
    if (S.done) {
      if (S.saved || !trialRows.length) return;
      try { body = localStorage.getItem(FKEY); } catch (e) { body = null; }
      // too long for a beacon: send the finished questions as a partial record (without events); the complete record follows at the next visit
      if (!body || body.length > 60000) body = payload(false, true);
    } else if (trialRows.length) { persist(); body = payload(false, true); }
    if (!body) return;
    try { navigator.sendBeacon(CONFIG.ENDPOINT_URL, new Blob([body], { type: "text/plain" })); } catch (e) { /* ignore */ }
  });

  // ------------------------------------------------------------ helpers
  function h(html, keepScroll) { app.innerHTML = html; if (!keepScroll) window.scrollTo(0, 0); }
  function progress(txt, frac) { $("#prog").hidden = !txt && frac === undefined; $("#progress").textContent = txt || ""; $("#bar").hidden = frac === undefined; if (frac !== undefined) $("#barfill").style.width = Math.round(100 * frac) + "%"; }

  // ------------------------------------------------------------ source reader with focused-time accounting
  const R = { open: false, idx: null, item: null, openedAt: 0, visibleMs: 0, lastTick: 0, maxScroll: 0, links: 0, marks: {},
    tick() { const n = now(); if (this.wasVisible) this.visibleMs += n - this.lastTick; this.lastTick = n; this.wasVisible = document.visibilityState === "visible" && document.hasFocus(); },
    paint() {
      const src = loc(this.item).sources[this.idx], safe = /^https:\/\/[^\s]+$/i.test(src.url || "");
      $("#reader-title").textContent = "[" + (this.idx + 1) + "] " + src.title; $("#reader-origin").textContent = T("reader_origin", { title: src.article });
      $("#reader-text").textContent = src.text; const a = $("#reader-link"); a.hidden = !safe; if (safe) { a.href = src.url; a.textContent = T("reader_link") + "\u00a0↗"; } else a.removeAttribute("href");
    },
    show(idx, item, opener, how) {
      if (!cur) return; if (this.open) this.close("switch"); EXP.tick();
      this.open = true; this.marks = {}; document.body.classList.add("reading"); EXP.tick(); this.idx = idx; this.item = item; this.opener = opener || null; this.openedAt = this.lastTick = now(); this.visibleMs = 0; this.maxScroll = 0; this.links = 0; this.wasVisible = document.visibilityState === "visible" && document.hasFocus();
      app.inert = true; app.setAttribute("aria-hidden", "true");
      if (!this.pushed) { try { history.pushState({ svcReader: 1 }, ""); this.pushed = true; } catch (e) { /* ignore */ } }
      this.paint(); reader.hidden = false; $("#reader-scroll").scrollTop = 0; $("#reader-close").focus();
      requestAnimationFrame(() => { const sc = $("#reader-scroll"); log("source_rendered", { source: idx + 1, chars: ($("#reader-text").textContent || "").length, scrollable: sc.scrollHeight > sc.clientHeight + 2 }); });
      log("source_open", { source: idx + 1, lang: S.lang, via: how || null, n_open: cur.opens.length });
    },
    close(how) {
      if (!this.open) return; this.tick();
      if (this.pushed && how !== "back" && how !== "switch") { this.pushed = false; this.skipPop = true; setTimeout(() => { R.skipPop = false; }, 600); try { history.back(); } catch (e) { /* ignore */ } } this.open = false; reader.hidden = true; app.inert = false; app.removeAttribute("aria-hidden"); document.body.classList.remove("reading"); EXP.tick();
      const rec = { source: this.idx + 1, open_ms: now() - this.openedAt, visible_ms: this.visibleMs, max_scroll: this.maxScroll, link_clicks: this.links, closed_by: how };
      log("source_close", rec); if (cur) cur.sourceVisits.push(rec);
      if (this.opener && document.contains(this.opener)) { try { this.opener.focus(); } catch (e) { /* ignore */ } } this.opener = null;
    } };
  $("#reader-close").addEventListener("click", () => R.close("button"));
  // the Back button or gesture closes the source sheet and keeps the participant in the study
  window.addEventListener("popstate", () => { if (R.skipPop) { R.skipPop = false; return; } if (R.open && R.pushed) { R.pushed = false; R.close("back"); } });
  try { if (history.state && history.state.svcReader) history.replaceState(null, ""); } catch (e) { /* ignore */ }
  reader.addEventListener("click", e => { if (e.target === reader) R.close("backdrop"); });
  document.addEventListener("keydown", e => {
    if (!R.open) return;
    if (e.key === "Escape") return R.close("escape");
    if (e.key === "Tab") {                                  // keep the keyboard inside the reader while it is open
      const f = [$("#reader-close"), $("#reader-link")].filter(x => x && !x.hidden), i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } else if (i < 0) { e.preventDefault(); f[0].focus(); }
    }
  });
  $("#reader-scroll").addEventListener("scroll", e => { const el = e.target; const d = el.scrollHeight - el.clientHeight; if (d > 0) { R.maxScroll = Math.max(R.maxScroll, Math.round(100 * el.scrollTop / d)); [25, 50, 75, 100].forEach(m => { if (R.maxScroll >= m && !R.marks[m]) { R.marks[m] = 1; log("reader_scroll", { source: R.idx + 1, pct: m }); } }); } });
  function linkClick(how, e) {
    if (!R.open) return; const n = R.idx + 1; R.links++; if (cur) cur.links.push(n);
    linkPending = { source: n, at: now(), sticky: how !== "click" }; log("source_link_click", { source: n, how: how, url: $("#reader-link").href, via: via(e) });
  }
  $("#reader-link").addEventListener("click", e => linkClick((e.ctrlKey || e.metaKey || e.shiftKey) ? "modified_click" : "click", e));
  $("#reader-link").addEventListener("auxclick", e => { if (e.button === 1) linkClick("middle_click", e); });
  $("#reader-link").addEventListener("contextmenu", () => { if (cur) cur.menus++; log("source_link_contextmenu", { source: R.idx + 1 }); });
  document.querySelectorAll("#lang button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.l)));
  $("#lang").hidden = LANGS.length < 2;


  // ------------------------------------------------------------ interaction context: pointer, device, viewport, exposure, selection, errors
  // Everything here only adds events; the stored columns do not change. What is recorded is described to participants on the first page.
  let lastPointer = null, selN = 0, ctxN = 0, selTotal = 0, copyN = 0, vpN = 0, zoomN = 0, errN = 0, netN = 0;
  document.addEventListener("pointerdown", e => { lastPointer = e.pointerType || null; }, true);
  /** How an element was activated: touch, mouse, pen or keyboard. */
  const via = e => (e && e.type === "click" && e.detail === 0) ? "keyboard" : (lastPointer || "unknown");
  function deviceInfo() {
    const mm = q => { try { return matchMedia(q).matches; } catch (e) { return null; } }, vv = window.visualViewport;
    return { touch_points: navigator.maxTouchPoints || 0, pointer_coarse: mm("(pointer: coarse)"), hover: mm("(hover: hover)"), dpr: window.devicePixelRatio || 1, vw: innerWidth, vh: innerHeight,
      sw: screen.width, sh: screen.height, orient: innerWidth >= innerHeight ? "landscape" : "portrait", zoom: vv ? Math.round(vv.scale * 100) / 100 : 1, standalone: mm("(display-mode: standalone)") };
  }
  let vpTimer = null, vpLast = { w: innerWidth, o: innerWidth >= innerHeight }, zoomTimer = null, zoomLast = 1;
  const vpCheck = () => { vpTimer = null; const o = innerWidth >= innerHeight; if ((o !== vpLast.o || Math.abs(innerWidth - vpLast.w) >= 20) && vpN++ < 30) log("viewport", { w: innerWidth, h: innerHeight, orient: o ? "landscape" : "portrait" }); vpLast = { w: innerWidth, o: o }; };
  window.addEventListener("resize", () => { clearTimeout(vpTimer); vpTimer = setTimeout(vpCheck, 400); }); window.addEventListener("orientationchange", () => { clearTimeout(vpTimer); vpTimer = setTimeout(vpCheck, 400); });
  if (window.visualViewport) visualViewport.addEventListener("resize", () => { clearTimeout(zoomTimer); zoomTimer = setTimeout(() => { const z = Math.round(visualViewport.scale * 100) / 100; if (Math.abs(z - zoomLast) >= 0.05) { zoomLast = z; if (zoomN++ < 30) log("zoom", { scale: z }); } }, 400); });
  window.addEventListener("online", () => { if (netN++ < 20) log("connectivity", { online: true }); }); window.addEventListener("offline", () => { if (netN++ < 20) log("connectivity", { online: false }); });
  window.addEventListener("pageshow", e => { if (e.persisted) log("pageshow", { persisted: true }); });
  const logErr = (kind, msg, src) => { if (errN++ < 10) log("client_error", { kind: kind, message: String(msg || "").replace(/[a-z-]+:\/\/\S+/gi, "[url]").slice(0, 200), src: src || null }); };
  window.addEventListener("error", e => { const f = e.filename || ""; if (f && f.indexOf(location.origin) !== 0) return;   // errors of browser extensions and other foreign scripts are not recorded
    logErr("error", e.message, f.split("?")[0].split("#")[0].split("/").pop() + ":" + (e.lineno || "")); });
  window.addEventListener("unhandledrejection", e => logErr("rejection", e.reason && e.reason.message ? e.reason.message : e.reason));
  window.addEventListener("scroll", () => { if (!cur || R.open) return; const d = document.documentElement.scrollHeight - innerHeight; if (d > 0) cur.pageScroll = Math.max(cur.pageScroll || 0, Math.round(100 * window.scrollY / d)); }, { passive: true });
  // selecting, copying and context menus: where and how much, never the text itself
  const AREAS = [[".question", "question"], [".answer", "answer"], [".sources", "sources"], [".trace", "trace"], [".decision", "decision"], ["#reader-text", "source_text"], ["#reader", "reader"], ["main", "page"]];
  function areaOf(node) { const el = node && (node.nodeType === 1 ? node : node.parentElement); if (!el || !el.closest) return null; for (let i = 0; i < AREAS.length; i++) if (el.closest(AREAS[i][0])) return AREAS[i][1]; return "other"; }
  let selTimer = null;
  document.addEventListener("selectionchange", () => { clearTimeout(selTimer); selTimer = setTimeout(() => { const g = document.getSelection(); if (!g || g.isCollapsed) return; const n = g.toString().trim().length; if (n < 3 || selN >= 8 || selTotal >= 60) return; selN++; selTotal++; log("text_select", { area: areaOf(g.anchorNode), chars: n }); }, 700); });
  document.addEventListener("copy", () => { if (copyN++ >= 30) return; const g = document.getSelection(); log("copy", { area: g ? areaOf(g.anchorNode) : null, chars: g ? g.toString().length : 0 }); });
  document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest("#reader-link")) return; if (ctxN++ < 12) log("contextmenu", { area: areaOf(e.target), via: via(e) }); });
  // time on screen per part of the question page: counted while the page is visible and focused and the reader is closed
  const EXP = { names: ["question", "answer", "sources", "trace", "decision"], sel: { question: ".card.q", answer: ".answer", sources: ".sources", trace: ".trace", decision: ".decision" }, vis: {}, ms: {}, first: {}, last: 0, active: false, obs: null, t0: 0,
    isActive() { return document.visibilityState === "visible" && document.hasFocus() && !R.open; },
    begin() { this.vis = {}; this.ms = {}; this.first = {}; this.t0 = this.last = now(); this.active = this.isActive(); },
    attach() {
      this.tick(); if (this.obs) this.obs.disconnect(); this.obs = null; this.vis = {}; if (!("IntersectionObserver" in window)) return;
      this.obs = new IntersectionObserver(list => { this.tick(); list.forEach(en => { const nm = en.target.dataset.exp, big = en.intersectionRect.height >= 0.5 * innerHeight;
        this.vis[nm] = en.isIntersecting && (en.intersectionRatio >= 0.5 || big); if (this.vis[nm] && this.first[nm] === undefined) this.first[nm] = Math.round(now() - this.t0); }); }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
      this.names.forEach(n => { const el = app.querySelector(this.sel[n]); if (el) { el.dataset.exp = n; this.obs.observe(el); } });
    },
    tick() { const n = now(); if (this.active) for (const k in this.vis) if (this.vis[k]) this.ms[k] = (this.ms[k] || 0) + (n - this.last); this.last = n; this.active = this.isActive(); },
    stop() { if (this.obs) this.obs.disconnect(); this.obs = null; },
    result() { this.tick(); const v = {}; this.names.forEach(k => { v[k] = Math.round(this.ms[k] || 0); }); return { view_ms: v, first_seen_ms: this.first }; } };

  // ------------------------------------------------------------ screens
  const card = (hd, p) => '<div class="card"><h1>' + T(hd) + '</h1><p>' + T(p) + '</p></div>';
  function screenGate() {
    if (innerWidth < CONFIG.MIN_WIDTH) { log("device_gate", { width: innerWidth }); go("gate", () => { progress(""); h(card("gate_h", "gate_p")); }); return; }
    screenConsent();
  }
  function about() {
    return '<details class="about" id="about"><summary>' + T("about_sum") + '</summary><p>' + T("about_1", { researcher: esc(CONFIG.RESEARCHER) }) + '</p><p>' + T("about_2") + '</p><p>' + T("about_3") + '</p><p>' + T("about_4", { mail: MAIL() }) + '</p><p>' + T("about_5", { code: esc(S.session_id.slice(0, 8)) }) + '</p></details>';
  }
  function screenConsent() {
    const st = { checked: false, about: false };
    log("screen", { name: "consent" });
    go("consent", re => {
      progress("");
      h('<div class="card hero"><div class="tag">' + T("hero_tag") + '</div><h1>' + T("hero_h") + '</h1><p class="lead">' + T("hero_p") + '</p></div>' +
        '<div class="cols3"><div class="card mini c1"><b>' + T("m1_h") + '</b><span>' + T("m1_p") + '</span></div><div class="card mini c2"><b>' + T("m2_h") + '</b><span>' + T("m2_p") + '</span></div><div class="card mini c3"><b>' + T("m3_h") + '</b><span>' + T("m3_p") + '</span></div></div>' +
        '<div class="card"><h2 style="margin-top:0">' + T("data_h") + '</h2><ul class="facts"><li>' + T("data_1") + '</li><li>' + T("data_2") + '</li><li>' + T("data_3") + '</li><li>' + T("data_4") + '</li></ul>' + about() +
        '<label class="check"><input type="checkbox" id="c1"><span>' + T("consent_check") + '</span></label><button class="btn primary big" id="go" disabled>' + T("consent_go") + '</button></div>', re);
      $("#c1").checked = st.checked; $("#go").disabled = !st.checked; $("#about").open = st.about;
      $("#about").addEventListener("toggle", e => { st.about = e.target.open; log("about_toggle", { open: st.about }); });
      $("#c1").addEventListener("change", e => { st.checked = e.target.checked; $("#go").disabled = !st.checked; });
      $("#go").addEventListener("click", () => { log("consent_given", { lang: S.lang }); go("loading", () => h('<div class="card"><p>' + T("loading") + '</p></div>'));
        prepare().then(r => { if (r === "closed") return go("closed", () => h(card("closed_h", "closed_p"))); screenInstructions(0); }); });
    });
  }
  function screenInstructions(attempt, failed) {
    const st = { k1: null, k2: null };
    log("screen", { name: "instructions", attempt: attempt });
    go("instructions", re => {
      const radio = (n, v, key) => '<label><input type="radio" name="' + n + '" value="' + v + '"' + (st[n] === v ? " checked" : "") + '>' + T(key) + '</label>';
      h('<div class="card"><h1>' + T("ins_h") + '</h1><p>' + T("ins_1") + '</p><p>' + T("ins_2") + '</p><p>' + T("ins_3") + '</p><p>' + T("ins_4") + '</p><h2>' + T("chk_h") + '</h2>' +
        '<fieldset><legend>' + T("k1_q") + '</legend><div class="opts">' + radio("k1", "a", "k1_a") + radio("k1", "b", "k1_b") + radio("k1", "c", "k1_c") + '</div></fieldset>' +
        '<fieldset><legend>' + T("k2_q") + '</legend><div class="opts">' + radio("k2", "a", "k2_a") + radio("k2", "b", "k2_b") + '</div></fieldset>' +
        '<div class="err" id="err">' + (failed ? T("chk_err") : "") + '</div><button class="btn primary" id="go">' + T("ins_go") + '</button></div>', re);
      app.querySelectorAll("input[type=radio]").forEach(i => i.addEventListener("change", () => { st[i.name] = i.value; }));
      $("#go").addEventListener("click", () => {
        const ok = st.k1 === "b" && st.k2 === "b"; log("comprehension", { k1: st.k1, k2: st.k2, ok: ok, attempt: attempt });
        if (ok) return runTrial(-1);
        if (attempt >= 1) { S.done = true; save(); return go("failed", () => h(card("fail_h", "fail_p"))); }
        screenInstructions(attempt + 1, true);
      });
    });
  }

  function runTrial(i) {
    const practice = i < 0;
    const t = practice ? { index: 0, item: "practice", trace: true, supported: true, key: PRACT.key } : TRIALS[i];
    const it = practice ? PRACT : byId[t.item];
    const v = t.supported ? "s" : "u";
    inTrials = true;
    cur = { index: t.index, item: t.item, sourceVisits: [], opens: [], links: [], awayMs: 0, awayN: 0, linkAwayMs: 0, startedAt: now(), pageScroll: 0, firstChoiceAt: null, changes: 0, choice: null, langSwitches: 0, menus: 0, langStart: S.lang, restarts: 0 };
    const starts = S.starts[t.item + "#" + t.index] = (S.starts[t.item + "#" + t.index] || 0) + 1; cur.restarts = starts - 1; save(); linkPending = null;
    // after a reload (or a tab that the phone discarded while a source was being read) what was done in this question before the reload still counts
    if (cur.restarts) events.forEach(ev => { if (ev.trial === t.index && ev.item === t.item && ev.payload) {
      if (ev.type === "source_open") cur.opens.push(ev.payload.source); else if (ev.type === "source_link_click") cur.links.push(ev.payload.source);
      else if (ev.type === "source_close") cur.sourceVisits.push(ev.payload); else if (ev.type === "source_link_contextmenu") cur.menus++;
      else if (ev.type === "away_end") { cur.awayMs += ev.payload.ms || 0; cur.awayN++; if (ev.payload.after_link) cur.linkAwayMs += ev.payload.ms || 0; } } });
    selN = 0; ctxN = 0;
    log("trial_start", { trace: t.trace, supported: t.supported, practice: practice, lang: S.lang, restart: cur.restarts });
    if (cur.restarts) log("trial_restart", { n: cur.restarts });
    go("trial", re => {
      const c = loc(it);
      progress(practice ? T("prog_practice") : T("prog_trial", { i: t.index, n: TRIALS.length }), practice ? 0 : (t.index - 1) / TRIALS.length);
      h((practice ? '<p class="muted">' + T("practice_note") + '</p>' : '') +
        '<div class="card q"><div class="label">' + T("l_question") + '</div><div class="question">' + esc(c.question) + '</div></div>' +
        '<div class="card"><div class="label">' + T("l_answer") + '</div><div class="answer">' + esc(c.answer[v]) + '</div>' +
        '<div style="margin-top:16px"><div class="label">' + T("l_sources") + '</div></div><div class="sources" aria-label="' + T("l_sources_aria") + '">' + c.sources.map((s, k) => '<button class="chip" data-k="' + k + '"><b>[' + (k + 1) + ']</b>' + esc(s.title) + '</button>').join("") + '</div></div>' +
        (t.trace ? '<div class="card trace"><div class="label">' + T("l_trace") + '</div><ol>' + c.trace[v].map(x => '<li>' + esc(x) + '</li>').join("") + '</ol></div>' : '') +
        '<div class="card decision"><span>' + T("dec") + '</span><button class="btn choice acc' + (cur.choice === "accept" ? " sel" : "") + '" data-d="accept">' + T("acc") + '</button><button class="btn choice rej' + (cur.choice === "reject" ? " sel" : "") + '" data-d="reject">' + T("rej") + '</button>' +
        '<button class="btn primary" id="confirm"' + (cur.choice ? "" : " disabled") + '>' + T("confirm") + '</button></div>', re);
      app.querySelectorAll(".chip").forEach(b => b.addEventListener("click", e => { const k = +b.dataset.k; cur.opens.push(k + 1); R.show(k, it, b, via(e)); }));
      if (!re) EXP.begin(); EXP.attach();
      app.querySelectorAll(".choice").forEach(b => b.addEventListener("click", e => {
        if (cur.choice && cur.choice !== b.dataset.d) cur.changes++; cur.choice = b.dataset.d; if (cur.firstChoiceAt === null) cur.firstChoiceAt = now();
        app.querySelectorAll(".choice").forEach(x => x.classList.toggle("sel", x === b)); $("#confirm").disabled = false; log("decision_select", { decision: cur.choice, via: via(e), changed: cur.changes });
      }));
      $("#confirm").addEventListener("click", e => {
        if (R.open) R.close("confirm"); const how = via(e);
        const end = now(), choice = cur.choice; const visits = cur.sourceVisits; const distinct = Array.from(new Set(cur.opens)), linksDistinct = Array.from(new Set(cur.links));
        const answerSays = t.supported ? it.key : (it.key === "yes" ? "no" : "yes");
        const judgedCorrect = (choice === "accept") === (answerSays === it.key);
        const row = { session_id: S.session_id, list: S.list, trial_index: t.index, item: t.item, practice: practice, trace: t.trace ? 1 : 0, supported: t.supported ? 1 : 0,
          key: it.key, decision: choice, correct: judgedCorrect ? 1 : 0, opened_any: distinct.length ? 1 : 0, n_sources_distinct: distinct.length, n_source_opens: cur.opens.length,
          open_order: cur.opens.join(">"), source_open_ms: visits.reduce((a, x) => a + x.open_ms, 0), source_visible_ms: visits.reduce((a, x) => a + x.visible_ms, 0),
          max_scroll: visits.reduce((a, x) => Math.max(a, x.max_scroll), 0), decision_changes: cur.changes, first_choice_ms: cur.firstChoiceAt - cur.startedAt, trial_ms: end - cur.startedAt,
          verification_success: (!t.supported && choice === "reject" && distinct.length > 0) ? 1 : 0,
          lang: S.lang, lang_start: cur.langStart, content_lang: (S.lang === "de" && it.de) ? "de" : "en", lang_changed: cur.langSwitches > 0 ? 1 : 0, restarts: cur.restarts, n_link_clicks: cur.links.length, n_link_menu: cur.menus, n_links_distinct: linksDistinct.length, link_order: cur.links.join(">"),
          link_away_ms: cur.linkAwayMs, away_ms: cur.awayMs, n_away: cur.awayN };
        log("decision_confirm", { decision: choice, correct: judgedCorrect, via: how });
        log("trial_end", Object.assign({ trial_index: t.index, decision: choice, correct: row.correct, trial_ms: row.trial_ms, page_scroll_max: cur.pageScroll }, EXP.result())); EXP.stop();
        if (!practice) { trialRows.push(row); persist(); } cur = null; linkPending = null;
        if (practice) return screenAfterPractice();
        if (i + 1 < TRIALS.length) return runTrial(i + 1);
        screenQuestionnaire(0);
      });
    });
  }
  function screenAfterPractice() {
    log("screen", { name: "after_practice" });
    go("after_practice", re => { progress(""); h('<div class="card"><h1>' + T("after_h") + '</h1><p>' + T("after_p") + '</p><button class="btn primary" id="go">' + T("after_go") + '</button></div>', re);
      $("#go").addEventListener("click", () => runTrial(0)); });
  }

  // ------------------------------------------------------------ questionnaire (closed questions, three short pages)
  let Q = null;
  const FORM = [
    [ { name: "trust_trace", type: "scale" }, { name: "trust_notrace", type: "scale" }, { name: "self_checked", type: "count" } ],
    [ { name: "why_open", type: "multi", exclusive: ["none"], opts: ["unsure", "surprised", "trace_doubt", "trace_pointer", "no_trace", "be_sure", "curious", "none"] },
      { name: "why_closed", type: "multi", exclusive: ["always"], opts: ["knew", "plausible", "trace_convinced", "trace_instead", "effort", "trust_ai", "unnoticed", "always"] },
      { name: "trace_read", type: "single", opts: ["never", "few", "most", "all"] }, { name: "trace_effect", type: "single", opts: ["accept", "critical", "none", "mixed"] } ],
    [ { name: "ai_use", type: "single", opts: ["never", "lt_monthly", "monthly", "weekly", "daily"] }, { name: "habit_check", type: "single", opts: ["never", "rarely", "sometimes", "often", "always"] },
      { name: "age", type: "single", opts: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+", "na"] }, { name: "gender", type: "single", opts: ["female", "male", "other", "na"] },
      { name: "education", type: "single", opts: ["secondary", "vocational", "bachelor", "master", "doctorate", "other", "na"] }, { name: "english", type: "single", opts: ["basic", "intermediate", "advanced", "native"] },
      { name: "lookup", type: "single", opts: ["no", "once", "several"] }, { name: "comment", type: "text" } ] ];
  function fieldHtml(f, n) {
    const x = (FORM_TEXT[S.lang] || FORM_TEXT.en)[f.name];
    const head = '<div class="qn">' + n + '</div><div class="qb"><div class="qt">' + x.q + '</div>' + (x.hint ? '<div class="muted">' + x.hint + '</div>' : "");
    const on = v => f.type === "multi" ? (A[f.name] || []).indexOf(v) >= 0 : String(A[f.name]) === String(v);
    let body = "";
    if (f.type === "scale") body = '<div class="scale"><span class="muted">' + x.lo + '</span>' + [1, 2, 3, 4, 5].map(v => '<button type="button" class="opt num' + (on(v) ? " on" : "") + '" data-f="' + f.name + '" data-v="' + v + '">' + v + '</button>').join("") + '<span class="muted">' + x.hi + '</span></div>';
    else if (f.type === "count") body = '<div class="opts tight">' + Array.from({ length: 17 }, (z, v) => '<button type="button" class="opt num' + (on(v) ? " on" : "") + '" data-f="' + f.name + '" data-v="' + v + '">' + v + '</button>').join("") + '</div>';
    else if (f.type === "text") body = '<textarea data-t="' + f.name + '" maxlength="600">' + esc(A[f.name] || "") + '</textarea>';
    else body = '<div class="opts' + (f.type === "multi" ? " col" : "") + '">' + f.opts.map(o => '<button type="button" class="opt' + (f.type === "multi" ? " box" : "") + (on(o) ? " on" : "") + '" data-f="' + f.name + '" data-v="' + o + '" aria-pressed="' + on(o) + '">' + x.opts[o] + '</button>').join("") + '</div>';
    return '<div class="qrow" id="q_' + f.name + '">' + head + body + '</div></div>';
  }
  function screenQuestionnaire(page) {
    inTrials = false; const F = FORM[page]; let n0 = 1; for (let k = 0; k < page; k++) n0 += FORM[k].length;
    log("screen", { name: "questionnaire", page: page + 1 });
    go("questionnaire_" + (page + 1), re => {
      progress(T("q_prog", { i: page + 1, n: FORM.length }), (page + 1) / (FORM.length + 1));
      h('<div class="card"><div class="tag">' + T("q_tag") + '</div><h1>' + (FORM_TEXT[S.lang] || FORM_TEXT.en).titles[page] + '</h1>' + F.map((f, k) => fieldHtml(f, n0 + k)).join("") +
        '<div class="err" id="err"></div><div class="row">' + (page ? '<button class="btn" id="back">' + T("q_back") + '</button>' : "") + '<button class="btn primary" id="next">' + T(page + 1 < FORM.length ? "q_next" : "q_finish") + '</button></div></div>', re);
      const byName = {}; F.forEach(f => byName[f.name] = f);
      app.querySelectorAll(".opt").forEach(b => b.addEventListener("click", () => {
        const f = byName[b.dataset.f], v = (f.type === "scale" || f.type === "count") ? +b.dataset.v : b.dataset.v;
        if (f.type === "multi") { let c = A[f.name] || []; const ex = f.exclusive || [];
          if (c.indexOf(v) >= 0) c = c.filter(x => x !== v); else c = ex.indexOf(v) >= 0 ? [v] : c.filter(x => ex.indexOf(x) < 0).concat([v]);
          A[f.name] = c; } else A[f.name] = v;
        log("q_answer", { field: f.name, value: A[f.name] }); persistSoon();
        app.querySelectorAll('.opt[data-f="' + f.name + '"]').forEach(x => { const sel = f.type === "multi" ? A[f.name].indexOf(x.dataset.v) >= 0 : String(A[f.name]) === x.dataset.v; x.classList.toggle("on", sel); x.setAttribute("aria-pressed", sel); });
        $("#q_" + f.name).classList.remove("missing"); }));
      app.querySelectorAll("textarea[data-t]").forEach(t => t.addEventListener("input", () => { A[t.dataset.t] = t.value; persistSoon(); }));
      if ($("#back")) $("#back").addEventListener("click", () => screenQuestionnaire(page - 1));
      $("#next").addEventListener("click", () => {
        const miss = F.filter(f => f.type !== "text" && (A[f.name] === undefined || (f.type === "multi" && !A[f.name].length)));
        app.querySelectorAll(".qrow").forEach(r => r.classList.remove("missing")); miss.forEach(f => $("#q_" + f.name).classList.add("missing"));
        if (miss.length) { $("#err").textContent = T(miss.length > 1 ? "q_missn" : "q_miss1"); $("#q_" + miss[0].name).scrollIntoView({ behavior: "smooth", block: "center" }); return; }
        if (page + 1 < FORM.length) return screenQuestionnaire(page + 1);
        const o = {}; FORM.forEach(pg => pg.forEach(f => { const v = A[f.name]; o[f.name] = f.type === "multi" ? v.join("|") : (v === undefined ? "" : (typeof v === "string" ? v.trim() : v)); }));
        o.logged_checked = trialRows.filter(r => r.opened_any).length; Q = o; log("questionnaire_submit", { lang: S.lang }); screenDebrief();
      });
    });
  }

  // ------------------------------------------------------------ debrief + submit
  let STATUS = "st_saving", DL = false;
  function screenDebrief() {
    log("session_end"); S.done = true; save();
    try { localStorage.setItem(FKEY, payload(true)); localStorage.removeItem(PKEY); localStorage.removeItem(IKEY); } catch (e) { /* ignore */ }
    go("debrief", re => {
      progress("");
      const n = trialRows.filter(r => r.correct).length;
      const rows = trialRows.slice().sort((a, b) => a.trial_index - b.trial_index).map(r => { const it = byId[r.item];
        return '<tr><td>' + r.trial_index + '</td><td>' + esc(loc(it).question) + '</td><td>' + T(it.key === "yes" ? "yes" : "no") + '</td><td>' + T(r.supported ? "ai_ok" : "ai_wrong") + '</td><td class="' + (r.correct ? "tagok" : "tagno") + '">' + T(r.correct ? "you_ok" : "you_no") + '</td></tr>'; }).join("");
      h('<div class="card"><h1>' + T("deb_h") + '</h1><p id="status" class="muted">' + T(STATUS) + '</p>' +
        '<p>' + T("deb_result", { score: '<span class="score">' + T("deb_score", { n: n, total: trialRows.length }) + '</span>' }) + '</p>' +
        '<h2>' + T("deb_about_h") + '</h2><p>' + T("deb_about") + '</p>' +
        '<p>' + T("deb_remove", { mail: esc(CONFIG.EMAIL) }) + '</p><p><b>' + T("deb_code") + '</b> <code>' + esc(S.session_id.slice(0, 8)) + '</code></p>' +
        '<p>' + T("deb_results", { mail: MAIL() }) + '</p><p>' + T("deb_secret") + '</p></div>' +
        '<div class="card"><h2>' + T("tbl_h") + '</h2><table class="res"><tr><th>#</th><th>' + T("th_q") + '</th><th>' + T("th_key") + '</th><th>' + T("th_ai") + '</th><th>' + T("th_you") + '</th></tr>' + rows + '</table></div>' +
        '<div class="card" id="dl"' + (DL ? "" : " hidden") + '><p>' + T("dl_p", { mail: esc(CONFIG.EMAIL) }) + '</p><button class="btn" id="dlb">' + T("dl_b") + '</button></div>', re);
      $("#dlb").addEventListener("click", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([finalBody()], { type: "application/json" })); a.download = "responses-" + S.session_id.slice(0, 8) + ".json"; a.click(); });
    });
    submit();
  }
  function setStatus(key, dl) { STATUS = key; DL = !!dl; const s = $("#status"); if (s) s.textContent = T(key); const d = $("#dl"); if (d) d.hidden = !DL; }
  function finalBody() { let b = null; try { b = localStorage.getItem(FKEY); } catch (e) { b = null; } return b || payload(true); }
  /** Sends the finished record. It stays in the browser until the server has confirmed it, so that a failed attempt can be repeated. */
  function post(body, tryNo, ok, fail) {
    fetch(CONFIG.ENDPOINT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body, redirect: "follow" })
      .then(r => r.json()).then(j => { if (!j || !j.ok) throw new Error("endpoint"); ok(); })
      .catch(() => { if (tryNo < 3) return setTimeout(() => post(body, tryNo + 1, ok, fail), 1500 * tryNo); fail(); });
  }
  function confirmed() { S.saved = true; save(); try { localStorage.removeItem(FKEY); } catch (e) { /* ignore */ } }
  function submit() {
    if (!CONFIG.ENDPOINT_URL) return setStatus("st_preview", true);
    post(finalBody(), 1, () => { confirmed(); setStatus("st_saved", false); }, () => setStatus("st_failed", true));
  }
  /** After a reload: a record that was finished but never confirmed is sent again. */
  function resendFinal() {
    if (S.saved || !CONFIG.ENDPOINT_URL) return; let body = null; try { body = localStorage.getItem(FKEY); } catch (e) { body = null; }
    if (body) post(body, 1, confirmed, () => { /* stays in the browser; the next visit tries again */ });
  }

  function screenResume() {
    log("resume", { trials_done: trialRows.length });
    go("resume", re => { h('<div class="card"><h1>' + T("res_h") + '</h1><p>' + T("res_p", { done: trialRows.length, n: TRIALS.length }) + '</p><button class="btn primary" id="go">' + T("res_go") + '</button></div>', re);
      $("#go").addEventListener("click", () => trialRows.length < TRIALS.length ? runTrial(trialRows.length) : screenQuestionnaire(0)); });
  }
  paintChrome();
  if (WAS_DONE) { go("done", () => h(card("done_h", "done_p"))); resendFinal(); return; }
  log("device", deviceInfo());
  if (innerWidth >= CONFIG.MIN_WIDTH && trialRows.length > 0) { prepare(true).then(screenResume); return; }
  log("session_start", meta());
  screenGate();
})();
