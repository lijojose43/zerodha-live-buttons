import { useEffect, useState } from "react";
import StockCard from "./components/StockCard";
import PWAInstallButton from "./components/PWAInstallButton";
import PWAStatus from "./components/PWAStatus";

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
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
            aria-label="Open settings"
            title="Settings"
          >
            {/* Enhanced Gear icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 dark:from-indigo-500 dark:to-purple-600 dark:hover:from-indigo-600 dark:hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
            aria-label="Toggle theme"
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? (
              // Enhanced Sun icon for light mode
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 animate-pulse"
              >
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2"/>
                <path d="M12 20v2"/>
                <path d="m4.93 4.93 1.41 1.41"/>
                <path d="m17.66 17.66 1.41 1.41"/>
                <path d="M2 12h2"/>
                <path d="M20 12h2"/>
                <path d="m6.34 17.66-1.41 1.41"/>
                <path d="m19.07 4.93-1.41 1.41"/>
              </svg>
            ) : (
              // Enhanced Moon icon for dark mode
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 animate-pulse"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                <path d="M19 3v4"/>
                <path d="M21 5h-4"/>
              </svg>
            )}
            <span className="hidden sm:inline font-semibold">
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
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white text-slate-900 dark:bg-slate-900 dark:text-white p-6 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 mx-4 sm:mx-0">
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
      
      {/* PWA Components */}
      <PWAStatus />
      <PWAInstallButton />
    </div>
  );
}
