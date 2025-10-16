import { useState, useEffect } from "react";

const PWAStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check if app is installed (running in standalone mode)
    const checkInstalled = () => {
      const isStandalone = window.matchMedia(
        "(display-mode: standalone)"
      ).matches;
      const isIOSStandalone = window.navigator.standalone === true;
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    // Check current theme and listen for changes
    const checkTheme = () => {
      const savedTheme = localStorage.getItem("theme");
      const isDark = savedTheme === "dark" || 
        (savedTheme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setIsDarkTheme(isDark);
      
      // Set PWA theme color based on current theme
      updatePWAThemeColor(isDark);
    };

    checkInstalled();
    checkTheme();

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      const htmlElement = document.documentElement;
      const isDark = htmlElement.classList.contains('dark');
      setIsDarkTheme(isDark);
      updatePWAThemeColor(isDark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      observer.disconnect();
    };
  }, []);

  // Update PWA theme color meta tag
  const updatePWAThemeColor = (isDark) => {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const color = isDark ? '#0f172a' : '#f8fafc'; // slate-950 for dark, slate-50 for light
    
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', color);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    }
  };

  return <div className="fixed top-4 left-4 z-40 flex gap-2"></div>;
};

export default PWAStatus;
