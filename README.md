# The Thirty-Two Challenge

One Commander deck for every colour identity — all 32 of them. Paste your
decks, see which slots you hold.

**Live:** https://headpunter.github.io/thirty-two/

Runs entirely in the browser: a bundled catalog of every legal commander's
colour identity means no server, no API calls, no accounts. It even works
opened straight from a local file. Your list lives in the page URL, so
sharing your board is copying the address bar.

## Paste format

```
5
Esika  Legends
Zada  Mafia Queen

4
Reyhan / Ishai  Iterative Sequence Computer
Alela, Cunning Conqueror | On the Clock
```

- One deck per line: a commander name (loose prefixes fine), and whatever
  follows becomes the deck's name.
- Pairs: `Reyhan / Ishai`, `A + B`, or just two partner names in a row.
- `|` pins an exact split between commander and deck name — the fix for any
  name the matcher gets wrong.
- A line that's only a number rates the lines after it (`3^` / `3v` for
  high-3 and low-3). Ratings show as chips; skip them entirely if you like.
- Names that match several commanders show a click-to-pick prompt — only
  when the candidates actually differ in colour identity.

## Development

No build step. `index.html` + `grid.js` (all logic, DOM-free) +
`commanders.js`/`commanders.json` (data).

```
node test/run.js
```

`tools/export_commanders.py` regenerates the data files from the
arcanists-rubric commander catalog (needs its `DATABASE_URL`); commit the
result when new sets add commanders. The page footer shows the data date.
