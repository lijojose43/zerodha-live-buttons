import { useCallback, useEffect, useRef, useState } from "react";

// Live NSE prices via Moneycontrol pricefeed (the one host proven
// reachable: HTTP 200 from a real browser, verified via DevTools MCP).
// Pricefeed needs Moneycontrol's own stock code (sc_id). Codes come from:
//  1. KNOWN_SCID (hand-verified) + localStorage cache, else
//  2. one crawl of MC's Nifty constituents page, whose stock links embed
//     the codes (…/stockpricequote/<sector>/<slug>/<SCID>). Every candidate
//     is verified: its pricefeed NSEID must equal our NSE symbol, and the
//     verified fetch doubles as the price — wrong codes can never stick.
// Diasbled graveyard (all proven dead from a real browser):
// ISMA EC2 (hangs), Stooq (blocked), NSE API (CORS+cookies),
// MC autosuggest (404), public CORS proxies (unreachable/keyed).
const MC = "https://priceapi.moneycontrol.com/pricefeed";
const NIFTY_PAGE =
  "https://www.moneycontrol.com/indian-indices/nifty-50-9.html";
const SCID_KEY = "mc_scid_map_v1";

const KNOWN_SCID = {
  RELIANCE: "RI",
  HDFCBANK: "HDF01",
  INFY: "IT",
  TCS: "TCS",
  SBIN: "SBI",
  ICICIBANK: "ICI02",
  ADANIPORTS: "MPS",
  APOLLOHOSP: "AHE",
  CIPLA: "C",
  HINDALCO: "H",
  SUNPHARMA: "SPI",
  TRENT: "L",
  WIPRO: "W",
  ONGC: "ONG",
  TATACONSUM: "TT",
  ITC: "ITC",
  LT: "LT",
  NTPC: "NTP",
  "M&M": "MM",
  ULTRACEMCO: "UTC",
  DRREDDY: "DRL",
  HCLTECH: "HCL02",
  TITAN: "TI01",
  BAJFINANCE: "BAF",
  BEL: "BE03",
  BAJAJFINSV: "BF04",
  TATASTEEL: "TIS",
  POWERGRID: "PGC",
  NESTLEIND: "NI",
  TECHM: "TM4",
  EICHERMOT: "EM",
  GRASIM: "GI01",
  SBILIFE: "SLI03",
  HDFCLIFE: "HSL01",
  JIOFIN: "JFS",
  SHRIRAMFIN: "STF",
  MAXHEALTH: "MHI",
};
// NOTE: TATAMOTORS/TML02 removed — feed now returns NSEID=TMCV
// (post-demerger CV entity), so the guard correctly drops it.

function todayIST() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return "";
  }
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function fetchJson(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function loadScidCache() {
  try {
    return JSON.parse(localStorage.getItem(SCID_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveScidCache(map) {
  try {
    localStorage.setItem(SCID_KEY, JSON.stringify(map));
  } catch {}
}

// Equities expose LP (last price); indices expose pricecurrent.
function readPrice(d) {
  return num(d?.LP ?? d?.pricecurrent);
}

function toYahoo(symbol) {
  return `${encodeURIComponent(String(symbol || "").toUpperCase().trim())}.NS`;
}

async function yahooQuote(symbol) {
  const j = await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${toYahoo(symbol)}?interval=1d&range=1d`
  );
  const meta = j?.chart?.result?.[0]?.meta || {};
  const price = num(
    meta.regularMarketPrice ??
      meta.fulldayPrice ??
      j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(Number.isFinite).pop()
  );
  if (!price) throw new Error("no price");
  return { price };
}
async function mcQuote(scid) {
  const j = await fetchJson(`${MC}/nse/equitycash/${scid}`);
  const d = j?.data || {};
  const price = readPrice(d);
  if (!price) throw new Error("no price");
  return { price, nseid: norm(d.NSEID || "") };
}

// Crawl MC's Nifty page once per session for candidate codes.
let crawledScids = null;
async function crawlScids() {
  if (crawledScids) return crawledScids;
  const html = await fetchText(NIFTY_PAGE);
  const set = new Set();
  const re = /stockpricequote\/[^"'`\s]+/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tail = m[0].split("/").pop();
    if (tail && /^[A-Z0-9]+$/i.test(tail)) set.add(tail.toUpperCase());
  }
  crawledScids = [...set];
  console.log(`[live-prices] crawled ${crawledScids.length} candidate codes`);
  return crawledScids;
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          out[idx] = { ok: true, value: await fn(items[idx]) };
        } catch (e) {
          out[idx] = { ok: false, error: e };
        }
      }
    }
  );
  await Promise.all(workers);
  return out;
}

export default function useNiftyPrices(symbols, { intervalMs = 60000 } = {}) {
  const [prices, setPrices] = useState({}); // { SYMBOL: { price, date } }
  const [status, setStatus] = useState("idle"); // idle | loading | ok | error
  const [updatedAt, setUpdatedAt] = useState(0);
  const [source, setSource] = useState(""); // moneycontrol
  const [liveCount, setLiveCount] = useState(0);
  const loadingRef = useRef(false);
  const crawledKeyRef = useRef("");

  const key = (symbols || [])
    .map((s) => String(s || "").toUpperCase().trim())
    .filter(Boolean)
    .sort()
    .join(",");

  const load = useCallback(async () => {
    const list = key ? key.split(",") : [];
    if (!list.length || loadingRef.current) return;
    loadingRef.current = true;
    setStatus((s) => (s === "ok" ? s : "loading"));
    const next = {};
    try {
      const cache = loadScidCache();
      let cacheDirty = false;

      // 1. Known + cached codes (pooled + one retry pass).
      const fetchKnown = async (sym) => {
        const scid = cache[sym] || KNOWN_SCID[sym];
        const q = await mcQuote(scid);
        if (q.nseid && q.nseid !== norm(sym)) {
          throw new Error(`code ${scid} NSEID=${q.nseid}, want ${sym}`);
        }
        return { scid, price: q.price };
      };
      const storeKnown = (sym, scid, price) => {
        if (!cache[sym]) {
          cache[sym] = scid;
          cacheDirty = true;
        }
        next[sym] = { price, date: todayIST() };
      };
      const knownSyms = list.filter((s) => !next[s] && (cache[s] || KNOWN_SCID[s]));
      const r1 = await pool(knownSyms, 8, async (sym) => {
        const { scid, price } = await fetchKnown(sym);
        return { sym, scid, price };
      });
      const retrySyms = [];
      r1.forEach((r, i) => {
        if (r.ok) storeKnown(r.value.sym, r.value.scid, r.value.price);
        else retrySyms.push(knownSyms[i]);
      });
      if (retrySyms.length > 0) {
        await new Promise((r) => setTimeout(r, 1500));
        const r2 = await pool(retrySyms, 8, async (sym) => {
          const { scid, price } = await fetchKnown(sym);
          return { sym, scid, price };
        });
        r2.forEach((r, i) => {
          if (r.ok) storeKnown(r.value.sym, r.value.scid, r.value.price);
          else console.warn(`[live-prices] mc failed for ${retrySyms[i]}:`, r.error);
        });
      }

      // 2. Crawl + NSEID-verify for everything still missing
      // (at most once per symbol set — codes rarely change).
      const missing = list.filter((s) => !next[s]);
      if (missing.length > 0 && crawledKeyRef.current !== key) {
        crawledKeyRef.current = key;
        try {
          const cands = (await crawlScids()).filter(
            (c) => !Object.values(cache).includes(c)
          );
          const res = await pool(cands, 10, (scid) => mcQuote(scid));
          // Reuse each verified fetch as the price — no second request.
          const priceByNseid = {};
          res.forEach((r, i) => {
            if (r.ok && r.value.nseid)
              priceByNseid[r.value.nseid] = {
                scid: cands[i],
                price: r.value.price,
              };
          });
          for (const sym of missing) {
            const hit = priceByNseid[norm(sym)];
            if (hit) {
              cache[sym] = hit.scid;
              cacheDirty = true;
              next[sym] = { price: hit.price, date: todayIST() };
              console.log(`[live-prices] resolved ${sym} → ${hit.scid}`);
            }
          }
        } catch (e) {
          console.warn("[live-prices] crawl failed:", e);
        }
      }
      // 3. Yahoo Finance fallback for everything still missing.
      // Needs no code mapping: <SYMBOL>.NS covers the whole Nifty 50
      // (incl. M&M, BAJAJ-AUTO, ETERNAL, TATAMOTORS post-demerger).
      const stillMissing = list.filter((s) => !next[s]);
      let yahooHits = 0;
      if (stillMissing.length > 0) {
        const ry = await pool(stillMissing, 8, async (sym) => {
          const { price } = await yahooQuote(sym);
          return { sym, price };
        });
        ry.forEach((r, i) => {
          if (r.ok) {
            next[r.value.sym] = { price: r.value.price, date: todayIST() };
            yahooHits++;
          } else console.warn(`[live-prices] yahoo failed for ${stillMissing[i]}:`, r.error);
        });
      }
      if (cacheDirty) saveScidCache(cache);

      if (Object.keys(next).length === 0) throw new Error("no quotes");
      setPrices((prev) => ({ ...prev, ...next }));
      setLiveCount(Object.keys(next).length);
      setUpdatedAt(Date.now());
      setSource(yahooHits > 0 && yahooHits === Object.keys(next).length ? "yahoo" : yahooHits > 0 ? "moneycontrol+yahoo" : "moneycontrol");
      setStatus("ok");
    } catch (e) {
      console.warn("[live-prices] load failed:", e);
      setStatus((s) => (s === "ok" ? s : "error"));
    } finally {
      loadingRef.current = false;
    }
  }, [key]);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) load();
    }, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { prices, status, updatedAt, source, liveCount, refresh: load };
}
