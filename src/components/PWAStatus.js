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
      const isPWA = isStandalone || isIOSStandalone;
      
      setIsInstalled(isPWA);
      
      // Request desktop site mode when PWA is detected
      if (isPWA) {
        requestDesktopSite();
      }
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

  // Request desktop site mode for PWA
  const requestDesktopSite = () => {
    try {
      // Update viewport for desktop experience
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=1024, initial-scale=0.8, user-scalable=yes');
      }

      // Add desktop user agent hint if supported
      if ('userAgentData' in navigator && navigator.userAgentData.getHighEntropyValues) {
        navigator.userAgentData.getHighEntropyValues(['platform', 'platformVersion'])
          .then(ua => {
            console.log('PWA: Desktop site mode requested', ua);
          })
          .catch(err => console.log('PWA: User agent data not available', err));
      }

      // Set desktop-friendly CSS custom properties
      document.documentElement.style.setProperty('--pwa-desktop-mode', '1');
      document.body.classList.add('pwa-desktop-mode');
      
      console.log('PWA: Desktop site mode enabled');
    } catch (error) {
      console.log('PWA: Desktop site mode request failed', error);
    }
  };

  return <div className="fixed top-4 left-4 z-40 flex gap-2"></div>;
};

export default PWAStatus;
