import { useRef, useEffect, useState } from "react";
import axios from "axios";
import useZerodhaPublisher from "../hooks/useZerodhaPublisher";

export default function ZerodhaLivePriceButton({
  symbol,
  action = "BUY",
  quantity = 1,
  exchange = "NSE",
  finnhubApiKey,
  // Optional: exchange tick size for rounding prices (most NSE eq are 0.05)
  tickSize = 0.05,
}) {
  const { ready, refreshButtons } = useZerodhaPublisher();
  const hiddenLinkRef = useRef(null);
  const wsRef = useRef(null);
  const activeSymbolRef = useRef(null);
  const [price, setPrice] = useState(null);
  const [lastPrice, setLastPrice] = useState(null);
  // Removed dynamic price color changes; keep static color

  useEffect(() => {
    if (ready) {
      refreshButtons();
    }
  }, [ready, symbol, action, quantity, exchange]);

  useEffect(() => {
    if (!finnhubApiKey || !symbol) return;

    // Close any existing socket before creating a new one
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      try {
        wsRef.current.close();
      } catch {}
    }

    const ws = new WebSocket(`wss://ws.finnhub.io?token=${finnhubApiKey}`);
    wsRef.current = ws;
    const ex = (exchange || "").toUpperCase();
    // Try multiple symbol formats to maximize chance of data
    const candidates = Array.from(
      new Set([
        `${ex}:${symbol}`,
        `${symbol}`,
        `${symbol}`,
        `${symbol}`,
        `${symbol}`,
        `${symbol}`,
      ])
    );
    const subscribed = new Set();
    activeSymbolRef.current = null;

    ws.onopen = () => {
      try {
        candidates.forEach((sym) => {
          ws.send(JSON.stringify({ type: "subscribe", symbol: sym }));
          subscribed.add(sym);
        });
      } catch (e) {
        console.error("Finnhub WS subscribe error:", e);
      }
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "trade" && Array.isArray(payload.data)) {
          // Find the first trade that matches any of our candidates
          const trade =
            payload.data.find((t) => candidates.includes(t.s)) ||
            payload.data[0];
          if (trade && typeof trade.p === "number") {
            if (!activeSymbolRef.current && trade.s) {
              activeSymbolRef.current = trade.s;
              // Unsubscribe from other candidates to reduce noise
              try {
                subscribed.forEach((sym) => {
                  if (sym !== trade.s && ws.readyState === WebSocket.OPEN) {
                    ws.send(
                      JSON.stringify({ type: "unsubscribe", symbol: sym })
                    );
                  }
                });
              } catch {}
            }
            const newPrice = trade.p;
            setPrice(newPrice);
            setLastPrice(newPrice);
          }
        }
      } catch (e) {
        console.error("Finnhub WS message parse error:", e);
      }
    };

    ws.onerror = (e) => {
      console.error("Finnhub WS error:", e);
    };

    // One-time REST fetch for an immediate price display using candidates
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
        } catch (err) {
          // try next candidate
        }
      }
    })();

    return () => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          subscribed.forEach((sym) => {
            try {
              ws.send(JSON.stringify({ type: "unsubscribe", symbol: sym }));
            } catch {}
          });
        }
      } catch {}
      try {
        ws.close();
      } catch {}
    };
  }, [symbol, exchange, finnhubApiKey]);

  // Round a price to the nearest valid tick
  const roundToTick = (p) => {
    if (!tickSize || tickSize <= 0) return Number(p.toFixed(2));
    return Math.round(p / tickSize) * tickSize;
  };

  const handleClick = () => {
    // Prefer programmatic Publisher API if available so we can place a 3-leg basket
    try {
      if (!ready || !window.kite || !lastPrice) {
        // Fallback: trigger hidden anchor if Publisher not ready or price missing
        if (hiddenLinkRef.current) hiddenLinkRef.current.click();
        return;
      }

      const txn = (action || "BUY").toUpperCase();

      const ltp = Number(lastPrice);
      if (!ltp || !isFinite(ltp)) {
        if (hiddenLinkRef.current) hiddenLinkRef.current.click();
        return;
      }

      const common = {
        exchange: (exchange || "NSE").toUpperCase(),
        tradingsymbol: symbol,
        quantity: Number(quantity) || 1,
        variety: "regular",
        product: "MIS",
      };

      // Clear any previous staged orders if API exists
      if (typeof window.kite.clear === "function") {
        try {
          window.kite.clear();
        } catch {}
      }

      if (txn === "BUY") {
        const slTrigger = roundToTick(ltp * 0.995); // 0.5% below
        const targetPrice = roundToTick(ltp * 1.01); // 1% above

        // 1) BUY market entry
        window.kite.add({
          ...common,
          transaction_type: "BUY",
          order_type: "MARKET",
        });

        // 2) SELL stop-loss (SL-M)
        window.kite.add({
          ...common,
          transaction_type: "SELL",
          order_type: "SL-M",
          trigger_price: slTrigger,
        });

        // 3) SELL target (LIMIT)
        window.kite.add({
          ...common,
          transaction_type: "SELL",
          order_type: "LIMIT",
          price: targetPrice,
        });
      } else if (txn === "SELL") {
        const slTrigger = roundToTick(ltp * 1.005); // 0.5% above
        const targetPrice = roundToTick(ltp * 0.99); // 1% below

        // 1) SELL market entry
        window.kite.add({
          ...common,
          transaction_type: "SELL",
          order_type: "MARKET",
        });

        // 2) BUY stop-loss (SL-M)
        window.kite.add({
          ...common,
          transaction_type: "BUY",
          order_type: "SL-M",
          trigger_price: slTrigger,
        });

        // 3) BUY target (LIMIT)
        window.kite.add({
          ...common,
          transaction_type: "BUY",
          order_type: "LIMIT",
          price: targetPrice,
        });
      } else {
        // Unknown action, fallback
        if (hiddenLinkRef.current) hiddenLinkRef.current.click();
        return;
      }

      // Open the Publisher basket popup
      if (typeof window.kite.publish === "function") {
        window.kite.publish();
      } else if (hiddenLinkRef.current) {
        // Fallback if publish API not present
        hiddenLinkRef.current.click();
      }
    } catch (e) {
      // As a safety fallback
      if (hiddenLinkRef.current) hiddenLinkRef.current.click();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <a
        ref={hiddenLinkRef}
        href="#"
        style={{ display: "none" }}
        className="kite-button"
        data-kite="v4mpvs6exp4garzl"
        data-exchange={exchange}
        data-tradingsymbol={symbol}
        data-transaction_type={action.toUpperCase()}
        data-quantity={quantity}
        data-order_type="MARKET"
        data-product="MIS"
        data-price="0"
      >
        {action} {symbol}
      </a>

      <button
        onClick={handleClick}
        className={`px-4 py-2 rounded-lg font-semibold shadow-md transition-all flex flex-col items-center
        ${
          action.toUpperCase() === "BUY"
            ? "bg-green-500 hover:bg-green-600 text-white"
            : "bg-red-500 hover:bg-red-600 text-white"
        }`}
      >
        <span>
          {action} {symbol}
        </span>
        <span className="text-sm font-mono text-white">
          {price ? `₹${price}` : "Loading..."}
        </span>
      </button>
    </div>
  );
}
