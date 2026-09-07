/**
 * Singleton MCP client manager.
 *
 * Wraps the official `@modelcontextprotocol/sdk` `Client` and connects to
 * remote MCP servers over SSE (`SSEClientTransport`). Connections are
 * lazily initialized on first use, cached per `serverId`, and automatically
 * disconnected after a configurable idle timeout (default 10 minutes).
 */

import { Client } from '@modelcontextprotocol/sdk/client'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

/** Milliseconds of inactivity after which an idle connection is reaped. */
const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

/** Name/version advertised to MCP servers during the initialize handshake. */
const CLIENT_INFO = { name: 'ads-pro-mcp-client', version: '1.0.0' } as const

/** A single content item returned from an MCP tool call. */
export interface McpToolContent {
  type: 'text' | 'image' | 'audio' | 'resource'
  text?: string
  data?: string
  mimeType?: string
}

/** Normalized result of an MCP tool call. */
export interface McpToolResult {
  content: McpToolContent[]
  isError?: boolean
}

/** Normalized tool metadata returned by `listTools`. */
export interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

/**
 * Extract the concatenated text payload from an MCP tool result. Returns an
 * empty string when no textual content is present, so callers can treat the
 * result uniformly regardless of whether the server returned text, images,
 * or resources.
 */
export function extractToolText(result: McpToolResult): string {
  if (!result?.content) {
    return ''
  }
  return result.content
    .filter((item): item is McpToolContent & { text: string } => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n')
}

/**
 * Parse the text payload of an MCP tool result as JSON. Returns `null` when
 * the payload is empty or not valid JSON, so adapters can fall back to a
 * sensible default instead of throwing.
 */
export function parseToolJson<T = unknown>(result: McpToolResult): T | null {
  const text = extractToolText(result)
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/** Internal record tracking a live connection and its idle timer. */
interface ManagedConnection {
  client: Client
  transport: SSEClientTransport
  url: string
  /** `setTimeout` handle used to reap the connection when idle. */
  idleTimer: ReturnType<typeof setTimeout>
  /** Last connection/usage timestamp (ms epoch). */
  lastUsedAt: number
}

/**
 * Connection options accepted by {@link McpClientManager.getClient}.
 */
export interface GetClientOptions {
  /** Optional request headers attached to the SSE handshake (e.g. auth). */
  headers?: Record<string, string>
}

/**
 * Process-wide singleton that owns every MCP connection. Use this instead of
 * instantiating `Client` directly so connections are shared, de-duplicated,
 * and reaped when idle.
 */
class McpClientManagerImpl {
  private readonly connections = new Map<string, ManagedConnection>()
  private readonly idleTimeoutMs: number

  constructor(idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS) {
    this.idleTimeoutMs = idleTimeoutMs
  }

  /**
   * Return a connected {@link Client} for `serverId`, creating one lazily
   * if none exists (or if a previously-created one has been reaped).
   */
  async getClient(
    serverId: string,
    url: string,
    options: GetClientOptions = {},
  ): Promise<Client> {
    const existing = this.connections.get(serverId)
    if (existing) {
      this.touch(serverId)
      return existing.client
    }

    console.log(`[MCP] initializing connection to "${serverId}" at ${url}`)

    const parsedUrl = new URL(url)
    const transport = new SSEClientTransport(parsedUrl, {
      requestInit: {
        headers: options.headers ?? {},
      },
    })

    const client = new Client(CLIENT_INFO, {
      capabilities: {},
    })

    try {
      await client.connect(transport)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        `[MCP] failed to connect to "${serverId}" at ${url}: ${message}`,
      )
      // Best-effort transport cleanup before propagating.
      await this.safeClose(transport)
      throw new Error(
        `MCP connection to "${serverId}" failed: ${message}`,
      )
    }

    const serverVersion = client.getServerVersion()
    console.log(
      `[MCP] connected to "${serverId}" (server: ${serverVersion?.name ?? 'unknown'} ${serverVersion?.version ?? ''})`.trim(),
    )

    const idleTimer = setTimeout(() => {
      void this.disconnect(serverId).catch((err) => {
        console.error(`[MCP] idle disconnect failed for "${serverId}":`, err)
      })
    }, this.idleTimeoutMs)

    this.connections.set(serverId, {
      client,
      transport,
      url,
      idleTimer,
      lastUsedAt: Date.now(),
    })

    return client
  }

  /**
   * Invoke a tool on the given server. Lazily connects if needed and resets
   * the idle timer after the call resolves.
   */
  async callTool(
    serverId: string,
    url: string,
    toolName: string,
    args: Record<string, unknown> = {},
    options: GetClientOptions = {},
  ): Promise<McpToolResult> {
    const client = await this.getClient(serverId, url, options)
    try {
      const result = await client.callTool({ name: toolName, arguments: args })
      this.touch(serverId)
      return result as unknown as McpToolResult
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        `[MCP] tool "${toolName}" failed on "${serverId}": ${message}`,
      )
      throw new Error(
        `MCP tool "${toolName}" failed on "${serverId}": ${message}`,
      )
    }
  }

  /**
   * List the tools exposed by a server. Lazily connects if needed.
   */
  async listTools(
    serverId: string,
    url: string,
    options: GetClientOptions = {},
  ): Promise<{ tools: McpToolInfo[]; nextCursor?: string }> {
    const client = await this.getClient(serverId, url, options)
    try {
      const result = await client.listTools()
      this.touch(serverId)
      const tools: McpToolInfo[] = result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
      }))
      return { tools, nextCursor: result.nextCursor }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        `[MCP] listTools failed on "${serverId}": ${message}`,
      )
      throw new Error(`MCP listTools failed on "${serverId}": ${message}`)
    }
  }

  /**
   * Lightweight liveness check — issues an MCP `ping` to the server.
   */
  async healthCheck(serverId: string, url: string): Promise<boolean> {
    try {
      const client = await this.getClient(serverId, url)
      await client.ping()
      this.touch(serverId)
      return true
    } catch (error) {
      console.error(
        `[MCP] health check failed for "${serverId}":`,
        error instanceof Error ? error.message : error,
      )
      return false
    }
  }

  /** Tear down a single server connection, cancelling its idle timer. */
  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId)
    if (!conn) {
      return
    }
    clearTimeout(conn.idleTimer)
    console.log(`[MCP] disconnecting "${serverId}" (idle reaper)`)
    await this.safeClose(conn.transport)
    this.connections.delete(serverId)
  }

  /** Tear down every active connection. Safe to call on shutdown. */
  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.connections.keys())
    await Promise.allSettled(ids.map((id) => this.disconnect(id)))
    console.log(`[MCP] disconnected ${ids.length} connection(s)`)
  }

  /** Whether a connection is currently cached for `serverId`. */
  has(serverId: string): boolean {
    return this.connections.has(serverId)
  }

  /** Reset the idle timer and update `lastUsedAt` for an active connection. */
  private touch(serverId: string): void {
    const conn = this.connections.get(serverId)
    if (!conn) {
      return
    }
    clearTimeout(conn.idleTimer)
    conn.lastUsedAt = Date.now()
    conn.idleTimer = setTimeout(() => {
      void this.disconnect(serverId).catch((err) => {
        console.error(`[MCP] idle disconnect failed for "${serverId}":`, err)
      })
    }, this.idleTimeoutMs)
  }

  /** Close a transport without throwing on already-closed connections. */
  private async safeClose(transport: SSEClientTransport): Promise<void> {
    try {
      await transport.close()
    } catch {
      // Swallow: connection may already be closed.
    }
  }
}

/**
 * Process-wide singleton. Re-exported as `McpClientManager` from the package
 * barrel so callers share a single connection pool.
 */
export const McpClientManager = new McpClientManagerImpl()

export { McpClientManagerImpl as McpClientManagerClass }
