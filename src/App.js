import { useEffect, useState } from "react";
import StockCard from "./components/StockCard";

export default function App() {
  const FINNHUB_API_KEY = "d2dgmohr01qjem5knv90d2dgmohr01qjem5knv9g";
  const stocks = ["AAPL"]; // Add or remove symbols here
  const [theme, setTheme] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved === "light" || saved === "dark") return saved;
    // Prefer system
    const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zerodha Live Price Buttons</h1>
        <button
          onClick={toggleTheme}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-100 dark:ring-slate-700 dark:hover:bg-slate-900"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === "dark" ? (
            // Sun icon for light mode
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
              <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75Zm0 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm9-6.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5H20.25a.75.75 0 0 1 .75.75ZM6 12a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1 0-1.5H5.25A.75.75 0 0 1 6 12Zm11.78 7.03a.75.75 0 0 1-1.06 0l-1.06-1.06a.75.75 0 1 1 1.06-1.06l1.06 1.06c.29.29.29.77 0 1.06ZM8.32 7.09a.75.75 0 0 1-1.06 0L6.2 6.03A.75.75 0 0 1 7.26 4.97l1.06 1.06c.29.29.29.77 0 1.06Zm9.46-2.12a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM7.26 17.97a.75.75 0 0 1 0-1.06l1.06-1.06a.75.75 0 0 1 1.06 1.06L8.32 17.97a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
            </svg>
          ) : (
            // Moon icon for dark mode
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M21.752 15.002A9.718 9.718 0 0 1 12.002 22C6.476 22 2 17.523 2 11.998 2 7.517 4.86 3.796 8.77 2.43a.75.75 0 0 1 .964.964A8.219 8.219 0 0 0 9.5 6.248c0 4.549 3.69 8.238 8.239 8.238 1.386 0 2.69-.333 3.855-.934a.75.75 0 0 1 .158 1.45Z" />
            </svg>
          )}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </header>

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
