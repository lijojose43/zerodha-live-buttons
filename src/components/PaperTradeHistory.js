import { useState, useCallback, useEffect } from "react";
import { usePaperTrading } from "../context/PaperTradingContext";
import Icon from "./icons";

const isDesktop = () =>
  typeof window !== "undefined" && window.innerWidth >= 1024;

export default function PaperTradeHistory({ onClose }) {
  const { trades, balance, getStats, closePaperTrade, resetPaperTrades, deletePaperTrade } =
    usePaperTrading();
  const stats = getStats();
  const openTrades = trades.filter((t) => t.status === "OPEN");
  const closedTrades = trades.filter((t) => t.status === "CLOSED");

  const [isAnimating, setIsAnimating] = useState(true);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktopView, setIsDesktopView] = useState(isDesktop);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    if (!confirmingReset) return;
    const t = setTimeout(() => setConfirmingReset(false), 2600);
    return () => clearTimeout(t);
  }, [confirmingReset]);

  const handleReset = () => {
    if (trades.length === 0) return;
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setConfirmingReset(false);
    resetPaperTrades();
  };

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

  const statTone = (v) =>
    v >= 0 ? "text-pos" : "text-neg";

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ transform: "translateZ(0)", isolation: "isolate" }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${
          isAnimating ? "opacity-0" : "opacity-100"
        }`}
        onClick={close}
      />

      {/* Panel — bottom sheet on mobile, right drawer on desktop */}
      <div
        className={`absolute pointer-events-auto flex flex-col bg-surface text-ink shadow-pop ${
          isDesktopView
            ? "top-0 bottom-0 right-0 w-full max-w-[420px] border-l border-line"
            : "bottom-0 left-0 right-0 rounded-t-xl"
        }`}
        style={{
          transform: getTransform(),
          transition: isDragging
            ? "none"
            : isAnimating
            ? "transform 400ms cubic-bezier(0.25,0.46,0.45,0.94)"
            : "transform 400ms ease-out",
          willChange: "transform",
          opacity: isDesktopView ? 1 : dragDelta > 200 ? Math.max(0.3, 1 - dragDelta / 400) : 1,
          ...(isDesktopView
            ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }
            : {
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
            className={`h-1.5 rounded-full bg-line-2 ${
              isDesktopView ? "w-10" : "w-12"
            }`}
          />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">Paper Trading</h2>
            <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-2">
              Balance ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              onBlur={() => setConfirmingReset(false)}
              disabled={trades.length === 0}
              title={
                trades.length === 0
                  ? "Nothing to reset"
                  : confirmingReset
                  ? "Click again to confirm reset"
                  : "Reset balance & clear trades"
              }
              className={`h-7 rounded-md px-2.5 text-[11px] font-bold uppercase tracking-wide ring-1 transition-colors ${
                confirmingReset
                  ? "bg-neg text-white ring-neg"
                  : trades.length === 0
                  ? "cursor-not-allowed bg-surface-2 text-ink-3 ring-line opacity-60"
                  : "bg-surface text-ink-2 ring-line hover:text-ink hover:ring-line-2"
              }`}
            >
              {confirmingReset ? "Confirm" : "Reset"}
            </button>
            <button
              onClick={close}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 ring-1 ring-line transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-2 border-y border-line bg-surface-2 px-5 py-3 shrink-0">
          <div className="rounded-md bg-surface px-2 py-2 text-center ring-1 ring-line">
            <p className="text-[15px] font-bold tabular-nums leading-none text-ink">{stats.totalTrades}</p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">Trades</p>
          </div>
          <div className="rounded-md bg-surface px-2 py-2 text-center ring-1 ring-line">
            <p className="text-[15px] font-bold tabular-nums leading-none text-ink">{stats.winRate.toFixed(0)}%</p>
            <div className="mx-auto mt-1.5 h-1 w-10 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line">
              <div
                className={`h-full rounded-full ${stats.winRate >= 50 ? "bg-pos" : stats.winRate > 0 ? "bg-warn" : "bg-line-2"}`}
                style={{ width: `${Math.min(100, Math.max(0, stats.winRate))}%` }}
              />
            </div>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">Win rate</p>
          </div>
          <div className="rounded-md bg-surface px-2 py-2 text-center ring-1 ring-line">
            <p className="text-[15px] font-bold tabular-nums leading-none text-ink">₹{stats.totalCharges.toFixed(0)}</p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">Charges</p>
          </div>
          <div className="rounded-md bg-surface px-2 py-2 text-center ring-1 ring-line">
            <p className={`text-[15px] font-bold tabular-nums leading-none ${statTone(stats.netPnl)}`}>
              {stats.netPnl >= 0 ? "+" : "−"}₹{Math.abs(stats.netPnl).toFixed(0)}
            </p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">Net P&amp;L</p>
          </div>
        </div>

        {/* Content */}
        <div className="scroll-slim flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {openTrades.length > 0 && (
            <div>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
                Open positions · {openTrades.length}
              </h3>
              <div className="space-y-2">
                {openTrades.map((t) => (
                  <TradeCard key={t.id} trade={t} onClose={closePaperTrade} onDelete={deletePaperTrade} />
                ))}
              </div>
            </div>
          )}

          {closedTrades.length > 0 && (
            <div>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
                History · {closedTrades.length}
              </h3>
              <div className="space-y-2">
                {closedTrades.map((t) => (
                  <TradeCard key={t.id} trade={t} onDelete={deletePaperTrade} />
                ))}
              </div>
            </div>
          )}

          {trades.length === 0 && (
            <div className="rounded-md bg-surface-2 px-4 py-10 text-center text-[13px] text-ink-3 ring-1 ring-line">
              No paper trades yet. Switch to Paper mode and place a trade.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TradeCard({ trade, onClose, onDelete }) {
  const isOpen = trade.status === "OPEN";
  const isBuy = trade.action === "BUY";
  const [closing, setClosing] = useState(false);
  const [exitInput, setExitInput] = useState("");
  const time = new Date(trade.entryTime).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="group rounded-md bg-surface ring-1 ring-line transition-colors hover:ring-line-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white ${
              isBuy ? "bg-pos" : "bg-neg"
            }`}
          >
            {trade.action}
          </span>
          <span className="truncate text-[13px] font-bold text-ink">{trade.symbol}</span>
          <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-3">
            ×{trade.quantity}
          </span>
          {isOpen && (
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-pos">
              <span className="h-1.5 w-1.5 rounded-full bg-pos" />
              Open
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[11px] tabular-nums text-ink-3">{time}</span>
          {onDelete && (
            <button
              onClick={() => onDelete(trade.id)}
              aria-label="Delete trade"
              title="Delete trade"
              className="rounded p-1 text-ink-3 opacity-0 transition-all hover:text-neg focus:opacity-100 group-hover:opacity-100"
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Price levels */}
      <div className="grid grid-cols-3 divide-x divide-line border-y border-line text-center">
        <div className="px-1 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">Entry</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums text-ink">₹{trade.entryPrice.toFixed(2)}</p>
        </div>
        <div className="px-1 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">Target</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums text-pos">
            {trade.targetPrice ? `₹${trade.targetPrice.toFixed(2)}` : "—"}
          </p>
        </div>
        <div className="px-1 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">Stop-loss</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums text-neg">
            {trade.slPrice ? `₹${trade.slPrice.toFixed(2)}` : "—"}
          </p>
        </div>
      </div>

      {/* Footer: close controls for open, exit + P&L pill for closed */}
      <div className="px-3 py-2.5">
        {isOpen && onClose &&
          (closing ? (
            <span className="flex items-center gap-2">
              <span className="flex flex-1 items-center rounded-md bg-surface-2 px-3 py-1.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent/50">
                <span className="mr-1 font-mono text-[12px] text-ink-3">₹</span>
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  value={exitInput}
                  onChange={(e) => setExitInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = Number(exitInput);
                      if (exitInput && Number.isFinite(v)) {
                        onClose(trade.id, v);
                        setClosing(false);
                      }
                    } else if (e.key === "Escape") {
                      setClosing(false);
                    }
                  }}
                  placeholder={trade.entryPrice.toFixed(2)}
                  className="w-full min-w-0 bg-transparent text-right font-mono text-[13px] font-semibold tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </span>
              <button
                onClick={() => {
                  const v = Number(exitInput);
                  if (exitInput && Number.isFinite(v)) {
                    onClose(trade.id, v);
                    setClosing(false);
                  }
                }}
                aria-label="Confirm close"
                className="flex h-8 items-center justify-center rounded-md bg-pos px-3 text-white transition hover:brightness-110 active:brightness-95"
              >
                <Icon name="check" className="h-4 w-4" />
              </button>
              <button
                onClick={() => setClosing(false)}
                aria-label="Cancel"
                className="flex h-8 items-center justify-center rounded-md bg-surface-2 px-3 text-[12px] font-bold text-ink-2 ring-1 ring-line transition-colors hover:text-ink"
              >
                ✕
              </button>
            </span>
          ) : (
            <button
              onClick={() => {
                setExitInput(trade.entryPrice.toFixed(2));
                setClosing(true);
              }}
              className="h-8 w-full rounded-md bg-ink text-[11px] font-bold uppercase tracking-[0.08em] text-canvas transition hover:opacity-90"
            >
              Close position
            </button>
          ))}
        {!isOpen && (
          <div className="flex items-center justify-between rounded-md bg-surface-2 px-2.5 py-1.5 ring-1 ring-line">
            <span className="font-mono text-[11px] text-ink-3">
              Exit <b className="font-semibold text-ink">₹{trade.exitPrice?.toFixed(2)}</b>
            </span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[12px] font-bold tabular-nums ${
                trade.pnl >= 0
                  ? "bg-pos/10 text-pos"
                  : "bg-neg/10 text-neg"
              }`}
            >
              {trade.pnl >= 0 ? "+" : "−"}₹{Math.abs(trade.pnl).toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
