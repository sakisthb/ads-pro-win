'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Brain, Target, Zap, BarChart3, ExternalLink, Users, DollarSign, TrendingUp } from "lucide-react";

export default function DevDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Brain className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Ads Pro Enterprise
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            AI-Powered Marketing Intelligence Platform - Development Demo
          </p>
          <Badge variant="secondary" className="mt-4">
            🚀 Development Version - All Features Available!
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100">Active Campaigns</p>
                  <p className="text-3xl font-bold">247</p>
                </div>
                <Target className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100">Revenue</p>
                  <p className="text-3xl font-bold">$127K</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100">AI Operations</p>
                  <p className="text-3xl font-bold">1,247</p>
                </div>
                <Brain className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100">Conversion Rate</p>
                  <p className="text-3xl font-bold">12.4%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feature Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* AI Analysis Panel */}
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-6 h-6 text-blue-600" />
                AI Campaign Analysis
              </CardTitle>
              <CardDescription>
                Real-time AI-powered insights and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="font-medium">Campaign Performance</span>
                <Badge variant="default">+23.5%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="font-medium">Cost Optimization</span>
                <Badge variant="secondary">-$2,340</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <span className="font-medium">Audience Insights</span>
                <Badge variant="outline">New Data</Badge>
              </div>
              <Button className="w-full" variant="outline">
                <BarChart3 className="w-4 h-4 mr-2" />
                View Detailed Analysis
              </Button>
            </CardContent>
          </Card>

          {/* Creative Generation */}
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-600" />
                Creative Generation
              </CardTitle>
              <CardDescription>
                AI-generated ad creatives and copy optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Generated Ad Copy:</p>
                  <p className="font-medium text-blue-600">"Transform your business with AI-powered insights..."</p>
                </div>
                <div className="p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Suggested Keywords:</p>
                  <p className="font-medium text-green-600">AI marketing, automation, ROI optimization</p>
                </div>
              </div>
              <Button className="w-full">
                <Target className="w-4 h-4 mr-2" />
                Generate New Creative
              </Button>
            </CardContent>
          </Card>

          {/* Real-time Analytics */}
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-600" />
                Real-time Analytics
              </CardTitle>
              <CardDescription>
                Live metrics and performance tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Click-through Rate</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div className="w-3/4 h-2 bg-green-500 rounded-full"></div>
                    </div>
                    <span className="text-sm font-medium">7.2%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>Conversion Rate</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div className="w-3/5 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                    <span className="text-sm font-medium">4.8%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>ROAS</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div className="w-4/5 h-2 bg-purple-500 rounded-full"></div>
                    </div>
                    <span className="text-sm font-medium">3.2x</span>
                  </div>
                </div>
              </div>
              <Button className="w-full" variant="outline">
                <Activity className="w-4 h-4 mr-2" />
                View Full Dashboard
              </Button>
            </CardContent>
          </Card>

          {/* Campaign Management */}
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-6 h-6 text-purple-600" />
                Campaign Management
              </CardTitle>
              <CardDescription>
                Intelligent campaign orchestration and optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Summer Sale Campaign</p>
                    <p className="text-sm text-gray-500">Active • 247 conversions</p>
                  </div>
                  <Badge>Running</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Black Friday Prep</p>
                    <p className="text-sm text-gray-500">Scheduled • Nov 20</p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              </div>
              <Button className="w-full">
                <Target className="w-4 h-4 mr-2" />
                Manage Campaigns
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="text-center mt-12 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              <ExternalLink className="w-5 h-5 mr-2" />
              View Full AI Demo
            </Button>
            <Button size="lg" variant="outline">
              <BarChart3 className="w-5 h-5 mr-2" />
              Analytics Dashboard
            </Button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            🎯 All AI features are functional and ready for testing
          </p>
        </div>

      </div>
    </div>
  );
}