import { useEffect, useMemo, useState } from "react";
import ZerodhaLivePriceButton from "./ZerodhaLivePriceButton";

export default function StockCard({
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
}) {
  const [ltp, setLtp] = useState(0);
  const [ltpInput, setLtpInput] = useState('');
  const [ltpStatus, setLtpStatus] = useState("manual"); // manual | ok | error
  
  // Custom target and SL prices (null means use calculated values)
  const [customBuyTarget, setCustomBuyTarget] = useState(null);
  const [customBuyTargetInput, setCustomBuyTargetInput] = useState('');
  const [customBuySL, setCustomBuySL] = useState(null);
  const [customBuySLInput, setCustomBuySLInput] = useState('');
  const [customSellTarget, setCustomSellTarget] = useState(null);
  const [customSellTargetInput, setCustomSellTargetInput] = useState('');
  const [customSellSL, setCustomSellSL] = useState(null);
  const [customSellSLInput, setCustomSellSLInput] = useState('');
  const roundToTick = (p) => {
    if (!tickSize || tickSize <= 0) return Number(p.toFixed(2));
    return Math.round(p / tickSize) * tickSize;
  };

  // Upstox instrument_key used for API requests. Prefer explicit prop; fallback to `symbol`.
  // Supports forms like 'NSE_EQ|RELIANCE' or 'NSE_EQ:RELIANCE'.
  const instrumentKey = useMemo(() => {
    const base = instrumentKeyProp ?? symbol;
    return String(base || "").toUpperCase().trim();
  }, [instrumentKeyProp, symbol]);

  // Derive a trading symbol for Zerodha Publisher buttons from the instrument_key
  // Take the part after '|' or ':' if present, else the whole string
  const tradingSymbol = useMemo(() => {
    const raw = String(instrumentKey || symbol || "").trim();
    const afterPipe = raw.includes("|") ? raw.split("|").pop() : raw;
    const afterColon = afterPipe.includes(":") ? afterPipe.split(":").pop() : afterPipe;
    return String(afterColon || "").toUpperCase();
  }, [instrumentKey, symbol]);

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
        setLtpInput('');
      }
      
      // Load custom target and SL values
      const savedBuyTarget = window.localStorage.getItem(`buyTarget:${instrumentKey}`);
      const savedBuySL = window.localStorage.getItem(`buySL:${instrumentKey}`);
      const savedSellTarget = window.localStorage.getItem(`sellTarget:${instrumentKey}`);
      const savedSellSL = window.localStorage.getItem(`sellSL:${instrumentKey}`);
      
      const buyTargetVal = savedBuyTarget ? Number(savedBuyTarget) : null;
      const buySLVal = savedBuySL ? Number(savedBuySL) : null;
      const sellTargetVal = savedSellTarget ? Number(savedSellTarget) : null;
      const sellSLVal = savedSellSL ? Number(savedSellSL) : null;
      
      setCustomBuyTarget(buyTargetVal);
      setCustomBuyTargetInput(buyTargetVal ? String(buyTargetVal) : '');
      setCustomBuySL(buySLVal);
      setCustomBuySLInput(buySLVal ? String(buySLVal) : '');
      setCustomSellTarget(sellTargetVal);
      setCustomSellTargetInput(sellTargetVal ? String(sellTargetVal) : '');
      setCustomSellSL(sellSLVal);
      setCustomSellSLInput(sellSLVal ? String(sellSLVal) : '');
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
  const calculatedBuyTarget = ltp ? roundToTick(ltp * (1 + (targetPct || 0) / 100)) : 0;
  const calculatedBuySL = ltp ? roundToTick(ltp * (1 - (slPct || 0) / 100)) : 0;
  const calculatedSellTarget = ltp ? roundToTick(ltp * (1 - (targetPct || 0) / 100)) : 0;
  const calculatedSellSL = ltp ? roundToTick(ltp * (1 + (slPct || 0) / 100)) : 0;
  
  // Update all calculated values when LTP changes - clear custom overrides
  useEffect(() => {
    if (ltp > 0) {
      // Clear custom values and their input states when LTP changes
      // This ensures all values update based on the new LTP
      setCustomBuyTarget(null);
      setCustomBuyTargetInput('');
      setCustomBuySL(null);
      setCustomBuySLInput('');
      setCustomSellTarget(null);
      setCustomSellTargetInput('');
      setCustomSellSL(null);
      setCustomSellSLInput('');
    }
  }, [ltp]);

  // Use custom values if set, otherwise use calculated values
  const buyTarget = customBuyTarget !== null ? customBuyTarget : calculatedBuyTarget;
  const buySL = customBuySL !== null ? customBuySL : calculatedBuySL;
  const sellTarget = customSellTarget !== null ? customSellTarget : calculatedSellTarget;
  const sellSL = customSellSL !== null ? customSellSL : calculatedSellSL;

  // Brokerage/charges calculation based on provided PHP logic
  const round2 = (n) => Math.round(n * 100) / 100;
  const iRound = (n) => Math.round(n);
  const getBrokerage = (buyPrice, sellPrice, qty) => {
    if (!buyPrice || !sellPrice || !qty) return 0;
    const buyTotal = buyPrice * qty;
    const sellTotal = sellPrice * qty;
    const turnover = round2((sellPrice + buyPrice) * qty);

    let brokerageBuy = (buyTotal * 0.03) / 100;
    let brokerageSell = (sellTotal * 0.03) / 100;
    brokerageBuy = brokerageBuy < 20 ? brokerageBuy : 20;
    brokerageSell = brokerageSell < 20 ? brokerageSell : 20;
    const brokerage = round2(brokerageBuy + brokerageSell);

    // STT based on average price of buy and sell
    let stt = iRound(round2(((buyPrice + sellPrice) / 2) * qty * 0.00025));
    if (buyPrice === 0 && sellPrice === 0) stt = 0;

    // SEBI charges
    const sebiCharges = round2(turnover * 0.000001);

    // Exchange transaction charges and NSE IPFT
    const isNSE = (exchange || "").toUpperCase() === "NSE";
    const baseEtc = isNSE ? turnover * 0.0000297 : turnover * 0.0000375;
    const nseIpft = isNSE ? turnover * 0.000001 : 0;
    const transactionCharges = round2(baseEtc + nseIpft);

    // GST on brokerage + etc + sebi
    const gst = round2(0.18 * (brokerage + transactionCharges + sebiCharges));

    // Stamp duty on buy side
    const stampCharges = iRound(round2(buyTotal * 0.00003));

    const totalCharges = round2(
      brokerage + stt + transactionCharges + gst + sebiCharges + stampCharges
    );
    return totalCharges;
  };

  // Net Profit/Loss after charges
  const potentialBuyProfit =
    ltp && buyTarget
      ? (buyTarget - ltp) * effectiveQty -
        getBrokerage(ltp, buyTarget, effectiveQty)
      : 0;
  const potentialBuyLoss =
    ltp && buySL
      ? (ltp - buySL) * effectiveQty + getBrokerage(ltp, buySL, effectiveQty)
      : 0;
  const potentialSellProfit =
    ltp && sellTarget
      ? (ltp - sellTarget) * effectiveQty -
        getBrokerage(sellTarget, ltp, effectiveQty)
      : 0;
  const potentialSellLoss =
    ltp && sellSL
      ? (sellSL - ltp) * effectiveQty + getBrokerage(sellSL, ltp, effectiveQty)
      : 0;

  const openTradingView = () => {
    // Determine a TradingView symbol. Prefer provided exchange, else fallback to plain symbol.
    const ex = (exchange || "").toUpperCase();
    const tvExchange = ex || "NSE";
    const candidates = [`${symbol}`, `${symbol}`];
    const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(
      candidates[0]
    )}&interval=5`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="rounded-xl bg-white text-slate-900 dark:bg-slate-900 dark:text-white p-4 shadow-lg ring-1 ring-slate-200 dark:ring-slate-800 w-full max-w-sm">
      <div className="grid grid-cols-2 gap-4">
        <div className="self-start">
          <button
            type="button"
            onClick={openTradingView}
            className="text-left text-lg font-semibold tracking-wide hover:underline cursor-pointer"
            title="Open 5m TradingView chart"
          >
            {symbol}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {exchange}
          </p>
        </div>
        <div className="text-right self-start justify-self-end">
          <div className="relative">
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
              onBlur={() => {
                if (typeof window !== 'undefined') {
                  if (Number.isFinite(ltp) && ltp > 0) {
                    window.localStorage.setItem(`ltp:${instrumentKey}`, String(ltp));
                  } else {
                    window.localStorage.removeItem(`ltp:${instrumentKey}`);
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              step={tickSize || 0.05}
              min="0"
              placeholder="0.00"
              className="block w-32 h-8 leading-8 p-0 text-right text-2xl font-mono bg-transparent appearance-none focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
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
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
          <div className="flex justify-between text-base">
            <span className="text-slate-600 dark:text-slate-400">Target</span>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={customBuyTargetInput || (customBuyTarget === null && buyTarget > 0 ? buyTarget.toFixed(2) : '')}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const regex = /^\d{0,5}(\.\d{0,2})?$|^\d{0,5}\.$|^$/;
                  if (regex.test(inputValue)) {
                    setCustomBuyTargetInput(inputValue);
                    const val = Number(inputValue);
                    setCustomBuyTarget(Number.isFinite(val) && val > 0 ? val : null);
                  }
                }}
                onBlur={() => {
                  if (typeof window !== 'undefined') {
                    if (customBuyTarget !== null && customBuyTarget > 0) {
                      window.localStorage.setItem(`buyTarget:${instrumentKey}`, String(customBuyTarget));
                    } else {
                      window.localStorage.removeItem(`buyTarget:${instrumentKey}`);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                step={tickSize || 0.05}
                min="0"
                placeholder="0.00"
                className="w-20 text-right text-base font-mono bg-transparent focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
            </div>
          </div>
          <div className="flex justify-between text-base">
            <span className="text-slate-600 dark:text-slate-400">SL</span>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={customBuySLInput || (customBuySL === null && buySL > 0 ? buySL.toFixed(2) : '')}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const regex = /^\d{0,5}(\.\d{0,2})?$|^\d{0,5}\.$|^$/;
                  if (regex.test(inputValue)) {
                    setCustomBuySLInput(inputValue);
                    const val = Number(inputValue);
                    setCustomBuySL(Number.isFinite(val) && val > 0 ? val : null);
                  }
                }}
                onBlur={() => {
                  if (typeof window !== 'undefined') {
                    if (customBuySL !== null && customBuySL > 0) {
                      window.localStorage.setItem(`buySL:${instrumentKey}`, String(customBuySL));
                    } else {
                      window.localStorage.removeItem(`buySL:${instrumentKey}`);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                step={tickSize || 0.05}
                min="0"
                placeholder="0.00"
                className="w-20 text-right text-base font-mono bg-transparent focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
            </div>
          </div>
          <div className="flex justify-between text-base text-slate-600 dark:text-slate-400">
            <span>Qty</span>
            <span className="text-white">{effectiveQty}</span>
          </div>
          <div className="mt-2 flex justify-between text-base font-medium text-green-600 dark:text-green-300">
            <span>Profit</span>
            <span>{potentialBuyProfit.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-medium text-red-600 dark:text-red-300">
            <span>Loss</span>
            <span>{potentialBuyLoss.toFixed(2)}</span>
          </div>
        </div>
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
          <div className="flex justify-between text-base">
            <span className="text-slate-600 dark:text-slate-400">Target</span>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={customSellTargetInput || (customSellTarget === null && sellTarget > 0 ? sellTarget.toFixed(2) : '')}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const regex = /^\d{0,5}(\.\d{0,2})?$|^\d{0,5}\.$|^$/;
                  if (regex.test(inputValue)) {
                    setCustomSellTargetInput(inputValue);
                    const val = Number(inputValue);
                    setCustomSellTarget(Number.isFinite(val) && val > 0 ? val : null);
                  }
                }}
                onBlur={() => {
                  if (typeof window !== 'undefined') {
                    if (customSellTarget !== null && customSellTarget > 0) {
                      window.localStorage.setItem(`sellTarget:${instrumentKey}`, String(customSellTarget));
                    } else {
                      window.localStorage.removeItem(`sellTarget:${instrumentKey}`);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                step={tickSize || 0.05}
                min="0"
                placeholder="0.00"
                className="w-20 text-right text-base font-mono bg-transparent focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
            </div>
          </div>
          <div className="flex justify-between text-base">
            <span className="text-slate-600 dark:text-slate-400">SL</span>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={customSellSLInput || (customSellSL === null && sellSL > 0 ? sellSL.toFixed(2) : '')}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const regex = /^\d{0,5}(\.\d{0,2})?$|^\d{0,5}\.$|^$/;
                  if (regex.test(inputValue)) {
                    setCustomSellSLInput(inputValue);
                    const val = Number(inputValue);
                    setCustomSellSL(Number.isFinite(val) && val > 0 ? val : null);
                  }
                }}
                onBlur={() => {
                  if (typeof window !== 'undefined') {
                    if (customSellSL !== null && customSellSL > 0) {
                      window.localStorage.setItem(`sellSL:${instrumentKey}`, String(customSellSL));
                    } else {
                      window.localStorage.removeItem(`sellSL:${instrumentKey}`);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                step={tickSize || 0.05}
                min="0"
                placeholder="0.00"
                className="w-20 text-right text-base font-mono bg-transparent focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
            </div>
          </div>
          <div className="flex justify-between text-base text-slate-600 dark:text-slate-400">
            <span>Qty</span>
            <span className="text-white">{effectiveQty}</span>
          </div>
          <div className="mt-2 flex justify-between text-base font-medium text-green-600 dark:text-green-300">
            <span>Profit</span>
            <span>{potentialSellProfit.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-medium text-red-600 dark:text-red-300">
            <span>Loss</span>
            <span>{potentialSellLoss.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ZerodhaLivePriceButton
          symbol={symbol}
          action="BUY"
          quantity={effectiveQty}
          exchange={exchange}
          tickSize={tickSize}
          currentPrice={ltp}
          targetPct={targetPct}
          slPct={slPct}
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
          compact
          className="justify-center w-full"
        />
      </div>
    </div>
  );
}
