import ZerodhaLivePriceButton from "./components/ZerodhaLivePriceButton";

export default function App() {
  const FINNHUB_API_KEY = "d2dgmohr01qjem5knv90d2dgmohr01qjem5knv9g";

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Zerodha Live Price Buttons</h1>

      <div className="flex gap-4">
        <ZerodhaLivePriceButton
          symbol="PFC"
          action="BUY"
          quantity={2}
          finnhubApiKey={FINNHUB_API_KEY}
        />
        <ZerodhaLivePriceButton
          symbol="DLF"
          action="BUY"
          quantity={2}
          finnhubApiKey={FINNHUB_API_KEY}
        />
        <ZerodhaLivePriceButton
          symbol="RECLTD"
          action="BUY"
          quantity={2}
          finnhubApiKey={FINNHUB_API_KEY}
        />
      </div>

      <div className="flex gap-4">
        <ZerodhaLivePriceButton
          symbol="PFC"
          action="SELL"
          quantity={2}
          finnhubApiKey={FINNHUB_API_KEY}
        />
        <ZerodhaLivePriceButton
          symbol="DLF"
          action="SELL"
          quantity={2}
          finnhubApiKey={FINNHUB_API_KEY}
        />
        <ZerodhaLivePriceButton
          symbol="RECLTD"
          action="SELL"
          quantity={2}
          finnhubApiKey={FINNHUB_API_KEY}
        />
      </div>
    </div>
  );
}
