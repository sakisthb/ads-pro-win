'use client'

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Brain, Target, Zap, BarChart3, ExternalLink, Users, DollarSign, TrendingUp, Settings, Eye, Download } from "lucide-react";

// Lazy load performance-critical components with AI integration
const DashboardContent = dynamic(() => import("@/components/DashboardContent"), {
  ssr: false,
  loading: () => (
    <Card className="animate-pulse">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  ),
});

const AnalyticsWidget = dynamic(() => import("@/components/AnalyticsWidget"), {
  ssr: false,
  loading: () => (
    <Card className="animate-pulse">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </CardContent>
    </Card>
  ),
});

const CampaignManager = dynamic(() => import("@/components/CampaignManager"), {
  ssr: false,
  loading: () => (
    <Card className="animate-pulse">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  ),
});

// AI Components - Lazy loaded
const AIWorkspace = dynamic(() => import("@/components/ai").then(mod => mod.AIWorkspace), {
  ssr: false,
  loading: () => (
    <Card className="animate-pulse">
      <CardContent className="p-6">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
      </CardContent>
    </Card>
  ),
});

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-gray-600 dark:text-gray-300">Loading Ads Pro Enterprise...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Ads Pro Enterprise
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">AI-Powered Marketing Intelligence</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="hidden sm:flex">
                {process.env.NODE_ENV === 'development' ? '🔧 Development' : '🚀 Production'}
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-1 mt-4">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'campaigns', label: 'Campaigns', icon: Target },
              { id: 'analytics', label: 'Analytics', icon: Activity },
              { id: 'ai-workspace', label: 'AI Workspace', icon: Brain },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </Button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Active Campaigns</p>
                      <p className="text-3xl font-bold">247</p>
                      <p className="text-blue-200 text-xs">+12% vs last month</p>
                    </div>
                    <Target className="w-8 h-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">Revenue</p>
                      <p className="text-3xl font-bold">$127K</p>
                      <p className="text-green-200 text-xs">+8% vs last month</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">AI Operations</p>
                      <p className="text-3xl font-bold">1,247</p>
                      <p className="text-purple-200 text-xs">+23% vs last month</p>
                    </div>
                    <Brain className="w-8 h-8 text-purple-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm">Conversion Rate</p>
                      <p className="text-3xl font-bold">12.4%</p>
                      <p className="text-orange-200 text-xs">+3.2% vs last month</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-orange-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Dashboard Components */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2">
                <DashboardContent />
              </div>
              <div className="space-y-6">
                <AnalyticsWidget />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Campaign Management</h2>
                <p className="text-gray-600 dark:text-gray-400">Manage and optimize your marketing campaigns</p>
              </div>
              <Button>
                <Target className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            </div>
            <CampaignManager />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
                <p className="text-gray-600 dark:text-gray-400">Real-time insights and performance metrics</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AnalyticsWidget />
              <AnalyticsWidget />
            </div>
          </div>
        )}

        {activeTab === 'ai-workspace' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">AI Workspace</h2>
                <p className="text-gray-600 dark:text-gray-400">Advanced AI-powered tools and automation</p>
              </div>
              <Button>
                <Brain className="w-4 h-4 mr-2" />
                New AI Task
              </Button>
            </div>
            <AIWorkspace />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-600" />
              <span>Ads Pro Enterprise</span>
              <Badge variant="outline" className="text-xs">v3.0.0</Badge>
            </div>
            <div className="flex items-center gap-4">
              <span>© 2025 All rights reserved</span>
              <Button variant="ghost" size="sm" asChild>
                <a href="/ai-demo" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  AI Demo
                </a>
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}