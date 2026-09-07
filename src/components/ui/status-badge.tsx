"use client";

import { cn } from "@/lib/utils";

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "pending"
  | "syncing";

interface StatusBadgeProps {
  status: ConnectionStatus;
  /** Optional label override; defaults to the capitalized status. */
  label?: string;
  className?: string;
}

const STATUS_STYLES: Record<
  ConnectionStatus,
  { pill: string; dot: string; pulse: boolean; defaultLabel: string }
> = {
  connected: {
    pill: "bg-green-500/10 text-green-400 border border-green-500/20",
    dot: "bg-green-400",
    pulse: false,
    defaultLabel: "Connected",
  },
  disconnected: {
    pill: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
    dot: "bg-gray-400",
    pulse: false,
    defaultLabel: "Disconnected",
  },
  error: {
    pill: "bg-red-500/10 text-red-400 border border-red-500/20",
    dot: "bg-red-400",
    pulse: false,
    defaultLabel: "Error",
  },
  pending: {
    pill: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
    dot: "bg-yellow-400",
    pulse: false,
    defaultLabel: "Pending",
  },
  syncing: {
    pill: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    dot: "bg-blue-400",
    pulse: true,
    defaultLabel: "Syncing",
  },
};

/**
 * StatusBadge renders a colored pill with a leading dot indicator. The
 * "syncing" status adds a pulsing animation to the dot. Designed for the
 * app's dark glassmorphism theme.
 */
export function StatusBadge({
  status,
  label,
  className,
}: StatusBadgeProps) {
  const { pill, dot, pulse, defaultLabel } = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        pill,
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              dot
            )}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dot)} />
      </span>
      {label ?? defaultLabel}
    </span>
  );
}
