// Shared Zerodha intraday-equity charges engine.
// Single source of truth — imported by both the trading cards
// (StockCard), the landing page calculator, and paper trading.
// Mirrors Zerodha's official calculator (zerodha.com/static/js/brokerage.js
// -> cal_intra, NSE branch) step for step, including its per-step
// rounding: brokerage legs rounded before summing, STT on the SELL leg
// only rounded to whole rupees, exchange charge + IPFT rounded
// separately before summing, GST on (brokerage + etc + SEBI),
// stamp duty on the buy leg rounded to whole rupees.

export const round2 = (n) => parseFloat(Number(n).toFixed(2));

export function getBrokerage(buyPrice, sellPrice, qty, exchange = "NSE") {
  if (!buyPrice || !sellPrice || !qty) return 0;
  // Zerodha reads inputs already rounded to 2 decimals
  const bp = parseFloat(Number(buyPrice).toFixed(2));
  const sp = parseFloat(Number(sellPrice).toFixed(2));
  const q = parseFloat(Number(qty).toFixed(2));

  let brokerageBuy = bp * q * 0.0003;
  brokerageBuy = brokerageBuy > 20 ? 20 : round2(brokerageBuy);
  let brokerageSell = sp * q * 0.0003;
  brokerageSell = brokerageSell > 20 ? 20 : round2(brokerageSell);
  const brokerage = round2(brokerageBuy + brokerageSell);

  const turnover = round2((bp + sp) * q);

  // STT: sell side only, whole rupees (0 when both legs are 0)
  let stt = Math.round(round2(sp * q * 0.00025));
  if (bp === 0 && sp === 0) stt = 0;

  // SEBI charges
  const sebiCharges = round2(turnover * 0.000001);

  // Exchange transaction charges (+ NSE IPFT), each rounded before summing
  const isNSE = (exchange || "").toUpperCase() === "NSE";
  let transactionCharges = isNSE
    ? round2(0.0000297 * turnover)
    : round2(0.0000375 * turnover);
  const nseIpft = isNSE ? round2(0.000001 * turnover) : 0;
  transactionCharges = round2(transactionCharges + nseIpft);

  // GST on brokerage + etc + sebi
  const gst = round2(0.18 * (brokerage + transactionCharges + sebiCharges));

  // Stamp duty on buy side, whole rupees
  const stampCharges = Math.round(round2(bp * q * 0.00003));

  const totalCharges = round2(
    brokerage + stt + transactionCharges + gst + sebiCharges + stampCharges
  );
  return totalCharges;
}
