import { useEffect, useRef, useState } from "react";
import "../landing.css";
import Icon from "./icons";
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
              // Equities expose LP (last price); indices expose pricecurrent.
              const price = Number(data?.LP ?? data?.pricecurrent);
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

  const W = 300, Hh = 64;
  const lo = Math.min(...hist), hi = Math.max(...hist);
  const pts = hist.map((v, i) => `${(i / (hist.length - 1)) * W},${Hh - 5 - ((v - lo) / (hi - lo || 1)) * (Hh - 12)}`).join(" ");
  const up = dir >= 0;

  return (
    <div style={{ position: "relative" }}>
      <div className="lb-float-chip lb-chip-a"><Icon name="target" className="h-3.5 w-3.5" /> Target hit {inr(net)}</div>
      <div className="lb-float-chip lb-chip-b"><Icon name="bolt" className="h-3.5 w-3.5" /> Order staged in 1 tap</div>
      <div className="lb-terminal">
        <div className="lb-term-bar">
          <span className="lb-dot" style={{ background: "#FF5F57" }} />
          <span className="lb-dot" style={{ background: "#FEBC2E" }} />
          <span className="lb-dot" style={{ background: "#28C840" }} />
          <span className="lb-term-title">watchlist.terminal — nse</span>
          <span className="lb-term-live">● Live preview</span>
        </div>
        <div className="lb-term-body">
          <div className="lb-term-sym"><h3>RELIANCE</h3><span>NSE · MIS · Qty {qty}</span></div>
          <div className={`lb-term-price ${up ? "up" : "down"}`}>₹{price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          <div className={`lb-term-chg ${chg >= 0 ? "lb-pos" : "lb-neg"}`}>{chg >= 0 ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}% today</div>
          <svg className="lb-spark" viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none">
            <polyline points={pts} fill="none" stroke={up ? "#2EBE82" : "#F06E6E"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className="lb-term-grid">
            <div className="lb-term-cell">Target ₹{target.toFixed(2)}<b className="lb-pos">+{inr(gross)}</b></div>
            <div className="lb-term-cell">Stop-loss ₹{sl.toFixed(2)}<b className="lb-neg">−{inr((price - sl) * qty)}</b></div>
            <div className="lb-term-cell">Charges<b>{inr(brokerage(price, target, qty))}</b></div>
            <div className="lb-term-cell">Net profit<b className="lb-pos">+{inr(net)}</b></div>
          </div>
          <div className="lb-term-btns">
            <button className="lb-tbtn lb-tbtn-buy" onClick={onEnter}>Buy</button>
            <button className="lb-tbtn lb-tbtn-sell" onClick={onEnter}>Sell</button>
          </div>
          <div className="lb-term-foot">Tap to open the real terminal</div>
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
          <div className="lb-res"><span>Charges</span><b style={{ color: "#F06E6E" }}>−{inr(chg)}</b></div>
          <div className="lb-res lb-res-net"><span style={{ color: "#8FB6FF" }}>You actually keep</span><b className="lb-pos">+{inr(net)}</b></div>
        </div>
      </Reveal>
    </div>
  );
}

/* ---------- page ---------- */
export default function LandingPage({ onEnter }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Shares the app's theme key + `.dark` class on <html>, so the choice
  // survives navigation between the landing page and the terminal.
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="lb-landing">
      <nav className="lb-nav">
        <div className="lb-nav-inner">
          <a href="#top" className="lb-nav-logo">
            <img src="/logo-mark.png" alt="" className="lb-nav-mark" />
            Zerodha Live <span className="lb-nav-tag">Terminal</span>
          </a>
          <div className={`lb-nav-links ${menuOpen ? "open" : ""}`}>
            <a href="#features" onClick={() => setMenuOpen(false)}>Platform</a>
            <a href="#calculator" onClick={() => setMenuOpen(false)}>Calculator</a>
            <a href="#security" onClick={() => setMenuOpen(false)}>Security</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          </div>
          <div className="lb-nav-actions">
            <button
              className="lb-theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <button className="lb-nav-toggle" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
          </div>
        </div>
      </nav>

      <Ticker />

      <main id="top">
        <section className="lb-hero">
          <div className="lb-hero-inner">
            <div className="lb-hero-content">
              <span className="lb-pill"><span className="lb-pulse-dot" /> NSE cash · intraday execution</span>
              <h1>The watchlist<br />is the <span className="lb-grad-text">order ticket.</span></h1>
              <p className="lb-hero-desc">
                Zerodha Live wires the full <strong>Nifty 50</strong> to one-tap bracket
                orders — entry, target and stop-loss derived from live prices, with{" "}
                <strong>net P&amp;L after all six NSE charge heads</strong>. No accounts,
                no servers: everything runs local-first in your browser.
              </p>
              <div className="lb-hero-actions">
                <button className="lb-btn-primary" onClick={onEnter}><Icon name="bolt" className="h-4 w-4" /> Launch terminal</button>
                <a href="#calculator" className="lb-btn-ghost">Profit calculator ↓</a>
              </div>
              <div className="lb-hero-proof">
                <div className="lb-proof"><span className="lb-check"><Icon name="check" /></span><span><b>50 instruments</b> pre-wired</span></div>
                <div className="lb-proof"><span className="lb-check"><Icon name="check" /></span><span><b>3-leg</b> bracket orders</span></div>
                <div className="lb-proof"><span className="lb-check"><Icon name="check" /></span><span><b>Charge-aware</b> P&amp;L</span></div>
                <div className="lb-proof"><span className="lb-check"><Icon name="check" /></span><span><b>Local-first</b> storage</span></div>
              </div>
            </div>
            <LiveTerminal onEnter={onEnter} />
          </div>
        </section>

        <div className="lb-integrations">
          <div className="lb-integrations-inner">
            <span>Wires into</span>
            <b>Zerodha Kite Publisher</b>
            <span className="lb-int-sep" />
            <b>TradingView</b>
            <span className="lb-int-sep" />
            <b>Moneycontrol price feed</b>
            <span className="lb-int-sep" />
            <b>Yahoo Finance fallback</b>
          </div>
        </div>

        <section className="lb-stats">
          <div className="lb-stats-inner">
            <div className="lb-stat"><CountUp to={50} /><span>Nifty constituents pre-wired</span></div>
            <div className="lb-stat"><CountUp to={3} suffix=" legs" /><span>staged per bracket order</span></div>
            <div className="lb-stat"><CountUp to={6} /><span>charge heads netted from P&amp;L</span></div>
            <div className="lb-stat"><CountUp to={0} /><span>servers between you and execution</span></div>
          </div>
        </section>

        <section className="lb-section" id="features">
          <div className="lb-inner">
            <Reveal><div style={{ textAlign: "center" }}><span className="lb-label">Platform</span></div></Reveal>
            <Reveal><h2 className="lb-title">Built for the <span className="lb-grad-text">five-minute candle</span></h2></Reveal>
            <Reveal><p className="lb-subtitle">When price is running, there is no room for calculators and order forms. Everything is pre-computed before you need it.</p></Reveal>
            <div className="lb-bento">
              <Reveal>
                <div className="lb-card lb-card-wide">
                  <div className="lb-ico"><Icon name="bolt" /></div>
                  <span className="lb-tag">Kite Publisher</span>
                  <h3>One-tap bracket orders</h3>
                  <p>BUY and SELL stage the full bracket — market entry, SL-M stop and limit target — in Zerodha Kite, pre-filled with symbol, quantity and exact levels. Review once, swipe, executed, while the candle is still forming.</p>
                </div>
              </Reveal>
              <Reveal delay="80ms">
                <div className="lb-card">
                  <div className="lb-ico"><Icon name="layers" /></div>
                  <h3>Charge-aware net P&amp;L</h3>
                  <p>Brokerage, STT, exchange transaction charges, SEBI fees, GST and stamp duty are deducted before the profit number reaches your eyes.</p>
                </div>
              </Reveal>
              <Reveal delay="160ms">
                <div className="lb-card">
                  <div className="lb-ico"><Icon name="pieChart" /></div>
                  <h3>Deterministic position sizing</h3>
                  <p>Set capital × leverage once. Quantity recomputes from live LTP for every instrument on every tick — no spreadsheets, no slogans.</p>
                </div>
              </Reveal>
              <Reveal delay="80ms">
                <div className="lb-card">
                  <div className="lb-ico"><Icon name="activity" /></div>
                  <h3>Levels that track the tick</h3>
                  <p>Target and stop-loss percentages become tick-rounded prices the moment LTP updates. Override any level inline when your plan changes.</p>
                </div>
              </Reveal>
              <Reveal delay="160ms">
                <div className="lb-card">
                  <div className="lb-ico"><Icon name="playCircle" /></div>
                  <h3>Paper trading mode</h3>
                  <p>Rehearse with a virtual balance and full trade history — entries, exits, charges and net P&amp;L — before risking a rupee.</p>
                </div>
              </Reveal>
              <Reveal delay="240ms">
                <div className="lb-card">
                  <div className="lb-ico"><Icon name="sliders" /></div>
                  <h3>Terminal-grade ergonomics</h3>
                  <p>Dense cards, tabular figures, keyboard shortcuts and a live feed status bar. Designed for a second monitor, not a phone-first demo.</p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="lb-section lb-calc" id="calculator">
          <div className="lb-inner">
            <Reveal><div style={{ textAlign: "center" }}><span className="lb-label">Try it</span></div></Reveal>
            <Reveal><h2 className="lb-title">Brokers show gross.<br />We show <span className="lb-grad-text">what you keep.</span></h2></Reveal>
            <Reveal><p className="lb-subtitle">Drag the sliders — the same charge engine as the terminal, running right here.</p></Reveal>
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
              <Reveal><div className="lb-step"><div className="lb-step-num">01</div><h4>Open the terminal</h4><p>The Nifty 50 is pre-loaded — every card shows live LTP, target, stop-loss, quantity and net P&amp;L. Press <kbd>/</kbd> to jump to search.</p></div></Reveal>
              <Reveal delay="100ms"><div className="lb-step"><div className="lb-step-num">02</div><h4>Set risk once</h4><p>Capital, leverage, target% and stop-loss% live in Settings. Quantities, levels and P&amp;L compute themselves from then on.</p></div></Reveal>
              <Reveal delay="200ms"><div className="lb-step"><div className="lb-step-num">03</div><h4>Tap BUY or SELL</h4><p>Kite opens with the full bracket staged. Review, swipe, executed — while the candle is still forming.</p></div></Reveal>
            </div>
          </div>
        </section>

        <section className="lb-section" id="security">
          <div className="lb-inner">
            <div className="lb-sec-grid">
              <Reveal><div className="lb-sec"><div className="lb-sec-icon"><Icon name="lock" /></div><h4>Nothing leaves</h4><p>Symbols, prices, settings — all in your browser's localStorage.</p></div></Reveal>
              <Reveal delay="80ms"><div className="lb-sec"><div className="lb-sec-icon"><Icon name="download" /></div><h4>Offline-capable</h4><p>Install to home screen. The shell works offline; prices need the network.</p></div></Reveal>
              <Reveal delay="160ms"><div className="lb-sec"><div className="lb-sec-icon"><Icon name="shield" /></div><h4>No accounts</h4><p>No signup, no API keys, no analytics server. Orders go straight to Zerodha.</p></div></Reveal>
              <Reveal delay="240ms"><div className="lb-sec"><div className="lb-sec-icon"><Icon name="bolt" /></div><h4>Official order flow</h4><p>Kite Publisher — the integration Zerodha documents. Credentials never touch this app.</p></div></Reveal>
            </div>
          </div>
        </section>

        <section className="lb-section" id="faq">
          <div className="lb-inner">
            <Reveal><div style={{ textAlign: "center" }}><span className="lb-label">FAQ</span></div></Reveal>
            <Reveal><h2 className="lb-title">Questions, <span className="lb-grad-text">answered</span></h2></Reveal>
            <Reveal><p className="lb-subtitle">The short version of everything traders ask.</p></Reveal>
            <div className="lb-faq-list">
              <Reveal><details className="lb-faq-item"><summary className="lb-faq-q">Is this affiliated with Zerodha?</summary><div className="lb-faq-a">No. It's an independent tool that opens orders in Zerodha Kite via the official publisher flow. Your trading account and credentials stay with Zerodha.</div></details></Reveal>
              <Reveal><details className="lb-faq-item"><summary className="lb-faq-q">Where is my data stored?</summary><div className="lb-faq-a">Only in your own browser (localStorage). There is no backend, no account, no analytics server. Clear site data and everything is gone.</div></details></Reveal>
              <Reveal><details className="lb-faq-item"><summary className="lb-faq-q">How accurate are the charges?</summary><div className="lb-faq-a">They follow Zerodha's intraday equity schedule: 0.03% brokerage capped at ₹20 per leg, 0.025% STT, NSE transaction + IPFT, SEBI turnover fee, 18% GST and stamp duty — the same engine powers the terminal and the calculator above.</div></details></Reveal>
              <Reveal><details className="lb-faq-item"><summary className="lb-faq-q">Do I need a Zerodha account to try it?</summary><div className="lb-faq-a">No. Paper-trading mode gives you a virtual balance and full history with zero brokerage account required.</div></details></Reveal>
              <Reveal><details className="lb-faq-item"><summary className="lb-faq-q">Which devices work?</summary><div className="lb-faq-a">Any modern browser on Android, iOS, Windows, macOS or Linux — and it installs as a PWA for an app-like, offline-capable shell.</div></details></Reveal>
            </div>
          </div>
        </section>

        <div className="lb-cta">
          <Reveal>
            <div className="lb-cta-inner">
              <h2>Open the terminal.</h2>
              <p>Free forever · No signup · Installs in seconds</p>
              <button className="lb-btn-white" onClick={onEnter}><Icon name="bolt" className="h-4 w-4" /> Launch Zerodha Live</button>
            </div>
          </Reveal>
        </div>
      </main>

      <footer className="lb-footer">
        <div className="lb-footer-inner">
          <div className="lb-footer-brand">
            <span className="lb-nav-logo"><img src="/logo-mark.png" alt="" className="lb-nav-mark" />Zerodha Live</span>
            <p>One-tap intraday execution for the Nifty 50, with charge-aware P&amp;L. Local-first PWA.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <div className="lb-footer-links">
              <a href="#features">Platform</a>
              <a href="#calculator">Profit calculator</a>
              <a href="#how">How it works</a>
              <a href="#faq">FAQ</a>
            </div>
          </div>
          <div>
            <h4>Status</h4>
            <div className="lb-footer-status">
              <span className="lb-status-row"><span className="lb-status-dot" /> Price feed operational</span>
              <span>Feed: Moneycontrol · Yahoo fallback</span>
              <span>Storage: local-first · v1.0.0</span>
            </div>
          </div>
        </div>
        <div className="lb-footer-bottom">
          <span>© 2026 Zerodha Live. Independent tool — not affiliated with Zerodha.</span>
          <span>Local-first · your data never leaves this device</span>
        </div>
      </footer>
    </div>
  );
}
