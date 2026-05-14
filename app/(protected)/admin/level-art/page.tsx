"use client";

import { LevelArt } from "@/components/LevelArt";

const BAND_LABELS: Record<number, string> = {
  1:  "Tier 1-10 — Sólido",
  2:  "Tier 11-20 — Anel",
  3:  "Tier 21-30 — Gradiente",
  4:  "Tier 31-40 — Estrela",
  5:  "Tier 41-50 — Raios",
  6:  "Tier 51-60 — Halos",
  7:  "Tier 61-70 — Pulso",
  8:  "Tier 71-80 — Spin",
  9:  "Tier 81-90 — Glow",
  10: "Tier 91-100 — Lendário",
};

export default function LevelArtPreviewPage() {
  const tiers = Array.from({ length: 100 }, (_, i) => i + 1);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold">Preview — 100 Level Arts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cada tier cobre 10 níveis. Tier 1 = níveis 1-10, Tier 2 = níveis 11-20, etc.
        </p>
      </div>

      {Array.from({ length: 10 }, (_, band) => {
        const bandNum = band + 1;
        const bandTiers = tiers.slice(band * 10, band * 10 + 10);
        return (
          <section key={bandNum}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
              {BAND_LABELS[bandNum]}
            </h3>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-4">
              {bandTiers.map((tier) => (
                <div key={tier} className="flex flex-col items-center gap-2">
                  <LevelArt tier={tier} level={tier} size={48} />
                  <span className="text-xs text-muted-foreground">{tier}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
