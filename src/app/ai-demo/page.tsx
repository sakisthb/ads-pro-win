"use client";

// AI Demo Page - Demonstration of AI Components Integration
// Shows all AI components working with real-time WebSocket connections

import React from 'react';
import { AIWorkspace } from '@/components/ai';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Zap, Palette, BarChart3, Activity } from 'lucide-react';

export default function AIDemoPage() {
  // Demo organization ID (in real app, this would come from auth context)
  const demoOrganizationId = "demo-org-123";
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Demo Header */}
        <div className="mb-8">
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-blue-900 dark:text-blue-100">
                    AI-Powered Campaign Workspace Demo
                  </CardTitle>
                  <CardDescription className="text-blue-700 dark:text-blue-300">
                    Experience the full suite of AI tools for campaign analysis, optimization, and creative generation
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="outline" className="text-purple-600 border-purple-600">
                  <Brain className="h-3 w-3 mr-1" />
                  AI Analysis
                </Badge>
                <Badge variant="outline" className="text-pink-600 border-pink-600">
                  <Palette className="h-3 w-3 mr-1" />
                  Creative Generation
                </Badge>
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  <Zap className="h-3 w-3 mr-1" />
                  Performance Optimization
                </Badge>
                <Badge variant="outline" className="text-blue-600 border-blue-600">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Real-Time Analytics
                </Badge>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Activity className="h-3 w-3 mr-1" />
                  WebSocket Integration
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Demo Features List */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Demo Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 border border-purple-200 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <Brain className="h-8 w-8 text-purple-600 mb-2" />
                  <h3 className="font-medium text-purple-900 dark:text-purple-100">Campaign Analysis</h3>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    Real-time AI analysis with multiple providers (OpenAI, Anthropic, Google)
                  </p>
                </div>
                
                <div className="p-4 border border-pink-200 rounded-lg bg-pink-50 dark:bg-pink-900/20">
                  <Palette className="h-8 w-8 text-pink-600 mb-2" />
                  <h3 className="font-medium text-pink-900 dark:text-pink-100">Creative Generation</h3>
                  <p className="text-sm text-pink-700 dark:text-pink-300">
                    Platform-specific creative content with audience targeting
                  </p>
                </div>
                
                <div className="p-4 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <Zap className="h-8 w-8 text-orange-600 mb-2" />
                  <h3 className="font-medium text-orange-900 dark:text-orange-100">Optimization</h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Performance optimization with before/after projections
                  </p>
                </div>
                
                <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <BarChart3 className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-medium text-blue-900 dark:text-blue-100">Analytics</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Live metrics dashboard with auto-refresh and real-time updates
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <div className="mb-8">
          <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
            <CardHeader>
              <CardTitle className="text-lg text-green-900 dark:text-green-100">
                Demo Instructions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-green-700 dark:text-green-300 space-y-2">
                <p><strong>1. Real-Time Connection:</strong> Check the WebSocket status in the top-right corner</p>
                <p><strong>2. Campaign Selection:</strong> Select a campaign from the dropdown (demo data included)</p>
                <p><strong>3. AI Analysis:</strong> Use the "Campaign Analysis" tab to run AI-powered insights</p>
                <p><strong>4. Creative Generation:</strong> Try the "Creative Generation" tab for platform-specific content</p>
                <p><strong>5. Performance Optimization:</strong> Get optimization recommendations in the "Optimization" tab</p>
                <p><strong>6. Live Analytics:</strong> View real-time metrics and AI activities in the "Analytics" tab</p>
                <p><strong>Note:</strong> This is a demo environment. Some features may use mock data for demonstration purposes.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Workspace Component */}
        <AIWorkspace 
          organizationId={demoOrganizationId}
          defaultTab="analytics"
        />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>AI-Powered Campaign Workspace Demo - Phase 5 Task 2.2 Integration</p>
          <p>All AI components are connected to backend systems with real-time WebSocket updates</p>
        </div>
      </div>
    </div>
  );
}