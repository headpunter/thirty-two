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
Atraxa  Superfriends {Sunday Night}
Krenko  Goblin Bomb {Sunday Night}

4
Thrasios / Tymna  Value Town {Cube Shelf}
Alela, Cunning Conqueror | Faerie Flash
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
- `{Box Name}` anywhere on a line files that deck into a box. Braces are
  lifted out before name matching, so they can sit wherever reads best.

## Views

**Colour grid** is the default: all 32 identity slots, filled and vacant.

**Boxes** re-sorts the same decks into one panel per `{Box Name}` — your own
shelf, sleeve, or playgroup ordering rather than the colour wheel. Boxes appear
in the order you first name them, decks inside sort by rating, and anything
unlabelled collects in a trailing box. Each deck carries its colour pips, since
position no longer encodes identity. A shared link containing braces opens in
this view.

## Development

No build step. `index.html` + `grid.js` (all logic, DOM-free) +
`commanders.js`/`commanders.json` (data).

```
node test/run.js
```

`tools/export_commanders.py` regenerates the data files from the
arcanists-rubric commander catalog (needs its `DATABASE_URL`); commit the
result when new sets add commanders. The page footer shows the data date.
