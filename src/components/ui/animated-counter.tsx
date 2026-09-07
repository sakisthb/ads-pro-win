"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  /** Target number to animate towards. */
  target: number;
  /** Prefix shown before the number, e.g. "$". */
  prefix?: string;
  /** Suffix shown after the number, e.g. "%". */
  suffix?: string;
  /** Animation duration in milliseconds. */
  duration?: number;
  /** Number of decimal places to render. */
  decimals?: number;
  /** Optional className for the rendered span. */
  className?: string;
}

function toFinite(value: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Animates from the currently displayed value to `target`. Does not wait for
 * intersection — KPI cards below the fold (or faded in by Framer) would
 * otherwise freeze at 0 forever.
 */
export function AnimatedCounter({
  target,
  prefix = "",
  suffix = "",
  duration = 2000,
  decimals = 0,
  className,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const displayed = useRef(0);

  useEffect(() => {
    const from = displayed.current;
    const to = toFinite(target);
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (from === to || duration <= 0 || reduceMotion) {
      displayed.current = to;
      setCount(to);
      return;
    }

    const startTime = performance.now();
    let frame = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const next = from + (to - from) * easeOutQuart;
      displayed.current = next;
      setCount(next);
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        displayed.current = to;
        setCount(to);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  const formattedCount = count.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={cn(className)}>
      {prefix}
      {formattedCount}
      {suffix}
    </span>
  );
}
