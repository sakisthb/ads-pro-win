"use client";

import { useEffect, useState } from "react";

/** True only after the first client effect — safe gate for Radix / theme UI. */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
