import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Plus, Search } from "lucide-react";
import { getInstruments } from "../lib/bullionai-api";

export type SelectedSymbol = {
  exch: string;
  token: string;
  tsym: string;
  label?: string;
  tickSize?: number | null;
};

type Entry = {
  exchange?: string;
  token?: string;
  tradingSymbol?: string;
  symbol?: string;
  lotSize?: number | null;
  tickSize?: number | null;
  name?: string;
};

const EXCHANGES = ["MCX", "NSE", "BSE", "COMEX"];


export function InstrumentPicker({
  onAdd,
}: {
  onAdd: (s: SelectedSymbol) => void;
}) {
  const [exchange, setExchange] = useState("MCX");
  const [instruments, setInstruments] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  function updatePos() {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }

  useEffect(() => {
    const term = q.trim();

    let cancelled = false;
    setLoading(true);

    /* Debounced SERVER search — covers every company name,
       not just the first page of the registry */

    const t = window.setTimeout(async () => {
      try {
        const rows = await getInstruments(
          exchange,
          term.length >= 2 ? term : ""
        );
        if (!cancelled) {
          setInstruments(rows);
        }
      } catch {
        if (!cancelled) setInstruments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, exchange]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      const inBox = boxRef.current?.contains(t);
      const inList = listRef.current?.contains(t);
      if (!inBox && !inList) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    function rp() {
      if (open) updatePos();
    }
    window.addEventListener("scroll", rp, true);
    window.addEventListener("resize", rp);
    return () => {
      window.removeEventListener("scroll", rp, true);
      window.removeEventListener("resize", rp);
    };
  }, [open]);

  const visible =
    q.trim()
      ? instruments.filter(
          i =>
            (i.tradingSymbol || "").toUpperCase().includes(q.trim().toUpperCase()) ||
            (i.name || "").toUpperCase().includes(q.trim().toUpperCase())
        )
      : instruments;

  function displayName(i: Entry) {
    return i.exchange === "MCX"
      ? i.symbol || i.tradingSymbol
      : i.tradingSymbol;
  }

  function add(i: Entry) {
    const exch = i.exchange || exchange;
    const tsym = i.tradingSymbol || "";
    onAdd({
      exch,
      token: i.token || "",
      tsym,
      label: displayName(i),
      tickSize: i.tickSize ?? null,
    });
    setOpen(false);
    setQ("");
  }

  return (
    <div className="flex w-full items-center gap-2">
      {/* EXCHANGE */}
      <select
        value={exchange}
        onChange={e => setExchange(e.target.value)}
        className="w-[96px] shrink-0 cursor-pointer rounded-xl border border-slate-300 bg-white px-2 py-2 text-[12px] font-bold uppercase tracking-wider text-slate-700 outline-none transition focus:border-amber-400"
      >
        {EXCHANGES.map(e => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>

      {/* SCRIPT SEARCH */}
      <div ref={boxRef} className="relative min-w-0 flex-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onFocus={() => {
              updatePos();
              setOpen(true);
            }}
            onChange={e => {
              setQ(e.target.value);
              updatePos();
              setOpen(true);
            }}
            placeholder={`Search ${exchange}…`}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-[12px] font-medium outline-none transition placeholder:text-slate-400 focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-300" />
          )}
        </div>

        {open &&
          createPortal(
            <div
              ref={listRef}
              onMouseDown={e => e.preventDefault()}
              className="fixed z-[90] max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-[0_18px_50px_-16px_rgba(15,23,42,0.45)]"
              style={
                pos
                  ? { top: pos.top, left: pos.left, width: pos.width }
                  : { display: "none" }
              }
            >
              {visible.length === 0 && !loading && (
                <div className="px-4 py-6 text-center text-[11px] font-medium text-slate-400">
                  {q ? "No matches" : "Loading contracts…"}
                </div>
              )}

              {visible.map(raw => {
                const exch = raw.exchange || exchange;
                return (
                  <div
                    key={exch + "-" + raw.token}
                    className="group flex w-full items-center gap-2 px-3 py-2 transition hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate font-mono text-[12px] font-semibold text-slate-800">
                        {displayName({ ...raw, exchange: exch })}
                      </span>
                      {exch !== "MCX" && raw.name && (
                        <span className="block truncate text-[9.5px] font-medium text-slate-400">
                          {raw.name}
                        </span>
                      )}
                    </span>

                    {raw.lotSize != null && (
                      <span className="shrink-0 text-[9px] font-medium text-slate-400">
                        lot {raw.lotSize}
                      </span>
                    )}

                    <button
                      title="Add to watchlist"
                      onClick={() => add(raw)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
