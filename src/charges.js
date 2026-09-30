// Shared Zerodha intraday-equity charges engine.
// Single source of truth — imported by both the trading cards
// (StockCard) and the landing page calculator. Based on provided PHP logic.

export const round2 = (n) => Math.round(n * 100) / 100;

const iRound = (n) => Math.round(n);

export function getBrokerage(buyPrice, sellPrice, qty, exchange = "NSE") {
  if (!buyPrice || !sellPrice || !qty) return 0;
  const buyTotal = buyPrice * qty;
  const sellTotal = sellPrice * qty;
  const turnover = round2((sellPrice + buyPrice) * qty);

  let brokerageBuy = (buyTotal * 0.03) / 100;
  let brokerageSell = (sellTotal * 0.03) / 100;
  brokerageBuy = brokerageBuy < 20 ? brokerageBuy : 20;
  brokerageSell = brokerageSell < 20 ? brokerageSell : 20;
  const brokerage = round2(brokerageBuy + brokerageSell);

  // STT based on average price of buy and sell
  let stt = iRound(round2(((buyPrice + sellPrice) / 2) * qty * 0.00025));
  if (buyPrice === 0 && sellPrice === 0) stt = 0;

  // SEBI charges
  const sebiCharges = round2(turnover * 0.000001);

  // Exchange transaction charges and NSE IPFT
  const isNSE = (exchange || "").toUpperCase() === "NSE";
  const baseEtc = isNSE ? turnover * 0.0000297 : turnover * 0.0000375;
  const nseIpft = isNSE ? turnover * 0.000001 : 0;
  const transactionCharges = round2(baseEtc + nseIpft);

  // GST on brokerage + etc + sebi
  const gst = round2(0.18 * (brokerage + transactionCharges + sebiCharges));

  // Stamp duty on buy side
  const stampCharges = iRound(round2(buyTotal * 0.00003));

  const totalCharges = round2(
    brokerage + stt + transactionCharges + gst + sebiCharges + stampCharges
  );
  return totalCharges;
}
