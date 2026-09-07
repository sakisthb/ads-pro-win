"use client";

import { cn } from "@/lib/utils";

export type PriorityLevel = "critical" | "high" | "medium" | "low";

interface PriorityBadgeProps {
  priority: PriorityLevel;
  /** Show priority text in uppercase for emphasis. */
  uppercase?: boolean;
  className?: string;
}

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  critical:
    "bg-red-500/10 text-red-400 border border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
};

/**
 * PriorityBadge renders a small pill that communicates a priority level.
 * Uses the app's dark glassmorphism color tokens.
 */
export function PriorityBadge({
  priority,
  uppercase = true,
  className,
}: PriorityBadgeProps) {
  const text = uppercase ? priority.toUpperCase() : priority;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        PRIORITY_STYLES[priority],
        className
      )}
    >
      {text}
    </span>
  );
}
