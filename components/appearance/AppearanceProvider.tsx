"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Palette } from "lucide-react";
import { APPEARANCE_KEY, DEFAULT_APPEARANCE, parseAppearance, resolveAppearance, type AppearanceSettings } from "@/lib/appearance";
import { AppearancePanel } from "./AppearancePanel";

type AppearanceContextValue = {
  active: AppearanceSettings;
  systemDark: boolean;
  dark: boolean;
  ready: boolean;
  open: boolean;
  openPanel: () => void;
  preview: (settings: AppearanceSettings) => void;
  cancel: () => void;
  save: () => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("AppearanceProvider is missing");
  return context;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [draft, setDraft] = useState<AppearanceSettings | null>(null);
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");

  useEffect(() => {
    if (!storageMessage) return;
    const timer = setTimeout(() => setStorageMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [storageMessage]);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(APPEARANCE_KEY);
      const stored = value ? parseAppearance(JSON.parse(value)) : null;
      if (stored) setSettings(stored);
    } catch {
      // Appearance must still work when browser storage is blocked or corrupt.
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(media.matches);
    setReady(true);
    const onSystemChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== APPEARANCE_KEY && event.key !== null) return;
      try {
        setSettings(event.newValue ? parseAppearance(JSON.parse(event.newValue)) ?? DEFAULT_APPEARANCE : DEFAULT_APPEARANCE);
      } catch { setSettings(DEFAULT_APPEARANCE); }
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const active = draft ?? settings;
  const palette = useMemo(() => resolveAppearance(active, systemDark), [active, systemDark]);
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    Object.entries(palette.variables).forEach(([name, value]) => root.style.setProperty(name, value));
    root.style.colorScheme = palette.dark ? "dark" : "light";
    root.dataset.appearance = palette.dark ? "dark" : "light";
    root.classList.toggle("dark", palette.dark);
    root.classList.toggle("light", !palette.dark);
  }, [palette, ready]);

  const openPanel = useCallback(() => { setStorageMessage(""); setDraft({ ...settings }); }, [settings]);
  const cancel = useCallback(() => setDraft(null), []);
  const save = useCallback(() => {
    if (!draft) return;
    setSettings(draft);
    try {
      window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(draft));
      setStorageMessage("Aparência salva neste navegador.");
    } catch {
      setStorageMessage("Tema aplicado nesta sessão. O navegador não permitiu salvar a preferência.");
    }
    setDraft(null);
  }, [draft]);

  return <AppearanceContext.Provider value={{ active, systemDark, dark: palette.dark, ready, open: !!draft, openPanel, preview: setDraft, cancel, save }}>
    {children}
    <AppearancePanel />
    {storageMessage && !draft && <div className="appearance-notice" role="status">{storageMessage}<button onClick={() => setStorageMessage("")} aria-label="Fechar aviso de aparência">×</button></div>}
  </AppearanceContext.Provider>;
}

export function AppearanceTrigger({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { openPanel, ready } = useAppearance();
  return <button type="button" className={`appearance-trigger ${className}`} aria-label="Personalizar aparência" onClick={openPanel} disabled={!ready}>
    <Palette size={19} strokeWidth={1.8} aria-hidden="true" />{!compact && <span>Aparência</span>}
  </button>;
}
