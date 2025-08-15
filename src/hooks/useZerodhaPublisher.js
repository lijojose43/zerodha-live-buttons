import { useEffect, useState } from "react";

export default function useZerodhaPublisher() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.kite_publisher_load) {
      setReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://kite.trade/publisher.js?v=3";
    script.async = true;
    script.onload = () => {
      if (window.kite_publisher_load) {
        setReady(true);
      }
    };
    document.body.appendChild(script);
  }, []);

  const refreshButtons = () => {
    if (window.kite_publisher_load) {
      window.kite_publisher_load();
    }
  };

  return { ready, refreshButtons };
}
