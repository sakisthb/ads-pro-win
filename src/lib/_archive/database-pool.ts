// Advanced Database Connection Pooling - Phase 3 Week 8
import { PrismaClient } from '@prisma/client';

interface PoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statementTimeoutMillis: number;
  maxLifetimeMillis: number;
  healthCheckIntervalMillis: number;
}

interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalAcquires: number;
  totalReleases: number;
  totalErrors: number;
  averageAcquireTime: number;
  averageQueryTime: number;
}

interface PooledConnection {
  id: string;
  client: PrismaClient;
  createdAt: Date;
  lastUsed: Date;
  isActive: boolean;
  queryCount: number;
  errorCount: number;
}

class DatabaseConnectionPool {
  private config: PoolConfig;
  private connections: Map<string, PooledConnection> = new Map();
  private waitingQueue: Array<{
    resolve: (client: PrismaClient) => void;
    reject: (error: Error) => void;
    requestedAt: Date;
  }> = [];
  private stats: ConnectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    totalAcquires: 0,
    totalReleases: 0,
    totalErrors: 0,
    averageAcquireTime: 0,
    averageQueryTime: 0,
  };
  private healthCheckInterval?: NodeJS.Timeout;
  private acquireTimes: number[] = [];
  private queryTimes: number[] = [];

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = {
      minConnections: 2,
      maxConnections: 10,
      acquireTimeoutMillis: 30000, // 30 seconds
      idleTimeoutMillis: 300000, // 5 minutes
      connectionTimeoutMillis: 10000, // 10 seconds
      statementTimeoutMillis: 60000, // 1 minute
      maxLifetimeMillis: 3600000, // 1 hour
      healthCheckIntervalMillis: 60000, // 1 minute
      ...config,
    };

    this.initializePool();
    this.startHealthCheck();
  }

  private async initializePool(): Promise<void> {
    // Create minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        console.error(`Failed to create initial connection ${i}:`, error);
      }
    }
  }

  private async createConnection(): Promise<PooledConnection> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const client = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });

    // Configure connection timeouts
    await client.$connect();

    const connection: PooledConnection = {
      id: connectionId,
      client,
      createdAt: new Date(),
      lastUsed: new Date(),
      isActive: false,
      queryCount: 0,
      errorCount: 0,
    };

    this.connections.set(connectionId, connection);
    this.stats.totalConnections++;
    this.stats.idleConnections++;

    console.log(`Created database connection: ${connectionId}`);
    return connection;
  }

  private async destroyConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      await connection.client.$disconnect();
      this.connections.delete(connectionId);
      
      if (connection.isActive) {
        this.stats.activeConnections--;
      } else {
        this.stats.idleConnections--;
      }
      this.stats.totalConnections--;

      console.log(`Destroyed database connection: ${connectionId}`);
    } catch (error) {
      console.error(`Error destroying connection ${connectionId}:`, error);
    }
  }

  private getIdleConnection(): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (!connection.isActive) {
        return connection;
      }
    }
    return null;
  }

  private shouldCreateNewConnection(): boolean {
    return (
      this.stats.totalConnections < this.config.maxConnections &&
      this.stats.idleConnections === 0 &&
      this.waitingQueue.length > 0
    );
  }

  private async processWaitingQueue(): Promise<void> {
    while (this.waitingQueue.length > 0) {
      const idleConnection = this.getIdleConnection();
      if (!idleConnection) {
        if (this.shouldCreateNewConnection()) {
          try {
            await this.createConnection();
            continue; // Try again with the new connection
          } catch (error) {
            // If we can't create a new connection, break and wait
            break;
          }
        } else {
          break; // No idle connections and can't create new ones
        }
      }

      const request = this.waitingQueue.shift();
      if (request && idleConnection) {
        this.activateConnection(idleConnection);
        request.resolve(idleConnection.client);
      }
    }
  }

  private activateConnection(connection: PooledConnection): void {
    connection.isActive = true;
    connection.lastUsed = new Date();
    this.stats.activeConnections++;
    this.stats.idleConnections--;
  }

  private deactivateConnection(connection: PooledConnection): void {
    connection.isActive = false;
    connection.lastUsed = new Date();
    this.stats.activeConnections--;
    this.stats.idleConnections++;
  }

  async acquire(): Promise<PrismaClient> {
    const startTime = Date.now();
    this.stats.totalAcquires++;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from queue if timeout
        const index = this.waitingQueue.findIndex(req => req.resolve === resolve);
        if (index >= 0) {
          this.waitingQueue.splice(index, 1);
          this.stats.waitingRequests--;
        }
        reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeoutMillis}ms`));
      }, this.config.acquireTimeoutMillis);

      const wrappedResolve = (client: PrismaClient) => {
        clearTimeout(timeout);
        const acquireTime = Date.now() - startTime;
        this.recordAcquireTime(acquireTime);
        resolve(client);
      };

      const wrappedReject = (error: Error) => {
        clearTimeout(timeout);
        this.stats.totalErrors++;
        reject(error);
      };

      // Try to get an idle connection immediately
      const idleConnection = this.getIdleConnection();
      if (idleConnection) {
        this.activateConnection(idleConnection);
        wrappedResolve(idleConnection.client);
        return;
      }

      // Try to create a new connection if possible
      if (this.shouldCreateNewConnection()) {
        this.createConnection()
          .then(connection => {
            this.activateConnection(connection);
            wrappedResolve(connection.client);
          })
          .catch(wrappedReject);
        return;
      }

      // Add to waiting queue
      this.waitingQueue.push({
        resolve: wrappedResolve,
        reject: wrappedReject,
        requestedAt: new Date(),
      });
      this.stats.waitingRequests++;
    });
  }

  async release(client: PrismaClient): Promise<void> {
    this.stats.totalReleases++;

    // Find the connection for this client
    for (const connection of this.connections.values()) {
      if (connection.client === client && connection.isActive) {
        this.deactivateConnection(connection);
        
        // Process waiting queue
        await this.processWaitingQueue();
        return;
      }
    }

    console.warn('Attempted to release unknown or inactive connection');
  }

  private recordAcquireTime(time: number): void {
    this.acquireTimes.push(time);
    if (this.acquireTimes.length > 100) {
      this.acquireTimes.splice(0, 50); // Keep last 100 measurements
    }
    this.stats.averageAcquireTime = Math.round(
      this.acquireTimes.reduce((sum, t) => sum + t, 0) / this.acquireTimes.length
    );
  }

  recordQueryTime(time: number): void {
    this.queryTimes.push(time);
    if (this.queryTimes.length > 100) {
      this.queryTimes.splice(0, 50); // Keep last 100 measurements
    }
    this.stats.averageQueryTime = Math.round(
      this.queryTimes.reduce((sum, t) => sum + t, 0) / this.queryTimes.length
    );
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMillis);
  }

  private async performHealthCheck(): Promise<void> {
    const now = new Date();
    const connectionsToDestroy: string[] = [];

    // Check for idle timeout and max lifetime
    for (const [id, connection] of this.connections) {
      const idleTime = now.getTime() - connection.lastUsed.getTime();
      const lifetime = now.getTime() - connection.createdAt.getTime();

      if (
        !connection.isActive &&
        (idleTime > this.config.idleTimeoutMillis || lifetime > this.config.maxLifetimeMillis) &&
        this.stats.totalConnections > this.config.minConnections
      ) {
        connectionsToDestroy.push(id);
      }
    }

    // Destroy old connections
    for (const id of connectionsToDestroy) {
      await this.destroyConnection(id);
    }

    // Ensure minimum connections
    while (this.stats.totalConnections < this.config.minConnections) {
      try {
        await this.createConnection();
      } catch (error) {
        console.error('Failed to maintain minimum connections:', error);
        break;
      }
    }

    // Test a sample of connections
    await this.testConnections();
  }

  private async testConnections(): Promise<void> {
    const connectionsToTest = Array.from(this.connections.values())
      .filter(conn => !conn.isActive)
      .slice(0, Math.min(3, this.connections.size)); // Test up to 3 connections

    for (const connection of connectionsToTest) {
      try {
        await connection.client.$queryRaw`SELECT 1`;
      } catch (error) {
        console.error(`Connection ${connection.id} failed health check:`, error);
        connection.errorCount++;
        
        // Destroy connections with too many errors
        if (connection.errorCount > 3) {
          await this.destroyConnection(connection.id);
        }
      }
    }
  }

  getStats(): ConnectionStats {
    this.stats.waitingRequests = this.waitingQueue.length;
    return { ...this.stats };
  }

  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Reject all waiting requests
    for (const request of this.waitingQueue) {
      request.reject(new Error('Connection pool is closing'));
    }
    this.waitingQueue.length = 0;

    // Close all connections
    const destroyPromises = Array.from(this.connections.keys()).map(id =>
      this.destroyConnection(id)
    );
    await Promise.all(destroyPromises);

    console.log('Database connection pool closed');
  }
}

// Singleton pool instance
let globalPool: DatabaseConnectionPool | null = null;

export function getConnectionPool(): DatabaseConnectionPool {
  if (!globalPool) {
    globalPool = new DatabaseConnectionPool({
      minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '2'),
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '300000'),
    });
  }
  return globalPool;
}

// Utility function for executing queries with automatic pool management
export async function withPooledConnection<T>(
  operation: (client: PrismaClient) => Promise<T>
): Promise<T> {
  const pool = getConnectionPool();
  const client = await pool.acquire();
  const startTime = Date.now();

  try {
    const result = await operation(client);
    const queryTime = Date.now() - startTime;
    pool.recordQueryTime(queryTime);
    return result;
  } finally {
    await pool.release(client);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (globalPool) {
    await globalPool.close();
  }
});

process.on('SIGINT', async () => {
  if (globalPool) {
    await globalPool.close();
  }
});

export { DatabaseConnectionPool };
export default getConnectionPool;