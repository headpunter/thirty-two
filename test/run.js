// node test/run.js — exercises grid.js against the real commanders.json,
// including every line of the paste that motivated this app.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const T32 = require("../grid.js");
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "commanders.json"), "utf8"));
const index = T32.buildIndex(data.commanders);

let n = 0;
function test(name, fn) {
  n++;
  try { fn(); } catch (e) {
    console.error(`FAIL ${name}\n  ${e.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok ${name}`);
}

// ---------- normalize ----------
test("normalize folds case, commas, apostrophes", () => {
  assert.equal(T32.normalize("Zada, Hedron Grinder"), "zada hedron grinder");
  assert.equal(T32.normalize("Eshki Fate’s Not Subtle"), "eshki fates not subtle");
});

// ---------- matchName ----------
test("exact full name matches", () => {
  const r = T32.matchName(index, "Zada, Hedron Grinder");
  assert.equal(r.match.identity, "R");
});
test("unique first-name prefix matches", () => {
  assert.equal(T32.matchName(index, "Zurzoth").match.name, "Zurzoth, Chaos Rider");
});
test("prefix respects word boundaries: Esika is not Esika's Chariot", () => {
  const r = T32.matchName(index, "Esika");
  assert.ok(r.match, "expected a unique match");
  assert.equal(r.match.name, "Esika, God of the Tree");
  assert.equal(r.match.identity, "WUBRG");
});
test("ambiguous prefix surfaces candidates", () => {
  const r = T32.matchName(index, "Alela");
  assert.ok(r.ambiguous);
  assert.deepEqual(r.ambiguous.map((c) => c.name).sort(), [
    "Alela, Artful Provocateur", "Alela, Cunning Conqueror"]);
});
test("unknown name returns null", () => {
  assert.equal(T32.matchName(index, "Not A Real Card"), null);
});
test("ambiguous names with one shared identity resolve as typed", () => {
  const r = T32.matchName(index, "Eshki");   // two Eshkis, both Temur
  assert.ok(r.match, "expected auto-resolve");
  assert.equal(r.match.name, "Eshki");
  assert.equal(r.match.identity, "URG");
});

// ---------- aliases & completion ----------
test("back-face alias resolves to the front-face entry", () => {
  const r = T32.matchName(index, "Esper Terra");
  assert.equal(r.match.name, "Terra, Magical Adept");
  assert.equal(r.match.identity, "WUBRG");
});
test("completePrefix: unique partial-word prefix completes", () => {
  assert.equal(T32.completePrefix(index, "zurz"), "Zurzoth, Chaos Rider");
  assert.equal(T32.completePrefix(index, "esika g"), "Esika, God of the Tree");
});
test("completePrefix: back-face alias completes as typed side", () => {
  assert.equal(T32.completePrefix(index, "esper"), "Esper Terra");
});
test("completePrefix: ambiguous or unknown gives nothing", () => {
  assert.equal(T32.completePrefix(index, "esika"), null);  // God vs Chariot
  assert.equal(T32.completePrefix(index, "alela"), null);
  assert.equal(T32.completePrefix(index, "zzzz"), null);
  assert.equal(T32.completePrefix(index, "  "), null);
});

// ---------- tier markers ----------
test("tier markers parse and rank", () => {
  assert.equal(T32.parseTierMarker("5"), "5");
  assert.equal(T32.parseTierMarker("3^"), "3^");
  assert.equal(T32.parseTierMarker("3v"), "3v");
  assert.equal(T32.parseTierMarker("Zada"), null);
  assert.ok(T32.tierRank("5") > T32.tierRank("4"));
  assert.ok(T32.tierRank("3^") > T32.tierRank("3"));
  assert.ok(T32.tierRank("3") > T32.tierRank("3v"));
  assert.ok(T32.tierRank("3v") > T32.tierRank("2"));
  assert.equal(T32.tierLabel("3v"), "3↓");
});

// ---------- the motivating paste, verbatim ----------
const PASTE = `5
Esika Legends
Zada Mafia Queen

4
Zada Forest Queen
Esika Overtime
Arcades Zugzwang
Reyhan/Ishai Reyhan’s Iterative Sequence Computer
Eshki Fate’s Not Subtle

3^
Zurzoth Temple Gun
Zurgo Stormrender N/A
Alela, Cunning Conqueror | On the Clock

3v
Kess Clonestorm
Terra, Magical Adept Esper? I barely know her!
Ikra Ardenn  N/A

2
Esika Artsika `;

const parsed = T32.parseList(index, PASTE);

test("paste: all 14 lines resolve", () => {
  assert.equal(parsed.problems.length, 0,
    JSON.stringify(parsed.problems));
  assert.equal(parsed.decks.length, 14);
});
test("paste: deck names survive prefix trimming", () => {
  const zada = parsed.decks.find((d) => d.deckName === "Mafia Queen");
  assert.equal(zada.names[0], "Zada, Hedron Grinder");
  assert.equal(zada.tier, "5");
});
test("paste: explicit pair Reyhan/Ishai unions to Witch-Maw", () => {
  const d = parsed.decks.find((d) => d.names.length === 2 &&
    d.names[0].startsWith("Reyhan"));
  assert.equal(d.identity, "WUBG");
  assert.equal(d.names[1], "Ishai, Ojutai Dragonspeaker");
  assert.ok(d.deckName.startsWith("Reyhan"));
  assert.deepEqual(d.warnings, []);
});
test("paste: implicit pair Ikra Ardenn unions to Abzan", () => {
  const d = parsed.decks.find((d) => d.names.length === 2 &&
    d.names[0].startsWith("Ikra"));
  assert.equal(d.identity, "WBG");
  assert.equal(d.names[1], "Ardenn, Intrepid Archaeologist");
  assert.equal(d.deckName, "N/A");
});
test("paste: N/A after a non-pairable commander is a deck name, not a pair", () => {
  const d = parsed.decks.find((d) => d.names[0] === "Zurgo Stormrender");
  assert.equal(d.names.length, 1);
  assert.equal(d.identity, "WBR");
  assert.equal(d.deckName, "N/A");
});
test("paste: explicit | separator pins name and deck", () => {
  const d = parsed.decks.find((d) => d.names[0] === "Alela, Cunning Conqueror");
  assert.equal(d.identity, "UB");
  assert.equal(d.deckName, "On the Clock");
  assert.equal(d.tier, "3^");
});
test("paste: deck name containing a card name does not mis-pair", () => {
  const d = parsed.decks.find((d) => d.deckName.indexOf("barely") !== -1);
  assert.equal(d.names[0], "Terra, Magical Adept");
  assert.equal(d.names.length, 1);
  assert.equal(d.identity, "WUBRG");
});

// ---------- ambiguity through parseList ----------
test("bare Alela line comes back as an ambiguity, not a guess", () => {
  const r = T32.parseList(index, "Alela On the Clock");
  assert.equal(r.decks.length, 0);
  assert.equal(r.problems[0].kind, "ambiguous");
  assert.equal(r.problems[0].candidates.length, 2);
});
test("bare Terra line is ambiguous — the two Terras differ in identity", () => {
  const r = T32.parseList(index, "Terra Esper? I barely know her!");
  assert.equal(r.problems[0].kind, "ambiguous");
  assert.deepEqual(
    r.problems[0].candidates.map((c) => c.identity).sort(),
    ["WBR", "WUBRG"]);
});
test("garbage line comes back unresolved with the raw text", () => {
  const r = T32.parseList(index, "totally made up words");
  assert.equal(r.problems[0].kind, "unresolved");
  assert.equal(r.problems[0].raw, "totally made up words");
});

// ---------- pairing warning ----------
test("explicit pair of non-partners warns but still renders", () => {
  const r = T32.parseList(index, "Zada / Zurzoth");
  assert.equal(r.decks.length, 1);
  assert.equal(r.decks[0].identity, "R");
  assert.equal(r.decks[0].warnings.length, 1);
});

// ---------- slots ----------
test("buildSlots covers 9 identities for the paste, best tier first", () => {
  const slots = T32.buildSlots(parsed.decks);
  assert.equal(slots.length, 32);
  assert.equal(slots.filter((s) => s.filled).length, 9);
  const five = slots.find((s) => s.identity === "WUBRG");
  assert.equal(five.decks.length, 4);
  assert.equal(five.decks[0].deckName, "Legends");
  const red = slots.find((s) => s.identity === "R");
  assert.equal(red.decks.length, 3);
  assert.equal(red.decks[0].deckName, "Mafia Queen");
});

process.on("exit", () => {
  if (!process.exitCode) console.log(`\n${n} tests passed`);
});
