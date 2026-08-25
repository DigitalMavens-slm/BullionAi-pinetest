const fs = require("fs");
const path = require("path");

/* =========================================================
   A. BACKEND: name-map fallback to NSE for any exchange
      (so BSE picks up company names of dual-listed stocks)
   ========================================================= */
{
  const p = path.resolve(__dirname, "..", "src", "market", "symbol-master.js");
  let s = fs.readFileSync(p, "utf8");

  if (!s.includes("FALLBACK: dual-listed")) {
    const oldAuto =
      `    if (
        !fs.existsSync(f) &&
        exch === "NSE"
    ) {`;
    const newAuto =
      `    /* FALLBACK: dual-listed companies share names across
       * NSE/BSE — reuse the NSE name file when needed. */
    const useNseFallback =
        !fs.existsSync(f) && exch !== "NSE";

    if (
        !fs.existsSync(f) &&
        exch === "NSE"
    ) {`;

    if (!s.includes(oldAuto)) { console.log("MISS auto block"); process.exit(1); }
    s = s.replace(oldAuto, newAuto);

    // after NSE download block closes, load NSE map into fallback
    const anchor2 =
      `    } catch {
        // offline — continue without names
    }`;
    if (!s.includes(anchor2)) { console.log("MISS catch anchor"); process.exit(1); }
    s = s.replace(
      anchor2,
      anchor2 + `\n\n    if (useNseFallback) {\n        return nameCache.get("NSE") || {};\n    }`
    );

    fs.writeFileSync(p, s);
    console.log("backend name fallback added");
  }
}

/* =========================================================
   B. FRONTEND: server-backed search once user types
   ========================================================= */
{
  const p = path.resolve(__dirname, "..", "frontend", "src", "components", "SymbolSearch.tsx");
  let s = fs.readFileSync(p, "utf8");

  // import lib helper
  if (!s.includes("getInstruments")) {
    s = s.replace(
      /(import \{\s*\r?\n?\s*Loader2,\s*\r?\n?\s*Plus,\s*\r?\n?\s*Search,\s*\r?\n?\s*\} from "lucide-react";)/,
      `$1\nimport { getInstruments } from "../lib/bullionai-api";`
    );
  }

  // replace the bulk-load-only effect with hybrid:
  //   - bulk 200 for instant browse
  //   - debounced server search when filter has >= 2 chars
  const oldFxStart = s.indexOf("  /* Load CURRENT-CONTRACT list on exchange change */");
  if (oldFxStart < 0) { console.log("MISS fx comment"); process.exit(1); }

  // find end of that effect: the closing "  }, [exchange]);"
  const endTok = "  }, [exchange]);";
  const endIdx = s.indexOf(endTok, oldFxStart);
  if (endIdx < 0) { console.log("MISS fx end"); process.exit(1); }

  const newEffect = [
    "  /* Load CURRENT-CONTRACT list on exchange change,\n     * plus server-backed search once you type */",
    "  useEffect(() => {",
    "    let cancelled = false;",
    "",
    "    setLoading(true);",
    "",
    "    getInstruments(exchange)",
    "      .then(rows => {",
    "        if (!cancelled) setInstruments(rows);",
    "      })",
    "      .catch(() => {})",
    "      .finally(() => {",
    "        if (!cancelled) setLoading(false);",
    "      });",
    "",
    "    return () => {",
    "      cancelled = true;",
    "    };",
    "  }, [exchange]);",
    "",
    "  useEffect(() => {",
    "    const term = filter.trim();",
    "    if (term.length < 2) return;",
    "",
    "    let cancelled = false;",
    "    setLoading(true);",
    "",
    "    getInstruments(exchange, term)",
    "      .then(rows => {",
    "        if (!cancelled) setInstruments(rows);",
    "      })",
    "      .catch(() => {})",
    "      .finally(() => {",
    "        if (!cancelled) setLoading(false);",
    "      });",
    "",
    "    return () => {",
    "      cancelled = true;",
    "    };",
    "  }, [filter, exchange]);",
  ].join("\n");

  s = s.slice(0, oldFxStart) + newEffect + s.slice(endIdx + endTok.length);

  // local filter should NOT double-filter server results while searching;
  // treat `visible` as instruments directly
  s = s.replace(
    /const visible =\s*\r?\n?\s*filter\.trim\(\)\s*\r?\n?\s*\? instruments\.filter\(i =>[\s\S]*?\)\s*\r?\n?\s*: instruments;/,
    "const visible = instruments;"
  );

  fs.writeFileSync(p, s);
  console.log("frontend hybrid search wired");
}
