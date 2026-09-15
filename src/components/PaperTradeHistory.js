import { useState, useCallback, useEffect } from "react";
import { usePaperTrading } from "../context/PaperTradingContext";

const isDesktop = () =>
  typeof window !== "undefined" && window.innerWidth >= 1024;

export default function PaperTradeHistory({ onClose }) {
  const { trades, balance, getStats, closePaperTrade, resetPaperTrades } =
    usePaperTrading();
  const stats = getStats();
  const openTrades = trades.filter((t) => t.status === "OPEN");
  const closedTrades = trades.filter((t) => t.status === "CLOSED");

  const [isAnimating, setIsAnimating] = useState(true);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktopView, setIsDesktopView] = useState(isDesktop);

  useEffect(() => {
    const onResize = () => setIsDesktopView(isDesktop());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsAnimating(false));
    });
  }, []);

  const close = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => onClose(), 400);
  }, [onClose]);

  const handleDragStart = (e) => {
    const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX, y: clientY });
    setDragDelta(0);
    setIsDragging(true);
  };

  const handleDragMove = useCallback(
    (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;
      const delta = isDesktopView
        ? Math.max(0, clientX - dragStart.x)
        : Math.max(0, clientY - dragStart.y);
      setDragDelta(delta);
    },
    [isDragging, dragStart, isDesktopView]
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragDelta > 100) {
      close();
    } else {
      setDragDelta(0);
    }
  }, [isDragging, dragDelta, close]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => handleDragMove(e);
    const onUp = () => handleDragEnd();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Mobile: translateY from bottom. Desktop: translateX from right.
  const getTransform = () => {
    if (isDesktopView) {
      return isAnimating
        ? "translateX(100%)"
        : `translateX(${dragDelta}px)`;
    }
    return isAnimating
      ? "translateY(100%)"
      : `translateY(${dragDelta}px)`;
  };

  const getWebkitTransform = () => {
    if (isDesktopView) {
      return isAnimating
        ? "translateZ(0) translateX(100%)"
        : `translateZ(0) translateX(${dragDelta}px)`;
    }
    return isAnimating
      ? "translateZ(0) translateY(100%)"
      : `translateZ(0) translateY(${dragDelta}px)`;
  };

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ transform: "translateZ(0)", isolation: "isolate" }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${
          isAnimating ? "opacity-0 backdrop-blur-none" : "opacity-100 backdrop-blur-sm"
        }`}
        style={{
          transition: "opacity 600ms cubic-bezier(0.25,0.46,0.45,0.94), backdrop-filter 600ms cubic-bezier(0.25,0.46,0.45,0.94)",
        }}
        onClick={close}
      />

      {/* Panel — bottom sheet on mobile, right drawer on desktop */}
      <div
        className={`absolute bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl flex flex-col ${
          isDesktopView
            ? "top-0 bottom-0 right-0 w-full max-w-[420px]"
            : "bottom-0 left-0 right-0"
        }`}
        style={{
          transform: getTransform(),
          transition: isDragging
            ? "none"
            : isAnimating
            ? "transform 400ms cubic-bezier(0.25,0.46,0.45,0.94)"
            : "transform 400ms ease-out",
          willChange: "transform",
          opacity: isDesktopView ? 1 : (dragDelta > 200 ? Math.max(0.3, 1 - dragDelta / 400) : 1),
          ...(isDesktopView
            ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }
            : {
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                maxHeight: "85vh",
                transformOrigin: "center bottom",
              }),
          WebkitTransform: getWebkitTransform(),
          contain: "layout style paint",
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
            style={{ transition: "all 300ms cubic-bezier(0.175,0.885,0.32,1.275)" }}
          />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3">
          <div>
            <h2 className="text-lg font-semibold">Paper Trading</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Balance: ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetPaperTrades}
              className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400"
            >
              Reset
            </button>
            <button
              onClick={close}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-800 text-center text-xs shrink-0">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Trades</p>
            <p className="font-semibold">{stats.totalTrades}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Win Rate</p>
            <p className="font-semibold">{stats.winRate.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Charges</p>
            <p className="font-semibold">₹{stats.totalCharges.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Net P&L</p>
            <p className={`font-semibold ${stats.netPnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              ₹{stats.netPnl.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {openTrades.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Open Positions ({openTrades.length})
              </h3>
              <div className="space-y-2">
                {openTrades.map((t) => (
                  <TradeCard key={t.id} trade={t} onClose={closePaperTrade} />
                ))}
              </div>
            </div>
          )}

          {closedTrades.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                History ({closedTrades.length})
              </h3>
              <div className="space-y-2">
                {closedTrades.map((t) => (
                  <TradeCard key={t.id} trade={t} />
                ))}
              </div>
            </div>
          )}

          {trades.length === 0 && (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
              No paper trades yet. Switch to Paper mode and place a trade.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TradeCard({ trade, onClose }) {
  const isOpen = trade.status === "OPEN";
  const time = new Date(trade.entryTime).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              trade.action === "BUY"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {trade.action}
          </span>
          <span className="font-semibold">{trade.symbol}</span>
          <span className="text-slate-500 dark:text-slate-400">{trade.quantity}</span>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{time}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <div className="flex gap-3 text-slate-600 dark:text-slate-400">
          <span>Entry ₹{trade.entryPrice.toFixed(2)}</span>
          {trade.targetPrice && <span>Tgt ₹{trade.targetPrice.toFixed(2)}</span>}
          {trade.slPrice && <span>SL ₹{trade.slPrice.toFixed(2)}</span>}
        </div>
        {isOpen && onClose && (
          <button
            onClick={() => {
              const price = prompt(
                `Close ${trade.action} ${trade.symbol} @ ₹?`,
                trade.entryPrice.toFixed(2)
              );
              if (price && !isNaN(Number(price))) {
                onClose(trade.id, Number(price));
              }
            }}
            className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-[11px] font-medium"
          >
            Close
          </button>
        )}
      </div>
      {!isOpen && (
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Exit ₹{trade.exitPrice?.toFixed(2)}
          </span>
          <span className={`font-semibold ${trade.pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {trade.pnl >= 0 ? "+" : ""}₹{trade.pnl.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
