"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Brain,
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Lightbulb,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Play,
  Pause,
  Settings,
  ExternalLink,
  ArrowRight,
  Star,
  Flame,
  Shield
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AIInsight {
  id: string
  type: "prediction" | "optimization" | "anomaly" | "recommendation" | "alert"
  title: string
  description: string
  confidence: number
  impact: "high" | "medium" | "low"
  urgency: "critical" | "high" | "medium" | "low"
  category: string
  data: any
  actionable: boolean
  autoImplementable: boolean
  estimatedRevenue?: number
  timeToImplement?: string
  createdAt: Date
}

interface PredictionModel {
  id: string
  name: string
  accuracy: number
  lastTrained: Date
  status: "active" | "training" | "outdated"
  predictions: number
}

const mockInsights: AIInsight[] = [
  {
    id: "1",
    type: "prediction", 
    title: "Revenue Spike Predicted",
    description: "Based on seasonal patterns and current campaign performance, we predict a 34% revenue increase in the next 7 days.",
    confidence: 87,
    impact: "high",
    urgency: "medium",
    category: "Revenue Forecasting",
    data: { predictedIncrease: 34, timeframe: "7 days", probability: 87 },
    actionable: true,
    autoImplementable: false,
    estimatedRevenue: 42750,
    timeToImplement: "2 hours",
    createdAt: new Date()
  },
  {
    id: "2",
    type: "optimization",
    title: "Budget Reallocation Opportunity", 
    description: "Moving $2,500 from Facebook to Google Ads could increase overall ROAS by 0.8x based on current performance trends.",
    confidence: 92,
    impact: "high",
    urgency: "high",
    category: "Budget Optimization",
    data: { currentRoas: 4.2, predictedRoas: 5.0, budgetMove: 2500 },
    actionable: true,
    autoImplementable: true,
    estimatedRevenue: 18500,
    timeToImplement: "5 minutes",
    createdAt: new Date()
  },
  {
    id: "3",
    type: "anomaly",
    title: "Unusual CTR Drop Detected",
    description: "Campaign 'Holiday Sale 2025' shows 23% CTR decrease compared to historical performance. Possible creative fatigue.",
    confidence: 95,
    impact: "medium", 
    urgency: "high",
    category: "Performance Monitoring",
    data: { ctrDrop: 23, campaign: "Holiday Sale 2025", suspectedCause: "creative fatigue" },
    actionable: true,
    autoImplementable: false,
    timeToImplement: "1 hour",
    createdAt: new Date()
  },
  {
    id: "4",
    type: "recommendation",
    title: "New Audience Segment Opportunity",
    description: "AI identified a high-value lookalike audience with 4.5x higher conversion rate. Potential reach: 250K users.",
    confidence: 84,
    impact: "high",
    urgency: "medium", 
    category: "Audience Targeting",
    data: { conversionRate: 4.5, reach: 250000, similarity: 84 },
    actionable: true,
    autoImplementable: false,
    estimatedRevenue: 67500,
    timeToImplement: "30 minutes",
    createdAt: new Date()
  },
  {
    id: "5", 
    type: "alert",
    title: "Competitive Price Change Alert",
    description: "Key competitor reduced prices by 15% for similar products. Consider adjusting pricing strategy to maintain market position.",
    confidence: 100,
    impact: "medium",
    urgency: "critical",
    category: "Competitive Intelligence", 
    data: { competitorPriceChange: -15, affectedProducts: 12 },
    actionable: true,
    autoImplementable: false,
    timeToImplement: "2 hours",
    createdAt: new Date()
  }
]

const mockModels: PredictionModel[] = [
  {
    id: "1",
    name: "Revenue Prediction Model",
    accuracy: 89.4,
    lastTrained: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: "active",
    predictions: 1247
  },
  {
    id: "2", 
    name: "Campaign Performance Model",
    accuracy: 92.7,
    lastTrained: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: "active",
    predictions: 2847
  },
  {
    id: "3",
    name: "Audience Segmentation Model",
    accuracy: 85.2,
    lastTrained: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    status: "outdated",
    predictions: 847
  },
  {
    id: "4",
    name: "Anomaly Detection Model", 
    accuracy: 94.8,
    lastTrained: new Date(Date.now() - 12 * 60 * 60 * 1000),
    status: "active",
    predictions: 3472
  }
]

const insightConfig = {
  prediction: {
    icon: Brain,
    color: "bg-blue-500",
    textColor: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200"
  },
  optimization: {
    icon: Zap,
    color: "bg-yellow-500", 
    textColor: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200"
  },
  anomaly: {
    icon: AlertTriangle,
    color: "bg-red-500",
    textColor: "text-red-600",
    bgColor: "bg-red-50", 
    borderColor: "border-red-200"
  },
  recommendation: {
    icon: Lightbulb,
    color: "bg-green-500",
    textColor: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200"
  },
  alert: {
    icon: AlertTriangle,
    color: "bg-orange-500",
    textColor: "text-orange-600", 
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200"
  }
}

const impactConfig = {
  high: { color: "text-red-600", icon: Flame },
  medium: { color: "text-yellow-600", icon: Star },
  low: { color: "text-green-600", icon: CheckCircle }
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const config = insightConfig[insight.type]
  const impactConf = impactConfig[insight.impact]
  const IconComponent = config.icon
  const ImpactIcon = impactConf.icon

  return (
    <Card className={cn("relative overflow-hidden transition-all hover:shadow-md", config.borderColor, "border-l-4")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <IconComponent className={cn("w-5 h-5", config.textColor)} />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base leading-tight">{insight.title}</CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className={cn(config.textColor, config.bgColor)}>
                  {insight.type}
                </Badge>
                <Badge variant="outline" className={cn(impactConf.color)}>
                  <ImpactIcon className="w-3 h-3 mr-1" />
                  {insight.impact} impact
                </Badge>
                <Badge variant="outline">
                  {insight.confidence}% confidence
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right space-y-1">
            {insight.estimatedRevenue && (
              <div className="font-semibold text-green-600">
                +${insight.estimatedRevenue.toLocaleString()}
              </div>
            )}
            {insight.timeToImplement && (
              <div className="text-xs text-muted-foreground">
                {insight.timeToImplement} to implement
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {insight.description}
        </p>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Confidence Level</span>
            <span>{insight.confidence}%</span>
          </div>
          <Progress value={insight.confidence} className="h-2" />
        </div>

        {insight.actionable && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center space-x-2">
              {insight.autoImplementable && (
                <Badge variant="secondary" className="text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  Auto-implementable
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{insight.category}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Button size="sm" variant="outline">
                View Details
              </Button>
              {insight.autoImplementable ? (
                <Button size="sm">
                  <Play className="w-3 h-3 mr-1" />
                  Auto-Apply
                </Button>
              ) : (
                <Button size="sm">
                  <ArrowRight className="w-3 h-3 mr-1" />
                  Implement
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ModelStatus({ models }: { models: PredictionModel[] }) {
  return (
    <div className="space-y-4">
      {models.map((model) => (
        <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h4 className="font-semibold">{model.name}</h4>
              <Badge variant={
                model.status === "active" ? "default" : 
                model.status === "training" ? "secondary" : "destructive"
              }>
                {model.status}
              </Badge>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Accuracy: {model.accuracy}%</span>
              <span>Predictions: {model.predictions.toLocaleString()}</span>
              <span>Last trained: {model.lastTrained.toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {model.status === "outdated" && (
              <Button size="sm" variant="outline">
                <RefreshCw className="w-3 h-3 mr-1" />
                Retrain
              </Button>
            )}
            <Button size="sm" variant="outline">
              <Settings className="w-3 h-3 mr-1" />
              Configure
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AIInsightsCenter() {
  const [insights, setInsights] = useState<AIInsight[]>(mockInsights)
  const [models, setModels] = useState<PredictionModel[]>(mockModels)
  const [isGenerating, setIsGenerating] = useState(false)
  const [filter, setFilter] = useState<string>("all")

  const generateNewInsights = async () => {
    setIsGenerating(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    // Simulate new insights generation
    setIsGenerating(false)
  }

  const filteredInsights = insights.filter(insight => 
    filter === "all" || insight.type === filter
  )

  const totalEstimatedRevenue = insights
    .filter(i => i.estimatedRevenue)
    .reduce((sum, i) => sum + (i.estimatedRevenue || 0), 0)

  const activeModels = models.filter(m => m.status === "active").length
  const avgAccuracy = models.reduce((sum, m) => sum + m.accuracy, 0) / models.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Insights Center</h2>
          <p className="text-muted-foreground">
            Predictive analytics and intelligent optimization recommendations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={generateNewInsights} disabled={isGenerating}>
            <Sparkles className={cn("w-4 h-4 mr-2", isGenerating && "animate-pulse")} />
            {isGenerating ? "Generating..." : "Generate Insights"}
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            AI Settings
          </Button>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Model Hub
          </Button>
        </div>
      </div>

      {/* AI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Brain className="w-4 h-4 mr-2" />
              Active Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.length}</div>
            <div className="text-xs text-muted-foreground">
              {insights.filter(i => i.urgency === "critical" || i.urgency === "high").length} high priority
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              Revenue Potential
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEstimatedRevenue.toLocaleString()}</div>
            <div className="text-xs text-green-600">
              From actionable insights
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Model Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgAccuracy.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              Across {activeModels} active models
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Auto-Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights.filter(i => i.autoImplementable).length}
            </div>
            <div className="text-xs text-blue-600">
              Ready to auto-implement
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium">Filter by type:</span>
        {["all", "prediction", "optimization", "recommendation", "anomaly", "alert"].map((type) => (
          <Button
            key={type}
            variant={filter === type ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(type)}
          >
            {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
          </Button>
        ))}
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredInsights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>

      {/* AI Models Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="w-5 h-5 mr-2" />
            AI Models Status
          </CardTitle>
          <CardDescription>
            Overview of prediction models and their performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModelStatus models={models} />
        </CardContent>
      </Card>
    </div>
  )
}