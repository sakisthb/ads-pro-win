// Database Connection Pool Optimization - Phase 3 Week 10
import { PrismaClient } from '@prisma/client';

interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
  retryAttempts: number;
  retryDelay: number;
}

interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  averageAcquireTime: number;
  averageQueryTime: number;
  connectionErrors: number;
  lastError?: string;
}

interface Connection {
  id: string;
  client: PrismaClient;
  createdAt: number;
  lastUsed: number;
  isActive: boolean;
  queryCount: number;
}

// Advanced Connection Pool Manager
class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool;
  private config: ConnectionPoolConfig;
  private connections: Map<string, Connection> = new Map();
  private waitingQueue: Array<{
    resolve: (value: { client: PrismaClient; release: () => void }) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private metrics: ConnectionMetrics;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      maxConnections: parseInt(process.env.DATABASE_POOL_MAX || '20'),
      minConnections: parseInt(process.env.DATABASE_POOL_MIN || '5'),
      acquireTimeout: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT || '30000'),
      idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '300000'), // 5 minutes
      maxLifetime: parseInt(process.env.DATABASE_MAX_LIFETIME || '3600000'), // 1 hour
      retryAttempts: 3,
      retryDelay: 1000,
    };

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      pendingRequests: 0,
      averageAcquireTime: 0,
      averageQueryTime: 0,
      connectionErrors: 0,
    };

    this.initialize();
  }

  static getInstance(): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool();
    }
    return DatabaseConnectionPool.instance;
  }

  private async initialize(): Promise<void> {
    console.log('🔌 Initializing database connection pool...');
    
    // Create minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        console.error(`Failed to create initial connection ${i + 1}:`, error);
      }
    }

    // Start cleanup interval
    this.startCleanupInterval();
    
    console.log(`✅ Connection pool initialized with ${this.connections.size} connections`);
  }

  private async createConnection(): Promise<Connection> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const client = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });

      // Test connection
      await client.$connect();
      await client.$queryRaw`SELECT 1`;

      const connection: Connection = {
        id: connectionId,
        client,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: false,
        queryCount: 0,
      };

      this.connections.set(connectionId, connection);
      this.updateMetrics();
      
      console.log(`🆕 Created new database connection: ${connectionId}`);
      return connection;
    } catch (error) {
      this.metrics.connectionErrors++;
      console.error(`❌ Failed to create database connection: ${error}`);
      throw error;
    }
  }

  private async destroyConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      await connection.client.$disconnect();
      this.connections.delete(connectionId);
      this.updateMetrics();
      console.log(`🗑️ Destroyed database connection: ${connectionId}`);
    } catch (error) {
      console.error(`Failed to destroy connection ${connectionId}:`, error);
    }
  }

  // Acquire connection from pool
  async acquire(): Promise<{ client: PrismaClient; release: () => void }> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeFromWaitingQueue(resolve);
        reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeout}ms`));
      }, this.config.acquireTimeout);

      const tryAcquire = async () => {
        try {
          // Find available connection
          const availableConnection = this.findAvailableConnection();
          
          if (availableConnection) {
            clearTimeout(timeout);
            this.removeFromWaitingQueue(resolve);
            
            availableConnection.isActive = true;
            availableConnection.lastUsed = Date.now();
            this.updateMetrics();
            
            const acquireTime = Date.now() - startTime;
            this.updateAverageAcquireTime(acquireTime);
            
            const release = () => this.releaseConnection(availableConnection.id);
            resolve({ client: availableConnection.client, release });
            return;
          }

          // Try to create new connection if under limit
          if (this.connections.size < this.config.maxConnections) {
            const newConnection = await this.createConnection();
            clearTimeout(timeout);
            this.removeFromWaitingQueue(resolve);
            
            newConnection.isActive = true;
            newConnection.lastUsed = Date.now();
            this.updateMetrics();
            
            const acquireTime = Date.now() - startTime;
            this.updateAverageAcquireTime(acquireTime);
            
            const release = () => this.releaseConnection(newConnection.id);
            resolve({ client: newConnection.client, release });
            return;
          }

          // Add to waiting queue
          this.waitingQueue.push({ resolve, reject, timestamp: Date.now() });
          this.metrics.pendingRequests = this.waitingQueue.length;
        } catch (error) {
          clearTimeout(timeout);
          this.removeFromWaitingQueue(resolve);
          reject(error);
        }
      };

      tryAcquire();
    });
  }

  private findAvailableConnection(): Connection | undefined {
    for (const connection of this.connections.values()) {
      if (!connection.isActive && this.isConnectionHealthy(connection)) {
        return connection;
      }
    }
    return undefined;
  }

  private isConnectionHealthy(connection: Connection): boolean {
    const now = Date.now();
    
    // Check if connection is too old
    if (now - connection.createdAt > this.config.maxLifetime) {
      this.destroyConnection(connection.id);
      return false;
    }

    // Check if connection is idle too long
    if (now - connection.lastUsed > this.config.idleTimeout) {
      // Keep minimum connections alive
      if (this.connections.size > this.config.minConnections) {
        this.destroyConnection(connection.id);
        return false;
      }
    }

    return true;
  }

  private releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.isActive = false;
    connection.lastUsed = Date.now();
    this.updateMetrics();

    // Process waiting queue
    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift();
      if (waiting) {
        this.metrics.pendingRequests = this.waitingQueue.length;
        
        connection.isActive = true;
        const release = () => this.releaseConnection(connectionId);
        waiting.resolve({ client: connection.client, release });
      }
    }
  }

  private removeFromWaitingQueue(resolve: Function): void {
    const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
    if (index !== -1) {
      this.waitingQueue.splice(index, 1);
      this.metrics.pendingRequests = this.waitingQueue.length;
    }
  }

  private updateMetrics(): void {
    this.metrics.totalConnections = this.connections.size;
    this.metrics.activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.isActive).length;
    this.metrics.idleConnections = this.metrics.totalConnections - this.metrics.activeConnections;
  }

  private updateAverageAcquireTime(newTime: number): void {
    const count = this.metrics.totalConnections;
    this.metrics.averageAcquireTime = 
      (this.metrics.averageAcquireTime * (count - 1) + newTime) / count;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // Cleanup every minute
  }

  private async performCleanup(): Promise<void> {
    const now = Date.now();
    const connectionsToDestroy: string[] = [];

    // Find connections to cleanup
    for (const [id, connection] of this.connections.entries()) {
      if (connection.isActive) continue;

      const age = now - connection.createdAt;
      const idle = now - connection.lastUsed;

      // Remove old connections
      if (age > this.config.maxLifetime) {
        connectionsToDestroy.push(id);
        continue;
      }

      // Remove idle connections (but keep minimum)
      if (idle > this.config.idleTimeout && 
          this.connections.size > this.config.minConnections) {
        connectionsToDestroy.push(id);
      }
    }

    // Destroy marked connections
    for (const id of connectionsToDestroy) {
      await this.destroyConnection(id);
    }

    // Ensure minimum connections
    while (this.connections.size < this.config.minConnections) {
      try {
        await this.createConnection();
      } catch (error) {
        console.error('Failed to maintain minimum connections:', error);
        break;
      }
    }

    // Clean expired waiting requests
    const expiredRequests = this.waitingQueue.filter(
      req => now - req.timestamp > this.config.acquireTimeout
    );

    expiredRequests.forEach(req => {
      req.reject(new Error('Connection request expired'));
      this.removeFromWaitingQueue(req.resolve);
    });
  }

  // Execute query with automatic connection management
  async executeQuery<T>(queryFn: (client: PrismaClient) => Promise<T>): Promise<T> {
    const { client, release } = await this.acquire();
    const startTime = Date.now();

    try {
      const result = await queryFn(client);
      
      // Update query metrics
      const queryTime = Date.now() - startTime;
      const connection = Array.from(this.connections.values())
        .find(conn => conn.client === client);
      
      if (connection) {
        connection.queryCount++;
        this.updateAverageQueryTime(queryTime);
      }

      return result;
    } finally {
      release();
    }
  }

  private updateAverageQueryTime(newTime: number): void {
    const totalQueries = Array.from(this.connections.values())
      .reduce((sum, conn) => sum + conn.queryCount, 0);
    
    if (totalQueries > 0) {
      this.metrics.averageQueryTime = 
        (this.metrics.averageQueryTime * (totalQueries - 1) + newTime) / totalQueries;
    }
  }

  // Health check for the pool
  async healthCheck(): Promise<{
    healthy: boolean;
    metrics: ConnectionMetrics;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check if we have connections
    if (this.connections.size === 0) {
      issues.push('No database connections available');
    }

    // Check pending requests
    if (this.metrics.pendingRequests > this.config.maxConnections) {
      issues.push(`High number of pending requests: ${this.metrics.pendingRequests}`);
    }

    // Check error rate
    if (this.metrics.connectionErrors > 10) {
      issues.push(`High connection error rate: ${this.metrics.connectionErrors}`);
    }

    // Test a connection
    try {
      await this.executeQuery(async (client) => {
        await client.$queryRaw`SELECT 1`;
        return true;
      });
    } catch (error) {
      issues.push(`Connection test failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      metrics: { ...this.metrics },
      issues,
    };
  }

  // Get current metrics
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  // Update configuration
  updateConfig(newConfig: Partial<ConnectionPoolConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Connection pool configuration updated');
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('🔌 Shutting down database connection pool...');

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Reject all waiting requests
    this.waitingQueue.forEach(req => {
      req.reject(new Error('Connection pool is shutting down'));
    });
    this.waitingQueue.length = 0;

    // Close all connections
    const closePromises = Array.from(this.connections.keys()).map(id => 
      this.destroyConnection(id)
    );

    await Promise.all(closePromises);
    console.log('✅ Database connection pool shut down successfully');
  }
}

// Export singleton instance
export const connectionPool = DatabaseConnectionPool.getInstance();

// Export utilities
export const poolUtils = {
  // Execute with retry logic
  executeWithRetry: async <T>(
    queryFn: (client: PrismaClient) => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await connectionPool.executeQuery(queryFn);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Query attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }

    throw lastError!;
  },

  // Execute multiple queries in parallel with connection limits
  executeParallel: async <T>(
    queryFunctions: Array<(client: PrismaClient) => Promise<T>>,
    concurrency: number = 5
  ): Promise<T[]> => {
    const results: T[] = [];
    
    for (let i = 0; i < queryFunctions.length; i += concurrency) {
      const batch = queryFunctions.slice(i, i + concurrency);
      const batchPromises = batch.map(fn => connectionPool.executeQuery(fn));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  },
};

// Export types and classes
export {
  DatabaseConnectionPool,
  type ConnectionPoolConfig,
  type ConnectionMetrics,
  type Connection,
};