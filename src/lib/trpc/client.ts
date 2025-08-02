// tRPC Client Configuration for Frontend
// React Query integration with tRPC

import { createTRPCReact } from "@trpc/react-query";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";

import { type AppRouter } from "@/lib/trpc/root";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
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