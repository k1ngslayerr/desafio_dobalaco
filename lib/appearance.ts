export type AppearanceSettings = {
  version: 1;
  mode: "system" | "custom";
  background: string;
  accent: string;
};

export const APPEARANCE_KEY = "desafiohub.appearance.v1";
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  version: 1, mode: "system", background: "#F5F6F8", accent: "#3158CF",
};

export function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex)) return `#${hex.split("").map((digit) => digit + digit).join("")}`.toUpperCase();
  return /^[\da-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

export function parseAppearance(value: unknown): AppearanceSettings | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AppearanceSettings>;
  if (candidate.version !== 1 || !["system", "custom"].includes(candidate.mode ?? "")) return null;
  if (typeof candidate.background !== "string" || !/^#[\da-f]{6}$/i.test(candidate.background) ||
      typeof candidate.accent !== "string" || !/^#[\da-f]{6}$/i.test(candidate.accent)) return null;
  const background = typeof candidate.background === "string" ? normalizeHex(candidate.background) : null;
  const accent = typeof candidate.accent === "string" ? normalizeHex(candidate.accent) : null;
  return background && accent ? { version: 1, mode: candidate.mode!, background, accent } : null;
}

// Self-contained so the very same palette calculation can run before hydration.
// Its arguments must be canonical #RRGGBB strings. No user CSS is interpolated.
export function createAppearancePalette(background: string, accent: string) {
  const rgb = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const mix = (a: string, b: string, amount: number) => {
    const from = rgb(a), to = rgb(b);
    return `#${from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  };
  const luminance = (hex: string) => rgb(hex).reduce((total, channel, index) => {
    const s = channel / 255;
    return total + (s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index];
  }, 0);
  const contrast = (a: string, b: string) => {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  };
  const pole = contrast(background, "#FFFFFF") > contrast(background, "#000000") ? "#FFFFFF" : "#000000";
  const dark = pole === "#FFFFFF";
  let surface = dark ? mix(background, "#FFFFFF", .065) : mix(background, "#FFFFFF", .96);
  let soft = dark ? mix(background, "#FFFFFF", .10) : mix(background, "#000000", .035);
  // At middle luminances, brightening a dark surface can break white text.
  // Move those surfaces toward the opposite pole instead of crossing the limit.
  if (contrast(surface, pole) < 4.5) surface = mix(background, dark ? "#000000" : "#FFFFFF", .10);
  if (contrast(soft, pole) < 4.5) soft = mix(background, dark ? "#000000" : "#FFFFFF", .16);
  const bases = [background, surface, soft];
  const readable = (desired: string, backgrounds = bases) => {
    for (let step = 0; step <= 100; step++) {
      const color = mix(desired, pole, step / 100);
      if (backgrounds.every((base) => contrast(color, base) >= 4.5)) return color;
    }
    return pole;
  };
  const text = readable(dark ? "#F2F4F7" : "#222733");
  const muted = readable(mix(background, text, .56));
  const tint = (color: string) => {
    const tinted = mix(surface, color, .10);
    return contrast(tinted, pole) >= 4.5 ? tinted : mix(surface, dark ? "#000000" : "#FFFFFF", .10);
  };
  const accentSoft = tint(accent);
  // Protect selected navigation labels even for white/yellow/black accents.
  const accentInk = readable(accent, [...bases, accentSoft]);
  const successSoft = tint("#359669");
  const warningSoft = tint("#C58A2C");
  const dangerSoft = tint("#D15148");
  const onAccent = contrast(accent, "#FFFFFF") > contrast(accent, "#000000") ? "#FFFFFF" : "#000000";
  const onLegacyPrimary = contrast(accentInk, "#FFFFFF") > contrast(accentInk, "#000000") ? "#FFFFFF" : "#000000";
  return {
    dark,
    variables: {
      "--appearance-color-scheme": dark ? "dark" : "light",
      "--appearance-background": background,
      "--appearance-surface": surface,
      "--appearance-soft": soft,
      "--appearance-text": text,
      "--appearance-muted": muted,
      "--appearance-line": mix(surface, text, .18),
      "--appearance-accent": accentInk,
      "--appearance-accent-fill": accent,
      "--appearance-on-accent": onAccent,
      "--appearance-accent-soft": accentSoft,
      "--appearance-success": readable("#267052", [...bases, successSoft]),
      "--appearance-success-soft": successSoft,
      "--appearance-warning": readable("#91601B", [...bases, warningSoft]),
      "--appearance-warning-soft": warningSoft,
      "--appearance-danger": readable("#B52F36", [...bases, dangerSoft]),
      "--appearance-danger-soft": dangerSoft,
      "--background": background, "--foreground": text,
      "--card": surface, "--card-foreground": text,
      "--popover": surface, "--popover-foreground": text,
      "--primary": accentInk, "--primary-foreground": onLegacyPrimary,
      "--secondary": soft, "--secondary-foreground": text,
      "--muted": soft, "--muted-foreground": muted,
      "--accent": accentSoft, "--accent-foreground": readable(accent, [accentSoft]),
      "--border": mix(surface, text, .18), "--input": mix(surface, text, .24),
      "--ring": accentInk, "--destructive": readable("#B52F36"),
      "--sidebar": surface, "--sidebar-foreground": text,
      "--sidebar-primary": accentInk, "--sidebar-primary-foreground": onLegacyPrimary,
      "--sidebar-accent": accentSoft, "--sidebar-accent-foreground": readable(accent, [accentSoft]),
      "--sidebar-border": mix(surface, text, .18), "--sidebar-ring": accentInk,
    },
  };
}

export function resolveAppearance(settings: AppearanceSettings, systemDark: boolean) {
  return createAppearancePalette(settings.mode === "system" ? (systemDark ? "#15181D" : "#F5F6F8") : settings.background, settings.accent);
}

// A small inline bootstrap avoids flashing a white page for a saved dark theme.
// Validation here is intentionally strict; malformed or old storage is ignored.
export const appearanceBootstrap = `(() => {
  try {
    const makePalette = ${createAppearancePalette.toString()};
    let settings = ${JSON.stringify(DEFAULT_APPEARANCE)};
    try {
      const stored = JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)}) || 'null');
      if (stored && stored.version === 1 && ['system', 'custom'].includes(stored.mode) &&
          /^#[0-9a-f]{6}$/i.test(stored.background) && /^#[0-9a-f]{6}$/i.test(stored.accent)) settings = stored;
    } catch {}
    const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;
    const palette = makePalette(settings.mode === 'system' ? (systemDark ? '#15181D' : '#F5F6F8') : settings.background, settings.accent);
    const root = document.documentElement;
    Object.entries(palette.variables).forEach(([name, value]) => root.style.setProperty(name, value));
    root.style.colorScheme = palette.dark ? 'dark' : 'light';
    root.dataset.appearance = palette.dark ? 'dark' : 'light';
    root.classList.toggle('dark', palette.dark);
    root.classList.toggle('light', !palette.dark);
  } catch {}
})()`;
