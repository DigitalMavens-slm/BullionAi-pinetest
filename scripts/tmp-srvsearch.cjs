const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "frontend", "src", "components", "SymbolSearch.tsx");
let s = fs.readFileSync(p, "utf8");

/* Replace the exchange-only load effect with a debounced
   SERVER-side search so typing searches the ENTIRE registry
   (company names included), not just the first 200 rows. */

const startTok = "  /* Load CURRENT-CONTRACT list on exchange change */";
let start = s.indexOf(startTok);
if (start < 0) { console.log("MISS start"); process.exit(1); }

const endTok = "  }, [exchange]);";
const end = s.indexOf(endTok, start);
if (end < 0) { console.log("MISS end"); process.exit(1); }

const newEffect = [
  "  /* Debounced SERVER search — covers every company name,\n   * not just the first page of the registry */",
  "  useEffect(() => {",
  "    const term = q.trim();",
    "",
  "    let cancelled = false;",
  "    setLoading(true);",
  "",
  "    const t = window.setTimeout(async () => {",
  "      try {",
  "        const rows = await getInstruments(",
  "          exchange,",
  "          term.length >= 2 ? term : \"\"",
  "        );",
  "        if (!cancelled) {",
  "          setInstruments(rows);",
  "          setToken(\"\");",
  "        }",
  "      } catch {",
  "        if (!cancelled) setInstruments([]);",
  "      } finally {",
  "        if (!cancelled) setLoading(false);",
  "      }",
  "    }, 250);",
  "",
  "    return () => {",
  "      cancelled = true;",
  "      window.clearTimeout(t);",
  "    };",
  "  }, [q, exchange]);",
].join("\r\n");

s = s.slice(0, start) + newEffect + s.slice(end);

/* remove the now-duplicated local filter (server already filtered)
   — keep it harmless: it still narrows within returned rows */
fs.writeFileSync(p, s);
console.log("server-backed typing search installed");
