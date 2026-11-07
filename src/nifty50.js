// Nifty 50 watchlist — NSE trading symbols, as provided.
// Shown by default; add/remove/rename still works and persists.
export const NIFTY50 = [
  "HDFCBANK",
  "ICICIBANK",
  "RELIANCE",
  "BHARTIARTL",
  "LT",
  "SBIN",
  "INFY",
  "AXISBANK",
  "KOTAKBANK",
  "M&M",
  "ITC",
  "TCS",
  "BAJFINANCE",
  "HINDUNILVR",
  "MARUTI",
  "SUNPHARMA",
  "NTPC",
  "TITAN",
  "ETERNAL",
  "TATASTEEL",
  "BEL",
  "SHRIRAMFIN",
  "ULTRACEMCO",
  "HCLTECH",
  "POWERGRID",
  "HINDALCO",
  "JSWSTEEL",
  "BAJAJFINSV",
  "ADANIPORTS",
  "BAJAJ-AUTO",
  "EICHERMOT",
  "INDIGO",
  "ONGC",
  "ASIANPAINT",
  "GRASIM",
  "COALINDIA",
  "NESTLEIND",
  "SBILIFE",
  "TRENT",
  "TECHM",
  "JIOFIN",
  "MAXHEALTH",
  "APOLLOHOSP",
  "TATAMOTORS",
  "DRREDDY",
  "HDFCLIFE",
  "CIPLA",
  "TATACONSUM",
  "WIPRO",
  "ADANIENT",
];

// Map an NSE trading symbol to its Stooq quote symbol (NSE = ".ns").
export function toStooq(symbol) {
  return `${String(symbol || "").toLowerCase()}.ns`;
}

// Stooq echoes the symbol back in the CSV — normalize it to an NSE symbol.
export function fromStooq(stooqSymbol) {
  return String(stooqSymbol || "")
    .toUpperCase()
    .replace(/\.NS$/i, "")
    .trim();
}
