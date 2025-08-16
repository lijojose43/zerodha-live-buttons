import StockCard from "./components/StockCard";

export default function App() {
  const FINNHUB_API_KEY = "d2dgmohr01qjem5knv90d2dgmohr01qjem5knv9g";
  const stocks = ["AAPL"]; // Add or remove symbols here

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Zerodha Live Price Buttons</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stocks.map((sym) => (
          <StockCard
            key={sym}
            symbol={sym}
            quantity={2}
            exchange="NSE"
            finnhubApiKey={FINNHUB_API_KEY}
          />
        ))}
      </div>
    </div>
  );
}
