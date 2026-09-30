import { useEffect, useState, useCallback } from "react";
import StockCard from "./components/StockCard";
import LandingPage from "./components/LandingPage";
import PWAInstallButton from "./components/PWAInstallButton";
import PWAStatus from "./components/PWAStatus";
import Toast from "./components/Toast";
import PaperTradeHistory from "./components/PaperTradeHistory";
import {
  PaperTradingProvider,
  usePaperTrading,
} from "./context/PaperTradingContext";

function AppInner() {
  const { mode, toggleMode, balance } = usePaperTrading();
  const [entered, setEntered] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("lb_entered") === "1";
    } catch {
      return false;
    }
  });
  const enterApp = () => {
    try {
      localStorage.setItem("lb_entered", "1");
    } catch {}
    setEntered(true);
  };
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
  const [isBottomSheetAnimating, setIsBottomSheetAnimating] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragCurrentY, setDragCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktopView, setIsDesktopView] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024
  );

  useEffect(() => {
    const onResize = () => setIsDesktopView(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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

  useEffect(() => {
    const hasEmpty = (stocks || []).some(
      (s) => !String(s.symbol || "").trim()
    );
    if (!hasEmpty) {
      setStocks((prev) => {
        const list = prev || [];
        const stillHasEmpty = list.some((s) => !String(s.symbol || "").trim());
        if (stillHasEmpty) return list;
        const id = `NEW-${Date.now()}`;
        return [...list, { id, symbol: "", instrumentKey: "" }];
      });
    }
  }, [stocks]);

  if (!entered) {
    return <LandingPage onEnter={enterApp} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {mode !== "paper" && (
              <img src={`${process.env.PUBLIC_URL}/zerodha-kite-seeklogo.svg`} alt="Zerodha" className="w-7 h-7" />
            )}
            {mode === "paper" ? "Paper Trading" : "Zerodha Live"}
          </h1>
          {mode === "paper" && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[11px] font-semibold uppercase tracking-wide">
              Paper
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Paper Balance / History */}
          {mode === "paper" && (
            <button
              onClick={() => setShowPaperHistory(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-xs font-medium"
              title="Paper trade history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v.258a33.186 33.186 0 016.668.83.75.75 0 01-.336 1.461 31.28 31.28 0 00-1.103-.232l2.79 5.178a.75.75 0 01-.387.999l-2.278-.716A7.804 7.804 0 0114.48 13H16a.75.75 0 010 1.5h-1.52a7.804 7.804 0 01-.368 1.273l2.278.716a.75.75 0 01.387.999l-2.79 5.178c.37.078.74.15 1.103.232a.75.75 0 01.336 1.461 33.186 33.186 0 01-6.668.83V17.25a.75.75 0 01-1.5 0v-.258a33.186 33.186 0 01-6.668-.83.75.75 0 01.336-1.461 31.28 31.28 0 001.103.232L4.663 9.738a.75.75 0 01.387-.999l2.278.716A7.804 7.804 0 015.52 7.5H4a.75.75 0 010-1.5h1.52a7.804 7.804 0 01.368-1.273L3.61 3.548a.75.75 0 01-.387-.999l2.79-5.178A31.28 31.28 0 006.71 0a.75.75 0 01.336-1.461A33.186 33.186 0 0113.75.758V.5a.75.75 0 01.75-.75h.258zM10 12a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              ₹{balance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </button>
          )}
          {/* Live/Paper Toggle — iOS native style */}
          <button
            onClick={toggleMode}
            role="switch"
            aria-checked={mode === "live"}
            className={`relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
              mode === "live"
                ? "bg-orange-500"
                : "bg-slate-200 dark:bg-[#39393D]"
            }`}
            title={mode === "live" ? "Switch to Paper mode" : "Switch to Live mode"}
          >
            <span
              className={`pointer-events-none inline-block h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                mode === "live" ? "translate-x-[21px]" : "translate-x-[2px]"
              }`}
            />
          </button>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
            {mode === "paper" ? "Paper" : "Live"}
          </span>

          <button
            onClick={() => window.location.reload()}
            className="p-2 rounded-full transition-colors text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Refresh"
            title="Refresh"
          >
            {/* Refresh icon */}
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
              <path d="M21 12a9 9 0 1 1-3-6.7"/>
              <path d="M21 3v6h-6"/>
            </svg>
          </button>
          <button
            onClick={openSettings}
            className="p-2 rounded-full transition-colors text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
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
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full transition-colors text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
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
                className="h-5 w-5"
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
                className="h-5 w-5"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                <path d="M19 3v4"/>
                <path d="M21 5h-4"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stocks.map((it) => (
          <StockCard
            key={it.id}
            id={it.id}
            symbol={it.symbol}
            instrumentKey={it.instrumentKey || it.symbol}
            quantity={2}
            exchange="NSE"
            capitalPerStock={capitalTotal * leverage}
            leverage={leverage}
            targetPct={targetPct}
            slPct={slPct}
            onRename={renameStock}
            onDelete={removeStock}
          />
        ))}
      </div>

      {showSettings && (
        <div 
          className="fixed inset-0 z-50"
          style={{
            transform: 'translateZ(0)',
            willChange: 'contents',
            isolation: 'isolate'
          }}
        >
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/80 ${
              isBottomSheetAnimating ? 'opacity-0' : 'opacity-100'
            }`}
            style={{
              transition: 'opacity 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              willChange: 'opacity'
            }}
            onClick={closeSettings}
          />
          
          {/* Panel — bottom sheet on mobile, right drawer on desktop */}
          <div 
            className={`absolute bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl flex flex-col ${
              isDesktopView
                ? "top-0 bottom-0 right-0 w-full max-w-[420px]"
                : "bottom-0 left-0 right-0"
            }`}
            style={{
              transform: isDesktopView
                ? isBottomSheetAnimating
                  ? 'translateX(100%)'
                  : `translateX(${dragCurrentY}px)`
                : isBottomSheetAnimating 
                  ? 'translateY(100%)' 
                  : `translateY(${dragCurrentY}px)`,
              ...(isDesktopView
                ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }
                : {
                    borderTopLeftRadius: '24px',
                    borderTopRightRadius: '24px',
                    maxHeight: '85vh',
                    transformOrigin: 'center bottom',
                  }),
              transition: isDragging 
                ? 'none' 
                : isBottomSheetAnimating
                  ? 'transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                  : 'transform 400ms ease-out',
              willChange: 'transform, opacity',
              opacity: isDesktopView ? 1 : (dragCurrentY > 200 ? Math.max(0.3, 1 - dragCurrentY / 400) : 1),
              backfaceVisibility: 'hidden',
              perspective: '1000px',
              WebkitTransform: isDesktopView
                ? isBottomSheetAnimating
                  ? 'translateZ(0) translateX(100%)'
                  : `translateZ(0) translateX(${dragCurrentY}px)`
                : isBottomSheetAnimating 
                  ? 'translateZ(0) translateY(100%)' 
                  : `translateZ(0) translateY(${dragCurrentY}px)`,
              contain: 'layout style paint'
            }}
          >
            {/* Drag Handle */}
            <div 
              className={`flex shrink-0 cursor-grab active:cursor-grabbing ${
                isDesktopView
                  ? "justify-center pt-4 pb-2 px-2"
                  : "justify-center pt-4 pb-3"
              }`}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              <div 
                className={`h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full hover:bg-slate-400 dark:hover:bg-slate-500 ${
                  isDesktopView ? "w-10" : "w-12 hover:w-16"
                }`}
                style={{
                  transition: 'all 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  willChange: 'width, background-color'
                }}
              ></div>
            </div>
            
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-6 pb-4">
              <h2 className="text-xl font-semibold">Settings</h2>
              <button
                onClick={closeSettings}
                aria-label="Close"
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                closeSettings();
              }}
              className="space-y-4"
            >
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
        </div>
      )}
      
      {/* PWA Components */}
      <PWAStatus />
      <PWAInstallButton />
      <Toast />
      {showPaperHistory && (
        <PaperTradeHistory onClose={() => setShowPaperHistory(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <PaperTradingProvider>
      <AppInner />
    </PaperTradingProvider>
  );
}
