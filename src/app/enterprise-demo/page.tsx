'use client'

import { ProtectedLayout } from '@/components/layouts/ProtectedLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Eye, 
  BarChart3, 
  Target,
  Brain,
  Zap,
  Activity,
  Sparkles 
} from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';

const statsCards = [
  {
    title: "Active Campaigns",
    value: "12",
    change: "+2.5%",
    changeType: "positive" as const,
    icon: Target,
    description: "Running campaigns"
  },
  {
    title: "Total Revenue",
    value: "$45,231",
    change: "+12.3%",
    changeType: "positive" as const,
    icon: DollarSign,
    description: "This month"
  },
  {
    title: "Conversion Rate",
    value: "3.24%",
    change: "+0.8%",
    changeType: "positive" as const,
    icon: TrendingUp,
    description: "Last 30 days"
  },
  {
    title: "Active Users",
    value: "2,845",
    change: "-1.2%",
    changeType: "negative" as const,
    icon: Users,
    description: "Daily active"
  }
];

const aiFeatures = [
  {
    title: "Smart Optimization",
    description: "AI-powered campaign optimization with real-time adjustments",
    icon: Brain,
    status: "Active",
    color: "green"
  },
  {
    title: "Predictive Analytics",
    description: "Forecast campaign performance and audience behavior",
    icon: Sparkles,
    status: "Learning",
    color: "blue"
  },
  {
    title: "Auto-Bidding",
    description: "Automated bid management for maximum ROI",
    icon: Zap,
    status: "Active",
    color: "green"
  },
  {
    title: "Performance Monitor",
    description: "Real-time monitoring with smart alerts",
    icon: Activity,
    status: "Monitoring",
    color: "orange"
  }
];

export default function EnterpriseDemo() {
  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Enterprise Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Professional SaaS layout with advanced navigation and AI-powered insights
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Live Demo
            </Badge>
            <Badge variant="outline">
              New Layout
            </Badge>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((stat, index) => (
            <Card key={index} className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 hover:bg-white/70 dark:hover:bg-gray-900/70 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</div>
                <div className="flex items-center space-x-2 text-xs">
                  <span className={`font-medium ${
                    stat.changeType === 'positive' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">{stat.description}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI Features Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* AI Features */}
          <Card className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                AI-Powered Features
              </CardTitle>
              <CardDescription>
                Advanced automation and intelligence for your campaigns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiFeatures.map((feature, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                  <feature.icon className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {feature.title}
                      </h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          feature.color === 'green' ? 'border-green-500 text-green-700 dark:text-green-400' :
                          feature.color === 'blue' ? 'border-blue-500 text-blue-700 dark:text-blue-400' :
                          'border-orange-500 text-orange-700 dark:text-orange-400'
                        }`}
                      >
                        {feature.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Performance Chart Placeholder */}
          <Card className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                Performance Overview
              </CardTitle>
              <CardDescription>
                Real-time campaign performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                <div className="text-center">
                  <Eye className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Advanced Chart Component
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Real-time data visualization coming soon
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <Card className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
          <CardHeader>
            <CardTitle>Layout Features Showcase</CardTitle>
            <CardDescription>
              Test the new enterprise layout components and navigation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
                <Target className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
              <Button variant="outline">
                <BarChart3 className="w-4 h-4 mr-2" />
                View Analytics
              </Button>
              <Button variant="outline">
                <Brain className="w-4 h-4 mr-2" />
                AI Insights
              </Button>
              <Button variant="secondary">
                <Zap className="w-4 h-4 mr-2" />
                Quick Optimize
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toast Container */}
      <Toaster />
    </ProtectedLayout>
  );
}