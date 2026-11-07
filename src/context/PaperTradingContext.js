import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getBrokerage } from "../charges";

const PaperTradingContext = createContext(null);

const STORAGE_KEY_MODE = "tradingMode";
const STORAGE_KEY_TRADES = "paperTrades";
const STORAGE_KEY_BALANCE = "paperBalance";

const DEFAULT_BALANCE = 100000;

function loadMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY_MODE);
    if (v === "live" || v === "paper") return v;
  } catch {}
  return "live";
}

function loadTrades() {
  try {
    const v = localStorage.getItem(STORAGE_KEY_TRADES);
    if (v) return JSON.parse(v);
  } catch {}
  return [];
}

function loadBalance() {
  try {
    const v = localStorage.getItem(STORAGE_KEY_BALANCE);
    if (v != null) return Number(v);
  } catch {}
  return DEFAULT_BALANCE;
}

export function PaperTradingProvider({ children }) {
  const [mode, setMode] = useState(loadMode);
  const [trades, setTrades] = useState(loadTrades);
  const [balance, setBalance] = useState(loadBalance);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TRADES, JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BALANCE, String(balance));
  }, [balance]);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === "live" ? "paper" : "live"));
  }, []);

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const executePaperTrade = useCallback(
    (order) => {
      const {
        symbol,
        action,
        quantity,
        price,
        orderType,
        triggerPrice,
        targetPrice,
        slPrice,
      } = order;

      const trade = {
        id: `PT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        symbol,
        action: action.toUpperCase(),
        quantity: Number(quantity),
        entryPrice: Number(price),
        orderType: orderType || "MARKET",
        triggerPrice: triggerPrice ? Number(triggerPrice) : null,
        targetPrice: targetPrice ? Number(targetPrice) : null,
        slPrice: slPrice ? Number(slPrice) : null,
        status: "OPEN",
        entryTime: new Date().toISOString(),
        exitPrice: null,
        exitTime: null,
        pnl: 0,
        charges: 0,
      };

      const cost = trade.entryPrice * trade.quantity;
      if (trade.action === "BUY" && cost > balance) {
        showToast(`Insufficient balance. Need ₹${cost.toFixed(2)}`, "error");
        return null;
      }

      setTrades((prev) => [trade, ...prev]);
      if (trade.action === "BUY") {
        setBalance((b) => b - cost);
      } else {
        setBalance((b) => b + cost);
      }

      showToast(
        `Paper ${trade.action} ${trade.quantity} ${trade.symbol} @ ₹${trade.entryPrice.toFixed(2)}`,
        "success"
      );
      return trade;
    },
    [balance, showToast]
  );

  const closePaperTrade = useCallback(
    (tradeId, exitPrice) => {
      setTrades((prev) => {
        const updated = prev.map((t) => {
          if (t.id !== tradeId || t.status !== "OPEN") return t;
          const pnl =
            t.action === "BUY"
              ? (exitPrice - t.entryPrice) * t.quantity
              : (t.entryPrice - exitPrice) * t.quantity;
          // Shared Zerodha engine (sell leg = exit for BUY, entry for SELL)
          const charges = getBrokerage(
            t.action === "BUY" ? t.entryPrice : exitPrice,
            t.action === "BUY" ? exitPrice : t.entryPrice,
            t.quantity,
            "NSE"
          );
          const netPnl = pnl - charges;

          const exitCost =
            t.action === "BUY"
              ? exitPrice * t.quantity
              : t.entryPrice * t.quantity;

          if (t.action === "BUY") {
            setBalance((b) => b + exitCost + netPnl);
          } else {
            setBalance((b) => b - exitCost + netPnl);
          }

          return {
            ...t,
            status: "CLOSED",
            exitPrice,
            exitTime: new Date().toISOString(),
            pnl: netPnl,
            charges,
          };
        });
        return updated;
      });
    },
    []
  );

  const getOpenTrades = useCallback(
    () => trades.filter((t) => t.status === "OPEN"),
    [trades]
  );

  const getClosedTrades = useCallback(
    () => trades.filter((t) => t.status === "CLOSED"),
    [trades]
  );

  const getStats = useCallback(() => {
    const closed = trades.filter((t) => t.status === "CLOSED");
    const wins = closed.filter((t) => t.pnl > 0);
    const losses = closed.filter((t) => t.pnl <= 0);
    const totalPnl = closed.reduce((s, t) => s + t.pnl, 0);
    const totalCharges = closed.reduce((s, t) => s + t.charges, 0);
    return {
      totalTrades: closed.length,
      wins: wins.length,
      losses: losses.length,
      winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
      totalPnl,
      totalCharges,
      netPnl: totalPnl,
    };
  }, [trades]);

  const resetPaperTrades = useCallback(() => {
    setTrades([]);
    setBalance(DEFAULT_BALANCE);
    showToast("Paper trading reset", "info");
  }, [showToast]);

  const deletePaperTrade = useCallback(
    (tradeId) => {
      const trade = trades.find((t) => t.id === tradeId);
      if (!trade) return;
      const cost = trade.entryPrice * trade.quantity;
      if (trade.status === "OPEN") {
        // Refund the entry lock: reverse of executePaperTrade
        setBalance((b) =>
          trade.action === "BUY" ? b + cost : b - cost
        );
      } else {
        // Undo a closed trade: reverse entry + close effects
        const exitCost =
          trade.action === "BUY"
            ? trade.exitPrice * trade.quantity
            : trade.entryPrice * trade.quantity;
        setBalance((b) =>
          trade.action === "BUY"
            ? b + cost - exitCost - trade.pnl
            : b - cost + exitCost - trade.pnl
        );
      }
      setTrades((prev) => prev.filter((t) => t.id !== tradeId));
      showToast("Trade deleted", "info");
    },
    [trades, showToast]
  );

  return (
    <PaperTradingContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        trades,
        balance,
        executePaperTrade,
        closePaperTrade,
        getOpenTrades,
        getClosedTrades,
        getStats,
        resetPaperTrades,
        deletePaperTrade,
        toast,
        showToast,
      }}
    >
      {children}
    </PaperTradingContext.Provider>
  );
}

export function usePaperTrading() {
  const ctx = useContext(PaperTradingContext);
  if (!ctx) throw new Error("usePaperTrading must be used within PaperTradingProvider");
  return ctx;
}
