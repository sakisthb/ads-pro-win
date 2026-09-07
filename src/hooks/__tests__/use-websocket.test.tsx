import { act, renderHook, waitFor } from "@testing-library/react";

import { useWebSocket } from "../use-websocket";

const originalWebSocket = global.WebSocket;

interface MockSocket {
  readyState: number;
  send: jest.Mock;
  close: jest.Mock;
  onopen: (() => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
}

describe("useWebSocket", () => {
  let mockSocket: MockSocket;
  let mockWebSocketConstructor: jest.Mock;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSocket = {
      readyState: 0,
      send: jest.fn(),
      close: jest.fn(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };
    mockWebSocketConstructor = jest.fn(() => mockSocket);
    Object.assign(mockWebSocketConstructor, { OPEN: 1 });
    Object.defineProperty(global, "WebSocket", {
      configurable: true,
      value: mockWebSocketConstructor,
    });

    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ token: "ticket-token", expiresAt: new Date().toISOString() }),
    } as unknown as Response);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(global, "WebSocket", {
      configurable: true,
      value: originalWebSocket,
    });
  });

  it("fetches a ticket and opens a connection with the ticket in the URL", async () => {
    renderHook(() => useWebSocket({ autoConnect: true }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(fetchSpy).toHaveBeenCalledWith("/api/ws/ticket", {
      method: "POST",
      credentials: "same-origin",
    });

    act(() => {
      mockSocket.onopen?.();
    });

    expect(mockWebSocketConstructor).toHaveBeenCalledWith(
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}?ticket=ticket-token`,
    );
  });

  it("records the server-issued session ID from the welcome event", async () => {
    const { result } = renderHook(() => useWebSocket({ autoConnect: true }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    act(() => {
      mockSocket.onopen?.();
      mockSocket.onmessage?.({
        data: JSON.stringify({
          type: "ai_progress",
          data: { stage: "connected", message: "Connected" },
          timestamp: Date.now(),
          sessionId: "server-session-id",
        }),
      } as MessageEvent);
    });

    expect(result.current.connectionId).toBe("server-session-id");
  });

  it("surfaces ticket fetch failures as connection errors", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
    } as unknown as Response);

    const { result } = renderHook(() => useWebSocket({ autoConnect: true }));

    await waitFor(() => expect(result.current.error).toBe("Unauthorized"));
    expect(mockWebSocketConstructor).not.toHaveBeenCalled();
  });
});
