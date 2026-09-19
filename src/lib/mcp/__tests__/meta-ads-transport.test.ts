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

describe("MetaAdsAdapter connection options", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requests the Streamable HTTP transport for Meta's hosted MCP endpoint", async () => {
    const adapter = new MetaAdsAdapter();
    await adapter.connect({ accountId: "377992403045602", accessToken: "fixture-token" });

    expect(McpClientManager.getClient).toHaveBeenCalledWith(
      "meta-ads",
      "https://mcp.facebook.com/ads",
      expect.objectContaining({ transport: "streamable-http" }),
    );
  });
});
