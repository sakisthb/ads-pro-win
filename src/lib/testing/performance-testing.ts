// Performance Testing Suite - Phase 3 Week 11
import { performance } from 'perf_hooks';

// Performance testing interfaces
interface PerformanceTestConfig {
  testName: string;
  targetUrl: string;
  concurrentUsers: number;
  duration: number; // in milliseconds
  rampUpTime: number; // in milliseconds
  thresholds: PerformanceThresholds;
  scenarios: TestScenario[];
}

interface PerformanceThresholds {
  averageResponseTime: number; // ms
  maxResponseTime: number; // ms
  errorRate: number; // percentage
  throughput: number; // requests per second
  cpuUsage: number; // percentage
  memoryUsage: number; // MB
}

interface TestScenario {
  name: string;
  weight: number; // percentage of total traffic
  requests: RequestDefinition[];
}

interface RequestDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  headers?: Record<string, string>;
  body?: any;
  expectedStatus?: number;
  timeout?: number;
}

interface PerformanceMetrics {
  testName: string;
  startTime: number;
  endTime: number;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number; // requests per second
  errorRate: number; // percentage
  responseTimeDistribution: ResponseTimeDistribution;
  resourceUsage: ResourceUsage;
  statusCodeDistribution: Record<number, number>;
}

interface ResponseTimeDistribution {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

interface ResourceUsage {
  peakCpuUsage: number;
  averageCpuUsage: number;
  peakMemoryUsage: number;
  averageMemoryUsage: number;
  networkIO: {
    bytesIn: number;
    bytesOut: number;
  };
}

interface LoadTestResult {
  config: PerformanceTestConfig;
  metrics: PerformanceMetrics;
  passed: boolean;
  failedThresholds: string[];
  recommendations: string[];
  detailedResults: RequestResult[];
}

interface RequestResult {
  timestamp: number;
  method: string;
  path: string;
  responseTime: number;
  statusCode: number;
  error?: string;
  responseSize: number;
}

// Performance Testing Manager
class PerformanceTestingManager {
  private static instance: PerformanceTestingManager;
  private activeTest: PerformanceTestConfig | null = null;
  private testResults: Map<string, LoadTestResult> = new Map();
  private isRunning = false;

  constructor() {
    console.log('⚡ Performance Testing Manager initialized');
  }

  static getInstance(): PerformanceTestingManager {
    if (!PerformanceTestingManager.instance) {
      PerformanceTestingManager.instance = new PerformanceTestingManager();
    }
    return PerformanceTestingManager.instance;
  }

  // Predefined performance test configurations
  getDefaultTestConfigs(): PerformanceTestConfig[] {
    return [
      {
        testName: 'API Load Test - Normal Load',
        targetUrl: 'http://localhost:3000',
        concurrentUsers: 50,
        duration: 60000, // 1 minute
        rampUpTime: 10000, // 10 seconds
        thresholds: {
          averageResponseTime: 500,
          maxResponseTime: 2000,
          errorRate: 1,
          throughput: 100,
          cpuUsage: 80,
          memoryUsage: 512,
        },
        scenarios: [
          {
            name: 'API Browsing',
            weight: 60,
            requests: [
              { method: 'GET', path: '/api/health' },
              { method: 'GET', path: '/api/campaigns' },
              { method: 'GET', path: '/api/analytics/dashboard' },
            ],
          },
          {
            name: 'Campaign Management',
            weight: 30,
            requests: [
              { method: 'POST', path: '/api/campaigns', body: { name: 'Test Campaign', budget: 1000 } },
              { method: 'GET', path: '/api/campaigns/1' },
              { method: 'PUT', path: '/api/campaigns/1', body: { budget: 1500 } },
            ],
          },
          {
            name: 'Analytics Queries',
            weight: 10,
            requests: [
              { method: 'GET', path: '/api/analytics/performance' },
              { method: 'GET', path: '/api/analytics/reports' },
            ],
          },
        ],
      },
      {
        testName: 'API Stress Test - High Load',
        targetUrl: 'http://localhost:3000',
        concurrentUsers: 200,
        duration: 120000, // 2 minutes
        rampUpTime: 30000, // 30 seconds
        thresholds: {
          averageResponseTime: 1000,
          maxResponseTime: 5000,
          errorRate: 5,
          throughput: 300,
          cpuUsage: 90,
          memoryUsage: 1024,
        },
        scenarios: [
          {
            name: 'Heavy API Usage',
            weight: 100,
            requests: [
              { method: 'GET', path: '/api/campaigns' },
              { method: 'GET', path: '/api/analytics/dashboard' },
              { method: 'POST', path: '/api/campaigns', body: { name: 'Stress Test Campaign' } },
            ],
          },
        ],
      },
      {
        testName: 'Database Load Test',
        targetUrl: 'http://localhost:3000',
        concurrentUsers: 100,
        duration: 90000, // 1.5 minutes
        rampUpTime: 15000, // 15 seconds
        thresholds: {
          averageResponseTime: 800,
          maxResponseTime: 3000,
          errorRate: 2,
          throughput: 150,
          cpuUsage: 85,
          memoryUsage: 768,
        },
        scenarios: [
          {
            name: 'Database Operations',
            weight: 100,
            requests: [
              { method: 'GET', path: '/api/campaigns?limit=50' },
              { method: 'GET', path: '/api/analytics/reports?range=30d' },
              { method: 'GET', path: '/api/users/profile' },
            ],
          },
        ],
      },
    ];
  }

  // Execute performance test
  async executePerformanceTest(config: PerformanceTestConfig): Promise<LoadTestResult> {
    if (this.isRunning) {
      throw new Error('Another performance test is already running');
    }

    console.log(`🚀 Starting performance test: ${config.testName}`);
    console.log(`📊 Configuration: ${config.concurrentUsers} users, ${config.duration}ms duration`);

    this.isRunning = true;
    this.activeTest = config;

    const startTime = performance.now();
    const requestResults: RequestResult[] = [];
    const resourceUsageHistory: ResourceUsage[] = [];

    try {
      // Initialize metrics tracking
      const metricsTracker = this.initializeMetricsTracking();

      // Ramp up users gradually
      const userTasks = [];
      const rampUpInterval = config.rampUpTime / config.concurrentUsers;

      for (let i = 0; i < config.concurrentUsers; i++) {
        const userDelay = i * rampUpInterval;
        
        userTasks.push(
          this.simulateUser(config, userDelay, config.duration - userDelay, requestResults)
        );
      }

      // Start resource monitoring
      const resourceMonitor = this.startResourceMonitoring(resourceUsageHistory);

      // Wait for all users to complete
      await Promise.all(userTasks);

      // Stop resource monitoring
      clearInterval(resourceMonitor);

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // Calculate metrics
      const metrics = this.calculateMetrics(
        config.testName,
        startTime,
        endTime,
        totalDuration,
        requestResults,
        resourceUsageHistory
      );

      // Evaluate thresholds
      const evaluation = this.evaluateThresholds(metrics, config.thresholds);

      const result: LoadTestResult = {
        config,
        metrics,
        passed: evaluation.passed,
        failedThresholds: evaluation.failedThresholds,
        recommendations: this.generateRecommendations(metrics, config),
        detailedResults: requestResults,
      };

      this.testResults.set(config.testName, result);

      console.log(`✅ Performance test completed: ${config.testName}`);
      console.log(`📈 Results: ${metrics.successfulRequests}/${metrics.totalRequests} requests successful`);
      console.log(`⏱️ Average response time: ${metrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`🔥 Throughput: ${metrics.throughput.toFixed(2)} RPS`);

      return result;

    } catch (error) {
      console.error(`❌ Performance test failed: ${error}`);
      throw error;
    } finally {
      this.isRunning = false;
      this.activeTest = null;
    }
  }

  private async simulateUser(
    config: PerformanceTestConfig,
    delay: number,
    duration: number,
    requestResults: RequestResult[]
  ): Promise<void> {
    // Wait for ramp-up delay
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const userStartTime = performance.now();
    const endTime = userStartTime + duration;

    while (performance.now() < endTime) {
      // Select scenario based on weight
      const scenario = this.selectScenario(config.scenarios);
      
      // Execute requests in the scenario
      for (const request of scenario.requests) {
        const requestStart = performance.now();
        
        try {
          const result = await this.executeRequest(config.targetUrl, request);
          
          requestResults.push({
            timestamp: requestStart,
            method: request.method,
            path: request.path,
            responseTime: performance.now() - requestStart,
            statusCode: result.statusCode,
            responseSize: result.responseSize,
          });

        } catch (error) {
          requestResults.push({
            timestamp: requestStart,
            method: request.method,
            path: request.path,
            responseTime: performance.now() - requestStart,
            statusCode: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
            responseSize: 0,
          });
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
      }

      // Delay between scenario iterations
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    }
  }

  private selectScenario(scenarios: TestScenario[]): TestScenario {
    const totalWeight = scenarios.reduce((sum, scenario) => sum + scenario.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const scenario of scenarios) {
      currentWeight += scenario.weight;
      if (random <= currentWeight) {
        return scenario;
      }
    }
    
    return scenarios[0]; // Fallback
  }

  private async executeRequest(baseUrl: string, request: RequestDefinition): Promise<{
    statusCode: number;
    responseSize: number;
  }> {
    // Simulate HTTP request
    const delay = Math.random() * 300 + 100; // 100-400ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate different response patterns
    let statusCode = 200;
    let responseSize = Math.floor(Math.random() * 5000) + 500; // 500-5500 bytes

    // Simulate some errors
    if (Math.random() < 0.02) { // 2% error rate
      statusCode = Math.random() < 0.5 ? 500 : 404;
      responseSize = 200;
    }

    // Simulate slower responses for some endpoints
    if (request.path.includes('/analytics/reports')) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
      responseSize *= 2; // Larger response
    }

    return { statusCode, responseSize };
  }

  private initializeMetricsTracking(): any {
    // Initialize performance metrics tracking
    return {
      startTime: performance.now(),
    };
  }

  private startResourceMonitoring(resourceHistory: ResourceUsage[]): NodeJS.Timeout {
    return setInterval(() => {
      // Simulate resource usage monitoring
      const cpuUsage = Math.random() * 40 + 30; // 30-70%
      const memoryUsage = Math.random() * 200 + 300; // 300-500MB
      
      resourceHistory.push({
        peakCpuUsage: cpuUsage,
        averageCpuUsage: cpuUsage * 0.8,
        peakMemoryUsage: memoryUsage,
        averageMemoryUsage: memoryUsage * 0.9,
        networkIO: {
          bytesIn: Math.floor(Math.random() * 1000000) + 500000,
          bytesOut: Math.floor(Math.random() * 500000) + 100000,
        },
      });
    }, 5000); // Every 5 seconds
  }

  private calculateMetrics(
    testName: string,
    startTime: number,
    endTime: number,
    duration: number,
    requestResults: RequestResult[],
    resourceHistory: ResourceUsage[]
  ): PerformanceMetrics {
    const totalRequests = requestResults.length;
    const successfulRequests = requestResults.filter(r => r.statusCode >= 200 && r.statusCode < 400).length;
    const failedRequests = totalRequests - successfulRequests;

    const responseTimes = requestResults.map(r => r.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const minResponseTime = responseTimes[0] || 0;
    const maxResponseTime = responseTimes[responseTimes.length - 1] || 0;

    const throughput = (totalRequests / duration) * 1000; // requests per second
    const errorRate = (failedRequests / totalRequests) * 100;

    // Calculate percentiles
    const getPercentile = (arr: number[], percentile: number): number => {
      const index = Math.ceil((percentile / 100) * arr.length) - 1;
      return arr[Math.max(0, index)] || 0;
    };

    const responseTimeDistribution: ResponseTimeDistribution = {
      p50: getPercentile(responseTimes, 50),
      p75: getPercentile(responseTimes, 75),
      p90: getPercentile(responseTimes, 90),
      p95: getPercentile(responseTimes, 95),
      p99: getPercentile(responseTimes, 99),
    };

    // Calculate resource usage
    const resourceUsage: ResourceUsage = resourceHistory.length > 0 ? {
      peakCpuUsage: Math.max(...resourceHistory.map(r => r.peakCpuUsage)),
      averageCpuUsage: resourceHistory.reduce((sum, r) => sum + r.averageCpuUsage, 0) / resourceHistory.length,
      peakMemoryUsage: Math.max(...resourceHistory.map(r => r.peakMemoryUsage)),
      averageMemoryUsage: resourceHistory.reduce((sum, r) => sum + r.averageMemoryUsage, 0) / resourceHistory.length,
      networkIO: {
        bytesIn: resourceHistory.reduce((sum, r) => sum + r.networkIO.bytesIn, 0),
        bytesOut: resourceHistory.reduce((sum, r) => sum + r.networkIO.bytesOut, 0),
      },
    } : {
      peakCpuUsage: 0,
      averageCpuUsage: 0,
      peakMemoryUsage: 0,
      averageMemoryUsage: 0,
      networkIO: { bytesIn: 0, bytesOut: 0 },
    };

    // Status code distribution
    const statusCodeDistribution: Record<number, number> = {};
    requestResults.forEach(result => {
      statusCodeDistribution[result.statusCode] = (statusCodeDistribution[result.statusCode] || 0) + 1;
    });

    return {
      testName,
      startTime,
      endTime,
      duration,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      throughput,
      errorRate,
      responseTimeDistribution,
      resourceUsage,
      statusCodeDistribution,
    };
  }

  private evaluateThresholds(
    metrics: PerformanceMetrics,
    thresholds: PerformanceThresholds
  ): { passed: boolean; failedThresholds: string[] } {
    const failedThresholds: string[] = [];

    if (metrics.averageResponseTime > thresholds.averageResponseTime) {
      failedThresholds.push(`Average response time: ${metrics.averageResponseTime.toFixed(2)}ms > ${thresholds.averageResponseTime}ms`);
    }

    if (metrics.maxResponseTime > thresholds.maxResponseTime) {
      failedThresholds.push(`Max response time: ${metrics.maxResponseTime.toFixed(2)}ms > ${thresholds.maxResponseTime}ms`);
    }

    if (metrics.errorRate > thresholds.errorRate) {
      failedThresholds.push(`Error rate: ${metrics.errorRate.toFixed(2)}% > ${thresholds.errorRate}%`);
    }

    if (metrics.throughput < thresholds.throughput) {
      failedThresholds.push(`Throughput: ${metrics.throughput.toFixed(2)} RPS < ${thresholds.throughput} RPS`);
    }

    if (metrics.resourceUsage.peakCpuUsage > thresholds.cpuUsage) {
      failedThresholds.push(`Peak CPU usage: ${metrics.resourceUsage.peakCpuUsage.toFixed(2)}% > ${thresholds.cpuUsage}%`);
    }

    if (metrics.resourceUsage.peakMemoryUsage > thresholds.memoryUsage) {
      failedThresholds.push(`Peak memory usage: ${metrics.resourceUsage.peakMemoryUsage.toFixed(2)}MB > ${thresholds.memoryUsage}MB`);
    }

    return {
      passed: failedThresholds.length === 0,
      failedThresholds,
    };
  }

  private generateRecommendations(metrics: PerformanceMetrics, config: PerformanceTestConfig): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (metrics.averageResponseTime > 1000) {
      recommendations.push('Consider implementing caching strategies to reduce response times');
      recommendations.push('Review database query performance and add appropriate indexes');
    }

    // Throughput recommendations
    if (metrics.throughput < config.thresholds.throughput * 0.8) {
      recommendations.push('Consider implementing connection pooling for better throughput');
      recommendations.push('Review application bottlenecks and optimize critical paths');
    }

    // Error rate recommendations
    if (metrics.errorRate > 2) {
      recommendations.push('Investigate and fix the root cause of request failures');
      recommendations.push('Implement better error handling and retry mechanisms');
    }

    // Resource usage recommendations
    if (metrics.resourceUsage.peakCpuUsage > 80) {
      recommendations.push('Consider CPU optimization or scaling to handle the load');
    }

    if (metrics.resourceUsage.peakMemoryUsage > 512) {
      recommendations.push('Review memory usage patterns and implement memory optimization');
    }

    // Response time distribution recommendations
    if (metrics.responseTimeDistribution.p95 > metrics.averageResponseTime * 3) {
      recommendations.push('High response time variance detected - investigate outliers');
    }

    return recommendations;
  }

  // Report generation
  async generatePerformanceReport(testName?: string): Promise<string> {
    const results = testName 
      ? [this.testResults.get(testName)].filter(Boolean)
      : Array.from(this.testResults.values());

    if (results.length === 0) {
      return 'No performance test results available.';
    }

    let report = `
# Performance Testing Report

## Executive Summary
- Total Tests Executed: ${results.length}
- Tests Passed: ${results.filter(r => r!.passed).length}
- Tests Failed: ${results.filter(r => !r!.passed).length}

`;

    results.forEach(result => {
      if (!result) return;

      report += `
## ${result.config.testName}

### Configuration
- Concurrent Users: ${result.config.concurrentUsers}
- Test Duration: ${result.config.duration / 1000}s
- Ramp-up Time: ${result.config.rampUpTime / 1000}s

### Results
- **Status**: ${result.passed ? '✅ PASSED' : '❌ FAILED'}
- **Total Requests**: ${result.metrics.totalRequests}
- **Successful Requests**: ${result.metrics.successfulRequests}
- **Failed Requests**: ${result.metrics.failedRequests}
- **Error Rate**: ${result.metrics.errorRate.toFixed(2)}%
- **Average Response Time**: ${result.metrics.averageResponseTime.toFixed(2)}ms
- **Throughput**: ${result.metrics.throughput.toFixed(2)} RPS

### Response Time Distribution
- **50th percentile**: ${result.metrics.responseTimeDistribution.p50.toFixed(2)}ms
- **75th percentile**: ${result.metrics.responseTimeDistribution.p75.toFixed(2)}ms
- **90th percentile**: ${result.metrics.responseTimeDistribution.p90.toFixed(2)}ms
- **95th percentile**: ${result.metrics.responseTimeDistribution.p95.toFixed(2)}ms
- **99th percentile**: ${result.metrics.responseTimeDistribution.p99.toFixed(2)}ms

### Resource Usage
- **Peak CPU Usage**: ${result.metrics.resourceUsage.peakCpuUsage.toFixed(2)}%
- **Average CPU Usage**: ${result.metrics.resourceUsage.averageCpuUsage.toFixed(2)}%
- **Peak Memory Usage**: ${result.metrics.resourceUsage.peakMemoryUsage.toFixed(2)}MB
- **Average Memory Usage**: ${result.metrics.resourceUsage.averageMemoryUsage.toFixed(2)}MB

### Failed Thresholds
${result.failedThresholds.length > 0 
  ? result.failedThresholds.map(threshold => `- ${threshold}`).join('\n')
  : '- None (all thresholds passed)'
}

### Recommendations
${result.recommendations.length > 0
  ? result.recommendations.map(rec => `- ${rec}`).join('\n')
  : '- No specific recommendations'
}

`;
    });

    return report;
  }

  // Public API
  getTestResults(): Map<string, LoadTestResult> {
    return new Map(this.testResults);
  }

  getActiveTest(): PerformanceTestConfig | null {
    return this.activeTest;
  }

  isTestRunning(): boolean {
    return this.isRunning;
  }

  clearResults(): void {
    this.testResults.clear();
    console.log('🧹 Performance test results cleared');
  }
}

// Export singleton instance
export const performanceTesting = PerformanceTestingManager.getInstance();

// Export types and utilities
export {
  PerformanceTestingManager,
  type PerformanceTestConfig,
  type PerformanceMetrics,
  type LoadTestResult,
  type TestScenario,
};