/* Design logic without any DOM access, so it can be tested with Node (see test_design.js).
 *
 * 8 lists. list % 4  = group whose four items appear in the unsupported version.
 *          list >> 2 = which half of every group is shown with a reasoning trace.
 * Every group holds [yes, yes, no, no]. A trace is shown for positions (0, 2) or (1, 3),
 * so in every group one "yes" item and one "no" item carry a trace.
 * Result per participant: 16 trials, 8 with a trace, 4 unsupported (2 with a trace, 2 without).
 */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function buildTrials(items, list, seed) {
  const rnd = mulberry32(seed);
  const unsupportedGroup = list % 4, half = list >> 2;
  const trials = [];
  for (let g = 0; g < 4; g++) {
    // "yes" items first, so that the two trace positions always hold one "yes" and one "no" item
    const grp = items.filter(it => it.group === g).sort((x, y) => (x.key === y.key ? 0 : (x.key === "yes" ? -1 : 1)));
    grp.forEach((it, pos) => {
      trials.push({ item: it.id, group: g, key: it.key,
        trace: (pos % 2) === half, supported: g !== unsupportedGroup });
    });
  }
  // random order; first trial supported; no two unsupported trials in a row
  let order, ok = false, guard = 0;
  while (!ok && guard++ < 5000) {
    order = shuffle(trials, rnd);
    ok = order[0].supported && order.every((t, i) => i === 0 || t.supported || order[i - 1].supported);
  }
  return order.map((t, i) => Object.assign({ index: i + 1 }, t));
}
/* Checks an item set against the rules the design depends on. Returns a list of problems (empty = valid). */
/* Checks one item (shared by the item set and the practice item, which has only a supported version). Appends problems to p. */
function checkItem(it, n, p, requireDe, ids, practice) {
  const variants = practice ? ["s"] : ["s", "u"];
    const tag = "Item " + (n + 1) + (it && it.id ? " (" + it.id + ")" : "") + ": ";
    if (!it || typeof it !== "object") { p.push(tag + "not an object."); return; }
    if (!it.id || !/^[a-z0-9_-]+$/.test(it.id)) p.push(tag + "the id must consist of lower-case letters, digits, - or _.");
    if (ids[it.id]) p.push(tag + "the id is used twice."); ids[it.id] = true;
    if (!practice && [0, 1, 2, 3].indexOf(it.group) < 0) p.push(tag + "the group must be 0, 1, 2 or 3.");
    if (it.key !== "yes" && it.key !== "no") p.push(tag + "the correct answer must be yes or no.");
    if (!it.question || !String(it.question).trim()) p.push(tag + "the question is empty.");
    variants.forEach(v => {
      const name = v === "s" ? "supported" : "unsupported";
      if (!it.answer || !it.answer[v] || !String(it.answer[v]).trim()) p.push(tag + "the " + name + " answer is empty.");
      else { const says = /^\s*yes\b/i.test(it.answer[v]) ? "yes" : (/^\s*no\b/i.test(it.answer[v]) ? "no" : null);
        const should = v === "s" ? it.key : (it.key === "yes" ? "no" : "yes");
        if (says === null) p.push(tag + "the " + name + " answer must begin with Yes or No.");
        else if (says !== should) p.push(tag + "the " + name + " answer begins with " + says + " but must begin with " + should + "."); }
      const tr = it.trace && it.trace[v];
      if (!Array.isArray(tr) || tr.length < 2 || tr.some(x => !String(x).trim())) p.push(tag + "the " + name + " trace needs at least two non-empty steps.");
    });
    if (!Array.isArray(it.sources) || it.sources.length !== 3) p.push(tag + "exactly three sources are required.");
    else it.sources.forEach((s, k) => { if (!s || !s.title || !s.text || !String(s.title).trim() || !String(s.text).trim()) p.push(tag + "source " + (k + 1) + " needs a title and a text.");
      else if (s.url && !/^https:\/\/[^\s]+$/.test(s.url)) p.push(tag + "the link of source " + (k + 1) + " must begin with https://."); });
    // German version: optional for the design, required when the study offers German
    const d = it.de;
    if (!d) { if (requireDe) p.push(tag + "the German version is missing."); return; }
    if (!d.question || !String(d.question).trim()) p.push(tag + "the German question is empty.");
    variants.forEach(v => {
      const name = v === "s" ? "supported" : "unsupported", a = d.answer && d.answer[v];
      if (!a || !String(a).trim()) p.push(tag + "the German " + name + " answer is empty.");
      else { const says = /^\s*ja\b/i.test(a) ? "yes" : (/^\s*nein\b/i.test(a) ? "no" : null), should = v === "s" ? it.key : (it.key === "yes" ? "no" : "yes");
        if (says === null) p.push(tag + "the German " + name + " answer must begin with Ja or Nein.");
        else if (says !== should) p.push(tag + "the German " + name + " answer begins with " + (says === "yes" ? "Ja" : "Nein") + " but must begin with " + (should === "yes" ? "Ja" : "Nein") + "."); }
      const tr = d.trace && d.trace[v], en = it.trace && it.trace[v];
      if (!Array.isArray(tr) || tr.length < 2 || tr.some(x => !String(x).trim())) p.push(tag + "the German " + name + " trace needs at least two non-empty steps.");
      else if (Array.isArray(en) && tr.length !== en.length) p.push(tag + "the German " + name + " trace has " + tr.length + " steps, the English one " + en.length + ".");
    });
    if (!Array.isArray(d.sources) || d.sources.length !== 3 || d.sources.some(s => !s || !String(s.title || "").trim() || !String(s.text || "").trim())) p.push(tag + "the German version needs a title and a text for each of the three sources.");
}
function validateItems(items, opts) {
  const p = [], requireDe = !!(opts && opts.requireDe);
  if (!Array.isArray(items)) return ["The item set is not a list."];
  if (items.length !== 16) p.push("There must be exactly 16 items (found " + items.length + ").");
  const ids = {};
  items.forEach((it, n) => checkItem(it, n, p, requireDe, ids));
  for (let g = 0; g < 4; g++) {
    const grp = items.filter(it => it && it.group === g);
    if (grp.length !== 4) p.push("Group " + g + " must contain 4 items (found " + grp.length + ").");
    else if (grp.filter(it => it.key === "yes").length !== 2) p.push("Group " + g + " must contain two items with the answer yes and two with the answer no.");
  }
  return p;
}
/* Checks the practice item with the same rules as the 16 items. Returns a list of problems (empty = valid). */
function validatePractice(pr, opts) {
  const p = [], requireDe = !!(opts && opts.requireDe);
  if (!pr || typeof pr !== "object") return ["The practice item is missing."];
  checkItem(pr, 0, p, requireDe, {}, true);
  return p.map(x => x.replace(/^Item 1/, "Practice item"));
}
if (typeof module !== "undefined") module.exports = { buildTrials, mulberry32, shuffle, validateItems, validatePractice };
