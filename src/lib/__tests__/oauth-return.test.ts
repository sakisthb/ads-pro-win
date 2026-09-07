import {
  oauthReturnPath,
  parseOAuthState,
  encodeOAuthState,
  missingPlatformConfig,
  platformNotConfiguredMessage,
  OAUTH_PLATFORMS,
  oauthAuthorizationCode,
  oauthReadiness,
  getOrigin,
  googleOAuthOrigin,
  normalizePublicOrigin,
  toGoogleOAuthOrigin,
} from "@/lib/oauth/platforms";
import { META_GRAPH_VERSION } from "@/lib/meta/actions";

describe("oauth return path", () => {
  it("only allows known in-app destinations", () => {
    expect(oauthReturnPath(null)).toBe("/connections");
    expect(oauthReturnPath("/onboarding")).toBe("/onboarding");
    expect(oauthReturnPath("/campaign-launcher")).toBe("/campaign-launcher");
    expect(oauthReturnPath("https://evil.example")).toBe("/connections");
    expect(oauthReturnPath("/settings")).toBe("/connections");
  });

  it("parses platform:path state from the OAuth round trip", () => {
    expect(parseOAuthState("meta")).toEqual({
      platformHint: "meta",
      returnPath: "/connections",
    });
    expect(parseOAuthState("meta:/onboarding")).toEqual({
      platformHint: "meta",
      returnPath: "/onboarding",
    });
  });

  it("encodes and parses shop-scoped OAuth state", () => {
    const brandId = "clbagtobagshop01";
    expect(encodeOAuthState("meta", "/onboarding", brandId)).toBe(
      `meta~/onboarding~${brandId}`,
    );
    expect(parseOAuthState(`meta~/onboarding~${brandId}`)).toEqual({
      platformHint: "meta",
      returnPath: "/onboarding",
      brandId,
    });
    expect(parseOAuthState("meta~/connections")).toEqual({
      platformHint: "meta",
      returnPath: "/connections",
    });
  });

  it("re-requests declined Meta scopes on Connect and Reconnect", () => {
    expect(OAUTH_PLATFORMS.meta.extraParams?.auth_type).toBe("rerequest");
    expect(OAUTH_PLATFORMS.meta.scope).toMatch(/ads_management/);
    expect(OAUTH_PLATFORMS.meta.authBaseUrl).toContain(META_GRAPH_VERSION);
    expect(META_GRAPH_VERSION).toMatch(/^v2[5-9]\.0$/);
  });

  it("accepts TikTok auth_code as well as code", () => {
    expect(oauthAuthorizationCode(new URLSearchParams("auth_code=tt-1"))).toBe("tt-1");
    expect(oauthAuthorizationCode(new URLSearchParams("code=google-1"))).toBe("google-1");
    expect(oauthAuthorizationCode(new URLSearchParams())).toBeNull();
    expect(OAUTH_PLATFORMS.tiktok.clientIdParam).toBe("app_id");
    expect(OAUTH_PLATFORMS.tiktok.includeResponseType).toBe(false);
  });

  it("requests Analytics readonly for GA4 connect", () => {
    expect(OAUTH_PLATFORMS["google-analytics"].scope).toBe(
      "https://www.googleapis.com/auth/analytics.readonly",
    );
    expect(OAUTH_PLATFORMS["google-analytics"].callbackPath).toBe(
      "/api/auth/google-analytics/callback",
    );
  });

  it("requests Search Console readonly for GSC connect", () => {
    expect(OAUTH_PLATFORMS["google-search-console"].scope).toBe(
      "https://www.googleapis.com/auth/webmasters.readonly",
    );
    expect(OAUTH_PLATFORMS["google-search-console"].callbackPath).toBe(
      "/api/auth/google-search-console/callback",
    );
  });
});

describe("Google Ads env contract", () => {
  const keys = [
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ANALYTICS_CLIENT_ID",
    "GOOGLE_ANALYTICS_CLIENT_SECRET",
    "GOOGLE_SEARCH_CONSOLE_CLIENT_ID",
    "GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET",
    "TIKTOK_APP_ID",
    "TIKTOK_APP_SECRET",
  ] as const;
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      snapshot[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (snapshot[key] == null) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  });

  it("requires OAuth client plus developer token", () => {
    process.env.GOOGLE_ADS_CLIENT_ID = "id";
    expect(missingPlatformConfig("google-ads")).toEqual([
      "GOOGLE_ADS_CLIENT_SECRET",
      "GOOGLE_ADS_DEVELOPER_TOKEN",
    ]);
    expect(platformNotConfiguredMessage("google-ads")).toMatch(/GOOGLE_ADS_CLIENT_SECRET/);
    process.env.GOOGLE_ADS_CLIENT_SECRET = "secret";
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev";
    expect(missingPlatformConfig("google-ads")).toEqual([]);
  });

  it("reuses the Analytics client for Search Console and Ads OAuth", () => {
    process.env.GOOGLE_ANALYTICS_CLIENT_ID = "ga-id";
    process.env.GOOGLE_ANALYTICS_CLIENT_SECRET = "ga-secret";
    expect(missingPlatformConfig("google-search-console")).toEqual([]);
    expect(missingPlatformConfig("google-ads")).toEqual(["GOOGLE_ADS_DEVELOPER_TOKEN"]);
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev";
    expect(missingPlatformConfig("google-ads")).toEqual([]);
  });

  it("reports TikTok as unconfigured when app credentials are empty", () => {
    delete process.env.TIKTOK_APP_ID;
    delete process.env.TIKTOK_APP_SECRET;
    expect(oauthReadiness().tiktok).toBe(false);
    expect(missingPlatformConfig("tiktok")).toEqual(["TIKTOK_APP_ID", "TIKTOK_APP_SECRET"]);
  });
});

describe("Google OAuth origin", () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (siteUrl == null) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
  });

  it("rewrites the 0.0.0.0 listen address to localhost", () => {
    expect(normalizePublicOrigin("http://0.0.0.0:3000")).toBe("http://localhost:3000");
    expect(toGoogleOAuthOrigin("http://0.0.0.0:3000")).toBe("http://localhost:3000");
  });

  it("uses Host localhost even when Request.url is 0.0.0.0", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const req = new Request("http://0.0.0.0:3000/api/auth/google-ads", {
      headers: { host: "localhost:3000" },
    });
    expect(getOrigin(req)).toBe("http://localhost:3000");
    expect(googleOAuthOrigin(req)).toBe("http://localhost:3000");
  });

  it("rewrites LAN HTTP to localhost for Google only", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const req = new Request("http://192.168.1.82:3000/api/auth/google-ads", {
      headers: { host: "192.168.1.82:3000" },
    });
    expect(getOrigin(req)).toBe("http://192.168.1.82:3000");
    expect(googleOAuthOrigin(req)).toBe("http://localhost:3000");
  });

  it("keeps https origins and loopback HTTP", () => {
    expect(toGoogleOAuthOrigin("https://ads.example.com")).toBe("https://ads.example.com");
    expect(toGoogleOAuthOrigin("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(toGoogleOAuthOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });
});
