import {
  createInvitationTokenDigest,
  generateInvitationToken,
  normalizeEmail,
} from "@/lib/invitation-tokens";

describe("invitation tokens", () => {
  it("normalizes email addresses", () => {
    expect(normalizeEmail("  Hello.World@Example.COM  ")).toBe(
      "hello.world@example.com",
    );
    expect(normalizeEmail("user+tag@domain.io")).toBe("user+tag@domain.io");
  });

  it("produces deterministic, distinct digests for the same raw token", () => {
    const raw = "a".repeat(64);
    const digest1 = createInvitationTokenDigest(raw);
    const digest2 = createInvitationTokenDigest(raw);
    expect(digest1).toBe(digest2);
    expect(digest1).not.toBe(raw);
    expect(digest1).toHaveLength(64);
  });

  it("generates unique raw tokens and matching digests", () => {
    const t1 = generateInvitationToken();
    const t2 = generateInvitationToken();
    expect(t1.raw).not.toBe(t2.raw);
    expect(t1.digest).not.toBe(t2.digest);
    expect(createInvitationTokenDigest(t1.raw)).toBe(t1.digest);
    expect(createInvitationTokenDigest(t2.raw)).toBe(t2.digest);
  });
});
