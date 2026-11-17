const { ITEMS } = require("./items.js"); const { buildTrials, validateItems } = require("./design.js");
console.log("validation problems in bundled items (German required):", validateItems(ITEMS, { requireDe: true }));
const badDe = JSON.parse(JSON.stringify(ITEMS)); badDe[1].de.answer.s = "Nein. Falsch."; badDe[2].de.trace.u.pop(); delete badDe[4].de; badDe[5].sources[0].url = "http://x";
console.log("broken German / link is rejected:", validateItems(badDe, { requireDe: true }));
console.log("every source has a link:", ITEMS.every(i => i.sources.every(s => /^https:\/\/en\.wikipedia\.org\/wiki\//.test(s.url))));
const bad = JSON.parse(JSON.stringify(ITEMS)); bad[0].key = "no"; bad[3].answer.s = "Maybe."; console.log("deliberately broken set is rejected:", validateItems(bad).length > 0, validateItems(bad));
let cells = {};
for (let list = 0; list < 8; list++) for (let seed = 1; seed <= 200; seed++) {
  const t = buildTrials(ITEMS, list, seed);
  console.assert(t.length === 16); console.assert(t.filter(x => x.trace).length === 8);
  const u = t.filter(x => !x.supported); console.assert(u.length === 4 && u.filter(x => x.trace).length === 2);
  console.assert(t[0].supported); for (let i = 1; i < 16; i++) console.assert(t[i].supported || t[i - 1].supported, "adjacent");
  console.assert(t.filter(x => x.trace && x.key === "yes").length === 4);
  if (seed === 1) t.forEach(x => { const k = x.item + "|" + x.trace + "|" + x.supported; cells[k] = (cells[k] || 0) + 1; });
}
const per = {}; Object.keys(cells).forEach(k => { const id = k.split("|")[0]; per[id] = (per[id] || 0) + 1; });
console.log("items:", Object.keys(per).length, "all four cells for every item:", Object.values(per).every(v => v === 4));
const g = {}; ITEMS.forEach(i => { g[i.group] = (g[i.group] || "") + i.key[0]; }); console.log("groups:", g);
ITEMS.forEach(i => { const w = i.sources.map(s => s.text.split(/\s+/).length); console.log(i.id.padEnd(10), "source words", w.join("/"), "trace steps", i.trace.s.length, i.trace.u.length,
  "trace words", i.trace.s.join(" ").split(/\s+/).length, i.trace.u.join(" ").split(/\s+/).length); });

// practice item: validated like the others (supported variant only, no group), English and German
const { PRACTICE } = require("./items.js"); const { validatePractice } = require("./design.js");
console.log("practice item valid (German required):", validatePractice(PRACTICE, { requireDe: true }));
const badPr = JSON.parse(JSON.stringify(PRACTICE)); badPr.answer.s = "Maybe."; delete badPr.de; badPr.sources[0].url = "http://x";
console.log("broken practice item is rejected:", validatePractice(badPr, { requireDe: true }).length > 0, validatePractice(badPr, { requireDe: true }));
console.log("missing practice item is rejected:", validatePractice(null));
