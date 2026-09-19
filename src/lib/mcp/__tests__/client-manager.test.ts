/** @jest-environment node */

jest.mock("@modelcontextprotocol/sdk/client", () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    callTool: jest.fn().mockResolvedValue({ content: [] }),
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
import { McpClientManagerClass } from "@/lib/mcp/client-manager";

const sseMock = SSEClientTransport as unknown as jest.Mock;
const streamableMock = StreamableHTTPClientTransport as unknown as jest.Mock;

describe("McpClientManager transport selection", () => {
  const managers: McpClientManagerClass[] = [];

  function createManager(idleTimeoutMs = 60_000): McpClientManagerClass {
    const manager = new McpClientManagerClass(idleTimeoutMs);
    managers.push(manager);
    return manager;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // A failed assertion would otherwise leak the 60s idle timer and hang
    // Jest's worker shutdown.
    await Promise.allSettled(managers.splice(0).map((m) => m.disconnectAll()));
  });

  it("connects over SSE by default, preserving existing adapter behavior", async () => {
    const manager = createManager();
    await manager.getClient("fixture-sse", "https://mcp.example.com/sse", {
      headers: { Authorization: "Bearer fixture" },
    });

    expect(sseMock).toHaveBeenCalledTimes(1);
    expect(streamableMock).not.toHaveBeenCalled();
    expect(sseMock.mock.calls[0][0]).toEqual(new URL("https://mcp.example.com/sse"));
    expect(sseMock.mock.calls[0][1]).toEqual({
      requestInit: { headers: { Authorization: "Bearer fixture" } },
    });
    await manager.disconnectAll();
  });

  it("connects over Streamable HTTP when a connection requests it", async () => {
    const manager = createManager();
    await manager.getClient("fixture-http", "https://mcp.facebook.com/ads", {
      headers: { Authorization: "Bearer fixture" },
      transport: "streamable-http",
    });

    expect(streamableMock).toHaveBeenCalledTimes(1);
    expect(sseMock).not.toHaveBeenCalled();
    expect(streamableMock.mock.calls[0][0]).toEqual(new URL("https://mcp.facebook.com/ads"));
    expect(streamableMock.mock.calls[0][1]).toEqual({
      requestInit: { headers: { Authorization: "Bearer fixture" } },
    });
    await manager.disconnectAll();
  });
});
