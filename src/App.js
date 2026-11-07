import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import StockCard from "./components/StockCard";
import LandingPage from "./components/LandingPage";
import PWAInstallButton from "./components/PWAInstallButton";
import PWAStatus from "./components/PWAStatus";
import Toast from "./components/Toast";
import PaperTradeHistory from "./components/PaperTradeHistory";
import Icon from "./components/icons";
import {
  PaperTradingProvider,
  usePaperTrading,
} from "./context/PaperTradingContext";
import useNiftyPrices from "./hooks/useNiftyPrices";
import { NIFTY50 } from "./nifty50";

/* ---------- IST clock + NSE session (enterprise status language) ---------- */
function istParts(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
    const wd = (get("weekday") || "").slice(0, 3);
    return {
      weekday: wd,
      hour: Number(get("hour")) % 24,
      minute: Number(get("minute")),
      second: Number(get("second")),
    };
  } catch {
    return {
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }
}

const useIstClock = () => {
  const [now, setNow] = useState(() => istParts());
  useEffect(() => {
    const id = setInterval(() => setNow(istParts()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
};

function istTimeString(ts) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

// NSE cash session: Mon–Fri 09:15–15:30 IST, pre-open 09:00–09:15.
function sessionState(now) {
  const weekend = now.weekday === "Sat" || now.weekday === "Sun";
  const mins = now.hour * 60 + now.minute;
  if (weekend || mins < 9 * 60 + 15 || mins >= 15 * 60 + 30)
    return { key: "closed", label: "Market closed", tone: "neutral" };
  if (mins < 9 * 60 + 15)
    return { key: "pre", label: "Pre-open", tone: "warn" };
  return { key: "open", label: "Market open", tone: "live" };
}

/* ---------- primitives ---------- */
function Chip({ tone = "neutral", pulse = false, children, className = "", title }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2 ring-line",
    live: "bg-pos/10 text-pos ring-pos/25",
    warn: "bg-warn/10 text-warn ring-warn/25",
    neg: "bg-neg/10 text-neg ring-neg/25",
    accent: "bg-accent/10 text-accent ring-accent/25",
  };
  const dotTone = {
    neutral: "bg-ink-3",
    live: "bg-pos",
    warn: "bg-warn",
    neg: "bg-neg",
    accent: "bg-accent",
  };
  return (
    <span
      title={title}
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded border px-2 text-[10px] font-bold uppercase tracking-[0.1em] ring-1 ${tones[tone]} ${className}`}
    >
      {tone !== "neutral" || pulse ? (
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotTone[tone]} ${
            pulse ? "animate-pulse" : ""
          }`}
        />
      ) : null}
      {children}
    </span>
  );
}

function IconButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-2 ring-1 ring-line transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </button>
  );
}

/* ---------- feed status (was LiveBadge) ---------- */
function FeedChip({ prices, status, updatedAt, source, liveCount, total, onRetry }) {
  const dates = Object.values(prices || {})
    .map((p) => p && p.date)
    .filter(Boolean);
  let todayIST = "";
  try {
    todayIST = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {}
  const fresh = dates.length > 0 && dates[0] === todayIST;
  const count =
    Number.isFinite(liveCount) && Number.isFinite(total) && total > 0
      ? `${liveCount}/${total}`
      : "";
  const hint = updatedAt
    ? `Updated ${new Date(updatedAt).toLocaleTimeString()} via ${
        source || "feed"
      } — click to refresh`
    : "Click to retry the price feed";
  if (status === "ok" && fresh) {
    return (
      <button onClick={onRetry} title={hint} className="shrink-0">
        <Chip tone="live" >
          Live{count ? ` ${count}` : ""}
        </Chip>
      </button>
    );
  }
  if (status === "ok") {
    return (
      <button onClick={onRetry} title={hint} className="shrink-0">
        <Chip tone="warn">Prev close{count ? ` ${count}` : ""}</Chip>
      </button>
    );
  }
  if (status === "loading") {
    return (
      <span title="Fetching prices" className="shrink-0">
        <Chip tone="neutral" pulse>
          Syncing
        </Chip>
      </span>
    );
  }
  return (
    <button onClick={onRetry} title={hint} className="shrink-0">
      <Chip tone="neg">Feed offline · manual</Chip>
    </button>
  );
}

/* ---------- mode switch (segmented control) ---------- */
function ModeSwitch({ mode, onChange }) {
  const opts = [
    { key: "live", label: "Live", icon: "bolt" },
    { key: "paper", label: "Paper", icon: "fileText" },
  ];
  return (
    <div
      className="flex h-8 items-center gap-0.5 rounded-md bg-surface-2 p-0.5 ring-1 ring-line"
      role="group"
      aria-label="Trading mode"
    >
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={mode === o.key}
          title={o.key === "live" ? "Live mode — orders open in Kite" : "Paper mode — simulated fills"}
          className={`flex h-7 items-center gap-1.5 rounded px-2 text-[11px] font-bold uppercase tracking-wide transition-colors ${
            mode === o.key
              ? "bg-surface text-ink shadow-elev ring-1 ring-line"
              : "text-ink-3 hover:text-ink-2"
          }`}
        >
          <Icon name={o.icon} className="h-3.5 w-3.5" />
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MarketSessionChip() {
  const now = useIstClock();
  const s = sessionState(now);
  const time = `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`;
  return (
    <Chip
      tone={s.tone}
      title={`NSE cash session 09:15–15:30 IST · now ${time} IST`}
      className="hidden sm:inline-flex"
    >
      {s.label} · {time} IST
    </Chip>
  );
}

/* ---------- settings field primitives ---------- */
const fieldInputCls =
  "h-9 w-full rounded-md bg-surface-2 px-3 text-[13px] font-mono tabular-nums text-ink ring-1 ring-line placeholder:font-sans placeholder:text-ink-3 focus:ring-2 focus:ring-accent/50 outline-none transition";

function AppInner() {
  const { mode, setMode, balance } = usePaperTrading();
  const [stocks, setStocks] = useState(() => {
    const canonical = () =>
      NIFTY50.map((s) => ({ id: s, symbol: s, instrumentKey: s }));
    // Merge saved watchlist with the canonical Nifty 50 so ALL 50 cards are
    // present on open. User-added extras are preserved after the 50.
    const mergeWithCanonical = (list) => {
      const seen = new Set();
      const out = [];
      for (const s of canonical()) {
        seen.add(s.symbol);
        out.push(s);
      }
      for (const o of list || []) {
        const sym = String(o?.symbol || o || "").toUpperCase().trim();
        if (!sym || seen.has(sym)) continue;
        seen.add(sym);
        out.push({
          id: o?.id || sym,
          symbol: sym,
          instrumentKey: String(o?.instrumentKey || sym).toUpperCase().trim(),
        });
      }
      return out;
    };
    try {
      if (typeof window !== "undefined") {
        const ver = window.localStorage.getItem("watchlistVer");
        const v = window.localStorage.getItem("stocks");
        const parsed = v ? JSON.parse(v) : null;
        if (ver !== "nifty50-2026-10-03" || !parsed) {
          window.localStorage.setItem("watchlistVer", "nifty50-2026-10-03");
          return mergeWithCanonical(Array.isArray(parsed) ? parsed : []);
        }
        if (Array.isArray(parsed)) return mergeWithCanonical(parsed);
      }
    } catch {}
    return canonical();
  });
  const [newStockSymbol, setNewStockSymbol] = useState("");
  const [query, setQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isBottomSheetAnimating, setIsBottomSheetAnimating] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragCurrentY, setDragCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktopView, setIsDesktopView] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024
  );
  const searchRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsDesktopView(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Global "/" focuses search — power-user convention from trading terminals.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      const typing =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if (!typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  const [showPaperHistory, setShowPaperHistory] = useState(false);
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
  const openSettings = () => {
    setShowSettings(true);
    setIsBottomSheetAnimating(true);
    setDragCurrentY(0); // Reset drag position

    // Use double requestAnimationFrame for ultra-smooth animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsBottomSheetAnimating(false);
      });
    });
  };

  const closeSettings = () => {
    setIsBottomSheetAnimating(true);
    setTimeout(() => {
      setShowSettings(false);
      setIsBottomSheetAnimating(false);
      setIsDragging(false);
      setDragCurrentY(0);
    }, 400);
  };

  const handleDragStart = (e) => {
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    setDragStartY(isDesktopView ? clientX : clientY);
    setDragCurrentY(0);
    setIsDragging(true);
  };

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const client = isDesktopView ? clientX : clientY;
    const deltaY = Math.max(0, client - dragStartY);
    setDragCurrentY(deltaY);
  }, [isDragging, dragStartY, isDesktopView]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Close if dragged down more than 100px or with sufficient velocity
    if (dragCurrentY > 100) {
      closeSettings();
    } else {
      // Smooth snap back with spring animation
      setDragCurrentY(0);
    }
  }, [isDragging, dragCurrentY]);

  // Add global event listeners for drag handling
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => handleDragMove(e);
    const handleMouseUp = () => handleDragEnd();
    const handleTouchMove = (e) => handleDragMove(e);
    const handleTouchEnd = () => handleDragEnd();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

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

  const renameStock = (id, raw) => {
    const sym = String(raw || "").toUpperCase().trim();
    if (!sym) {
      removeStock(id);
      return;
    }
    setStocks((prev) => {
      const list = prev || [];
      if (list.some((x) => x.id !== id && (x.instrumentKey || x.symbol) === sym)) {
        return list.filter((x) => x.id !== id);
      }
      return list.map((x) =>
        x.id === id ? { ...x, symbol: sym, instrumentKey: sym, id: sym } : x
      );
    });
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

  // Drop any blank placeholder rows (legacy) — the watchlist always holds
  // the full Nifty 50 plus explicit user additions.
  useEffect(() => {
    if ((stocks || []).some((s) => !String(s.symbol || "").trim())) {
      setStocks((prev) => (prev || []).filter((s) => String(s.symbol || "").trim()));
    }
  }, [stocks]);

  const {
    prices: livePrices,
    status: liveStatus,
    updatedAt: liveUpdatedAt,
    source: liveSource,
    liveCount,
    refresh: refreshPrices,
  } = useNiftyPrices(
    (stocks || [])
      .map((s) => s.symbol)
      .filter((s) => String(s || "").trim())
  );

  const resetToNifty50 = () => {
    try {
      window.localStorage.setItem("watchlistVer", "nifty50-2026-10-03");
    } catch {}
    setStocks(NIFTY50.map((s) => ({ id: s, symbol: s, instrumentKey: s })));
    setQuery("");
  };

  const nonEmptyStocks = (stocks || []).filter((s) =>
    String(s.symbol || "").trim()
  );
  const q = query.trim().toUpperCase();
  const visibleStocks = !q
    ? nonEmptyStocks
    : nonEmptyStocks.filter((it) =>
        String(it.symbol || "").toUpperCase().includes(q)
      );

  const feedLabel =
    liveStatus === "ok"
      ? liveUpdatedAt && new Date(liveUpdatedAt).toDateString() === new Date().toDateString()
        ? "Live"
        : "Delayed"
      : liveStatus === "loading"
      ? "Syncing"
      : liveStatus === "error"
      ? "Offline"
      : "Idle";

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      {/* ================= top app bar ================= */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/logo-mark.png" alt="" className="h-7 w-7 shrink-0 rounded-md shadow-elev" />
            <span className="truncate text-[15px] font-bold tracking-tight text-ink">
              Zerodha Live
            </span>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3 lg:inline">
              Terminal
            </span>
            <span className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-3 md:inline">
              v1.0.0
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <MarketSessionChip />
            {mode === "paper" && (
              <>
                <button
                  onClick={() => setShowPaperHistory(true)}
                  title="Paper balance — open trade history"
                  className="hidden h-8 items-center gap-2 rounded-md bg-surface px-2.5 text-[12px] font-semibold text-ink ring-1 ring-line transition-colors hover:bg-surface-2 sm:inline-flex"
                >
                  <Icon name="clock" className="h-3.5 w-3.5 text-ink-3" />
                  <span className="font-mono tabular-nums">
                    ₹{balance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </button>
                <button
                  onClick={() => setShowPaperHistory(true)}
                  aria-label="Paper trade history"
                  title="Paper trade history"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-ink-2 ring-1 ring-line transition-colors hover:bg-surface-2 hover:text-ink sm:hidden"
                >
                  <Icon name="clock" className="h-4 w-4" />
                </button>
              </>
            )}
            <ModeSwitch mode={mode} onChange={setMode} />
            <IconButton label="Toggle theme" onClick={toggleTheme}>
              <Icon
                name={theme === "dark" ? "sun" : "moon"}
                className="h-4 w-4"
              />
            </IconButton>
            <IconButton label="Settings" onClick={openSettings}>
              <Icon name="settings" className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </header>

      {/* ================= command toolbar ================= */}
      <div className="border-b border-line bg-canvas">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <div className="relative min-w-0 basis-full flex-1 sm:basis-auto sm:max-w-xs">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="Search symbol…"
              aria-label="Search symbol"
              name="q"
              className="h-9 w-full rounded-md bg-surface pl-9 pr-9 text-[13px] font-medium text-ink ring-1 ring-line placeholder:text-ink-3 focus:ring-2 focus:ring-accent/50 outline-none transition"
            />
            {!query && (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-3">
                /
              </kbd>
            )}
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <FeedChip
            prices={livePrices}
            status={liveStatus}
            updatedAt={liveUpdatedAt}
            source={liveSource}
            liveCount={liveCount}
            total={nonEmptyStocks.length}
            onRetry={refreshPrices}
          />
          <div className="ml-auto flex items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addStock(newStockSymbol);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newStockSymbol}
                onChange={(e) => setNewStockSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setNewStockSymbol("");
                }}
                placeholder="Add symbol"
                aria-label="Add symbol"
                name="add-symbol"
                className="h-9 w-28 rounded-md bg-surface px-3 text-[13px] font-semibold uppercase text-ink ring-1 ring-line placeholder:font-medium placeholder:normal-case placeholder:text-ink-3 focus:ring-2 focus:ring-accent/50 outline-none transition sm:w-32"
              />
              <button
                type="submit"
                className="h-9 rounded-md bg-accent px-3 text-[12px] font-bold text-white transition hover:brightness-110 active:brightness-95"
              >
                <span className="hidden sm:inline">Add instrument</span>
                <span className="sm:hidden">Add</span>
              </button>
            </form>
            <button
              onClick={resetToNifty50}
              title="Restore all 50 Nifty stocks"
              className="h-9 rounded-md bg-surface px-3 text-[12px] font-semibold text-ink-2 ring-1 ring-line transition-colors hover:text-ink hover:ring-line-2"
            >
              <span className="hidden sm:inline">Reset to Nifty 50</span>
              <span className="sm:hidden">Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= watchlist ================= */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-10 pt-4 sm:px-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-2">
              Watchlist
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              NIFTY 50 · NSE equity · {nonEmptyStocks.length} instruments
            </p>
          </div>
          <p className="hidden text-[11px] text-ink-3 sm:block">
            Auto-refresh 60s · tap any level to override
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleStocks.map((it, i) => (
            <div
              key={it.id}
              className="app-rise min-w-0"
              style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}
            >
              <StockCard
                id={it.id}
                symbol={it.symbol}
                instrumentKey={it.instrumentKey || it.symbol}
                livePrice={livePrices[String(it.symbol || "").toUpperCase()]?.price ?? null}
                quantity={2}
                exchange="NSE"
                capitalPerStock={capitalTotal * leverage}
                leverage={leverage}
                targetPct={targetPct}
                slPct={slPct}
                onRename={renameStock}
                onDelete={removeStock}
              />
            </div>
          ))}
        </div>
        {visibleStocks.length === 0 && (
          <div className="rounded-lg bg-surface px-6 py-14 text-center ring-1 ring-line">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-surface-2 text-ink-3 ring-1 ring-line">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            </div>
            <p className="text-[13px] font-bold text-ink">
              No instruments match “{query.trim()}”.
            </p>
            <p className="mt-1 text-[12px] text-ink-3">
              Try another symbol or reset to the Nifty 50.
            </p>
          </div>
        )}
      </main>

      {/* ================= status bar ================= */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 text-[11px] text-ink-3 sm:px-6">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-[0.1em]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                liveStatus === "ok"
                  ? "bg-pos"
                  : liveStatus === "loading"
                  ? "animate-pulse bg-warn"
                  : liveStatus === "error"
                  ? "bg-neg"
                  : "bg-ink-3"
              }`}
            />
            {feedLabel}
          </span>
          <span>Feed: {liveSource || "—"}</span>
          <span className="font-mono tabular-nums">
            Last tick {liveUpdatedAt ? istTimeString(liveUpdatedAt) : "—"} IST
          </span>
          <span>
            Mode: {mode === "paper" ? "Paper simulation" : "Live · Kite Publisher"}
          </span>
          <span className="ml-auto">Local-first storage · v1.0.0</span>
        </div>
      </footer>

      {/* ================= settings drawer ================= */}
      {showSettings &&
        createPortal(
          <div
            className="fixed inset-0 z-50"
            style={{
              transform: "translateZ(0)",
              willChange: "contents",
              isolation: "isolate",
            }}
          >
            {/* Backdrop */}
            <div
              className={`absolute inset-0 bg-ink/40 ${
                isBottomSheetAnimating ? "opacity-0" : "opacity-100"
              }`}
              style={{
                transition: "opacity 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                willChange: "opacity",
              }}
              onClick={closeSettings}
            />

            {/* Panel — bottom sheet on mobile, right drawer on desktop */}
            <div
              className={`absolute flex flex-col bg-surface text-ink shadow-pop ${
                isDesktopView
                  ? "top-0 bottom-0 right-0 w-full max-w-[420px] border-l border-line"
                  : "top-0 bottom-0 left-0 right-0"
              }`}
              style={{
                top: 0,
                bottom: 0,
                transform: isDesktopView
                  ? isBottomSheetAnimating
                    ? "translateX(100%)"
                    : `translateX(${dragCurrentY}px)`
                  : isBottomSheetAnimating
                  ? "translateY(100%)"
                  : `translateY(${dragCurrentY}px)`,
                ...(isDesktopView
                  ? {
                      borderTopLeftRadius: 0,
                      borderTopRightRadius: 0,
                      borderBottomLeftRadius: 0,
                      borderBottomRightRadius: 0,
                    }
                  : {
                      borderTopLeftRadius: 0,
                      borderTopRightRadius: 0,
                      transformOrigin: "center bottom",
                    }),
                transition: isDragging
                  ? "none"
                  : isBottomSheetAnimating
                  ? "transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)"
                  : "transform 400ms ease-out",
                willChange: "transform, opacity",
                opacity: isDesktopView ? 1 : dragCurrentY > 200 ? Math.max(0.3, 1 - dragCurrentY / 400) : 1,
                backfaceVisibility: "hidden",
                perspective: "1000px",
                WebkitTransform: isDesktopView
                  ? isBottomSheetAnimating
                    ? "translateZ(0) translateX(100%)"
                    : `translateZ(0) translateX(${dragCurrentY}px)`
                  : isBottomSheetAnimating
                  ? "translateZ(0) translateY(100%)"
                  : `translateZ(0) translateY(${dragCurrentY}px)`,
                contain: "layout style paint",
              }}
            >
              {/* Drag Handle — mobile bottom-sheet only */}
              {!isDesktopView && (
                <div
                  className="flex shrink-0 cursor-grab active:cursor-grabbing justify-center pt-4 pb-3"
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                >
                  <div className="h-1.5 w-12 rounded-full bg-line-2" />
                </div>
              )}

              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-line px-5 pt-5 pb-4">
                <div>
                  <h2 className="text-[15px] font-bold tracking-tight">Settings</h2>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    Risk parameters · stored locally on this device
                  </p>
                </div>
                <IconButton label="Close" onClick={closeSettings}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </IconButton>
              </div>

              {/* Content */}
              <div className="scroll-slim flex-1 overflow-y-auto px-5 py-5">
                <form
                  id="settings-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    closeSettings();
                  }}
                  className="space-y-6"
                >
                  {/* ---- Risk capital ---- */}
                  <section>
                    <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">
                      Risk capital
                    </h3>
                    <label className="mb-1.5 block text-[12px] font-semibold text-ink-2" htmlFor="capital">
                      Capital (total)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-3">
                        ₹
                      </span>
                      <input
                        id="capital"
                        type="number"
                        min="0"
                        step="100"
                        value={capitalTotal}
                        onChange={(e) => setCapitalTotal(Number(e.target.value))}
                        className={`${fieldInputCls} pl-7`}
                        placeholder="e.g. 100000"
                      />
                    </div>
                    <label className="mb-1.5 mt-4 block text-[12px] font-semibold text-ink-2" htmlFor="leverage">
                      Leverage
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 5, 10].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setLeverage(v)}
                          className={`h-9 flex-1 rounded-md text-[12px] font-bold tabular-nums ring-1 transition-colors ${
                            leverage === v
                              ? "bg-accent text-white ring-accent"
                              : "bg-surface-2 text-ink-2 ring-line hover:text-ink hover:ring-line-2"
                          }`}
                        >
                          {v}x
                        </button>
                      ))}
                      <input
                        id="leverage"
                        type="number"
                        min="1"
                        step="1"
                        value={leverage}
                        onChange={(e) => setLeverage(Number(e.target.value))}
                        className="h-9 w-16 rounded-md bg-surface-2 px-2 text-center text-[13px] font-mono tabular-nums text-ink ring-1 ring-line focus:ring-2 focus:ring-accent/50 outline-none transition"
                        placeholder="5"
                      />
                    </div>
                  </section>

                  {/* ---- Order levels ---- */}
                  <section className="border-t border-line pt-5">
                    <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">
                      Order levels
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[12px] font-semibold text-ink-2" htmlFor="targetPct">
                          Target (%)
                        </label>
                        <div className="relative">
                          <input
                            id="targetPct"
                            type="number"
                            min="0"
                            step="0.1"
                            value={targetPct}
                            onChange={(e) => setTargetPct(Number(e.target.value))}
                            className={`${fieldInputCls} pr-8`}
                            placeholder="e.g. 1"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-3">
                            %
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12px] font-semibold text-ink-2" htmlFor="slPct">
                          Stop loss (%)
                        </label>
                        <div className="relative">
                          <input
                            id="slPct"
                            type="number"
                            min="0"
                            step="0.1"
                            value={slPct}
                            onChange={(e) => setSlPct(Number(e.target.value))}
                            className={`${fieldInputCls} pr-8`}
                            placeholder="e.g. 0.5"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-3">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* ---- Derived summary ---- */}
                  <section className="border-t border-line pt-5">
                    <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">
                      Derived exposure
                    </h3>
                    <div className="space-y-2 rounded-md bg-surface-2 p-3.5 ring-1 ring-line">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-ink-2">Per-instrument firepower</span>
                        <span className="font-mono font-semibold tabular-nums text-ink">
                          ₹{(capitalTotal * leverage).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-ink-2">Reward : risk</span>
                        <span className="font-mono font-semibold tabular-nums text-ink">
                          {slPct > 0 && targetPct > 0
                            ? `${(targetPct / slPct).toFixed(1)} : 1`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-ink-2">Qty @ ₹1,000 LTP</span>
                        <span className="font-mono font-semibold tabular-nums text-ink">
                          {Math.max(1, Math.floor((capitalTotal * leverage) / 1000))} shares
                        </span>
                      </div>
                    </div>
                  </section>
                </form>
              </div>

              {/* Footer */}
              <div className="shrink-0 grid grid-cols-2 gap-2 border-t border-line px-5 py-4">
                <button
                  type="button"
                  onClick={closeSettings}
                  className="h-9 rounded-md text-[13px] font-semibold text-ink-2 ring-1 ring-line transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="settings-form"
                  className="h-9 rounded-md bg-accent text-[13px] font-bold text-white transition hover:brightness-110 active:brightness-95"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* PWA Components */}
      <PWAInstallButton />
      <Toast />
      {showPaperHistory && (
        <PaperTradeHistory onClose={() => setShowPaperHistory(false)} />
      )}
    </div>
  );
}

export default function App() {
  const getPath = () =>
    typeof window !== "undefined"
      ? window.location.pathname.replace(/\/+$/, "") || "/"
      : "/";
  const [path, setPath] = useState(getPath);

  useEffect(() => {
    const onPop = () => setPath(getPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // One-time cleanup: old versions gated the landing page behind
  // localStorage `lb_entered`, which made `/` skip straight to the app
  // for returning visitors. Routing is URL-based now.
  useEffect(() => {
    try {
      localStorage.removeItem("lb_entered");
    } catch {}
  }, []);

  const isAppRoute = path === "/app";

  return (
    <PaperTradingProvider>
      <PWAStatus />
      {isAppRoute ? (
        <AppInner />
      ) : (
        <LandingPage
          onEnter={() => {
            window.history.pushState(null, "", "/app/");
            setPath("/app");
            window.scrollTo(0, 0);
          }}
        />
      )}
    </PaperTradingProvider>
  );
}
