"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface XPBarProps {
  currentXP: number;
  requiredXP: number;
  level: number;
  className?: string;
}

export function XPBar({ currentXP, requiredXP, level, className }: XPBarProps) {
  const prevXPRef = useRef(currentXP);
  const [displayXP, setDisplayXP] = useState(currentXP);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (currentXP !== prevXPRef.current) {
      setAnimating(true);
      const timeout = setTimeout(() => {
        setDisplayXP(currentXP);
        prevXPRef.current = currentXP;
        setAnimating(false);
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [currentXP]);

  const pct = Math.min(100, Math.round((displayXP / requiredXP) * 100));

  return (
    <div className={cn("w-full space-y-1", className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Nível {level}</span>
        <span>
          {displayXP.toLocaleString()} / {requiredXP.toLocaleString()} XP
        </span>
      </div>

      {/* Track */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
        {/* Fill — CSS transition gives the smooth animation */}
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            "bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500",
            animating && "shadow-[0_0_10px_2px_rgba(168,85,247,0.6)]"
          )}
          style={{ width: `${pct}%` }}
        />
        {/* Shimmer overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
          }}
        />
      </div>

      <p className="text-right text-xs font-medium text-muted-foreground">
        {pct}%
      </p>
    </div>
  );
}

export default XPBar;
