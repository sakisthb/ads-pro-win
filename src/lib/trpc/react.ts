"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/lib/trpc/root";

/** Single React tRPC instance — Provider and every `api.*` hook must share this. */
export const api = createTRPCReact<AppRouter>();
