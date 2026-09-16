-- Additive tables required by OAuth start/callback and WebSocket tickets.
-- Safe for DBs that were previously pushed without these models (schema drift).

CREATE TABLE IF NOT EXISTS "oauth_transactions" (
    "id" TEXT NOT NULL,
    "stateDigest" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT,
    "returnPath" TEXT NOT NULL DEFAULT '/connections',
    "pkceCodeVerifier" TEXT,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "websocket_tickets" (
    "id" TEXT NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channels" TEXT[],
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "websocket_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_transactions_stateDigest_key" ON "oauth_transactions"("stateDigest");
CREATE INDEX IF NOT EXISTS "oauth_transactions_organizationId_consumedAt_idx" ON "oauth_transactions"("organizationId", "consumedAt");
CREATE INDEX IF NOT EXISTS "oauth_transactions_expiresAt_idx" ON "oauth_transactions"("expiresAt");
CREATE INDEX IF NOT EXISTS "oauth_transactions_stateDigest_idx" ON "oauth_transactions"("stateDigest");

CREATE UNIQUE INDEX IF NOT EXISTS "websocket_tickets_tokenDigest_key" ON "websocket_tickets"("tokenDigest");
CREATE INDEX IF NOT EXISTS "websocket_tickets_organizationId_idx" ON "websocket_tickets"("organizationId");
CREATE INDEX IF NOT EXISTS "websocket_tickets_expiresAt_idx" ON "websocket_tickets"("expiresAt");
CREATE INDEX IF NOT EXISTS "websocket_tickets_consumedAt_idx" ON "websocket_tickets"("consumedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oauth_transactions_organizationId_fkey'
  ) THEN
    ALTER TABLE "oauth_transactions"
      ADD CONSTRAINT "oauth_transactions_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'websocket_tickets_organizationId_fkey'
  ) THEN
    ALTER TABLE "websocket_tickets"
      ADD CONSTRAINT "websocket_tickets_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
