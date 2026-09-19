/** @jest-environment node */

jest.mock("@/lib/config", () => ({
  config: { mcp: { metaUrl: undefined, tiktokUrl: undefined, googleUrl: undefined } },
}));

jest.mock("@/lib/mcp/client-manager", () => ({
  McpClientManager: {
    getClient: jest.fn().mockResolvedValue({}),
    callTool: jest.fn(),
    listTools: jest.fn(),
    has: jest.fn(() => true),
    disconnect: jest.fn().mockResolvedValue(undefined),
  },
  parseToolJson: jest.fn(() => null),
}));

import { McpClientManager } from "@/lib/mcp/client-manager";
import { MetaAdsAdapter } from "@/lib/mcp/adapters/meta-ads";

const getClientMock = McpClientManager.getClient as unknown as jest.Mock;
const callToolMock = McpClientManager.callTool as unknown as jest.Mock;
const disconnectMock = McpClientManager.disconnect as unknown as jest.Mock;

const emptyPayload = { content: [{ type: "text" as const, text: '{"data":[]}' }] };

describe("MetaAdsAdapter connection options", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    callToolMock.mockResolvedValue(emptyPayload);
  });

  it("requests the Streamable HTTP transport for Meta's hosted MCP endpoint", async () => {
    const adapter = new MetaAdsAdapter();
    await adapter.connect({ accountId: "377992403045602", accessToken: "fixture-token" });

    expect(getClientMock).toHaveBeenCalledWith(
      expect.stringMatching(/^meta-ads:377992403045602:\d+$/),
      "https://mcp.facebook.com/ads",
      expect.objectContaining({ transport: "streamable-http" }),
    );
  });

  it("carries Streamable HTTP options into the list_campaigns callTool (lazy reconnect path)", async () => {
    const adapter = new MetaAdsAdapter();
    await adapter.connect({ accountId: "377992403045602", accessToken: "fixture-token" });

    await adapter.getCampaigns();

    expect(callToolMock).toHaveBeenCalledTimes(1);
    expect(callToolMock).toHaveBeenCalledWith(
      expect.stringMatching(/^meta-ads:377992403045602:\d+$/),
      "https://mcp.facebook.com/ads",
      "list_campaigns",
      expect.objectContaining({ account_id: "377992403045602" }),
      expect.objectContaining({
        transport: "streamable-http",
        headers: expect.objectContaining({
          Authorization: "Bearer fixture-token",
          "X-Ad-Account": "377992403045602",
        }),
      }),
    );
  });

  it("carries Streamable HTTP options into the get_insights callTool (lazy reconnect path)", async () => {
    const adapter = new MetaAdsAdapter();
    await adapter.connect({ accountId: "377992403045602", accessToken: "fixture-token" });

    await adapter.getPerformance({ startDate: "2026-09-01", endDate: "2026-09-02" });

    expect(callToolMock).toHaveBeenCalledWith(
      expect.stringMatching(/^meta-ads:377992403045602:\d+$/),
      "https://mcp.facebook.com/ads",
      "get_insights",
      expect.objectContaining({ account_id: "377992403045602" }),
      expect.objectContaining({
        transport: "streamable-http",
        headers: expect.objectContaining({
          Authorization: "Bearer fixture-token",
          "X-Ad-Account": "377992403045602",
        }),
      }),
    );
  });

  it("gives concurrent adapters independent connection identities", async () => {
    const daily = new MetaAdsAdapter();
    const hourly = new MetaAdsAdapter();
    await daily.connect({ accountId: "377992403045602", accessToken: "fixture-token" });
    await hourly.connect({ accountId: "377992403045602", accessToken: "fixture-token" });

    const dailyId = getClientMock.mock.calls[0][0] as string;
    const hourlyId = getClientMock.mock.calls[1][0] as string;
    expect(dailyId).not.toBe(hourlyId);

    await daily.disconnect();

    expect(disconnectMock).toHaveBeenCalledTimes(1);
    expect(disconnectMock).toHaveBeenCalledWith(dailyId);
    expect(disconnectMock).not.toHaveBeenCalledWith(hourlyId);
    expect(daily.isConnected()).toBe(false);
    expect(hourly.isConnected()).toBe(true);
  });

  it("never shares a connection identity between two different Meta accounts", async () => {
    const first = new MetaAdsAdapter();
    const second = new MetaAdsAdapter();
    await first.connect({ accountId: "377992403045602", accessToken: "token-b2c" });
    await second.connect({ accountId: "111111111111111", accessToken: "token-b2b" });

    const firstId = getClientMock.mock.calls[0][0] as string;
    const secondId = getClientMock.mock.calls[1][0] as string;

    expect(firstId).not.toBe(secondId);
    expect(firstId).toContain("377992403045602");
    expect(secondId).toContain("111111111111111");

    const firstHeaders = (getClientMock.mock.calls[0][2] as { headers: Record<string, string> }).headers;
    const secondHeaders = (getClientMock.mock.calls[1][2] as { headers: Record<string, string> }).headers;
    expect(firstHeaders.Authorization).toBe("Bearer token-b2c");
    expect(secondHeaders.Authorization).toBe("Bearer token-b2b");
  });
});
