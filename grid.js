// Pure logic for the thirty-two grid: commander-name matching, list parsing,
// and slot assembly. No DOM, no network — index.html renders what this
// returns, and test/run.js exercises it under node.

(function (root) {
  "use strict";

  var WUBRG = "WUBRG";

  // The 32 colour identities, grouped by Magic's own taxonomy. The grouping
  // is the information: allied vs enemy pairs, shards vs wedges, four-colour
  // identities named for what they lack.
  var GROUPS = [
    { key: "colourless", label: "Colourless", note: "no colour identity",
      identities: [{ code: "", name: "Colourless" }] },
    { key: "mono", label: "Mono", note: "one colour",
      identities: [
        { code: "W", name: "White" }, { code: "U", name: "Blue" },
        { code: "B", name: "Black" }, { code: "R", name: "Red" },
        { code: "G", name: "Green" }] },
    { key: "allied", label: "Allied pairs", note: "neighbours on the wheel",
      identities: [
        { code: "WU", name: "Azorius" }, { code: "UB", name: "Dimir" },
        { code: "BR", name: "Rakdos" }, { code: "RG", name: "Gruul" },
        { code: "WG", name: "Selesnya" }] },
    { key: "enemy", label: "Enemy pairs", note: "opposites on the wheel",
      identities: [
        { code: "WB", name: "Orzhov" }, { code: "UR", name: "Izzet" },
        { code: "BG", name: "Golgari" }, { code: "WR", name: "Boros" },
        { code: "UG", name: "Simic" }] },
    { key: "shards", label: "Shards", note: "a colour and both its allies",
      identities: [
        { code: "WUB", name: "Esper" }, { code: "UBR", name: "Grixis" },
        { code: "BRG", name: "Jund" }, { code: "WRG", name: "Naya" },
        { code: "WUG", name: "Bant" }] },
    { key: "wedges", label: "Wedges", note: "a colour and both its enemies",
      identities: [
        { code: "WBG", name: "Abzan" }, { code: "WUR", name: "Jeskai" },
        { code: "UBG", name: "Sultai" }, { code: "WBR", name: "Mardu" },
        { code: "URG", name: "Temur" }] },
    { key: "four", label: "Four colours", note: "named for the colour they lack",
      identities: [
        { code: "WUBR", name: "Yore-Tiller" }, { code: "UBRG", name: "Glint-Eye" },
        { code: "WBRG", name: "Dune-Brood" }, { code: "WURG", name: "Ink-Treader" },
        { code: "WUBG", name: "Witch-Maw" }] },
    { key: "five", label: "Five colours", note: "every colour",
      identities: [{ code: "WUBRG", name: "WUBRG" }] },
  ];

  var ALL_IDENTITIES = GROUPS.reduce(function (acc, g) {
    return acc.concat(g.identities.map(function (i) { return i.code; }));
  }, []);

  function canonicalIdentity(colors) {
    var set = {};
    String(colors).split("").forEach(function (c) { set[c] = true; });
    return WUBRG.split("").filter(function (c) { return set[c]; }).join("");
  }

  // Case-, punctuation- and apostrophe-insensitive form used for all matching.
  // "Eshki Fate's" -> "eshki fates"; "Zada, Hedron Grinder" -> "zada hedron grinder".
  function normalize(s) {
    return String(s).toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // commanders: [[name, identity, pairable, backFaceName?], ...] from
  // commanders.json. A back-face name ("Esper Terra") is an alias: it
  // matches and completes, but always resolves to the front-face entry.
  function buildIndex(commanders) {
    var list = [];
    var aliases = [];
    commanders.forEach(function (row) {
      var entry = { name: row[0], identity: row[1], pairable: !!row[2],
                    norm: normalize(row[0]) };
      list.push(entry);
      if (row[3]) {
        aliases.push({ name: row[3], norm: normalize(row[3]), entry: entry });
      }
    });
    var byNorm = {};
    list.forEach(function (c) { byNorm[c.norm] = c; });
    aliases.forEach(function (a) {
      if (!byNorm[a.norm]) byNorm[a.norm] = a.entry;
    });
    return { list: list, aliases: aliases, byNorm: byNorm };
  }

  // Resolve a query to a commander. Exact normalized match wins; otherwise a
  // word-boundary prefix ("zurzoth" matches "zurzoth chaos rider" but "esika"
  // does not match "esikas chariot"). Returns:
  //   {match}                 unique hit
  //   {ambiguous: [...]}      several hits, caller disambiguates
  //   null                    nothing
  function matchName(index, query) {
    var nq = normalize(query);
    if (!nq) return null;
    var exact = index.byNorm[nq];
    if (exact) return { match: exact };
    var hits = index.list.filter(function (c) {
      return c.norm.indexOf(nq + " ") === 0;
    });
    if (hits.length === 1) return { match: hits[0] };
    if (hits.length > 1) {
      // Several names, one answer: when every candidate has the same colour
      // identity and pair-capability, the grid slot is determined — resolve
      // to the query as typed instead of making the user pick ("Eshki"
      // matches two Eshkis, both Temur).
      var uniform = hits.every(function (c) {
        return c.identity === hits[0].identity &&
               c.pairable === hits[0].pairable;
      });
      if (uniform) {
        return { match: { name: String(query).trim(),
                          identity: hits[0].identity,
                          pairable: hits[0].pairable } };
      }
      return { ambiguous: hits };
    }
    // Back-face aliases are a fallback so they can never shadow a real
    // front-face name.
    var aliasHits = index.aliases.filter(function (a) {
      return a.norm.indexOf(nq + " ") === 0;
    });
    var entries = {};
    aliasHits.forEach(function (a) { entries[a.entry.name] = a.entry; });
    var names = Object.keys(entries);
    if (names.length === 1) return { match: entries[names[0]] };
    if (names.length > 1) {
      return { ambiguous: names.map(function (n) { return entries[n]; }) };
    }
    return null;
  }

  // Shell-style completion for the UI: the full name when exactly one
  // commander (or back-face alias) starts with the typed text — partial
  // words allowed, so "esper" completes where matchName would not resolve.
  function completePrefix(index, typed) {
    var nq = normalize(typed);
    if (!nq) return null;
    var names = {};
    index.list.forEach(function (c) {
      if (c.norm.indexOf(nq) === 0) names[c.name] = true;
    });
    index.aliases.forEach(function (a) {
      if (a.norm.indexOf(nq) === 0) names[a.name] = true;
    });
    var hits = Object.keys(names);
    return hits.length === 1 ? hits[0] : null;
  }

  // Longest-prefix resolution of a free-form line: try the whole line as a
  // name, then keep dropping trailing words; whatever fell off is the deck
  // name. An ambiguous hit at the longest matching length is surfaced rather
  // than silently shortened past.
  function matchLine(index, line) {
    var words = line.trim().split(/\s+/);
    var firstAmbiguous = null;
    for (var k = words.length; k >= 1; k--) {
      var q = words.slice(0, k).join(" ");
      var r = matchName(index, q);
      if (r && r.match) {
        return { match: r.match, rest: words.slice(k).join(" ") };
      }
      if (r && r.ambiguous && !firstAmbiguous) {
        firstAmbiguous = { ambiguous: r.ambiguous, query: q,
                           rest: words.slice(k).join(" ") };
      }
    }
    return firstAmbiguous;
  }

  var TIER_RE = /^([0-9]{1,2})\s*(\^|v|V|↑|↓)?$/;

  function parseTierMarker(line) {
    var m = TIER_RE.exec(line.trim());
    if (!m) return null;
    var mod = m[2] ? (m[2] === "^" || m[2] === "↑" ? "^" : "v") : "";
    return m[1] + mod;
  }

  function tierRank(tier) {
    if (!tier) return -Infinity;
    var m = TIER_RE.exec(tier);
    if (!m) return -Infinity;
    var v = parseInt(m[1], 10);
    if (m[2] === "^" || m[2] === "↑") v += 0.25;
    else if (m[2]) v -= 0.25;
    return v;
  }

  function tierLabel(tier) {
    return tier ? tier.replace("^", "↑").replace("v", "↓") : "";
  }

  function stripDeckName(rest) {
    return rest.replace(/^[\s/|.—-]+/, "").trim();
  }

  // {Category} anywhere on a line names the box the deck belongs in. It is
  // lifted out before any name matching so braces can sit wherever the user
  // finds them readable — "Atraxa {Casual} Superfriends" and
  // "Atraxa Superfriends {Casual}" are the same deck in the same box.
  function extractCategory(line) {
    var found = "";
    var stripped = String(line).replace(/\{([^{}]*)\}/g, function (_, inner) {
      if (!found) found = inner.trim();
      return " ";
    });
    return { line: stripped.replace(/\s+/g, " ").trim(), category: found };
  }

  // [WUBRG] anywhere on a line overrides the deck's colour identity outright:
  // "Zada, Hedron Grinder [G] Forest Queen" files a mono-red commander in the
  // mono-green slot. Lifted before name matching like {Category}, and only
  // when the brackets hold nothing but colour letters — "[my pet deck]" stays
  // in the line so bracketed deck names survive. [C] and [] mean colourless.
  function extractIdentity(line) {
    var found = null;
    var stripped = String(line).replace(/\[([^\[\]]*)\]/g, function (whole, inner) {
      var body = inner.trim();
      if (found !== null || !/^[wubrgc]*$/i.test(body)) return whole;
      found = canonicalIdentity(body.toUpperCase().replace(/C/g, ""));
      return " ";
    });
    return { line: stripped.replace(/\s+/g, " ").trim(), identity: found };
  }

  // Parse one deck line into {commanders: [entry,...], deckName, warnings} or
  // {unresolved} / {ambiguous}. Explicit "|" separates commander part from
  // deck name; "/", " + ", " & " separate an explicit pair; an implicit pair
  // ("Ikra Ardenn") is recognised only when both halves are pair-capable.
  function parseDeckLine(index, raw) {
    var line = raw.trim();
    var deckName = "";
    var explicitName = line.indexOf("|") !== -1;
    if (explicitName) {
      var cut = line.split("|");
      line = cut[0].trim();
      deckName = cut.slice(1).join("|").trim();
    }

    // Explicit pair: try the first separator occurrence; fall back to a solo
    // read when the left side is not a commander ("Zurgo Stormrender N/A").
    var sep = /\s*(?:\/\/|\/|\+|&)\s*/.exec(line);
    if (sep) {
      var left = line.slice(0, sep.index);
      var right = line.slice(sep.index + sep[0].length);
      var lm = matchName(index, left);
      if (lm && lm.match) {
        var rm = matchLine(index, right);
        if (rm && rm.match) {
          var warnings = [];
          if (!lm.match.pairable || !rm.match.pairable) {
            warnings.push("not a known partner/background pairing");
          }
          return { commanders: [lm.match, rm.match],
                   deckName: deckName || stripDeckName(rm.rest),
                   warnings: warnings };
        }
        if (rm && rm.ambiguous) {
          return { ambiguous: rm.ambiguous, query: rm.query, raw: raw,
                   rest: rm.rest };
        }
        return { unresolved: true, raw: raw };
      }
      if (lm && lm.ambiguous) {
        return { ambiguous: lm.ambiguous, query: left, raw: raw, rest: right };
      }
      // fall through to solo parse
    }

    var r = matchLine(index, line);
    if (!r) return { unresolved: true, raw: raw };
    if (r.ambiguous) {
      return { ambiguous: r.ambiguous, query: r.query, raw: raw, rest: r.rest };
    }

    // Implicit pair: "Ikra Ardenn" — only when both halves are pair-capable,
    // so deck names never get eaten behind a non-partner commander.
    if (r.match.pairable && r.rest) {
      var p = matchLine(index, r.rest);
      if (p && p.match && p.match.pairable) {
        return { commanders: [r.match, p.match],
                 deckName: deckName || stripDeckName(p.rest), warnings: [] };
      }
    }
    return { commanders: [r.match],
             deckName: deckName || stripDeckName(r.rest), warnings: [] };
  }

  // Parse the whole paste. Lines that are bare tier markers (5, 4, 3^, 3v)
  // set the tier for the lines after them. Returns:
  //   decks:      [{names, identity, deckName, tier, warnings, lineIndex}]
  //   problems:   [{kind: "unresolved"|"ambiguous", raw, lineIndex, candidates?, query?}]
  function parseList(index, text) {
    var decks = [];
    var problems = [];
    var tier = "";
    String(text).split(/\r?\n/).forEach(function (raw, i) {
      var lifted = extractCategory(raw);
      var forced = extractIdentity(lifted.line);
      var line = forced.line;
      if (!line) return;
      var marker = parseTierMarker(line);
      if (marker !== null) { tier = marker; return; }
      var r = parseDeckLine(index, line);
      if (r.commanders) {
        var identity = forced.identity !== null ? forced.identity
          : canonicalIdentity(r.commanders.map(function (c) {
              return c.identity;
            }).join(""));
        decks.push({
          names: r.commanders.map(function (c) { return c.name; }),
          identity: identity,
          deckName: r.deckName,
          tier: tier,
          category: lifted.category,
          warnings: r.warnings,
          lineIndex: i,
        });
      } else if (r.ambiguous) {
        problems.push({ kind: "ambiguous", raw: raw, lineIndex: i,
                        query: r.query, candidates: r.ambiguous,
                        category: lifted.category, override: forced.identity,
                        rest: stripDeckName(r.rest || "") });
      } else {
        problems.push({ kind: "unresolved", raw: raw, lineIndex: i,
                        category: lifted.category, override: forced.identity });
      }
    });
    return { decks: decks, problems: problems };
  }

  // Slot assembly: every identity gets a slot; decks sort by tier, best first.
  function buildSlots(decks) {
    var byIdentity = {};
    ALL_IDENTITIES.forEach(function (id) { byIdentity[id] = []; });
    decks.forEach(function (d) {
      if (byIdentity[d.identity]) byIdentity[d.identity].push(d);
    });
    return ALL_IDENTITIES.map(function (id) {
      var entries = byIdentity[id].slice().sort(function (a, b) {
        return tierRank(b.tier) - tierRank(a.tier);
      });
      return { identity: id, decks: entries, filled: entries.length > 0 };
    });
  }

  // Box assembly: one box per {category}, in the order the categories first
  // appear in the list — the user's own ordering is the only sensible one, and
  // it survives editing. Decks with no category collect in a trailing box so
  // a half-labelled list still shows everything.
  function buildBoxes(decks) {
    var order = [];
    var byLabel = {};
    decks.forEach(function (d) {
      var label = d.category || "";
      if (!byLabel[label]) { byLabel[label] = []; order.push(label); }
      byLabel[label].push(d);
    });
    order.sort(function (a, b) {
      // Uncategorised last; everything else keeps first-appearance order.
      if ((a === "") !== (b === "")) return a === "" ? 1 : -1;
      return 0;
    });
    return order.map(function (label) {
      var entries = byLabel[label].slice().sort(function (a, b) {
        return tierRank(b.tier) - tierRank(a.tier);
      });
      var seen = {};
      entries.forEach(function (d) { seen[d.identity] = true; });
      return { label: label, decks: entries,
               identities: Object.keys(seen).length };
    });
  }

  // ---- share-URL codec ----------------------------------------------------
  // The list rides in the URL hash. Deflate + base64url ("z=" prefix) keeps
  // links short and free of %20 noise; plain percent-encoded hashes (the
  // original format, and the fallback where CompressionStream is missing)
  // still decode, so old links keep working.

  function toBase64Url(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromBase64Url(s) {
    var bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function pipeThrough(bytes, stream) {
    var writer = stream.writable.getWriter();
    // Failures surface on the read side; unhandled writer rejections would
    // crash node before the reader's catch ever ran.
    function ignore() {}
    writer.write(bytes).catch(ignore);
    writer.close().catch(ignore);
    return new Response(stream.readable).arrayBuffer().then(function (buf) {
      return new Uint8Array(buf);
    });
  }

  // -> Promise<string>: the hash payload (without the leading "#").
  function encodeShare(text) {
    if (typeof CompressionStream === "undefined") {
      return Promise.resolve(encodeURIComponent(text));
    }
    var bytes = new TextEncoder().encode(text);
    return pipeThrough(bytes, new CompressionStream("deflate"))
      .then(function (out) { return "z=" + toBase64Url(out); });
  }

  // -> Promise<string>: the list text, from either hash format.
  function decodeShare(hash) {
    if (hash.indexOf("z=") !== 0) {
      try { return Promise.resolve(decodeURIComponent(hash)); }
      catch (e) { return Promise.resolve(""); }
    }
    if (typeof DecompressionStream === "undefined") {
      return Promise.resolve("");
    }
    try {
      var bytes = fromBase64Url(hash.slice(2));
      return pipeThrough(bytes, new DecompressionStream("deflate"))
        .then(function (out) { return new TextDecoder().decode(out); })
        .catch(function () { return ""; });
    } catch (e) {
      return Promise.resolve("");
    }
  }

  var T32 = {
    GROUPS: GROUPS,
    ALL_IDENTITIES: ALL_IDENTITIES,
    canonicalIdentity: canonicalIdentity,
    normalize: normalize,
    buildIndex: buildIndex,
    matchName: matchName,
    matchLine: matchLine,
    completePrefix: completePrefix,
    parseTierMarker: parseTierMarker,
    tierRank: tierRank,
    tierLabel: tierLabel,
    parseList: parseList,
    buildSlots: buildSlots,
    buildBoxes: buildBoxes,
    extractCategory: extractCategory,
    extractIdentity: extractIdentity,
    stripDeckName: stripDeckName,
    encodeShare: encodeShare,
    decodeShare: decodeShare,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = T32;
  else root.T32 = T32;
})(this);
