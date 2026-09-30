import { useEffect, useMemo, useState } from "react";
import ZerodhaLivePriceButton from "./ZerodhaLivePriceButton";
import { getBrokerage } from "../charges";

export default function StockCard({
  id,
  // UI display symbol (trading symbol)
  symbol,
  // Upstox instrument key used for API; if not provided, fallback to `symbol`
  instrumentKey: instrumentKeyProp,
  exchange = "NSE",
  quantity = 1,
  tickSize = 0.05,
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

  // Upstox instrument_key used for API requests. Prefer explicit prop; fallback to `symbol`.
  // Supports forms like 'NSE_EQ|RELIANCE' or 'NSE_EQ:RELIANCE'.
  const instrumentKey = useMemo(() => {
    const base = instrumentKeyProp ?? symbol;
    return String(base || "")
      .toUpperCase()
      .trim();
  }, [instrumentKeyProp, symbol]);

  // Derive a trading symbol for Zerodha Publisher buttons from the instrument_key
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

  // Live price fetching is disabled (Upstox removed). Manual entry enabled.
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
    // Prefer opening the TradingView app (deep link). If it fails, fallback in the same tab.
    window.location.href = deep;
    setTimeout(() => {
      // Fallback to web in the SAME tab (no new tab)
      window.location.href = web;
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

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white text-slate-900 dark:bg-slate-900 dark:text-white p-4 shadow-lg ring-1 ring-slate-200 dark:ring-slate-800 w-full transition-shadow hover:shadow-xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="self-start flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-sm font-extrabold text-white shadow-md">
            {String(symbol || "?").charAt(0).toUpperCase()}
          </div>
          <div>
          <div className="flex items-center gap-2">
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
              className="text-left text-lg font-semibold tracking-wide bg-transparent border-b border-transparent focus:border-slate-400 outline-none"
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>{exchange}</span>
            <button
              type="button"
              onClick={openTradingView}
              className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Open in TradingView"
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
        <div className="text-right self-start justify-self-end">
          <div className="relative flex items-center">
            <span className="text-2xl font-mono text-slate-600 dark:text-slate-400 mr-1">
              ₹
            </span>
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
              className="block w-24 h-8 leading-8 p-0 text-right text-2xl font-mono bg-transparent appearance-none focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {ltpStatus === "manual" && "Manual price"}
            {ltpStatus === "ok" && "Live price"}
            {ltpStatus === "error" && "Error fetching LTP"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <div className="rounded-xl bg-gradient-to-b from-emerald-50 to-slate-100 dark:from-emerald-950/40 dark:to-slate-800 p-3 ring-1 ring-emerald-200/60 dark:ring-emerald-900/40">
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
            ▲ Long
          </div>
          <div className="flex justify-between text-base">
            <span className="text-slate-600 dark:text-slate-400">TA</span>
            <div className="relative flex items-center">
              <span className="text-base font-mono text-slate-600 dark:text-slate-400 mr-1">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={
                  customBuyTargetInput ||
                  (customBuyTarget === null && buyTarget > 0
                    ? buyTarget.toFixed(2)
                    : "")
                }
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const regex = /^\d{0,5}(\.\d{0,2})?$|^\d{0,5}\.$|^$/;
                  if (regex.test(inputValue)) {
                    setCustomBuyTargetInput(inputValue);
                    const val = Number(inputValue);
                    setCustomBuyTarget(
                      Number.isFinite(val) && val > 0 ? val : null
                    );
                  }
                }}
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
                placeholder="0.00"
                className="w-20 min-w-0 text-right text-base font-mono bg-transparent focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
            </div>
          </div>
          <div className="flex justify-between text-base">
            <span className="text-slate-600 dark:text-slate-400">SL</span>
            <div className="relative flex items-center">
              <span className="text-base font-mono text-slate-600 dark:text-slate-400 mr-1">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={
                  customBuySLInput ||
                  (customBuySL === null && buySL > 0 ? buySL.toFixed(2) : "")
                }
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const regex = /^\d{0,5}(\.\d{0,2})?$|^\d{0,5}\.$|^$/;
                  if (regex.test(inputValue)) {
                    setCustomBuySLInput(inputValue);
                    const val = Number(inputValue);
                    setCustomBuySL(
                      Number.isFinite(val) && val > 0 ? val : null
                    );
                  }
                }}
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
                placeholder="0.00"
                className="w-20 min-w-0 text-right text-base font-mono bg-transparent focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
            </div>
          </div>
          <div className="flex justify-between text-base text-slate-600 dark:text-slate-400">
            <span>Qty</span>
            <span className="font-semibold text-slate-900 dark:text-white">{effectiveQty}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>R:R</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{buyRR > 0 ? buyRR.toFixed(2) : "—"}</span>
          </div>
          <div className="mt-2 flex justify-between gap-2 rounded-md bg-emerald-500/10 px-2 py-1 text-base font-medium text-green-600 dark:text-green-300">
            <span className="shrink-0">Profit</span>
            <span className="truncate tabular-nums">₹{potentialBuyProfit.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-2 rounded-md bg-red-500/10 px-2 py-1 text-base font-medium text-red-600 dark:text-red-300">
            <span className="shrink-0">Loss</span>
            <span className="truncate tabular-nums">₹{potentialBuyLoss.toFixed(2)}</span>
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-b from-rose-50 to-slate-100 dark:from-rose-950/40 dark:to-slate-800 p-3 ring-1 ring-rose-200/60 dark:ring-rose-900/40">
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
            ▼ Short
          </div>
          <div className="flex justify-between text-base">
            <span className="text-slate-600 dark:text-slate-400">SL</span>
            <div className="relative flex items-center">
              <span className="text-base font-mono text-slate-600 dark:text-slate-400 mr-1">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={
                  customSellSLInput ||
                  (customSellSL === null && sellSL > 0 ? sellSL.toFixed(2) : "")
                }
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const regex = /^\d{0,5}(\.\d{0,2})?$|^\d{0,5}\.$|^$/;
                  if (regex.test(inputValue)) {
                    setCustomSellSLInput(inputValue);
                    const val = Number(inputValue);
                    setCustomSellSL(
                      Number.isFinite(val) && val > 0 ? val : null
                    );
                  }
                }}
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
                placeholder="0.00"
                className="w-20 min-w-0 text-right text-base font-mono bg-transparent focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
            </div>
          </div>
          <div className="flex justify-between text-base">
            <span className="text-slate-600 dark:text-slate-400">TA</span>
            <div className="relative flex items-center">
              <span className="text-base font-mono text-slate-600 dark:text-slate-400 mr-1">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={
                  customSellTargetInput ||
                  (customSellTarget === null && sellTarget > 0
                    ? sellTarget.toFixed(2)
                    : "")
                }
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const regex = /^\d{0,5}(\.\d{0,2})?$|^\d{0,5}\.$|^$/;
                  if (regex.test(inputValue)) {
                    setCustomSellTargetInput(inputValue);
                    const val = Number(inputValue);
                    setCustomSellTarget(
                      Number.isFinite(val) && val > 0 ? val : null
                    );
                  }
                }}
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
                placeholder="0.00"
                className="w-20 min-w-0 text-right text-base font-mono bg-transparent focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
            </div>
          </div>
          <div className="flex justify-between text-base text-slate-600 dark:text-slate-400">
            <span>Qty</span>
            <span className="font-semibold text-slate-900 dark:text-white">{effectiveQty}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>R:R</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{sellRR > 0 ? sellRR.toFixed(2) : "—"}</span>
          </div>
          <div className="mt-2 flex justify-between gap-2 rounded-md bg-emerald-500/10 px-2 py-1 text-base font-medium text-green-600 dark:text-green-300">
            <span className="shrink-0">Profit</span>
            <span className="truncate tabular-nums">₹{potentialSellProfit.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-2 rounded-md bg-red-500/10 px-2 py-1 text-base font-medium text-red-600 dark:text-red-300">
            <span className="shrink-0">Loss</span>
            <span className="truncate tabular-nums">₹{potentialSellLoss.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-center text-[11px] tracking-wide text-slate-400 dark:text-slate-500">
        Net after all 6 Zerodha charge heads · R:R updates live
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
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
    </div>
  );
}
