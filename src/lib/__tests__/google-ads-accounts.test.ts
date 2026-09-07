/**
 * @jest-environment node
 */

import {
  formatGoogleAdsApiError,
  googleAdsPendingAccountId,
  googleAdsSearchStreamUrl,
  googleAdsStoredAccountId,
  isGoogleAdsAccountReady,
  listGoogleAdsCustomers,
  parseGoogleAdsCustomerId,
  parseGoogleAdsStoredAccount,
  preferGoogleAdsCustomer,
} from "@/lib/google-ads-accounts";

describe("Google Ads API errors", () => {
  it("tells operators to apply for Basic Access when the token is test-only", () => {
    const body = JSON.stringify([{
      error: {
        code: 403,
        message: "The caller does not have permission",
        details: [{ errors: [{ errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" }, message: "The developer token is only approved for use with test accounts." }] }],
      },
    }]);
    expect(formatGoogleAdsApiError(403, body)).toMatch(/Basic Access/i);
  });
});

describe("Google Ads account ids", () => {
  it("treats pending and empty placeholders as not ready", () => {
    expect(parseGoogleAdsCustomerId("")).toBeNull();
    expect(parseGoogleAdsCustomerId(googleAdsPendingAccountId("brand_1"))).toBeNull();
    expect(isGoogleAdsAccountReady("gads:pending:brand_1")).toBe(false);
  });

  it("parses stored, dashed, and resource names", () => {
    expect(parseGoogleAdsCustomerId(googleAdsStoredAccountId("brand_1", "123-456-7890"))).toBe(
      "1234567890",
    );
    expect(parseGoogleAdsStoredAccount(googleAdsStoredAccountId("brand_1", "111", "999"))).toEqual({
      customerId: "111",
      loginCustomerId: "999",
    });
    expect(parseGoogleAdsCustomerId("customers/1234567890")).toBe("1234567890");
    expect(isGoogleAdsAccountReady("1234567890")).toBe(true);
  });
});

describe("Google Ads picker", () => {
  it("prefers a named spend account over MCC", () => {
    const chosen = preferGoogleAdsCustomer(
      [
        { id: "1", descriptiveName: "Agency MCC", manager: true, currencyCode: "EUR", loginCustomerId: null, testAccount: false },
        { id: "2", descriptiveName: "BAGTOBAG GR", manager: false, currencyCode: "EUR", loginCustomerId: "1", testAccount: false },
        { id: "3", descriptiveName: "Other shop", manager: false, currencyCode: "EUR", loginCustomerId: "1", testAccount: false },
      ],
      "BAGTOBAG",
    );
    expect(chosen?.id).toBe("2");
  });

  it("points at Ads API Center when the developer token is missing", () => {
    expect(
      formatGoogleAdsApiError(403, JSON.stringify({ error: { message: "Developer token is not set" } })),
    ).toMatch(/GOOGLE_ADS_DEVELOPER_TOKEN/);
  });

  it("maps HTML 404 from the wrong REST path to an operator message", () => {
    expect(googleAdsSearchStreamUrl("7488715250")).toContain("/customers/7488715250/googleAds:searchStream");
    expect(googleAdsSearchStreamUrl("7488715250")).not.toMatch(/customers\/7488715250:searchStream/);
    expect(formatGoogleAdsApiError(404, "<!DOCTYPE html><html><body>404</body></html>")).toMatch(
      /googleAds:searchStream/,
    );
  });
});

describe("Google Ads HTTP helpers", () => {
  const original = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  afterEach(() => {
    if (original == null) delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    else process.env.GOOGLE_ADS_DEVELOPER_TOKEN = original;
  });

  it("expands an MCC into named client accounts", async () => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev-token";
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      const href = String(url);
      const body = String(init?.body ?? "");
      if (href.endsWith("customers:listAccessibleCustomers")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ resourceNames: ["customers/1234567890"] }),
        };
      }
      if (body.includes("FROM customer_client")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify([
              {
                results: [
                  {
                    customerClient: {
                      id: "2718325078",
                      descriptiveName: "BAGTOBAG",
                      manager: false,
                      currencyCode: "EUR",
                      status: "ENABLED",
                      testAccount: false,
                    },
                  },
                ],
              },
            ]),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              results: [
                {
                  customer: {
                    id: "1234567890",
                    descriptiveName: "Agency MCC",
                    manager: true,
                    currencyCode: "EUR",
                    testAccount: false,
                  },
                },
              ],
            },
          ]),
      };
    }) as unknown as typeof fetch;

    const customers = await listGoogleAdsCustomers("tok", fetchImpl);
    expect(customers.some((c) => c.id === "2718325078" && c.descriptiveName === "BAGTOBAG")).toBe(true);
    expect(customers.find((c) => c.id === "2718325078")?.loginCustomerId).toBe("1234567890");
  });

  it("retries a client searchStream with the MCC login after a 404 HTML", async () => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev-token";
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      const href = String(url);
      const body = String(init?.body ?? "");
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const login = headers["login-customer-id"];
      if (href.endsWith("customers:listAccessibleCustomers")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ resourceNames: ["customers/1234567890", "customers/7488715250"] }),
        };
      }
      if (href.includes("/customers/7488715250/googleAds:searchStream") && !login) {
        return {
          ok: false,
          status: 404,
          text: async () => "<!DOCTYPE html><html>Not Found</html>",
        };
      }
      if (body.includes("FROM customer_client")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{ results: [] }]),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              results: [
                {
                  customer: {
                    id: href.includes("7488715250") ? "7488715250" : "1234567890",
                    descriptiveName: href.includes("7488715250") ? "BAGTOBAG" : "Agency MCC",
                    manager: !href.includes("7488715250"),
                    currencyCode: "EUR",
                    testAccount: false,
                  },
                },
              ],
            },
          ]),
      };
    }) as unknown as typeof fetch;

    const customers = await listGoogleAdsCustomers("tok", fetchImpl);
    expect(customers.some((c) => c.id === "7488715250" && c.descriptiveName === "BAGTOBAG")).toBe(true);
    expect(customers.find((c) => c.id === "7488715250")?.loginCustomerId).toBe("1234567890");
  });

  it("keeps accessible customer ids when searchStream is test-only", async () => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev-token";
    const fetchImpl = jest.fn(async (url: string) => {
      const href = String(url);
      if (href.endsWith("customers:listAccessibleCustomers")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ resourceNames: ["customers/7488715250"] }),
        };
      }
      return {
        ok: false,
        status: 403,
        text: async () =>
          JSON.stringify({
            error: { message: "The developer token is only approved for use with test accounts." },
          }),
      };
    }) as unknown as typeof fetch;

    const customers = await listGoogleAdsCustomers("tok", fetchImpl);
    expect(customers).toEqual([
      expect.objectContaining({ id: "7488715250", descriptiveName: "Google Ads 7488715250" }),
    ]);
  });
});
