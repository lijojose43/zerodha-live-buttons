// NSE symbol → official company domain, used to fetch real company logos
// via the Clearbit Logo API (no key required). Symbols missing here fall
// back to the first-letter avatar in StockCard.
const DOMAINS = {
  HDFCBANK: "hdfcbank.com",
  ICICIBANK: "icicibank.com",
  RELIANCE: "ril.com",
  BHARTIARTL: "airtel.com",
  LT: "larsentoubro.com",
  SBIN: "sbi.co.in",
  INFY: "infosys.com",
  AXISBANK: "axisbank.com",
  KOTAKBANK: "kotak.com",
  "M&M": "mahindra.com",
  ITC: "itcportal.com",
  TCS: "tcs.com",
  BAJFINANCE: "bajajfinserv.in",
  HINDUNILVR: "hul.co.in",
  MARUTI: "marutisuzuki.com",
  SUNPHARMA: "sunpharma.com",
  NTPC: "ntpc.co.in",
  TITAN: "titancompany.in",
  ETERNAL: "zomato.com",
  TATASTEEL: "tatasteel.com",
  BEL: "bel-india.in",
  SHRIRAMFIN: "shriramfinance.in",
  ULTRACEMCO: "ultratechcement.com",
  HCLTECH: "hcltech.com",
  POWERGRID: "powergrid.in",
  HINDALCO: "hindalco.com",
  JSWSTEEL: "jsw.in",
  BAJAJFINSV: "bajajfinserv.in",
  ADANIPORTS: "adaniports.com",
  "BAJAJ-AUTO": "bajajauto.com",
  EICHERMOT: "eichermotors.com",
  INDIGO: "goindigo.in",
  ONGC: "ongcindia.com",
  ASIANPAINT: "asianpaints.com",
  GRASIM: "grasim.com",
  COALINDIA: "coalindia.in",
  NESTLEIND: "nestle.in",
  SBILIFE: "sbilife.co.in",
  TRENT: "trentlimited.com",
  TECHM: "techmahindra.com",
  JIOFIN: "jio.com",
  MAXHEALTH: "maxhealthcare.in",
  APOLLOHOSP: "apollohospitals.com",
  TATAMOTORS: "tatamotors.com",
  DRREDDY: "drreddys.com",
  HDFCLIFE: "hdfclife.com",
  CIPLA: "cipla.com",
  TATACONSUM: "tataconsumer.com",
  WIPRO: "wipro.com",
  ADANIENT: "adanienterprises.com",
};

export function getCompanyDomain(symbol) {
  const key = String(symbol || "").toUpperCase().trim();
  return DOMAINS[key] || null;
}

export function getCompanyLogoUrl(symbol, size = 128) {
  const domain = getCompanyDomain(symbol);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
