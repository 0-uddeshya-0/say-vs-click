/*
 * say-vs-click — study runtime.
 *
 * A citation-backed AI question-answering simulation that measures participants'
 * verification behaviour. Plain HTML/CSS/JS, no build step, no dependencies.
 *
 * Event log: one append-only array; every record carries
 *   { seq, session_id, prolific_pid, study_id, condition:{presence, certainty},
 *     trial_id, event_type, t_perf, t_wall, visibility, target, payload }
 * The array is persisted to localStorage after every event (crash recovery) and
 * beacon'd to ENDPOINT_URL on pagehide. See README § "Data schema".
 */
'use strict';
(function () {

  /* ================= tiny helpers ================= */
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const now  = () => performance.now();
  const iso  = () => new Date().toISOString();
  const round = x => Math.round(x * 100) / 100;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(a) { return a[(Math.random() * a.length) | 0]; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ================= configuration & identity ================= */
  const CFG = (typeof CONFIG !== 'undefined') ? CONFIG : (window.CONFIG || {});
  const ENDPOINT_URL    = CFG.ENDPOINT_URL || '';
  const COMPLETION_URL  = CFG.PROLIFIC_COMPLETION_URL || '';
  const COMPLETION_CODE = CFG.PROLIFIC_COMPLETION_CODE || 'COMPLETION-CODE-PENDING';
  const RETURN_CODE     = CFG.PROLIFIC_RETURN_CODE || COMPLETION_CODE;
  const SHOW_FAM        = CFG.SHOW_FAMILIARITY_RECAP !== false;

  const STIM = (typeof STIMULI !== 'undefined') ? STIMULI : (window.STIMULI || { practice: null, trials: [] });
  const Q    = (typeof QUESTIONNAIRE !== 'undefined') ? QUESTIONNAIRE : (window.QUESTIONNAIRE || { situationalTrust: [], aiLiteracy: [], habitualCheck: '', funnel: '', demographics: [] });
  const N_TRIALS = STIM.trials.length;

  const qs = new URLSearchParams(location.search);
  const LS_EVENTS  = 'svc.events.v1';
  const LS_SESSION = 'svc.session.v1';

  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); } catch (e) { stored = null; }

  // Prolific passes ?PROLIFIC_PID=..&STUDY_ID=..&SESSION_ID=.. ; anything else is a preview.
  const session_id   = qs.get('SESSION_ID')   || (stored && stored.session_id)   || uuid();
  const prolific_pid = qs.get('PROLIFIC_PID') || (stored && stored.prolific_pid) || '';
  const study_id     = qs.get('STUDY_ID')     || (stored && stored.study_id)     || '';
  const preview      = qs.get('preview') === '1' || !qs.get('PROLIFIC_PID');

  /* ================= condition assignment =================
   * Between-subjects: presence {shown,hidden} x certainty {none,certain,uncertain}.
   * Within-subjects: trial order shuffled; exactly 2 of N trials get the flawed
   * rationale and exactly 2 get the non-entailing source set (independent draws,
   * so a trial may carry both). Persisted per session so a reload cannot
   * re-randomise a participant into a different cell.
   */
  let assignment = stored && stored.assignment;
  if (!assignment || !assignment.order) assignment = makeAssignment();

  function makeAssignment() {
    const ids = STIM.trials.map(t => t.id);
    const order = shuffle(ids.slice());
    const flawedPool = STIM.trials.filter(t => Array.isArray(t.rationaleFlawed) && t.rationaleFlawed.length).map(t => t.id);
    const unsupPool  = STIM.trials.filter(t => Array.isArray(t.sourcesUnsupported) && t.sourcesUnsupported.length).map(t => t.id);
    const flawed      = shuffle(flawedPool.slice()).slice(0, Math.min(2, flawedPool.length));
    const unsupported = shuffle(unsupPool.slice()).slice(0, Math.min(2, unsupPool.length));
    return {
      presence:  sample(['shown', 'hidden']),
      certainty: sample(['none', 'certain', 'uncertain']),
      order, flawed, unsupported
    };
  }

  function persistSession() {
    try {
      localStorage.setItem(LS_SESSION, JSON.stringify({
        session_id, prolific_pid, study_id, assignment, saved_at: iso()
      }));
    } catch (e) { /* storage full/blocked — keep going */ }
  }
  persistSession();

  /* ================= event log ================= */
  let events = [];
  try {
    const prev = JSON.parse(localStorage.getItem(LS_EVENTS) || 'null');
    if (Array.isArray(prev) && prev.length && prev[0] && prev[0].session_id === session_id) {
      events = prev;                                   // continue the partial log after reload
    } else if (Array.isArray(prev) && prev.length) {
      localStorage.setItem('svc.events.archive.' + (prev[0] && prev[0].session_id || 'old'), JSON.stringify(prev));
    }
  } catch (e) { events = []; }
  let seq = events.length;

  let cur = null;       // active trial context (null outside trials)
  let openSrc = null;   // state of the currently open source panel

  function logEvent(event_type, opts) {
    opts = opts || {};
    const e = {
      seq: ++seq,
      session_id: session_id,
      prolific_pid: prolific_pid,
      study_id: study_id,
      condition: { presence: assignment.presence, certainty: assignment.certainty },
      trial_id: opts.trial_id !== undefined ? opts.trial_id : (cur ? cur.id : null),
      event_type: event_type,
      t_perf: round(now()),
      t_wall: iso(),
      visibility: document.visibilityState,
      target: opts.target !== undefined ? opts.target : null,
      payload: opts.payload !== undefined ? opts.payload : null
    };
    events.push(e);
    try { localStorage.setItem(LS_EVENTS, JSON.stringify(events)); } catch (err) { /* keep going */ }
    return e;
  }

  /* ================= focus-corrected dwell =================
   * Raw dwell = wall time between open and close. Focused dwell accumulates only
   * while document.visibilityState==='visible' AND the window has focus.
   * Event-driven accumulation: accrue() is called on every state change (and on
   * a 500 ms heartbeat) and adds elapsed time to the active timers only when the
   * previous slice was spent visible+focused.
   */
  const track = { active: false, last: 0 };
  function activeNow() { return document.visibilityState === 'visible' && document.hasFocus(); }
  function accrue() {
    const t = now();
    if (track.active) {
      const d = t - track.last;
      if (cur)     cur.focusedDwellMs += d;
      if (openSrc) openSrc.focusedMs  += d;
    }
    track.last = t;
    track.active = activeNow();
  }
  window.addEventListener('blur',  () => { accrue(); logEvent('window_blur'); });
  window.addEventListener('focus', () => { accrue(); logEvent('window_focus'); });
  document.addEventListener('visibilitychange', () => {
    accrue();
    logEvent('visibilitychange', { payload: { state: document.visibilityState } });
  });
  setInterval(accrue, 500);

  /* ================= screens / progress ================= */
  function setProgress(label, frac) {
    $('#progress-label').textContent = label;
    $('#progress-fill').style.width = Math.round(frac * 100) + '%';
  }
  function showScreen(id) {
    $$('.screen').forEach(s => { s.hidden = (s.id !== 's-' + id); });
    window.scrollTo(0, 0);
  }
  function reveal(sel) {
    const el = $(sel);
    if (el && el.hidden) {
      el.hidden = false;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /* ================= flow =================
   * queue[0] = practice; queue[1..N] = main trials in this participant's order.
   * Interstitials (practice-done, attention check) do not consume positions.
   */
  const queue = [];
  if (STIM.practice) queue.push({ stim: STIM.practice, practice: true, index: 0 });
  assignment.order.forEach((id, i) => {
    const stim = STIM.trials.find(t => t.id === id);
    if (stim) queue.push({ stim: stim, practice: false, index: i + 1 });
  });
  let qpos = -1;

  function nextStep() {
    qpos++;
    if (qpos < queue.length) {
      const entry = queue[qpos];
      if (!entry.practice && entry.index === 1 && STIM.practice) {
        showScreen('practice-done'); setProgress('Practice complete', 0.16);
        return;
      }
      if (!entry.practice && entry.index === 4) {   // mid-trials attention check after trial 3
        startAttnCheck();
        return;
      }
      startTrial(entry);
      return;
    }
    startSurvey1();
  }

  /* ================= 1. consent ================= */
  $('#consent-check').addEventListener('change', e => {
    $('#consent-btn').disabled = !e.target.checked;
  });
  $('#consent-btn').addEventListener('click', () => {
    logEvent('consent_given');
    instrT0 = now();
    showScreen('instructions'); setProgress('Instructions', 0.06);
  });

  /* ================= 2. instructions ================= */
  let instrT0 = 0;
  $('#instr-btn').addEventListener('click', () => {
    logEvent('instructions_viewed', { payload: { dwell_ms: Math.round(now() - instrT0) } });
    showScreen('device'); setProgress('Device check', 0.1);
    runDeviceCheck(true);
  });

  /* ================= 3. device gate =================
   * Pass: viewport >= 1024px wide AND no primary touch input
   * (navigator.maxTouchPoints === 0 or a fine pointer). Re-checked on resize
   * while either gate screen is showing.
   */
  function deviceOk() {
    const fine = window.matchMedia ? matchMedia('(pointer:fine)').matches : true;
    return window.innerWidth >= 1024 && (navigator.maxTouchPoints === 0 || fine);
  }
  let deviceState = null;
  function runDeviceCheck(first) {
    const ok = deviceOk();
    const state = ok ? 'pass' : 'fail';
    if (first || state !== deviceState) {
      logEvent('device_check', { trial_id: null, payload: {
        pass: ok,
        viewport_w: window.innerWidth, viewport_h: window.innerHeight,
        maxTouchPoints: navigator.maxTouchPoints,
        pointer_fine: window.matchMedia ? matchMedia('(pointer:fine)').matches : null,
        user_agent: navigator.userAgent
      }});
      deviceState = state;
    }
    if (ok) {
      setTimeout(() => { if (!$('#s-device').hidden || !$('#s-incompatible').hidden) nextStep(); }, 550);
    } else {
      $('#return-code').textContent = RETURN_CODE;
      showScreen('incompatible'); setProgress('Device check', 0.1);
    }
  }
  let devTimer = null;
  window.addEventListener('resize', () => {
    if ($('#s-device').hidden && $('#s-incompatible').hidden) return;
    clearTimeout(devTimer);
    devTimer = setTimeout(() => runDeviceCheck(false), 250);
  });

  $('#practice-done-btn').addEventListener('click', () => startTrial(queue[qpos]));

  /* ================= 4–5. trials ================= */
  function startTrial(entry) {
    const stim = entry.stim;
    const variant = assignment.flawed.includes(stim.id) ? 'flawed' : 'correct';
    const useU = assignment.unsupported.includes(stim.id) &&
                 Array.isArray(stim.sourcesUnsupported) && stim.sourcesUnsupported.length > 0;
    const sources = useU ? stim.sourcesUnsupported : (stim.sourcesSupported || stim.sources || []);
    const gt = useU ? 'unsupported' : 'supported';   // does the displayed source set entail the answer?

    cur = {
      id: stim.id, index: entry.index, practice: entry.practice, stim: stim,
      variant: variant, gt: gt, sources: sources,
      t0: now(), focusedDwellMs: 0,
      openOrder: [], perSource: {},
      verdict: null, revisions: 0, confidence: null, trust: null,
      justShown: !entry.practice && (entry.index === 3 || entry.index === 5),
      ended: false
    };
    track.active = activeNow(); track.last = now();

    renderTrial();
    showScreen('trial');
    setProgress(
      cur.practice ? 'Practice trial' : 'Trial ' + cur.index + ' of ' + N_TRIALS,
      cur.practice ? 0.15 : 0.16 + 0.58 * (cur.index / N_TRIALS)
    );
    logEvent('trial_start', { payload: {
      trial_index: cur.index, is_practice: cur.practice,
      ground_truth: cur.gt, rationale_variant: cur.variant,
      rationale_shown: !$('#rationale-block').hidden,
      certainty_marker: assignment.certainty,
      n_sources: cur.sources.length,
      claim_true: cur.stim.claimTrue !== undefined ? cur.stim.claimTrue : null
    }});
    if (!$('#rationale-block').hidden) {
      logEvent('rationale_rendered', { payload: { variant: cur.variant, flaw_type: cur.stim.flawType || null } });
    }
  }

  function renderTrial() {
    $('#trial-tag').textContent   = cur.practice ? 'Practice trial' : 'Trial ' + cur.index + ' of ' + N_TRIALS;
    $('#claim-text').textContent  = cur.stim.claim;
    $('#answer-text').textContent = cur.stim.answerText;

    const rb = $('#rationale-block');
    const steps = cur.variant === 'flawed' ? cur.stim.rationaleFlawed : cur.stim.rationaleCorrect;
    if (assignment.presence === 'shown' && Array.isArray(steps) && steps.length) {
      const ol = $('#rationale-list');
      ol.innerHTML = '';
      steps.forEach(s => {
        const li = document.createElement('li');
        li.textContent = s;
        ol.appendChild(li);
      });
      if (!rb.open) expectedToggle = true;   // render queues an async open-toggle
      rb.hidden = false; rb.open = true;
    } else {
      rb.hidden = true;
    }

    const cl = $('#certainty-line');
    if (assignment.certainty !== 'none' && cur.stim.certaintyMarkers && cur.stim.certaintyMarkers[assignment.certainty]) {
      cl.textContent = cur.stim.certaintyMarkers[assignment.certainty];
      cl.hidden = false;
    } else {
      cl.hidden = true;
    }

    const chips = $('#citation-chips');
    chips.innerHTML = '';
    cur.sources.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.idx = i;
      b.textContent = '[' + (i + 1) + ']';
      b.setAttribute('aria-label', 'Open source ' + (i + 1) + ': ' + (s.title || ''));
      b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', () => onChip(i));
      chips.appendChild(b);
    });
    $('#chips-note').hidden = cur.sources.length > 0;

    // reset the staged response blocks
    $$('#verdict-card .verdict-btn').forEach(b => { b.classList.remove('sel'); b.disabled = false; });
    $('#confidence-card').hidden = true;
    $('#trust-card').hidden = true;
    $('#just-card').hidden = true;
    $('#next-btn').hidden = true;
    $('#conf-range').value = 4;  $('#conf-val').textContent = '–';
    $('#trust-range').value = 4; $('#trust-val').textContent = '–';
    $('#just-text').value = '';
    confSet = false; trustSet = false;
  }

  /* ---------- rationale collapse/expand ---------------------
   * <details> toggle events are dispatched asynchronously, so the one queued
   * by renderTrial's `rb.open = true` arrives after rendering finishes. Track
   * the open value render expects and swallow exactly that event; every other
   * toggle is a real user action. */
  let expectedToggle = null;
  $('#rationale-block').addEventListener('toggle', e => {
    if (expectedToggle !== null && e.target.open === expectedToggle) {
      expectedToggle = null;
      return;
    }
    expectedToggle = null;
    if (!cur || cur.ended || e.target.hidden) return;
    logEvent('rationale_toggle', { payload: { open: e.target.open, latency_ms: Math.round(now() - cur.t0) } });
  });

  /* ---------- citation chips + source drawer ---------- */
  function onChip(i) {
    if (!cur || cur.ended) return;
    logEvent('citation_click', { target: i, payload: { latency_ms: Math.round(now() - cur.t0) } });
    if (openSrc && openSrc.index === i) closeSource('chip-toggle');
    else openSource(i);
  }

  function openSource(i) {
    if (!cur) return;
    if (openSrc) closeSource('switch');
    accrue();
    const s = cur.sources[i];
    openSrc = { index: i, t0: now(), focusedMs: 0, milestones: {}, lastPct: -1 };
    cur.openOrder.push(i);

    $('#drawer-label').textContent   = s.label || ('Source ' + (i + 1));
    $('#drawer-title').textContent   = s.title || '';
    $('#drawer-excerpt').textContent = s.excerpt || '';
    const dr = $('#source-drawer');
    dr.hidden = false;
    $('#drawer-overlay').hidden = false;
    $('#drawer-scroll').scrollTop = 0;
    requestAnimationFrame(() => dr.classList.add('open'));
    attachSourceObservers();
    $$('#citation-chips .chip').forEach(c => {
      const on = +c.dataset.idx === i;
      c.classList.toggle('active', on);
      c.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    logEvent('source_open', { target: i, payload: { source_index: i } });
    $('#drawer-close').focus();
  }

  function closeSource(reason) {
    if (!openSrc) return;
    accrue();
    const s = openSrc; openSrc = null;
    detachSourceObservers();
    const raw = now() - s.t0;
    logEvent('source_close', { target: s.index, payload: {
      source_index: s.index,
      open_duration_ms: Math.round(raw),
      focused_ms: Math.round(s.focusedMs),
      reason: reason
    }});
    const agg = cur.perSource[s.index] || (cur.perSource[s.index] = { opens: 0, raw_ms: 0, focused_ms: 0 });
    agg.opens++; agg.raw_ms += Math.round(raw); agg.focused_ms += Math.round(s.focusedMs);

    const dr = $('#source-drawer');
    dr.classList.remove('open');
    $('#drawer-overlay').hidden = true;
    setTimeout(() => { if (!openSrc) dr.hidden = true; }, 240);
    $$('#citation-chips .chip').forEach(c => { c.classList.remove('active'); c.setAttribute('aria-expanded', 'false'); });
    if (reason !== 'switch' && reason !== 'trial_end') {
      const chip = $('#citation-chips .chip[data-idx="' + s.index + '"]');
      if (chip) chip.focus();
    }
  }

  $('#drawer-close').addEventListener('click', () => closeSource('close-btn'));
  $('#drawer-overlay').addEventListener('click', () => closeSource('overlay'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openSrc) closeSource('escape');
  });

  /* ---------- source visibility + scroll tracking ---------- */
  let srcIO = null;
  function onSrcScroll() {
    if (!openSrc) return;
    const el = $('#drawer-scroll');
    const range = el.scrollHeight - el.clientHeight;
    if (range <= 0) return;
    const pct = Math.min(100, Math.round((el.scrollTop + el.clientHeight) / el.scrollHeight * 100));
    [25, 50, 75, 100].forEach(m => {
      if (pct >= m && !openSrc.milestones[m]) {
        openSrc.milestones[m] = true;
        logEvent('scroll_milestone', { target: openSrc.index, payload: { source_index: openSrc.index, pct: m } });
      }
    });
  }
  function attachSourceObservers() {
    const el = $('#drawer-scroll');
    el.addEventListener('scroll', onSrcScroll, { passive: true });
    if (typeof window.IntersectionObserver === 'function') {
      srcIO = new IntersectionObserver(entries => {
        if (!openSrc) return;
        entries.forEach(en => {
          const pct = Math.round(en.intersectionRatio * 100);
          if (pct !== openSrc.lastPct) {
            openSrc.lastPct = pct;
            logEvent('source_visible', { target: openSrc.index, payload: { source_index: openSrc.index, pct: pct } });
          }
        });
      }, { root: el, threshold: [0, 0.25, 0.5, 0.75, 1] });
      srcIO.observe($('#drawer-excerpt'));
    }
  }
  function detachSourceObservers() {
    $('#drawer-scroll').removeEventListener('scroll', onSrcScroll);
    if (srcIO) { srcIO.disconnect(); srcIO = null; }
  }

  /* ---------- verdict → confidence → trust → justification → next ---------- */
  $$('#verdict-card .verdict-btn').forEach(b => b.addEventListener('click', () => onVerdict(b.dataset.verdict)));
  function onVerdict(choice) {
    if (!cur || cur.ended) return;
    cur.revisions++;
    cur.verdict = choice;
    const correct = (choice === 'supported'     && cur.gt === 'supported') ||
                    (choice === 'not_supported' && cur.gt === 'unsupported');
    logEvent('verdict', { payload: {
      choice: choice, correct: correct, ground_truth: cur.gt,
      latency_ms: Math.round(now() - cur.t0), revision: cur.revisions
    }});
    $$('#verdict-card .verdict-btn').forEach(b => b.classList.toggle('sel', b.dataset.verdict === choice));
    reveal('#confidence-card');
  }

  let confSet = false, trustSet = false;
  $('#conf-range').addEventListener('input', e => {
    const v = +e.target.value;
    $('#conf-val').textContent = v;
    if (!cur || cur.ended) return;
    cur.confidence = v;
    if (!confSet) { confSet = true; reveal('#trust-card'); }
  });
  $('#conf-range').addEventListener('change', e => {
    if (!cur || cur.ended) return;
    logEvent('confidence_set', { payload: { value: +e.target.value, latency_ms: Math.round(now() - cur.t0) } });
  });
  $('#trust-range').addEventListener('input', e => {
    const v = +e.target.value;
    $('#trust-val').textContent = v;
    if (!cur || cur.ended) return;
    cur.trust = v;
    if (!trustSet) {
      trustSet = true;
      if (cur.justShown) reveal('#just-card');
      reveal('#next-btn');
    }
  });
  $('#trust-range').addEventListener('change', e => {
    if (!cur || cur.ended) return;
    logEvent('trust_set', { payload: { value: +e.target.value, latency_ms: Math.round(now() - cur.t0) } });
  });

  $('#next-btn').addEventListener('click', endTrial);
  function endTrial() {
    if (!cur || cur.ended) return;
    accrue();
    if (openSrc) closeSource('trial_end');
    if (cur.justShown) {
      const t = $('#just-text').value.trim();
      logEvent('justification_text', { payload: { text: t, len: t.length } });
    }
    cur.ended = true;
    logEvent('trial_end', { payload: {
      nSourcesOpened: cur.openOrder.length,
      openOrder: cur.openOrder.slice(),
      perSource: cur.perSource,
      focusCorrectedDwellMs: Math.round(cur.focusedDwellMs),
      rawDwellMs: Math.round(now() - cur.t0),
      verdict: cur.verdict,
      confidence: cur.confidence,
      trust: cur.trust,
      ground_truth: cur.gt,
      rationale_variant: cur.variant,
      claim_true: cur.stim.claimTrue !== undefined ? cur.stim.claimTrue : null
    }});
    cur = null;
    nextStep();
  }

  /* ================= 6. mid-trials attention check =================
   * Instructed-response item styled like a trial verdict card. The FIRST click
   * decides pass/fail; a wrong first click lets them retry so they can proceed.
   */
  let attnLogged = false, attnPassed = false;
  function startAttnCheck() {
    attnLogged = false; attnPassed = false;
    $('#attn-hint').hidden = true;
    $$('#s-attn .verdict-btn').forEach(b => b.classList.remove('sel'));
    showScreen('attn');
    setProgress('Quick check', 0.16 + 0.58 * (3.5 / N_TRIALS));
  }
  $$('#s-attn .verdict-btn').forEach(b => b.addEventListener('click', () => {
    if (attnPassed) return;
    const c = b.dataset.choice;
    if (!attnLogged) {
      attnLogged = true;
      logEvent('attention_check', { target: 'mid_trials', payload: {
        check_id: 'mid_trials', pass: c === 'not_supported', first_choice: c
      }});
    }
    if (c === 'not_supported') {
      attnPassed = true;
      b.classList.add('sel');
      setTimeout(() => startTrial(queue[qpos]), 650);
    } else {
      $('#attn-hint').hidden = false;
    }
  }));

  /* ================= 7. post-questionnaire ================= */
  function likertItem(id, text, n, endL, endR) {
    const fs = document.createElement('fieldset');
    fs.className = 'likert';
    const lg = document.createElement('legend');
    lg.textContent = text;
    fs.appendChild(lg);
    const row = document.createElement('div');
    row.className = 'likert-row';
    const e1 = document.createElement('span');
    e1.className = 'likert-end'; e1.textContent = endL;
    row.appendChild(e1);
    for (let v = 1; v <= n; v++) {
      const lb = document.createElement('label');
      lb.className = 'likert-opt';
      const inp = document.createElement('input');
      inp.type = 'radio'; inp.name = 'q_' + id; inp.value = v;
      inp.setAttribute('aria-label', v + ' of ' + n);
      const sp = document.createElement('span');
      sp.className = 'likert-pill'; sp.textContent = v;
      lb.appendChild(inp); lb.appendChild(sp);
      row.appendChild(lb);
    }
    const e2 = document.createElement('span');
    e2.className = 'likert-end'; e2.textContent = endR;
    row.appendChild(e2);
    fs.appendChild(row);
    return fs;
  }

  const s1Answered = new Set();
  let s1Total = 0;
  function startSurvey1() {
    const tWrap = $('#trust-items'); tWrap.innerHTML = '';
    Q.situationalTrust.forEach((txt, i) => tWrap.appendChild(likertItem('trust_' + (i + 1), txt, 7, 'Strongly disagree', 'Strongly agree')));
    const aWrap = $('#attn-item'); aWrap.innerHTML = '';
    aWrap.appendChild(likertItem('attn_survey', "To show that you are reading carefully, please select '2' for this item.", 7, 'Strongly disagree', 'Strongly agree'));
    const lWrap = $('#lit-items'); lWrap.innerHTML = '';
    Q.aiLiteracy.forEach((txt, i) => lWrap.appendChild(likertItem('lit_' + (i + 1), txt, 7, 'Strongly disagree', 'Strongly agree')));
    const hWrap = $('#habit-item'); hWrap.innerHTML = '';
    hWrap.appendChild(likertItem('habitual_check', Q.habitualCheck, 5, 'Never', 'Always'));
    s1Total = Q.situationalTrust.length + 1 + Q.aiLiteracy.length + 1;
    showScreen('survey1');
    setProgress('Questionnaire', 0.8);
  }
  $('#s-survey1').addEventListener('change', e => {
    const inp = e.target;
    if (!inp.name || inp.name.indexOf('q_') !== 0) return;
    const id = inp.name.slice(2);
    const v = +inp.value;
    const firstAnswer = !s1Answered.has(id);
    if (id === 'attn_survey') {
      if (firstAnswer) {
        logEvent('attention_check', { target: 'survey', payload: { check_id: 'survey_embedded', pass: v === 2, value: v } });
      }
    } else {
      logEvent('questionnaire_item', { target: id, payload: { item_id: id, value: v } });
    }
    s1Answered.add(id);
    $('#survey1-btn').disabled = s1Answered.size < s1Total;
  });
  $('#survey1-btn').addEventListener('click', () => startSurvey2());

  const s2Answered = new Set();
  let s2Total = 0;
  let ageOk = false, genderOk = false;
  function startSurvey2() {
    const famWrap = $('#fam-items'); famWrap.innerHTML = '';
    $('#fam-block').hidden = !SHOW_FAM;
    s2Total = 0;
    if (SHOW_FAM) {
      queue.filter(en => !en.practice).forEach(en => {
        famWrap.appendChild(likertItem('fam_' + en.stim.id, '“' + en.stim.claim + '”', 5, 'Not at all familiar', 'Very familiar'));
        s2Total++;
      });
    }
    $('#funnel-label').textContent = Q.funnel || 'What do you think this study was about?';
    updateS2Btn();
    showScreen('survey2');
    setProgress('Questionnaire', 0.88);
  }
  function updateS2Btn() {
    $('#survey2-btn').disabled = !(s2Answered.size >= s2Total && ageOk && genderOk);
  }
  $('#s-survey2').addEventListener('change', e => {
    const inp = e.target;
    if (inp.name && inp.name.indexOf('q_') === 0) {
      const id = inp.name.slice(2);
      logEvent('questionnaire_item', { target: id, payload: { item_id: id, value: +inp.value } });
      s2Answered.add(id);
    }
    updateS2Btn();
  });
  $('#age-input').addEventListener('change', () => {
    const v = parseInt($('#age-input').value, 10);
    ageOk = Number.isFinite(v) && v >= 18 && v <= 100;
    if (ageOk) logEvent('questionnaire_item', { target: 'age', payload: { item_id: 'age', value: v } });
    updateS2Btn();
  });
  $('#gender-select').addEventListener('change', () => {
    const v = $('#gender-select').value;
    genderOk = !!v;
    $('#gender-self').hidden = (v !== 'self');
    if (genderOk) logEvent('questionnaire_item', { target: 'gender', payload: { item_id: 'gender', value: v } });
    updateS2Btn();
  });
  $('#survey2-btn').addEventListener('click', () => {
    const self = $('#gender-self').value.trim();
    if (self) logEvent('questionnaire_item', { target: 'gender_self', payload: { item_id: 'gender_self', value: self } });
    logEvent('questionnaire_item', { target: 'funnel', payload: { item_id: 'funnel', text: $('#funnel-text').value.trim() } });
    showDebrief();
  });

  /* ================= 8. debrief ================= */
  function showDebrief() {
    const list = $('#debrief-list');
    list.innerHTML = '';
    queue.filter(en => !en.practice).forEach(en => {
      const stim = en.stim;
      const wasU = assignment.unsupported.includes(stim.id);
      const wasF = assignment.flawed.includes(stim.id);
      const div = document.createElement('div');
      div.className = 'debrief-item';
      let html = '<strong>“' + escapeHtml(stim.claim) + '”</strong> — ';
      html += wasU ? 'the cited sources did <strong>not</strong> support the answer'
                   : 'the cited sources supported the answer';
      if (assignment.presence === 'shown' && wasF) html += ' · <em>the reasoning shown contained a flawed step</em>';
      div.innerHTML = html + '.';
      list.appendChild(div);
    });
    showScreen('debrief');
    setProgress('Debrief', 0.94);
    logEvent('debrief_shown');
  }

  /* ================= 9. submit ================= */
  function buildPayload() {
    const first = events.find(e => e.event_type === 'session_start');
    return {
      meta: {
        session_id: session_id,
        prolific_pid: prolific_pid,
        study_id: study_id,
        prolific_session_id: qs.get('SESSION_ID') || '',
        preview: preview,
        condition: { presence: assignment.presence, certainty: assignment.certainty },
        assignment: { order: assignment.order, flawed: assignment.flawed, unsupported: assignment.unsupported },
        user_agent: navigator.userAgent,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        started_wall: first ? first.t_wall : null,
        ended_wall: iso(),
        n_events: events.length,
        n_trials: N_TRIALS,
        instrument: 'say-vs-click/1.0'
      },
      events: events
    };
  }

  function postJSON(body, timeoutMs) {
    // Apps Script web apps do not answer CORS preflights, so we try three
    // transports in order: application/json (spec), text/plain (simple request,
    // no preflight), and a no-cors opaque POST as last resort.
    const attempt = (opts, via) => fetch(ENDPOINT_URL, Object.assign({ method: 'POST', body: body }, opts))
      .then(r => ({ ok: r.ok, status: r.status, via: via }))
      .catch(err => ({ ok: false, error: String(err), via: via }));
    const jsonOpts = { headers: { 'Content-Type': 'application/json' } };
    if (window.AbortSignal && AbortSignal.timeout) jsonOpts.signal = AbortSignal.timeout(timeoutMs);
    return attempt(jsonOpts, 'json').then(r => {
      if (r.ok) return r;
      const plainOpts = { headers: { 'Content-Type': 'text/plain;charset=utf-8' } };
      if (window.AbortSignal && AbortSignal.timeout) plainOpts.signal = AbortSignal.timeout(timeoutMs);
      return attempt(plainOpts, 'plain');
    }).then(r => {
      if (r.ok) return r;
      return attempt({ mode: 'no-cors' }, 'nocors')
        .then(() => ({ ok: true, status: null, via: 'nocors', opaque: true }))
        .catch(err => ({ ok: false, error: String(err), via: 'nocors' }));
    });
  }

  let submitted = false;
  function submitData() {
    logEvent('session_end', { trial_id: null, payload: { n_events: events.length, total_perf_ms: Math.round(now()) } });
    persistSession();

    const finishUI = (ok, msg) => {
      $('#submit-running').hidden = true;
      $('#submit-done').hidden = false;
      $('#submit-msg').textContent = msg;
      $('#completion-code').textContent = COMPLETION_CODE;
      const link = $('#prolific-link');
      if (COMPLETION_URL) { link.href = COMPLETION_URL; link.hidden = false; }
      setProgress('Complete', 1);
    };

    if (!ENDPOINT_URL) {
      logEvent('submit_attempt', { trial_id: null, payload: { endpoint_set: false, n_events: events.length } });
      logEvent('submit_result',  { trial_id: null, payload: { ok: false, reason: 'no_endpoint' } });
      finishUI(false, 'Your responses were recorded locally in this browser. Please download your session data and report the completion code on Prolific.');
      return;
    }
    logEvent('submit_attempt', { trial_id: null, payload: { endpoint_set: true, n_events: events.length } });
    const body = JSON.stringify(buildPayload());   // includes submit_attempt
    postJSON(body, 15000).then(res => {
      logEvent('submit_result', { trial_id: null, payload: {
        ok: !!res.ok, status: res.status != null ? res.status : null,
        via: res.via || null, error: res.error || null, opaque: !!res.opaque
      }});
      if (res.ok) {
        submitted = true;
        finishUI(true, 'Your responses were submitted. Click below to return to Prolific and complete the study.');
      } else {
        finishUI(false, 'We could not reach the data server — your data is safe in this browser. Please download your session data and report the completion code on Prolific.');
      }
    });
  }

  $('#finish-btn').addEventListener('click', () => {
    showScreen('submit'); setProgress('Submitting', 0.97);
    submitData();
  });

  $('#download-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'say-vs-click-' + session_id + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });

  /* Partial-data safety: beacon the whole log when the page is hidden/closed. */
  window.addEventListener('pagehide', () => {
    if (!ENDPOINT_URL) return;
    try {
      navigator.sendBeacon(ENDPOINT_URL, new Blob([JSON.stringify(buildPayload())], { type: 'application/json' }));
    } catch (e) { /* best effort */ }
  });

  /* ================= init ================= */
  logEvent('session_start', { trial_id: null, payload: {
    resumed: events.length > 1,
    preview: preview,
    condition: { presence: assignment.presence, certainty: assignment.certainty },
    order: assignment.order,
    flawed: assignment.flawed,
    unsupported: assignment.unsupported,
    user_agent: navigator.userAgent,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    url_params: {
      prolific_pid: !!qs.get('PROLIFIC_PID'),
      study_id: !!qs.get('STUDY_ID'),
      session_id: !!qs.get('SESSION_ID')
    }
  }});
  showScreen('consent');
  setProgress('Consent', 0.02);

})();
