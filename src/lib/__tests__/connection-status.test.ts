import { adAccountIsConnected, adAccountTokenExpired, isOAuthAdPlatform } from "@/lib/connection-status";

describe("connection status", () => {
  it("treats Woo / email keys as connected whenever a token is stored", () => {
    expect(isOAuthAdPlatform("woocommerce")).toBe(false);
    expect(adAccountIsConnected({ platform: "woocommerce", accessToken: "ck", tokenExpiry: null })).toBe(true);
    expect(adAccountIsConnected({ platform: "woocommerce", accessToken: null, tokenExpiry: null })).toBe(false);
  });

  it("treats Meta with a future or missing expiry as connected", () => {
    expect(
      adAccountIsConnected({
        platform: "meta",
        accessToken: "tok",
        tokenExpiry: new Date(Date.now() + 86_400_000),
      }),
    ).toBe(true);
    expect(adAccountIsConnected({ platform: "meta", accessToken: "tok", tokenExpiry: null })).toBe(true);
  });

  it("keeps Google OAuth connected when a refresh token can mint a new access token", () => {
    const staleAccess = {
      platform: "google" as const,
      accessToken: "tok",
      refreshToken: "refresh",
      tokenExpiry: new Date(Date.now() - 1000),
    };
    expect(adAccountIsConnected(staleAccess)).toBe(true);
    expect(adAccountTokenExpired(staleAccess)).toBe(false);
  });

  it("flags expired Meta tokens so the UI can offer Reconnect", () => {
    const expired = {
      platform: "meta" as const,
      accessToken: "tok",
      tokenExpiry: new Date(Date.now() - 1000),
    };
    expect(adAccountIsConnected(expired)).toBe(false);
    expect(adAccountTokenExpired(expired)).toBe(true);
  });

  it("treats Google Analytics and Search Console like other OAuth platforms", () => {
    expect(isOAuthAdPlatform("google-analytics")).toBe(true);
    expect(isOAuthAdPlatform("google-search-console")).toBe(true);
    expect(
      adAccountIsConnected({
        platform: "google-analytics",
        accessToken: "tok",
        tokenExpiry: new Date(Date.now() + 3_600_000),
      }),
    ).toBe(true);
    expect(
      adAccountIsConnected({
        platform: "google-search-console",
        accessToken: "tok",
        tokenExpiry: new Date(Date.now() + 3_600_000),
      }),
    ).toBe(true);
    expect(
      adAccountIsConnected({
        platform: "google-search-console",
        accessToken: "tok",
        refreshToken: "refresh",
        tokenExpiry: new Date(Date.now() - 1000),
      }),
    ).toBe(true);
    expect(
      adAccountIsConnected({
        platform: "google-search-console",
        accessToken: "tok",
        tokenExpiry: new Date(Date.now() - 1000),
      }),
    ).toBe(false);
  });
});
