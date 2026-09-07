import { createHash, randomBytes } from "node:crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createInvitationTokenDigest(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateInvitationToken(): { raw: string; digest: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, digest: createInvitationTokenDigest(raw) };
}
