import { useEffect, useState } from "react";
import StockCard from "./components/StockCard";

export default function App() {
  const [stocks, setStocks] = useState(() => {
    const v =
      typeof window !== "undefined" ? localStorage.getItem("stocks") : null;
    try {
      const parsed = v ? JSON.parse(v) : ["RELIANCE"];
      // Migrate: if array of strings, convert to objects
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return parsed.map((s) => {
          const sym = String(s || "")
            .toUpperCase()
            .trim();
          return {
            id: `${sym}`,
            symbol: sym,
            instrumentKey: sym, // fallback: user can store full key here later
          };
        });
      }
      // Ensure each object has id, symbol, instrumentKey
      if (
        Array.isArray(parsed) &&
        parsed.every((x) => typeof x === "object" && x)
      ) {
        return parsed.map((o) => ({
          id:
            o.id ||
            `${(o.instrumentKey || o.symbol || "").toUpperCase().trim()}`,
          symbol: String(o.symbol || o.instrumentKey || "")
            .toUpperCase()
            .trim(),
          instrumentKey: String(o.instrumentKey || o.symbol || "")
            .toUpperCase()
            .trim(),
        }));
      }
      return [
        {
          id: "RELIANCE",
          symbol: "RELIANCE",
          instrumentKey: "NSE_EQ|RELIANCE",
        },
      ];
    } catch {
      return [
        {
          id: "RELIANCE",
          symbol: "RELIANCE",
          instrumentKey: "NSE_EQ|RELIANCE",
        },
      ];
    }
  });
  const [newStockSymbol, setNewStockSymbol] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [capitalTotal, setCapitalTotal] = useState(() => {
    const v =
      typeof window !== "undefined"
        ? localStorage.getItem("capitalTotal")
        : null;
    return v ? Number(v) : 10000;
  });
  const [leverage, setLeverage] = useState(() => {
    const v =
      typeof window !== "undefined" ? localStorage.getItem("leverage") : null;
    return v ? Number(v) : 5;
  });
  const [targetPct, setTargetPct] = useState(() => {
    const v =
      typeof window !== "undefined" ? localStorage.getItem("targetPct") : null;
    return v ? Number(v) : 1;
  });
  const [slPct, setSlPct] = useState(() => {
    const v =
      typeof window !== "undefined" ? localStorage.getItem("slPct") : null;
    return v ? Number(v) : 0.5;
  });
  const [theme, setTheme] = useState(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved === "light" || saved === "dark") return saved;
    // Prefer system
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const openSettings = () => setShowSettings(true);
  const closeSettings = () => setShowSettings(false);

  const addStock = (symRaw) => {
    const sym = String(symRaw || "")
      .toUpperCase()
      .trim();
    if (!sym) return;
    const id = `${sym}`;
    setStocks((prev) => {
      const list = prev || [];
      // prevent duplicates by symbol/instrumentKey
      if (list.some((x) => (x.instrumentKey || x.symbol) === sym)) return list;
      return [...list, { id, symbol: sym, instrumentKey: sym }];
    });
    setNewStockSymbol("");
  };
  const removeStock = (id) => {
    setStocks((prev) => (prev || []).filter((s) => s.id !== id));
  };

  useEffect(() => {
    localStorage.setItem("capitalTotal", String(capitalTotal || 0));
  }, [capitalTotal]);

  useEffect(() => {
    localStorage.setItem("leverage", String(leverage || 1));
  }, [leverage]);
  useEffect(() => {
    localStorage.setItem("targetPct", String(targetPct || 0));
  }, [targetPct]);
  useEffect(() => {
    localStorage.setItem("slPct", String(slPct || 0));
  }, [slPct]);

  useEffect(() => {
    try {
      localStorage.setItem("stocks", JSON.stringify(stocks || []));
    } catch {}
  }, [stocks]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zerodha Live</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={openSettings}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-100 dark:ring-slate-700 dark:hover:bg-slate-900"
            aria-label="Open settings"
            title="Settings"
          >
            {/* Gear icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M11.078 2.25c-.917 0-1.699.663-1.83 1.57l-.155 1.073a8.286 8.286 0 0 0-1.862 1.076l-1.018-.508a1.875 1.875 0 0 0-2.5.819l-.997 1.726a1.875 1.875 0 0 0 .444 2.361l.86.744a8.445 8.445 0 0 0 0 2.152l-.86.744a1.875 1.875 0 0 0-.444 2.36l.997 1.727a1.875 1.875 0 0 0 2.5.818l1.018-.508c.57.45 1.196.823 1.862 1.076l.155 1.073c.131.907.913 1.57 1.83 1.57h1.844c.917 0 1.699-.663 1.83-1.57l.155-1.073a8.286 8.286 0 0 0 1.862-1.076l1.018.508a1.875 1.875 0 0 0 2.5-.819l.997-1.726a1.875 1.875 0 0 0-.444-2.361l-.86-.744a8.445 8.445 0 0 0 0-2.152l.86-.744c.708-.612.893-1.644.444-2.36l-.997-1.727a1.875 1.875 0 0 0-2.5-.818l-1.018.508a8.286 8.286 0 0 0-1.862-1.076l-.155-1.073a1.875 1.875 0 0 0-1.83-1.57h-1.844Zm-.078 9.75a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0Z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-100 dark:ring-slate-700 dark:hover:bg-slate-900"
            aria-label="Toggle theme"
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? (
              // Sun icon for light mode
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
                <path
                  fillRule="evenodd"
                  d="M12 2.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75Zm0 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm9-6.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5H20.25a.75.75 0 0 1 .75.75ZM6 12a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1 0-1.5H5.25A.75.75 0 0 1 6 12Zm11.78 7.03a.75.75 0 0 1-1.06 0l-1.06-1.06a.75.75 0 1 1 1.06-1.06l1.06 1.06c.29.29.29.77 0 1.06ZM8.32 7.09a.75.75 0 0 1-1.06 0L6.2 6.03A.75.75 0 0 1 7.26 4.97l1.06 1.06c.29.29.29.77 0 1.06Zm9.46-2.12a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM7.26 17.97a.75.75 0 0 1 0-1.06l1.06-1.06a.75.75 0 0 1 1.06 1.06L8.32 17.97a.75.75 0 0 1-1.06 0Z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              // Moon icon for dark mode
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M21.752 15.002A9.718 9.718 0 0 1 12.002 22C6.476 22 2 17.523 2 11.998 2 7.517 4.86 3.796 8.77 2.43a.75.75 0 0 1 .964.964A8.219 8.219 0 0 0 9.5 6.248c0 4.549 3.69 8.238 8.239 8.238 1.386 0 2.69-.333 3.855-.934a.75.75 0 0 1 .158 1.45Z" />
              </svg>
            )}
            <span className="hidden sm:inline">
              {theme === "dark" ? "Light" : "Dark"}
            </span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stocks.map((it) => (
          <StockCard
            key={it.id}
            symbol={it.symbol}
            instrumentKey={it.instrumentKey || it.symbol}
            quantity={2}
            exchange="NSE"
            capitalPerStock={capitalTotal * leverage}
            leverage={leverage}
            targetPct={targetPct}
            slPct={slPct}
          />
        ))}
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeSettings}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white text-slate-900 dark:bg-slate-900 dark:text-white p-6 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Settings</h2>
              <button
                onClick={closeSettings}
                aria-label="Close"
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                closeSettings();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm mb-1">Stocks</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {stocks.map((it) => (
                    <span
                      key={it.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-700 text-sm"
                    >
                      <span className="font-semibold">{it.symbol}</span>
                      <button
                        type="button"
                        onClick={() => removeStock(it.id)}
                        className="ml-1 text-slate-500 hover:text-red-600"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={newStockSymbol}
                      onChange={(e) => setNewStockSymbol(e.target.value)}
                      placeholder="Enter symbol e.g. RELIANCE"
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => addStock(newStockSymbol)}
                    className="rounded-md px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Add
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1" htmlFor="capital">
                  Capital (total)
                </label>
                <input
                  id="capital"
                  type="number"
                  min="0"
                  step="100"
                  value={capitalTotal}
                  onChange={(e) => setCapitalTotal(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 100000"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Per-stock capital used (with leverage): ₹{(capitalTotal * leverage).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="block text-sm mb-1" htmlFor="leverage">
                  Leverage (x)
                </label>
                <input
                  id="leverage"
                  type="number"
                  min="1"
                  step="1"
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 5"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1" htmlFor="targetPct">
                    Target (%)
                  </label>
                  <input
                    id="targetPct"
                    type="number"
                    min="0"
                    step="0.1"
                    value={targetPct}
                    onChange={(e) => setTargetPct(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" htmlFor="slPct">
                    Stop Loss (%)
                  </label>
                  <input
                    id="slPct"
                    type="number"
                    min="0"
                    step="0.1"
                    value={slPct}
                    onChange={(e) => setSlPct(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 0.5"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeSettings}
                  className="rounded-md px-3 py-2 ring-1 ring-slate-300 hover:bg-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
