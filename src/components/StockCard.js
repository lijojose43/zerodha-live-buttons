import { useEffect, useMemo, useState } from "react";
import ZerodhaLivePriceButton from "./ZerodhaLivePriceButton";
import Icon from "./icons";
import { getBrokerage } from "../charges";
import { getCompanyDomain, getCompanyLogoUrl } from "../companyLogos";

/* Editable price cell — ₹ prefix + monospace right-aligned input. */
function PriceCell({ value, onChange, onBlur, onKeyDown, step, min, ariaLabel }) {
  return (
    <span className="flex items-center font-mono text-[12px] tabular-nums text-ink">
      <span className="mr-0.5 text-ink-3">₹</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        step={step}
        min={min}
        aria-label={ariaLabel}
        name={ariaLabel}
        className="w-[68px] min-w-0 bg-transparent text-right tabular-nums outline-none rounded focus:ring-1 focus:ring-accent/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </span>
  );
}

/* Static row inside the levels panel. */
function LevelRow({ label, children, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-2 py-[3px]">
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
        {label}
      </span>
      <span
        className={`font-mono text-[12px] tabular-nums ${
          strong ? "font-semibold text-ink" : "text-ink-2"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

export default function StockCard({
  id,
  // UI display symbol (trading symbol)
  symbol,
  // Upstox instrument key used for API; if not provided, fallback to `symbol`
  instrumentKey: instrumentKeyProp,
  exchange = "NSE",
  quantity = 1,
  tickSize = 0.05,
  // Live price pushed from App (feed). Manual edits pause the follow.
  livePrice = null,
  // Optional: auto-calc quantity per stock using capital and leverage
  capitalPerStock,
  leverage = 5,
  targetPct = 1,
  slPct = 0.5,
  onRename,
  onDelete,
}) {
  const [ltp, setLtp] = useState(0);
  const [ltpInput, setLtpInput] = useState("");
  const [ltpStatus, setLtpStatus] = useState("manual"); // manual | ok | error
  const [followLive, setFollowLive] = useState(true);

  // Custom target and SL prices (null means use calculated values)
  const [customBuyTarget, setCustomBuyTarget] = useState(null);
  const [customBuyTargetInput, setCustomBuyTargetInput] = useState("");
  const [customBuySL, setCustomBuySL] = useState(null);
  const [customBuySLInput, setCustomBuySLInput] = useState("");
  const [customSellTarget, setCustomSellTarget] = useState(null);
  const [customSellTargetInput, setCustomSellTargetInput] = useState("");
  const [customSellSL, setCustomSellSL] = useState(null);
  const [customSellSLInput, setCustomSellSLInput] = useState("");
  const roundToTick = (p) => {
    if (!tickSize || tickSize <= 0) return Number(p.toFixed(2));
    return Math.round(p / tickSize) * tickSize;
  };

  // Instrument key used for API requests. Prefer explicit prop; fallback to `symbol`.
  // Supports forms like 'NSE_EQ|RELIANCE' or 'NSE_EQ:RELIANCE'.
  const instrumentKey = useMemo(() => {
    const base = instrumentKeyProp ?? symbol;
    return String(base || "")
      .toUpperCase()
      .trim();
  }, [instrumentKeyProp, symbol]);

  // Derive a trading symbol from the instrument_key
  // Take the part after '|' or ':' if present, else the whole string
  const tradingSymbol = useMemo(() => {
    const raw = String(instrumentKey || symbol || "").trim();
    const afterPipe = raw.includes("|") ? raw.split("|").pop() : raw;
    const afterColon = afterPipe.includes(":")
      ? afterPipe.split(":").pop()
      : afterPipe;
    return String(afterColon || "").toUpperCase();
  }, [instrumentKey, symbol]);

  // Local input state for symbol name editing
  const [nameInput, setNameInput] = useState(String(symbol || ""));
  useEffect(() => {
    setNameInput(String(symbol || ""));
  }, [symbol]);

  // Load saved LTP and custom prices from localStorage on instrument change
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(`ltp:${instrumentKey}`);
      const n = saved ? Number(saved) : 0;
      if (Number.isFinite(n) && n > 0) {
        setLtp(n);
        setLtpInput(String(n));
      } else {
        setLtp(0);
        setLtpInput("");
      }

      // Load custom target and SL values
      const savedBuyTarget = window.localStorage.getItem(
        `buyTarget:${instrumentKey}`
      );
      const savedBuySL = window.localStorage.getItem(`buySL:${instrumentKey}`);
      const savedSellTarget = window.localStorage.getItem(
        `sellTarget:${instrumentKey}`
      );
      const savedSellSL = window.localStorage.getItem(
        `sellSL:${instrumentKey}`
      );

      const buyTargetVal = savedBuyTarget ? Number(savedBuyTarget) : null;
      const buySLVal = savedBuySL ? Number(savedBuySL) : null;
      const sellTargetVal = savedSellTarget ? Number(savedSellTarget) : null;
      const sellSLVal = savedSellSL ? Number(savedSellSL) : null;

      setCustomBuyTarget(buyTargetVal);
      setCustomBuyTargetInput(buyTargetVal ? String(buyTargetVal) : "");
      setCustomBuySL(buySLVal);
      setCustomBuySLInput(buySLVal ? String(buySLVal) : "");
      setCustomSellTarget(sellTargetVal);
      setCustomSellTargetInput(sellTargetVal ? String(sellTargetVal) : "");
      setCustomSellSL(sellSLVal);
      setCustomSellSLInput(sellSLVal ? String(sellSLVal) : "");
    }
    setLtpStatus("manual");
  }, [instrumentKey]);

  // Follow the live feed unless the user typed a manual price.
  useEffect(() => {
    if (followLive && Number.isFinite(livePrice) && livePrice > 0) {
      setLtp(livePrice);
      setLtpInput(String(livePrice));
      setLtpStatus("ok");
      try {
        window.localStorage.setItem(`ltp:${instrumentKey}`, String(livePrice));
      } catch {}
    }
  }, [livePrice, followLive, instrumentKey]);

  // Persist LTP on blur of input instead of every change
  const autoQty = useMemo(
    () =>
      ltp > 0 && capitalPerStock
        ? Math.max(1, Math.floor(capitalPerStock / ltp))
        : null,
    [ltp, capitalPerStock]
  );
  const effectiveQty = autoQty || quantity || 1;
  const calculatedBuyTarget = ltp
    ? roundToTick(ltp * (1 + (targetPct || 0) / 100))
    : 0;
  const calculatedBuySL = ltp ? roundToTick(ltp * (1 - (slPct || 0) / 100)) : 0;
  const calculatedSellTarget = ltp
    ? roundToTick(ltp * (1 - (targetPct || 0) / 100))
    : 0;
  const calculatedSellSL = ltp
    ? roundToTick(ltp * (1 + (slPct || 0) / 100))
    : 0;

  // Update all calculated values when LTP changes - clear custom overrides
  useEffect(() => {
    if (ltp > 0) {
      // Clear custom values and their input states when LTP changes
      // This ensures all values update based on the new LTP
      setCustomBuyTarget(null);
      setCustomBuyTargetInput("");
      setCustomBuySL(null);
      setCustomBuySLInput("");
      setCustomSellTarget(null);
      setCustomSellTargetInput("");
      setCustomSellSL(null);
      setCustomSellSLInput("");
    }
  }, [ltp]);

  // Use custom values if set, otherwise use calculated values
  const buyTarget =
    customBuyTarget !== null ? customBuyTarget : calculatedBuyTarget;
  const buySL = customBuySL !== null ? customBuySL : calculatedBuySL;
  const sellTarget =
    customSellTarget !== null ? customSellTarget : calculatedSellTarget;
  const sellSL = customSellSL !== null ? customSellSL : calculatedSellSL;

  // Brokerage/charges — shared engine (see src/charges.js).
  // Kept as a closure so existing call sites stay unchanged.
  const getBrokerageForCard = (buyPrice, sellPrice, qty) =>
    getBrokerage(buyPrice, sellPrice, qty, exchange);

  // Net Profit/Loss after charges
  const potentialBuyProfit =
    ltp && buyTarget
      ? (buyTarget - ltp) * effectiveQty -
        getBrokerageForCard(ltp, buyTarget, effectiveQty)
      : 0;
  const potentialBuyLoss =
    ltp && buySL
      ? (ltp - buySL) * effectiveQty + getBrokerageForCard(ltp, buySL, effectiveQty)
      : 0;
  const potentialSellProfit =
    ltp && sellTarget
      ? (ltp - sellTarget) * effectiveQty -
        getBrokerageForCard(sellTarget, ltp, effectiveQty)
      : 0;
  const potentialSellLoss =
    ltp && sellSL
      ? (sellSL - ltp) * effectiveQty + getBrokerageForCard(sellSL, ltp, effectiveQty)
      : 0;

  const openTradingView = () => {
    const sym = String(symbol || "").trim();
    if (!sym) return;
    // Use exchange-prefixed TradingView symbol (e.g., NSE:RELIANCE)
    const tvSymbol = `${String(exchange || "").toUpperCase()}:${tradingSymbol}`;
    const deep = `tradingview://chart?symbol=${encodeURIComponent(tvSymbol)}&interval=5`;
    const web = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}&interval=5`;
    const ua = (
      typeof navigator !== "undefined" ? navigator.userAgent : ""
    ).toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/.test(ua);
    if (!isMobile) {
      // Desktop: open the web chart in a NEW tab.
      window.open(web, "_blank", "noopener,noreferrer");
      return;
    }
    // Mobile: prefer the TradingView app (deep link), fall back to web in a new tab.
    window.location.href = deep;
    setTimeout(() => {
      window.open(web, "_blank", "noopener,noreferrer");
    }, 800);
  };

  // Risk : reward (per side) for display
  const buyRR =
    ltp && buyTarget && buySL && ltp - buySL > 0
      ? (buyTarget - ltp) / (ltp - buySL)
      : 0;
  const sellRR =
    ltp && sellTarget && sellSL && sellSL - ltp > 0
      ? (ltp - sellTarget) / (sellSL - ltp)
      : 0;

  // Real company logo (Clearbit) with first-letter fallback.
  const logoDomain = getCompanyDomain(tradingSymbol);
  const logoUrl = getCompanyLogoUrl(tradingSymbol, 128);
  const [logoOk, setLogoOk] = useState(true);
  useEffect(() => {
    setLogoOk(true);
  }, [logoDomain]);

  const numField = (setInput, setValue) => (e) => {
    const inputValue = e.target.value;
    // Allow partial inputs including trailing dots and incomplete decimals
    const regex = /^\d{0,5}(\.\d{0,2})?$|^\d{0,5}\.$|^$/;
    if (regex.test(inputValue)) {
      setInput(inputValue);
      const val = Number(inputValue);
      setValue(Number.isFinite(val) && val > 0 ? val : null);
    }
  };

  return (
    <div className="flex h-full flex-col rounded-lg bg-surface ring-1 ring-line transition-colors duration-150 hover:ring-line-2">
      {/* ---------- header: identity + LTP ---------- */}
      <div className="flex items-start justify-between gap-3 border-b border-line p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {logoUrl && logoOk ? (
            <div className="relative h-7 w-7 shrink-0">
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-surface-2 text-[11px] font-bold text-ink-2 ring-1 ring-line">
                {String(symbol || "?").charAt(0).toUpperCase()}
              </div>
              <img
                src={logoUrl}
                alt={`${tradingSymbol} logo`}
                loading="lazy"
                onError={() => setLogoOk(false)}
                className="absolute inset-0 h-7 w-7 rounded-md bg-surface object-contain p-0.5 ring-1 ring-line"
              />
            </div>
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[11px] font-bold text-ink-2 ring-1 ring-line">
              {String(symbol || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value.toUpperCase())}
              onBlur={() => {
                const v = String(nameInput || "")
                  .toUpperCase()
                  .trim();
                if (!v) {
                  onDelete && id && onDelete(id);
                } else if (onRename && id) {
                  onRename(id, v);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="SYMBOL"
              aria-label="Instrument symbol"
              name="symbol"
              className="w-full min-w-0 rounded border border-transparent bg-transparent px-0.5 text-[14px] font-bold uppercase tracking-wide text-ink outline-none transition-colors hover:border-line-2 focus:border-accent/50"
            />
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              <span>{exchange} · EQ</span>
              <span className="h-2.5 w-px bg-line-2" />
              <button
                type="button"
                onClick={openTradingView}
                className="rounded p-0.5 transition-colors hover:bg-surface-2 hover:text-ink-2"
                title="Open in TradingView"
                aria-label="Open in TradingView"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="M14 3h7v7" />
                  <path d="M10 14 21 3" />
                  <path d="M21 14v7h-7" />
                  <path d="M3 10V3h7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end">
            <span className="mr-1 font-mono text-[13px] text-ink-3">₹</span>
            <input
              type="number"
              inputMode="decimal"
              value={ltpInput}
              onChange={(e) => {
                const inputValue = e.target.value;
                // Allow partial inputs including trailing dots and incomplete decimals
                const regex = /^\d{0,5}(\.\d{0,2})?$|^\d{0,5}\.$|^$/;
                if (regex.test(inputValue)) {
                  setLtpInput(inputValue);
                  const val = Number(inputValue);
                  setLtp(Number.isFinite(val) ? val : 0);
                  setLtpStatus("manual");
                  setFollowLive(false);
                }
              }}
              onBlur={(e) => {
                if (typeof window !== "undefined") {
                  const val = Number(e.currentTarget.value);
                  if (Number.isFinite(val) && val > 0) {
                    setLtp(val);
                    setLtpInput(String(val));
                    window.localStorage.setItem(
                      `ltp:${instrumentKey}`,
                      String(val)
                    );
                  } else {
                    window.localStorage.removeItem(`ltp:${instrumentKey}`);
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              step={tickSize || 0.05}
              min="0"
              placeholder="0.00"
              aria-label="Last traded price"
              name="ltp"
              className="w-24 bg-transparent text-right text-lg font-bold tabular-nums text-ink outline-none rounded focus:ring-1 focus:ring-accent/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em]">
            {ltpStatus === "ok" && (
              <span className="inline-flex items-center gap-1 text-pos">
                <span className="h-1.5 w-1.5 rounded-full bg-pos" />
                Live
              </span>
            )}
            {ltpStatus === "manual" &&
              (Number.isFinite(livePrice) && livePrice > 0 ? (
                <button
                  onClick={() => setFollowLive(true)}
                  className="rounded text-ink-3 underline decoration-dotted underline-offset-2 transition-colors hover:text-ink-2"
                  title="Resume live price"
                >
                  Manual · resume live
                </button>
              ) : (
                <span className="text-ink-3">Manual entry</span>
              ))}
            {ltpStatus === "error" && (
              <span className="text-neg">Feed error</span>
            )}
          </div>
        </div>
      </div>

      {/* ---------- levels: long / short ---------- */}
      <div className="grid grid-cols-2 divide-x divide-line">
        {/* LONG */}
        <div className="p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-pos">
            <Icon name="arrowUp" className="h-3 w-3" /> Long
          </div>
          <LevelRow label="Target">
            <PriceCell
              value={
                customBuyTargetInput ||
                (customBuyTarget === null && buyTarget > 0
                  ? buyTarget.toFixed(2)
                  : "")
              }
              onChange={numField(setCustomBuyTargetInput, setCustomBuyTarget)}
              onBlur={(e) => {
                if (typeof window !== "undefined") {
                  const val = Number(e.currentTarget.value);
                  if (Number.isFinite(val) && val > 0) {
                    setCustomBuyTarget(val);
                    setCustomBuyTargetInput(String(val));
                    window.localStorage.setItem(
                      `buyTarget:${instrumentKey}`,
                      String(val)
                    );
                  } else {
                    window.localStorage.removeItem(`buyTarget:${instrumentKey}`);
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              step={tickSize || 0.05}
              min="0"
              ariaLabel="Long target price"
            />
          </LevelRow>
          <LevelRow label="Stop loss">
            <PriceCell
              value={
                customBuySLInput ||
                (customBuySL === null && buySL > 0 ? buySL.toFixed(2) : "")
              }
              onChange={numField(setCustomBuySLInput, setCustomBuySL)}
              onBlur={(e) => {
                if (typeof window !== "undefined") {
                  const val = Number(e.currentTarget.value);
                  if (Number.isFinite(val) && val > 0) {
                    setCustomBuySL(val);
                    setCustomBuySLInput(String(val));
                    window.localStorage.setItem(
                      `buySL:${instrumentKey}`,
                      String(val)
                    );
                  } else {
                    window.localStorage.removeItem(`buySL:${instrumentKey}`);
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              step={tickSize || 0.05}
              min="0"
              ariaLabel="Long stop loss price"
            />
          </LevelRow>
          <LevelRow label="Qty" strong>
            {effectiveQty}
          </LevelRow>
          <LevelRow label="R:R" strong>
            {buyRR > 0 ? `${buyRR.toFixed(2)} : 1` : "—"}
          </LevelRow>
          <div className="mt-1.5 flex items-center justify-between rounded bg-pos/8 px-2 py-1 text-[11px] font-semibold text-pos">
            <span className="uppercase tracking-wide">Profit</span>
            <span className="font-mono tabular-nums">
              ₹{potentialBuyProfit.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between rounded bg-neg/8 px-2 py-1 text-[11px] font-semibold text-neg">
            <span className="uppercase tracking-wide">Loss</span>
            <span className="font-mono tabular-nums">
              ₹{potentialBuyLoss.toFixed(2)}
            </span>
          </div>
        </div>

        {/* SHORT */}
        <div className="p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-neg">
            <Icon name="arrowDown" className="h-3 w-3" /> Short
          </div>
          <LevelRow label="Target">
            <PriceCell
              value={
                customSellTargetInput ||
                (customSellTarget === null && sellTarget > 0
                  ? sellTarget.toFixed(2)
                  : "")
              }
              onChange={numField(setCustomSellTargetInput, setCustomSellTarget)}
              onBlur={(e) => {
                if (typeof window !== "undefined") {
                  const val = Number(e.currentTarget.value);
                  if (Number.isFinite(val) && val > 0) {
                    setCustomSellTarget(val);
                    setCustomSellTargetInput(String(val));
                    window.localStorage.setItem(
                      `sellTarget:${instrumentKey}`,
                      String(val)
                    );
                  } else {
                    window.localStorage.removeItem(`sellTarget:${instrumentKey}`);
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              step={tickSize || 0.05}
              min="0"
              ariaLabel="Short target price"
            />
          </LevelRow>
          <LevelRow label="Stop loss">
            <PriceCell
              value={
                customSellSLInput ||
                (customSellSL === null && sellSL > 0 ? sellSL.toFixed(2) : "")
              }
              onChange={numField(setCustomSellSLInput, setCustomSellSL)}
              onBlur={(e) => {
                if (typeof window !== "undefined") {
                  const val = Number(e.currentTarget.value);
                  if (Number.isFinite(val) && val > 0) {
                    setCustomSellSL(val);
                    setCustomSellSLInput(String(val));
                    window.localStorage.setItem(
                      `sellSL:${instrumentKey}`,
                      String(val)
                    );
                  } else {
                    window.localStorage.removeItem(`sellSL:${instrumentKey}`);
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              step={tickSize || 0.05}
              min="0"
              ariaLabel="Short stop loss price"
            />
          </LevelRow>
          <LevelRow label="Qty" strong>
            {effectiveQty}
          </LevelRow>
          <LevelRow label="R:R" strong>
            {sellRR > 0 ? `${sellRR.toFixed(2)} : 1` : "—"}
          </LevelRow>
          <div className="mt-1.5 flex items-center justify-between rounded bg-pos/8 px-2 py-1 text-[11px] font-semibold text-pos">
            <span className="uppercase tracking-wide">Profit</span>
            <span className="font-mono tabular-nums">
              ₹{potentialSellProfit.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between rounded bg-neg/8 px-2 py-1 text-[11px] font-semibold text-neg">
            <span className="uppercase tracking-wide">Loss</span>
            <span className="font-mono tabular-nums">
              ₹{potentialSellLoss.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ---------- execution ---------- */}
      <div className="mt-auto border-t border-line p-3">
        <div className="grid grid-cols-2 gap-2">
          <ZerodhaLivePriceButton
            symbol={symbol}
            action="BUY"
            quantity={effectiveQty}
            exchange={exchange}
            tickSize={tickSize}
            currentPrice={ltp}
            targetPct={targetPct}
            slPct={slPct}
            overrideTargetPrice={buyTarget}
            overrideSLTrigger={buySL}
            compact
            className="justify-center w-full"
          />
          <ZerodhaLivePriceButton
            symbol={symbol}
            action="SELL"
            quantity={effectiveQty}
            exchange={exchange}
            tickSize={tickSize}
            currentPrice={ltp}
            targetPct={targetPct}
            slPct={slPct}
            overrideTargetPrice={sellTarget}
            overrideSLTrigger={sellSL}
            compact
            className="justify-center w-full"
          />
        </div>
        <p className="mt-2 text-center text-[10px] tracking-wide text-ink-3">
          Net of all 6 NSE charge heads · R:R recalculates on every tick
        </p>
      </div>
    </div>
  );
}
