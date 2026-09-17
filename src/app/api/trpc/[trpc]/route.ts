// Next.js 13+ App Router tRPC Handler
// Main API endpoint for all tRPC procedures

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { env } from "@/env";
import { appRouter } from "@/lib/trpc/root";
import { createTRPCContext } from "@/lib/trpc/server";

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req: req as any, res: null as any, info: undefined as any }),
    onError:
      env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
            );
          }
        : undefined,
  });
  // This router carries session- and organization-scoped connector/operator data.
  // Explicit private headers keep these responses out of HTTP caches; production
  // readback must also verify that upstream policies respect them.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
};

export { handler as GET, handler as POST };
