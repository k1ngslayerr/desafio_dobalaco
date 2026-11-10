import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { APPEARANCE_KEY, DEFAULT_APPEARANCE, appearanceBootstrap, createAppearancePalette, normalizeHex, parseAppearance, resolveAppearance } from "../lib/appearance.ts";

// An independent WCAG luminance calculation catches errors in the palette
// algorithm, rather than merely asserting values produced by that algorithm.
function luminance(color) {
  const channels = color.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function contrast(a, b) {
  const low = Math.min(luminance(a), luminance(b));
  const high = Math.max(luminance(a), luminance(b));
  return (high + .05) / (low + .05);
}

test("HEX inputs accept canonical and shorthand colors, rejecting incomplete or CSS input", () => {
  assert.equal(normalizeHex(" 000000 "), "#000000");
  assert.equal(normalizeHex("#fFf"), "#FFFFFF");
  assert.equal(normalizeHex("a1B2c3"), "#A1B2C3");
  for (const value of ["#0000", "0000#", "transparent", "red", "#GGGGGG", "#12345678", "url(x)", "var(--background)", ""]) {
    assert.equal(normalizeHex(value), null, value);
  }
});

test("stored preferences are validated instead of trusted as CSS", () => {
  assert.deepEqual(parseAppearance({ ...DEFAULT_APPEARANCE, background: "#abcdef" }), { ...DEFAULT_APPEARANCE, background: "#ABCDEF" });
  for (const value of [null, [], {}, { ...DEFAULT_APPEARANCE, version: 2 }, { ...DEFAULT_APPEARANCE, mode: "javascript" }, { ...DEFAULT_APPEARANCE, background: "#FFF" }, { ...DEFAULT_APPEARANCE, accent: "red;display:none" }]) {
    assert.equal(parseAppearance(value), null);
  }
});

test("arbitrary colors retain the exact button fill and readable text, labels and statuses", () => {
  const colors = ["#000000", "#FFFFFF", "#F5F6F8", "#15181D", "#3158CF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#777777", "#767676", "#747474", "#808000", "#00A6B6", "#E54477"];
  // Repeatable, varied RGB combinations catch transitions near middle luminance.
  let seed = 581;
  for (let i = 0; i < 30; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    colors.push(`#${(seed & 0xffffff).toString(16).padStart(6, "0").toUpperCase()}`);
  }
  for (const background of colors) for (const accent of colors) {
    const { variables: v } = createAppearancePalette(background, accent);
    const bases = [v["--appearance-background"], v["--appearance-surface"], v["--appearance-soft"]];
    assert.equal(v["--appearance-background"], background);
    assert.equal(v["--appearance-accent-fill"], accent);
    const checks = [
      [v["--appearance-text"], bases],
      [v["--appearance-muted"], bases],
      [v["--appearance-accent"], [...bases, v["--appearance-accent-soft"]]],
      [v["--appearance-on-accent"], [accent]],
      [v["--primary"], bases],
      [v["--primary-foreground"], [v["--primary"]]],
      ...["success", "warning", "danger"].map((status) => [v[`--appearance-${status}`], [...bases, v[`--appearance-${status}-soft`]]]),
    ];
    for (const [foreground, backgrounds] of checks) for (const base of backgrounds) {
      assert.ok(contrast(foreground, base) >= 4.5, `${background}/${accent}: ${foreground} on ${base}: ${contrast(foreground, base)}`);
    }
    for (const [name, value] of Object.entries(v)) if (name !== "--appearance-color-scheme") assert.match(value, /^#[\dA-F]{6}$/i);
  }
});

test("system preference affects automatic themes, while a custom black background stays black", () => {
  assert.equal(resolveAppearance(DEFAULT_APPEARANCE, false).variables["--appearance-background"], "#F5F6F8");
  assert.equal(resolveAppearance(DEFAULT_APPEARANCE, true).variables["--appearance-background"], "#15181D");
  const custom = { ...DEFAULT_APPEARANCE, mode: "custom", background: "#000000" };
  assert.deepEqual(resolveAppearance(custom, true), resolveAppearance(custom, false));
});

test("saturated backgrounds keep tonal surfaces instead of nearly white cards", () => {
  const channels = (color) => color.slice(1).match(/../g).map((value) => parseInt(value, 16));
  const chroma = (color) => Math.max(...channels(color)) - Math.min(...channels(color));
  for (const background of ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#00FFFF", "#FF00FF", "#E54477", "#00A6B6"]) {
    for (const accent of ["#3158CF", "#FFFFFF", "#000000"]) {
      const { variables: v } = createAppearancePalette(background, accent);
      for (const surface of [v["--appearance-surface"], v["--appearance-soft"]]) {
        assert.ok(chroma(surface) >= chroma(background) * .8, `${background}: ${surface} lost the background colour`);
        const original = channels(background), result = channels(surface);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          if (original[i] > original[j]) assert.ok(result[i] > result[j], `${background}: ${surface} changed hue`);
        }
      }
    }
  }
  const neutral = createAppearancePalette("#F5F6F8", "#3158CF").variables["--appearance-surface"];
  assert.ok(channels(neutral).every((channel) => channel >= 250), "neutral light theme should retain light cards");
});

test("pre-hydration bootstrap produces the same theme and tolerates damaged/blocked storage", () => {
  const cases = [
    { stored: null, systemDark: false, expected: DEFAULT_APPEARANCE },
    { stored: "{broken", systemDark: true, expected: DEFAULT_APPEARANCE },
    { stored: JSON.stringify({ ...DEFAULT_APPEARANCE, accent: "red" }), systemDark: false, expected: DEFAULT_APPEARANCE },
    { stored: JSON.stringify({ ...DEFAULT_APPEARANCE, mode: "custom", background: "#000000", accent: "#FFFF00" }), systemDark: false, expected: { ...DEFAULT_APPEARANCE, mode: "custom", background: "#000000", accent: "#FFFF00" } },
    { stored: JSON.stringify({ ...DEFAULT_APPEARANCE, mode: "custom", background: "#00FF00" }), systemDark: false, expected: { ...DEFAULT_APPEARANCE, mode: "custom", background: "#00FF00" } },
    { blocked: true, systemDark: true, expected: DEFAULT_APPEARANCE },
  ];
  for (const entry of cases) {
    const values = new Map(), classes = new Map();
    const root = { dataset: {}, style: { setProperty: (name, value) => values.set(name, value) }, classList: { toggle: (name, value) => classes.set(name, value) } };
    vm.runInNewContext(appearanceBootstrap, {
      document: { documentElement: root },
      localStorage: { getItem: (key) => { assert.equal(key, APPEARANCE_KEY); if (entry.blocked) throw new Error("blocked"); return entry.stored; } },
      matchMedia: () => ({ matches: entry.systemDark }),
    });
    const expected = resolveAppearance(entry.expected, entry.systemDark);
    assert.deepEqual(Object.fromEntries(values), expected.variables);
    assert.equal(classes.get("dark"), expected.dark);
    assert.equal(root.style.colorScheme, expected.dark ? "dark" : "light");
  }
});
