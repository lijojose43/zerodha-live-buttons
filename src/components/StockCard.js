import { useEffect, useRef, useState } from "react";
import axios from "axios";
import ZerodhaLivePriceButton from "./ZerodhaLivePriceButton";

export default function StockCard({
  symbol,
  exchange = "NSE",
  quantity = 1,
  finnhubApiKey,
  tickSize = 0.05,
}) {
  const wsRef = useRef(null);
  const [price, setPrice] = useState(null);
  const [lastPrice, setLastPrice] = useState(null);

  useEffect(() => {
    if (!finnhubApiKey || !symbol) return;

    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      try { wsRef.current.close(); } catch {}
    }

    const ws = new WebSocket(`wss://ws.finnhub.io?token=${finnhubApiKey}`);
    wsRef.current = ws;
    const ex = (exchange || "").toUpperCase();
    const candidates = Array.from(new Set([`${ex}:${symbol}`, `${symbol}`]));

    ws.onopen = () => {
      try {
        candidates.forEach((sym) => ws.send(JSON.stringify({ type: "subscribe", symbol: sym })));
      } catch {}
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "trade" && Array.isArray(payload.data)) {
          const trade = payload.data.find((t) => candidates.includes(t.s)) || payload.data[0];
          if (trade && typeof trade.p === "number") {
            const p = trade.p;
            setPrice(p);
            setLastPrice(p);
          }
        }
      } catch {}
    };

    (async () => {
      for (const sym of candidates) {
        try {
          const res = await axios.get("https://finnhub.io/api/v1/quote", {
            params: { symbol: sym, token: finnhubApiKey },
          });
          const p = res?.data?.c;
          if (typeof p === "number" && p > 0) {
            setPrice(p);
            setLastPrice(p);
            break;
          }
        } catch {}
      }
    })();

    return () => {
      try { ws.close(); } catch {}
    };
  }, [symbol, exchange, finnhubApiKey]);

  const roundToTick = (p) => {
    if (!tickSize || tickSize <= 0) return Number(p.toFixed(2));
    return Math.round(p / tickSize) * tickSize;
  };

  const ltp = Number(price) || 0;
  const buyTarget = ltp ? roundToTick(ltp * 1.01) : 0;
  const buySL = ltp ? roundToTick(ltp * 0.995) : 0;
  const sellTarget = ltp ? roundToTick(ltp * 0.99) : 0;
  const sellSL = ltp ? roundToTick(ltp * 1.005) : 0;

  const potentialBuyProfit = ltp ? (buyTarget - ltp) * quantity : 0;
  const potentialBuyLoss = ltp ? (ltp - buySL) * quantity : 0;
  const potentialSellProfit = ltp ? (ltp - sellTarget) * quantity : 0;
  const potentialSellLoss = ltp ? (sellSL - ltp) * quantity : 0;

  return (
    <div className="rounded-xl bg-slate-900 text-white p-4 shadow-lg ring-1 ring-slate-800 w-full max-w-sm">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-wide">{symbol}</h3>
          <p className="text-xs text-slate-400">{exchange}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono">{ltp ? `₹${ltp.toFixed(2)}` : "--"}</div>
          <div className="text-[11px] text-slate-400">Live price</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <div className="rounded-lg bg-slate-800 p-3">
          <div className="flex justify-between"><span className="text-slate-400">Target</span><span className="font-mono">{buyTarget ? `₹${buyTarget.toFixed(2)}` : "--"}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">SL</span><span className="font-mono">{buySL ? `₹${buySL.toFixed(2)}` : "--"}</span></div>
          <div className="mt-2 text-[12px] text-green-300">Potential +₹{potentialBuyProfit.toFixed(2)}</div>
          <div className="text-[12px] text-red-300">Risk -₹{potentialBuyLoss.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-slate-800 p-3">
          <div className="flex justify-between"><span className="text-slate-400">Target</span><span className="font-mono">{sellTarget ? `₹${sellTarget.toFixed(2)}` : "--"}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">SL</span><span className="font-mono">{sellSL ? `₹${sellSL.toFixed(2)}` : "--"}</span></div>
          <div className="mt-2 text-[12px] text-green-300">Potential +₹{potentialSellProfit.toFixed(2)}</div>
          <div className="text-[12px] text-red-300">Risk -₹{potentialSellLoss.toFixed(2)}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ZerodhaLivePriceButton
          symbol={symbol}
          action="BUY"
          quantity={quantity}
          exchange={exchange}
          finnhubApiKey={finnhubApiKey}
          tickSize={tickSize}
          compact
          className="justify-center"
        />
        <ZerodhaLivePriceButton
          symbol={symbol}
          action="SELL"
          quantity={quantity}
          exchange={exchange}
          finnhubApiKey={finnhubApiKey}
          tickSize={tickSize}
          compact
          className="justify-center"
        />
      </div>
    </div>
  );
}
