import { useEffect, useState } from "react";

export default function useZerodhaPublisher() {
  const [ready, setReady] = useState(false);
  const [kite, setKite] = useState(null);

  useEffect(() => {
    const init = () => {
      if (typeof window.KiteConnect === "undefined" || !window.KiteConnect.ready) return false;
      window.KiteConnect.ready(function () {
        try {
          // Prefer explicit global key if present; else read from first .kite-button data-kite
          const key = window.__KITE_PUBLISHER_KEY__ || document.querySelector(".kite-button")?.getAttribute("data-kite");
          if (!key) return;
          const instance = new window.KiteConnect(key);
          setKite(instance);
          setReady(true);
        } catch {
          // ignore
        }
      });
      return true;
    };

    if (init()) return;
    const script = document.createElement("script");
    script.src = "https://kite.trade/publisher.js?v=3";
    script.async = true;
    script.onload = () => {
      // Try init after load
      init();
    };
    document.body.appendChild(script);
  }, []);

  const refreshButtons = () => {
    if (typeof window.kite_publisher_load === "function") {
      window.kite_publisher_load();
    }
  };

  return { ready, refreshButtons, kite };
}
