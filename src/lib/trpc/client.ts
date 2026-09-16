// tRPC Client Configuration for Frontend
// React Query integration with tRPC

import { createTRPCReact } from "@trpc/react-query";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";

import { type AppRouter } from "@/lib/trpc/root";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  return `http://localhost:${process.env.PORT ?? 3000}`; // Docker/Caddy or local SSR
};

export const api = createTRPCReact<AppRouter>();

export const trpcClientOptions = {
  links: [
    loggerLink({
      enabled: (op) =>
        process.env.NODE_ENV === "development" ||
        (op.direction === "down" && op.result instanceof Error),
    }),
    unstable_httpBatchStreamLink({
      url: `${getBaseUrl()}/api/trpc`,
      headers() {
        const headers = new Map<string, string>();
        headers.set("x-trpc-source", "nextjs-react");
        return Object.fromEntries(headers);
      },
    }),
  ],
};