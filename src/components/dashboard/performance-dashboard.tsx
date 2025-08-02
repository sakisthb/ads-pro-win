"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Activity, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Cpu, 
  HardDrive, 
  Wifi,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Settings
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PerformanceMetric {
  id: string
  name: string
  value: number
  unit: string
  status: "excellent" | "good" | "warning" | "critical"
  trend: "up" | "down" | "stable"
  change: number
  target?: number
}

interface SystemHealth {
  overall: "excellent" | "good" | "warning" | "critical"
  uptime: string
  lastUpdate: Date
  metrics: PerformanceMetric[]
}

const mockPerformanceData: SystemHealth = {
  overall: "excellent",
  uptime: "99.8%",
  lastUpdate: new Date(),
  metrics: [
    {
      id: "response_time",
      name: "API Response Time",
      value: 142,
      unit: "ms",
      status: "excellent",
      trend: "down",
      change: -12,
      target: 200
    },
    {
      id: "throughput",
      name: "Requests/sec",
      value: 1847,
      unit: "req/s",
      status: "good",
      trend: "up",
      change: 8.3
    },
    {
      id: "error_rate",
      name: "Error Rate",
      value: 0.12,
      unit: "%",
      status: "excellent",
      trend: "down",
      change: -0.05,
      target: 1.0
    },
    {
      id: "cpu_usage",
      name: "CPU Usage",
      value: 23.5,
      unit: "%",
      status: "excellent",
      trend: "stable",
      change: 0.1,
      target: 80
    },
    {
      id: "memory_usage",
      name: "Memory Usage",
      value: 45.2,
      unit: "%",
      status: "good",
      trend: "up",
      change: 3.2,
      target: 85
    },
    {
      id: "disk_usage",
      name: "Disk I/O",
      value: 12.8,
      unit: "MB/s",
      status: "excellent",
      trend: "stable",
      change: 0.5
    },
    {
      id: "network_latency",
      name: "Network Latency",
      value: 28,
      unit: "ms",
      status: "excellent",
      trend: "down",
      change: -2.1,
      target: 100
    },
    {
      id: "cache_hit_rate",
      name: "Cache Hit Rate",
      value: 94.7,
      unit: "%",
      status: "excellent",
      trend: "up",
      change: 1.2,
      target: 90
    }
  ]
}

const statusConfig = {
  excellent: {
    color: "bg-green-500",
    textColor: "text-green-600",
    bgColor: "bg-green-50",
    icon: CheckCircle,
    label: "Excellent"
  },
  good: {
    color: "bg-blue-500",
    textColor: "text-blue-600", 
    bgColor: "bg-blue-50",
    icon: CheckCircle,
    label: "Good"
  },
  warning: {
    color: "bg-yellow-500",
    textColor: "text-yellow-600",
    bgColor: "bg-yellow-50", 
    icon: AlertTriangle,
    label: "Warning"
  },
  critical: {
    color: "bg-red-500",
    textColor: "text-red-600",
    bgColor: "bg-red-50",
    icon: AlertTriangle,
    label: "Critical"
  }
}

function MetricCard({ metric }: { metric: PerformanceMetric }) {
  const config = statusConfig[metric.status]
  const StatusIcon = config.icon
  const TrendIcon = metric.trend === "up" ? TrendingUp : metric.trend === "down" ? TrendingDown : Activity

  const progressValue = metric.target ? (metric.value / metric.target) * 100 : 0

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {metric.name}
          </CardTitle>
          <div className="flex items-center space-x-1">
            <Badge variant="outline" className={cn("text-xs", config.textColor, config.bgColor)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-baseline space-x-1">
              <span className="text-2xl font-bold">
                {metric.value.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                {metric.unit}
              </span>
            </div>
            
            <div className="flex items-center space-x-1 text-xs">
              <TrendIcon className={cn(
                "w-3 h-3",
                metric.trend === "up" && metric.change > 0 && "text-green-500",
                metric.trend === "down" && metric.change < 0 && "text-green-500",
                metric.trend === "up" && metric.change < 0 && "text-red-500",
                metric.trend === "down" && metric.change > 0 && "text-red-500",
                metric.trend === "stable" && "text-gray-500"
              )} />
              <span className={cn(
                "font-medium",
                metric.change > 0 && metric.trend === "up" && "text-green-600",
                metric.change < 0 && metric.trend === "down" && "text-green-600",
                metric.change > 0 && metric.trend === "down" && "text-red-600",
                metric.change < 0 && metric.trend === "up" && "text-red-600",
                metric.trend === "stable" && "text-gray-600"
              )}>
                {metric.change > 0 ? "+" : ""}{metric.change}
                {metric.unit === "%" ? "pp" : metric.unit === "ms" ? "ms" : "%"}
              </span>
              <span className="text-muted-foreground">vs last hour</span>
            </div>
          </div>
        </div>

        {metric.target && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress to target</span>
              <span>{metric.target} {metric.unit}</span>
            </div>
            <Progress 
              value={Math.min(progressValue, 100)} 
              className={cn(
                "h-2",
                metric.status === "excellent" && "[&>div]:bg-green-500",
                metric.status === "good" && "[&>div]:bg-blue-500", 
                metric.status === "warning" && "[&>div]:bg-yellow-500",
                metric.status === "critical" && "[&>div]:bg-red-500"
              )}
            />
          </div>
        )}
      </CardContent>
      
      {/* Status indicator */}
      <div className={cn("absolute top-0 left-0 w-1 h-full", config.color)} />
    </Card>
  )
}

export function PerformanceDashboard() {
  const [data, setData] = useState<SystemHealth>(mockPerformanceData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const refreshData = async () => {
    setIsRefreshing(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Update with slightly varied data
    const updatedData = {
      ...data,
      lastUpdate: new Date(),
      metrics: data.metrics.map(metric => ({
        ...metric,
        value: metric.value + (Math.random() - 0.5) * metric.value * 0.1,
        change: (Math.random() - 0.5) * 10
      }))
    }
    
    setData(updatedData)
    setLastRefresh(new Date())
    setIsRefreshing(false)
  }

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshData, 30000)
    return () => clearInterval(interval)
  }, [])

  const overallConfig = statusConfig[data.overall]
  const OverallIcon = overallConfig.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Performance Monitor</h2>
          <p className="text-muted-foreground">
            Real-time system performance and health metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={refreshData} disabled={isRefreshing}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Details
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <OverallIcon className={cn("w-5 h-5", overallConfig.textColor)} />
              <CardTitle>System Health: {overallConfig.label}</CardTitle>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>Uptime: {data.uptime}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Activity className="w-4 h-4" />
                <span>Last update: {lastRefresh.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "p-4 rounded-lg border-l-4",
            overallConfig.bgColor,
            overallConfig.color.replace("bg-", "border-l-")
          )}>
            <p className="text-sm">
              All systems are operating within normal parameters. 
              Performance metrics are {data.overall === "excellent" ? "exceeding" : "meeting"} targets.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription>
            Common performance optimization tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <Zap className="w-6 h-6" />
              <span>Clear Cache</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <Cpu className="w-6 h-6" />
              <span>Optimize CPU</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <HardDrive className="w-6 h-6" />
              <span>Clean Storage</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}