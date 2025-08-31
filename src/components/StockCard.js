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
  const [ltpStatus, setLtpStatus] = useState("idle"); // idle | ok | error | unauth
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

  useEffect(() => {
    let timer;
    let stopped = false;
    const pollMs = 2500;

    const fetchLtp = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("upstoxToken")
          : "";
      if (!token) {
        setLtpStatus("unauth");
        return;
      }
      try {
        setLtpStatus((s) => (s === "ok" ? s : "idle"));
        const url = `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(
          instrumentKey
        )}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setLtpStatus("error");
          return;
        }
        const json = await res.json();
        // Support both '|' and ':' in response keys and also match nested instrument_token.
        // Example: request 'NSE_EQ|INE002A01018' but response key is 'NSE_EQ:RELIANCE' with instrument_token 'NSE_EQ|INE002A01018'.
        const pipeKey = instrumentKey.includes(":") ? instrumentKey.replace(":", "|") : instrumentKey;
        const colonKey = instrumentKey.includes("|") ? instrumentKey.replace("|", ":") : instrumentKey;
        const dataObj = json?.data || {};
        let last = (dataObj[pipeKey]?.last_price ?? dataObj[colonKey]?.last_price);
        if (typeof last !== "number") {
          for (const [k, v] of Object.entries(dataObj)) {
            const tok = v && v.instrument_token;
            if (tok === pipeKey || tok === colonKey) {
              last = v.last_price;
              break;
            }
          }
        }
        if (typeof last === "number" && !Number.isNaN(last)) {
          setLtp(last);
          setLtpStatus("ok");
        } else {
          setLtpStatus("error");
        }
      } catch (e) {
        // Likely CORS/network error if running purely client-side
        setLtpStatus("error");
      }
    };

    const loop = async () => {
      await fetchLtp();
      if (!stopped) timer = setTimeout(loop, pollMs);
    };
    loop();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [instrumentKey]);
  const autoQty = useMemo(
    () =>
      ltp > 0 && capitalPerStock
        ? Math.max(1, Math.floor((capitalPerStock * (leverage || 1)) / ltp))
        : null,
    [ltp, capitalPerStock, leverage]
  );
  const effectiveQty = autoQty || quantity || 1;
  const buyTarget = ltp ? roundToTick(ltp * (1 + (targetPct || 0) / 100)) : 0;
  const buySL = ltp ? roundToTick(ltp * (1 - (slPct || 0) / 100)) : 0;
  const sellTarget = ltp ? roundToTick(ltp * (1 - (targetPct || 0) / 100)) : 0;
  const sellSL = ltp ? roundToTick(ltp * (1 + (slPct || 0) / 100)) : 0;

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
      <div className="flex items-baseline justify-between">
        <div>
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
        <div className="text-right">
          <div className="text-2xl font-mono">
            {ltp ? `₹${ltp.toFixed(2)}` : "--"}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {ltpStatus === "ok" && "Live price"}
            {ltpStatus === "idle" && "Loading..."}
            {ltpStatus === "unauth" && "Set Upstox token in Settings"}
            {ltpStatus === "error" && "Error fetching LTP"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Target</span>
            <span className="font-mono">
              {buyTarget ? `₹${buyTarget.toFixed(2)}` : "--"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">SL</span>
            <span className="font-mono">
              {buySL ? `₹${buySL.toFixed(2)}` : "--"}
            </span>
          </div>
          <div className="mt-2 text-[12px] text-green-600 dark:text-green-300">
            Potential +₹{potentialBuyProfit.toFixed(2)}
          </div>
          <div className="text-[12px] text-red-600 dark:text-red-300">
            Risk -₹{potentialBuyLoss.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Target</span>
            <span className="font-mono">
              {sellTarget ? `₹${sellTarget.toFixed(2)}` : "--"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">SL</span>
            <span className="font-mono">
              {sellSL ? `₹${sellSL.toFixed(2)}` : "--"}
            </span>
          </div>
          <div className="mt-2 text-[12px] text-green-600 dark:text-green-300">
            Potential +₹{potentialSellProfit.toFixed(2)}
          </div>
          <div className="text-[12px] text-red-600 dark:text-red-300">
            Risk -₹{potentialSellLoss.toFixed(2)}
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
          className="justify-center"
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
          className="justify-center"
        />
      </div>
      <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
        Qty: {effectiveQty}
      </div>
    </div>
  );
}
