/** @jest-environment node */
import {
  explainWooHttpFailure,
  looksLikeCloudflareChallenge,
  normalizeWooStoreUrl,
  wooRestGet,
} from "@/lib/woocommerce-rest";
import { safeFetch } from "@/lib/safe-fetch";

jest.mock("@/lib/safe-fetch", () => ({
  safeFetch: jest.fn(),
  SafeFetchError: class extends Error {
    readonly code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = "SafeFetchError";
    }
  },
}));

const mockedSafeFetch = jest.mocked(safeFetch);

const CF_HTML = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title>
<meta http-equiv="content-security-policy" content="script-src https://challenges.cloudflare.com">
</head><body>Enable JavaScript and cookies to continue</body></html>`;

describe("woocommerce REST helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("strips trailing slashes from the store URL", () => {
    expect(normalizeWooStoreUrl("https://bagtobag.com.gr/")).toBe("https://bagtobag.com.gr");
  });

  it("detects Cloudflare JS challenges", () => {
    expect(
      looksLikeCloudflareChallenge({
        status: 403,
        body: CF_HTML,
        cfMitigated: "challenge",
      }),
    ).toBe(true);
    expect(
      looksLikeCloudflareChallenge({
        status: 200,
        body: JSON.stringify([{ id: 1 }]),
      }),
    ).toBe(false);
  });

  it("explains Cloudflare blocks as WAF, not bad keys", () => {
    const message = explainWooHttpFailure({
      storeUrl: "https://bagtobag.com.gr",
      status: 403,
      body: CF_HTML,
      cfMitigated: "challenge",
    });
    expect(message).toMatch(/Cloudflare/);
    expect(message).toMatch(/bagtobag\.com\.gr/);
    expect(message).toMatch(/\/wp-json\/wc\//);
    expect(message).not.toMatch(/consumer key is required/i);
  });

  it("surfaces WooCommerce REST JSON errors", () => {
    const message = explainWooHttpFailure({
      storeUrl: "https://bagtobag.com.gr",
      status: 401,
      body: JSON.stringify({
        code: "woocommerce_rest_cannot_view",
        message: "Sorry, you cannot list resources.",
        data: { status: 401 },
      }),
    });
    expect(message).toMatch(/Sorry, you cannot list resources/i);
  });

  it("uses HTTP Basic Auth without putting credentials in the URL", async () => {
    mockedSafeFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await wooRestGet({
      storeUrl: "https://bagtobag.com.gr/",
      path: "orders",
      consumerKey: "ck_test",
      consumerSecret: "cs_test",
      searchParams: { per_page: "1" },
    });

    expect(result.ok).toBe(true);
    expect(mockedSafeFetch).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = mockedSafeFetch.mock.calls[0];
    expect(String(requestUrl)).toBe("https://bagtobag.com.gr/wp-json/wc/v3/orders?per_page=1");
    expect(String(requestUrl)).not.toContain("consumer_key");
    expect(String(requestUrl)).not.toContain("consumer_secret");
    expect((requestInit?.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
  });

  it("does not retry rejected Basic Auth with query-string credentials", async () => {
    mockedSafeFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "woocommerce_rest_cannot_view",
          message: "Sorry, you cannot list resources.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await wooRestGet({
      storeUrl: "https://bagtobag.com.gr",
      path: "orders",
      consumerKey: "ck_test",
      consumerSecret: "cs_test",
    });

    expect(result.ok).toBe(false);
    expect(mockedSafeFetch).toHaveBeenCalledTimes(1);
  });
});
