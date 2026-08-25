const fs = require("fs");

/* ---------- 1. server: /api/instruments + subscribe unsubscribe ---------- */
{
  const p = "src/server/bullionai-api.js";
  let s = fs.readFileSync(p, "utf8");
  const NL = "\r\n";

  if (!s.includes("/api/instruments")) {
    const anchor = 'url.pathname === "/api/symbols"';
    const i = s.indexOf(anchor);
    if (i < 0) { console.log("MISS symbols route"); process.exit(1); }
    // insert before this whole if-block: find preceding blank line
    let st = s.lastIndexOf("\n\r\n", i);
    st = st < 0 ? i : st;
    const route = [
      '        if (',
      '            url.pathname === "/api/instruments"',
      '        ) {',
      '',
      '            const exch =',
      '                url.searchParams.get("exchange") || "MCX";',
      '',
      '            const q =',
      '                url.searchParams.get("q") || "";',
      '',
      '            const limit =',
      '                Math.min(200, Number(url.searchParams.get("limit")) || 100);',
      '',
      '            try {',
      '',
      '                let rows = await searchSymbols({',
      '                    query: q,',
      '                    exchange: exch,',
      '                    limit: q ? limit : limit,',
      '                });',
      '',
      '                /* Registry endpoint returns the CURRENT-CONTRACT list */',
      '',
      '                this.sendJson(response, 200, {',
      '                    ok: true,',
      '                    exchange: exch.toUpperCase(),',
      '                    count: rows.length,',
      '                    instruments: rows.map(r => ({',
      '                        exchange: r.exchange,',
      '                        token: r.token,',
      '                        symbol: r.symbol,',
      '                        tradingSymbol: r.tsym || r.tradingSymbol,',
      '                        instrumentType: r.instrumentType,',
      '                        expiry: r.expiry ?? null,',
      '                        lotSize: r.lotSize,',
      '                        tickSize: r.tickSize,',
      '                    })),',
      '                });',
      '',
      '            } catch (error) {',
      '                this.sendJson(response, 500, {',
      '                    ok: false,',
      '                    error: error?.message || String(error),',
      '                });',
      '            }',
      '            return;',
      '        }',
      NL,
    ].join("");
    s = s.slice(0, st) + route + s.slice(st);
    console.log("instruments route added");
  }

  /* subscribe route: support unsubscribe list */
  if (!s.includes("unsubscribeTokens")) {
    s = s.replace(
      /(const market = this\.coordinator\?\.market;\r?\n\s*if \(market\?\.subscribeTokens\) \{\r?\n\s*market\.subscribeTokens\(\[\{ exch, token \}\]\);\r?\n\s*\}\)/,
      `const market = this.coordinator?.market;\r\n                if (market?.subscribeTokens) {\r\n                    market.subscribeTokens([{ exch, token }]);\r\n                }\r\n                const prev = body.unsubscribe;\r\n                if (\r\n                    market?.unsubscribeTokens &&\r\n                    Array.isArray(prev)\r\n                ) {\r\n                    market.unsubscribeTokens(prev);\r\n                }`
    );
    console.log("subscribe route: unsubscribe wired");
  }
}

/* ---------- 2. live-market-state: unsubscribeTokens ---------- */
{
  const p = "src/market/live-market-state.js";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("unsubscribeTokens")) {
    const anchor = "this.emitUpdate();";
    // append method after subscribeTokens' closing emitUpdate
    const i = s.indexOf(anchor);
    if (i < 0) { console.log("MISS lms anchor"); process.exit(1); }
    const insAt = i + anchor.length;
    const method = [
      "",
      "",
      "    unsubscribeTokens(pairs) {",
      "",
      "        const subs = [];",
      "",
      "        pairs.forEach(({ exch, token }) => {",
      "",
      "            const EX = String(exch || this.exchange).toUpperCase();",
      "",
      "            subs.push(EX + \"|\" + token);",
      "",
      "            /* keep price state for history; stop is feed-level only */",
      "        });",
      "",
      "        try {",
      "            this.feed.unsubscribeTouchline(subs);",
      "        } catch (error) {",
      '            console.error(',
      '                "Runtime unsubscribe failed:",',
      "                error?.message || error",
      "            );",
      "        }",
    ].join("\r\n");
    s = s.slice(0, insAt) + method + s.slice(insAt);
    fs.writeFileSync(p, s);
    console.log("unsubscribeTokens added");
  }
}

/* ---------- 3. lib: getInstruments ---------- */
{
  const p = "frontend/src/lib/bullionai-api.ts";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("getInstruments")) {
    s += `
export type InstrumentEntry = {
  exchange: string;
  token: string;
  symbol: string;
  tradingSymbol: string;
  instrumentType: string;
  expiry: number | null;
  lotSize: number | null;
  tickSize: number | null;
};

export async function getInstruments(
  exchange: string,
  q = ""
): Promise<InstrumentEntry[]> {
  const u = new URL(API_BASE + "/api/instruments");
  u.searchParams.set("exchange", exchange);
  if (q) u.searchParams.set("q", q);
  const r = await fetch(u);
  const d = await r.json();
  return (d.instruments || []) as InstrumentEntry[];
}
`;
    fs.writeFileSync(p, s);
    console.log("lib getInstruments added");
  }
}

/* ---------- 4. subscribe helper accepts prev for unsubscription ---------- */
{
  const p = "frontend/src/lib/bullionai-api.ts";
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(
    /export async function subscribeSymbol\(sym: \{\s*\r?\n\s*exch: string;\s*\r?\n\s*token: string;\s*\r?\n\s*tsym: string;\s*\r?\n?\s*\}\) \{\s*\r?\n\s*await fetch\(API_BASE \+ "\/api\/subscribe", \{\s*\r?\n\s*method: "POST",\s*\r?\n\s*headers: \{ "Content-Type": "application\/json" \},\s*\r?\n\s*body: JSON\.stringify\(sym\),\s*\r?\n\s*\}\)\.catch\(\(\) => \{\}\);/,
    `export async function subscribeSymbol(
  sym: { exch: string; token: string; tsym: string },
  unsubscribe?: Array<{ exch: string; token: string }>
) {
  await fetch(API_BASE + "/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...sym,
      unsubscribe: unsubscribe || [],
    }),
  }).catch(() => {});
}`
  );
  fs.writeFileSync(p, s);
  console.log("subscribeSymbol extended");
}
