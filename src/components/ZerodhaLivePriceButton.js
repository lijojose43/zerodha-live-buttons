import { useRef, useEffect, useState } from "react";
import useZerodhaPublisher from "../hooks/useZerodhaPublisher";

export default function ZerodhaLivePriceButton({
  symbol,
  action = "BUY",
  quantity = 1,
  exchange = "NSE",
  // Optional: exchange tick size for rounding prices (most NSE eq are 0.05)
  tickSize = 0.05,
  // Compact mode hides inline price and uses smaller paddings
  compact = false,
  className = "",
  // User-configurable target and stop loss percentages
  targetPct = 1,
  slPct = 0.5,
  // Live price from parent (StockCard)
  currentPrice = null,
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

  // Use currentPrice from parent for display and calculations
  useEffect(() => {
    if (typeof currentPrice === "number" && isFinite(currentPrice)) {
      setLastPrice(currentPrice);
      setPrice(currentPrice);
    }
  }, [currentPrice]);

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
        const slTrigger = roundToTick(ltp * (1 - (slPct || 0) / 100)); // SL below
        const targetPrice = roundToTick(ltp * (1 + (targetPct || 0) / 100)); // Target above

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
        const slTrigger = roundToTick(ltp * (1 + (slPct || 0) / 100)); // SL above
        const targetPrice = roundToTick(ltp * (1 - (targetPct || 0) / 100)); // Target below

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
        className={`${className} ${compact ? "px-3 py-1.5 text-sm" : "px-4 py-2"} rounded-lg font-semibold shadow-md transition-all flex flex-col items-center ${
          action.toUpperCase() === "BUY"
            ? "bg-green-500 hover:bg-green-600 text-white"
            : "bg-red-500 hover:bg-red-600 text-white"
        }`}
      >
        <span>
          {action} {symbol}
        </span>
        {!compact && (
          <span className="text-sm font-mono text-white">
            {typeof price === "number" ? `₹${price.toFixed(2)}` : "Loading..."}
          </span>
        )}
      </button>
    </div>
  );
}
