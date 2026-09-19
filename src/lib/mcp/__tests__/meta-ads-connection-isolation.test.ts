/** @jest-environment node */

jest.mock("@/lib/config", () => ({
  config: { mcp: { metaUrl: undefined, tiktokUrl: undefined, googleUrl: undefined } },
}));

jest.mock("@modelcontextprotocol/sdk/client", () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    callTool: jest.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"data":[]}' }],
    }),
    listTools: jest.fn().mockResolvedValue({ tools: [] }),
    ping: jest.fn().mockResolvedValue(undefined),
    getServerVersion: jest.fn().mockReturnValue({ name: "fixture", version: "1.0.0" }),
  })),
}));

jest.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: jest.fn().mockImplementation(() => ({
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: jest.fn().mockImplementation(() => ({
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpClientManager } from "@/lib/mcp/client-manager";
import { MetaAdsAdapter } from "@/lib/mcp/adapters/meta-ads";

const sseMock = SSEClientTransport as unknown as jest.Mock;
const streamableMock = StreamableHTTPClientTransport as unknown as jest.Mock;

function transportHeaders(callIndex: number): Record<string, string> {
  return (streamableMock.mock.calls[callIndex][1] as {
    requestInit: { headers: Record<string, string> };
  }).requestInit.headers;
}

describe("MetaAdsAdapter connection isolation in the MCP pool", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await McpClientManager.disconnectAll();
  });

  it("keeps two accounts' connections independent — separate credentials, no cross-disconnect", async () => {
    const b2c = new MetaAdsAdapter();
    const b2b = new MetaAdsAdapter();

    await b2c.connect({ accountId: "377992403045602", accessToken: "token-b2c" });
    await b2b.connect({ accountId: "111111111111111", accessToken: "token-b2b" });

    expect(streamableMock).toHaveBeenCalledTimes(2);
    expect(sseMock).not.toHaveBeenCalled();
    expect(transportHeaders(0).Authorization).toBe("Bearer token-b2c");
    expect(transportHeaders(1).Authorization).toBe("Bearer token-b2b");
    expect(transportHeaders(0).Authorization).not.toBe(transportHeaders(1).Authorization);

    // Disconnecting B2C must not disturb B2B's pooled connection.
    await b2c.disconnect();
    streamableMock.mockClear();

    expect(await b2b.getCampaigns()).toEqual([]);
    expect(streamableMock).not.toHaveBeenCalled();

    // The disconnected adapter reconnects lazily under its own identity and credentials.
    await b2c.getCampaigns();
    expect(streamableMock).toHaveBeenCalledTimes(1);
    expect(transportHeaders(0).Authorization).toBe("Bearer token-b2c");
  });

  it("keeps same-account concurrent job connections independent (daily + hourly at 04:00)", async () => {
    const daily = new MetaAdsAdapter();
    const hourly = new MetaAdsAdapter();

    await daily.connect({ accountId: "377992403045602", accessToken: "fixture-token" });
    await hourly.connect({ accountId: "377992403045602", accessToken: "fixture-token" });

    expect(streamableMock).toHaveBeenCalledTimes(2);

    await daily.disconnect();
    streamableMock.mockClear();

    expect(await hourly.getCampaigns()).toEqual([]);
    expect(streamableMock).not.toHaveBeenCalled();
  });
});
