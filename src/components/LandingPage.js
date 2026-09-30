import { useEffect, useRef, useState } from "react";
import "../landing.css";
import { getBrokerage } from "../charges";

/* ---------- Zerodha intraday charges — shared engine, same as StockCard ---------- */
const brokerage = (buy, sell, qty) => getBrokerage(buy, sell, qty, "NSE");
const inr = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

/* ---------- scroll reveal ---------- */
function Reveal({ children, delay }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVis(true);
          ob.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return (
    <div ref={ref} className={`lb-reveal ${vis ? "lb-in" : ""}`} style={{ transitionDelay: delay || "0ms" }}>
      {children}
    </div>
  );
}

/* ---------- animated counter ---------- */
function CountUp({ to, decimals, prefix, suffix }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf;
    const ob = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        ob.disconnect();
        const t0 = performance.now();
        const tick = (t) => {
          const p = Math.min(1, (t - t0) / 1300);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(to * eased);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    ob.observe(el);
    return () => {
      ob.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <b ref={ref}>
      {prefix || ""}
      {val.toFixed(decimals || 0)}
      {suffix || ""}
    </b>
  );
}

/* ---------- ticker tape (live NSE prices via Moneycontrol, fallback to last known) ---------- */
const MC_BASE = "https://priceapi.moneycontrol.com/pricefeed";
const TICKER_DEFS = [
  { s: "RELIANCE", u: `${MC_BASE}/nse/equitycash/RI`, fp: "1,187.00", fc: 0.42 },
  { s: "HDFCBANK", u: `${MC_BASE}/nse/equitycash/HDF01`, fp: "708.70", fc: -1.94 },
  { s: "INFY", u: `${MC_BASE}/nse/equitycash/IT`, fp: "994.10", fc: -2.10 },
  { s: "TCS", u: `${MC_BASE}/nse/equitycash/TCS`, fp: "2,050.60", fc: 0.90 },
  { s: "SBIN", u: `${MC_BASE}/nse/equitycash/SBI`, fp: "959.50", fc: -0.54 },
  { s: "TATAMOTORS", u: `${MC_BASE}/nse/equitycash/TML02`, fp: "421.65", fc: -1.98 },
  { s: "ICICIBANK", u: `${MC_BASE}/nse/equitycash/ICI02`, fp: "1,321.70", fc: 2.28 },
  { s: "NIFTY 50", u: `${MC_BASE}/notapplicable/inidicesindia/in%3BNSX`, fp: "22,620.45", fc: -0.42 },
];
function Ticker() {
  const [ticks, setTicks] = useState(() =>
    TICKER_DEFS.map((d) => [d.s, d.fp, d.fc])
  );
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const results = await Promise.all(
          TICKER_DEFS.map(async (d) => {
            try {
              const res = await fetch(d.u);
              if (!res.ok) throw new Error("feed " + res.status);
              const j = await res.json();
              const data = j?.data;
              const price = Number(data?.pricecurrent);
              const chg = Number(data?.pricepercentchange);
              if (!Number.isFinite(price)) throw new Error("no price");
              const priceStr = price.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              return [d.s, priceStr, Number.isFinite(chg) ? chg : d.fc];
            } catch {
              return null;
            }
          })
        );
        if (cancelled) return;
        setTicks((prev) =>
          prev.map((oldTick, i) => results[i] || oldTick)
        );
      } catch {}
    }
    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  const row = [...ticks, ...ticks];
  return (
    <div className="lb-ticker" aria-hidden>
      <div className="lb-ticker-track">
        {row.map(([s, p, c], i) => (
          <span className="lb-tick" key={i}>
            <b>{s}</b> {p} <span className={c >= 0 ? "lb-up" : "lb-down"}>{c >= 0 ? "▲" : "▼"} {Math.abs(c).toFixed(2)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- live terminal demo ---------- */
function LiveTerminal({ onEnter }) {
  const [price, setPrice] = useState(2485.5);
  const [hist, setHist] = useState(() =>
    Array.from({ length: 24 }, (_, i) => 2485.5 + Math.sin(i / 3) * 6 + (Math.random() - 0.5) * 4)
  );
  const [dir, setDir] = useState(1);
  useEffect(() => {
    const id = setInterval(() => {
      setPrice((p) => {
        const n = +(p + (Math.random() - 0.47) * 5).toFixed(2);
        setHist((h) => [...h.slice(-23), n]);
        setDir(n >= p ? 1 : -1);
        return n;
      });
    }, 1300);
    return () => clearInterval(id);
  }, []);

  const qty = 20;
  const target = price * 1.01;
  const sl = price * 0.995;
  const gross = (target - price) * qty;
  const net = gross - brokerage(price, target, qty);
  const chg = ((price - 2455.2) / 2455.2) * 100;

  const W = 300, Hh = 74;
  const lo = Math.min(...hist), hi = Math.max(...hist);
  const pts = hist.map((v, i) => `${(i / (hist.length - 1)) * W},${Hh - 6 - ((v - lo) / (hi - lo || 1)) * (Hh - 14)}`).join(" ");
  const up = dir >= 0;

  return (
    <div style={{ position: "relative" }}>
      <div className="lb-float-chip lb-chip-a">🎯 Target hit +{inr(net)}</div>
      <div className="lb-float-chip lb-chip-b">⚡ Order fired in 1 tap</div>
      <div className="lb-terminal">
        <div className="lb-term-bar">
          <span className="lb-dot" style={{ background: "#FF5F57" }} />
          <span className="lb-dot" style={{ background: "#FEBC2E" }} />
          <span className="lb-dot" style={{ background: "#28C840" }} />
          <span className="lb-term-title">ZERODHA LIVE</span>
          <span className="lb-term-live">● LIVE DEMO</span>
        </div>
        <div className="lb-term-body">
          <div className="lb-term-sym"><h3>RELIANCE</h3><span>NSE · Qty {qty}</span></div>
          <div className={`lb-term-price ${up ? "up" : "down"}`}>₹{price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          <div className={`lb-term-chg ${chg >= 0 ? "lb-pos" : "lb-neg"}`}>{chg >= 0 ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}% today</div>
          <svg className="lb-spark" viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none">
            <polyline points={pts} fill="none" stroke={up ? "#00E5A0" : "#FF5C6C"} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className="lb-term-grid">
            <div className="lb-term-cell">Target ₹{target.toFixed(2)}<b className="lb-pos">+{inr(gross)}</b></div>
            <div className="lb-term-cell">Stop-loss ₹{sl.toFixed(2)}<b className="lb-neg">−{inr((price - sl) * qty)}</b></div>
            <div className="lb-term-cell">Charges<b style={{ color: "#F8FAFC" }}>{inr(brokerage(price, target, qty))}</b></div>
            <div className="lb-term-cell">Net profit<b className="lb-pos">+{inr(net)}</b></div>
          </div>
          <div className="lb-term-btns">
            <button className="lb-tbtn lb-tbtn-buy" onClick={onEnter}>BUY</button>
            <button className="lb-tbtn lb-tbtn-sell" onClick={onEnter}>SELL</button>
          </div>
          <div className="lb-term-foot">Live preview — tap to open the real app</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- profit calculator ---------- */
function Calculator() {
  const [buy, setBuy] = useState(1200);
  const [pct, setPct] = useState(1);
  const [qty, setQty] = useState(25);
  const sell = buy * (1 + pct / 100);
  const gross = (sell - buy) * qty;
  const chg = brokerage(buy, sell, qty);
  const net = gross - chg;
  return (
    <div className="lb-calc-box">
      <Reveal>
        <div className="lb-calc-controls">
          <div className="lb-slider-row">
            <label>Buy price <b>₹{buy.toLocaleString("en-IN")}</b></label>
            <input type="range" min="100" max="5000" step="10" value={buy} onChange={(e) => setBuy(Number(e.target.value))} />
          </div>
          <div className="lb-slider-row">
            <label>Target <b>{pct.toFixed(1)}% → ₹{sell.toFixed(2)}</b></label>
            <input type="range" min="0.2" max="5" step="0.1" value={pct} onChange={(e) => setPct(Number(e.target.value))} />
          </div>
          <div className="lb-slider-row" style={{ marginBottom: 0 }}>
            <label>Quantity <b>{qty} shares</b></label>
            <input type="range" min="1" max="200" step="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
        </div>
      </Reveal>
      <Reveal delay="120ms">
        <div className="lb-calc-results">
          <div className="lb-res"><span>Gross profit</span><b>+{inr(gross)}</b></div>
          <div className="lb-res"><span>Charges</span><b style={{ color: "#FF8A94" }}>−{inr(chg)}</b></div>
          <div className="lb-res lb-res-net"><span style={{ color: "#7DD3FC" }}>You actually keep</span><b className="lb-pos">+{inr(net)}</b></div>
        </div>
      </Reveal>
    </div>
  );
}

/* ---------- page ---------- */
export default function LandingPage({ onEnter }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="lb-landing">
      <nav className="lb-nav">
        <div className="lb-nav-inner">
          <a href="#top" className="lb-nav-logo">
            <span className="lb-nav-mark">Z</span>
            Zerodha Live <span className="lb-nav-live">PWA</span>
          </a>
          <div className={`lb-nav-links ${menuOpen ? "open" : ""}`}>
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#calculator" onClick={() => setMenuOpen(false)}>Profit Calc</a>
            <a href="#how" onClick={() => setMenuOpen(false)}>How It Works</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            <button className="lb-nav-cta" onClick={onEnter}>Open App</button>
          </div>
          <button className="lb-nav-toggle" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
        </div>
      </nav>

      <Ticker />

      <main id="top">
        <section className="lb-hero">
          <div className="lb-orb lb-orb-a" />
          <div className="lb-orb lb-orb-b" />
          <div className="lb-hero-inner">
            <div className="lb-hero-content">
              <span className="lb-pill"><span className="lb-pulse-dot" /> intraday · live + paper</span>
              <h1>Fire orders at<br />the speed of <span className="lb-grad-text">thought.</span></h1>
              <p className="lb-hero-desc">
                Zerodha Live turns every stock into a <strong>one-tap BUY/SELL button</strong> —
                with auto target, stop-loss, position sizing and the <strong>honest net profit</strong> after
                all 6 Zerodha charge heads. No signup. Nothing leaves your device.
              </p>
              <div className="lb-hero-actions">
                <button className="lb-btn-primary" onClick={onEnter}>⚡ Launch the App</button>
                <a href="#calculator" className="lb-btn-ghost">See your real profit ↓</a>
              </div>
              <div className="lb-hero-proof">
                <div className="lb-proof"><span className="lb-check">✓</span><span><b>1 tap</b>to Kite order</span></div>
                <div className="lb-proof"><span className="lb-check">✓</span><span><b>₹0</b>tracked or stored</span></div>
                <div className="lb-proof"><span className="lb-check">✓</span><span><b>Works</b>offline as PWA</span></div>
                <div className="lb-proof"><span className="lb-check">✓</span><span><b>Net P&L</b>after all charges</span></div>
              </div>
            </div>
            <LiveTerminal onEnter={onEnter} />
          </div>
        </section>

        <section className="lb-stats">
          <div className="lb-stats-inner">
            <div className="lb-stat"><CountUp to={1} suffix=" tap" /><span>from idea to Kite order</span></div>
            <div className="lb-stat"><CountUp to={6} suffix="" /><span>charge heads in every P&amp;L</span></div>
            <div className="lb-stat"><CountUp to={100} suffix="%" /><span>private — local-first storage</span></div>
            <div className="lb-stat"><CountUp to={0} suffix="" /><span>signups, logins, servers</span></div>
          </div>
        </section>

        <section className="lb-section" id="features">
          <div className="lb-inner">
            <Reveal><div style={{ textAlign: "center" }}><span className="lb-label">Arsenal</span></div></Reveal>
            <Reveal><h2 className="lb-title">Built for the <span className="lb-grad-text">5-minute candle</span></h2></Reveal>
            <Reveal><p className="lb-subtitle">When price is running, you don't have room for calculators and order forms. Everything is pre-computed.</p></Reveal>
            <div className="lb-bento">
              <Reveal>
                <div className="lb-card lb-card-wide">
                  <div className="lb-ico" style={{ background: "rgba(255,138,42,.14)", color: "#FF9E2C" }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg></div>
                  <h3>One-tap Zerodha orders</h3>
                  <p>BUY and SELL buttons open Kite pre-filled with symbol, quantity, target and stop-loss. Hesitation gone — conviction in one tap.</p>
                </div>
              </Reveal>
              <Reveal delay="100ms">
                <div className="lb-card">
                  <div className="lb-ico" style={{ background: "rgba(255,138,42,.14)", color: "#FF9E2C" }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="11" x2="8.01" y2="11" /><line x1="12" y1="11" x2="12.01" y2="11" /><line x1="16" y1="11" x2="16.01" y2="11" /><line x1="8" y1="15" x2="8.01" y2="15" /><line x1="12" y1="15" x2="12.01" y2="15" /><line x1="16" y1="15" x2="16.01" y2="15" /><line x1="8" y1="19" x2="16" y2="19" /></svg></div>
                  <h3>Honest net P&amp;L</h3>
                  <p>Brokerage, STT, exchange, SEBI, GST, stamp duty — deducted before you see profit. What you see is what you keep.</p>
                </div>
              </Reveal>
              <Reveal>
                <div className="lb-card">
                  <div className="lb-ico" style={{ background: "rgba(254,188,46,.14)", color: "#FEBC2E" }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg></div>
                  <h3>Auto position sizing</h3>
                  <p>Set capital × leverage once. Every card sizes quantity from live LTP automatically.</p>
                </div>
              </Reveal>
              <Reveal delay="100ms">
                <div className="lb-card">
                  <div className="lb-ico" style={{ background: "rgba(255,92,108,.12)", color: "#FF5C6C" }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg></div>
                  <h3>Target + SL on autopilot</h3>
                  <p>Your target% and SL% become exact prices the moment LTP updates. Override any level by tapping it.</p>
                </div>
              </Reveal>
              <Reveal delay="200ms">
                <div className="lb-card">
                  <div className="lb-ico" style={{ background: "rgba(167,139,250,.14)", color: "#A78BFA" }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg></div>
                  <h3>Paper trading mode</h3>
                  <p>Practice with ₹ virtual balance, full trade history and per-trade P&amp;L — zero risk, full realism.</p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="lb-section lb-calc" id="calculator">
          <div className="lb-inner">
            <Reveal><div style={{ textAlign: "center" }}><span className="lb-label">Try it</span></div></Reveal>
            <Reveal><h2 className="lb-title">Brokers show gross.<br />We show <span className="lb-grad-text">what you keep.</span></h2></Reveal>
            <Reveal><p className="lb-subtitle">Drag the sliders — same charge engine as the app, running right here.</p></Reveal>
            <Calculator />
            <p className="lb-calc-note">Intraday equity charges: brokerage 0.03% (₹20 cap/leg) · STT 0.025% · exchange 0.00297% · SEBI · GST 18% · stamp 0.003%</p>
          </div>
        </section>

        <section className="lb-section" id="how">
          <div className="lb-inner">
            <Reveal><div style={{ textAlign: "center" }}><span className="lb-label">How it works</span></div></Reveal>
            <Reveal><h2 className="lb-title">Live in <span className="lb-grad-text">60 seconds</span></h2></Reveal>
            <Reveal><p className="lb-subtitle">No account. No API keys. No setup ritual.</p></Reveal>
            <div className="lb-steps">
              <Reveal><div className="lb-step"><div className="lb-step-num">01</div><h4>Add a symbol</h4><p>Type any NSE symbol — a trading card appears with LTP, target and SL fields. Press Enter, done.</p></div></Reveal>
              <Reveal delay="100ms"><div className="lb-step"><div className="lb-step-num">02</div><h4>Set risk once</h4><p>Capital, leverage, target% and SL% in Settings. Quantity, levels and net P&amp;L compute themselves forever after.</p></div></Reveal>
              <Reveal delay="200ms"><div className="lb-step"><div className="lb-step-num">03</div><h4>Tap BUY / SELL</h4><p>The order opens in Zerodha Kite, fully filled. Review, swipe, executed — while the candle is still forming.</p></div></Reveal>
            </div>
          </div>
        </section>

        <section className="lb-section" id="security" style={{ paddingTop: 0 }}>
          <div className="lb-inner">
            <div className="lb-sec-grid">
              <Reveal><div className="lb-sec"><div className="lb-sec-icon" style={{ color: "#00E5A0" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></div><h4>Nothing leaves</h4><p>Symbols, prices, settings — all in your browser's localStorage.</p></div></Reveal>
              <Reveal delay="80ms"><div className="lb-sec"><div className="lb-sec-icon" style={{ color: "#7DD3FC" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg></div><h4>Dark-mode PWA</h4><p>Install to home screen. Offline-capable. Easy on tired eyes.</p></div></Reveal>
              <Reveal delay="160ms"><div className="lb-sec"><div className="lb-sec-icon" style={{ color: "#FEBC2E" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg></div><h4>TradingView jump</h4><p>One tap opens any symbol's chart — app or web, your call.</p></div></Reveal>
              <Reveal delay="240ms"><div className="lb-sec"><div className="lb-sec-icon" style={{ color: "#A78BFA" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div><h4>Paper first</h4><p>Prove the setup risk-free before risking a rupee.</p></div></Reveal>
            </div>
          </div>
        </section>

        <section className="lb-section" id="faq" style={{ paddingTop: 0 }}>
          <div className="lb-inner">
            <Reveal><div style={{ textAlign: "center" }}><span className="lb-label">FAQ</span></div></Reveal>
            <Reveal><h2 className="lb-title">Questions, <span className="lb-grad-text">answered</span></h2></Reveal>
            <Reveal><p className="lb-subtitle">The short version of everything traders ask.</p></Reveal>
            <div className="lb-faq-list">
              <Reveal><details className="lb-faq-item"><summary className="lb-faq-q">Is this affiliated with Zerodha?</summary><div className="lb-faq-a">No. It's an independent tool that opens orders in Zerodha Kite via the official publisher flow. Your trading account and credentials stay with Zerodha.</div></details></Reveal>
              <Reveal><details className="lb-faq-item"><summary className="lb-faq-q">Where is my data stored?</summary><div className="lb-faq-a">Only in your own browser (localStorage). There is no backend, no account, no analytics server. Clear site data and everything is gone.</div></details></Reveal>
              <Reveal><details className="lb-faq-item"><summary className="lb-faq-q">How accurate are the charges?</summary><div className="lb-faq-a">They follow Zerodha's intraday equity schedule: 0.03% brokerage capped at ₹20 per leg, 0.025% STT, NSE transaction + IPFT, SEBI, 18% GST and stamp duty — the same engine powers the app and the calculator above.</div></details></Reveal>
              <Reveal><details className="lb-faq-item"><summary className="lb-faq-q">Do I need a Zerodha account to try it?</summary><div className="lb-faq-a">No. Paper-trading mode gives you a virtual balance and full history with zero brokerage account required.</div></details></Reveal>
              <Reveal><details className="lb-faq-item"><summary className="lb-faq-q">Which devices work?</summary><div className="lb-faq-a">Any modern browser on Android, iOS, Windows, macOS or Linux — and it installs as a PWA for an app-like, offline-capable experience.</div></details></Reveal>
            </div>
          </div>
        </section>

        <div className="lb-cta">
          <Reveal>
            <div className="lb-cta-inner">
              <h2>The next candle won't wait.<br />Neither should you.</h2>
              <p>Free forever · No signup · Installs in seconds</p>
              <button className="lb-btn-white" onClick={onEnter}>⚡ Open Zerodha Live ▸</button>
            </div>
          </Reveal>
        </div>
      </main>

      <footer className="lb-footer">
        <div className="lb-footer-inner">
          <div className="lb-footer-brand">
            <span className="lb-nav-logo"><span className="lb-nav-mark">Z</span>Zerodha Live</span>
            <p>One-tap intraday buttons with honest, brokerage-adjusted P&amp;L. Local-first PWA.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <div className="lb-footer-links">
              <a href="#features">Features</a>
              <a href="#calculator">Profit calculator</a>
              <a href="#how">How it works</a>
              <a href="#faq">FAQ</a>
            </div>
          </div>
          <div className="lb-sub">
            <h4>Stay sharp</h4>
            <p>One email when something big ships. No spam.</p>
            <form className="lb-sub-form" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="you@email.com" required />
              <button type="submit">Notify me</button>
            </form>
          </div>
        </div>
        <div className="lb-footer-bottom">
          <span>© 2026 Zerodha Live. Independent tool — not affiliated with Zerodha.</span>
          <span>Local-first · Your data never leaves this device</span>
        </div>
      </footer>
    </div>
  );
}
