"use client";

// tRPC Provider for React Query Integration
// Wraps app with tRPC and React Query providers

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";

import { api } from "@/lib/trpc/react";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 5 * 1000,
        // Disable retries globally — when the DB is unreachable, retrying
        // just multiplies console errors (80+ from ~20 unique queries).
        // When the DB IS connected, first-request success makes this moot.
        retry: false,
        // Don't refetch on tab switch — avoids error bursts on every focus.
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  return (clientQueryClientSingleton ??= createQueryClient());
};

function getBaseUrl() {
  if (typeof window !== "undefined") {
    // In the browser, we return a relative URL
    return "";
  }
  // When rendering on the server, we return an absolute URL

  // reference for vercel.com
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // assume localhost
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) => {
            // Only log in development, and suppress error-direction logs
            // to avoid console noise when the DB is unreachable.
            if (process.env.NODE_ENV !== "development") return false;
            if (op.direction === "down" && op.result instanceof Error) return false;
            return true;
          },
        }),
        unstable_httpBatchStreamLink({
          transformer: superjson,
          url: getBaseUrl() + "/api/trpc",
          // Explicitly send cookies (e.g. the x-active-org cookie consumed by
          // organizationProcedure). Same-origin defaults already do this, but
          // setting `credentials` ensures it across environments.
          fetch: (url, options) =>
            fetch(url, { ...options, credentials: "include" }),
          headers() {
            const headers = new Map<string, string>();
            headers.set("x-trpc-source", "nextjs-react");
            return Object.fromEntries(headers);
          },
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
        <ReactQueryDevtools initialIsOpen={false} />
      </api.Provider>
    </QueryClientProvider>
  );
}

export { api };