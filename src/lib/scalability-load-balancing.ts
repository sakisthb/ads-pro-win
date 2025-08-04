// Scalability Improvements & Load Balancing - Phase 3 Week 10
import { EventEmitter } from 'events';

// Load balancing and scalability interfaces
interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'least-connections' | 'weighted' | 'ip-hash';
  healthCheckInterval: number;
  healthCheckTimeout: number;
  retryAttempts: number;
  failoverThreshold: number;
  enableStickySessions: boolean;
  sessionAffinityTTL: number;
}

interface ServerInstance {
  id: string;
  host: string;
  port: number;
  weight: number;
  status: 'healthy' | 'unhealthy' | 'draining';
  currentConnections: number;
  totalRequests: number;
  lastHealthCheck: number;
  averageResponseTime: number;
  errorRate: number;
}

interface AutoScalingConfig {
  minInstances: number;
  maxInstances: number;
  targetCPUUtilization: number;
  targetMemoryUtilization: number;
  scaleUpCooldown: number; // seconds
  scaleDownCooldown: number; // seconds
  metricsWindow: number; // seconds
  enabled: boolean;
}

interface ScalingMetrics {
  currentInstances: number;
  targetInstances: number;
  cpuUtilization: number;
  memoryUtilization: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  timestamp: number;
}

interface SessionAffinity {
  sessionId: string;
  serverId: string;
  lastAccessed: number;
  expiresAt: number;
}

// Advanced Load Balancer & Auto Scaling Manager
class ScalabilityLoadBalancingManager extends EventEmitter {
  private static instance: ScalabilityLoadBalancingManager;
  private config: LoadBalancerConfig;
  private autoScalingConfig: AutoScalingConfig;
  private servers: Map<string, ServerInstance> = new Map();
  private sessionAffinityMap: Map<string, SessionAffinity> = new Map();
  private currentServerIndex = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private scalingInterval: NodeJS.Timeout | null = null;
  private metricsHistory: ScalingMetrics[] = [];

  constructor() {
    super();
    this.config = {
      algorithm: 'round-robin',
      healthCheckInterval: 30000, // 30 seconds
      healthCheckTimeout: 5000, // 5 seconds
      retryAttempts: 3,
      failoverThreshold: 3,
      enableStickySessions: false,
      sessionAffinityTTL: 1800000, // 30 minutes
    };

    this.autoScalingConfig = {
      minInstances: 2,
      maxInstances: 10,
      targetCPUUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpCooldown: 300, // 5 minutes
      scaleDownCooldown: 600, // 10 minutes
      metricsWindow: 300, // 5 minutes
      enabled: process.env.NODE_ENV === 'production',
    };

    this.initialize();
  }

  static getInstance(): ScalabilityLoadBalancingManager {
    if (!ScalabilityLoadBalancingManager.instance) {
      ScalabilityLoadBalancingManager.instance = new ScalabilityLoadBalancingManager();
    }
    return ScalabilityLoadBalancingManager.instance;
  }

  private initialize(): void {
    // Add initial server instances
    this.addDefaultServers();

    // Start health checking
    this.startHealthChecking();

    // Start auto-scaling monitoring
    if (this.autoScalingConfig.enabled) {
      this.startAutoScaling();
    }

    console.log('⚖️ Load balancer and auto-scaling initialized');
  }

  private addDefaultServers(): void {
    const defaultServers = [
      { host: 'app-server-1.ads-pro.com', port: 3000, weight: 1 },
      { host: 'app-server-2.ads-pro.com', port: 3000, weight: 1 },
    ];

    defaultServers.forEach((serverConfig, index) => {
      const serverId = `server_${index + 1}`;
      const server: ServerInstance = {
        id: serverId,
        host: serverConfig.host,
        port: serverConfig.port,
        weight: serverConfig.weight,
        status: 'healthy',
        currentConnections: 0,
        totalRequests: 0,
        lastHealthCheck: Date.now(),
        averageResponseTime: 0,
        errorRate: 0,
      };

      this.servers.set(serverId, server);
    });
  }

  // Load balancing algorithms
  private selectServerRoundRobin(): ServerInstance | null {
    const healthyServers = Array.from(this.servers.values())
      .filter(server => server.status === 'healthy');

    if (healthyServers.length === 0) return null;

    this.currentServerIndex = (this.currentServerIndex + 1) % healthyServers.length;
    return healthyServers[this.currentServerIndex];
  }

  private selectServerLeastConnections(): ServerInstance | null {
    const healthyServers = Array.from(this.servers.values())
      .filter(server => server.status === 'healthy')
      .sort((a, b) => a.currentConnections - b.currentConnections);

    return healthyServers[0] || null;
  }

  private selectServerWeighted(): ServerInstance | null {
    const healthyServers = Array.from(this.servers.values())
      .filter(server => server.status === 'healthy');

    if (healthyServers.length === 0) return null;

    const totalWeight = healthyServers.reduce((sum, server) => sum + server.weight, 0);
    let randomWeight = Math.random() * totalWeight;

    for (const server of healthyServers) {
      randomWeight -= server.weight;
      if (randomWeight <= 0) {
        return server;
      }
    }

    return healthyServers[0];
  }

  private selectServerIPHash(clientIP: string): ServerInstance | null {
    const healthyServers = Array.from(this.servers.values())
      .filter(server => server.status === 'healthy');

    if (healthyServers.length === 0) return null;

    // Simple hash function for IP
    let hash = 0;
    for (let i = 0; i < clientIP.length; i++) {
      hash = ((hash << 5) - hash + clientIP.charCodeAt(i)) & 0xffffffff;
    }

    const index = Math.abs(hash) % healthyServers.length;
    return healthyServers[index];
  }

  // Main load balancing method
  selectServer(clientIP?: string, sessionId?: string): ServerInstance | null {
    // Check session affinity first
    if (this.config.enableStickySessions && sessionId) {
      const affinity = this.sessionAffinityMap.get(sessionId);
      if (affinity && affinity.expiresAt > Date.now()) {
        const server = this.servers.get(affinity.serverId);
        if (server && server.status === 'healthy') {
          affinity.lastAccessed = Date.now();
          return server;
        } else {
          // Remove invalid affinity
          this.sessionAffinityMap.delete(sessionId);
        }
      }
    }

    let selectedServer: ServerInstance | null = null;

    // Select server based on algorithm
    switch (this.config.algorithm) {
      case 'round-robin':
        selectedServer = this.selectServerRoundRobin();
        break;
      case 'least-connections':
        selectedServer = this.selectServerLeastConnections();
        break;
      case 'weighted':
        selectedServer = this.selectServerWeighted();
        break;
      case 'ip-hash':
        selectedServer = clientIP ? this.selectServerIPHash(clientIP) : this.selectServerRoundRobin();
        break;
    }

    // Create session affinity if enabled
    if (selectedServer && this.config.enableStickySessions && sessionId) {
      this.sessionAffinityMap.set(sessionId, {
        sessionId,
        serverId: selectedServer.id,
        lastAccessed: Date.now(),
        expiresAt: Date.now() + this.config.sessionAffinityTTL,
      });
    }

    return selectedServer;
  }

  // Health checking
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.servers.values()).map(server => 
      this.checkServerHealth(server)
    );

    await Promise.all(healthCheckPromises);
    this.emit('healthCheckCompleted', this.getHealthStatus());
  }

  private async checkServerHealth(server: ServerInstance): Promise<void> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.healthCheckTimeout);

      const response = await fetch(`http://${server.host}:${server.port}/health`, {
        signal: controller.signal,
        method: 'GET',
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      server.averageResponseTime = (server.averageResponseTime * 0.8) + (responseTime * 0.2);
      server.lastHealthCheck = Date.now();

      if (response.ok) {
        if (server.status === 'unhealthy') {
          console.log(`✅ Server ${server.id} recovered`);
          this.emit('serverRecovered', server);
        }
        server.status = 'healthy';
        server.errorRate = Math.max(0, server.errorRate - 0.1);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      server.errorRate = Math.min(100, server.errorRate + 1);
      
      if (server.status === 'healthy' && server.errorRate >= this.config.failoverThreshold) {
        console.error(`❌ Server ${server.id} marked as unhealthy: ${error}`);
        server.status = 'unhealthy';
        this.emit('serverFailed', server);
      }
    }
  }

  // Auto-scaling functionality
  private startAutoScaling(): void {
    this.scalingInterval = setInterval(async () => {
      await this.evaluateScaling();
    }, 60000); // Check every minute
  }

  private async evaluateScaling(): Promise<void> {
    const currentMetrics = await this.collectScalingMetrics();
    this.metricsHistory.push(currentMetrics);

    // Keep only recent metrics
    const cutoffTime = Date.now() - (this.autoScalingConfig.metricsWindow * 1000);
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoffTime);

    if (this.metricsHistory.length < 3) return; // Need at least 3 data points

    const shouldScaleUp = this.shouldScaleUp();
    const shouldScaleDown = this.shouldScaleDown();

    if (shouldScaleUp) {
      await this.scaleUp();
    } else if (shouldScaleDown) {
      await this.scaleDown();
    }
  }

  private async collectScalingMetrics(): Promise<ScalingMetrics> {
    const servers = Array.from(this.servers.values()).filter(s => s.status === 'healthy');
    
    // Simulate metrics collection - in production, this would gather real metrics
    const cpuUtilization = this.simulateMetric(50, 100);
    const memoryUtilization = this.simulateMetric(40, 90);
    const requestsPerSecond = servers.reduce((sum, s) => sum + (s.totalRequests / 60), 0);
    const averageResponseTime = servers.reduce((sum, s) => sum + s.averageResponseTime, 0) / servers.length;

    return {
      currentInstances: servers.length,
      targetInstances: servers.length,
      cpuUtilization,
      memoryUtilization,
      requestsPerSecond,
      averageResponseTime: averageResponseTime || 0,
      timestamp: Date.now(),
    };
  }

  private shouldScaleUp(): boolean {
    const recentMetrics = this.metricsHistory.slice(-3);
    const avgCPU = recentMetrics.reduce((sum, m) => sum + m.cpuUtilization, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryUtilization, 0) / recentMetrics.length;
    const currentInstances = recentMetrics[recentMetrics.length - 1].currentInstances;

    return (
      currentInstances < this.autoScalingConfig.maxInstances &&
      (avgCPU > this.autoScalingConfig.targetCPUUtilization ||
       avgMemory > this.autoScalingConfig.targetMemoryUtilization)
    );
  }

  private shouldScaleDown(): boolean {
    const recentMetrics = this.metricsHistory.slice(-5);
    const avgCPU = recentMetrics.reduce((sum, m) => sum + m.cpuUtilization, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryUtilization, 0) / recentMetrics.length;
    const currentInstances = recentMetrics[recentMetrics.length - 1].currentInstances;

    return (
      currentInstances > this.autoScalingConfig.minInstances &&
      avgCPU < (this.autoScalingConfig.targetCPUUtilization * 0.5) &&
      avgMemory < (this.autoScalingConfig.targetMemoryUtilization * 0.5)
    );
  }

  private async scaleUp(): Promise<void> {
    const currentCount = Array.from(this.servers.values()).filter(s => s.status === 'healthy').length;
    const newInstanceId = `server_${Date.now()}`;
    
    console.log(`📈 Scaling up: Adding new instance ${newInstanceId}`);

    // Simulate launching new instance
    const newServer: ServerInstance = {
      id: newInstanceId,
      host: `app-server-${currentCount + 1}.ads-pro.com`,
      port: 3000,
      weight: 1,
      status: 'healthy',
      currentConnections: 0,
      totalRequests: 0,
      lastHealthCheck: Date.now(),
      averageResponseTime: 0,
      errorRate: 0,
    };

    this.servers.set(newInstanceId, newServer);
    this.emit('instanceAdded', newServer);
    
    console.log(`✅ New instance ${newInstanceId} added successfully`);
  }

  private async scaleDown(): Promise<void> {
    const healthyServers = Array.from(this.servers.values())
      .filter(s => s.status === 'healthy')
      .sort((a, b) => a.currentConnections - b.currentConnections);

    if (healthyServers.length <= this.autoScalingConfig.minInstances) {
      return;
    }

    const serverToRemove = healthyServers[0];
    console.log(`📉 Scaling down: Removing instance ${serverToRemove.id}`);

    // Gracefully drain connections
    serverToRemove.status = 'draining';
    
    // Wait for connections to drain (simplified)
    setTimeout(() => {
      this.servers.delete(serverToRemove.id);
      this.emit('instanceRemoved', serverToRemove);
      console.log(`✅ Instance ${serverToRemove.id} removed successfully`);
    }, 30000); // 30 seconds
  }

  private simulateMetric(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  // Connection tracking
  trackConnection(serverId: string, isConnect: boolean): void {
    const server = this.servers.get(serverId);
    if (!server) return;

    if (isConnect) {
      server.currentConnections++;
      server.totalRequests++;
    } else {
      server.currentConnections = Math.max(0, server.currentConnections - 1);
    }
  }

  // Server management
  addServer(config: Omit<ServerInstance, 'status' | 'currentConnections' | 'totalRequests' | 'lastHealthCheck' | 'averageResponseTime' | 'errorRate'>): void {
    const server: ServerInstance = {
      ...config,
      status: 'healthy',
      currentConnections: 0,
      totalRequests: 0,
      lastHealthCheck: Date.now(),
      averageResponseTime: 0,
      errorRate: 0,
    };

    this.servers.set(config.id, server);
    console.log(`➕ Server ${config.id} added to load balancer`);
    this.emit('serverAdded', server);
  }

  removeServer(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    // Drain connections first
    server.status = 'draining';
    
    setTimeout(() => {
      this.servers.delete(serverId);
      console.log(`➖ Server ${serverId} removed from load balancer`);
      this.emit('serverRemoved', server);
    }, 30000);

    return true;
  }

  updateServerWeight(serverId: string, weight: number): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    server.weight = weight;
    console.log(`⚖️ Server ${serverId} weight updated to ${weight}`);
    return true;
  }

  // Configuration management
  updateLoadBalancerConfig(updates: Partial<LoadBalancerConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('⚙️ Load balancer configuration updated');
  }

  updateAutoScalingConfig(updates: Partial<AutoScalingConfig>): void {
    this.autoScalingConfig = { ...this.autoScalingConfig, ...updates };
    
    if (updates.enabled !== undefined) {
      if (updates.enabled && !this.scalingInterval) {
        this.startAutoScaling();
      } else if (!updates.enabled && this.scalingInterval) {
        clearInterval(this.scalingInterval);
        this.scalingInterval = null;
      }
    }
    
    console.log('📊 Auto-scaling configuration updated');
  }

  // Status and metrics
  getHealthStatus(): {
    healthy: number;
    unhealthy: number;
    draining: number;
    total: number;
    servers: ServerInstance[];
  } {
    const servers = Array.from(this.servers.values());
    
    return {
      healthy: servers.filter(s => s.status === 'healthy').length,
      unhealthy: servers.filter(s => s.status === 'unhealthy').length,
      draining: servers.filter(s => s.status === 'draining').length,
      total: servers.length,
      servers,
    };
  }

  getScalingMetrics(): ScalingMetrics[] {
    return [...this.metricsHistory];
  }

  getSessionAffinityStats(): {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  } {
    const now = Date.now();
    const sessions = Array.from(this.sessionAffinityMap.values());
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.expiresAt > now).length,
      expiredSessions: sessions.filter(s => s.expiresAt <= now).length,
    };
  }

  // Cleanup expired sessions
  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanupCount = 0;

    for (const [sessionId, affinity] of this.sessionAffinityMap.entries()) {
      if (affinity.expiresAt <= now) {
        this.sessionAffinityMap.delete(sessionId);
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      console.log(`🧹 Cleaned up ${cleanupCount} expired session affinities`);
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down load balancer...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.scalingInterval) {
      clearInterval(this.scalingInterval);
    }

    // Drain all servers
    for (const server of this.servers.values()) {
      if (server.status === 'healthy') {
        server.status = 'draining';
      }
    }

    // Wait for connections to drain
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log('✅ Load balancer shutdown complete');
  }
}

// Circuit breaker for additional resilience
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }
}

// Export singleton instance
export const scalabilityLoadBalancing = ScalabilityLoadBalancingManager.getInstance();

// Export utilities
export const loadBalancingUtils = {
  // Create circuit breaker for server operations
  createCircuitBreaker: (failureThreshold = 5, recoveryTimeout = 60000) => 
    new CircuitBreaker(failureThreshold, recoveryTimeout),

  // Calculate server capacity score
  calculateCapacityScore: (server: ServerInstance): number => {
    const connectionScore = Math.max(0, 100 - server.currentConnections);
    const responseTimeScore = Math.max(0, 100 - (server.averageResponseTime / 10));
    const errorRateScore = Math.max(0, 100 - server.errorRate);
    
    return (connectionScore + responseTimeScore + errorRateScore) / 3;
  },

  // Generate load balancing report
  generateLoadBalancingReport: (manager: ScalabilityLoadBalancingManager): string => {
    const health = manager.getHealthStatus();
    const metrics = manager.getScalingMetrics();
    const sessions = manager.getSessionAffinityStats();

    return `
# Load Balancing Report

## Server Health
- Healthy Servers: ${health.healthy}
- Unhealthy Servers: ${health.unhealthy}
- Draining Servers: ${health.draining}
- Total Servers: ${health.total}

## Session Affinity
- Total Sessions: ${sessions.totalSessions}
- Active Sessions: ${sessions.activeSessions}
- Expired Sessions: ${sessions.expiredSessions}

## Recent Metrics
${metrics.slice(-5).map(m => 
  `- ${new Date(m.timestamp).toLocaleTimeString()}: ${m.currentInstances} instances, CPU: ${m.cpuUtilization.toFixed(1)}%, Memory: ${m.memoryUtilization.toFixed(1)}%`
).join('\n')}
`;
  },
};

// Export types and classes
export {
  ScalabilityLoadBalancingManager,
  CircuitBreaker,
  type LoadBalancerConfig,
  type ServerInstance,
  type AutoScalingConfig,
  type ScalingMetrics,
  type SessionAffinity,
};