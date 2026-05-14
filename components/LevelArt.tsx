"use client";

/**
 * LevelArt – renders a unique SVG badge for each of the 100 art tiers.
 *
 * Progression:
 *  Tier  1-10  : solid shapes (circle / hexagon) — pure color
 *  Tier 11-20  : outlined with thin ring
 *  Tier 21-30  : dual-color gradient fill
 *  Tier 31-40  : decorative inner star / glow
 *  Tier 41-50  : outer spikes / rays
 *  Tier 51-60  : layered halos + inner pattern
 *  Tier 61-70  : CSS pulse animation
 *  Tier 71-80  : CSS slow-spin + shimmer ring
 *  Tier 81-90  : multi-layer animated glow
 *  Tier 91-100 : full composition with orbiting particles
 */

import React from "react";

// ── Palette per tier band ────────────────────────────────────────
const PALETTE: Record<number, { primary: string; secondary: string; glow: string }> = {
  1:  { primary: "#6b7280", secondary: "#9ca3af", glow: "#6b728080" },
  2:  { primary: "#10b981", secondary: "#34d399", glow: "#10b98180" },
  3:  { primary: "#3b82f6", secondary: "#60a5fa", glow: "#3b82f680" },
  4:  { primary: "#8b5cf6", secondary: "#a78bfa", glow: "#8b5cf680" },
  5:  { primary: "#f59e0b", secondary: "#fbbf24", glow: "#f59e0b80" },
  6:  { primary: "#ef4444", secondary: "#f87171", glow: "#ef444480" },
  7:  { primary: "#ec4899", secondary: "#f472b6", glow: "#ec489980" },
  8:  { primary: "#14b8a6", secondary: "#2dd4bf", glow: "#14b8a680" },
  9:  { primary: "#f97316", secondary: "#fb923c", glow: "#f9731680" },
  10: { primary: "#a855f7", secondary: "#c084fc", glow: "#a855f780" },
};

function getPalette(tier: number) {
  const band = Math.ceil(tier / 10);
  return PALETTE[band] ?? PALETTE[10];
}

// ── Level number text overlay ─────────────────────────────────────
function LevelText({ level, size }: { level: number; size: number }) {
  const digits = String(level).length;
  const fontSize =
    digits === 1 ? size * 0.38 :
    digits === 2 ? size * 0.32 :
                   size * 0.24;
  return (
    <text
      x="50%" y="50%"
      dominantBaseline="central"
      textAnchor="middle"
      fontSize={fontSize}
      fontWeight="700"
      fontFamily="system-ui, sans-serif"
      fill="white"
      stroke="rgba(0,0,0,0.4)"
      strokeWidth={size * 0.025}
      paintOrder="stroke"
    >
      {level}
    </text>
  );
}

// ── SVG helpers ──────────────────────────────────────────────────

/** Round to 4 decimal places to avoid SSR/client floating-point mismatches */
function r4(n: number) {
  return Math.round(n * 10000) / 10000;
}

function hexPath(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${r4(cx + r * Math.cos(a))},${r4(cy + r * Math.sin(a))}`;
  });
  return `M ${pts.join(" L ")} Z`;
}

function starPath(cx: number, cy: number, outerR: number, innerR: number, points: number) {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rv = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI / points) * i - Math.PI / 2;
    pts.push(`${r4(cx + rv * Math.cos(a))},${r4(cy + rv * Math.sin(a))}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

// ── Unique ID factory (stable per tier) ─────────────────────────
function uid(tier: number, suffix: string) {
  return `la_t${tier}_${suffix}`;
}

// ── Individual tier renderers ────────────────────────────────────

/** Tiers 1-10: solid shapes */
function SolidTier({ tier, size, level }: { tier: number; size: number; level?: number }) {
  const { primary } = getPalette(tier);
  const c = size / 2;
  const r = size * 0.4;
  const useHex = tier % 2 === 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {useHex
        ? <path d={hexPath(c, c, r)} fill={primary} />
        : <circle cx={c} cy={c} r={r} fill={primary} />}
      {level !== undefined && <LevelText level={level} size={size} />}
    </svg>
  );
}

/** Tiers 11-20: solid shape + outer ring */
function RingTier({ tier, size, level }: { tier: number; size: number; level?: number }) {
  const { primary, secondary } = getPalette(tier);
  const c = size / 2;
  const r = size * 0.35;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r * 1.3} fill="none" stroke={secondary} strokeWidth={size * 0.05} />
      <circle cx={c} cy={c} r={r} fill={primary} />
      {level !== undefined && <LevelText level={level} size={size} />}
    </svg>
  );
}

/** Tiers 21-30: gradient fill */
function GradientTier({ tier, size, level }: { tier: number; size: number; level?: number }) {
  const { primary, secondary } = getPalette(tier);
  const c = size / 2;
  const r = size * 0.4;
  const id = uid(tier, "grad");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={id} cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
      </defs>
      <path d={hexPath(c, c, r)} fill={`url(#${id})`} />
      <circle cx={c} cy={c} r={r * 0.3} fill={secondary} opacity={0.6} />
      {level !== undefined && <LevelText level={level} size={size} />}
    </svg>
  );
}

/** Tiers 31-40: gradient + inner star */
function StarTier({ tier, size, level }: { tier: number; size: number; level?: number }) {
  const { primary, secondary, glow } = getPalette(tier);
  const c = size / 2;
  const r = size * 0.4;
  const id = uid(tier, "grad");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={id} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
        <filter id={uid(tier, "glow")}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* glow halo */}
      <circle cx={c} cy={c} r={r * 1.1} fill={glow} />
      <path d={hexPath(c, c, r)} fill={`url(#${id})`} />
      {/* inner 6-point star */}
      <path d={starPath(c, c, r * 0.45, r * 0.2, 6)}
        fill={secondary} filter={`url(#${uid(tier, "glow")})`} />
      {level !== undefined && <LevelText level={level} size={size} />}
    </svg>
  );
}

/** Tiers 41-50: spikes / rays radiating out */
function RayTier({ tier, size, level }: { tier: number; size: number; level?: number }) {
  const { primary, secondary, glow } = getPalette(tier);
  const c = size / 2;
  const r = size * 0.35;
  const rays = 8 + (tier - 41);
  const id = uid(tier, "grad");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
      </defs>
      {/* rays */}
      {Array.from({ length: rays }, (_, i) => {
        const a = (Math.PI * 2 * i) / rays;
        const x1 = r4(c + r * 1.05 * Math.cos(a));
        const y1 = r4(c + r * 1.05 * Math.sin(a));
        const x2 = r4(c + r * 1.55 * Math.cos(a));
        const y2 = r4(c + r * 1.55 * Math.sin(a));
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={secondary} strokeWidth={size * 0.04} strokeLinecap="round" opacity={0.7} />;
      })}
      {/* glow */}
      <circle cx={c} cy={c} r={r * 1.1} fill={glow} />
      <path d={hexPath(c, c, r)} fill={`url(#${id})`} />
      <path d={starPath(c, c, r * 0.4, r * 0.18, 6)} fill={secondary} opacity={0.9} />
      {level !== undefined && <LevelText level={level} size={size} />}
    </svg>
  );
}

/** Tiers 51-60: layered halos */
function HaloTier({ tier, size, level }: { tier: number; size: number; level?: number }) {
  const { primary, secondary, glow } = getPalette(tier);
  const c = size / 2;
  const r = size * 0.32;
  const layers = tier - 50;
  const id = uid(tier, "grad");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={id} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
      </defs>
      {/* concentric halos */}
      {Array.from({ length: layers }, (_, i) => (
        <circle key={i} cx={c} cy={c} r={r * (1.25 + i * 0.18)}
          fill="none" stroke={secondary} strokeWidth={size * 0.025}
          opacity={0.5 - i * 0.04} />
      ))}
      <circle cx={c} cy={c} r={r * 1.15} fill={glow} />
      <path d={hexPath(c, c, r)} fill={`url(#${id})`} />
      <path d={starPath(c, c, r * 0.45, r * 0.2, 8)} fill={secondary} opacity={0.85} />
      {level !== undefined && <LevelText level={level} size={size} />}
    </svg>
  );
}

/** Tiers 61-70: pulse animation */
function PulseTier({ tier, size, level }: { tier: number; size: number; level?: number }) {
  const { primary, secondary, glow } = getPalette(tier);
  const c = size / 2;
  const r = size * 0.33;
  const id = uid(tier, "grad");
  const dur = `${1.8 - (tier - 61) * 0.05}s`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={id} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
      </defs>
      {/* animated pulse ring */}
      <circle cx={c} cy={c} r={r} fill={glow} opacity={0.6}>
        <animate attributeName="r" values={`${r};${r * 1.6};${r}`} dur={dur} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur={dur} repeatCount="indefinite" />
      </circle>
      <path d={hexPath(c, c, r)} fill={`url(#${id})`} />
      <path d={starPath(c, c, r * 0.5, r * 0.22, 8)} fill={secondary} />
      {level !== undefined && <LevelText level={level} size={size} />}
    </svg>
  );
}

/** Tiers 71-80: spin ring + shimmer */
function SpinTier({ tier, size, level }: { tier: number; size: number; level?: number }) {
  const { primary, secondary, glow } = getPalette(tier);
  const c = size / 2;
  const r = size * 0.33;
  const segments = 8 + (tier - 71);
  const idGrad = uid(tier, "grad");
  const idSpin = uid(tier, "spin");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={idGrad} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
      </defs>
      {/* spinning dashed ring */}
      <g id={idSpin}>
        <circle cx={c} cy={c} r={r * 1.35}
          fill="none" stroke={secondary} strokeWidth={size * 0.04}
          strokeDasharray={`${(2 * Math.PI * r * 1.35) / segments / 2} ${(2 * Math.PI * r * 1.35) / segments / 2}`}
          opacity={0.75}>
          <animateTransform attributeName="transform" type="rotate"
            from={`0 ${c} ${c}`} to={`360 ${c} ${c}`} dur="4s" repeatCount="indefinite" />
        </circle>
      </g>
      {/* glow */}
      <circle cx={c} cy={c} r={r * 1.1} fill={glow} opacity={0.5}>
        <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite" />
      </circle>
      <path d={hexPath(c, c, r)} fill={`url(#${idGrad})`} />
      <path d={starPath(c, c, r * 0.48, r * 0.2, 8)} fill={secondary} />
      {level !== undefined && <LevelText level={level} size={size} />}
    </svg>
  );
}

/** Tiers 81-90: multi-layer glow + inner mandala */
function GlowTier({ tier, size, level }: { tier: number; size: number; level?: number }) {
  const { primary, secondary, glow } = getPalette(tier);
  const c = size / 2;
  const r = size * 0.3;
  const idGrad = uid(tier, "grad");
  const extra = tier - 80;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={idGrad} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
        <filter id={uid(tier, "blur")}>
          <feGaussianBlur stdDeviation={3 + extra * 0.3} />
        </filter>
      </defs>
      {/* blurred glow base */}
      <circle cx={c} cy={c} r={r * 1.5} fill={primary} filter={`url(#${uid(tier, "blur")})`} opacity={0.55}>
        <animate attributeName="opacity" values="0.55;0.9;0.55" dur="2.5s" repeatCount="indefinite" />
      </circle>
      {/* spinning outer ring */}
      <circle cx={c} cy={c} r={r * 1.4} fill="none" stroke={secondary}
        strokeWidth={size * 0.035} strokeDasharray="6 4" opacity={0.8}>
        <animateTransform attributeName="transform" type="rotate"
          from={`0 ${c} ${c}`} to={`360 ${c} ${c}`} dur="6s" repeatCount="indefinite" />
      </circle>
      {/* counter-spin ring */}
      <circle cx={c} cy={c} r={r * 1.18} fill="none" stroke={glow}
        strokeWidth={size * 0.025} strokeDasharray="3 5" opacity={0.7}>
        <animateTransform attributeName="transform" type="rotate"
          from={`360 ${c} ${c}`} to={`0 ${c} ${c}`} dur="4s" repeatCount="indefinite" />
      </circle>
      <path d={hexPath(c, c, r)} fill={`url(#${idGrad})`} />
      {/* mandala stars */}
      {Array.from({ length: 3 }, (_, i) => (
        <path key={i}
          d={starPath(c, c, r * (0.55 - i * 0.1), r * (0.25 - i * 0.04), 6 + i * 2)}
          fill={secondary} opacity={0.7 + i * 0.1} />
      ))}
      {level !== undefined && <LevelText level={level} size={size} />}
    </svg>
  );
}

/** Tiers 91-100: full composition with orbiting particles */
function LegendaryTier({ tier, size, level }: { tier: number; size: number; level?: number }) {
  const { primary, secondary, glow } = getPalette(tier);
  const c = size / 2;
  const r = size * 0.28;
  const particles = 6 + (tier - 91);
  const idGrad = uid(tier, "grad");
  const idGlow = uid(tier, "blur");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={idGrad} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
        <filter id={idGlow}>
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* deep glow base */}
      <circle cx={c} cy={c} r={r * 1.8} fill={primary} opacity={0.25} filter={`url(#${idGlow})`}>
        <animate attributeName="opacity" values="0.25;0.5;0.25" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* orbiting particles */}
      {Array.from({ length: particles }, (_, i) => {
        const angle = (360 / particles) * i;
        const dur = `${3 + i * 0.3}s`;
        return (
          <circle key={i} cx={c + r * 1.6} cy={c} r={size * 0.04} fill={secondary} opacity={0.9}>
            <animateTransform attributeName="transform" type="rotate"
              from={`${angle} ${c} ${c}`} to={`${angle + 360} ${c} ${c}`}
              dur={dur} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0.3;0.9" dur={dur} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* triple spinning rings */}
      {[1.45, 1.25, 1.08].map((scale, idx) => (
        <circle key={idx} cx={c} cy={c} r={r * scale}
          fill="none" stroke={idx === 1 ? glow : secondary}
          strokeWidth={size * (0.04 - idx * 0.008)}
          strokeDasharray={idx % 2 === 0 ? "8 3" : "4 6"}
          opacity={0.85}>
          <animateTransform attributeName="transform" type="rotate"
            from={`${idx % 2 === 0 ? 0 : 360} ${c} ${c}`}
            to={`${idx % 2 === 0 ? 360 : 0} ${c} ${c}`}
            dur={`${4 + idx * 1.5}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* core */}
      <path d={hexPath(c, c, r)} fill={`url(#${idGrad})`} filter={`url(#${idGlow})`} />

      {/* inner mandala */}
      {Array.from({ length: 4 }, (_, i) => (
        <path key={i}
          d={starPath(c, c, r * (0.62 - i * 0.11), r * (0.28 - i * 0.05), 6 + i * 2)}
          fill={i % 2 === 0 ? secondary : glow}
          opacity={0.7 + i * 0.07}>
          <animateTransform attributeName="transform" type="rotate"
            from={`${i % 2 === 0 ? 0 : 45} ${c} ${c}`}
            to={`${i % 2 === 0 ? 360 : 405} ${c} ${c}`}
            dur={`${8 + i * 2}s`} repeatCount="indefinite" />
        </path>
      ))}

      {/* center gem */}
      <circle cx={c} cy={c} r={r * 0.18} fill="white" opacity={0.9}>
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.5s" repeatCount="indefinite" />
      </circle>
      {level !== undefined && <LevelText level={level} size={size} />}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────

interface LevelArtProps {
  /** art_tier from level_config (1–100) */
  tier: number;
  /** Player level to display inside the badge (optional) */
  level?: number;
  /** Pixel size for the square SVG (default 64) */
  size?: number;
  className?: string;
}

export function LevelArt({ tier, level, size = 64, className }: LevelArtProps) {
  const t = Math.max(1, Math.min(100, tier));

  const props = { tier: t, size, level };

  let art: React.ReactNode;
  if (t <= 10) art = <SolidTier {...props} />;
  else if (t <= 20) art = <RingTier {...props} />;
  else if (t <= 30) art = <GradientTier {...props} />;
  else if (t <= 40) art = <StarTier {...props} />;
  else if (t <= 50) art = <RayTier {...props} />;
  else if (t <= 60) art = <HaloTier {...props} />;
  else if (t <= 70) art = <PulseTier {...props} />;
  else if (t <= 80) art = <SpinTier {...props} />;
  else if (t <= 90) art = <GlowTier {...props} />;
  else              art = <LegendaryTier {...props} />;

  return (
    <div
      className={className}
      style={{ width: size, height: size, display: "inline-flex", flexShrink: 0 }}
      aria-label={`Nível art tier ${t}`}
      title={`Art Tier ${t}`}
    >
      {art}
    </div>
  );
}

export default LevelArt;
