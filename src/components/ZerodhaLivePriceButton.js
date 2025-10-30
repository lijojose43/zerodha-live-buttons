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
  const { ready, refreshButtons, kite } = useZerodhaPublisher();
  const hiddenLinkRef = useRef(null);
  const wsRef = useRef(null);
  const activeSymbolRef = useRef(null);
  const [price, setPrice] = useState(null);
  const [lastPrice, setLastPrice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
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

  // Round a price to the nearest valid tick with exactly 2 decimal places
  const roundToTick = (p) => {
    if (!tickSize || tickSize <= 0) return Number(p.toFixed(2));
    const tickRounded = Math.round(p / tickSize) * tickSize;
    // Ensure exactly 2 decimal places for SL and Limit orders
    return Number(tickRounded.toFixed(2));
  };

  // When a Kite tab/window opens and the user closes it, focus returns here.
  // Use that signal to clear the busy state so "Processing..." goes away.
  const setupReturnFocusReset = () => {
    let cleared = false;
    const clearBusyState = () => {
      if (cleared) return;
      cleared = true;
      try {
        setBusy(false);
        setLastClickTime(0);
      } catch {}
      window.removeEventListener('focus', onFocus, true);
      document.removeEventListener('visibilitychange', onVisibility, true);
    };
    const onFocus = () => {
      // Small delay to avoid racing with popup/tab close
      setTimeout(clearBusyState, 150);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(clearBusyState, 150);
      }
    };
    window.addEventListener('focus', onFocus, true);
    document.addEventListener('visibilitychange', onVisibility, true);
    return () => {
      window.removeEventListener('focus', onFocus, true);
      document.removeEventListener('visibilitychange', onVisibility, true);
    };
  };

  // Function to temporarily request desktop site mode
  const requestDesktopMode = () => {
    // Store original viewport meta tag
    const originalViewport = document.querySelector('meta[name="viewport"]');
    const originalContent = originalViewport ? originalViewport.getAttribute('content') : null;
    
    // Set desktop mode viewport
    if (originalViewport) {
      originalViewport.setAttribute('content', 'width=1024, initial-scale=1.0, user-scalable=yes');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=1024, initial-scale=1.0, user-scalable=yes';
      document.head.appendChild(meta);
    }
    
    // Restore original viewport after a delay (when Kite page loads)
    setTimeout(() => {
      if (originalViewport && originalContent) {
        originalViewport.setAttribute('content', originalContent);
      } else if (originalViewport) {
        originalViewport.setAttribute('content', 'width=device-width, initial-scale=1');
      }
    }, 3000); // 3 seconds delay to allow Kite page to load
  };

  const handleClick = () => {
    const now = Date.now();
    // Prevent duplicate clicks within 2 seconds
    if (busy || (now - lastClickTime < 2000)) {
      console.log('Duplicate click prevented - order already in progress');
      return;
    }
    
    // Request desktop mode before opening Kite
    requestDesktopMode();
    
    setLastClickTime(now);
    // Prefer programmatic Publisher API if available so we can place a 3-leg basket
    try {
      setBusy(true);
      const hasProgrammatic = ready && !!kite && typeof kite.add === "function";
      if (!lastPrice) {
        // Fallback: trigger hidden anchor if price missing
        if (hiddenLinkRef.current) hiddenLinkRef.current.click();
        setBusy(false);
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
        validity: "DAY",
      };

      // Clear any previous staged orders if API exists
      if (hasProgrammatic && typeof kite.clear === "function") {
        try {
          kite.clear();
        } catch {}
      }

      if (txn === "BUY") {
        const slTrigger = roundToTick(ltp * (1 - (slPct || 0) / 100)); // SL below
        const slLimit = roundToTick(slTrigger - (tickSize || 0.05)); // unused when using SL-M
        const targetPrice = roundToTick(ltp * (1 + (targetPct || 0) / 100)); // Target above
        if (hasProgrammatic) {
          const legs = [
            { ...common, transaction_type: "BUY", order_type: "MARKET" },
            { ...common, transaction_type: "SELL", order_type: "SL-M", trigger_price: slTrigger },
            { ...common, transaction_type: "SELL", order_type: "LIMIT", price: targetPrice },
          ];
          console.debug("[kite] adding BUY legs", legs);
          const addSeq = (i = 0) => {
            if (i >= legs.length) {
              setTimeout(() => {
                try {
                  const cnt = typeof kite.count === 'function' ? kite.count() : undefined;
                  console.debug("[kite] staged legs count:", cnt);
                } catch {}
                // Use link() to open basket per docs
                const id = `kite-launch-${Date.now()}`;
                const btn = document.createElement('button');
                btn.id = id;
                btn.style.display = 'none';
                document.body.appendChild(btn);
                try {
                  // Reset busy when the Publisher finishes (success/cancel)
                  if (typeof kite.finished === 'function') {
                    kite.finished(function () { 
                      setBusy(false);
                      setLastClickTime(0); // Reset click time on completion
                    });
                  }
                  if (typeof kite.link === 'function') {
                    kite.link(`#${id}`);
                  }
                } catch {}
                setTimeout(() => {
                  // Install a one-time focus/visibility handler so if user closes
                  // the Kite window, we clear the Processing state on return.
                  try { setupReturnFocusReset(); } catch {}
                  btn.click();
                  setTimeout(() => document.body.removeChild(btn), 1000);
                }, 50);
              }, 150);
              return;
            }
            try {
              kite.add(legs[i]);
            } catch (e) {
              console.warn("[kite] add failed", e);
            }
            setTimeout(() => addSeq(i + 1), 120);
          };
          addSeq(0);
        } else {
          // Fallback: create and click three hidden anchors sequentially
          const entries = [
            { transaction_type: "BUY", order_type: "MARKET" },
            { transaction_type: "SELL", order_type: "SL-M", trigger_price: slTrigger },
            { transaction_type: "SELL", order_type: "LIMIT", price: targetPrice },
          ];
          const created = entries.map((cfg) => {
            const a = document.createElement("a");
            a.href = "#";
            a.style.display = "none";
            a.className = "kite-button";
            a.target = "_blank";
            a.rel = "noopener";
            a.setAttribute("data-kite", hiddenLinkRef.current?.getAttribute("data-kite") || "");
            a.setAttribute("data-exchange", common.exchange);
            a.setAttribute("data-tradingsymbol", common.tradingsymbol);
            a.setAttribute("data-transaction_type", cfg.transaction_type);
            a.setAttribute("data-quantity", String(common.quantity));
            a.setAttribute("data-order_type", cfg.order_type);
            a.setAttribute("data-product", common.product);
            if (typeof cfg.price === "number") a.setAttribute("data-price", String(cfg.price));
            else a.setAttribute("data-price", "0");
            if (typeof cfg.trigger_price === "number") a.setAttribute("data-trigger_price", String(cfg.trigger_price));
            document.body.appendChild(a);
            return a;
          });
          // Initialize anchors via Publisher script, then click sequentially
          if (typeof window.kite_publisher_load === "function") {
            try { window.kite_publisher_load(); } catch {}
          }
          // Ensure busy clears when user closes the newly opened window/tab
          try { setupReturnFocusReset(); } catch {}
          created.forEach((a, idx) => {
            setTimeout(() => {
              a.click();
              setTimeout(() => document.body.removeChild(a), 500);
            }, idx * 350);
          });
          // In fallback, clear busy shortly after last click
          setTimeout(() => {
            setBusy(false);
            setLastClickTime(0); // Reset click time on completion
          }, created.length * 400 + 800);
          return;
        }
      } else if (txn === "SELL") {
        const slTrigger = roundToTick(ltp * (1 + (slPct || 0) / 100)); // SL above
        const slLimit = roundToTick(slTrigger + (tickSize || 0.05)); // unused when using SL-M
        const targetPrice = roundToTick(ltp * (1 - (targetPct || 0) / 100)); // Target below
        if (hasProgrammatic) {
          const legs = [
            { ...common, transaction_type: "SELL", order_type: "MARKET" },
            { ...common, transaction_type: "BUY", order_type: "SL-M", trigger_price: slTrigger },
            { ...common, transaction_type: "BUY", order_type: "LIMIT", price: targetPrice },
          ];
          console.debug("[kite] adding SELL legs", legs);
          const addSeq = (i = 0) => {
            if (i >= legs.length) {
              setTimeout(() => {
                try {
                  const cnt = typeof kite.count === 'function' ? kite.count() : undefined;
                  console.debug("[kite] staged legs count:", cnt);
                } catch {}
                const id = `kite-launch-${Date.now()}`;
                const btn = document.createElement('button');
                btn.id = id;
                btn.style.display = 'none';
                document.body.appendChild(btn);
                try {
                  if (typeof kite.finished === 'function') {
                    kite.finished(function () { 
                      setBusy(false);
                      setLastClickTime(0); // Reset click time on completion
                    });
                  }
                  if (typeof kite.link === 'function') {
                    kite.link(`#${id}`);
                  }
                } catch {}
                setTimeout(() => {
                  // Install a one-time focus/visibility handler so if user closes
                  // the Kite window, we clear the Processing state on return.
                  try { setupReturnFocusReset(); } catch {}
                  btn.click();
                  setTimeout(() => document.body.removeChild(btn), 1000);
                }, 50);
              }, 150);
              return;
            }
            try {
              kite.add(legs[i]);
            } catch (e) {
              console.warn("[kite] add failed", e);
            }
            setTimeout(() => addSeq(i + 1), 120);
          };
          addSeq(0);
        } else {
          // Fallback: create and click three hidden anchors sequentially
          const entries = [
            { transaction_type: "SELL", order_type: "MARKET" },
            { transaction_type: "BUY", order_type: "SL-M", trigger_price: slTrigger },
            { transaction_type: "BUY", order_type: "LIMIT", price: targetPrice },
          ];
          const created = entries.map((cfg) => {
            const a = document.createElement("a");
            a.href = "#";
            a.style.display = "none";
            a.className = "kite-button";
            a.setAttribute("data-kite", hiddenLinkRef.current?.getAttribute("data-kite") || "");
            a.setAttribute("data-exchange", common.exchange);
            a.setAttribute("data-tradingsymbol", common.tradingsymbol);
            a.setAttribute("data-transaction_type", cfg.transaction_type);
            a.setAttribute("data-quantity", String(common.quantity));
            a.setAttribute("data-order_type", cfg.order_type);
            a.setAttribute("data-product", common.product);
            if (typeof cfg.price === "number") a.setAttribute("data-price", String(cfg.price));
            else a.setAttribute("data-price", "0");
            if (typeof cfg.trigger_price === "number") a.setAttribute("data-trigger_price", String(cfg.trigger_price));
            document.body.appendChild(a);
            return a;
          });
          if (typeof window.kite_publisher_load === "function") {
            try { window.kite_publisher_load(); } catch {}
          }
          // Ensure busy clears when user closes the newly opened window/tab
          try { setupReturnFocusReset(); } catch {}
          created.forEach((a, idx) => {
            setTimeout(() => {
              a.click();
              setTimeout(() => document.body.removeChild(a), 500);
            }, idx * 200);
          });
          setTimeout(() => {
            setBusy(false);
            setLastClickTime(0); // Reset click time on completion
          }, created.length * 250 + 800);
          return;
        }
      } else {
        // Unknown action, fallback
        if (hiddenLinkRef.current) hiddenLinkRef.current.click();
        return;
      }

      // No direct publish here; we trigger link() above after staging legs
    } catch (e) {
      // As a safety fallback
      if (hiddenLinkRef.current) hiddenLinkRef.current.click();
      setBusy(false);
      setLastClickTime(0); // Reset click time on error
    }
  };

  return (
    <div className="flex flex-col items-center">
      <a
        ref={hiddenLinkRef}
        href="#"
        style={{ display: "none" }}
        className="kite-button"
        onClick={requestDesktopMode}
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
        disabled={busy}
        className={`${className} ${compact ? "px-3 py-1.5 text-sm" : "px-4 py-2"} rounded-lg font-semibold shadow-md transition-all flex flex-col items-center ${
          action.toUpperCase() === "BUY"
            ? "bg-green-500 hover:bg-green-600 text-white"
            : "bg-red-500 hover:bg-red-600 text-white"
        } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <span className="flex items-center gap-2">
          {busy && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {busy ? 'Processing...' : `${action} ${symbol}`}
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
