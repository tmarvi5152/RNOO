import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

const DEFAULT_THEME = {
  mode: "system",
  brand: "classic",
};

const ThemeContext = createContext(null);

const isConsumerRoute = (pathname) => {
  return /^(\/order\/|\/checkout\/|\/track\/|\/order-confirmation)/.test(
    pathname,
  );
};

const getSystemPreference = () => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const resolveThemeMode = (mode, systemPreference) => {
  return mode === "system" ? systemPreference : mode;
};

const applyThemeToDocument = ({ mode, resolvedMode, brand, surface }) => {
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.dataset.themeResolved = resolvedMode;
  root.dataset.themeBrand = brand;
  root.dataset.appSurface = surface;
  root.style.colorScheme = resolvedMode;
  root.classList.toggle("dark", resolvedMode === "dark");
};

export const ThemeProvider = ({ children }) => {
  const location = useLocation();
  const [storefrontTheme, setStorefrontTheme] = useState(DEFAULT_THEME);
  const [systemPreference, setSystemPreference] = useState(getSystemPreference);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => {
      setSystemPreference(event.matches ? "dark" : "light");
    };

    setSystemPreference(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const activeTheme = useMemo(() => {
    if (isConsumerRoute(location.pathname)) {
      const resolvedMode = resolveThemeMode(
        storefrontTheme.mode,
        systemPreference,
      );
      return {
        ...storefrontTheme,
        resolvedMode,
        surface: "consumer",
      };
    }

    return {
      mode: "light",
      brand: "admin",
      resolvedMode: "light",
      surface: "admin",
    };
  }, [location.pathname, storefrontTheme, systemPreference]);

  useEffect(() => {
    applyThemeToDocument(activeTheme);
  }, [activeTheme]);

  const value = useMemo(
    () => ({
      storefrontTheme,
      setStorefrontTheme,
      activeTheme,
    }),
    [storefrontTheme, activeTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

export const DEFAULT_STOREFRONT_THEME = DEFAULT_THEME;
