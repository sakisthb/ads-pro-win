"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Download, 
  Calendar,
  DollarSign,
  Users,
  MousePointer,
  ShoppingCart,
  Target,
  Eye,
  Share2,
  Heart,
  MessageCircle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AnalyticsData {
  campaigns: CampaignMetrics[]
  channels: ChannelMetrics[]
  funnel: FunnelStage[]
  attribution: AttributionData[]
  timeframe: "7d" | "30d" | "90d"
}

interface CampaignMetrics {
  id: string
  name: string
  platform: string
  impressions: number
  clicks: number
  conversions: number
  spend: number
  ctr: number
  cpc: number
  roas: number
  status: "active" | "paused" | "completed"
  trend: "up" | "down" | "stable"
}

interface ChannelMetrics {
  channel: string
  sessions: number
  bounceRate: number
  avgSessionDuration: number
  pageViews: number
  goalCompletions: number
  revenue: number
  share: number
  growth: number
}

interface FunnelStage {
  stage: string
  visitors: number
  conversionRate: number
  dropOff: number
  value: number
}

interface AttributionData {
  touchpoint: string
  firstTouch: number
  lastTouch: number
  assisted: number
  totalValue: number
  efficiency: number
}

const mockAnalyticsData: AnalyticsData = {
  timeframe: "30d",
  campaigns: [
    {
      id: "1",
      name: "Holiday Sale 2025",
      platform: "Facebook",
      impressions: 2847392,
      clicks: 28474,
      conversions: 1423,
      spend: 12450,
      ctr: 1.0,
      cpc: 0.44,
      roas: 4.2,
      status: "active",
      trend: "up"
    },
    {
      id: "2", 
      name: "Q1 Brand Awareness",
      platform: "Google",
      impressions: 1923847,
      clicks: 34722,
      conversions: 2834,
      spend: 15200,
      ctr: 1.8,
      cpc: 0.44,
      roas: 5.7,
      status: "active",
      trend: "up"
    },
    {
      id: "3",
      name: "Retargeting Campaign",
      platform: "TikTok",
      impressions: 892847,
      clicks: 12847,
      conversions: 742,
      spend: 4200,
      ctr: 1.4,
      cpc: 0.33,
      roas: 3.8,
      status: "active", 
      trend: "stable"
    }
  ],
  channels: [
    {
      channel: "Paid Search",
      sessions: 145892,
      bounceRate: 23.4,
      avgSessionDuration: 245,
      pageViews: 524847,
      goalCompletions: 12847,
      revenue: 284750,
      share: 34.2,
      growth: 12.5
    },
    {
      channel: "Social Media",
      sessions: 128475,
      bounceRate: 45.2,
      avgSessionDuration: 180,
      pageViews: 398274,
      goalCompletions: 8472,
      revenue: 192847,
      share: 28.6,
      growth: 23.1
    },
    {
      channel: "Direct",
      sessions: 89472,
      bounceRate: 18.7,
      avgSessionDuration: 320,
      pageViews: 284750,
      goalCompletions: 9847,
      revenue: 247892,
      share: 21.4,
      growth: 8.7
    },
    {
      channel: "Email",
      sessions: 47382,
      bounceRate: 15.2,
      avgSessionDuration: 280,
      pageViews: 147382,
      goalCompletions: 5847,
      revenue: 138472,
      share: 15.8,
      growth: 15.3
    }
  ],
  funnel: [
    {
      stage: "Awareness",
      visitors: 1000000,
      conversionRate: 100,
      dropOff: 0,
      value: 0
    },
    {
      stage: "Interest", 
      visitors: 284750,
      conversionRate: 28.5,
      dropOff: 71.5,
      value: 850
    },
    {
      stage: "Consideration",
      visitors: 142375,
      conversionRate: 50.0,
      dropOff: 50.0,
      value: 2400
    },
    {
      stage: "Purchase",
      visitors: 28475,
      conversionRate: 20.0,
      dropOff: 80.0,
      value: 8900
    },
    {
      stage: "Retention",
      visitors: 11390,
      conversionRate: 40.0,
      dropOff: 60.0,
      value: 15600
    }
  ],
  attribution: [
    {
      touchpoint: "Paid Search",
      firstTouch: 45.2,
      lastTouch: 32.8,
      assisted: 28.5,
      totalValue: 294750,
      efficiency: 4.2
    },
    {
      touchpoint: "Social Media", 
      firstTouch: 28.4,
      lastTouch: 24.7,
      assisted: 38.2,
      totalValue: 187490,
      efficiency: 3.8
    },
    {
      touchpoint: "Email",
      firstTouch: 12.8,
      lastTouch: 35.2,
      assisted: 24.7,
      totalValue: 147382,
      efficiency: 5.7
    },
    {
      touchpoint: "Direct",
      firstTouch: 8.2,
      lastTouch: 7.3,
      assisted: 8.6,
      totalValue: 98472,
      efficiency: 6.2
    }
  ]
}

function CampaignTable({ campaigns }: { campaigns: CampaignMetrics[] }) {
  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <Card key={campaign.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h4 className="font-semibold">{campaign.name}</h4>
                <Badge variant="outline">{campaign.platform}</Badge>
                <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                  {campaign.status}
                </Badge>
              </div>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <span>CTR: {campaign.ctr}%</span>
                <span>CPC: ${campaign.cpc}</span>
                <span>ROAS: {campaign.roas}x</span>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center space-x-1">
                {campaign.trend === "up" ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : campaign.trend === "down" ? (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                ) : (
                  <BarChart3 className="w-4 h-4 text-gray-500" />
                )}
                <span className="font-semibold">${campaign.spend.toLocaleString()}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {campaign.conversions.toLocaleString()} conversions
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function ChannelBreakdown({ channels }: { channels: ChannelMetrics[] }) {
  const totalRevenue = channels.reduce((sum, channel) => sum + channel.revenue, 0)
  
  return (
    <div className="space-y-4">
      {channels.map((channel, index) => (
        <div key={channel.channel} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={cn(
                "w-3 h-3 rounded-full",
                index === 0 && "bg-blue-500",
                index === 1 && "bg-green-500", 
                index === 2 && "bg-yellow-500",
                index === 3 && "bg-purple-500"
              )} />
              <span className="font-medium">{channel.channel}</span>
              <Badge variant="outline">
                {channel.growth > 0 ? "+" : ""}{channel.growth}%
              </Badge>
            </div>
            <div className="text-right">
              <div className="font-semibold">${channel.revenue.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">{channel.share}% share</div>
            </div>
          </div>
          <Progress value={channel.share} className="h-2" />
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Sessions</div>
              <div className="font-medium">{channel.sessions.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Bounce Rate</div>
              <div className="font-medium">{channel.bounceRate}%</div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg Duration</div>
              <div className="font-medium">{Math.floor(channel.avgSessionDuration / 60)}m {channel.avgSessionDuration % 60}s</div>
            </div>
            <div>
              <div className="text-muted-foreground">Conversions</div>
              <div className="font-medium">{channel.goalCompletions.toLocaleString()}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function FunnelAnalysis({ funnel }: { funnel: FunnelStage[] }) {
  return (
    <div className="space-y-6">
      {funnel.map((stage, index) => {
        const isLast = index === funnel.length - 1
        const nextStage = !isLast ? funnel[index + 1] : null
        
        return (
          <div key={stage.stage} className="relative">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold",
                    index === 0 && "bg-blue-500",
                    index === 1 && "bg-green-500",
                    index === 2 && "bg-yellow-500", 
                    index === 3 && "bg-orange-500",
                    index === 4 && "bg-purple-500"
                  )}>
                    {index + 1}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold">{stage.stage}</h4>
                  <p className="text-sm text-muted-foreground">
                    {stage.visitors.toLocaleString()} visitors
                  </p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="font-semibold">{stage.conversionRate}%</div>
                <div className="text-sm text-muted-foreground">
                  {stage.dropOff > 0 && `${stage.dropOff}% drop-off`}
                </div>
                {stage.value > 0 && (
                  <div className="text-sm font-medium text-green-600">
                    ${stage.value.toLocaleString()} value
                  </div>
                )}
              </div>
            </div>
            
            {nextStage && (
              <div className="flex justify-center py-2">
                <ArrowDownRight className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function AdvancedAnalyticsHub() {
  const [data, setData] = useState<AnalyticsData>(mockAnalyticsData)
  const [activeTab, setActiveTab] = useState("overview")

  const totalSpend = data.campaigns.reduce((sum, campaign) => sum + campaign.spend, 0)
  const totalRevenue = data.channels.reduce((sum, channel) => sum + channel.revenue, 0)
  const totalRoas = totalRevenue / totalSpend

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Advanced Analytics</h2>
          <p className="text-muted-foreground">
            Multi-dimensional analysis and attribution modeling
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            {data.timeframe}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <div className="flex items-center text-sm text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              +12.5% vs last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ad Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpend.toLocaleString()}</div>
            <div className="flex items-center text-sm text-blue-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              +8.3% vs last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall ROAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRoas.toFixed(1)}x</div>
            <div className="flex items-center text-sm text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              +0.8x vs last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.campaigns.filter(c => c.status === "active").length}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Zap className="w-4 h-4 mr-1" />
              All performing well
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger> 
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Channel Performance</CardTitle>
                <CardDescription>Revenue contribution by channel</CardDescription>
              </CardHeader>
              <CardContent>
                <ChannelBreakdown channels={data.channels} />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Attribution Analysis</CardTitle>
                <CardDescription>Multi-touch attribution insights</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.attribution.map((attr) => (
                    <div key={attr.touchpoint} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{attr.touchpoint}</span>
                        <span className="text-sm text-muted-foreground">
                          ${attr.totalValue.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">First Touch</div>
                          <div className="font-medium">{attr.firstTouch}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Assisted</div>
                          <div className="font-medium">{attr.assisted}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Last Touch</div>
                          <div className="font-medium">{attr.lastTouch}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>Detailed campaign metrics and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <CampaignTable campaigns={data.campaigns} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Channel Deep Dive</CardTitle>
              <CardDescription>Comprehensive channel analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <ChannelBreakdown channels={data.channels} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
              <CardDescription>Customer journey analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <FunnelAnalysis funnel={data.funnel} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}