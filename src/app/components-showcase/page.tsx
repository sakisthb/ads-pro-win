"use client"

import React, { useState } from "react"
import { ProtectedLayout } from "@/components/layouts/protected-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  BarChart3,
  Brain,
  Bell,
  Activity,
  Sparkles,
  Target,
  Zap,
  TrendingUp,
  Users,
  DollarSign
} from "lucide-react"

import { PerformanceDashboard } from "@/components/dashboard/performance-dashboard"
import { AdvancedAnalyticsHub } from "@/components/dashboard/advanced-analytics-hub"
import { AIInsightsCenter } from "@/components/dashboard/ai-insights-center"
import { NotificationCenter } from "@/components/dashboard/notification-center"

export default function ComponentsShowcase() {
  const [activeTab, setActiveTab] = useState("overview")

  const components = [
    {
      id: "performance",
      name: "Performance Dashboard",
      description: "Real-time system performance monitoring with metrics, alerts, and health indicators",
      icon: Activity,
      features: ["Real-time metrics", "Color-coded status", "Auto-refresh", "Quick actions"],
      status: "live",
      complexity: "high"
    },
    {
      id: "analytics", 
      name: "Advanced Analytics Hub",
      description: "Multi-dimensional analytics with funnel analysis, attribution modeling, and channel breakdown",
      icon: BarChart3,
      features: ["Multi-touch attribution", "Funnel analysis", "Channel breakdown", "Export functionality"],
      status: "live",
      complexity: "very-high"
    },
    {
      id: "ai-insights",
      name: "AI Insights Center", 
      description: "AI-powered predictions, optimizations, and intelligent recommendations",
      icon: Brain,
      features: ["Predictive analytics", "Auto-optimization", "Confidence scoring", "Revenue impact"],
      status: "live",
      complexity: "very-high"
    },
    {
      id: "notifications",
      name: "Notification Center",
      description: "Smart notification management with priority filtering and actionable alerts",
      icon: Bell,
      features: ["Smart filtering", "Action buttons", "Priority levels", "Read/unread management"],
      status: "live", 
      complexity: "high"
    }
  ]

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-bold tracking-tight">Components Showcase</h1>
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              Phase 2 Complete
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Advanced dashboard components with enterprise-grade functionality and AI-powered features
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{components.length}</div>
                  <div className="text-sm text-muted-foreground">Components</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">15+</div>
                  <div className="text-sm text-muted-foreground">Features</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                <div>
                  <div className="text-2xl font-bold">Real-time</div>
                  <div className="text-sm text-muted-foreground">Updates</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Brain className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold">AI-Powered</div>
                  <div className="text-sm text-muted-foreground">Intelligence</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Component Showcase */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-full max-w-2xl grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {components.map((component) => {
                const IconComponent = component.icon
                return (
                  <Card key={component.id} className="relative overflow-hidden">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <IconComponent className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{component.name}</CardTitle>
                            <CardDescription className="mt-1">
                              {component.description}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Badge variant={component.status === "live" ? "default" : "secondary"}>
                            {component.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {component.complexity}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Key Features:</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {component.features.map((feature) => (
                              <div key={feature} className="flex items-center space-x-2 text-sm">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={() => setActiveTab(component.id)}
                        >
                          View Component
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Phase 2 Achievements
                </CardTitle>
                <CardDescription>
                  What we accomplished in the Component Sophistication phase
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-green-600">✅ Performance Excellence</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Real-time monitoring dashboard</li>
                      <li>• Color-coded health indicators</li>
                      <li>• Auto-refresh capabilities</li>
                      <li>• Quick action buttons</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-600">✅ Analytics Sophistication</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Multi-dimensional analysis</li>
                      <li>• Attribution modeling</li>
                      <li>• Funnel visualization</li>
                      <li>• Channel breakdown</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold text-purple-600">✅ AI Intelligence</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Predictive analytics</li>
                      <li>• Smart recommendations</li>
                      <li>• Automated optimization</li>
                      <li>• Confidence scoring</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <PerformanceDashboard />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <AdvancedAnalyticsHub />
          </TabsContent>

          <TabsContent value="ai-insights" className="space-y-4">
            <AIInsightsCenter />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <NotificationCenter />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedLayout>
  )
}