// Real-time Monitoring Dashboard - Phase 3 Week 10
import { EventEmitter } from 'events';

// Real-time monitoring interfaces
interface SystemHealth {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    incoming: number;
    outgoing: number;
  };
  database: {
    connections: number;
    queryTime: number;
    errorRate: number;
  };
  api: {
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
  timestamp: number;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
  duration?: number;
}

interface MonitoringRule {
  id: string;
  name: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'warning' | 'error' | 'critical';
  enabled: boolean;
  cooldown: number; // minutes
  lastTriggered?: number;
}

interface DashboardMetrics {
  uptime: number;
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  activeUsers: number;
  systemHealth: SystemHealth;
  recentAlerts: Alert[];
  performanceHistory: Array<{
    timestamp: number;
    responseTime: number;
    errorRate: number;
    throughput: number;
  }>;
}

// Real-time Monitoring System
class RealTimeMonitoringSystem extends EventEmitter {
  private static instance: RealTimeMonitoringSystem;
  private systemHealth: SystemHealth;
  private alerts: Map<string, Alert> = new Map();
  private monitoringRules: Map<string, MonitoringRule> = new Map();
  private performanceHistory: DashboardMetrics['performanceHistory'] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private websocketConnections: Set<any> = new Set();
  private startTime: number;

  constructor() {
    super();
    this.startTime = Date.now();
    this.systemHealth = this.getInitialSystemHealth();
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  static getInstance(): RealTimeMonitoringSystem {
    if (!RealTimeMonitoringSystem.instance) {
      RealTimeMonitoringSystem.instance = new RealTimeMonitoringSystem();
    }
    return RealTimeMonitoringSystem.instance;
  }

  private getInitialSystemHealth(): SystemHealth {
    return {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: {
        incoming: 0,
        outgoing: 0,
      },
      database: {
        connections: 0,
        queryTime: 0,
        errorRate: 0,
      },
      api: {
        responseTime: 0,
        errorRate: 0,
        throughput: 0,
      },
      timestamp: Date.now(),
    };
  }

  private initializeDefaultRules(): void {
    const defaultRules: Omit<MonitoringRule, 'id'>[] = [
      {
        name: 'High CPU Usage',
        metric: 'cpu',
        condition: 'greater_than',
        threshold: 80,
        severity: 'warning',
        enabled: true,
        cooldown: 5,
      },
      {
        name: 'Critical CPU Usage',
        metric: 'cpu',
        condition: 'greater_than',
        threshold: 95,
        severity: 'critical',
        enabled: true,
        cooldown: 1,
      },
      {
        name: 'High Memory Usage',
        metric: 'memory',
        condition: 'greater_than',
        threshold: 85,
        severity: 'warning',
        enabled: true,
        cooldown: 5,
      },
      {
        name: 'Critical Memory Usage',
        metric: 'memory',
        condition: 'greater_than',
        threshold: 95,
        severity: 'critical',
        enabled: true,
        cooldown: 1,
      },
      {
        name: 'Slow API Response',
        metric: 'api.responseTime',
        condition: 'greater_than',
        threshold: 2000,
        severity: 'warning',
        enabled: true,
        cooldown: 2,
      },
      {
        name: 'High API Error Rate',
        metric: 'api.errorRate',
        condition: 'greater_than',
        threshold: 5,
        severity: 'error',
        enabled: true,
        cooldown: 3,
      },
      {
        name: 'Database Connection Issues',
        metric: 'database.connections',
        condition: 'greater_than',
        threshold: 18,
        severity: 'warning',
        enabled: true,
        cooldown: 2,
      },
      {
        name: 'Slow Database Queries',
        metric: 'database.queryTime',
        condition: 'greater_than',
        threshold: 1000,
        severity: 'warning',
        enabled: true,
        cooldown: 5,
      },
    ];

    defaultRules.forEach(rule => {
      const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.monitoringRules.set(id, { ...rule, id });
    });
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.evaluateRules();
      this.updatePerformanceHistory();
      this.broadcastUpdate();
    }, 5000); // Update every 5 seconds

    console.log('📊 Real-time monitoring started');
  }

  private async collectSystemMetrics(): Promise<void> {
    // Simulate system metrics collection
    // In a real implementation, this would collect actual system metrics
    
    this.systemHealth = {
      cpu: this.simulateMetric(this.systemHealth.cpu, 0, 100, 2),
      memory: this.simulateMetric(this.systemHealth.memory, 0, 100, 1.5),
      disk: this.simulateMetric(this.systemHealth.disk, 0, 100, 0.5),
      network: {
        incoming: this.simulateMetric(this.systemHealth.network.incoming, 0, 1000, 10),
        outgoing: this.simulateMetric(this.systemHealth.network.outgoing, 0, 1000, 8),
      },
      database: {
        connections: Math.floor(this.simulateMetric(this.systemHealth.database.connections, 0, 20, 1)),
        queryTime: this.simulateMetric(this.systemHealth.database.queryTime, 10, 2000, 50),
        errorRate: this.simulateMetric(this.systemHealth.database.errorRate, 0, 10, 0.1),
      },
      api: {
        responseTime: this.simulateMetric(this.systemHealth.api.responseTime, 50, 3000, 100),
        errorRate: this.simulateMetric(this.systemHealth.api.errorRate, 0, 20, 0.5),
        throughput: this.simulateMetric(this.systemHealth.api.throughput, 0, 1000, 20),
      },
      timestamp: Date.now(),
    };

    // Emit system health update
    this.emit('healthUpdate', this.systemHealth);
  }

  private simulateMetric(current: number, min: number, max: number, volatility: number): number {
    const change = (Math.random() - 0.5) * volatility;
    const newValue = current + change;
    return Math.max(min, Math.min(max, newValue));
  }

  private evaluateRules(): void {
    const now = Date.now();

    for (const rule of this.monitoringRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && (now - rule.lastTriggered) < (rule.cooldown * 60 * 1000)) {
        continue;
      }

      const value = this.getMetricValue(rule.metric);
      if (value === undefined) continue;

      let triggered = false;
      switch (rule.condition) {
        case 'greater_than':
          triggered = value > rule.threshold;
          break;
        case 'less_than':
          triggered = value < rule.threshold;
          break;
        case 'equals':
          triggered = value === rule.threshold;
          break;
        case 'not_equals':
          triggered = value !== rule.threshold;
          break;
      }

      if (triggered) {
        this.createAlert(rule, value);
        rule.lastTriggered = now;
      }
    }
  }

  private getMetricValue(metricPath: string): number | undefined {
    const parts = metricPath.split('.');
    let current: any = this.systemHealth;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return typeof current === 'number' ? current : undefined;
  }

  private createAlert(rule: MonitoringRule, value: number): void {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: Alert = {
      id: alertId,
      type: rule.severity,
      title: rule.name,
      message: `${rule.metric} is ${value.toFixed(2)}, exceeding threshold of ${rule.threshold}`,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.set(alertId, alert);
    this.emit('newAlert', alert);

    // Auto-resolve after some time for warnings
    if (rule.severity === 'warning') {
      setTimeout(() => {
        this.resolveAlert(alertId);
      }, 5 * 60 * 1000); // 5 minutes
    }

    console.log(`🚨 Alert created: ${alert.title} - ${alert.message}`);
  }

  private updatePerformanceHistory(): void {
    this.performanceHistory.push({
      timestamp: Date.now(),
      responseTime: this.systemHealth.api.responseTime,
      errorRate: this.systemHealth.api.errorRate,
      throughput: this.systemHealth.api.throughput,
    });

    // Keep only last 100 data points
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }
  }

  private broadcastUpdate(): void {
    const dashboardData = this.getDashboardMetrics();
    this.emit('dashboardUpdate', dashboardData);

    // Broadcast to WebSocket connections
    this.websocketConnections.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'dashboardUpdate',
          data: dashboardData,
        }));
      }
    });
  }

  // Public API methods
  getDashboardMetrics(): DashboardMetrics {
    const now = Date.now();
    const uptime = now - this.startTime;
    const recentAlerts = Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    // Calculate total requests (simulated)
    const totalRequests = Math.floor(uptime / 1000) * Math.random() * 10;

    return {
      uptime,
      totalRequests,
      errorRate: this.systemHealth.api.errorRate,
      averageResponseTime: this.systemHealth.api.responseTime,
      activeUsers: Math.floor(Math.random() * 150) + 50, // Simulated
      systemHealth: this.systemHealth,
      recentAlerts,
      performanceHistory: this.performanceHistory,
    };
  }

  getAlerts(resolved = false): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.resolved === resolved)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) return false;

    alert.resolved = true;
    alert.duration = Date.now() - alert.timestamp;
    
    this.emit('alertResolved', alert);
    console.log(`✅ Alert resolved: ${alert.title}`);
    return true;
  }

  addMonitoringRule(rule: Omit<MonitoringRule, 'id'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.monitoringRules.set(id, { ...rule, id });
    console.log(`📋 Monitoring rule added: ${rule.name}`);
    return id;
  }

  updateMonitoringRule(id: string, updates: Partial<MonitoringRule>): boolean {
    const rule = this.monitoringRules.get(id);
    if (!rule) return false;

    Object.assign(rule, updates);
    console.log(`📝 Monitoring rule updated: ${rule.name}`);
    return true;
  }

  deleteMonitoringRule(id: string): boolean {
    const deleted = this.monitoringRules.delete(id);
    if (deleted) {
      console.log(`🗑️ Monitoring rule deleted: ${id}`);
    }
    return deleted;
  }

  getMonitoringRules(): MonitoringRule[] {
    return Array.from(this.monitoringRules.values());
  }

  // WebSocket connection management
  addWebSocketConnection(ws: any): void {
    this.websocketConnections.add(ws);
    
    // Send initial data
    ws.send(JSON.stringify({
      type: 'initialData',
      data: this.getDashboardMetrics(),
    }));

    ws.on('close', () => {
      this.websocketConnections.delete(ws);
    });
  }

  // Performance test simulation
  simulateLoad(duration: number = 60000): void {
    console.log(`🧪 Simulating load for ${duration}ms`);
    
    const loadInterval = setInterval(() => {
      // Increase system load
      this.systemHealth.cpu = Math.min(100, this.systemHealth.cpu + Math.random() * 10);
      this.systemHealth.memory = Math.min(100, this.systemHealth.memory + Math.random() * 5);
      this.systemHealth.api.responseTime = Math.min(5000, this.systemHealth.api.responseTime + Math.random() * 200);
      this.systemHealth.api.errorRate = Math.min(20, this.systemHealth.api.errorRate + Math.random() * 2);
    }, 1000);

    setTimeout(() => {
      clearInterval(loadInterval);
      console.log('🧪 Load simulation completed');
    }, duration);
  }

  // Health check endpoint
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'warn' | 'fail';
      value?: number;
      threshold?: number;
    }>;
  } {
    const checks = [
      {
        name: 'CPU Usage',
        status: this.systemHealth.cpu > 95 ? 'fail' : this.systemHealth.cpu > 80 ? 'warn' : 'pass' as 'pass' | 'warn' | 'fail',
        value: this.systemHealth.cpu,
        threshold: 80,
      },
      {
        name: 'Memory Usage',
        status: this.systemHealth.memory > 95 ? 'fail' : this.systemHealth.memory > 85 ? 'warn' : 'pass' as 'pass' | 'warn' | 'fail',
        value: this.systemHealth.memory,
        threshold: 85,
      },
      {
        name: 'API Response Time',
        status: this.systemHealth.api.responseTime > 3000 ? 'fail' : this.systemHealth.api.responseTime > 2000 ? 'warn' : 'pass' as 'pass' | 'warn' | 'fail',
        value: this.systemHealth.api.responseTime,
        threshold: 2000,
      },
      {
        name: 'Database Query Time',
        status: this.systemHealth.database.queryTime > 2000 ? 'fail' : this.systemHealth.database.queryTime > 1000 ? 'warn' : 'pass' as 'pass' | 'warn' | 'fail',
        value: this.systemHealth.database.queryTime,
        threshold: 1000,
      },
    ];

    const failCount = checks.filter(check => check.status === 'fail').length;
    const warnCount = checks.filter(check => check.status === 'warn').length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failCount > 0) {
      status = 'unhealthy';
    } else if (warnCount > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return { status, checks };
  }

  // Shutdown
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Close all WebSocket connections
    this.websocketConnections.forEach(ws => {
      ws.close();
    });

    console.log('🛑 Real-time monitoring stopped');
  }
}

// Export singleton instance
export const realTimeMonitoring = RealTimeMonitoringSystem.getInstance();

// Export types and utilities
export {
  RealTimeMonitoringSystem,
  type SystemHealth,
  type Alert,
  type MonitoringRule,
  type DashboardMetrics,
};